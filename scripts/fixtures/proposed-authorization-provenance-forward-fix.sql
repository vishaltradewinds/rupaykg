-- UNNUMBERED REVIEW FIXTURE ONLY.
-- This file is deliberately outside migrations/. Do not deploy or assign a
-- migration version until the shared migration chronology is reconciled and
-- independent security/database review approves a forward-only change.
--
-- Proposed semantics:
-- * approval transitions capture a fresh authorization snapshot;
-- * an already-approved decision cannot silently swap verifier/evidence/activity;
-- * updates to an approved row preserve its decision-time snapshot;
-- * moving away from APPROVED preserves the prior snapshot as historical evidence;
-- * non-approved rows cannot carry caller-supplied approval provenance.

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

  if TG_OP = 'UPDATE' and OLD.decision = 'APPROVED' then
    if NEW.decision = 'APPROVED' and (
      NEW.verifier_identity_id is distinct from OLD.verifier_identity_id
      or NEW.evidence_id is distinct from OLD.evidence_id
      or NEW.activity_id is distinct from OLD.activity_id
    ) then
      raise exception 'approved verification linkage is immutable; use an explicit audited reapproval workflow';
    end if;

    -- Never refresh decision-time provenance during an unrelated UPDATE or
    -- rewrite it when the current decision is changed away from APPROVED.
    new.authorization_membership_id := OLD.authorization_membership_id;
    new.authorization_role_id := OLD.authorization_role_id;
    new.authorization_permissions_snapshot := OLD.authorization_permissions_snapshot;
    new.authorization_checked_at := OLD.authorization_checked_at;

    return new;
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
    new.authorization_checked_at := now();
  else
    new.authorization_membership_id := null;
    new.authorization_role_id := null;
    new.authorization_permissions_snapshot := null;
    new.authorization_checked_at := null;
  end if;

  return new;
end;
$$;
