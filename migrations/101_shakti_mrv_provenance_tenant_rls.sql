-- Shakti tenant isolation: MRV provenance row boundary.
--
-- Protected migration: installs ownership, grants and fail-closed policies.
-- It intentionally does NOT enable RLS. RLS activation remains a separate
-- controlled DDL operation after preflight and negative-test acceptance.

do $shakti$
declare
  actual_owner text;
begin
  if current_user in ('rupaykg_app_runtime', 'rupaykg_runtime_login') then
    raise exception 'SHakti abort: application runtime login cannot install MRV provenance RLS';
  end if;

  if not exists (
    select 1 from pg_roles
     where rolname = 'rupaykg_app_runtime'
       and rolsuper = false
       and rolbypassrls = false
       and rolcanlogin = false
  ) then
    raise exception 'SHakti abort: application runtime role is missing or unsafe';
  end if;

  if not exists (
    select 1 from pg_roles
     where rolname = 'rupaykg_ddl'
       and rolsuper = false
       and rolbypassrls = false
       and rolcanlogin = false
  ) then
    raise exception 'SHakti abort: controlled non-BYPASSRLS rupaykg_ddl owner is missing or unsafe';
  end if;

  select pg_get_userbyid(c.relowner)
    into actual_owner
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'mrv_provenance_events'
     and c.relkind = 'r';

  if actual_owner is null then
    raise exception 'SHakti abort: public.mrv_provenance_events is missing';
  end if;

  -- ALTER TABLE ... OWNER requires the executing migration owner to be able
  -- to SET ROLE to the target owner. Do not rely on ordinary membership or
  -- on a superuser-only CI rehearsal for the production migration path.
  if not exists (
    select 1 from pg_roles where rolname = current_user and rolsuper = true
  ) then
    if current_user <> actual_owner then
      raise exception 'SHakti abort: migration executor % does not own public.mrv_provenance_events (owner: %)', current_user, actual_owner;
    end if;
    if not pg_has_role(current_user, 'rupaykg_ddl', 'SET') then
      raise exception 'SHakti abort: migration executor % cannot SET ROLE rupaykg_ddl; provision temporary SET membership before migration 101', current_user;
    end if;
  end if;

  if actual_owner not in ('rupaykg', 'rupaykg_ddl')
     and not exists (
       select 1 from pg_roles
        where rolname = current_user
          and rolsuper = true
     ) then
    raise exception 'SHakti abort: unexpected owner for public.mrv_provenance_events: %', actual_owner;
  end if;
end
$shakti$;

-- The new table owner must be able to own objects in this schema.
-- rupaykg is the current database owner and can grant this privilege.
grant create on schema public to rupaykg_ddl;

revoke all on table public.mrv_provenance_events from public;
revoke delete on table public.mrv_provenance_events from rupaykg_app_runtime;
grant select, insert, update on table public.mrv_provenance_events to rupaykg_app_runtime;

-- Verification guard functions run as the controlled DDL owner during
-- rollback-only acceptance fixtures. Expose only the identity columns those
-- guards need; do not grant broad identity-table access.
grant select (id, status, suspended_at) on table public.identities to rupaykg_ddl;

create policy mrv_provenance_events_tenant_select on public.mrv_provenance_events
  for select
  using (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy mrv_provenance_events_tenant_insert on public.mrv_provenance_events
  for insert
  with check (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy mrv_provenance_events_tenant_update on public.mrv_provenance_events
  for update
  using (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    exists (
      select 1
        from public.activities a
        join public.evidence e
          on e.id = mrv_provenance_events.evidence_id
         and e.activity_id = a.id
        join public.verifications v
          on v.id = mrv_provenance_events.verification_id
         and v.activity_id = a.id
         and v.evidence_id = mrv_provenance_events.evidence_id
       where a.id = mrv_provenance_events.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

comment on table public.mrv_provenance_events is
'Shakti tenant-scoped Guardian/Hedera provenance. Policies bind activity, evidence and verification to the active verified organization; RLS activation is a separate controlled DDL gate.';

-- Transfer ownership last. All grants, policies and comments above must be
-- installed while the current migration owner still owns this table.
alter table public.mrv_provenance_events owner to rupaykg_ddl;
