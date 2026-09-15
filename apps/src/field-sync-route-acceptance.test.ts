import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerSyncRoutes } from "./sync-routes.js";

const databaseUrl = process.env.DATABASE_URL;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

test("authoritative field capture reaches /operations/sync and creates an activity", { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
  const app = Fastify({ logger: false });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await registerSyncRoutes(app, pool);
    await app.ready();
    await client.query("begin");

    const org = (await client.query<{ id: string }>("insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id", [`field-sync-route-${suffix}`])).rows[0]!.id;
    const identity = (await client.query<{ id: string }>("insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id", [`field-sync-route-${suffix}`, "Field Sync Route Test"])).rows[0]!.id;
    const role = (await client.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,$3) returning id", [org, `FIELD_SYNC_${suffix}`, '["waste:record"]'])).rows[0]!.id;
    await client.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [identity, org, role]);
    const geography = (await client.query<{ id: string }>("insert into geography(kind,code,name,source) values('DISTRICT',$1,'Field Sync Test Geography','test') returning id", [`FS-${suffix.slice(0,8)}`])).rows[0]!.id;
    await client.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [org, geography]);
    const device = (await client.query<{ id: string }>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'VERIFIED') returning id", [`field-device-${suffix}`, identity, org])).rows[0]!.id;
    const token = `field-sync-token-${suffix}`;
    await client.query("insert into identity_sessions(identity_id,expires_at,token_hash,request_context) values($1,now()+interval '1 hour',$2,'{}')", [identity, hash(token)]);

    const idempotencyKey = `field-capture:${suffix}`;
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/operations/sync",
      headers: { authorization: `Bearer ${token}`, "x-rupaykg-organization-id": org },
      payload: {
        idempotencyKey,
        deviceId: device,
        capturedAt: new Date().toISOString(),
        clientSequence: 1,
        payload: {
          operationType: "ACTIVITY_CREATE",
          organizationId: org,
          activityType: "GENERATION",
          occurredAt: new Date().toISOString(),
          geographyId: geography,
          metadata: { captureSource: "RupayKG field capture", operatingContext: "URBAN", material: "MUNICIPAL_SOLID_WASTE", declaredQuantity: 25, declaredUnit: "kg" },
        },
      },
    });

    assert.ok(response.statusCode < 300, `sync failed: ${response.statusCode} ${response.body}`);
    const body = response.json() as Record<string, unknown>;
    assert.equal(body.source, "postgresql");
    assert.equal(body.syntheticData, false);
    assert.equal(body.authoritativeMutation, true);
    assert.equal(body.entityType, "activity");
    assert.match(String(body.entityId), /^[0-9a-f-]{36}$/i);

    const activity = await client.query<{ organization_id: string; actor_identity_id: string; geography_id: string; status: string; activity_type: string }>("select organization_id,actor_identity_id,geography_id,status,activity_type from activities where id=$1", [body.entityId]);
    assert.deepEqual(activity.rows[0], { organization_id: org, actor_identity_id: identity, geography_id: geography, status: "DRAFT", activity_type: "GENERATION" });

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/operations/sync",
      headers: { authorization: `Bearer ${token}`, "x-rupaykg-organization-id": org },
      payload: {
        idempotencyKey,
        deviceId: device,
        capturedAt: new Date().toISOString(),
        clientSequence: 1,
        payload: { operationType: "ACTIVITY_CREATE", organizationId: org, activityType: "GENERATION", occurredAt: new Date().toISOString(), geographyId: geography, metadata: { captureSource: "RupayKG field capture" } },
      },
    });
    assert.ok(replay.statusCode < 300, `replay failed: ${replay.statusCode} ${replay.body}`);
    const replayBody = replay.json() as Record<string, unknown>;
    assert.equal(replayBody.replay, true);
    assert.equal(replayBody.entityId, body.entityId);

    const count = await client.query<{ count: string }>("select count(*)::text as count from activities where id=$1", [body.entityId]);
    assert.equal(count.rows[0]!.count, "1");
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await app.close();
    client.release();
    await pool.end();
  }
});
