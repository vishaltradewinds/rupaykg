-- Read-only verification for migration 101.
-- Execute with the intended non-BYPASSRLS runtime role after applying the migration.
with protected(table_name) as (
  values
    ('organizations'),('roles'),('activities'),('obligations'),('audit_events'),
    ('field_devices'),('resource_flows'),('organization_memberships'),
    ('measurements'),('evidence'),('verifications'),('carbon_calculations'),
    ('mrv_observations'),('evidence_verification_requirements'),
    ('credentials'),('chain_of_custody_links'),('settlements')
)
select
  p.table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  count(pol.policyname) as policy_count
from protected p
left join pg_class c on c.relname=p.table_name
left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
left join pg_policies pol on pol.schemaname='public' and pol.tablename=p.table_name
group by p.table_name,c.relrowsecurity,c.relforcerowsecurity
order by p.table_name;

select
  current_user,
  coalesce((select rolsuper from pg_roles where rolname=current_user), true) as rolsuper,
  coalesce((select rolbypassrls from pg_roles where rolname=current_user), true) as rolbypassrls,
  has_function_privilege(current_user,'app.current_organization_id()','EXECUTE') as current_org_function_execute;

select 1 / case
  when coalesce((select rolsuper from pg_roles where rolname=current_user), true) = false
   and coalesce((select rolbypassrls from pg_roles where rolname=current_user), true) = false
   and not exists (
     select 1 from pg_class c
     join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public'
       and c.relname in (
         'organizations','roles','activities','obligations','audit_events',
         'field_devices','resource_flows','organization_memberships',
         'measurements','evidence','verifications','carbon_calculations',
         'mrv_observations','evidence_verification_requirements',
         'credentials','chain_of_custody_links','settlements'
       )
       and not c.relrowsecurity
   )
   and not exists (
     with protected(table_name) as (
       values
         ('organizations'),('roles'),('activities'),('obligations'),('audit_events'),
         ('field_devices'),('resource_flows'),('organization_memberships'),
         ('measurements'),('evidence'),('verifications'),('carbon_calculations'),
         ('mrv_observations'),('evidence_verification_requirements'),
         ('credentials'),('chain_of_custody_links'),('settlements')
     )
     select 1
     from protected p
     where not exists (
       select 1 from pg_policies pol
       where pol.schemaname='public'
         and pol.tablename=p.table_name
         and pol.cmd in ('SELECT','*')
     )
   )
  then 1 else 0
end as shakti_101_activation_assertion;
