import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { authenticate, bearerChallenge, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { withDatabaseBootstrapContext, withDatabaseTenantContext } from "./db-context.js";
import { registerOnboardingHierarchyRoutes } from "./onboarding-hierarchy-routes.js";
import { registerValueRoutes } from "./value-routes.js";
import { registerRegistryRoutes } from "./registry-routes.js";
import { registerSyncRoutes } from "./sync-routes.js";
import { registerWorkspaceRoutes } from "./workspace-routes.js";
import { registerBwgRoutes } from "./bwg-routes.js";
import { registerCpcbSwmRoutes } from "./cpcb-swm-routes.js";
import { registerIntelligenceRoutes } from "./intelligence-routes.js";
import { registerMrvRoutes } from "./mrv-routes.js";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";
import { registerPlatformAdminRoutes } from "./platform-admin-routes.js";

const app = Fastify({ logger: true });
const allowedOrigins = process.env.RUPAYKG_ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()).filter(Boolean) ?? [];
await app.register(cors, { origin: allowedOrigins.length ? allowedOrigins : false });
const webRoot = resolve(process.cwd(), "apps/web/dist");
if (existsSync(webRoot)) await app.register(fastifyStatic, { root: webRoot, wildcard: false });
const databaseUrl = process.env.DATABASE_URL;
const poolConfig: PoolConfig = { connectionString: databaseUrl, max: 10 };
if (process.env.DATABASE_SSL === "require") poolConfig.ssl = { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT };
else if (process.env.DATABASE_SSL !== "false") poolConfig.ssl = { rejectUnauthorized: false };
const pool = databaseUrl ? new Pool(poolConfig) : null;
async function query<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return withDatabaseBootstrapContext(pool, async client => (await client.query<T>(text, values)).rows);
}
function bodyOf(request: { body: unknown }): Record<string, unknown> { return (request.body && typeof request.body === "object" ? request.body : {}) as Record<string, unknown>; }
function requiredString(body: Record<string, unknown>, key: string): string | null { return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null; }
function requiredPositiveNumber(body: Record<string, unknown>, key: string): number | null { const value = Number(body[key]); return Number.isFinite(value) && value > 0 ? value : null; }
async function requireAuth(request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }): Promise<AuthContext | null> { try { const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; } catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null; } }
function requireOrganization(auth: AuthContext, organizationId: string, reply: { code: (status: number) => { send: (body: unknown) => unknown } }): boolean { if (!canActForOrganization(auth, organizationId)) { reply.code(403).send({ error: "No verified membership for organization", code: "ORG_FORBIDDEN" }); return false; } return true; }
async function canReadGeography(client: PoolClient, auth: AuthContext, geographyId: string): Promise<boolean> { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(geographyId)) return false; const result = await client.query<{ ok: boolean }>(`select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$2)) as ok`, [auth.identityId, geographyId]); return result.rows[0]?.ok === true; }
async function canWriteActivity(client: PoolClient, auth: AuthContext, activityId: string): Promise<boolean> { const result = await client.query<{ organization_id: string }>(`select a.organization_id from activities a join organization_memberships om on om.organization_id=a.organization_id and om.identity_id=$2 and om.status='VERIFIED' where a.id=$1 and a.geography_id is not null and organization_has_geography_scope(om.organization_id,a.geography_id)`, [activityId, auth.identityId]); const organizationId = result.rows[0]?.organization_id; return !!organizationId && await hasOrganizationPermission(client, auth, organizationId, ['waste:record']); }
async function canWriteGeography(client: PoolClient, auth: AuthContext, organizationId: string, geographyId: string): Promise<boolean> { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(geographyId)) return false; const result = await client.query<{ ok: boolean }>(`select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok`, [auth.identityId, organizationId, geographyId]); return result.rows[0]?.ok === true; }

