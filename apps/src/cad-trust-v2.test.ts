import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExternalLifecycleEntity,
  CAD_TRUST_INSERT_ORDER,
  CAD_TRUST_PROJECT_FIELD_RULES,
  CAD_TRUST_SCHEMA_VERSION,
  validateCadTrustProjection,
} from "./cad-trust-v2.js";

const project = (fields: Record<string, unknown>) => ({
  schemaVersion: CAD_TRUST_SCHEMA_VERSION,
  entityType: "project" as const,
  sourceSystem: "RUPAYKG" as const,
  sourceId: "activity-1",
  fields,
  provenance: { activityId: "activity-1" },
});

const validProject = {
  projectRegistryName: "Example Registry",
  projectId: "EXT-PROJECT-001",
  projectName: "Municipal organic waste diversion",
  projectLink: "https://registry.example/projects/EXT-PROJECT-001",
  projectSector: ["Waste handling and disposal"],
  projectType: ["Waste"],
  projectStatus: "Registered",
  projectStatusDate: "2026-11-12",
  projectUnitMetric: "tCO2e",
};

test("CAD Trust v2.0.2 project mapping", async (t) => {
  await t.test("preserves published insert order", () => {
    assert.equal(CAD_TRUST_INSERT_ORDER[0], "program");
    assert.equal(CAD_TRUST_INSERT_ORDER.at(-1), "unit_label");
  });

  await t.test("pins required project fields to the published entity schema", () => {
    const required = Object.entries(CAD_TRUST_PROJECT_FIELD_RULES)
      .filter(([, rule]) => rule.required).map(([name]) => name);
    assert.deepEqual(required, [
      "projectRegistryName", "projectId", "projectName", "projectLink",
      "projectSector", "projectType", "projectStatus", "projectStatusDate", "projectUnitMetric",
    ]);
  });

  await t.test("accepts a valid project fixture without requiring parent program fields in project payload", () => {
    assert.deepEqual(validateCadTrustProjection(project(validProject)), { ok: true });
  });

  await t.test("rejects missing entity-specific required fields", () => {
    const result = validateCadTrustProjection(project({ projectName: "Incomplete" }));
    assert.equal(result.ok, false);
    assert.equal(result.code, "CADT_REQUIRED_FIELD_MISSING");
  });

  await t.test("rejects unmapped/system-generated fields", () => {
    const result = validateCadTrustProjection(project({ ...validProject, cadTrustProjectId: "must-not-submit" }));
    assert.equal(result.ok, false);
    assert.equal(result.code, "CADT_FIELD_UNMAPPED");
  });

  await t.test("rejects invalid picklist values", () => {
    const result = validateCadTrustProjection(project({ ...validProject, projectStatus: "APPROVED_BY_RUPAYKG" }));
    assert.equal(result.ok, false);
    assert.equal(result.code, "CADT_PICKLIST_VALUE_INVALID");
  });

  await t.test("rejects invalid date and URL formats", () => {
    assert.equal(validateCadTrustProjection(project({ ...validProject, projectStatusDate: "12-11-2026" })).ok, false);
    assert.equal(validateCadTrustProjection(project({ ...validProject, projectLink: "/project/1" })).ok, false);
  });

  await t.test("fails closed for entity types without an implemented field map", () => {
    const result = validateCadTrustProjection({ ...project({}), entityType: "location" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "CADT_ENTITY_VALIDATION_NOT_IMPLEMENTED");
  });

  await t.test("blocks local issuance and unit creation", () => {
    assert.throws(() => assertExternalLifecycleEntity("issuance"));
    assert.throws(() => assertExternalLifecycleEntity("unit"));
  });
});
