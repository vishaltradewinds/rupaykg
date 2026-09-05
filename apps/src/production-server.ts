import { readProductionConfig } from "./production-config.js";

const config = readProductionConfig();

// The authoritative server consumes RUPAYKG_ALLOWED_ORIGINS directly during
// Fastify registration. Keep this entrypoint limited to production config
// validation; runtime policy belongs to the server itself, not source scans.
process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.RUPAYKG_ALLOWED_ORIGINS = config.allowedOrigins.join(",");
process.env.RUPAYKG_AUTH_MODE = config.authMode;
process.env.RUPAYKG_SYNTHETIC_DATA = String(config.syntheticData);

await import("./server.js");
