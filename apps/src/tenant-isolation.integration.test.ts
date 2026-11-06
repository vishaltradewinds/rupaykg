import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { withDatabaseBootstrapContext, withDatabaseTenantContext } from "./db-context.js";

const integrationEnabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

const pool = integrationEnabled && databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 1 })
  : null;

const schema = `rupaykg_tenant_isolation_${process.pid}_${Date.now().toString(36)}`;
const testRole = `rupaykg_ti_${process.pid}_${Date.now().toString(36)}`;

function qid(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function query(text: string, values: unknown[] = []) {
  assert.ok(pool, "integration pool must be configured");
  return pool.query(text, values);
}

async function contextQuery(
  identityId: string,
  organizationId: string | undefined,
  options: { bilateral?: boolean; serviceMode?: boolean } = {},
  sql: string,
  values: unknown[] = [],
) {
  assert.ok(pool, "integration pool must be configured");
  return withDatabaseTenantContext(
    pool,
    {
      identityId,
      ...(organizationId ? { organizationId } : {}),
      bilateralOrganizationScope: options.bilateral ?? false,
      serviceMode: options.serviceMode ?? false,
    },
    async (client) => {
      await client.query(`set local role ${qid(testRole)}`);
      return client.query(sql, values);
    },
  );
}

before(async () => {
  if (!integrationEnabled || !pool) return;

  await query(`create role ${qid(testRole)} nosuperuser nobypassrls nologin`);
  await query(`create schema ${qid(schema)}`);
  await query(`
    create table ${qid(schema)}.identities (
      identity_id text primary key,
      status text not null
    );
    create table ${qid(schema)}.memberships (
      identity_id text not null,
      organization_id text not null,
      status text not null,
      primary key (identity_id, organization_id)
    );
    create table ${qid(schema)}.tenant_records (
      id integer generated always as identity primary key,
      organization_id text not null,
      payload text not null
    );
    create table ${qid(schema)}.bilateral_records (
      id integer generated always as identity primary key,
      from_organization_id text not null,
      to_organization_id text not null,
      payload text not null
    );
    create table ${qid(schema)}.activities (
      id integer generated always as identity primary key,
      organization_id text not null,
      actor_identity_id text,
      payload text not null
    );
    create table ${qid(schema)}.evidence (
      id integer generated always as identity primary key,
      activity_id integer not null references ${qid(schema)}.activities(id),
      payload text not null
    );
    create table ${qid(schema)}.verifications (
      id integer generated always as identity primary key,
      evidence_id integer not null references ${qid(schema)}.evidence(id),
      decision text not null,
      payload text not null
    );
  `);

  await query(`
    grant usage on schema ${qid(schema)} to ${qid(testRole)};
    grant select on ${qid(schema)}.identities, ${qid(schema)}.memberships to ${qid(testRole)};
    grant select, insert, update, delete on ${qid(schema)}.tenant_records, ${qid(schema)}.bilateral_records, ${qid(schema)}.activities, ${qid(schema)}.evidence, ${qid(schema)}.verifications to ${qid(testRole)};
    grant usage, select on all sequences in schema ${qid(schema)} to ${qid(testRole)};

    insert into ${qid(schema)}.identities(identity_id, status)
    values ('identity-a', 'ACTIVE'), ('identity-b', 'ACTIVE'), ('identity-suspended', 'SUSPENDED');
    insert into ${qid(schema)}.memberships(identity_id, organization_id, status)
    values
      ('identity-a', 'org-a', 'ACTIVE'),
      ('identity-a', 'org-b', 'REVOKED'),
      ('identity-b', 'org-b', 'ACTIVE'),
      ('identity-suspended', 'org-a', 'ACTIVE');
  `);

  await query(`
    alter table ${qid(schema)}.tenant_records enable row level security;
    alter table ${qid(schema)}.tenant_records force row level security;
    alter table ${qid(schema)}.bilateral_records enable row level security;
    alter table ${qid(schema)}.bilateral_records force row level security;
    alter table ${qid(schema)}.activities enable row level security;
    alter table ${qid(schema)}.activities force row level security;
    alter table ${qid(schema)}.evidence enable row level security;
    alter table ${qid(schema)}.evidence force row level security;
    alter table ${qid(schema)}.verifications enable row level security;
    alter table ${qid(schema)}.verifications force row level security;

    create policy tenant_records_isolation on ${qid(schema)}.tenant_records
      using (
        current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (
          select 1
          from ${qid(schema)}.memberships m
          join ${qid(schema)}.identities i on i.identity_id = m.identity_id
          where m.identity_id = current_setting('app.rupaykg.identity_id', true)
            and m.organization_id = ${qid(schema)}.tenant_records.organization_id
            and m.status = 'ACTIVE'
            and i.status = 'ACTIVE'
            and m.organization_id = current_setting('app.rupaykg.organization_id', true)
        )
      )
      with check (
        current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (
          select 1
          from ${qid(schema)}.memberships m
          join ${qid(schema)}.identities i on i.identity_id = m.identity_id
          where m.identity_id = current_setting('app.rupaykg.identity_id', true)
            and m.organization_id = ${qid(schema)}.tenant_records.organization_id
            and m.status = 'ACTIVE'
            and i.status = 'ACTIVE'
            and m.organization_id = current_setting('app.rupaykg.organization_id', true)
        )
      );

    create policy activities_isolation on ${qid(schema)}.activities
      using (current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (select 1 from ${qid(schema)}.memberships m join ${qid(schema)}.identities i on i.identity_id=m.identity_id
          where m.identity_id=current_setting('app.rupaykg.identity_id', true) and m.organization_id=${qid(schema)}.activities.organization_id
            and m.organization_id=current_setting('app.rupaykg.organization_id', true) and m.status='ACTIVE' and i.status='ACTIVE'))
      with check (current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (select 1 from ${qid(schema)}.memberships m join ${qid(schema)}.identities i on i.identity_id=m.identity_id
          where m.identity_id=current_setting('app.rupaykg.identity_id', true) and m.organization_id=${qid(schema)}.activities.organization_id
            and m.organization_id=current_setting('app.rupaykg.organization_id', true) and m.status='ACTIVE' and i.status='ACTIVE'));

    create policy evidence_isolation on ${qid(schema)}.evidence
      using (current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (select 1 from ${qid(schema)}.activities a join ${qid(schema)}.memberships m on m.organization_id=a.organization_id
          join ${qid(schema)}.identities i on i.identity_id=m.identity_id
          where a.id=${qid(schema)}.evidence.activity_id and m.identity_id=current_setting('app.rupaykg.identity_id', true)
            and m.organization_id=current_setting('app.rupaykg.organization_id', true) and m.status='ACTIVE' and i.status='ACTIVE'))
      with check (current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (select 1 from ${qid(schema)}.activities a join ${qid(schema)}.memberships m on m.organization_id=a.organization_id
          join ${qid(schema)}.identities i on i.identity_id=m.identity_id
          where a.id=${qid(schema)}.evidence.activity_id and m.identity_id=current_setting('app.rupaykg.identity_id', true)
            and m.organization_id=current_setting('app.rupaykg.organization_id', true) and m.status='ACTIVE' and i.status='ACTIVE'));

    create policy verifications_isolation on ${qid(schema)}.verifications
      using (current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (select 1 from ${qid(schema)}.evidence e join ${qid(schema)}.activities a on a.id=e.activity_id
          join ${qid(schema)}.memberships m on m.organization_id=a.organization_id join ${qid(schema)}.identities i on i.identity_id=m.identity_id
          where e.id=${qid(schema)}.verifications.evidence_id and m.identity_id=current_setting('app.rupaykg.identity_id', true)
            and m.organization_id=current_setting('app.rupaykg.organization_id', true) and m.status='ACTIVE' and i.status='ACTIVE'))
      with check (current_setting('app.rupaykg.service_mode', true) = 'true'
        or exists (select 1 from ${qid(schema)}.evidence e join ${qid(schema)}.activities a on a.id=e.activity_id
          join ${qid(schema)}.memberships m on m.organization_id=a.organization_id join ${qid(schema)}.identities i on i.identity_id=m.identity_id
          where e.id=${qid(schema)}.verifications.evidence_id and m.identity_id=current_setting('app.rupaykg.identity_id', true)
            and m.organization_id=current_setting('app.rupaykg.organization_id', true) and m.status='ACTIVE' and i.status='ACTIVE'));

    create policy bilateral_records_isolation on ${qid(schema)}.bilateral_records
      using (
        current_setting('app.rupaykg.service_mode', true) = 'true'
        or (
          exists (
            select 1
            from ${qid(schema)}.memberships m
            join ${qid(schema)}.identities i on i.identity_id = m.identity_id
            where m.identity_id = current_setting('app.rupaykg.identity_id', true)
              and m.status = 'ACTIVE'
              and i.status = 'ACTIVE'
              and m.organization_id = current_setting('app.rupaykg.organization_id', true)
          )
          and current_setting('app.rupaykg.bilateral_scope', true) = 'true'
          and (
            ${qid(schema)}.bilateral_records.from_organization_id = current_setting('app.rupaykg.organization_id', true)
            or ${qid(schema)}.bilateral_records.to_organization_id = current_setting('app.rupaykg.organization_id', true)
          )
        )
      )
      with check (
        current_setting('app.rupaykg.service_mode', true) = 'true'
        or (
          exists (
            select 1
            from ${qid(schema)}.memberships m
            join ${qid(schema)}.identities i on i.identity_id = m.identity_id
            where m.identity_id = current_setting('app.rupaykg.identity_id', true)
              and m.status = 'ACTIVE'
              and i.status = 'ACTIVE'
              and m.organization_id = current_setting('app.rupaykg.organization_id', true)
          )
          and current_setting('app.rupaykg.bilateral_scope', true) = 'true'
          and (
            ${qid(schema)}.bilateral_records.from_organization_id = current_setting('app.rupaykg.organization_id', true)
            or ${qid(schema)}.bilateral_records.to_organization_id = current_setting('app.rupaykg.organization_id', true)
          )
        )
      );
  `);

  await contextQuery("identity-a", undefined, { serviceMode: true }, `
    insert into ${qid(schema)}.tenant_records(organization_id, payload)
    values ('org-a', 'a-row'), ('org-b', 'b-row');
    insert into ${qid(schema)}.bilateral_records(from_organization_id, to_organization_id, payload)
    values ('org-a', 'org-b', 'a-b-row'), ('org-b', 'org-c', 'b-c-row');
    insert into ${qid(schema)}.activities(organization_id, actor_identity_id, payload)
    values ('org-a', 'identity-a', 'activity-a'), ('org-b', 'identity-b', 'activity-b');
    insert into ${qid(schema)}.evidence(activity_id, payload)
    values (1, 'evidence-a'), (2, 'evidence-b');
    insert into ${qid(schema)}.verifications(evidence_id, decision, payload)
    values (1, 'APPROVED', 'verification-a'), (2, 'APPROVED', 'verification-b');
  `);
});

after(async () => {
  if (!pool) return;
  try {
    await query(`drop schema if exists ${qid(schema)} cascade`);
    await query(`drop role if exists ${qid(testRole)}`);
  } finally {
    await pool.end();
  }
});

test("bootstrap context is organization-neutral and explicitly non-service-scoped", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const result = await withDatabaseBootstrapContext(pool!, async (client) => {
    await client.query(`set local role ${qid(testRole)}`);
    const settings = await client.query(
      "select current_setting('app.rupaykg.organization_id', true) as organization_id, current_setting('app.rupaykg.identity_id', true) as identity_id, current_setting('app.rupaykg.service_mode', true) as service_mode, current_setting('app.rupaykg.bilateral_scope', true) as bilateral_scope",
    );
    return settings.rows[0];
  });
  assert.ok(result.organization_id === null || result.organization_id === "");
  assert.ok(result.identity_id === null || result.identity_id === "");
  assert.equal(result.service_mode, "false");
  assert.equal(result.bilateral_scope, "false");
});

