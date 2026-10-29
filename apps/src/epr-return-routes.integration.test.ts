import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerEprReturnRoutes } from "./epr-return-routes.js";
import type { Pool } from "pg";

const ORG = "123e4567-e89b-42d3-a456-426614174001";
const GEO = "123e4567-e89b-42d3-a456-426614174002";
const RETURN = "123e4567-e89b-42d3-a456-426614174003";
const OBLIGATION = "123e4567-e89b-42d3-a456-426614174004";
const EVIDENCE = "123e4567-e89b-42d3-a456-426614174005";
const VERIFICATION = "123e4567-e89b-42d3-a456-426614174006";
const IDENTITY = "123e4567-e89b-42d3-a456-426614174007";

test("EPR submit fails closed before fulfillment mutation when quantity binding is absent", async () => {
  const clientSql: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => {
      clientSql.push(sql);
      if (sql.includes("select r.*,eo.target_quantity")) return { rows: [{
        id: RETURN, organization_id: ORG, obligation_id: OBLIGATION, scheme_id: "scheme-1",
        status: "DRAFT", obligation_geography_id: GEO, reported_quantity: 100
      }] };
      if (sql.includes("select id,target_quantity,fulfilled_quantity,status from epr_obligations")) return { rows: [{
        id: OBLIGATION, target_quantity: 1000, fulfilled_quantity: 0, status: "OPEN"
      }] };
      if (sql.includes("from evidence e join activities")) return { rows: [{
        id: EVIDENCE, status: "VERIFIED", content_hash: "a".repeat(64), content_uri: null,
        organization_id: ORG, geography_id: GEO, verifier_identity_id: IDENTITY
      }] };
      if (sql.includes("from organization_memberships vm")) return { rows: [{ authorized: true }] };
      if (sql.includes("select organization_has_geography_scope")) return { rows: [{ ok: true }] };
      if (sql.includes("select exists(select 1 from epr_returns where evidence_id")) return { rows: [{ reused: false }] };
      return { rows: [] };
    },
    release: () => { released = true; }
  };
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: IDENTITY }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status")) return { rows: [{ organization_id: ORG, role_id: "role-1", status: "VERIFIED" }] };
      if (sql.includes("select exists (") && sql.includes("jsonb_array_elements_text")) return { rows: [{ ok: true }] };
      return { rows: [] };
    },
    connect: async () => client
  } as unknown as Pool;

  const app = Fastify({ logger: false });
  await registerEprReturnRoutes(app, pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/epr/returns/${RETURN}/submit`,
      headers: { authorization: "Bearer test-session-token", "x-rupaykg-organization-id": ORG },
      payload: { evidenceId: EVIDENCE, verificationId: VERIFICATION }
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "EPR_QUANTITY_BINDING_NOT_IMPLEMENTED");
    assert.equal(response.json().productionGate, "HOLD");
    assert.ok(clientSql.includes("ROLLBACK"));
    assert.ok(!clientSql.some((sql) => /update\s+epr_obligations/i.test(sql)));
    assert.ok(!clientSql.some((sql) => /update\s+epr_returns/i.test(sql)));
    assert.ok(released, "transaction client must be released");
  } finally {
    await app.close();
  }
});
