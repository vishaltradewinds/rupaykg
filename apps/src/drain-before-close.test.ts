import test from "node:test";
import assert from "node:assert/strict";
import { drainBeforeClose } from "./drain-before-close.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test("drain closes resources after active work settles within grace period", async () => {
  let inFlight = true;
  let closed = false;
  const work = deferred();
  const operation = drainBeforeClose({
    isInFlight: () => inFlight,
    timeoutMs: 500,
    pollIntervalMs: 2,
    close: async () => { assert.equal(inFlight, false); closed = true; },
  });

  work.promise.then(() => { inFlight = false; });
  work.resolve();
  const result = await operation;
  assert.deepEqual(result, { timedOut: false });
  assert.equal(closed, true);
});

test("timeout reports unclean shutdown but defers resource close until work settles", async () => {
  let inFlight = true;
  let closed = false;
  let timeoutReported = false;
  const work = deferred();
  const operation = drainBeforeClose({
    isInFlight: () => inFlight,
    timeoutMs: 10,
    pollIntervalMs: 2,
    onTimeout: () => { timeoutReported = true; },
    close: async () => { assert.equal(inFlight, false); closed = true; },
  });

  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(timeoutReported, true);
  assert.equal(closed, false, "resource must remain open while work is in flight");
  work.promise.then(() => { inFlight = false; });
  work.resolve();

  const result = await operation;
  assert.deepEqual(result, { timedOut: true });
  assert.equal(closed, true);
});
