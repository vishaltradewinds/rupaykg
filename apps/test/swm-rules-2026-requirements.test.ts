import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261117_swm_rules_2026_operational_requirements.sql",
  "../../../migrations/20261117_swm_rules_2026_operational_requirements.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("SWM Rules 2026 operational requirements migration not found");
const migrationSql = readFileSync(migrationPath, "utf8");

const requirementCodes = [
  "SWM-2026-WASTE-GENERATOR-SEGREGATION",
  "SWM-2026-BWG-REGISTRATION-EBWGR-RETURN",
  "SWM-2026-WASTE-PROCESSOR-REGISTRATION-RETURNS",
  "SWM-2026-LOCAL-BODY-PORTAL-REPORTING",
  "SWM-2026-EBWGR-CERTIFICATE-ISSUANCE",
  "SWM-2026-MRF-QUARTERLY-REPORTING",
];

test("SWM 2026 operational requirement seed is evidence-first and fail-closed about external portal state", () => {
  for (const code of requirementCodes) assert.ok(migrationSql.includes(code), `missing requirement ${code}`);
  assert.match(migrationSql, /Rules 8 and 10 of S\.O\. 388\(E\)/);
  assert.match(migrationSql, /Only the local body is mandated to generate EBWGR certificates/i);
  assert.match(migrationSql, /must not mint or assert official certificates without verified external issuance/i);
  assert.match(migrationSql, /https:\/\/www\.swm\.cpcb\.gov\.in\//);
  assert.match(migrationSql, /on conflict \(code\) do update/i);
});

test("SWM 2026 operational requirements are linked to the authoritative source after migrations", {
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
      code: string;
      source_title: string;
      source_reference: string;
      status: string;
      external_url: string | null;
    }>(
      `select r.code,s.title as source_title,s.reference as source_reference,
              r.status,r.external_url
       from regulatory_requirements r
       join regulatory_sources s on s.id=r.regulatory_source_id
       where r.code = any($1::text[])
       order by r.code`,
      [requirementCodes],
    );
    assert.equal(result.rows.length, requirementCodes.length, "all SWM operational requirements must be seeded");
    for (const row of result.rows) {
      assert.equal(row.source_title, "Solid Waste Management Rules, 2026");
      assert.equal(row.source_reference, "S.O. 388(E)");
      assert.equal(row.status, "IN_FORCE");
      assert.equal(row.external_url, "https://www.swm.cpcb.gov.in/", "use the verified official CPCB portal landing page");
    }
  } finally {
    await pool.end();
  }
});
