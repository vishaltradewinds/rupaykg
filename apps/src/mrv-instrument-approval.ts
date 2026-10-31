export interface MrvObservationInstrumentRef {
  instrument_id?: string | null;
  parameter_code?: string | null;
}

export interface MrvInstrumentApprovalEvidence {
  instrument_code: string;
  measurement_instrument: boolean;
  manufacturer_serial_number: string | null;
  asset_tag: string | null;
  calibration_serial_number: string | null;
  supported_parameter_codes: string[];
  approval_status: string;
  meity_certificate_id: string | null;
  meity_issuer: string | null;
  meity_certificate_scope: string | null;
  meity_verification_url: string | null;
  meity_evidence_reference: string | null;
  meity_evidence_sha256: string | null;
  meity_verified_at: string | Date | null;
  meity_validity_basis: string | null;
  meity_valid_until: string | Date | null;
  calibration_required: boolean;
  calibration_status: string;
  calibration_certificate_id: string | null;
  calibration_evidence_reference: string | null;
  calibration_evidence_sha256: string | null;
  calibration_lab: string | null;
  calibration_traceability: string | null;
  calibration_uncertainty: string | number | null;
  calibration_valid_until: string | Date | null;
  calibration_not_required_reason: string | null;
  firmware_version?: string | null;
  firmware_support_until?: string | Date | null;
  security_review_status: string;
  security_evidence_reference: string | null;
  security_evidence_sha256: string | null;
  security_reviewed_at: string | Date | null;
  security_not_applicable_reason: string | null;
}

export interface MrvInstrumentParameterSpec {
  instrument_code: string;
  parameter_code: string;
  unit: string;
  minimum_value: string | number;
  maximum_value: string | number;
  resolution: string | number;
  accuracy_absolute: string | number | null;
  accuracy_relative_percent: string | number | null;
}

export function instrumentParameterFailure(
  instrumentCode: string,
  parameterCode: string,
  unit: string,
  value: number,
  specs: readonly MrvInstrumentParameterSpec[],
): string | null {
  if (!Number.isFinite(value)) return "Measurement value must be a finite number.";
  if (!parameterCode.trim() || !unit.trim()) return "Measurement parameter code and unit are required.";
  const spec = specs.find((candidate) =>
    candidate.parameter_code.trim().toLowerCase() === parameterCode.trim().toLowerCase()
    && candidate.unit.trim() === unit.trim()
    && candidate.instrument_code === instrumentCode,
  );
  if (!spec) return `Instrument "${instrumentCode}" has no exact parameter/unit specification for "${parameterCode}" in "${unit}".`;
  const minimum = Number(spec.minimum_value);
  const maximum = Number(spec.maximum_value);
  const resolution = Number(spec.resolution);
  const absoluteAccuracy = spec.accuracy_absolute == null ? null : Number(spec.accuracy_absolute);
  const relativeAccuracy = spec.accuracy_relative_percent == null ? null : Number(spec.accuracy_relative_percent);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum
    || !Number.isFinite(resolution) || resolution <= 0
    || (absoluteAccuracy !== null && (!Number.isFinite(absoluteAccuracy) || absoluteAccuracy < 0))
    || (relativeAccuracy !== null && (!Number.isFinite(relativeAccuracy) || relativeAccuracy < 0))
    || (absoluteAccuracy === null && relativeAccuracy === null)) {
    return `Instrument "${instrumentCode}" has an invalid parameter specification.`;
  }
  if (value < minimum || value > maximum) {
    return `Measurement from instrument "${instrumentCode}" is outside the approved range [${minimum}, ${maximum}] ${spec.unit}.`;
  }
  if (Math.abs(value / resolution - Math.round(value / resolution)) > 0.000001) {
    return `Measurement from instrument "${instrumentCode}" exceeds the approved resolution ${resolution} ${spec.unit}.`;
  }
  return null;
}

