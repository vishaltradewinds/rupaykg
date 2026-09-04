import { readProductionConfig } from "./production-config.js";

const config = readProductionConfig();

process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;

// The authoritative server is imported only after production configuration has
// passed all fail-closed checks above. This module is the production entrypoint.
await import("./server.js");
