-- Guardian + Hedera provenance for authoritative MRV decisions.
-- A row is created only for an actual Guardian execution attempt.
-- Hedera fields remain null until a real HCS consensus response is received.

create table if not exists mrv_provenance_events (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  verification_id uuid not null references verifications(id),
  evidence_id uuid not null references evidence(id),
  guardian_policy_id text not null,
  guardian_execution_id text,
  guardian_status text not null check (guardian_status in ('VERIFIED','REJECTED','NOT_CONFIGURED','UNAVAILABLE')),
  hcs_status text not null check (hcs_status in ('NOT_CONFIGURED','CONSENSUS_CONFIRMED','RETRYABLE_FAILURE','FAILED')),
  hcs_topic_id text,
  hcs_transaction_id text,
  hcs_consensus_timestamp text,
  integrity_hash text not null,
  methodology_code text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(activity_id, verification_id, integrity_hash)
);

create index if not exists mrv_provenance_activity_idx on mrv_provenance_events(activity_id, created_at desc);
create index if not exists mrv_provenance_verification_idx on mrv_provenance_events(verification_id, created_at desc);
create index if not exists mrv_provenance_hcs_idx on mrv_provenance_events(hcs_consensus_timestamp);
