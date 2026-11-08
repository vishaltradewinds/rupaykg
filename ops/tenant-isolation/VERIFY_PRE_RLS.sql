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
    'evidence_verification_requirements','chain_of_custody_links'
  )
order by c.relname;

select
  current_user = 'rupaykg_app_runtime'
  or pg_has_role(current_user, 'rupaykg_app_runtime', 'member') as runtime_role_membership;
