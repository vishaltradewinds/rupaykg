-- Signed, short-lived W3C VC-JWT attestations of internally approved BM WA03.001 baselines.
-- These are baseline attestations only, never carbon-credit or registry credentials.
create table bm_wa03001_baseline_attestations (
  id uuid primary key default gen_random_uuid(),
  baseline_record_id uuid not null unique references bm_wa03001_baseline_records(id),
  organization_id uuid not null references organizations(id),
  activity_id uuid not null references activities(id),
  credential_jwt text not null check (length(credential_jwt) between 100 and 200000),
  credential_sha256 text not null check (credential_sha256 ~ '^[a-f0-9]{64}$'),
  issuer_did text not null check (issuer_did like 'did:%'),
  signing_key_id text not null,
  public_jwk jsonb not null,
  issued_by_identity_id uuid not null references identities(id),
  issued_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > issued_at),
  created_at timestamptz not null default now(),
  foreign key (baseline_record_id, activity_id, organization_id)
    references bm_wa03001_baseline_records(id, activity_id, organization_id)
);
create index bm_wa03001_baseline_attestations_scope_idx on bm_wa03001_baseline_attestations(organization_id, activity_id, issued_at desc);
create or replace function prevent_bm_wa03001_attestation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'BM WA03.001 baseline attestations are append-only';
end;
$$;
create trigger bm_wa03001_baseline_attestation_immutable
before update or delete on bm_wa03001_baseline_attestations
for each row execute function prevent_bm_wa03001_attestation_mutation();
