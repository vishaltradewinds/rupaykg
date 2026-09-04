import { readFile } from "node:fs/promises";
import { readProductionConfig } from "./production-config.js";

const config = readProductionConfig();

// Production must not boot while the authoritative server exposes reflective
// CORS. The allowed-origin contract is intentionally enforced as a startup
// gate until the server registration consumes it directly.
const serverSource = await readFile(new URL("./server.js", import.meta.url), "utf8");
if (/register\(cors,\s*\{\s*origin:\s*true\s*\}\)/.test(serverSource)) {
  throw new Error("PRODUCTION_CONFIG_INVALID: server CORS is permissive; configure RUPAYKG_ALLOWED_ORIGINS explicitly before production startup");
}

process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;

// The authoritative server is imported only after every production startup
// gate above has passed. This module is the production entrypoint.
await import("./server.js");
