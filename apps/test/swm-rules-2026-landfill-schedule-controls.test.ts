import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261125_swm_rules_2026_landfill_schedule_controls.sql",
  "../../../migrations/20261125_swm_rules_2026_landfill_schedule_controls.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM landfill/Schedule I migration not found");
const sql = readFileSync(migrationPath, "utf8");
const codes = [
  "SWM-2026-SANITARY-LANDFILL-REGISTRATION-RETURNS",
  "SWM-2026-SANITARY-LANDFILL-WASTE-ACCEPTANCE",
  "SWM-2026-SCHEDULE-I-INFRASTRUCTURE-DEADLINES",
  "SWM-2026-LANDFILL-SITING-AND-ENVIRONMENTAL-SAFEGUARDS",
];

test("SWM sanitary landfill and Schedule I controls track evidence without claiming approval", () => {
  for (const code of codes) assert.ok(sql.includes(code), `missing requirement ${code}`);
  assert.match(sql, /Rule 14\(7\)-\(10\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 14\(4\)-\(6\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Schedule I to S\.O\. 388\(E\)/);
  assert.match(sql, /1 October 2027, 1 April 2028 and 1 April 2029/);
  assert.match(sql, /do not extrapolate across omitted or ambiguous population bands/i);
  assert.match(sql, /must not infer site suitability or issue statutory clearances from map distance alone/i);
  assert.match(sql, /on conflict \(code\) do update/i);
});

test("SWM landfill and Schedule I requirements are linked to the in-force source after migrations", {
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
