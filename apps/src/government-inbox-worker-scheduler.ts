import { Pool, type PoolConfig } from "pg";
import { drainBeforeClose } from "./drain-before-close.js";
import { readProductionConfig } from "./production-config.js";
import { reconcileGovernmentInbox, runGovernmentInboxWorker } from "./async-mirror-worker.js";
import { readGovernmentInboxWorkerIntervalSeconds } from "./government-inbox-worker-scheduler-config.js";
import { deliverOperationalAlert, readOperationalAlertWebhookUrl, type OperationalAlertEvent } from "./government-inbox-operational-alerts.js";

const intervalSeconds = readGovernmentInboxWorkerIntervalSeconds(process.env.GOVERNMENT_INBOX_WORKER_INTERVAL_SECONDS);
const alertWebhookUrl = readOperationalAlertWebhookUrl(process.env.RUPAYKG_ALERT_WEBHOOK_URL);
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
  // Never log inbox payloads, credentials, tokens, source evidence, or webhook URLs.
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

async function alert(event: OperationalAlertEvent, details: Record<string, unknown>) {
  if (!alertWebhookUrl) {
    emit("alert_delivery_not_configured", { alertEvent: event, deliveryConfigured: false });
    return;
  }
  const result = await deliverOperationalAlert(alertWebhookUrl, event, details);
  emit("alert_delivery_result", {
    alertEvent: event,
    deliveryConfigured: true,
    delivered: result.delivered,
    statusCode: result.statusCode,
    errorClass: result.errorClass,
  });
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
      const details = {
        quarantined: result.quarantined,
        expiredLeases: reconciliation.expiredLeases,
        oldestUnresolvedAt: reconciliation.oldestUnresolvedAt,
      };
      emit("attention_required", details);
      await alert("attention_required", details);
    }
  } catch (error) {
    const errorClass = error instanceof Error ? error.name : "UNKNOWN_WORKER_ERROR";
    emit("tick_failed", {
      durationMs: Date.now() - startedAt,
      error: errorClass,
      payloadLogged: false,
      alert: true,
    });
    await alert("tick_failed", { errorClass });
  } finally {
    inFlight = false;
  }
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  emit("shutdown_started", { signal });
  const result = await drainBeforeClose({
    isInFlight: () => inFlight,
    timeoutMs: 10_000,
    secondStageTimeoutMs: 5_000,
    pollIntervalMs: 100,
    onTimeout: () => {
      process.exitCode = 1;
      emit("shutdown_grace_deadline_exceeded", {
        signal,
        resourceCloseDeferred: true,
      });
    },
    onForcedTermination: () => {
      emit("shutdown_forced_termination", {
        signal,
        resourceCloseSkipped: true,
        retryMayReprocessWork: true,
        idempotencyRequired: true,
      });
    },
    terminate: exitCode => process.exit(exitCode),
    close: () => pool.end(),
  });
  emit("shutdown_completed", {
    signal,
    timedOut: result.timedOut,
    forcedTermination: result.forcedTermination,
    inFlightAtShutdown: inFlight,
  });
  if (!result.timedOut) process.exitCode = 0;
}

process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });

emit("scheduler_started", {
  intervalSeconds,
  schedulerEnabledByExplicitConfiguration: true,
  alertDeliveryConfigured: Boolean(alertWebhookUrl),
});
await tick();
// A signal may arrive while the initial tick is running; do not create a live
// interval after shutdown has already begun.
if (!stopping) timer = setInterval(() => { void tick(); }, intervalSeconds * 1000);
