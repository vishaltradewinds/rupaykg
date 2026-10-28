import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261116_swm_rules_2026_authoritative_source.sql",
  "../../../migrations/20261116_swm_rules_2026_authoritative_source.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM Rules 2026 authoritative source migration not found");
const migrationSql = readFileSync(migrationPath, "utf8");

test("SWM Rules 2026 source is registered with the official instrument and commencement date", () => {
  assert.match(migrationSql, /Solid Waste Management Rules, 2026/);
  assert.match(migrationSql, /S\.O\. 388\(E\)/);
  assert.match(migrationSql, /'2026-04-01'/);
  assert.match(migrationSql, /https:\/\/moef\.gov\.in\/uploads\/pdf-uploads\/pdf_69a16e3b04c107\.91022257\.pdf/);
  assert.match(migrationSql, /'IN_FORCE'/);
  assert.match(migrationSql, /on conflict \(authority,title,reference\) do update/i);
  assert.match(migrationSql, /does not itself determine any organization/i);
});

test("SWM Rules 2026 source is present in the applied regulatory catalog", {
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
      instrument: string;
      effective_from: string;
      status: string;
      source_url: string;
      affected_module: string;
    }>(
      `select instrument,effective_from::text,status,source_url,affected_module
       from regulatory_sources
       where authority=$1 and title=$2 and reference=$3`,
      [
        "Ministry of Environment, Forest and Climate Change",
        "Solid Waste Management Rules, 2026",
        "S.O. 388(E)",
      ],
    );
    assert.equal(result.rows.length, 1, "the current SWM Rules must have one authoritative catalog row");
    assert.equal(result.rows[0]?.instrument, "RULE");
    assert.equal(result.rows[0]?.effective_from, "2026-04-01");
    assert.equal(result.rows[0]?.status, "IN_FORCE");
    assert.equal(
      result.rows[0]?.source_url,
      "https://moef.gov.in/uploads/pdf-uploads/pdf_69a16e3b04c107.91022257.pdf",
    );
    assert.equal(result.rows[0]?.affected_module, "cpcb_swm");
  } finally {
    await pool.end();
  }
});
