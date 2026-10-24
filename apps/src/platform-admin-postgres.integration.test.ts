import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerPlatformAdminRoutes } from "./platform-admin-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.RUPAYKG_TEST_DATABASE_URL ?? process.env.DATABASE_URL);
const auditChainDatabaseUrl = process.env.RUPAYKG_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const auditChainEnabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(auditChainDatabaseUrl);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Bootstrap a reserved-role membership only inside a single transaction on the
 * explicitly disposable integration database. Production authorization paths
 * and the database guard remain enabled for all assertions after fixture setup.
 */
async function bootstrapReservedMembership(pool: Pool, identityId: string, organizationId: string, roleId: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Disable only the application lifecycle guard for deterministic Super Admin
    // fixture setup. Keep foreign-key and all other PostgreSQL triggers active.
    await client.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    const result = await client.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    );
    await client.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    await client.query("commit");
    const id = result.rows[0]?.id;
    if (!id) throw new Error("TEST_FIXTURE_MEMBERSHIP_INSERT_FAILED");
    return id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

test("PostgreSQL Super Admin suspension revokes sessions and blocks subsequent authentication", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString: process.env.RUPAYKG_TEST_DATABASE_URL ?? process.env.DATABASE_URL });
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const actorToken = randomBytes(32).toString("base64url");
  const targetToken = randomBytes(32).toString("base64url");
  let actorId = "";
  let targetId = "";
  let organizationId = "";
  let roleId = "";
  let membershipId = "";
  let auditId = "";
  try {
    const org = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-ADMIN-${suffix}`],
    );
    organizationId = org.rows[0]!.id;
    const actor = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`test-admin:${suffix}`, `Test Admin ${suffix}`, `test-admin-${suffix}@example.invalid`],
    );
    actorId = actor.rows[0]!.id;
    const target = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`test-target:${suffix}`, `Test Target ${suffix}`, `test-target-${suffix}@example.invalid`],
    );
    targetId = target.rows[0]!.id;
    const role = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'super_admin',$2::jsonb,'[]') returning id",
      [organizationId, JSON.stringify(["dashboard:read", "admin:users", "admin:roles", "admin:security"])],
    );
    roleId = role.rows[0]!.id;
    membershipId = await bootstrapReservedMembership(pool, actorId, organizationId, roleId);
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)",
      [actorId, hash(actorToken), targetId, hash(targetToken)],
    );

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/identities/${targetId}/suspend`,
      headers: { authorization: `Bearer ${actorToken}`, "x-rupaykg-organization-id": organizationId },
      payload: { reason: "Database integration test suspension" },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().suspended, true);

    const identity = await pool.query<{ suspended_at: Date | null }>(
      "select suspended_at from identities where id=$1",
      [targetId],
    );
    assert.ok(identity.rows[0]?.suspended_at, "identity should persist its suspension marker");
    const session = await pool.query<{ revoked_at: Date | null }>(
      "select revoked_at from identity_sessions where identity_id=$1 and token_hash=$2",
      [targetId, hash(targetToken)],
    );
    assert.ok(session.rows[0]?.revoked_at, "target session should be revoked in PostgreSQL");

    const rejected = await app.inject({
      method: "GET",
      url: "/api/v1/admin/overview",
      headers: { authorization: `Bearer ${targetToken}` },
    });
    assert.equal(rejected.statusCode, 401, "suspended identity must fail authentication");
    const audit = await pool.query<{ id: string; event_hash: string; previous_hash: string | null }>(
      "select id,event_hash,previous_hash from audit_events where actor_identity_id=$1 and target_id=$2 and action='IDENTITY_SUSPENDED' order by id desc limit 1",
      [actorId, targetId],
    );
    auditId = audit.rows[0]?.id ?? "";
    assert.ok(audit.rows[0]?.event_hash, "suspension should have an audit event");

    const reactivated = await app.inject({
      method: "POST",
      url: "/api/v1/admin/identities/" + targetId + "/reactivate",
      headers: { authorization: "Bearer " + actorToken, "x-rupaykg-organization-id": organizationId },
      payload: { reason: "Verified security review permits reactivation" },
    });
    assert.equal(reactivated.statusCode, 200, reactivated.body);
    assert.equal(reactivated.json().suspended, false);

    const chain = await pool.query<{ id: string; action: string; event_hash: string; previous_hash: string | null }>(
      `select e.id,e.action,e.event_hash,e.previous_hash
       from audit_events e
       where e.actor_identity_id=$1 and e.target_id=$2
         and e.action in ('IDENTITY_SUSPENDED','IDENTITY_REACTIVATED')
       order by e.created_at asc,e.id asc`,
      [actorId, targetId],
    );
    assert.equal(chain.rows.length, 2, "both lifecycle changes should be audited");
    assert.ok(chain.rows[0]?.event_hash && chain.rows[1]?.event_hash, "both audit events need hashes");
    const predecessor = await pool.query(
      "select 1 from audit_events where event_hash=$1 limit 1",
      [chain.rows[1]?.previous_hash],
    );
    assert.equal(predecessor.rowCount, 1, "the reactivation event must link to an existing predecessor in the global chain");
    const head = await pool.query<{ last_event_id: string | null; last_event_hash: string | null }>(
      "select last_event_id,last_event_hash from platform_audit_chain_head where singleton=true",
    );
    const headEvent = await pool.query<{ event_hash: string }>(
      "select event_hash from audit_events where id=$1",
      [head.rows[0]?.last_event_id],
    );
    assert.equal(head.rows[0]?.last_event_hash, headEvent.rows[0]?.event_hash, "authoritative global chain head hash must match its referenced event");
  } finally {
    await app.close();
    // This test is permitted only against an explicitly designated disposable test database.
    // Audit events are append-only: deleting them would break the hash chain and make the
    // authoritative chain head point to a removed event. Retain the audit actor and organization
    // referenced by those events; clean up only unreferenced fixture rows.
    if (actorId || targetId) await pool.query("delete from identity_sessions where identity_id = any($1::uuid[])", [[actorId, targetId].filter(Boolean)]);
    if (membershipId) await pool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await pool.query("delete from roles where id=$1", [roleId]);
    if (targetId) await pool.query("delete from identities where id=$1", [targetId]);
    await pool.end();
  }
});