test("cross-tenant SELECT/INSERT/UPDATE/DELETE is denied", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const visible = await contextQuery("identity-a", "org-a", {}, `select organization_id, payload from ${qid(schema)}.tenant_records order by organization_id`);
  assert.deepEqual(visible.rows, [{ organization_id: "org-a", payload: "a-row" }]);

  await assert.rejects(
    contextQuery("identity-a", "org-a", {}, `insert into ${qid(schema)}.tenant_records(organization_id, payload) values ('org-b', 'cross-write')`),
    (error: any) => error?.code === "42501",
  );

  const updated = await contextQuery("identity-a", "org-a", {}, `update ${qid(schema)}.tenant_records set payload = 'tampered' where organization_id = 'org-b'`);
  assert.equal(updated.rowCount, 0);

  const deleted = await contextQuery("identity-a", "org-a", {}, `delete from ${qid(schema)}.tenant_records where organization_id = 'org-b'`);
  assert.equal(deleted.rowCount, 0);
});

test("inherited activity/evidence/verification scope follows the parent organization", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const orgA = await contextQuery("identity-a", "org-a", {}, `select a.payload as activity, e.payload as evidence, v.payload as verification
    from ${qid(schema)}.activities a join ${qid(schema)}.evidence e on e.activity_id=a.id
    join ${qid(schema)}.verifications v on v.evidence_id=e.id order by a.id`);
  assert.deepEqual(orgA.rows, [{ activity: "activity-a", evidence: "evidence-a", verification: "verification-a" }]);

  const orgB = await contextQuery("identity-b", "org-b", {}, `select a.payload as activity, e.payload as evidence, v.payload as verification
    from ${qid(schema)}.activities a join ${qid(schema)}.evidence e on e.activity_id=a.id
    join ${qid(schema)}.verifications v on v.evidence_id=e.id order by a.id`);
  assert.deepEqual(orgB.rows, [{ activity: "activity-b", evidence: "evidence-b", verification: "verification-b" }]);

  const crossTenantUpdate = await contextQuery("identity-a", "org-a", {}, `update ${qid(schema)}.verifications set payload='tampered' where id=2`);
  assert.equal(crossTenantUpdate.rowCount, 0);
});

