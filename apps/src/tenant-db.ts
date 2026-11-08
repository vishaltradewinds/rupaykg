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


export async function withAuthorityTransaction<T>(
  pool: Pool,
  identityId: string,
  authorityLevel: string,
  geographyId: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!identityId || !authorityLevel) {
    throw Object.assign(new Error("Authority context is required"), { code: "AUTHORITY_CONTEXT_REQUIRED" });
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select app.set_authority_context($1,$2,$3)", [identityId, authorityLevel, geographyId]);
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
  if (!auth.memberships.some((m) => m.status === "VERIFIED" && m.organization_id === auth.activeOrganizationId)) {
    throw Object.assign(new Error("Active organization must have verified membership"), { code: "TENANT_MEMBERSHIP_REQUIRED" });
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const membership = await client.query<{ ok: boolean }>(
      "select exists (select 1 from organization_memberships where identity_id=$1 and organization_id=$2 and status='VERIFIED') as ok",
      [auth.identityId, auth.activeOrganizationId],
    );
    if (membership.rows[0]?.ok !== true) {
      throw Object.assign(new Error("Active organization must have verified membership in the authoritative database"), { code: "TENANT_MEMBERSHIP_REVOKED" });
    }
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
