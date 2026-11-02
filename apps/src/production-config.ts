const PRODUCTION_ENV = "production";

export type ProductionConfig = {
  environment: "production";
  databaseUrl: string;
  migrationDatabaseUrl: string;
  databaseSsl: "require";
  databaseCaCert: string;
  allowedOrigins: string[];
  authMode: "real";
  syntheticData: false;
};

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`PRODUCTION_CONFIG_INVALID: ${name} is required`);
  return value;
}

function productionDatabaseUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_URL must be a valid PostgreSQL URL"); }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_URL must use postgres:// or postgresql://");
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())) throw new Error("PRODUCTION_CONFIG_INVALID: production DATABASE_URL must not target localhost");
  // node-postgres may let SSL parameters in the connection string replace the explicit ssl object.
  // Keep TLS policy in validated config, not in URL flags.
  for (const parameter of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    if (parsed.searchParams.has(parameter)) {
      throw new Error("PRODUCTION_CONFIG_INVALID: remove " + parameter + " from the database URL; configure TLS using DATABASE_SSL and DATABASE_CA_CERT");
    }
  }
  return value;
}

function productionCaCert(value: string): string {
  if (value.includes("-----BEGIN CERTIFICATE-----") && value.includes("-----END CERTIFICATE-----")) return value;
  throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_CA_CERT must contain a PEM certificate for external PostgreSQL TLS");
}

function origins(value: string): string[] {
  const result = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!result.length) throw new Error("PRODUCTION_CONFIG_INVALID: RUPAYKG_ALLOWED_ORIGINS must contain at least one origin");
  for (const origin of result) {
    let parsed: URL;
    try { parsed = new URL(origin); } catch { throw new Error(`PRODUCTION_CONFIG_INVALID: invalid allowed origin: ${origin}`); }
    if (parsed.protocol !== "https:") throw new Error(`PRODUCTION_CONFIG_INVALID: production origin must use HTTPS: ${origin}`);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error(`PRODUCTION_CONFIG_INVALID: origin must not contain path/query/hash: ${origin}`);
  }
  return result;
}

export function readProductionConfig(env: NodeJS.ProcessEnv = process.env): ProductionConfig {
  if (env.NODE_ENV !== PRODUCTION_ENV) throw new Error("PRODUCTION_CONFIG_NOT_ACTIVE: NODE_ENV must be production");
  if (env.RUPAYKG_SYNTHETIC_DATA?.toLowerCase() === "true") throw new Error("PRODUCTION_CONFIG_INVALID: synthetic data is forbidden in production");
  if (env.RUPAYKG_AUTH_MODE !== "real") throw new Error("PRODUCTION_CONFIG_INVALID: RUPAYKG_AUTH_MODE must be real");
  if (env.VITE_RUPAYKG_SESSION_TOKEN?.trim()) throw new Error("PRODUCTION_CONFIG_INVALID: VITE_RUPAYKG_SESSION_TOKEN must not be provided in production");
  const databaseUrl = productionDatabaseUrl(required(env, "DATABASE_URL"));
  const migrationDatabaseUrl = productionDatabaseUrl(required(env, "MIGRATION_DATABASE_URL"));
  const parsedDatabaseUrl = new URL(databaseUrl);
  const parsedMigrationDatabaseUrl = new URL(migrationDatabaseUrl);
  const decodeUser = (url: URL) => decodeURIComponent(url.username);
  const effectivePort = (url: URL) => url.port || "5432";
  if (
    parsedDatabaseUrl.hostname.toLowerCase() !== parsedMigrationDatabaseUrl.hostname.toLowerCase() ||
    effectivePort(parsedDatabaseUrl) !== effectivePort(parsedMigrationDatabaseUrl) ||
    decodeURIComponent(parsedDatabaseUrl.pathname) !== decodeURIComponent(parsedMigrationDatabaseUrl.pathname)
  ) {
    throw new Error("PRODUCTION_CONFIG_INVALID: MIGRATION_DATABASE_URL must target the same database host, port, and database name as DATABASE_URL");
  }
  if (!decodeUser(parsedMigrationDatabaseUrl) || decodeUser(parsedMigrationDatabaseUrl) === decodeUser(parsedDatabaseUrl)) {
    throw new Error("PRODUCTION_CONFIG_INVALID: MIGRATION_DATABASE_URL must use a distinct non-empty database role");
  }
  // Require verified TLS for every production PostgreSQL target, including Render's
  // private/internal hostname form. Managed database endpoints can enforce TLS even
  // when traffic stays on a private network; never infer that private means plaintext.
  if (env.DATABASE_SSL !== "require") throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_SSL must be require");
  return {
    environment: "production",
    databaseUrl,
    migrationDatabaseUrl,
    databaseSsl: "require",
    databaseCaCert: productionCaCert(env.DATABASE_CA_CERT?.trim() ?? ""),
    allowedOrigins: origins(required(env, "RUPAYKG_ALLOWED_ORIGINS")),
    authMode: "real",
    syntheticData: false,
  };
}
