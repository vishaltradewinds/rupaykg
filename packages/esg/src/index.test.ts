import test from "node:test";
import assert from "node:assert/strict";
import { buildDisclosure, classifyMetric, hasAuthoritativeEsgVerification, type AuthoritativeEsgVerification } from "./index.js";

const verifiedContext: AuthoritativeEsgVerification = {
  evidencePersisted: true,
  evidenceApproved: true,
  verificationPersisted: true,
  verifierCurrentlyAuthorized: true,
  organizationMatches: true,
  geographyMatches: true,
  reportingPeriodMatches: true,
  methodologyMatches: true,
  evidenceCurrentAndNotRevoked: true,
};

test("reference IDs alone never mark an ESG metric verified", () => {
  const metric = { code: "SCOPE3-WASTE", scope: "3" as const, value: 12.5, unit: "tCO2e", evidenceId: "e1", verificationId: "v1" };
  assert.equal(classifyMetric(metric), "PENDING");
  assert.equal(buildDisclosure([metric]).metrics[0].state, "PENDING");
});

test("ESG metric is verified only when trusted persisted-record checks all pass", () => {
  const metric = { code: "SCOPE3-WASTE", scope: "3" as const, value: 12.5, unit: "tCO2e", evidenceId: "e1", verificationId: "v1" };
  assert.equal(hasAuthoritativeEsgVerification(verifiedContext), true);
  assert.equal(classifyMetric(metric, verifiedContext), "VERIFIED");
});

test("any failed authoritative ESG check keeps metric pending", () => {
  for (const key of Object.keys(verifiedContext) as Array<keyof AuthoritativeEsgVerification>) {
    const context = { ...verifiedContext, [key]: false };
    assert.equal(hasAuthoritativeEsgVerification(context), false, `expected ${key} to fail closed`);
  }
});
