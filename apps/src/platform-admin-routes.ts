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
  // Serialize this route's hash-linked audit writes to avoid concurrent branches.
  await client.query("select pg_advisory_xact_lock(82026010)");
  const prior = await client.query<{ event_hash: string }>(
    "select event_hash from audit_events order by created_at desc, id desc limit 1",
  );
  const previousHash = prior.rows[0]?.event_hash ?? null;
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
  await client.query(
    `insert into audit_events(actor_identity_id,organization_id,action,target_type,target_id,request_id,previous_hash,event_hash,payload,created_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp())`,
    [actorId, organizationId, action, targetType, targetId, request.id, previousHash, eventHash, JSON.stringify(payload)],
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
        if (m.role_name === "super_admin" && requestedStatus === "VERIFIED") return { status: 409 as const, body: { error: "Super Admin restoration requires a separate dual-control workflow", code: "RESERVED_ROLE_RESTORE_BLOCKED" } };
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
          await client.query("select pg_advisory_xact_lock(82026011)");
          const count = await client.query<{ count: string }>(
            `select count(*)::text count from organization_memberships om join roles r on r.id=om.role_id
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
}
