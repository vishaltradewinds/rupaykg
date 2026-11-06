-- Bind approved verification to the verifier's active permission in the same
-- organization as the activity, and retain the decision-time authorization snapshot.
alter table verifications
  add column if not exists authorization_membership_id uuid references organization_memberships(id),
  add column if not exists authorization_role_id uuid references roles(id),
  add column if not exists authorization_permissions_snapshot jsonb,
  add column if not exists authorization_checked_at timestamptz;

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

  if resolved_activity_id is not null then
    select a.actor_identity_id, a.organization_id
      into activity_actor, activity_organization_id
    from activities a where a.id = resolved_activity_id;
  end if;

  if new.decision = 'APPROVED' then
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
  end if;

  return new;
end;
$$;

drop trigger if exists verifications_integrity_guard on verifications;
create trigger verifications_integrity_guard
before insert or update on verifications
for each row execute function prevent_invalid_verification();

comment on column verifications.authorization_membership_id is
  'Verified organization membership used when this verification was approved.';
comment on column verifications.authorization_role_id is
  'Role used for the decision-time verifier authorization snapshot.';
comment on column verifications.authorization_permissions_snapshot is
  'Permissions JSON copied from the verifier role at decision time; later role changes do not rewrite historical provenance.';
comment on column verifications.authorization_checked_at is
  'Database timestamp when verifier authorization was checked for an approved decision.';
