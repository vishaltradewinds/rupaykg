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
        "update organization_memberships set status='REJECTED',last_revoked_at=now(),last_revocation_reason='integration test revocation' where id=$1",
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


test("field-sync conflict visibility and resolution require current verified device membership", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const suffix = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const organizationId = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`sync-auth-org-${suffix}`],
    )).rows[0]!.id;
    const identityId = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`sync-auth-identity-${suffix}`, "Sync Authorization Test"],
    )).rows[0]!.id;
    const roleId = (await client.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[]'::jsonb) returning id",
      [organizationId, `sync-auth-role-${suffix}`],
    )).rows[0]!.id;
    const membershipId = (await client.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    )).rows[0]!.id;
    const deviceId = (await client.query<{ id: string }>(
      "insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [`sync-auth-device-${suffix}`, identityId, organizationId],
    )).rows[0]!.id;
    const envelopeId = (await client.query<{ id: string }>(
      "insert into field_sync_envelopes(device_id,identity_id,idempotency_key,client_sequence,captured_at,payload,payload_hash) values($1,$2,$3,1,now(),'{}'::jsonb,'fixture') returning id",
      [deviceId, identityId, `sync-auth-envelope-${suffix}`],
    )).rows[0]!.id;
    const conflictId = (await client.query<{ id: string }>(
      "insert into field_sync_conflicts(envelope_id,entity_type,conflict_type,client_version) values($1,'activity','TEST_CONFLICT','{}'::jsonb) returning id",
      [envelopeId],
    )).rows[0]!.id;

    const visible = await client.query<{ id: string }>(
      `select c.id from field_sync_conflicts c
        join field_sync_envelopes e on e.id=c.envelope_id
        join field_devices fd on fd.id=e.device_id and fd.identity_id=e.identity_id and fd.status='VERIFIED'
       where c.id=$1 and e.identity_id=$2
         and exists(select 1 from organization_memberships om where om.identity_id=e.identity_id and om.organization_id=fd.organization_id and om.status='VERIFIED')`,
      [conflictId, identityId],
    );
    assert.equal(visible.rows.length, 1, "verified member with verified device can access its conflict");

    await client.query("update field_devices set status='PENDING' where id=$1", [deviceId]);
    const unverifiedDevice = await client.query<{ id: string }>(
      `select c.id from field_sync_conflicts c
        join field_sync_envelopes e on e.id=c.envelope_id
        join field_devices fd on fd.id=e.device_id and fd.identity_id=e.identity_id and fd.status='VERIFIED'
       where c.id=$1 and e.identity_id=$2
         and exists(select 1 from organization_memberships om where om.identity_id=e.identity_id and om.organization_id=fd.organization_id and om.status='VERIFIED')`,
      [conflictId, identityId],
    );
    assert.equal(unverifiedDevice.rows.length, 0, "unverified device must not expose conflicts");
    await client.query("update field_devices set status='VERIFIED' where id=$1", [deviceId]);

    await client.query("update organization_memberships set status='REJECTED',last_revoked_at=now(),last_revocation_reason='integration test revocation' where id=$1", [membershipId]);
    const revokedRead = await client.query<{ id: string }>(
      `select c.id from field_sync_conflicts c
        join field_sync_envelopes e on e.id=c.envelope_id
        join field_devices fd on fd.id=e.device_id and fd.identity_id=e.identity_id and fd.status='VERIFIED'
       where c.id=$1 and e.identity_id=$2
         and exists(select 1 from organization_memberships om where om.identity_id=e.identity_id and om.organization_id=fd.organization_id and om.status='VERIFIED')`,
      [conflictId, identityId],
    );
    assert.equal(revokedRead.rows.length, 0, "revoked membership must remove conflict visibility");
    const revokedResolve = await client.query<{ id: string }>(
      `update field_sync_conflicts c
          set resolution_status='RESOLVED', resolved_by_identity_id=$2, resolved_at=now()
        where c.id=$1 and c.resolution_status='OPEN'
          and exists (
            select 1 from field_sync_envelopes e
            join field_devices fd on fd.id=e.device_id and fd.identity_id=e.identity_id and fd.status='VERIFIED'
            where e.id=c.envelope_id and e.identity_id=$2
              and exists(select 1 from organization_memberships om where om.identity_id=e.identity_id and om.organization_id=fd.organization_id and om.status='VERIFIED')
          )
        returning c.id`,
      [conflictId, identityId],
    );
    assert.equal(revokedResolve.rows.length, 0, "revoked membership must not resolve a conflict");

    await client.query("rollback");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