test("revoked membership denies tenant access", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const visible = await contextQuery("identity-a", "org-b", {}, `select * from ${qid(schema)}.tenant_records`);
  assert.equal(visible.rowCount, 0);

  await assert.rejects(
    contextQuery("identity-a", "org-b", {}, `insert into ${qid(schema)}.tenant_records(organization_id, payload) values ('org-b', 'revoked-write')`),
    (error: any) => error?.code === "42501",
  );
});

test("suspended identity denies access even with an active membership row", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const visible = await contextQuery("identity-suspended", "org-a", {}, `select * from ${qid(schema)}.tenant_records`);
  assert.equal(visible.rowCount, 0);

  await assert.rejects(
    contextQuery("identity-suspended", "org-a", {}, `insert into ${qid(schema)}.tenant_records(organization_id, payload) values ('org-a', 'suspended-write')`),
    (error: any) => error?.code === "42501",
  );
});

test("pooled connection context is transaction-local and resets between tenants", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const first = await contextQuery("identity-a", "org-a", {}, `select current_setting('app.rupaykg.organization_id', true) as organization_id`);
  assert.equal(first.rows[0]?.organization_id, "org-a");

  const second = await contextQuery("identity-b", "org-b", {}, `select current_setting('app.rupaykg.organization_id', true) as organization_id`);
  assert.equal(second.rows[0]?.organization_id, "org-b");

  const outside = await query(`select current_setting('app.rupaykg.organization_id', true) as organization_id, current_setting('app.rupaykg.identity_id', true) as identity_id`);
  assert.equal(outside.rows[0]?.organization_id, "");
  assert.equal(outside.rows[0]?.identity_id, "");
});

