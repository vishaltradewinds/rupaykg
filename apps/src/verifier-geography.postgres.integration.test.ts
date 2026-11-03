import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("geography authorization rejects cycles, excessive depth, missing scopes and invalid effective dates; verifier decisions are subject-bound and immutable", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const suffix = randomBytes(6).toString("hex");
  try {
    await client.query("BEGIN");

    const orgA = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["Verifier Geography A " + suffix],
    )).rows[0]!.id;
    const orgB = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["Verifier Geography B " + suffix],
    )).rows[0]!.id;

    const actorId = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["verifier-actor:" + suffix, "Verifier Test Actor"],
    )).rows[0]!.id;
    await client.query(
      "update public.organizations set verification_status='VERIFIED',verified_by_identity_id=$2,verified_at=clock_timestamp() where id=any($1::uuid[])",
      [[orgA, orgB], actorId],
    );
    const verifierId = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["verifier-valid:" + suffix, "Verifier Test Valid"],
    )).rows[0]!.id;
    const roleId = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'custom_review_role','[\"VERIFY_EVIDENCE\"]'::jsonb,'[]'::jsonb) returning id",
      [orgA],
    )).rows[0]!.id;

    await client.query("ALTER TABLE public.organization_memberships DISABLE TRIGGER stakeholder_membership_application_guard");
    const membershipId = (await client.query<{ id: string }>(
      "insert into public.organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [verifierId, orgA, roleId],
    )).rows[0]!.id;
    await client.query("ALTER TABLE public.organization_memberships ENABLE TRIGGER stakeholder_membership_application_guard");

    const rootId = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name,valid_from) values('COUNTRY',$1,'CI Country',timestamptz '2020-01-01') returning id",
      ["ci-country-" + suffix],
    )).rows[0]!.id;
    const childId = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name,parent_id,valid_from) values('STATE_UT',$1,'CI State',$2,timestamptz '2020-01-01') returning id",
      ["ci-state-" + suffix, rootId],
    )).rows[0]!.id;
    const districtId = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name,parent_id,valid_from) values('DISTRICT',$1,'CI District',$2,timestamptz '2020-01-01') returning id",
      ["ci-district-" + suffix, childId],
    )).rows[0]!.id;
    const siblingId = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name,parent_id,valid_from) values('DISTRICT',$1,'CI Sibling District',$2,timestamptz '2020-01-01') returning id",
      ["ci-sibling-" + suffix, childId],
    )).rows[0]!.id;

    await client.query(
      "insert into public.organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [orgA, rootId],
    );

    const inScope = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope_at($1,$2,now()) as allowed",
      [orgA, districtId],
    );
    assert.equal(inScope.rows[0]?.allowed, true, "a verified ancestor scope covers its descendant");
    const siblingInScope = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope_at($1,$2,now()) as allowed",
      [orgA, siblingId],
    );
    assert.equal(siblingInScope.rows[0]?.allowed, true, "siblings under a scoped ancestor remain in scope");

    const noScope = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope_at($1,$2,now()) as allowed",
      [orgB, districtId],
    );
    assert.equal(noScope.rows[0]?.allowed, false, "an organization with no verified scope must fail closed");

    const expiredId = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name,parent_id,valid_from,valid_to) values('LOCALITY',$1,'Expired CI Locality',$2,timestamptz '2020-01-01',timestamptz '2021-01-01') returning id",
      ["ci-expired-" + suffix, childId],
    )).rows[0]!.id;
    const expired = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope_at($1,$2,timestamptz '2022-01-01') as allowed",
      [orgA, expiredId],
    );
    assert.equal(expired.rows[0]?.allowed, false, "an expired node invalidates the historical path");

    const historicalId = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name,parent_id,valid_from,valid_to) values('LOCALITY',$1,'Historical CI Locality',$2,timestamptz '2025-01-01',timestamptz '2026-01-01') returning id",
      ["ci-historical-" + suffix, childId],
    )).rows[0]!.id;
    const historicallyValid = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope_at($1,$2,timestamptz '2025-06-01') as allowed",
      [orgA, historicalId],
    );
    assert.equal(historicallyValid.rows[0]?.allowed, true, "historical activity dates use the effective hierarchy at that date");

    const cycleA = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name) values('CLUSTER',$1,'Cycle A') returning id",
      ["ci-cycle-a-" + suffix],
    )).rows[0]!.id;
    const cycleB = (await client.query<{ id: string }>(
      "insert into public.geography(kind,code,name,parent_id) values('CLUSTER',$1,'Cycle B',$2) returning id",
      ["ci-cycle-b-" + suffix, cycleA],
    )).rows[0]!.id;
    await client.query("update public.geography set parent_id=$2 where id=$1", [cycleA, cycleB]);
    await client.query(
      "insert into public.organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [orgA, cycleA],
    );
    const cycle = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope_at($1,$2,now()) as allowed",
      [orgA, cycleA],
    );
    assert.equal(cycle.rows[0]?.allowed, false, "a cycle must deny even if a node in the cycle is scoped");

    let parentId = rootId;
    let deepLeafId = rootId;
    for (let index = 0; index < 128; index += 1) {
      deepLeafId = (await client.query<{ id: string }>(
        "insert into public.geography(kind,code,name,parent_id) values('VILLAGE',$1,$2,$3) returning id",
        ["ci-depth-" + suffix + "-" + index, "CI depth " + index, parentId],
      )).rows[0]!.id;
      parentId = deepLeafId;
    }
    const tooDeep = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope_at($1,$2,now()) as allowed",
      [orgA, deepLeafId],
    );
    assert.equal(tooDeep.rows[0]?.allowed, false, "a hierarchy exceeding 128 nodes must deny");

    const activityId = (await client.query<{ id: string }>(
      "insert into public.activities(organization_id,actor_identity_id,geography_id,activity_type,occurred_at) values($1,$2,$3,'CI_VERIFIER_TEST',timestamptz '2025-06-01') returning id",
      [orgA, actorId, historicalId],
    )).rows[0]!.id;

    const decision = await client.query<{
      authorization_membership_id: string;
      authorization_role_id: string;
      authorization_permissions_snapshot: string[];
      authorization_checked_at: Date;
    }>(
      "insert into public.verifications(activity_id,verifier_identity_id,decision,scope,decided_at) values($1,$2,'REJECTED','EVIDENCE',now()) returning authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at",
      [activityId, verifierId],
    );
    assert.equal(decision.rows[0]?.authorization_membership_id, membershipId);
    assert.equal(decision.rows[0]?.authorization_role_id, roleId);
    assert.deepEqual(decision.rows[0]?.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
    assert.ok(decision.rows[0]?.authorization_checked_at, "REJECTED decisions must carry the same authorization snapshot");

    await assert.rejects(
      client.query("update public.verifications set rationale='mutated' where activity_id=$1", [activityId]),
      /immutable/i,
      "a verification decision cannot be edited in place",
    );

    await client.query("ROLLBACK");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
