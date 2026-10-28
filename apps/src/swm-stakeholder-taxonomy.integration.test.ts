import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { resolveStakeholderTaxonomy } from "./cpcb-swm-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

test("SWM stakeholder taxonomy resolves only approved effective registry rows", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  const code = `TEST_CLASS_${suffix}`;
  let identityId = "";
  try {
    const identity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      [`test-taxonomy-reviewer:${suffix}`, `Taxonomy Reviewer ${suffix}`],
    );
    identityId = identity.rows[0]!.id;

    await pool.query(
      `insert into swm_stakeholder_taxonomy(
        code,display_name,checklist_profile,governance_status,source_reference,source_version,
        source_sha256,effective_from,reviewed_by_identity_id,reviewed_at,notes
      ) values($1,'Synthetic approved test class','BWG','APPROVED','synthetic://test-source','fixture-v1',
        $2,current_date,$3,now(),'Synthetic integration fixture only')`,
      [code, sha(`taxonomy-fixture-${suffix}`), identityId],
    );

    assert.deepEqual(await resolveStakeholderTaxonomy(pool, code), { code, checklistProfile: "BWG" });

    await pool.query("update swm_stakeholder_taxonomy set governance_status='PROPOSED' where code=$1", [code]);
    assert.equal(await resolveStakeholderTaxonomy(pool, code), null, "proposed taxonomy rows must not be operational");

    await pool.query("update swm_stakeholder_taxonomy set governance_status='APPROVED', effective_from=current_date + 1 where code=$1", [code]);
    assert.equal(await resolveStakeholderTaxonomy(pool, code), null, "future-effective taxonomy rows must not be operational");
  } finally {
    await pool.query("delete from swm_stakeholder_taxonomy where code=$1", [code]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    await pool.end();
  }
});
