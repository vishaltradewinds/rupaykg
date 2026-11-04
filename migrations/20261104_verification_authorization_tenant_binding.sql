-- Bind every verification decision to an active verifier membership in the
-- exact organization that owns the evidence activity. Decision-time provenance
-- is write-once: corrections are represented by a new verification record.
--
-- This is a forward-only correction for the legacy global-membership trigger
-- and the recovered-but-untracked production migration 096. It does not replay
-- migration 096 and is safe when its four snapshot columns already exist.
--
-- Row-locking SELECT ... FOR SHARE requires UPDATE privilege on at least one
-- column of each locked table. A dedicated NOLOGIN/NOBYPASSRLS function owner
-- receives only SELECT plus UPDATE(id) on the locked rows. The API role is not
-- granted membership in this helper role. If RLS is enabled later, helper-role
-- policies must be designed and tested before activation; this migration does
-- not enable or force RLS.

do $role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'rupaykg_verification_guard') then
    create role rupaykg_verification_guard
      nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end;
$role$;

-- CREATEROLE grants ADMIN OPTION on roles it creates, but not SET ROLE.
-- Temporarily enable SET for function ownership transfer, then remove it.
grant rupaykg_verification_guard to current_user
  with set true, inherit false;
alter role rupaykg_verification_guard
  nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

do $role_check$
declare
  guard_oid oid;
  migrator_oid oid;
begin
  select oid into guard_oid from pg_catalog.pg_roles where rolname = 'rupaykg_verification_guard';
  select oid into migrator_oid from pg_catalog.pg_roles where rolname = current_user;
  if exists (
    select 1 from pg_catalog.pg_auth_members
     where roleid = guard_oid and member <> migrator_oid
  ) then
    raise exception 'verification guard role must not be granted to any non-migrator role';
  end if;
  if exists (
    select 1 from pg_catalog.pg_auth_members where member = guard_oid
  ) then
    raise exception 'verification guard role must not be a member of another role';
  end if;
end;
$role_check$;

grant usage on schema public to rupaykg_verification_guard;
grant select on public.evidence,
                public.activities,
                public.organization_memberships,
                public.roles,
                public.identities,
                public.organization_geography_scopes,
                public.geography,
                public.organizations
  to rupaykg_verification_guard;
grant update (id) on public.evidence,
                     public.activities,
                     public.organization_memberships,
                     public.roles,
                     public.identities,
                     public.organizations
  to rupaykg_verification_guard;

alter table public.verifications
  add column if not exists authorization_membership_id uuid references public.organization_memberships(id),
  add column if not exists authorization_role_id uuid references public.roles(id),
  add column if not exists authorization_permissions_snapshot jsonb,
  add column if not exists authorization_checked_at timestamptz;

create or replace function public.enforce_verification_authorization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  resolved_activity_id uuid;
  activity_actor uuid;
  activity_organization_id uuid;
  activity_geography_id uuid;
  activity_organization_status text;
  geography_scope_authorized boolean;
  evidence_activity_id uuid;
  membership_row record;
  role_row record;
  identity_row record;
