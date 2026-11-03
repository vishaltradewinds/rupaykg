import type { PoolConfig } from "pg";

/**
 * Construct a PostgreSQL pool configuration without allowing libpq-style URL
 * query parameters to silently weaken the explicit TLS policy.
 *
 * Production external endpoints always use certificate and hostname
 * verification. The only plaintext production exception is an explicitly
 * identified Render private-service hostname (dpg-...) normalized by the
 * production configuration gate.
 */
export function createDatabasePoolConfig(
  env: NodeJS.ProcessEnv = process.env,
  max = 10,
): PoolConfig {
  const rawUrl = env.DATABASE_URL?.trim();
  if (!rawUrl) throw new Error("DATABASE_URL is required");

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://");
  }

  const internalRenderHost = /^dpg-[a-z0-9-]+$/i.test(parsed.hostname);
  const production = env.NODE_ENV === "production";
  const sslMode = env.DATABASE_SSL;

  if (production && internalRenderHost && sslMode !== "false") {
    throw new Error("Production Render private database connections must be explicitly normalized to DATABASE_SSL=false");
  }
  if (production && !internalRenderHost && sslMode === "false") {
    throw new Error("Plaintext PostgreSQL is forbidden for external production database endpoints");
  }
  if (production && !internalRenderHost && sslMode !== "require") {
    throw new Error("Production external PostgreSQL connections require DATABASE_SSL=require");
  }

  // node-postgres may let sslmode/sslrootcert URL parameters override the
  // supplied TLS object. Remove all TLS URL parameters and apply one policy.
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslpassword"]) {
    parsed.searchParams.delete(key);
  }

  const config: PoolConfig = {
    connectionString: parsed.toString(),
    max,
  };

  if (production && internalRenderHost && sslMode === "false") {
    config.ssl = false;
  } else if (sslMode === "require" || (production && !internalRenderHost)) {
    const ca = env.DATABASE_CA_CERT?.trim();
    config.ssl = {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    };
  } else if (sslMode === "false") {
    config.ssl = false;
  }

  return config;
}
