import { createHash } from "node:crypto";
import { Pool } from "pg";

/**
 * Creates one deterministic, idempotent live-acceptance dataset.
 *
 * Safety: acceptance seeding is forbidden in production and otherwise does
 * nothing unless RUPAYKG_ACCEPTANCE_SEED_ON_START=true. It prefers an existing
 * source-versioned operational geography. If none exists, it uses the dedicated
 * source-versioned acceptance fixture geography created by migration 081; it
 * never invents LGD/government geography data.
 */

if (process.env.NODE_ENV === "production") {
  throw new Error("Acceptance seeding is forbidden in production");
}

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
    `insert into organization_memberships(identity_id, org
