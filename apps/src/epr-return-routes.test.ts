import test from "node:test";
import assert from "node:assert/strict";
import { authorizeGeography, requestedGeography } from "./epr-return-routes.js";
import type { AuthContext } from "./auth.js";
import type { Pool } from "pg";

const GEO = "123e4567-e89b-42d3-a456-426614174000";
const auth = (status = "VERIFIED") => ({ memberships: [{ organization_id: "org-1", status }] }) as unknown as AuthContext;

test("requestedGeography trims a supplied geography identifier", () => {
  assert.equal(requestedGeography({ query: { geographyId: `  ${GEO}  ` } }), GEO);
});

test("requestedGeography treats missing, blank and non-string values as no filter", () => {
  assert.equal(requestedGeography({ query: {} }), null);
  assert.equal(requestedGeography({ query: { geographyId: "   " } }), null);
  assert.equal(requestedGeography({ query: { geographyId: 123 } }), null);
  assert.equal(requestedGeography({ query: null }), null);
});

test("authorizeGeography fails closed for malformed UUID without querying the database", async () => {
  let calls = 0;
  const pool = { query: async () => { calls += 1; return { rows: [{ ok: true }] }; } } as unknown as Pool;
  assert.equal(await authorizeGeography(pool, auth(), "org-1", "not-a-uuid"), false);
  assert.equal(calls, 0);
});

test("authorizeGeography fails closed when no verified organization membership exists", async () => {
  let calls = 0;
  const pool = { query: async () => { calls += 1; return { rows: [{ ok: true }] }; } } as unknown as Pool;
  assert.equal(await authorizeGeography(pool, auth("PENDING"), "org-1", GEO), false);
  assert.equal(calls, 0);
});

test("authorizeGeography uses the database organization-scope decision", async () => {
  const calls: unknown[][] = [];
  const pool = { query: async (sql: string, params: unknown[]) => { calls.push([sql, ...params]); return { rows: [{ ok: true }] }; } } as unknown as Pool;
  assert.equal(await authorizeGeography(pool, auth(), "org-1", GEO), true);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]?.[0]), /organization_has_geography_scope/);
  assert.equal(calls[0]?.[1], "org-1");
  assert.equal(calls[0]?.[2], GEO);
});

test("authorizeGeography denies a geography the database does not authorize", async () => {
  const pool = { query: async () => ({ rows: [{ ok: false }] }) } as unknown as Pool;
  assert.equal(await authorizeGeography(pool, auth(), "org-1", GEO), false);
});
