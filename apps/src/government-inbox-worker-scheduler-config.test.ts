import test from "node:test";
import assert from "node:assert/strict";
import {
  GOVERNMENT_INBOX_WORKER_MAX_INTERVAL_SECONDS,
  GOVERNMENT_INBOX_WORKER_MIN_INTERVAL_SECONDS,
  readGovernmentInboxWorkerIntervalSeconds,
} from "./government-inbox-worker-scheduler-config.js";

test("scheduler interval requires explicit bounded configuration", () => {
  assert.throws(() => readGovernmentInboxWorkerIntervalSeconds(undefined), /explicitly set/);
  assert.throws(() => readGovernmentInboxWorkerIntervalSeconds(""), /explicitly set/);
  assert.throws(() => readGovernmentInboxWorkerIntervalSeconds("15s"), /explicitly set/);
  assert.throws(() => readGovernmentInboxWorkerIntervalSeconds("14"), /outside the allowed range/);
  assert.throws(() => readGovernmentInboxWorkerIntervalSeconds("3601"), /outside the allowed range/);
  assert.throws(() => readGovernmentInboxWorkerIntervalSeconds("1.5"), /explicitly set/);
  assert.throws(() => readGovernmentInboxWorkerIntervalSeconds("999999999999999999999"), /outside the allowed range/);
});

test("scheduler accepts only the documented interval boundaries and integers", () => {
  assert.equal(readGovernmentInboxWorkerIntervalSeconds(String(GOVERNMENT_INBOX_WORKER_MIN_INTERVAL_SECONDS)), 15);
  assert.equal(readGovernmentInboxWorkerIntervalSeconds("60"), 60);
  assert.equal(readGovernmentInboxWorkerIntervalSeconds(String(GOVERNMENT_INBOX_WORKER_MAX_INTERVAL_SECONDS)), 3600);
});
