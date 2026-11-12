import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExternalLifecycleEntity,
  CAD_TRUST_INSERT_ORDER,
  CAD_TRUST_PROJECT_FIELD_RULES,
  CAD_TRUST_STAKEHOLDER_FIELD_RULES,
  CAD_TRUST_LABEL_FIELD_RULES,
  CAD_TRUST_VALIDATION_FIELD_RULES,
  CAD_TRUST_VERIFICATION_FIELD_RULES,
  CAD_TRUST_PROJECT_METHODOLOGY_FIELD_RULES,
  CAD_TRUST_PROGRAM_FIELD_RULES,
  CAD_TRUST_METHODOLOGY_FIELD_RULES,
  CAD_TRUST_SCHEMA_VERSION,
  validateCadTrustProjection,
} from "./cad-trust-v2.js";

const projection = (entityType: "project" | "program" | "methodology" | "stakeholder" | "label" | "validation" | "verification" | "project_methodology", fields: Record<string, unknown>) => ({
  schemaVersion: CAD_TRUST_SCHEMA_VERSION,
  entityType,
  sourceSystem: "RUPAYKG" as const,
  sourceId: "source-record-1",
  fields,
  provenance: { activityId: "source-record-1" },
});

const project = (fields: Record<string, unknown>) => projection("project", fields);

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

