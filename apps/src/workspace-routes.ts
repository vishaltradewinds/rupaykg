import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, canVerifyEvidence, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { withTenantTransaction } from "./tenant-db.js";

async function requireAuth(app: FastifyInstance, pool: Pool | null, request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); return null; }
}
function orgIds(auth: AuthContext): string[] { return auth.activeOrganizationId ? [auth.activeOrganizationId] : [...new Set(auth.memberships.map((m) => m.organization_id))]; }
function result<T>(data: T) { return { source: "postgresql", syntheticData: false, data }; }
function requestedGeography(request: { query: unknown }): string | null { const q = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {}; return typeof q.geographyId === "string" && q.geographyId.trim() ? q.geographyId.trim() : null; }
export type OperatingContextRail = "urban" | "rural";
export function operatingContextGeographyKinds(context: OperatingContextRail): readonly string[] {
  return context === "urban" ? ["ULB", "WARD"] : ["GRAM_PANCHAYAT", "VILLAGE", "CLUSTER"];
}
export function operatingContextSqlClause(context: OperatingContextRail | undefined, parameterIndex: number): string {
  if (!context) return "";
  if (!Number.isInteger(parameterIndex) || parameterIndex < 2) throw new RangeError("Context SQL parameter index must be an integer >= 2");
  return " and exists (select 1 from geography context_geo where context_geo.id=a.geography_id and context_geo.kind::text = any($" + parameterIndex + "::text[]))";
}
function requestedOperatingContext(request: { query: unknown }): { context?: OperatingContextRail; invalid: boolean } {
  const q = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {};
  const raw = q.context;
  if (raw === undefined || raw === null || raw === "") return { invalid: false };
  if (raw === "urban" || raw === "rural") return { context: raw, invalid: false };
  return { invalid: true };
}
async function authorizeGeography(pool: Pool, auth: AuthContext, geographyId: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(geographyId)) return false;
  const check = await pool.query<{ ok: boolean }>(`select exists (select 1 from organization_memberships om where om.identity_id=$1 and om.status='VERIFIED' and ($3::uuid is null or om.organization_id=$3::uuid) and organization_has_geography_scope(om.organization_id,$2)) as ok`, [auth.identityId, geographyId, auth.activeOrganizationId ?? null]);
  return check.rows[0]?.ok === true;
}
function geoClause(geographyId: string | null, column: string): string { return geographyId ? ` and ${column} = $2` : ""; }

type WorkspaceName = "resourceFlows" | "mrv" | "compliance" | "carbon" | "registry" | "settlement" | "esg";
const WORKSPACE_READ_PERMISSIONS: Record<WorkspaceName, readonly string[]> = {
  resourceFlows: ["waste:read"], mrv: ["evidence:upload", "evidence:review", "guardian:read"], compliance: ["reports:read", "swm:read", "epr:read", "audit:read"], carbon: ["reports:read", "credits:read", "projects:read"], registry: ["registry:read", "credits:read"], settlement: ["credits:read", "settlement:authorize", "settlement:settle", "AUTHORIZE_SETTLEMENT", "SETTLE_FUNDS"], esg: ["reports:read", "epr:read", "csr:read", "audit:read"],
};
async function authorizeWorkspaceRead(pool: Pool, auth: AuthContext, workspace: WorkspaceName): Promise<boolean> {
  const organizations = orgIds(auth); if (!organizations.length) return false;
  const permissions = WORKSPACE_READ_PERMISSIONS[workspace];
  for (const organizationId of organizations) if (!await hasOrganizationPermission(pool, auth, organizationId, permissions)) return false;
  return true;
}

