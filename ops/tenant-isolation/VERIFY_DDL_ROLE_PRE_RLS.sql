-- Shakti tenant-isolation DDL-role preflight
-- Read-only. Run with the controlled migration/DDL role immediately before
-- ACTIVATE_RLS.sql. This proves the role owns all protected tenant tables and
-- is not SUPERUSER, BYPASSRLS, or the application runtime role.

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
  current_user = 'rupaykg_app_runtime'
  as runtime_role_membership;

select
  c.relname as table_name,
  pg_get_userbyid(c.relowner) as table_owner,
  (pg_get_userbyid(c.relowner) = current_user) as owned_by_current_role
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links'
  )
order by c.relname;

select 1 / case
  when current_user = session_user
   and current_user = 'rupaykg_ddl_migration'
   and coalesce((select rolcanlogin from pg_roles where rolname = current_user), false) = true
   and coalesce((select rolinherit from pg_roles where rolname = current_user), true) = false
   and coalesce((select rolsuper from pg_roles where rolname = current_user), true) = false
   and coalesce((select rolbypassrls from pg_roles where rolname = current_user), true) = false
   and current_user <> 'rupaykg_app_runtime'
   and pg_has_role(current_user, 'rupaykg_app_runtime', 'member')
   and (
     select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in (
         'organizations','roles','activities','obligations','credentials',
         'settlements','audit_events','resource_flows','field_devices',
         'organization_memberships','measurements','evidence','verifications',
         'carbon_calculations','mrv_observations',
         'evidence_verification_requirements','chain_of_custody_links'
       )
       and pg_get_userbyid(c.relowner) = current_user
   ) = 17
  then 1
  else 0
end as tenant_ddl_role_preflight_assertion;

