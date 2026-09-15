const PRODUCTION_ENV = "production";

export type ProductionConfig = {
  environment: "production";
  databaseUrl: string;
  databaseSsl: "require" | "false";
  databaseCaCert: string;
  allowedOrigins: string[];
  authMode: "real";
  firebaseProjectId: string;
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
  return value;
}

function productionCaCert(value: string, databaseUrl: string): string {
  if (value.includes("BEGIN CERTIFICATE") && value.includes("END CERTIFICATE")) return value;
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_URL must be a valid PostgreSQL URL"); }
  if (parsed.searchParams.get("sslmode") === "require") return "";
  throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_CA_CERT must contain a PEM certificate unless DATABASE_URL uses sslmode=require");
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
  const parsedDatabaseUrl = new URL(databaseUrl);
  // Render internal Postgres URLs use private dpg-* hostnames. Public Render
  // Postgres endpoints use *.render.com and therefore require managed TLS.
  const renderInternalDatabase =
    /^dpg-[a-z0-9-]+$/i.test(parsedDatabaseUrl.hostname) &&
    !parsedDatabaseUrl.searchParams.get("sslmode");
  if (!renderInternalDatabase && env.DATABASE_SSL !== "require") throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_SSL must be require");
  return {
    environment: "production",
    databaseUrl,
    databaseSsl: renderInternalDatabase ? "false" : "require",
    databaseCaCert: renderInternalDatabase ? "" : productionCaCert(env.DATABASE_CA_CERT?.trim() ?? "", databaseUrl),
    allowedOrigins: origins(required(env, "RUPAYKG_ALLOWED_ORIGINS")),
    authMode: "real",
    firebaseProjectId: required(env, "FIREBASE_PROJECT_ID"),
    syntheticData: false,
  };
}
