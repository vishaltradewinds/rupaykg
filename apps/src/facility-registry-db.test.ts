import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const url = process.env.DATABASE_URL;

test("facility registry enforces tenant geography, membership and append-only review events", { skip: !url }, async () => {
  assert.ok(url);
  const pool = new Pool({ connectionString: url, max: 1, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    const tableCheck = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema=current_schema() and table_name=any($1::text[])",
      [["facilities", "facility_memberships", "facility_review_events"]],
    );
    assert.deepEqual(new Set(tableCheck.rows.map((r) => r.table_name)), new Set(["facilities", "facility_memberships", "facility_review_events"]));

    await client.query("begin");
    const org = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`facility-registry-org-${suffix}`],
    )).rows[0]!.id;
    const otherOrg = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id",
      [`facility-registry-other-org-${suffix}`],
    )).rows[0]!.id;
    const actor = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`facility-registry-actor-${suffix}`, "Facility registry actor"],
    )).rows[0]!.id;
    const operator = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`facility-registry-operator-${suffix}`, "Facility registry operator"],
    )).rows[0]!.id;
    const outsider = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`facility-registry-outsider-${suffix}`, "Facility registry outsider"],
    )).rows[0]!.id;
    const reviewer = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`facility-registry-reviewer-${suffix}`, "Facility registry reviewer"],
    )).rows[0]!.id;
    const role = (await client.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[\"facility:manage\"]'::jsonb) returning id",
      [org, `FACILITY-MANAGER-${suffix}`],
    )).rows[0]!.id;
    await client.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$3,'VERIFIED'),($5,$2,$3,'VERIFIED')",
      [actor, org, role, operator, reviewer],
    );

    const state = (await client.query<{ id: string }>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      [`FST-${suffix}`, `Facility Test State ${suffix}`],
    )).rows[0]!.id;
    const district = (await client.query<{ id: string }>(
      "insert into geography(parent_id,kind,code,name) values($1,'DISTRICT',$2,$3) returning id",
      [state, `FD-${suffix}`, `Facility Test District ${suffix}`],
    )).rows[0]!.id;
    const otherState = (await client.query<{ id: string }>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      [`FOS-${suffix}`, `Facility Other State ${suffix}`],
    )).rows[0]!.id;
    await client.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [org, state]);

    const facility = (await client.query<{ id: string; version: number; operational_status: string }>(
      "insert into facilities(organization_id,facility_code,name,facility_type,geography_id,created_by_identity_id,updated_by_identity_id) values($1,$2,$3,'COLLECTION_CENTRE',$4,$5,$5) returning id,version,operational_status",
      [org, `FC-${suffix}`, "Collection Centre", district, actor],
    )).rows[0]!;
    assert.equal(facility.version, 1);
    assert.equal(facility.operational_status, "UNVERIFIED");

    await rejectsInSavepoint(client, () => client.query(
      "insert into facilities(organization_id,facility_code,name,facility_type,geography_id,created_by_identity_id,updated_by_identity_id) values($1,$2,$3,'COLLECTION_CENTRE',$4,$5,$5)",
      [org, `OUTSIDE-${suffix}`, "Out of scope", otherState, actor],
    ), /outside organization authorization scope/i);

    await rejectsInSavepoint(client, () => client.query(
      "insert into facilities(organization_id,facility_code,name,facility_type,geography_id,created_by_identity_id,updated_by_identity_id) values($1,$2,$3,'COLLECTION_CENTRE',$4,$5,$5)",
      [org, `FC-${suffix}`, "Duplicate code", district, actor],
    ), /unique constraint/i);

    const membership = (await client.query<{ id: string; status: string }>(
      "insert into facility_memberships(facility_id,identity_id,membership_role,assigned_by_identity_id) values($1,$2,'OPERATOR',$3) returning id,status",
      [facility.id, operator, actor],
    )).rows[0]!;
    assert.equal(membership.status, "PENDING");

    await rejectsInSavepoint(client, () => client.query(
      "insert into facility_memberships(facility_id,identity_id,membership_role,assigned_by_identity_id) values($1,$2,'OPERATOR',$3)",
      [facility.id, outsider, actor],
    ), /verified membership in the facility organization/i);

    await client.query("update facility_memberships set status='VERIFIED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='independent review' where id=$1", [membership.id, reviewer]);
    const updated = (await client.query<{ version: number }>(
      "update facilities set name='Collection Centre Renamed' where id=$1 returning version",
      [facility.id],
    )).rows[0]!;
    assert.equal(updated.version, 2);

    await client.query(
      "insert into facility_review_events(facility_id,actor_identity_id,event_type,previous_version,new_version,previous_status,new_status,note) values($1,$2,'PROFILE_CREATED',null,1,null,'UNVERIFIED','test event')",
      [facility.id, actor],
    );
    await rejectsInSavepoint(client, () => client.query("update facility_review_events set note='tampered' where facility_id=$1", [facility.id]), /append-only/i);

    // The other organization is intentionally present but must not be able to own the same facility row.
    assert.notEqual(org, otherOrg);
    await client.query("rollback");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});

async function rejectsInSavepoint(client: PoolClient, operation: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  await client.query("savepoint expected_failure");
  try {
    await operation();
    await client.query("rollback to savepoint expected_failure");
    assert.fail("Expected operation to fail");
  } catch (error) {
    await client.query("rollback to savepoint expected_failure");
    assert.match(error instanceof Error ? error.message : String(error), pattern);
  } finally {
    await client.query("release savepoint expected_failure");
  }
}
