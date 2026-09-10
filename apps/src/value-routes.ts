import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { calculateEmissionReduction, sha256Canonical } from "@rupaykg/carbon";
import { assessEprObligation } from "@rupaykg/compliance";
import { classifyMetric } from "@rupaykg/esg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { registerAuthRoutes } from "./auth-routes.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void }; headers: Record<string, string | undefined> };
function bodyOf(request: Request): Record<string, unknown> { return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {}; }
function str(body: Record<string, unknown>, key: string): string | null { return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null; }
function nonNegative(body: Record<string, unknown>, key: string): number | null { const n = Number(body[key]); return Number.isFinite(n) && n >= 0 ? n : null; }
async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> { try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; } catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null; } }
async function activityAccess(client: Pool | PoolClient, activityId: string, identityId: string): Promise<{ organization_id: string; geography_id: string | null } | null> { const result = await client.query<{ organization_id: string; geography_id: string | null }>(`select a.organization_id, a.geography_id from activities a join organization_memberships om on om.organization_id = a.organization_id where a.id = $1 and om.identity_id = $2 and om.status = 'VERIFIED'`, [activityId, identityId]); return result.rows[0] ?? null; }
async function assertActivityGeographyScope(client: Pool | PoolClient, geographyId: string | null, identityId: string): Promise<{ ok: boolean; code?: string }> { if (!geographyId) return { ok: false, code: "ACTIVITY_GEOGRAPHY_REQUIRED" }; const result = await client.query<{ ok: boolean }>(`select exists(select 1 from organization_memberships om where om.identity_id = $1 and om.status = 'VERIFIED' and organization_has_geography_scope(om.organization_id, $2)) as ok`, [identityId, geographyId]); return result.rows[0]?.ok === true ? { ok: true } : { ok: false, code: "GEOGRAPHY_FORBIDDEN" }; }
async function hasValuePermission(pool: Pool, functionName: "can_assess_epr" | "can_write_esg", identityId: string, organizationId: string): Promise<boolean> { const result = await pool.query<{ ok: boolean }>(`select ${functionName}($1,$2) as ok`, [identityId, organizationId]); return result.rows[0]?.ok === true; }
async function evidenceIsVerified(pool: Pool, evidenceId: string, organizationId: string): Promise<boolean> { const result = await pool.query<{ ok: boolean }>(`select exists(select 1 from evidence e join activities a on a.id=e.activity_id where e.id=$1 and a.organization_id=$2 and e.status='VERIFIED' and (e.content_hash is not null or e.content_uri is not null) and a.geography_id is not null and organization_has_geography_scope($2,a.geography_id)) as ok`, [evidenceId, organizationId]); return result.rows[0]?.ok === true; }

