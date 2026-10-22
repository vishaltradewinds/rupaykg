-- Pan-India source identifiers are aliases, not primary keys. Preserve provenance and effective
-- dates so state/local authority code changes do not rewrite RupayKg's canonical geography IDs.
-- No jurisdiction records are seeded here: ingest only from a reviewed official source snapshot.
-- btree_gist makes source/type/code equality participate in the temporal exclusion constraint.
create extension if not exists btree_gist;
create table if not exists geography_external_identifiers (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references geography_sources(id),
  geography_id uuid not null references geography(id),
  identifier_type text not null check (identifier_type ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  external_identifier text not null check (btrim(external_identifier) <> ''),
  valid_from date not null,
  valid_to date,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'VERIFIED', 'RETIRED', 'REJECTED')),
  source_reference_uri text,
  source_checksum text,
  reviewed_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  check (
    status <> 'VERIFIED'
    or (reviewed_at is not null and reviewed_by_identity_id is not null and source_checksum is not null)
  ),
  unique (source_id, identifier_type, external_identifier, valid_from)
);

create index if not exists geography_external_identifiers_geography_idx
  on geography_external_identifiers(geography_id, status, valid_from desc);
create index if not exists geography_external_identifiers_lookup_idx
  on geography_external_identifiers(source_id, identifier_type, external_identifier, status);

-- Database exclusion constraints (rather than application-only checks) reject overlapping verified
-- effective periods even when two independent transactions attempt the same alias concurrently.
drop trigger if exists geography_external_identifier_no_overlap on geography_external_identifiers;
drop function if exists prevent_overlapping_verified_geography_identifier();
alter table geography_external_identifiers
  drop constraint if exists geography_external_identifier_effective_period_excl;
alter table geography_external_identifiers
  add constraint geography_external_identifier_effective_period_excl
  exclude using gist (
    source_id with =,
    identifier_type with =,
    external_identifier with =,
    daterange(valid_from, valid_to, '[]') with &&
  ) where (status = 'VERIFIED');

-- A resolver must never use PENDING, REJECTED or RETIRED aliases. The caller supplies the
-- target date and the exact source manifest; no fuzzy or cross-source fallback is permitted.
create or replace function resolve_verified_geography_external_identifier(
  p_source_id uuid,
  p_identifier_type text,
  p_external_identifier text,
  p_as_of date
) returns uuid
language sql stable as $
  select geography_id
  from geography_external_identifiers
  where source_id = p_source_id
    and identifier_type = p_identifier_type
    and external_identifier = p_external_identifier
    and status = 'VERIFIED'
    and valid_from <= p_as_of
    and (valid_to is null or valid_to >= p_as_of)
  limit 1;
$;

comment on function resolve_verified_geography_external_identifier(uuid,text,text,date) is
  'Exact, source-bound, effective-date resolver for verified external geography identifiers; no fuzzy matching or fallback is permitted.';

comment on table geography_external_identifiers is
  'Versioned, provenance-bound external geography identifiers; canonical geography IDs remain internal and stable.';
