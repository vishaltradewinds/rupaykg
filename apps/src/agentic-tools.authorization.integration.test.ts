import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { authorizeAgenticTools } from "./agentic-tools.js";
import type { AuthContext } from "./auth.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("agentic tool authorization uses real PostgreSQL role permissions and rejects elevated-only grants", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let organizationId = "";
  let otherOrganizationId = "";
  const identityIds: string[] = [];
  const roleIds: string[] = [];
  const memberships: Array<{ identityId: string; organizationId: string; roleId: string }> = [];
  try {
    organizationId = (await pool.query<{id:string}>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-AGENTIC-AUTH-" + suffix],
    )).rows[0]!.id;
    otherOrganizationId = (await pool.query<{id:string}>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-AGENTIC-AUTH-OTHER-" + suffix],
    )).rows[0]!.id;

    const scenarios = [
      { key: "read", permissions: ["waste:read"], org: organizationId },
      { key: "evidence-read", permissions: ["projects:read", "evidence:read", "audit:read"], org: organizationId },
      { key: "manage-only", permissions: ["projects:manage"], org: organizationId },
      { key: "verify-only", permissions: ["VERIFY_EVIDENCE"], org: organizationId },
      { key: "stakeholder-manage-only", permissions: ["MANAGE_STAKEHOLDERS"], org: organizationId },
      { key: "foreign-read", permissions: ["waste:read", "audit:read"], org: otherOrganizationId },
    ];
    const authByKey: Record<string, AuthContext> = {};

    for (const scenario of scenarios) {
      const identityId = (await pool.query<{id:string}>(
        "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
        ["test-agentic-auth:" + suffix + ":" + scenario.key, "Agentic authorization " + scenario.key],
      )).rows[0]!.id;
      identityIds.push(identityId);
      const roleId = (await pool.query<{id:string}>(
        "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
        [scenario.org, "TEST-AGENTIC-" + scenario.key + "-" + suffix, JSON.stringify(scenario.permissions)],
      )).rows[0]!.id;
      roleIds.push(roleId);
      memberships.push({ identityId, organizationId: scenario.org, roleId });
      authByKey[scenario.key] = {
        identityId,
        memberships: [{ organization_id: scenario.org, role_id: roleId, status: "VERIFIED" }],
        activeOrganizationId: scenario.org,
      };
    }

    // This opt-in test runs only against the disposable PostgreSQL CI database.
    // Disable the lifecycle-only onboarding guard for fixture setup, then restore it immediately.
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      for (const membership of memberships) {
        await pool.query(
          "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
          [membership.identityId, membership.organizationId, membership.roleId],
        );
      }
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }

    assert.deepEqual(
      await authorizeAgenticTools(pool, authByKey.read!, organizationId, "review_measurements"),
      { allowed: true, toolIds: ["activities.list", "measurements.count"] },
      "explicit read permission should authorize read-only measurement tools",
    );
    assert.deepEqual(
      await authorizeAgenticTools(pool, authByKey["manage-only"]!, organizationId, "review_measurements"),
      { allowed: false, deniedToolId: "activities.list" },
      "projects:manage alone must not authorize read-only tools",
    );
    assert.deepEqual(
      await authorizeAgenticTools(pool, authByKey["verify-only"]!, organizationId, "review_measurements"),
      { allowed: false, deniedToolId: "activities.list" },
      "verification authority alone must not authorize read-only tools",
    );
    assert.deepEqual(
      await authorizeAgenticTools(pool, authByKey["stakeholder-manage-only"]!, organizationId, "onboard_stakeholder"),
      { allowed: false, deniedToolId: "stakeholder_applications.list" },
      "stakeholder-management authority alone must not authorize read-only onboarding data",
    );
    assert.deepEqual(
      await authorizeAgenticTools(pool, authByKey.read!, otherOrganizationId, "review_measurements"),
      { allowed: false, deniedToolId: "activities.list" },
      "an identity's permission in one organization must not authorize another organization",
    );
  } finally {
    if (identityIds.length) await pool.query("delete from organization_memberships where identity_id=any($1::uuid[])", [identityIds]);
    if (identityIds.length) await pool.query("delete from identities where id=any($1::uuid[])", [identityIds]);
    if (roleIds.length) await pool.query("delete from roles where id=any($1::uuid[])", [roleIds]);
    if (organizationId) await pool.query("delete from organizations where id=$1", [organizationId]);
    if (otherOrganizationId) await pool.query("delete from organizations where id=$1", [otherOrganizationId]);
    await pool.end();
  }
});


