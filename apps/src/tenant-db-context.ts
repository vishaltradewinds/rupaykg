import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";
import type { AuthContext } from "./auth.js";

export type RequestDatabaseContext = {
  client: PoolClient;
  auth: AuthContext;
  failed: boolean;
  finished: boolean;
  savepoints: string[];
  nextSavepoint: number;
  clientView?: PoolClient;
};

const requestStorage = new AsyncLocalStorage<RequestDatabaseContext>();

function transactionCommand(query: unknown): "BEGIN" | "COMMIT" | "ROLLBACK" | null {
  if (typeof query !== "string") return null;
  const normalized = query.trim().replace(/;+$/, "").trim().toUpperCase();
  if (normalized === "BEGIN" || normalized.startsWith("BEGIN ")) return "BEGIN";
  if (normalized === "COMMIT" || normalized === "END") return "COMMIT";
  if (normalized === "ROLLBACK") return "ROLLBACK";
  return null;
}

function rawQuery(context: RequestDatabaseContext, args: unknown[]): Promise<unknown> {
  return (context.client.query as (...queryArgs: unknown[]) => Promise<unknown>).apply(context.client, args);
}

async function scopedQuery(context: RequestDatabaseContext, args: unknown[]): Promise<unknown> {
  const command = transactionCommand(args[0]);
  if (!command) return rawQuery(context, args);

  if (command === "BEGIN") {
    const name = `rupaykg_request_sp_${++context.nextSavepoint}`;
    context.savepoints.push(name);
    return rawQuery(context, [`SAVEPOINT ${name}`]);
  }

  const name = context.savepoints.pop();
  if (!name) {
    context.failed = true;
    throw new Error(`REQUEST_TRANSACTION_BOUNDARY_VIOLATION: ${command} without a matching nested BEGIN`);
  }

  if (command === "COMMIT") return rawQuery(context, [`RELEASE SAVEPOINT ${name}`]);

  await rawQuery(context, [`ROLLBACK TO SAVEPOINT ${name}`]);
  return rawQuery(context, [`RELEASE SAVEPOINT ${name}`]);
}

function scopedClient(context: RequestDatabaseContext): PoolClient {
  if (context.clientView) return context.clientView;
  context.clientView = new Proxy(context.client, {
    get(target, property) {
      if (property === "query") return (...args: unknown[]) => scopedQuery(context, args);
      if (property === "release") {
        return (error?: Error | boolean) => {
          if (error || context.savepoints.length) context.failed = true;
          // The request owns the physical connection; route helpers only borrow this view.
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return context.clientView;
}

/**
 * Route all pool.query()/pool.connect() operations in the active async request
 * through one request transaction. Outside a request context, the real Pool is
 * used unchanged. The caller must finish and release the request context.
 */
export function createContextAwarePool(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, property) {
      if (property === "query") {
        return (...args: unknown[]) => {
          const context = requestStorage.getStore();
          if (context) return scopedQuery(context, args);
          return (target.query as (...queryArgs: unknown[]) => unknown).apply(target, args);
        };
      }
      if (property === "connect") {
        return (...args: unknown[]) => {
          const context = requestStorage.getStore();
          if (context) {
            if (args.length) throw new Error("REQUEST_CONTEXT_CONNECT_CALLBACK_UNSUPPORTED");
            return Promise.resolve(scopedClient(context));
          }
          return (target.connect as (...connectArgs: unknown[]) => unknown).apply(target, args);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Pool;
}

export async function beginRequestDatabaseContext(pool: Pool, auth: AuthContext): Promise<RequestDatabaseContext> {
  const client = await pool.connect();
  const context: RequestDatabaseContext = {
    client,
    auth,
    failed: false,
    finished: false,
    savepoints: [],
    nextSavepoint: 0,
  };

  try {
    await client.query("BEGIN");
    const verifiedMemberships = auth.memberships
      .filter((membership) => membership.status === "VERIFIED")
      .map((membership) => membership.organization_id);
    const organizationIds = auth.bilateralOrganizationScope
      ? [...new Set(verifiedMemberships)]
      : auth.activeOrganizationId
        ? [auth.activeOrganizationId]
        : [];
    await client.query(
      `select
         set_config('app.identity_id', $1, true),
         set_config('app.active_organization_id', $2, true),
         set_config('app.organization_ids', $3, true),
         set_config('app.bilateral_organization_scope', $4, true)`,
      [
        auth.identityId,
        auth.activeOrganizationId ?? "",
        organizationIds.join(","),
        auth.bilateralOrganizationScope ? "true" : "false",
      ],
    );
    return context;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    client.release(error instanceof Error ? error : new Error("Request transaction initialization failed"));
    throw error;
  }
}

export async function finishRequestDatabaseContext(
  context: RequestDatabaseContext,
  commit: boolean,
): Promise<void> {
  if (context.finished) return;
  let releaseError: Error | undefined;
  try {
    if (context.savepoints.length) {
      context.failed = true;
      throw new Error("REQUEST_TRANSACTION_UNCLOSED_SAVEPOINT: route left a nested transaction open");
    }
    await context.client.query(commit && !context.failed ? "COMMIT" : "ROLLBACK");
    context.finished = true;
  } catch (error) {
    releaseError = error instanceof Error ? error : new Error("Request transaction finalization failed");
    try { await context.client.query("ROLLBACK"); } catch {}
    context.finished = true;
    throw error;
  } finally {
    context.client.release(releaseError);
  }
}

export function runWithRequestDatabaseContext<T>(
  context: RequestDatabaseContext,
  callback: () => T,
): T {
  return requestStorage.run(context, callback);
}

export function currentRequestDatabaseContext(): RequestDatabaseContext | undefined {
  return requestStorage.getStore();
}
