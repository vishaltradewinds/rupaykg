-- Bind every verification decision to an active verifier membership in the
-- exact organization that owns the evidence activity. Decision-time provenance
-- is write-once: corrections are represented by a new verification record.
--
-- This is a forward-only correction for the legacy global-membership trigger
-- and the recovered-but-untracked production migration 096. It does not replay
-- migration 096 and is safe when its four snapshot columns already exist.
--
-- This migration is intentionally sequenced after the security-context
-- convergence migration (2026110402). That migration establishes the
-- dedicated non-login function owner and its narrowly scoped table-read
-- privileges before this authorization trigger is installed.

alter table public.verifications
  add column if not exists authorization_membership_id uuid references public.organization_memberships(id),
  add column if not exists authorization_role_id uuid references public.roles(id),
  add column if not exists authorization_permissions_snapshot jsonb,
  add column if not exists authorization_checked_at timestamptz;

create or replace function public.enforce_verification_authorization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  resolved_activity_id uuid;
  activity_actor uuid;
  activity_organization_id uuid;
  activity_geography_id uuid;
  evidence_activity_id uuid;
  membership_id uuid;
  membership_role_id uuid;
  membership_permissions jsonb;
  membership_candidate record;
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

  -- Lock the owning organization before evaluating geography or membership.
  -- This serializes verification against concurrent organization suspension and
  -- geography-scope changes and preserves a deterministic lock order:
  -- evidence -> activity -> organization -> membership -> role -> identity.
  perform 1
    from public.organizations o
   where o.id = activity_organization_id
     and o.status = 'VERIFIED'
   for share;
  if not found then
    raise exception 'verification requires a verified activity organization';
  end if;

  if activity_geography_id is null then
    raise exception 'verification requires an activity within an authorized organization geography';
  end if;

  -- Evaluate the scope after the organization lock using a VOLATILE trigger-local
  -- query. The STABLE helper can retain the outer statement snapshot and is not
  -- sufficient for this concurrency boundary.
  if not exists (
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
    select 1
      from public.organization_geography_scopes s
      join ancestors a on a.id = s.geography_id
     where s.organization_id = activity_organization_id
       and s.status = 'VERIFIED'
  ) then
    raise exception 'verification requires an activity within an authorized organization geography';
  end if;

  if activity_actor is not null and activity_actor = new.verifier_identity_id then
    raise exception 'activity actor cannot self-approve evidence';
  end if;

  -- Consider every active membership carrying a verifier permission. A newer
  -- non-verifier membership must not mask another valid verifier membership.
  -- Lock and re-check each membership and role after the candidate is selected.
  for membership_candidate in
    select m.id
      from public.organization_memberships m
      join public.roles r
        on r.id = m.role_id
       and r.organization_id = m.organization_id
     where m.identity_id = new.verifier_identity_id
       and m.organization_id = activity_organization_id
       and m.status = 'VERIFIED'
       and (
         r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
         or r.permissions @> '["verification:approve"]'::jsonb
         or r.permissions @> '["verification.approve"]'::jsonb
       )
     order by m.created_at desc, m.id desc
  loop
    select m.id, m.role_id
      into membership_row.membership_id, membership_row.role_id
      from public.organization_memberships m
     where m.id = membership_candidate.id
       and m.identity_id = new.verifier_identity_id
       and m.organization_id = activity_organization_id
       and m.status = 'VERIFIED'
     for share;

    if membership_id is null then
      continue;
    end if;

    select r.permissions
      into membership_row.permissions
      from public.roles r
     where r.id = membership_row.role_id
       and r.organization_id = activity_organization_id
     for share;

    if membership_row.permissions is not null and (
         membership_row.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
         or membership_row.permissions @> '["verification:approve"]'::jsonb
         or membership_row.permissions @> '["verification.approve"]'::jsonb
       ) then
      exit;
    end if;

    membership_row.membership_id := null;
    membership_row.role_id := null;
    membership_row.permissions := null;
  end loop;

  if membership_row.membership_id is null then
    raise exception 'verification requires active explicit verifier permission in the activity organization';
  end if;

  perform 1
    from public.identities i
   where i.id = new.verifier_identity_id
     and i.status = 'VERIFIED'
     and i.suspended_at is null
   for share;
  if not found then
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

create trigger verification_authorization_guard
before insert or update on public.verifications
for each row execute function public.enforce_verification_authorization();

comment on function public.enforce_verification_authorization() is
  'Requires explicit active verifier authority in the exact evidence activity organization for every decision; snapshots are captured at insert and verification rows cannot be updated.';

-- Serialize geography-scope mutations with verification decisions by taking
-- the same organization-row lock used by the verification trigger.
create or replace function public.lock_organization_for_geography_scope_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
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

alter function public.lock_organization_for_geography_scope_change()
  owner to rupaykg_auth_context_owner;

drop trigger if exists verification_geography_scope_serialization_guard
  on public.organization_geography_scopes;
create trigger verification_geography_scope_serialization_guard
before insert or update or delete on public.organization_geography_scopes
for each row execute function public.lock_organization_for_geography_scope_change();



ALTER FUNCTION public.enforce_verification_authorization()
  OWNER TO rupaykg_auth_context_owner;
