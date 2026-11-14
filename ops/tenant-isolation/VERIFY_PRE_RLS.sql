-- Shakti tenant-isolation preflight
-- Run against the exact production database before RLS activation.
-- This script is read-only and must be executed with the intended application
-- runtime login role, not the migration/owner role.

select current_user, session_user;

select
  rolname,
  rolsuper,
  rolbypassrls,
  rolinherit,
  rolcanlogin
from pg_roles
where rolname = current_user;

select
  current_setting('app.identity_id', true) as identity_id,
  current_setting('app.organization_id', true) as organization_id;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
  )
order by c.relname;

select
  current_user = 'rupaykg_app_runtime'
  or pg_has_role(current_user, 'rupaykg_app_runtime', 'member') as runtime_role_membership;

-- A runtime login that owns a protected table can bypass RLS unless the table
-- is explicitly forced into RLS. The intended application role must therefore
-- not own any protected table.
select
  c.relname as table_name,
  pg_get_userbyid(c.relowner) as table_owner,
  (pg_get_userbyid(c.relowner) = current_user) as runtime_role_is_table_owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
  )
order by c.relname;

select
  count(*) = 0 as runtime_role_owns_no_protected_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
  )
  and pg_get_userbyid(c.relowner) = current_user;


-- Fail-closed assertion: any unsafe runtime state causes division-by-zero.
select 1 / case
  when coalesce((select rolsuper from pg_roles where rolname = current_user), true) = false
   and coalesce((select rolbypassrls from pg_roles where rolname = current_user), true) = false
   and (
     current_user = 'rupaykg_app_runtime'
     or pg_has_role(current_user, 'rupaykg_app_runtime', 'member')
   )
   and not exists (
     select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'organizations','roles','activities','obligations','credentials',
          'settlements','audit_events','resource_flows','field_devices',
          'organization_memberships','measurements','evidence','verifications',
          'carbon_calculations','mrv_observations',
          'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
        )
        and pg_get_userbyid(c.relowner) = current_user
   )
  then 1
  else 0
end as tenant_isolation_preflight_assertion;


select
  table_name,
  has_table_privilege(current_user, table_name, 'SELECT') as can_select,
  has_table_privilege(current_user, table_name, 'INSERT') as can_insert,
  has_table_privilege(current_user, table_name, 'UPDATE') as can_update,
  has_table_privilege(current_user, table_name, 'DELETE') as can_delete
from (values
  ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
  ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
  ('organization_memberships'),('measurements'),('evidence'),('verifications'),
  ('carbon_calculations'),('mrv_observations'),
  ('evidence_verification_requirements'),('chain_of_custody_links'),('mrv_provenance_events')
) as protected(table_name)
order by table_name;

