import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { createSignedRequestContextToken } from "./signed-request-context-token.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("EPR returns RLS isolates two organizations and fails closed without a valid signed context", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const secret = "ci-epr-tenant-rls-secret-material-at-least-32-bytes";
  const keyId = "epr_ci";
  const actorId = "d1000000-0000-4000-8000-000000000001";
  const organizationA = "d2000000-0000-4000-8000-000000000001";
  const organizationB = "d2000000-0000-4000-8000-000000000002";
  const returnA = "d3000000-0000-4000-8000-000000000001";
  const returnB = "d3000000-0000-4000-8000-000000000002";

  try {
    await client.query("BEGIN");
    await client.query(
      `insert into app_security.request_context_keys(key_id,secret,active)
       values($1,$2,true)
       on conflict(key_id) do update set secret=excluded.secret,active=true`,
      [keyId, secret],
    );
    await client.query(
      `insert into public.organizations(id,name,organization_type)
       values($1,'EPR RLS CI Tenant A','PRODUCER'),($2,'EPR RLS CI Tenant B','PRODUCER')
       on conflict(id) do nothing`,
      [organizationA, organizationB],
    );
    const scheme = await client.query<{ id: string }>(
      "select id from public.epr_schemes where code='PLASTIC_PACKAGING' and status='VERIFIED' limit 1",
    );
    assert.ok(scheme.rows[0]?.id, "verified PLASTIC_PACKAGING scheme fixture must exist");
    await client.query(
      `insert into public.epr_returns(id,scheme_id,organization_id,period_start,period_end,return_type,reported_quantity)
       values
         ($1,$3,$4,date '2098-01-01',date '2098-12-31','ANNUAL',10),
         ($2,$3,$5,date '2098-01-01',date '2098-12-31','ANNUAL',20)
       on conflict(id) do nothing`,
      [returnA, returnB, scheme.rows[0]!.id, organizationA, organizationB],
    );

    await client.query(
      `insert into public.identities(id,external_subject,display_name,status)
       values($1,$2,'EPR RLS CI Actor','VERIFIED')
       on conflict(id) do nothing`,
      [actorId, 'epr-rls-actor'],
    );
    await client.query(
      "update public.organizations set verification_status='VERIFIED',verified_by_identity_id=$2,verified_at=clock_timestamp() where id=any($1::uuid[]) and verification_status is distinct from 'VERIFIED'",
      [[organizationA, organizationB], actorId],
    );
    const permissionRole = await client.query<{ id: string }>(
      `insert into public.roles(organization_id,name,permissions,geography_scope)
       values($1,'epr_reader','["epr:read"]'::jsonb,'[]'::jsonb) returning id`,
      [organizationA],
    );
    await client.query("ALTER TABLE public.organization_memberships DISABLE TRIGGER stakeholder_membership_application_guard");
    await client.query(
      `insert into public.organization_memberships(identity_id,organization_id,role_id,status)
       values($1,$2,$3,'VERIFIED')`,
      [actorId, organizationA, permissionRole.rows[0]!.id],
    );
    await client.query("ALTER TABLE public.organization_memberships ENABLE TRIGGER stakeholder_membership_application_guard");

    await client.query("SET LOCAL ROLE rupaykg_app_runtime");
    const tokenA = createSignedRequestContextToken(
      { actorIdentityId: actorId, organizationId: organizationA },
      { secret, keyId, ttlSeconds: 60 },
    );
    await client.query("select set_config('app.request_context',$1,true)", [tokenA]);
    const allowedPermission = await client.query<{ allowed: boolean }>(
      "select auth_private.has_organization_permission($1,$2,$3::text[]) as allowed",
      [actorId, organizationA, ["epr:read"]],
    );
    assert.equal(allowedPermission.rows[0]?.allowed, true, "exact app runtime must execute the signed same-tenant permission helper");
    const mismatchedOrganization = await client.query<{ allowed: boolean }>(
      "select auth_private.has_organization_permission($1,$2,$3::text[]) as allowed",
      [actorId, organizationB, ["epr:read"]],
    );
    assert.equal(mismatchedOrganization.rows[0]?.allowed, false, "the helper must reject an organization argument different from the signed claim");
    const visibleA = await client.query<{ id: string; organization_id: string }>(
      "select id,organization_id from public.epr_returns where id = any($1::uuid[]) order by id",
      [[returnA, returnB]],
    );
    assert.deepEqual(visibleA.rows.map((row) => row.id), [returnA]);
    assert.ok(visibleA.rows.every((row) => row.organization_id === organizationA));

    const tokenB = createSignedRequestContextToken(
      { actorIdentityId: actorId, organizationId: organizationB },
      { secret, keyId, ttlSeconds: 60 },
    );
    await client.query("select set_config('app.request_context',$1,true)", [tokenB]);
    const visibleB = await client.query<{ id: string; organization_id: string }>(
      "select id,organization_id from public.epr_returns where id = any($1::uuid[]) order by id",
      [[returnA, returnB]],
    );
    assert.deepEqual(visibleB.rows.map((row) => row.id), [returnB]);
    assert.ok(visibleB.rows.every((row) => row.organization_id === organizationB));

    await client.query("select set_config('app.request_context','',true)");
    const withoutContext = await client.query<{ count: string }>(
      "select count(*)::text as count from public.epr_returns where id = any($1::uuid[])",
      [[returnA, returnB]],
    );
    assert.equal(withoutContext.rows[0]?.count, "0");

    await client.query("select set_config('app.request_context',$1,true)", ["forged.context"]);
    const forged = await client.query<{ count: string }>(
      "select count(*)::text as count from public.epr_returns where id = any($1::uuid[])",
      [[returnA, returnB]],
    );
    assert.equal(forged.rows[0]?.count, "0");

    const privileges = await client.query<{
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
      can_truncate: boolean;
      can_reference: boolean;
      can_trigger: boolean;
      can_scheme_insert: boolean;
      can_scheme_update: boolean;
      can_scheme_delete: boolean;
      can_scheme_truncate: boolean;
      can_scheme_reference: boolean;
      can_scheme_trigger: boolean;
      can_read_signing_keys: boolean;
      can_insert_signing_keys: boolean;
      can_update_signing_keys: boolean;
      can_delete_signing_keys: boolean;
      can_truncate_signing_keys: boolean;
      can_reference_signing_keys: boolean;
      can_trigger_signing_keys: boolean;
      can_create_security_schema: boolean;
    }>(
      `select
         has_table_privilege(current_user,'public.epr_returns','INSERT') as can_insert,
         has_table_privilege(current_user,'public.epr_returns','UPDATE') as can_update,
         has_table_privilege(current_user,'public.epr_returns','DELETE') as can_delete,
         has_table_privilege(current_user,'public.epr_returns','TRUNCATE') as can_truncate,
         has_table_privilege(current_user,'public.epr_returns','REFERENCES') as can_reference,
         has_table_privilege(current_user,'public.epr_returns','TRIGGER') as can_trigger,
         has_table_privilege(current_user,'public.epr_schemes','INSERT') as can_scheme_insert,
         has_table_privilege(current_user,'public.epr_schemes','UPDATE') as can_scheme_update,
         has_table_privilege(current_user,'public.epr_schemes','DELETE') as can_scheme_delete,
         has_table_privilege(current_user,'public.epr_schemes','TRUNCATE') as can_scheme_truncate,
         has_table_privilege(current_user,'public.epr_schemes','REFERENCES') as can_scheme_reference,
         has_table_privilege(current_user,'public.epr_schemes','TRIGGER') as can_scheme_trigger,
         has_table_privilege(current_user,'app_security.request_context_keys','SELECT') as can_read_signing_keys,
         has_table_privilege(current_user,'app_security.request_context_keys','INSERT') as can_insert_signing_keys,
         has_table_privilege(current_user,'app_security.request_context_keys','UPDATE') as can_update_signing_keys,
         has_table_privilege(current_user,'app_security.request_context_keys','DELETE') as can_delete_signing_keys,
         has_table_privilege(current_user,'app_security.request_context_keys','TRUNCATE') as can_truncate_signing_keys,
         has_table_privilege(current_user,'app_security.request_context_keys','REFERENCES') as can_reference_signing_keys,
         has_table_privilege(current_user,'app_security.request_context_keys','TRIGGER') as can_trigger_signing_keys,
         has_schema_privilege(current_user,'app_security','CREATE') as can_create_security_schema`,
    );
    assert.deepEqual(privileges.rows[0], {
      can_insert: false,
      can_update: false,
      can_delete: false,
      can_truncate: false,
      can_reference: false,
      can_trigger: false,
      can_scheme_insert: false,
      can_scheme_update: false,
      can_scheme_delete: false,
      can_scheme_truncate: false,
      can_scheme_reference: false,
      can_scheme_trigger: false,
      can_read_signing_keys: false,
      can_insert_signing_keys: false,
      can_update_signing_keys: false,
      can_delete_signing_keys: false,
      can_truncate_signing_keys: false,
      can_reference_signing_keys: false,
      can_trigger_signing_keys: false,
      can_create_security_schema: false,
    });

    const expectPermissionDenied = async (sql: string, values: unknown[] = []) => {
      await client.query("SAVEPOINT epr_privilege_check");
      try {
        await assert.rejects(client.query(sql, values), /permission denied/i);
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT epr_privilege_check");
        await client.query("RELEASE SAVEPOINT epr_privilege_check");
      }
    };

    await expectPermissionDenied(
      `insert into public.epr_returns
        (id,scheme_id,organization_id,period_start,period_end,return_type,reported_quantity)
       values($1,$2,$3,date '2099-01-01',date '2099-12-31','ANNUAL',1)`,
      ["d3000000-0000-4000-8000-000000000003", scheme.rows[0]!.id, organizationA],
    );
    await expectPermissionDenied(
      "update public.epr_returns set reported_quantity=99 where id=$1",
      [returnA],
    );
    await expectPermissionDenied(
      "delete from public.epr_returns where id=$1",
      [returnA],
    );
    await expectPermissionDenied("select * from app_security.request_context_keys");
    await expectPermissionDenied("select * from public.organization_memberships");
    await expectPermissionDenied("select * from public.roles");

    await client.query("ROLLBACK");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
