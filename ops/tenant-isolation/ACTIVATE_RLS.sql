-- Shakti tenant-isolation controlled activation
-- IMPORTANT: execute only after the preflight has passed. This is a DDL
-- activation step and therefore must run as the controlled migration/DDL role
-- that owns the protected tables (or otherwise has ALTER TABLE privilege).
-- It must NOT be the application runtime role. The runtime role is used for
-- the subsequent negative acceptance test.
--
-- This script deliberately aborts before changing RLS if the executing role
-- is SUPERUSER, BYPASSRLS, or the application runtime role.

do $shakti$
declare
  v_super boolean;
  v_bypass boolean;
  v_member boolean;
begin
  select r.rolsuper, r.rolbypassrls
    into v_super, v_bypass
    from pg_roles r
   where r.rolname = current_user;

  select pg_has_role(current_user, 'rupaykg_app_runtime', 'member')
    into v_member;

  if v_super or v_bypass then
    raise exception 'TENANT_ISOLATION_ACTIVATION_BLOCKED: current role is SUPERUSER or BYPASSRLS';
  end if;

  if v_member or current_user = 'rupaykg_app_runtime' then
    raise exception 'TENANT_ISOLATION_ACTIVATION_BLOCKED: application runtime role cannot perform DDL activation';
  end if;
  if exists (
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
  ) then
    raise exception 'TENANT_ISOLATION_ACTIVATION_BLOCKED: every protected tenant table must have a SELECT RLS policy before activation';
  end if;

  if (
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
  ) <> 18 then
    raise exception 'TENANT_ISOLATION_ACTIVATION_BLOCKED: current DDL role does not own all protected tenant tables';
  end if;
end $shakti$;

alter table organizations enable row level security;
alter table roles enable row level security;
alter table activities enable row level security;
alter table obligations enable row level security;
alter table credentials enable row level security;
alter table settlements enable row level security;
alter table audit_events enable row level security;
alter table resource_flows enable row level security;
alter table field_devices enable row level security;
alter table organization_memberships enable row level security;
alter table measurements enable row level security;
alter table evidence enable row level security;
alter table verifications enable row level security;
alter table carbon_calculations enable row level security;
alter table mrv_observations enable row level security;
alter table evidence_verification_requirements enable row level security;
alter table chain_of_custody_links enable row level security;
alter table mrv_provenance_events enable row level security;

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
