import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; query: Record<string, unknown>; log: { error: (error: unknown) => void } };

const bodyOf = (request: Request): Record<string, unknown> => request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
const stringValue = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const uuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send(bearerChallenge()); return null; }
    return auth;
  } catch (error) {
    request.log.error(error);
    reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false });
    return null;
  }
}

async function canManageInstrument(pool: Pool, auth: AuthContext, organizationId: string): Promise<boolean> {
  if (!canActForOrganization(auth, organizationId)) return false;
  if (await hasOrganizationPermission(pool, auth, organizationId, ["guardian:operate"])) return true;
  const result = await pool.query<{ ok: boolean }>("select can_manage_field_device($1,$2) as ok", [auth.identityId, organizationId]);
  return result.rows[0]?.ok === true;
}

async function canReadInstruments(pool: Pool, auth: AuthContext, organizationId: string): Promise<boolean> {
  if (!canActForOrganization(auth, organizationId)) return false;
  if (await hasOrganizationPermission(pool, auth, organizationId, ["guardian:read", "guardian:operate"])) return true;
  return canManageInstrument(pool, auth, organizationId);
}

export async function registerMrvInstrumentRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/mrv/instruments", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool);
    if (!auth || !pool) return;
    const query = (request.query ?? {}) as Record<string, unknown>;
    const requestedOrganization = stringValue(query.organizationId);
    const organizationId = requestedOrganization || auth.activeOrganizationId || auth.memberships[0]?.organization_id;
    if (!organizationId || !uuid(organizationId)) return reply.code(400).send({ error: "A valid organizationId is required", code: "ORGANIZATION_REQUIRED" });
    if (!await canReadInstruments(pool, auth, organizationId)) return reply.code(403).send({ error: "MRV instrument read permission required", code: "MRV_INSTRUMENT_PERMISSION_REQUIRED" });
    try {
      const result = await pool.query("select * from mrv_instruments where organization_id=$1 order by instrument_code", [organizationId]);
      return { source: "postgresql", syntheticData: false, instruments: result.rows };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "MRV instrument register unavailable", code: "MRV_INSTRUMENTS_UNAVAILABLE", syntheticData: false });
    }
  });

  app.post("/api/v1/mrv/instruments", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool);
    if (!auth || !pool) return;
    const body = bodyOf(request as never);
    const organizationId = stringValue(body.organizationId);
    const instrumentCode = stringValue(body.instrumentCode);
    const instrumentType = stringValue(body.instrumentType);
    const manufacturer = stringValue(body.manufacturer);
    const model = stringValue(body.model);
    const skuRevision = stringValue(body.skuRevision);
    const intendedUse = stringValue(body.intendedUse);
    const measurementInstrument = body.measurementInstrument;
    const nonMeasurementReason = stringValue(body.nonMeasurementReason);
    const rawSupportedCodes = Array.isArray(body.supportedParameterCodes) ? body.supportedParameterCodes : null;
    const supportedCodes = rawSupportedCodes?.map((value) => typeof value === "string" ? value.trim() : "") ?? [];
    const normalizedSupportedCodes = [...new Map(supportedCodes.map((code) => [code.toLowerCase(), code])).values()];
    if (!organizationId || !uuid(organizationId) || !instrumentCode || !instrumentType || !manufacturer || !model || !skuRevision || !intendedUse || typeof measurementInstrument !== "boolean" || !rawSupportedCodes || rawSupportedCodes.length > 50 || supportedCodes.some((code) => !code || code.length > 100) || (measurementInstrument && normalizedSupportedCodes.length === 0) || (!measurementInstrument && (!nonMeasurementReason || normalizedSupportedCodes.length > 0))) {
      return reply.code(400).send({ error: "organizationId, instrumentCode, instrumentType, exact manufacturer/model/SKU revision, intendedUse, measurementInstrument, and supportedParameterCodes are required; non-measuring devices require a written nonMeasurementReason", code: "MRV_INSTRUMENT_INVALID" });
    }
    if ([instrumentCode, instrumentType, manufacturer, model, skuRevision, intendedUse].some((value) => value.length > 240)) {
      return reply.code(400).send({ error: "Instrument identity fields must not exceed 240 characters", code: "MRV_INSTRUMENT_INVALID" });
    }
    if (!await canManageInstrument(pool, auth, organizationId)) return reply.code(403).send({ error: "MRV instrument management permission required", code: "MRV_INSTRUMENT_PERMISSION_REQUIRED" });
    try {
      const result = await pool.query(
        "insert into mrv_instruments (organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,intended_use,measurement_instrument,non_measurement_reason,supported_parameter_codes,interface_protocol,firmware_version,firmware_support_until,registered_by_identity_id,approval_status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'HOLD') returning *",
        [organizationId, instrumentCode, instrumentType, manufacturer, model, skuRevision, intendedUse, measurementInstrument, nonMeasurementReason, normalizedSupportedCodes, stringValue(body.interfaceProtocol), stringValue(body.firmwareVersion), stringValue(body.firmwareSupportUntil), auth.identityId],
      );
      return reply.code(201).send({ source: "postgresql", syntheticData: false, instrument: result.rows[0], message: "Instrument registered in HOLD. Exact-model MeitY and required calibration evidence must be reviewed before MRV eligibility." });
    } catch (error) {
      request.log.error(error);
      const duplicate = error && typeof error === "object" && "code" in error && error.code === "23505";
      return reply.code(duplicate ? 409 : 503).send({ error: duplicate ? "Instrument code is already registered for this organization" : "MRV instrument registration unavailable", code: duplicate ? "MRV_INSTRUMENT_EXISTS" : "MRV_INSTRUMENT_REGISTER_UNAVAILABLE", syntheticData: false });
    }
  });

  app.post("/api/v1/mrv/instruments/:instrumentId/review", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool);
    if (!auth || !pool) return;
    const instrumentId = (request.params as { instrumentId: string }).instrumentId;
    if (!uuid(instrumentId)) return reply.code(400).send({ error: "instrumentId must be a UUID", code: "MRV_INSTRUMENT_ID_INVALID" });
    const body = bodyOf(request as never);
    const decision = stringValue(body.decision);
    const note = stringValue(body.note);
    if (!["VERIFIED", "HOLD", "EXPIRED", "REJECTED"].includes(decision ?? "") || !note) {
      return reply.code(400).send({ error: "decision must be VERIFIED, HOLD, EXPIRED or REJECTED and note is required", code: "MRV_INSTRUMENT_REVIEW_INVALID" });
    }
    try {
      const current = await pool.query<{ id: string; organization_id: string; approval_status: string; firmware_version: string | null; firmware_support_until: Date | string | null }>("select id,organization_id,approval_status,firmware_version,firmware_support_until from mrv_instruments where id=$1", [instrumentId]);
      const row = current.rows[0];
      if (!row) return reply.code(404).send({ error: "MRV instrument not found", code: "MRV_INSTRUMENT_NOT_FOUND" });
      if (!await canManageInstrument(pool, auth, row.organization_id)) return reply.code(403).send({ error: "MRV instrument review permission required", code: "MRV_INSTRUMENT_PERMISSION_REQUIRED" });
      if (row.approval_status === "VERIFIED") {
        if (decision === "VERIFIED") return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: true, instrumentId, approvalStatus: "VERIFIED" });
      }

      if (decision !== "VERIFIED") {
        const updated = await pool.query(
          "update mrv_instruments set approval_status=$2,reviewed_by_identity_id=$3,reviewed_at=now(),review_note=$4 where id=$1 returning *",
          [instrumentId, decision, auth.identityId, note],
        );
        return { source: "postgresql", syntheticData: false, instrument: updated.rows[0] };
      }

      const certificateId = stringValue(body.meityCertificateId);
      const issuer = stringValue(body.meityIssuer);
      const scope = stringValue(body.meityCertificateScope);
      const verificationUrl = stringValue(body.meityVerificationUrl);
      const meityEvidenceReference = stringValue(body.meityEvidenceReference);
      const meityEvidenceSha256 = stringValue(body.meityEvidenceSha256);
      const verifiedAt = stringValue(body.meityVerifiedAt);
      const validityBasis = stringValue(body.meityValidityBasis);
      const validUntil = stringValue(body.meityValidUntil);
      const calibrationRequired = body.calibrationRequired;
      if (!certificateId || !issuer || !scope || !verificationUrl?.startsWith("https://") || !meityEvidenceReference || !/^[0-9a-f]{64}$/i.test(meityEvidenceSha256 ?? "") || !verifiedAt || Number.isNaN(Date.parse(verifiedAt))
        || !["VALID_UNTIL", "NO_EXPIRY_CONFIRMED"].includes(validityBasis ?? "")
        || (validityBasis === "VALID_UNTIL" && (!validUntil || Number.isNaN(Date.parse(validUntil)) || Date.parse(validUntil) <= Date.now()))
        || (validityBasis === "NO_EXPIRY_CONFIRMED" && validUntil !== null && validUntil !== undefined && validUntil !== "")
        || typeof calibrationRequired !== "boolean") {
        return reply.code(400).send({ error: "VERIFIED requires exact-model MeitY certificate ID, issuer, scope, HTTPS official verification URL, stored evidence reference and SHA-256 evidence hash, verification timestamp, validity basis, and explicit calibrationRequired", code: "MRV_INSTRUMENT_APPROVAL_EVIDENCE_REQUIRED" });
      }
      const calibrationStatus = stringValue(body.calibrationStatus);
      const calibrationCertificateId = stringValue(body.calibrationCertificateId);
      const calibrationEvidenceReference = stringValue(body.calibrationEvidenceReference);
      const calibrationEvidenceSha256 = stringValue(body.calibrationEvidenceSha256);
      const calibrationLab = stringValue(body.calibrationLab);
      const calibrationTraceability = stringValue(body.calibrationTraceability);
      const rawCalibrationUncertainty = body.calibrationUncertainty;
      const calibrationUncertainty = rawCalibrationUncertainty === undefined || rawCalibrationUncertainty === null || (typeof rawCalibrationUncertainty === "string" && !rawCalibrationUncertainty.trim()) ? null : Number(rawCalibrationUncertainty);
      const calibrationValidUntil = stringValue(body.calibrationValidUntil);
      const calibrationNotRequiredReason = stringValue(body.calibrationNotRequiredReason);
      const firmwareVersion = stringValue(body.firmwareVersion) || row.firmware_version;
      const firmwareSupportUntil = stringValue(body.firmwareSupportUntil) || (row.firmware_support_until ? new Date(row.firmware_support_until).toISOString() : null);
      const securityReviewStatus = stringValue(body.securityReviewStatus);
      const securityEvidenceReference = stringValue(body.securityEvidenceReference);
      const securityEvidenceSha256 = stringValue(body.securityEvidenceSha256);
      const securityReviewedAt = stringValue(body.securityReviewedAt);
      const securityNotApplicableReason = stringValue(body.securityNotApplicableReason);
      if (calibrationRequired) {
        if (calibrationStatus !== "VERIFIED" || !calibrationCertificateId || !calibrationEvidenceReference || !/^[0-9a-f]{64}$/i.test(calibrationEvidenceSha256 ?? "") || !calibrationLab || !calibrationTraceability
          || calibrationUncertainty === null || !Number.isFinite(calibrationUncertainty) || calibrationUncertainty < 0
          || !calibrationValidUntil || Number.isNaN(Date.parse(calibrationValidUntil)) || Date.parse(calibrationValidUntil) <= Date.now()) {
          return reply.code(400).send({ error: "Measuring instrument requires current calibration certificate, stored evidence reference and SHA-256 evidence hash, lab, traceability, non-negative uncertainty and future validity", code: "MRV_INSTRUMENT_CALIBRATION_REQUIRED" });
        }
      } else if (calibrationStatus !== "NOT_APPLICABLE_WITH_JUSTIFICATION" || !calibrationNotRequiredReason) {
        return reply.code(400).send({ error: "Non-measuring instrument requires a written calibration-not-required rationale", code: "MRV_INSTRUMENT_CALIBRATION_RATIONALE_REQUIRED" });
      }
      if (firmwareVersion) {
        if (!firmwareSupportUntil || Number.isNaN(Date.parse(firmwareSupportUntil)) || Date.parse(firmwareSupportUntil) <= Date.now()
          || securityReviewStatus !== "VERIFIED" || !securityEvidenceReference || !/^[0-9a-f]{64}$/i.test(securityEvidenceSha256 ?? "")
          || !securityReviewedAt || Number.isNaN(Date.parse(securityReviewedAt)) || Date.parse(securityReviewedAt) > Date.now()) {
          return reply.code(400).send({ error: "Firmware-enabled instruments require current support, a stored security-review evidence reference/hash and review timestamp", code: "MRV_INSTRUMENT_SECURITY_EVIDENCE_REQUIRED" });
        }
      } else if (firmwareSupportUntil || securityReviewStatus !== "NOT_APPLICABLE_WITH_JUSTIFICATION" || !securityNotApplicableReason) {
        return reply.code(400).send({ error: "Instrument without firmware requires a written security-lifecycle not-applicable rationale", code: "MRV_INSTRUMENT_SECURITY_RATIONALE_REQUIRED" });
      }
      const update = await pool.query(
        "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id=$2,meity_issuer=$3,meity_certificate_scope=$4,meity_verification_url=$5,meity_evidence_reference=$6,meity_evidence_sha256=$7,meity_verified_at=$8,meity_validity_basis=$9,meity_valid_until=$10,calibration_required=$11,calibration_status=$12,calibration_certificate_id=$13,calibration_evidence_reference=$14,calibration_evidence_sha256=$15,calibration_lab=$16,calibration_traceability=$17,calibration_uncertainty=$18,calibration_valid_until=$19,calibration_not_required_reason=$20,firmware_version=$21,firmware_support_until=$22,security_review_status=$23,security_evidence_reference=$24,security_evidence_sha256=$25,security_reviewed_at=$26,security_not_applicable_reason=$27,reviewed_by_identity_id=$28,reviewed_at=now(),review_note=$29 where id=$1 returning *",
        [instrumentId, certificateId, issuer, scope, verificationUrl, meityEvidenceReference, meityEvidenceSha256, verifiedAt, validityBasis, validityBasis === "VALID_UNTIL" ? validUntil : null, calibrationRequired, calibrationStatus, calibrationCertificateId, calibrationRequired ? calibrationEvidenceReference : null, calibrationRequired ? calibrationEvidenceSha256 : null, calibrationLab, calibrationTraceability, calibrationUncertainty, calibrationRequired ? calibrationValidUntil : null, calibrationNotRequiredReason, firmwareVersion, firmwareSupportUntil, securityReviewStatus, firmwareVersion ? securityEvidenceReference : null, firmwareVersion ? securityEvidenceSha256 : null, firmwareVersion ? securityReviewedAt : null, firmwareVersion ? null : securityNotApplicableReason, auth.identityId, note],
      );
      return { source: "postgresql", syntheticData: false, instrument: update.rows[0], message: "Exact-model evidence recorded. Human reviewer is responsible for confirming that the official source matches this exact model and scope." };
    } catch (error) {
      request.log.error(error);
      const pgCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const rejectedByPolicy = pgCode === "P0001" || pgCode.startsWith("23");
      return reply.code(rejectedByPolicy ? 409 : 503).send({
        error: rejectedByPolicy ? "MRV instrument review failed closed; check exact-model evidence and current validity" : "MRV instrument review service unavailable",
        code: rejectedByPolicy ? "MRV_INSTRUMENT_REVIEW_BLOCKED" : "MRV_INSTRUMENT_REVIEW_UNAVAILABLE",
        syntheticData: false,
      });
    }
  });

  app.get("/api/v1/mrv/instruments/:instrumentId/decisions", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool);
    if (!auth || !pool) return;
    const instrumentId = (request.params as { instrumentId: string }).instrumentId;
    if (!uuid(instrumentId)) return reply.code(400).send({ error: "instrumentId must be a UUID", code: "MRV_INSTRUMENT_ID_INVALID" });
    try {
      const instrument = await pool.query<{ organization_id: string }>("select organization_id from mrv_instruments where id=$1", [instrumentId]);
      const organizationId = instrument.rows[0]?.organization_id;
      if (!organizationId) return reply.code(404).send({ error: "MRV instrument not found", code: "MRV_INSTRUMENT_NOT_FOUND" });
      if (!await canReadInstruments(pool, auth, organizationId)) return reply.code(403).send({ error: "MRV instrument read permission required", code: "MRV_INSTRUMENT_PERMISSION_REQUIRED" });
      const decisions = await pool.query("select * from mrv_instrument_decisions where instrument_id=$1 order by created_at", [instrumentId]);
      return { source: "postgresql", syntheticData: false, decisions: decisions.rows };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "MRV instrument decision history unavailable", code: "MRV_INSTRUMENT_HISTORY_UNAVAILABLE", syntheticData: false });
    }
  });
}
