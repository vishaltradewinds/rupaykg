import type { PoolConfig } from "pg";

/**
 * Use the same PostgreSQL TLS policy for migrations, acceptance setup and API
 * runtime. Production entrypoint validates and normalizes these environment
 * variables before any database code is imported.
 */
export function databaseSslConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig["ssl"] {
  if (env.DATABASE_SSL === "false") return false;

  if (env.DATABASE_SSL === "require") {
    return {
      rejectUnauthorized: true,
      ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT } : {}),
    };
  }

  if (env.NODE_ENV === "production") {
    throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_SSL must be normalized before database access");
  }

  // Development/test compatibility only.
  return { rejectUnauthorized: false };
}
