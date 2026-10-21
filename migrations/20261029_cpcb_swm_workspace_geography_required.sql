-- Require explicit geography on all new CPCB SWM workspace records.
-- Legacy NULL-geography rows remain readable and are not rewritten by this migration;
-- route-level updates require a real, verified geography and scope.
create or replace function enforce_cpcb_swm_workspace_geography()
returns trigger language plpgsql as $$
begin
  if new.geography_id is null then
    raise exception 'SWM_WORKSPACE_GEOGRAPHY_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists cpcb_swm_workspace_geography_required on cpcb_swm_stakeholder_workspaces;
create trigger cpcb_swm_workspace_geography_required
before insert or update of geography_id on cpcb_swm_stakeholder_workspaces
for each row execute function enforce_cpcb_swm_workspace_geography();

comment on function enforce_cpcb_swm_workspace_geography() is
  'Fail closed for new or explicitly changed CPCB SWM workspace geography; legacy null rows are not silently rewritten.';
