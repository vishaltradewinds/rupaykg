import { createHash } from "node:crypto";

export type UncertaintyKind = "ABSOLUTE" | "RELATIVE";
export type UncertaintyExpression = "STANDARD" | "EXPANDED";

export interface ParameterUncertaintyInput {
  parameterCode: string;
  parameterUnit: string;
  kind: UncertaintyKind;
  value: number;
  valueUnit: string;
  expression: UncertaintyExpression;
  coverageFactor: number | null;
  confidenceLevelPercent: number | null;
  calibrationArtifactVersionId: string;
  calibrationArtifactSha256: string;
  calibrationReviewDecision: "APPROVED" | "REJECTED" | "PENDING";
  decisionRuleId: string;
}

export interface ValidatedParameterUncertainty {
  parameterCode: string;
  parameterUnit: string;
  kind: UncertaintyKind;
  value: number;
  valueUnit: string;
  expression: UncertaintyExpression;
  coverageFactor: number | null;
  confidenceLevelPercent: number | null;
  calibrationArtifactVersionId: string;
  calibrationArtifactSha256: string;
  decisionRuleId: string;
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const sha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);

/**
 * Validates the shape and evidence binding of a parameter-specific uncertainty
 * statement. It deliberately does not choose an acceptance threshold, convert
 * units, infer confidence, or replace review by a competent calibration body.
 */
export function validateParameterUncertainty(
  input: ParameterUncertaintyInput,
  expectedParameterCode: string,
  expectedParameterUnit: string,
): { ok: true; value: ValidatedParameterUncertainty } | { ok: false; reason: string } {
  if (!nonEmpty(input.parameterCode) || input.parameterCode.trim() !== expectedParameterCode.trim()) {
    return { ok: false, reason: "UNCERTAINTY_PARAMETER_MISMATCH" };
  }
  if (!nonEmpty(input.parameterUnit) || input.parameterUnit !== expectedParameterUnit) {
    return { ok: false, reason: "UNCERTAINTY_PARAMETER_UNIT_MISMATCH" };
  }
  if (!Number.isFinite(input.value) || input.value < 0) {
    return { ok: false, reason: "UNCERTAINTY_VALUE_INVALID" };
  }
  if (input.kind === "ABSOLUTE") {
    if (!nonEmpty(input.valueUnit) || input.valueUnit !== expectedParameterUnit) {
      return { ok: false, reason: "ABSOLUTE_UNCERTAINTY_UNIT_MISMATCH" };
    }
  } else if (input.kind === "RELATIVE") {
    if (input.valueUnit !== "%") {
      return { ok: false, reason: "RELATIVE_UNCERTAINTY_UNIT_MUST_BE_PERCENT" };
    }
  } else {
    return { ok: false, reason: "UNCERTAINTY_KIND_INVALID" };
  }
  if (input.expression !== "STANDARD" && input.expression !== "EXPANDED") {
    return { ok: false, reason: "UNCERTAINTY_EXPRESSION_INVALID" };
  }
  if (input.expression === "EXPANDED"
    && (!Number.isFinite(input.coverageFactor) || (input.coverageFactor ?? 0) <= 0)) {
    return { ok: false, reason: "EXPANDED_UNCERTAINTY_REQUIRES_COVERAGE_FACTOR" };
  }
  if (input.confidenceLevelPercent !== null
    && (!Number.isFinite(input.confidenceLevelPercent)
      || input.confidenceLevelPercent <= 0 || input.confidenceLevelPercent >= 100)) {
    return { ok: false, reason: "UNCERTAINTY_CONFIDENCE_LEVEL_INVALID" };
  }
  if (!nonEmpty(input.calibrationArtifactVersionId) || !sha256(input.calibrationArtifactSha256)) {
    return { ok: false, reason: "UNCERTAINTY_CALIBRATION_ARTIFACT_BINDING_INVALID" };
  }
  if (input.calibrationReviewDecision !== "APPROVED") {
    return { ok: false, reason: "UNCERTAINTY_CALIBRATION_EVIDENCE_NOT_APPROVED" };
  }
  if (!nonEmpty(input.decisionRuleId)) {
    return { ok: false, reason: "UNCERTAINTY_DECISION_RULE_REQUIRED" };
  }

  return {
    ok: true,
    value: {
      parameterCode: input.parameterCode.trim(),
      parameterUnit: input.parameterUnit,
      kind: input.kind,
      value: input.value,
      valueUnit: input.valueUnit,
      expression: input.expression,
      coverageFactor: input.coverageFactor,
      confidenceLevelPercent: input.confidenceLevelPercent,
      calibrationArtifactVersionId: input.calibrationArtifactVersionId,
      calibrationArtifactSha256: input.calibrationArtifactSha256.toLowerCase(),
      decisionRuleId: input.decisionRuleId.trim(),
    },
  };
}

export interface RawFrameEvidence {
  sha256: string;
  byteLength: number;
  claimedDigestMatched: boolean | null;
}

/**
 * Hashes the exact byte sequence received by the server, before parsing or
 * normalization. Persistence, immutable object versioning and device
 * authentication remain responsibilities of the receiving service.
 */
export function hashRawInstrumentFrame(
  rawBytes: Uint8Array,
  claimedSha256?: string | null,
  maxBytes = 1_048_576,
): RawFrameEvidence {
  if (!(rawBytes instanceof Uint8Array) || rawBytes.byteLength === 0) {
    throw new Error("RAW_FRAME_EMPTY_OR_INVALID");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || rawBytes.byteLength > maxBytes) {
    throw new Error("RAW_FRAME_SIZE_LIMIT_EXCEEDED");
  }
  const digest = createHash("sha256").update(rawBytes).digest("hex");
  const claimedDigestMatched = claimedSha256 == null
    ? null
    : sha256(claimedSha256) && digest === claimedSha256.toLowerCase();
  return { sha256: digest, byteLength: rawBytes.byteLength, claimedDigestMatched };
}
