import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261118_swm_central_portal_launch_gate.sql",
  "../../../migrations/20261118_swm_central_portal_launch_gate.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM central portal launch gate migration not found");
const migrationSql = readFileSync(migrationPath, "utf8");
const requirementCode = "SWM-2026-CPCB-CENTRAL-PORTAL-LAUNCH";

test("SWM portal launch verification is fail-closed and does not invent a production endpoint", () => {
  assert.ok(migrationSql.includes(requirementCode));
  assert.match(migrationSql, /six-month establishment window/i);
  assert.match(migrationSql, /deadline 1 October 2026/i);
  assert.match(migrationSql, /official_production_portal_URL/);
  assert.match(migrationSql, /external_url,\s*null::text/i);
  assert.match(migrationSql, /This is not a finding that CPCB has failed to launch the portal/i);
  assert.match(migrationSql, /on conflict \(code\) do update/i);
});

test("SWM portal launch verification gate is linked to the current official source", {
  skip: !(process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && process.env.DATABASE_URL)
    ? "requires CI disposable PostgreSQL and applied migrations"
    : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  try {
    const result = await pool.query<{
      source_title: string;
      source_reference: string;
      external_url: string | null;
      status: string;
      notes: string;
    }>(
      `select s.title as source_title,s.reference as source_reference,
              r.external_url,r.status,r.notes
       from regulatory_requirements r
       join regulatory_sources s on s.id=r.regulatory_source_id
       where r.code=$1`,
      [requirementCode],
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.source_title, "Solid Waste Management Rules, 2026");
    assert.equal(result.rows[0]?.source_reference, "S.O. 388(E)");
    assert.equal(result.rows[0]?.external_url, null);
    assert.equal(result.rows[0]?.status, "IN_FORCE");
    assert.match(result.rows[0]?.notes ?? "", /not a finding that CPCB has failed to launch/i);
  } finally {
    await pool.end();
  }
});
