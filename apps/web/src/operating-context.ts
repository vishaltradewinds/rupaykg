export type OperatingContext = "urban" | "rural";

export const OPERATING_CONTEXT_STORAGE_KEY = "rupaykg.operatingContext";

export type OperatingContextConfig = {
  label: string;
  anchor: string;
  unit: string;
  waste: string;
  analytics: string;
  actor: string;
  geography: string;
  fieldFocus: string;
  categories: readonly string[];
};

export const OPERATING_CONTEXTS: Record<OperatingContext, OperatingContextConfig> = {
  urban: {
    label: "Urban",
    anchor: "Municipal Corporation",
    unit: "Ward",
    waste: "MSW",
    analytics: "Ward Analytics",
    actor: "Citizen / MSW Generator",
    geography: "State → District → ULB → Ward → Facility → Activity",
    fieldFocus: "Municipal solid waste, collection, MRF and recycling flows",
    categories: ["Municipal", "Plastics", "Metals", "E-Waste", "Textiles", "Hazardous", "Construction", "Industrial"],
  },
  rural: {
    label: "Rural",
    anchor: "Gram Panchayat",
    unit: "Village",
    waste: "Biomass",
    analytics: "Village Analytics",
    actor: "Farmer / FPO / Biomass Generator",
    geography: "State → District → Block → Gram Panchayat → Village → Producer → Activity",
    fieldFocus: "Agricultural, forestry, livestock and other biomass resource flows",
    categories: ["Agricultural", "Forestry", "Livestock", "Aquatic"],
  },
};

export function readOperatingContext(): OperatingContext {
  return window.localStorage.getItem(OPERATING_CONTEXT_STORAGE_KEY) === "rural" ? "rural" : "urban";
}

export function getOperatingContextConfig(context: OperatingContext = readOperatingContext()): OperatingContextConfig {
  return OPERATING_CONTEXTS[context];
}
