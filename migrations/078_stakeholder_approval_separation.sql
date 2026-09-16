-- A stakeholder applicant must never approve their own onboarding application.
create or replace function prevent_stakeholder_self_approval()
returns trigger language plpgsql as $$
begin
  if new.approved_by_identity_id is not null and exists (
    select 1 from stakeholder_applications sa
    where sa.id=new.application_id and sa.identity_id=new.approved_by_identity_id
  ) then
    raise exception 'STAKEHOLDER_SELF_APPROVAL_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists stakeholder_approval_separation_guard on stakeholder_application_approvals;
create trigger stakeholder_approval_separation_guard
before insert or update of approved_by_identity_id on stakeholder_application_approvals
for each row execute function prevent_stakeholder_self_approval();
