import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { withDatabaseBootstrapContext } from "./db-context.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;
const pool = enabled && databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : null;
const schema = `rupaykg_auth_bootstrap_boundary_${process.pid}_${Date.now().toString(36)}`;
const role = `rupaykg_auth_bootstrap_${process.pid}_${Date.now().toString(36)}`;

function qid(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

before(async () => {
  if (!pool) return;
  await pool.query(`create role ${qid(role)} nosuperuser nobypassrls nologin`);
  await pool.query(`create schema ${qid(schema)}`);
  await pool.query(`create table ${qid(schema)}.control_plane (id integer primary key, identity_id text not null)`);
  await pool.query(`create table ${qid(schema)}.tenant_data (id integer primary key, organization_id text not null, payload text not null)`);
  await pool.query(`insert into ${qid(schema)}.control_plane values (1, 'identity-a')`);
  await pool.query(`insert into ${qid(schema)}.tenant_data values (1, 'org-a', 'a'), (2, 'org-b', 'b')`);
  await pool.query(`grant usage on schema ${qid(schema)} to ${qid(role)}`);
  await pool.query(`grant select on ${qid(schema)}.control_plane, ${qid(schema)}.tenant_data to ${qid(role)}`);
  await pool.query(`alter table ${qid(schema)}.tenant_data enable row level security`);
  await pool.query(`alter table ${qid(schema)}.tenant_data force row level security`);
  await pool.query(`
    create policy tenant_boundary on ${qid(schema)}.tenant_data
      using (
        current_setting('app.rupaykg.service_mode', true) = 'true'
        or (
          current_setting('app.rupaykg.organization_id', true) <> ''
          and organization_id = current_setting('app.rupaykg.organization_id', true)
        )
      )
  `);
});

after(async () => {
  if (!pool) return;
  try {
    await pool.query(`drop schema if exists ${qid(schema)} cascade`);
    await pool.query(`drop role if exists ${qid(role)}`);
  } finally {
    await pool.end();
  }
});

test("authentication bootstrap cannot project tenant data or enable service mode", { skip: !enabled || !databaseUrl }, async () => {
  const result = await withDatabaseBootstrapContext(pool!, async (client) => {
    await client.query(`set local role ${qid(role)}`);
    const control = await client.query(`select identity_id from ${qid(schema)}.control_plane`);
    assert.equal(control.rows[0]?.identity_id, "identity-a");

    const settings = await client.query(
      "select current_setting('app.rupaykg.organization_id', true) as organization_id, current_setting('app.rupaykg.identity_id', true) as identity_id, current_setting('app.rupaykg.service_mode', true) as service_mode, current_setting('app.rupaykg.bilateral_scope', true) as bilateral_scope",
    );
    assert.equal(settings.rows[0]?.organization_id, "");
    assert.equal(settings.rows[0]?.identity_id, "");
    assert.equal(settings.rows[0]?.service_mode, "false");
    assert.equal(settings.rows[0]?.bilateral_scope, "false");

    const tenant = await client.query(`select count(*)::int as count from ${qid(schema)}.tenant_data`);
    assert.equal(tenant.rows[0]?.count, 0);
    return true;
  });
  assert.equal(result, true);
});
