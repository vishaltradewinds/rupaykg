-- Shakti tenant-isolation policy coverage evidence.
-- Read-only. Execute after RLS activation using the intended runtime role.
-- This does not replace cross-tenant negative testing.

with protected(table_name) as (
  values
    ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
    ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
    ('organization_memberships'),('measurements'),('evidence'),('verifications'),
    ('carbon_calculations'),('mrv_observations'),
    ('evidence_verification_requirements'),('chain_of_custody_links'),('evidence_artifact_series'),('evidence_artifact_versions'),('evidence_artifact_reviews'),('field_sync_envelopes'),('field_sync_cursors'),('field_sync_conflicts'),('mrv_provenance_events'),('organization_geography_scopes'),('registry_events'),('settlement_events'),('environmental_attribute_claims'),('report_runs')
),
coverage as (
  select
    p.table_name,
    count(pol.policyname) as policy_count,
    bool_or(pol.cmd in ('SELECT','*')) as has_select_policy,
    bool_or(pol.cmd in ('INSERT','UPDATE','DELETE','*')) as has_modify_policy
  from protected p
  left join pg_policies pol
    on pol.schemaname = 'public'
   and pol.tablename = p.table_name
  group by p.table_name
)
select
  table_name,
  policy_count,
  coalesce(has_select_policy, false) as has_select_policy,
  coalesce(has_modify_policy, false) as has_modify_policy
from coverage
order by table_name;

select 1 / case
  when not exists (
    with protected(table_name) as (
      values
        ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
        ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
        ('organization_memberships'),('measurements'),('evidence'),('verifications'),
        ('carbon_calculations'),('mrv_observations'),
        ('evidence_verification_requirements'),('chain_of_custody_links'),('evidence_artifact_series'),('evidence_artifact_versions'),('evidence_artifact_reviews'),('field_sync_envelopes'),('field_sync_cursors'),('field_sync_conflicts'),('mrv_provenance_events'),('organization_geography_scopes'),('registry_events'),('settlement_events'),('environmental_attribute_claims'),('report_runs')
    )
    select 1
      from protected p
     where not exists (
       select 1
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = p.table_name
          and c.relrowsecurity
     )
  )
  and not exists (
    with protected(table_name) as (
      values
        ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
        ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
        ('organization_memberships'),('measurements'),('evidence'),('verifications'),
        ('carbon_calculations'),('mrv_observations'),
        ('evidence_verification_requirements'),('chain_of_custody_links'),('evidence_artifact_series'),('evidence_artifact_versions'),('evidence_artifact_reviews'),('field_sync_envelopes'),('field_sync_cursors'),('field_sync_conflicts'),('mrv_provenance_events'),('organization_geography_scopes'),('registry_events'),('settlement_events'),('environmental_attribute_claims'),('report_runs')
    )
    select 1
      from protected p
     where not exists (
       select 1
         from pg_policies pol
        where pol.schemaname = 'public'
          and pol.tablename = p.table_name
          and pol.cmd in ('SELECT','*')
     )
  )
  then 1
  else 0
end as tenant_policy_coverage_assertion;
