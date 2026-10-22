-- Pan-India source identifiers are aliases, not primary keys. Preserve provenance and effective
-- dates so state/local authority code changes do not rewrite RupayKg's canonical geography IDs.
-- No jurisdiction records are seeded here: ingest only from a reviewed official source snapshot.
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
  source_reference_uri text check (source_reference_uri is null or source_reference_uri ~ '^https://'),
  source_checksum text check (source_checksum is null or source_checksum ~ '^[0-9a-f]{64}$'),
  reviewed_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  check (
    status <> 'VERIFIED'
    or (
      reviewed_at is not null
      and reviewed_by_identity_id is not null
      and source_reference_uri is not null
      and source_reference_uri ~ '^https://'
      and source_checksum is not null
      and source_checksum ~ '^[0-9a-f]{64}$'
    )
  ),
  unique (source_id, identifier_type, external_identifier, valid_from)
);

create index if not exists geography_external_identifiers_geography_idx
  on geography_external_identifiers(geography_id, status, valid_from desc);
create index if not exists geography_external_identifiers_lookup_idx
  on geography_external_identifiers(source_id, identifier_type, external_identifier, status);

-- Database exclusion constraints reject overlapping verified periods, including concurrent writes.
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

-- Once verified, an alias is immutable except for one-way retirement. Corrections require a new
-- effective-dated record so earlier evidence and mappings remain auditable.
create or replace function guard_geography_external_identifier_lifecycle()
returns trigger language plpgsql as $$
begin
  if old.status = 'RETIRED' then
    raise exception 'GEOGRAPHY_EXTERNAL_IDENTIFIER_RETIRED_TERMINAL'
      using errcode = '23514';
  end if;
  if old.status = 'VERIFIED' then
    if new.status not in ('VERIFIED', 'RETIRED') then
      raise exception 'GEOGRAPHY_EXTERNAL_IDENTIFIER_VERIFIED_STATUS_IMMUTABLE'
        using errcode = '23514';
    end if;
    if new.source_id is distinct from old.source_id
      or new.geography_id is distinct from old.geography_id
      or new.identifier_type is distinct from old.identifier_type
      or new.external_identifier is distinct from old.external_identifier
      or new.valid_from is distinct from old.valid_from
      or new.valid_to is distinct from old.valid_to
      or new.source_reference_uri is distinct from old.source_reference_uri
      or new.source_checksum is distinct from old.source_checksum
      or new.reviewed_by_identity_id is distinct from old.reviewed_by_identity_id
      or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'GEOGRAPHY_EXTERNAL_IDENTIFIER_VERIFIED_IMMUTABLE'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists geography_external_identifier_lifecycle_guard on geography_external_identifiers;
create trigger geography_external_identifier_lifecycle_guard
before update on geography_external_identifiers
for each row execute function guard_geography_external_identifier_lifecycle();

-- Exact source/type/code/effective-date lookup only. No fuzzy or cross-source fallback.
create or replace function resolve_verified_geography_external_identifier(
  p_source_id uuid,
  p_identifier_type text,
  p_external_identifier text,
  p_as_of date
) returns uuid
language sql stable as $$
  select geography_id
  from geography_external_identifiers
  where source_id = p_source_id
    and identifier_type = p_identifier_type
    and external_identifier = p_external_identifier
    and status = 'VERIFIED'
    and valid_from <= p_as_of
    and (valid_to is null or valid_to >= p_as_of)
  limit 1;
$$;

comment on function resolve_verified_geography_external_identifier(uuid,text,text,date) is
  'Exact, source-bound, effective-date resolver for verified external geography identifiers; no fuzzy matching or fallback is permitted.';
comment on table geography_external_identifiers is
  'Versioned, provenance-bound external geography identifiers; canonical geography IDs remain internal and stable.';

    )
  ),
  unique (source_id, identifier_type, external_identifier, valid_from)
);

create index if not exists geography_external_identifiers_geography_idx
  on geography_external_identifiers(geography_id, status, valid_from desc);
create index if not exists geography_external_identifiers_lookup_idx
  on geography_external_identifiers(source_id, identifier_type, external_identifier, status);

-- Database exclusion constraints reject overlapping verified periods, including concurrent writes.
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

-- Once verified, an alias is immutable except for one-way retirement. Corrections require a new
-- effective-dated record so earlier evidence and mappings remain auditable.
create or replace function guard_geography_external_identifier_lifecycle()
returns trigger language plpgsql as $$
begin
  if old.status = 'RETIRED' then
    raise exception 'GEOGRAPHY_EXTERNAL_IDENTIFIER_RETIRED_TERMINAL'
      using errcode = '23514';
  end if;
  if old.status = 'VERIFIED' then
    if new.status not in ('VERIFIED', 'RETIRED') then
      raise exception 'GEOGRAPHY_EXTERNAL_IDENTIFIER_VERIFIED_STATUS_IMMUTABLE'
        using errcode = '23514';
    end if;
    if new.source_id is distinct from old.source_id
      or new.geography_id is distinct from old.geography_id
      or new.identifier_type is distinct from old.identifier_type
      or new.external_identifier is distinct from old.external_identifier
      or new.valid_from is distinct from old.valid_from
      or new.valid_to is distinct from old.valid_to
      or new.source_reference_uri is distinct from old.source_reference_uri
      or new.source_checksum is distinct from old.source_checksum
      or new.reviewed_by_identity_id is distinct from old.reviewed_by_identity_id
      or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'GEOGRAPHY_EXTERNAL_IDENTIFIER_VERIFIED_IMMUTABLE'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists geography_external_identifier_lifecycle_guard on geography_external_identifiers;
create trigger geography_external_identifier_lifecycle_guard
before update on geography_external_identifiers
for each row execute function guard_geography_external_identifier_lifecycle();

-- Exact source/type/code/effective-date lookup only. No fuzzy or cross-source fallback.
create or replace function resolve_verified_geography_external_identifier(
  p_source_id uuid,
  p_identifier_type text,
  p_external_identifier text,
  p_as_of date
) returns uuid
language sql stable as $$
  select geography_id
  from geography_external_identifiers
  where source_id = p_source_id
    and identifier_type = p_identifier_type
    and external_identifier = p_external_identifier
    and status = 'VERIFIED'
    and valid_from <= p_as_of
    and (valid_to is null or valid_to >= p_as_of)
  limit 1;
$$;

comment on function resolve_verified_geography_external_identifier(uuid,text,text,date) is
  'Exact, source-bound, effective-date resolver for verified external geography identifiers; no fuzzy matching or fallback is permitted.';
comment on table geography_external_identifiers is
  'Versioned, provenance-bound external geography identifiers; canonical geography IDs remain internal and stable.';
