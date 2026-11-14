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
  or pg_has_role(current_user, 'rupaykg_app_runtime', 'member')
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
    'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
  )
order by c.relname;

select 1 / case
  when coalesce((select rolsuper from pg_roles where rolname = current_user), true) = false
   and coalesce((select rolbypassrls from pg_roles where rolname = current_user), true) = false
   and current_user <> 'rupaykg_app_runtime'
   and not pg_has_role(current_user, 'rupaykg_app_runtime', 'member')
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
         'evidence_verification_requirements','chain_of_custody_links','mrv_provenance_events'
       )
       and pg_get_userbyid(c.relowner) = current_user
   ) = 18
  then 1
  else 0
end as tenant_ddl_role_preflight_assertion;

-- The verifier integrity triggers need only these identity columns.
-- This must be column-level access, not broad SELECT on identities.
select 1 / case
  when has_column_privilege(current_user, 'public.identities', 'id', 'SELECT')
   and has_column_privilege(current_user, 'public.identities', 'status', 'SELECT')
   and has_column_privilege(current_user, 'public.identities', 'suspended_at', 'SELECT')
  then 1 else 0
end as ddl_identity_lookup_privilege_assertion;

