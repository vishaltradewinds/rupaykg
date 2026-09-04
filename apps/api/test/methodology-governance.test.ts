import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;

const evidenceHash = (seed: string) => seed.repeat(64).slice(0, 64);

test("methodology governance fails closed and becomes immutable after progression", async (t) => {
  if (!databaseUrl) {
    t.skip("DATABASE_URL is required for methodology governance integration tests");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
  const methodologyId = randomUUID();

  try {
    await pool.query("insert into methodology_versions (id,methodology_code,version,rules) values ($1,$2,$3,$4)", [methodologyId, "TEST-GOVERNANCE", "1", JSON.stringify({ equation: "test" })]);

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='IMPLEMENTATION_MAPPED' where id=$1", [methodologyId]),
      /requires locked source reference and hash|violates check constraint/,
    );

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='NUMERICALLY_RECONCILED', source_reference='test', source_hash=$2, applicability_rules=$3, parameter_dictionary=$4, equation_mapping=$5, reconciliation_reference='recon-1', reconciled_at=now() where id=$1", [methodologyId, "a".repeat(64), JSON.stringify({ sector: "TEST" }), JSON.stringify({ value: "number" }), JSON.stringify({})]),
      /requires applicability, parameter and equation mappings|violates check constraint/,
    );

    await pool.query("update methodology_versions set governance_status='IMPLEMENTATION_MAPPED', source_reference='test', source_hash=$2, applicability_rules=$3, parameter_dictionary=$4, equation_mapping=$5 where id=$1", [methodologyId, "a".repeat(64), JSON.stringify({ sector: "TEST" }), JSON.stringify({ value: "number" }), JSON.stringify({ equation: "TEST.V1" })]);

    await assert.rejects(
      pool.query("update methodology_versions set source_hash=$2 where id=$1", [methodologyId, "b".repeat(64)]),
      /locked methodology source and implementation mapping cannot be changed/,
    );

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='SOURCE_LOCKED' where id=$1", [methodologyId]),
      /methodology governance status cannot regress/,
    );

    await pool.query("update methodology_versions set governance_status='NUMERICALLY_RECONCILED', reconciliation_reference='recon-1', reconciled_at=now(), reconciliation_evidence=$2 where id=$1", [methodologyId, JSON.stringify([{ reference: "fixture-1" }])]);

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
      pool.query("update methodology_versions set governance_status='PRODUCTION_ELIGIBLE' where id=$1", [methodologyId]),
      /requires independent numerical reconciliation evidence|requires independent regression evidence|requires reconciliation evidence/,
    );

    await pool.query(
      "insert into methodology_governance_evidence (methodology_version_id,evidence_kind,reference,evidence_hash,independent_party,evidence) values ($1,'NUMERICAL_RECONCILIATION','fixture-reconciliation',$2,'independent-test-party',$3)",
      [methodologyId, evidenceHash("c"), JSON.stringify({ expected: 22783, unit: "tCO2e", fixture: "BM.WA03.001.EQ4.V1" })],
    );

    await assert.rejects(
      pool.query("update methodology_versions set governance_status='PRODUCTION_ELIGIBLE' where id=$1", [methodologyId]),
      /requires independent regression evidence/,
    );

    await pool.query(
      "insert into methodology_governance_evidence (methodology_version_id,evidence_kind,reference,evidence_hash,independent_party,evidence) values ($1,'REGRESSION_TEST','fixture-regression',$2,'independent-test-party',$3)",
      [methodologyId, evidenceHash("d"), JSON.stringify({ test: "methodology-governance", status: "PASS" })],
    );

    await pool.query("update methodology_versions set governance_status='PRODUCTION_ELIGIBLE' where id=$1", [methodologyId]);

    await assert.rejects(
      pool.query("update methodology_governance_evidence set evidence_hash=$2 where methodology_version_id=$1 and evidence_kind='NUMERICAL_RECONCILIATION'", [methodologyId, evidenceHash("e")]),
      /methodology governance evidence is immutable/,
    );

    await assert.rejects(
      pool.query("update methodology_governance_evidence set independent_party='changed' where methodology_version_id=$1 and evidence_kind='REGRESSION_TEST'", [methodologyId]),
      /methodology governance evidence is immutable/,
    );
  } finally {
    await pool.query("delete from methodology_governance_evidence where methodology_version_id=$1", [methodologyId]);
    await pool.query("delete from methodology_versions where id=$1", [methodologyId]);
    await pool.end();
  }
});
