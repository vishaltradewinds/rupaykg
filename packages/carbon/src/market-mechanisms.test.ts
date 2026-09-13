import test from "node:test";
import assert from "node:assert/strict";
import { assertCarbonMarketMechanism, CARBON_MARKET_MECHANISMS, evaluateCarbonMechanismGate } from "./market-mechanisms.js";

test("carbon market catalogue contains mandatory compliance and voluntary offset pathways", () => {
  assert.deepEqual(CARBON_MARKET_MECHANISMS.map((item) => item.code), ["COMPLIANCE", "OFFSET", "OTHER"]);
  assert.equal(CARBON_MARKET_MECHANISMS.find((item) => item.code === "COMPLIANCE")?.participationModel, "MANDATORY");
  assert.equal(CARBON_MARKET_MECHANISMS.find((item) => item.code === "OFFSET")?.participationModel, "VOLUNTARY_PROJECT_BASED");
});

test("mechanism gate fails closed when statutory applicability is not established", () => {
  assert.equal(evaluateCarbonMechanismGate({ mechanism: "COMPLIANCE", methodologyMechanism: "COMPLIANCE", obligatedEntityStatus: "UNKNOWN" }).eligible, false);
  assert.equal(evaluateCarbonMechanismGate({ mechanism: "OFFSET", methodologyMechanism: "OFFSET", projectEligibility: "UNKNOWN" }).eligible, false);
  assert.equal(evaluateCarbonMechanismGate({ mechanism: "OFFSET", methodologyMechanism: "COMPLIANCE", projectEligibility: "CONFIRMED" }).eligible, false);
});

test("mechanism gate permits only explicitly established pathways", () => {
  assert.equal(evaluateCarbonMechanismGate({ mechanism: "COMPLIANCE", methodologyMechanism: "COMPLIANCE", obligatedEntityStatus: "CONFIRMED" }).eligible, true);
  assert.equal(evaluateCarbonMechanismGate({ mechanism: "OFFSET", methodologyMechanism: "OFFSET", projectEligibility: "CONFIRMED" }).eligible, true);
  assert.equal(evaluateCarbonMechanismGate({ mechanism: "OTHER", methodologyMechanism: "OTHER", authorityReferencePresent: true }).eligible, true);
  assert.throws(() => assertCarbonMarketMechanism("CARBON_MARKETPLACE"), /valid carbon market mechanism/);
});
