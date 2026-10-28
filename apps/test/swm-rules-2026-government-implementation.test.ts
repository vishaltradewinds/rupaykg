import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261122_swm_rules_2026_government_implementation.sql",
  "../../../migrations/20261122_swm_rules_2026_government_implementation.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM government implementation migration not found");
const sql = readFileSync(migrationPath, "utf8");
const codes = [
  "SWM-2026-STATE-URBAN-SWM-POLICY",
  "SWM-2026-STATE-LOCAL-BODY-INFRASTRUCTURE-PORTAL",
  "SWM-2026-STATE-WASTE-PICKER-REGISTRY",
  "SWM-2026-STATE-RURAL-SWM-POLICY",
  "SWM-2026-DISTRICT-QUARTERLY-SWM-REVIEW",
  "SWM-2026-CPCB-ANNUAL-IMPLEMENTATION-REPORT",
  "SWM-2026-CPCB-SOLID-WASTE-ACTION-PLAN-PROFORMA",
];

test("SWM government implementation controls cover Rules 35-38 without asserting authority completion", () => {
  for (const code of codes) assert.ok(sql.includes(code), `missing requirement ${code}`);
  assert.match(sql, /Rule 35\(1\)\(i\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 35\(2\)\(viii\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 35\(2\)\(xix\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 36\(1\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 37\(i\)-\(ii\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 38\(1\)\(vi\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 38\(1\)\(x\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Do not mark a local body onboarded from a local RupayKg record/i);
  assert.match(sql, /Distinguish evidence of compilation, submission to MoEFCC and public publication/i);
  assert.match(sql, /on conflict \(code\) do update/i);
});

test("SWM government implementation rows link to the in-force authoritative source after migrations", {
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