test("CAD Trust v2.0.2 entity-specific mappings", async (t) => {
  await t.test("preserves the complete published insert order", () => {
    assert.deepEqual(CAD_TRUST_INSERT_ORDER, [
      "program", "methodology", "stakeholder", "label", "project",
      "project_methodology", "validation", "verification", "location",
      "estimation", "rating", "co_benefit", "issuance", "unit", "unit_label",
    ]);
  });

  await t.test("pins project required fields to the entity schema", () => {
    const required = Object.entries(CAD_TRUST_PROJECT_FIELD_RULES)
      .filter(([, rule]) => rule.required).map(([name]) => name);
    assert.deepEqual(required, [
      "projectRegistryName", "projectId", "projectName", "projectLink",
      "projectSector", "projectType", "projectStatus", "projectStatusDate", "projectUnitMetric",
    ]);
    assert.deepEqual(validateCadTrustProjection(project(validProject)), { ok: true });
  });

  await t.test("rejects missing project fields and system-generated fields", () => {
    const missing = validateCadTrustProjection(project({ projectName: "Incomplete" }));
    assert.equal(missing.ok, false);
    assert.equal(missing.ok ? undefined : missing.code, "CADT_REQUIRED_FIELD_MISSING");
    const generated = validateCadTrustProjection(project({ ...validProject, cadTrustProjectId: "must-not-submit" }));
    assert.equal(generated.ok, false);
    assert.equal(generated.ok ? undefined : generated.code, "CADT_FIELD_UNMAPPED");
  });

  await t.test("rejects invalid project picklists, arrays, dates and URLs", () => {
    const invalidStatus = validateCadTrustProjection(project({ ...validProject, projectStatus: "APPROVED_BY_RUPAYKG" }));
    assert.equal(invalidStatus.ok ? undefined : invalidStatus.code, "CADT_PICKLIST_VALUE_INVALID");
    const invalidSector = validateCadTrustProjection(project({ ...validProject, projectSector: ["Waste handling and disposal", "Invented sector"] }));
    assert.equal(invalidSector.ok ? undefined : invalidSector.code, "CADT_PICKLIST_VALUE_INVALID");
    assert.equal(validateCadTrustProjection(project({ ...validProject, projectType: [] })).ok, false);
    assert.equal(validateCadTrustProjection(project({ ...validProject, projectType: "Waste" })).ok, false);
    assert.equal(validateCadTrustProjection(project({ ...validProject, projectStatusDate: "12-11-2026" })).ok, false);
    assert.equal(validateCadTrustProjection(project({ ...validProject, projectLink: "/project/1" })).ok, false);
  });

  await t.test("pins program required fields and accepts a valid program fixture", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_PROGRAM_FIELD_RULES).filter(([, rule]) => rule.required).map(([name]) => name),
      ["programName", "programRegistry", "programRegistryId"]);
    assert.deepEqual(validateCadTrustProjection(projection("program", {
      programName: "Example Crediting Programme",
      programRegistry: "Example Registry",
      programRegistryId: "REG-PROG-001",
      programDescription: "Test fixture only",
    })), { ok: true });
  });

  await t.test("rejects missing program fields and CAD Trust-generated identifiers", () => {
    const missing = validateCadTrustProjection(projection("program", { programName: "Incomplete" }));
    assert.equal(missing.ok ? undefined : missing.code, "CADT_REQUIRED_FIELD_MISSING");
    const generated = validateCadTrustProjection(projection("program", {
      programName: "Example", programRegistry: "Registry", programRegistryId: "P-1",
      cadTrustProgramId: "must-be-generated",
    }));
    assert.equal(generated.ok ? undefined : generated.code, "CADT_FIELD_UNMAPPED");
  });

  await t.test("pins methodology required fields and validates optional methodology type", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_METHODOLOGY_FIELD_RULES).filter(([, rule]) => rule.required).map(([name]) => name),
      ["methodologyCode", "methodologyName"]);
    assert.deepEqual(validateCadTrustProjection(projection("methodology", {
      methodologyCode: "METH-001",
      methodologyName: "Organic waste methane avoidance",
      methodologyType: "Avoidance - technical",
      methodologyVersion: "1.0",
      methodologyDate: "2026-11-12",
      methodologyLink: "https://example.org/methodology",
    })), { ok: true });
  });

  await t.test("rejects invalid methodology picklist, URL and calendar date", () => {
    const base = { methodologyCode: "M-1", methodologyName: "Method" };
    const invalidType = validateCadTrustProjection(projection("methodology", { ...base, methodologyType: "RupayKg Verified" }));
    assert.equal(invalidType.ok ? undefined : invalidType.code, "CADT_PICKLIST_VALUE_INVALID");
    assert.equal(validateCadTrustProjection(projection("methodology", { ...base, methodologyLink: "/method" })).ok, false);
    assert.equal(validateCadTrustProjection(projection("methodology", { ...base, methodologyDate: "2026-13-40" })).ok, false);
  });


  await t.test("pins stakeholder user-input fields, project FK and v2.0.2 picklist", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_STAKEHOLDER_FIELD_RULES).filter(([, rule]) => rule.required).map(([name]) => name),
      ["stakeholderName", "stakeholderType", "cadTrustProjectId"]);
    const valid = projection("stakeholder", {
      stakeholderName: "Municipal Aggregator Cooperative",
      stakeholderType: "Developer",
      stakeholderLink: "https://example.org/participants/aggregator",
      cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab",
    });
    assert.deepEqual(validateCadTrustProjection(valid), { ok: true });
    const missingProject = validateCadTrustProjection(projection("stakeholder", {
      stakeholderName: "Municipal Aggregator Cooperative",
      stakeholderType: "Developer",
    }));
    assert.equal(missingProject.ok ? undefined : missingProject.code, "CADT_REQUIRED_FIELD_MISSING");
    const invalidType = validateCadTrustProjection(projection("stakeholder", {
      stakeholderName: "Municipal Aggregator Cooperative",
      stakeholderType: "Generator",
      cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab",
    }));
    assert.equal(invalidType.ok ? undefined : invalidType.code, "CADT_PICKLIST_VALUE_INVALID");
    const generated = validateCadTrustProjection(projection("stakeholder", {
      stakeholderName: "Municipal Aggregator Cooperative",
      stakeholderType: "Developer",
      cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab",
      cadTrustStakeholderId: "must-be-generated",
    }));
    assert.equal(generated.ok ? undefined : generated.code, "CADT_FIELD_UNMAPPED");
    const invalidUrl = validateCadTrustProjection(projection("stakeholder", {
      stakeholderName: "Municipal Aggregator Cooperative",
      stakeholderType: "Developer",
      stakeholderLink: "/participants/aggregator",
      cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab",
    }));
    assert.equal(invalidUrl.ok ? undefined : invalidUrl.code, "CADT_FIELD_FORMAT_INVALID");
  });

  await t.test("pins label fields; labelName is free text and labelType is picklisted", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_LABEL_FIELD_RULES).filter(([, r]) => r.required).map(([n]) => n), ["labelName", "labelType"]);
    assert.deepEqual(validateCadTrustProjection(projection("label", { labelName: "RupayKg pilot label", labelType: "Certification", labelLink: "https://example.org/label", labelDate: "2026-11-12" })), { ok: true });
    const badType = validateCadTrustProjection(projection("label", { labelName: "Article 6 readiness", labelType: "RupayKg Approved" }));
    assert.equal(badType.ok ? undefined : badType.code, "CADT_PICKLIST_VALUE_INVALID");
    assert.equal(validateCadTrustProjection(projection("label", { labelName: "Certification", labelType: "Certification", labelLink: "/label" })).ok, false);
  });

  await t.test("pins validation fields, exact picklists, project FK and dates", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_VALIDATION_FIELD_RULES).filter(([, r]) => r.required).map(([n]) => n), ["validationId", "validationType", "validationBody", "cadTrustProjectId"]);
    const valid = { validationId: "VCS9218-Valid1023CP01", validationType: "Validation of Project Design Document", validationBody: "Bureau Veritas India Private Limited", validationDate: "2026-11-12", validationCreditPeriodStartDate: "2026-01-01", validationCreditPeriodEndDate: "2030-12-31", cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab" };
    assert.deepEqual(validateCadTrustProjection(projection("validation", valid)), { ok: true });
    const missingParent = validateCadTrustProjection(projection("validation", { ...valid, cadTrustProjectId: undefined }));
    assert.equal(missingParent.ok ? undefined : missingParent.code, "CADT_REQUIRED_FIELD_MISSING");
    const badBody = validateCadTrustProjection(projection("validation", { ...valid, validationBody: "RupayKg Internal Team" }));
    assert.equal(badBody.ok ? undefined : badBody.code, "CADT_PICKLIST_VALUE_INVALID");
    const badDate = validateCadTrustProjection(projection("validation", { ...valid, validationCreditPeriodEndDate: "2026-02-30" }));
    assert.equal(badDate.ok ? undefined : badDate.code, "CADT_FIELD_FORMAT_INVALID");
    const systemField = validateCadTrustProjection(projection("validation", { ...valid, createdAt: "2026-11-12" }));
    assert.equal(systemField.ok ? undefined : systemField.code, "CADT_FIELD_UNMAPPED");
  });

  await t.test("pins verification fields and external project/validation GUID references", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_VERIFICATION_FIELD_RULES).filter(([, r]) => r.required).map(([n]) => n), ["verificationId", "verificationBody", "cadTrustProjectId"]);
    const valid = { verificationId: "VCS9218-V1023", verificationStartDate: "2026-01-01", verificationEndDate: "2026-11-12", verificationBody: "Bureau Veritas India Private Limited", cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab", cadTrustValidationId: "c1b2c3d4-e5f6-4789-8abc-1234567890ab" };
    assert.deepEqual(validateCadTrustProjection(projection("verification", valid)), { ok: true });
    const missingParent = validateCadTrustProjection(projection("verification", { ...valid, cadTrustProjectId: undefined }));
    assert.equal(missingParent.ok ? undefined : missingParent.code, "CADT_REQUIRED_FIELD_MISSING");
    const badBody = validateCadTrustProjection(projection("verification", { ...valid, verificationBody: "RupayKg" }));
    assert.equal(badBody.ok ? undefined : badBody.code, "CADT_PICKLIST_VALUE_INVALID");
    const badValidationRef = validateCadTrustProjection(projection("verification", { ...valid, cadTrustValidationId: "local-validation-id" }));
    assert.equal(badValidationRef.ok ? undefined : badValidationRef.code, "CADT_FIELD_FORMAT_INVALID");
    const withoutOptionalValidation = { ...valid }; delete withoutOptionalValidation.cadTrustValidationId;
    assert.deepEqual(validateCadTrustProjection(projection("verification", withoutOptionalValidation)), { ok: true });
  });

  await t.test("pins project-methodology join fields and requires externally resolved parent references", () => {
    assert.deepEqual(Object.entries(CAD_TRUST_PROJECT_METHODOLOGY_FIELD_RULES)
      .filter(([, rule]) => rule.required).map(([name]) => name),
      ["cadTrustProjectMethodologyId", "cadTrustProjectId"]);
    const valid = projection("project_methodology", {
      cadTrustProjectMethodologyId: "a1b2c3d4-e5f6-4789-8abc-1234567890ab",
      cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab",
      projectMethodologyDate: "2026-11-12",
      projectMethodologyDescription: "Fixture relationship only",
    });
    assert.deepEqual(validateCadTrustProjection(valid), { ok: true });
    const missingParent = validateCadTrustProjection(projection("project_methodology", {
      cadTrustProjectMethodologyId: "a1b2c3d4-e5f6-4789-8abc-1234567890ab",
    }));
    assert.equal(missingParent.ok ? undefined : missingParent.code, "CADT_REQUIRED_FIELD_MISSING");
    const badGuid = validateCadTrustProjection(projection("project_methodology", {
      cadTrustProjectMethodologyId: "not-a-guid",
      cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab",
    }));
    assert.equal(badGuid.ok ? undefined : badGuid.code, "CADT_FIELD_FORMAT_INVALID");
    const systemField = validateCadTrustProjection(projection("project_methodology", {
      cadTrustProjectMethodologyId: "a1b2c3d4-e5f6-4789-8abc-1234567890ab",
      cadTrustProjectId: "b1b2c3d4-e5f6-4789-8abc-1234567890ab",
      cadTrustMethodologyId: "c1d2e3f4-a5b6-4789-8abc-1234567890ab",
    }));
    assert.equal(systemField.ok ? undefined : systemField.code, "CADT_FIELD_UNMAPPED");
  });

  await t.test("fails closed for entities without an implemented field map", () => {
    const result = validateCadTrustProjection({ ...project({}), entityType: "location" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "CADT_ENTITY_VALIDATION_NOT_IMPLEMENTED");
  });

  await t.test("blocks local issuance and unit creation", () => {
    assert.throws(() => assertExternalLifecycleEntity("issuance"));
    assert.throws(() => assertExternalLifecycleEntity("unit"));
  });
});