test("PostgreSQL requires two distinct active Super Admins for reserved-role grants and restoration", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.RUPAYKG_TEST_DATABASE_URL ?? process.env.DATABASE_URL });
  const app = Fastify({ logger: { level: "error" } });
  await registerPlatformAdminRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const requesterToken = randomBytes(32).toString("base64url");
  const approverToken = randomBytes(32).toString("base64url");
  let organizationId = "";
  let requesterId = "";
  let approverId = "";
  let targetId = "";
  let superAdminRoleId = "";
  let reservedRoleId = "";
  let requesterMembershipId = "";
  let approverMembershipId = "";
  let targetMembershipId = "";
  let requestId = "";
  let restoreRequestId = "";
  try {
    organizationId = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-DUAL-CONTROL-" + suffix],
    )).rows[0]!.id;
    requesterId = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["dual-requester:" + suffix, "Dual Control Requester " + suffix, "dual-requester-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    approverId = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["dual-approver:" + suffix, "Dual Control Approver " + suffix, "dual-approver-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    targetId = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["dual-target:" + suffix, "Dual Control Target " + suffix, "dual-target-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    superAdminRoleId = (await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'super_admin',$2::jsonb,'[]') returning id",
      [organizationId, JSON.stringify(["admin:users", "admin:roles", "admin:security"])],
    )).rows[0]!.id;
    reservedRoleId = (await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'platform_admin',$2::jsonb,'[]') returning id",
      [organizationId, JSON.stringify(["admin:users"])],
    )).rows[0]!.id;
    requesterMembershipId = await bootstrapReservedMembership(pool, requesterId, organizationId, superAdminRoleId);
    approverMembershipId = await bootstrapReservedMembership(pool, approverId, organizationId, superAdminRoleId);
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)",
      [requesterId, hash(requesterToken), approverId, hash(approverToken)],
    );

    // A direct SQL insert must not bypass the dual-control API for reserved roles.
    await assert.rejects(
      pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
        [targetId, organizationId, reservedRoleId],
      ),
      /RESERVED_ROLE_REQUIRES_DUAL_CONTROL/,
      "PostgreSQL must reject direct reserved-role grants without an approved two-person request",
    );

    const requested = await app.inject({
      method: "POST",
      url: "/api/v1/admin/access-change-requests",
      headers: { authorization: "Bearer " + requesterToken, "x-rupaykg-organization-id": organizationId },
      payload: { requestType: "GRANT_RESERVED_ROLE", identityId: targetId, organizationId, roleId: reservedRoleId, reason: "Approved need for platform administration" },
    });
    assert.equal(requested.statusCode, 201, requested.body);
    requestId = requested.json().request.id as string;

    const selfApproval = await app.inject({
      method: "POST",
      url: "/api/v1/admin/access-change-requests/" + requestId + "/approve",
      headers: { authorization: "Bearer " + requesterToken, "x-rupaykg-organization-id": organizationId },
      payload: { reason: "Attempted self approval must fail" },
    });
    assert.equal(selfApproval.statusCode, 409, selfApproval.body);
    assert.equal(selfApproval.json().code, "DUAL_CONTROL_SELF_APPROVAL_FORBIDDEN");

    const approved = await app.inject({
      method: "POST",
      url: "/api/v1/admin/access-change-requests/" + requestId + "/approve",
      headers: { authorization: "Bearer " + approverToken, "x-rupaykg-organization-id": organizationId },
      payload: { reason: "Independent second-admin review completed" },
    });
    assert.equal(approved.statusCode, 200, approved.body);
    assert.equal(approved.json().applied, true);
    assert.equal(approved.json().status, "APPROVED");
    targetMembershipId = approved.json().membershipId as string;

    const membership = await pool.query<{ status: string }>(
      "select status from organization_memberships where id=$1 and identity_id=$2 and role_id=$3",
      [targetMembershipId, targetId, reservedRoleId],
    );
    assert.equal(membership.rows[0]?.status, "VERIFIED", "approval must apply the reserved role grant in the same transaction");
    const duplicateDecision = await app.inject({
      method: "POST",
      url: "/api/v1/admin/access-change-requests/" + requestId + "/approve",
      headers: { authorization: "Bearer " + approverToken, "x-rupaykg-organization-id": organizationId },
      payload: { reason: "Repeated approval should be rejected" },
    });
    assert.equal(duplicateDecision.statusCode, 409);
    assert.equal(duplicateDecision.json().code, "ACCESS_CHANGE_ALREADY_DECIDED");

    const revoked = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/memberships/" + targetMembershipId + "/status",
      headers: { authorization: "Bearer " + approverToken, "x-rupaykg-organization-id": organizationId },
      payload: { status: "REVOKED", reason: "Revoke role before restoration acceptance" },
    });
    assert.equal(revoked.statusCode, 200, revoked.body);
    await assert.rejects(
      pool.query("update organization_memberships set status='VERIFIED' where id=$1", [targetMembershipId]),
      /RESERVED_ROLE_REQUIRES_DUAL_CONTROL/,
      "PostgreSQL must block direct restoration without an approved two-person request",
    );

    const restoreRequested = await app.inject({
      method: "POST",
      url: "/api/v1/admin/access-change-requests",
      headers: { authorization: "Bearer " + requesterToken, "x-rupaykg-organization-id": organizationId },
      payload: { requestType: "RESTORE_RESERVED_ROLE", membershipId: targetMembershipId, reason: "Restore platform administrator after review" },
    });
    assert.equal(restoreRequested.statusCode, 201, restoreRequested.body);
    restoreRequestId = restoreRequested.json().request.id as string;

    const restored = await app.inject({
      method: "POST",
      url: "/api/v1/admin/access-change-requests/" + restoreRequestId + "/approve",
      headers: { authorization: "Bearer " + approverToken, "x-rupaykg-organization-id": organizationId },
      payload: { reason: "Independent restoration approval completed" },
    });
    assert.equal(restored.statusCode, 200, restored.body);
    assert.equal(restored.json().applied, true);
    const restoredMembership = await pool.query<{ status: string }>(
      "select status from organization_memberships where id=$1",
      [targetMembershipId],
    );
    assert.equal(restoredMembership.rows[0]?.status, "VERIFIED", "reserved-role restoration must apply only after a second-admin approval");
  } finally {
    await app.close();
    // Keep hash-linked audit events append-only; delete only disposable authorization fixtures.
    if (requestId || restoreRequestId) await pool.query("delete from platform_access_change_requests where id=any($1::uuid[])", [[requestId, restoreRequestId].filter(Boolean)]);
    if (targetMembershipId) await pool.query("delete from organization_memberships where id=$1", [targetMembershipId]);
    if (requesterMembershipId || approverMembershipId) await pool.query("delete from organization_memberships where id=any($1::uuid[])", [[requesterMembershipId, approverMembershipId].filter(Boolean)]);
    if (requesterId || approverId) await pool.query("delete from identity_sessions where identity_id=any($1::uuid[])", [[requesterId, approverId].filter(Boolean)]);
    if (superAdminRoleId || reservedRoleId) {
      await pool.query("delete from organization_memberships where role_id=any($1::uuid[])", [[superAdminRoleId, reservedRoleId].filter(Boolean)]);
      await pool.query("delete from roles where id=any($1::uuid[])", [[superAdminRoleId, reservedRoleId].filter(Boolean)]);
    }
    // Audit actor and organization foreign keys require these fixture rows to remain in the disposable DB.
    await pool.end();
  }
});

