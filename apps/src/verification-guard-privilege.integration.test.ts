import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("verification SECURITY DEFINER guard runs under a NOLOGIN non-owner role with FORCE RLS", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  const suffix = randomBytes(5).toString("hex");
  const schema = "guard_proto_" + suffix;
  const guardRole = "guard_proto_" + suffix;
  const apiRole = "api_proto_" + suffix;
  const q = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  const s = q(schema);
  const guard = q(guardRole);
  const api = q(apiRole);
  let createdGuard = false;
  let createdApi = false;

  try {
    await pool.query(`create role ${guard} nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication`);
    createdGuard = true;
    await pool.query(`create role ${api} nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication`);
    createdApi = true;
    await pool.query(`create schema ${s}`);
    await pool.query(`grant usage on schema ${s} to ${guard}, ${api}`);

    await pool.query(`create table ${s}.geography(id uuid primary key, parent_id uuid)`);
    await pool.query(`create table ${s}.organization_geography_scopes(organization_id uuid not null, geography_id uuid not null, status text not null)`);
    await pool.query(`create table ${s}.identities(id uuid primary key, status text not null, suspended_at timestamptz)`);
    await pool.query(`create table ${s}.roles(id uuid primary key, organization_id uuid not null, permissions jsonb not null)`);
    await pool.query(`create table ${s}.organization_memberships(id uuid primary key, identity_id uuid not null, organization_id uuid not null, role_id uuid not null, status text not null, created_at timestamptz not null default now())`);
    await pool.query(`create table ${s}.activities(id uuid primary key, organization_id uuid not null, geography_id uuid not null, actor_identity_id uuid)`);
    await pool.query(`create table ${s}.evidence(id uuid primary key, activity_id uuid not null)`);
    await pool.query(`create table ${s}.verifications(id uuid primary key default gen_random_uuid(), evidence_id uuid not null, activity_id uuid, verifier_identity_id uuid not null, decision text not null, authorization_membership_id uuid, authorization_role_id uuid, authorization_permissions_snapshot jsonb, authorization_checked_at timestamptz)`);

    await pool.query(`
      create or replace function ${s}.organization_has_geography_scope(p_org uuid, p_geo uuid)
      returns boolean language sql stable security invoker
      set search_path = pg_catalog, ${schema}
      as $scope$
        with recursive ancestors(id) as (
          select g.id from ${s}.geography g where g.id = p_geo
          union all
          select g.parent_id from ${s}.geography g join ancestors a on g.id = a.id where g.parent_id is not null
        )
        select case
          when not exists (select 1 from ${s}.organization_geography_scopes x where x.organization_id=p_org and x.status='VERIFIED') then true
          else exists (
            select 1 from ${s}.organization_geography_scopes x
            join ancestors a on a.id=x.geography_id
            where x.organization_id=p_org and x.status='VERIFIED'
          )
        end
      $scope$
    `);

    const rlsTables = ["organization_geography_scopes", "identities", "roles", "organization_memberships", "activities", "evidence"];
    for (const table of rlsTables) {
      await pool.query(`alter table ${s}.${q(table)} enable row level security`);
      await pool.query(`alter table ${s}.${q(table)} force row level security`);
    }
    await pool.query(`create policy guard_geo_scope on ${s}.organization_geography_scopes for select to ${guard} using (organization_id = nullif(current_setting('rupaykg_guard.organization_id', true), '')::uuid)`);
    await pool.query(`create policy guard_identity on ${s}.identities for select to ${guard} using (id = nullif(current_setting('rupaykg_guard.identity_id', true), '')::uuid)`);
    await pool.query(`create policy guard_roles on ${s}.roles for select to ${guard} using (organization_id = nullif(current_setting('rupaykg_guard.organization_id', true), '')::uuid)`);
    await pool.query(`create policy guard_memberships on ${s}.organization_memberships for select to ${guard} using (identity_id = nullif(current_setting('rupaykg_guard.identity_id', true), '')::uuid and organization_id = nullif(current_setting('rupaykg_guard.organization_id', true), '')::uuid)`);
    await pool.query(`create policy guard_activities on ${s}.activities for select to ${guard} using (id = nullif(current_setting('rupaykg_guard.activity_id', true), '')::uuid)`);
    await pool.query(`create policy guard_evidence on ${s}.evidence for select to ${guard} using (id = nullif(current_setting('rupaykg_guard.evidence_id', true), '')::uuid)`);

    await pool.query(`grant select on ${s}.geography, ${s}.organization_geography_scopes, ${s}.identities, ${s}.roles, ${s}.organization_memberships, ${s}.activities, ${s}.evidence to ${guard}`);
    for (const table of ["identities", "roles", "organization_memberships", "activities", "evidence"]) {
      await pool.query(`grant update(id) on ${s}.${q(table)} to ${guard}`);
    }
    await pool.query(`grant execute on function ${s}.organization_has_geography_scope(uuid,uuid) to ${guard}`);

    const functionSql = `
      create function ${s}.enforce_verification_authorization()
      returns trigger
      language plpgsql
      security definer
      set search_path = pg_catalog, ${schema}
      set row_security = on
      as $guard_fn$
      declare
        v_activity_id uuid;
        v_org_id uuid;
        v_geo_id uuid;
        v_actor_id uuid;
        v_membership_id uuid;
        v_role_id uuid;
        v_permissions jsonb;
        v_old_evidence text := current_setting('rupaykg_guard.evidence_id', true);
        v_old_activity text := current_setting('rupaykg_guard.activity_id', true);
        v_old_identity text := current_setting('rupaykg_guard.identity_id', true);
        v_old_org text := current_setting('rupaykg_guard.organization_id', true);
      begin
        if tg_op = 'UPDATE' then
          raise exception 'verification records are immutable';
        end if;
        begin
          perform set_config('rupaykg_guard.evidence_id', new.evidence_id::text, true);
          select e.activity_id into v_activity_id
            from ${s}.evidence e where e.id = new.evidence_id for share;
          if v_activity_id is null then
            raise exception 'verification evidence must be bound to an activity';
          end if;
          if new.activity_id is not null and new.activity_id is distinct from v_activity_id then
            raise exception 'verification activity must match evidence activity';
          end if;
          new.activity_id := v_activity_id;
          perform set_config('rupaykg_guard.activity_id', v_activity_id::text, true);
          select a.organization_id, a.geography_id, a.actor_identity_id
            into v_org_id, v_geo_id, v_actor_id
            from ${s}.activities a where a.id = v_activity_id for share;
          if v_org_id is null or v_geo_id is null then
            raise exception 'verification requires organization and geography';
          end if;
          perform set_config('rupaykg_guard.organization_id', v_org_id::text, true);
          perform set_config('rupaykg_guard.identity_id', new.verifier_identity_id::text, true);
          if not ${s}.organization_has_geography_scope(v_org_id, v_geo_id) then
            raise exception 'verification geography is outside organization scope';
          end if;
          if v_actor_id is not null and v_actor_id = new.verifier_identity_id then
            raise exception 'activity actor cannot verify own evidence';
          end if;
          select m.id, m.role_id, r.permissions
            into v_membership_id, v_role_id, v_permissions
            from ${s}.organization_memberships m
            join ${s}.roles r on r.id=m.role_id and r.organization_id=m.organization_id
            join ${s}.identities i on i.id=m.identity_id
           where m.identity_id=new.verifier_identity_id
             and m.organization_id=v_org_id
             and m.status='VERIFIED'
             and i.status='VERIFIED'
             and i.suspended_at is null
             and (
               r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
               or r.permissions @> '["verification:approve"]'::jsonb
               or r.permissions @> '["verification.approve"]'::jsonb
             )
           order by m.created_at desc, m.id desc
           limit 1
           for share of m, r, i;
          if v_membership_id is null then
            raise exception 'verification requires active explicit verifier permission';
          end if;
          new.authorization_membership_id := v_membership_id;
          new.authorization_role_id := v_role_id;
          new.authorization_permissions_snapshot := v_permissions;
          new.authorization_checked_at := clock_timestamp();
          perform set_config('rupaykg_guard.evidence_id', coalesce(v_old_evidence, ''), true);
          perform set_config('rupaykg_guard.activity_id', coalesce(v_old_activity, ''), true);
          perform set_config('rupaykg_guard.identity_id', coalesce(v_old_identity, ''), true);
          perform set_config('rupaykg_guard.organization_id', coalesce(v_old_org, ''), true);
          return new;
        exception when others then
          perform set_config('rupaykg_guard.evidence_id', coalesce(v_old_evidence, ''), true);
          perform set_config('rupaykg_guard.activity_id', coalesce(v_old_activity, ''), true);
          perform set_config('rupaykg_guard.identity_id', coalesce(v_old_identity, ''), true);
          perform set_config('rupaykg_guard.organization_id', coalesce(v_old_org, ''), true);
          raise;
        end;
      end;
      $guard_fn$
    `;
    await pool.query(functionSql);
    await pool.query(`grant create on schema ${s} to ${guard}`);
    await pool.query(`alter function ${s}.enforce_verification_authorization() owner to ${guard}`);
    await pool.query(`revoke create on schema ${s} from ${guard}`);
    await pool.query(`revoke all on function ${s}.enforce_verification_authorization() from public, ${api}`);
    await pool.query(`create trigger verification_guard before insert or update on ${s}.verifications for each row execute function ${s}.enforce_verification_authorization()`);
    await pool.query(`grant insert, select on ${s}.verifications to ${api}`);

    const orgA = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const orgB = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const geoA = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const geoB = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const identity = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const roleId = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const membership = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const activityA = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const activityB = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const evidenceA = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const evidenceB = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const selfActivity = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const selfEvidence = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const scopeActivity = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const scopeEvidence = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const suspendedIdentity = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const suspendedRole = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const suspendedMembership = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const suspendedActivity = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");
    const suspendedEvidence = randomBytes(16).toString("hex").match(/.{1,8}/g)!.join("-");

    await pool.query(`insert into ${s}.geography(id) values ($1),($2)`, [geoA, geoB]);
    await pool.query(`insert into ${s}.organization_geography_scopes(organization_id,geography_id,status) values ($1,$2,'VERIFIED')`, [orgA, geoA]);
    await pool.query(`insert into ${s}.identities(id,status) values ($1,'VERIFIED'),($2,'SUSPENDED')`, [identity, suspendedIdentity]);
    await pool.query(`insert into ${s}.roles(id,organization_id,permissions) values ($1,$2,'["VERIFY_EVIDENCE"]'::jsonb),($3,$2,'["VERIFY_EVIDENCE"]'::jsonb)`, [roleId, orgA, suspendedRole]);
    await pool.query(`insert into ${s}.organization_memberships(id,identity_id,organization_id,role_id,status) values ($1,$2,$3,$4,'VERIFIED'),($5,$6,$3,$7,'VERIFIED')`, [membership, identity, orgA, roleId, suspendedMembership, suspendedIdentity, suspendedRole]);
    await pool.query(`insert into ${s}.activities(id,organization_id,geography_id,actor_identity_id) values ($1,$2,$3,null),($4,$5,$6,null),($7,$2,$3,$8),($9,$2,$10,null),($11,$2,$3,null)`, [activityA, orgA, geoA, activityB, orgB, geoA, selfActivity, identity, scopeActivity, geoB, suspendedActivity]);
    await pool.query(`insert into ${s}.evidence(id,activity_id) values ($1,$2),($3,$4),($5,$6),($7,$8),($9,$10)`, [evidenceA, activityA, evidenceB, activityB, selfEvidence, selfActivity, scopeEvidence, scopeActivity, suspendedEvidence, suspendedActivity]);

    const roleMeta = await pool.query<{ rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean; owner: string; api_execute: boolean }>(
      `select r.rolcanlogin, r.rolsuper, r.rolbypassrls,
              pg_get_userbyid(p.proowner) as owner,
              has_function_privilege($2, p.oid, 'EXECUTE') as api_execute
         from pg_roles r
         join pg_proc p on p.proname='enforce_verification_authorization'
         join pg_namespace n on n.oid=p.pronamespace and n.nspname=$1
        where r.rolname=$3`,
      [schema, apiRole, guardRole],
    );
    assert.equal(roleMeta.rows[0]?.rolcanlogin, false);
    assert.equal(roleMeta.rows[0]?.rolsuper, false);
    assert.equal(roleMeta.rows[0]?.rolbypassrls, false);
    assert.equal(roleMeta.rows[0]?.owner, guardRole);
    assert.equal(roleMeta.rows[0]?.api_execute, false);

    const guardCheck = await pool.connect();
    try {
      await guardCheck.query("begin");
      await guardCheck.query(`set local role ${guard}`);
      const noContext = await guardCheck.query(`select count(*)::int as n from ${s}.evidence`);
      assert.equal(noContext.rows[0]!.n, 0, "FORCE RLS must hide all evidence when guard context is absent");
      await guardCheck.query("select set_config('rupaykg_guard.evidence_id',$1,true)", [evidenceA]);
      await guardCheck.query("select set_config('rupaykg_guard.activity_id',$1,true)", [activityA]);
      await guardCheck.query("select set_config('rupaykg_guard.organization_id',$1,true)", [orgA]);
      await guardCheck.query("select set_config('rupaykg_guard.identity_id',$1,true)", [identity]);
      const visible = await guardCheck.query(`select id from ${s}.evidence where id=$1 for share`, [evidenceA]);
      assert.equal(visible.rowCount, 1, "column-limited UPDATE(id) must permit the trigger's FOR SHARE lock");
      const mutation = await guardCheck.query(`update ${s}.evidence set id=id where id=$1 returning id`, [evidenceA]);
      assert.equal(mutation.rowCount, 0, "without an UPDATE RLS policy the guard's technical column grant must not authorize mutation");
      const hiddenOther = await guardCheck.query(`select count(*)::int as n from ${s}.evidence where id=$1`, [evidenceB]);
      assert.equal(hiddenOther.rows[0]!.n, 0, "guard context must not expose another tenant's evidence");
      const memberships = await guardCheck.query(`select count(*)::int as n from ${s}.organization_memberships`);
      assert.equal(memberships.rows[0]!.n, 1, "guard context must expose only the selected identity's membership in the selected organization");
      await guardCheck.query("commit");
    } finally {
      await guardCheck.query("rollback").catch(() => undefined);
      guardCheck.release();
    }

    const apiClient = await pool.connect();
    try {
      await apiClient.query(`set role ${api}`);
      await assert.rejects(apiClient.query(`set role ${guard}`), /permission denied to set role/);
      await assert.rejects(apiClient.query(`select * from ${s}.evidence`), /permission denied/);
      const allowed = await apiClient.query<{ authorization_membership_id: string; authorization_role_id: string; authorization_permissions_snapshot: string[] }>(
        `insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'APPROVED') returning authorization_membership_id,authorization_role_id,authorization_permissions_snapshot`,
        [evidenceA, identity],
      );
      assert.equal(allowed.rows[0]?.authorization_membership_id, membership);
      assert.equal(allowed.rows[0]?.authorization_role_id, roleId);
      assert.deepEqual(allowed.rows[0]?.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
      await assert.rejects(
        apiClient.query(`insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`, [evidenceB, identity]),
        /verification requires active explicit verifier permission/,
      );
      await assert.rejects(
        apiClient.query(`insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`, [selfEvidence, identity]),
        /activity actor cannot verify own evidence/,
      );
      await assert.rejects(
        apiClient.query(`insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`, [scopeEvidence, identity]),
        /verification geography is outside organization scope/,
      );
      await assert.rejects(
        apiClient.query(`insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`, [suspendedEvidence, suspendedIdentity]),
        /verification requires active explicit verifier permission/,
      );
      await assert.rejects(apiClient.query(`update ${s}.verifications set decision='REJECTED'`), /permission denied/);
      await assert.rejects(apiClient.query(`delete from ${s}.verifications`), /permission denied/);
    } finally {
      await apiClient.query("reset role").catch(() => undefined);
      apiClient.release();
    }
    await assert.rejects(pool.query(`update ${s}.verifications set decision='REJECTED'`), /verification records are immutable/);

    // Revocation race through the actual non-owner API role. The guard's row
    // lock must serialize the decision after the role permission update.
    const revoker = await pool.connect();
    const apiRace = await pool.connect();
    let committed = false;
    try {
      await revoker.query("begin");
      await revoker.query(`update ${s}.roles set permissions='[]'::jsonb where id=$1`, [roleId]);
      await apiRace.query(`set role ${api}`);
      const pid = (await apiRace.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
      const pending = apiRace.query(
        `insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`,
        [evidenceA, identity],
      ).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
      let waiting = false;
      for (let i = 0; i < 200; i++) {
        const state = await pool.query<{ wait_event_type: string | null }>("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
        if (state.rows[0]?.wait_event_type === "Lock") { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, "API verification must wait for the concurrent role permission revocation");
      await revoker.query("commit");
      committed = true;
      const outcome = await pending;
      assert.equal(outcome.ok, false);
      if (!outcome.ok) assert.match(outcome.error instanceof Error ? outcome.error.message : String(outcome.error), /verification requires active explicit verifier permission/);
    } finally {
      if (!committed) await revoker.query("rollback").catch(() => undefined);
      await apiRace.query("reset role").catch(() => undefined);
      revoker.release();
      apiRace.release();
    }
  } finally {
    await pool.query(`drop schema if exists ${s} cascade`).catch(() => undefined);
    if (createdApi) await pool.query(`drop role if exists ${api}`).catch(() => undefined);
    if (createdGuard) await pool.query(`drop role if exists ${guard}`).catch(() => undefined);
    await pool.end();
  }
});
