
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, bearerChallenge, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { initialSwmChecklist } from "@rupaykg/domain";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAKEHOLDERS = ["BWG", "WASTE_FACILITY", "ULB", "DISTRICT_PANCHAYAT", "GRAM_PANCHAYAT", "COLLECTOR_TRANSPORTER", "PROCESSOR"] as const;
const EVIDENCE_STATUSES = ["MISSING", "PROVIDED_UNVERIFIED", "REJECTED", "EXPIRED", "NOT_APPLICABLE", "UNRESOLVED"] as const;
const REPORTED_STATUSES = ["NOT_REPORTED", "DRAFT", "UNDER_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED"] as const;
const LOCAL_STAGES = ["LOCAL_PREPARATION", "ELIGIBILITY_REVIEW", "DOCUMENTS_PENDING", "READY_FOR_USER_SUBMISSION", "SUBMISSION_REPORTED", "UNDER_REVIEW_FOLLOW_UP", "CORRECTION_PREPARATION", "AMENDMENT_PREPARATION", "LEVEL_1_APPEAL_PREPARATION", "GRIEVANCE_PREPARATION", "EVENT_INTIMATION_PREPARATION", "CLOSED_LOCAL", "UNRESOLVED"] as const;
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
export function safeChecklist(value: unknown, stakeholder: Stakeholder): ChecklistItem[] | null {
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
  const expected = initialSwmChecklist(stakeholder);
  if (result.length !== expected.length) return null;
  for (let index = 0; index < expected.length; index++) {
    const actual = result[index]!;
    const canonical = expected[index]!;
    if (actual.key !== canonical.key || actual.label !== canonical.label || actual.officialRequirement !== canonical.officialRequirement) return null;
  }
  return result;
}
export function isCpcbReportedStatus(value: unknown): value is typeof REPORTED_STATUSES[number] {
  return typeof value === "string" && (REPORTED_STATUSES as readonly string[]).includes(value);
}
export function isSwmLocalStage(value: unknown): value is typeof LOCAL_STAGES[number] {
  return typeof value === "string" && (LOCAL_STAGES as readonly string[]).includes(value);
}
export function safeObservations(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["floorAreaM2", "waterConsumptionLitresPerDay", "wasteGenerationKgPerDay"];
  if (Object.keys(record).some(key => !keys.includes(key))) return false;
  for (const key of keys) {
    const raw = record[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const observation = raw as Record<string, unknown>;
    if (!(observation.value === null || (typeof observation.value === "number" && Number.isFinite(observation.value) && observation.value >= 0))) return false;
    if (typeof observation.unit !== "string" || observation.unit.length > 32) return false;
    for (const field of ["sourceReference", "periodStart", "periodEnd"]) {
      const fieldValue = observation[field];
      if (fieldValue !== undefined && fieldValue !== null && typeof fieldValue !== "string") return false;
      if (typeof fieldValue === "string" && fieldValue.length > 500) return false;
    }
    if (typeof observation.periodStart === "string" && observation.periodStart && !validDate(observation.periodStart)) return false;
    if (typeof observation.periodEnd === "string" && observation.periodEnd && !validDate(observation.periodEnd)) return false;
    if (typeof observation.periodStart === "string" && typeof observation.periodEnd === "string" && observation.periodStart && observation.periodEnd && observation.periodStart > observation.periodEnd) return false;
  }
  return true;
}
async function writeAudit(client: PoolClient, identityId: string, organizationId: string, action: string, targetId: string, payload: unknown, requestId: string) {
  // PostgreSQL migration 088 owns predecessor selection and canonical hashing for every writer.
  // Do not construct a per-organization chain here; it can race and fork the global chain.
  await client.query(
    "insert into audit_events(actor_identity_id,organization_id,action,target_type,target_id,request_id,payload) values($1,$2,$3,'cpcb_swm_stakeholder_workspace',$4,$5,$6::jsonb)",
    [identityId, organizationId, action, targetId, requestId, JSON.stringify(payload)],
  );
}

export async function registerCpcbSwmRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/cpcb-swm/workspaces", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const organizationId = auth.activeOrganizationId;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Select a verified organization", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["swm:read", "waste:read", "reports:read", "epr:read", "audit:read"])) return reply.code(403).send({ error: "CPCB SWM workspace read permission required", code: "SWM_READ_FORBIDDEN" });
    try {
      const rows = await pool.query("select w.id,w.organization_id,w.geography_id,w.stakeholder_type,w.title,w.eligibility_observations,w.checklist,w.cpcb_application_reference,w.cpcb_status_claim,w.cpcb_reported_status,w.local_workflow_stage,w.cpcb_status_source_reference,w.cpcb_status_reference_recorded_at,w.cpcb_status_note,w.due_date,w.notes,w.created_by_identity_id,w.updated_by_identity_id,w.created_at,w.updated_at,coalesce((select json_agg(json_build_object('id',h.id,'previousReportedStatus',h.previous_reported_status,'reportedStatus',h.reported_status,'sourceReference',h.source_reference,'statusNote',h.status_note,'actorIdentityId',h.actor_identity_id,'recordedAt',h.recorded_at) order by h.recorded_at desc) from cpcb_swm_status_history h where h.workspace_id=w.id),'[]'::json) as status_history from cpcb_swm_stakeholder_workspaces w where w.organization_id=$1 order by w.updated_at desc limit 100", [organizationId]);
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
    const reportedStatus = body.cpcbReportedStatus === undefined ? "NOT_REPORTED" : body.cpcbReportedStatus;
    const localStage = body.localWorkflowStage === undefined ? "LOCAL_PREPARATION" : body.localWorkflowStage;
    const statusNote = text(body, "statusNote", 1000);
    const geographyId = text(body, "geographyId", 64);
    const checklist = validStakeholder(stakeholderType) ? safeChecklist(body.checklist, stakeholderType) : null;
    const observations = body.eligibilityObservations;
    const applicationReference = text(body, "cpcbApplicationReference", 240);
    const sourceReference = text(body, "cpcbStatusSourceReference", 500);
    const dueDate = body.dueDate === null || body.dueDate === "" || body.dueDate === undefined ? null : validDate(body.dueDate) ? body.dueDate : "INVALID";
    const notes = body.notes === undefined || body.notes === null ? null : text(body, "notes", 4000);
    if (!validStakeholder(stakeholderType) || !title || !checklist || !safeObservations(observations) || !isCpcbReportedStatus(reportedStatus) || !isSwmLocalStage(localStage) || (reportedStatus !== "NOT_REPORTED" && !sourceReference) || (geographyId && !UUID.test(geographyId)) || dueDate === "INVALID" || (body.notes !== undefined && body.notes !== null && body.notes !== "" && notes === null) || (body.statusNote !== undefined && body.statusNote !== null && body.statusNote !== "" && statusNote === null)) return reply.code(400).send({ error: "Invalid stakeholder type, title, geography, canonical checklist, observations, workflow stage, reported status, status source, due date or notes", code: "SWM_WORKSPACE_INVALID" });
    try {
      if (geographyId) {
        const allowed = await pool.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3::uuid)) ok", [auth.identityId, organizationId, geographyId]);
        if (!allowed.rows[0]?.ok) return reply.code(403).send({ error: "Geography outside verified organization scope", code: "GEOGRAPHY_FORBIDDEN" });
      }
      const client = await pool.connect();
      try {
        await client.query("begin");
        const effectiveSourceReference = reportedStatus === "NOT_REPORTED" ? null : sourceReference;
        const rows = await client.query("insert into cpcb_swm_stakeholder_workspaces(organization_id,geography_id,stakeholder_type,title,eligibility_observations,checklist,cpcb_application_reference,cpcb_status_claim,cpcb_reported_status,local_workflow_stage,cpcb_status_source_reference,cpcb_status_reference_recorded_at,cpcb_status_note,due_date,notes,created_by_identity_id,updated_by_identity_id) values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,'USER_REPORTED_UNVERIFIED',$8,$9,$10,case when $10 is not null then now() else null end,$11,$12,$13,$14,$14) returning *", [organizationId, geographyId || null, stakeholderType, title, JSON.stringify(observations), JSON.stringify(checklist), applicationReference, reportedStatus, localStage, effectiveSourceReference, statusNote, dueDate, notes, auth.identityId]);
        const workspace = rows.rows[0] as { id: string };
        if (reportedStatus !== "NOT_REPORTED") {
          await client.query("insert into cpcb_swm_status_history(workspace_id,organization_id,previous_reported_status,reported_status,source_reference,status_note,actor_identity_id) values($1,$2,'NOT_REPORTED',$3,$4,$5,$6)", [workspace.id, organizationId, reportedStatus, effectiveSourceReference, statusNote, auth.identityId]);
        }
        await writeAudit(client, auth.identityId, organizationId, "CPCB_SWM_WORKSPACE_CREATED", workspace.id, { stakeholderType, title, checklistItems: checklist.length, cpcbReportedStatus: reportedStatus, localWorkflowStage: localStage, cpcbStatusClaim: "USER_REPORTED_UNVERIFIED" }, (request as never as Request).id ?? "request-id-unavailable");
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
    const reportedStatus = body.cpcbReportedStatus === undefined ? "NOT_REPORTED" : body.cpcbReportedStatus;
    const localStage = body.localWorkflowStage === undefined ? "LOCAL_PREPARATION" : body.localWorkflowStage;
    const statusNote = text(body, "statusNote", 1000);
    const checklist = validStakeholder(stakeholderType) ? safeChecklist(body.checklist, stakeholderType) : null, observations = body.eligibilityObservations;
    const applicationReference = text(body, "cpcbApplicationReference", 240), sourceReference = text(body, "cpcbStatusSourceReference", 500);
    const dueDate = body.dueDate === null || body.dueDate === "" || body.dueDate === undefined ? null : validDate(body.dueDate) ? body.dueDate : "INVALID";
    const notes = body.notes === undefined || body.notes === null ? null : text(body, "notes", 4000);
    if (!validStakeholder(stakeholderType) || !title || !checklist || !safeObservations(observations) || !isCpcbReportedStatus(reportedStatus) || !isSwmLocalStage(localStage) || (reportedStatus !== "NOT_REPORTED" && !sourceReference) || (geographyId && !UUID.test(geographyId)) || dueDate === "INVALID" || (body.notes !== undefined && body.notes !== null && body.notes !== "" && notes === null) || (body.statusNote !== undefined && body.statusNote !== null && body.statusNote !== "" && statusNote === null)) return reply.code(400).send({ error: "Invalid stakeholder type, title, geography, canonical checklist, observations, workflow stage, reported status, status source, due date or notes", code: "SWM_WORKSPACE_INVALID" });
    try {
      if (geographyId) {
        const allowed = await pool.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3::uuid)) ok", [auth.identityId, organizationId, geographyId]);
        if (!allowed.rows[0]?.ok) return reply.code(403).send({ error: "Geography outside verified organization scope", code: "GEOGRAPHY_FORBIDDEN" });
      }
      const client = await pool.connect();
      try {
        await client.query("begin");
        const prior = await client.query<{ id: string; cpcb_reported_status: string; cpcb_status_source_reference: string | null; cpcb_status_note: string | null }>("select id,cpcb_reported_status,cpcb_status_source_reference,cpcb_status_note from cpcb_swm_stakeholder_workspaces where id=$1 and organization_id=$2 for update", [id, organizationId]);
        if (!prior.rows[0]) { await client.query("rollback"); return reply.code(404).send({ error: "Stakeholder workspace not found", code: "SWM_WORKSPACE_NOT_FOUND" }); }
        const effectiveSourceReference = reportedStatus === "NOT_REPORTED" ? null : sourceReference;
        const rows = await client.query("update cpcb_swm_stakeholder_workspaces set geography_id=$1,stakeholder_type=$2,title=$3,eligibility_observations=$4::jsonb,checklist=$5::jsonb,cpcb_application_reference=$6,cpcb_reported_status=$7,local_workflow_stage=$8,cpcb_status_source_reference=$9,cpcb_status_reference_recorded_at=case when $9 is not null then now() else null end,cpcb_status_note=$10,due_date=$11,notes=$12,updated_by_identity_id=$13,updated_at=now() where id=$14 and organization_id=$15 returning *", [geographyId || null, stakeholderType, title, JSON.stringify(observations), JSON.stringify(checklist), applicationReference, reportedStatus, localStage, effectiveSourceReference, statusNote, dueDate, notes, auth.identityId, id, organizationId]);
        if (prior.rows[0].cpcb_reported_status !== reportedStatus || prior.rows[0].cpcb_status_source_reference !== effectiveSourceReference || prior.rows[0].cpcb_status_note !== statusNote) {
          await client.query("insert into cpcb_swm_status_history(workspace_id,organization_id,previous_reported_status,reported_status,source_reference,status_note,actor_identity_id) values($1,$2,$3,$4,$5,$6,$7)", [id, organizationId, prior.rows[0].cpcb_reported_status, reportedStatus, effectiveSourceReference, statusNote, auth.identityId]);
        }
        await writeAudit(client, auth.identityId, organizationId, "CPCB_SWM_WORKSPACE_UPDATED", id, { stakeholderType, title, checklistItems: checklist.length, cpcbReportedStatus: reportedStatus, localWorkflowStage: localStage, cpcbStatusClaim: "USER_REPORTED_UNVERIFIED" }, (request as never as Request).id ?? "request-id-unavailable");
        await client.query("commit");
        return { source: "postgresql", syntheticData: false, workspace: rows.rows[0] };
      } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "CPCB SWM workspace update failed", code: "SWM_WORKSPACE_UPDATE_FAILED", syntheticData: false }); }
  });
  app.get("/api/v1/cpcb-swm/workspaces/:workspaceId/evidence", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const org = auth.activeOrganizationId, id = (request as never as Request).params.workspaceId ?? "";
    if (!org || !canActForOrganization(auth, org)) return reply.code(403).send({error:"Organization forbidden",code:"ORG_FORBIDDEN"});
    if (!UUID.test(id)) return reply.code(400).send({error:"Invalid workspace ID",code:"SWM_WORKSPACE_ID_INVALID"});
    if (!await hasOrganizationPermission(pool,auth,org,["waste:record"]) || !await hasOrganizationPermission(pool,auth,org,["evidence:read","evidence:upload","evidence:review"])) return reply.code(403).send({error:"Evidence read permission required",code:"SWM_EVIDENCE_READ_FORBIDDEN"});
    const w=await pool.query("select id from cpcb_swm_stakeholder_workspaces where id=$1 and organization_id=$2",[id,org]);
    if(!w.rows[0]) return reply.code(404).send({error:"Workspace not found",code:"SWM_WORKSPACE_NOT_FOUND"});
    const rows=await pool.query("select l.id,l.evidence_id,l.artifact_version_id,l.checklist_key,l.created_at,e.status::text evidence_status,v.version_number,v.file_name,v.media_type,v.size_bytes,v.sha256,v.source_reference from cpcb_swm_workspace_evidence l join evidence e on e.id=l.evidence_id join evidence_artifact_versions v on v.id=l.artifact_version_id where l.workspace_id=$1 and l.organization_id=$2 order by l.created_at desc",[id,org]);
    return {source:"postgresql",syntheticData:false,evidenceLinks:rows.rows};
  });

  app.post("/api/v1/cpcb-swm/workspaces/:workspaceId/evidence", async (request, reply) => {
    const auth=await authFor(request as never,reply,pool); if(!auth||!pool)return;
    const org=auth.activeOrganizationId,id=(request as never as Request).params.workspaceId??"",body=bodyOf(request as never),evidenceId=text(body,"evidenceId",64),checklistKey=text(body,"checklistKey",80);
    if(!org||!canActForOrganization(auth,org))return reply.code(403).send({error:"Organization forbidden",code:"ORG_FORBIDDEN"});
    if(!UUID.test(id))return reply.code(400).send({error:"Invalid workspace ID",code:"SWM_WORKSPACE_ID_INVALID"});
    if(!evidenceId||!UUID.test(evidenceId)||!checklistKey||!/^[a-z0-9_]{2,80}$/.test(checklistKey))return reply.code(400).send({error:"Valid evidenceId and checklistKey required",code:"SWM_EVIDENCE_FIELDS_INVALID"});
    if(!await hasOrganizationPermission(pool,auth,org,["waste:record"])||!await hasOrganizationPermission(pool,auth,org,["evidence:read","evidence:upload","evidence:review"]))return reply.code(403).send({error:"Evidence linking permission required",code:"SWM_EVIDENCE_LINK_FORBIDDEN"});
    const client=await pool.connect();
    try{
      await client.query("begin");
      const wr=await client.query("select id,geography_id,stakeholder_type from cpcb_swm_stakeholder_workspaces where id=$1 and organization_id=$2 for update",[id,org]);
      const w=wr.rows[0] as {id:string;geography_id:string|null;stakeholder_type:Stakeholder}|undefined;
      if(!w){await client.query("rollback");return reply.code(404).send({error:"Workspace not found",code:"SWM_WORKSPACE_NOT_FOUND"});}
      if(!initialSwmChecklist(w.stakeholder_type).some(x=>x.key===checklistKey)){await client.query("rollback");return reply.code(400).send({error:"Checklist key is not canonical for stakeholder",code:"SWM_EVIDENCE_CHECKLIST_KEY_INVALID"});}
      const er=await client.query("select e.id evidence_id,v.id version_id,a.geography_id,e.status::text status,e.content_hash,v.sha256 from evidence e join activities a on a.id=e.activity_id join evidence_artifact_versions v on v.evidence_id=e.id join evidence_artifact_series s on s.id=v.series_id where e.id=$1 and s.organization_id=$2 and a.organization_id=$2 and s.activity_id=a.id",[evidenceId,org]);
      const e=er.rows[0] as {evidence_id:string;version_id:string;geography_id:string|null;status:string;content_hash:string;sha256:string}|undefined;
      if(!e||e.content_hash!==e.sha256){await client.query("rollback");return reply.code(404).send({error:"Evidence not found in organization or hash mismatch",code:"SWM_EVIDENCE_NOT_FOUND"});}
      if(!e.geography_id||(w.geography_id&&w.geography_id!==e.geography_id)){await client.query("rollback");return reply.code(403).send({error:"Evidence geography must match workspace and be present",code:"SWM_EVIDENCE_GEOGRAPHY_MISMATCH"});}
      const scope=await client.query("select organization_has_geography_scope($1::uuid,$2::uuid) ok",[org,e.geography_id]);
      if(!(scope.rows[0] as {ok:boolean}|undefined)?.ok){await client.query("rollback");return reply.code(403).send({error:"Evidence geography outside organization scope",code:"SWM_EVIDENCE_SCOPE_FORBIDDEN"});}
      const lr=await client.query("insert into cpcb_swm_workspace_evidence(workspace_id,organization_id,evidence_id,artifact_version_id,checklist_key,linked_by_identity_id) values($1,$2,$3,$4,$5,$6) on conflict(workspace_id,evidence_id,checklist_key) do nothing returning id",[id,org,evidenceId,e.version_id,checklistKey,auth.identityId]);
      const link=lr.rows[0] as {id:string}|undefined;
      if(!link){await client.query("rollback");return reply.code(409).send({error:"Evidence already linked to checklist item",code:"SWM_EVIDENCE_ALREADY_LINKED"});}
      await writeAudit(client,auth.identityId,org,"CPCB_SWM_EVIDENCE_LINKED",link.id,{workspaceId:id,evidenceId,artifactVersionId:e.version_id,checklistKey,evidenceStatus:e.status,officialCpcbStatusChanged:false},(request as never as Request).id??"request-id-unavailable");
      await client.query("commit");
      return reply.code(201).send({source:"postgresql",syntheticData:false,evidenceLink:{id:link.id,workspaceId:id,evidenceId,artifactVersionId:e.version_id,checklistKey,evidenceStatus:e.status,verificationStatus:e.status==="VERIFIED"?"INDEPENDENTLY_REVIEWED":e.status==="REJECTED"?"REJECTED":"PENDING_REVIEW",officialCpcbStatus:"UNCHANGED"}});
    }catch(error){await client.query("rollback").catch(()=>undefined);request.log.error(error);return reply.code(503).send({error:"Evidence link unavailable",code:"SWM_EVIDENCE_LINK_UNAVAILABLE",syntheticData:false});}finally{client.release();}
  });

}
