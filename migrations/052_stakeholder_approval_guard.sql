-- Stakeholder onboarding approval is a platform-authority action.
-- PostgreSQL must reject approval mutations even if an HTTP/API authorization check is bypassed.

create or replace function prevent_unauthorized_stakeholder_approval()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'APPROVED'
     and old.status is distinct from 'APPROVED' then
    if new.reviewed_by_identity_id is null then
      raise exception 'Stakeholder approval requires a reviewing platform authority';
    end if;

    if new.reviewed_by_identity_id = new.identity_id then
      raise exception 'Stakeholder applications cannot be self-approved';
    end if;

    if not exists (
      select 1
      from organization_memberships om
      join roles r on r.id = om.role_id
      where om.identity_id = new.reviewed_by_identity_id
        and om.status = 'VERIFIED'
        and r.name in ('platform_admin', 'super_admin')
    ) then
      raise exception 'Stakeholder approval requires a verified platform_admin or super_admin';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists stakeholder_approval_authority_guard on stakeholder_applications;
create trigger stakeholder_approval_authority_guard
before update of status, reviewed_by_identity_id
on stakeholder_applications
for each row
execute function prevent_unauthorized_stakeholder_approval();
