/**
 * CAD Trust Data Model v2.0.2 projection boundary.
 *
 * Validation is entity-specific for program, methodology, and project.
 * Other entities fail closed until their own schema fixtures and field maps
 * are implemented.
 */
export const CAD_TRUST_SCHEMA_VERSION = "v2.0.2" as const;
export const CAD_TRUST_SCHEMA_SOURCE_COMMIT = "577f4e394c30d4a225485b2e5f25f1c38a0fd550" as const;

export type CadTrustEntityType =
  | "program" | "methodology" | "stakeholder" | "label" | "project"
  | "project_methodology" | "validation" | "verification" | "location"
  | "estimation" | "rating" | "co_benefit" | "issuance" | "unit" | "unit_label";

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

type FieldRule = {
  required: boolean;
  kind: "string" | "url" | "date" | "guid" | "string_array" | "picklist";
  picklist?: readonly string[];
};

export const CAD_TRUST_INSERT_ORDER: readonly CadTrustEntityType[] = [
  "program", "methodology", "stakeholder", "label", "project",
  "project_methodology", "validation", "verification", "location",
  "estimation", "rating", "co_benefit", "issuance", "unit", "unit_label",
] as const;

/** Exact user_input fields from CAD Trust schema v2.0.2. System/API fields are excluded. */
export const CAD_TRUST_PROGRAM_FIELD_RULES: Readonly<Record<string, FieldRule>> = {
  programName: { required: true, kind: "string" },
  programRegistry: { required: true, kind: "string" },
  programRegistryId: { required: true, kind: "string" },
  programDescription: { required: false, kind: "string" },
};

export const CAD_TRUST_METHODOLOGY_FIELD_RULES: Readonly<Record<string, FieldRule>> = {
  methodologyCode: { required: true, kind: "string" },
  methodologyName: { required: true, kind: "string" },
  methodologyType: { required: false, kind: "picklist", picklist: [
    "Avoidance - nature", "Avoidance - technical", "Not Determined",
    "Reduction - nature", "Reduction - technical", "Removal - nature", "Removal - technical",
  ] },
  methodologyVersion: { required: false, kind: "string" },
  methodologyDate: { required: false, kind: "date" },
  methodologyLink: { required: false, kind: "url" },
};

/** Exact user_input fields from CAD Trust schema v2.0.2; project FK is externally resolved. */
export const CAD_TRUST_STAKEHOLDER_FIELD_RULES: Readonly<Record<string, FieldRule>> = {
  stakeholderName: { required: true, kind: "string" },
  stakeholderType: { required: true, kind: "picklist", picklist: ["Consultant", "Developer", "Owner"] },
  stakeholderLink: { required: false, kind: "url" },
  cadTrustProjectId: { required: true, kind: "guid" },
};

/** Values are pinned to CAD Trust schema v2.0.2 (generated 2026-06-30). */
export const CAD_TRUST_PROJECT_FIELD_RULES: Readonly<Record<string, FieldRule>> = {
  projectRegistryName: { required: true, kind: "string" },
  projectId: { required: true, kind: "string" },
  projectCreditingProgram: { required: false, kind: "string" },
  projectName: { required: true, kind: "string" },
  projectLink: { required: true, kind: "url" },
  projectDescription: { required: false, kind: "string" },
  projectSector: { required: true, kind: "string_array", picklist: [
    "Afforestation and reforestation", "Agriculture", "Any combination of the above",
    "Carbon capture and storage", "Chemical industries", "Construction", "Energy demand",
    "Energy distribution", "Energy industries (renewable-/ non renewable sources)",
    "Fugitive emissions from fuel (solid, oil and gas)",
    "Fugitive emissions from the production and consumption of halocarbons and sulfur hexafluoride",
    "Livestock and manure management", "Manufacturing industries", "Metal production",
    "Mining/mineral production", "Others", "Solvent use", "Transport", "Urban Development",
    "Waste handling and disposal",
  ] },
  projectType: { required: true, kind: "string_array", picklist: [
    "Afforestation", "Agriculture", "Agriculture, forestry and other land use (AFOLU)",
    "Any combination of the above", "Biogas", "Biomass Energy", "CO2 usage", "Cement",
    "Coal bed/mine methane", "Energy Efficiency Industry", "Energy Efficiency households",
    "Energy Efficiency own generation", "Energy Efficiency service", "Energy Efficiency supply side",
    "Energy distribution", "Fugitive", "Geothermal", "Hydro", "Landfill gas", "Methane avoidance",
    "N2O", "PFCs and SF6", "Reforestation", "Solar", "Tidal", "Transport", "Waste", "Wind",
  ] },
  projectSubtype: { required: false, kind: "string" },
  projectStatus: { required: true, kind: "picklist", picklist: [
    "Certified", "Completed", "Inactive", "Listed", "Registered", "Rejected",
    "Validated", "Verified", "Withdrawn",
  ] },
  projectStatusDate: { required: true, kind: "date" },
  projectUnitMetric: { required: true, kind: "picklist", picklist: [
    "gCO2eq/kWh", "kt (Kiloton)", "tCO2e",
  ] },
  // CAD Trust accepts this optional user-input FK. The ID must come from CAD Trust.
  cadTrustProgramId: { required: false, kind: "string" },
};


