import type { ConnectionOptions } from "node:tls";

export type DatabaseSslSetting = false | (ConnectionOptions & { rejectUnauthorized: true });

function legacyIpv4Number(part: string): number | null {
  if (/^0x[0-9a-f]+$/i.test(part)) return Number.parseInt(part.slice(2), 16);
  if (/^0[0-7]+$/.test(part) && part.length > 1) return Number.parseInt(part, 8);
  if (/^\d+$/.test(part)) return Number.parseInt(part, 10);
  return null;
}

/** Detect IPv4 addresses, including legacy numeric spellings that some URL/OS stacks accept. */
function isIpv4Loopback(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length < 1 || parts.length > 4) return false;
  const values = parts.map(legacyIpv4Number);
  if (values.some((value) => value === null)) return false;
  const octets = values as number[];
  let address: number;

  if (octets.length === 1) {
    const only = octets[0]!;
    if (only > 0xffffffff) return false;
    address = only;
  } else if (octets.length === 2) {
    const first = octets[0]!;
    const last = octets[1]!;
    if (first > 255 || last > 0xffffff) return false;
    address = first * 0x1000000 + last;
  } else if (octets.length === 3) {
    const first = octets[0]!;
    const second = octets[1]!;
    const last = octets[2]!;
    if (first > 255 || second > 255 || last > 0xffff) return false;
    address = first * 0x1000000 + second * 0x10000 + last;
  } else {
    const first = octets[0]!;
    const second = octets[1]!;
    const third = octets[2]!;
    const fourth = octets[3]!;
    if (octets.some((value) => value > 255)) return false;
    address = first * 0x1000000 + second * 0x10000 + third * 0x100 + fourth;
  }
  return Math.floor(address / 0x1000000) === 127 || address === 0;
}

/**
 * Reject canonical and non-canonical loopback spellings for production DB
 * targets, including localhost subdomains and legacy IPv4 numeric forms.
 */
export function isLoopbackDatabaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || host === "::1" || host === "[::]" || host === "::") return true;

  let normalized = host;
  try {
    normalized = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    // Invalid/unsupported host forms are handled by the caller's URL validation.
  }
  if (normalized === "[::1]" || normalized === "::1" || normalized === "[::]" || normalized === "::") return true;
  // URL canonicalizes IPv4-mapped IPv6 addresses; 0x7f in the high byte of
  // the mapped IPv4 portion represents the entire 127.0.0.0/8 loopback range.
  if (/^\[?::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]?$/i.test(normalized)) return true;
  return isIpv4Loopback(host) || isIpv4Loopback(normalized);
}

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
    if (isLoopbackDatabaseHost(parsed.hostname)) {
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
