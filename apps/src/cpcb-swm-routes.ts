import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, bearerChallenge, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAKEHOLDERS = ["BWG", "WASTE_FACILITY", "ULB", "DISTRICT_PANCHAYAT", "GRAM_PANCHAYAT", "COLLECTOR_TRANSPORTER", "PROCESSOR"] as const;
const EVIDENCE_STATUSES = ["MISSING", "PROVIDED_UNVERIFIED", "REJECTED", "EXPIRED", "NOT_APPLICABLE", "UNRESOLVED"] as const;
type Stakeholder = typeof STAKEHOLDERS[number];
type ChecklistStatus = typeof EVIDENCE_STATUSES[number];
type ChecklistItem = { key: string; label: string; status: ChecklistStatus; officialRequirement: "GUIDE_LISTED" | "RULE_DERIVED" | "NEEDS_OFFICIAL_CONFIRMATION" };
type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; headers: Record<string, unknown>; id: string; log: { error: (error: unknown) => void } };

const text = (body: Record<string, unknown>, key: string, max = 2000): string | null => {
  const value = body[key];
  return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
};
const bodyOf = (request: Request): Record<string, unknown> => request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
const validStakeholder = (value: unknown): value is Stakeholder => typeof value === "string" && (STAKEHOLDERS as readonly string[]).includes(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); return null; }
}
function safeChecklist(value: unknown): ChecklistItem[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const result: ChecklistItem[] = [];
  const keys = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.key !== "string" || !/^[a-z0-9_]{2,80}$/.test(item.key) || keys.has(item.key)) return null;
    if (typeof item.label !== "string" || !item.label.trim() || item.label.length > 300) return null;
    if (!(EVIDENCE_STATUSES as readonly string[]).includes(String(item.status))) return null;
    if (!["GUIDE_LISTED", "RULE_DERIVED", "NEEDS_OFFICIAL_CONFIRMATION"].includes(String(item.officialRequirement))) return null;
    // The client cannot mark evidence verified; that requires a separate authorized review workflow.
    result.push({ key: item.key, label: item.label.trim(), status: item.status as ChecklistStatus, officialRequirement: item.officialRequirement as ChecklistItem["officialRequirement"] });
    keys.add(item.key);
  }
  return result;
}
function hashEvent(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function writeAudit(client: PoolClient, identityId: string, organizationId: string, action: string, targetId: string, payload: unknown, requestId: string) {
  const prior = await client.query<{ event_hash: string }>("select event_hash from audit_events where organization_id=$1 order by created_at desc, id desc limit 1 for update", [organizationId]);
  const previousHash = prior.rows[0]?.event_hash ?? null;
  const event = { identityId, organizationId, action, targetId, payload, requestId, previousHash, at: new Date().toISOString() };
  await client.query("insert into audit_events(actor_identity_id,organization_id,action,target_type,target_id,request_id,previous_hash,event_hash,payload) values($1,$2,$3,'cpcb_swm_stakeholder_workspace',$4,$5,$6,$7,$8::jsonb)", [identityId, organizationId, action, targetId, requestId, previousHash, hashEvent(event), JSON.stringify(payload)]);
}

export async function registerCpcbSwmRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/cpcb-swm/workspaces", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const organizationId = auth.activeOrganizationId;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Select a verified organization", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["swm:read", "waste:read", "reports:read"])) return reply.code(403).send({ error: "CPCB SWM workspace read permission required", code: "SWM_READ_FORBIDDEN" });
    try {
      const rows = await pool.query("select id,organization_id,geography_id,stakeholder_type,title,eligibility_observations,checklist,cpcb_application_reference,cpcb_status_claim,cpcb_status_source_reference,cpcb_status_reference_recorded_at,due_date,notes,created_by_identity_id,updated_by_identity_id,created_at,updated_at from cpcb_swm_stakeholder_workspaces where organization_id=$1 order by updated_at desc limit 100", [organizationId]);
      return { source: "postgresql", syntheticData: false, workspaces: rows.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "CPCB SWM workspace unavailable", code: "SWM_WORKSPACE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/cpcb-swm/workspaces", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never), organizationId = auth.activeOrganizationId;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Select a verified organization", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["waste:record"])) return reply.code(403).send({ error: "Waste-recording permission required to save stakeholder preparation", code: "SWM_WRITE_FORBIDDEN" });
    const stakeholderType = body.stakeholderType;
    const title = text(body, "title", 240);
    const geographyId = text(body, "geographyId", 64);
    const checklist = safeChecklist(body.checklist);
    const observations = body.eligibilityObservations;
    const applicationReference = text(body, "cpcbApplicationReference", 240);
    const sourceReference = text(body, "cpcbStatusSourceReference", 500);
    const dueDate = body.dueDate === null || body.dueDate === "" || body.dueDate === undefined ? null : validDate(body.dueDate) ? body.dueDate : "INVALID";
    const notes = body.notes === undefined || body.notes === null ? null : text(body, "notes", 4000);
    if (!validStakeholder(stakeholderType) || !title || !checklist || !observations || typeof observations !== "object" || Array.isArray(observations) || (geographyId && !UUID.test(geographyId)) || dueDate === "INVALID" || (body.notes !== undefined && body.notes !== null && body.notes !== "" && notes === null)) return reply.code(400).send({ error: "Invalid stakeholder type, title, geography, checklist, eligibility observations, due date or notes", code: "SWM_WORKSPACE_INVALID" });
    try {
      if (geographyId) {
        const allowed = await pool.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3::uuid)) ok", [auth.identityId, organizationId, geographyId]);
        if (!allowed.rows[0]?.ok) return reply.code(403).send({ error: "Geography outside verified organization scope", code: "GEOGRAPHY_FORBIDDEN" });
      }
      const client = await pool.connect();
      try {
        await client.query("begin");
        const rows = await client.query("insert into cpcb_swm_stakeholder_workspaces(organization_id,geography_id,stakeholder_type,title,eligibility_observations,checklist,cpcb_application_reference,cpcb_status_claim,cpcb_status_source_reference,cpcb_status_reference_recorded_at,due_date,notes,created_by_identity_id,updated_by_identity_id) values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,'USER_REPORTED_UNVERIFIED',$8,case when $8 is not null then now() else null end,$9,$10,$11,$11) returning *", [organizationId, geographyId || null, stakeholderType, title, JSON.stringify(observations), JSON.stringify(checklist), applicationReference, sourceReference, dueDate, notes, auth.identityId]);
        const workspace = rows.rows[0] as { id: string };
        await writeAudit(client, auth.identityId, organizationId, "CPCB_SWM_WORKSPACE_CREATED", workspace.id, { stakeholderType, title, checklistItems: checklist.length, cpcbStatusClaim: "USER_REPORTED_UNVERIFIED" }, (request as never as Request).id ?? "request-id-unavailable");
        await client.query("commit");
        return reply.code(201).send({ source: "postgresql", syntheticData: false, workspace: rows.rows[0] });
      } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "CPCB SWM workspace save failed", code: "SWM_WORKSPACE_SAVE_FAILED", syntheticData: false }); }
  });

  app.patch("/api/v1/cpcb-swm/workspaces/:workspaceId", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never), organizationId = auth.activeOrganizationId, id = (request as never as Request).params.workspaceId ?? "";
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Select a verified organization", code: "ORG_FORBIDDEN" });
    if (!UUID.test(id)) return reply.code(400).send({ error: "Invalid workspace ID", code: "SWM_WORKSPACE_ID_INVALID" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["waste:record"])) return reply.code(403).send({ error: "Waste-recording permission required to update stakeholder preparation", code: "SWM_WRITE_FORBIDDEN" });
    const stakeholderType = body.stakeholderType, title = text(body, "title", 240), geographyId = text(body, "geographyId", 64);
    const checklist = safeChecklist(body.checklist), observations = body.eligibilityObservations;
    const applicationReference = text(body, "cpcbApplicationReference", 240), sourceReference = text(body, "cpcbStatusSourceReference", 500);
    const dueDate = body.dueDate === null || body.dueDate === "" || body.dueDate === undefined ? null : validDate(body.dueDate) ? body.dueDate : "INVALID";
    const notes = body.notes === undefined || body.notes === null ? null : text(body, "notes", 4000);
    if (!validStakeholder(stakeholderType) || !title || !checklist || !observations || typeof observations !== "object" || Array.isArray(observations) || (geographyId && !UUID.test(geographyId)) || dueDate === "INVALID" || (body.notes !== undefined && body.notes !== null && body.notes !== "" && notes === null)) return reply.code(400).send({ error: "Invalid stakeholder type, title, geography, checklist, eligibility observations, due date or notes", code: "SWM_WORKSPACE_INVALID" });
    try {
      if (geographyId) {
        const allowed = await pool.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3::uuid)) ok", [auth.identityId, organizationId, geographyId]);
        if (!allowed.rows[0]?.ok) return reply.code(403).send({ error: "Geography outside verified organization scope", code: "GEOGRAPHY_FORBIDDEN" });
      }
      const client = await pool.connect();
      try {
        await client.query("begin");
        const prior = await client.query("select id from cpcb_swm_stakeholder_workspaces where id=$1 and organization_id=$2 for update", [id, organizationId]);
        if (!prior.rows[0]) { await client.query("rollback"); return reply.code(404).send({ error: "Stakeholder workspace not found", code: "SWM_WORKSPACE_NOT_FOUND" }); }
        const rows = await client.query("update cpcb_swm_stakeholder_workspaces set geography_id=$1,stakeholder_type=$2,title=$3,eligibility_observations=$4::jsonb,checklist=$5::jsonb,cpcb_application_reference=$6,cpcb_status_source_reference=$7,cpcb_status_reference_recorded_at=case when $7 is not null then now() else null end,due_date=$8,notes=$9,updated_by_identity_id=$10,updated_at=now() where id=$11 and organization_id=$12 returning *", [geographyId || null, stakeholderType, title, JSON.stringify(observations), JSON.stringify(checklist), applicationReference, sourceReference, dueDate, notes, auth.identityId, id, organizationId]);
        await writeAudit(client, auth.identityId, organizationId, "CPCB_SWM_WORKSPACE_UPDATED", id, { stakeholderType, title, checklistItems: checklist.length, cpcbStatusClaim: "USER_REPORTED_UNVERIFIED" }, (request as never as Request).id ?? "request-id-unavailable");
        await client.query("commit");
        return { source: "postgresql", syntheticData: false, workspace: rows.rows[0] };
      } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "CPCB SWM workspace update failed", code: "SWM_WORKSPACE_UPDATE_FAILED", syntheticData: false }); }
  });
}
