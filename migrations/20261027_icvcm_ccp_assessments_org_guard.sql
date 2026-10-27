-- Database-level tenant binding for ICVCM assessment history.
create or replace function enforce_icvcm_assessment_activity_organization()
returns trigger
language plpgsql
as $$
declare
  activity_organization_id uuid;
begin
  select a.organization_id into activity_organization_id
  from activities a where a.id = new.activity_id;
  if activity_organization_id is null then
    raise exception 'ICVCM assessment activity must exist and have an organization';
  end if;
  if activity_organization_id is distinct from new.organization_id then
    raise exception 'ICVCM assessment organization must match the activity organization';
  end if;
  return new;
end;
$$;

drop trigger if exists icvcm_assessment_activity_organization_guard on icvcm_ccp_assessments;
create trigger icvcm_assessment_activity_organization_guard
before insert or update of organization_id, activity_id
on icvcm_ccp_assessments
for each row execute function enforce_icvcm_assessment_activity_organization();