test("role geography scope permits descendants and denies unrelated or unlocated records", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let organizationId = "";
  let roleId = "";
  let ambiguousRoleId = "";
  let identityId = "";
  let rootId = "";
  let childId = "";
  let outsideId = "";
  try {
    organizationId = (await pool.query<{id:string}>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-ROLE-GEO-" + suffix],
    )).rows[0]!.id;
    rootId = (await pool.query<{id:string}>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      ["TEST-STATE-" + suffix, "Test role scope root " + suffix],
    )).rows[0]!.id;
    childId = (await pool.query<{id:string}>(
      "insert into geography(parent_id,kind,code,name) values($1,'DISTRICT',$2,$3) returning id",
      [rootId, "TEST-DISTRICT-" + suffix, "Test role scope child " + suffix],
    )).rows[0]!.id;
    outsideId = (await pool.query<{id:string}>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      ["TEST-OUTSIDE-" + suffix, "Test role scope outside " + suffix],
    )).rows[0]!.id;
    roleId = (await pool.query<{id:string}>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,'[\"waste:read\"]'::jsonb,jsonb_build_array($3::text)) returning id",
      [organizationId, "TEST-ROLE-GEO-" + suffix, rootId],
    )).rows[0]!.id;

    identityId = (await pool.query<{id:string}>(
      "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["TEST-ROLE-GEO-IDENTITY-" + suffix, "Test role geography identity " + suffix],
    )).rows[0]!.id;
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [organizationId, rootId]);
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [identityId, organizationId, roleId]);
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }

    const descendant = await pool.query<{ok:boolean}>(
      "select role_has_geography_scope($1::uuid,$2::uuid) as ok", [roleId, childId],
    );
    const unrelated = await pool.query<{ok:boolean}>(
      "select role_has_geography_scope($1::uuid,$2::uuid) as ok", [roleId, outsideId],
    );
    const unlocated = await pool.query<{ok:boolean}>(
      "select role_has_geography_scope($1::uuid,null::uuid) as ok", [roleId],
    );
    assert.equal(descendant.rows[0]?.ok, true, "a configured root must include descendants");
    assert.equal(unrelated.rows[0]?.ok, false, "a configured root must exclude unrelated geographies");
    assert.equal(unlocated.rows[0]?.ok, false, "a restricted role must not see records without geography");

    const identityDescendant = await pool.query<{ok:boolean}>(
      "select identity_has_geography_scope($1::uuid,$2::uuid,$3::uuid) as ok", [identityId, organizationId, childId],
    );
    const identityUnrelated = await pool.query<{ok:boolean}>(
      "select identity_has_geography_scope($1::uuid,$2::uuid,$3::uuid) as ok", [identityId, organizationId, outsideId],
    );
    assert.equal(identityDescendant.rows[0]?.ok, true, "identity scope must require both organization and role geography grants");
    assert.equal(identityUnrelated.rows[0]?.ok, false, "identity scope must reject geography outside the role grant");

    ambiguousRoleId = (await pool.query<{id:string}>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,'[\"reports:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationId, "TEST-ROLE-GEO-AMBIGUOUS-" + suffix],
    )).rows[0]!.id;
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [identityId, organizationId, ambiguousRoleId]);
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }
    const ambiguous = await pool.query<{ok:boolean}>(
      "select identity_has_geography_scope($1::uuid,$2::uuid,$3::uuid) as ok", [identityId, organizationId, childId],
    );
    assert.equal(ambiguous.rows[0]?.ok, false, "multiple verified roles must fail closed instead of choosing the broader role");
  } finally {
    if (identityId) await pool.query("delete from organization_memberships where identity_id=$1", [identityId]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    if (roleId) await pool.query("delete from roles where id=$1", [roleId]);
    if (ambiguousRoleId) await pool.query("delete from roles where id=$1", [ambiguousRoleId]);
    if (organizationId) await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]);
    if (childId) await pool.query("delete from geography where id=$1", [childId]);
    if (rootId) await pool.query("delete from geography where id=$1", [rootId]);
    if (outsideId) await pool.query("delete from geography where id=$1", [outsideId]);
    if (organizationId) await pool.query("delete from organizations where id=$1", [organizationId]);
    await pool.end();
  }
});
