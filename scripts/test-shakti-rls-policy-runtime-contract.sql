-- Shakti disposable RLS policy runtime contract.
-- This validates the policy objects installed in the disposable PostgreSQL database.
-- It intentionally does not touch production Neon.

\set ON_ERROR_STOP on

select case
  when count(*) = 5
   and bool_and(c.relrowsecurity)
  then 1 else 1/0
end as protected_core_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'activities',
    'measurements',
    'evidence',
    'carbon_calculations',
    'epr_obligations'
  );

select case
  when count(*) = 5
   and bool_and(p.cmd = '*')
  then 1 else 1/0
end as protected_core_policy_count
from pg_policies p
where p.schemaname = 'public'
  and p.policyname in (
    'shakti_activities_tenant',
    'shakti_measurements_tenant',
    'shakti_evidence_tenant',
    'shakti_carbon_calculations_tenant',
    'shakti_epr_obligations_tenant'
  );

select case
  when count(*) = 5
   and bool_and(
     coalesce(qual, '') ilike '%app.current_organization_id()%'
     and coalesce(with_check, '') ilike '%app.current_organization_id()%'
   )
  then 1 else 1/0
end as policy_context_binding
from pg_policies
where schemaname = 'public'
  and policyname in (
    'shakti_activities_tenant',
    'shakti_measurements_tenant',
    'shakti_evidence_tenant',
    'shakti_carbon_calculations_tenant',
    'shakti_epr_obligations_tenant'
  );

select case
  when exists (
    select 1
    from pg_roles
    where rolname = 'rupaykg_app_runtime'
      and rolcanlogin
      and not rolsuper
      and not rolbypassrls
  )
  then 1 else 1/0
end as runtime_role_is_non_bypassrls;

select case
  when not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'shakti_activities_tenant',
        'shakti_measurements_tenant',
        'shakti_evidence_tenant',
        'shakti_carbon_calculations_tenant',
        'shakti_epr_obligations_tenant'
      )
      and (
        coalesce(qual, '') ilike '%current_user%'
        or coalesce(with_check, '') ilike '%current_user%'
      )
  )
  then 1 else 1/0
end as policies_do_not_depend_on_current_user_identity;

select 'Shakti disposable RLS policy runtime contract PASSED' as result;
