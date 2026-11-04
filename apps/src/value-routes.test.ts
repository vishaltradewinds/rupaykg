import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import type { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const identityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const geographyId = "33333333-3333-4333-8333-333333333333";

type FakePoolOptions = {
  permissionAllowed?: boolean;
  grantedPermissions?: string[];
  geographyAllowed?: boolean;
  memberships?: Array<{ organization_id: string; role_id: string; status: string }>;
};

class FakePool {
  calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  private readonly options: { permissionAllowed: boolean; grantedPermissions?: string[]; geographyAllowed: boolean; memberships: Array<{ organization_id: string; role_id: string; status: string }> };
  constructor(options: FakePoolOptions = {}) {
    this.options = {
      permissionAllowed: options.permissionAllowed ?? true,
      ...(options.grantedPermissions ? { grantedPermissions: options.grantedPermissions } : {}),
      geographyAllowed: options.geographyAllowed ?? true,
      memberships: options.memberships ?? [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }],
    };
  }
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1")) {
      return { rows: this.options.memberships };
    }
    if (sql.includes("jsonb_array_elements_text")) {
      const requested = Array.isArray(values?.[2]) ? values[2] as string[] : [];
      const ok = this.options.grantedPermissions
        ? requested.some((permission) => this.options.grantedPermissions!.includes(permission))
        : this.options.permissionAllowed;
      return { rows: [{ ok }] };
    }
    if (sql.includes("organization_has_geography_scope")) return { rows: [{ ok: this.options.geographyAllowed }] };
    if (sql.includes("insert into bwg_profiles")) {
      const basis = JSON.parse(String(values?.[7] ?? "{}"));
      return { rows: [{
        id: "44444444-4444-4444-8444-444444444444",
        organization_id: organizationId,
        jurisdiction_id: geographyId,
        applicability_status: values?.[6],
        applicability_basis: basis,
        status: "PENDING",
      }] };
    }
    return { rows: [] };
  }
}

async function makeApp(pool: FakePool) {
  const app = Fastify();
  await registerValueRoutes(app, pool as unknown as Pool);
  await app.ready();
  return app;
}

const validPayload = (orgId = organizationId) => ({
  organizationId: orgId,
  jurisdictionId: geographyId,
  floorAreaSqm: 25000,
  waterConsumptionLpd: 50000,
  wasteGenerationKgDay: 150,
  establishmentType: "INSTITUTIONAL",
});

test("BWG profile intake never self-certifies statutory applicability or verification", async () => {
  const pool = new FakePool();
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer acceptance-test-token" },
      payload: validPayload(),
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.profile.applicability_status, "REVIEW_REQUIRED");
    assert.equal(body.profile.status, "PENDING");
    assert.equal(body.profile.applicability_basis.screening, "INTERNAL_SCREENING_ONLY");
    assert.deepEqual(body.profile.applicability_basis.thresholds, {
      floorAreaSqm: 20000,
      waterConsumptionLpd: 40000,
      wasteGenerationKgDay: 100,
    });
    const insert = pool.calls.find((call) => call.sql.includes("insert into bwg_profiles"));
    assert.ok(insert);
    assert.match(insert.sql, /'PENDING'/);
    assert.doesNotMatch(insert.sql, /'VERIFIED'|'APPLICABLE'|'NOT_APPLICABLE'/);
    assert.equal(insert.values?.[6], "REVIEW_REQUIRED");
  } finally {
    await app.close();
  }
});

test("BWG profile intake rejects unauthenticated HTTP requests", async () => {
  const pool = new FakePool();
  const app = await makeApp(pool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/bwg/profile", payload: validPayload() });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, "AUTH_REQUIRED");
    assert.equal(pool.calls.some((call) => call.sql.includes("insert into bwg_profiles")), false);
  } finally {
    await app.close();
  }
});

test("BWG profile intake rejects identities without verified organization membership", async () => {
  const pool = new FakePool({ memberships: [] });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer acceptance-test-token" },
      payload: validPayload(),
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "ORG_FORBIDDEN");
    assert.equal(pool.calls.some((call) => call.sql.includes("insert into bwg_profiles")), false);
  } finally {
    await app.close();
  }
});

test("BWG profile intake rejects cross-organization writes", async () => {
  const pool = new FakePool();
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer acceptance-test-token" },
      payload: validPayload(otherOrganizationId),
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "ORG_FORBIDDEN");
    assert.equal(pool.calls.some((call) => call.sql.includes("insert into bwg_profiles")), false);
  } finally {
    await app.close();
  }
});

test("BWG profile intake rejects missing profile-update permission", async () => {
  const pool = new FakePool({ permissionAllowed: false });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer acceptance-test-token" },
      payload: validPayload(),
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "BWG_PROFILE_FORBIDDEN");
    assert.equal(pool.calls.some((call) => call.sql.includes("insert into bwg_profiles")), false);
  } finally {
    await app.close();
  }
});

test("BWG profile intake cannot be authorized by waste:record without profile:update", async () => {
  const pool = new FakePool({ grantedPermissions: ["waste:record"] });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer acceptance-test-token" },
      payload: validPayload(),
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "BWG_PROFILE_FORBIDDEN");
    assert.equal(pool.calls.some((call) => call.sql.includes("insert into bwg_profiles")), false);
  } finally {
    await app.close();
  }
});

test("BWG profile intake rejects jurisdictions outside verified organization geography scope", async () => {
  const pool = new FakePool({ geographyAllowed: false });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer acceptance-test-token" },
      payload: validPayload(),
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "GEOGRAPHY_FORBIDDEN");
    assert.equal(pool.calls.some((call) => call.sql.includes("insert into bwg_profiles")), false);
  } finally {
    await app.close();
  }
});
