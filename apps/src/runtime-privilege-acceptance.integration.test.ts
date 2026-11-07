import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { withDatabaseTenantContext } from "./db-context.js";

const integrationEnabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

const pool = integrationEnabled && databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : null;
const suffix = `${process.pid}_${Date.now().toString(36)}`;
const schema = `rupaykg_runtime_privilege_${suffix}`;
const ownerRole = `rupaykg_owner_${suffix}`;
const runtimeRole = `rupaykg_runtime_${suffix}`;

function qid(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function query(text: string, values: unknown[] = []) {
  assert.ok(pool, "integration pool must be configured");
  return pool.query(text, values);
}

async function asRuntime(sql: string, values: unknown[] = []) {
  assert.ok(pool, "integration pool must be configured");
  return withDatabaseTenantContext(
    pool,
    {
      identityId: "runtime-identity",
      organizationId: "org-a",
      bilateralOrganizationScope: false,
      serviceMode: false,
    },
    async (client) => {
      await client.query(`set local role ${qid(runtimeRole)}`);
      return client.query(sql, values);
    },
  );
}

before(async () => {
  if (!integrationEnabled || !pool) return;

  await query(`create role ${qid(ownerRole)} nosuperuser nobypassrls nocreaterole nocreatedb noreplication nologin`);
  await query(`create role ${qid(runtimeRole)} nosuperuser nobypassrls nocreaterole nocreatedb noreplication login`);
  await query(`create schema ${qid(schema)} authorization ${qid(ownerRole)}`);

  await query(`
    create table ${qid(schema)}.tenant_data (
      id integer generated always as identity primary key,
      organization_id text not null,
      payload text not null
    );
    create table ${qid(schema)}.shared_catalog (
      id integer generated always as identity primary key,
      code text not null
    );
    create table ${qid(schema)}.protected_control (
      id integer generated always as identity primary key,
      secret text not null
    );
    create table ${qid(schema)}.schema_migrations (
      version text primary key,
      filename text not null
    );
    create function ${qid(schema)}.runtime_allowed_function()
      returns text
      language sql
      stable
      as $$ select 'allowed'::text $$;
  `);

  await query(`
    alter table ${qid(schema)}.tenant_data owner to ${qid(ownerRole)};
    alter table ${qid(schema)}.shared_catalog owner to ${qid(ownerRole)};
    alter table ${qid(schema)}.protected_control owner to ${qid(ownerRole)};
    alter table ${qid(schema)}.schema_migrations owner to ${qid(ownerRole)};
    alter sequence ${qid(schema)}.tenant_data_id_seq owner to ${qid(ownerRole)};
    alter function ${qid(schema)}.runtime_allowed_function() owner to ${qid(ownerRole)};

    revoke all on schema ${qid(schema)} from public;
    revoke all on all tables in schema ${qid(schema)} from public;
    revoke all on all sequences in schema ${qid(schema)} from public;
    revoke all on function ${qid(schema)}.runtime_allowed_function() from public;

    grant usage on schema ${qid(schema)} to ${qid(runtimeRole)};
    grant select, insert, update, delete on ${qid(schema)}.tenant_data to ${qid(runtimeRole)};
    grant select on ${qid(schema)}.shared_catalog to ${qid(runtimeRole)};
    grant usage, select on sequence ${qid(schema)}.tenant_data_id_seq to ${qid(runtimeRole)};
    grant execute on function ${qid(schema)}.runtime_allowed_function() to ${qid(runtimeRole)};

    insert into ${qid(schema)}.tenant_data(organization_id, payload) values ('org-a', 'runtime-row');
    insert into ${qid(schema)}.shared_catalog(code) values ('CAT-001');
    insert into ${qid(schema)}.protected_control(secret) values ('not-for-runtime');
  `);

  await query(`
    alter table ${qid(schema)}.tenant_data enable row level security;
    alter table ${qid(schema)}.tenant_data force row level security;
    create policy tenant_data_isolation on ${qid(schema)}.tenant_data
      using (
        current_setting('app.rupaykg.service_mode', true) = 'true'
        or organization_id = current_setting('app.rupaykg.organization_id', true)
      )
      with check (
        current_setting('app.rupaykg.service_mode', true) = 'true'
        or organization_id = current_setting('app.rupaykg.organization_id', true)
      );
  `);
});

after(async () => {
  if (!pool) return;
  try {
    await query(`drop schema if exists ${qid(schema)} cascade`);
    await query(`drop role if exists ${qid(runtimeRole)}`);
    await query(`drop role if exists ${qid(ownerRole)}`);
  } finally {
    await pool.end();
  }
});

test("runtime role is least-privilege and objects are separately owned", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const role = await query(
    `select rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
     from pg_roles where rolname = $1`,
    [runtimeRole],
  );
  assert.deepEqual(role.rows[0], {
    rolcanlogin: true,
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  });

  const ownership = await query(
    `select c.relowner::regrole::text as owner
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1 and c.relname in ('tenant_data', 'shared_catalog', 'protected_control', 'schema_migrations')
     order by c.relname`,
    [schema],
  );
  assert.deepEqual(ownership.rows.map((row) => row.owner), Array(4).fill(ownerRole));

  const runtimeOwnsNothing = await query(
    `select count(*)::int as count
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_roles r on r.oid = c.relowner
     where n.nspname = $1 and r.rolname = $2`,
    [schema, runtimeRole],
  );
  assert.equal(runtimeOwnsNothing.rows[0]?.count, 0);
});

