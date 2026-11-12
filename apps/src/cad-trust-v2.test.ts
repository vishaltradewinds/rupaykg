import { describe, expect, it } from "vitest";
import {
  assertExternalLifecycleEntity,
  CAD_TRUST_INSERT_ORDER,
  CAD_TRUST_SCHEMA_VERSION,
  validateCadTrustProjection,
} from "./cad-trust-v2.js";

describe("CAD Trust v2.0.2 projection boundary", () => {
  it("uses the published v2 insert order", () => {
    expect(CAD_TRUST_INSERT_ORDER[0]).toBe("program");
    expect(CAD_TRUST_INSERT_ORDER.at(-1)).toBe("unit_label");
  });

  it("rejects missing required project fields", () => {
    const result = validateCadTrustProjection({
      schemaVersion: CAD_TRUST_SCHEMA_VERSION,
      entityType: "project",
      sourceSystem: "RUPAYKG",
      sourceId: "activity-1",
      fields: { projectName: "Test" },
      provenance: { activityId: "activity-1" },
    });

    expect(result.ok).toBe(false);
  });

  it("accepts a minimally complete project projection", () => {
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

    expect(result).toEqual({ ok: true });
  });

  it("blocks local creation of issuance and unit lifecycle records", () => {
    expect(() => assertExternalLifecycleEntity("issuance")).toThrow();
    expect(() => assertExternalLifecycleEntity("unit")).toThrow();
  });
});
