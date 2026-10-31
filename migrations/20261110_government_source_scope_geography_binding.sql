-- Bind a non-national source snapshot's scope code to a versioned geography directory
-- and prove that the target geography is within that scope. Free-text names are not authority.
alter table authoritative_source_snapshots
  add column if not exists scope_geography_id uuid references geography(id),
  add column if not exists scope_directory_source_id uuid references geography_sources(id);

alter table authoritative_source_snapshots
  drop constraint if exists authoritative_source_snapshot_scope_geography_binding_check;
alter table authoritative_source_snapshots
  add constraint authoritative_source_snapshot_scope_geography_binding_check
  check (
    (scope_kind = 'INDIA'
      and scope_code is null
      and scope_geography_id is null
      and scope_directory_source_id is null)
    or
    (scope_kind <> 'INDIA'
      and nullif(trim(scope_code), '') is not null
      and scope_geography_id is not null
      and scope_directory_source_id is not null)
  );

create index if not exists authoritative_source_snapshot_scope_geography_idx
  on authoritative_source_snapshots(scope_geography_id)
  where scope_geography_id is not null;

create or replace function government_source_scope_covers_geography(
  p_source_snapshot_id uuid,
  p_target_geography_id uuid
) returns boolean
language sql
stable
as $$
  with recursive target_lineage(id, parent_id) as (
    select g.id, g.parent_id
      from geography g
     where g.id = p_target_geography_id
    union all
    select parent.id, parent.parent_id
      from geography parent
      join target_lineage child on child.parent_id = parent.id
  )
  select coalesce((
    select case
      when s.scope_kind = 'INDIA' then
        s.scope_code is null
        and s.scope_geography_id is null
        and s.scope_directory_source_id is null
      else
        s.scope_code is not null
        and scope_geo.id is not null
        and scope_geo.external_code = s.scope_code
        and scope_geo.source_id = s.scope_directory_source_id
        and directory.status = 'VERIFIED'
        and nullif(trim(directory.source_uri), '') is not null
        and directory.checksum ~ '^[0-9a-f]{64}$'
        and nullif(trim(directory.source_version), '') is not null
        and (
          (s.scope_kind = 'STATE_UT' and scope_geo.kind = 'STATE_UT')
          or (s.scope_kind = 'DISTRICT' and scope_geo.kind = 'DISTRICT')
          or (s.scope_kind = 'LOCAL_BODY' and scope_geo.kind in ('ULB','GRAM_PANCHAYAT'))
          or (s.scope_kind = 'OTHER' and p_target_geography_id = scope_geo.id)
        )
        and (
          (s.scope_kind = 'OTHER' and p_target_geography_id = scope_geo.id)
          or
          (s.scope_kind <> 'OTHER' and exists (
            select 1 from target_lineage lineage where lineage.id = scope_geo.id
          ))
        )
        and (
          s.scope_kind = 'OTHER'
          or directory.source_name = 'Local Government Directory (LGD)'
        )
    end
    from authoritative_source_snapshots s
    left join geography scope_geo on scope_geo.id = s.scope_geography_id
    left join geography_sources directory on directory.id = s.scope_directory_source_id
    where s.id = p_source_snapshot_id
  ), false);
$$;

create or replace function enforce_government_crosswalk_source_scope()
returns trigger
language plpgsql
as $$
begin
  if not government_source_scope_covers_geography(new.source_snapshot_id, new.geography_id) then
    raise exception 'GOVERNMENT_CROSSWALK_SOURCE_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists government_crosswalk_request_source_scope on government_jurisdiction_crosswalk_requests;
create trigger government_crosswalk_request_source_scope
before insert or update of source_snapshot_id, geography_id
on government_jurisdiction_crosswalk_requests
for each row execute function enforce_government_crosswalk_source_scope();

drop trigger if exists government_crosswalk_source_scope on government_jurisdiction_crosswalks;
create trigger government_crosswalk_source_scope
before insert or update of source_snapshot_id, geography_id
on government_jurisdiction_crosswalks
for each row when (new.status = 'VERIFIED')
execute function enforce_government_crosswalk_source_scope();

create or replace function prevent_approved_source_snapshot_scope_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.validation_status in ('APPROVED','RETIRED') and (
    new.scope_kind is distinct from old.scope_kind
    or new.scope_code is distinct from old.scope_code
    or new.scope_geography_id is distinct from old.scope_geography_id
    or new.scope_directory_source_id is distinct from old.scope_directory_source_id
  ) then
    raise exception 'APPROVED_SOURCE_SNAPSHOT_SCOPE_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists approved_source_snapshot_scope_immutable on authoritative_source_snapshots;
create trigger approved_source_snapshot_scope_immutable
before update on authoritative_source_snapshots
for each row execute function prevent_approved_source_snapshot_scope_mutation();

comment on column authoritative_source_snapshots.scope_geography_id is
  'Evidence-backed geography node representing the snapshot scope; target crosswalk geography must be this node or a descendant where the scope kind permits.';
comment on column authoritative_source_snapshots.scope_directory_source_id is
  'Versioned, checksum-verified geography directory source used to bind scope_code to scope_geography_id; administrative scopes require Local Government Directory (LGD).';
comment on function government_source_scope_covers_geography(uuid,uuid) is
  'Fail-closed source-scope gate: India-wide sources may cover all geographies; state/district/local-body sources require a verified, versioned LGD code bound to a geography ancestor; OTHER is exact-geography only.';
