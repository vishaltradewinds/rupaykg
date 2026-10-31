-- Durable idempotency ledger for AI evidence intake.
-- Idempotency is scoped to identity + organization; request payloads are never stored here.
create table ai_evidence_intake_jobs (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id) on delete restrict,
  organization_id uuid not null references organizations(id) on delete restrict,
  idempotency_key varchar(200) not null,
  request_sha256 char(64) not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING','RETRYABLE_FAILED','COMPLETED')),
  source_evidence_id uuid references evidence(id) on delete restrict,
  proposal_evidence_id uuid references evidence(id) on delete restrict,
  response_json jsonb,
  attempt_count integer not null default 1 check (attempt_count between 1 and 100),
  lease_token uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz not null default (now() + interval '5 minutes'),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (identity_id, organization_id, idempotency_key),
  check ((status = 'COMPLETED') = (completed_at is not null)),
  check (status <> 'COMPLETED' or response_json is not null)
);
create index ai_evidence_intake_jobs_recovery_idx
  on ai_evidence_intake_jobs (lease_expires_at)
  where status <> 'COMPLETED';
create index ai_evidence_intake_jobs_org_updated_idx
  on ai_evidence_intake_jobs (organization_id, updated_at desc);

comment on table ai_evidence_intake_jobs is
  'Durable idempotency and recovery ledger for AI evidence intake. Contains hashes and state only; no raw logs, prompts, model output or credentials.';
