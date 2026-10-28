-- Align the database guard with the same strict geography policy used by high-impact API writes.
-- Preserve the dedicated no-root error while requiring the strict helper for the requested geography.
create or replace function enforce_cpcb_swm_workspace_geography()
returns trigger language plpgsql as $$
begin
  if new.geography_id is null then
    raise exception 'SWM_WORKSPACE_GEOGRAPHY_REQUIRED';
  end if;
  if not exists (
    select 1 from organization_geography_scopes s
    where s.organization_id = new.organization_id and s.status = 'VERIFIED'
  ) then
    raise exception 'SWM_WORKSPACE_GEOGRAPHY_SCOPE_REQUIRED';
  end if;
  if not organization_has_explicit_geography_scope(new.organization_id, new.geography_id) then
    raise exception 'SWM_WORKSPACE_GEOGRAPHY_FORBIDDEN';
  end if;
  return new;
end;
$$;

comment on function enforce_cpcb_swm_workspace_geography() is
  'Fail-closed CPCB SWM geography guard: requires explicit verified organization geography root and strict descendant scope on insert or geography change.';
