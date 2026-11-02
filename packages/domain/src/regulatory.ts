export const REGULATORY_STATUS = {
  DRAFT: "DRAFT",
  PROPOSED: "PROPOSED",
  NOTIFIED: "NOTIFIED",
  IN_FORCE: "IN_FORCE",
  SUPERSEDED: "SUPERSEDED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export type RegulatoryStatus =
  (typeof REGULATORY_STATUS)[keyof typeof REGULATORY_STATUS];

export const REGULATORY_INSTRUMENT = {
  ACT: "ACT",
  RULE: "RULE",
  REGULATION: "REGULATION",
  NOTIFICATION: "NOTIFICATION",
  CIRCULAR: "CIRCULAR",
  ORDER: "ORDER",
  GUIDELINE: "GUIDELINE",
  DRAFT: "DRAFT",
  CONSULTATION: "CONSULTATION",
} as const;

export type RegulatoryInstrument =
  (typeof REGULATORY_INSTRUMENT)[keyof typeof REGULATORY_INSTRUMENT];

export interface RegulatorySource {
  authority: string;
  title: string;
  instrument: RegulatoryInstrument;
  reference?: string;
  publishedOn: string;
  effectiveFrom?: string;
  jurisdiction: string;
  sourceUrl: string;
  verifiedOn: string;
  status: RegulatoryStatus;
}

export function isProductionApplicable(source: RegulatorySource): boolean {
  return source.status === REGULATORY_STATUS.IN_FORCE;
}

export function assertProductionApplicable(source: RegulatorySource): void {
  if (!isProductionApplicable(source)) {
    throw new Error(
      `Regulatory source is not in force: ${source.title} (${source.status})`,
    );
  }
}
