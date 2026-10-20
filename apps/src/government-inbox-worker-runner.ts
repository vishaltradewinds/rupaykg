import { Pool, type PoolConfig } from "pg";
import { readProductionConfig } from "./production-config.js";
import { reconcileGovernmentInbox, runGovernmentInboxWorker } from "./async-mirror-worker.js";

const config = readProductionConfig();
process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.DATABASE_CA_CERT = config.databaseCaCert;

const poolConfig: PoolConfig = { connectionString: config.databaseUrl, max: 2 };
if (config.databaseSsl === "require") poolConfig.ssl = { rejectUnauthorized: true, ca: config.databaseCaCert };
else if (config.databaseSsl !== "false") poolConfig.ssl = { rejectUnauthorized: false };

const pool = new Pool(poolConfig);
try {
  const result = await runGovernmentInboxWorker(pool);
  const reconciliation = await reconcileGovernmentInbox(pool);
  // Emit aggregate counts only; never log source payloads or secret material.
  console.log(JSON.stringify({
    worker: "government-inbox-structural-validation",
    authoritativeMrvMutation: false,
    officialGovernmentSubmission: false,
    guardianSubmission: false,
    result,
    reconciliation,
  }));
  if (result.quarantined > 0) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({
    worker: "government-inbox-structural-validation",
    error: error instanceof Error ? error.name : "UNKNOWN_WORKER_ERROR",
    payloadLogged: false,
  }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
