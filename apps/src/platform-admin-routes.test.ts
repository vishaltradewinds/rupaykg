import test from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerPlatformAdminRoutes } from "./platform-admin-routes.js";
import { auditEventV2FromRow, hashPlatformAuditEventV2 } from "./platform-audit-hash.js";

const identityId = "123e4567-e89b-42d3-a456-426614174000";
const organizationId = "223e4567-e89b-42d3-a456-426614174000";
const roleId = "323e4567-e89b-42d3-a456-426614174000";

function fakePool(isSuperAdmin: boolean): Pool {
  return {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) {
        return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      }
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: isSuperAdmin }] };
      if (sql.includes('as "verifiedIdentities"')) return { rows: [{
        verifiedIdentities: "12",
        organizations: "7",
        verifiedMemberships: "9",
        pendingApplications: "3",
        pendingLegalReviews: "2",
        anchoredMrvRecords: "4",
      }] };
      throw new Error(`Unexpected SQL in platform-admin test: ${sql}`);
    },
  } as unknown as Pool;
}

test("platform admin overview fails closed without a database", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, null);
  const response = await app.inject({ method: "GET", url: "/api/v1/admin/overview" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, "DATABASE_UNAVAILABLE");
  await app.close();
});

test("platform admin overview requires an authenticated session", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(true));
  const response = await app.inject({ method: "GET", url: "/api/v1/admin/overview" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "AUTH_REQUIRED");
  await app.close();
});

test("platform admin overview denies ordinary verified members", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(false));
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/admin/overview",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "PLATFORM_ADMIN_FORBIDDEN");
  await app.close();
});

test("Super Admin receives platform-wide aggregate counts only", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(true));
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/admin/overview",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    source: "postgresql",
    syntheticData: false,
    scope: "PLATFORM",
    counts: {
      verifiedIdentities: 12,
      organizations: 7,
      verifiedMemberships: 9,
      pendingApplications: 3,
      pendingLegalReviews: 2,
      anchoredMrvRecords: 4,
    },
  });
  await app.close();
});

test("ordinary verified members cannot access the identity directory", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(false));
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/admin/identities",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "PLATFORM_ADMIN_FORBIDDEN");
  await app.close();
});

test("Super Admin cannot suspend their own identity", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(true));
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/admin/identities/${identityId}/suspend`,
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Prevent accidental self-lockout" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "SELF_SUSPENSION_FORBIDDEN");
  await app.close();
});

test("role editor rejects privileged permissions from its safe permission catalogue", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(true));
  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/roles/${roleId}/permissions`,
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { permissions: ["admin:users"], reason: "Attempt to grant admin privilege" },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "ROLE_PERMISSIONS_INVALID");
  await app.close();
});

test("membership grant cannot be used for self-escalation", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(true));
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/admin/memberships",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { identityId, organizationId, roleId, reason: "Attempt to grant self access" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "SELF_ROLE_CHANGE_FORBIDDEN");
  await app.close();
});

