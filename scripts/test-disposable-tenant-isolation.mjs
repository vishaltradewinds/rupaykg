import { randomUUID } from "node:crypto";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
if (/localhost|127\\.0.0.1/.test(url) === false && process.env.ALLOW_DISPOSABLE_NONLOCAL !== "true") {
  throw new Error("Refusing tenant-isolation acceptance against a non-local database. Use disposable PostgreSQL or explicitly set ALLOW_DISPOSABLE_NONLOCAL=true.");
}

const admin = new Client({ connectionString: url });
const schema = "tenant_acceptance_" + randomUUID().replaceAll("-", "_");
const table = schema + ".tenant_rows";
const runtimeRole = "tenant_acceptance_" + randomUUID().replaceAll("-", "_");
const runtimePassword = randomUUID();

let runtime;
try {
  await admin.connect();

  await admin.query("CREATE ROLE " + JSON.stringify(runtimeRole) + " LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT PASSWORD $1", [runtimePassword]);
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.query(`CREATE TABLE "${schema}".tenant_rows (id uuid primary key, organization_id uuid not null, payload text not null)`);
  await admin.query(`ALTER TABLE "${schema}".tenant_rows ENABLE ROW LEVEL SECURITY`);
  await admin.query(`ALTER TABLE "${schema}".tenant_rows FORCE ROW LEVEL SECURITY`);
  await admin.query(`CREATE POLICY tenant_rows_isolation ON "${schema}".tenant_rows USING (organization_id = current_setting('app.rupaykg.organization_id', true)::uuid) WITH CHECK (organization_id = current_setting('app.rupaykg.organization_id', true)::uuid)`);
  await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${runtimeRole}"`);
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${schema}".tenant_rows TO "${runtimeRole}"`);

  const owner = await admin.query(`SELECT pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid = $1::regclass`, [table]);
  if (!owner.rows[0] || owner.rows[0].owner === runtimeRole) throw new Error("FAIL: disposable tenant table must be owned by an administrative role distinct from the runtime role");

  runtime = new Client({ connectionString: url, user: runtimeRole, password: runtimePassword });
  await runtime.connect();

  const role = await runtime.query(`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);
  if (!role.rows[0] || role.rows[0].rolsuper || role.rows[0].rolbypassrls) throw new Error("FAIL: disposable acceptance requires a non-superuser, non-BYPASSRLS runtime role");

  const orgA = randomUUID();
  const orgB = randomUUID();
  const rowA = randomUUID();
  const rowB = randomUUID();

  await runtime.query("BEGIN");
  await runtime.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  await runtime.query(`INSERT INTO ${table} (id, organization_id, payload) VALUES ($1,$2,'A')`, [rowA, orgA]);
  await runtime.query("COMMIT");

  await runtime.query("BEGIN");
  await runtime.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgB]);
  await runtime.query(`INSERT INTO ${table} (id, organization_id, payload) VALUES ($1,$2,'B')`, [rowB, orgB]);
  await runtime.query("COMMIT");

  await runtime.query("BEGIN");
  await runtime.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const own = await runtime.query(`SELECT id, payload FROM ${table} ORDER BY id`);
  if (own.rows.length !== 1 || own.rows[0].id !== rowA) throw new Error("FAIL: organization A can see another organization's row");
  await runtime.query("ROLLBACK");

  await runtime.query("BEGIN");
  await runtime.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  let insertDenied = false;
  try {
    await runtime.query(`INSERT INTO ${table} (id, organization_id, payload) VALUES ($1,$2,'spoof')`, [randomUUID(), orgB]);
  } catch {
    insertDenied = true;
  }
  if (!insertDenied) throw new Error("FAIL: organization A inserted a row for organization B");
  await runtime.query("ROLLBACK");

  await runtime.query("BEGIN");
  await runtime.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const deniedUpdate = await runtime.query(`UPDATE ${table} SET organization_id=$1 WHERE id=$2 RETURNING id`, [orgB, rowA]);
  if (deniedUpdate.rows.length !== 0) throw new Error("FAIL: organization A moved a row into organization B");
  await runtime.query("ROLLBACK");

  await runtime.query("BEGIN");
  await runtime.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const deniedDelete = await runtime.query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`, [rowB]);
  if (deniedDelete.rows.length !== 0) throw new Error("FAIL: organization A deleted organization B's row");
  await runtime.query("ROLLBACK");

  await runtime.query("BEGIN");
  await runtime.query("select set_config('app.rupaykg.organization_id', $1, true)", [orgA]);
  const settingInside = await runtime.query("select current_setting('app.rupaykg.organization_id', true) as value");
  if (settingInside.rows[0].value !== orgA) throw new Error("FAIL: transaction-local organization context was not set");
  await runtime.query("COMMIT");

  await runtime.query("BEGIN");
  const settingAfter = await runtime.query("select current_setting('app.rupaykg.organization_id', true) as value");
  if (settingAfter.rows[0].value !== "") throw new Error("FAIL: organization context leaked across transaction boundaries");
  await runtime.query("ROLLBACK");

  const policies = await runtime.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`, [table]);
  if (!policies.rows[0]?.relrowsecurity || !policies.rows[0]?.relforcerowsecurity) throw new Error("FAIL: disposable RLS policy was not enforced");

  console.log("PASS: disposable tenant isolation, write guards, RLS enforcement, transaction-local context cleanup, and runtime-role safety.");
} finally {
  try { await runtime?.end(); } catch {}
  try { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } catch {}
  try { await admin.query("DROP ROLE IF EXISTS " + JSON.stringify(runtimeRole)); } catch {}
  await admin.end();
}
