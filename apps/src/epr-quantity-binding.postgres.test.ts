import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

test("EPR quantity-binding delete guard preserves provenance and prevents identifier reuse", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL and RUPAYKG_RUN_DB_INTEGRATION_TESTS=1" : false,
}, async () => {
  const admin = new Pool({ connectionString: databaseUrl, max: 1 });
  const schema = `epr_binding_delete_it_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool | undefined;
  try {
    await admin.query(`create schema "${schema}"`);
    pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      options: `-c search_path=${schema},public`,
    });
    await pool.query(`
      create table epr_return_quantity_bindings (
        id uuid primary key,
        measurement_id uuid not null unique,
        custody_link_id uuid not null unique
      )
    `);
    const migrationCandidates = [
      resolve(process.cwd(), "migrations/091_epr_quantity_binding_delete_guard.sql"),
      resolve(process.cwd(), "../migrations/091_epr_quantity_binding_delete_guard.sql"),
    ];
    const migrationPath = migrationCandidates.find((candidate) => existsSync(candidate));
    assert.ok(migrationPath, "migration source must be available in the test checkout");
    await pool.query(readFileSync(migrationPath, "utf8"));

    const id = randomUUID();
    const measurementId = randomUUID();
    const custodyLinkId = randomUUID();
    await pool.query(
      "insert into epr_return_quantity_bindings(id,measurement_id,custody_link_id) values ($1,$2,$3)",
      [id, measurementId, custodyLinkId],
    );

    await assert.rejects(
      pool.query("delete from epr_return_quantity_bindings where id=$1", [id]),
      /EPR quantity binding deletion is prohibited/i,
    );
    const retained = await pool.query(
      "select id,measurement_id,custody_link_id from epr_return_quantity_bindings where id=$1",
      [id],
    );
    assert.equal(retained.rows.length, 1, "provenance row must remain after rejected delete");

    await assert.rejects(
      pool.query("insert into epr_return_quantity_bindings(id,measurement_id,custody_link_id) values ($1,$2,$3)", [
        randomUUID(), measurementId, randomUUID(),
      ]),
      /unique constraint/i,
      "a retained binding must continue to reserve its measurement identifier",
    );
    await assert.rejects(
      pool.query("insert into epr_return_quantity_bindings(id,measurement_id,custody_link_id) values ($1,$2,$3)", [
        randomUUID(), randomUUID(), custodyLinkId,
      ]),
      /unique constraint/i,
      "a retained binding must continue to reserve its custody identifier",
    );
  } finally {
    await pool?.end();
    await admin.query(`drop schema if exists "${schema}" cascade`).catch(() => undefined);
    await admin.end();
  }
});
