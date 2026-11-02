-- Geography-scoped authorization for operational records.
-- Organizations may be assigned one or more geography roots. When an organization has
-- explicit roots, activities/resource flows must remain within those roots (including descendants).
-- An organization with no configured roots remains governed by its existing membership controls
-- so deployments can introduce geography scopes without breaking existing tenants.

create table organization_geography_scopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  geography_id uuid not null references geography(id),
  status record_status not null default 'VERIFIED',
  created_at timestamptz not null default now(),
  unique(organization_id, geography_id)
);

create index organization_geography_scopes_org_idx
  on organization_geography_scopes(organization_id, status);

create index organization_geography_scopes_geo_idx
  on organization_geography_scopes(geography_id);

create or replace function organization_has_geography_scope(
  p_organization_id uuid,
  p_geography_id uuid
) returns boolean
language sql stable as $$
  with recursive ancestors(id) as (
    select g.id from geography g where g.id = p_geography_id
    union all
    select g.parent_id
    from geography g
    join ancestors a on a.id = g.id
    where g.parent_id is not null
  )
  select case
    when not exists (
      select 1 from organization_geography_scopes s
      where s.organization_id = p_organization_id
        and s.status = 'VERIFIED'
    ) then true
    else exists (
      select 1
      from organization_geography_scopes s
      join ancestors a on a.id = s.geography_id
      where s.organization_id = p_organization_id
        and s.status = 'VERIFIED'
    )
  end;
$$;

create or replace function enforce_activity_geography_scope()
returns trigger language plpgsql as $$
begin
  if new.geography_id is not null and not organization_has_geography_scope(new.organization_id, new.geography_id) then
    raise exception 'activity geography is outside organization authorization scope';
  end if;
  return new;
end;
$$;

drop trigger if exists activity_geography_scope_guard on activities;
create trigger activity_geography_scope_guard
before insert or update on activities
for each row execute function enforce_activity_geography_scope();

create or replace function enforce_resource_flow_geography_scope()
returns trigger language plpgsql as $$
begin
  if new.source_geography_id is not null
     and not organization_has_geography_scope(new.organization_id, new.source_geography_id) then
    raise exception 'resource-flow source geography is outside organization authorization scope';
  end if;

  if new.destination_geography_id is not null
     and not organization_has_geography_scope(new.organization_id, new.destination_geography_id) then
    raise exception 'resource-flow destination geography is outside organization authorization scope';
  end if;

  return new;
end;
$$;

drop trigger if exists resource_flow_geography_scope_guard on resource_flows;
create trigger resource_flow_geography_scope_guard
before insert or update on resource_flows
for each row execute function enforce_resource_flow_geography_scope();
