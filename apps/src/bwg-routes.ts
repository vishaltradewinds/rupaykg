import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: any; query: unknown; log: { error: (error: unknown) => void } };
function bodyOf(request: Request): Record<string, unknown> { return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {}; }
function str(body: Record<string, unknown>, key: string): string | null { return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null; }
function nonNegative(body: Record<string, unknown>, key: string): number | null { const n = Number(body[key]); return Number.isFinite(n) && n >= 0 ? n : null; }
function queryOrg(request: Request): string | null { const q = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {}; const id = typeof q.organizationId === "string" ? q.organizationId.trim() : ""; return id || null; }
async function authFor(pool: Pool | null, request: Request, reply: Reply): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); return null; }
}
function requireOrg(auth: AuthContext, organizationId: string, reply: Reply): boolean { if (!UUID.test(organizationId) || !canActForOrganization(auth, organizationId)) { reply.code(403).send({ error: "Verified organization membership is required", code: "ORG_FORBIDDEN" }); return false; } return true; }
async function hasValuePermission(pool: Pool, fn: "can_assess_epr" | "can_write_esg", identityId: string, organizationId: string): Promise<boolean> { const r = await pool.query<{ ok: boolean }>(`select ${fn}($1,$2) as ok`, [identityId, organizationId]); return r.rows[0]?.ok === true; }
async function verifiedEvidence(pool: Pool, evidenceId: string, verificationId: string | null, organizationId: string): Promise<{ ok: boolean; code?: string }> {
  if (!UUID.test(evidenceId)) return { ok: false, code: "INVALID_EVIDENCE_ID" };
  const e = await pool.query<{ status: string; organization_id: string }>(`select e.status, a.organization_id from evidence e join activities a on a.id=e.activity_id where e.id=$1`, [evidenceId]);
  if (!e.rows[0] || e.rows[0].organization_id !== organizationId) return { ok: false, code: "EVIDENCE_FORBIDDEN" };
  if (e.rows[0].status !== "VERIFIED") return { ok: false, code: "EVIDENCE_NOT_VERIFIED" };
  if (verificationId) {
    if (!UUID.test(verificationId)) return { ok: false, code: "INVALID_VERIFICATION_ID" };
    const v = await pool.query("select 1 from verifications where id=$1 and evidence_id=$2 and decision='APPROVED'", [verificationId, evidenceId]);
    if (!v.rows[0]) return { ok: false, code: "VERIFICATION_INVALID" };
  }
  return { ok: true };
}
async function authorizedJurisdiction(pool: Pool, identityId: string, organizationId: string, geographyId: string): Promise<boolean> {
  if (!UUID.test(geographyId)) return false;
  const r = await pool.query<{ ok: boolean }>(`select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok`, [identityId, organizationId, geographyId]);
  return r.rows[0]?.ok === true;
}

