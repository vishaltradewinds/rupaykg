import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerPlatformAdminRoutes } from "./platform-admin-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("PostgreSQL Super Admin suspension revokes sessions and blocks subsequent authentication", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
    const membership = await pool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [actorId, organizationId, roleId],
    );
    membershipId = membership.rows[0]!.id;
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

    const chain = await pool.query<{ action: string; event_hash: string; previous_hash: string | null; expected_previous_hash: string | null }>(
      `select e.action,e.event_hash,e.previous_hash,
         (select p.event_hash from audit_events p
          where (p.created_at,p.id)<(e.created_at,e.id)
          order by p.created_at desc,p.id desc limit 1) as expected_previous_hash
       from audit_events e
       where e.actor_identity_id=$1 and e.target_id=$2
         and e.action in ('IDENTITY_SUSPENDED','IDENTITY_REACTIVATED')
       order by e.created_at asc,e.id asc`,
      [actorId, targetId],
    );
    assert.equal(chain.rows.length, 2, "both lifecycle changes should be audited");
    assert.ok(chain.rows[0]?.event_hash && chain.rows[1]?.event_hash, "both audit events need hashes");
    assert.equal(chain.rows[0]?.previous_hash, chain.rows[0]?.expected_previous_hash, "suspension must link to the immediately preceding global audit event");
    assert.equal(chain.rows[1]?.previous_hash, chain.rows[1]?.expected_previous_hash, "reactivation must link to the immediately preceding global audit event");
  } finally {
    await app.close();
    // This test is permitted only against an explicitly designated disposable test database.
    if (actorId && targetId) await pool.query("delete from audit_events where actor_identity_id=$1 and target_id=$2 and action in ('IDENTITY_SUSPENDED','IDENTITY_REACTIVATED')", [actorId, targetId]);
    if (actorId || targetId) await pool.query("delete from identity_sessions where identity_id = any($1::uuid[])", [[actorId, targetId].filter(Boolean)]);
    if (membershipId) await pool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await pool.query("delete from roles where id=$1", [roleId]);
    if (actorId || targetId) await pool.query("delete from identities where id = any($1::uuid[])", [[actorId, targetId].filter(Boolean)]);
    if (organizationId) await pool.query("delete from organizations where id=$1", [organizationId]);
    await pool.end();
  }
});


test("PostgreSQL serializes concurrent Super Admin revocations and preserves one active administrator", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
      const membership = await pool.query<{ id: string }>(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
        [identityId, organizationId, roleId],
      );
      membershipIds.push(membership.rows[0]!.id);
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
      `select count(*)::text count from organization_memberships om
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
      `select count(*)::text count from organization_memberships om
       join roles r on r.id=om.role_id join identities i on i.id=om.identity_id
       where r.name='super_admin' and om.status='VERIFIED' and i.status='VERIFIED' and i.suspended_at is null`,
    );
    assert.ok(Number(active.rows[0]?.count ?? 0) >= 1, "at least one active Super Admin must remain after racing revocations");
    assert.equal(activeBefore - Number(active.rows[0]?.count ?? 0), successes, "active admin count must match successful revocations");
  } finally {
    await app.close();
    if (actorIds.length && membershipIds.length) {
      await pool.query(
        "delete from audit_events where actor_identity_id = any($1::uuid[]) and target_id = any($2::uuid[]) and action='MEMBERSHIP_REVOKED'",
        [actorIds, membershipIds],
      );
    }
    if (actorIds.length) await pool.query("delete from identity_sessions where identity_id = any($1::uuid[])", [actorIds]);
    if (membershipIds.length) await pool.query("delete from organization_memberships where id = any($1::uuid[])", [membershipIds]);
    if (roleId) await pool.query("delete from roles where id=$1", [roleId]);
    if (actorIds.length) await pool.query("delete from identities where id = any($1::uuid[])", [actorIds]);
    if (organizationId) await pool.query("delete from organizations where id=$1", [organizationId]);
    await pool.end();
  }
});
