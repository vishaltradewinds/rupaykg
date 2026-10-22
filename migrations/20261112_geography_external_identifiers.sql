-- Pan-India source identifiers are aliases, not primary keys. Preserve provenance and effective
-- dates so state/local authority code changes do not rewrite RupayKg's canonical geography IDs.
-- No jurisdiction records are seeded here: ingest only from a reviewed official source snapshot.
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

-- Prevent two concurrently reviewed mappings from assigning the same source identifier
-- to overlapping effective periods. The transaction advisory lock serializes checks per alias.
create or replace function prevent_overlapping_verified_geography_identifier()
returns trigger language plpgsql as $$
begin
  if new.status = 'VERIFIED' then
    perform pg_advisory_xact_lock(hashtextextended(
      new.source_id::text || '|' || new.identifier_type || '|' || new.external_identifier, 0
    ));
    if exists (
      select 1
      from geography_external_identifiers existing
      where existing.id <> new.id
        and existing.source_id = new.source_id
        and existing.identifier_type = new.identifier_type
        and existing.external_identifier = new.external_identifier
        and existing.status = 'VERIFIED'
        and daterange(existing.valid_from, existing.valid_to, '[]')
            && daterange(new.valid_from, new.valid_to, '[]')
    ) then
      raise exception 'GEOGRAPHY_EXTERNAL_IDENTIFIER_EFFECTIVE_PERIOD_OVERLAP'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists geography_external_identifier_no_overlap on geography_external_identifiers;
create trigger geography_external_identifier_no_overlap
before insert or update of source_id, identifier_type, external_identifier, valid_from, valid_to, status
on geography_external_identifiers
for each row execute function prevent_overlapping_verified_geography_identifier();

comment on table geography_external_identifiers is
  'Versioned, provenance-bound external geography identifiers; canonical geography IDs remain internal and stable.';