test("bilateral scope exposes both sides only when explicitly enabled", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const disabled = await contextQuery("identity-a", "org-a", { bilateral: false }, `select payload from ${qid(schema)}.bilateral_records order by id`);
  assert.deepEqual(disabled.rows, []);

  const enabled = await contextQuery("identity-a", "org-a", { bilateral: true }, `select payload from ${qid(schema)}.bilateral_records order by id`);
  assert.deepEqual(enabled.rows, [{ payload: "a-b-row" }]);

  const orgB = await contextQuery("identity-b", "org-b", { bilateral: true }, `select payload from ${qid(schema)}.bilateral_records order by id`);
  assert.deepEqual(orgB.rows, [{ payload: "a-b-row" }, { payload: "b-c-row" }]);
});

test("explicit service mode is the only disposable policy exception", { skip: !integrationEnabled || !databaseUrl }, async () => {
  const serviceVisible = await contextQuery("service-identity", undefined, { serviceMode: true }, `select count(*)::int as count from ${qid(schema)}.tenant_records`);
  assert.equal(serviceVisible.rows[0]?.count, 2);

  await contextQuery("service-identity", undefined, { serviceMode: true }, `
    insert into ${qid(schema)}.tenant_records(organization_id, payload)
    values ('org-b', 'service-write')
  `);

  const count = await contextQuery("identity-b", "org-b", {}, `select count(*)::int as count from ${qid(schema)}.tenant_records`);
  assert.equal(count.rows[0]?.count, 2);
});
