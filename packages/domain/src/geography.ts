export type GeographyKind =
  | "COUNTRY" | "STATE_UT" | "DISTRICT" | "SUB_DISTRICT" | "BLOCK" | "TALUK" | "TEHSIL"
  | "ULB" | "WARD" | "LOCALITY" | "GRAM_PANCHAYAT" | "VILLAGE" | "HABITATION" | "CLUSTER";

export type GeographyMode = "URBAN" | "RURAL";

/**
 * A source-specific parent -> allowed child map.
 *
 * India does not have one universally valid hierarchy across all states, local
 * bodies and datasets. Callers handling authoritative geography must provide a
 * hierarchy validated against that source/version instead of treating the
 * starter map below as a legal or nationwide authority.
 */
export type GeographyHierarchy = Partial<Record<GeographyKind, readonly GeographyKind[]>>;

const urban = new Set<GeographyKind>(["ULB", "WARD", "LOCALITY"]);
const rural = new Set<GeographyKind>(["GRAM_PANCHAYAT", "VILLAGE", "HABITATION", "CLUSTER"]);

/** Platform classification only; not a substitute for source-specific legal jurisdiction. */
export function geographyMode(kind: GeographyKind): GeographyMode | "NATIONAL" | "ADMINISTRATIVE" {
  if (urban.has(kind)) return "URBAN";
  if (rural.has(kind)) return "RURAL";
  if (kind === "COUNTRY") return "NATIONAL";
  return "ADMINISTRATIVE";
}

/**
 * Validate one edge against an explicitly supplied, source-versioned hierarchy.
 * Requiring the profile at the call site prevents accidental use of a starter
 * hierarchy for authoritative Pan-India decisions.
 */
export function isValidChild(
  parent: GeographyKind,
  child: GeographyKind,
  hierarchy: GeographyHierarchy,
): boolean {
  return hierarchy[parent]?.includes(child) ?? false;
}

/**
 * Starter profile for local development and tests only. Do not use as a
 * universal India hierarchy or to grant jurisdictional authorization.
 */
export const DEFAULT_GEOGRAPHY_HIERARCHY: Readonly<Record<GeographyKind, readonly GeographyKind[]>> = {
  COUNTRY: ["STATE_UT"],
  STATE_UT: ["DISTRICT"],
  DISTRICT: ["SUB_DISTRICT", "BLOCK", "TALUK", "TEHSIL"],
  SUB_DISTRICT: ["ULB", "GRAM_PANCHAYAT", "CLUSTER"],
  BLOCK: ["GRAM_PANCHAYAT", "VILLAGE", "CLUSTER"],
  TALUK: ["VILLAGE", "CLUSTER", "ULB"],
  TEHSIL: ["VILLAGE", "CLUSTER", "ULB"],
  ULB: ["WARD", "LOCALITY"],
  WARD: ["LOCALITY"],
  LOCALITY: [],
  GRAM_PANCHAYAT: ["VILLAGE", "HABITATION", "CLUSTER"],
  VILLAGE: ["HABITATION", "CLUSTER"],
  HABITATION: ["CLUSTER"],
  CLUSTER: [],
};
