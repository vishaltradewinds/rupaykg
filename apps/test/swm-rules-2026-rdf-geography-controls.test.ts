import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261121_swm_rules_2026_rdf_geography_controls.sql",
  "../../../migrations/20261121_swm_rules_2026_rdf_geography_controls.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM RDF/geography controls migration not found");
const sql = readFileSync(migrationPath, "utf8");
const codes = [
  "SWM-2026-RDF-SCF-INDUSTRIAL-FUEL-RETURN",
  "SWM-2026-RDF-QUALITY-AVAILABILITY-OFFTAKE",
  "SWM-2026-HILL-ISLAND-LOCAL-BODY-CONTROLS",
  "SWM-2026-HIGH-CALORIFIC-WASTE-DIVERSION",
];

test("SWM RDF, high-calorific waste, and conditional geography controls preserve legal boundaries", () => {
  for (const code of codes) assert.ok(sql.includes(code), `missing requirement ${code}`);
  assert.match(sql, /Rule 11\(1\)-\(2\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 11\(3\)-\(6\) of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 12 of S\.O\. 388\(E\)/);
  assert.match(sql, /Rule 13\(1\)-\(3\) of S\.O\. 388\(E\)/);
  assert.match(sql, /do not infer applicability from straight-line distance alone/i);
  assert.match(sql, /Apply only when jurisdiction classification and the relevant sub-rule are evidenced/i);
  assert.match(sql, /internal evidence is not proof of portal filing or regulatory acceptance/i);
  assert.match(sql, /on conflict \(code\) do update/i);
});

test("SWM RDF/geography requirements are linked to the in-force authoritative source after migrations", {
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
