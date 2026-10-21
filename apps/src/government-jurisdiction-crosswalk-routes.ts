import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { hashPlatformAuditEventV2 } from "./platform-audit-hash.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z0-9][A-Z0-9._-]{1,79}$/;
const SHA256 = /^[0-9a-f]{64}$/;
type Body = Record<string, unknown>;

function bodyOf(request: FastifyRequest): Body {
  return request.body && typeof request.body === "object" && request.body !== null ? request.body as Body : {};
}
function text(body: Body, key: string, max = 1000): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}
function error(reply: FastifyReply, status: number, message: string, code: string) {
  return reply.code(status).send({ error: message, code, syntheticData: false });
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
async function authFor(request: FastifyRequest, reply: FastifyReply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { error(reply, 503, "Database unavailable", "DATABASE_UNAVAILABLE"); return null; }
  try {
    const auth = await authenticate(request, pool);
    if (!auth) { error(reply, 401, "Authenticated session required", "AUTH_REQUIRED"); return null; }
    return auth;
  } catch (cause) {
    request.log.error(cause);
    error(reply, 503, "Authentication service unavailable", "AUTH_UNAVAILABLE");
    return null;
  }
}
async function requireCrosswalkManager(pool: Pool, auth: AuthContext, organizationId: string): Promise<boolean> {
  if (!canActForOrganization(auth, organizationId)) return false;
  return await hasOrganizationPermission(pool, auth, organizationId, ["MANAGE_STAKEHOLDERS", "admin:system"]);
}
async function requireSuperAdmin(pool: Pool, identityId: string): Promise<boolean> {
  const result = await pool.query<{ ok: boolean }>(
    `select exists (
       select 1 from organization_memberships om
       join roles r on r.id=om.role_id
       join identities i on i.id=om.identity_id
       where om.identity_id=$1 and om.status='VERIFIED' and r.name='super_admin'
         and i.status='VERIFIED' and i.suspended_at is null
         and exists (select 1 from jsonb_array_elements_text(r.permissions) p where p='MANAGE_STAKEHOLDERS')
     ) as ok`,
    [identityId],
  );
  return result.rows[0]?.ok === true;
}
async function appendAudit(
  client: PoolClient,
  request: FastifyRequest,
  actorId: string,
  organizationId: string,
  action: string,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const head = await client.query<{ last_event_hash: string | null }>(
    "select last_event_hash from platform_audit_chain_head where singleton=true for update",
  );
  if (head.rowCount !== 1) throw new Error("PLATFORM_AUDIT_CHAIN_HEAD_MISSING");
  const previousHash = head.rows[0]?.last_event_hash ?? null;
  const event = { actorIdentityId: actorId, action, targetType: "government_jurisdiction_crosswalk", targetId, organizationId, requestId: request.id, payload, previousHash };
  const eventHash = hashPlatformAuditEventV2(event);
  const inserted = await client.query<{ id: string }>(
    `insert into audit_events(actor_identity_id,organization_id,action,target_type,target_id,request_id,previous_hash,event_hash,payload,hash_version,created_at)
     values($1,$2,$3,'government_jurisdiction_crosswalk',$4,$5,$6,$7,$8::jsonb,2,clock_timestamp()) returning id`,
    [actorId, organizationId, action, targetId, request.id, previousHash, eventHash, JSON.stringify(payload)],
  );
  const eventId = inserted.rows[0]?.id;
  if (!eventId) throw new Error("PLATFORM_AUDIT_EVENT_INSERT_FAILED");
  await client.query(
    "update platform_audit_chain_head set last_event_id=$1,last_event_hash=$2,updated_at=clock_timestamp() where singleton=true",
    [eventId, eventHash],
  );
}

export async function registerGovernmentJurisdictionCrosswalkRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/government/jurisdiction-crosswalk/requests", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request);
    const organizationId = text(body, "organizationId", 80);
    const geographyId = text(body, "geographyId", 80);
    const activityId = text(body, "activityId", 80);
    const authorityCode = text(body, "authorityCode", 80)?.toUpperCase();
    const municipalCode = text(body, "municipalCode", 80)?.toUpperCase();
    const sourceVersion = text(body, "sourceVersion", 120);
    const evidenceReference = text(body, "evidenceReference", 1000);
    const evidenceSha256 = text(body, "evidenceSha256", 64);
    const reason = text(body, "reason", 1000);
    if (!organizationId || !UUID.test(organizationId) || !geographyId || !UUID.test(geographyId)
      || (body.activityId !== undefined && body.activityId !== null && activityId === null)
      || (activityId !== null && !UUID.test(activityId))
      || !authorityCode || !CODE.test(authorityCode) || !municipalCode || !CODE.test(municipalCode)
      || !sourceVersion || !evidenceReference || !evidenceSha256 || !SHA256.test(evidenceSha256)
      || !reason || reason.length < 8) {
      return error(reply, 400, "Valid organizationId, geographyId, authorityCode, municipalCode, sourceVersion, evidence reference/SHA-256 and reason are required", "GOVERNMENT_CROSSWALK_REQUEST_INVALID");
    }
    if (!await requireCrosswalkManager(pool, auth, organizationId)) {
      return error(reply, 403, "Verified organization membership and stakeholder-management permission are required", "GOVERNMENT_CROSSWALK_FORBIDDEN");
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      const scope = await client.query<{ ok: boolean }>(
        "select organization_has_explicit_geography_scope($1,$2) as ok",
        [organizationId, geographyId],
      );
      if (scope.rows[0]?.ok !== true) {
        await client.query("rollback");
        return error(reply, 403, "Geography must be within an explicitly verified organization scope", "GEOGRAPHY_FORBIDDEN");
      }
      const target = await client.query<{ source_version: string | null }>(
        "select source_version from geography where id=$1",
        [geographyId],
      );
      if (!target.rows[0] || !target.rows[0].source_version?.trim()) {
        await client.query("rollback");
        return error(reply, 409, "Crosswalk target must be a canonical source-versioned geography record", "GOVERNMENT_CROSSWALK_TARGET_UNVERSIONED");
      }
      if (activityId) {
        const activity = await client.query<{ ok: boolean }>(
          "select exists(select 1 from activities where id=$1 and organization_id=$2 and geography_id=$3) as ok",
          [activityId, organizationId, geographyId],
        );
        if (activity.rows[0]?.ok !== true) {
          await client.query("rollback");
          return error(reply, 409, "Optional activity must belong to the same organization and geography", "GOVERNMENT_CROSSWALK_ACTIVITY_MISMATCH");
        }
      }
      const requestHash = digest({ authorityCode, municipalCode, sourceVersion, organizationId, geographyId, activityId: activityId ?? null, evidenceReference, evidenceSha256, reason, requestedBy: auth.identityId });
      const inserted = await client.query<{ id: string }>(
        `insert into government_jurisdiction_crosswalk_requests
          (authority_code,municipal_code,source_version,organization_id,geography_id,activity_id,evidence_reference,evidence_sha256,request_reason,request_hash,requested_by_identity_id)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [authorityCode, municipalCode, sourceVersion, organizationId, geographyId, activityId, evidenceReference, evidenceSha256, reason, requestHash, auth.identityId],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new Error("GOVERNMENT_CROSSWALK_REQUEST_INSERT_FAILED");
      await appendAudit(client, request, auth.identityId, organizationId, "GOVERNMENT_CROSSWALK_REQUESTED", id, { authorityCode, municipalCode, sourceVersion, geographyId, activityId: activityId ?? null, evidenceSha256, requestHash });
      await client.query("commit");
      return reply.code(201).send({ source: "postgresql", syntheticData: false, status: "PENDING", requestId: id, requestHash });
    } catch (cause) {
      await client.query("rollback").catch(() => undefined);
      if ((cause as { code?: string }).code === "23505") return error(reply, 409, "An equivalent pending crosswalk request already exists", "GOVERNMENT_CROSSWALK_REQUEST_DUPLICATE");
      request.log.error(cause);
      return error(reply, 503, "Unable to create crosswalk request", "GOVERNMENT_CROSSWALK_REQUEST_UNAVAILABLE");
    } finally { client.release(); }
  });

  app.get("/api/v1/government/jurisdiction-crosswalk/requests", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    if (!await requireSuperAdmin(pool, auth.identityId)) {
      return error(reply, 403, "An active Super Admin with platform-management permission is required to review crosswalk requests", "GOVERNMENT_CROSSWALK_APPROVAL_FORBIDDEN");
    }
    const query = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {};
    const status = typeof query.status === "string" ? query.status : "PENDING";
    if (!["PENDING", "APPROVED", "REJECTED", "ALL"].includes(status)) {
      return error(reply, 400, "status must be PENDING, APPROVED, REJECTED or ALL", "GOVERNMENT_CROSSWALK_QUERY_INVALID");
    }
    try {
      const rows = await pool.query(
        `select r.id,r.authority_code,r.municipal_code,r.source_version,r.organization_id,o.name organization_name,
                r.geography_id,g.name geography_name,r.activity_id,r.evidence_reference,r.evidence_sha256,
                r.request_reason,r.request_hash,r.requested_by_identity_id,requester.display_name requested_by,
                r.status,r.decided_by_identity_id,approver.display_name decided_by,r.decision_reason,r.expires_at,
                r.created_at,r.decided_at,r.applied_at
           from government_jurisdiction_crosswalk_requests r
           join organizations o on o.id=r.organization_id
           join geography g on g.id=r.geography_id
           join identities requester on requester.id=r.requested_by_identity_id
           left join identities approver on approver.id=r.decided_by_identity_id
          where ($1='ALL' or r.status=$1)
          order by case when r.status='PENDING' then 0 else 1 end, r.created_at asc
          limit 200`,
        [status],
      );
      return { source: "postgresql", syntheticData: false, requests: rows.rows };
    } catch (cause) {
      request.log.error(cause);
      return error(reply, 503, "Crosswalk review queue unavailable", "GOVERNMENT_CROSSWALK_QUEUE_UNAVAILABLE");
    }
  });

  app.post("/api/v1/government/jurisdiction-crosswalk/requests/:requestId/decision", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    if (!await requireSuperAdmin(pool, auth.identityId)) {
      return error(reply, 403, "An active Super Admin with stakeholder-management permission must decide this request", "GOVERNMENT_CROSSWALK_APPROVAL_FORBIDDEN");
    }
    const requestId = (request.params as { requestId: string }).requestId;
    const body = bodyOf(request);
    const decision = text(body, "decision", 16);
    const reason = text(body, "reason", 1000);
    if (!UUID.test(requestId) || !["APPROVE", "REJECT"].includes(decision ?? "") || !reason || reason.length < 8) {
      return error(reply, 400, "Valid requestId, decision (APPROVE/REJECT) and decision reason are required", "GOVERNMENT_CROSSWALK_DECISION_INVALID");
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      const found = await client.query<{
        id: string; authority_code: string; municipal_code: string; source_version: string; organization_id: string;
        geography_id: string; activity_id: string | null; evidence_reference: string; evidence_sha256: string;
        requested_by_identity_id: string; status: string; expires_at: Date | string | null;
      }>(
        `select id,authority_code,municipal_code,source_version,organization_id,geography_id,activity_id,evidence_reference,evidence_sha256,
                requested_by_identity_id,status,expires_at
           from government_jurisdiction_crosswalk_requests where id=$1 for update`,
        [requestId],
      );
      const row = found.rows[0];
      if (!row) { await client.query("rollback"); return error(reply, 404, "Crosswalk request not found", "GOVERNMENT_CROSSWALK_REQUEST_NOT_FOUND"); }
      if (row.status !== "PENDING") { await client.query("rollback"); return error(reply, 409, "Crosswalk request already has a decision", "GOVERNMENT_CROSSWALK_ALREADY_DECIDED"); }
      if (row.requested_by_identity_id === auth.identityId) { await client.query("rollback"); return error(reply, 403, "Requester cannot approve or reject their own crosswalk request", "GOVERNMENT_CROSSWALK_SELF_APPROVAL_FORBIDDEN"); }
      const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const updated = await client.query(
        `update government_jurisdiction_crosswalk_requests
            set status=$2,decided_by_identity_id=$3,decision_reason=$4,decided_at=now(),applied_at=case when $2='APPROVED' then now() else null end
          where id=$1 and status='PENDING'`,
        [requestId, status, auth.identityId, reason],
      );
      if (updated.rowCount !== 1) throw new Error("GOVERNMENT_CROSSWALK_DECISION_RACE");
      let crosswalkId: string | null = null;
      if (status === "APPROVED") {
        const inserted = await client.query<{ id: string }>(
          `insert into government_jurisdiction_crosswalks
            (authority_code,municipal_code,source_version,organization_id,geography_id,activity_id,status,evidence_reference,evidence_sha256,
             requested_by_identity_id,approved_by_identity_id,approval_reason,approval_request_id,effective_from,verified_at)
           values($1,$2,$3,$4,$5,$6,'VERIFIED',$7,$8,$9,$10,$11,$12,now(),now()) returning id`,
          [row.authority_code, row.municipal_code, row.source_version, row.organization_id, row.geography_id, row.activity_id,
            row.evidence_reference, row.evidence_sha256, row.requested_by_identity_id, auth.identityId, reason, requestId],
        );
        crosswalkId = inserted.rows[0]?.id ?? null;
        if (!crosswalkId) throw new Error("GOVERNMENT_CROSSWALK_INSERT_FAILED");
      }
      await appendAudit(client, request, auth.identityId, row.organization_id,
        status === "APPROVED" ? "GOVERNMENT_CROSSWALK_APPROVED" : "GOVERNMENT_CROSSWALK_REJECTED",
        crosswalkId ?? requestId, { requestId, decision: status, crosswalkId, reason });
      await client.query("commit");
      return reply.code(200).send({ source: "postgresql", syntheticData: false, status, requestId, crosswalkId });
    } catch (cause) {
      await client.query("rollback").catch(() => undefined);
      const message = (cause as { message?: string }).message ?? "";
      if (message.includes("GOVERNMENT_CROSSWALK_DUAL_CONTROL_MISMATCH") || message.includes("GOVERNMENT_CROSSWALK_VERIFICATION_INVALID")) {
        return error(reply, 409, "Crosswalk approval failed database integrity checks", "GOVERNMENT_CROSSWALK_INTEGRITY_FAILED");
      }
      if ((cause as { code?: string }).code === "23505") return error(reply, 409, "A verified mapping already exists for this authority/municipality/source version", "GOVERNMENT_CROSSWALK_MAPPING_CONFLICT");
      request.log.error(cause);
      return error(reply, 503, "Unable to decide crosswalk request", "GOVERNMENT_CROSSWALK_DECISION_UNAVAILABLE");
    } finally { client.release(); }
  });

  app.get("/api/v1/government/jurisdiction-crosswalks", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const organizationId = auth.activeOrganizationId;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return error(reply, 403, "Select a verified organization", "ORG_FORBIDDEN");
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["MANAGE_STAKEHOLDERS", "admin:system", "audit:read"])) {
      return error(reply, 403, "Crosswalk management or audit-read permission is required", "GOVERNMENT_CROSSWALK_FORBIDDEN");
    }
    try {
      const rows = await pool.query(
        `select id,authority_code,municipal_code,source_version,organization_id,geography_id,activity_id,status,
                evidence_reference,evidence_sha256,requested_by_identity_id,approved_by_identity_id,approval_reason,
                approval_request_id,effective_from,effective_to,created_at,verified_at,revoked_at
           from government_jurisdiction_crosswalks where organization_id=$1 order by created_at desc limit 500`,
        [organizationId],
      );
      return { source: "postgresql", syntheticData: false, crosswalks: rows.rows };
    } catch (cause) {
      request.log.error(cause);
      return error(reply, 503, "Crosswalk listing unavailable", "GOVERNMENT_CROSSWALK_LIST_UNAVAILABLE");
    }
  });
}
