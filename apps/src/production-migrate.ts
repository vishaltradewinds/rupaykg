import { readProductionConfig } from "./production-config.js";

// The production migration runner must use the same fail-closed environment
// contract and TLS trust material as the production API process.
const config = readProductionConfig();

process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.DATABASE_CA_CERT = config.databaseCaCert;

await import("./migrate.js");
