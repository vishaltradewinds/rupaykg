import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("operation sync cannot claim an unverified or another identity's device", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await client.query("begin");
    const org = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`operation-sync-security-${suffix}`],
    )).rows[0]!.id;
    const deviceIdentity = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`operation-sync-device-${suffix}`, "Operation Sync Device Identity"],
    )).rows[0]!.id;
    const otherIdentity = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`operation-sync-other-${suffix}`, "Operation Sync Other Identity"],
    )).rows[0]!.id;
    const deviceId = `operation-sync-device-${suffix}`;

    await client.query(
      "insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'PENDING')",
      [deviceId, deviceIdentity, org],
    );

    await assert.rejects(
      client.query(
        "insert into operation_sync_envelopes(idempotency_key,actor_identity_id,device_id,captured_at,payload) values($1,$2,$3,now(),'{}')",
        [`pending-${suffix}`, deviceIdentity, deviceId],
      ),
      /not verified/i,
    );

    await client.query("update field_devices set status='VERIFIED' where device_id=$1", [deviceId]);

    await assert.rejects(
      client.query(
        "insert into operation_sync_envelopes(idempotency_key,actor_identity_id,device_id,captured_at,payload) values($1,$2,$3,now(),'{}')",
        [`cross-identity-${suffix}`, otherIdentity, deviceId],
      ),
      /does not match enrolled device/i,
    );

    const accepted = await client.query<{ id: string }>(
      "insert into operation_sync_envelopes(idempotency_key,actor_identity_id,device_id,captured_at,payload) values($1,$2,$3,now(),'{}') returning id",
      [`accepted-${suffix}`, deviceIdentity, deviceId],
    );
    assert.ok(accepted.rows[0]?.id);
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
