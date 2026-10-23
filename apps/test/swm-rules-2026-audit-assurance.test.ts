import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261120_swm_rules_2026_audit_assurance.sql",
  "../../../migrations/20261120_swm_rules_2026_audit_assurance.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM audit assurance migration not found");
const sql = readFileSync(migrationPath, "utf8");
const legacyMigrationPath = [
  "../../migrations/20261119_swm_rules_2026_assurance_requirements.sql",
  "../../../migrations/20261119_swm_rules_2026_assurance_requirements.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!legacyMigrationPath) throw new Error("SWM legacy reporting migration not found");
const legacySql = readFileSync(legacyMigrationPath, "utf8");
const codes = [
    "SWM-2026-SPCB-FACILITY-ANNUAL-AUDIT",
  "SWM-2026-ORGANIC-MANURE-MONTHLY-TEST-REPORT",
  "SWM-2026-CPCB-PUBLIC-DASHBOARD-DATA",
];

test("SWM audit and assurance requirements preserve rule references and external evidence boundaries", () => {
  assert.ok(legacySql.includes("SWM-2026-LEGACY-DUMPSITE-QUARTERLY-RETURNS"));
  for (const code of codes) assert.ok(sql.includes(code), `missing ${code}`);
  assert.match(sql, /Rule 39\(5\)-\(6\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 39\(11\)-\(12\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 16\(2\)-\(3\) of S\.O\. 388\(E\)/);
  assert.ok(sql.includes("https://swmp.cpcb.gov.in/en/"));
  assert.match(sql, /on conflict \(code\) do update/i);
});

test("SWM audit and assurance rows are linked to the official 2026 Rules after migrations", {
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
    const result = await pool.query(
      `select r.code,s.title,s.reference,r.status,r.external_url
       from regulatory_requirements r
       join regulatory_sources s on s.id=r.regulatory_source_id
       where r.code = any($1::text[]) order by r.code`,
      [codes],
    );
    assert.equal(result.rows.length, codes.length);
    for (const row of result.rows) {
      assert.equal(row.title, "Solid Waste Management Rules, 2026");
      assert.equal(row.reference, "S.O. 388(E)");
      assert.equal(row.status, "IN_FORCE");
      assert.equal(row.external_url, "https://swmp.cpcb.gov.in/en/");
    }
  } finally {
    await pool.end();
  }
});
