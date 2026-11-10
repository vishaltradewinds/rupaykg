-- Controlled Shakti live-state ledger reconciliation.
--
-- PURPOSE:
--   Reconcile schema_migrations when migrations 097-100 are demonstrably
--   already effective in the live database but were not recorded in the
--   migration ledger.
--
-- SAFETY:
--   * This script changes ONLY schema_migrations.
--   * It never enables/disables RLS.
--   * It never changes table ownership.
--   * It never creates/drops application tables, roles, functions, or policies.
--   * It aborts unless the live state matches the intended effects of 097-100.
--   * Run only in an approved production change window with a privileged
--     migration/DDL role and captured pre/post evidence.
--
-- This is a reconciliation timestamp, not a claim that 097-100 originally
-- executed at this time.

begin;

do $shakti$
declare
  protected_tables text[] := array[
    'organizations','roles','activities','obligations','credentials',
    'settlements','audit_events','resource_flows','field_devices',
    'organization_memberships','measurements','evidence','verifications',
    'carbon_calculations','mrv_observations',
    'evidence_verification_requirements','chain_of_custody_links'
  ];
  required_policies text[] := array[
    'organizations_tenant_select','organizations_tenant_modify',
    'roles_tenant_select','roles_tenant_modify',
    'activities_tenant_select','activities_tenant_modify',
    'obligations_tenant_select','obligations_tenant_modify',
    'credentials_tenant_select','credentials_tenant_modify',
    'settlements_tenant_select','settlements_tenant_modify',
    'audit_events_tenant_select','audit_events_tenant_insert',
    'resource_flows_tenant_select','resource_flows_tenant_modify',
    'field_devices_tenant_select','field_devices_tenant_modify',
    'organization_memberships_tenant_select',
    'measurements_tenant_select','measurements_tenant_modify',
    'evidence_tenant_select','evidence_tenant_insert','evidence_tenant_update',
    'verifications_tenant_select','verifications_tenant_insert',
    'carbon_calculations_tenant_select','carbon_calculations_tenant_modify',
    'mrv_observations_tenant_select',
    'evidence_requirements_tenant_select',
    'custody_tenant_select'
  ];
  protected_count integer;
  rls_count integer;
  owner_count integer;
  policy_count integer;
  expected_policy_count integer;
  existing_version text;
  expected_filename text;
begin
  if current_user in ('rupaykg_app_runtime','rupaykg_runtime_login') then
    raise exception 'SHAKTI reconciliation refused: runtime role cannot modify migration ledger';
  end if;

  select count(*), count(*) filter (where c.relrowsecurity),
         count(*) filter (where pg_get_userbyid(c.relowner) = 'rupaykg_ddl')
    into protected_count, rls_count, owner_count
  from unnest(protected_tables) as p(table_name)
  left join pg_class c
    on c.relname = p.table_name
  left join pg_namespace n
    on n.oid = c.relnamespace
   and n.nspname = 'public';

  if protected_count <> 17 or rls_count <> 17 or owner_count <> 17 then
    raise exception
      'SHAKTI reconciliation refused: protected table/RLS/owner state is not exactly 17/17/17 (%, %, %)',
      protected_count, rls_count, owner_count;
  end if;

  if exists (
    select 1 from pg_roles
    where rolname = 'rupaykg_app_runtime'
      and (rolsuper or rolbypassrls or rolcanlogin or rolinherit)
  ) then
    raise exception 'SHAKTI reconciliation refused: rupaykg_app_runtime role attributes are unsafe';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname = 'rupaykg_ddl'
      and not rolsuper and not rolbypassrls and not rolcanlogin and not rolinherit
  ) then
    raise exception 'SHAKTI reconciliation refused: rupaykg_ddl role is missing or unsafe';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname = 'rupaykg_runtime_login'
      and not rolsuper and not rolbypassrls and rolcanlogin
  ) then
    raise exception 'SHAKTI reconciliation refused: rupaykg_runtime_login role is missing or unsafe';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app'
      and p.proname in ('set_request_context','authenticate_bearer_session','is_verified_org_member')
      and (
        not p.prosecdef
        or has_function_privilege('public', p.oid, 'EXECUTE')
        or not has_function_privilege('rupaykg_app_runtime', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'SHAKTI reconciliation refused: governed SECURITY DEFINER function boundary is unsafe';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname='public'
    and tablename = any(protected_tables);

  select count(*) into expected_policy_count
  from unnest(required_policies);

  if policy_count <> expected_policy_count then
    raise exception
      'SHAKTI reconciliation refused: expected % protected policies, found %',
      expected_policy_count, policy_count;
  end if;

  foreach expected_filename in array array[
    '097_shakti_tenant_isolation_runtime_contract.sql',
    '098_shakti_authentication_bootstrap.sql',
    '099_shakti_rls_policy_foundation.sql',
    '100_shakti_production_ddl_runtime_role_split.sql'
  ] loop
    select filename into existing_version
    from schema_migrations
    where version = split_part(expected_filename, '_', 1);

    if existing_version is not null and existing_version <> expected_filename then
      raise exception
        'SHAKTI reconciliation refused: migration version % is recorded as %',
        split_part(expected_filename, '_', 1), existing_version;
    end if;
  end loop;

  -- Record the verified effective state. applied_at is the reconciliation
  -- time, not the historical execution time of the original migrations.
  insert into schema_migrations(version, filename)
  select v.version, v.filename
  from (
    values
      ('097','097_shakti_tenant_isolation_runtime_contract.sql'),
      ('098','098_shakti_authentication_bootstrap.sql'),
      ('099','099_shakti_rls_policy_foundation.sql'),
      ('100','100_shakti_production_ddl_runtime_role_split.sql')
  ) as v(version, filename)
  where not exists (
    select 1 from schema_migrations sm where sm.version=v.version
  );
end
$shakti$;

commit;
