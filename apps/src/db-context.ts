import type { Pool, PoolClient } from "pg";

export type DatabaseTenantContext = {
  identityId: string;
  organizationId?: string;
  bilateralOrganizationScope: boolean;
  serviceMode: boolean;
};

export type DatabaseContextClient = Pick<PoolClient, "query" | "release">;

function requireNonEmpty(value: string, name: string): string {
  if (!value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

/**
 * Executes work inside one PostgreSQL transaction and binds tenant/security
 * context with SET LOCAL semantics. SET LOCAL is transaction-scoped, so the
 * context cannot survive release of a pooled connection.
 *
 * This is intentionally an access-context primitive only. It does not enable
 * RLS or change production database policy state.
 */
export async function withDatabaseTenantContext<T>(
  pool: Pool,
  context: DatabaseTenantContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const identityId = requireNonEmpty(context.identityId, "identityId");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.rupaykg.identity_id', $1, true)", [identityId]);

    if (context.organizationId) {
      await client.query(
        "select set_config('app.rupaykg.organization_id', $1, true)",
        [requireNonEmpty(context.organizationId, "organizationId")],
      );
    }

    await client.query(
      "select set_config('app.rupaykg.bilateral_scope', $1, true)",
      [context.bilateralOrganizationScope === true ? "true" : "false"],
    );

    await client.query(
      "select set_config('app.rupaykg.service_mode', $1, true)",
      [context.serviceMode === true ? "true" : "false"],
    );

    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original application/database error.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Executes authentication/bootstrap work in an explicit PostgreSQL service context.
 * This context intentionally carries no organization scope and must remain limited
 * to control-plane bootstrap reads such as session, identity, and membership lookup.
 */
export async function withDatabaseBootstrapContext<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.rupaykg.bilateral_scope', 'false', true)");
    await client.query("select set_config('app.rupaykg.service_mode', 'false', true)");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally { client.release(); }
}
