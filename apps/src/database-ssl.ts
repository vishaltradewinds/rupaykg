import type { ConnectionOptions } from "node:tls";

export type DatabaseSslSetting = false | (ConnectionOptions & { rejectUnauthorized: true });

/**
 * Explicit PostgreSQL TLS policy shared by migration and fixture tooling.
 * Production public connections require a trusted CA. Render's internal
 * dpg-* database host is treated as provider-internal TLS termination only
 * when the URL has no explicit sslmode, matching production-config.ts.
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

  if (mode === "false") return false;
  if (mode !== "require") {
    throw new Error("DATABASE_SSL must be explicitly set to require or false");
  }

  const ca = env.DATABASE_CA_CERT?.trim();
  if (ca && ca.includes("BEGIN CERTIFICATE") && ca.includes("END CERTIFICATE")) {
    return { rejectUnauthorized: true, ca };
  }
  // Match production-config.ts: sslmode=require may use the runtime's trusted
  // system CA store when no custom CA is supplied, but certificate validation
  // must remain enabled.
  if (parsed.searchParams.get("sslmode") === "require") {
    return { rejectUnauthorized: true };
  }
  throw new Error("DATABASE_CA_CERT must contain a PEM certificate when DATABASE_SSL=require");
}

/**
 * Return a sanitized connection string plus the single authoritative TLS
 * configuration. node-postgres may otherwise let SSL query parameters in the
 * URL override the explicitly supplied SSL object.
 */
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
