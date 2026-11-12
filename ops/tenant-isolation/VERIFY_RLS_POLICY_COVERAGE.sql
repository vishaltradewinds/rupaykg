-- Shakti tenant-isolation policy coverage evidence.
-- Read-only. Execute after RLS activation using the intended runtime role.
-- This does not replace cross-tenant negative testing.

with protected(table_name) as (
  values
    ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
    ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
    ('organization_memberships'),('measurements'),('evidence'),('verifications'),
    ('carbon_calculations'),('mrv_observations'),
    ('evidence_verification_requirements'),('chain_of_custody_links'),('mrv_provenance_events')
),
coverage as (
  select
    p.table_name,
    count(pol.policyname) as policy_count,
    bool_or(pol.cmd in ('SELECT','ALL')) as has_select_policy,
    bool_or(pol.cmd in ('INSERT','UPDATE','DELETE','ALL')) as has_modify_policy,
    bool_or(pol.cmd in ('INSERT','ALL')) as has_insert_policy,
    bool_or(pol.cmd in ('UPDATE','ALL')) as has_update_policy
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
  coalesce(has_modify_policy, false) as has_modify_policy,
  coalesce(has_insert_policy, false) as has_insert_policy,
  coalesce(has_update_policy, false) as has_update_policy
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
        ('evidence_verification_requirements'),('chain_of_custody_links'),('mrv_provenance_events')
    )
    select 1
      from protected p
     where not exists (
       select 1
         from pg_policies pol
        where pol.schemaname = 'public'
          and pol.tablename = p.table_name
          and pol.cmd in ('SELECT','ALL')
     )
  )
  )
  and exists (
    select 1 from pg_policies pol
     where pol.schemaname = 'public'
       and pol.tablename = 'mrv_provenance_events'
       and pol.cmd = 'INSERT'
  )
  and exists (
    select 1 from pg_policies pol
     where pol.schemaname = 'public'
       and pol.tablename = 'mrv_provenance_events'
       and pol.cmd = 'UPDATE'
  )
  then 1
  else 0
end as tenant_policy_coverage_assertion;
