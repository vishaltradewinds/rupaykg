import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerSensorThingsRoutes } from "./sensorthings-routes.js";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const IDENTITY_A = "33333333-3333-4333-8333-333333333333";
const ROLE_A = "44444444-4444-4444-8444-444444444444";
const MEASUREMENT_A = "55555555-5555-4555-8555-555555555555";
const MEASUREMENT_B = "66666666-6666-4666-8666-666666666666";
const TOKEN_A = "test-token-a";

type FakeClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  release: () => void;
};

function makePool() {
  let sourceReadCount = 0;
  const pool = {
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("from identity_sessions")) {
        return { rows: params?.[0] ? [{ identity_id: IDENTITY_A }] : [] };
      }
      if (sql.includes("from organization_memberships")) {
        return { rows: [{ organization_id: ORG_A, role_id: ROLE_A, status: "VERIFIED" }] };
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
    async connect(): Promise<FakeClient> {
      let transactionOrganization = "";
      return {
        async query(sql: string, params?: unknown[]) {
          if (sql === "begin" || sql === "commit" || sql === "rollback") return { rows: [] };
          if (sql.includes("select app.set_request_context")) {
            transactionOrganization = String(params?.[1] ?? "");
            return { rows: [] };
          }
          if (sql.includes("from measurements m")) {
            sourceReadCount += 1;
            if (transactionOrganization !== ORG_A) return { rows: [] };
            if (params?.[0] !== MEASUREMENT_A) return { rows: [] };
            return {
              rows: [{
                measurement_id: MEASUREMENT_A,
                activity_id: "77777777-7777-4777-8777-777777777777",
                organization_id: ORG_A,
                value: "125.500000",
                unit: "kg",
                method: "weighbridge",
                source: "EDGE-001",
                measured_at: "2026-11-08T09:00:00.000Z",
                quality_status: "VALIDATED",
                measurement_metadata: {
                  deviceId: "EDGE-001",
                  observedProperty: {
                    id: "mass-kg",
                    name: "Mass",
                    definition: "urn:rupaykg:observed-property:mass-kg"
                  }
                },
                activity_metadata: {
                  location: { latitude: 23.2599, longitude: 77.4126 }
                }
              }]
            };
          }
          throw new Error(`Unexpected client query: ${sql}`);
        },
        release() {},
      };
    },
    get sourceReadCount() { return sourceReadCount; },
  };
  return pool;
}

async function buildApp(pool: any) {
  const app = Fastify({ logger: false });
  registerSensorThingsRoutes(app, pool);
  await app.ready();
  return app;
}

test("authenticated organization can export its authoritative measurement", async () => {
  const pool = makePool();
  const app = await buildApp(pool);

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/interoperability/sensorthings/measurements/${MEASUREMENT_A}`,
    headers: { authorization: `Bearer ${TOKEN_A}`, "x-rupaykg-organization-id": ORG_A },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.source, "postgresql");
  assert.equal(body.syntheticData, false);
  assert.equal(body.data.observation.result, 125.5);
  assert.equal(body.data.observation.phenomenonTime, "2026-11-08T09:00:00.000Z");
  assert.deepEqual(body.data.location.location.coordinates, [77.4126, 23.2599]);
  assert.equal(pool.sourceReadCount, 1);

  await app.close();
});

test("organization A cannot export organization B measurement", async () => {
  const pool = makePool();
  const app = await buildApp(pool);

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/interoperability/sensorthings/measurements/${MEASUREMENT_B}`,
    headers: { authorization: `Bearer ${TOKEN_A}`, "x-rupaykg-organization-id": ORG_A },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "MEASUREMENT_NOT_FOUND");

  await app.close();
});

test("invalid or missing authentication fails closed", async () => {
  const pool = makePool();
  const app = await buildApp(pool);

  const missing = await app.inject({
    method: "GET",
    url: `/api/v1/interoperability/sensorthings/measurements/${MEASUREMENT_A}`,
  });
  assert.equal(missing.statusCode, 401);

  const wrongOrganization = await app.inject({
    method: "GET",
    url: `/api/v1/interoperability/sensorthings/measurements/${MEASUREMENT_A}`,
    headers: { authorization: `Bearer ${TOKEN_A}`, "x-rupaykg-organization-id": ORG_B },
  });
  assert.equal(wrongOrganization.statusCode, 401);

  await app.close();
});

test("missing measurement returns 404 without synthesizing data", async () => {
  const pool = makePool();
  const app = await buildApp(pool);

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/interoperability/sensorthings/measurements/88888888-8888-4888-8888-888888888888",
    headers: { authorization: `Bearer ${TOKEN_A}`, "x-rupaykg-organization-id": ORG_A },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "MEASUREMENT_NOT_FOUND");

  await app.close();
});
