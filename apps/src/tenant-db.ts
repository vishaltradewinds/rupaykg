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
    await client.query("select app.set_request_context($1,$2)", [auth.identityId, auth.activeOrganizationId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
    }
  });
}
