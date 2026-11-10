-- Shakti live-state drift audit. READ-ONLY. Never enables RLS, changes ownership,
-- creates roles, applies migrations, or changes application data.
-- Run against the authoritative production endpoint with a governed audit role.

select current_database() as database_name,
       current_user as current_user,
       session_user as session_user,
       current_setting('server_version_num') as server_version_num;

select coalesce(max(version),'') as max_schema_version,
       count(*) filter (where version in ('097','098','099','100')) as shakti_versions_recorded
from schema_migrations;

select version, filename, applied_at
from schema_migrations
where version in ('097','098','099','100')
order by version;

with protected(table_name) as (
  values
    ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
    ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
    ('organization_memberships'),('measurements'),('evidence'),('verifications'),
    ('carbon_calculations'),('mrv_observations'),
    ('evidence_verification_requirements'),('chain_of_custody_links')
)
select
  count(*) as protected_table_count,
  count(*) filter (where c.relrowsecurity) as rls_enabled_count,
  count(*) filter (where c.relforcerowsecurity) as rls_forced_count,
  count(*) filter (where pg_get_userbyid(c.relowner) = 'rupaykg_ddl') as owned_by_legacy_ddl_count,
  count(*) filter (where pg_get_userbyid(c.relowner) = 'rupaykg_ddl_migration') as owned_by_controlled_migration_count,
  count(*) filter (where pg_get_userbyid(c.relowner) = 'rupaykg_app_runtime') as owned_by_runtime_count
from protected p
left join pg_class c on c.relname = p.table_name
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public';

select rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
from pg_roles
where rolname in (
  'rupaykg','rupaykg_runtime_login','rupaykg_app_runtime',
  'rupaykg_ddl','rupaykg_ddl_migration'
)
order by rolname;

select n.nspname, p.proname, p.prosecdef,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
       has_function_privilege('rupaykg_app_runtime', p.oid, 'EXECUTE') as runtime_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app'
  and p.proname in (
    'set_request_context',
    'authenticate_bearer_session',
    'is_verified_org_member'
  )
order by p.proname;

with protected(table_name) as (
  values
    ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
    ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
    ('organization_memberships'),('measurements'),('evidence'),('verifications'),
    ('carbon_calculations'),('mrv_observations'),
    ('evidence_verification_requirements'),('chain_of_custody_links')
)
select p.tablename, count(*) filter (where p.cmd in ('SELECT','*')) as select_policy_count
from protected t
left join pg_policies p on p.schemaname='public' and p.tablename=t.table_name
group by p.tablename
order by p.tablename;
