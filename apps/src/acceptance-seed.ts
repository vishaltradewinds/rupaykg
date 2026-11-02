import { createHash } from "node:crypto";
import { Pool } from "pg";

/**
 * Creates one deterministic, idempotent live-acceptance dataset.
 *
 * Safety: this file does nothing unless RUPAYKG_ACCEPTANCE_SEED_ON_START=true.
 * It prefers an existing source-versioned operational geography. If none exists,
 * it uses the dedicated source-versioned acceptance fixture geography created by
 * migration 081; it never invents LGD/government geography data.
 */

if (process.env.RUPAYKG_ACCEPTANCE_SEED_ON_START !== "true") {
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
const sessionToken = process.env.RUPAYKG_ACCEPTANCE_SESSION_TOKEN;
if (!databaseUrl) throw new Error("DATABASE_URL is required for acceptance seed");
if (!sessionToken) throw new Error("RUPAYKG_ACCEPTANCE_SESSION_TOKEN is required for acceptance seed");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});

const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
const evidenceHash = createHash("sha256")
  .update("rupaykg-live-acceptance-wa03.001-v1")
  .digest("hex");

try {
  await pool.query("begin");

  const geography = await pool.query<{ id: string }>(
    `select id from geography
      where kind in ('ULB','DISTRICT','STATE_UT')
        and source is not null
        and source_version is not null
      order by case kind when 'ULB' then 1 when 'DISTRICT' then 2 else 3 end, created_at nulls last
      limit 1`,
  );

  let geographyId = geography.rows[0]?.id;
  if (!geographyId) {
    const fixtureGeography = await pool.query<{ id: string }>(
      `select id from geography
        where kind='CLUSTER'
          and code='RUPAYKG-ACCEPTANCE-V1'
          and source='RupayKG Acceptance Fixture Geography'
          and source_version='v1'
        limit 1`,
    );
    geographyId = fixtureGeography.rows[0]?.id;
  }
  if (!geographyId) {
    throw new Error("No source-versioned geography exists; acceptance fixture migration 081 may not have applied");
  }

  const identity = await pool.query<{ id: string }>(
    `insert into identities(external_subject, display_name, status)
     values ('rupaykg-live-acceptance-operator-v1', 'RupayKG Live Acceptance Operator', 'VERIFIED')
     on conflict(external_subject) do update set display_name=excluded.display_name, status='VERIFIED'
     returning id`,
  );
  if (!identity.rows[0]) throw new Error("Acceptance identity could not be created");
  const identityId = identity.rows[0].id;

  const verifier = await pool.query<{ id: string }>(
    `insert into identities(external_subject, display_name, status)
     values ('rupaykg-live-acceptance-verifier-v1', 'RupayKG Live Acceptance Independent Verifier', 'VERIFIED')
     on conflict(external_subject) do update set display_name=excluded.display_name, status='VERIFIED'
     returning id`,
  );
  if (!verifier.rows[0]) throw new Error("Acceptance verifier identity could not be created");
  const verifierIdentityId = verifier.rows[0].id;

  const organization = await pool.query<{ id: string }>(
    `insert into organizations(name, organization_type, status)
     values ('RupayKG Live Acceptance Test', 'ACCEPTANCE_TEST', 'VERIFIED')
     on conflict do nothing
     returning id`,
  );
  let organizationId = organization.rows[0]?.id;
  if (!organizationId) {
    const existing = await pool.query<{ id: string }>(
      `select id from organizations where name='RupayKG Live Acceptance Test' limit 1`,
    );
    if (!existing.rows[0]) throw new Error("Acceptance organization could not be created");
    organizationId = existing.rows[0].id;
  }

  const operatorRole = await pool.query<{ id: string }>(
    `insert into roles(organization_id, name, permissions, geography_scope)
     values ($1, 'Live Acceptance Operator', $2::jsonb, '[]'::jsonb)
     on conflict(organization_id, name) do update
       set permissions=excluded.permissions, geography_scope=excluded.geography_scope
     returning id`,
    [organizationId, JSON.stringify(["guardian:read", "guardian:operate", "verification:approve"])],
  );
  if (!operatorRole.rows[0]) throw new Error("Acceptance operator role could not be created");
  const operatorRoleId = operatorRole.rows[0].id;

  const verifierRole = await pool.query<{ id: string }>(
    `insert into roles(organization_id, name, permissions, geography_scope)
     values ($1, 'Live Acceptance Verifier', $2::jsonb, '[]'::jsonb)
     on conflict(organization_id, name) do update
       set permissions=excluded.permissions, geography_scope=excluded.geography_scope
     returning id`,
    [organizationId, JSON.stringify(["VERIFY_EVIDENCE", "verification:approve", "verification.approve"])],
  );
  if (!verifierRole.rows[0]) throw new Error("Acceptance verifier role could not be created");
  const verifierRoleId = verifierRole.rows[0].id;

  await pool.query(
    `insert into organization_memberships(identity_id, organization_id, role_id, status)
     values ($1,$2,$3,'VERIFIED')
     on conflict(identity_id, organization_id, role_id) do update set status='VERIFIED'`,
    [identityId, organizationId, operatorRoleId],
  );

  await pool.query(
    `insert into organization_memberships(identity_id, organization_id, role_id, status)
     values ($1,$2,$3,'VERIFIED')
     on conflict(identity_id, organization_id, role_id) do update set status='VERIFIED'`,
    [verifierIdentityId, organizationId, verifierRoleId],
  );

  await pool.query(
    `insert into organization_geography_scopes(organization_id, geography_id, status)
     values ($1,$2,'VERIFIED')
     on conflict(organization_id, geography_id) do update set status='VERIFIED'`,
    [organizationId, geographyId],
  );

  const activity = await pool.query<{ id: string }>(
    `insert into activities(
       organization_id, actor_identity_id, geography_id, activity_type, status,
       occurred_at, metadata, completed_at, idempotency_key, captured_at
     ) values ($1,$2,$3,'WASTE_TO_CARBON_MRV','COMPLETED',now(),$4::jsonb,now(),'live-acceptance-wa03.001-v1',now())
     on conflict(idempotency_key) do update
       set status='COMPLETED', geography_id=excluded.geography_id,
           metadata=excluded.metadata, completed_at=excluded.completed_at
     returning id`,
    [organizationId, identityId, geographyId, JSON.stringify({ acceptanceFixture: true, methodologyCode: "WA03.001" })],
  );
  if (!activity.rows[0]) throw new Error("Acceptance activity could not be created");
  const activityId = activity.rows[0].id;

  const measurement = await pool.query<{ id: string }>(
    `insert into measurements(activity_id, value, unit, method, source, measured_at, quality_status, metadata)
     values ($1,1000,'kg','acceptance-scale','live-acceptance-fixture',now(),'VERIFIED',$2::jsonb)
     returning id`,
    [activityId, JSON.stringify({ acceptanceFixture: true })],
  );
  if (!measurement.rows[0]) throw new Error("Acceptance measurement could not be created");
  const measurementId = measurement.rows[0].id;

  const evidence = await pool.query<{ id: string }>(
    `insert into evidence(
       activity_id, measurement_id, evidence_type, status, captured_at,
       content_uri, content_hash, captured_by_identity_id, metadata
     ) values ($1,$2,'WEIGHBRIDGE_RECORD','VERIFIED',now(),
       'urn:rupaykg:acceptance:wa03.001',$3,$4,$5::jsonb)
     on conflict do nothing
     returning id`,
    [activityId, measurementId, evidenceHash, identityId, JSON.stringify({ acceptanceFixture: true, methodologyCode: "WA03.001" })],
  );
  let evidenceId = evidence.rows[0]?.id;
  if (!evidenceId) {
    const existing = await pool.query<{ id: string }>(
      `select id from evidence where activity_id=$1 and content_hash=$2 limit 1`,
      [activityId, evidenceHash],
    );
    evidenceId = existing.rows[0]?.id;
  }
  if (!evidenceId) throw new Error("Acceptance evidence could not be created");

  const verification = await pool.query<{ id: string }>(
    `insert into verifications(evidence_id, activity_id, verifier_identity_id, decision, scope, rationale, decided_at)
     values ($1,$2,$3,'APPROVED','WA03.001','Live acceptance fixture approved for external Guardian/Hedera integration test',now())
     on conflict do nothing
     returning id`,
    [evidenceId, activityId, verifierIdentityId],
  );
  let verificationId = verification.rows[0]?.id;
  if (!verificationId) {
    const existing = await pool.query<{ id: string }>(
      `select id from verifications where activity_id=$1 and evidence_id=$2 and verifier_identity_id=$3 order by decided_at desc limit 1`,
      [activityId, evidenceId, verifierIdentityId],
    );
    verificationId = existing.rows[0]?.id;
  }
  if (!verificationId) throw new Error("Acceptance verification could not be created");

  await pool.query(
    `insert into mrv_observations(
       activity_id, measurement_id, parameter_code, observed_value, unit, method,
       instrument_id, observed_at, uncertainty, quality_status, metadata
     ) values ($1,$2,'WASTE_MASS',1000,'kg','acceptance-scale','ACCEPTANCE-INSTRUMENT-01',now(),0,'VERIFIED',$3::jsonb)`,
    [activityId, measurementId, JSON.stringify({ acceptanceFixture: true })],
  );

  await pool.query(
    `insert into activity_assignments(activity_id, identity_id, role_id)
     values ($1,$2,$3) on conflict(activity_id, identity_id) do update set role_id=excluded.role_id`,
    [activityId, identityId, operatorRoleId],
  );

  await pool.query(
    `insert into identity_sessions(identity_id, expires_at, token_hash, request_context)
     values ($1, now() + interval '7 days', $2, $3::jsonb)
     on conflict(token_hash) do update set expires_at=excluded.expires_at, revoked_at=null,
       request_context=excluded.request_context`,
    [identityId, tokenHash, JSON.stringify({ purpose: "live-acceptance", fixture: true })],
  );

  await pool.query("commit");
  console.log(JSON.stringify({
    event: "RUPAYKG_ACCEPTANCE_FIXTURE_READY",
    organizationId,
    activityId,
    verificationId,
    evidenceId,
    guardianPolicyId: process.env.GUARDIAN_MRV_POLICY_ID || "rupaykg:guardian-mrv:v1",
    methodologyCode: "WA03.001",
  }));
} catch (error) {
  await pool.query("rollback");
  throw error;
} finally {
  await pool.end();
}
