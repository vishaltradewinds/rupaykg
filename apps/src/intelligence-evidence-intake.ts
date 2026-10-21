export const WASTE_LOG_RECORD_TYPES = [
  "WASTE_MEASUREMENT",
  "WASTE_HANDOVER",
  "FACILITY_PROCESSING",
  "METHANE_OBSERVATION",
  "OTHER",
] as const;
export type WasteLogRecordType = typeof WASTE_LOG_RECORD_TYPES[number];

export const WASTE_STREAMS = ["WET", "DRY", "SANITARY", "SPECIAL_CARE", "UNKNOWN"] as const;
export type WasteStream = typeof WASTE_STREAMS[number];

export type WasteLogExtraction = {
  recordType: WasteLogRecordType;
  observedAt: string | null;
  quantity: number | null;
  unit: string | null;
  wasteStream: WasteStream | null;
  facilityReference: string | null;
  notes: string;
  confidence: number;
  warnings: string[];
};

export type ValidatedWasteLogExtraction = WasteLogExtraction & {
  validationStatus: "SCHEMA_VALIDATED_NOT_FACT_VERIFIED";
  authoritativeMutation: false;
  requiresHumanReview: true;
};

const allowedKeys = new Set([
  "recordType", "observedAt", "quantity", "unit", "wasteStream",
  "facilityReference", "notes", "confidence", "warnings",
]);
const recordTypes = new Set<string>(WASTE_LOG_RECORD_TYPES);
const streams = new Set<string>(WASTE_STREAMS);

function validIsoDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;

  // Capture indexes are explicit: 10 = offset hour, 11 = offset minute.
  // Avoid accidentally validating the sign character as the offset hour.
  const hour = match[4];
  const minute = match[5];
  const second = match[6];
  const offsetHour = match[10];
  const offsetMinute = match[11];
  const datePart = value.slice(0, 10);
  const parsedDate = new Date(datePart + "T00:00:00.000Z");
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== datePart) return false;

  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  if (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * Validate untrusted model output without coercion. Schema validity is not
 * evidence of truth: every result remains a review-only proposal.
 */
export function validateWasteLogExtraction(value: unknown): ValidatedWasteLogExtraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !allowedKeys.has(key))) return null;
  if (typeof row.recordType !== "string" || !recordTypes.has(row.recordType)) return null;
  if (row.observedAt !== null && (typeof row.observedAt !== "string" || !validIsoDateTime(row.observedAt))) return null;
  if (row.quantity !== null && (typeof row.quantity !== "number" || !Number.isFinite(row.quantity) || row.quantity < 0)) return null;
  if ((row.quantity === null) !== (row.unit === null)) return null;
  if (row.unit !== null && (typeof row.unit !== "string" || !row.unit.trim() || row.unit.length > 40)) return null;
  if (row.wasteStream !== null && (typeof row.wasteStream !== "string" || !streams.has(row.wasteStream))) return null;
  if (row.facilityReference !== null && (typeof row.facilityReference !== "string" || row.facilityReference.length > 240)) return null;
  if (typeof row.notes !== "string" || row.notes.length > 1000) return null;
  if (typeof row.confidence !== "number" || !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1) return null;
  if (!Array.isArray(row.warnings) || row.warnings.length > 10 ||
      row.warnings.some((warning) => typeof warning !== "string" || warning.length > 240)) return null;

  return {
    recordType: row.recordType as WasteLogRecordType,
    observedAt: row.observedAt as string | null,
    quantity: row.quantity as number | null,
    unit: row.unit as string | null,
    wasteStream: row.wasteStream as WasteStream | null,
    facilityReference: row.facilityReference as string | null,
    notes: row.notes,
    confidence: row.confidence,
    warnings: [...row.warnings] as string[],
    validationStatus: "SCHEMA_VALIDATED_NOT_FACT_VERIFIED",
    authoritativeMutation: false,
    requiresHumanReview: true,
  };
}