function present(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function time(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const result = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function instrumentApprovalFailure(
  methodologyCode: string | null | undefined,
  observations: readonly MrvObservationInstrumentRef[],
  instruments: readonly MrvInstrumentApprovalEvidence[],
  now: Date = new Date(),
): string | null {
  const wa03 = /WA03[.\s_-]*001/i.test(methodologyCode ?? "");

  if (observations.length === 0) {
    return wa03
      ? "WA03.001 MRV submission requires instrument-linked observations."
      : "MRV submission requires instrument-linked observations.";
  }

  if (observations.some((observation) => !present(observation.instrument_id))) {
    return wa03
      ? "Every WA03.001 observation must identify its source instrument; missing instrument IDs are not eligible for MRV."
      : "Every MRV observation must identify its source instrument; missing instrument IDs are not eligible.";
  }

  const instrumentCodes = [...new Set(observations
    .map((observation) => typeof observation.instrument_id === "string" ? observation.instrument_id.trim() : "")
    .filter(Boolean))];

  if (instrumentCodes.length === 0) return "MRV submission has no instrument-linked observations.";

  const byCode = new Map(instruments.map((instrument) => [instrument.instrument_code, instrument]));
  const nowMs = now.getTime();

  for (const code of instrumentCodes) {
    const instrument = byCode.get(code);
    if (!instrument) return `Instrument "${code}" is not registered for this organization; MRV eligibility is blocked.`;
    if (instrument.approval_status !== "VERIFIED") {
      return `Instrument "${code}" is not VERIFIED; MRV eligibility is blocked.`;
    }
    if (instrument.measurement_instrument && !present(instrument.manufacturer_serial_number)) {
      return `Instrument "${code}" lacks its exact manufacturer serial number; physical-unit traceability is required.`;
    }
    if (!instrument.measurement_instrument && !present(instrument.manufacturer_serial_number) && !present(instrument.asset_tag)) {
      return `Instrument "${code}" lacks a physical serial number or organization asset tag.`;
    }
    if (instrument.calibration_required && instrument.calibration_serial_number !== instrument.manufacturer_serial_number) {
      return `Instrument "${code}" calibration certificate serial does not match the registered physical unit.`;
    }
    if (!instrument.calibration_required && instrument.calibration_serial_number !== null) {
      return `Instrument "${code}" has an inconsistent calibration serial despite calibration being marked not required.`;
    }
    if (!present(instrument.meity_certificate_id)
      || !present(instrument.meity_issuer)
      || !present(instrument.meity_certificate_scope)
      || typeof instrument.meity_verification_url !== "string"
      || !present(instrument.meity_evidence_reference)
      || !instrument.meity_verification_url.startsWith("https://")
      || !/^[0-9a-f]{64}$/i.test(instrument.meity_evidence_sha256 ?? '')
      || time(instrument.meity_verified_at) === null
      || (time(instrument.meity_verified_at) as number) > nowMs) {
      return `Instrument "${code}" lacks complete exact-model MeitY approval evidence.`;
    }
    if (instrument.meity_validity_basis === "VALID_UNTIL") {
      const validUntil = time(instrument.meity_valid_until);
      if (validUntil === null || validUntil <= nowMs) return `Instrument "${code}" has expired or unknown MeitY approval validity.`;
    } else if (instrument.meity_validity_basis === "NO_EXPIRY_CONFIRMED") {
      if (instrument.meity_valid_until !== null) return `Instrument "${code}" has inconsistent no-expiry approval evidence.`;
    } else {
      return `Instrument "${code}" has no verified MeitY approval validity basis.`;
    }

    if (instrument.calibration_required) {
      const calibrationUntil = time(instrument.calibration_valid_until);
      if (instrument.calibration_status !== "VERIFIED"
        || !present(instrument.calibration_certificate_id)
        || !present(instrument.calibration_evidence_reference)
        || !/^[0-9a-f]{64}$/i.test(instrument.calibration_evidence_sha256 ?? '')
        || !present(instrument.calibration_lab)
        || !present(instrument.calibration_traceability)
        || instrument.calibration_uncertainty === null
        || !Number.isFinite(Number(instrument.calibration_uncertainty))
        || Number(instrument.calibration_uncertainty) < 0
        || calibrationUntil === null
        || calibrationUntil <= nowMs) {
        return `Instrument "${code}" has missing, invalid or expired required calibration evidence.`;
      }
    } else if (instrument.calibration_status !== "NOT_APPLICABLE_WITH_JUSTIFICATION"
      || !present(instrument.calibration_not_required_reason)) {
      return `Instrument "${code}" lacks a written justification for not requiring calibration.`;
    }

    const firmwareSupportUntil = time(instrument.firmware_support_until);
    if (present(instrument.firmware_version)) {
      if (firmwareSupportUntil === null || firmwareSupportUntil <= nowMs
        || instrument.security_review_status !== "VERIFIED"
        || !present(instrument.security_evidence_reference)
        || !/^[0-9a-f]{64}$/i.test(instrument.security_evidence_sha256 ?? "")
        || time(instrument.security_reviewed_at) === null
        || (time(instrument.security_reviewed_at) as number) > nowMs) {
        return `Instrument "${code}" firmware support or security lifecycle evidence is missing, expired or unverified.`;
      }
    } else if (firmwareSupportUntil !== null
      || instrument.security_review_status !== "NOT_APPLICABLE_WITH_JUSTIFICATION"
      || !present(instrument.security_not_applicable_reason)) {
      return `Instrument "${code}" lacks a written security-lifecycle rationale for having no firmware.`;
    }

    const observationsForInstrument = observations.filter((observation) =>
      typeof observation.instrument_id === "string" && observation.instrument_id.trim() === code,
    );
    for (const observation of observationsForInstrument) {
      const parameterCode = typeof observation.parameter_code === "string" ? observation.parameter_code.trim() : "";
      if (!parameterCode) return `Observation from instrument "${code}" is missing its parameter code.`;
      const supportedCodes = Array.isArray(instrument.supported_parameter_codes) ? instrument.supported_parameter_codes : [];
      if (!supportedCodes.some((supported) => supported.trim().toLowerCase() === parameterCode.toLowerCase())) {
        return `Instrument "${code}" is not registered for observation parameter "${parameterCode}".`;
      }
    }
  }

  return null;
}