begin
  if tg_op = 'UPDATE' then
    raise exception 'verification records are immutable; create a superseding verification';
  end if;

  if new.evidence_id is null then
    raise exception 'verification evidence is required';
  end if;

  select e.activity_id
    into evidence_activity_id
    from public.evidence e
   where e.id = new.evidence_id
   for share;

  if evidence_activity_id is null then
    raise exception 'verification evidence must be bound to an activity';
  end if;

  resolved_activity_id := evidence_activity_id;
  if new.activity_id is not null and new.activity_id is distinct from resolved_activity_id then
    raise exception 'verification activity must match the evidence activity';
  end if;
  new.activity_id := resolved_activity_id;

  select a.actor_identity_id, a.organization_id, a.geography_id
    into activity_actor, activity_organization_id, activity_geography_id
    from public.activities a
   where a.id = resolved_activity_id
   for share;

  if activity_organization_id is null then
    raise exception 'verification requires an activity with an organization';
  end if;

  -- Lock the organization after evidence and activity. This serializes
  -- verification against organization suspension and geography-scope changes.
  select o.status::text
    into activity_organization_status
    from public.organizations o
   where o.id = activity_organization_id
   for share;

  if activity_organization_status is distinct from 'VERIFIED' then
    raise exception 'verification requires a verified activity organization';
  end if;

  if activity_geography_id is null then
    raise exception 'verification requires an activity within an authorized organization geography';
  end if;

  -- Do not call the existing STABLE scope helper here: its snapshot can be
  -- pinned to the outer INSERT statement while waiting for the organization
  -- lock. This VOLATILE trigger performs a fresh SPI query after the lock so
  -- a committed concurrent scope change is visible before the decision.
  with recursive ancestors(id) as (
    select g.id
      from public.geography g
     where g.id = activity_geography_id
    union all
    select g.parent_id
      from public.geography g
      join ancestors a on a.id = g.id
     where g.parent_id is not null
  )
  select case
    when not exists (
      select 1 from public.organization_geography_scopes s
       where s.organization_id = activity_organization_id
         and s.status = 'VERIFIED'
    ) then true
    else exists (
      select 1
        from public.organization_geography_scopes s
        join ancestors a on a.id = s.geography_id
       where s.organization_id = activity_organization_id
         and s.status = 'VERIFIED'
    )
  end
    into geography_scope_authorized;

  if geography_scope_authorized is not true then
    raise exception 'verification requires an activity within an authorized organization geography';
  end if;

  if activity_actor is not null and activity_actor = new.verifier_identity_id then
    raise exception 'activity actor cannot self-approve evidence';
  end if;

  -- Fixed authorization lock order after evidence/activity/organization:
  -- membership -> role -> identity. Read each row again after acquiring its
  -- lock so concurrent revocation, reassignment, or suspension fails closed.
  select m.id, m.role_id, m.status
    into membership_row
    from public.organization_memberships m
   where m.identity_id = new.verifier_identity_id
     and m.organization_id = activity_organization_id
   order by m.created_at desc, m.id desc
   limit 1
   for share;

  if membership_row.id is null or membership_row.status <> 'VERIFIED' then
    raise exception 'verification requires active explicit verifier permission in the activity organization';
  end if;

  select r.permissions
    into role_row
    from public.roles r
   where r.id = membership_row.role_id
     and r.organization_id = activity_organization_id
   for share;

  if role_row.permissions is null or not (
       role_row.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
       or role_row.permissions @> '["verification:approve"]'::jsonb
       or role_row.permissions @> '["verification.approve"]'::jsonb
     ) then
    raise exception 'verification requires active explicit verifier permission in the activity organization';
  end if;

  select i.status, i.suspended_at
    into identity_row
    from public.identities i
   where i.id = new.verifier_identity_id
   for share;

  if identity_row.status is distinct from 'VERIFIED' or identity_row.suspended_at is not null then
    raise exception 'verification requires active explicit verifier permission in the activity organization';
  end if;

  -- Never accept client-supplied authorization provenance. Capture the exact
  -- membership, role and permission set used by this decision.
  new.authorization_membership_id := membership_row.id;
  new.authorization_role_id := membership_row.role_id;
  new.authorization_permissions_snapshot := role_row.permissions;
  new.authorization_checked_at := clock_timestamp();

  return new;
end;
$$;

drop trigger if exists verification_independence_guard on public.verifications;
drop trigger if exists verifications_integrity_guard on public.verifications;
drop trigger if exists verification_authorization_guard on public.verifications;

grant create on schema public to rupaykg_verification_guard;
alter function public.enforce_verification_authorization()
  owner to rupaykg_verification_guard;
revoke create on schema public from rupaykg_verification_guard;
create trigger verification_authorization_guard
before insert or update on public.verifications
for each row execute function public.enforce_verification_authorization();

comment on function public.enforce_verification_authorization() is
  'Requires explicit active verifier authority in the exact evidence activity organization for every decision; snapshots are captured at insert and verification rows cannot be updated.';

-- Geography-scope mutations take an UPDATE lock on the owning organization.
-- Verification takes SHARE on that same organization before evaluating scope,
-- preventing a decision from racing a newly added or changed geography root.
create or replace function public.lock_organization_for_geography_scope_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $scope_lock$
declare
  old_organization_id uuid;
  new_organization_id uuid;
begin
  if tg_op <> 'INSERT' then
    old_organization_id := old.organization_id;
  end if;
  if tg_op <> 'DELETE' then
    new_organization_id := new.organization_id;
  end if;

  perform o.id
    from public.organizations o
   where o.id = any(array_remove(array[old_organization_id, new_organization_id], null))
   order by o.id
   for update;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$scope_lock$;

grant create on schema public to rupaykg_verification_guard;
alter function public.lock_organization_for_geography_scope_change()
  owner to rupaykg_verification_guard;
revoke create on schema public from rupaykg_verification_guard;

drop trigger if exists verification_geography_scope_serialization_guard
  on public.organization_geography_scopes;
create trigger verification_geography_scope_serialization_guard
before insert or update or delete on public.organization_geography_scopes
for each row execute function public.lock_organization_for_geography_scope_change();

-- Leave the migration principal as ADMIN-only, without SET ROLE access.
grant rupaykg_verification_guard to current_user
  with set false, inherit false;

do $role_check$
declare
  guard_oid oid;
  migrator_oid oid;
begin
  select oid into guard_oid from pg_catalog.pg_roles where rolname = 'rupaykg_verification_guard';
  select oid into migrator_oid from pg_catalog.pg_roles where rolname = current_user;
  if exists (
    select 1 from pg_catalog.pg_auth_members
     where roleid = guard_oid
       and (member <> migrator_oid or set_option)
  ) then
    raise exception 'only the migration principal may retain ADMIN-only membership in the verification guard role';
  end if;
end;
$role_check$;

