import assert from "node:assert/strict";
import test from "node:test";
import { runMrvSubmissionWorkerOnce } from "./mrv-submission-worker.js";

test("durable MRV worker is fail-closed unless explicitly enabled", async () => {
  const previous = process.env.RUPAYKG_MRV_WORKER_ENABLED;
  delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
  let databaseConnections = 0;
  const pool = { connect: async () => { databaseConnections += 1; throw new Error("database must not be touched while worker is disabled"); } } as never;
  try {
    await assert.rejects(
      runMrvSubmissionWorkerOnce(pool, "test-worker"),
      /MRV_WORKER_DISABLED/,
    );
    assert.equal(databaseConnections, 0, "disabled worker must not connect to the database");
  } finally {
    if (previous === undefined) delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
    else process.env.RUPAYKG_MRV_WORKER_ENABLED = previous;
  }
});
