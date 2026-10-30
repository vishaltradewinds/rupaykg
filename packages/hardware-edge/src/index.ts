/**
 * RupayKg hardware edge contract.
 *
 * This package validates adapter output only. It does not read hardware, verify
 * calibration certificates, authenticate a device, persist evidence, or approve
 * MRV eligibility. Those decisions belong to the canonical services and human
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
const validTime = (value: unknown): boolean =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const validSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);

export function validateEdgeObservation(input: EdgeObservation): ObservationValidation {
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
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) blockers.push("INVALID_SEQUENCE");
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) blockers.push("INVALID_MEASUREMENT_VALUE");
  if (!validSha256(input.rawPayloadSha256)) blockers.push("INVALID_RAW_PAYLOAD_SHA256");
  if (!Array.isArray(input.qualityFlags) || input.qualityFlags.some((flag) => !nonEmpty(flag))) blockers.push("INVALID_QUALITY_FLAGS");
  if (input.authenticationState !== "AUTHENTICATED") blockers.push("DEVICE_NOT_AUTHENTICATED");
  if (input.clockQuality !== "TRUSTED") blockers.push("DEVICE_CLOCK_UNCERTAIN");

  if (blockers.length) return { disposition: "QUARANTINED", blockers };

  if (input.calibrationState === "MISSING" || input.calibrationState === "EXPIRED"
    || (input.calibrationState === "VERIFIED_CURRENT" && !nonEmpty(input.calibrationRecordId))) {
    return { disposition: "CALIBRATION_BLOCKED", blockers: ["CALIBRATION_EVIDENCE_MISSING_OR_EXPIRED"] };
  }
  if (input.calibrationState === "NOT_APPLICABLE_WITH_JUSTIFICATION" && !nonEmpty(input.calibrationRecordId)) {
    // The justification is expected to be resolved by the canonical instrument register.
    return { disposition: "CALIBRATION_BLOCKED", blockers: ["CALIBRATION_NOT_APPLICABLE_REQUIRES_REVIEWED_REGISTER_RECORD"] };
  }

  return { disposition: "READY_FOR_REVIEW", blockers: [] };
}
