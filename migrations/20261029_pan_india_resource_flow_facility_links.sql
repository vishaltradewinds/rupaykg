-- Optional explicit facility endpoints on resource flows. Existing records remain unassigned.
alter table resource_flows
 add column source_facility_id uuid references facilities(id),
 add column destination_facility_id uuid references facilities(id);
create index resource_flows_source_facility_idx on resource_flows(source_facility_id) where source_facility_id is not null;
create index resource_flows_destination_facility_idx on resource_flows(destination_facility_id) where destination_facility_id is not null;

create or replace function enforce_resource_flow_facility_scope()
returns trigger language plpgsql as $$
declare f_org uuid; f_geo uuid; f_status text;
begin
 if new.source_facility_id is not null then
  select organization_id,geography_id,operational_status into f_org,f_geo,f_status
    from facilities where id=new.source_facility_id for share;
  if f_org is null or f_org<>new.organization_id then
   raise exception 'resource flow source facility must belong to the flow organization';
  end if;
  if f_status<>'ACTIVE' then
   raise exception 'resource flow source facility must be ACTIVE';
  end if;
  if new.source_geography_id is null or new.source_geography_id<>f_geo then
   raise exception 'resource flow source facility geography must exactly match source geography';
  end if;
  if not organization_has_geography_scope(new.organization_id,f_geo) then
   raise exception 'resource flow source facility geography is outside organization scope';
  end if;
 end if;
 if new.destination_facility_id is not null then
  select organization_id,geography_id,operational_status into f_org,f_geo,f_status
    from facilities where id=new.destination_facility_id for share;
  if f_org is null or f_org<>new.organization_id then
   raise exception 'resource flow destination facility must belong to the flow organization';
  end if;
  if f_status<>'ACTIVE' then
   raise exception 'resource flow destination facility must be ACTIVE';
  end if;
  if new.destination_geography_id is null or new.destination_geography_id<>f_geo then
   raise exception 'resource flow destination facility geography must exactly match destination geography';
  end if;
  if not organization_has_geography_scope(new.organization_id,f_geo) then
   raise exception 'resource flow destination facility geography is outside organization scope';
  end if;
 end if;
 return new;
end; $$;
create trigger resource_flow_facility_scope_guard
before insert or update on resource_flows
for each row execute function enforce_resource_flow_facility_scope();

-- Keep facility geography aligned with all existing resource-flow endpoints.
-- The earlier activity-link guard is replaced here after the endpoint columns exist.
create or replace function prevent_facility_geography_change_with_open_activity_links()
returns trigger language plpgsql as $$
begin
 if new.geography_id is distinct from old.geography_id then
  if exists(
   select 1 from facility_activity_links
   where facility_id=old.id and status in ('PENDING','VERIFIED')
  ) then
   raise exception 'cannot change facility geography while pending or verified activity links exist';
  end if;
  if exists(
   select 1 from resource_flows
   where source_facility_id=old.id or destination_facility_id=old.id
  ) then
   raise exception 'cannot change facility geography while resource flows reference this facility';
  end if;
 end if;
 return new;
end; $$;
