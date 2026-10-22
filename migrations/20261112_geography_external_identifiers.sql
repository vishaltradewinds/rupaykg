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

comment on table geography_external_identifiers is
  'Versioned, provenance-bound external geography identifiers; canonical geography IDs remain internal and stable.';