app.get("/health", async (_request, reply) => { let database: "AVAILABLE" | "UNAVAILABLE" = "UNAVAILABLE"; if (pool) { try { await withDatabaseBootstrapContext(pool, async client => { await client.query("select 1"); }); database = "AVAILABLE"; } catch {} } const healthy = database === "AVAILABLE"; return reply.code(healthy ? 200 : 503).send({ status: healthy ? "READY" : "DEGRADED", database, syntheticData: false }); });
app.get("/api/v1/status", async () => ({ service: "rupaykg-api", version: "0.1.0", sourceOfTruth: "postgresql", syntheticData: false }));
app.get("/api/v1/overview", async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth || !pool) return;
  const organizationId = auth.activeOrganizationId;
  if (!organizationId) return reply.code(403).send({ error: "An active organization is required for overview access", code: "ACTIVE_ORGANIZATION_REQUIRED" });
  try {
    const counts = await withDatabaseTenantContext(pool, { identityId: auth.identityId, organizationId, bilateralOrganizationScope: auth.bilateralOrganizationScope ?? false, serviceMode: false }, async (client) => {
      const permitted = async (permissions: string[]) => hasOrganizationPermission(client, auth, organizationId, permissions);
      const [operations, mrv, compliance, registry, settlement] = await Promise.all([
        permitted(["waste:read"]), permitted(["evidence:upload", "evidence:review", "guardian:read"]),
        permitted(["reports:read", "swm:read", "epr:read", "audit:read"]),
        permitted(["registry:read", "credits:read"]),
        permitted(["credits:read", "settlement:authorize", "settlement:settle", "AUTHORIZE_SETTLEMENT", "SETTLE_FUNDS"]),
      ]);
      const count = async (sql: string, identityScoped = false): Promise<number | null> => {
        const values = identityScoped ? [organizationId, auth.identityId] : [organizationId];
        const rows = await client.query<{ count: string }>(sql, values);
        return Number(rows.rows[0]?.count ?? 0);
      };
      return {
        activities: operations || mrv ? await count("select count(*)::text as count from activities a where a.organization_id=$1 and a.geography_id is not null and exists (select 1 from organization_memberships om where om.organization_id=a.organization_id and om.identity_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,a.geography_id))", true) : null,
        measurements: mrv ? await count("select count(*)::text as count from measurements m join activities a on a.id=m.activity_id where a.organization_id=$1 and a.geography_id is not null and exists (select 1 from organization_memberships om where om.organization_id=a.organization_id and om.identity_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,a.geography_id))", true) : null,
        evidence: mrv ? await count("select count(*)::text as count from evidence e join activities a on a.id=e.activity_id where a.organization_id=$1 and a.geography_id is not null and exists (select 1 from organization_memberships om where om.organization_id=a.organization_id and om.identity_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,a.geography_id))", true) : null,
        approvedVerifications: mrv ? await count("select count(*)::text as count from verifications v join activities a on a.id=v.activity_id where a.organization_id=$1 and a.geography_id is not null and exists (select 1 from organization_memberships om where om.organization_id=a.organization_id and om.identity_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,a.geography_id)) and v.decision='APPROVED'", true) : null,
        openObligations: compliance ? await count("select count(*)::text as count from obligations where organization_id=$1 and status='OPEN'") : null,
        issuedOrActiveCredentials: registry ? await count("select count(*)::text as count from credentials where issuer_organization_id=$1 and status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED')") : null,
        settledTransactions: settlement ? await count("select count(*)::text as count from settlements where (payer_id=$1 or payee_id=$1) and status='SETTLED'") : null,
      };
    });
    return { source: "postgresql", syntheticData: false, counts };
  } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authoritative overview unavailable", syntheticData: false }); }
});
app.get("/api/v1/regulatory/sources", async (_request, reply) => { try { return { source: "postgresql", syntheticData: false, sources: await query("select id, authority, title, instrument, reference, published_on, effective_from, jurisdiction, source_url, verified_on, status, affected_module, notes from regulatory_sources order by effective_from desc nulls last, published_on desc") }; } catch (error) { return reply.code(503).send({ error: "Regulatory source catalog unavailable", syntheticData: false }); } });

