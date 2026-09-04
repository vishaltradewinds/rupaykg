const PRODUCTION_ENV = "production";

export type ProductionConfig = {
  environment: "production";
  databaseUrl: string;
  databaseSsl: "require";
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
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_URL must use postgres:// or postgresql://");
  }
  const host = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("PRODUCTION_CONFIG_INVALID: production DATABASE_URL must not target localhost");
  }
  return value;
}

function origins(value: string): string[] {
  const result = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!result.length) throw new Error("PRODUCTION_CONFIG_INVALID: RUPAYKG_ALLOWED_ORIGINS must contain at least one origin");
  for (const origin of result) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`PRODUCTION_CONFIG_INVALID: invalid allowed origin: ${origin}`);
    }
    if (parsed.protocol !== "https:") throw new Error(`PRODUCTION_CONFIG_INVALID: production origin must use HTTPS: ${origin}`);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error(`PRODUCTION_CONFIG_INVALID: origin must not contain path/query/hash: ${origin}`);
  }
  return result;
}

export function readProductionConfig(env: NodeJS.ProcessEnv = process.env): ProductionConfig {
  if (env.NODE_ENV !== PRODUCTION_ENV) throw new Error("PRODUCTION_CONFIG_NOT_ACTIVE: NODE_ENV must be production");
  if (env.RUPAYKG_SYNTHETIC_DATA?.toLowerCase() === "true") throw new Error("PRODUCTION_CONFIG_INVALID: synthetic data is forbidden in production");
  if (env.RUPAYKG_AUTH_MODE !== "real") throw new Error("PRODUCTION_CONFIG_INVALID: RUPAYKG_AUTH_MODE must be real");
  if (env.DATABASE_SSL !== "require") throw new Error("PRODUCTION_CONFIG_INVALID: DATABASE_SSL must be require");
  if (env.VITE_RUPAYKG_SESSION_TOKEN?.trim()) throw new Error("PRODUCTION_CONFIG_INVALID: VITE_RUPAYKG_SESSION_TOKEN must not be provided in production");
  return {
    environment: "production",
    databaseUrl: productionDatabaseUrl(required(env, "DATABASE_URL")),
    databaseSsl: "require",
    allowedOrigins: origins(required(env, "RUPAYKG_ALLOWED_ORIGINS")),
    authMode: "real",
    syntheticData: false,
  };
}
