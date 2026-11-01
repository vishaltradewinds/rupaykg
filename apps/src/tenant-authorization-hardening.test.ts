import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { lockOrganizationPermission, type AuthContext } from "./auth.js";

const databaseUrl = process.env.DATABASE_URL;

test("high-risk authorization lock serializes membership revocation", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const suffix = randomUUID();
  let organizationId = "";
  let identityId = "";
  let roleId = "";
  let membershipId = "";
  const setup = await pool.connect();
  try {
    await setup.query("begin");
    organizationId = (await setup.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`tenant-auth-lock-org-${suffix}`],
    )).rows[0]!.id;
    identityId = (await setup.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`tenant-auth-lock-identity-${suffix}`, "Tenant Authorization Lock Test"],
    )).rows[0]!.id;
    roleId = (await setup.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id",
      [organizationId, `tenant-auth-lock-role-${suffix}`, JSON.stringify(["ISSUE_CREDENTIAL"])],
    )).rows[0]!.id;
    membershipId = (await setup.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    )).rows[0]!.id;
    await setup.query("commit");

    const auth: AuthContext = {
      identityId,
      memberships: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }],
      activeOrganizationId: organizationId,
    };
    const issuer = await pool.connect();
    const revoker = await pool.connect();
    try {
      await issuer.query("begin");
      assert.equal(
        await lockOrganizationPermission(issuer, auth, organizationId, ["ISSUE_CREDENTIAL"]),
        true,
      );

      await revoker.query("begin");
      let revocationFinished = false;
      const revocation = revoker.query(
        "update organization_memberships set status='REVOKED' where id=$1",
        [membershipId],
      ).then(() => { revocationFinished = true; });
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(revocationFinished, false, "revocation must wait while the authorized mutation holds its row lock");

      await issuer.query("commit");
      await revocation;
      await revoker.query("commit");

      await issuer.query("begin");
      assert.equal(
        await lockOrganizationPermission(issuer, auth, organizationId, ["ISSUE_CREDENTIAL"]),
        false,
        "a subsequent authorization must observe the revoked membership",
      );
      await issuer.query("rollback");
    } finally {
      try { await issuer.query("rollback"); } catch {}
      try { await revoker.query("rollback"); } catch {}
      issuer.release();
      revoker.release();
    }
  } catch (error) {
    try { await setup.query("rollback"); } catch {}
    throw error;
  } finally {
    setup.release();
    if (membershipId) await pool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await pool.query("delete from roles where id=$1", [roleId]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    if (organizationId) await pool.query("delete from organizations where id=$1", [organizationId]);
    await pool.end();
  }
});
