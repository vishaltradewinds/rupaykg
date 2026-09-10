import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, canVerifyEvidence, type AuthContext } from "./auth.js";

async function requireAuth(app: FastifyInstance, pool: Pool | null, request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); return null; }
}
function orgIds(auth: AuthContext): string[] {
  if (auth.activeOrganizationId) return [auth.activeOrganizationId];
  return [...new Set(auth.memberships.map((m) => m.organization_id))];
}
function result<T>(data: T) { return { source: "postgresql", syntheticData: false, data }; }
function requestedGeography(request: { query: unknown }): string | null { const q = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {}; return typeof q.geographyId === "string" && q.geographyId.trim() ? q.geographyId.trim() : null; }
async function authorizeGeography(pool: Pool, auth: AuthContext, geographyId: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(geographyId)) return false;
  const check = await pool.query<{ ok: boolean }>(`select exists (select 1 from organization_memberships om where om.identity_id=$1 and om.status='VERIFIED' and ($3::uuid is null or om.organization_id=$3::uuid) and organization_has_geography_scope(om.organization_id,$2)) as ok`, [auth.identityId, geographyId, auth.activeOrganizationId ?? null]);
  return check.rows[0]?.ok === true;
}
function geoClause(geographyId: string | null, column: string): string { return geographyId ? ` and ${column} = $2` : ""; }

export async function registerWorkspaceRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/workspaces/resource-flows", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return; const ids = orgIds(auth); if (!ids.length) return result({ resourceFlows: [] });
    const geographyId = requestedGeography(request); if (geographyId && !await authorizeGeography(pool, auth, geographyId)) return reply.code(403).send({ error: "Geography outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    try { const params: unknown[]=[ids]; if(geographyId)params.push(geographyId); const rows=await pool.query(`select rf.id, rf.organization_id, o.name as organization_name, rf.origin_type, rf.resource_form, rf.material_code, rf.declared_quantity, rf.unit, rf.status, rf.source_geography_id, sg.name as source_geography_name, rf.destination_geography_id, dg.name as destination_geography_name, rf.created_at from resource_flows rf join organizations o on o.id=rf.organization_id left join geography sg on sg.id=rf.source_geography_id left join geography dg on dg.id=rf.destination_geography_id where rf.organization_id=any($1::uuid[]) and (organization_has_geography_scope(rf.organization_id, rf.source_geography_id) or organization_has_geography_scope(rf.organization_id, rf.destination_geography_id))${geographyId?" and (rf.source_geography_id=$2 or rf.destination_geography_id=$2)":""} order by rf.created_at desc limit 100`,params); return result({resourceFlows:rows.rows}); } catch(error){request.log.error(error);return reply.code(503).send({error:"Resource-flow workspace unavailable",syntheticData:false});}
  });

  app.get("/api/v1/workspaces/mrv", async (request, reply) => {
    const auth=await requireAuth(app,pool,request,reply);if(!auth||!pool)return;const ids=orgIds(auth);if(!ids.length)return result({activities:[],measurements:[],evidence:[],verifications:[]});const geographyId=requestedGeography(request);if(geographyId&&!await authorizeGeography(pool,auth,geographyId))return reply.code(403).send({error:"Geography outside organization authorization scope",code:"GEOGRAPHY_FORBIDDEN"});
    try{const params:unknown[]=[ids];if(geographyId)params.push(geographyId);const clause=geoClause(geographyId,"a.geography_id");const scopeClause=" and organization_has_geography_scope(a.organization_id,a.geography_id)";const [activities,measurements,evidence,verifications]=await Promise.all([
      pool.query(`select a.id,a.activity_type,a.status,a.occurred_at,a.created_at,a.geography_id,g.name as geography_name from activities a left join geography g on g.id=a.geography_id where a.organization_id=any($1::uuid[])${scopeClause}${clause} order by a.created_at desc limit 100`,params),
      pool.query(`select m.id,m.activity_id,m.value,m.unit,m.method,m.source,m.measured_at,m.quality_status from measurements m join activities a on a.id=m.activity_id where a.organization_id=any($1::uuid[])${scopeClause}${clause} order by m.measured_at desc limit 100`,params),
      pool.query(`select e.id,e.activity_id,e.measurement_id,e.evidence_type,e.status,e.captured_at,e.content_uri,e.content_hash from evidence e join activities a on a.id=e.activity_id where a.organization_id=any($1::uuid[])${scopeClause}${clause} order by e.captured_at desc limit 100`,params),
      pool.query(`select v.id,v.evidence_id,v.activity_id,v.verifier_identity_id,v.decision,v.scope,v.rationale,v.decided_at from verifications v join evidence e on e.id=v.evidence_id join activities a on a.id=e.activity_id where a.organization_id=any($1::uuid[])${scopeClause}${clause} order by v.decided_at desc limit 100`,params)]);return result({activities:activities.rows,measurements:measurements.rows,evidence:evidence.rows,verifications:verifications.rows});} catch(error){request.log.error(error);return reply.code(503).send({error:"MRV workspace unavailable",syntheticData:false});}
  });

  app.post("/api/v1/evidence/:evidenceId/verification", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Evidence verification unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const { evidenceId } = request.params as { evidenceId: string };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceId)) return reply.code(400).send({ error: "evidenceId must be a UUID", code: "INVALID_EVIDENCE_ID" });
    const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
    const decision = typeof body.decision === "string" ? body.decision.trim().toUpperCase() : "";
    const scope = typeof body.scope === "string" ? body.scope.trim() : "";
    if (decision !== "APPROVED" || !scope) return reply.code(400).send({ error: "decision=APPROVED and scope are required", code: "INVALID_VERIFICATION" });
    const client = await pool.connect();
    try { await client.query("BEGIN"); const evidence = await client.query<{ activity_id: string }>("select activity_id from evidence where id=$1 for update", [evidenceId]); const activityId = evidence.rows[0]?.activity_id; if (!activityId) { await client.query("ROLLBACK"); return reply.code(404).send({ error: "Evidence not found", code: "EVIDENCE_NOT_FOUND" }); } const authorized = await canVerifyEvidence(client, auth.identityId, evidenceId); if (!authorized || (auth.activeOrganizationId && !await canActForActiveOrganization(client, auth, activityId))) { await client.query("ROLLBACK"); return reply.code(403).send({ error: "Explicit verification permission required", code: "VERIFY_EVIDENCE_FORBIDDEN" }); }
      const inserted = await client.query<{ id: string; evidence_id: string; activity_id: string; verifier_identity_id: string; decision: string; scope: string; decided_at: string }>("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,$4,$5) returning id,evidence_id,activity_id,verifier_identity_id,decision,scope,decided_at", [evidenceId, activityId, auth.identityId, decision, scope]); await client.query("update evidence set status='VERIFIED' where id=$1", [evidenceId]); await client.query("COMMIT"); return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, verification: inserted.rows[0] });
    } catch (error) { await client.query("ROLLBACK"); request.log.error(error); return reply.code(503).send({ error: "Evidence verification unavailable", code: "VERIFICATION_UNAVAILABLE", syntheticData: false }); } finally { client.release(); }
  });
}

async function canActForActiveOrganization(client: import("pg").PoolClient, auth: AuthContext, activityId: string): Promise<boolean> {
  if (!auth.activeOrganizationId) return true;
  const result = await client.query<{ ok: boolean }>("select exists(select 1 from activities where id=$1 and organization_id=$2) as ok", [activityId, auth.activeOrganizationId]);
  return result.rows[0]?.ok === true;
}
