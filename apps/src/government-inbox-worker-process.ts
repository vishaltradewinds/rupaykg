import { setTimeout as delay } from "node:timers/promises";
import { createGovernmentInboxWorkerPool, assertGovernmentInboxWorkerReady } from "./async-mirror-worker-runner.js";
import { runGovernmentInboxWorker } from "./async-mirror-worker.js";

const enabled = process.env.GOVERNMENT_INBOX_WORKER_ENABLED === "true";
if (!enabled) throw new Error("GOVERNMENT_INBOX_WORKER_DISABLED: enable only on a dedicated worker service");

const pollIntervalMs = Number(process.env.GOVERNMENT_INBOX_POLL_INTERVAL_MS ?? 5000);
if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1000 || pollIntervalMs > 60000) {
  throw new Error("GOVERNMENT_INBOX_POLL_INTERVAL_MS_INVALID");
}

const pool = createGovernmentInboxWorkerPool();
let stopping = false;
const sleepController = new AbortController();
const stop = (signal: string): void => {
  if (stopping) return;
  stopping = true;
  sleepController.abort();
  process.stdout.write(JSON.stringify({ event: "government_inbox_worker_stopping", signal }) + "\n");
};
process.once("SIGTERM", () => stop("SIGTERM"));
process.once("SIGINT", () => stop("SIGINT"));

try {
  // Fail closed before the first claim; never fall back to the API pool.
  await assertGovernmentInboxWorkerReady(pool, process.env.DATABASE_URL);
  process.stdout.write(JSON.stringify({ event: "government_inbox_worker_ready" }) + "\n");

  while (!stopping) {
    try {
      const result = await runGovernmentInboxWorker(pool);
      process.stdout.write(JSON.stringify({ event: "government_inbox_worker_cycle", ...result }) + "\n");
    } catch (error) {
      const code = error instanceof Error ? error.message : "WORKER_CYCLE_FAILED";
      process.stderr.write(JSON.stringify({ event: "government_inbox_worker_cycle_failed", code }) + "\n");
    }
    if (!stopping) await delay(pollIntervalMs, undefined, { signal: sleepController.signal }).catch(() => undefined);
  }
} finally {
  await pool.end();
  process.stdout.write(JSON.stringify({ event: "government_inbox_worker_stopped" }) + "\n");
}
