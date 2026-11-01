import type { Pool, PoolClient } from "pg";
import type { AuthContext } from "./auth.js";
import { createSignedRequestContextToken } from "./signed-request-context-token.js";

export type RlsRequestContextConfig = {
  hmacSecret: string;
  keyId: string;
  ttlSeconds?: number;
};

export class RlsRequestContextError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "RlsRequestContextError";
  }
}

function requireVerifiedSingleOrganization(auth: AuthContext): string {
  if (!auth.activeOrganizationId) {
    throw new RlsRequestContextError(
      "A single active organization is required for an RLS transaction",
      "RLS_ORGANIZATION_CONTEXT_REQUIRED",
    );
  }
  if (auth.bilateralOrganizationScope) {
    throw new RlsRequestContextError(
      "Bilateral organization operations require a separately designed multi-party RLS context",
      "RLS_BILATERAL_CONTEXT_UNSUPPORTED",
    );
  }
  const membership = auth.memberships.find(
    (item) => item.organization_id === auth.activeOrganizationId && item.status === "VERIFIED",
  );
  if (!membership) {
    throw new RlsRequestContextError(
      "The active organization is not backed by a verified membership",
      "RLS_VERIFIED_MEMBERSHIP_REQUIRED",
    );
  }
  return auth.activeOrganizationId;
}

/**
 * Executes one request unit of work under a transaction-local signed tenant context.
 *
 * This function intentionally accepts a validated AuthContext rather than raw request
 * fields. The selected organization must have a VERIFIED membership. The GUC is set
 * with SET LOCAL semantics via set_config(..., true), so it is cleared by COMMIT or
 * ROLLBACK before the pooled connection is released.
 *
 * It is not safe to replace direct pool queries until every tenant-data route is
 * migrated to this boundary and the runtime database role is NOBYPASSRLS.
 */
export async function withRlsRequestTransaction<T>(
  pool: Pick<Pool, "connect">,
  auth: AuthContext,
  config: RlsRequestContextConfig,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const organizationId = requireVerifiedSingleOrganization(auth);
  const token = createSignedRequestContextToken(
    { actorIdentityId: auth.identityId, organizationId },
    config,
  );
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("select set_config('app.request_context', $1, true)", [token]);
    const result = await operation(client);
    await client.query("COMMIT");
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original operation error; release() will discard a broken client.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
