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
  try {
    organizationId = (await pool.query<{id:string}>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-AGENTIC-AUTH-" + suffix],
    )).rows[0]!.id;
    otherOrganizationId = (await pool.query<{id:string}>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-AGENTIC-AUTH-OTHER-" + suffix],
    )).rows[0]!.id;
    const identity = (await pool.query<{id:string}>(
      "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["test-agentic-auth:" + suffix, "Agentic authorization test"],
    )).rows[0]!.id;
    identityIds.push(identity);

    const roleSpecs = [
      { name: "TEST-AGENTIC-READ-" + suffix, permissions: ["waste:read"] },
      { name: "TEST-AGENTIC-MANAGE-ONLY-" + suffix, permissions: ["projects:manage"] },
      { name: "TEST-AGENTIC-VERIFY-ONLY-" + suffix, permissions: ["VERIFY_EVIDENCE"] },
      { name: "TEST-AGENTIC-STAKEHOLDER-MANAGE-ONLY-" + suffix, permissions: ["MANAGE_STAKEHOLDERS"] },
    ];
    for (const spec of roleSpecs) {
      roleIds.push((await pool.query<{id:string}>(
        "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
        [organizationId, spec.name, JSON.stringify(spec.permissions)],
      )).rows[0]!.id);
    }
    const foreignRole = (await pool.query<{id:string}>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [otherOrganizationId, "TEST-AGENTIC-FOREIGN-" + suffix, JSON.stringify(["waste:read","audit:read"])],
    )).rows[0]!.id;
    roleIds.push(foreignRole);

    // This test is opt-in and only runs against the disposable PostgreSQL CI database.
    // Disable the lifecycle-only onboarding guard for fixture setup, then restore it immediately.
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      for (const roleId of roleIds.slice(0, 4)) {
        await pool.query(
          "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
          [identity, organizationId, roleId],
        );
      }
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
        [identity, otherOrganizationId, foreignRole],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }

    const auth: AuthContext = {
      identityId: identity,
      memberships: [
        { organization_id: organizationId, role_id: roleIds[0]!, status: "VERIFIED" },
        { organization_id: organizationId, role_id: roleIds[1]!, status: "VERIFIED" },
        { organization_id: organizationId, role_id: roleIds[2]!, status: "VERIFIED" },
        { organization_id: organizationId, role_id: roleIds[3]!, status: "VERIFIED" },
        { organization_id: otherOrganizationId, role_id: foreignRole, status: "VERIFIED" },
      ],
      activeOrganizationId: organizationId,
    };

    assert.deepEqual(
      await authorizeAgenticTools(pool, auth, organizationId, "review_measurements"),
      { allowed: true, toolIds: ["activities.list", "measurements.count"] },
      "the explicit read permission should authorize read-only measurement tools",
    );

    const manageOnlyAuth: AuthContext = { ...auth, memberships: [auth.memberships[1]!] };
    assert.deepEqual(
      await authorizeAgenticTools(pool, manageOnlyAuth, organizationId, "review_measurements"),
      { allowed: false, deniedToolId: "activities.list" },
      "projects:manage alone must not authorize read-only tools",
    );

    const verifyOnlyAuth: AuthContext = { ...auth, memberships: [auth.memberships[2]!] };
    assert.deepEqual(
      await authorizeAgenticTools(pool, verifyOnlyAuth, organizationId, "review_measurements"),
      { allowed: false, deniedToolId: "activities.list" },
      "verification authority alone must not authorize read-only tools",
    );

    const stakeholderManageOnlyAuth: AuthContext = { ...auth, memberships: [auth.memberships[3]!] };
    assert.deepEqual(
      await authorizeAgenticTools(pool, stakeholderManageOnlyAuth, organizationId, "onboard_stakeholder"),
      { allowed: false, deniedToolId: "stakeholder_applications.list" },
      "stakeholder-management authority alone must not authorize read-only onboarding data",
    );

    assert.deepEqual(
      await authorizeAgenticTools(pool, auth, otherOrganizationId, "review_measurements"),
      { allowed: false, deniedToolId: "activities.list" },
      "active organization scope must prevent using another organization's permission",
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