test("dual-control access requests cannot be approved by their requester", async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error("Unexpected pool SQL in dual-control self-approval test: " + sql);
    },
    connect: async () => ({
      query: async (sql: string) => {
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };
        if (sql.includes("from platform_access_change_requests where id=$1 for update")) return { rows: [{
          id: "423e4567-e89b-42d3-a456-426614174000",
          request_type: "GRANT_RESERVED_ROLE",
          target_identity_id: "523e4567-e89b-42d3-a456-426614174000",
          organization_id: organizationId,
          role_id: roleId,
          membership_id: null,
          requester_identity_id: identityId,
          status: "PENDING",
          reason: "Test privileged access request",
        }], rowCount: 1 };
        throw new Error("Unexpected client SQL in dual-control self-approval test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/admin/access-change-requests/423e4567-e89b-42d3-a456-426614174000/approve",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Requester cannot approve own change" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "DUAL_CONTROL_SELF_APPROVAL_FORBIDDEN");
  await app.close();
});

test("dual-control access targets cannot approve their own reserved-role grant", async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error("Unexpected pool SQL in dual-control self-approval test: " + sql);
    },
    connect: async () => ({
      query: async (sql: string) => {
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };
        if (sql.includes("from platform_access_change_requests where id=$1 for update")) return { rows: [{
          id: "423e4567-e89b-42d3-a456-426614174000",
          request_type: "GRANT_RESERVED_ROLE",
          target_identity_id: identityId,
          organization_id: organizationId,
          role_id: roleId,
          membership_id: null,
          requester_identity_id: "723e4567-e89b-42d3-a456-426614174000",
          status: "PENDING",
          reason: "Test privileged access request",
        }], rowCount: 1 };
        throw new Error("Unexpected client SQL in dual-control self-approval test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/admin/access-change-requests/423e4567-e89b-42d3-a456-426614174000/approve",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Requester cannot approve own change" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "DUAL_CONTROL_TARGET_APPROVAL_FORBIDDEN");
  await app.close();
});

test("the last active Super Admin membership cannot be revoked", async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) {
        return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      }
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error(`Unexpected pool SQL in last-admin test: ${sql}`);
    },
    connect: async () => ({
      query: async (sql: string) => {
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };
        if (sql.includes("where om.id=$1 for update")) return { rows: [{
          id: "423e4567-e89b-42d3-a456-426614174000",
          identity_id: "523e4567-e89b-42d3-a456-426614174000",
          organization_id: organizationId,
          organization_status: "VERIFIED",
          role_id: roleId,
          role_name: "super_admin",
          status: "VERIFIED",
          identity_status: "VERIFIED",
          suspended_at: null,
          last_revoked_at: null,
        }] };
        if (sql.includes("count(distinct om.identity_id)::text count from organization_memberships")) return { rows: [{ count: "1" }] };
        if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
        throw new Error(`Unexpected client SQL in last-admin test: ${sql}`);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "PATCH",
    url: "/api/v1/admin/memberships/423e4567-e89b-42d3-a456-426614174000/status",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { status: "REVOKED", reason: "Approved access review request" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "LAST_SUPER_ADMIN_PROTECTED");
  await app.close();
});

test("identity suspension revokes active sessions and records an audit event transactionally", async () => {
  const statements: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) {
        return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      }
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error(`Unexpected pool SQL in identity-suspension test: ${sql}`);
    },
    connect: async () => ({
      query: async (sql: string) => {
        statements.push(sql);
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };
        if (sql.includes("select id,status,suspended_at from identities")) return { rows: [{
          id: "523e4567-e89b-42d3-a456-426614174000", status: "VERIFIED", suspended_at: null,
        }] };
        if (sql.includes("r.name in ('super_admin','platform_admin')")) return { rows: [{ ok: false }] };
        if (sql.includes("update identities set suspended_at=now()")) return { rows: [], rowCount: 1 };
        if (sql.includes("update identity_sessions set revoked_at=now()")) return { rows: [], rowCount: 2 };
        if (sql.includes("select last_event_hash from platform_audit_chain_head")) return { rows: [{ last_event_hash: null }], rowCount: 1 };
        if (sql.includes("insert into audit_events")) return { rows: [{ id: "623e4567-e89b-42d3-a456-426614174000" }], rowCount: 1 };
        if (sql.includes("update platform_audit_chain_head")) return { rows: [], rowCount: 1 };
        throw new Error(`Unexpected client SQL in identity-suspension test: ${sql}`);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const targetId = "523e4567-e89b-42d3-a456-426614174000";
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/admin/identities/${targetId}/suspend`,
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Confirmed security incident review" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().suspended, true);
  assert.equal(response.json().revokedSessions, 2);
  assert.ok(statements.some(sql => sql.includes("update identities set suspended_at=now()")));
  assert.ok(statements.some(sql => sql.includes("update identity_sessions set revoked_at=now()")));
  assert.ok(statements.some(sql => sql.includes("insert into audit_events")));
  assert.ok(statements.some(sql => sql.includes("select last_event_hash from platform_audit_chain_head where singleton=true for update")), "audit append must lock the authoritative chain head");
  assert.ok(statements.some(sql => sql.includes("update platform_audit_chain_head set last_event_id=$1,last_event_hash=$2")), "audit append must atomically advance the chain head");
  assert.ok(statements.some(sql => sql.includes("returning id")), "audit append must capture the inserted event ID");
  assert.equal(statements.filter(sql => sql.trim().toLowerCase() === "commit").length, 1);
  await app.close();
});

test("platform_admin membership cannot be restored through the generic membership endpoint", async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error("Unexpected pool SQL in reserved-role restore test: " + sql);
    },
    connect: async () => ({
      query: async (sql: string) => {
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };
        if (sql.includes("where om.id=$1 for update")) return { rows: [{
          id: "423e4567-e89b-42d3-a456-426614174000",
          identity_id: "523e4567-e89b-42d3-a456-426614174000",
          organization_id: organizationId,
          organization_status: "VERIFIED",
          role_id: roleId,
          role_name: "platform_admin",
          status: "REJECTED",
          identity_status: "VERIFIED",
          suspended_at: null,
          last_revoked_at: new Date(),
        }] };
        throw new Error("Unexpected client SQL in reserved-role restore test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "PATCH",
    url: "/api/v1/admin/memberships/423e4567-e89b-42d3-a456-426614174000/status",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { status: "VERIFIED", reason: "Attempted reserved role restoration" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "RESERVED_ROLE_RESTORE_BLOCKED");
  await app.close();
});

test("platform-reserved administrators cannot be suspended through the generic identity action", async () => {
  const statements: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) {
        return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      }
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error(`Unexpected pool SQL in reserved-admin test: ${sql}`);
    },
    connect: async () => ({
      query: async (sql: string) => {
        statements.push(sql);
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };
        if (sql.includes("select id,status,suspended_at from identities")) return { rows: [{
          id: "523e4567-e89b-42d3-a456-426614174000", status: "VERIFIED", suspended_at: null,
        }] };
        if (sql.includes("r.name in ('super_admin','platform_admin')")) return { rows: [{ ok: true }] };
        throw new Error(`Unexpected client SQL in reserved-admin test: ${sql}`);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/admin/identities/523e4567-e89b-42d3-a456-426614174000/suspend",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Requested privileged administrator suspension" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "RESERVED_ADMIN_SUSPENSION_BLOCKED");
  assert.ok(!statements.some(sql => sql.includes("update identities set suspended_at=now()")));
  await app.close();
});


test("stakeholder authorization request cannot be approved by its requester", async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error("Unexpected pool SQL in stakeholder dual-control test: " + sql);
    },
    connect: async () => ({
      query: async (sql: string) => {
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };
        if (sql.includes("from organization_stakeholder_authorization_requests where id=$1 for update")) return { rows: [{
          id: "623e4567-e89b-42d3-a456-426614174000",
          organization_id: organizationId,
          stakeholder_type: "BWG",
          status: "PENDING",
          evidence_reference: "synthetic://test-evidence",
          evidence_sha256: "a".repeat(64),
          request_reason: "Synthetic authorization request",
          request_hash: "b".repeat(64),
          requested_by_identity_id: identityId,
          expires_at: null,
        }], rowCount: 1 };
        throw new Error("Unexpected client SQL in stakeholder dual-control test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/admin/stakeholder-authorization-requests/623e4567-e89b-42d3-a456-426614174000/approve",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Requester cannot approve own mapping" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "STAKEHOLDER_AUTHORIZATION_SELF_APPROVAL_FORBIDDEN");
  await app.close();
});


test("stakeholder authorization VERIFY requires a distinct active approver and writes the mapping in the audited transaction", async () => {
  const requesterId = "523e4567-e89b-42d3-a456-426614174000";
  const requestId = "623e4567-e89b-42d3-a456-426614174000";
  const authorizationId = "723e4567-e89b-42d3-a456-426614174000";
  const evidenceReference = "synthetic://stakeholder-proof";
  const evidenceSha256 = "a".repeat(64);
  const requestReason = "Synthetic verification request";
  const requestHash = createHash("sha256").update(JSON.stringify({
    organizationId, stakeholderType: "BWG", requestAction: "VERIFY", evidenceReference,
    evidenceSha256, requestReason, requesterIdentityId: requesterId, expiresAt: null,
  })).digest("hex");
  const statements: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error("Unexpected pool SQL in stakeholder approval test: " + sql);
    },
    connect: async () => ({
      query: async (sql: string) => {
        statements.push(sql);
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 1 };
        if (sql.includes("from organization_stakeholder_authorization_requests where id=$1 for update")) return { rows: [{
          id: requestId, organization_id: organizationId, stakeholder_type: "BWG", request_action: "VERIFY",
          status: "PENDING", evidence_reference: evidenceReference, evidence_sha256: evidenceSha256,
          request_reason: requestReason, request_hash: requestHash, requested_by_identity_id: requesterId, expires_at: null,
        }], rowCount: 1 };
        if (sql.includes("requester_active")) return { rows: [{ requester_active: true, approver_active: true }], rowCount: 1 };
        if (sql.includes("select status,verification_status from organizations")) return { rows: [{ status: "VERIFIED", verification_status: "VERIFIED" }], rowCount: 1 };
        if (sql.includes("select id,status from organization_stakeholder_authorizations")) return { rows: [], rowCount: 0 };
        if (sql.includes("insert into organization_stakeholder_authorizations")) return { rows: [{ id: authorizationId }], rowCount: 1 };
        if (sql.includes("select last_event_hash from platform_audit_chain_head")) return { rows: [{ last_event_hash: null }], rowCount: 1 };
        if (sql.includes("insert into audit_events")) return { rows: [{ id: "823e4567-e89b-42d3-a456-426614174000" }], rowCount: 1 };
        if (sql.includes("update platform_audit_chain_head")) return { rows: [], rowCount: 1 };
        if (sql.includes("update organization_stakeholder_authorization_requests set status='APPROVED'")) return { rows: [], rowCount: 1 };
        throw new Error("Unexpected client SQL in stakeholder approval test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/admin/stakeholder-authorization-requests/${requestId}/approve`,
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Evidence reviewed and approved" },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().authorizationId, authorizationId);
  assert.equal(response.json().status, "APPROVED");
  assert.ok(statements.some(sql => sql.includes("insert into organization_stakeholder_authorizations")));
  assert.ok(statements.some(sql => sql.includes("insert into audit_events")));
  assert.ok(statements.some(sql => sql.includes("update platform_audit_chain_head")));
  assert.equal(statements.filter(sql => sql.trim().toLowerCase() === "commit").length, 1);
  await app.close();
});

test("stakeholder authorization REVOKE requires independent approval and appends an audit event", async () => {
  const requesterId = "523e4567-e89b-42d3-a456-426614174000";
  const requestId = "623e4567-e89b-42d3-a456-426614174000";
  const authorizationId = "723e4567-e89b-42d3-a456-426614174000";
  const evidenceReference = "synthetic://revocation-proof";
  const evidenceSha256 = "c".repeat(64);
  const requestReason = "Synthetic revocation request";
  const requestHash = createHash("sha256").update(JSON.stringify({
    organizationId, stakeholderType: "BWG", requestAction: "REVOKE", evidenceReference,
    evidenceSha256, requestReason, requesterIdentityId: requesterId, expiresAt: null,
  })).digest("hex");
  const statements: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: true }] };
      throw new Error("Unexpected pool SQL in stakeholder revocation test: " + sql);
    },
    connect: async () => ({
      query: async (sql: string) => {
        statements.push(sql);
        if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [], rowCount: 1 };
        if (sql.includes("from organization_stakeholder_authorization_requests where id=$1 for update")) return { rows: [{
          id: requestId, organization_id: organizationId, stakeholder_type: "BWG", request_action: "REVOKE",
          status: "PENDING", evidence_reference: evidenceReference, evidence_sha256: evidenceSha256,
          request_reason: requestReason, request_hash: requestHash, requested_by_identity_id: requesterId, expires_at: null,
        }], rowCount: 1 };
        if (sql.includes("requester_active")) return { rows: [{ requester_active: true, approver_active: true }], rowCount: 1 };
        if (sql.includes("select status,verification_status from organizations")) return { rows: [{ status: "VERIFIED", verification_status: "VERIFIED" }], rowCount: 1 };
        if (sql.includes("select id,status from organization_stakeholder_authorizations")) return { rows: [{ id: authorizationId, status: "VERIFIED" }], rowCount: 1 };
        if (sql.includes("update organization_stakeholder_authorizations set status='REVOKED'")) return { rows: [], rowCount: 1 };
        if (sql.includes("select last_event_hash from platform_audit_chain_head")) return { rows: [{ last_event_hash: null }], rowCount: 1 };
        if (sql.includes("insert into audit_events")) return { rows: [{ id: "823e4567-e89b-42d3-a456-426614174000" }], rowCount: 1 };
        if (sql.includes("update platform_audit_chain_head")) return { rows: [], rowCount: 1 };
        if (sql.includes("update organization_stakeholder_authorization_requests set status='APPROVED'")) return { rows: [], rowCount: 1 };
        throw new Error("Unexpected client SQL in stakeholder revocation test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/admin/stakeholder-authorization-requests/${requestId}/approve`,
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { reason: "Independent revocation approved" },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().authorizationId, authorizationId);
  assert.equal(response.json().status, "REVOKED");
  assert.ok(statements.some(sql => sql.includes("update organization_stakeholder_authorizations set status='REVOKED'")));
  assert.ok(statements.some(sql => sql.includes("insert into audit_events")));
  assert.equal(statements.filter(sql => sql.trim().toLowerCase() === "commit").length, 1);
  await app.close();
});


test("canonical audit v2 hash is reproducible after JSONB object-key normalization", () => {
  const row = {
    actor_identity_id: identityId,
    action: "FIELD_DEVICE_ENROLLED",
    target_type: "field_device",
    target_id: "device-test",
    organization_id: organizationId,
    request_id: "request-test",
    payload: { z: 1, nested: { y: 2, x: 3 } },
    previous_hash: "0".repeat(64),
  };
  const normalizedRow = {
    ...row,
    payload: { nested: { x: 3, y: 2 }, z: 1 },
  };
  const hash = hashPlatformAuditEventV2(auditEventV2FromRow(row));
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashPlatformAuditEventV2(auditEventV2FromRow(normalizedRow)), hash);
});
