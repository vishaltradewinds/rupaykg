import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { calculateEmissionReduction, isGenericCalculationMethodAllowed, sha256Canonical } from "@rupaykg/carbon";
import { assessEprObligation } from "@rupaykg/compliance";
import { classifyMetric } from "@rupaykg/esg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { createTenantTransaction, tenantDatabaseContextFromAuth } from "./database-context.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void }; headers: Record<string, string | undefined> };
function bodyOf(request: Request): Record<string, unknown> { return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {}; }
function str(body: Record<string, unknown>, key: string): string | null { return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null; }
function nonNegative(body: Record<string, unknown>, key: string): number | null { const n = Number(body[key]); return Number.isFinite(n) && n >= 0 ? n : null; }

export type BwgEprQuantityError = "BWG_EPR_REQUIRED" | "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED";

export function bwgEprQuantityError(obligated: number | null, fulfilled: number | null): BwgEprQuantityError | null {
  if (obligated === null || fulfilled === null || !Number.isFinite(obligated) || !Number.isFinite(fulfilled) || obligated < 0 || fulfilled < 0) return "BWG_EPR_REQUIRED";
  if (fulfilled > obligated) return "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED";
  return null;
}

export function isBwgEprFulfilledObligationConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === "23514" && candidate.constraint === "bwg_epr_reports_fulfilled_le_obligated";
}
async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> { try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; } catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null; } }
async function activityAccess(client: Pool | PoolClient, activityId: string, identityId: string): Promise<{ organization_id: string; geography_id: string | null } | null> { const result = await client.query<{ organization_id: string; geography_id: string | null }>(`select a.organization_id, a.geography_id from activities a join organization_memberships om on om.organization_id = a.organization_id where a.id = $1 and om.identity_id = $2 and om.status = 'VERIFIED'`, [activityId, identityId]); return result.rows[0] ?? null; }
async function assertActivityGeographyScope(client: Pool | PoolClient, geographyId: string | null, identityId: string, organizationId: string): Promise<{ ok: boolean; code?: string }> {
  if (!geographyId) return { ok: false, code: "ACTIVITY_GEOGRAPHY_REQUIRED" };
  const result = await client.query<{ ok: boolean }>(
    "select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$3 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$2)) as ok",
    [identityId, geographyId, organizationId],
  );
  return result.rows[0]?.ok === true ? { ok: true } : { ok: false, code: "GEOGRAPHY_FORBIDDEN" };
}
async function hasValuePermission(pool: Pool | PoolClient, functionName: "can_assess_epr" | "can_write_esg", identityId: string, organizationId: string): Promise<boolean> { const result = await pool.query<{ ok: boolean }>(`select ${functionName}($1,$2) as ok`, [identityId, organizationId]); return result.rows[0]?.ok === true; }
export function bwgProfileReviewBasis(): Record<string, unknown> {
  return {
    sourceRuleReference: "SWM_RULES_2026_S_O_388_E",
    classification: "REVIEW_REQUIRED",
    determinationBoundary: "PROFILE_INTAKE_ONLY_NOT_A_STATUTORY_DETERMINATION",
    evidenceAndIndependentReviewRequired: true,
    externalRegistrationAsserted: false,
  };
}

/** BWG reporting data is visible only to members with the explicit report-read capability. */
export async function canReadBwgWorkspace(client: Pool | PoolClient, auth: AuthContext, organizationId: string): Promise<boolean> {
  return hasOrganizationPermission(client, auth, organizationId, ["reports:read"]);
}
async function evidenceIsVerified(pool: Pool | PoolClient, evidenceId: string, organizationId: string): Promise<boolean> { const result = await pool.query<{ ok: boolean }>(`select exists(select 1 from evidence e join activities a on a.id=e.activity_id where e.id=$1 and a.organization_id=$2 and e.status='VERIFIED' and (e.content_hash is not null or e.content_uri is not null) and a.geography_id is not null and organization_has_geography_scope($2,a.geography_id)) as ok`, [evidenceId, organizationId]); return result.rows[0]?.ok === true; }

