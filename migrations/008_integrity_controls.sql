-- Integrity controls for independent verification and tamper-evident registry/settlement events.
-- New verification decisions require an authorized verifier role and cannot be self-approved.

create or replace function enforce_verification_independence()
returns trigger language plpgsql as $$
declare
  activity_actor uuid;
  verifier_authorized boolean;
begin
  select a.actor_identity_id
    into activity_actor
    from activities a
    join evidence e on e.activity_id = a.id
   where e.id = new.evidence_id;

  if activity_actor is not null and activity_actor = new.verifier_identity_id then
    raise exception 'verifier cannot self-approve activity evidence';
  end if;

  select exists (
    select 1
      from organization_memberships om
      join roles r on r.id = om.role_id
     where om.identity_id = new.verifier_identity_id
       and om.status = 'VERIFIED'
       and (r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb or r.name in ('VERIFIER','AUDITOR'))
  ) into verifier_authorized;

  if not verifier_authorized then
    raise exception 'verifier lacks VERIFY_EVIDENCE authorization';
  end if;

  return new;
end;
$$;

drop trigger if exists verification_independence_guard on verifications;
create trigger verification_independence_guard
before insert on verifications
for each row execute function enforce_verification_independence();

create or replace function hash_registry_event()
returns trigger language plpgsql as $$
begin
  new.event_hash := encode(digest(
    concat_ws('|', new.credential_id::text, new.event_type, coalesce(new.from_owner_id::text,''),
      coalesce(new.to_owner_id::text,''), coalesce(new.external_reference,''),
      coalesce(new.verification_id::text,''), coalesce(new.recorded_by_identity_id::text,''),
      coalesce(new.created_at::text,'')), 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists registry_event_hash_guard on registry_events;
create trigger registry_event_hash_guard
before insert on registry_events
for each row execute function hash_registry_event();

create or replace function reject_registry_event_update()
returns trigger language plpgsql as $$
begin
  raise exception 'registry events are append-only';
end;
$$;

drop trigger if exists registry_event_append_only on registry_events;
create trigger registry_event_append_only
before update or delete on registry_events
for each row execute function reject_registry_event_update();

create or replace function hash_settlement_event()
returns trigger language plpgsql as $$
begin
  new.event_hash := encode(digest(
    concat_ws('|', new.settlement_id::text, new.event_type, coalesce(new.actor_identity_id::text,''),
      coalesce(new.external_reference,''), coalesce(new.created_at::text,'')), 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists settlement_event_hash_guard on settlement_events;
create trigger settlement_event_hash_guard
before insert on settlement_events
for each row execute function hash_settlement_event();

drop trigger if exists settlement_event_append_only on settlement_events;
create trigger settlement_event_append_only
before update or delete on settlement_events
for each row execute function reject_settlement_event_update();

create or replace function reject_settlement_event_update()
returns trigger language plpgsql as $$
begin
  raise exception 'settlement events are append-only';
end;
$$;

create index if not exists verifications_verifier_idx on verifications(verifier_identity_id, decided_at desc);
