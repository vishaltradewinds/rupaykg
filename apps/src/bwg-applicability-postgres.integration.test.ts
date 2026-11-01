import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("BWG profile intake stays pending and the real PostgreSQL applicability trigger blocks reporting periods", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const token = randomBytes(32).toString("base64url");
  let organizationId: string | undefined;
  let geographyId: string | undefined;
  let identityId: string | undefined;
  let roleId: string | undefined;
  try {
    const org = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BWG-APPLICABILITY-" + suffix],
    );
    organizationId = org.rows[0]!.id;
    const geography = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','fixture-v1') returning id",
      ["TEST-BWG-GEO-" + suffix],
    );
    geographyId = geography.rows[0]!.id;
    const identity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["test-bwg-operator:"+suffix,"BWG Integration Operator","bwg-operator-"+suffix+"@example.invalid"],
    );
    identityId = identity.rows[0]!.id;
    const role = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [organizationId,"bwg_operator_"+suffix,JSON.stringify(["profile:update","waste:record","reports:read","epr:manage"])],
    );
    roleId = role.rows[0]!.id;
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
        [identity.rows[0]!.id,organizationId,role.rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }
    await pool.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [organizationId,geography.rows[0]!.id],
    );
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)",
      [identity.rows[0]!.id,hash(token)],
    );

    const headers = { authorization: "Bearer " + token, "x-rupaykg-organization-id": organizationId };
    const profile = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers,
      payload: {
        organizationId,
        jurisdictionId: geography.rows[0]!.id,
        floorAreaSqm: 25000,
        waterConsumptionLpd: 50000,
        wasteGenerationKgDay: 150,
        establishmentType: "INSTITUTIONAL",
      },
    });
    assert.equal(profile.statusCode, 201, profile.body);
    assert.equal(profile.json().profile.applicability_status, "REVIEW_REQUIRED");
    assert.equal(profile.json().profile.status, "PENDING");

    const persisted = await pool.query<{ applicability_status: string; status: string }>(
      "select applicability_status,status from bwg_profiles where organization_id=$1",
      [organizationId],
    );
    assert.equal(persisted.rows[0]?.applicability_status, "REVIEW_REQUIRED");
    assert.equal(persisted.rows[0]?.status, "PENDING");

    const period = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods",
      headers,
      payload: {
        organizationId,
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        reportingBasis: "QUARTERLY",
      },
    });
    assert.equal(period.statusCode, 409, period.body);
    assert.equal(period.json().code, "BWG_APPLICABILITY_NOT_VERIFIED");
    assert.doesNotMatch(period.body, /23514|BWG applicability must be verified before creating a reporting period/);

    const periods = await pool.query<{ count: string }>(
      "select count(*)::text as count from bwg_reporting_periods where organization_id=$1",
      [organizationId],
    );
    assert.equal(periods.rows[0]?.count, "0");
  } finally {
    if (organizationId) {
      await pool.query("delete from bwg_waste_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_epr_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_esg_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_reporting_periods where organization_id=$1", [organizationId]);
      await pool.query("delete from bwg_profiles where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_memberships where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_statutory_profiles where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_bwg_assessments where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_epr_applicability where organization_id=$1", [organizationId]);
      if (roleId) await pool.query("delete from roles where id=$1", [roleId]);
      await pool.query("delete from organizations where id=$1", [organizationId]);
    }
    if (identityId) {
      await pool.query("delete from identity_sessions where identity_id=$1", [identityId]);
      await pool.query("delete from identities where id=$1", [identityId]);
    }
    if (geographyId) await pool.query("delete from geography where id=$1", [geographyId]);
    await app.close();
    await pool.end();
  }
});
