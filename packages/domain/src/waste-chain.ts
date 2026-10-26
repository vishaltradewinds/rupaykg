/**
 * Product-level participant roles and waste families for pan-India waste-chain workflows.
 *
 * These codes are not legal classifications, permits or authorisations. A role must never
 * grant regulated capability by itself. Legal applicability must be assessed separately
 * for the exact organisation, facility, activity, material, jurisdiction, capacity and date.
 */
export const WASTE_PARTICIPANT_ROLES = [
  "GENERATOR",
  "COLLECTOR",
  "AGGREGATOR",
  "MATERIAL_RECOVERY_FACILITY",
  "TRANSPORTER",
  "RECYCLER",
  "PROCESSOR",
  "TREATMENT_OPERATOR",
  "DOWNSTREAM_BUYER",
  "EPR_OBLIGATED_ENTITY",
  "LOCAL_BODY",
  "COMPLIANCE_REVIEWER",
  "INDEPENDENT_VERIFIER",
] as const;

export type WasteParticipantRole = (typeof WASTE_PARTICIPANT_ROLES)[number];

export const WASTE_STREAM_FAMILIES = [
  "MSW_WET",
  "MSW_DRY_RECYCLABLE",
  "MSW_DRY_NON_RECYCLABLE",
  "MSW_SANITARY",
  "MSW_SPECIAL_CARE",
  "HORTICULTURAL_WASTE",
  "PLASTIC_PACKAGING",
  "E_WASTE",
  "BATTERY_WASTE",
  "WASTE_TYRE",
  "USED_OIL",
  "CONSTRUCTION_DEMOLITION",
  "HAZARDOUS_INDUSTRIAL",
  "BIOMEDICAL",
  "AGRI_RESIDUE",
  "ORGANIC_PROCESSING",
  "TEXTILE",
  "PAPER_CARDBOARD",
  "FERROUS_NONFERROUS_METAL",
  "GLASS",
  "WOOD",
  "OTHER_UNCLASSIFIED",
] as const;

export type WasteStreamFamily = (typeof WASTE_STREAM_FAMILIES)[number];

export type WasteTaxonomyRecord = {
  code: WasteStreamFamily;
  label: string;
  examples: readonly string[];
  taxonomyVersion: "IN-WASTE-1.0";
  legalApplicability: "MUST_BE_ASSESSED";
};

export const WASTE_TAXONOMY: readonly WasteTaxonomyRecord[] = [
  { code: "MSW_WET", label: "Municipal solid waste — wet", examples: ["food scraps", "kitchen waste", "vegetable waste"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "MSW_DRY_RECYCLABLE", label: "Municipal solid waste — dry recyclable", examples: ["paper", "metal", "glass", "recyclable plastic"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "MSW_DRY_NON_RECYCLABLE", label: "Municipal solid waste — dry non-recyclable", examples: ["non-recyclable dry fraction", "combustible residual"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "MSW_SANITARY", label: "Municipal solid waste — sanitary", examples: ["used diapers", "sanitary napkins"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "MSW_SPECIAL_CARE", label: "Municipal solid waste — special care", examples: ["discarded paint containers", "expired medicines", "waste batteries"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "HORTICULTURAL_WASTE", label: "Horticultural and park waste", examples: ["prunings", "leaves", "garden residues"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "PLASTIC_PACKAGING", label: "Plastic and plastic packaging", examples: ["plastic packaging", "polymer scrap"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "E_WASTE", label: "Electrical and electronic waste", examples: ["discarded electrical equipment", "electronic components"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "BATTERY_WASTE", label: "Waste batteries", examples: ["portable batteries", "industrial batteries", "vehicle batteries"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "WASTE_TYRE", label: "Waste tyres and rubber", examples: ["end-of-life tyres", "rubber scrap"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "USED_OIL", label: "Used oil and regulated oil waste", examples: ["used lubricating oil", "used industrial oil"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "CONSTRUCTION_DEMOLITION", label: "Construction and demolition waste", examples: ["concrete", "masonry", "excavated material", "mixed C&D"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "HAZARDOUS_INDUSTRIAL", label: "Potentially hazardous industrial waste", examples: ["process residues", "contaminated packaging", "regulated sludge"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "BIOMEDICAL", label: "Biomedical waste", examples: ["regulated healthcare waste categories"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "AGRI_RESIDUE", label: "Agricultural and horticultural residues", examples: ["crop residues", "husk", "bagasse"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "ORGANIC_PROCESSING", label: "Food, animal and other organic processing residues", examples: ["food-processing residues", "fish-market organics", "manure"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "TEXTILE", label: "Textile waste and offcuts", examples: ["fabric offcuts", "discarded textiles"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "PAPER_CARDBOARD", label: "Paper and cardboard", examples: ["corrugated board", "office paper"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "FERROUS_NONFERROUS_METAL", label: "Ferrous and non-ferrous metal", examples: ["iron", "steel", "aluminium", "copper scrap"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "GLASS", label: "Glass waste", examples: ["container glass", "flat glass"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "WOOD", label: "Wood waste", examples: ["untreated wood offcuts", "discarded pallets"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
  { code: "OTHER_UNCLASSIFIED", label: "Other or not-yet-classified material", examples: ["material awaiting qualified classification"], taxonomyVersion: "IN-WASTE-1.0", legalApplicability: "MUST_BE_ASSESSED" },
] as const;

const roleSet: ReadonlySet<string> = new Set(WASTE_PARTICIPANT_ROLES);
const streamSet: ReadonlySet<string> = new Set(WASTE_STREAM_FAMILIES);

export function isWasteParticipantRole(value: string): value is WasteParticipantRole {
  return roleSet.has(value);
}

export function isWasteStreamFamily(value: string): value is WasteStreamFamily {
  return streamSet.has(value);
}

/** Unknown material codes fail closed; they must not silently fall into a permissive stream. */
export function assertKnownWasteStream(value: string): asserts value is WasteStreamFamily {
  if (!isWasteStreamFamily(value)) {
    throw new Error("WASTE_CLASSIFICATION_REQUIRED: unknown material family must be reviewed");
  }
}

/** Product role is only a workflow selector, never proof of statutory authorisation. */
export function assertParticipantRole(value: string): asserts value is WasteParticipantRole {
  if (!isWasteParticipantRole(value)) {
    throw new Error("WASTE_PARTICIPANT_ROLE_UNKNOWN: select a supported operational role");
  }
}
