import { readProductionConfig } from "./production-config.js";

/**
 * Validates the complete production contract before any database migration or
 * application startup can run. Acceptance fixtures are deliberately not part
 * of this entrypoint.
 */
const config = readProductionConfig();

process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.DATABASE_CA_CERT = config.databaseCaCert;
process.env.RUPAYKG_ALLOWED_ORIGINS = config.allowedOrigins.join(",");
process.env.RUPAYKG_AUTH_MODE = config.authMode;
process.env.RUPAYKG_SYNTHETIC_DATA = String(config.syntheticData);

// Migration remains startup-coupled until a separate, authorized release-job
// path is implemented and verified. At minimum, it cannot run before the
// production environment and database connection policy have been validated.
await import("./migrate.js");
await import("./server.js");
