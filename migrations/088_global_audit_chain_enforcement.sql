-- Make every audit_events insert participate in one serialized SHA-256 chain.
-- The latest historical row remains a migration-time anchor only; this does not
-- retroactively certify legacy rows that were written by different mechanisms.
-- Refresh the migration-time anchor while writes to both tables are quiesced. Ordering is
-- used only to select the legacy anchor; it does not certify the legacy chain order.
-- Lock the head table first to match the app's historical head -> audit insert lock order.
lock table platform_audit_chain_head in share row exclusive mode;
lock table audit_events in share row exclusive mode;

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

comment on table audit_events is
  'Append-only audit ledger. New rows are globally serialized and SHA-256 chained by database triggers. Legacy rows before migration 088 are not retroactively certified.';
