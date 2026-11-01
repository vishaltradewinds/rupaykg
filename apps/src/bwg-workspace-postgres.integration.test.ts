import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("BWG workspace enforces reports:read in PostgreSQL and scopes returned profiles to the selected organization", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const allowedToken = randomBytes(32).toString("base64url");
  const deniedToken = randomBytes(32).toString("base64url");
  const organizationIds: string[] = [];
  const identityIds: string[] = [];
  const geographyIds: string[] = [];
  try {
    const orgA = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BWG-WORKSPACE-A-" + suffix],
    );
    const orgB = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BWG-WORKSPACE-B-" + suffix],
    );
    organizationIds.push(orgA.rows[0]!.id, orgB.rows[0]!.id);

    const geography = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','fixture-v1') returning id",
      ["TEST-BWG-WORKSPACE-GEO-" + suffix],
    );
    geographyIds.push(geography.rows[0]!.id);

    const allowedIdentity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["test-bwg-workspace-allowed:" + suffix,"BWG Workspace Authorized Reader","bwg-workspace-allowed-" + suffix + "@example.invalid"],
    );
    const deniedIdentity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["test-bwg-workspace-denied:" + suffix,"BWG Workspace Unauthorized Reader","bwg-workspace-denied-" + suffix + "@example.invalid"],
    );
    identityIds.push(allowedIdentity.rows[0]!.id, deniedIdentity.rows[0]!.id);

    const allowedRole = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [orgA.rows[0]!.id,"bwg_workspace_reader_" + suffix,JSON.stringify(["reports:read"])],
    );
    const deniedRole = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [orgA.rows[0]!.id,"bwg_workspace_denied_" + suffix,JSON.stringify(["guardian:read"])],
    );

    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED')",
        [allowedIdentity.rows[0]!.id,orgA.rows[0]!.id,allowedRole.rows[0]!.id,deniedIdentity.rows[0]!.id,deniedRole.rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }

    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)",
      [allowedIdentity.rows[0]!.id,hash(allowedToken),deniedIdentity.rows[0]!.id,hash(deniedToken)],
    );

    const profileSql = "insert into bwg_profiles (organization_id,jurisdiction_id,floor_area_sqm,water_consumption_lpd,waste_generation_kg_day,establishment_type,applicability_status,applicability_basis,status,regulatory_registration_status,regulatory_registration_reference) values ($1,$2,25000,50000,150,'INSTITUTIONAL','REVIEW_REQUIRED',$3::jsonb,'PENDING','NOT_SUBMITTED',null) returning id";
    const profileA = await pool.query<{ id: string }>(profileSql, [orgA.rows[0]!.id,geography.rows[0]!.id,JSON.stringify({ testFixture: true, source: "DISPOSABLE_CI_ONLY" })]);
    const profileB = await pool.query<{ id: string }>(profileSql, [orgB.rows[0]!.id,geography.rows[0]!.id,JSON.stringify({ testFixture: true, source: "DISPOSABLE_CI_ONLY" })]);

    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/bwg",
      headers: { authorization: "Bearer " + deniedToken, "x-rupaykg-organization-id": orgA.rows[0]!.id },
    });
    assert.equal(denied.statusCode, 403, denied.body);
    assert.equal(denied.json().code, "BWG_WORKSPACE_READ_FORBIDDEN");

    const allowed = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/bwg",
      headers: { authorization: "Bearer " + allowedToken, "x-rupaykg-organization-id": orgA.rows[0]!.id },
    });
    assert.equal(allowed.statusCode, 200, allowed.body);
    assert.equal(allowed.json().source, "postgresql");
    assert.deepEqual(allowed.json().data.profiles.map((profile: { id: string }) => profile.id), [profileA.rows[0]!.id]);
    assert.equal(allowed.json().data.profiles.some((profile: { id: string }) => profile.id === profileB.rows[0]!.id), false);
    assert.deepEqual(allowed.json().data.organizations.map((item: { organizationId: string }) => item.organizationId), [orgA.rows[0]!.id]);
  } finally {
    for (const organizationId of organizationIds) {
      await pool.query("delete from bwg_waste_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_epr_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_esg_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_reporting_periods where organization_id=$1", [organizationId]);
      await pool.query("delete from bwg_profiles where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_memberships where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_statutory_profiles where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_bwg_assessments where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_epr_applicability where organization_id=$1", [organizationId]);
      await pool.query("delete from roles where organization_id=$1", [organizationId]);
    }
    if (identityIds.length) {
      await pool.query("delete from identity_sessions where identity_id = any($1::uuid[])", [identityIds]);
      await pool.query("delete from identities where id = any($1::uuid[])", [identityIds]);
    }
    for (const geographyId of geographyIds) await pool.query("delete from geography where id=$1", [geographyId]);
    for (const organizationId of organizationIds) await pool.query("delete from organizations where id=$1", [organizationId]);
    await app.close();
    await pool.end();
  }
});