export async function registerValueRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  await registerAuthRoutes(app, pool);
  const withTenantTransaction = pool ? createTenantTransaction(pool) : null;
  app.post("/api/v1/carbon/calculations", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    if (!auth.activeOrganizationId) return reply.code(403).send({ error: "Select a verified active organization", code: "ORG_FORBIDDEN" });
    const activeOrganizationId = auth.activeOrganizationId;
    const body = bodyOf(request as never);
    const activityId = str(body, "activityId"); const methodologyCode = str(body, "methodologyCode"); const methodologyVersion = str(body, "methodologyVersion"); const evidenceId = str(body, "evidenceId");
    const baselineTco2e = nonNegative(body, "baselineTco2e"); const projectTco2e = nonNegative(body, "projectTco2e");
    const leakageTco2e = nonNegative(body, "leakageTco2e"); const uncertaintyTco2e = nonNegative(body, "uncertaintyTco2e");
    if (!activityId || !methodologyCode || !methodologyVersion || !evidenceId || baselineTco2e === null || projectTco2e === null || leakageTco2e === null || uncertaintyTco2e === null) return reply.code(400).send({ error: "activityId, methodologyCode, methodologyVersion, evidenceId, baselineTco2e, projectTco2e, leakageTco2e and uncertaintyTco2e are required", code: "CARBON_INPUTS_REQUIRED" });
    try {
      if (!withTenantTransaction) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
      const access = await activityAccess(client, activityId, auth.identityId); if (!access || access.organization_id !== activeOrganizationId) return reply.code(403).send({ error: "Activity access denied", code: "ACTIVITY_FORBIDDEN" });
      if (!await hasOrganizationPermission(client, auth, access.organization_id, ["projects:manage"])) return reply.code(403).send({ error: "Explicit projects:manage permission is required", code: "CARBON_CALCULATION_FORBIDDEN" });
      const geography = await assertActivityGeographyScope(client, access.geography_id, auth.identityId, activeOrganizationId);
      if (!geography.ok) return reply.code(geography.code === "ACTIVITY_GEOGRAPHY_REQUIRED" ? 409 : 403).send({ error: geography.code === "ACTIVITY_GEOGRAPHY_REQUIRED" ? "Activity must have an authorized geography before value calculation" : "Activity geography is outside organization authorization scope", code: geography.code });
      const evidence = await client.query<{ id: string; activity_id: string | null; content_hash: string | null; content_uri: string | null; status: string }>("select id, activity_id, content_hash, content_uri, status from evidence where id = $1", [evidenceId]);
      const evidenceRow = evidence.rows[0];
      if (!evidenceRow || evidenceRow.activity_id !== activityId) return reply.code(409).send({ error: "Evidence must exist and belong to the activity", code: "EVIDENCE_ACTIVITY_MISMATCH" });
      if (evidenceRow.status !== "VERIFIED") return reply.code(409).send({ error: "Evidence must be verified before value calculation", code: "EVIDENCE_NOT_VERIFIED" });
      const verification = await client.query<{ id: string }>("select id from verifications where evidence_id = $1 and decision = 'APPROVED' limit 1", [evidenceId]);
      if (!verification.rows[0]) return reply.code(409).send({ error: "Approved verification is required before value calculation", code: "VERIFICATION_REQUIRED" });
      if (!evidenceRow.content_hash && !evidenceRow.content_uri) return reply.code(409).send({ error: "Evidence must have a content hash or authoritative content URI", code: "EVIDENCE_PROVENANCE_REQUIRED" });
      const method = await client.query<{ id: string; rules: unknown; governance_status: string }>("select id, rules, governance_status from methodology_versions where methodology_code = $1 and version = $2", [methodologyCode, methodologyVersion]);
      if (!method.rows[0]) return reply.code(409).send({ error: "Methodology version is not registered", code: "METHODOLOGY_NOT_REGISTERED" });
      if (!isGenericCalculationMethodAllowed(methodologyCode)) return reply.code(409).send({ error: "Official BEE CCTS methodologies require a reviewed, method-specific calculation adapter; generic baseline/project arithmetic is blocked", code: "METHODOLOGY_ADAPTER_NOT_VALIDATED" });
      const result = calculateEmissionReduction({ activityId, methodologyCode, methodologyVersion, baselineTco2e, projectTco2e, leakageTco2e, uncertaintyTco2e });
      const dataset = { activityId, evidence: { id: evidenceId, contentHash: evidenceRow.content_hash, contentUri: evidenceRow.content_uri, status: evidenceRow.status }, normalizedInputs: result.normalizedInputs };
      const datasetHash = sha256Canonical(dataset);
      const formulaHash = sha256Canonical(method.rows[0].rules);
      const calculationTrace = result.trace.map(step => ({ ...step, evidenceId, evidenceHash: datasetHash }));
      const calculationHash = sha256Canonical({ provenanceVersion: "1", methodologyCode, methodologyVersion, methodologyGovernanceStatus: method.rows[0].governance_status, datasetHash, formulaHash, calculationTrace, result: { grossReductionTco2e: result.grossReductionTco2e, netReductionTco2e: result.netReductionTco2e, uncertaintyTco2e: result.uncertaintyTco2e } });
      const inputs = { ...result.normalizedInputs, evidenceId };
      const inserted = await client.query("insert into carbon_calculations (activity_id, methodology_version_id, inputs, result, unit, status, calculated_at, baseline_result, uncertainty, dataset_hash, formula_hash, calculation_trace, provenance_version, calculation_hash) values ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11,$12,$13) returning *", [activityId, method.rows[0].id, inputs, result.netReductionTco2e, "tCO2e", result.status, baselineTco2e, uncertaintyTco2e, datasetHash, formulaHash, JSON.stringify(calculationTrace), "1", calculationHash]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, calculation: inserted.rows[0], calculationResult: { ...result, evidenceId, datasetHash, formulaHash, calculationTrace, calculationHash } });
      });
      return tenantResponse;
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Carbon calculation unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/epr/obligations/:obligationId/assess", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    if (!auth.activeOrganizationId) return reply.code(403).send({ error: "Select a verified active organization", code: "ORG_FORBIDDEN" });
    const activeOrganizationId = auth.activeOrganizationId;
    const obligationId = (request.params as { obligationId: string }).obligationId;
    try {
      if (!withTenantTransaction) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
      const obligation = await client.query<{ id: string; organization_id: string; jurisdiction_id: string | null; required_quantity: string }>("select id, organization_id, jurisdiction_id, required_quantity from obligations where id = $1 and organization_id = $2", [obligationId, activeOrganizationId]);
      if (!obligation.rows[0]) return reply.code(404).send({ error: "Obligation not found" });
      const organizationId = obligation.rows[0].organization_id;
      if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await hasValuePermission(client, "can_assess_epr", auth.identityId, organizationId)) return reply.code(403).send({ error: "EPR assessment permission required", code: "EPR_ASSESS_FORBIDDEN" });
      const jurisdictionId = obligation.rows[0].jurisdiction_id;
      if (!jurisdictionId) return reply.code(409).send({ error: "EPR obligation must have an authorized jurisdiction before assessment", code: "OBLIGATION_JURISDICTION_REQUIRED" });
      const jurisdiction = await client.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok", [auth.identityId, organizationId, jurisdictionId]);
      if (jurisdiction.rows[0]?.ok !== true) return reply.code(403).send({ error: "Obligation jurisdiction is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      const evidence = await client.query<{ evidence_id: string; verification_id: string; quantity: string }>(`select c.evidence_id, c.verification_id, c.quantity::text from epr_credits c join epr_obligations eo on eo.scheme_id = c.scheme_id and eo.obligated_organization_id = $1 join evidence e on e.id = c.evidence_id join verifications v on v.id = c.verification_id join activities a on a.id = e.activity_id where eo.obligation_id = $2 and c.status in ('ELIGIBLE','ISSUED','ACTIVE') and e.status = 'VERIFIED' and (e.content_hash is not null or e.content_uri is not null) and v.decision = 'APPROVED' and a.geography_id is not null and organization_has_geography_scope($1,a.geography_id) and (c.issuer_organization_id = $1 or c.recycler_organization_id = $1)`, [organizationId, obligationId]);
      const assessment = assessEprObligation(Number(obligation.rows[0].required_quantity ?? 0), evidence.rows.map(row => ({ evidenceId: row.evidence_id, verificationId: row.verification_id, approved: true, quantity: Number(row.quantity) })));
      await client.query("update obligations set status = $2, required_quantity = $3 where id = $1", [obligationId, assessment.status, assessment.requiredQuantity]);
      return { source: "postgresql", syntheticData: false, assessment };
      });
      return tenantResponse;
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "EPR assessment unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/esg/reporting-periods/:periodId/metrics", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    if (!auth.activeOrganizationId) return reply.code(403).send({ error: "Select a verified active organization", code: "ORG_FORBIDDEN" });
    const activeOrganizationId = auth.activeOrganizationId;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const metricCode = str(body, "metricCode"); const scope = str(body, "scope") as "1" | "2" | "3" | "IMPACT" | null; const unit = str(body, "unit"); const value = nonNegative(body, "value");
    if (!metricCode || !scope || !["1","2","3","IMPACT"].includes(scope) || !unit || value === null) return reply.code(400).send({ error: "metricCode, scope, unit and non-negative value are required" });
    try {
      if (!withTenantTransaction) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
      const period = await client.query<{ organization_id: string }>("select organization_id from esg_reporting_periods where id = $1 and organization_id = $2", [periodId, activeOrganizationId]);
      if (!period.rows[0]) return reply.code(404).send({ error: "Reporting period not found" });
      const organizationId = period.rows[0].organization_id;
      if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await hasValuePermission(client, "can_write_esg", auth.identityId, organizationId)) return reply.code(403).send({ error: "ESG metric write permission required", code: "ESG_WRITE_FORBIDDEN" });
      const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId");
      if (verificationId && !evidenceId) return reply.code(400).send({ error: "verificationId requires evidenceId" });
      const metric = { code: metricCode, scope, value, unit, ...(evidenceId ? { evidenceId } : {}), ...(verificationId ? { verificationId } : {}) };
      const state = classifyMetric(metric);
      if (evidenceId) {
        const evidence = await client.query<{ activity_id: string | null; status: string }>(`select e.activity_id, e.status from evidence e left join activities a on a.id=e.activity_id where e.id=$1 and a.organization_id=$2 and a.geography_id is not null and organization_has_geography_scope($2,a.geography_id)`, [evidenceId, organizationId]);
        if (!evidence.rows[0]) return reply.code(403).send({ error: "Evidence is outside organization authorization scope", code: "EVIDENCE_FORBIDDEN" });
        if (evidence.rows[0].status !== "VERIFIED") return reply.code(409).send({ error: "Evidence must be verified before ESG metric recording", code: "EVIDENCE_NOT_VERIFIED" });
      }
      if (verificationId) {
        const verified = await client.query("select 1 from verifications v join evidence e on e.id=v.evidence_id join activities a on a.id=e.activity_id where v.id = $1 and v.evidence_id = $2 and v.decision = 'APPROVED' and a.organization_id = $3", [verificationId, evidenceId, organizationId]);
        if (!verified.rows[0]) return reply.code(409).send({ error: "Verification is not an approved verification for the supplied evidence", code: "VERIFICATION_INVALID" });
      }
      const inserted = await client.query("insert into esg_metrics (reporting_period_id, metric_code, scope, value, unit, evidence_id, verification_id, status, metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [periodId, metricCode, scope, value, unit, evidenceId, verificationId, state, body.metadata ?? {}]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, metric: inserted.rows[0], state });
      });
      return tenantResponse;
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "ESG metric recording unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/workspaces/bwg", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activeOrganizationId = auth.activeOrganizationId;
    if (!activeOrganizationId || !auth.memberships.some(m => m.organization_id === activeOrganizationId && m.status === "VERIFIED")) return reply.code(403).send({ error: "Select a verified active organization", code: "ORG_FORBIDDEN" });
    const ids = [activeOrganizationId];
    if (!ids.length) return { source: "postgresql", syntheticData: false, data: { profiles: [], periods: [], wasteReports: [], eprReports: [], esgReports: [], jurisdictions: [], schemes: [] } };
    try {
      if (!withTenantTransaction) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
      if (!await canReadBwgWorkspace(client, auth, activeOrganizationId)) return { denied: true as const };
      const [profiles, periods, wasteReports, eprReports, esgReports, jurisdictions, schemes] = await Promise.all([
        client.query("select p.*, g.name as jurisdiction_name from bwg_profiles p left join geography g on g.id=p.jurisdiction_id where p.organization_id=any($1::uuid[]) order by p.updated_at desc", [ids]),
        client.query("select * from bwg_reporting_periods where organization_id=any($1::uuid[]) order by period_end desc", [ids]),
        client.query("select w.*, r.organization_id from bwg_waste_reports w join bwg_reporting_periods r on r.id=w.reporting_period_id where r.organization_id=any($1::uuid[]) order by w.created_at desc", [ids]),
        client.query("select e.*, r.organization_id, s.name as scheme_name from bwg_epr_reports e join bwg_reporting_periods r on r.id=e.reporting_period_id join epr_schemes s on s.id=e.scheme_id where r.organization_id=any($1::uuid[]) order by e.created_at desc", [ids]),
        client.query("select e.*, r.organization_id from bwg_esg_reports e join bwg_reporting_periods r on r.id=e.reporting_period_id where r.organization_id=any($1::uuid[]) order by e.created_at desc", [ids]),
        client.query("select distinct g.id, g.name from geography g join organization_geography_scopes ogs on ogs.geography_id=g.id where ogs.organization_id=any($1::uuid[]) and ogs.status='VERIFIED' order by g.name", [ids]),
        client.query("select id, code, name, authority, jurisdiction_id from epr_schemes where status='VERIFIED' order by name"),
      ]);
      const organizations = await Promise.all(ids.map(async (organizationId) => ({
        organizationId,
        profileUpdate: await hasOrganizationPermission(client, auth, organizationId, ["profile:update", "waste:record"]),
        periodCreate: await hasOrganizationPermission(client, auth, organizationId, ["reports:read", "waste:record"]),
        wasteRecord: await hasOrganizationPermission(client, auth, organizationId, ["waste:record"]),
        eprManage: await hasOrganizationPermission(client, auth, organizationId, ["epr:manage"]),
        esgWrite: await hasValuePermission(client, "can_write_esg", auth.identityId, organizationId),
      })));
      return { source: "postgresql", syntheticData: false, data: { profiles: profiles.rows, periods: periods.rows, wasteReports: wasteReports.rows, eprReports: eprReports.rows, esgReports: esgReports.rows, jurisdictions: jurisdictions.rows, schemes: schemes.rows, organizations } };
      });
      if ("denied" in tenantResponse) return reply.code(403).send({ error: "BWG report read permission required", code: "BWG_WORKSPACE_READ_FORBIDDEN" });
      return tenantResponse;
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG reporting workspace unavailable", code: "BWG_WORKSPACE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/profile", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool || !withTenantTransaction) return;
    const body = bodyOf(request as never); const organizationId = str(body, "organizationId"); const jurisdictionId = str(body, "jurisdictionId");
    const floorArea = nonNegative(body, "floorAreaSqm"); const water = nonNegative(body, "waterConsumptionLpd"); const waste = nonNegative(body, "wasteGenerationKgDay"); const establishmentType = str(body, "establishmentType");
    if (!organizationId || !jurisdictionId || floorArea === null || water === null || waste === null || !establishmentType) return reply.code(400).send({ error: "organizationId, jurisdictionId, floorAreaSqm, waterConsumptionLpd, wasteGenerationKgDay and establishmentType are required", code: "BWG_PROFILE_REQUIRED" });
    if (!canActForOrganization(auth, organizationId) || auth.activeOrganizationId !== organizationId) return reply.code(403).send({ error: "Select this verified organization as the active organization", code: "ORG_FORBIDDEN" });
    try {
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        if (!await hasOrganizationPermission(client, auth, organizationId, ["profile:update", "waste:record"])) return { denied: "BWG_PROFILE_FORBIDDEN" as const };
        const geography = await client.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok", [auth.identityId, organizationId, jurisdictionId]);
        if (geography.rows[0]?.ok !== true) return { denied: "GEOGRAPHY_FORBIDDEN" as const };
        const applicabilityBasis = bwgProfileReviewBasis();
        const row = await client.query("insert into bwg_profiles (organization_id,jurisdiction_id,floor_area_sqm,water_consumption_lpd,waste_generation_kg_day,establishment_type,applicability_status,applicability_basis,status,updated_at) values ($1,$2,$3,$4,$5,$6,'REVIEW_REQUIRED',$7,'PENDING',now()) on conflict (organization_id) do update set jurisdiction_id=excluded.jurisdiction_id,floor_area_sqm=excluded.floor_area_sqm,water_consumption_lpd=excluded.water_consumption_lpd,waste_generation_kg_day=excluded.waste_generation_kg_day,establishment_type=excluded.establishment_type,applicability_status='REVIEW_REQUIRED',applicability_basis=excluded.applicability_basis,status='PENDING',updated_at=now() returning *", [organizationId, jurisdictionId, floorArea, water, waste, establishmentType, JSON.stringify(applicabilityBasis)]);
        return { profile: row.rows[0] };
      });
      if ("denied" in tenantResponse) return reply.code(403).send({ error: tenantResponse.denied === "GEOGRAPHY_FORBIDDEN" ? "Jurisdiction is outside organization authorization scope" : "Profile update and waste recording permissions are required", code: tenantResponse.denied });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, statutoryBoundary: "PROFILE_INTAKE_ONLY_NOT_A_STATUTORY_DETERMINATION", profile: tenantResponse.profile });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG profile unavailable", code: "BWG_PROFILE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool || !withTenantTransaction) return;
    const body = bodyOf(request as never); const organizationId = str(body, "organizationId"); const start = str(body, "periodStart"); const end = str(body, "periodEnd"); const basis = str(body, "reportingBasis");
    if (!organizationId || !start || !end || !basis || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || start > end) return reply.code(400).send({ error: "organizationId, valid periodStart, periodEnd and reportingBasis are required", code: "BWG_PERIOD_REQUIRED" });
    if (!canActForOrganization(auth, organizationId) || auth.activeOrganizationId !== organizationId) return reply.code(403).send({ error: "Select this verified organization as the active organization", code: "ORG_FORBIDDEN" });
    try {
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        if (!await hasOrganizationPermission(client, auth, organizationId, ["reports:read", "waste:record"])) return { denied: true as const };
        const row = await client.query("insert into bwg_reporting_periods (organization_id,period_start,period_end,reporting_basis) values ($1,$2,$3,$4) on conflict (organization_id,period_start,period_end,reporting_basis) do update set reporting_basis=excluded.reporting_basis returning *", [organizationId,start,end,basis]);
        return { period: row.rows[0] };
      });
      if ("denied" in tenantResponse) return reply.code(403).send({ error: "Reporting and waste recording permissions are required", code: "BWG_PERIOD_FORBIDDEN" });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, period: tenantResponse.period });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG reporting period unavailable", code: "BWG_PERIOD_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/waste", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool || !withTenantTransaction) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const wasteStream = str(body, "wasteStream"); const unit = str(body, "unit");
    const generated = nonNegative(body, "generatedQuantity"); const segregated = nonNegative(body, "segregatedQuantity") ?? 0; const channelized = nonNegative(body, "channelizedQuantity") ?? 0; const processed = nonNegative(body, "processedQuantity") ?? 0;
    if (!wasteStream || !unit || generated === null || segregated > generated || channelized > generated || processed > channelized) return reply.code(400).send({ error: "wasteStream, unit, generatedQuantity and valid segregated/channelized/processed quantities are required", code: "BWG_WASTE_REQUIRED" });
    const activeOrganizationId = auth.activeOrganizationId;
    if (!activeOrganizationId || !canActForOrganization(auth, activeOrganizationId)) return reply.code(403).send({ error: "Select a verified active organization", code: "ORG_FORBIDDEN" });
    try {
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        const period = await client.query<{ organization_id: string }>("select organization_id from bwg_reporting_periods where id=$1 and organization_id=$2 for update", [periodId, activeOrganizationId]);
        if (!period.rows[0]) return { missing: true as const };
        if (!await hasOrganizationPermission(client, auth, activeOrganizationId, ["waste:record"])) return { denied: true as const };
        const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId");
        if (verificationId && !evidenceId) return { invalid: "VERIFICATION_INVALID" as const };
        if (evidenceId && !await evidenceIsVerified(client, evidenceId, activeOrganizationId)) return { invalid: "EVIDENCE_NOT_VERIFIED" as const };
        if (evidenceId && verificationId) {
          const v = await client.query("select 1 from verifications v join evidence e on e.id=v.evidence_id join activities a on a.id=e.activity_id where v.id=$1 and v.evidence_id=$2 and v.decision='APPROVED' and a.organization_id=$3 and e.status='VERIFIED' and organization_has_geography_scope(a.organization_id,a.geography_id)", [verificationId,evidenceId,activeOrganizationId]);
          if (!v.rows[0]) return { invalid: "VERIFICATION_INVALID" as const };
        }
        const row = await client.query("insert into bwg_waste_reports (reporting_period_id,waste_stream,generated_quantity,segregated_quantity,channelized_quantity,processed_quantity,unit,evidence_id,verification_id,status,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *", [periodId,wasteStream,generated,segregated,channelized,processed,unit,evidenceId,verificationId,evidenceId && verificationId ? 'VERIFIED' : 'PENDING',body.metadata ?? {}]);
        return { report: row.rows[0] };
      });
      if ("missing" in tenantResponse) return reply.code(404).send({ error: "BWG reporting period not found" });
      if ("denied" in tenantResponse) return reply.code(403).send({ error: "Waste recording permission required", code: "BWG_WASTE_FORBIDDEN" });
      if ("invalid" in tenantResponse) return reply.code(409).send({ error: tenantResponse.invalid === "EVIDENCE_NOT_VERIFIED" ? "Verified, provenance-backed evidence is required" : "Approved verification is required", code: tenantResponse.invalid });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, wasteReport: tenantResponse.report });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG waste report unavailable", code: "BWG_WASTE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/epr", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool || !withTenantTransaction) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const schemeId = str(body, "schemeId"); const categoryCode = str(body, "categoryCode"); const obligated = nonNegative(body, "obligatedQuantity"); const fulfilled = nonNegative(body, "fulfilledQuantity");
    const quantityError = bwgEprQuantityError(obligated, fulfilled);
    if (!schemeId || !categoryCode || quantityError === "BWG_EPR_REQUIRED") return reply.code(400).send({ error: "schemeId, categoryCode and non-negative obligated/fulfilled quantities are required", code: "BWG_EPR_REQUIRED" });
    if (quantityError === "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED") return reply.code(400).send({ error: "Fulfilled quantity cannot exceed obligated quantity", code: quantityError });
    const activeOrganizationId = auth.activeOrganizationId;
    if (!activeOrganizationId || !canActForOrganization(auth, activeOrganizationId)) return reply.code(403).send({ error: "Select a verified active organization", code: "ORG_FORBIDDEN" });
    try {
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        const period = await client.query<{ organization_id: string }>("select organization_id from bwg_reporting_periods where id=$1 and organization_id=$2 for update", [periodId, activeOrganizationId]);
        if (!period.rows[0]) return { missing: true as const };
        if (!await hasOrganizationPermission(client, auth, activeOrganizationId, ["epr:manage"])) return { denied: true as const };
        const scheme = await client.query("select id from epr_schemes where id=$1 and status='VERIFIED'", [schemeId]);
        if (!scheme.rows[0]) return { invalid: "EPR_SCHEME_INVALID" as const };
        const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId");
        if (verificationId && !evidenceId) return { invalid: "VERIFICATION_INVALID" as const };
        if (evidenceId && !await evidenceIsVerified(client, evidenceId, activeOrganizationId)) return { invalid: "EVIDENCE_NOT_VERIFIED" as const };
        if (evidenceId && verificationId) {
          const v = await client.query("select 1 from verifications v join evidence e on e.id=v.evidence_id join activities a on a.id=e.activity_id where v.id=$1 and v.evidence_id=$2 and v.decision='APPROVED' and a.organization_id=$3 and e.status='VERIFIED' and organization_has_geography_scope(a.organization_id,a.geography_id)", [verificationId,evidenceId,activeOrganizationId]);
          if (!v.rows[0]) return { invalid: "VERIFICATION_INVALID" as const };
        }
        const row = await client.query("insert into bwg_epr_reports (reporting_period_id,scheme_id,category_code,obligated_quantity,fulfilled_quantity,evidence_id,verification_id,status,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [periodId,schemeId,categoryCode,obligated,fulfilled,evidenceId,verificationId,evidenceId && verificationId ? 'VERIFIED' : 'PENDING',body.metadata ?? {}]);
        return { report: row.rows[0] };
      });
      if ("missing" in tenantResponse) return reply.code(404).send({ error: "BWG reporting period not found" });
      if ("denied" in tenantResponse) return reply.code(403).send({ error: "EPR management permission required", code: "BWG_EPR_FORBIDDEN" });
      if ("invalid" in tenantResponse) return reply.code(tenantResponse.invalid === "EPR_SCHEME_INVALID" ? 404 : 409).send({ error: tenantResponse.invalid === "EPR_SCHEME_INVALID" ? "Authoritative EPR scheme not found" : tenantResponse.invalid === "EVIDENCE_NOT_VERIFIED" ? "Verified, provenance-backed evidence is required" : "Approved verification is required", code: tenantResponse.invalid });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, externalSubmission: "NOT_SUBMITTED", eprReport: tenantResponse.report });
    } catch (error) {
      if (isBwgEprFulfilledObligationConstraintViolation(error)) return reply.code(409).send({ error: "Fulfilled quantity cannot exceed obligated quantity", code: "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED" });
      request.log.error(error);
      return reply.code(503).send({ error: "BWG EPR report unavailable", code: "BWG_EPR_UNAVAILABLE", syntheticData: false });
    }
  });

  app.post("/api/v1/bwg/reporting-periods/:periodId/esg", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool || !withTenantTransaction) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never); const metricCode = str(body, "metricCode"); const scope = str(body, "scope"); const unit = str(body, "unit"); const value = nonNegative(body, "value");
    if (!metricCode || !scope || !unit || value === null) return reply.code(400).send({ error: "metricCode, scope, unit and non-negative value are required", code: "BWG_ESG_REQUIRED" });
    const activeOrganizationId = auth.activeOrganizationId;
    if (!activeOrganizationId || !canActForOrganization(auth, activeOrganizationId)) return reply.code(403).send({ error: "Select a verified active organization", code: "ORG_FORBIDDEN" });
    try {
      const tenantResponse = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        const period = await client.query<{ organization_id: string }>("select organization_id from bwg_reporting_periods where id=$1 and organization_id=$2 for update", [periodId, activeOrganizationId]);
        if (!period.rows[0]) return { missing: true as const };
        if (!await hasValuePermission(client, "can_write_esg", auth.identityId, activeOrganizationId)) return { denied: true as const };
        const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId");
        if (verificationId && !evidenceId) return { invalid: "VERIFICATION_INVALID" as const };
        if (evidenceId && !await evidenceIsVerified(client, evidenceId, activeOrganizationId)) return { invalid: "EVIDENCE_NOT_VERIFIED" as const };
        if (evidenceId && verificationId) {
          const v = await client.query("select 1 from verifications v join evidence e on e.id=v.evidence_id join activities a on a.id=e.activity_id where v.id=$1 and v.evidence_id=$2 and v.decision='APPROVED' and a.organization_id=$3 and e.status='VERIFIED' and organization_has_geography_scope(a.organization_id,a.geography_id)", [verificationId,evidenceId,activeOrganizationId]);
          if (!v.rows[0]) return { invalid: "VERIFICATION_INVALID" as const };
        }
        const row = await client.query("insert into bwg_esg_reports (reporting_period_id,metric_code,scope,value,unit,evidence_id,verification_id,status,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [periodId,metricCode,scope,value,unit,evidenceId,verificationId,evidenceId && verificationId ? 'VERIFIED' : 'PENDING',body.metadata ?? {}]);
        return { report: row.rows[0] };
      });
      if ("missing" in tenantResponse) return reply.code(404).send({ error: "BWG reporting period not found" });
      if ("denied" in tenantResponse) return reply.code(403).send({ error: "ESG metric write permission required", code: "BWG_ESG_FORBIDDEN" });
      if ("invalid" in tenantResponse) return reply.code(409).send({ error: tenantResponse.invalid === "EVIDENCE_NOT_VERIFIED" ? "Verified, provenance-backed evidence is required" : "Approved verification is required", code: tenantResponse.invalid });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, esgReport: tenantResponse.report });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG ESG report unavailable", code: "BWG_ESG_UNAVAILABLE", syntheticData: false }); }
  });
}
