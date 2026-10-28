import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261123_swm_rules_2026_authority_inventory_controls.sql",
  "../../../migrations/20261123_swm_rules_2026_authority_inventory_controls.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM authority inventory controls migration not found");
const sql = readFileSync(migrationPath, "utf8");
const codes = [
  "SWM-2026-SPCB-ANNUAL-FACILITY-INVENTORY",
  "SWM-2026-SPCB-GEOTAGGED-INFRASTRUCTURE",
  "SWM-2026-SPCB-AUTHORIZATION-REGISTER",
  "SWM-2026-SPCB-ANNUAL-INSPECTION-AND-EMISSIONS-AUDIT",
];

test("SWM authority inventory and authorization controls retain rule references and fail-closed boundaries", () => {
  for (const code of codes) assert.ok(sql.includes(code), `missing requirement ${code}`);
  assert.match(sql, /Rule 39\(13\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 41\(1\)\(xiv\) and Rule 41\(8\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 41\(1\)\(iii\)-\(viii\) and Rule 41\(1\)\(xiv\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 41\(1\)\(xi\) and Rule 41\(1\)\(xxi\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Only the competent SPCB\/PCC can issue, renew, suspend or cancel authorization/i);
  assert.match(sql, /on conflict \(code\) do update/i);
});

test("SWM authority inventory requirements are linked to the in-force authoritative source after migrations", {
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
