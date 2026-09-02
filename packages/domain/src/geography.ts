export type GeographyKind =
  | "COUNTRY" | "STATE_UT" | "DISTRICT" | "SUB_DISTRICT"
  | "ULB" | "WARD" | "LOCALITY" | "GRAM_PANCHAYAT" | "VILLAGE" | "CLUSTER";

export type GeographyMode = "URBAN" | "RURAL";

const urban = new Set<GeographyKind>(["ULB", "WARD", "LOCALITY"]);
const rural = new Set<GeographyKind>(["GRAM_PANCHAYAT", "VILLAGE", "CLUSTER"]);

export function geographyMode(kind: GeographyKind): GeographyMode | "NATIONAL" | "ADMINISTRATIVE" {
  if (urban.has(kind)) return "URBAN";
  if (rural.has(kind)) return "RURAL";
  if (kind === "COUNTRY") return "NATIONAL";
  return "ADMINISTRATIVE";
}

export function isValidChild(parent: GeographyKind, child: GeographyKind): boolean {
  const allowed: Record<GeographyKind, GeographyKind[]> = {
    COUNTRY: ["STATE_UT"],
    STATE_UT: ["DISTRICT"],
    DISTRICT: ["SUB_DISTRICT"],
    SUB_DISTRICT: ["ULB", "GRAM_PANCHAYAT", "CLUSTER"],
    ULB: ["WARD", "LOCALITY"],
    WARD: ["LOCALITY"],
    LOCALITY: [],
    GRAM_PANCHAYAT: ["VILLAGE", "CLUSTER"],
    VILLAGE: ["CLUSTER"],
    CLUSTER: [],
  };
  return allowed[parent].includes(child);
}
