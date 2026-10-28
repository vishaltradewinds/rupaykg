import test from "node:test";
import assert from "node:assert/strict";
import { drainBeforeClose } from "./drain-before-close.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

test("drain closes resources after active work settles within grace period", async () => {
  let inFlight = true;
  let closed = false;
  const work = deferred();
  const operation = drainBeforeClose({
    isInFlight: () => inFlight,
    timeoutMs: 500,
    pollIntervalMs: 2,
    terminate: () => { throw new Error("termination must not be requested for a clean drain"); },
    close: async () => { assert.equal(inFlight, false); closed = true; },
  });

  work.promise.then(() => { inFlight = false; });
  work.resolve();
  const result = await operation;
  assert.deepEqual(result, { timedOut: false, forcedTermination: false });
  assert.equal(closed, true);
});

test("second-stage drain closes resources only if timed-out work eventually settles", async () => {
  let inFlight = true;
  let closed = false;
  let timeoutReported = false;
  let terminated = false;
  const work = deferred();
  const operation = drainBeforeClose({
    isInFlight: () => inFlight,
    timeoutMs: 10,
    secondStageTimeoutMs: 100,
    pollIntervalMs: 2,
    onTimeout: () => { timeoutReported = true; },
    terminate: () => { terminated = true; },
    close: async () => { assert.equal(inFlight, false); closed = true; },
  });

  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(timeoutReported, true);
  assert.equal(closed, false, "resource must remain open while work is in flight");
  work.promise.then(() => { inFlight = false; });
  work.resolve();

  const result = await operation;
  assert.deepEqual(result, { timedOut: true, forcedTermination: false });
  assert.equal(closed, true);
  assert.equal(terminated, false);
});

test("permanently stalled work triggers bounded forced termination without closing resources", async () => {
  let closed = false;
  let terminationCode: number | undefined;
  let forcedTerminationLogged = false;
  const result = await drainBeforeClose({
    isInFlight: () => true,
    timeoutMs: 5,
    secondStageTimeoutMs: 10,
    pollIntervalMs: 1,
    onForcedTermination: () => { forcedTerminationLogged = true; },
    terminate: code => { terminationCode = code; },
    close: async () => { closed = true; },
  });

  assert.deepEqual(result, { timedOut: true, forcedTermination: true });
  assert.equal(forcedTerminationLogged, true);
  assert.equal(terminationCode, 1);
  assert.equal(closed, false, "must not close pool while work is still active");
});

test("forced termination is still requested if forced-termination logging throws", async () => {
  let terminationCode: number | undefined;
  const result = await drainBeforeClose({
    isInFlight: () => true,
    timeoutMs: 2,
    secondStageTimeoutMs: 2,
    pollIntervalMs: 1,
    onForcedTermination: () => { throw new Error("logger failed"); },
    terminate: code => { terminationCode = code; },
    close: async () => { throw new Error("resources must not close while work is active"); },
  });

  assert.deepEqual(result, { timedOut: true, forcedTermination: true });
  assert.equal(terminationCode, 1);
});

test("hung resource closure triggers bounded forced termination", async () => {
  let terminationCode: number | undefined;
  let closeFailure: "timeout" | "rejected" | undefined;
  const result = await drainBeforeClose({
    isInFlight: () => false,
    timeoutMs: 5,
    closeTimeoutMs: 5,
    terminate: code => { terminationCode = code; },
    onCloseFailure: reason => { closeFailure = reason; },
    close: () => new Promise<void>(() => {}),
  });

  assert.deepEqual(result, { timedOut: true, forcedTermination: true });
  assert.equal(closeFailure, "timeout");
  assert.equal(terminationCode, 1);
});

test("rejected resource closure triggers forced termination", async () => {
  let terminationCode: number | undefined;
  let closeFailure: "timeout" | "rejected" | undefined;
  const result = await drainBeforeClose({
    isInFlight: () => false,
    timeoutMs: 5,
    closeTimeoutMs: 50,
    terminate: code => { terminationCode = code; },
    onCloseFailure: reason => { closeFailure = reason; },
    close: async () => { throw new Error("pool close failed"); },
  });

  assert.deepEqual(result, { timedOut: true, forcedTermination: true });
  assert.equal(closeFailure, "rejected");
  assert.equal(terminationCode, 1);
});

test("close failure still requests termination if its logging callback throws", async () => {
  let terminationCode: number | undefined;
  const result = await drainBeforeClose({
    isInFlight: () => false,
    timeoutMs: 5,
    closeTimeoutMs: 50,
    terminate: code => { terminationCode = code; },
    onCloseFailure: () => { throw new Error("logger failed"); },
    close: async () => { throw new Error("pool close failed"); },
  });

  assert.deepEqual(result, { timedOut: true, forcedTermination: true });
  assert.equal(terminationCode, 1);
});