test("PUBLIC has no accidental application privileges and runtime grants are explicit", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const privileges = await query(
    `select
       has_schema_privilege('public', $1, 'USAGE') as public_schema_usage,
       has_table_privilege('public', $1 || '.tenant_data', 'SELECT') as public_tenant_select,
       has_table_privilege($2, $1 || '.tenant_data', 'SELECT') as runtime_select,
       has_table_privilege($2, $1 || '.tenant_data', 'INSERT') as runtime_insert,
       has_table_privilege($2, $1 || '.protected_control', 'SELECT') as runtime_protected_select`,
    [schema, runtimeRole],
  );
  assert.deepEqual(privileges.rows[0], {
    public_schema_usage: false,
    public_tenant_select: false,
    runtime_select: true,
    runtime_insert: true,
    runtime_protected_select: false,
  });

  const grants = await query(
    `select privilege_type, is_grantable
     from information_schema.role_table_grants
     where grantee = $1 and table_schema = $2 and table_name = 'tenant_data'
     order by privilege_type`,
    [runtimeRole, schema],
  );
  assert.ok(grants.rows.length >= 4);
  assert.ok(grants.rows.every((row) => row.is_grantable === "NO"));
});

test("runtime DDL, role administration, and migration-ledger writes are denied", { skip: !integrationEnabled || !databaseUrl }, async () => {
  await asRuntime(`insert into ${qid(schema)}.tenant_data(organization_id, payload) values ('org-a', 'allowed-write')`);

  await assert.rejects(
    asRuntime(`insert into ${qid(schema)}.schema_migrations(version, filename) values ('999', 'runtime.sql')`),
    (error: any) => error?.code === "42501",
  );

  await assert.rejects(
    asRuntime(`create table ${qid(schema)}.runtime_created(id integer)`),
    (error: any) => error?.code === "42501",
  );

  await assert.rejects(
    asRuntime(`alter table ${qid(schema)}.tenant_data add column runtime_created text`),
    (error: any) => error?.code === "42501",
  );

  await assert.rejects(
    asRuntime(`drop table ${qid(schema)}.tenant_data`),
    (error: any) => error?.code === "42501",
  );

  await assert.rejects(
    asRuntime(`create role ${qid(`runtime_child_${suffix}`)}`),
    (error: any) => error?.code === "42501",
  );
});

test("required sequence/function access is explicit and protected control data remains inaccessible", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const inserted = await asRuntime(
    `insert into ${qid(schema)}.tenant_data(organization_id, payload) values ('org-a', 'sequence-write') returning id`,
  );
  assert.equal(typeof inserted.rows[0]?.id, "number");

  const fn = await asRuntime(`select ${qid(schema)}.runtime_allowed_function() as value`);
  assert.equal(fn.rows[0]?.value, "allowed");

  await assert.rejects(
    asRuntime(`select secret from ${qid(schema)}.protected_control`),
    (error: any) => error?.code === "42501",
  );
});

test("tenant RLS remains effective under the runtime role", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const own = await asRuntime(`select payload from ${qid(schema)}.tenant_data where organization_id = 'org-a' order by id`);
  assert.ok(own.rows.length >= 1);

  const crossTenant = await asRuntime(`select payload from ${qid(schema)}.tenant_data where organization_id = 'org-b'`);
  assert.deepEqual(crossTenant.rows, []);

  const crossTenantWrite = await asRuntime(
    `update ${qid(schema)}.tenant_data set payload = 'tampered' where organization_id = 'org-b'`,
  );
  assert.equal(crossTenantWrite.rowCount, 0);

  await assert.rejects(
    asRuntime(`insert into ${qid(schema)}.tenant_data(organization_id, payload) values ('org-b', 'cross-tenant')`),
    (error: any) => error?.code === "42501",
  );
});
