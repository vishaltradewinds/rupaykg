import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
      const result = await pool.query("select f.organization_id,f.designation_status,p.production_quantity,p.production_unit,p.emissions_tco2e,p.data_status,t.target_value,t.target_unit,t.period_start as target_start,t.period_end as target_end,t.source_reference,t.source_hash,t.status as target_status from industrial_ccts_facilities f join industrial_ccts_periods p on p.facility_id=f.id join industrial_ccts_target_rules t on t.id=$3 and t.sector_code=f.sector_code and p.period_start>=t.period_start and p.period_end<=t.period_end where f.id=$1 and p.id=$2", [facilityId, periodId, targetId]);
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
      return reply.code(201).send({ source: "postgresql", syntheticData: false, targetRule: result.rows[0], status: "ACTIVE" });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Target rule could not be stored", code: "CCTS_TARGET_WRITE_FAILED" }); }
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