export async function registerWorkspaceRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    const route = request.routeOptions.url ?? ""; if (!route.startsWith("/api/v1/workspaces/")) return;
    const routeWorkspace = route.split("/").pop() ?? ""; const workspace = routeWorkspace === "resource-flows" ? "resourceFlows" : routeWorkspace as WorkspaceName;
    if (!(workspace in WORKSPACE_READ_PERMISSIONS)) return; const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    if (!await authorizeWorkspaceRead(pool, auth, workspace)) return reply.code(403).send({ error: "Workspace read permission required", code: "WORKSPACE_READ_FORBIDDEN", workspace });
  });

  app.get("/api/v1/workspaces/resource-flows", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return; const ids = orgIds(auth); if (!ids.length) return result({ resourceFlows: [] });
    const geographyId = requestedGeography(request); if (geographyId && !await authorizeGeography(pool, auth, geographyId)) return reply.code(403).send({ error: "Geography outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    try { return await withTenantTransaction(pool, auth, async client => { const params: unknown[]=[ids]; if(geographyId)params.push(geographyId); const rows=await client.query(`select rf.id,rf.organization_id,o.name as organization_name,rf.origin_type,rf.resource_form,rf.material_code,rf.declared_quantity,rf.unit,rf.status,rf.source_geography_id,sg.name as source_geography_name,rf.destination_geography_id,dg.name as destination_geography_name,rf.created_at from resource_flows rf join organizations o on o.id=rf.organization_id left join geography sg on sg.id=rf.source_geography_id left join geography dg on dg.id=rf.destination_geography_id where rf.organization_id=any($1::uuid[]) and (organization_has_geography_scope(rf.organization_id,rf.source_geography_id) or organization_has_geography_scope(rf.organization_id,rf.destination_geography_id))${geographyId?" and (rf.source_geography_id=$2 or rf.destination_geography_id=$2)":""} order by rf.created_at desc limit 100`,params); return result({resourceFlows:rows.rows}); }); } catch(error){request.log.error(error);return reply.code(503).send({error:"Resource-flow workspace unavailable",syntheticData:false});}
  });

  app.get("/api/v1/workspaces/mrv", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ activities: [], measurements: [], evidence: [], verifications: [] });
    const geographyId = requestedGeography(request);
    if (geographyId && !await authorizeGeography(pool, auth, geographyId)) return reply.code(403).send({ error: "Geography outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    const contextRequest = requestedOperatingContext(request);
    if (contextRequest.invalid) return reply.code(400).send({ error: "Context must be urban or rural", code: "INVALID_OPERATING_CONTEXT", syntheticData: false });
    try { return await withTenantTransaction(pool, auth, async client => {
      const params: unknown[] = [ids];
      if (geographyId) params.push(geographyId);
      if (contextRequest.context) params.push(operatingContextGeographyKinds(contextRequest.context));
      const geographyClause = geoClause(geographyId, "a.geography_id");
      const contextClause = operatingContextSqlClause(contextRequest.context, params.length);
      const scopeClause = " and organization_has_geography_scope(a.organization_id,a.geography_id)";
      const [activities, measurements, evidence, verifications] = await Promise.all([
        client.query(`select a.id,a.activity_type,a.status,a.occurred_at,a.created_at,a.geography_id,g.name as geography_name,g.kind::text as geography_kind from activities a left join geography g on g.id=a.geography_id where a.organization_id=any($1::uuid[])${scopeClause}${geographyClause}${contextClause} order by a.created_at desc limit 100`, params),
        client.query(`select m.id,m.activity_id,m.value,m.unit,m.method,m.source,m.measured_at,m.quality_status from measurements m join activities a on a.id=m.activity_id where a.organization_id=any($1::uuid[])${scopeClause}${geographyClause}${contextClause} order by m.measured_at desc limit 100`, params),
        client.query(`select e.id,e.activity_id,e.measurement_id,e.evidence_type,e.status,e.captured_at,e.content_uri,e.content_hash from evidence e join activities a on a.id=e.activity_id where a.organization_id=any($1::uuid[])${scopeClause}${geographyClause}${contextClause} order by e.captured_at desc limit 100`, params),
        client.query(`select v.id,v.evidence_id,v.activity_id,v.verifier_identity_id,v.decision,v.scope,v.rationale,v.decided_at from verifications v join evidence e on e.id=v.evidence_id join activities a on a.id=e.activity_id where a.organization_id=any($1::uuid[])${scopeClause}${geographyClause}${contextClause} order by v.decided_at desc limit 100`, params),
      ]);
      return result({ activities: activities.rows, measurements: measurements.rows, evidence: evidence.rows, verifications: verifications.rows, ...(contextRequest.context ? { operatingContext: contextRequest.context, geographyKinds: operatingContextGeographyKinds(contextRequest.context) } : {}) });
      });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV workspace unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/evidence/:evidenceId/verification", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply);
    if (!auth || !pool) return;
    const { evidenceId } = request.params as { evidenceId: string };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceId)) return reply.code(400).send({ error: "evidenceId must be a UUID", code: "INVALID_EVIDENCE_ID" });
    const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
    const decision = typeof body.decision === "string" ? body.decision.trim().toUpperCase() : "";
    const scope = typeof body.scope === "string" ? body.scope.trim() : "";
    const rationale = typeof body.rationale === "string" ? body.rationale.trim() : "";
    if ((decision !== "APPROVED" && decision !== "REJECTED") || !scope || scope.length > 100 || rationale.length < 5 || rationale.length > 2000) return reply.code(400).send({ error: "decision, scope and 5–2000 character rationale are required", code: "INVALID_VERIFICATION" });
    try {
      return await withTenantTransaction(pool, auth, async client => {
        const q = await client.query<{ activity_id: string; organization_id: string; geography_id: string | null; actor_identity_id: string; captured_by_identity_id: string | null; status: string }>(
          "select e.activity_id,a.organization_id,a.geography_id,a.actor_identity_id,e.captured_by_identity_id,e.status::text status from evidence e join activities a on a.id=e.activity_id where e.id=$1 for update of e",
          [evidenceId],
        );
        const row = q.rows[0];
        if (!row) return reply.code(404).send({ error: "Evidence not found", code: "EVIDENCE_NOT_FOUND" });
        if (!row.geography_id || !canActForOrganization(auth, row.organization_id)) return reply.code(404).send({ error: "Evidence not found", code: "EVIDENCE_NOT_FOUND" });
        const geography = await client.query<{ ok: boolean }>("select organization_has_geography_scope($1::uuid,$2::uuid) as ok", [row.organization_id, row.geography_id]);
        if (!geography.rows[0]?.ok) return reply.code(403).send({ error: "Evidence geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
        if (row.actor_identity_id === auth.identityId || row.captured_by_identity_id === auth.identityId) return reply.code(403).send({ error: "Evidence creator cannot verify its own evidence", code: "EVIDENCE_SELF_REVIEW_FORBIDDEN" });
        const permissions = ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"];
        if (!await hasOrganizationPermission(client, auth, row.organization_id, permissions) || !await canVerifyEvidence(client, auth.identityId, evidenceId)) return reply.code(403).send({ error: "Explicit verification permission required", code: "VERIFY_EVIDENCE_FORBIDDEN" });
        if (row.status !== "CAPTURED") return reply.code(409).send({ error: "Only captured evidence can be verified; reviewed evidence is immutable", code: "EVIDENCE_ALREADY_REVIEWED" });
        const inserted = await client.query<{ id: string }>(
          "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,$4,$5,$6) returning id",
          [evidenceId, row.activity_id, auth.identityId, decision, scope, rationale],
        );
        const verificationId = inserted.rows[0]?.id;
        if (!verificationId) throw new Error("Evidence verification was not recorded");
        const status = decision === "APPROVED" ? "VERIFIED" : "REJECTED";
        await client.query("update evidence set status=$2 where id=$1", [evidenceId, status]);
        return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, verification: { id: verificationId, evidenceId, activityId: row.activity_id, verifierIdentityId: auth.identityId, decision, scope, status } });
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Evidence verification unavailable", code: "VERIFICATION_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/workspaces/compliance", async (request, reply) => {
    const auth=await requireAuth(app,pool,request,reply);if(!auth||!pool)return;const ids=orgIds(auth);if(!ids.length)return result({obligations:[]});const geographyId=requestedGeography(request);if(geographyId&&!await authorizeGeography(pool,auth,geographyId))return reply.code(403).send({error:"Geography outside organization authorization scope",code:"GEOGRAPHY_FORBIDDEN"});
    try { return await withTenantTransaction(pool, auth, async client => {const params:unknown[]=[ids];if(geographyId)params.push(geographyId);const clause=geoClause(geographyId,"ob.jurisdiction_id");const rows=await client.query(`select ob.id,ob.organization_id,o.name as organization_name,ob.jurisdiction_id,g.name as jurisdiction_name,ob.obligation_type,ob.period_start,ob.period_end,ob.required_quantity,ob.status from obligations ob join organizations o on o.id=ob.organization_id left join geography g on g.id=ob.jurisdiction_id where ob.organization_id=any($1::uuid[]) and organization_has_geography_scope(ob.organization_id,ob.jurisdiction_id)${clause} order by ob.period_end desc limit 100`,params);return result({obligations:rows.rows});}); }catch(error){request.log.error(error);return reply.code(503).send({error:"Compliance workspace unavailable",syntheticData:false});}
  });

  app.get("/api/v1/workspaces/carbon", async (request, reply) => {
    const auth=await requireAuth(app,pool,request,reply);if(!auth||!pool)return;const ids=orgIds(auth);if(!ids.length)return result({calculations:[]});const geographyId=requestedGeography(request);if(geographyId&&!await authorizeGeography(pool,auth,geographyId))return reply.code(403).send({error:"Geography outside organization authorization scope",code:"GEOGRAPHY_FORBIDDEN"});
    try { return await withTenantTransaction(pool, auth, async client => {const params:unknown[]=[ids];if(geographyId)params.push(geographyId);const rows=await client.query(`select cc.id,cc.activity_id,cc.methodology_version_id,mv.methodology_code,mv.version as methodology_version,mv.governance_status,cc.inputs,cc.result,cc.unit,cc.status,cc.calculated_at,cc.dataset_hash,cc.formula_hash,cc.calculation_hash,cc.provenance_version,cc.calculation_trace from carbon_calculations cc join activities a on a.id=cc.activity_id join methodology_versions mv on mv.id=cc.methodology_version_id where a.organization_id=any($1::uuid[]) and organization_has_geography_scope(a.organization_id,a.geography_id)${geoClause(geographyId,"a.geography_id")} order by cc.calculated_at desc nulls last,cc.id desc limit 100`,params);return result({calculations:rows.rows});}); }catch(error){request.log.error(error);return reply.code(503).send({error:"Carbon workspace unavailable",syntheticData:false});}
  });

  app.get("/api/v1/workspaces/registry", async (request, reply) => {
    const auth=await requireAuth(app,pool,request,reply);if(!auth||!pool)return;const ids=orgIds(auth);if(!ids.length)return result({credentials:[],events:[]});const geographyId=requestedGeography(request);if(geographyId&&!await authorizeGeography(pool,auth,geographyId))return reply.code(403).send({error:"Geography outside organization authorization scope",code:"GEOGRAPHY_FORBIDDEN"});
    try { return await withTenantTransaction(pool, auth, async client => {const params:unknown[]=[ids];if(geographyId)params.push(geographyId);const clause=geoClause(geographyId,"a.geography_id");const scopeClause=" and organization_has_geography_scope(a.organization_id,a.geography_id)";const [credentials,events]=await Promise.all([client.query(`select c.id,c.activity_id,c.issuer_organization_id,o.name as issuer_name,c.trust_root_id,c.status,c.credential_uri,c.issued_at from credentials c join organizations o on o.id=c.issuer_organization_id join activities a on a.id=c.activity_id left join lateral (select re.to_owner_id as current_owner_id from registry_events re where re.credential_id=c.id and re.event_type in('ISSUED','TRANSFERRED') order by re.created_at desc limit 1) current_owner on true where (c.issuer_organization_id=any($1::uuid[]) or current_owner.current_owner_id=any($1::uuid[]))${scopeClause}${clause} order by c.issued_at desc nulls last,c.id desc limit 100`,params),client.query(`select re.id,re.credential_id,re.event_type,re.from_owner_id,fo.name as from_owner_name,re.to_owner_id,too.name as to_owner_name,re.external_reference,re.event_hash,re.created_at from registry_events re left join organizations fo on fo.id=re.from_owner_id left join organizations too on too.id=re.to_owner_id join credentials c on c.id=re.credential_id join activities a on a.id=c.activity_id left join lateral (select re2.to_owner_id as current_owner_id from registry_events re2 where re2.credential_id=c.id and re2.event_type in('ISSUED','TRANSFERRED') order by re2.created_at desc limit 1) current_owner on true where (c.issuer_organization_id=any($1::uuid[]) or current_owner.current_owner_id=any($1::uuid[]))${scopeClause}${clause} order by re.created_at desc limit 200`,params)]);return result({credentials:credentials.rows,events:events.rows});}); }catch(error){request.log.error(error);return reply.code(503).send({error:"Registry workspace unavailable",syntheticData:false});}
  });

  app.get("/api/v1/workspaces/settlement", async (request, reply) => {
    const auth=await requireAuth(app,pool,request,reply);if(!auth||!pool)return;const ids=orgIds(auth);if(!ids.length)return result({settlements:[]});const geographyId=requestedGeography(request);if(geographyId&&!await authorizeGeography(pool,auth,geographyId))return reply.code(403).send({error:"Geography outside organization authorization scope",code:"GEOGRAPHY_FORBIDDEN"});
    try { return await withTenantTransaction(pool, auth, async client => {const params:unknown[]=[ids];if(geographyId)params.push(geographyId);const rows=await client.query(`select s.id,s.obligation_id,s.credential_id,s.payer_id,p.name as payer_name,s.payee_id,py.name as payee_name,s.amount,s.currency,s.status,s.external_reference,s.created_at,s.settled_at from settlements s left join organizations p on p.id=s.payer_id left join organizations py on py.id=s.payee_id left join credentials c on c.id=s.credential_id left join activities a on a.id=c.activity_id where (s.payer_id=any($1::uuid[]) or s.payee_id=any($1::uuid[])) and organization_has_geography_scope(a.organization_id,a.geography_id)${geoClause(geographyId,"a.geography_id")} order by s.created_at desc limit 100`,params);return result({settlements:rows.rows});}); }catch(error){request.log.error(error);return reply.code(503).send({error:"Settlement workspace unavailable",syntheticData:false});}
  });

  app.get("/api/v1/workspaces/esg", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ reportingPeriods: [], metrics: [] });
    try { return await withTenantTransaction(pool, auth, async client => {
      const periods = await client.query(`select id,organization_id,period_start,period_end,framework,status,reporting_standard,applicability_status,value_chain_reporting,assurance_mode,external_submission_status,methodology_notes,reporting_boundary from esg_reporting_periods where organization_id=any($1::uuid[]) order by period_end desc,period_start desc limit 100`, [ids]);
      const metrics = await client.query(`select em.id,em.reporting_period_id,em.metric_code,em.scope,em.value,em.unit,em.source_activity_id,em.evidence_id,em.verification_id,em.status,em.metadata,em.disclosure_id,em.esg_attribute,em.value_chain_direction,em.methodology,em.assumptions,em.reporting_boundary,em.data_quality,em.assurance_status from esg_metrics em join esg_reporting_periods rp on rp.id=em.reporting_period_id where rp.organization_id=any($1::uuid[]) order by em.id desc limit 200`, [ids]);
      return result({ reportingPeriods: periods.rows, metrics: metrics.rows });
    }); } catch (error) { request.log.error(error); return reply.code(503).send({ error: "ESG workspace unavailable", syntheticData: false }); }
  });
}
