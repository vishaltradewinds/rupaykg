import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261124_swm_rules_2026_landfill_dumpsite_controls.sql",
  "../../../migrations/20261124_swm_rules_2026_landfill_dumpsite_controls.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM landfill/dumpsite controls migration not found");
const sql = readFileSync(migrationPath, "utf8");
const codes = [
  "SWM-2026-SANITARY-LANDFILL-REGISTRATION-ANNUAL-RETURN",
  "SWM-2026-SANITARY-LANDFILL-AUDIT",
  "SWM-2026-DUMPSITE-GEO-MAPPING-DEADLINE",
  "SWM-2026-LEGACY-DUMPSITE-ANNUAL-AUDIT",
  "SWM-2026-LEGACY-DUMPSITE-FRACTION-DESTINATION",
];

test("SWM landfill and dumpsite controls map Rules 14-15 and preserve evidence boundaries", () => {
  for (const code of codes) assert.ok(sql.includes(code), `missing requirement ${code}`);
  assert.match(sql, /Rule 14\(8\)-\(10\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 14\(7\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 15\(1\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 15\(10\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 15\(4\)-\(8\) of S\.O\. 388\(E\)/);
  assert.match(sql, /31 October 2026/);
  assert.match(sql, /by 31 December of the next financial year/i);
  assert.match(sql, /coordinates alone are not proof/i);
  assert.match(sql, /platform status is not an independent statutory audit opinion/i);
  assert.match(sql, /on conflict \(code\) do update/i);
});

test("SWM landfill/dumpsite requirements are linked to the in-force authoritative source after migrations", {
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
