import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, type AuthContext } from "./auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PERMISSIONS = new Set([
  "dashboard:read", "profile:read", "profile:update", "waste:read", "waste:record",
  "evidence:upload", "reports:read", "reports:export", "swm:read", "projects:read",
  "projects:create", "registry:read", "credits:read", "credits:buy", "epr:read",
  "csr:read", "guardian:read", "audit:read",
]);
const RESERVED_ROLES = new Set(["super_admin", "platform_admin"]);
const PROTECTED_PERMISSIONS = new Set([
  "evidence:review", "swm:manage", "projects:manage", "projects:review", "projects:verify",
  "acva:manage", "registry:write", "credits:issue", "credits:retire", "credits:transfer",
  "epr:manage", "csr:manage", "guardian:operate", "audit:execute", "admin:users",
  "admin:roles", "admin:security", "admin:system", "MANAGE_STAKEHOLDERS", "VERIFY_EVIDENCE",
  "verification:approve", "verification.approve", "ISSUE_CREDENTIAL", "registry:issue",
  "registry.issue", "TRANSFER_CREDENTIAL", "registry:transfer", "registry.transfer",
  "RETIRE_CREDENTIAL", "registry:retire", "registry.retire", "AUTHORIZE_SETTLEMENT",
  "settlement:authorize", "settlement.authorize", "SETTLE_FUNDS", "settlement:settle",
  "settlement.settle",
]);

type AdminContext = { auth: AuthContext; permission: string | null };
type Body = Record<string, unknown>;

function bodyOf(request: { body: unknown }): Body {
  return request.body && typeof request.body === "object" ? request.body as Body : {};
}
function text(body: Body, key: string): string | null {
  return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
}
function validReason(value: string | null): value is string {
  return Boolean(value && value.length >= 8 && value.length <= 1000);
}
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function routeError(reply: FastifyReply, status: number, error: string, code: string) {
  return reply.code(status).send({ error, code, syntheticData: false });
}

async function authorize(
  request: FastifyRequest,
  reply: FastifyReply,
  pool: Pool | null,
  permission: string | null,
): Promise<AdminContext | null> {
  if (!pool) {
    routeError(reply, 503, "Database unavailable", "DATABASE_UNAVAILABLE");
    return null;
  }
  let auth: AuthContext | null;
  try {
    auth = await authenticate(request, pool);
  } catch (error) {
    request.log.error(error);
    routeError(reply, 503, "Authentication service unavailable", "AUTH_UNAVAILABLE");
    return null;
  }
  if (!auth) {
    routeError(reply, 401, "Authenticated session required", "AUTH_REQUIRED");
    return null;
  }
  try {
    const result = await pool.query<{ ok: boolean }>(
      `select exists (
         select 1 from organization_memberships om
         join roles r on r.id = om.role_id
         join identities i on i.id = om.identity_id
         where om.identity_id = $1 and om.status = 'VERIFIED'
           and r.name = 'super_admin' and i.suspended_at is null
           and ($2::text is null or exists (
             select 1 from jsonb_array_elements_text(r.permissions) p where p = $2
           ))
       ) as ok`,
      [auth.identityId, permission],
    );
    if (result.rows[0]?.ok !== true) {
      routeError(reply, 403, "Super Admin authority and required permission are required", "PLATFORM_ADMIN_FORBIDDEN");
      return null;
    }
    return { auth, permission };
  } catch (error) {
    request.log.error(error);
    routeError(reply, 503, "Platform authorization unavailable", "PLATFORM_AUTH_UNAVAILABLE");
    return null;
  }
}

