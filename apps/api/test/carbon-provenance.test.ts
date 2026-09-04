import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;

test("carbon provenance is immutable in PostgreSQL", async (t) => {
  if (!databaseUrl) {
    t.skip("DATABASE_URL is required for carbon provenance integration tests");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
  const organizationId = randomUUID();
  const activityId = randomUUID();
  const methodologyId = randomUUID();
  const calculationId = randomUUID();
  const datasetHash = "a".repeat(64);
  const formulaHash = "b".repeat(64);
  const calculationHash = "c".repeat(64);

  try {
    await pool.query("begin");
    await pool.query("insert into organizations (id,name,organization_type) values ($1,$2,$3)", [organizationId, "Carbon Provenance Test Org", "TEST"]);
    await pool.query("insert into activities (id,organization_id,activity_type) values ($1,$2,$3)", [activityId, organizationId, "CARBON_TEST"]);
    await pool.query("insert into methodology_versions (id,methodology_code,version,rules) values ($1,$2,$3,$4)", [methodologyId, "TEST-METHOD", "1", JSON.stringify({ equation: "baseline-project" })]);
    await pool.query("insert into carbon_calculations (id,activity_id,methodology_version_id,inputs,result,unit,status,calculated_at,dataset_hash,formula_hash,calculation_trace,provenance_version,calculation_hash) values ($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10,$11,$12)", [calculationId, activityId, methodologyId, JSON.stringify({ baselineTco2e: 10, projectTco2e: 4 }), 6, "tCO2e", "CALCULATED_PENDING_VERIFICATION", datasetHash, formulaHash, JSON.stringify([{ equationId: "TEST.V1", result: 6, evidenceHash: datasetHash }]), "1", calculationHash]);
    await pool.query("commit");

    await assert.rejects(
      pool.query("update carbon_calculations set dataset_hash=$2 where id=$1", [calculationId, "d".repeat(64)]),
      /carbon calculation dataset provenance cannot be changed/,
    );
    await assert.rejects(
      pool.query("update carbon_calculations set formula_hash=$2 where id=$1", [calculationId, "e".repeat(64)]),
      /carbon calculation formula provenance cannot be changed/,
    );
    await assert.rejects(
      pool.query("update carbon_calculations set calculation_trace=$2 where id=$1", [calculationId, JSON.stringify([{ equationId: "ALTERED" }])]),
      /carbon calculation trace cannot be changed/,
    );
    await assert.rejects(
      pool.query("update carbon_calculations set provenance_version='2' where id=$1", [calculationId]),
      /carbon calculation provenance version cannot be changed/,
    );
    await assert.rejects(
      pool.query("update carbon_calculations set calculation_hash=$2 where id=$1", [calculationId, "f".repeat(64)]),
      /carbon calculation hash cannot be changed/,
    );
  } finally {
    await pool.query("delete from carbon_calculations where id=$1", [calculationId]);
    await pool.query("delete from methodology_versions where id=$1", [methodologyId]);
    await pool.query("delete from activities where id=$1", [activityId]);
    await pool.query("delete from organizations where id=$1", [organizationId]);
    await pool.end();
  }
});
