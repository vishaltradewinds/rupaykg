/**
 * RupayKg hardware edge contract.
 *
 * This package validates adapter output only. It does not read hardware, verify
 * calibration certificates, authenticate a device, persist evidence, or approve
 * MRV eligibility. Those decisions belong to canonical services and human
 * review gates. No protocol-specific adapter is enabled until the exact field
 * instrument manual and interface are known.
 */
export type CalibrationState = "VERIFIED_CURRENT" | "MISSING" | "EXPIRED" | "NOT_APPLICABLE_WITH_JUSTIFICATION";
export type AuthenticationState = "AUTHENTICATED" | "UNVERIFIED" | "REVOKED";
export type ObservationDisposition = "QUARANTINED" | "CALIBRATION_BLOCKED" | "READY_FOR_REVIEW";

export interface EdgeObservation {
  schemaVersion: "rupaykg.edge-observation.v1";
  eventId: string;
  deviceId: string;
  instrumentId: string;
  siteId: string;
  organizationId: string;
  parameterCode: string;
  observedAt: string;
  receivedAt: string;
  sequence: number;
  value: number;
  unit: string;
  rawPayloadSha256: string;
  firmwareVersion: string | null;
  calibrationRecordId: string | null;
  calibrationState: CalibrationState;
  authenticationState: AuthenticationState;
  clockQuality: "TRUSTED" | "UNCERTAIN";
  qualityFlags: string[];
}

export interface ObservationValidation {
  disposition: ObservationDisposition;
  blockers: string[];
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const validTime = (value: unknown): value is string => {
  // Require a full RFC3339-style timestamp with an explicit timezone; date-only
  // and timezone-naive values are ambiguous across edge devices.
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\\.\\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] ? Number(match[9]) : 0;
  const offsetMinute = match[8] ? Number(match[10]) : 0;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1
    && month >= 1 && month <= 12
    && day >= 1 && day <= (daysInMonth[month - 1] ?? 0)
    && hour <= 23 && minute <= 59 && second <= 59
    && offsetHour <= 23 && offsetMinute <= 59
    && Number.isFinite(Date.parse(value));
};
const validSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const quarantine = (blockers: string[]): ObservationValidation => ({
  disposition: "QUARANTINED",
  blockers,
});

/**
 * Runtime validation is deliberately defensive: JSON from a physical adapter is
 * untrusted even if the caller's TypeScript type claims otherwise.
 */
export function validateEdgeObservation(input: unknown): ObservationValidation {
  if (!isRecord(input)) return quarantine(["INVALID_OBSERVATION_OBJECT"]);

  const blockers: string[] = [];
  if (input.schemaVersion !== "rupaykg.edge-observation.v1") blockers.push("UNSUPPORTED_SCHEMA_VERSION");
  for (const [field, value] of Object.entries({
    eventId: input.eventId,
    deviceId: input.deviceId,
    instrumentId: input.instrumentId,
    siteId: input.siteId,
    organizationId: input.organizationId,
    parameterCode: input.parameterCode,
    unit: input.unit,
  })) {
    if (!nonEmpty(value)) blockers.push(`MISSING_OR_INVALID_${field.replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}`);
  }

  if (!validTime(input.observedAt)) blockers.push("INVALID_OBSERVED_AT");
  if (!validTime(input.receivedAt)) blockers.push("INVALID_RECEIVED_AT");
  if (validTime(input.observedAt) && validTime(input.receivedAt)
    && Date.parse(input.receivedAt) < Date.parse(input.observedAt)) {
    blockers.push("RECEIVED_BEFORE_OBSERVED");
  }
  if (!Number.isSafeInteger(input.sequence) || (input.sequence as number) < 0) blockers.push("INVALID_SEQUENCE");
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) blockers.push("INVALID_MEASUREMENT_VALUE");
  if (!validSha256(input.rawPayloadSha256)) blockers.push("INVALID_RAW_PAYLOAD_SHA256");
  if (input.firmwareVersion !== null && !nonEmpty(input.firmwareVersion)) blockers.push("INVALID_FIRMWARE_VERSION");
  if (!Array.isArray(input.qualityFlags) || input.qualityFlags.some((flag) => !nonEmpty(flag))) {
    blockers.push("INVALID_QUALITY_FLAGS");
  }
  if (!["AUTHENTICATED", "UNVERIFIED", "REVOKED"].includes(String(input.authenticationState))) {
    blockers.push("INVALID_AUTHENTICATION_STATE");
  } else if (input.authenticationState !== "AUTHENTICATED") {
    blockers.push("DEVICE_NOT_AUTHENTICATED");
  }
  if (!["TRUSTED", "UNCERTAIN"].includes(String(input.clockQuality))) {
    blockers.push("INVALID_CLOCK_QUALITY");
  } else if (input.clockQuality !== "TRUSTED") {
    blockers.push("DEVICE_CLOCK_UNCERTAIN");
  }
  if (!["VERIFIED_CURRENT", "MISSING", "EXPIRED", "NOT_APPLICABLE_WITH_JUSTIFICATION"]
    .includes(String(input.calibrationState))) {
    blockers.push("INVALID_CALIBRATION_STATE");
  }

  if (blockers.length) return quarantine(blockers);

  const calibrationState = input.calibrationState as CalibrationState;
  if (calibrationState === "MISSING" || calibrationState === "EXPIRED"
    || (calibrationState === "VERIFIED_CURRENT" && !nonEmpty(input.calibrationRecordId))) {
    return { disposition: "CALIBRATION_BLOCKED", blockers: ["CALIBRATION_EVIDENCE_MISSING_OR_EXPIRED"] };
  }
  if (input.calibrationRecordId !== null && !nonEmpty(input.calibrationRecordId)) {
    return { disposition: "CALIBRATION_BLOCKED", blockers: ["INVALID_CALIBRATION_RECORD_ID"] };
  }
  if (calibrationState === "NOT_APPLICABLE_WITH_JUSTIFICATION" && !nonEmpty(input.calibrationRecordId)) {
    // The canonical instrument register must independently verify the rationale.
    return {
      disposition: "CALIBRATION_BLOCKED",
      blockers: ["CALIBRATION_NOT_APPLICABLE_REQUIRES_REVIEWED_REGISTER_RECORD"],
    };
  }

  // This is a local shape check only, never an authoritative approval.
  return { disposition: "READY_FOR_REVIEW", blockers: [] };
}
