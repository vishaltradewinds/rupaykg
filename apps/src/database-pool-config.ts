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
  const sslMode = env.DATABASE_SSL?.trim() || undefined;
  if (sslMode && sslMode !== "require" && sslMode !== "false") {
    throw new Error("DATABASE_SSL must be either require or false");
  }

  if (production && internalRenderHost && sslMode !== "false") {
    throw new Error("Production Render private database connections must be explicitly normalized to DATABASE_SSL=false");
  }
  if (production && !internalRenderHost && sslMode === "false") {
    throw new Error("Plaintext PostgreSQL is forbidden for external production database endpoints");
  }
  if (production && !internalRenderHost && sslMode !== "require") {
    throw new Error("Production external PostgreSQL connections require DATABASE_SSL=require");
  }

  const config: PoolConfig = {
    connectionString: parsed.toString(),
    max,
  };

  // In non-production, preserve the driver's native URL TLS configuration
  // unless an explicit DATABASE_SSL policy was supplied. Production always
  // requires an explicit policy, so URL parameters cannot downgrade it.
  if (!production && sslMode === undefined) {
    config.connectionString = rawUrl;
    return config;
  }

  // node-postgres URL TLS parameters can override an explicit ssl object.
  // Strip them only after capturing the URL and only when our environment
  // policy is authoritative.
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslpassword"]) {
    parsed.searchParams.delete(key);
  }
  config.connectionString = parsed.toString();

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
