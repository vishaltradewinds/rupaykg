-- Authoritative RBAC defaults for stakeholder onboarding.
-- The legacy platform defined stakeholder capabilities by role. The current
-- PostgreSQL model keeps permissions on tenant-local roles, so newly created
-- onboarding roles must not remain empty after approval.
--
-- Unknown/custom roles intentionally receive no permissions. Administrative
-- roles are not exposed by public onboarding and must be provisioned explicitly.

create or replace function rupaykg_default_role_permissions(role_name text)
returns jsonb
language sql
immutable
as $$
  select case role_name
    when 'citizen' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'farmer' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'safai_mitra' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'fpo' then '["dashboard:read","profile:read","profile:update","reports:read","waste:read","waste:record","evidence:upload","swm:read","reports:export"]'::jsonb
    when 'municipal_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","evidence:upload","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","registry:read","credits:read","epr:read","audit:read"]'::jsonb
    when 'municipal_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","swm:read"]'::jsonb
    when 'state_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","projects:review","registry:read","credits:read","epr:read","csr:read","audit:read","audit:execute","admin:users","MANAGE_STAKEHOLDERS"]'::jsonb
    when 'aggregator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'processor' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload"]'::jsonb
    when 'industry_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","epr:read"]'::jsonb
    when 'commercial_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","epr:read"]'::jsonb
    when 'institution_generator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","epr:read"]'::jsonb
    when 'PROJECT_OWNER' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","evidence:upload","projects:read","projects:create","projects:manage","registry:read","credits:read"]'::jsonb
    when 'ACVA_USER' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","evidence:review","VERIFY_EVIDENCE","projects:read","projects:review","projects:verify","registry:read","credits:read","audit:read","audit:execute"]'::jsonb
    when 'ccc_buyer' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","projects:read","registry:read","credits:read","credits:buy","credits:retire","RETIRE_CREDENTIAL"]'::jsonb
    when 'regulator' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","projects:review","projects:verify","registry:read","credits:read","epr:read","epr:manage","csr:read","csr:manage","guardian:read","guardian:operate","audit:read","audit:execute"]'::jsonb
    when 'epr_partner' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","registry:read","credits:read","epr:read","epr:manage"]'::jsonb
    when 'csr_partner' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","registry:read","credits:read","csr:read","csr:manage"]'::jsonb
    when 'super_admin' then '["dashboard:read","profile:read","profile:update","reports:read","reports:export","waste:read","waste:record","evidence:upload","evidence:review","VERIFY_EVIDENCE","swm:read","swm:manage","projects:read","projects:create","projects:manage","projects:review","projects:verify","acva:manage","registry:read","registry:write","ISSUE_CREDENTIAL","TRANSFER_CREDENTIAL","RETIRE_CREDENTIAL","credits:read","credits:issue","credits:buy","credits:retire","credits:transfer","epr:read","epr:manage","csr:read","csr:manage","guardian:read","guardian:operate","audit:read","audit:execute","admin:users","admin:roles","admin:security","admin:system","MANAGE_STAKEHOLDERS"]'::jsonb
    when 'VERIFIER' then '["dashboard:read","profile:read","reports:read","evidence:review","VERIFY_EVIDENCE"]'::jsonb
    when 'AUDITOR' then '["dashboard:read","profile:read","reports:read","evidence:review","VERIFY_EVIDENCE","audit:read","audit:execute"]'::jsonb
    else '[]'::jsonb
  end;
$$;

create or replace function apply_rupaykg_role_defaults()
returns trigger
language plpgsql
as $$
declare
  defaults jsonb;
begin
  if new.permissions is null or jsonb_typeof(new.permissions) <> 'array' then
    new.permissions := '[]'::jsonb;
  end if;

  defaults := rupaykg_default_role_permissions(new.name);
  if jsonb_array_length(new.permissions) = 0 and jsonb_array_length(defaults) > 0 then
    new.permissions := defaults;
  end if;
  return new;
end;
$$;

drop trigger if exists roles_default_permissions_guard on roles;
create trigger roles_default_permissions_guard
before insert or update of name, permissions on roles
for each row execute function apply_rupaykg_role_defaults();

-- Repair roles created by the previous onboarding implementation.
update roles
set permissions = rupaykg_default_role_permissions(name)
where (permissions is null or jsonb_array_length(permissions) = 0)
  and jsonb_array_length(rupaykg_default_role_permissions(name)) > 0;

-- A verified membership must reference a role with an explicit permission set.
-- This prevents an onboarding approval from silently creating a verified but
-- unusable identity and makes authorization fail closed for unknown roles.
create or replace function enforce_verified_membership_role_permissions()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'VERIFIED' then
    if not exists (
      select 1
      from roles r
      where r.id = new.role_id
        and jsonb_typeof(r.permissions) = 'array'
        and jsonb_array_length(r.permissions) > 0
    ) then
      raise exception 'verified membership requires an explicit role permission set';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists verified_membership_permission_guard on organization_memberships;
create trigger verified_membership_permission_guard
before insert or update of status, role_id on organization_memberships
for each row execute function enforce_verified_membership_role_permissions();
