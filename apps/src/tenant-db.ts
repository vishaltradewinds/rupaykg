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
  const tracer = trace.getTracer("rupaykg-db");
  return tracer.startActiveSpan("rupaykg.db.tenant_transaction", async span => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("rupaykg.db.tenant_scoped", true);
    const client = await pool.connect();
    try {
    await client.query("begin");
    // This SECURITY DEFINER bootstrap validates the identity's verified membership
    // before setting transaction-local tenant context. It is the only permitted
    // pre-context membership boundary; all ordinary tenant queries follow it.
    await client.query("select app.set_request_context($1,$2)", [auth.identityId, auth.activeOrganizationId]);
    const membershipOk = auth.memberships.some((m) => m.status === "VERIFIED" && m.organization_id === auth.activeOrganizationId);
    if (!membershipOk) throw Object.assign(new Error("Verified organization membership is required"), { code: "TENANT_MEMBERSHIP_REQUIRED" });
    const membership = await client.query<{ ok: boolean }>(`select exists (select 1 from organization_memberships om
       join organizations o on o.id = om.organization_id and o.status = 'VERIFIED'
       where om.identity_id = $1 and om.organization_id = $2 and om.status = 'VERIFIED') as ok`, [auth.identityId, auth.activeOrganizationId]);
    if (!membership.rows[0]?.ok) throw Object.assign(new Error("Verified organization membership is required"), { code: "TENANT_MEMBERSHIP_REQUIRED" });
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
