import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExternalLifecycleEntity,
  CAD_TRUST_INSERT_ORDER,
  CAD_TRUST_SCHEMA_VERSION,
  validateCadTrustProjection,
} from "./cad-trust-v2.js";

test("CAD Trust v2.0.2 projection boundary", async (t) => {
  await t.test("uses the published v2 insert order", () => {
    assert.equal(CAD_TRUST_INSERT_ORDER[0], "program");
    assert.equal(CAD_TRUST_INSERT_ORDER.at(-1), "unit_label");
  });

  await t.test("rejects missing required project fields", () => {
    const result = validateCadTrustProjection({
      schemaVersion: CAD_TRUST_SCHEMA_VERSION,
      entityType: "project",
      sourceSystem: "RUPAYKG",
      sourceId: "activity-1",
      fields: { projectName: "Test" },
      provenance: { activityId: "activity-1" },
    });

    assert.equal(result.ok, false);
  });

  await t.test("accepts a minimally complete project projection", () => {
    const result = validateCadTrustProjection({
      schemaVersion: CAD_TRUST_SCHEMA_VERSION,
      entityType: "project",
      sourceSystem: "RUPAYKG",
      sourceId: "activity-1",
      fields: {
        projectRegistryName: "RupayKg",
        projectId: "activity-1",
        projectName: "Test Project",
        projectLink: "https://example.invalid/project/activity-1",
        projectSector: ["WASTE"],
        projectType: ["WASTE_MANAGEMENT"],
        projectStatus: "ACTIVE",
        projectStatusDate: "2026-11-12",
        projectUnitMetric: "TONNES_CO2E",
      },
      provenance: { activityId: "activity-1" },
    });

    assert.deepEqual(result, { ok: true });
  });

  await t.test("rejects unmapped fields instead of silently exporting them", () => {
    const result = validateCadTrustProjection({
      schemaVersion: CAD_TRUST_SCHEMA_VERSION,
      entityType: "project",
      sourceSystem: "RUPAYKG",
      sourceId: "activity-1",
      fields: { unexpectedField: "must-not-export" },
      provenance: { activityId: "activity-1" },
    });

    assert.deepEqual(result, {
      ok: false,
      code: "CADT_FIELD_UNMAPPED",
      error: "unexpectedField is not mapped to a CAD Trust user-input field",
    });
  });

  await t.test("blocks local creation of issuance and unit lifecycle records", () => {
    assert.throws(() => assertExternalLifecycleEntity("issuance"));
    assert.throws(() => assertExternalLifecycleEntity("unit"));
  });
});