test("PostgreSQL serializes concurrent Super Admin revocations and preserves one active administrator", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString: process.env.RUPAYKG_TEST_DATABASE_URL ?? process.env.DATABASE_URL });
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const tokenA = randomBytes(32).toString("base64url");
  const tokenB = randomBytes(32).toString("base64url");
  const actorIds: string[] = [];
  const membershipIds: string[] = [];
  let organizationId = "";
  let roleId = "";
  try {
    const org = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-CONCURRENT-ADMIN-${suffix}`],
    );
    organizationId = org.rows[0]!.id;
    for (const [index, token] of [tokenA, tokenB].entries()) {
      const identity = await pool.query<{ id: string }>(
        "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
        [`test-concurrent-admin:${suffix}:${index}`, `Test Concurrent Admin ${suffix} ${index}`, `test-concurrent-admin-${suffix}-${index}@example.invalid`],
      );
      actorIds.push(identity.rows[0]!.id);
      await pool.query(
        "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)",
        [identity.rows[0]!.id, hash(token)],
      );
    }
    const role = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'super_admin',$2::jsonb,'[]') returning id",
      [organizationId, JSON.stringify(["dashboard:read", "admin:users", "admin:roles", "admin:security"])],
    );
    roleId = role.rows[0]!.id;
    for (const identityId of actorIds) {
      membershipIds.push(await bootstrapReservedMembership(pool, identityId, organizationId, roleId));
    }

    const revoke = (actorIndex: number, targetIndex: number) => app.inject({
      method: "PATCH",
      url: `/api/v1/admin/memberships/${membershipIds[targetIndex]}/status`,
      headers: {
        authorization: `Bearer ${[tokenA, tokenB][actorIndex]}`,
        "x-rupaykg-organization-id": organizationId,
      },
      payload: { status: "REVOKED", reason: "Concurrent revocation integration test" },
    });
    const before = await pool.query<{ count: string }>(
      `select count(distinct om.identity_id)::text count from organization_memberships om
       join roles r on r.id=om.role_id join identities i on i.id=om.identity_id
       where r.name='super_admin' and om.status='VERIFIED' and i.status='VERIFIED' and i.suspended_at is null`,
    );
    const activeBefore = Number(before.rows[0]?.count ?? 0);
    assert.ok(activeBefore >= 2, "fixture must have at least two active Super Admin memberships");

    const responses = await Promise.all([revoke(0, 1), revoke(1, 0)]);
    const statuses = responses.map((response) => response.statusCode);
    const successes = statuses.filter((status) => status === 200).length;
    assert.ok(successes >= 1, `at least one revocation should complete; statuses=${statuses.join(",")}; responses=${responses.map((response) => response.body).join(" | ")}`);
    assert.ok(statuses.every((status) => [200, 401, 403, 409].includes(status)), `concurrent revocation must not deadlock or fail as a server error; revoked sessions may correctly return 401; statuses=${statuses.join(",")}; responses=${responses.map((response) => response.body).join(" | ")}`);
    assert.ok(successes <= Math.min(2, activeBefore - 1), "concurrent revocations must never remove the last active Super Admin");

    const active = await pool.query<{ count: string }>(
      `select count(distinct om.identity_id)::text count from organization_memberships om
       join roles r on r.id=om.role_id join identities i on i.id=om.identity_id
       where r.name='super_admin' and om.status='VERIFIED' and i.status='VERIFIED' and i.suspended_at is null`,
    );
    assert.ok(Number(active.rows[0]?.count ?? 0) >= 1, "at least one active Super Admin must remain after racing revocations");
    assert.equal(activeBefore - Number(active.rows[0]?.count ?? 0), successes, "active admin count must match successful revocations");
    const revocationEvents = await pool.query<{ id: string; target_id: string; event_hash: string; previous_hash: string | null }>(
      "select id,target_id,event_hash,previous_hash from audit_events where target_id=any($1::uuid[]) and action='MEMBERSHIP_REVOKED' order by created_at,id",
      [membershipIds],
    );
    assert.equal(revocationEvents.rows.length, successes, "every successful concurrent revocation must append exactly one audit event");
    if (revocationEvents.rows.length === 2) {
      assert.ok(
        revocationEvents.rows.some(event => event.previous_hash === revocationEvents.rows.find(other => other.id !== event.id)?.event_hash),
        "the two concurrent platform-admin audit appends must form one continuous chain",
      );
    }
    const head = await pool.query<{ last_event_id: string | null; last_event_hash: string | null }>(
      "select last_event_id,last_event_hash from platform_audit_chain_head where singleton=true",
    );
    const lastRevocation = revocationEvents.rows[revocationEvents.rows.length - 1];
    assert.equal(head.rows[0]?.last_event_id, lastRevocation?.id, "audit head must reflect the last committed concurrent revocation");
    assert.equal(head.rows[0]?.last_event_hash, lastRevocation?.event_hash, "audit head hash must match the last concurrent revocation");
  } finally {
    await app.close();
    // Keep the append-only audit records and their actor/organization foreign-key targets.
    // This test runs only against a disposable PostgreSQL database.
    if (actorIds.length) await pool.query("delete from identity_sessions where identity_id = any($1::uuid[])", [actorIds]);
    if (membershipIds.length) await pool.query("delete from organization_memberships where id = any($1::uuid[])", [membershipIds]);
    if (roleId) await pool.query("delete from roles where id=$1", [roleId]);
    await pool.end();
  }
});


test("PostgreSQL globally serializes concurrent audit appends and rolls back chain state atomically", { skip: !auditChainEnabled }, async () => {
  const pool = new Pool({ connectionString: process.env.RUPAYKG_TEST_DATABASE_URL ?? process.env.DATABASE_URL });
  const prefix = "TEST-GLOBAL-AUDIT-" + randomBytes(8).toString("hex");
  const rolledBackAction = prefix + "-ROLLBACK";
  const appendedIds: string[] = [];
  let rolledBackHash = "";
  try {
    const baseline = await pool.query<{ last_event_hash: string | null }>(
      "select last_event_hash from platform_audit_chain_head where singleton=true",
    );
    assert.equal(baseline.rowCount, 1, "global chain head must exist before appends");

    const anchor = await pool.query<{ anchor_event_id: string; anchor_event_hash: string }>(
      "select anchor_event_id,anchor_event_hash from platform_audit_chain_anchor where singleton=true",
    );
    assert.equal(anchor.rowCount, 1, "migration 088 must persist an immutable cutover anchor");
    const anchorEvent = await pool.query<{ action: string; event_hash: string }>(
      "select action,event_hash from audit_events where id=$1",
      [anchor.rows[0]!.anchor_event_id],
    );
    assert.equal(anchorEvent.rows[0]?.action, "AUDIT_CHAIN_CUTOVER_ANCHOR");
    assert.equal(anchorEvent.rows[0]?.event_hash, anchor.rows[0]!.anchor_event_hash);

    const client = await pool.connect();
    try {
      await client.query("begin");
      const rolledBack = await client.query<{ id: string; event_hash: string }>(
        "insert into audit_events(action,target_type,request_id,event_hash,payload) values($1,'test',$2,'caller-supplied-hash',$3::jsonb) returning id,event_hash",
        [rolledBackAction, prefix + "-rollback-request", JSON.stringify({ test: true })],
      );
      rolledBackHash = rolledBack.rows[0]!.event_hash;
      assert.notEqual(rolledBackHash, "caller-supplied-hash", "database trigger must override caller-supplied hashes");
      await client.query("rollback");
    } finally {
      client.release();
    }
    const rolledBackCheck = await pool.query(
      "select 1 from audit_events where action=$1 or event_hash=$2",
      [rolledBackAction, rolledBackHash],
    );
    assert.equal(rolledBackCheck.rowCount, 0, "rolled-back event and its chain-head update must not persist");

    const inserts = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      pool.query<{ id: string; event_hash: string; previous_hash: string | null }>(
        "insert into audit_events(action,target_type,request_id,event_hash,payload) values($1,'test',$2,'caller-supplied-hash',$3::jsonb) returning id,event_hash,previous_hash",
        [prefix + "-" + index, prefix + "-request-" + index, JSON.stringify({ index })],
      ),
    ));
    for (const result of inserts) {
      assert.equal(result.rowCount, 1);
      assert.ok(result.rows[0]!.event_hash && result.rows[0]!.event_hash !== "caller-supplied-hash");
      appendedIds.push(result.rows[0]!.id);
    }

    const canonicalHashes = await pool.query<{ event_hash: string; expected_hash: string }>(
      `select event_hash,
              encode(digest(convert_to(jsonb_build_object(
                'id', id, 'actor_identity_id', actor_identity_id, 'organization_id', organization_id,
                'action', action, 'target_type', target_type, 'target_id', target_id,
                'request_id', request_id, 'payload', payload, 'created_at', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                'previous_hash', previous_hash
              )::text, 'UTF8'), 'sha256'), 'hex') as expected_hash
         from audit_events where id=any($1::uuid[])`,
      [appendedIds],
    );
    assert.equal(canonicalHashes.rows.length, appendedIds.length);
    for (const row of canonicalHashes.rows) assert.equal(row.event_hash, row.expected_hash, "stored event hash must match canonical SHA-256 content");
    const headSnapshot = await pool.query<{ last_event_id: string | null; last_event_hash: string | null }>("select last_event_id,last_event_hash from platform_audit_chain_head where singleton=true");
    const chainRows = await pool.query<{ id: string; event_hash: string; previous_hash: string | null }>(
      "with recursive chain as (select id,event_hash,previous_hash from audit_events where id=$1 union select e.id,e.event_hash,e.previous_hash from audit_events e join chain c on e.previous_hash=c.event_hash) select id,event_hash,previous_hash from chain",
      [anchor.rows[0]!.anchor_event_id],
    );
    const byPreviousHash = new Map<string | null, { id: string; event_hash: string; previous_hash: string | null }>();
    for (const row of chainRows.rows) {
      if (row.id !== anchor.rows[0]!.anchor_event_id) {
        assert.equal(byPreviousHash.has(row.previous_hash), false, "each chain predecessor must have at most one successor");
        byPreviousHash.set(row.previous_hash, row);
      }
    }
    const head = await pool.query<{ last_event_id: string | null; last_event_hash: string | null }>(
      "select last_event_id,last_event_hash from platform_audit_chain_head where singleton=true",
    );
    const currentHeadEvent = await pool.query<{ event_hash: string }>("select event_hash from audit_events where id=$1", [head.rows[0]?.last_event_id]);
    assert.equal(currentHeadEvent.rows[0]?.event_hash, head.rows[0]?.last_event_hash, "global head must reference an existing event with the same hash");
    let cursorHash = anchor.rows[0]!.anchor_event_hash;
    const visited = new Set<string>();
    const reachedHead = anchor.rows[0]!.anchor_event_hash === headSnapshot.rows[0]!.last_event_hash;
    let foundHead = reachedHead;
    while (!foundHead) {
      const next = byPreviousHash.get(cursorHash);
      assert.ok(next, "global audit chain must have no gap between baseline and head");
      assert.equal(visited.has(next.event_hash), false, "global audit chain must not cycle");
      visited.add(next.event_hash);
      cursorHash = next.event_hash;
      foundHead = cursorHash === headSnapshot.rows[0]!.last_event_hash;
      if (visited.size > chainRows.rows.length) assert.fail("global audit chain traversal exceeded row count");
    }
    for (const id of appendedIds) assert.ok(visited.has((await pool.query<{ event_hash: string }>("select event_hash from audit_events where id=$1", [id])).rows[0]!.event_hash), "every concurrent append must be linked into the global chain");
    assert.equal(headSnapshot.rows[0]!.last_event_hash, cursorHash);
    assert.ok(visited.size >= appendedIds.length, "the chain must contain all concurrent appends");
    await assert.rejects(
      pool.query("update platform_audit_chain_anchor set captured_at=clock_timestamp() where singleton=true"),
      /AUDIT_CHAIN_ANCHOR_IMMUTABLE/,
    );
    await assert.rejects(
      pool.query("delete from platform_audit_chain_anchor where singleton=true"),
      /AUDIT_CHAIN_ANCHOR_IMMUTABLE/,
    );
    await assert.rejects(
      pool.query("truncate table platform_audit_chain_anchor"),
      /AUDIT_CHAIN_ANCHOR_IMMUTABLE/,
    );
    await assert.rejects(
      pool.query("delete from platform_audit_chain_head where singleton=true"),
      /AUDIT_CHAIN_HEAD_IMMUTABLE/,
    );
    await assert.rejects(
      pool.query("truncate table platform_audit_chain_head"),
      /AUDIT_CHAIN_HEAD_IMMUTABLE/,
    );
    await assert.rejects(
      pool.query("update audit_events set payload=payload where id=$1", [appendedIds[0]]),
      /AUDIT_EVENTS_APPEND_ONLY/,
    );
    await assert.rejects(
      pool.query("delete from audit_events where id=$1", [appendedIds[0]]),
      /AUDIT_EVENTS_APPEND_ONLY/,
    );
    await assert.rejects(
      pool.query("truncate table audit_events cascade"),
      /AUDIT_EVENTS_APPEND_ONLY|AUDIT_CHAIN_ANCHOR_IMMUTABLE/,
    );
  } finally {
    // Append-only audit fixtures are retained intentionally; deleting them would break the chain.
    await pool.end();
  }
});
