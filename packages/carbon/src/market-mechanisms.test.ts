import test from "node:test";
import assert from "node:assert/strict";
import { assertCarbonMarketMechanism, canClaimIssuedCarbonCredit, CARBON_MARKET_MECHANISMS, evaluateCarbonMechanismGate } from "./market-mechanisms.js";

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


test("CCC issuance claim requires verified, traceable authority evidence, not a calculation or reference alone", () => {
  const evidence = {
    authorityName: "Bureau of Energy Efficiency",
    officialSourceUrl: "https://beeindia.gov.in/",
    issuanceReference: "CCC-REF-001",
    artifactSha256: "b".repeat(64),
    verificationStatus: "VERIFIED" as const,
    verificationRecordId: "review-001",
    verifiedAt: "2026-10-18T17:00:00Z",
  };
  assert.equal(canClaimIssuedCarbonCredit("CALCULATED_PENDING_VERIFICATION", evidence), false);
  assert.equal(canClaimIssuedCarbonCredit("ISSUED", undefined), false);
  assert.equal(canClaimIssuedCarbonCredit("ISSUED", { ...evidence, officialSourceUrl: "http://untrusted.example" }), false);
  assert.equal(canClaimIssuedCarbonCredit("ISSUED", { ...evidence, artifactSha256: "not-a-hash" }), false);
  assert.equal(canClaimIssuedCarbonCredit("ISSUED", { ...evidence, verificationRecordId: " " }), false);
  assert.equal(canClaimIssuedCarbonCredit("ISSUED", evidence), true);
});
