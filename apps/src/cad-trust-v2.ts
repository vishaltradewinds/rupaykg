/**
 * CAD Trust Data Model v2.0.2 projection boundary.
 *
 * This module is deliberately transport-neutral. It does not create CAD Trust
 * issuance/unit records and does not mutate authoritative RupayKg state.
 */

export const CAD_TRUST_SCHEMA_VERSION = "v2.0.2" as const;

export type CadTrustEntityType =
  | "program"
  | "methodology"
  | "stakeholder"
  | "label"
  | "project"
  | "project_methodology"
  | "validation"
  | "verification"
  | "location"
  | "estimation"
  | "rating"
  | "co_benefit"
  | "issuance"
  | "unit"
  | "unit_label";

export type CadTrustFieldSource = "user_input" | "system" | "api_generated";

export type CadTrustFieldDefinition = {
  apiField: string;
  required: boolean;
  source: CadTrustFieldSource;
  picklist?: string;
};

export type CadTrustProjection = {
  schemaVersion: typeof CAD_TRUST_SCHEMA_VERSION;
  entityType: CadTrustEntityType;
  sourceSystem: "RUPAYKG";
  sourceId: string;
  fields: Record<string, unknown>;
  provenance: {
    activityId?: string;
    evidenceId?: string;
    verificationId?: string;
    calculationId?: string;
    integrityHash?: string;
  };
};

export const CAD_TRUST_INSERT_ORDER: readonly CadTrustEntityType[] = [
  "program",
  "methodology",
  "stakeholder",
  "label",
  "project",
  "project_methodology",
  "validation",
  "verification",
  "location",
  "estimation",
  "rating",
  "co_benefit",
  "issuance",
  "unit",
  "unit_label",
] as const;

export const CAD_TRUST_FIELD_RULES: Readonly<Record<string, CadTrustFieldDefinition>> = {
  programName: { apiField: "programName", required: true, source: "user_input" },
  programRegistry: { apiField: "programRegistry", required: true, source: "user_input" },
  programRegistryId: { apiField: "programRegistryId", required: true, source: "user_input" },
  methodologyCode: { apiField: "methodologyCode", required: true, source: "user_input" },
  methodologyName: { apiField: "methodologyName", required: true, source: "user_input" },
  projectRegistryName: { apiField: "projectRegistryName", required: true, source: "user_input" },
  projectId: { apiField: "projectId", required: true, source: "user_input" },
  projectName: { apiField: "projectName", required: true, source: "user_input" },
  projectLink: { apiField: "projectLink", required: true, source: "user_input" },
  projectSector: { apiField: "projectSector", required: true, source: "user_input", picklist: "project_sector" },
  projectType: { apiField: "projectType", required: true, source: "user_input", picklist: "project_type" },
  projectStatus: { apiField: "projectStatus", required: true, source: "user_input", picklist: "project_status" },
  projectStatusDate: { apiField: "projectStatusDate", required: true, source: "user_input" },
  projectUnitMetric: { apiField: "projectUnitMetric", required: true, source: "user_input", picklist: "unit_metric" },
};

export function validateCadTrustProjection(
  projection: CadTrustProjection,
): { ok: true } | { ok: false; code: string; error: string } {
  if (projection.schemaVersion !== CAD_TRUST_SCHEMA_VERSION) {
    return { ok: false, code: "CADT_SCHEMA_VERSION_UNSUPPORTED", error: "Unsupported CAD Trust schema version" };
  }

  if (!projection.sourceId.trim()) {
    return { ok: false, code: "CADT_SOURCE_ID_REQUIRED", error: "sourceId is required" };
  }

  if (projection.sourceSystem !== "RUPAYKG") {
    return { ok: false, code: "CADT_SOURCE_SYSTEM_INVALID", error: "sourceSystem must be RUPAYKG" };
  }

  for (const fieldName of Object.keys(projection.fields)) {
    const definition = CAD_TRUST_FIELD_RULES[fieldName];
    if (!definition) {
      return {
        ok: false,
        code: "CADT_FIELD_UNMAPPED",
        error: fieldName + " is not mapped to a CAD Trust user-input field",
      };
    }
    if (definition.source !== "user_input") {
      return {
        ok: false,
        code: "CADT_FIELD_SOURCE_NOT_ALLOWED",
        error: fieldName + " is not allowed in a RupayKg-authored CAD Trust projection",
      };
    }
  }

  for (const [fieldName, definition] of Object.entries(CAD_TRUST_FIELD_RULES)) {
    if (definition.source !== "user_input") continue;
    if (!definition.required) continue;
    const value = projection.fields[fieldName];
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
      return {
        ok: false,
        code: "CADT_REQUIRED_FIELD_MISSING",
        error: `${fieldName} is required for CAD Trust projection`,
      };
    }
  }

  return { ok: true };
}

/**
 * Guardrail: registry lifecycle entities are external-authority records.
 * RupayKg cannot manufacture an issuance or unit from an MRV result.
 */
export function assertExternalLifecycleEntity(entityType: CadTrustEntityType): void {
  if (entityType === "issuance" || entityType === "unit") {
    throw new Error("CAD Trust issuance/unit records require external registry authority");
  }
}
