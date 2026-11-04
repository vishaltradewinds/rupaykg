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
  alter role rupaykg_verification_guard
    nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

  if exists (
    select 1 from pg_catalog.pg_auth_members
     where roleid = (select oid from pg_catalog.pg_roles where rolname = 'rupaykg_verification_guard')
  ) then
    raise exception 'verification guard role must not be assumable by any login or application role';
  end if;
end;
$role$;

grant usage on schema public to rupaykg_verification_guard;
grant select on public.evidence,
                public.activities,
                public.organization_memberships,
                public.roles,
                public.identities,
                public.organization_geography_scopes,
                public.geography
  to rupaykg_verification_guard;
grant update (id) on public.evidence,
                     public.activities,
                     public.organization_memberships,
                     public.roles,
                     public.identities
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
  evidence_activity_id uuid;
  membership_row record;
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

  if activity_geography_id is null
     or not public.organization_has_geography_scope(activity_organization_id, activity_geography_id) then
    raise exception 'verification requires an activity within an authorized organization geography';
  end if;

  if activity_actor is not null and activity_actor = new.verifier_identity_id then
    raise exception 'activity actor cannot self-approve evidence';
  end if;

  -- Lock the exact identity, membership and role rows while evaluating the
  -- permission. Concurrent suspension, revocation or permission mutation must
  -- serialize with this decision transaction.
  select m.id as membership_id, m.role_id, r.permissions
    into membership_row
    from public.organization_memberships m
    join public.roles r on r.id = m.role_id and r.organization_id = m.organization_id
    join public.identities i on i.id = m.identity_id
   where m.identity_id = new.verifier_identity_id
     and m.organization_id = activity_organization_id
     and m.status = 'VERIFIED'
     and i.status = 'VERIFIED'
     and i.suspended_at is null
     and (
       r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
       or r.permissions @> '["verification:approve"]'::jsonb
       or r.permissions @> '["verification.approve"]'::jsonb
     )
   order by m.created_at desc, m.id desc
   limit 1
   for share of m, r, i;

  if membership_row.membership_id is null then
    raise exception 'verification requires active explicit verifier permission in the activity organization';
  end if;

  -- Never accept client-supplied authorization provenance. Capture the exact
  -- membership, role and permission set used by this decision.
  new.authorization_membership_id := membership_row.membership_id;
  new.authorization_role_id := membership_row.role_id;
  new.authorization_permissions_snapshot := membership_row.permissions;
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
grant execute on function public.organization_has_geography_scope(uuid, uuid)
  to rupaykg_verification_guard;

create trigger verification_authorization_guard
before insert or update on public.verifications
for each row execute function public.enforce_verification_authorization();

comment on function public.enforce_verification_authorization() is
  'Requires explicit active verifier authority in the exact evidence activity organization for every decision; snapshots are captured at insert and verification rows cannot be updated.';
