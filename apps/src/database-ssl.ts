import type { ConnectionOptions } from "node:tls";

export type DatabaseSslSetting = false | (ConnectionOptions & { rejectUnauthorized: true });

/**
 * Explicit PostgreSQL TLS policy shared by migration and fixture tooling.
 * Production public connections require a trusted CA. Render's internal
 * dpg-* database host uses the provider-internal non-TLS path only when the
 * URL has no explicit sslmode, matching production-config.ts.
 */
export function readDatabaseSslSetting(env: NodeJS.ProcessEnv = process.env): DatabaseSslSetting {
  const mode = env.DATABASE_SSL;
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://");
  }

  const renderInternalDatabase =
    /^dpg-[a-z0-9-]+$/i.test(parsed.hostname) &&
    !parsed.searchParams.get("sslmode");
  if (renderInternalDatabase) return false;

  // Direct migration/fixture commands must not bypass the production
  // configuration contract by opting out of TLS or targeting loopback.
  // The only production non-TLS exception is the provider-internal Render
  // database path validated above.
  if (env.NODE_ENV === "production") {
    const hostname = parsed.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
      throw new Error("PRODUCTION_DATABASE_TARGET_FORBIDDEN: loopback host");
    }
    if (mode === "false") {
      throw new Error("PRODUCTION_DATABASE_TLS_REQUIRED: TLS may be disabled only for the provider-internal Render database");
    }
  }

  if (mode === "false") return false;
  if (mode !== "require") {
    throw new Error("DATABASE_SSL must be explicitly set to require or false");
  }

  const ca = env.DATABASE_CA_CERT?.trim();
  if (ca && ca.includes("BEGIN CERTIFICATE") && ca.includes("END CERTIFICATE")) {
    return { rejectUnauthorized: true, ca };
  }
  if (parsed.searchParams.get("sslmode") === "require") {
    return { rejectUnauthorized: true };
  }
  throw new Error("DATABASE_CA_CERT must contain a PEM certificate when DATABASE_SSL=require");
}

export function readDatabaseConnectionOptions(env: NodeJS.ProcessEnv = process.env): {
  connectionString: string;
  ssl: DatabaseSslSetting;
} {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const parsed = new URL(connectionString);
  const ssl = readDatabaseSslSetting(env);
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslpassword",
    "sslcrl",
    "sslcrldir",
    "sslsni",
    "sslnegotiation",
    "ssl_min_protocol_version",
    "ssl_max_protocol_version",
  ]) {
    parsed.searchParams.delete(key);
  }
  return { connectionString: parsed.toString(), ssl };
}
