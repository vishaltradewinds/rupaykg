export type CarbonMarketMechanism = "COMPLIANCE" | "OFFSET" | "OTHER";

export type CarbonMarketMechanismDefinition = {
  code: CarbonMarketMechanism;
  name: string;
  participationModel: "MANDATORY" | "VOLUNTARY_PROJECT_BASED";
  authority: string;
  sourceUrl: string;
  description: string;
};

/**
 * First-class Indian Carbon Market mechanism catalogue used by the platform.
 * The catalogue is deliberately descriptive: statutory applicability and
 * issuance remain evidence/authority-backed and are never inferred from an
 * activity merely because it is carbon-relevant.
 */
export const CARBON_MARKET_MECHANISMS: readonly CarbonMarketMechanismDefinition[] = [
  {
    code: "COMPLIANCE",
    name: "CCTS Compliance Mechanism",
    participationModel: "MANDATORY",
    authority: "Bureau of Energy Efficiency / competent Indian authorities",
    sourceUrl: "https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116",
    description: "Mandatory pathway for notified obligated entities against prescribed GHG emission-intensity targets.",
  },
  {
    code: "OFFSET",
    name: "CCTS Offset Mechanism",
    participationModel: "VOLUNTARY_PROJECT_BASED",
    authority: "Bureau of Energy Efficiency / competent Indian authorities",
    sourceUrl: "https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=640&ls_id=737",
    description: "Voluntary project-based baseline-and-credit pathway for eligible non-obligated entities.",
  },
  {
    code: "OTHER",
    name: "Other / External Carbon Mechanism",
    participationModel: "VOLUNTARY_PROJECT_BASED",
    authority: "Explicitly identified competent authority or programme",
    sourceUrl: "https://beeindia.gov.in/",
    description: "Reserved for a separately identified mechanism; it is never treated as CCTS issuance without explicit authority evidence.",
  },
] as const;

export function isCarbonMarketMechanism(value: unknown): value is CarbonMarketMechanism {
  return value === "COMPLIANCE" || value === "OFFSET" || value === "OTHER";
}

export function assertCarbonMarketMechanism(value: unknown): CarbonMarketMechanism {
  if (!isCarbonMarketMechanism(value)) throw new Error("A valid carbon market mechanism is required: COMPLIANCE, OFFSET or OTHER");
  return value;
}

export type CarbonMechanismGateInput = {
  mechanism: CarbonMarketMechanism;
  methodologyMechanism: CarbonMarketMechanism;
  obligatedEntityStatus?: "CONFIRMED" | "NOT_OBLIGATED" | "UNKNOWN";
  projectEligibility?: "CONFIRMED" | "NOT_ELIGIBLE" | "UNKNOWN";
  authorityReferencePresent?: boolean;
};

/**
 * Fail-closed mechanism gate. This is an internal control, not a regulatory
 * approval. A compliance calculation requires confirmed obligated status;
 * an offset calculation requires confirmed project eligibility. Both require
 * the methodology to be governed for the same mechanism.
 */
export function evaluateCarbonMechanismGate(input: CarbonMechanismGateInput): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.mechanism !== input.methodologyMechanism) reasons.push("carbon mechanism must match the methodology mechanism");
  if (input.mechanism === "COMPLIANCE" && input.obligatedEntityStatus !== "CONFIRMED") reasons.push("compliance pathway requires confirmed obligated-entity status");
  if (input.mechanism === "OFFSET" && input.projectEligibility !== "CONFIRMED") reasons.push("offset pathway requires confirmed project eligibility");
  if (input.mechanism === "OTHER" && input.authorityReferencePresent !== true) reasons.push("external mechanism requires an explicit authority/programme reference");
  return { eligible: reasons.length === 0, reasons };
}

export const CARBON_VALUE_STATES = [
  "CALCULATED_PENDING_VERIFICATION",
  "VALUE_ELIGIBLE",
  "CERTIFIED_ISSUANCE_PENDING_EXTERNAL_AUTHORITY",
  "ISSUED",
  "REGISTERED",
  "TRANSFERRED",
  "RETIRED",
] as const;

export type CarbonValueState = typeof CARBON_VALUE_STATES[number];

/** Internal value state is never an assertion of external government issuance. */
export function canClaimIssuedCarbonCredit(state: CarbonValueState, externalIssuanceReference?: string | null): boolean {
  return state === "ISSUED" && Boolean(externalIssuanceReference?.trim());
}
