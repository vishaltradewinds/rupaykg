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
  effectiveTo?: string;
  jurisdiction: string;
  sourceUrl: string;
  verifiedOn: string;
  status: RegulatoryStatus;
}

export interface RegulatoryApplicabilityContext {
  /** ISO-8601 calendar date. Defaults to today's UTC date. */
  asOfDate?: string;
  /** State/UT or national jurisdiction for the workflow being assessed. */
  jurisdiction?: string;
}

export type RegulatoryApplicabilityResult =
  | { applicable: true; reason: "IN_FORCE_AND_WITHIN_EFFECTIVE_DATES" }
  | {
      applicable: false;
      reason:
        | "SOURCE_NOT_IN_FORCE"
        | "MISSING_OR_INVALID_EFFECTIVE_FROM"
        | "INVALID_EFFECTIVE_TO"
        | "NOT_YET_EFFECTIVE"
        | "NO_LONGER_EFFECTIVE"
        | "JURISDICTION_MISMATCH"
        | "MISSING_OR_INVALID_SOURCE_METADATA";
    };

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Conservative release/applicability guard. This establishes only whether a
 * source record is eligible for rule evaluation; it is not a legal conclusion
 * that a particular entity or activity is covered by the source.
 */
export function evaluateRegulatorySource(
  source: RegulatorySource,
  context: RegulatoryApplicabilityContext = {},
): RegulatoryApplicabilityResult {
  const asOfDate = context.asOfDate ?? new Date().toISOString().slice(0, 10);

  if (
    !source.authority.trim() ||
    !source.title.trim() ||
    !source.jurisdiction.trim() ||
    !source.sourceUrl.trim() ||
    !/^https:\/\//i.test(source.sourceUrl) ||
    !isCalendarDate(source.publishedOn) ||
    !isCalendarDate(source.verifiedOn) ||
    !isCalendarDate(asOfDate)
  ) {
    return { applicable: false, reason: "MISSING_OR_INVALID_SOURCE_METADATA" };
  }

  if (source.status !== REGULATORY_STATUS.IN_FORCE) {
    return { applicable: false, reason: "SOURCE_NOT_IN_FORCE" };
  }

  if (!isCalendarDate(source.effectiveFrom)) {
    return { applicable: false, reason: "MISSING_OR_INVALID_EFFECTIVE_FROM" };
  }

  if (source.effectiveTo !== undefined && !isCalendarDate(source.effectiveTo)) {
    return { applicable: false, reason: "INVALID_EFFECTIVE_TO" };
  }

  if (asOfDate < source.effectiveFrom) {
    return { applicable: false, reason: "NOT_YET_EFFECTIVE" };
  }

  if (source.effectiveTo !== undefined && asOfDate > source.effectiveTo) {
    return { applicable: false, reason: "NO_LONGER_EFFECTIVE" };
  }

  const requestedJurisdiction = context.jurisdiction?.trim().toLocaleLowerCase("en-IN");
  const sourceJurisdiction = source.jurisdiction.trim().toLocaleLowerCase("en-IN");
  if (
    requestedJurisdiction &&
    sourceJurisdiction !== "india" &&
    sourceJurisdiction !== requestedJurisdiction
  ) {
    return { applicable: false, reason: "JURISDICTION_MISMATCH" };
  }

  return { applicable: true, reason: "IN_FORCE_AND_WITHIN_EFFECTIVE_DATES" };
}

export function isProductionApplicable(
  source: RegulatorySource,
  context: RegulatoryApplicabilityContext = {},
): boolean {
  return evaluateRegulatorySource(source, context).applicable;
}

export function assertProductionApplicable(
  source: RegulatorySource,
  context: RegulatoryApplicabilityContext = {},
): void {
  const result = evaluateRegulatorySource(source, context);
  if (!result.applicable) {
    throw new Error(
      `Regulatory source is not production applicable: ${source.title} (${result.reason})`,
    );
  }
}