export async function registerBwgRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/workspaces/bwg", async (request, reply) => {
    const auth = await authFor(pool, request, reply); if (!auth || !pool) return;
    const organizationId = queryOrg(request);
    if (organizationId && !requireOrg(auth, organizationId, reply)) return;
    const ids = organizationId ? [organizationId] : [...new Set(auth.memberships.filter(m => m.status === "VERIFIED").map(m => m.organization_id))];
    if (!ids.length) return { source: "postgresql", syntheticData: false, data: { profiles: [], periods: [], wasteReports: [], eprReports: [], esgReports: [], jurisdictions: [], schemes: [], organizations: [] } };
    try {
      const [profiles, periods, waste, epr, esg, jurisdictions, schemes] = await Promise.all([
        pool.query("select id,organization_id,jurisdiction_id,floor_area_sqm,water_consumption_lpd,waste_generation_kg_day,establishment_type,applicability_status,applicability_basis,status,created_at,updated_at from bwg_profiles where organization_id=any($1::uuid[])", [ids]),
        pool.query("select id,organization_id,period_start,period_end,reporting_basis,status,external_submission_status,external_submission_reference,created_at from bwg_reporting_periods where organization_id=any($1::uuid[]) order by period_start desc", [ids]),
        pool.query("select w.*,p.organization_id from bwg_waste_reports w join bwg_reporting_periods p on p.id=w.reporting_period_id where p.organization_id=any($1::uuid[]) order by w.created_at desc", [ids]),
        pool.query("select e.*,p.organization_id from bwg_epr_reports e join bwg_reporting_periods p on p.id=e.reporting_period_id where p.organization_id=any($1::uuid[]) order by e.created_at desc", [ids]),
        pool.query("select e.*,p.organization_id from bwg_esg_reports e join bwg_reporting_periods p on p.id=e.reporting_period_id where p.organization_id=any($1::uuid[]) order by e.created_at desc", [ids]),
        pool.query(`select distinct g.id,g.name from geography g join organization_geography_scopes s on s.geography_id=g.id and s.status='VERIFIED' where s.organization_id=any($1::uuid[]) order by g.name`, [ids]),
        pool.query(`select id,code,name,authority,jurisdiction_id from epr_schemes where status='VERIFIED' and (jurisdiction_id is null or exists(select 1 from organization_geography_scopes s where s.organization_id=any($1::uuid[]) and s.geography_id=epr_schemes.jurisdiction_id and s.status='VERIFIED')) order by name`, [ids]),
      ]);
      const organizations = await Promise.all(ids.map(async (id) => ({ organizationId: id, profileUpdate: await hasOrganizationPermission(pool, auth, id, ["profile:update"]), periodCreate: await hasOrganizationPermission(pool, auth, id, ["reports:read"]), wasteRecord: await hasOrganizationPermission(pool, auth, id, ["waste:record"]), eprManage: await hasValuePermission(pool, "can_assess_epr", auth.identityId, id), esgWrite: await hasValuePermission(pool, "can_write_esg", auth.identityId, id) })));
      return { source: "postgresql", syntheticData: false, data: { profiles: profiles.rows, periods: periods.rows, wasteReports: waste.rows, eprReports: epr.rows, esgReports: esg.rows, jurisdictions: jurisdictions.rows, schemes: schemes.rows, organizations } };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG workspace unavailable", code: "BWG_WORKSPACE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/profile", async (request, reply) => {
    const auth = await authFor(pool, request, reply); if (!auth || !pool) return;
    const body = bodyOf(request); const organizationId = str(body, "organizationId"); const jurisdictionId = str(body, "jurisdictionId"); const establishmentType = str(body, "establishmentType"); const floor = nonNegative(body, "floorAreaSqm"); const water = nonNegative(body, "waterConsumptionLpd"); const waste = nonNegative(body, "wasteGenerationKgDay");
    if (!organizationId || !jurisdictionId || !establishmentType || floor === null || water === null || waste === null) return reply.code(400).send({ error: "organizationId, jurisdictionId, establishmentType and non-negative thresholds are required", code: "BWG_PROFILE_REQUIRED" });
    if (!requireOrg(auth, organizationId, reply)) return; if (!await hasOrganizationPermission(pool, auth, organizationId, ["profile:update"])) return reply.code(403).send({ error: "Profile update permission required", code: "PROFILE_UPDATE_FORBIDDEN" });
    if (!await authorizedJurisdiction(pool, auth.identityId, organizationId, jurisdictionId)) return reply.code(403).send({ error: "Jurisdiction is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    const applicable = floor >= 20000 || water >= 40000 || waste >= 100;
    const basis = { floorAreaSqm: floor, waterConsumptionLpd: water, wasteGenerationKgDay: waste, rules: "SWM_RULES_2026_BWG" };
    try {
      const row = await pool.query(`insert into bwg_profiles(organization_id,jurisdiction_id,floor_area_sqm,water_consumption_lpd,waste_generation_kg_day,establishment_type,applicability_status,applicability_basis,status) values($1,$2,$3,$4,$5,$6,$7,$8,'PENDING') on conflict(organization_id) do update set jurisdiction_id=excluded.jurisdiction_id,floor_area_sqm=excluded.floor_area_sqm,water_consumption_lpd=excluded.water_consumption_lpd,waste_generation_kg_day=excluded.waste_generation_kg_day,establishment_type=excluded.establishment_type,applicability_status=excluded.applicability_status,applicability_basis=excluded.applicability_basis,updated_at=now() returning *`, [organizationId, jurisdictionId, floor, water, waste, establishmentType, applicable ? "APPLICABLE" : "NOT_APPLICABLE", JSON.stringify(basis)]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, profile: row.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG profile unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods", async (request, reply) => {
    const auth = await authFor(pool, request, reply); if (!auth || !pool) return;
    const body = bodyOf(request); const organizationId = str(body, "organizationId"); const start = str(body, "periodStart"); const end = str(body, "periodEnd"); const basis = str(body, "reportingBasis");
    if (!organizationId || !start || !end || !basis || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || end < start) return reply.code(400).send({ error: "organizationId, valid periodStart/periodEnd and reportingBasis are required", code: "BWG_PERIOD_INVALID" });
    if (!requireOrg(auth, organizationId, reply)) return; if (!await hasOrganizationPermission(pool, auth, organizationId, ["reports:read"])) return reply.code(403).send({ error: "Reporting-period permission required", code: "PERIOD_CREATE_FORBIDDEN" });
    try { const row = await pool.query(`insert into bwg_reporting_periods(organization_id,period_start,period_end,reporting_basis) values($1,$2,$3,$4) on conflict(organization_id,period_start,period_end,reporting_basis) do update set reporting_basis=excluded.reporting_basis returning *`, [organizationId,start,end,basis]); return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, period: row.rows[0] }); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Reporting period unavailable", syntheticData: false }); }
  });

  async function periodOrganization(auth: AuthContext, periodId: string, reply: Reply): Promise<string | null> {
    if (!pool || !UUID.test(periodId)) { reply.code(400).send({ error: "Valid reporting period UUID is required", code: "INVALID_PERIOD_ID" }); return null; }
    const r = await pool.query<{ organization_id: string }>("select organization_id from bwg_reporting_periods where id=$1", [periodId]); const id = r.rows[0]?.organization_id; if (!id) { reply.code(404).send({ error: "Reporting period not found", code: "PERIOD_NOT_FOUND" }); return null; } if (!requireOrg(auth,id,reply)) return null; return id;
  }

  app.post("/api/v1/bwg/reporting-periods/:periodId/waste", async (request, reply) => {
    const auth = await authFor(pool, request, reply); if (!auth || !pool) return; const organizationId = await periodOrganization(auth, request.params.periodId, reply); if (!organizationId) return;
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["waste:record"])) return reply.code(403).send({ error: "Waste recording permission required", code: "WASTE_RECORD_FORBIDDEN" });
    const body=bodyOf(request); const stream=str(body,"wasteStream"); const unit=str(body,"unit"); const generated=nonNegative(body,"generatedQuantity"); const segregated=nonNegative(body,"segregatedQuantity"); const channelized=nonNegative(body,"channelizedQuantity"); const processed=nonNegative(body,"processedQuantity");
    if (!stream||!unit||generated===null||segregated===null||channelized===null||processed===null) return reply.code(400).send({error:"wasteStream, unit and non-negative quantities are required",code:"WASTE_INPUT_INVALID"}); if(segregated>generated||channelized>generated||processed>channelized)return reply.code(400).send({error:"Waste quantities must satisfy segregated ≤ generated, channelised ≤ generated, and processed ≤ channelised",code:"WASTE_QUANTITY_INVALID"});
    const evidenceId=str(body,"evidenceId"); const verificationId=str(body,"verificationId"); if(verificationId&&!evidenceId)return reply.code(400).send({error:"verificationId requires evidenceId",code:"VERIFICATION_EVIDENCE_REQUIRED"}); if(evidenceId){const check=await verifiedEvidence(pool,evidenceId,verificationId,organizationId);if(!check.ok)return reply.code(check.code==="EVIDENCE_FORBIDDEN"?403:409).send({error:"Evidence or verification is not authoritative for this organization",code:check.code});}
    try{const row=await pool.query("insert into bwg_waste_reports(reporting_period_id,waste_stream,generated_quantity,segregated_quantity,channelized_quantity,processed_quantity,unit,evidence_id,verification_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",[request.params.periodId,stream,generated,segregated,channelized,processed,unit,evidenceId,verificationId]);return reply.code(201).send({source:"postgresql",syntheticData:false,authoritativeMutation:true,report:row.rows[0]});}catch(error){request.log.error(error);return reply.code(503).send({error:"Waste report unavailable",syntheticData:false});}
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/epr", async (request, reply) => {
    const auth=await authFor(pool,request,reply);if(!auth||!pool)return;const organizationId=await periodOrganization(auth,request.params.periodId,reply);if(!organizationId)return;if(!await hasValuePermission(pool,"can_assess_epr",auth.identityId,organizationId))return reply.code(403).send({error:"EPR assessment permission required",code:"EPR_MANAGE_FORBIDDEN"});
    const body=bodyOf(request);const schemeId=str(body,"schemeId");const categoryCode=str(body,"categoryCode");const obligated=nonNegative(body,"obligatedQuantity");const fulfilled=nonNegative(body,"fulfilledQuantity");if(!schemeId||!categoryCode||obligated===null||fulfilled===null||!UUID.test(schemeId))return reply.code(400).send({error:"schemeId, categoryCode and non-negative quantities are required",code:"EPR_INPUT_INVALID"});
    const scheme=await pool.query<{jurisdiction_id:string|null}>("select jurisdiction_id from epr_schemes where id=$1 and status='VERIFIED'",[schemeId]);if(!scheme.rows[0])return reply.code(409).send({error:"Verified EPR scheme is required",code:"EPR_SCHEME_INVALID"});if(scheme.rows[0].jurisdiction_id&&!await authorizedJurisdiction(pool,auth.identityId,organizationId,scheme.rows[0].jurisdiction_id))return reply.code(403).send({error:"EPR scheme jurisdiction is outside organization scope",code:"GEOGRAPHY_FORBIDDEN"});
    const evidenceId=str(body,"evidenceId");const verificationId=str(body,"verificationId");if(verificationId&&!evidenceId)return reply.code(400).send({error:"verificationId requires evidenceId",code:"VERIFICATION_EVIDENCE_REQUIRED"});if(evidenceId){const check=await verifiedEvidence(pool,evidenceId,verificationId,organizationId);if(!check.ok)return reply.code(check.code==="EVIDENCE_FORBIDDEN"?403:409).send({error:"Evidence or verification is not authoritative for this organization",code:check.code});}
    try{const row=await pool.query("insert into bwg_epr_reports(reporting_period_id,scheme_id,category_code,obligated_quantity,fulfilled_quantity,evidence_id,verification_id) values($1,$2,$3,$4,$5,$6,$7) returning *",[request.params.periodId,schemeId,categoryCode,obligated,fulfilled,evidenceId,verificationId]);return reply.code(201).send({source:"postgresql",syntheticData:false,authoritativeMutation:true,report:row.rows[0]});}catch(error){request.log.error(error);return reply.code(503).send({error:"EPR report unavailable",syntheticData:false});}
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/esg", async (request, reply) => {
    const auth=await authFor(pool,request,reply);if(!auth||!pool)return;const organizationId=await periodOrganization(auth,request.params.periodId,reply);if(!organizationId)return;if(!await hasValuePermission(pool,"can_write_esg",auth.identityId,organizationId))return reply.code(403).send({error:"ESG metric write permission required",code:"ESG_WRITE_FORBIDDEN"});
    const body=bodyOf(request);const metricCode=str(body,"metricCode");const scope=str(body,"scope");const unit=str(body,"unit");const metricValue=nonNegative(body,"value");if(!metricCode||!scope||!unit||metricValue===null||!["1","2","3","IMPACT"].includes(scope))return reply.code(400).send({error:"metricCode, scope, unit and non-negative value are required",code:"ESG_INPUT_INVALID"});
    const evidenceId=str(body,"evidenceId");const verificationId=str(body,"verificationId");if(verificationId&&!evidenceId)return reply.code(400).send({error:"verificationId requires evidenceId",code:"VERIFICATION_EVIDENCE_REQUIRED"});if(evidenceId){const check=await verifiedEvidence(pool,evidenceId,verificationId,organizationId);if(!check.ok)return reply.code(check.code==="EVIDENCE_FORBIDDEN"?403:409).send({error:"Evidence or verification is not authoritative for this organization",code:check.code});}
    try{const row=await pool.query("insert into bwg_esg_reports(reporting_period_id,metric_code,scope,value,unit,evidence_id,verification_id) values($1,$2,$3,$4,$5,$6,$7) returning *",[request.params.periodId,metricCode,scope,metricValue,unit,evidenceId,verificationId]);return reply.code(201).send({source:"postgresql",syntheticData:false,authoritativeMutation:true,report:row.rows[0]});}catch(error){request.log.error(error);return reply.code(503).send({error:"ESG report unavailable",syntheticData:false});}
  });
}
