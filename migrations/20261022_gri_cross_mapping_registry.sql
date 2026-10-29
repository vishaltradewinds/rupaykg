-- GRI cross-mapping registry: versioned, organization-scoped, evidence-linked review records.
-- This migration stores mappings only. It does not imply GRI conformity, statutory compliance,
-- third-party assurance, EPR acceptance, CCTS eligibility or CCC issuance.

create unique index if not exists esg_reporting_periods_id_org_uidx
  on esg_reporting_periods(id, organization_id);

create table if not exists esg_cross_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  reporting_period_id uuid not null,
  mapping_key text not null,
  mapping_version integer not null check (mapping_version > 0),
  schema_version text not null,
  source_requirement jsonb not null,
  target_disclosure jsonb not null,
  relationship text not null check (relationship in (
    'equivalent','partial_overlap','supports','contextual',
    'no_direct_equivalence','conflict_requires_review'
  )),
  rationale text not null,
  applicability jsonb not null,
  metric_mapping jsonb not null default '[]'::jsonb,
  evidence jsonb not null,
  controls jsonb not null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT','REVIEW_REQUIRED','APPROVED','BLOCKED','DEPRECATED'
  )),
  supersedes_mapping_id uuid references esg_cross_mappings(id),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (reporting_period_id, organization_id)
    references esg_reporting_periods(id, organization_id),
  unique (organization_id, reporting_period_id, mapping_key, mapping_version),
  check (jsonb_typeof(source_requirement) = 'object'),
  check (jsonb_typeof(target_disclosure) = 'object'),
  check (jsonb_typeof(applicability) = 'object'),
  check (jsonb_typeof(metric_mapping) = 'array'),
  check (jsonb_typeof(evidence) = 'object'),
  check (jsonb_typeof(controls) = 'object'),
  check (length(trim(mapping_key)) > 0),
  check (length(trim(schema_version)) > 0),
  check (length(trim(rationale)) >= 10)
);

create index if not exists esg_cross_mappings_period_status_idx
  on esg_cross_mappings(organization_id, reporting_period_id, status, mapping_key);

create index if not exists esg_cross_mappings_source_framework_idx
  on esg_cross_mappings using gin ((source_requirement -> 'framework'));

create table if not exists esg_cross_mapping_events (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references esg_cross_mappings(id),
  organization_id uuid not null references organizations(id),
  actor_id uuid,
  event_type text not null check (event_type in (
    'CREATED','UPDATED','SUBMITTED_FOR_REVIEW','APPROVED','BLOCKED',
    'DEPRECATED','EVIDENCE_ATTACHED','REVIEW_COMMENTED'
  )),
  previous_status text,
  new_status text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(event_payload) = 'object')
);

create index if not exists esg_cross_mapping_events_mapping_idx
  on esg_cross_mapping_events(mapping_id, created_at);

create index if not exists esg_cross_mapping_events_org_idx
  on esg_cross_mapping_events(organization_id, created_at);

create or replace function prevent_approved_esg_cross_mapping_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('APPROVED','DEPRECATED') then
      raise exception 'Approved/deprecated GRI mapping versions are immutable; create a new version';
    end if;
    raise exception 'GRI mapping records are retained for audit; deletion is not permitted';
  end if;

  if old.status in ('APPROVED','DEPRECATED') then
    raise exception 'Approved/deprecated GRI mapping versions are immutable; create a new version';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists esg_cross_mapping_immutable_version_guard on esg_cross_mappings;
create trigger esg_cross_mapping_immutable_version_guard
  before update or delete on esg_cross_mappings
  for each row execute function prevent_approved_esg_cross_mapping_mutation();

create or replace function prevent_esg_cross_mapping_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'GRI mapping audit events are append-only';
end;
$$;

drop trigger if exists esg_cross_mapping_event_append_only_guard on esg_cross_mapping_events;
create trigger esg_cross_mapping_event_append_only_guard
  before update or delete on esg_cross_mapping_events
  for each row execute function prevent_esg_cross_mapping_event_mutation();

comment on table esg_cross_mappings is
  'Versioned GRI/ESG cross-mapping records; never substitutes for statutory or credit eligibility determinations.';
comment on table esg_cross_mapping_events is
  'Append-only audit events for GRI cross-mapping lifecycle transitions.';
comment on column esg_cross_mappings.relationship is
  'Mapping relationship only; equivalent does not mean legal equivalence or regulatory acceptance.';
comment on column esg_cross_mappings.supersedes_mapping_id is
  'Optional prior mapping version. Approved versions are immutable; corrections require a new version.';
