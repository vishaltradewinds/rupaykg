import test from "node:test";
import assert from "node:assert/strict";
import { assertTransition, canTransition } from "./state-machines.js";

test("allows valid activity transition", () => {
  assert.equal(canTransition("activity", "SUBMITTED", "ACCEPTED"), true);
});

test("rejects skipping activity evidence lifecycle", () => {
  assert.equal(canTransition("activity", "SUBMITTED", "COMPLETED"), false);
  assert.throws(() => assertTransition("activity", "SUBMITTED", "COMPLETED"));
});

test("settlement cannot be settled before reconciliation", () => {
  assert.equal(canTransition("settlement", "EXECUTING", "SETTLED"), false);
});
