import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("BWG reporting period and authorized/denied waste, EPR and ESG writes use real PostgreSQL authorization and pending evidence states", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const allowedToken = randomBytes(32).toString("base64url");
  const deniedToken = randomBytes(32).toString("base64url");
  let organizationId: string | undefined;
  let otherOrganizationId: string | undefined;
  let geographyId: string | undefined;
  let periodId: string | undefined;
  const identityIds: string[] = [];
  try {
    const organization = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BWG-REPORT-WRITES-" + suffix],
    );
    organizationId = organization.rows[0]!.id;
    const otherOrganization = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BWG-OTHER-TENANT-" + suffix],
    );
    otherOrganizationId = otherOrganization.rows[0]!.id;

    const geography = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','fixture-v1') returning id",
      ["TEST-BWG-REPORT-GEO-" + suffix],
    );
    geographyId = geography.rows[0]!.id;

    const allowedIdentity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["test-bwg-writer:"+suffix,"BWG Integration Writer","bwg-writer-"+suffix+"@example.invalid"],
    );
    const deniedIdentity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["test-bwg-reader:"+suffix,"BWG Integration Reader","bwg-reader-"+suffix+"@example.invalid"],
    );
    const verifierIdentity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["test-bwg-verifier:"+suffix,"BWG Integration Verifier","bwg-verifier-"+suffix+"@example.invalid"],
    );
    identityIds.push(allowedIdentity.rows[0]!.id, deniedIdentity.rows[0]!.id, verifierIdentity.rows[0]!.id);

    const allowedRole = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [organizationId,"bwg_writer_"+suffix,JSON.stringify(["reports:read","waste:record","epr:manage","esg:write"])],
    );
    const deniedRole = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [organizationId,"bwg_reader_"+suffix,JSON.stringify(["guardian:read"])],
    );
    const verifierRole = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [organizationId,"bwg_evidence_verifier_"+suffix,JSON.stringify(["VERIFY_EVIDENCE","verification:approve"])],
    );

    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED'),($6,$2,$7,'VERIFIED')",
        [allowedIdentity.rows[0]!.id,organizationId,allowedRole.rows[0]!.id,deniedIdentity.rows[0]!.id,deniedRole.rows[0]!.id,verifierIdentity.rows[0]!.id,verifierRole.rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }

    await pool.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [organizationId,geographyId],
    );
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)",
      [allowedIdentity.rows[0]!.id,hash(allowedToken),deniedIdentity.rows[0]!.id,hash(deniedToken)],
    );

    const activity = await pool.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status) values($1,$2,$3,'BWG_REPORT_EVIDENCE_FIXTURE','COMPLETED') returning id",
      [organizationId,allowedIdentity.rows[0]!.id,geographyId],
    );
    const verifiedEvidence = await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'WASTE_WEIGHT_TICKET','VERIFIED',now(),'db://integration-test/verified-evidence',$2,$3::jsonb) returning id",
      [activity.rows[0]!.id,hash("verified-test-evidence-"+suffix),JSON.stringify({ testFixture: true, source: "DISPOSABLE_CI_ONLY" })],
    );
    const unverifiedEvidence = await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'WASTE_WEIGHT_TICKET','CAPTURED',now(),'db://integration-test/unverified-evidence',$2,$3::jsonb) returning id",
      [activity.rows[0]!.id,hash("unverified-test-evidence-"+suffix),JSON.stringify({ testFixture: true, source: "DISPOSABLE_CI_ONLY" })],
    );
    const otherTenantActivity = await pool.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status) values($1,$2,$3,'OTHER_TENANT_EVIDENCE_FIXTURE','COMPLETED') returning id",
      [otherOrganizationId,allowedIdentity.rows[0]!.id,geographyId],
    );
    const crossTenantEvidence = await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'WASTE_WEIGHT_TICKET','VERIFIED',now(),'db://integration-test/cross-tenant-evidence',$2,$3::jsonb) returning id",
      [otherTenantActivity.rows[0]!.id,hash("cross-tenant-test-evidence-"+suffix),JSON.stringify({ testFixture: true, source: "DISPOSABLE_CI_ONLY" })],
    );
    const verification = await pool.query<{ id: string }>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','BWG_REPORTING','Disposable integration fixture verification') returning id",
      [verifiedEvidence.rows[0]!.id,activity.rows[0]!.id,verifierIdentity.rows[0]!.id],
    );

    // This isolated fixture represents an already authority-verified BWG profile.
    // It is inserted directly only in disposable CI PostgreSQL so reporting-route
    // acceptance can be tested. It is not a CPCB submission or production assertion.
    await pool.query(
      "insert into bwg_profiles (organization_id,jurisdiction_id,floor_area_sqm,water_consumption_lpd,waste_generation_kg_day,establishment_type,applicability_status,applicability_basis,status,regulatory_registration_status,regulatory_registration_reference) values ($1,$2,25000,50000,150,'INSTITUTIONAL','APPLICABLE',$3::jsonb,'VERIFIED','ACCEPTED',$4)",
      [organizationId,geographyId,JSON.stringify({ testFixture: true, authority: "DISPOSABLE_CI_FIXTURE_ONLY", externalAcceptance: true }),"TEST-CPCB-REG-"+suffix],
    );

    const allowedHeaders = { authorization: "Bearer " + allowedToken, "x-rupaykg-organization-id": organizationId };
    const deniedHeaders = { authorization: "Bearer " + deniedToken, "x-rupaykg-organization-id": organizationId };

    const period = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods",
      headers: allowedHeaders,
      payload: { organizationId, periodStart: "2026-01-01", periodEnd: "2026-03-31", reportingBasis: "QUARTERLY" },
    });
    assert.equal(period.statusCode, 201, period.body);
    assert.equal(period.json().period.external_submission_status, "NOT_SUBMITTED");
    periodId = period.json().period.id;

    const deniedPeriod = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods",
      headers: deniedHeaders,
      payload: { organizationId, periodStart: "2026-04-01", periodEnd: "2026-06-30", reportingBasis: "QUARTERLY" },
    });
    assert.equal(deniedPeriod.statusCode, 403, deniedPeriod.body);
    assert.equal(deniedPeriod.json().code, "BWG_PERIOD_FORBIDDEN");

    const waste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/waste",
      headers: allowedHeaders,
      payload: { wasteStream: "ORGANIC", unit: "kg", generatedQuantity: 100, segregatedQuantity: 80, channelizedQuantity: 70, processedQuantity: 60, evidenceId: verifiedEvidence.rows[0]!.id, verificationId: verification.rows[0]!.id },
    });
    assert.equal(waste.statusCode, 201, waste.body);
    assert.equal(waste.json().wasteReport.status, "VERIFIED");

    const pendingWaste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/waste",
      headers: allowedHeaders,
      payload: { wasteStream: "DRY", unit: "kg", generatedQuantity: 20 },
    });
    assert.equal(pendingWaste.statusCode, 201, pendingWaste.body);
    assert.equal(pendingWaste.json().wasteReport.status, "PENDING");

    const unverifiedWaste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/waste",
      headers: allowedHeaders,
      payload: { wasteStream: "ORGANIC", unit: "kg", generatedQuantity: 10, evidenceId: unverifiedEvidence.rows[0]!.id },
    });
    assert.equal(unverifiedWaste.statusCode, 409, unverifiedWaste.body);
    assert.equal(unverifiedWaste.json().code, "EVIDENCE_NOT_VERIFIED");

    const crossTenantWaste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/waste",
      headers: allowedHeaders,
      payload: { wasteStream: "ORGANIC", unit: "kg", generatedQuantity: 10, evidenceId: crossTenantEvidence.rows[0]!.id },
    });
    assert.equal(crossTenantWaste.statusCode, 409, crossTenantWaste.body);
    assert.equal(crossTenantWaste.json().code, "EVIDENCE_NOT_VERIFIED");

    const mismatchedVerification = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/waste",
      headers: allowedHeaders,
      payload: { wasteStream: "ORGANIC", unit: "kg", generatedQuantity: 10, evidenceId: verifiedEvidence.rows[0]!.id, verificationId: randomUUID() },
    });
    assert.equal(mismatchedVerification.statusCode, 409, mismatchedVerification.body);
    assert.equal(mismatchedVerification.json().code, "VERIFICATION_INVALID");

    const deniedWaste = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/waste",
      headers: deniedHeaders,
      payload: { wasteStream: "ORGANIC", unit: "kg", generatedQuantity: 50 },
    });
    assert.equal(deniedWaste.statusCode, 403, deniedWaste.body);
    assert.equal(deniedWaste.json().code, "BWG_WASTE_FORBIDDEN");

    const scheme = await pool.query<{ id: string }>(
      "select id from epr_schemes where status='VERIFIED' order by code limit 1",
    );
    assert.ok(scheme.rows[0]?.id, "a verified EPR scheme fixture must exist after migrations");

    const epr = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/epr",
      headers: allowedHeaders,
      payload: { schemeId: scheme.rows[0]!.id, categoryCode: "TEST_CATEGORY", obligatedQuantity: 100, fulfilledQuantity: 50 },
    });
    assert.equal(epr.statusCode, 201, epr.body);
    assert.equal(epr.json().eprReport.status, "PENDING");
    assert.equal(epr.json().externalSubmission, "NOT_SUBMITTED");

    const deniedEpr = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/epr",
      headers: deniedHeaders,
      payload: { schemeId: scheme.rows[0]!.id, categoryCode: "TEST_CATEGORY", obligatedQuantity: 100, fulfilledQuantity: 50 },
    });
    assert.equal(deniedEpr.statusCode, 403, deniedEpr.body);
    assert.equal(deniedEpr.json().code, "BWG_EPR_FORBIDDEN");

    const esg = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/esg",
      headers: allowedHeaders,
      payload: { metricCode: "WASTE_RECOVERY_RATE", scope: "SCOPE_3", unit: "%", value: 75 },
    });
    assert.equal(esg.statusCode, 201, esg.body);
    assert.equal(esg.json().esgReport.status, "PENDING");

    const deniedEsg = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods/"+periodId+"/esg",
      headers: deniedHeaders,
      payload: { metricCode: "WASTE_RECOVERY_RATE", scope: "SCOPE_3", unit: "%", value: 75 },
    });
    assert.equal(deniedEsg.statusCode, 403, deniedEsg.body);
    assert.equal(deniedEsg.json().code, "BWG_ESG_FORBIDDEN");

    const counts = await pool.query<{ waste: string; epr: string; esg: string }>(
      "select (select count(*) from bwg_waste_reports where reporting_period_id=$1)::text as waste, (select count(*) from bwg_epr_reports where reporting_period_id=$1)::text as epr, (select count(*) from bwg_esg_reports where reporting_period_id=$1)::text as esg",
      [periodId],
    );
    assert.deepEqual(counts.rows[0], { waste: "2", epr: "1", esg: "1" });
  } finally {
    if (otherOrganizationId) {
      await pool.query("delete from evidence where activity_id in (select id from activities where organization_id=$1)", [otherOrganizationId]);
      await pool.query("delete from activities where organization_id=$1", [otherOrganizationId]);
      await pool.query("delete from organization_statutory_profiles where organization_id=$1", [otherOrganizationId]);
      await pool.query("delete from organizations where id=$1", [otherOrganizationId]);
    }
    if (organizationId) {
      await pool.query("delete from bwg_waste_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from verifications where evidence_id in (select e.id from evidence e join activities a on a.id=e.activity_id where a.organization_id=$1)", [organizationId]);
      await pool.query("delete from evidence where activity_id in (select id from activities where organization_id=$1)", [organizationId]);
      await pool.query("delete from activities where organization_id=$1", [organizationId]);
      await pool.query("delete from bwg_epr_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_esg_reports where reporting_period_id in (select id from bwg_reporting_periods where organization_id=$1)", [organizationId]);
      await pool.query("delete from bwg_reporting_periods where organization_id=$1", [organizationId]);
      await pool.query("delete from bwg_profiles where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_memberships where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_statutory_profiles where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_bwg_assessments where organization_id=$1", [organizationId]);
      await pool.query("delete from organization_epr_applicability where organization_id=$1", [organizationId]);
      await pool.query("delete from roles where organization_id=$1", [organizationId]);
      if (identityIds.length) {
        await pool.query("delete from identity_sessions where identity_id = any($1::uuid[])", [identityIds]);
        await pool.query("delete from identities where id = any($1::uuid[])", [identityIds]);
      }
      await pool.query("delete from organizations where id=$1", [organizationId]);
    }
    if (geographyId) await pool.query("delete from geography where id=$1", [geographyId]);
    await app.close();
    await pool.end();
  }
});
