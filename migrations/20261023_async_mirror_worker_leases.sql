-- Durable internal validation-worker leases and bounded retry/quarantine states.
-- These statuses are internal intake states only, not official CPCB/BEE/ICM decisions.
alter table async_mirror_inbox
  drop constraint if exists async_mirror_inbox_status_check;

alter table async_mirror_inbox
  add constraint async_mirror_inbox_status_check
  check (status in ('RECEIVED','PROCESSING','PROCESSED','VALIDATED','REJECTED','RETRY','QUARANTINED'));

alter table async_mirror_inbox
  add column if not exists lease_token uuid,
  add column if not exists lease_until timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists quarantined_at timestamptz,
  add column if not exists validation_summary jsonb;

create index if not exists async_mirror_inbox_due_idx
  on async_mirror_inbox (next_attempt_at, received_at)
  where status in ('RECEIVED','RETRY');

create index if not exists async_mirror_inbox_expired_lease_idx
  on async_mirror_inbox (lease_until)
  where status='PROCESSING';

comment on column async_mirror_inbox.validation_summary is
  'Non-authoritative internal payload-validation summary; never an official authority decision or verified MRV result.';


-- Append-only, payload-free event history for intake/worker state transitions.
create table if not exists async_mirror_inbox_events (
  id bigserial primary key,
  inbox_id uuid not null references async_mirror_inbox(id),
  authority_code text not null,
  municipal_code text not null,
  batch_id uuid not null,
  from_status text,
  to_status text not null,
  attempt integer not null check (attempt >= 0),
  payload_sha256 char(64) not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  error_code text,
  occurred_at timestamptz not null default now()
);

create index if not exists async_mirror_inbox_events_inbox_time_idx
  on async_mirror_inbox_events (inbox_id, occurred_at);

create or replace function record_async_mirror_inbox_event()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' or old.status is distinct from new.status or old.attempts is distinct from new.attempts then
    insert into async_mirror_inbox_events
      (inbox_id, authority_code, municipal_code, batch_id, from_status, to_status, attempt, payload_sha256, error_code)
    values
      (new.id, new.authority_code, new.municipal_code, new.batch_id,
       case when TG_OP = 'INSERT' then null else old.status end,
       new.status, new.attempts, new.payload_sha256, new.last_error_code);
  end if;
  return new;
end;
$$;

drop trigger if exists async_mirror_inbox_event_after_change on async_mirror_inbox;
create trigger async_mirror_inbox_event_after_change
after insert or update on async_mirror_inbox
for each row execute function record_async_mirror_inbox_event();

create or replace function prevent_async_mirror_inbox_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'async_mirror_inbox_events is append-only';
end;
$$;

drop trigger if exists async_mirror_inbox_events_immutable on async_mirror_inbox_events;
create trigger async_mirror_inbox_events_immutable
before update or delete on async_mirror_inbox_events
for each row execute function prevent_async_mirror_inbox_event_mutation();

comment on table async_mirror_inbox_events is
  'Append-only payload-free status/attempt history for internal government bridge intake; not official authority audit evidence.';
