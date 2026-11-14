import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerReportingRoutes } from "./reporting-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");

test("SWM report resolves verified stakeholder roles and persists immutable tenant-scoped runs", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const app = Fastify({ logger: false });
  const suffix = randomBytes(8).toString("hex");
  const organizationIds: string[] = [];
  const identityIds: string[] = [];
  let geographyId = "";
  let activityId = "";
  let recyclerActivityId = "";
  let transporterActivityId = "";
  let runId = "";
  try {
    await registerReportingRoutes(app, pool);

    const owner = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'AGGREGATOR','VERIFIED') returning id",
      ["TEST-REPORT-OWNER-" + suffix],
    );
    const outsider = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'AGGREGATOR','VERIFIED') returning id",
      ["TEST-REPORT-OUTSIDER-" + suffix],
    );
    organizationIds.push(owner.rows[0]!.id, outsider.rows[0]!.id);

    const geography = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('ULB',$1,'reporting-integration','fixture-v1') returning id",
      ["TEST-REPORT-ULB-" + suffix],
    );
    geographyId = geography.rows[0]!.id;
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)", [organizationIds[0], geographyId]);

    const identities = await Promise.all([
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["report-owner:"+suffix,"Report Owner","report-owner-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["report-recycler:"+suffix,"Report Recycler","report-recycler-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["report-transporter:"+suffix,"Report Transporter","report-transporter-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["report-outsider:"+suffix,"Report Outsider","report-outsider-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["report-outsider-reviewer:"+suffix,"Report Outsider Reviewer","report-outsider-reviewer-"+suffix+"@example.invalid"]),
    ]);
    identityIds.push(...identities.map(result => result.rows[0]!.id));
    const ownerIdentityId = identityIds[0]!;
    const recyclerIdentityId = identityIds[1]!;
    const transporterIdentityId = identityIds[2]!;
    const outsiderIdentityId = identityIds[3]!;
    const outsiderReviewerId = identityIds[4]!;

    const roles = await Promise.all([
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'aggregator','[]'::jsonb,'[]'::jsonb) returning id", [organizationIds[0]]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'recycler','[]'::jsonb,'[]'::jsonb) returning id", [organizationIds[0]]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'transporter','[]'::jsonb,'[]'::jsonb) returning id", [organizationIds[0]]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'aggregator','[]'::jsonb,'[]'::jsonb) returning id", [organizationIds[1]]),
    ]);
    const ownerRoleId = roles[0]!.rows[0]!.id;
    const recyclerRoleId = roles[1]!.rows[0]!.id;
    const transporterRoleId = roles[2]!.rows[0]!.id;
    const outsiderRoleId = roles[3]!.rows[0]!.id;
    const roleDefaults = await pool.query<{ name: string; permissions: string[] }>(
      "select name,permissions from roles where id=any($1::uuid[])",
      [[recyclerRoleId, transporterRoleId]],
    );
    assert.ok(roleDefaults.rows.every(role => role.permissions.includes("reports:read")));
    const canonicalDefaults = await pool.query<{ generator: string[]; bwg: string[]; ulb: string[]; gram: string[] }>("select rupaykg_default_role_permissions('generator') as generator, rupaykg_default_role_permissions('bwg') as bwg, rupaykg_default_role_permissions('ulb_admin') as ulb, rupaykg_default_role_permissions('gram_panchayat_admin') as gram");
    assert.ok(canonicalDefaults.rows[0]!.generator.includes("reports:read"));
    assert.ok(canonicalDefaults.rows[0]!.bwg.includes("swm:read"));
    assert.ok(canonicalDefaults.rows[0]!.ulb.includes("swm:manage"));
    assert.ok(canonicalDefaults.rows[0]!.gram.includes("swm:read"));

    // Seed pre-approved onboarding fixture records so the membership guard is
    // satisfied. This test targets reporting, not the onboarding approval workflow.
    await pool.query(
      "insert into stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type,status,reviewed_by_identity_id,reviewed_at) values($1,$2,$3,'aggregator','AGGREGATOR','APPROVED',$4,now()),($5,$2,$6,'recycler','RECYCLER','APPROVED',$1,now()),($7,$2,$8,'transporter','TRANSPORTER','APPROVED',$1,now()),($9,$10,$11,'aggregator','AGGREGATOR','APPROVED',$12,now())",
      [ownerIdentityId, organizationIds[0], ownerRoleId, recyclerIdentityId, recyclerIdentityId, recyclerRoleId, transporterIdentityId, transporterRoleId, outsiderIdentityId, organizationIds[1], outsiderRoleId, outsiderReviewerId],
    );
    await pool.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED'),($6,$2,$7,'VERIFIED'),($8,$9,$10,'VERIFIED')",
      [ownerIdentityId, organizationIds[0], ownerRoleId, recyclerIdentityId, recyclerRoleId, transporterIdentityId, transporterRoleId, outsiderIdentityId, organizationIds[1], outsiderRoleId],
    );

    const ownerToken = token();
    const outsiderToken = token();
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)",
      [ownerIdentityId, hash(ownerToken), outsiderIdentityId, hash(outsiderToken)],
    );

    activityId = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,occurred_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id",
      [organizationIds[0], ownerIdentityId, geographyId],
    )).rows[0]!.id;
    recyclerActivityId = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,occurred_at) values($1,$2,$3,'RECYCLING','COMPLETED',now()) returning id",
      [organizationIds[0], recyclerIdentityId, geographyId],
    )).rows[0]!.id;
    transporterActivityId = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,occurred_at) values($1,$2,$3,'TRANSPORT','COMPLETED',now()) returning id",
      [organizationIds[0], transporterIdentityId, geographyId],
    )).rows[0]!.id;
    await pool.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,quality_status) values($1,100,'kg','WEIGHBRIDGE','FIELD',now(),'VERIFIED'),($2,200,'kg','WEIGHBRIDGE','FIELD',now(),'VERIFIED'),($3,300,'kg','WEIGHBRIDGE','FIELD',now(),'VERIFIED')",
      [activityId, recyclerActivityId, transporterActivityId],
    );

    const headers = (bearer: string, organizationId: string) => ({
      authorization: "Bearer " + bearer,
      "x-rupaykg-organization-id": organizationId,
    });
    const day = (await pool.query<{ day: string }>("select current_date::text as day")).rows[0]!.day;
    const previewUrl = "/api/v1/reports/swm-2026/preview?periodStart=" + day + "&periodEnd=" + day + "&context=urban";
    const preview = await app.inject({ method: "GET", url: previewUrl, headers: headers(ownerToken, organizationIds[0]!) });
    assert.equal(preview.statusCode, 200, preview.body);
    const report = preview.json().report as { snapshotHash: string; generatedAt: string; rows: Array<{ id: string; stakeholder: string; stakeholderAttribution: string }> };
    const activityRow = report.rows.find(row => row.id === activityId);
    assert.ok(activityRow, "activity must be included in the report snapshot");
    assert.equal(activityRow.stakeholder, "AGGREGATOR");
    assert.equal(activityRow.stakeholderAttribution, "VERIFIED");
    assert.equal(report.rows.find(row => row.id === recyclerActivityId)?.stakeholder, "RECYCLER");
    assert.equal(report.rows.find(row => row.id === recyclerActivityId)?.stakeholderAttribution, "VERIFIED");
    assert.equal(report.rows.find(row => row.id === transporterActivityId)?.stakeholder, "TRANSPORTER");
    assert.equal(report.rows.find(row => row.id === transporterActivityId)?.stakeholderAttribution, "VERIFIED");

    await pool.query("update measurements set value=101 where activity_id=$1", [activityId]);
    const stale = await app.inject({
      method: "POST",
      url: "/api/v1/reports/swm-2026/runs",
      headers: headers(ownerToken, organizationIds[0]!),
      payload: { periodStart: day, periodEnd: day, context: "urban", snapshotHash: report.snapshotHash, generatedAt: report.generatedAt },
    });
    assert.equal(stale.statusCode, 409, stale.body);
    assert.equal(stale.json().code, "REPORT_PREVIEW_STALE");

    const freshPreview = await app.inject({ method: "GET", url: previewUrl, headers: headers(ownerToken, organizationIds[0]!) });
    assert.equal(freshPreview.statusCode, 200, freshPreview.body);
    const freshReport = freshPreview.json().report as { snapshotHash: string; generatedAt: string };
    const saved = await app.inject({
      method: "POST",
      url: "/api/v1/reports/swm-2026/runs",
      headers: headers(ownerToken, organizationIds[0]!),
      payload: { periodStart: day, periodEnd: day, context: "urban", snapshotHash: freshReport.snapshotHash, generatedAt: freshReport.generatedAt },
    });
    assert.equal(saved.statusCode, 201, saved.body);
    runId = saved.json().run.id as string;

    const history = await app.inject({ method: "GET", url: "/api/v1/reports/runs?reportType=CPCB_SWMP_2026&limit=20", headers: headers(ownerToken, organizationIds[0]!) });
    assert.equal(history.statusCode, 200, history.body);
    assert.ok(history.json().runs.some((run: { id: string }) => run.id === runId));

    const retrieved = await app.inject({ method: "GET", url: "/api/v1/reports/runs/" + runId, headers: headers(ownerToken, organizationIds[0]!) });
    assert.equal(retrieved.statusCode, 200, retrieved.body);
    assert.equal(retrieved.json().run.snapshot.snapshotHash, freshReport.snapshotHash);

    const csv = await app.inject({ method: "GET", url: "/api/v1/reports/runs/" + runId + ".csv", headers: headers(ownerToken, organizationIds[0]!) });
    assert.equal(csv.statusCode, 200, csv.body);
    assert.match(csv.body, /AGGREGATOR/);
    assert.match(csv.body, /RECYCLER/);
    assert.match(csv.body, /TRANSPORTER/);
    assert.match(csv.body, /VERIFIED/);

    const outsiderRead = await app.inject({ method: "GET", url: "/api/v1/reports/runs/" + runId, headers: headers(outsiderToken, organizationIds[1]!) });
    assert.equal(outsiderRead.statusCode, 404, outsiderRead.body);
  } finally {
    await app.close();
    if (organizationIds.length) {
      await pool.query("delete from report_runs where organization_id=any($1::uuid[])", [organizationIds]);
      const activityIds = [activityId, recyclerActivityId, transporterActivityId].filter(Boolean);
      if (activityIds.length) {
        await pool.query("delete from measurements where activity_id=any($1::uuid[])", [activityIds]);
        await pool.query("delete from activities where id=any($1::uuid[])", [activityIds]);
      }
      if (identityIds.length) {
        await pool.query("delete from identity_sessions where identity_id=any($1::uuid[])", [identityIds]);
        await pool.query("delete from organization_memberships where identity_id=any($1::uuid[])", [identityIds]);
      }
      await pool.query("delete from stakeholder_applications where organization_id=any($1::uuid[])", [organizationIds]);
      await pool.query("delete from roles where organization_id=any($1::uuid[])", [organizationIds]);
      await pool.query("delete from organization_geography_scopes where organization_id=any($1::uuid[])", [organizationIds]);
      if (geographyId) await pool.query("delete from geography where id=$1", [geographyId]);
      if (identityIds.length) await pool.query("delete from identities where id=any($1::uuid[])", [identityIds]);
      await pool.query("delete from organizations where id=any($1::uuid[])", [organizationIds]);
    }
    await pool.end();
  }
});