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
  const apiPassword = randomBytes(24).toString("hex");
  let apiPool: Pool | undefined;
  const uuid = () => { const hex = randomBytes(16).toString("hex"); return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-"); };
  const q = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  const s = q(schema);
  const guard = q(guardRole);
  const api = q(apiRole);
  let createdGuard = false;
  let createdApi = false;

  try {
    await pool.query(`create role ${guard} nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication`);
    createdGuard = true;
    await pool.query(`create role ${api} login nosuperuser nobypassrls nocreatedb nocreaterole noreplication password '${apiPassword}'`);
    createdApi = true;
    await pool.query(`create schema ${s}`);
    await pool.query(`grant usage on schema ${s} to ${guard}, ${api}`);

    await pool.query(`create table ${s}.geography(id uuid primary key, parent_id uuid)`);
    await pool.query(`create table ${s}.organization_geography_scopes(id uuid primary key, organization_id uuid not null, geography_id uuid not null, status text not null)`);
    await pool.query(`create table ${s}.identities(id uuid primary key, status text not null, suspended_at timestamptz)`);
    await pool.query(`create table ${s}.roles(id uuid primary key, organization_id uuid not null, permissions jsonb not null)`);
    await pool.query(`create table ${s}.organization_memberships(id uuid primary key, identity_id uuid not null, organization_id uuid not null, role_id uuid not null, status text not null, created_at timestamptz not null default now())`);
    await pool.query(`create table ${s}.activities(id uuid primary key, organization_id uuid not null, geography_id uuid not null, actor_identity_id uuid)`);
    await pool.query(`create table ${s}.evidence(id uuid primary key, activity_id uuid not null)`);
    await pool.query(`create table ${s}.verifications(id uuid primary key default gen_random_uuid(), evidence_id uuid not null, activity_id uuid, verifier_identity_id uuid not null, decision text not null, authorization_membership_id uuid, authorization_role_id uuid, authorization_permissions_snapshot jsonb, authorization_checked_at timestamptz)`);

    await pool.query(`
      create or replace function ${s}.organization_has_geography_scope(p_org uuid, p_geo uuid)
      returns boolean language plpgsql volatile security invoker
      set search_path = pg_catalog, ${schema}, pg_temp
      as $scope$
      declare
        v_scope record;
        v_scope_count integer := 0;
        v_matches boolean := false;
        v_is_ancestor boolean := false;
        v_old_scope text := current_setting('rupaykg_guard.scope_id', true);
      begin
        -- Lock all currently verified organization scopes before deciding.
        -- A concurrent revocation waits, then the row is re-evaluated.
        for v_scope in
          select x.id, x.geography_id
            from ${s}.organization_geography_scopes x
           where x.organization_id=p_org and x.status='VERIFIED'
           order by x.id
        loop
          v_scope_count := v_scope_count + 1;
          perform set_config('rupaykg_guard.scope_id', v_scope.id::text, true);
          perform 1 from ${s}.organization_geography_scopes x
           where x.id=v_scope.id and x.organization_id=p_org and x.status='VERIFIED'
           for share;
          if found then
            with recursive ancestors(id) as (
              select g.id from ${s}.geography g where g.id = p_geo
              union all
              select g.parent_id from ${s}.geography g join ancestors a on g.id = a.id where g.parent_id is not null
            )
            select exists(select 1 from ancestors where id=v_scope.geography_id) into v_is_ancestor;
            v_matches := v_matches or v_is_ancestor;
          end if;
        end loop;
        perform set_config('rupaykg_guard.scope_id', coalesce(v_old_scope, ''), true);
        -- No verified scope is not unrestricted access.
        return v_scope_count > 0 and v_matches;
      exception when others then
        perform set_config('rupaykg_guard.scope_id', coalesce(v_old_scope, ''), true);
        raise;
      end;
      $scope$
    `);

    const rlsTables = ["organization_geography_scopes", "identities", "roles", "organization_memberships", "activities", "evidence"];
    for (const table of rlsTables) {
      await pool.query(`alter table ${s}.${q(table)} enable row level security`);
      await pool.query(`alter table ${s}.${q(table)} force row level security`);
    }
    await pool.query(`create policy guard_geo_scope on ${s}.organization_geography_scopes for select to ${guard} using (organization_id = nullif(current_setting('rupaykg_guard.organization_id', true), '')::uuid)`);
    await pool.query(`create policy guard_geo_scope_lock on ${s}.organization_geography_scopes for update to ${guard} using (id = nullif(current_setting('rupaykg_guard.scope_id', true), '')::uuid) with check (id = nullif(current_setting('rupaykg_guard.scope_id', true), '')::uuid)`);
    await pool.query(`create policy guard_identity_read on ${s}.identities for select to ${guard} using (id = nullif(current_setting('rupaykg_guard.identity_id', true), '')::uuid)`);
    await pool.query(`create policy guard_identity_lock on ${s}.identities for update to ${guard} using (id = nullif(current_setting('rupaykg_guard.identity_id', true), '')::uuid) with check (id = nullif(current_setting('rupaykg_guard.identity_id', true), '')::uuid)`);
    await pool.query(`create policy guard_roles_read on ${s}.roles for select to ${guard} using (organization_id = nullif(current_setting('rupaykg_guard.organization_id', true), '')::uuid)`);
    await pool.query(`create policy guard_roles_lock on ${s}.roles for update to ${guard} using (id = nullif(current_setting('rupaykg_guard.role_id', true), '')::uuid) with check (id = nullif(current_setting('rupaykg_guard.role_id', true), '')::uuid)`);
    await pool.query(`create policy guard_memberships_read on ${s}.organization_memberships for select to ${guard} using (identity_id = nullif(current_setting('rupaykg_guard.identity_id', true), '')::uuid and organization_id = nullif(current_setting('rupaykg_guard.organization_id', true), '')::uuid)`);
    await pool.query(`create policy guard_memberships_lock on ${s}.organization_memberships for update to ${guard} using (id = nullif(current_setting('rupaykg_guard.membership_id', true), '')::uuid) with check (id = nullif(current_setting('rupaykg_guard.membership_id', true), '')::uuid)`);
    await pool.query(`create policy guard_activities_read on ${s}.activities for select to ${guard} using (id = nullif(current_setting('rupaykg_guard.activity_id', true), '')::uuid)`);
    await pool.query(`create policy guard_activities_lock on ${s}.activities for update to ${guard} using (id = nullif(current_setting('rupaykg_guard.activity_id', true), '')::uuid) with check (id = nullif(current_setting('rupaykg_guard.activity_id', true), '')::uuid)`);
    await pool.query(`create policy guard_evidence_read on ${s}.evidence for select to ${guard} using (id = nullif(current_setting('rupaykg_guard.evidence_id', true), '')::uuid)`);
    await pool.query(`create policy guard_evidence_lock on ${s}.evidence for update to ${guard} using (id = nullif(current_setting('rupaykg_guard.evidence_id', true), '')::uuid) with check (id = nullif(current_setting('rupaykg_guard.evidence_id', true), '')::uuid)`);

    await pool.query(`grant select on ${s}.geography, ${s}.organization_geography_scopes, ${s}.identities, ${s}.roles, ${s}.organization_memberships, ${s}.activities, ${s}.evidence to ${guard}`);
    for (const table of ["organization_geography_scopes", "identities", "roles", "organization_memberships", "activities", "evidence"]) {
      await pool.query(`grant update(id) on ${s}.${q(table)} to ${guard}`);
    }
    await pool.query(`grant execute on function ${s}.organization_has_geography_scope(uuid,uuid) to ${guard}`);

    const functionSql = `
      create function ${s}.enforce_verification_authorization()
      returns trigger
      language plpgsql
      security definer
      set search_path = pg_catalog, ${schema}, pg_temp
      set row_security = on
      as $guard_fn$
      declare
        v_activity_id uuid;
        v_org_id uuid;
        v_geo_id uuid;
        v_actor_id uuid;
        v_identity_id uuid;
        v_membership_id uuid;
        v_role_id uuid;
        v_permissions jsonb;
        v_old_evidence text := current_setting('rupaykg_guard.evidence_id', true);
        v_old_activity text := current_setting('rupaykg_guard.activity_id', true);
        v_old_identity text := current_setting('rupaykg_guard.identity_id', true);
        v_old_org text := current_setting('rupaykg_guard.organization_id', true);
        v_old_membership text := current_setting('rupaykg_guard.membership_id', true);
        v_old_role text := current_setting('rupaykg_guard.role_id', true);
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
          select i.id into v_identity_id
            from ${s}.identities i
           where i.id=new.verifier_identity_id
             and i.status='VERIFIED'
             and i.suspended_at is null
           for share;
          if v_identity_id is null then
            raise exception 'verification requires an active non-suspended identity';
          end if;

          -- Resolve the membership without a lock, then lock that exact row.
          -- The UPDATE RLS policy is keyed to the exact membership id, so the
          -- technical UPDATE(id) grant cannot expose or mutate other rows.
          select m.id, m.role_id into v_membership_id, v_role_id
            from ${s}.organization_memberships m
           where m.identity_id=new.verifier_identity_id
             and m.organization_id=v_org_id
             and m.status='VERIFIED'
           order by m.created_at desc, m.id desc
           limit 1;
          if v_membership_id is null then
            raise exception 'verification requires active explicit verifier permission';
          end if;
          perform set_config('rupaykg_guard.membership_id', v_membership_id::text, true);
          select m.role_id into v_role_id
            from ${s}.organization_memberships m
           where m.id=v_membership_id
             and m.identity_id=new.verifier_identity_id
             and m.organization_id=v_org_id
             and m.status='VERIFIED'
           for share;
          if v_role_id is null then
            raise exception 'verification requires active explicit verifier permission';
          end if;

          -- Lock and re-read the exact organization role after membership lock.
          perform set_config('rupaykg_guard.role_id', v_role_id::text, true);
          select r.permissions into v_permissions
            from ${s}.roles r
           where r.id=v_role_id
             and r.organization_id=v_org_id
             and (
               r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
               or r.permissions @> '["verification:approve"]'::jsonb
               or r.permissions @> '["verification.approve"]'::jsonb
             )
           for share;
          if v_permissions is null then
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
          perform set_config('rupaykg_guard.membership_id', coalesce(v_old_membership, ''), true);
          perform set_config('rupaykg_guard.role_id', coalesce(v_old_role, ''), true);
          return new;
        exception when others then
          perform set_config('rupaykg_guard.evidence_id', coalesce(v_old_evidence, ''), true);
          perform set_config('rupaykg_guard.activity_id', coalesce(v_old_activity, ''), true);
          perform set_config('rupaykg_guard.identity_id', coalesce(v_old_identity, ''), true);
          perform set_config('rupaykg_guard.organization_id', coalesce(v_old_org, ''), true);
          perform set_config('rupaykg_guard.membership_id', coalesce(v_old_membership, ''), true);
          perform set_config('rupaykg_guard.role_id', coalesce(v_old_role, ''), true);
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
    await pool.query(`grant select on ${s}.evidence to ${api}`);
    const apiUrl = new URL(process.env.DATABASE_URL!);
    apiUrl.username = apiRole;
    apiUrl.password = apiPassword;
    apiPool = new Pool({ connectionString: apiUrl.toString(), max: 4, ssl: false });

    const orgA = uuid();
    const orgB = uuid();
    const geoA = uuid();
    const geoB = uuid();
    const scopeA = uuid();
    const scopeB = uuid();
    const identity = uuid();
    const roleId = uuid();
    const membership = uuid();
    const activityA = uuid();
    const activityB = uuid();
    const evidenceA = uuid();
    const evidenceB = uuid();
    const selfActivity = uuid();
    const selfEvidence = uuid();
    const scopeActivity = uuid();
    const scopeEvidence = uuid();
    const suspendedIdentity = uuid();
    const suspendedRole = uuid();
    const suspendedMembership = uuid();
    const suspendedActivity = uuid();
    const suspendedEvidence = uuid();

    await pool.query(`insert into ${s}.geography(id) values ($1),($2)`, [geoA, geoB]);
    await pool.query(`insert into ${s}.organization_geography_scopes(id,organization_id,geography_id,status) values ($1,$2,$3,'VERIFIED'),($4,$5,$3,'VERIFIED')`, [scopeA, orgA, geoA, scopeB, orgB]);
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
      await guardCheck.query("select set_config('rupaykg_guard.membership_id',$1,true)", [membership]);
      await guardCheck.query("select set_config('rupaykg_guard.role_id',$1,true)", [roleId]);
      await guardCheck.query("select set_config('rupaykg_guard.scope_id',$1,true)", [scopeA]);
      const visibleBeforeLock = await guardCheck.query(`select count(*)::int as n from ${s}.evidence where id=$1`, [evidenceA]);
      assert.equal(visibleBeforeLock.rows[0]!.n, 1, "SELECT policy must expose only the selected evidence row");
      for (const [table, rowId] of [["evidence", evidenceA], ["activities", activityA], ["identities", identity], ["organization_memberships", membership], ["roles", roleId], ["organization_geography_scopes", scopeA]] as const) {
        const locked = await guardCheck.query(`select id from ${s}.${q(table)} where id=$1 for share`, [rowId]);
        assert.equal(locked.rowCount, 1, `exact-row UPDATE RLS policy must permit FOR SHARE on ${table}`);
      }
      await guardCheck.query("savepoint deny_mutation");
      const mutation = await guardCheck.query<{ id: string }>(
        `update ${s}.evidence set id=$2 where id=$1 returning id`,
        [evidenceA, orgB],
      ).then(
        result => ({ rowCount: result.rowCount ?? 0, code: null as string | null }),
        error => ({ rowCount: 0, code: (error as { code?: string }).code ?? "UNKNOWN" }),
      );
      await guardCheck.query("rollback to savepoint deny_mutation");
      await guardCheck.query("release savepoint deny_mutation");
      assert.equal(mutation.rowCount, 0, "RLS must prevent the guard from changing the evidence identifier");
      if (mutation.code !== null) assert.equal(mutation.code, "42501");
      const unchanged = await guardCheck.query(`select id from ${s}.evidence where id=$1`, [evidenceA]);
      assert.equal(unchanged.rowCount, 1, "the exact evidence row must remain unchanged");
      const hiddenOther = await guardCheck.query(`select count(*)::int as n from ${s}.evidence where id=$1`, [evidenceB]);
      assert.equal(hiddenOther.rows[0]!.n, 0, "guard context must not expose another tenant's evidence");
      const memberships = await guardCheck.query(`select count(*)::int as n from ${s}.organization_memberships`);
      assert.equal(memberships.rows[0]!.n, 1, "guard context must expose only the selected identity's membership in the selected organization");
      await guardCheck.query("commit");
    } finally {
      await guardCheck.query("rollback").catch(() => undefined);
      guardCheck.release();
    }

    const apiClient = await apiPool!.connect();
    try {
      const loginIdentity = await apiClient.query<{ current_user: string }>("select current_user");
      assert.equal(loginIdentity.rows[0]?.current_user, apiRole, "requests must use the actual non-owner API login");
      await apiClient.query("select set_config('rupaykg_guard.evidence_id',$1,false)", [evidenceA]);
      const spoofedRead = await apiClient.query(`select count(*)::int as n from ${s}.evidence`);
      assert.equal(spoofedRead.rows[0]!.n, 0, "API-supplied guard GUCs must not bypass policies targeted only to the guard role");
      await assert.rejects(apiClient.query(`set role ${guard}`), /permission denied to set role/);
      const allowed = await apiClient.query<{ authorization_membership_id: string; authorization_role_id: string; authorization_permissions_snapshot: string[] }>(
        `insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'APPROVED') returning authorization_membership_id,authorization_role_id,authorization_permissions_snapshot`,
        [evidenceA, identity],
      );
      assert.equal(allowed.rows[0]?.authorization_membership_id, membership);
      assert.equal(allowed.rows[0]?.authorization_role_id, roleId);
      assert.deepEqual(allowed.rows[0]?.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
      const restoredGuc = await apiClient.query<{ value: string }>("select current_setting('rupaykg_guard.evidence_id', true) as value");
      assert.equal(restoredGuc.rows[0]?.value, evidenceA, "the trigger must restore caller GUC state after its scoped checks");
      const stillHidden = await apiClient.query(`select count(*)::int as n from ${s}.evidence`);
      assert.equal(stillHidden.rows[0]!.n, 0, "restored caller GUC must not reveal evidence to the API role");
      await assert.rejects(
        apiClient.query(`insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`, [evidenceB, identity]),
        /verification requires active explicit verifier permission/,
      );
      await pool.query(`update ${s}.organization_geography_scopes set status='PENDING' where organization_id=$1`, [orgB]);
      await assert.rejects(
        apiClient.query(`insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`, [evidenceB, identity]),
        /verification geography is outside organization scope/,
      );
      await pool.query(`update ${s}.organization_geography_scopes set status='VERIFIED' where organization_id=$1`, [orgB]);
      const restoredAfterDenied = await apiClient.query<{ value: string }>("select current_setting('rupaykg_guard.evidence_id', true) as value");
      assert.equal(restoredAfterDenied.rows[0]?.value, evidenceA, "failed trigger execution must restore the caller's pre-existing guard GUC");
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
        /verification requires an active non-suspended identity/,
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
    const apiRace = await apiPool!.connect();
    let committed = false;
    try {
      await revoker.query("begin");
      await revoker.query(`update ${s}.roles set permissions='[]'::jsonb where id=$1`, [roleId]);
      const raceLogin = await apiRace.query<{ current_user: string }>("select current_user");
      assert.equal(raceLogin.rows[0]?.current_user, apiRole);
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

    const assertNonOwnerRevocationRace = async (label: string, updateSql: string, values: unknown[], expected: RegExp, requestEvidenceId: string = evidenceA) => {
      const mutationSession = await pool.connect();
      const requestSession = await apiPool!.connect();
      let mutationCommitted = false;
      let pending: Promise<{ ok: true } | { ok: false; error: unknown }> | undefined;
      try {
        await mutationSession.query("begin");
        await mutationSession.query(updateSql, values);
        const login = await requestSession.query<{ current_user: string }>("select current_user");
        assert.equal(login.rows[0]?.current_user, apiRole);
        const pid = (await requestSession.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
        pending = requestSession.query(
          `insert into ${s}.verifications(evidence_id,verifier_identity_id,decision) values ($1,$2,'REJECTED')`,
          [requestEvidenceId, identity],
        ).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
        let waiting = false;
        for (let i = 0; i < 400; i++) {
          const state = await pool.query<{ wait_event_type: string | null }>("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
          if (state.rows[0]?.wait_event_type === "Lock") { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.equal(waiting, true, `${label}: API verification must wait for the concurrent revocation`);
        await mutationSession.query("commit");
        mutationCommitted = true;
        const outcome = await pending;
        assert.equal(outcome.ok, false, `${label}: revoked authority must deny the verification`);
        if (!outcome.ok) assert.match(outcome.error instanceof Error ? outcome.error.message : String(outcome.error), expected);
      } finally {
        if (!mutationCommitted) await mutationSession.query("rollback").catch(() => undefined);
        if (pending) await pending.catch(() => undefined);
        await requestSession.query("reset role").catch(() => undefined);
        mutationSession.release();
        requestSession.release();
      }
    };

    await pool.query(`update ${s}.roles set permissions='["VERIFY_EVIDENCE"]'::jsonb where id=$1`, [roleId]);
    await assertNonOwnerRevocationRace(
      "membership deactivation",
      `update ${s}.organization_memberships set status='PENDING' where id=$1`,
      [membership],
      /verification requires active explicit verifier permission/,
    );
    await pool.query(`update ${s}.organization_memberships set status='VERIFIED' where id=$1`, [membership]);
    await assertNonOwnerRevocationRace(
      "evidence-to-activity reassignment",
      `update ${s}.evidence set activity_id=$2 where id=$1`,
      [evidenceA, activityB],
      /verification requires active explicit verifier permission/,
    );
    await pool.query(`update ${s}.evidence set activity_id=$2 where id=$1`, [evidenceA, activityA]);
    await assertNonOwnerRevocationRace(
      "activity organization reassignment",
      `update ${s}.activities set organization_id=$2 where id=$1`,
      [activityA, orgB],
      /verification requires active explicit verifier permission/,
    );
    await pool.query(`update ${s}.activities set organization_id=$2 where id=$1`, [activityA, orgA]);
    await assertNonOwnerRevocationRace(
      "activity geography reassignment",
      `update ${s}.activities set geography_id=$2 where id=$1`,
      [activityA, geoB],
      /verification geography is outside organization scope/,
    );
    await pool.query(`update ${s}.activities set geography_id=$2 where id=$1`, [activityA, geoA]);
    await assertNonOwnerRevocationRace(
      "geography scope revocation",
      `update ${s}.organization_geography_scopes set status='PENDING' where id=$1`,
      [scopeA],
      /verification geography is outside organization scope/,
    );
    await pool.query(`update ${s}.organization_geography_scopes set status='VERIFIED' where id=$1`, [scopeA]);
    await assertNonOwnerRevocationRace(
      "identity suspension",
      `update ${s}.identities set status='SUSPENDED', suspended_at=now() where id=$1`,
      [identity],
      /verification requires an active non-suspended identity/,
    );
  } finally {
    await apiPool?.end().catch(() => undefined);
    await pool.query(`drop schema if exists ${s} cascade`).catch(() => undefined);
    if (createdApi) await pool.query(`drop role if exists ${api}`).catch(() => undefined);
    if (createdGuard) await pool.query(`drop role if exists ${guard}`).catch(() => undefined);
    await pool.end();
  }
});
