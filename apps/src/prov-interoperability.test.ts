import test from "node:test";
import assert from "node:assert/strict";
import { mapRupayKgProvenance } from "./prov-interoperability.js";

test("maps RupayKg evidence and calculation lineage into PROV concepts", () => {
  const doc = mapRupayKgProvenance({
    evidenceId: "evidence-1",
    activityId: "activity-1",
    observationId: "observation-1",
    calculationId: "calculation-1",
    verificationId: "verification-1",
    organizationId: "org-1",
    identityId: "identity-1",
    timestamps: {
      startedAt: "2026-11-08T09:00:00Z",
      endedAt: "2026-11-08T09:01:00Z",
    },
  });

  assert.equal(doc.context, "https://www.w3.org/ns/prov");
  assert.equal(doc.entity.length, 3);
  assert.equal(doc.activity.length, 2);
  assert.equal(doc.agent.length, 2);
  assert.ok(doc.relations.some(r => r.type === "wasDerivedFrom" && r.generatedEntity === "rupaykg:entity/calculation:calculation-1"));
  assert.ok(doc.relations.some(r => r.type === "wasAssociatedWith" && r.agent === "rupaykg:agent/identity:identity-1"));
});

test("does not invent optional provenance records", () => {
  const doc = mapRupayKgProvenance({
    evidenceId: "evidence-1",
    activityId: "activity-1",
    organizationId: "org-1",
  });

  assert.equal(doc.entity.length, 1);
  assert.equal(doc.activity.length, 1);
  assert.equal(doc.agent.length, 1);
  assert.equal(doc.relations.length, 2);
});
