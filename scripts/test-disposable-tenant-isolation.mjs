import { randomUUID } from "node:crypto";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
if (/localhost|127\\.0.0.1/.test(url) === false && process.env.ALLOW_DISPOSABLE_NONLOCAL !== "true") {
  throw new Error("Refusing tenant-isolation acceptance against a non-local database. Use disposable PostgreSQL or explicitly set ALLOW_DISPOSABLE_NONLOCAL=true.");
}

const client = new Client({ connectionString: url });
const schema = "tenant_acceptance_" + randomUUID().replaceAll("-", "_");
const table = schema + ".tenant_rows";

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`CREATE TABLE "${schema}".tenant_rows (id uuid primary key, organization_id uuid not null, payload text not null)`);
  await client.query(`ALTER TABLE "${schema}".tenant_rows ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE "${schema}".tenant_rows FORCE ROW LEVEL SECURITY`);
  await client.query(`CREATE POLICY tenant_rows_isolation ON "${schema}".tenant_rows USING (organization_id = current_setting('app.rupaykg.organization_id', true)::uuid) WITH CHECK (organization_id = current_setting('app.rupaykg.organization_id', true)::uuid)`);
  await client.query("COMMIT");

  const orgA = randomUUID();
  const orgB = randomUUID();
  const rowA = randomUUID();
  const rowB = randomUUID();

  await client.query("BEGIN");
  await client.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  await client.query(`INSERT INTO ${table} (id, organization_id, payload) VALUES ($1,$2,'A')`, [rowA, orgA]);
  await client.query("COMMIT");

  await client.query("BEGIN");
  await client.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgB]);
  await client.query(`INSERT INTO ${table} (id, organization_id, payload) VALUES ($1,$2,'B')`, [rowB, orgB]);
  await client.query("COMMIT");

  await client.query("BEGIN");
  await client.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const own = await client.query(`SELECT id, payload FROM ${table} ORDER BY id`);
  if (own.rows.length !== 1 || own.rows[0].id !== rowA) throw new Error("FAIL: organization A can see another organization's row");
  await client.query("ROLLBACK");

  await client.query("BEGIN");
  await client.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const deniedInsert = await client.query(`INSERT INTO ${table} (id, organization_id, payload) VALUES ($1,$2,'spoof') ON CONFLICT DO NOTHING RETURNING id`, [randomUUID(), orgB]);
  if (deniedInsert.rows.length !== 0) throw new Error("FAIL: organization A inserted a row for organization B");
  await client.query("ROLLBACK");

  await client.query("BEGIN");
  await client.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const deniedUpdate = await client.query(`UPDATE ${table} SET organization_id=$1 WHERE id=$2 RETURNING id`, [orgB, rowA]);
  if (deniedUpdate.rows.length !== 0) throw new Error("FAIL: organization A moved a row into organization B");
  await client.query("ROLLBACK");

  await client.query("BEGIN");
  await client.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const deniedDelete = await client.query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`, [rowB]);
  if (deniedDelete.rows.length !== 0) throw new Error("FAIL: organization A deleted organization B's row");
  await client.query("ROLLBACK");

  await client.query("BEGIN");
  await client.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const settingInside = await client.query("select current_setting('app.rupaykg.organization_id', true) as value");
  if (settingInside.rows[0].value !== orgA) throw new Error("FAIL: transaction-local organization context was not set");
  await client.query("COMMIT");

  await client.query("BEGIN");
  const settingAfter = await client.query("select current_setting('app.rupaykg.organization_id', true) as value");
  if (settingAfter.rows[0].value !== "") throw new Error("FAIL: organization context leaked across transaction boundaries");
  await client.query("ROLLBACK");

  await client.query("BEGIN");
  const policies = await client.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`, [table]);
  if (!policies.rows[0]?.relrowsecurity || !policies.rows[0]?.relforcerowsecurity) throw new Error("FAIL: disposable RLS policy was not enforced");
  await client.query("ROLLBACK");

  console.log("PASS: disposable tenant isolation, write guards, RLS enforcement and transaction-local context cleanup.");
} finally {
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } catch {}
  await client.end();
}
