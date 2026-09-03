import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;

test("methodology governance fails closed and becomes immutable after progression", async (t) => {
  if (!databaseUrl) {
    t.skip("DATABASE_URL is required for methodology governance integration tests");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
  const methodologyId = randomUUID();

  try {
    await pool.query("insert into methodology_versions (id,methodology_code,version,rules) values ($1,$2,$3,$4)", [methodologyId, "TEST-GOVERNANCE", "1", { equation: "test" }]);

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='IMPLEMENTATION_MAPPED' where id=$1", [methodologyId]),
      /requires locked source reference and hash|violates check constraint/,
    );

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='NUMERICALLY_RECONCILED', source_reference='test', source_hash=$2, applicability_rules=$3, parameter_dictionary=$4, equation_mapping=$5, reconciliation_reference='recon-1', reconciled_at=now() where id=$1", [methodologyId, "a".repeat(64), { sector: "TEST" }, { value: "number" }, {}]),
      /requires applicability, parameter and equation mappings|violates check constraint/,
    );

    await pool.query("update methodology_versions set governance_status='IMPLEMENTATION_MAPPED', source_reference='test', source_hash=$2, applicability_rules=$3, parameter_dictionary=$4, equation_mapping=$5 where id=$1", [methodologyId, "a".repeat(64), { sector: "TEST" }, { value: "number" }, { equation: "TEST.V1" }]);

    await assert.rejects(
      pool.query("update methodology_versions set source_hash=$2 where id=$1", [methodologyId, "b".repeat(64)]),
      /locked methodology source and implementation mapping cannot be changed/,
    );

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='SOURCE_LOCKED' where id=$1", [methodologyId]),
      /methodology governance status cannot regress/,
    );

    await pool.query("update methodology_versions set governance_status='NUMERICALLY_RECONCILED', reconciliation_reference='recon-1', reconciled_at=now(), reconciliation_evidence=$2 where id=$1", [methodologyId, [{ reference: "fixture-1" }]]);

    await assert.rejects(
      pool.query("update methodology_versions set reconciliation_reference='changed' where id=$1", [methodologyId]),
      /numerical reconciliation evidence cannot be changed/,
    );

    await pool.query("update methodology_versions set governance_status='REGRESSION_VERIFIED', regression_verified_at=now() where id=$1", [methodologyId]);

    await assert.rejects(
      pool.query("update methodology_versions set regression_verified_at=null where id=$1", [methodologyId]),
      /regression verification evidence cannot be changed|violates check constraint/,
    );

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='PRODUCTION_ELIGIBLE', reconciliation_evidence='[]'::jsonb where id=$1", [methodologyId]),
      /requires reconciliation evidence|violates check constraint/,
    );
  } finally {
    await pool.query("delete from methodology_versions where id=$1", [methodologyId]);
    await pool.end();
  }
});
