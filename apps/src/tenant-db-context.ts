import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import type { AuthContext } from "./auth.js";
import { authenticate, cacheRequestAuthContext } from "./auth.js";
import type { RlsRequestContextConfig } from "./rls-request-transaction.js";
import { createSignedRequestContextForAuth } from "./signed-request-context-token.js";

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

function queryText(query: unknown): string | null {
  if (typeof query === "string") return query;
  if (query && typeof query === "object" && typeof (query as { text?: unknown }).text === "string") {
    return (query as { text: string }).text;
  }
  return null;
}

function transactionCommand(query: unknown): "BEGIN" | "COMMIT" | "ROLLBACK" | "UNSUPPORTED" | null {
  const text = queryText(query);
  if (!text) return null;
  const normalized = text.trim().replace(/;+$/, "").trim().toUpperCase();
  if (normalized === "BEGIN" || normalized === "BEGIN TRANSACTION" || normalized === "BEGIN WORK") return "BEGIN";
  if (normalized === "COMMIT" || normalized === "COMMIT TRANSACTION" || normalized === "END" || normalized === "END TRANSACTION") return "COMMIT";
  if (normalized === "ROLLBACK" || normalized === "ROLLBACK TRANSACTION") return "ROLLBACK";
  if (/^(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE\s+SAVEPOINT)\b/.test(normalized)) return "UNSUPPORTED";
  return null;
}

function rawQuery(context: RequestDatabaseContext, args: unknown[]): Promise<unknown> {
  return (context.client.query as (...queryArgs: unknown[]) => Promise<unknown>).apply(context.client, args);
}

async function scopedQuery(context: RequestDatabaseContext, args: unknown[]): Promise<unknown> {
  try {
    if (context.finished) throw new Error("REQUEST_CONTEXT_ALREADY_FINISHED");
    if (args.some((argument) => typeof argument === "function")) {
      throw new Error("REQUEST_CONTEXT_QUERY_CALLBACK_UNSUPPORTED");
    }
    const command = transactionCommand(args[0]);
    if (command === "UNSUPPORTED") {
      context.failed = true;
      throw new Error("REQUEST_TRANSACTION_COMMAND_UNSUPPORTED");
    }
    if (!command) return await rawQuery(context, args);

    if (command === "BEGIN") {
      const name = "rupaykg_request_sp_" + String(++context.nextSavepoint);
      const result = await rawQuery(context, ["SAVEPOINT " + name]);
      context.savepoints.push(name);
      return result;
    }

    const name = context.savepoints[context.savepoints.length - 1];
    if (!name) {
      context.failed = true;
      throw new Error("REQUEST_TRANSACTION_BOUNDARY_VIOLATION: " + command + " without a matching nested BEGIN");
    }

    if (command === "COMMIT") {
      const result = await rawQuery(context, ["RELEASE SAVEPOINT " + name]);
      context.savepoints.pop();
      return result;
    }

    await rawQuery(context, ["ROLLBACK TO SAVEPOINT " + name]);
    const result = await rawQuery(context, ["RELEASE SAVEPOINT " + name]);
    context.savepoints.pop();
    return result;
  } catch (error) {
    // A failed statement inside a savepoint may be recovered only by an explicit
    // matching route-level ROLLBACK. An uncontained failure poisons the outer unit.
    if (!context.savepoints.length) context.failed = true;
    throw error;
  }
}

function scopedClient(context: RequestDatabaseContext): PoolClient {
  if (context.clientView) return context.clientView;
  context.clientView = new Proxy(context.client, {
    get(target, property) {
      if (property === "query") return (...args: unknown[]) => scopedQuery(context, args);
      if (property === "release") {
        return (error?: Error | boolean) => {
          if (error || context.savepoints.length) context.failed = true;
          // The physical connection is owned and released by the outer request.
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return context.clientView;
}

/**
 * Route existing pool.query()/pool.connect() calls through the active request
 * transaction. Outside a request context the underlying Pool is unchanged.
 * Callback-style query/connect APIs are rejected inside a request because the
 * current route inventory uses promise-based calls only.
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

export async function beginRequestDatabaseContext(
  pool: Pick<Pool, "connect">,
  auth: AuthContext,
  config: RlsRequestContextConfig,
): Promise<RequestDatabaseContext> {
  const token = createSignedRequestContextForAuth(auth, {
    secret: config.hmacSecret,
    keyId: config.keyId,
    ...(config.ttlSeconds === undefined ? {} : { ttlSeconds: config.ttlSeconds }),
  });
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
    await client.query("select set_config('app.request_context', $1, true)", [token]);
    return context;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    client.release(error instanceof Error ? error : new Error("Request tenant transaction initialization failed"));
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
  } catch (error) {
    releaseError = error instanceof Error ? error : new Error("Request tenant transaction finalization failed");
    try { await context.client.query("ROLLBACK"); }
    catch (rollbackError) {
      releaseError = rollbackError instanceof Error ? rollbackError : releaseError;
    }
    throw error;
  } finally {
    context.finished = true;
    context.client.release(releaseError);
  }
}

export function runWithRequestDatabaseContext<T>(context: RequestDatabaseContext, callback: () => T): T {
  return requestStorage.run(context, callback);
}

export function currentRequestDatabaseContext(): RequestDatabaseContext | undefined {
  return requestStorage.getStore();
}

/**
 * Bind a validated bearer session to a signed, single-organization transaction
 * after body parsing and before route handlers. Bilateral settlement routes stay
 * fail-closed until a separately reviewed multi-party RLS contract exists.
 */
export function registerRequestTenantContext(
  app: FastifyInstance,
  pool: Pool,
  config: RlsRequestContextConfig,
): void {
  const contexts = new WeakMap<FastifyRequest, RequestDatabaseContext>();

  app.addHook("preHandler", (request, reply, done) => {
    const path = (request.url.split("?", 1)[0] ?? "").replace(/\/+$/, "");
    if (!path.startsWith("/api/v1/") || path === "/api/v1/operations/sync") return done();
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return done();

    void (async () => {
      try {
        const auth = await authenticate(request, pool, "security_definer");
        cacheRequestAuthContext(request, auth);
        if (!auth) return done();
        if (!auth.activeOrganizationId) return done();
        if (auth.bilateralOrganizationScope) {
          reply.code(503).send({
            error: "Bilateral settlement access is not enabled until the multi-party RLS context is independently approved",
            code: "RLS_BILATERAL_CONTEXT_UNSUPPORTED",
            syntheticData: false,
          });
          return done();
        }
        const context = await beginRequestDatabaseContext(pool, auth, config);
        contexts.set(request, context);
        runWithRequestDatabaseContext(context, () => done());
      } catch (error) {
        request.log.error(error);
        reply.code(503).send({
          error: "Tenant request context unavailable",
          code: "TENANT_CONTEXT_UNAVAILABLE",
          syntheticData: false,
        });
        done();
      }
    })();
  });

  app.addHook("onSend", (request, reply, payload, done) => {
    const context = contexts.get(request);
    if (!context) return done(null, payload);
    finishRequestDatabaseContext(context, reply.statusCode < 400)
      .then(() => done(null, payload))
      .catch((error: unknown) => done(error instanceof Error ? error : new Error("Tenant request transaction finalization failed")));
  });

  app.addHook("onResponse", async (request) => {
    const context = contexts.get(request);
    if (!context || context.finished) return;
    try {
      await finishRequestDatabaseContext(context, false);
    } catch (error) {
      request.log.error(error);
    }
  });
}
