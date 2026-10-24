-- Make every audit_events insert participate in one serialized SHA-256 chain.
-- The latest historical row is linked to a dedicated cutover event; this does not
-- retroactively certify legacy rows that were written by different mechanisms.
-- Quiesce audit writes before locking the head. INSERT acquires a relation lock on
-- audit_events before its BEFORE trigger locks the head row, so this order lets
-- in-flight writers finish instead of creating a head/audit lock inversion.
-- Ordering is used only to select the legacy anchor; it does not certify legacy order.
lock table audit_events in share row exclusive mode;
lock table platform_audit_chain_head in exclusive mode;

create table if not exists platform_audit_chain_anchor (
  singleton boolean primary key default true check (singleton),
  anchor_event_id uuid not null references audit_events(id),
  anchor_event_hash text not null,
  legacy_anchor_event_id uuid references audit_events(id),
  legacy_anchor_event_hash text,
  captured_at timestamptz not null default clock_timestamp(),
  constraint platform_audit_chain_anchor_legacy_pair check (
    (legacy_anchor_event_id is null and legacy_anchor_event_hash is null)
    or (legacy_anchor_event_id is not null and legacy_anchor_event_hash is not null)
  )
);

update platform_audit_chain_head
   set last_event_id = (select id from audit_events order by created_at desc, id desc limit 1),
       last_event_hash = (select event_hash from audit_events order by created_at desc, id desc limit 1),
       updated_at = clock_timestamp()
 where singleton = true;

create or replace function chain_audit_event_before_insert()
returns trigger
language plpgsql
as $$
declare
  chain_previous_hash text;
  canonical_event jsonb;
begin
  select last_event_hash
    into chain_previous_hash
    from platform_audit_chain_head
   where singleton = true
   for update;

  if not found then
    raise exception 'PLATFORM_AUDIT_CHAIN_HEAD_MISSING';
  end if;

  new.previous_hash := chain_previous_hash;
  new.created_at := coalesce(new.created_at, clock_timestamp());

  canonical_event := jsonb_build_object(
    'id', new.id,
    'actor_identity_id', new.actor_identity_id,
    'organization_id', new.organization_id,
    'action', new.action,
    'target_type', new.target_type,
    'target_id', new.target_id,
    'request_id', new.request_id,
    'payload', new.payload,
    'created_at', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'previous_hash', new.previous_hash
  );

  new.event_hash := encode(digest(convert_to(canonical_event::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

create or replace function chain_audit_event_after_insert()
returns trigger
language plpgsql
as $$
begin
  update platform_audit_chain_head
     set last_event_id = new.id,
         last_event_hash = new.event_hash,
         updated_at = clock_timestamp()
   where singleton = true;

  if not found then
    raise exception 'PLATFORM_AUDIT_CHAIN_HEAD_MISSING';
  end if;
  return new;
end;
$$;

drop trigger if exists audit_events_chain_before_insert on audit_events;
create trigger audit_events_chain_before_insert
before insert on audit_events
for each row execute function chain_audit_event_before_insert();

drop trigger if exists audit_events_chain_after_insert on audit_events;
create trigger audit_events_chain_after_insert
after insert on audit_events
for each row execute function chain_audit_event_after_insert();

create or replace function reject_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AUDIT_EVENTS_APPEND_ONLY';
end;
$$;

drop trigger if exists audit_events_append_only_guard on audit_events;
create trigger audit_events_append_only_guard
before update or delete on audit_events
for each row execute function reject_audit_event_mutation();

create or replace function reject_audit_chain_anchor_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AUDIT_CHAIN_ANCHOR_IMMUTABLE';
end;
$$;

drop trigger if exists platform_audit_chain_anchor_immutable on platform_audit_chain_anchor;
create trigger platform_audit_chain_anchor_immutable
before update or delete on platform_audit_chain_anchor
for each row execute function reject_audit_chain_anchor_mutation();

-- Create a dedicated cutover event. This gives post-migration verification a
-- stable root even when legacy rows contain multiple historical hash streams.
do $$
declare
  legacy_event_id uuid;
  legacy_event_hash text;
  anchor_event_id uuid;
  anchor_event_hash text;
begin
  select last_event_id, last_event_hash
    into legacy_event_id, legacy_event_hash
    from platform_audit_chain_head
   where singleton = true;

  insert into audit_events(action, target_type, request_id, payload)
  values (
    'AUDIT_CHAIN_CUTOVER_ANCHOR',
    'audit_chain',
    'migration-088-cutover',
    jsonb_build_object(
      'migration', '088_global_audit_chain_enforcement',
      'legacy_anchor_event_id', legacy_event_id,
      'legacy_anchor_event_hash', legacy_event_hash
    )
  )
  returning id, event_hash into anchor_event_id, anchor_event_hash;

  insert into platform_audit_chain_anchor(
    singleton, anchor_event_id, anchor_event_hash, legacy_anchor_event_id, legacy_anchor_event_hash
  )
  values (true, anchor_event_id, anchor_event_hash, legacy_event_id, legacy_event_hash);
end;
$$;

comment on table audit_events is
  'Append-only audit ledger. New rows are globally serialized and SHA-256 chained by database triggers. Legacy rows before migration 088 are not retroactively certified.';
