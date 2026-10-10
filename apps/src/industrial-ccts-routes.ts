import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OFFICIAL_CCTS_HOSTS = ["beeindia.gov.in", "powermin.gov.in", "egazette.nic.in", "cercind.gov.in", "grid-india.in"];
export function isOfficialCctsReviewReference(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && OFFICIAL_CCTS_HOSTS.some(host => url.hostname.toLowerCase() === host || url.hostname.toLowerCase().endsWith("." + host));
  } catch { return false; }
}
export function isSha256Digest(value: string): boolean { return /^[a-f0-9]{64}$/i.test(value); }
type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };

async function authFor(request: Parameters<typeof authenticate>[0], reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try {
    const auth = await authenticate(request, pool);
    if (!auth) { reply.code(401).send(bearerChallenge()); return null; }
    return auth;
  } catch (error) {
    request.log.error(error);
    reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false });
    return null;
  }
}
function objectBody(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
}
function nonEmpty(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}
function authorized(auth: AuthContext, organizationId: string): boolean {
  return auth.memberships.some(m => m.organization_id === organizationId && m.status === "VERIFIED");
}
function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export async function registerIndustrialCctsRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/industrial-ccts/regulatory-register", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    try {
      const result = await pool.query("select source_id,publisher,title,source_url,source_date,review_status,source_hash,details,updated_at from industrial_ccts_regulatory_sources order by source_date desc nulls last,source_id");
      return { source: "postgresql", syntheticData: false, register: result.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Industrial CCTS register unavailable", code: "CCTS_REGISTER_UNAVAILABLE" }); }
  });

  app.post("/api/v1/industrial-ccts/facilities", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = objectBody(request.body);
    const organizationId = nonEmpty(body.organizationId, 64);
    const name = nonEmpty(body.name, 200);
    const sector = nonEmpty(body.sectorCode, 80);
    if (!organizationId || !UUID.test(organizationId) || !name || !sector) return reply.code(400).send({ error: "organizationId, name and sectorCode are required", code: "CCTS_INVALID_FACILITY" });
    if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "compliance:manage", "reports:manage"])) return reply.code(403).send({ error: "Verified organization membership and industrial CCTS management permission required", code: "CCTS_FORBIDDEN" });
    const designationStatus = body.designationStatus === "CONFIRMED" ? "CONFIRMED" : "UNVERIFIED";
    const designationReference = nonEmpty(body.designationReference, 500);
    if (designationStatus === "CONFIRMED" && !designationReference) return reply.code(400).send({ error: "Confirmed designation requires an official source reference", code: "CCTS_DESIGNATION_EVIDENCE_REQUIRED" });
    try {
      const id = randomUUID();
      const result = await pool.query(
        "insert into industrial_ccts_facilities (id,organization_id,name,sector_code,facility_reference,designation_status,designation_reference,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id,organization_id,name,sector_code,facility_reference,designation_status,designation_reference,created_at",
        [id, organizationId, name, sector, nonEmpty(body.facilityReference, 200), designationStatus, designationReference, auth.identityId],
      );
      return reply.code(201).send({ source: "postgresql", syntheticData: false, facility: result.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Facility could not be stored", code: "CCTS_FACILITY_WRITE_FAILED" }); }
  });

  app.get("/api/v1/industrial-ccts/facilities/:facilityId", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { facilityId } = request.params as { facilityId: string };
    if (!UUID.test(facilityId)) return reply.code(400).send({ error: "Invalid facility ID", code: "CCTS_INVALID_ID" });
    try {
      const result = await pool.query("select f.* from industrial_ccts_facilities f where f.id=$1", [facilityId]);
      const facility = result.rows[0];
      if (!facility) return reply.code(404).send({ error: "Facility not found", code: "CCTS_NOT_FOUND" });
      if (!authorized(auth, facility.organization_id) || !await hasOrganizationPermission(pool, auth, facility.organization_id, ["industrial_ccts:read", "industrial_ccts:manage", "compliance:read", "reports:read"])) return reply.code(403).send({ error: "Verified organization membership and read permission required", code: "CCTS_FORBIDDEN" });
      const periods = await pool.query("select id,period_start,period_end,production_quantity,production_unit,energy_quantity,energy_unit,emissions_tco2e,data_status,source_reference,created_at from industrial_ccts_periods where facility_id=$1 order by period_start desc", [facilityId]);
      return { source: "postgresql", syntheticData: false, facility, periods: periods.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Facility workspace unavailable", code: "CCTS_FACILITY_READ_FAILED" }); }
  });

  app.post("/api/v1/industrial-ccts/facilities/:facilityId/periods", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { facilityId } = request.params as { facilityId: string };
    const body = objectBody(request.body);
    if (!UUID.test(facilityId)) return reply.code(400).send({ error: "Invalid facility ID", code: "CCTS_INVALID_ID" });
    const start = nonEmpty(body.periodStart, 10), end = nonEmpty(body.periodEnd, 10);
    const production = Number(body.productionQuantity), energy = Number(body.energyQuantity);
    const productionUnit = nonEmpty(body.productionUnit, 40), energyUnit = nonEmpty(body.energyUnit, 40);
    const emissions = body.emissionsTco2e == null ? null : Number(body.emissionsTco2e);
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end || !Number.isFinite(production) || production <= 0 || !Number.isFinite(energy) || energy < 0 || !productionUnit || !energyUnit || (emissions !== null && (!Number.isFinite(emissions) || emissions < 0))) return reply.code(400).send({ error: "Valid period dates, positive production, non-negative energy/emissions and units are required", code: "CCTS_INVALID_PERIOD" });
    try {
      const found = await pool.query("select organization_id from industrial_ccts_facilities where id=$1", [facilityId]);
      const organizationId = found.rows[0]?.organization_id as string | undefined;
      if (!organizationId) return reply.code(404).send({ error: "Facility not found", code: "CCTS_NOT_FOUND" });
      if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "compliance:manage", "reports:manage"])) return reply.code(403).send({ error: "Verified organization membership and management permission required", code: "CCTS_FORBIDDEN" });
      const status = emissions === null ? "INCOMPLETE" : "RECORDED_UNVERIFIED";
      const result = await pool.query("insert into industrial_ccts_periods (id,facility_id,period_start,period_end,production_quantity,production_unit,energy_quantity,energy_unit,emissions_tco2e,data_status,source_reference,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (facility_id,period_start,period_end) do nothing returning *", [randomUUID(), facilityId, start, end, production, productionUnit, energy, energyUnit, emissions, status, nonEmpty(body.sourceReference, 500), auth.identityId]);
      if (!result.rows[0]) return reply.code(409).send({ error: "A record already exists for this facility and reporting period", code: "CCTS_DUPLICATE_PERIOD" });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, period: result.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Reporting period could not be stored", code: "CCTS_PERIOD_WRITE_FAILED" }); }
  });

  app.post("/api/v1/industrial-ccts/facilities/:facilityId/calculations", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { facilityId } = request.params as { facilityId: string };
    const body = objectBody(request.body);
    const periodId = nonEmpty(body.periodId, 64), targetId = nonEmpty(body.targetRuleId, 64);
    if (!UUID.test(facilityId) || !periodId || !UUID.test(periodId) || !targetId || !UUID.test(targetId)) return reply.code(400).send({ error: "facilityId, periodId and targetRuleId must be valid IDs", code: "CCTS_INVALID_CALCULATION" });
    try {
      const result = await pool.query("select f.organization_id,f.designation_status,p.production_quantity,p.production_unit,p.emissions_tco2e,p.data_status,t.target_value,t.target_unit,t.period_start as target_start,t.period_end as target_end,t.source_reference,t.source_hash,t.status as target_status from industrial_ccts_facilities f join industrial_ccts_periods p on p.facility_id=f.id join industrial_ccts_target_rules t on t.id=$3 and t.organization_id=f.organization_id and t.sector_code=f.sector_code and p.period_start>=t.period_start and p.period_end<=t.period_end where f.id=$1 and p.id=$2", [facilityId, periodId, targetId]);
      const row = result.rows[0];
      if (!row) return reply.code(422).send({ error: "No matching period and target rule; target applicability cannot be inferred", code: "CCTS_TARGET_NOT_APPLICABLE" });
      if (!authorized(auth, row.organization_id) || !await hasOrganizationPermission(pool, auth, row.organization_id, ["industrial_ccts:manage", "compliance:manage", "reports:manage"])) return reply.code(403).send({ error: "Verified organization membership and management permission required", code: "CCTS_FORBIDDEN" });
      if (row.designation_status !== "CONFIRMED" || row.target_status !== "ACTIVE" || !row.source_reference || !row.source_hash || row.data_status === "INCOMPLETE" || row.emissions_tco2e === null || Number(row.production_quantity) <= 0) return reply.code(422).send({ error: "Calculation blocked: confirmed designation, active source-backed target, production and emissions evidence are required", code: "CCTS_CALCULATION_INCOMPLETE" });
      const intensity = Number(row.emissions_tco2e) / Number(row.production_quantity);
      if (!Number.isFinite(intensity) || intensity < 0) return reply.code(422).send({ error: "Calculation invalid", code: "CCTS_CALCULATION_INVALID" });
      const calculation = { facilityId, periodId, targetRuleId: targetId, emissionsTco2e: Number(row.emissions_tco2e), productionQuantity: Number(row.production_quantity), productionUnit: row.production_unit, intensity, targetValue: Number(row.target_value), targetUnit: row.target_unit, sourceReference: row.source_reference, sourceHash: row.source_hash, targetPeriod: [row.target_start, row.target_end], calculatedBy: auth.identityId, formula: "emissions_tco2e / production_quantity", status: "PREPARED_NOT_SUBMITTED" };
      const hash = digest(calculation);
      const saved = await pool.query("insert into industrial_ccts_calculations (id,facility_id,period_id,target_rule_id,emissions_intensity,target_value,target_unit,calculation_hash,calculation_payload,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id,facility_id,period_id,target_rule_id,emissions_intensity,target_value,target_unit,calculation_hash,calculation_payload,status,created_at", [randomUUID(), facilityId, periodId, targetId, intensity, row.target_value, row.target_unit, hash, JSON.stringify(calculation), auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, calculation: saved.rows[0], note: "Prepared calculation only; not a statutory submission, verified result or certificate." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Calculation unavailable", code: "CCTS_CALCULATION_FAILED" }); }
  });

  app.post("/api/v1/industrial-ccts/target-rules", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = objectBody(request.body);
    const organizationId = nonEmpty(body.organizationId, 64), sector = nonEmpty(body.sectorCode, 80), name = nonEmpty(body.ruleName, 200), source = nonEmpty(body.sourceReference, 500), hash = nonEmpty(body.sourceHash, 64);
    const value = Number(body.targetValue), unit = nonEmpty(body.targetUnit, 80), start = nonEmpty(body.periodStart, 10), end = nonEmpty(body.periodEnd, 10);
    if (!organizationId || !UUID.test(organizationId) || !sector || !name || !source || !hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isFinite(value) || value <= 0 || !unit || !start || !end || start > end) return reply.code(400).send({ error: "A complete source-backed target rule is required", code: "CCTS_INVALID_TARGET_RULE" });
    if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "compliance:manage"])) return reply.code(403).send({ error: "Verified organization membership and CCTS management permission required", code: "CCTS_FORBIDDEN" });
    try {
      const result = await pool.query("insert into industrial_ccts_target_rules (id,organization_id,sector_code,rule_name,target_value,target_unit,period_start,period_end,source_reference,source_hash,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *", [randomUUID(), organizationId, sector, name, value, unit, start, end, source, hash.toLowerCase(), auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, targetRule: result.rows[0], status: "PENDING_REVIEW", note: "Target rules are not usable for calculations until separately reviewed against an official notification." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Target rule could not be stored", code: "CCTS_TARGET_WRITE_FAILED" }); }
  });

  app.post("/api/v1/industrial-ccts/target-rules/:targetRuleId/review", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { targetRuleId } = request.params as { targetRuleId: string };
    const body = objectBody(request.body);
    const decision = nonEmpty(body.decision, 20);
    const reviewReference = nonEmpty(body.reviewEvidenceReference, 1000);
    const reviewHash = nonEmpty(body.reviewEvidenceHash, 64);
    if (!UUID.test(targetRuleId) || decision !== "APPROVE" || !reviewReference || !isOfficialCctsReviewReference(reviewReference) || !reviewHash || !isSha256Digest(reviewHash)) {
      return reply.code(400).send({ error: "A valid rule ID, APPROVE decision, HTTPS official-notification reference and SHA-256 artifact hash are required", code: "CCTS_INVALID_RULE_REVIEW" });
    }
    try {
      const found = await pool.query("select id,organization_id,created_by,status,source_reference,source_hash from industrial_ccts_target_rules where id=$1", [targetRuleId]);
      const rule = found.rows[0];
      if (!rule) return reply.code(404).send({ error: "Target rule not found", code: "CCTS_NOT_FOUND" });
      if (!authorized(auth, rule.organization_id) || !await hasOrganizationPermission(pool, auth, rule.organization_id, ["industrial_ccts:regulatory:approve"])) return reply.code(403).send({ error: "Verified organization membership and explicit regulatory-approval permission required", code: "CCTS_REVIEW_FORBIDDEN" });
      if (rule.created_by === auth.identityId) return reply.code(403).send({ error: "Independent review is required; the rule creator cannot approve their own rule", code: "CCTS_SELF_APPROVAL_BLOCKED" });
      if (rule.status !== "PENDING_REVIEW") return reply.code(409).send({ error: "Only pending rules can be reviewed", code: "CCTS_RULE_NOT_PENDING" });
      if (rule.source_reference !== reviewReference || String(rule.source_hash).trim().toLowerCase() !== reviewHash.toLowerCase()) return reply.code(422).send({ error: "Review evidence must match the exact source URL and artifact hash recorded on the pending rule", code: "CCTS_REVIEW_SOURCE_MISMATCH" });
      const saved = await pool.query(
        "with updated as (update industrial_ccts_target_rules set status='ACTIVE', reviewed_by=$2, reviewed_at=now(), review_reference=$3, review_hash=$4 where id=$1 and status='PENDING_REVIEW' returning id,organization_id,sector_code,rule_name,target_value,target_unit,period_start,period_end,source_reference,source_hash,status,reviewed_by,reviewed_at,review_reference,review_hash), audit as (insert into industrial_ccts_audit_events (organization_id,entity_type,entity_id,action,actor_identity_id,details) select organization_id,'industrial_ccts_target_rule',id,'REGULATORY_RULE_APPROVED',$2,jsonb_build_object('reviewReference',$3,'reviewHash',$4,'decision','APPROVE') from updated returning id) select updated.* from updated cross join audit",
        [targetRuleId, auth.identityId, reviewReference, reviewHash.toLowerCase()],
      );
      if (!saved.rows[0]) return reply.code(409).send({ error: "Target rule changed during review; reload and retry", code: "CCTS_REVIEW_CONFLICT" });
      return { source: "postgresql", syntheticData: false, targetRule: saved.rows[0], note: "Approval is an internal, independently authorised review only; it does not establish regulator approval or replace notification verification." };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Target rule review could not be recorded", code: "CCTS_REVIEW_WRITE_FAILED" }); }
  });

  app.post("/api/v1/agri-residue/fields", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = objectBody(request.body);
    const organizationId = nonEmpty(body.organizationId, 64);
    const parcelReference = nonEmpty(body.parcelReference, 160);
    const cropCode = nonEmpty(body.cropCode, 80);
    const cropSeason = nonEmpty(body.cropSeason, 80);
    const stateCode = nonEmpty(body.stateCode, 20);
    const area = Number(body.areaHectares);
    const boundary = body.boundaryGeojson;
    if (!organizationId || !UUID.test(organizationId) || !parcelReference || !cropCode || !cropSeason || !stateCode || !Number.isFinite(area) || area <= 0 || !boundary || typeof boundary !== "object" || Array.isArray(boundary)) return reply.code(400).send({ error: "Organization, parcel reference, crop, season, state, positive area and GeoJSON boundary are required", code: "AGRI_FIELD_INVALID" });
    if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "reports:manage", "resource_flows:manage"])) return reply.code(403).send({ error: "Verified organization membership and residue-management permission required", code: "AGRI_FORBIDDEN" });
    try {
      const result = await pool.query("insert into agri_residue_fields (id,organization_id,parcel_reference,farmer_reference,village_code,district_code,state_code,crop_code,crop_season,area_hectares,boundary_geojson,land_use_evidence_reference,land_use_evidence_hash,baseline_evidence_reference,baseline_evidence_hash,baseline_status,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'PENDING_REVIEW',$16) returning id,organization_id,parcel_reference,crop_code,crop_season,state_code,area_hectares,baseline_status,created_at", [randomUUID(),organizationId,parcelReference,nonEmpty(body.farmerReference,160),nonEmpty(body.villageCode,80),nonEmpty(body.districtCode,80),stateCode,cropCode,cropSeason,area,JSON.stringify(boundary),nonEmpty(body.landUseEvidenceReference,1000),isSha256Digest(String(body.landUseEvidenceHash ?? ""))?String(body.landUseEvidenceHash).toLowerCase():null,nonEmpty(body.baselineEvidenceReference,1000),isSha256Digest(String(body.baselineEvidenceHash ?? ""))?String(body.baselineEvidenceHash).toLowerCase():null,auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, field: result.rows[0], note: "Field and baseline remain pending review; field registration does not establish methodology eligibility or CCC entitlement." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Field could not be recorded", code: "AGRI_FIELD_WRITE_FAILED" }); }
  });

  app.post("/api/v1/agri-residue/fields/:fieldId/fire-observations", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { fieldId } = request.params as { fieldId: string };
    const body = objectBody(request.body);
    const source = nonEmpty(body.observationSource, 160);
    const observedAt = nonEmpty(body.observedAt, 40);
    const reference = nonEmpty(body.evidenceReference, 1000);
    const hash = nonEmpty(body.evidenceHash, 64);
    const detected = body.detectedFire;
    const confidence = body.confidence == null ? null : Number(body.confidence);
    if (!UUID.test(fieldId) || !source || !observedAt || !Number.isFinite(Date.parse(observedAt)) || !reference || !hash || !isSha256Digest(hash) || typeof detected !== "boolean" || (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1))) return reply.code(400).send({ error: "Valid field, observation source/time, fire flag, optional 0–1 confidence, evidence reference and SHA-256 hash are required", code: "AGRI_FIRE_OBSERVATION_INVALID" });
    try {
      const found = await pool.query("select organization_id from agri_residue_fields where id=$1", [fieldId]);
      const organizationId = found.rows[0]?.organization_id as string | undefined;
      if (!organizationId) return reply.code(404).send({ error: "Field not found", code: "AGRI_FIELD_NOT_FOUND" });
      if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "reports:manage", "resource_flows:manage"])) return reply.code(403).send({ error: "Verified organization membership and residue-management permission required", code: "AGRI_FORBIDDEN" });
      const result = await pool.query("insert into agri_residue_fire_observations (id,field_id,observation_source,observed_at,detected_fire,confidence,spatial_intersection,evidence_reference,evidence_hash,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id,field_id,observation_source,observed_at,detected_fire,confidence,evidence_reference,evidence_hash,review_status,created_at", [randomUUID(),fieldId,source,new Date(observedAt).toISOString(),detected,confidence,body.spatialIntersection && typeof body.spatialIntersection==="object" ? JSON.stringify(body.spatialIntersection) : null,reference,hash.toLowerCase(),auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, observation: result.rows[0], note: "Fire observations are evidence signals pending review, not automatic legal findings or automatic credit deductions." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Fire observation could not be recorded", code: "AGRI_FIRE_OBSERVATION_WRITE_FAILED" }); }
  });

  app.post("/api/v1/agri-residue/fire-observations/:observationId/review", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { observationId } = request.params as { observationId: string };
    const body = objectBody(request.body);
    const decision = nonEmpty(body.decision, 20);
    const reviewNote = nonEmpty(body.reviewNote, 2000);
    if (!UUID.test(observationId) || !["CONFIRMED","DISMISSED","INCONCLUSIVE"].includes(decision ?? "") || !reviewNote) return reply.code(400).send({ error: "Observation ID, review decision and review note are required", code: "AGRI_FIRE_REVIEW_INVALID" });
    try {
      const found = await pool.query("select o.id,o.review_status,o.created_by,f.organization_id from agri_residue_fire_observations o join agri_residue_fields f on f.id=o.field_id where o.id=$1",[observationId]);
      const observation=found.rows[0];
      if(!observation) return reply.code(404).send({error:"Fire observation not found",code:"AGRI_FIRE_OBSERVATION_NOT_FOUND"});
      if(!authorized(auth,observation.organization_id) || !await hasOrganizationPermission(pool,auth,observation.organization_id,["industrial_ccts:regulatory:approve"])) return reply.code(403).send({error:"Verified organization membership and explicit independent-review permission required",code:"AGRI_FIRE_REVIEW_FORBIDDEN"});
      if(observation.created_by===auth.identityId) return reply.code(403).send({error:"The evidence creator cannot independently review the observation",code:"AGRI_FIRE_SELF_REVIEW_BLOCKED"});
      if(observation.review_status!=="PENDING_REVIEW") return reply.code(409).send({error:"Only pending observations can be reviewed",code:"AGRI_FIRE_REVIEW_NOT_PENDING"});
      const saved=await pool.query("with updated as (update agri_residue_fire_observations set review_status=$2,review_note=$3,reviewed_by=$4,reviewed_at=now() where id=$1 and review_status='PENDING_REVIEW' returning id,field_id,review_status,review_note,reviewed_by,reviewed_at), audit as (insert into industrial_ccts_audit_events (organization_id,entity_type,entity_id,action,actor_identity_id,details) select f.organization_id,'agri_residue_fire_observation',u.id,'FIRE_OBSERVATION_REVIEWED',$4,jsonb_build_object('decision',$2,'reviewNote',$3) from updated u join agri_residue_fields f on f.id=u.field_id returning id) select updated.* from updated cross join audit",[observationId,decision,reviewNote,auth.identityId]);
      if(!saved.rows[0]) return reply.code(409).send({error:"Observation changed during review; reload and retry",code:"AGRI_FIRE_REVIEW_CONFLICT"});
      return {source:"postgresql",syntheticData:false,observation:saved.rows[0],note:"This is a recorded internal evidence review, not a legal finding or automatic crediting decision. Apply any methodology-specific consequence only after methodology review."};
    } catch(error){request.log.error(error);return reply.code(503).send({error:"Fire observation review could not be recorded",code:"AGRI_FIRE_REVIEW_WRITE_FAILED"});}
  });

  app.post("/api/v1/agri-residue/lots", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = objectBody(request.body);
    const organizationId = nonEmpty(body.organizationId, 64);
    const lotCode = nonEmpty(body.lotCode, 160);
    const residueType = nonEmpty(body.residueType, 80);
    const cropSeason = nonEmpty(body.cropSeason, 80);
    const mass = Number(body.netMass);
    const unit = nonEmpty(body.massUnit, 8);
    const basis = nonEmpty(body.massBasis, 20);
    const weighingReference = nonEmpty(body.weighingReference, 1000);
    const evidenceHash = nonEmpty(body.weighingEvidenceHash, 64);
    const measuredAt = nonEmpty(body.measuredAt, 40);
    const sourceFieldId = body.sourceFieldId == null ? null : nonEmpty(body.sourceFieldId, 64);
    const moisture = body.moisturePercent == null ? null : Number(body.moisturePercent);
    if (!organizationId || !UUID.test(organizationId) || !lotCode || !residueType || !cropSeason || !Number.isFinite(mass) || mass <= 0 || !["kg","t"].includes(unit ?? "") || !["AS_RECEIVED","DRY_MATTER","UNKNOWN"].includes(basis ?? "") || !weighingReference || !evidenceHash || !isSha256Digest(evidenceHash) || !measuredAt || !Number.isFinite(Date.parse(measuredAt)) || (sourceFieldId !== null && (!sourceFieldId || !UUID.test(sourceFieldId))) || (moisture !== null && (!Number.isFinite(moisture) || moisture < 0 || moisture > 100))) return reply.code(400).send({ error: "Complete lot identity, positive measured mass, unit/basis, timestamp, scale reference and SHA-256 evidence are required", code: "AGRI_LOT_INVALID" });
    if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "reports:manage", "resource_flows:manage"])) return reply.code(403).send({ error: "Verified organization membership and residue-management permission required", code: "AGRI_FORBIDDEN" });
    try {
      if (sourceFieldId) {
        const field = await pool.query("select organization_id from agri_residue_fields where id=$1", [sourceFieldId]);
        if (!field.rows[0] || field.rows[0].organization_id !== organizationId) return reply.code(422).send({ error: "Source field must exist in the same organization", code: "AGRI_FIELD_SCOPE_MISMATCH" });
      }
      const result = await pool.query("insert into agri_residue_lots (id,organization_id,lot_code,source_field_id,residue_type,crop_season,net_mass,mass_unit,moisture_percent,mass_basis,weighing_reference,weighing_evidence_hash,measured_at,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (organization_id,lot_code) do nothing returning id,organization_id,lot_code,source_field_id,residue_type,crop_season,net_mass,mass_unit,moisture_percent,mass_basis,weighing_reference,weighing_evidence_hash,measured_at,custody_status,created_at", [randomUUID(),organizationId,lotCode,sourceFieldId,residueType,cropSeason,mass,unit,moisture,basis,weighingReference,evidenceHash.toLowerCase(),new Date(measuredAt).toISOString(),auth.identityId]);
      if (!result.rows[0]) return reply.code(409).send({ error: "Lot code already exists for this organization", code: "AGRI_DUPLICATE_LOT" });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, lot: result.rows[0], note: "Recorded mass is traceability evidence only; it is not converted into carbon credits." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Residue lot could not be recorded", code: "AGRI_LOT_WRITE_FAILED" }); }
  });

  app.post("/api/v1/agri-residue/lots/:lotId/custody-events", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { lotId } = request.params as { lotId: string };
    const body = objectBody(request.body);
    const eventType = nonEmpty(body.eventType, 40);
    const eventAt = nonEmpty(body.eventAt, 40);
    const evidenceReference = nonEmpty(body.evidenceReference, 1000);
    const evidenceHash = nonEmpty(body.evidenceHash, 64);
    const allowedEvents = ["COLLECTED","WEIGHED","TRANSFERRED","TRANSPORT_STARTED","TRANSPORT_ARRIVED","STORED","DELIVERED","PROCESSED","REJECTED","CORRECTED"];
    if (!UUID.test(lotId) || !eventType || !allowedEvents.includes(eventType) || !eventAt || !Number.isFinite(Date.parse(eventAt)) || !evidenceReference || !evidenceHash || !isSha256Digest(evidenceHash)) return reply.code(400).send({ error: "Valid lot, event type/time and SHA-256 evidence reference are required", code: "AGRI_CUSTODY_EVENT_INVALID" });
    const statusByEvent: Record<string,string> = { COLLECTED:"COLLECTED", TRANSPORT_STARTED:"IN_TRANSIT", TRANSPORT_ARRIVED:"AT_DEPOT", STORED:"AT_DEPOT", DELIVERED:"DELIVERED", PROCESSED:"PROCESSED", REJECTED:"REJECTED" };
    const client = await pool.connect();
    try {
      await client.query("begin");
      const found = await client.query("select id,organization_id,custody_status from agri_residue_lots where id=$1 for update", [lotId]);
      const lot = found.rows[0];
      if (!lot) { await client.query("rollback"); return reply.code(404).send({ error: "Residue lot not found", code: "AGRI_LOT_NOT_FOUND" }); }
      if (!authorized(auth, lot.organization_id) || !await hasOrganizationPermission(client as unknown as Pool, auth, lot.organization_id, ["industrial_ccts:manage","reports:manage","resource_flows:manage"])) { await client.query("rollback"); return reply.code(403).send({ error: "Verified organization membership and residue-management permission required", code: "AGRI_FORBIDDEN" }); }
      const allowedFrom: Record<string,string[]> = {
        COLLECTED:["AT_SOURCE"], WEIGHED:["AT_SOURCE","COLLECTED"], TRANSFERRED:["COLLECTED","AT_DEPOT","DELIVERED"],
        TRANSPORT_STARTED:["COLLECTED","AT_DEPOT"], TRANSPORT_ARRIVED:["IN_TRANSIT"], STORED:["AT_DEPOT"],
        DELIVERED:["IN_TRANSIT","AT_DEPOT"], PROCESSED:["DELIVERED"], REJECTED:["AT_SOURCE","COLLECTED","IN_TRANSIT","AT_DEPOT","DELIVERED"], CORRECTED:["AT_SOURCE","COLLECTED","IN_TRANSIT","AT_DEPOT","DELIVERED","PROCESSED","REJECTED","DISPUTED"]
      };
      const allowedTransitions = allowedFrom[eventType];
      if (!allowedTransitions || !allowedTransitions.includes(lot.custody_status)) { await client.query("rollback"); return reply.code(409).send({ error: "Custody transition is not allowed from the current lot state", code: "AGRI_CUSTODY_TRANSITION_INVALID", currentStatus: lot.custody_status }); }
      const saved = await client.query("insert into agri_residue_custody_events (id,lot_id,event_type,event_at,actor_organization_id,counterparty_organization_id,location_geojson,vehicle_reference,ticket_reference,evidence_reference,evidence_hash,details,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id,lot_id,event_type,event_at,evidence_reference,evidence_hash,created_at", [randomUUID(),lotId,eventType,new Date(eventAt).toISOString(),lot.organization_id,nonEmpty(body.counterpartyOrganizationId,64),body.locationGeojson && typeof body.locationGeojson==="object" ? JSON.stringify(body.locationGeojson) : null,nonEmpty(body.vehicleReference,160),nonEmpty(body.ticketReference,200),evidenceReference,evidenceHash.toLowerCase(),JSON.stringify(body.details && typeof body.details==="object" ? body.details : {}),auth.identityId]);
      const nextStatus = statusByEvent[eventType];
      if (nextStatus) await client.query("update agri_residue_lots set custody_status=$2 where id=$1", [lotId,nextStatus]);
      await client.query("commit");
      return reply.code(201).send({ source:"postgresql",syntheticData:false,event:saved.rows[0],custodyStatus:nextStatus ?? lot.custody_status,note:"Custody evidence is recorded; carbon-credit eligibility is not inferred." });
    } catch (error) { await client.query("rollback").catch(()=>undefined); request.log.error(error); return reply.code(503).send({ error:"Custody event could not be recorded",code:"AGRI_CUSTODY_EVENT_WRITE_FAILED" }); }
    finally { client.release(); }
  });

  app.post("/api/v1/agri-residue/lots/:lotId/processing-receipts", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { lotId } = request.params as { lotId: string };
    const body = objectBody(request.body);
    const processorOrganizationId = nonEmpty(body.processorOrganizationId,64);
    const processType = nonEmpty(body.processType,40);
    const receivedMass = Number(body.receivedMass);
    const massUnit = nonEmpty(body.massUnit,8);
    const receivedAt = nonEmpty(body.receivedAt,40);
    const ticket = nonEmpty(body.weighbridgeReference,200);
    const evidenceHash = nonEmpty(body.evidenceHash,64);
    const allowedProcesses = ["CBG","BIOMASS_ELECTRICITY","BIOMASS_HEAT","PELLETIZATION","COMPOSTING","IN_SITU_TREATMENT","OTHER"];
    if (!UUID.test(lotId) || !processorOrganizationId || !UUID.test(processorOrganizationId) || !processType || !allowedProcesses.includes(processType) || !Number.isFinite(receivedMass) || receivedMass<=0 || !["kg","t"].includes(massUnit ?? "") || !receivedAt || !Number.isFinite(Date.parse(receivedAt)) || !ticket || !evidenceHash || !isSha256Digest(evidenceHash)) return reply.code(400).send({ error:"Valid processor, process type, positive received mass, unit, time, weighbridge ticket and SHA-256 evidence are required",code:"AGRI_PROCESSING_RECEIPT_INVALID" });
    if (!authorized(auth,processorOrganizationId) || !await hasOrganizationPermission(pool,auth,processorOrganizationId,["industrial_ccts:manage","reports:manage","resource_flows:manage"])) return reply.code(403).send({ error:"Verified processor membership and residue-management permission required",code:"AGRI_FORBIDDEN" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const found = await client.query("select id,organization_id,net_mass,mass_unit,custody_status from agri_residue_lots where id=$1 for update",[lotId]);
      const lot=found.rows[0];
      if(!lot){await client.query("rollback");return reply.code(404).send({error:"Residue lot not found",code:"AGRI_LOT_NOT_FOUND"});}
      if(!authorized(auth,lot.organization_id) || !await hasOrganizationPermission(client as unknown as Pool,auth,lot.organization_id,["industrial_ccts:manage","reports:manage","resource_flows:manage"])){await client.query("rollback");return reply.code(403).send({error:"Verified source-organization membership and permission required",code:"AGRI_FORBIDDEN"});}
      if(!["DELIVERED","PROCESSED"].includes(lot.custody_status)){await client.query("rollback");return reply.code(409).send({error:"Lot must be delivered before processor receipt",code:"AGRI_LOT_NOT_DELIVERED"});}
      const prior=await client.query("select coalesce(sum(case when mass_unit='t' then received_mass*1000 else received_mass end),0) as received_kg from agri_residue_processing_receipts where lot_id=$1",[lotId]);
      const lotKg=Number(lot.net_mass)*(lot.mass_unit==="t"?1000:1);
      const newKg=receivedMass*(massUnit==="t"?1000:1);
      if(Number(prior.rows[0].received_kg)+newKg>lotKg+0.0001){await client.query("rollback");return reply.code(422).send({error:"Processing receipt exceeds remaining traceable lot mass",code:"AGRI_MASS_BALANCE_EXCEEDED",lotMassKg:lotKg,previouslyReceivedKg:Number(prior.rows[0].received_kg),attemptedKg:newKg});}
      const saved=await client.query("insert into agri_residue_processing_receipts (id,lot_id,processor_organization_id,process_type,received_mass,mass_unit,received_at,weighbridge_reference,evidence_hash,process_data,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id,lot_id,processor_organization_id,process_type,received_mass,mass_unit,received_at,weighbridge_reference,evidence_hash,created_at",[randomUUID(),lotId,processorOrganizationId,processType,receivedMass,massUnit,new Date(receivedAt).toISOString(),ticket,evidenceHash.toLowerCase(),JSON.stringify(body.processData && typeof body.processData==="object"?body.processData:{}),auth.identityId]);
      await client.query("update agri_residue_lots set custody_status='PROCESSED' where id=$1",[lotId]);
      await client.query("commit");
      return reply.code(201).send({source:"postgresql",syntheticData:false,receipt:saved.rows[0],note:"Receipt records physical utilization only; methodology eligibility, emissions reduction and CCC issuance remain separate."});
    }catch(error){await client.query("rollback").catch(()=>undefined);request.log.error(error);return reply.code(503).send({error:"Processing receipt could not be recorded",code:"AGRI_PROCESSING_RECEIPT_WRITE_FAILED"});}
    finally{client.release();}
  });

  app.post("/api/v1/industrial-ccts/offset-projects", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = objectBody(request.body);
    const organizationId = nonEmpty(body.organizationId, 64), name = nonEmpty(body.name, 200), sector = nonEmpty(body.sectorCode, 80), methodology = nonEmpty(body.methodologyCode, 40), version = nonEmpty(body.methodologyVersion, 40);
    if (!organizationId || !UUID.test(organizationId) || !name || !sector || !methodology || !version) return reply.code(400).send({ error: "organizationId, name, sectorCode, methodologyCode and methodologyVersion are required", code: "CCTS_INVALID_OFFSET_PROJECT" });
    if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "compliance:manage", "reports:manage"])) return reply.code(403).send({ error: "Verified organization membership and CCTS management permission required", code: "CCTS_FORBIDDEN" });
    try {
      const result = await pool.query("insert into industrial_ccts_offset_projects (id,organization_id,name,sector_code,methodology_code,methodology_version,project_boundary,eligibility_status,created_by) values ($1,$2,$3,$4,$5,$6,$7,'PENDING_REVIEW',$8) returning id,organization_id,name,sector_code,methodology_code,methodology_version,project_boundary,eligibility_status,workflow_status,created_at", [randomUUID(), organizationId, name, sector, methodology, version, nonEmpty(body.projectBoundary, 2000), auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, project: result.rows[0], note: "Project registration is not CCTS registry registration or approval." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Offset project could not be stored", code: "CCTS_OFFSET_WRITE_FAILED" }); }
  });

  app.post("/api/v1/industrial-ccts/offset-projects/:projectId/evidence", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { projectId } = request.params as { projectId: string };
    const body = objectBody(request.body);
    const kind = nonEmpty(body.evidenceKind, 80), reference = nonEmpty(body.reference, 1000), hash = nonEmpty(body.evidenceHash, 64);
    if (!UUID.test(projectId) || !kind || !reference || !hash || !/^[a-f0-9]{64}$/i.test(hash)) return reply.code(400).send({ error: "Project ID, evidence kind, reference and SHA-256 hash are required", code: "CCTS_INVALID_EVIDENCE" });
    try {
      const project = await pool.query("select organization_id from industrial_ccts_offset_projects where id=$1", [projectId]);
      const organizationId = project.rows[0]?.organization_id as string | undefined;
      if (!organizationId) return reply.code(404).send({ error: "Project not found", code: "CCTS_NOT_FOUND" });
      if (!authorized(auth, organizationId) || !await hasOrganizationPermission(pool, auth, organizationId, ["industrial_ccts:manage", "compliance:manage", "reports:manage"])) return reply.code(403).send({ error: "Verified organization membership and CCTS management permission required", code: "CCTS_FORBIDDEN" });
      const result = await pool.query("insert into industrial_ccts_offset_evidence (id,project_id,evidence_kind,reference,evidence_hash,metadata,created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id,project_id,evidence_kind,reference,evidence_hash,metadata,created_at", [randomUUID(), projectId, kind, reference, hash.toLowerCase(), JSON.stringify(body.metadata && typeof body.metadata === "object" ? body.metadata : {}), auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, evidence: result.rows[0], note: "Evidence reference is recorded; source authenticity and verifier acceptance remain unconfirmed." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Evidence could not be recorded", code: "CCTS_EVIDENCE_WRITE_FAILED" }); }
  });
}
