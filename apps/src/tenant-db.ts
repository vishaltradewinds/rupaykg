import type { Pool, PoolClient } from "pg";
import type { AuthContext } from "./auth.js";

export async function withPlatformTransaction<T>(
  pool: Pool,
  identityId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!identityId) throw Object.assign(new Error("Platform identity is required"), { code: "PLATFORM_CONTEXT_REQUIRED" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select app.set_platform_context($1)", [identityId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}


export async function withTenantTransaction<T>(
  pool: Pool,
  auth: AuthContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!auth.activeOrganizationId) {
    throw Object.assign(new Error("Active organization is required for tenant-scoped database access"), { code: "TENANT_CONTEXT_REQUIRED" });
  }
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
}
