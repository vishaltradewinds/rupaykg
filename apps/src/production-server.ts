import { readProductionConfig } from "./production-config.js";

const config = readProductionConfig();

// The migration credential is only needed by migrate.ts. Do not leave it in the API process environment.
delete process.env.MIGRATION_DATABASE_URL;

// The authoritative server consumes the validated production contract.
// Keep production-only configuration explicit here so TLS trust material is
// actually propagated to the PostgreSQL client at runtime.
process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.DATABASE_CA_CERT = config.databaseCaCert;
process.env.RUPAYKG_ALLOWED_ORIGINS = config.allowedOrigins.join(",");
process.env.RUPAYKG_AUTH_MODE = config.authMode;
process.env.RUPAYKG_SYNTHETIC_DATA = String(config.syntheticData);

await import("./server.js");