export async function registerValueRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  await registerAuthRoutes(app, pool);
  app.post("/api/v1/carbon/calculations", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never);
    const activityId = str(body, "activityId"); const methodologyCode = str(body, "methodologyCode"); const methodologyVersion = str(body, "methodologyVersion"); const evidenceId = str(body, "evidenceId");
    const baselineTco2e = nonNegative(body, "baselineTco2e"); const projectTco2e = nonNegative(body, "projectTco2e");
    const leakageTco2e = nonNegative(body, "leakageTco2e"); const uncertaintyTco2e = nonNegative(body, "uncertaintyTco2e");
    if (!activityId || !methodologyCode || !methodologyVersion || !evidenceId || baselineTco2e === null || projectTco2e === null || leakageTco2e === null || uncertaintyTco2e === null) return reply.code(400).send({ error: "activityId, methodologyCode, methodologyVersion, evidenceId, baselineTco2e, projectTco2e, leakageTco2e and uncertaintyTco2e are required", code: "CARBON_INPUTS_REQUIRED" });
    try {
      const access = await activityAccess(pool, activityId, auth.identityId); if (!access) return reply.code(403).send({ error: "Activity access denied", code: "ACTIVITY_FORBIDDEN" });
      if (!await hasOrganizationPermission(pool, auth, access.organization_id, ["projects:manage"])) return reply.code(403).send({ error: "Explicit projects:manage permission is required", code: "CARBON_CALCULATION_FORBIDDEN" });
      const geography = await assertActivityGeographyScope(pool, access.geography_id, auth.identityId);
      if (!geography.ok) return reply.code(geography.code === "ACTIVITY_GEOGRAPHY_REQUIRED" ? 409 : 403).send({ error: geography.code === "ACTIVITY_GEOGRAPHY_REQUIRED" ? "Activity must have an authorized geography before value calculation" : "Activity geography is outside organization authorization scope", code: geography.code });
      const evidence = await pool.query<{ id: string; activity_id: string | null; content_hash: string | null; content_uri: string | null; status: string }>("select id, activity_id, content_hash, content_uri, status from evidence where id = $1", [evidenceId]);
      const evidenceRow = evidence.rows[0];
      if (!evidenceRow || evidenceRow.activity_id !== activityId) return reply.code(409).send({ error: "Evidence must exist and belong to the activity", code: "EVIDENCE_ACTIVITY_MISMATCH" });
      if (evidenceRow.status !== "VERIFIED") return reply.code(409).send({ error: "Evidence must be verified before value calculation", code: "EVIDENCE_NOT_VERIFIED" });
      const verification = await pool.query<{ id: string }>("select id from verifications where evidence_id = $1 and decision = 'APPROVED' limit 1", [evidenceId]);
      if (!verification.rows[0]) return reply.code(409).send({ error: "Approved verification is required before value calculation", code: "VERIFICATION_REQUIRED" });
      if (!evidenceRow.content_hash && !evidenceRow.content_uri) return reply.code(409).send({ error: "Evidence must have a content hash or authoritative content URI", code: "EVIDENCE_PROVENANCE_REQUIRED" });
      const method = await pool.query<{ id: string; rules: unknown; governance_status: string }>("select id, rules, governance_status from methodology_versions where methodology_code = $1 and version = $2", [methodologyCode, methodologyVersion]);
      if (!method.rows[0]) return reply.code(409).send({ error: "Methodology version is not registered", code: "METHODOLOGY_NOT_REGISTERED" });
      const result = calculateEmissionReduction({ activityId, methodologyCode, methodologyVersion, baselineTco2e, projectTco2e, leakageTco2e, uncertaintyTco2e });
      const dataset = { activityId, evidence: { id: evidenceId, contentHash: evidenceRow.content_hash, contentUri: evidenceRow.content_uri, status: evidenceRow.status }, normalizedInputs: result.normalizedInputs };
      const datasetHash = sha256Canonical(dataset);
      const formulaHash = sha256Canonical(method.rows[0].rules);
      const calculationTrace = result.trace.map(step => ({ ...step, evidenceId, evidenceHash: datasetHash }));
      const calculationHash = sha256Canonical({ provenanceVersion: "1", methodologyCode, methodologyVersion, methodologyGovernanceStatus: method.rows[0].governance_status, datasetHash, formulaHash, calculationTrace, result: { grossReductionTco2e: result.grossReductionTco2e, netReductionTco2e: result.netReductionTco2e, uncertaintyTco2e: result.uncertaintyTco2e } });
      const inputs = { ...result.normalizedInputs, evidenceId };
      const inserted = await pool.query("insert into carbon_calculations (activity_id, methodology_version_id, inputs, result, unit, status, calculated_at, baseline_result, uncertainty, dataset_hash, formula_hash, calculation_trace, provenance_version, calculation_hash) values ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11,$12,$13) returning *", [activityId, method.rows[0].id, inputs, result.netReductionTco2e, "tCO2e", result.status, baselineTco2e, uncertaintyTco2e, datasetHash, formulaHash, JSON.stringify(calculationTrace), "1", calculationHash]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, calculation: inserted.rows[0], calculationResult: { ...result, evidenceId, datasetHash, formulaHash, calculationTrace, calculationHash } });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Carbon calculation unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/epr/obligations/:obligationId/assess", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const obligationId = (request.params as { obligationId: string }).obligationId;
    try {
      const obligation = await pool.query<{ id: string; organization_id: string; jurisdiction_id: string | null; required_quantity: string }>("select id, organization_id, jurisdiction_id, required_quantity from obligations where id = $1", [obligationId]);
      if (!obligation.rows[0]) return reply.code(404).send({ error: "Obligation not found" });
      const organizationId = obligation.rows[0].organization_id;
      if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await hasValuePermission(pool, "can_assess_epr", auth.identityId, organizationId)) return reply.code(403).send({ error: "EPR assessment permission required", code: "EPR_ASSESS_FORBIDDEN" });
      const jurisdictionId = obligation.rows[0].jurisdiction_id;
      if (!jurisdictionId) return reply.code(409).send({ error: "EPR obligation must have an authorized jurisdiction before assessment", code: "OBLIGATION_JURISDICTION_REQUIRED" });
      const jurisdiction = await pool.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok", [auth.identityId, organizationId, jurisdictionId]);
      if (jurisdiction.rows[0]?.ok !== true) return reply.code(403).send({ error: "Obligation jurisdiction is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      const evidence = await pool.query<{ evidence_id: string; verification_id: string; quantity: string }>(`select c.evidence_id, c.verification_id, c.quantity::text from epr_credits c join epr_obligations eo on eo.scheme_id = c.scheme_id and eo.obligated_organization_id = $1 join evidence e on e.id = c.evidence_id join verifications v on v.id = c.verification_id join activities a on a.id = e.activity_id where eo.obligation_id = $2 and c.status in ('ELIGIBLE','ISSUED','ACTIVE') and e.status = 'VERIFIED' and (e.content_hash is not null or e.content_uri is not null) and v.decision = 'APPROVED' and a.geography_id is not null and organization_has_geography_scope($1,a.geography_id)`, [organizationId, obligationId]);
      const assessment = assessEprObligation(Number(obligation.rows[0].required_quantity ?? 0), evidence.rows.map(row => ({ evidenceId: row.evidence_id, verificationId: row.verification_id, approved: true, quantity: Number(row.quantity) })));
      await pool.query("update obligations set status = $2, required_quantity = $3 where id = $1", [obligationId, assessment.status, assessment.requiredQuantity]);
      return { source: "postgresql", syntheticData: false, assessment };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "EPR assessment unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/esg/reporting-periods/:periodId/metrics", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const metricCode = str(body, "metricCode"); const scope = str(body, "scope") as "1" | "2" | "3" | "IMPACT" | null; const unit = str(body, "unit"); const value = nonNegative(body, "value");
    if (!metricCode || !scope || !["1","2","3","IMPACT"].includes(scope) || !unit || value === null) return reply.code(400).send({ error: "metricCode, scope, unit and non-negative value are required" });
    try {
      const period = await pool.query<{ organization_id: string }>("select organization_id from esg_reporting_periods where id = $1", [periodId]);
      if (!period.rows[0]) return reply.code(404).send({ error: "Reporting period not found" });
      const organizationId = period.rows[0].organization_id;
      if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await hasValuePermission(pool, "can_write_esg", auth.identityId, organizationId)) return reply.code(403).send({ error: "ESG metric write permission required", code: "ESG_WRITE_FORBIDDEN" });
      const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId");
      if (verificationId && !evidenceId) return reply.code(400).send({ error: "verificationId requires evidenceId" });
      const metric = { code: metricCode, scope, value, unit, ...(evidenceId ? { evidenceId } : {}), ...(verificationId ? { verificationId } : {}) };
      const state = classifyMetric(metric);
      if (evidenceId) {
        const evidence = await pool.query<{ activity_id: string | null; status: string }>(`select e.activity_id, e.status from evidence e left join activities a on a.id=e.activity_id where e.id=$1 and a.organization_id=$2 and a.geography_id is not null and organization_has_geography_scope($2,a.geography_id)`, [evidenceId, organizationId]);
        if (!evidence.rows[0]) return reply.code(403).send({ error: "Evidence is outside organization authorization scope", code: "EVIDENCE_FORBIDDEN" });
        if (evidence.rows[0].status !== "VERIFIED") return reply.code(409).send({ error: "Evidence must be verified before ESG metric recording", code: "EVIDENCE_NOT_VERIFIED" });
      }
      if (verificationId) {
        const verified = await pool.query("select 1 from verifications where id = $1 and evidence_id = $2 and decision = 'APPROVED'", [verificationId, evidenceId]);
        if (!verified.rows[0]) return reply.code(409).send({ error: "Verification is not an approved verification for the supplied evidence", code: "VERIFICATION_INVALID" });
      }
      const inserted = await pool.query("insert into esg_metrics (reporting_period_id, metric_code, scope, value, unit, evidence_id, verification_id, status, metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [periodId, metricCode, scope, value, unit, evidenceId, verificationId, state, body.metadata ?? {}]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, metric: inserted.rows[0], state });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "ESG metric recording unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/workspaces/bwg", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const ids = [...new Set(auth.memberships.map((membership) => membership.organization_id))];
    if (!ids.length) return { source: "postgresql", syntheticData: false, data: { profiles: [], periods: [], wasteReports: [], eprReports: [], esgReports: [] } };
    try {
      const [profiles, periods, wasteReports, eprReports, esgReports] = await Promise.all([
        pool.query("select p.*, g.name as jurisdiction_name from bwg_profiles p left join geography g on g.id=p.jurisdiction_id where p.organization_id=any($1::uuid[]) order by p.updated_at desc", [ids]),
        pool.query("select * from bwg_reporting_periods where organization_id=any($1::uuid[]) order by period_end desc", [ids]),
        pool.query("select w.*, r.organization_id from bwg_waste_reports w join bwg_reporting_periods r on r.id=w.reporting_period_id where r.organization_id=any($1::uuid[]) order by w.created_at desc", [ids]),
        pool.query("select e.*, r.organization_id, s.name as scheme_name from bwg_epr_reports e join bwg_reporting_periods r on r.id=e.reporting_period_id join epr_schemes s on s.id=e.scheme_id where r.organization_id=any($1::uuid[]) order by e.created_at desc", [ids]),
        pool.query("select e.*, r.organization_id from bwg_esg_reports e join bwg_reporting_periods r on r.id=e.reporting_period_id where r.organization_id=any($1::uuid[]) order by e.created_at desc", [ids]),
      ]);
      return { source: "postgresql", syntheticData: false, data: { profiles: profiles.rows, periods: periods.rows, wasteReports: wasteReports.rows, eprReports: eprReports.rows, esgReports: esgReports.rows } };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG reporting workspace unavailable", code: "BWG_WORKSPACE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/profile", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never); const organizationId = str(body, "organizationId"); const jurisdictionId = str(body, "jurisdictionId");
    const floorArea = nonNegative(body, "floorAreaSqm"); const water = nonNegative(body, "waterConsumptionLpd"); const waste = nonNegative(body, "wasteGenerationKgDay"); const establishmentType = str(body, "establishmentType");
    if (!organizationId || !jurisdictionId || floorArea === null || water === null || waste === null || !establishmentType) return reply.code(400).send({ error: "organizationId, jurisdictionId, floorAreaSqm, waterConsumptionLpd, wasteGenerationKgDay and establishmentType are required", code: "BWG_PROFILE_REQUIRED" });
    if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["profile:update", "waste:record"])) return reply.code(403).send({ error: "Profile update and waste recording permissions are required", code: "BWG_PROFILE_FORBIDDEN" });
    const geography = await pool.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok", [auth.identityId, organizationId, jurisdictionId]);
    if (geography.rows[0]?.ok !== true) return reply.code(403).send({ error: "Jurisdiction is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    const criteria = { floorAreaSqm: floorArea >= 20000, waterConsumptionLpd: water >= 40000, wasteGenerationKgDay: waste >= 100 };
    const applicable = Object.values(criteria).some(Boolean);
    const applicabilityStatus = applicable ? "APPLICABLE" : "NOT_APPLICABLE";
    try {
      const row = await pool.query("insert into bwg_profiles (organization_id,jurisdiction_id,floor_area_sqm,water_consumption_lpd,waste_generation_kg_day,establishment_type,applicability_status,applicability_basis,status,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,'VERIFIED',now()) on conflict (organization_id) do update set jurisdiction_id=excluded.jurisdiction_id,floor_area_sqm=excluded.floor_area_sqm,water_consumption_lpd=excluded.water_consumption_lpd,waste_generation_kg_day=excluded.waste_generation_kg_day,establishment_type=excluded.establishment_type,applicability_status=excluded.applicability_status,applicability_basis=excluded.applicability_basis,status='VERIFIED',updated_at=now() returning *", [organizationId, jurisdictionId, floorArea, water, waste, establishmentType, applicabilityStatus, JSON.stringify(criteria)]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, profile: row.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG profile unavailable", code: "BWG_PROFILE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never); const organizationId = str(body, "organizationId"); const start = str(body, "periodStart"); const end = str(body, "periodEnd"); const basis = str(body, "reportingBasis");
    if (!organizationId || !start || !end || !basis || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || start > end) return reply.code(400).send({ error: "organizationId, valid periodStart, periodEnd and reportingBasis are required", code: "BWG_PERIOD_REQUIRED" });
    if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["reports:read", "waste:record"])) return reply.code(403).send({ error: "Reporting and waste recording permissions are required", code: "BWG_PERIOD_FORBIDDEN" });
    try { const row = await pool.query("insert into bwg_reporting_periods (organization_id,period_start,period_end,reporting_basis) values ($1,$2,$3,$4) on conflict (organization_id,period_start,period_end,reporting_basis) do update set reporting_basis=excluded.reporting_basis returning *", [organizationId,start,end,basis]); return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, period: row.rows[0] }); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG reporting period unavailable", code: "BWG_PERIOD_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/waste", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const wasteStream = str(body, "wasteStream"); const unit = str(body, "unit");
    const generated = nonNegative(body, "generatedQuantity"); const segregated = nonNegative(body, "segregatedQuantity") ?? 0; const channelized = nonNegative(body, "channelizedQuantity") ?? 0; const processed = nonNegative(body, "processedQuantity") ?? 0;
    if (!wasteStream || !unit || generated === null || segregated > generated || channelized > generated || processed > channelized) return reply.code(400).send({ error: "wasteStream, unit, generatedQuantity and valid segregated/channelized/processed quantities are required", code: "BWG_WASTE_REQUIRED" });
    try {
      const period = await pool.query<{ organization_id: string }>("select organization_id from bwg_reporting_periods where id=$1", [periodId]); if (!period.rows[0]) return reply.code(404).send({ error: "BWG reporting period not found" });
      const organizationId = period.rows[0].organization_id; if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await hasOrganizationPermission(pool, auth, organizationId, ["waste:record"])) return reply.code(403).send({ error: "Waste recording permission required", code: "BWG_WASTE_FORBIDDEN" });
      const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId"); if (verificationId && !evidenceId) return reply.code(400).send({ error: "verificationId requires evidenceId" });
      if (evidenceId && !await evidenceIsVerified(pool, evidenceId, organizationId)) return reply.code(409).send({ error: "Verified, provenance-backed evidence is required", code: "EVIDENCE_NOT_VERIFIED" });
      if (verificationId) { const v = await pool.query("select 1 from verifications where id=$1 and evidence_id=$2 and decision='APPROVED'", [verificationId,evidenceId]); if (!v.rows[0]) return reply.code(409).send({ error: "Approved verification is required", code: "VERIFICATION_INVALID" }); }
      const row = await pool.query("insert into bwg_waste_reports (reporting_period_id,waste_stream,generated_quantity,segregated_quantity,channelized_quantity,processed_quantity,unit,evidence_id,verification_id,status,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *", [periodId,wasteStream,generated,segregated,channelized,processed,unit,evidenceId,verificationId,evidenceId && verificationId ? 'VERIFIED' : 'PENDING',body.metadata ?? {}]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, wasteReport: row.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG waste report unavailable", code: "BWG_WASTE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/epr", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const schemeId = str(body, "schemeId"); const categoryCode = str(body, "categoryCode"); const obligated = nonNegative(body, "obligatedQuantity"); const fulfilled = nonNegative(body, "fulfilledQuantity");
    if (!schemeId || !categoryCode || obligated === null || fulfilled === null || fulfilled > obligated) return reply.code(400).send({ error: "schemeId, categoryCode and valid obligated/fulfilled quantities are required", code: "BWG_EPR_REQUIRED" });
    try {
      const period = await pool.query<{ organization_id: string }>("select organization_id from bwg_reporting_periods where id=$1", [periodId]); if (!period.rows[0]) return reply.code(404).send({ error: "BWG reporting period not found" });
      const organizationId = period.rows[0].organization_id; if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await hasOrganizationPermission(pool, auth, organizationId, ["epr:manage"])) return reply.code(403).send({ error: "EPR management permission required", code: "BWG_EPR_FORBIDDEN" });
      const scheme = await pool.query("select id from epr_schemes where id=$1 and status='VERIFIED'", [schemeId]); if (!scheme.rows[0]) return reply.code(404).send({ error: "Authoritative EPR scheme not found" });
      const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId"); if (verificationId && !evidenceId) return reply.code(400).send({ error: "verificationId requires evidenceId" });
      if (evidenceId && !await evidenceIsVerified(pool, evidenceId, organizationId)) return reply.code(409).send({ error: "Verified, provenance-backed evidence is required", code: "EVIDENCE_NOT_VERIFIED" });
      if (verificationId) { const v = await pool.query("select 1 from verifications where id=$1 and evidence_id=$2 and decision='APPROVED'", [verificationId,evidenceId]); if (!v.rows[0]) return reply.code(409).send({ error: "Approved verification is required", code: "VERIFICATION_INVALID" }); }
      const row = await pool.query("insert into bwg_epr_reports (reporting_period_id,scheme_id,category_code,obligated_quantity,fulfilled_quantity,evidence_id,verification_id,status,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [periodId,schemeId,categoryCode,obligated,fulfilled,evidenceId,verificationId,evidenceId && verificationId ? 'VERIFIED' : 'PENDING',body.metadata ?? {}]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, externalSubmission: "NOT_SUBMITTED", eprReport: row.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG EPR report unavailable", code: "BWG_EPR_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/esg", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const metricCode = str(body, "metricCode"); const scope = str(body, "scope"); const unit = str(body, "unit"); const value = nonNegative(body, "value");
    if (!metricCode || !scope || !unit || value === null) return reply.code(400).send({ error: "metricCode, scope, unit and non-negative value are required", code: "BWG_ESG_REQUIRED" });
    try {
      const period = await pool.query<{ organization_id: string }>("select organization_id from bwg_reporting_periods where id=$1", [periodId]); if (!period.rows[0]) return reply.code(404).send({ error: "BWG reporting period not found" });
      const organizationId = period.rows[0].organization_id; if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await hasValuePermission(pool, "can_write_esg", auth.identityId, organizationId)) return reply.code(403).send({ error: "ESG metric write permission required", code: "BWG_ESG_FORBIDDEN" });
      const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId"); if (verificationId && !evidenceId) return reply.code(400).send({ error: "verificationId requires evidenceId" });
      if (evidenceId && !await evidenceIsVerified(pool, evidenceId, organizationId)) return reply.code(409).send({ error: "Verified, provenance-backed evidence is required", code: "EVIDENCE_NOT_VERIFIED" });
      if (verificationId) { const v = await pool.query("select 1 from verifications where id=$1 and evidence_id=$2 and decision='APPROVED'", [verificationId,evidenceId]); if (!v.rows[0]) return reply.code(409).send({ error: "Approved verification is required", code: "VERIFICATION_INVALID" }); }
      const row = await pool.query("insert into bwg_esg_reports (reporting_period_id,metric_code,scope,value,unit,evidence_id,verification_id,status,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [periodId,metricCode,scope,value,unit,evidenceId,verificationId,evidenceId && verificationId ? 'VERIFIED' : 'PENDING',body.metadata ?? {}]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, esgReport: row.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG ESG report unavailable", code: "BWG_ESG_UNAVAILABLE", syntheticData: false }); }
  });
}
