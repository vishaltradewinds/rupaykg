import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import type { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const identityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "11111111-1111-4111-8111-111111111111";
const geographyId = "33333333-3333-4333-8333-333333333333";

class FakePool {
  calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1")) {
      return { rows: [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }] };
    }
    if (sql.includes("jsonb_array_elements_text")) return { rows: [{ ok: true }] };
    if (sql.includes("organization_has_geography_scope")) return { rows: [{ ok: true }] };
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

test("BWG profile intake never self-certifies statutory applicability or verification", async () => {
  const pool = new FakePool();
  const app = Fastify();
  await registerValueRoutes(app, pool as unknown as Pool);
  await app.ready();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/profile",
      headers: { authorization: "Bearer acceptance-test-token" },
      payload: {
        organizationId,
        jurisdictionId: geographyId,
        floorAreaSqm: 25000,
        waterConsumptionLpd: 50000,
        wasteGenerationKgDay: 150,
        establishmentType: "INSTITUTIONAL",
      },
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