/** Exact user_input fields from CAD Trust schema v2.0.2. The methodology FK is system-resolved. */
export const CAD_TRUST_PROJECT_METHODOLOGY_FIELD_RULES: Readonly<Record<string, FieldRule>> = {
  cadTrustProjectMethodologyId: { required: true, kind: "guid" },
  cadTrustProjectId: { required: true, kind: "guid" },
  projectMethodologyDate: { required: false, kind: "date" },
  projectMethodologyDescription: { required: false, kind: "string" },
};

export type CadTrustValidationResult =
  | { ok: true }
  | { ok: false; code: string; error: string };

export function validateCadTrustProjection(projection: CadTrustProjection): CadTrustValidationResult {
  if (projection.schemaVersion !== CAD_TRUST_SCHEMA_VERSION) {
    return { ok: false, code: "CADT_SCHEMA_VERSION_UNSUPPORTED", error: "Unsupported CAD Trust schema version" };
  }
  if (!projection.sourceId.trim()) {
    return { ok: false, code: "CADT_SOURCE_ID_REQUIRED", error: "sourceId is required" };
  }
  if (projection.sourceSystem !== "RUPAYKG") {
    return { ok: false, code: "CADT_SOURCE_SYSTEM_INVALID", error: "sourceSystem must be RUPAYKG" };
  }
  if (projection.entityType === "issuance" || projection.entityType === "unit") {
    return { ok: false, code: "CADT_EXTERNAL_AUTHORITY_REQUIRED", error: "Issuance and unit records require external registry authority" };
  }

  const fieldRules = projection.entityType === "stakeholder"
    ? CAD_TRUST_STAKEHOLDER_FIELD_RULES
    : projection.entityType === "program"
    ? CAD_TRUST_PROGRAM_FIELD_RULES
    : projection.entityType === "methodology"
      ? CAD_TRUST_METHODOLOGY_FIELD_RULES
      : projection.entityType === "project"
        ? CAD_TRUST_PROJECT_FIELD_RULES
        : projection.entityType === "project_methodology"
          ? CAD_TRUST_PROJECT_METHODOLOGY_FIELD_RULES
          : undefined;
  if (!fieldRules) {
    return { ok: false, code: "CADT_ENTITY_VALIDATION_NOT_IMPLEMENTED", error: "This entity has no pinned field map and cannot be exported" };
  }

  for (const [field, value] of Object.entries(projection.fields)) {
    const rule = fieldRules[field];
    if (!rule) {
      return { ok: false, code: "CADT_FIELD_UNMAPPED", error: field + " is not an allowed CAD Trust " + projection.entityType + " user-input field" };
    }
    if (value === undefined || value === null) {
      return { ok: false, code: "CADT_FIELD_VALUE_INVALID", error: field + " cannot be null" };
    }
    if ((rule.kind === "string" || rule.kind === "url" || rule.kind === "date" || rule.kind === "guid" || rule.kind === "picklist") &&
        (typeof value !== "string" || !value.trim())) {
      return { ok: false, code: "CADT_FIELD_TYPE_INVALID", error: field + " must be a non-empty string" };
    }
    if (rule.kind === "url") {
      try {
        const parsed = new URL(value as string);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Unsupported URL protocol");
      } catch {
        return { ok: false, code: "CADT_FIELD_FORMAT_INVALID", error: field + " must be an absolute HTTP(S) URL" };
      }
    }
    if (rule.kind === "guid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value as string)) {
      return { ok: false, code: "CADT_FIELD_FORMAT_INVALID", error: field + " must be a valid UUID/GUID" };
    }
    if (rule.kind === "date") {
      const date = value as string;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
      if (!match || !parsed || parsed.toISOString().slice(0, 10) !== date) {
        return { ok: false, code: "CADT_FIELD_FORMAT_INVALID", error: field + " must be a valid calendar date in YYYY-MM-DD" };
      }
    }
    if (rule.kind === "string_array") {
      if (!Array.isArray(value) || value.length === 0 || value.some(v => typeof v !== "string" || !v.trim())) {
        return { ok: false, code: "CADT_FIELD_TYPE_INVALID", error: field + " must be a non-empty string array" };
      }
      const invalid = value.find(v => !rule.picklist?.includes(v));
      if (invalid !== undefined) {
        return { ok: false, code: "CADT_PICKLIST_VALUE_INVALID", error: field + " contains an unsupported value: " + invalid };
      }
    }
    if (rule.kind === "picklist" && !rule.picklist?.includes(value as string)) {
      return { ok: false, code: "CADT_PICKLIST_VALUE_INVALID", error: field + " contains an unsupported picklist value" };
    }
  }

  for (const [field, rule] of Object.entries(fieldRules)) {
    const value = projection.fields[field];
    if (rule.required && (value === undefined || value === null ||
      (typeof value === "string" && !value.trim()) ||
      (Array.isArray(value) && value.length === 0))) {
      return { ok: false, code: "CADT_REQUIRED_FIELD_MISSING", error: field + " is required for CAD Trust " + projection.entityType + " projection" };
    }
  }
  return { ok: true };
}

/** Guardrail retained for callers that model external lifecycle entities. */
export function assertExternalLifecycleEntity(entityType: CadTrustEntityType): void {
  if (entityType === "issuance" || entityType === "unit") {
    throw new Error("CAD Trust issuance/unit records require external registry authority");
  }
}
