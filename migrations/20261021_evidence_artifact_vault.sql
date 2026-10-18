-- Evidence vault: versioned, organization-scoped evidence bytes with immutable provenance.
-- PostgreSQL bytea storage is intentionally bounded by API upload limits.

create table evidence_artifact_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  activity_id uuid not null references activities(id),
  evidence_type text not null,
  created_by_identity_id uuid not null references identities(id),
  created_at timestamptz not null default now()
);

create table evidence_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references evidence_artifact_series(id),
  evidence_id uuid not null unique references evidence(id),
  version_number integer not null check (version_number > 0),
  file_name text not null check (length(file_name) between 1 and 180),
  media_type text not null check (media_type in ('application/pdf','image/jpeg','image/png','text/csv','text/plain','application/json')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content bytea not null,
  uploaded_by_identity_id uuid not null references identities(id),
  source_reference text,
  measurement_period_start date,
  measurement_period_end date,
  created_at timestamptz not null default now(),
  unique(series_id, version_number),
  check (octet_length(content) = size_bytes),
  check (measurement_period_start is null or measurement_period_end is null or measurement_period_end >= measurement_period_start)
);

create table evidence_artifact_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id),
  artifact_version_id uuid not null references evidence_artifact_versions(id),
  reviewer_identity_id uuid not null references identities(id),
  decision text not null check (decision in ('APPROVED','REJECTED')),
  rationale text not null check (length(btrim(rationale)) between 5 and 2000),
  created_at timestamptz not null default now()
);

create index evidence_artifact_series_org_activity_idx on evidence_artifact_series(organization_id, activity_id, evidence_type);
create index evidence_artifact_versions_series_idx on evidence_artifact_versions(series_id, version_number desc);
create index evidence_artifact_reviews_evidence_idx on evidence_artifact_reviews(evidence_id, created_at desc);

create or replace function prevent_evidence_artifact_version_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'evidence artifact versions are immutable; upload a new version instead';
end;
$$;
create trigger evidence_artifact_versions_immutable
before update or delete on evidence_artifact_versions
for each row execute function prevent_evidence_artifact_version_mutation();

create or replace function prevent_evidence_artifact_review_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'evidence artifact reviews are append-only';
end;
$$;
create trigger evidence_artifact_reviews_append_only
before update or delete on evidence_artifact_reviews
for each row execute function prevent_evidence_artifact_review_mutation();
