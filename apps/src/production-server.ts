import { readProductionConfig } from "./production-config.js";

const config = readProductionConfig();

// The authoritative server consumes the validated production contract.
// Keep production-only configuration explicit here so TLS trust material is
// actually propagated to the PostgreSQL client at runtime.
process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.DATABASE_CA_CERT = config.databaseCaCert;
process.env.RUPAYKG_ALLOWED_ORIGINS = config.allowedOrigins.join(",");
process.env.RUPAYKG_AUTH_MODE = config.authMode;
process.env.RUPAYKG_SYNTHETIC_DATA = String(config.syntheticData);

// Validate and normalize production configuration before any database access.
// Migrations and the optional acceptance fixture must use the same TLS policy as the API.
await import("./migrate.js");
if (process.env.RUPAYKG_ACCEPTANCE_SEED_ON_START === "true") {
  await import("./acceptance-seed.js");
}
await import("./server.js");
