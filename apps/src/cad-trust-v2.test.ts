import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExternalLifecycleEntity,
  CAD_TRUST_INSERT_ORDER,
  CAD_TRUST_PROJECT_FIELD_RULES,\n  CAD_TRUST_PROGRAM_FIELD_RULES,\n  CAD_TRUST_METHODOLOGY_FIELD_RULES,
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
    assert.deepEqual(validateCadTrustProjection(projection("project", validProject)), { ok: true });
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
    const result = validateCadTrustProjection({ ...projection("project", {}), entityType: "location" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "CADT_ENTITY_VALIDATION_NOT_IMPLEMENTED");
  });

  await t.test("pins program required fields to CAD Trust user-input schema", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_PROGRAM_FIELD_RULES).filter(([, rule]) => rule.required).map(([name]) => name),
      ["programName", "programRegistry", "programRegistryId"]);
    assert.deepEqual(validateCadTrustProjection(projection("program", {
      programName: "Example Crediting Programme", programRegistry: "Example Registry",
      programRegistryId: "REG-PROG-001",
    })), { ok: true });
  });

  await t.test("rejects missing program fields and CAD Trust-generated identifiers", () => {
    const missing = validateCadTrustProjection(projection("program", { programName: "Incomplete" }));
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "CADT_REQUIRED_FIELD_MISSING");
    const generated = validateCadTrustProjection(projection("program", {
      programName: "Example", programRegistry: "Registry", programRegistryId: "P-1",
      cadTrustProgramId: "must-be-generated",
    }));
    assert.equal(generated.ok, false);
    assert.equal(generated.code, "CADT_FIELD_UNMAPPED");
  });

  await t.test("pins methodology required fields and optional type picklist", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_METHODOLOGY_FIELD_RULES).filter(([, rule]) => rule.required).map(([name]) => name),
      ["methodologyCode", "methodologyName"]);
    assert.deepEqual(validateCadTrustProjection(projection("methodology", {
      methodologyCode: "METH-001", methodologyName: "Organic waste methane avoidance",
      methodologyType: "Avoidance - technical", methodologyVersion: "1.0",
      methodologyDate: "2026-11-12", methodologyLink: "https://example.org/methodology",
    })), { ok: true });
  });

  await t.test("rejects invalid methodology picklist, URL and date", () => {
    const base = { methodologyCode: "M-1", methodologyName: "Method" };
    assert.equal(validateCadTrustProjection(projection("methodology", { ...base, methodologyType: "RupayKg Verified" })).ok, false);
    assert.equal(validateCadTrustProjection(projection("methodology", { ...base, methodologyLink: "/method" })).ok, false);
    assert.equal(validateCadTrustProjection(projection("methodology", { ...base, methodologyDate: "2026-13-40" })).ok, false);
  });

  await t.test("blocks local issuance and unit creation", () => {
    assert.throws(() => assertExternalLifecycleEntity("issuance"));
    assert.throws(() => assertExternalLifecycleEntity("unit"));
  });
});
