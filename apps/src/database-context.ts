import type { Pool, PoolClient } from "pg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantDatabaseContext = {
  identityId: string;
  organizationId: string;
};

export type TenantTransaction = <T>(
  context: TenantDatabaseContext,
  work: (client: PoolClient) => Promise<T>,
) => Promise<T>;

export function assertTenantDatabaseContext(context: TenantDatabaseContext): void {
  if (!UUID_RE.test(context.identityId)) {
    throw new Error("TENANT_DATABASE_CONTEXT_INVALID: identityId must be a UUID");
  }
  if (!UUID_RE.test(context.organizationId)) {
    throw new Error("TENANT_DATABASE_CONTEXT_INVALID: organizationId must be a UUID");
  }
}

/**
 * Execute tenant-scoped SQL on one checked-out connection.
 *
 * Identity and organization must be taken from the server-verified AuthContext,
 * never from request body/query parameters. Context is transaction-local so
 * pooled connections cannot retain a previous request's tenant.
 *
 * This is infrastructure only: callers must still perform application
 * authorization and must not assume RLS is enabled until a reviewed policy
 * migration has been applied.
 */
export function createTenantTransaction(pool: Pool): TenantTransaction {
  return async function withTenantTransaction<T>(context, work): Promise<T> {
    assertTenantDatabaseContext(context);
    const client = await pool.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query(
        "select set_config('rupaykg.identity_id', $1, true), set_config('rupaykg.organization_id', $2, true)",
        [context.identityId, context.organizationId],
      );
      const result = await work(client);
      await client.query("COMMIT");
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original failure; connection is released below.
        }
      }
      throw error;
    } finally {
      client.release();
    }
  };
}
