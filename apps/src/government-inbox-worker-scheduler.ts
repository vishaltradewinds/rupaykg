import { Pool, type PoolConfig } from "pg";
import { readProductionConfig } from "./production-config.js";
import { reconcileGovernmentInbox, runGovernmentInboxWorker } from "./async-mirror-worker.js";
import { readGovernmentInboxWorkerIntervalSeconds } from "./government-inbox-worker-scheduler-config.js";

const intervalSeconds = readGovernmentInboxWorkerIntervalSeconds(process.env.GOVERNMENT_INBOX_WORKER_INTERVAL_SECONDS);
const config = readProductionConfig();
process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.DATABASE_CA_CERT = config.databaseCaCert;

const poolConfig: PoolConfig = { connectionString: config.databaseUrl, max: 2 };
if (config.databaseSsl === "require") poolConfig.ssl = { rejectUnauthorized: true, ca: config.databaseCaCert };
else if (config.databaseSsl !== "false") poolConfig.ssl = { rejectUnauthorized: false };

const pool = new Pool(poolConfig);
let stopping = false;
let inFlight = false;
let timer: NodeJS.Timeout | undefined;

function emit(event: string, details: Record<string, unknown> = {}) {
  // Never log inbox payloads, credentials, tokens, or source evidence.
  console.log(JSON.stringify({
    component: "government-inbox-structural-validation",
    event,
    timestamp: new Date().toISOString(),
    officialGovernmentSubmission: false,
    authoritativeMrvMutation: false,
    guardianSubmission: false,
    ...details,
  }));
}

async function tick() {
  if (stopping || inFlight) return;
  inFlight = true;
  const startedAt = Date.now();
  try {
    const result = await runGovernmentInboxWorker(pool);
    const reconciliation = await reconcileGovernmentInbox(pool);
    emit("tick_completed", {
      durationMs: Date.now() - startedAt,
      result,
      reconciliation,
      alert: result.quarantined > 0 || reconciliation.expiredLeases > 0,
    });
    if (result.quarantined > 0 || reconciliation.expiredLeases > 0) {
      // Structured alert signal only. An external log/monitoring alert destination is not configured here.
      emit("attention_required", {
        quarantined: result.quarantined,
        expiredLeases: reconciliation.expiredLeases,
        oldestUnresolvedAt: reconciliation.oldestUnresolvedAt,
      });
    }
  } catch (error) {
    emit("tick_failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.name : "UNKNOWN_WORKER_ERROR",
      payloadLogged: false,
      alert: true,
    });
  } finally {
    inFlight = false;
  }
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  emit("shutdown_started", { signal });
  const deadline = Date.now() + 10_000;
  while (inFlight && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await pool.end();
  emit("shutdown_completed", { signal, inFlightAtShutdown: inFlight });
  process.exitCode = inFlight ? 1 : 0;
}

process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });

emit("scheduler_started", { intervalSeconds, schedulerEnabledByExplicitConfiguration: true });
await tick();
timer = setInterval(() => { void tick(); }, intervalSeconds * 1000);