async function audit(
  client: PoolClient,
  request: FastifyRequest,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  payload: Record<string, unknown>,
  organizationId: string | null = null,
): Promise<void> {
  // Lock the authoritative chain-head row. Timestamps and random UUIDs do not define append order.
  const prior = await client.query<{ last_event_hash: string | null }>(
    "select last_event_hash from platform_audit_chain_head where singleton=true for update",
  );
  if (prior.rowCount !== 1) throw new Error("PLATFORM_AUDIT_CHAIN_HEAD_MISSING");
  const previousHash = prior.rows[0]?.last_event_hash ?? null;
  const event = {
    actorIdentityId: actorId,
    action,
    targetType,
    targetId,
    organizationId,
    requestId: request.id,
    payload,
    previousHash,
  };
  const eventHash = hash(JSON.stringify(event));
  const inserted = await client.query<{ id: string }>(
    `insert into audit_events(actor_identity_id,organization_id,action,target_type,target_id,request_id,previous_hash,event_hash,payload,created_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp())
     returning id`,
    [actorId, organizationId, action, targetType, targetId, request.id, previousHash, eventHash, JSON.stringify(payload)],
  );
  const eventId = inserted.rows[0]?.id;
  if (!eventId) throw new Error("PLATFORM_AUDIT_EVENT_INSERT_FAILED");
  await client.query(
    "update platform_audit_chain_head set last_event_id=$1,last_event_hash=$2,updated_at=clock_timestamp() where singleton=true",
    [eventId, eventHash],
  );
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerPlatformAdminRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/admin/overview", async (request, reply) => {
    const context = await authorize(request, reply, pool, null);
    if (!context || !pool) return;
    try {
      const result = await pool.query<{
        verifiedIdentities: string; organizations: string; verifiedMemberships: string;
        pendingApplications: string; pendingLegalReviews: string; anchoredMrvRecords: string;
      }>(
        `select
          (select count(*)::text from identities where status = 'VERIFIED' and suspended_at is null) as "verifiedIdentities",
          (select count(*)::text from organizations) as organizations,
          (select count(*)::text from organization_memberships where status = 'VERIFIED') as "verifiedMemberships",
          (select count(*)::text from stakeholder_applications where status = 'PENDING') as "pendingApplications",
          (select count(*)::text from organizations where verification_status in ('UNDER_REVIEW','PENDING')) as "pendingLegalReviews",
          (select count(*)::text from mrv_provenance_events where guardian_status = 'VERIFIED' and hcs_status = 'CONSENSUS_CONFIRMED') as "anchoredMrvRecords"`,
      );
      const row = result.rows[0];
      if (!row) throw new Error("Platform overview query returned no result");
      return { source: "postgresql", syntheticData: false, scope: "PLATFORM",
        counts: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) };
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Platform administration overview unavailable", "PLATFORM_OVERVIEW_UNAVAILABLE");
    }
  });

  app.get("/api/v1/admin/identities", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const query = request.query as Record<string, unknown>;
    const search = typeof query.search === "string" ? query.search.trim().slice(0, 120) : "";
    const limitValue = Number(query.limit ?? 50);
    const limit = Number.isInteger(limitValue) ? Math.max(1, Math.min(100, limitValue)) : 50;
    try {
      const result = await pool.query(
        `select i.id, i.display_name, i.email, i.status,
           case when i.suspended_at is null then false else true end as suspended,
           i.created_at, i.suspended_at, i.last_suspended_by_identity_id, i.last_suspension_reason,
           (select count(*)::int from organization_memberships om where om.identity_id=i.id and om.status='VERIFIED') as verified_memberships,
           (select count(*)::int from identity_sessions s where s.identity_id=i.id and s.revoked_at is null and s.expires_at>now()) as active_sessions
         from identities i
         where ($1 = '' or i.id::text ilike '%'||$1||'%' or i.display_name ilike '%'||$1||'%' or coalesce(i.email,'') ilike '%'||$1||'%')
         order by i.created_at desc, i.id limit $2`,
        [search, limit],
      );
      return { source: "postgresql", syntheticData: false, identities: result.rows };
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Identity directory unavailable", "IDENTITY_DIRECTORY_UNAVAILABLE");
    }
  });

  app.post("/api/v1/admin/identities/:identityId/suspend", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const { identityId } = request.params as { identityId: string };
    const reason = text(bodyOf(request), "reason");
    if (!UUID.test(identityId)) return routeError(reply, 400, "A valid identity UUID is required", "IDENTITY_ID_INVALID");
    if (identityId === context.auth.identityId) return routeError(reply, 409, "You cannot suspend your own identity", "SELF_SUSPENSION_FORBIDDEN");
    if (!validReason(reason)) return routeError(reply, 400, "A reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    try {
      const result = await transaction(pool, async (client) => {
        const row = await client.query<{ id: string; status: string; suspended_at: Date | null }>(
          "select id,status,suspended_at from identities where id=$1 for update", [identityId],
        );
        const identity = row.rows[0];
        if (!identity) return { status: 404 as const, body: { error: "Identity not found", code: "IDENTITY_NOT_FOUND" } };
        if (identity.status !== "VERIFIED") return { status: 409 as const, body: { error: "Only a verified identity can be suspended", code: "IDENTITY_NOT_ACTIVE" } };
        const reserved = await client.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om join roles r on r.id=om.role_id where om.identity_id=$1 and om.status='VERIFIED' and r.name in ('super_admin','platform_admin')) ok", [identityId]);
        if (reserved.rows[0]?.ok) return { status: 409 as const, body: { error: "Platform-reserved administrators require a separately governed suspension workflow", code: "RESERVED_ADMIN_SUSPENSION_BLOCKED" } };
        if (identity.suspended_at) return { status: 200 as const, body: { source: "postgresql", syntheticData: false, replay: true, suspended: true } };
        await client.query("update identities set suspended_at=now(),last_suspended_by_identity_id=$2,last_suspension_reason=$3 where id=$1", [identityId, context.auth.identityId, reason]);
        const sessions = await client.query("update identity_sessions set revoked_at=now() where identity_id=$1 and revoked_at is null", [identityId]);
        await audit(client, request, context.auth.identityId, "IDENTITY_SUSPENDED", "identity", identityId, { reason, revokedSessions: sessions.rowCount ?? 0 });
        return { status: 200 as const, body: { source: "postgresql", syntheticData: false, suspended: true, revokedSessions: sessions.rowCount ?? 0 } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Identity suspension failed", "IDENTITY_SUSPENSION_UNAVAILABLE");
    }
  });

  app.post("/api/v1/admin/identities/:identityId/reactivate", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const { identityId } = request.params as { identityId: string };
    const reason = text(bodyOf(request), "reason");
    if (!UUID.test(identityId)) return routeError(reply, 400, "A valid identity UUID is required", "IDENTITY_ID_INVALID");
    if (!validReason(reason)) return routeError(reply, 400, "A reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    try {
      const result = await transaction(pool, async (client) => {
        const row = await client.query<{ id: string; status: string; suspended_at: Date | null }>(
          "select id,status,suspended_at from identities where id=$1 for update", [identityId],
        );
        const identity = row.rows[0];
        if (!identity) return { status: 404 as const, body: { error: "Identity not found", code: "IDENTITY_NOT_FOUND" } };
        if (identity.status !== "VERIFIED") return { status: 409 as const, body: { error: "Identity verification must remain VERIFIED before reactivation", code: "IDENTITY_NOT_VERIFIED" } };
        const reserved = await client.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om join roles r on r.id=om.role_id where om.identity_id=$1 and om.status='VERIFIED' and r.name in ('super_admin','platform_admin')) ok", [identityId]);
        if (reserved.rows[0]?.ok) return { status: 409 as const, body: { error: "Platform-reserved administrators require a separately governed reactivation workflow", code: "RESERVED_ADMIN_REACTIVATION_BLOCKED" } };
        if (!identity.suspended_at) return { status: 200 as const, body: { source: "postgresql", syntheticData: false, replay: true, suspended: false } };
        await client.query("update identities set suspended_at=null where id=$1", [identityId]);
        await audit(client, request, context.auth.identityId, "IDENTITY_REACTIVATED", "identity", identityId, { reason });
        return { status: 200 as const, body: { source: "postgresql", syntheticData: false, suspended: false, sessionsRemainRevoked: true } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Identity reactivation failed", "IDENTITY_REACTIVATION_UNAVAILABLE");
    }
  });

  app.post("/api/v1/admin/identities/:identityId/revoke-sessions", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:security");
    if (!context || !pool) return;
    const { identityId } = request.params as { identityId: string };
    const reason = text(bodyOf(request), "reason");
    if (!UUID.test(identityId)) return routeError(reply, 400, "A valid identity UUID is required", "IDENTITY_ID_INVALID");
    if (!validReason(reason)) return routeError(reply, 400, "A reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    try {
      const result = await transaction(pool, async (client) => {
        const target = await client.query<{ id: string }>("select id from identities where id=$1 for update", [identityId]);
        if (!target.rows[0]) return { status: 404 as const, body: { error: "Identity not found", code: "IDENTITY_NOT_FOUND" } };
        const sessions = await client.query("update identity_sessions set revoked_at=now() where identity_id=$1 and revoked_at is null", [identityId]);
        await audit(client, request, context.auth.identityId, "IDENTITY_SESSIONS_REVOKED", "identity", identityId, { reason, revokedSessions: sessions.rowCount ?? 0 });
        return { status: 200 as const, body: { source: "postgresql", syntheticData: false, revokedSessions: sessions.rowCount ?? 0 } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Session revocation failed", "SESSION_REVOCATION_UNAVAILABLE");
    }
  });

  app.get("/api/v1/admin/roles", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:roles");
    if (!context || !pool) return;
    try {
      const result = await pool.query(
        `select r.id,r.organization_id,o.name as organization_name,r.name,r.permissions,
          (select count(*)::int from organization_memberships om where om.role_id=r.id and om.status='VERIFIED') as verified_memberships,
          (r.name=any($1::text[])) as reserved
         from roles r join organizations o on o.id=r.organization_id
         order by o.name,r.name limit 300`,
        [[...RESERVED_ROLES]],
      );
      return { source: "postgresql", syntheticData: false, safeEditablePermissions: [...SAFE_PERMISSIONS], roles: result.rows };
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Role directory unavailable", "ROLE_DIRECTORY_UNAVAILABLE");
    }
  });

  app.patch("/api/v1/admin/roles/:roleId/permissions", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:roles");
    if (!context || !pool) return;
    const { roleId } = request.params as { roleId: string };
    const body = bodyOf(request);
    const reason = text(body, "reason");
    const permissions = body.permissions;
    if (!UUID.test(roleId)) return routeError(reply, 400, "A valid role UUID is required", "ROLE_ID_INVALID");
    if (!validReason(reason)) return routeError(reply, 400, "A reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    if (!Array.isArray(permissions) || permissions.length > SAFE_PERMISSIONS.size ||
        permissions.some((p) => typeof p !== "string" || !SAFE_PERMISSIONS.has(p)) ||
        new Set(permissions).size !== permissions.length) {
      return routeError(reply, 400, "Permissions must be a unique list from the approved low-risk permission catalogue", "ROLE_PERMISSIONS_INVALID");
    }
    try {
      const result = await transaction(pool, async (client) => {
        const selected = await client.query<{ id: string; organization_id: string; name: string; permissions: string[] }>(
          "select id,organization_id,name,permissions from roles where id=$1 for update", [roleId],
        );
        const role = selected.rows[0];
        if (!role) return { status: 404 as const, body: { error: "Role not found", code: "ROLE_NOT_FOUND" } };
        if (RESERVED_ROLES.has(role.name)) return { status: 409 as const, body: { error: "Reserved platform roles cannot be edited through the ordinary role editor", code: "RESERVED_ROLE_LOCKED" } };
        if ((role.permissions ?? []).some((p) => PROTECTED_PERMISSIONS.has(p) || !SAFE_PERMISSIONS.has(p))) {
          return { status: 409 as const, body: { error: "This role contains high-risk permissions and requires a separately governed permission-change workflow", code: "HIGH_RISK_ROLE_LOCKED" } };
        }
        const updated = await client.query<{ id: string; organization_id: string; name: string; permissions: string[] }>(
          "update roles set permissions=$2::jsonb where id=$1 returning id,organization_id,name,permissions",
          [roleId, JSON.stringify(permissions)],
        );
        await audit(client, request, context.auth.identityId, "ROLE_PERMISSIONS_UPDATED", "role", roleId,
          { organizationId: role.organization_id, roleName: role.name, previousPermissions: role.permissions, permissions, reason }, role.organization_id);
        return { status: 200 as const, body: { source: "postgresql", syntheticData: false, role: updated.rows[0] } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Role permission update failed", "ROLE_UPDATE_UNAVAILABLE");
    }
  });

  app.post("/api/v1/admin/access-change-requests", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const body = bodyOf(request);
    const requestType = text(body, "requestType");
    const identityId = text(body, "identityId");
    const organizationId = text(body, "organizationId");
    const roleId = text(body, "roleId");
    const membershipId = text(body, "membershipId");
    const reason = text(body, "reason");
    if (!["GRANT_RESERVED_ROLE", "RESTORE_RESERVED_ROLE"].includes(requestType ?? "")) {
      return routeError(reply, 400, "requestType must be GRANT_RESERVED_ROLE or RESTORE_RESERVED_ROLE", "ACCESS_CHANGE_TYPE_INVALID");
    }
    if (!validReason(reason)) return routeError(reply, 400, "A reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    if (requestType === "GRANT_RESERVED_ROLE" && (!identityId || !UUID.test(identityId) || !organizationId || !UUID.test(organizationId) || !roleId || !UUID.test(roleId))) {
      return routeError(reply, 400, "Valid identityId, organizationId and roleId are required for a role grant", "ACCESS_CHANGE_INPUT_INVALID");
    }
    if (requestType === "RESTORE_RESERVED_ROLE" && (!membershipId || !UUID.test(membershipId))) {
      return routeError(reply, 400, "A valid membershipId is required for reserved-role restoration", "ACCESS_CHANGE_INPUT_INVALID");
    }
    try {
      const result = await transaction(pool, async (client) => {
        let target: { identity_id: string; organization_id: string; role_id: string; role_name: string; identity_status: string; suspended_at: Date | null; organization_status: string; role_organization_id: string; membership_id: string | null };
        if (requestType === "GRANT_RESERVED_ROLE") {
          const selected = await client.query<{ identity_status: string; suspended_at: Date | null; organization_status: string; role_name: string; role_organization_id: string }>(
            `select i.status identity_status,i.suspended_at,o.status organization_status,r.name role_name,r.organization_id role_organization_id
             from identities i cross join organizations o join roles r on r.organization_id=o.id
             where i.id=$1 and o.id=$2 and r.id=$3 for update of i,o,r`,
            [identityId, organizationId, roleId],
          );
          const row = selected.rows[0];
          if (!row) return { status: 404 as const, body: { error: "Identity, organization or role not found", code: "ACCESS_CHANGE_TARGET_NOT_FOUND" } };
          if (!RESERVED_ROLES.has(row.role_name) || row.role_organization_id !== organizationId) return { status: 409 as const, body: { error: "Dual control is only available for a reserved platform role belonging to the selected organization", code: "RESERVED_ROLE_REQUIRED" } };
          if (identityId === context.auth.identityId) return { status: 409 as const, body: { error: "You cannot request privileged access for yourself", code: "SELF_ROLE_CHANGE_FORBIDDEN" } };
          if (row.identity_status !== "VERIFIED" || row.suspended_at) return { status: 409 as const, body: { error: "Target identity must be verified and active", code: "IDENTITY_NOT_ACTIVE" } };
          if (row.organization_status !== "VERIFIED") return { status: 409 as const, body: { error: "Target organization must be verified", code: "ORGANIZATION_NOT_VERIFIED" } };
          const prior = await client.query<{ id: string; status: string; last_revoked_at: Date | null }>(
            "select id,status,last_revoked_at from organization_memberships where identity_id=$1 and organization_id=$2 and role_id=$3 for update",
            [identityId, organizationId, roleId],
          );
          if (prior.rows[0]) return { status: 409 as const, body: { error: prior.rows[0].status === "VERIFIED" ? "This privileged membership already exists" : "Previously revoked memberships must use the explicit restoration request", code: "PRIVILEGED_MEMBERSHIP_EXISTS" } };
          target = { identity_id: identityId!, organization_id: organizationId!, role_id: roleId!, role_name: row.role_name, identity_status: row.identity_status, suspended_at: row.suspended_at, organization_status: row.organization_status, role_organization_id: row.role_organization_id, membership_id: null };
        } else {
          const selected = await client.query<{ identity_id: string; organization_id: string; role_id: string; role_name: string; identity_status: string; suspended_at: Date | null; organization_status: string; role_organization_id: string; status: string; last_revoked_at: Date | null }>(
            `select om.identity_id,om.organization_id,om.role_id,r.name role_name,i.status identity_status,i.suspended_at,o.status organization_status,r.organization_id role_organization_id,om.status,om.last_revoked_at
             from organization_memberships om join identities i on i.id=om.identity_id join organizations o on o.id=om.organization_id join roles r on r.id=om.role_id
             where om.id=$1 for update of om,i,o,r`,
            [membershipId],
          );
          const row = selected.rows[0];
          if (!row) return { status: 404 as const, body: { error: "Membership not found", code: "MEMBERSHIP_NOT_FOUND" } };
          if (!RESERVED_ROLES.has(row.role_name) || row.role_organization_id !== row.organization_id || row.status !== "REJECTED" || !row.last_revoked_at) return { status: 409 as const, body: { error: "Only a previously revoked reserved platform-role membership with a valid organization binding can be restored through dual control", code: "RESERVED_ROLE_RESTORE_NOT_ELIGIBLE" } };
          if (row.identity_id === context.auth.identityId) return { status: 409 as const, body: { error: "You cannot request privileged access restoration for yourself", code: "SELF_ROLE_CHANGE_FORBIDDEN" } };
          if (row.identity_status !== "VERIFIED" || row.suspended_at || row.organization_status !== "VERIFIED") return { status: 409 as const, body: { error: "Target identity and organization must be verified and active", code: "ACCESS_CHANGE_TARGET_INACTIVE" } };
          target = { identity_id: row.identity_id, organization_id: row.organization_id, role_id: row.role_id, role_name: row.role_name, identity_status: row.identity_status, suspended_at: row.suspended_at, organization_status: row.organization_status, role_organization_id: row.role_organization_id, membership_id: membershipId };
        }
        const pending = await client.query(
          "select id from platform_access_change_requests where status='PENDING' and request_type=$1 and target_identity_id=$2 and coalesce(membership_id,role_id)=$3 limit 1",
          [requestType, target.identity_id, target.membership_id ?? target.role_id],
        );
        if (pending.rows[0]) return { status: 409 as const, body: { error: "A matching privileged access request is already pending", code: "ACCESS_CHANGE_ALREADY_PENDING" } };
        const requestHash = hash(JSON.stringify({ requestType, identityId: target.identity_id, organizationId: target.organization_id, roleId: target.role_id, membershipId: target.membership_id, requesterIdentityId: context.auth.identityId, reason }));
        const inserted = await client.query<{ id: string }>(
          `insert into platform_access_change_requests(request_type,target_identity_id,organization_id,role_id,membership_id,requester_identity_id,reason,request_hash)
           values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [requestType, target.identity_id, target.organization_id, target.role_id, target.membership_id, context.auth.identityId, reason, requestHash],
        );
        const id = inserted.rows[0]!.id;
        await audit(client, request, context.auth.identityId, "PLATFORM_ACCESS_CHANGE_REQUESTED", "platform_access_change_request", id,
          { requestType, targetIdentityId: target.identity_id, organizationId: target.organization_id, roleId: target.role_id, membershipId: target.membership_id, requestHash, reason }, target.organization_id);
        return { status: 201 as const, body: { source: "postgresql", syntheticData: false, request: { id, requestType, status: "PENDING", requestHash } } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      if ((error as { code?: string }).code === "23505") return routeError(reply, 409, "A matching privileged access request is already pending", "ACCESS_CHANGE_ALREADY_PENDING");
      return routeError(reply, 503, "Privileged access request could not be recorded", "ACCESS_CHANGE_REQUEST_UNAVAILABLE");
    }
  });

  app.get("/api/v1/admin/access-change-requests", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const query = request.query as Record<string, unknown>;
    const status = typeof query.status === "string" ? query.status : "PENDING";
    if (!["PENDING", "APPROVED", "REJECTED", "ALL"].includes(status)) return routeError(reply, 400, "status must be PENDING, APPROVED, REJECTED or ALL", "ACCESS_CHANGE_STATUS_INVALID");
    try {
      const result = await pool.query(
        `select q.id,q.request_type,q.target_identity_id,i.display_name target_display_name,q.organization_id,o.name organization_name,q.role_id,r.name role_name,q.membership_id,q.requester_identity_id,requester.display_name requester_display_name,q.approver_identity_id,approver.display_name approver_display_name,q.status,q.reason,q.decision_reason,q.request_hash,q.created_at,q.decided_at,q.applied_at
         from platform_access_change_requests q
         join identities i on i.id=q.target_identity_id join organizations o on o.id=q.organization_id join roles r on r.id=q.role_id
         join identities requester on requester.id=q.requester_identity_id left join identities approver on approver.id=q.approver_identity_id
         where ($1='ALL' or q.status=$1) order by q.created_at desc limit 100`,
        [status],
      );
      return { source: "postgresql", syntheticData: false, requests: result.rows };
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Privileged access request queue unavailable", "ACCESS_CHANGE_QUEUE_UNAVAILABLE");
    }
  });

  const decideAccessChange = async (request: FastifyRequest, reply: FastifyReply, decision: "APPROVED" | "REJECTED") => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const { requestId } = request.params as { requestId: string };
    const reason = text(bodyOf(request), "reason");
    if (!UUID.test(requestId)) return routeError(reply, 400, "A valid requestId is required", "ACCESS_CHANGE_ID_INVALID");
    if (!validReason(reason)) return routeError(reply, 400, "A decision reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    try {
      const result = await transaction(pool, async (client) => {
        const selected = await client.query<{ id: string; request_type: string; target_identity_id: string; organization_id: string; role_id: string; membership_id: string | null; requester_identity_id: string; status: string; reason: string; request_hash: string }>(
          "select id,request_type,target_identity_id,organization_id,role_id,membership_id,requester_identity_id,status,reason,request_hash from platform_access_change_requests where id=$1 for update",
          [requestId],
        );
        const change = selected.rows[0];
        if (!change) return { status: 404 as const, body: { error: "Access change request not found", code: "ACCESS_CHANGE_NOT_FOUND" } };
        if (change.status !== "PENDING") return { status: 409 as const, body: { error: "Access change request has already been decided", code: "ACCESS_CHANGE_ALREADY_DECIDED" } };
        if (change.requester_identity_id === context.auth.identityId) return { status: 409 as const, body: { error: "A different Super Admin must decide this request", code: "DUAL_CONTROL_SELF_APPROVAL_FORBIDDEN" } };
        if (change.target_identity_id === context.auth.identityId) return { status: 409 as const, body: { error: "The target identity cannot approve its own privileged access change", code: "DUAL_CONTROL_TARGET_APPROVAL_FORBIDDEN" } };
        const expectedRequestHash = hash(JSON.stringify({
          requestType: change.request_type,
          identityId: change.target_identity_id,
          organizationId: change.organization_id,
          roleId: change.role_id,
          membershipId: change.membership_id,
          requesterIdentityId: change.requester_identity_id,
          reason: change.reason,
        }));
        if (expectedRequestHash !== change.request_hash) return { status: 409 as const, body: { error: "Access request contents no longer match their recorded integrity hash", code: "ACCESS_CHANGE_INTEGRITY_MISMATCH" } };
        const authorities = await client.query<{ requester_active: boolean; approver_active: boolean }>(
          `select
             exists(select 1 from organization_memberships om join roles r on r.id=om.role_id join identities i on i.id=om.identity_id join organizations o on o.id=om.organization_id and o.status='VERIFIED'
                    where om.identity_id=$1 and om.status='VERIFIED' and r.name='super_admin' and i.status='VERIFIED' and i.suspended_at is null
                      and exists(select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')) requester_active,
             exists(select 1 from organization_memberships om join roles r on r.id=om.role_id join identities i on i.id=om.identity_id join organizations o on o.id=om.organization_id and o.status='VERIFIED'
                    where om.identity_id=$2 and om.status='VERIFIED' and r.name='super_admin' and i.status='VERIFIED' and i.suspended_at is null
                      and exists(select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')) approver_active`,
          [change.requester_identity_id, context.auth.identityId],
        );
        if (!authorities.rows[0]?.requester_active || !authorities.rows[0]?.approver_active) return { status: 403 as const, body: { error: "Requester and approver must both remain active Super Admins", code: "DUAL_CONTROL_AUTHORITY_REQUIRED" } };
        if (decision === "REJECTED") {
          await client.query(
            "update platform_access_change_requests set status='REJECTED',approver_identity_id=$2,decision_reason=$3,decided_at=clock_timestamp() where id=$1",
            [requestId, context.auth.identityId, reason],
          );
          await audit(client, request, context.auth.identityId, "PLATFORM_ACCESS_CHANGE_REJECTED", "platform_access_change_request", requestId,
            { requestType: change.request_type, requesterIdentityId: change.requester_identity_id, decisionReason: reason }, change.organization_id);
          return { status: 200 as const, body: { source: "postgresql", syntheticData: false, requestId, status: "REJECTED" } };
        }

        const target = await client.query<{ identity_status: string; suspended_at: Date | null; organization_status: string; role_name: string; role_organization_id: string }>(
          `select i.status identity_status,i.suspended_at,o.status organization_status,r.name role_name,r.organization_id role_organization_id
           from identities i cross join organizations o join roles r on r.organization_id=o.id
           where i.id=$1 and o.id=$2 and r.id=$3 for update of i,o,r`,
          [change.target_identity_id, change.organization_id, change.role_id],
        );
        const targetRow = target.rows[0];
        if (!targetRow || !RESERVED_ROLES.has(targetRow.role_name) || targetRow.role_organization_id !== change.organization_id) return { status: 409 as const, body: { error: "Reserved role or organization binding changed after request", code: "ACCESS_CHANGE_TARGET_CHANGED" } };
        if (targetRow.identity_status !== "VERIFIED" || targetRow.suspended_at || targetRow.organization_status !== "VERIFIED") return { status: 409 as const, body: { error: "Target identity and organization must remain verified and active", code: "ACCESS_CHANGE_TARGET_INACTIVE" } };
        let membershipId: string;
        if (change.request_type === "GRANT_RESERVED_ROLE") {
          const existing = await client.query<{ id: string; status: string; last_revoked_at: Date | null }>(
            "select id,status,last_revoked_at from organization_memberships where identity_id=$1 and organization_id=$2 and role_id=$3 for update",
            [change.target_identity_id, change.organization_id, change.role_id],
          );
          if (existing.rows[0]) return { status: 409 as const, body: { error: "Membership state changed; submit a new request for the current state", code: "ACCESS_CHANGE_MEMBERSHIP_CHANGED" } };
          // Mark the approval within this transaction before INSERT so the database trigger can
          // verify the matching two-person request. If the membership insert fails, the approval rolls back.
          await client.query(
            "update platform_access_change_requests set status='APPROVED',approver_identity_id=$2,decision_reason=$3,decided_at=clock_timestamp(),applied_at=clock_timestamp() where id=$1",
            [requestId, context.auth.identityId, reason],
          );
          const inserted = await client.query<{ id: string }>(
            "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
            [change.target_identity_id, change.organization_id, change.role_id],
          );
          membershipId = inserted.rows[0]!.id;
        } else {
          const existing = await client.query<{ id: string; identity_id: string; organization_id: string; role_id: string; status: string; last_revoked_at: Date | null }>(
            `select om.id,om.identity_id,om.organization_id,om.role_id,om.status,om.last_revoked_at
             from organization_memberships om where om.id=$1 for update`,
            [change.membership_id],
          );
          const membership = existing.rows[0];
          if (!membership || membership.identity_id !== change.target_identity_id || membership.organization_id !== change.organization_id || membership.role_id !== change.role_id || membership.status !== "REJECTED" || !membership.last_revoked_at || !RESERVED_ROLES.has(targetRow.role_name)) {
            return { status: 409 as const, body: { error: "Reserved-role membership state changed; submit a new request", code: "ACCESS_CHANGE_MEMBERSHIP_CHANGED" } };
          }
          // The database trigger requires a completed, matching two-person approval before
          // it permits a reserved membership to transition back to VERIFIED. If the update
          // fails, this status change rolls back with the enclosing transaction.
          await client.query(
            "update platform_access_change_requests set status='APPROVED',approver_identity_id=$2,decision_reason=$3,decided_at=clock_timestamp(),applied_at=clock_timestamp() where id=$1",
            [requestId, context.auth.identityId, reason],
          );
          await client.query("update organization_memberships set status='VERIFIED' where id=$1", [change.membership_id]);
          membershipId = change.membership_id!;
        }
        const action = change.request_type === "RESTORE_RESERVED_ROLE" ? "RESERVED_ROLE_RESTORED_DUAL_CONTROL" : "RESERVED_ROLE_GRANTED_DUAL_CONTROL";
        await audit(client, request, context.auth.identityId, action, "organization_membership", membershipId,
          { requestId, requestType: change.request_type, requesterIdentityId: change.requester_identity_id, approverIdentityId: context.auth.identityId, reason, decisionReason: reason }, change.organization_id);
        return { status: 200 as const, body: { source: "postgresql", syntheticData: false, requestId, membershipId, status: "APPROVED", applied: true } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Privileged access decision failed", "ACCESS_CHANGE_DECISION_UNAVAILABLE");
    }
  };

  app.post("/api/v1/admin/access-change-requests/:requestId/approve", async (request, reply) => decideAccessChange(request, reply, "APPROVED"));
  app.post("/api/v1/admin/access-change-requests/:requestId/reject", async (request, reply) => decideAccessChange(request, reply, "REJECTED"));

  app.get("/api/v1/admin/memberships", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const query = request.query as Record<string, unknown>;
    const identityId = typeof query.identityId === "string" ? query.identityId : "";
    const organizationId = typeof query.organizationId === "string" ? query.organizationId : "";
    if ((identityId && !UUID.test(identityId)) || (organizationId && !UUID.test(organizationId))) {
      return routeError(reply, 400, "Identity and organization filters must be valid UUIDs", "MEMBERSHIP_FILTER_INVALID");
    }
    try {
      const result = await pool.query(
        `select om.id,om.identity_id, i.display_name,i.email,om.organization_id,o.name organization_name,
          om.role_id,r.name role_name,om.status,om.created_at,om.last_revoked_at,om.last_revocation_reason
         from organization_memberships om join identities i on i.id=om.identity_id
         join organizations o on o.id=om.organization_id join roles r on r.id=om.role_id
         where ($1='' or om.identity_id::text=$1) and ($2='' or om.organization_id::text=$2)
         order by o.name,i.display_name,r.name limit 300`,
        [identityId, organizationId],
      );
      return { source: "postgresql", syntheticData: false, memberships: result.rows };
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Membership directory unavailable", "MEMBERSHIP_DIRECTORY_UNAVAILABLE");
    }
  });

  app.post("/api/v1/admin/memberships", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const body = bodyOf(request);
    const identityId = text(body, "identityId");
    const organizationId = text(body, "organizationId");
    const roleId = text(body, "roleId");
    const reason = text(body, "reason");
    if (!identityId || !UUID.test(identityId) || !organizationId || !UUID.test(organizationId) || !roleId || !UUID.test(roleId)) {
      return routeError(reply, 400, "Valid identityId, organizationId and roleId are required", "MEMBERSHIP_INPUT_INVALID");
    }
    if (identityId === context.auth.identityId) return routeError(reply, 409, "You cannot grant or escalate your own membership", "SELF_ROLE_CHANGE_FORBIDDEN");
    if (!validReason(reason)) return routeError(reply, 400, "A reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    try {
      const result = await transaction(pool, async (client) => {
        const selected = await client.query<{ identity_status: string; suspended_at: Date | null; organization_status: string; role_name: string; role_organization_id: string; role_permissions: string[] }>(
          `select i.status identity_status,i.suspended_at,o.status organization_status,r.name role_name,r.organization_id role_organization_id,r.permissions role_permissions
           from identities i cross join organizations o join roles r on r.organization_id=o.id
           where i.id=$1 and o.id=$2 and r.id=$3 for update of i,o,r`,
          [identityId, organizationId, roleId],
        );
        const target = selected.rows[0];
        if (!target) return { status: 404 as const, body: { error: "Identity, organization or role not found", code: "MEMBERSHIP_TARGET_NOT_FOUND" } };
        if (target.identity_status !== "VERIFIED" || target.suspended_at) return { status: 409 as const, body: { error: "Target identity must be verified and active", code: "IDENTITY_NOT_ACTIVE" } };
        if (target.organization_status !== "VERIFIED") return { status: 409 as const, body: { error: "Membership cannot be granted until the organization is verified", code: "ORGANIZATION_NOT_VERIFIED" } };
        if (target.role_organization_id !== organizationId) return { status: 400 as const, body: { error: "Role does not belong to the target organization", code: "ROLE_ORGANIZATION_MISMATCH" } };
        if (RESERVED_ROLES.has(target.role_name)) return { status: 409 as const, body: { error: "Platform-reserved roles require a separate dual-control workflow and cannot be granted here", code: "RESERVED_ROLE_GRANT_BLOCKED" } };
        if ((target.role_permissions ?? []).some((permission) => PROTECTED_PERMISSIONS.has(permission) || !SAFE_PERMISSIONS.has(permission))) return { status: 409 as const, body: { error: "This role contains high-risk permissions and requires a separately approved access-grant workflow", code: "HIGH_RISK_ROLE_GRANT_BLOCKED" } };
        const prior = await client.query<{ id: string; status: string; last_revoked_at: Date | null }>(
          "select id,status,last_revoked_at from organization_memberships where identity_id=$1 and organization_id=$2 and role_id=$3 for update",
          [identityId, organizationId, roleId],
        );
        let membershipId: string;
        let action: string;
        if (prior.rows[0]) {
          if (prior.rows[0].status === "VERIFIED") return { status: 409 as const, body: { error: "This verified membership already exists", code: "MEMBERSHIP_EXISTS" } };
          if (prior.rows[0].status !== "REJECTED" || !prior.rows[0].last_revoked_at) return { status: 409 as const, body: { error: "Only a previously revoked membership may be restored; pending or rejected applications require their original review workflow", code: "MEMBERSHIP_RESTORE_FORBIDDEN" } };
          const restored = await client.query<{ id: string }>("update organization_memberships set status='VERIFIED' where id=$1 returning id", [prior.rows[0].id]);
          membershipId = restored.rows[0]!.id;
          action = "MEMBERSHIP_RESTORED";
        } else {
          const inserted = await client.query<{ id: string }>(
            "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
            [identityId, organizationId, roleId],
          );
          membershipId = inserted.rows[0]!.id;
          action = "MEMBERSHIP_GRANTED";
        }
        await audit(client, request, context.auth.identityId, action, "organization_membership", membershipId,
          { identityId, organizationId, roleId, roleName: target.role_name, reason }, organizationId);
        return { status: 201 as const, body: { source: "postgresql", syntheticData: false, membershipId, status: "VERIFIED" } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Membership grant failed", "MEMBERSHIP_GRANT_UNAVAILABLE");
    }
  });

  app.patch("/api/v1/admin/memberships/:membershipId/status", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const { membershipId } = request.params as { membershipId: string };
    const body = bodyOf(request);
    const requestedStatus = text(body, "status");
    const reason = text(body, "reason");
    if (!UUID.test(membershipId)) return routeError(reply, 400, "A valid membership UUID is required", "MEMBERSHIP_ID_INVALID");
    if (!["VERIFIED", "REVOKED"].includes(requestedStatus ?? "")) return routeError(reply, 400, "status must be VERIFIED or REVOKED", "MEMBERSHIP_STATUS_INVALID");
    if (!validReason(reason)) return routeError(reply, 400, "A reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    try {
      const result = await transaction(pool, async (client) => {
        // Acquire the global membership-revocation lock before row locks. This prevents
        // opposite-direction concurrent revocations from deadlocking while each holds
        // its own target membership and waits for the other target's identity/role rows.
        if (requestedStatus === "REVOKED") await client.query("select pg_advisory_xact_lock(82026011)");
        const selected = await client.query<{ id: string; identity_id: string; organization_id: string; organization_status: string; role_id: string; role_name: string; status: string; identity_status: string; suspended_at: Date | null; last_revoked_at: Date | null }>(
          `select om.id,om.identity_id,om.organization_id,o.status organization_status,om.role_id,r.name role_name,
             om.status,i.status identity_status,i.suspended_at,om.last_revoked_at
           from organization_memberships om join identities i on i.id=om.identity_id
           join organizations o on o.id=om.organization_id join roles r on r.id=om.role_id
           where om.id=$1 for update of om,i,o,r`,
          [membershipId],
        );
        const m = selected.rows[0];
        if (!m) return { status: 404 as const, body: { error: "Membership not found", code: "MEMBERSHIP_NOT_FOUND" } };
        if (m.identity_id === context.auth.identityId && m.role_name === "super_admin") return { status: 409 as const, body: { error: "You cannot modify your own Super Admin membership", code: "SELF_ROLE_CHANGE_FORBIDDEN" } };
        if (RESERVED_ROLES.has(m.role_name) && requestedStatus === "VERIFIED") return { status: 409 as const, body: { error: "Reserved platform-role restoration requires a separate approved workflow", code: "RESERVED_ROLE_RESTORE_BLOCKED" } };
        if (requestedStatus === "VERIFIED") {
          if (m.status === "VERIFIED") return { status: 200 as const, body: { source: "postgresql", syntheticData: false, replay: true, status: "VERIFIED" } };
          if (m.status !== "REJECTED" || !m.last_revoked_at) return { status: 409 as const, body: { error: "Only a previously revoked membership can be restored", code: "MEMBERSHIP_RESTORE_FORBIDDEN" } };
          if (m.identity_status !== "VERIFIED" || m.suspended_at || m.organization_status !== "VERIFIED") return { status: 409 as const, body: { error: "Identity and organization must be verified and active", code: "MEMBERSHIP_TARGET_INACTIVE" } };
          await client.query("update organization_memberships set status='VERIFIED' where id=$1", [membershipId]);
          await audit(client, request, context.auth.identityId, "MEMBERSHIP_RESTORED", "organization_membership", membershipId,
            { identityId: m.identity_id, organizationId: m.organization_id, roleName: m.role_name, reason }, m.organization_id);
          return { status: 200 as const, body: { source: "postgresql", syntheticData: false, status: "VERIFIED" } };
        }
        if (m.status !== "VERIFIED") return { status: 200 as const, body: { source: "postgresql", syntheticData: false, replay: true, status: "REVOKED" } };
        if (m.role_name === "super_admin") {
          const count = await client.query<{ count: string }>(
            `select count(distinct om.identity_id)::text count from organization_memberships om join roles r on r.id=om.role_id
             join identities i on i.id=om.identity_id where r.name='super_admin' and om.status='VERIFIED'
             and i.status='VERIFIED' and i.suspended_at is null`,
          );
          if (Number(count.rows[0]?.count ?? 0) <= 1) return { status: 409 as const, body: { error: "The last active Super Admin cannot be revoked", code: "LAST_SUPER_ADMIN_PROTECTED" } };
        }
        await client.query(
          "update organization_memberships set status='REJECTED',last_revoked_at=now(),last_revoked_by_identity_id=$2,last_revocation_reason=$3 where id=$1",
          [membershipId, context.auth.identityId, reason],
        );
        await client.query("update identity_sessions set revoked_at=now() where identity_id=$1 and revoked_at is null", [m.identity_id]);
        await audit(client, request, context.auth.identityId, "MEMBERSHIP_REVOKED", "organization_membership", membershipId,
          { identityId: m.identity_id, organizationId: m.organization_id, roleName: m.role_name, reason }, m.organization_id);
        return { status: 200 as const, body: { source: "postgresql", syntheticData: false, status: "REVOKED", sessionsRevoked: true } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Membership status change failed", "MEMBERSHIP_STATUS_UNAVAILABLE");
    }
  });

  app.get("/api/v1/admin/audit-events", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:security");
    if (!context || !pool) return;
    const query = request.query as Record<string, unknown>;
    const value = Number(query.limit ?? 50);
    const limit = Number.isInteger(value) ? Math.max(1, Math.min(200, value)) : 50;
    try {
      const result = await pool.query(
        `select id,actor_identity_id,organization_id,action,target_type,target_id,request_id,previous_hash,event_hash,payload,created_at
         from audit_events order by created_at desc,id desc limit $1`,
        [limit],
      );
      return { source: "postgresql", syntheticData: false, auditEvents: result.rows };
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Security audit log unavailable", "AUDIT_LOG_UNAVAILABLE");
    }
  });

  app.post("/api/v1/admin/stakeholder-authorization-requests", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const body = bodyOf(request);
    const organizationId = text(body, "organizationId");
    const stakeholderType = text(body, "stakeholderType");
    const requestAction = text(body, "action") ?? "VERIFY";
    const evidenceReference = text(body, "evidenceReference");
    const evidenceSha256 = text(body, "evidenceSha256");
    const reason = text(body, "reason");
    const expiresAtRaw = text(body, "expiresAt");
    const allowedTypes = ["BWG", "WASTE_FACILITY", "ULB", "DISTRICT_PANCHAYAT", "GRAM_PANCHAYAT", "COLLECTOR_TRANSPORTER", "PROCESSOR"];
    if (!organizationId || !UUID.test(organizationId) || !stakeholderType || !allowedTypes.includes(stakeholderType)
      || !["VERIFY", "REVOKE"].includes(requestAction) || !evidenceReference || evidenceReference.length > 1000 || !evidenceSha256 || !/^[0-9a-f]{64}$/.test(evidenceSha256)
      || !validReason(reason) || (expiresAtRaw && !Number.isFinite(Date.parse(expiresAtRaw)))) {
      return routeError(reply, 400, "Valid organization, stakeholder type, evidence reference, SHA-256, reason and optional expiry are required", "STAKEHOLDER_AUTHORIZATION_INPUT_INVALID");
    }
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) return routeError(reply, 400, "Expiry must be in the future", "STAKEHOLDER_AUTHORIZATION_EXPIRY_INVALID");
    try {
      const result = await transaction(pool, async (client) => {
        const org = await client.query<{ status: string; verification_status: string }>(
          "select status,verification_status from organizations where id=$1 for update", [organizationId],
        );
        if (!org.rows[0]) return { status: 404 as const, body: { error: "Organization not found", code: "ORGANIZATION_NOT_FOUND" } };
        if (org.rows[0].status !== "VERIFIED" || org.rows[0].verification_status !== "VERIFIED") return { status: 409 as const, body: { error: "Organization must already be independently verified", code: "ORGANIZATION_NOT_VERIFIED" } };
        const existing = await client.query<{ status: string }>(
          "select status from organization_stakeholder_authorizations where organization_id=$1 and stakeholder_type=$2 for update",
          [organizationId, stakeholderType],
        );
        if (requestAction === "VERIFY" && existing.rows[0]?.status === "VERIFIED") return { status: 409 as const, body: { error: "A verified mapping already exists; revoke it through a governed process before replacing it", code: "STAKEHOLDER_AUTHORIZATION_ALREADY_VERIFIED" } };
        if (requestAction === "REVOKE" && existing.rows[0]?.status !== "VERIFIED") return { status: 409 as const, body: { error: "Only a currently verified mapping can be submitted for revocation", code: "STAKEHOLDER_AUTHORIZATION_NOT_VERIFIED" } };
        const pending = await client.query(
          "select id from organization_stakeholder_authorization_requests where organization_id=$1 and stakeholder_type=$2 and status='PENDING' limit 1",
          [organizationId, stakeholderType],
        );
        if (pending.rows[0]) return { status: 409 as const, body: { error: "A matching stakeholder authorization request is already pending", code: "STAKEHOLDER_AUTHORIZATION_ALREADY_PENDING" } };
        const requestHash = hash(JSON.stringify({
          organizationId, stakeholderType, requestAction, evidenceReference, evidenceSha256,
          requestReason: reason, requesterIdentityId: context.auth.identityId,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
        }));
        const inserted = await client.query<{ id: string }>(
          `insert into organization_stakeholder_authorization_requests
            (organization_id,stakeholder_type,request_action,evidence_reference,evidence_sha256,request_reason,request_hash,requested_by_identity_id,expires_at)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
          [organizationId, stakeholderType, requestAction, evidenceReference, evidenceSha256, reason, requestHash, context.auth.identityId, expiresAt],
        );
        const id = inserted.rows[0]!.id;
        await audit(client, request, context.auth.identityId, "STAKEHOLDER_AUTHORIZATION_REQUESTED", "organization_stakeholder_authorization_request", id,
          { organizationId, stakeholderType, requestAction, evidenceReference, evidenceSha256, requestHash, reason, expiresAt: expiresAt?.toISOString() ?? null }, organizationId);
        return { status: 201 as const, body: { source: "postgresql", syntheticData: false, request: { id, organizationId, stakeholderType, action: requestAction, status: "PENDING", requestHash } } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      if ((error as { code?: string }).code === "23505") return routeError(reply, 409, "A matching stakeholder authorization request is already pending", "STAKEHOLDER_AUTHORIZATION_ALREADY_PENDING");
      return routeError(reply, 503, "Stakeholder authorization request could not be recorded", "STAKEHOLDER_AUTHORIZATION_REQUEST_UNAVAILABLE");
    }
  });

  app.get("/api/v1/admin/stakeholder-authorization-requests", async (request, reply) => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const query = request.query as Record<string, unknown>;
    const status = typeof query.status === "string" ? query.status : "PENDING";
    if (!["PENDING", "APPROVED", "REJECTED", "ALL"].includes(status)) return routeError(reply, 400, "status must be PENDING, APPROVED, REJECTED or ALL", "STAKEHOLDER_AUTHORIZATION_STATUS_INVALID");
    try {
      const result = await pool.query(
        `select q.id,q.organization_id,o.name organization_name,q.stakeholder_type,q.status,q.evidence_reference,q.evidence_sha256,
          q.request_reason,q.request_hash,q.requested_by_identity_id,requester.display_name requester_display_name,
          q.decided_by_identity_id,decider.display_name decider_display_name,q.decision_reason,q.expires_at,q.created_at,q.decided_at,q.applied_at
         from organization_stakeholder_authorization_requests q
         join organizations o on o.id=q.organization_id
         join identities requester on requester.id=q.requested_by_identity_id
         left join identities decider on decider.id=q.decided_by_identity_id
         where ($1='ALL' or q.status=$1) order by q.created_at desc limit 100`, [status],
      );
      return { source: "postgresql", syntheticData: false, requests: result.rows };
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Stakeholder authorization queue unavailable", "STAKEHOLDER_AUTHORIZATION_QUEUE_UNAVAILABLE");
    }
  });

  const decideStakeholderAuthorization = async (request: FastifyRequest, reply: FastifyReply, decision: "APPROVED" | "REJECTED") => {
    const context = await authorize(request, reply, pool, "admin:users");
    if (!context || !pool) return;
    const { requestId } = request.params as { requestId: string };
    const decisionReason = text(bodyOf(request), "reason");
    if (!UUID.test(requestId)) return routeError(reply, 400, "A valid requestId is required", "STAKEHOLDER_AUTHORIZATION_REQUEST_ID_INVALID");
    if (!validReason(decisionReason)) return routeError(reply, 400, "A decision reason of 8–1000 characters is required", "ADMIN_REASON_REQUIRED");
    try {
      const result = await transaction(pool, async (client) => {
        const selected = await client.query<{
          id: string; organization_id: string; stakeholder_type: string; request_action: string; status: string; evidence_reference: string;
          evidence_sha256: string; request_reason: string; request_hash: string; requested_by_identity_id: string; expires_at: Date | null;
        }>(
          "select id,organization_id,stakeholder_type,request_action,status,evidence_reference,evidence_sha256,request_reason,request_hash,requested_by_identity_id,expires_at from organization_stakeholder_authorization_requests where id=$1 for update",
          [requestId],
        );
        const item = selected.rows[0];
        if (!item) return { status: 404 as const, body: { error: "Stakeholder authorization request not found", code: "STAKEHOLDER_AUTHORIZATION_REQUEST_NOT_FOUND" } };
        if (item.status !== "PENDING") return { status: 409 as const, body: { error: "Request has already been decided", code: "STAKEHOLDER_AUTHORIZATION_ALREADY_DECIDED" } };
        if (item.requested_by_identity_id === context.auth.identityId) return { status: 409 as const, body: { error: "A different Super Admin must decide this request", code: "STAKEHOLDER_AUTHORIZATION_SELF_APPROVAL_FORBIDDEN" } };
        const expiry = item.expires_at ? new Date(item.expires_at).toISOString() : null;
        const expectedHash = hash(JSON.stringify({
          organizationId: item.organization_id, stakeholderType: item.stakeholder_type, requestAction: item.request_action,
          evidenceReference: item.evidence_reference, evidenceSha256: item.evidence_sha256,
          requestReason: item.request_reason, requesterIdentityId: item.requested_by_identity_id, expiresAt: expiry,
        }));
        if (expectedHash !== item.request_hash) return { status: 409 as const, body: { error: "Request contents do not match their integrity hash", code: "STAKEHOLDER_AUTHORIZATION_INTEGRITY_MISMATCH" } };
        const authorities = await client.query<{ requester_active: boolean; approver_active: boolean }>(
          `select
            exists(select 1 from organization_memberships om join roles r on r.id=om.role_id join identities i on i.id=om.identity_id
              where om.identity_id=$1 and om.status='VERIFIED' and r.name='super_admin' and i.status='VERIFIED' and i.suspended_at is null
                and exists(select 1 from jsonb_array_elements_text(r.permissions) p where p='admin:users')) requester_active,
            exists(select 1 from organization_memberships om join roles r on r.id=om.role_id join identities i on i.id=om.identity_id
              where om.identity_id=$2 and om.status='VERIFIED' and r.name='super_admin' and i.status='VERIFIED' and i.suspended_at is null
                and exists(select 1 from jsonb_array_elements_text(r.permissions) p where p='admin:users')) approver_active`,
          [item.requested_by_identity_id, context.auth.identityId],
        );
        if (!authorities.rows[0]?.requester_active || !authorities.rows[0]?.approver_active) return { status: 403 as const, body: { error: "Requester and approver must both remain active Super Admins", code: "STAKEHOLDER_AUTHORIZATION_DUAL_CONTROL_REQUIRED" } };
        const org = await client.query<{ status: string; verification_status: string }>(
          "select status,verification_status from organizations where id=$1 for update", [item.organization_id],
        );
        if (!org.rows[0] || org.rows[0].status !== "VERIFIED" || org.rows[0].verification_status !== "VERIFIED") return { status: 409 as const, body: { error: "Organization verification changed; request cannot be approved", code: "STAKEHOLDER_AUTHORIZATION_ORGANIZATION_CHANGED" } };
        if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) return { status: 409 as const, body: { error: "Request expiry has passed; submit a new request", code: "STAKEHOLDER_AUTHORIZATION_REQUEST_EXPIRED" } };
        if (decision === "REJECTED") {
          await client.query("update organization_stakeholder_authorization_requests set status='REJECTED',decided_by_identity_id=$2,decision_reason=$3,decided_at=clock_timestamp() where id=$1", [requestId, context.auth.identityId, decisionReason]);
          await audit(client, request, context.auth.identityId, "STAKEHOLDER_AUTHORIZATION_REJECTED", "organization_stakeholder_authorization_request", requestId,
            { organizationId: item.organization_id, stakeholderType: item.stakeholder_type, requesterIdentityId: item.requested_by_identity_id, decisionReason }, item.organization_id);
          return { status: 200 as const, body: { source: "postgresql", syntheticData: false, requestId, status: "REJECTED", applied: false } };
        }
        const existingMapping = await client.query<{ id: string; status: string }>(
          "select id,status from organization_stakeholder_authorizations where organization_id=$1 and stakeholder_type=$2 for update",
          [item.organization_id, item.stakeholder_type],
        );
        if (item.request_action === "REVOKE" && existingMapping.rows[0]?.status !== "VERIFIED") return { status: 409 as const, body: { error: "Verified mapping state changed; submit a new revocation request", code: "STAKEHOLDER_AUTHORIZATION_STATE_CHANGED" } };
        if (item.request_action === "VERIFY" && existingMapping.rows[0]?.status === "VERIFIED") return { status: 409 as const, body: { error: "A verified stakeholder mapping already exists; revoke it through a governed process before replacing it", code: "STAKEHOLDER_AUTHORIZATION_ALREADY_VERIFIED" } };
        await client.query("update organization_stakeholder_authorization_requests set status='APPROVED',decided_by_identity_id=$2,decision_reason=$3,decided_at=clock_timestamp(),applied_at=clock_timestamp() where id=$1", [requestId, context.auth.identityId, decisionReason]);
        if (item.request_action === "REVOKE") {
          await client.query("update organization_stakeholder_authorizations set status='REVOKED',updated_at=clock_timestamp() where id=$1", [existingMapping.rows[0]!.id]);
          await audit(client, request, context.auth.identityId, "STAKEHOLDER_AUTHORIZATION_REVOKED", "organization_stakeholder_authorization", existingMapping.rows[0]!.id,
            { requestId, organizationId: item.organization_id, stakeholderType: item.stakeholder_type, requesterIdentityId: item.requested_by_identity_id, approverIdentityId: context.auth.identityId, evidenceReference: item.evidence_reference, evidenceSha256: item.evidence_sha256, decisionReason }, item.organization_id);
          return { status: 200 as const, body: { source: "postgresql", syntheticData: false, requestId, authorizationId: existingMapping.rows[0]!.id, status: "REVOKED", applied: true } };
        }
        const mapping = await client.query<{ id: string }>(
          `insert into organization_stakeholder_authorizations
            (organization_id,stakeholder_type,status,evidence_reference,evidence_sha256,verification_note,verified_by_identity_id,verified_at,expires_at,approval_request_id)
           values($1,$2,'VERIFIED',$3,$4,$5,$6,clock_timestamp(),$7,$8)
           on conflict (organization_id,stakeholder_type) do update set
             status='VERIFIED',evidence_reference=excluded.evidence_reference,evidence_sha256=excluded.evidence_sha256,
             verification_note=excluded.verification_note,verified_by_identity_id=excluded.verified_by_identity_id,
             verified_at=excluded.verified_at,expires_at=excluded.expires_at,approval_request_id=excluded.approval_request_id,updated_at=clock_timestamp()
           where organization_stakeholder_authorizations.status in ('PENDING','REVOKED')
           returning id`,
          [item.organization_id, item.stakeholder_type, item.evidence_reference, item.evidence_sha256, decisionReason, context.auth.identityId, item.expires_at, requestId],
        );
        if (!mapping.rows[0]) throw new Error("STAKEHOLDER_AUTHORIZATION_ALREADY_VERIFIED");
        await audit(client, request, context.auth.identityId, "STAKEHOLDER_AUTHORIZATION_APPROVED", "organization_stakeholder_authorization", mapping.rows[0].id,
          { requestId, organizationId: item.organization_id, stakeholderType: item.stakeholder_type, requesterIdentityId: item.requested_by_identity_id, approverIdentityId: context.auth.identityId, evidenceReference: item.evidence_reference, evidenceSha256: item.evidence_sha256, expiresAt: expiry, decisionReason }, item.organization_id);
        return { status: 200 as const, body: { source: "postgresql", syntheticData: false, requestId, authorizationId: mapping.rows[0].id, status: "APPROVED", applied: true } };
      });
      return reply.code(result.status).send(result.body);
    } catch (error) {
      request.log.error(error);
      return routeError(reply, 503, "Stakeholder authorization decision failed", "STAKEHOLDER_AUTHORIZATION_DECISION_UNAVAILABLE");
    }
  };
  app.post("/api/v1/admin/stakeholder-authorization-requests/:requestId/approve", async (request, reply) => decideStakeholderAuthorization(request, reply, "APPROVED"));
  app.post("/api/v1/admin/stakeholder-authorization-requests/:requestId/reject", async (request, reply) => decideStakeholderAuthorization(request, reply, "REJECTED"));

}
