-- Bind each hierarchical stakeholder approval to the exact geography requested
-- by its parent application. Null geography is a valid global/platform scope and
-- must compare null-safely; a normal composite FK would use MATCH SIMPLE semantics.
create or replace function rupaykg_enforce_stakeholder_approval_geography()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  application_geography_id uuid;
begin
  select sa.geography_id
    into application_geography_id
    from public.stakeholder_applications sa
   where sa.id = new.application_id
   for share;

  if not found then
    raise exception 'STAKEHOLDER_APPLICATION_NOT_FOUND';
  end if;

  if new.geography_id is distinct from application_geography_id then
    raise exception 'STAKEHOLDER_APPROVAL_GEOGRAPHY_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists stakeholder_approval_geography_guard
  on stakeholder_application_approvals;
create trigger stakeholder_approval_geography_guard
before insert or update of application_id, geography_id
on stakeholder_application_approvals
for each row
execute function rupaykg_enforce_stakeholder_approval_geography();

create or replace function rupaykg_prevent_application_geography_rewrite()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.geography_id is distinct from old.geography_id
     and exists (
       select 1
         from public.stakeholder_application_approvals a
        where a.application_id = old.id
     ) then
    raise exception 'STAKEHOLDER_APPLICATION_GEOGRAPHY_IMMUTABLE_AFTER_APPROVAL_CHAIN';
  end if;

  return new;
end;
$$;

drop trigger if exists stakeholder_application_geography_immutable
  on stakeholder_applications;
create trigger stakeholder_application_geography_immutable
before update of geography_id
on stakeholder_applications
for each row
execute function rupaykg_prevent_application_geography_rewrite();
