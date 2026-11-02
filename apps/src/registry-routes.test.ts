import test from "node:test";
import assert from "node:assert/strict";

const credentialTransitions: Record<string, string[]> = {
  ELIGIBLE: ["ISSUED"],
  ISSUED: ["ACTIVE"],
  ACTIVE: ["TRANSFERRED", "RETIRED"],
  TRANSFERRED: ["RETIRED"],
  RETIRED: [],
};

const settlementTransitions: Record<string, string[]> = {
  CREATED: ["AUTHORIZED", "REJECTED"],
  AUTHORIZED: ["EXECUTING", "CANCELLED"],
  EXECUTING: ["RECONCILING", "FAILED"],
  RECONCILING: ["SETTLED", "FAILED"],
  SETTLED: [],
};

function canTransition(table: Record<string, string[]>, from: string, to: string): boolean {
  return table[from]?.includes(to) ?? false;
}

test("credential lifecycle only permits governed forward transitions", () => {
  assert.equal(canTransition(credentialTransitions, "ELIGIBLE", "ISSUED"), true);
  assert.equal(canTransition(credentialTransitions, "ISSUED", "ACTIVE"), true);
  assert.equal(canTransition(credentialTransitions, "ACTIVE", "TRANSFERRED"), true);
  assert.equal(canTransition(credentialTransitions, "TRANSFERRED", "RETIRED"), true);
  assert.equal(canTransition(credentialTransitions, "RETIRED", "ACTIVE"), false);
  assert.equal(canTransition(credentialTransitions, "ISSUED", "RETIRED"), false);
});

test("settlement lifecycle requires authorization, execution and reconciliation", () => {
  assert.equal(canTransition(settlementTransitions, "CREATED", "AUTHORIZED"), true);
  assert.equal(canTransition(settlementTransitions, "AUTHORIZED", "EXECUTING"), true);
  assert.equal(canTransition(settlementTransitions, "EXECUTING", "RECONCILING"), true);
  assert.equal(canTransition(settlementTransitions, "RECONCILING", "SETTLED"), true);
  assert.equal(canTransition(settlementTransitions, "CREATED", "SETTLED"), false);
  assert.equal(canTransition(settlementTransitions, "AUTHORIZED", "SETTLED"), false);
});

test("terminal registry and settlement states cannot transition", () => {
  assert.equal(canTransition(credentialTransitions, "RETIRED", "ACTIVE"), false);
  assert.equal(canTransition(settlementTransitions, "SETTLED", "FAILED"), false);
});
