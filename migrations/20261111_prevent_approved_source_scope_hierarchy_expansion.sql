-- Prevent hierarchy expansion after an approved source snapshot freezes its geography scope.
-- Existing descendants are immutable (20261110); this closes the INSERT/reparenting gap.
create or replace function prevent_approved_source_scope_hierarchy_expansion()
returns trigger
language plpgsql
as $$
declare
  parent_is_frozen boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  with recursive frozen_geographies(id) as (
    select s.scope_geography_id
      from authoritative_source_snapshots s
     where s.scope_geography_id is not null
       and s.scope_kind <> 'OTHER'
       and s.validation_status in ('APPROVED','RETIRED')
    union
    select child.id
      from geography child
      join frozen_geographies frozen on child.parent_id = frozen.id
  )
  select exists (
    select 1 from frozen_geographies where id = new.parent_id
  ) into parent_is_frozen;

  if parent_is_frozen then
    raise exception 'APPROVED_SOURCE_SCOPE_HIERARCHY_EXPANSION_FORBIDDEN';
  end if;

  return new;
end;
$$;

drop trigger if exists approved_source_scope_hierarchy_expansion_guard on geography;
create trigger approved_source_scope_hierarchy_expansion_guard
before insert or update of parent_id
on geography
for each row execute function prevent_approved_source_scope_hierarchy_expansion();

comment on function prevent_approved_source_scope_hierarchy_expansion() is
  'Fail-closed: prevents inserting a new geography node or reparenting an outside node beneath any descendant of an approved/retired non-national source scope. Existing frozen descendants are separately immutable.';
