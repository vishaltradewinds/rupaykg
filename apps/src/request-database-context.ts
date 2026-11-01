import type { Pool, PoolClient } from "pg";
import type { AuthContext } from "./auth.js";
import {
  createSignedRequestContextForAuth,
  type SignedRequestContextOptions,
} from "./signed-request-context-token.js";

export type RequestDatabasePool = Pick<Pool, "connect">;

/**
 * Executes all callback queries on one PostgreSQL connection and one transaction.
 * The signed tenant context is transaction-local, so it cannot leak to the next
 * request when the pooled connection is released.
 *
 * The database verifier and RLS policies must already be installed before this
 * function provides database-enforced tenant isolation. Without those policies,
 * set_config is only context propagation, not authorization.
 */
export async function withSignedRequestDatabaseContext<T>(
  pool: RequestDatabasePool,
  auth: AuthContext,
  options: SignedRequestContextOptions,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const token = createSignedRequestContextForAuth(auth, options);
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("begin");
    transactionStarted = true;
    await client.query("select set_config('app.request_context', $1, true)", [token]);
    const result = await work(client);
    await client.query("commit");
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original query/commit error; release still returns the
        // connection to pg.Pool, which discards it if the connection is broken.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
