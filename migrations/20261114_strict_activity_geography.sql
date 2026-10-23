-- Fail-closed database guard for jurisdiction-bound activities.
-- Preserve existing rows for a separately planned backfill. New activities and changes to
-- an activity's organization or geography require an explicit verified organization scope.
-- Unrelated updates to legacy rows do not silently become blocked by this guard.
create or replace function enforce_activity_geography_scope()
returns trigger language plpgsql as $$
begin
  if new.geography_id is null then
    raise exception 'ACTIVITY_GEOGRAPHY_REQUIRED'
      using errcode = '23514';
  end if;

  if not organization_has_explicit_geography_scope(new.organization_id, new.geography_id) then
    raise exception 'ACTIVITY_GEOGRAPHY_FORBIDDEN'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists activity_geography_scope_guard on activities;
create trigger activity_geography_scope_guard
before insert or update of organization_id, geography_id on activities
for each row execute function enforce_activity_geography_scope();

comment on function enforce_activity_geography_scope() is
  'Fail-closed activity guard: inserts and organization/geography changes require geography within an explicit verified organization scope; unrelated legacy-row updates are not blocked.';
