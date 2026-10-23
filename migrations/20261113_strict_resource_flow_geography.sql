-- Strict Pan-India geography authorization for operational resource flows.
-- Keep the legacy helper available to old read paths, but do not allow new or changed
-- resource-flow records to bypass explicit verified jurisdiction roots.
create or replace function enforce_resource_flow_geography_scope()
returns trigger language plpgsql as $$
begin
  if new.source_geography_id is null and new.destination_geography_id is null then
    raise exception 'RESOURCE_FLOW_GEOGRAPHY_REQUIRED'
      using errcode = '23514';
  end if;

  if new.source_geography_id is not null
     and not organization_has_explicit_geography_scope(new.organization_id, new.source_geography_id) then
    raise exception 'RESOURCE_FLOW_SOURCE_GEOGRAPHY_FORBIDDEN'
      using errcode = '23514';
  end if;

  if new.destination_geography_id is not null
     and not organization_has_explicit_geography_scope(new.organization_id, new.destination_geography_id) then
    raise exception 'RESOURCE_FLOW_DESTINATION_GEOGRAPHY_FORBIDDEN'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists resource_flow_geography_scope_guard on resource_flows;
create trigger resource_flow_geography_scope_guard
before insert or update on resource_flows
for each row execute function enforce_resource_flow_geography_scope();

comment on function enforce_resource_flow_geography_scope() is
  'Fail-closed resource-flow geography guard: requires at least one endpoint and explicit verified organization scope for every supplied endpoint.';
