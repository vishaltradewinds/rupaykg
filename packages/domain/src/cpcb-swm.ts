export type SwmStakeholderType = "BWG" | "WASTE_FACILITY" | "ULB" | "DISTRICT_PANCHAYAT" | "GRAM_PANCHAYAT" | "COLLECTOR_TRANSPORTER" | "PROCESSOR";

export type EvidenceReadinessStatus =
  | "MISSING"
  | "PROVIDED_UNVERIFIED"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "NOT_APPLICABLE"
  | "UNRESOLVED";

export interface SourcedObservation {
  value: number | null;
  unit: string;
  sourceReference?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface BwgEligibilityInputs {
  floorAreaM2: SourcedObservation;
  waterConsumptionLitresPerDay: SourcedObservation;
  wasteGenerationKgPerDay: SourcedObservation;
}

export type BwgEligibilityResult = {
  status: "ELIGIBLE_PRECHECK" | "NOT_ELIGIBLE_PRECHECK" | "UNRESOLVED";
  qualifyingCriteria: Array<"FLOOR_AREA" | "WATER_CONSUMPTION" | "WASTE_GENERATION">;
  missingOrInvalid: string[];
  disclaimer: "READINESS_AID_NOT_OFFICIAL_CPCB_DETERMINATION";
};

const thresholds = {
  FLOOR_AREA: { key: "floorAreaM2", threshold: 20_000, unit: "m2", label: "floorAreaM2" },
  WATER_CONSUMPTION: { key: "waterConsumptionLitresPerDay", threshold: 40_000, unit: "L/day", label: "waterConsumptionLitresPerDay" },
  WASTE_GENERATION: { key: "wasteGenerationKgPerDay", threshold: 100, unit: "kg/day", label: "wasteGenerationKgPerDay" },
} as const;

function validIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/**
 * Pre-check only: CPCB's published BWG thresholds are alternatives (OR), not cumulative.
 * Unknown, malformed or unsourced values cannot be treated as a confirmed negative.
 */
export function assessBwgEligibility(input: BwgEligibilityInputs): BwgEligibilityResult {
  const qualifyingCriteria: BwgEligibilityResult["qualifyingCriteria"] = [];
  const missingOrInvalid: string[] = [];
  const observations = [
    ["FLOOR_AREA", input.floorAreaM2, thresholds.FLOOR_AREA],
    ["WATER_CONSUMPTION", input.waterConsumptionLitresPerDay, thresholds.WATER_CONSUMPTION],
    ["WASTE_GENERATION", input.wasteGenerationKgPerDay, thresholds.WASTE_GENERATION],
  ] as const;

  for (const [criterion, observation, rule] of observations) {
    if (observation.value === null || observation.value === undefined) {
      missingOrInvalid.push(rule.label + ":VALUE_MISSING");
      continue;
    }
    if (!Number.isFinite(observation.value) || observation.value < 0) {
      missingOrInvalid.push(rule.label + ":INVALID_VALUE");
      continue;
    }
    if (observation.unit.trim() !== rule.unit) {
      missingOrInvalid.push(rule.label + ":UNIT_MISMATCH");
      continue;
    }
    if (!observation.sourceReference?.trim()) {
      missingOrInvalid.push(rule.label + ":SOURCE_MISSING");
      continue;
    }
    if (!observation.periodStart || !observation.periodEnd ||
        !validIsoDate(observation.periodStart) || !validIsoDate(observation.periodEnd) ||
        observation.periodStart > observation.periodEnd) {
      missingOrInvalid.push(rule.label + ":PERIOD_INVALID");
      continue;
    }
    if (observation.value >= rule.threshold) qualifyingCriteria.push(criterion);
  }

  const status = qualifyingCriteria.length
    ? "ELIGIBLE_PRECHECK"
    : missingOrInvalid.length
      ? "UNRESOLVED"
      : "NOT_ELIGIBLE_PRECHECK";

  return {
    status,
    qualifyingCriteria,
    missingOrInvalid,
    disclaimer: "READINESS_AID_NOT_OFFICIAL_CPCB_DETERMINATION",
  };
}

export interface SwmChecklistItem {
  key: string;
  label: string;
  status: EvidenceReadinessStatus;
  officialRequirement: "GUIDE_LISTED" | "RULE_DERIVED" | "NEEDS_OFFICIAL_CONFIRMATION";
}

export function initialSwmChecklist(stakeholder: SwmStakeholderType): SwmChecklistItem[] {
  const item = (key: string, label: string, officialRequirement: SwmChecklistItem["officialRequirement"]): SwmChecklistItem =>
    ({ key, label, status: "MISSING", officialRequirement });
  switch (stakeholder) {
    case "BWG":
      return [
        item("property_or_building_document", "Property tax document or building approval plan", "GUIDE_LISTED"),
        item("water_consumption_bill", "Water consumption bill", "GUIDE_LISTED"),
        item("eligibility_measurements", "Floor area, water consumption and waste generation with source and period", "GUIDE_LISTED"),
        item("segregation_plan", "Four-stream segregation and handover evidence", "RULE_DERIVED"),
        item("registered_handover_destinations", "Evidence of authorized/registered handover destinations", "RULE_DERIVED"),
        item("ebwgr_evidence", "EBWGR certificate references/evidence from competent local body", "RULE_DERIVED"),
        item("cpcb_application_reference", "CPCB application reference and acknowledgement, if submitted", "NEEDS_OFFICIAL_CONFIRMATION"),
      ];
    case "WASTE_FACILITY":
    case "PROCESSOR":
      return [
        item("facility_layout_plan", "Facility layout plan", "GUIDE_LISTED"),
        item("consent_to_establish", "Consent to Establish (CTE)", "GUIDE_LISTED"),
        item("consent_to_operate", "Consent to Operate (CTO)", "GUIDE_LISTED"),
        item("spcb_authorization", "SPCB/PCC authorization", "GUIDE_LISTED"),
        item("environmental_clearance", "Environmental clearance, where applicable", "GUIDE_LISTED"),
        item("intake_processing_records", "Intake, processing, output and residue records", "RULE_DERIVED"),
      ];
    case "ULB":
    case "DISTRICT_PANCHAYAT":
    case "GRAM_PANCHAYAT":
      return [
        item("jurisdiction_and_authority", "Verified jurisdiction and authorized officer", "GUIDE_LISTED"),
        item("collection_transport_records", "Collection and transport quantity records", "RULE_DERIVED"),
        item("registered_destination_records", "Delivery to registered processing facilities", "RULE_DERIVED"),
        item("certificate_issuance_boundary", "Official EBWGR certificates issued only by competent local body", "RULE_DERIVED"),
      ];
    case "COLLECTOR_TRANSPORTER":
      return [
        item("authorized_actor", "Verified organization membership and role", "RULE_DERIVED"),
        item("collection_handover_records", "Source, stream, quantity, date and handover evidence", "RULE_DERIVED"),
        item("destination_and_transport", "Authorized destination and transport evidence", "RULE_DERIVED"),
      ];
  }
}
