-- Reserved-role restoration must use the audited two-person approval workflow.
-- Normal non-reserved onboarding retains the existing approved-application guard.
create or replace function prevent_direct_membership_activation()
returns trigger language plpgsql as $guard$
declare
  role_name text;
  dual_control_approved boolean := false;
begin
  if new.status <> 'VERIFIED' or old.status = 'VERIFIED' then
    return new;
  end if;

  select r.name into role_name
    from roles r
   where r.id = new.role_id and r.organization_id = new.organization_id;

  if role_name in ('super_admin','platform_admin') then
    select exists (
      select 1
        from platform_access_change_requests q
        join identities requester on requester.id=q.requester_identity_id
        join identities approver on approver.id=q.approver_identity_id
       where q.request_type='RESTORE_RESERVED_ROLE'
         and q.membership_id=old.id
         and q.target_identity_id=new.identity_id
         and q.organization_id=new.organization_id
         and q.role_id=new.role_id
         and q.status='APPROVED'
         and q.applied_at is not null
         and old.last_revoked_at is not null
         and q.created_at > old.last_revoked_at
         and q.requester_identity_id <> q.approver_identity_id
         and q.requester_identity_id <> q.target_identity_id
         and q.approver_identity_id <> q.target_identity_id
         and requester.status='VERIFIED' and requester.suspended_at is null
         and approver.status='VERIFIED' and approver.suspended_at is null
         and exists (
           select 1 from organization_memberships om
           join roles r on r.id=om.role_id
           join organizations o on o.id=om.organization_id and o.status='VERIFIED'
           where om.identity_id=q.requester_identity_id and om.status='VERIFIED'
             and r.name='super_admin'
             and exists (select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')
         )
         and exists (
           select 1 from organization_memberships om
           join roles r on r.id=om.role_id
           join organizations o on o.id=om.organization_id and o.status='VERIFIED'
           where om.identity_id=q.approver_identity_id and om.status='VERIFIED'
             and r.name='super_admin'
             and exists (select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')
         )
    ) into dual_control_approved;
    if not dual_control_approved then
      raise exception 'RESERVED_ROLE_REQUIRES_DUAL_CONTROL';
    end if;
    return new;
  end if;

  if not exists (
    select 1 from stakeholder_applications sa
     where sa.identity_id=new.identity_id
       and sa.organization_id=new.organization_id
       and sa.role_id=new.role_id
       and sa.status='APPROVED'
  ) then
    raise exception 'STAKEHOLDER_MEMBERSHIP_REQUIRES_APPROVED_APPLICATION';
  end if;
  return new;
end;
$guard$;

drop trigger if exists stakeholder_membership_application_guard on organization_memberships;
create trigger stakeholder_membership_application_guard
before update of status on organization_memberships
for each row execute function prevent_direct_membership_activation();
