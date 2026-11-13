import type { Pool, PoolClient } from "pg";
import { trace } from "@opentelemetry/api";
import type { AuthContext } from "./auth.js";

export async function withTenantTransaction<T>(
  pool: Pool,
  auth: AuthContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!auth.activeOrganizationId) {
    throw Object.assign(new Error("Active organization is required for tenant-scoped database access"), { code: "TENANT_CONTEXT_REQUIRED" });
  }
  if (!auth.contextToken) {
    throw Object.assign(new Error("Authenticated request context grant is required"), { code: "TENANT_CONTEXT_GRANT_REQUIRED" });
  }
  const tracer = trace.getTracer("rupaykg-db");
  return tracer.startActiveSpan("rupaykg.db.tenant_transaction", async span => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("rupaykg.db.tenant_scoped", true);
    const client = await pool.connect();
    try {
    await client.query("begin");
    const membershipOk = auth.memberships.some((m) => m.status === "VERIFIED" && m.organization_id === auth.activeOrganizationId);
    if (!membershipOk) throw Object.assign(new Error("Verified organization membership is required"), { code: "TENANT_MEMBERSHIP_REQUIRED" });
    // Do not query organization_memberships before establishing tenant context:
    // its RLS policy correctly returns no rows without an authenticated context.
    // The bearer-session bootstrap and the opaque-grant setter already revalidate
    // the live session, identity and verified membership before tenant SQL begins.
    await client.query("select app.set_request_context($1,$2,$3)", [auth.identityId, auth.activeOrganizationId, auth.contextToken]);
    const result = await fn(client);
    await client.query("commit");
    span.setAttribute("db.transaction.status", "committed");
    span.end();
    return result;
  } catch (error) {
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setAttribute("db.transaction.status", "rolled_back");
    span.end();
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
    }
  });
}
