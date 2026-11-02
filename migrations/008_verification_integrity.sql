-- Verification and event-integrity guardrails.
-- PostgreSQL is authoritative: a verification requires an authorized verifier who is independent
-- from the activity actor, and registry/settlement events are append-only and hash-anchored.

create or replace function has_verification_permission(p_identity_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from organization_memberships m
    join roles r on r.id = m.role_id
    where m.identity_id = p_identity_id
      and m.status = 'VERIFIED'
      and (
        lower(r.name) in ('verifier','auditor','validator','verification_officer')
        or r.permissions @> '["verification:approve"]'::jsonb
        or r.permissions @> '["verification.approve"]'::jsonb
      )
  );
$$;

create or replace function prevent_invalid_verification()
returns trigger language plpgsql as $$
declare
  activity_actor uuid;
begin
  if new.decision = 'APPROVED' then
    if not has_verification_permission(new.verifier_identity_id) then
      raise exception 'verification requires an authorized verifier';
    end if;

    if new.activity_id is not null then
      select actor_identity_id into activity_actor
      from activities
      where id = new.activity_id;
    elsif new.evidence_id is not null then
      select a.actor_identity_id into activity_actor
      from evidence e
      join activities a on a.id = e.activity_id
      where e.id = new.evidence_id;
    end if;

    if activity_actor is not null and activity_actor = new.verifier_identity_id then
      raise exception 'activity actor cannot verify its own evidence';
    end if;
  end if;
  return new;
end;
$$;

create trigger verifications_integrity_guard
before insert or update on verifications
for each row execute function prevent_invalid_verification();

create or replace function reject_registry_event_update()
returns trigger language plpgsql as $$
begin
  raise exception 'registry events are append-only';
end;
$$;

create or replace function reject_settlement_event_update()
returns trigger language plpgsql as $$
begin
  raise exception 'settlement events are append-only';
end;
$$;

create trigger registry_events_append_only
before update or delete on registry_events
for each row execute function reject_registry_event_update();

create trigger settlement_events_append_only
before update or delete on settlement_events
for each row execute function reject_settlement_event_update();

create or replace function anchor_registry_event_hash()
returns trigger language plpgsql as $$
begin
  new.event_hash := encode(
    digest(
      coalesce(new.id::text, '') || '|' ||
      coalesce(new.credential_id::text, '') || '|' ||
      coalesce(new.event_type, '') || '|' ||
      coalesce(new.from_owner_id::text, '') || '|' ||
      coalesce(new.to_owner_id::text, '') || '|' ||
      coalesce(new.external_reference, '') || '|' ||
      coalesce(new.verification_id::text, '') || '|' ||
      coalesce(new.recorded_by_identity_id::text, '') || '|' ||
      coalesce(new.created_at::text, ''),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$;

create or replace function anchor_settlement_event_hash()
returns trigger language plpgsql as $$
begin
  new.event_hash := encode(
    digest(
      coalesce(new.id::text, '') || '|' ||
      coalesce(new.settlement_id::text, '') || '|' ||
      coalesce(new.event_type, '') || '|' ||
      coalesce(new.actor_identity_id::text, '') || '|' ||
      coalesce(new.external_reference, '') || '|' ||
      coalesce(new.created_at::text, ''),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$;

create trigger registry_event_hash_anchor
before insert on registry_events
for each row execute function anchor_registry_event_hash();

create trigger settlement_event_hash_anchor
before insert on settlement_events
for each row execute function anchor_settlement_event_hash();

create index verifications_verifier_idx on verifications(verifier_identity_id, decided_at);
