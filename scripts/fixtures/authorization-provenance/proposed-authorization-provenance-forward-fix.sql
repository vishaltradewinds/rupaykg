-- UNNUMBERED REVIEW FIXTURE ONLY.
-- Deliberately outside migrations/. Do not deploy or assign a migration
-- version until migration chronology is reconciled and independent review
-- approves a forward-only change.
--
-- This proposal adds a durable lifecycle marker. Legacy rows are classified
-- conservatively from their current decision: APPROVED becomes
-- APPROVED_HISTORY; REJECTED becomes REJECTED_TERMINAL; all other states become
-- NEVER_APPROVED. A legacy rejected row is never re-opened in place. This is
-- deliberately fail-closed: it does not claim to reconstruct unknown history.
--
-- The trigger remains SECURITY INVOKER. A final migration must schema-qualify
-- all objects and pin a reviewed trusted search_path after confirming actual
-- runtime role grants/RLS behavior.

alter table verifications
  add column if not exists authorization_history_state text not null default 'NEVER_APPROVED';

alter table verifications
  drop constraint if exists verifications_authorization_history_state_check;

alter table verifications
  add constraint verifications_authorization_history_state_check
  check (authorization_history_state in ('NEVER_APPROVED','APPROVED_HISTORY','REJECTED_TERMINAL'));

-- Existing approvals and rejections become terminal lifecycle states.
-- No historical timestamp or permission snapshot is fabricated.
update verifications
set authorization_history_state = case
  when decision = 'APPROVED' then 'APPROVED_HISTORY'
  when decision = 'REJECTED' then 'REJECTED_TERMINAL'
  else 'NEVER_APPROVED'
end;

create or replace function prevent_invalid_verification()
returns trigger
language plpgsql
as $$
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
    from evidence e where e.id = new.evidence_id;

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
    elsif new.decision = 'REJECTED' then
      new.authorization_history_state := 'REJECTED_TERMINAL';
    else
      new.authorization_history_state := 'NEVER_APPROVED';
    end if;
  else
    -- Previously approved rows remain immutable, including after rejection.
    -- OLD.decision catches legacy approvals whose timestamp is NULL.
    if OLD.authorization_history_state = 'APPROVED_HISTORY' or OLD.decision = 'APPROVED' then
      if (
        NEW.verifier_identity_id is distinct from OLD.verifier_identity_id
        or NEW.evidence_id is distinct from OLD.evidence_id
        or NEW.activity_id is distinct from OLD.activity_id
      ) then
        raise exception 'approved verification linkage is immutable; use a new audited verification record';
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

    -- A rejected decision is terminal even if it predates migration 096.
    -- This intentionally prevents in-place reapproval when prior history is
    -- unknowable; correction must create a new verification record.
    if OLD.authorization_history_state = 'REJECTED_TERMINAL' or OLD.decision = 'REJECTED' then
      if (
        NEW.verifier_identity_id is distinct from OLD.verifier_identity_id
        or NEW.evidence_id is distinct from OLD.evidence_id
        or NEW.activity_id is distinct from OLD.activity_id
      ) then
        raise exception 'rejected verification linkage is immutable; create a new audited verification record';
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

    -- Caller-supplied provenance cannot be introduced by updates to a row
    -- that has never been approved.
    new.authorization_membership_id := null;
    new.authorization_role_id := null;
    new.authorization_permissions_snapshot := null;
    new.authorization_checked_at := null;

    if NEW.decision = 'REJECTED' then
      new.authorization_history_state := 'REJECTED_TERMINAL';
    else
      new.authorization_history_state := 'NEVER_APPROVED';
    end if;
  end if;

  if new.decision = 'APPROVED' then
    if resolved_activity_id is not null then
      select a.actor_identity_id, a.organization_id
        into activity_actor, activity_organization_id
      from activities a where a.id = resolved_activity_id;
    end if;

    if activity_organization_id is null then
      raise exception 'approved verification requires an activity with an organization';
    end if;

    if activity_actor is not null and activity_actor = new.verifier_identity_id then
      raise exception 'activity actor cannot verify its own evidence';
    end if;

    select m.id as membership_id, m.role_id, r.permissions
      into membership_row
    from organization_memberships m
    join roles r on r.id = m.role_id
    join identities i on i.id = m.identity_id
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
    limit 1;

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
  end if;

  return new;
end;
$$;
