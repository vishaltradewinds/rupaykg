-- UNNUMBERED REVIEW FIXTURE ONLY.
-- Deliberately outside migrations/. Do not deploy or assign a migration
-- version until migration chronology and independent review are complete.
--
-- Production verification_decision currently has exactly APPROVED and
-- REJECTED. Rejected decisions are terminal; correction uses a new evidence
-- row and new verification record, never in-place reapproval.
--
-- The lifecycle marker is populated from the current decision without
-- fabricating historical timestamps or permission snapshots.

alter table public.verifications
  add column if not exists authorization_history_state text not null default 'REJECTED_TERMINAL';

alter table public.verifications
  drop constraint if exists verifications_authorization_history_state_check;

alter table public.verifications
  add constraint verifications_authorization_history_state_check
  check (authorization_history_state in ('APPROVED_HISTORY','REJECTED_TERMINAL'));

update public.verifications
set authorization_history_state = case
  when decision = 'APPROVED' then 'APPROVED_HISTORY'
  else 'REJECTED_TERMINAL'
end;

create or replace function public.prevent_invalid_verification()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $fn$
declare
  resolved_activity_id uuid;
  activity_actor uuid;
  activity_organization_id uuid;
  membership_row record;
  evidence_activity_id uuid;
begin
  resolved_activity_id := new.activity_id;

  if new.evidence_id is not null then
    select e.activity_id into evidence_activity_id
    from public.evidence e where e.id = new.evidence_id;

    if evidence_activity_id is null then
      raise exception 'verification evidence must be bound to an activity';
    end if;

    if resolved_activity_id is not null and resolved_activity_id is distinct from evidence_activity_id then
      raise exception 'verification activity must match the evidence activity';
    end if;

    resolved_activity_id := evidence_activity_id;
    new.activity_id := evidence_activity_id;
  end if;

  if TG_OP = 'INSERT' then
    if new.decision = 'APPROVED' then
      new.authorization_history_state := 'APPROVED_HISTORY';
    else
      new.authorization_history_state := 'REJECTED_TERMINAL';
    end if;
  else
    -- Legacy APPROVED rows remain recognizable even when migration 096 left
    -- authorization_checked_at NULL. Preserve their original snapshot values.
    if OLD.authorization_history_state = 'APPROVED_HISTORY' or OLD.decision = 'APPROVED' then
      if (
        NEW.verifier_identity_id is distinct from OLD.verifier_identity_id
        or NEW.evidence_id is distinct from OLD.evidence_id
        or NEW.activity_id is distinct from OLD.activity_id
      ) then
        raise exception 'approved verification linkage is immutable; create a new evidence and verification record';
      end if;

      if OLD.decision <> 'APPROVED' and NEW.decision = 'APPROVED' then
        raise exception 'reapproval of a previously approved verification requires a new audited verification record';
      end if;

      new.authorization_history_state := 'APPROVED_HISTORY';
      new.authorization_membership_id := OLD.authorization_membership_id;
      new.authorization_role_id := OLD.authorization_role_id;
      new.authorization_permissions_snapshot := OLD.authorization_permissions_snapshot;
      new.authorization_checked_at := OLD.authorization_checked_at;
      return new;
    end if;

    -- REJECTED is terminal. Legacy rejected rows are not reopened even if
    -- their pre-096 decision history cannot be reconstructed.
    if OLD.authorization_history_state = 'REJECTED_TERMINAL' or OLD.decision = 'REJECTED' then
      if (
        NEW.verifier_identity_id is distinct from OLD.verifier_identity_id
        or NEW.evidence_id is distinct from OLD.evidence_id
        or NEW.activity_id is distinct from OLD.activity_id
      ) then
        raise exception 'rejected verification linkage is immutable; create a new evidence and verification record';
      end if;
      if NEW.decision is distinct from OLD.decision then
        raise exception 'rejected verification is terminal; create a new audited verification record';
      end if;
      new.authorization_history_state := 'REJECTED_TERMINAL';
      new.authorization_membership_id := OLD.authorization_membership_id;
      new.authorization_role_id := OLD.authorization_role_id;
      new.authorization_permissions_snapshot := OLD.authorization_permissions_snapshot;
      new.authorization_checked_at := OLD.authorization_checked_at;
      return new;
    end if;
  end if;

  if new.decision = 'APPROVED' then
    if resolved_activity_id is not null then
      select a.actor_identity_id, a.organization_id
        into activity_actor, activity_organization_id
      from public.activities a where a.id = resolved_activity_id;
    end if;

    if activity_organization_id is null then
      raise exception 'approved verification requires an activity with an organization';
    end if;

    if activity_actor is not null and activity_actor = new.verifier_identity_id then
      raise exception 'activity actor cannot verify its own evidence';
    end if;

    select m.id as membership_id, m.role_id, r.permissions
      into membership_row
    from public.organization_memberships m
    join public.roles r on r.id = m.role_id
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
    order by m.created_at desc
    limit 1
    for share of m, r, i;

    if membership_row.membership_id is null then
      raise exception 'approved verification requires active verifier permission in the activity organization';
    end if;

    new.authorization_membership_id := membership_row.membership_id;
    new.authorization_role_id := membership_row.role_id;
    new.authorization_permissions_snapshot := membership_row.permissions;
    new.authorization_checked_at := clock_timestamp();
    new.authorization_history_state := 'APPROVED_HISTORY';
  else
    new.authorization_membership_id := null;
    new.authorization_role_id := null;
    new.authorization_permissions_snapshot := null;
    new.authorization_checked_at := null;
    new.authorization_history_state := 'REJECTED_TERMINAL';
  end if;

  return new;
end;
$fn$;
