import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

test("EPR quantity binding preserves immutable provenance, consumption, and unique allocation keys", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL and RUPAYKG_RUN_DB_INTEGRATION_TESTS=1" : false,
}, async () => {
  const admin = new Pool({ connectionString: databaseUrl, max: 1 });
  const schema = `epr_binding_integrity_it_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool | undefined;
  try {
    await admin.query(`create schema "${schema}"`);
    pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      options: `-c search_path=${schema},public`,
    });

    // A minimal isolated table keeps the test disposable while exercising the
    // actual trigger functions from migrations 090 and 091.
    await pool.query(`
      create table epr_return_quantity_bindings (
        id uuid primary key,
        epr_return_id uuid not null unique,
        obligation_id uuid not null,
        measurement_id uuid not null unique,
        resource_flow_id uuid not null,
        custody_link_id uuid not null unique,
        evidence_id uuid not null,
        verification_id uuid not null,
        methodology_version_id uuid not null,
        category_code text not null,
        unit_code text not null,
        period_start date not null,
        period_end date not null,
        measured_quantity numeric(20,6) not null,
        created_by_identity_id uuid not null,
        declared_quantity_before_binding numeric(20,6) not null,
        consumed_at timestamptz,
        created_at timestamptz not null default now()
      )
    `);

    const migrationCandidates = [
      resolve(process.cwd(), "migrations/090_epr_declared_quantity_reconciliation.sql"),
      resolve(process.cwd(), "../migrations/090_epr_declared_quantity_reconciliation.sql"),
    ];
    const migrationPath = migrationCandidates.find((candidate) => existsSync(candidate));
    assert.ok(migrationPath, "migration 090 source must be available in the test checkout");
    const migration = readFileSync(migrationPath, "utf8");
    const functionMatch = migration.match(/create or replace function prevent_epr_quantity_binding_mutation\(\)[\s\S]*?\$\$;/i);
    assert.ok(functionMatch, "actual provenance immutability trigger function must be extracted from migration 090");
    await pool.query(functionMatch[0]);
    await pool.query(`
      create trigger epr_quantity_binding_immutability_guard
      before update on epr_return_quantity_bindings
      for each row execute function prevent_epr_quantity_binding_mutation()
    `);

    const deleteMigrationCandidates = [
      resolve(process.cwd(), "migrations/091_epr_quantity_binding_delete_guard.sql"),
      resolve(process.cwd(), "../migrations/091_epr_quantity_binding_delete_guard.sql"),
    ];
    const deleteMigrationPath = deleteMigrationCandidates.find((candidate) => existsSync(candidate));
    assert.ok(deleteMigrationPath, "migration 091 source must be available in the test checkout");
    await pool.query(readFileSync(deleteMigrationPath, "utf8"));

    const row = {
      id: randomUUID(),
      eprReturnId: randomUUID(),
      obligationId: randomUUID(),
      measurementId: randomUUID(),
      resourceFlowId: randomUUID(),
      custodyLinkId: randomUUID(),
      evidenceId: randomUUID(),
      verificationId: randomUUID(),
      methodologyVersionId: randomUUID(),
      createdBy: randomUUID(),
    };
    await pool.query(
      `insert into epr_return_quantity_bindings
        (id,epr_return_id,obligation_id,measurement_id,resource_flow_id,custody_link_id,
         evidence_id,verification_id,methodology_version_id,category_code,unit_code,
         period_start,period_end,measured_quantity,created_by_identity_id,declared_quantity_before_binding)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PLASTIC','kg','2026-04-01','2027-03-31',125.5,$10,130)`,
      [row.id,row.eprReturnId,row.obligationId,row.measurementId,row.resourceFlowId,row.custodyLinkId,
       row.evidenceId,row.verificationId,row.methodologyVersionId,row.createdBy],
    );

    await assert.rejects(
      pool.query("update epr_return_quantity_bindings set measured_quantity=126 where id=$1", [row.id]),
      /EPR quantity binding provenance is immutable/i,
      "measured quantity must not be editable after binding",
    );
    await assert.rejects(
      pool.query("update epr_return_quantity_bindings set declared_quantity_before_binding=125 where id=$1", [row.id]),
      /EPR quantity binding provenance is immutable/i,
      "original declared quantity must remain immutable",
    );

    await pool.query("update epr_return_quantity_bindings set consumed_at=now() where id=$1", [row.id]);
    await assert.rejects(
      pool.query("update epr_return_quantity_bindings set consumed_at=null where id=$1", [row.id]),
      /EPR quantity binding consumption is immutable/i,
      "consumed binding must not be reset to permit reuse",
    );

    await assert.rejects(
      pool.query("delete from epr_return_quantity_bindings where id=$1", [row.id]),
      /EPR quantity binding deletion is prohibited/i,
      "provenance rows must not be deleted",
    );

    await assert.rejects(
      pool.query(`insert into epr_return_quantity_bindings
        (id,epr_return_id,obligation_id,measurement_id,resource_flow_id,custody_link_id,
         evidence_id,verification_id,methodology_version_id,category_code,unit_code,
         period_start,period_end,measured_quantity,created_by_identity_id,declared_quantity_before_binding)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PLASTIC','kg','2026-04-01','2027-03-31',10,$10,10)`,
      [randomUUID(),randomUUID(),row.obligationId,row.measurementId,randomUUID(),randomUUID(),
       randomUUID(),randomUUID(),randomUUID(),randomUUID()],
      ),
      /unique constraint/i,
      "measurement key must remain reserved after consumption",
    );
    await assert.rejects(
      pool.query(`insert into epr_return_quantity_bindings
        (id,epr_return_id,obligation_id,measurement_id,resource_flow_id,custody_link_id,
         evidence_id,verification_id,methodology_version_id,category_code,unit_code,
         period_start,period_end,measured_quantity,created_by_identity_id,declared_quantity_before_binding)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PLASTIC','kg','2026-04-01','2027-03-31',10,$10,10)`,
      [randomUUID(),randomUUID(),row.obligationId,randomUUID(),randomUUID(),row.custodyLinkId,
       randomUUID(),randomUUID(),randomUUID(),randomUUID()],
      ),
      /unique constraint/i,
      "custody allocation must remain reserved after consumption",
    );

    const retained = await pool.query(
      "select measured_quantity::text,declared_quantity_before_binding::text,consumed_at from epr_return_quantity_bindings where id=$1",
      [row.id],
    );
    assert.equal(retained.rows.length, 1);
    assert.equal(retained.rows[0].measured_quantity, "125.500000");
    assert.equal(retained.rows[0].declared_quantity_before_binding, "130.000000");
    assert.ok(retained.rows[0].consumed_at);
  } finally {
    await pool?.end();
    await admin.query(`drop schema if exists "${schema}" cascade`).catch(() => undefined);
    await admin.end();
  }
});
