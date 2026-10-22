-- Fail-closed database guard for jurisdiction-bound activities.
-- Preserve existing rows for a separately planned backfill, but require explicit verified
-- organization geography scope for every new or changed activity record.
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
before insert or update on activities
for each row execute function enforce_activity_geography_scope();

comment on function enforce_activity_geography_scope() is
  'Fail-closed activity guard: new or changed activities require a geography within an explicit verified organization scope; existing rows are not rewritten.';
