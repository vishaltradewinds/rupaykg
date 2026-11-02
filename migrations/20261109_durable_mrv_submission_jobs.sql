-- Durable, replay-safe orchestration ledger for Guardian -> Hedera -> Mirror Node MRV.
-- This migration is intentionally not deployed. Worker implementation and tenant/RLS
-- review must pass before any production rollout.

create table if not exists mrv_submission_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) between 32 and 128),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  activity_id uuid not null references activities(id),
  verification_id uuid not null references verifications(id),
  evidence_id uuid not null references evidence(id),
  organization_id uuid not null references organizations(id),
  geography_id uuid not null references geography(id),
  requested_by_identity_id uuid not null,
  guardian_policy_id text not null check (length(btrim(guardian_policy_id)) > 0),
  methodology_code text,
  payload_snapshot jsonb not null check (jsonb_typeof(payload_snapshot) = 'object'),
  status text not null default 'REQUESTED'
    check (status in (
      'REQUESTED','CLAIMED','GUARDIAN_SUBMITTED','GUARDIAN_VERIFIED',
      'HCS_SUBMITTED','HCS_CONSENSUS_CONFIRMED','MIRROR_VERIFIED',
      'PROVENANCE_PERSISTED','COMPLETED','REJECTED','RETRYABLE_FAILURE',
      'PERMANENT_FAILURE','NEEDS_RECONCILIATION','CANCELLED'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  guardian_idempotency_key text,
  guardian_execution_id text,
  guardian_status text check (guardian_status is null or guardian_status in ('VERIFIED','REJECTED','UNAVAILABLE','NOT_CONFIGURED')),
  guardian_result jsonb,
  hedera_network text check (hedera_network is null or hedera_network in ('testnet','previewnet','mainnet')),
  hedera_topic_id text,
  hedera_transaction_id text,
  hedera_consensus_timestamp text,
  hedera_status text check (hedera_status is null or hedera_status in ('NOT_CONFIGURED','CONSENSUS_CONFIRMED','RETRYABLE_FAILURE','FAILED')),
  mirror_verified_at timestamptz,
  mirror_verification_digest text,
  last_error_code text,
  last_error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((lease_owner is null and lease_token is null and lease_expires_at is null)
      or (lease_owner is not null and lease_token is not null and lease_expires_at is not null)),
  check (status not in ('MIRROR_VERIFIED','PROVENANCE_PERSISTED','COMPLETED') or mirror_verified_at is not null),
  check (status <> 'COMPLETED' or completed_at is not null),
  check (status not in ('HCS_CONSENSUS_CONFIRMED','MIRROR_VERIFIED','PROVENANCE_PERSISTED','COMPLETED')
      or (hedera_transaction_id is not null and hedera_consensus_timestamp is not null and hedera_topic_id is not null)),
  check (status not in ('GUARDIAN_VERIFIED','HCS_SUBMITTED','HCS_CONSENSUS_CONFIRMED','MIRROR_VERIFIED','PROVENANCE_PERSISTED','COMPLETED')
      or (guardian_execution_id is not null and guardian_status = 'VERIFIED'))
);

create index if not exists mrv_submission_jobs_claim_idx
  on mrv_submission_jobs(next_attempt_at, created_at)
  where status in ('REQUESTED','RETRYABLE_FAILURE','CLAIMED');

create index if not exists mrv_submission_jobs_activity_idx
  on mrv_submission_jobs(activity_id, created_at desc);

create index if not exists mrv_submission_jobs_org_status_idx
  on mrv_submission_jobs(organization_id, status, created_at desc);

create unique index if not exists mrv_submission_jobs_provider_hcs_tx_idx
  on mrv_submission_jobs(hedera_transaction_id)
  where hedera_transaction_id is not null;

create table if not exists mrv_submission_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references mrv_submission_jobs(id),
  from_status text,
  to_status text not null,
  actor_kind text not null check (actor_kind in ('API','WORKER','SYSTEM')),
  actor_reference text,
  lease_token uuid,
  event_code text not null,
  event_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mrv_submission_job_events_job_idx
  on mrv_submission_job_events(job_id, id);

create or replace function guard_mrv_submission_job_update()
returns trigger language plpgsql as $$
declare
  allowed boolean := false;
begin
  if row(
    new.idempotency_key,new.payload_hash,new.activity_id,new.verification_id,new.evidence_id,
    new.organization_id,new.geography_id,new.requested_by_identity_id,new.guardian_policy_id,
    new.methodology_code,new.payload_snapshot,new.created_at
  ) is distinct from row(
    old.idempotency_key,old.payload_hash,old.activity_id,old.verification_id,old.evidence_id,
    old.organization_id,old.geography_id,old.requested_by_identity_id,old.guardian_policy_id,
    old.methodology_code,old.payload_snapshot,old.created_at
  ) then
    raise exception 'MRV_JOB_REQUEST_IMMUTABLE';
  end if;

  if new.status is distinct from old.status then
    allowed := case old.status
      when 'REQUESTED' then new.status in ('CLAIMED','CANCELLED')
      when 'CLAIMED' then new.status in ('CLAIMED','GUARDIAN_SUBMITTED','RETRYABLE_FAILURE','PERMANENT_FAILURE','NEEDS_RECONCILIATION','CANCELLED')
      when 'GUARDIAN_SUBMITTED' then new.status in ('GUARDIAN_VERIFIED','REJECTED','RETRYABLE_FAILURE','PERMANENT_FAILURE','NEEDS_RECONCILIATION')
      when 'GUARDIAN_VERIFIED' then new.status in ('HCS_SUBMITTED','RETRYABLE_FAILURE','PERMANENT_FAILURE','NEEDS_RECONCILIATION')
      when 'HCS_SUBMITTED' then new.status in ('HCS_CONSENSUS_CONFIRMED','RETRYABLE_FAILURE','PERMANENT_FAILURE','NEEDS_RECONCILIATION')
      when 'HCS_CONSENSUS_CONFIRMED' then new.status in ('MIRROR_VERIFIED','RETRYABLE_FAILURE','NEEDS_RECONCILIATION')
      when 'MIRROR_VERIFIED' then new.status in ('PROVENANCE_PERSISTED','NEEDS_RECONCILIATION')
      when 'PROVENANCE_PERSISTED' then new.status = 'COMPLETED'
      when 'RETRYABLE_FAILURE' then new.status in ('CLAIMED','NEEDS_RECONCILIATION','CANCELLED')
      when 'NEEDS_RECONCILIATION' then new.status in ('CLAIMED','PERMANENT_FAILURE','CANCELLED')
      else false
    end;
    if not allowed then
      raise exception 'MRV_JOB_INVALID_STATE_TRANSITION: % -> %', old.status, new.status;
    end if;

    -- Status transitions are lease-fenced at the database boundary as well as
    -- in the worker repository. Claiming REQUESTED/retryable work must install
    -- a fresh live lease; advancing an already claimed stage must present an
    -- existing live lease (the repository clears it after the transition).
    if not (old.status = 'REQUESTED' and new.status = 'CANCELLED') then
      if new.status = 'CLAIMED' then
        if new.lease_token is null or new.lease_expires_at is null or new.lease_expires_at <= now() then
          raise exception 'MRV_JOB_LEASE_REQUIRED';
        end if;
      elsif old.lease_token is null or old.lease_expires_at is null or old.lease_expires_at <= now() then
        raise exception 'MRV_JOB_LEASE_REQUIRED';
      end if;
    end if;

  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mrv_submission_job_update_guard on mrv_submission_jobs;
create trigger mrv_submission_job_update_guard
before update on mrv_submission_jobs
for each row execute function guard_mrv_submission_job_update();

create or replace function reject_mrv_submission_job_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'MRV_JOB_EVENT_APPEND_ONLY';
end;
$$;

drop trigger if exists mrv_submission_job_events_no_update on mrv_submission_job_events;
create trigger mrv_submission_job_events_no_update
before update or delete on mrv_submission_job_events
for each row execute function reject_mrv_submission_job_event_mutation();

create or replace function record_mrv_submission_job_event()
returns trigger language plpgsql as $$
begin
  insert into mrv_submission_job_events(
    job_id, from_status, to_status, actor_kind, actor_reference, lease_token, event_code, event_detail
  ) values (
    new.id, case when tg_op = 'INSERT' then null else old.status end,
    new.status, 'SYSTEM', null, new.lease_token,
    case when tg_op = 'INSERT' then 'JOB_CREATED' else 'JOB_UPDATED' end,
    jsonb_build_object('attemptCount', new.attempt_count, 'lastErrorCode', new.last_error_code)
  );
  return new;
end;
$$;

drop trigger if exists mrv_submission_job_event_insert on mrv_submission_jobs;
create trigger mrv_submission_job_event_insert
after insert on mrv_submission_jobs
for each row execute function record_mrv_submission_job_event();

drop trigger if exists mrv_submission_job_event_update on mrv_submission_jobs;
create trigger mrv_submission_job_event_update
after update of status, attempt_count, guardian_status, guardian_execution_id,
  hedera_status, hedera_transaction_id, hedera_consensus_timestamp, mirror_verified_at,
  next_attempt_at, last_error_code, last_error_detail
on mrv_submission_jobs
for each row execute function record_mrv_submission_job_event();

-- Deliberately no grants, RLS enablement, SECURITY DEFINER worker functions,
-- or production role changes here. Those require the completed 67-table role/policy
-- matrix and disposable two-tenant security tests.
