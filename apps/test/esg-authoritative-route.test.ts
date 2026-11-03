import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerValueRoutes } from "../src/value-routes.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const geographyId = "33333333-3333-4333-8333-333333333333";
const periodId = "44444444-4444-4444-8444-444444444444";
const evidenceId = "55555555-5555-4555-8555-555555555555";
const verificationId = "66666666-6666-4666-8666-666666666666";
const methodologyVersionId = "77777777-7777-4777-8777-777777777777";

function makePool(options: { verifierAuthorized?: boolean; methodologyMatches?: boolean; evidenceStatus?: string } = {}): Pool {
  const query = async (sql: string, values: unknown[] = []) => {
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
      return { rows: [{ organization_id: organizationId, role_id: "88888888-8888-4888-8888-888888888888", status: "VERIFIED" }] };
    }
    if (sql.includes("select can_write_esg")) return { rows: [{ ok: true }] };
    if (sql.includes("select organization_id from esg_reporting_periods")) return { rows: [{ organization_id: organizationId }] };
    if (sql.includes("from evidence e join activities a on a.id=e.activity_id")) {
      return { rows: [{
        evidence_id: evidenceId, evidence_status: options.evidenceStatus ?? "VERIFIED", content_hash: "a".repeat(64), content_uri: null,
        evidence_org: organizationId, geography_id: geographyId, occurred_at: new Date("2026-05-10T00:00:00Z"),
        measured_at: new Date("2026-05-10T00:00:00Z"), verification_id: verificationId,
        verification_decision: "APPROVED", verifier_identity_id: identityId, methodology_version_id: methodologyVersionId,
        effective_from: new Date("2026-01-01T00:00:00Z"),
        rules: { esgBinding: { framework: "BRSR", metricCode: options.methodologyMatches === false ? "OTHER-METRIC" : "SCOPE3-WASTE", scope: "3", unitCode: "tCO2e" } },
        period_start: "2026-04-01", period_end: "2027-03-31", framework: "BRSR", geography_matches: true, period_matches: true,
      }] };
    }
    if (sql.includes("select exists(select 1 from organization_memberships om join roles r")) return { rows: [{ ok: options.verifierAuthorized !== false }] };
    if (sql.includes("insert into esg_metrics")) return { rows: [{ id: "metric-test", status: values[8] }] };
    throw new Error(`Unexpected SQL in ESG route test: ${sql}`);
  };
  return { query } as unknown as Pool;
}

async function postMetric(options: { verifierAuthorized?: boolean; methodologyMatches?: boolean; evidenceStatus?: string } = {}) {
  const app = Fastify();
  await registerValueRoutes(app, makePool(options));
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/esg/reporting-periods/${periodId}/metrics`,
    headers: { authorization: "Bearer test-session" },
    payload: { metricCode: "SCOPE3-WASTE", scope: "3", value: 12.5, unit: "tCO2e", evidenceId, verificationId, methodologyVersionId },
  });
  await app.close();
  return response;
}

test("ESG route derives VERIFIED from persisted evidence, verifier authority, period and methodology checks", async () => {
  const response = await postMetric();
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().state, "VERIFIED");
});

test("ESG route keeps metric PENDING when the persisted methodology does not bind the metric", async () => {
  const response = await postMetric({ methodologyMatches: false });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().state, "PENDING");
});

test("ESG route keeps metric PENDING when verifier authority is no longer current", async () => {
  const response = await postMetric({ verifierAuthorized: false });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().state, "PENDING");
});


test("ESG route rejects metric recording when the underlying evidence has been revoked", async () => {
  const response = await postMetric({ evidenceStatus: "REVOKED" });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "EVIDENCE_NOT_VERIFIED");
});
