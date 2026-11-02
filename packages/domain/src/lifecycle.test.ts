import test from "node:test";
import assert from "node:assert/strict";
import { assertTransition, canTransition } from "./state-machines.js";

test("production lifecycle permits only governed forward transitions", () => {
  const path: Array<["activity" | "evidence" | "verification" | "credential" | "settlement", string, string]> = [
    ["activity", "DRAFT", "SUBMITTED"],
    ["activity", "SUBMITTED", "ACCEPTED"],
    ["activity", "ACCEPTED", "COMPLETED"],
    ["evidence", "CAPTURED", "SUBMITTED"],
    ["evidence", "SUBMITTED", "UNDER_REVIEW"],
    ["evidence", "UNDER_REVIEW", "VERIFIED"],
    ["verification", "REQUESTED", "IN_REVIEW"],
    ["verification", "IN_REVIEW", "APPROVED"],
    ["credential", "ELIGIBLE", "ISSUED"],
    ["credential", "ISSUED", "ACTIVE"],
    ["credential", "ACTIVE", "TRANSFERRED"],
    ["credential", "TRANSFERRED", "RETIRED"],
    ["settlement", "ELIGIBLE", "CREATED"],
    ["settlement", "CREATED", "AUTHORIZED"],
    ["settlement", "AUTHORIZED", "EXECUTING"],
    ["settlement", "EXECUTING", "RECONCILING"],
    ["settlement", "RECONCILING", "SETTLED"],
  ];

  for (const [lifecycle, from, to] of path) {
    assert.equal(canTransition(lifecycle, from, to), true, `${lifecycle}: ${from} -> ${to}`);
    assert.doesNotThrow(() => assertTransition(lifecycle, from, to));
  }
});

test("terminal and backwards lifecycle transitions are rejected", () => {
  assert.equal(canTransition("activity", "COMPLETED", "SUBMITTED"), false);
  assert.equal(canTransition("evidence", "VERIFIED", "UNDER_REVIEW"), false);
  assert.equal(canTransition("verification", "APPROVED", "IN_REVIEW"), false);
  assert.equal(canTransition("credential", "RETIRED", "ACTIVE"), false);
  assert.equal(canTransition("settlement", "SETTLED", "RECONCILING"), false);
  assert.throws(() => assertTransition("settlement", "SETTLED", "RECONCILING"), /Invalid settlement transition/);
});
