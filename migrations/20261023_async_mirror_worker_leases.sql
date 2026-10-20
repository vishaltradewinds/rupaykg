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
