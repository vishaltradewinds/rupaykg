-- Source snapshots and regulatory rule versions are separate from external approvals.
-- No snapshots/rules are seeded because no nationwide data import or reviewed rule package
-- has been evidenced in this repository.
create table if not exists authoritative_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_owner text not null check (length(trim(source_owner)) between 2 and 200),
  dataset_code text not null check (dataset_code ~ '^[A-Z0-9][A-Z0-9._-]{1,99}$'),
  source_url text not null check (source_url ~ '^https://'),
  source_version text not null check (length(trim(source_version)) between 1 and 160),
  scope_kind text not null check (scope_kind in ('INDIA','STATE_UT','DISTRICT','LOCAL_BODY','OTHER')),
  scope_code text,
  published_at timestamptz,
  retrieved_at timestamptz,
  effective_from date,
  effective_to date,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  record_count integer check (record_count is null or record_count >= 0),
  accepted_record_count integer check (accepted_record_count is null or accepted_record_count >= 0),
  unresolved_record_count integer check (unresolved_record_count is null or unresolved_record_count >= 0),
  validation_status text not null default 'DISCOVERED' check (validation_status in ('DISCOVERED','RETRIEVED','VALIDATED','APPROVED','REJECTED','RETIRED')),
  usage_terms_reference text,
  retrieved_by_identity_id uuid references identities(id),
  reviewed_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  check (record_count is null or accepted_record_count is null or unresolved_record_count is null or accepted_record_count + unresolved_record_count <= record_count),
  check (validation_status <> 'APPROVED' or (retrieved_at is not null and content_sha256 is not null and record_count is not null and accepted_record_count is not null and unresolved_record_count is not null and length(trim(coalesce(usage_terms_reference,''))) > 0 and reviewed_by_identity_id is not null and reviewed_at is not null))
);
create unique index if not exists authoritative_source_snapshot_version_scope_idx on authoritative_source_snapshots(dataset_code,source_version,scope_kind,coalesce(scope_code,'')) where validation_status <> 'RETIRED';

create table if not exists regulatory_rule_versions (
  id uuid primary key default gen_random_uuid(),
  framework text not null check (length(trim(framework)) between 2 and 120),
  rule_reference text not null check (length(trim(rule_reference)) between 2 and 200),
  stakeholder_class text,
  scheme_code text,
  jurisdiction_scope_kind text not null check (jurisdiction_scope_kind in ('INDIA','STATE_UT','DISTRICT','LOCAL_BODY')),
  jurisdiction_scope_code text,
  source_snapshot_id uuid not null references authoritative_source_snapshots(id),
  version_label text not null check (length(trim(version_label)) between 1 and 160),
  effective_from date not null,
  effective_to date,
  rule_payload jsonb not null check (jsonb_typeof(rule_payload)='object'),
  status text not null default 'REVIEW_REQUIRED' check (status in ('DRAFT','REVIEW_REQUIRED','APPROVED','RETIRED')),
  reviewed_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (jurisdiction_scope_kind='INDIA' or length(trim(coalesce(jurisdiction_scope_code,''))) > 0),
  check (status <> 'APPROVED' or (reviewed_by_identity_id is not null and reviewed_at is not null))
);
create index if not exists regulatory_rule_versions_lookup_idx on regulatory_rule_versions(framework,stakeholder_class,scheme_code,jurisdiction_scope_kind,jurisdiction_scope_code,status,effective_from,effective_to);
create index if not exists regulatory_rule_versions_source_idx on regulatory_rule_versions(source_snapshot_id);
alter table organization_statutory_profiles add column if not exists rule_version_id uuid references regulatory_rule_versions(id);
alter table organization_bwg_assessments add column if not exists rule_version_id uuid references regulatory_rule_versions(id);
alter table organization_epr_applicability add column if not exists rule_version_id uuid references regulatory_rule_versions(id);
comment on table authoritative_source_snapshots is 'Provenance and coverage manifest for source snapshots. APPROVED requires exact content hash, record counts, usage-terms reference and named review; it does not imply official API permission.';
comment on table regulatory_rule_versions is 'Effective-dated jurisdiction-specific rule version linked to a source snapshot. A version does not replace legal interpretation or external authority decisions.';