app.get("/api/v1/geography/roots", async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth || !pool) return;
  if (!auth.activeOrganizationId) return reply.code(403).send({ error: "An active organization is required for geography access", code: "ACTIVE_ORGANIZATION_REQUIRED" });
  try {
    const rows = await withDatabaseTenantContext(pool, { identityId: auth.identityId, organizationId: auth.activeOrganizationId, bilateralOrganizationScope: false, serviceMode: false }, async (client) => {
      const scoped = await client.query("with recursive scoped as (select g.id,g.parent_id,g.kind,g.code,g.external_code,g.name,g.source,g.source_version,g.valid_from,g.valid_to,g.metadata from geography g join organization_geography_scopes s on s.geography_id=g.id and s.status='VERIFIED' join organization_memberships om on om.organization_id=s.organization_id and om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' union select g.id,g.parent_id,g.kind,g.code,g.external_code,g.name,g.source,g.source_version,g.valid_from,g.valid_to,g.metadata from geography g join scoped p on g.parent_id=p.id) select distinct id,parent_id,kind,code,external_code,name,source,source_version,valid_from,valid_to,metadata from scoped order by name", [auth.identityId, auth.activeOrganizationId]);
      if (scoped.rows.length) return scoped.rows;
      const fallback = await client.query("select id,parent_id,kind,code,external_code,name,source,source_version,valid_from,valid_to,metadata from geography where parent_id is null order by name");
      const visible: unknown[] = [];
      for (const row of fallback.rows) if (await canReadGeography(client, auth, row.id)) visible.push(row);
      return visible;
    });
    return { source: "postgresql", syntheticData: false, data: { geography: rows } };
  } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authoritative geography unavailable", syntheticData: false }); }
});
app.get("/api/v1/geography/children/:parentId", async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth || !pool) return;
  if (!auth.activeOrganizationId) return reply.code(403).send({ error: "An active organization is required for geography access", code: "ACTIVE_ORGANIZATION_REQUIRED" });
  try {
    const { parentId } = request.params as { parentId: string };
    const rows = await withDatabaseTenantContext(pool, { identityId: auth.identityId, organizationId: auth.activeOrganizationId, bilateralOrganizationScope: false, serviceMode: false }, async (client) => {
      if (!await canReadGeography(client, auth, parentId)) throw Object.assign(new Error("Geography outside organization authorization scope"), { code: "GEOGRAPHY_FORBIDDEN" });
      const result = await client.query("select id,parent_id,kind,code,external_code,name,source,source_version,valid_from,valid_to,metadata from geography where parent_id=$1 order by name", [parentId]);
      return result.rows;
    });
    return { source: "postgresql", syntheticData: false, data: { geography: rows } };
  } catch (error) {
    if ((error as {code?:string}).code === "GEOGRAPHY_FORBIDDEN") return reply.code(403).send({ error: "Geography outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    request.log.error(error); return reply.code(503).send({ error: "Authoritative geography unavailable", syntheticData: false });
  }
});
app.post("/api/v1/operations/sync", async (request, reply) => {
  const body = bodyOf(request); const idempotencyKey = requiredString(body, "idempotencyKey"); const deviceId = requiredString(body, "deviceId"); const capturedAt = requiredString(body, "capturedAt"); const payload = body.payload;
  if (!idempotencyKey || !deviceId || !capturedAt || payload === undefined) return reply.code(400).send({ error: "idempotencyKey, deviceId, capturedAt and payload are required" });
  if (Number.isNaN(Date.parse(capturedAt))) return reply.code(400).send({ error: "capturedAt must be an ISO date" });
  const authorization = request.headers.authorization; if (!authorization?.startsWith("Bearer ")) return reply.code(401).send(bearerChallenge());
  const organizationId = request.headers["x-rupaykg-organization-id"]; const clientSequenceValue = Number(body.clientSequence ?? body.sequence ?? Date.now()); const clientSequence = Number.isSafeInteger(clientSequenceValue) && clientSequenceValue > 0 ? clientSequenceValue : Date.now();
  try { const intake = await app.inject({ method: "POST", url: "/api/v1/field-sync/envelopes", headers: { authorization, "x-rupaykg-organization-id": organizationId, "content-type": "application/json" }, payload: { idempotencyKey, deviceId, clientSequence, capturedAt, payload } }); const intakeBody = intake.json() as Record<string, unknown>; if (intake.statusCode >= 400) return reply.code(intake.statusCode).send(intakeBody); const envelope = intakeBody.envelope as Record<string, unknown> | undefined; const envelopeId = typeof envelope?.id === "string" ? envelope.id : null; if (!envelopeId) return reply.code(503).send({ error: "Authoritative field sync envelope was not returned", code: "FIELD_SYNC_ENVELOPE_MISSING", syntheticData: false }); if (intakeBody.replay === true && envelope?.status === "APPLIED") return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: true, authoritativeMutation: true, entityType: envelope.applied_entity_type, entityId: envelope.applied_entity_id, envelopeId }); const applied = await app.inject({ method: "POST", url: `/api/v1/field-sync/envelopes/${envelopeId}/apply`, headers: { authorization, "x-rupaykg-organization-id": organizationId, "content-type": "application/json" }, payload: {} }); return reply.code(applied.statusCode).send(applied.json()); } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authoritative operation application unavailable", code: "OPERATION_SYNC_UNAVAILABLE", syntheticData: false }); }
});
app.post("/api/v1/resource-flows", async (request, reply) => { const auth = await requireAuth(request, reply); if (!auth) return; const body = bodyOf(request); const organizationId = requiredString(body,"organizationId"); const originType = requiredString(body,"originType"); const resourceForm = requiredString(body,"resourceForm"); const materialCode = requiredString(body,"materialCode"); const unit = requiredString(body,"unit"); const quantity = requiredPositiveNumber(body,"quantity"); if (!organizationId || !originType || !resourceForm || !materialCode || !unit || quantity === null) return reply.code(400).send({ error:"organizationId, originType, resourceForm, positive quantity and unit are required" }); if (!requireOrganization(auth,organizationId,reply)) return; try { if (!pool) throw new Error("DATABASE_URL is not configured"); } catch (error) { request.log.error(error); return reply.code(503).send({ error:"Authorization service unavailable", code:"AUTHORIZATION_UNAVAILABLE" }); } const sourceGeographyId = requiredString(body,"sourceGeographyId"); const destinationGeographyId = requiredString(body,"destinationGeographyId"); if (!sourceGeographyId && !destinationGeographyId) return reply.code(400).send({ error:"At least one authorized sourceGeographyId or destinationGeographyId is required", code:"GEOGRAPHY_REQUIRED" }); try { if (!pool) throw new Error("DATABASE_URL is not configured"); const result = await withDatabaseTenantContext(pool, { identityId: auth.identityId, organizationId, bilateralOrganizationScope: auth.bilateralOrganizationScope ?? false, serviceMode: false }, async (client) => { if (!await hasOrganizationPermission(client, auth, organizationId, ['waste:record'])) throw Object.assign(new Error("Waste recording permission required"), { code: "PERMISSION_FORBIDDEN" }); if (sourceGeographyId && !await canWriteGeography(client,auth,organizationId,sourceGeographyId)) throw Object.assign(new Error("Source geography is outside organization authorization scope"), { code: "SOURCE_GEOGRAPHY_FORBIDDEN" }); if (destinationGeographyId && !await canWriteGeography(client,auth,organizationId,destinationGeographyId)) throw Object.assign(new Error("Destination geography is outside organization authorization scope"), { code: "DESTINATION_GEOGRAPHY_FORBIDDEN" }); const rows = await client.query("insert into resource_flows (organization_id,origin_type,resource_form,material_code,declared_quantity,unit,source_geography_id,destination_geography_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",[organizationId,originType,resourceForm,materialCode,quantity,unit,sourceGeographyId,destinationGeographyId]); return rows.rows[0]; }); return reply.code(201).send({source:"postgresql",syntheticData:false,resourceFlow:result}); } catch (error) { const code = (error as { code?: string }).code; if (code === "PERMISSION_FORBIDDEN") return reply.code(403).send({ error:"Waste recording permission required", code:"PERMISSION_FORBIDDEN" }); if (code === "SOURCE_GEOGRAPHY_FORBIDDEN" || code === "DESTINATION_GEOGRAPHY_FORBIDDEN") return reply.code(403).send({ error: code === "SOURCE_GEOGRAPHY_FORBIDDEN" ? "Source geography is outside organization authorization scope" : "Destination geography is outside organization authorization scope", code:"GEOGRAPHY_FORBIDDEN" }); request.log.error(error); return reply.code(503).send({error:"Resource flow creation unavailable",syntheticData:false}); } });
app.post("/api/v1/activities/:activityId/measurements", async (request, reply) => { const auth=await requireAuth(request,reply);if(!auth)return;if(!auth.activeOrganizationId)return reply.code(403).send({error:"An active organization is required for measurement recording",code:"ACTIVE_ORGANIZATION_REQUIRED"});const {activityId}=request.params as {activityId:string};const body=bodyOf(request);const value=requiredPositiveNumber(body,"value"),unit=requiredString(body,"unit"),method=requiredString(body,"method"),source=requiredString(body,"source"),measuredAt=requiredString(body,"measuredAt");if(value===null||!unit||!method||!source||!measuredAt||Number.isNaN(Date.parse(measuredAt)))return reply.code(400).send({error:"positive value, unit, method, source and valid measuredAt are required"});try{if(!pool)throw new Error("DATABASE_URL is not configured");const result=await withDatabaseTenantContext(pool,{identityId:auth.identityId,organizationId:auth.activeOrganizationId ?? undefined,bilateralOrganizationScope:auth.bilateralOrganizationScope ?? false,serviceMode:false},async client=>{if(!await canWriteActivity(client,auth,activityId))throw Object.assign(new Error("Activity is outside organization authorization scope or lacks waste recording permission"),{code:"ACTIVITY_FORBIDDEN"});const rows=await client.query("insert into measurements(activity_id,value,unit,method,source,measured_at) values($1,$2,$3,$4,$5,$6) returning *",[activityId,value,unit,method,source,measuredAt]);return rows.rows[0];});return reply.code(201).send({source:"postgresql",syntheticData:false,measurement:result});}catch(error){const code=(error as {code?:string}).code;if(code==="ACTIVITY_FORBIDDEN")return reply.code(403).send({error:"Activity is outside organization authorization scope or lacks waste recording permission",code:"ACTIVITY_FORBIDDEN"});request.log.error(error);return reply.code(503).send({error:"Measurement recording unavailable",syntheticData:false});}});

await registerOnboardingHierarchyRoutes(app, pool);
await registerValueRoutes(app, pool);
await registerRegistryRoutes(app, pool);
await registerSyncRoutes(app, pool);
await registerWorkspaceRoutes(app, pool);
await registerBwgRoutes(app, pool);
await registerCpcbSwmRoutes(app, pool);
await registerIntelligenceRoutes(app, pool);
await registerMrvRoutes(app, pool);
await registerEvidenceVaultRoutes(app, pool);
await registerPlatformAdminRoutes(app, pool);

if (existsSync(webRoot)) app.get("/*", async (_request, reply) => reply.type("text/html; charset=utf-8").send(readFileSync(resolve(webRoot, "index.html"), "utf8")));
const port = Number(process.env.PORT ?? 3000); const host = process.env.HOST ?? "0.0.0.0"; await app.listen({ port, host });