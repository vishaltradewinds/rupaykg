-- Keep every hierarchical approval step bound to the geography requested
-- by its parent application. The value is intentionally equal for every step
-- in the current workflow; authority scope is evaluated separately at review.
do $$
begin
  if exists (
    select 1
    from stakeholder_application_approvals a
    join stakeholder_applications sa on sa.id = a.application_id
    where a.geography_id is distinct from sa.geography_id
  ) then
    raise exception 'STAKEHOLDER_APPROVAL_GEOGRAPHY_PREFLIGHT_FAILED: existing approval geography differs from its application';
  end if;
end
$$;

create or replace function enforce_stakeholder_approval_geography_match()
returns trigger
language plpgsql
as $$
declare
  application_geography uuid;
begin
  select sa.geography_id
    into application_geography
  from stakeholder_applications sa
  where sa.id = new.application_id
  for share;

  if not found then
    raise exception 'STAKEHOLDER_APPLICATION_NOT_FOUND';
  end if;

  if new.geography_id is distinct from application_geography then
    raise exception 'STAKEHOLDER_APPROVAL_GEOGRAPHY_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists stakeholder_approval_geography_integrity_guard
  on stakeholder_application_approvals;
create trigger stakeholder_approval_geography_integrity_guard
before insert or update of application_id, geography_id
on stakeholder_application_approvals
for each row
execute function enforce_stakeholder_approval_geography_match();

create or replace function prevent_stakeholder_application_geography_drift()
returns trigger
language plpgsql
as $$
begin
  if new.geography_id is distinct from old.geography_id
     and exists (
       select 1
       from stakeholder_application_approvals a
       where a.application_id = old.id
     ) then
    raise exception 'STAKEHOLDER_APPLICATION_GEOGRAPHY_IMMUTABLE_AFTER_APPROVAL_CHAIN';
  end if;

  return new;
end;
$$;

drop trigger if exists stakeholder_application_geography_drift_guard
  on stakeholder_applications;
create trigger stakeholder_application_geography_drift_guard
before update of geography_id
on stakeholder_applications
for each row
execute function prevent_stakeholder_application_geography_drift();
