import type { Pool } from "pg";

type EprReturnReadContractRow = {
  connection_role: string;
  runtime_role_valid: boolean;
  no_role_memberships: boolean;
  returns_rls_enabled: boolean;
  returns_force_rls: boolean;
  returns_owner: string;
  policy_count: string | number;
  expected_policy_count: string | number;
  can_select_returns: boolean;
  can_insert_returns: boolean;
  can_update_returns: boolean;
  can_delete_returns: boolean;
  can_truncate_returns: boolean;
  can_reference_returns: boolean;
  can_trigger_returns: boolean;
  can_select_schemes: boolean;
  can_insert_schemes: boolean;
  can_update_schemes: boolean;
  can_delete_schemes: boolean;
  can_truncate_schemes: boolean;
  can_reference_schemes: boolean;
  can_trigger_schemes: boolean;
  can_read_signing_keys: boolean;
  can_insert_signing_keys: boolean;
  can_update_signing_keys: boolean;
  can_delete_signing_keys: boolean;
  can_truncate_signing_keys: boolean;
  can_reference_signing_keys: boolean;
  can_trigger_signing_keys: boolean;
  can_create_public: boolean;
  can_create_security_schema: boolean;
  can_create_database: boolean;
  verifier_schema_usage: boolean;
  verifier_execute: boolean;
  verifier_valid: boolean;
  can_read_memberships: boolean;
  can_read_roles: boolean;
  permission_schema_usage: boolean;
  permission_helper_execute: boolean;
  permission_helper_public_execute: boolean;
  permission_helper_valid: boolean;
  permission_owner_valid: boolean;
  permission_owner_no_memberships: boolean;
  session_resolver_execute: boolean;
  session_resolver_public_execute: boolean;
  session_resolver_valid: boolean;
};

const EPR_RETURN_READ_CONTRACT_SQL = `select
  current_user as connection_role,
  (r.rolcanlogin and not r.rolsuper and not r.rolbypassrls
    and not r.rolcreatedb and not r.rolcreaterole
    and not r.rolinherit and not r.rolreplication) as runtime_role_valid,
  not exists (
    select 1 from pg_catalog.pg_auth_members m
     where m.member = r.oid
  ) as no_role_memberships,
  epr_table.relrowsecurity as returns_rls_enabled,
  epr_table.relforcerowsecurity as returns_force_rls,
  pg_catalog.pg_get_userbyid(epr_table.relowner) as returns_owner,
  (select count(*) from pg_catalog.pg_policies
    where schemaname='public' and tablename='epr_returns') as policy_count,
  (select count(*) from pg_catalog.pg_policies
    where schemaname='public' and tablename='epr_returns'
      and cmd='SELECT'
      and roles @> ARRAY['rupaykg_app_runtime']::name[]
      and coalesce(qual,'') ilike '%organization_id%'
      and coalesce(qual,'') ilike '%current_request_context_claims%') as expected_policy_count,
  has_table_privilege(current_user,'public.epr_returns','SELECT') as can_select_returns,
  has_table_privilege(current_user,'public.epr_returns','INSERT') as can_insert_returns,
  has_table_privilege(current_user,'public.epr_returns','UPDATE') as can_update_returns,
  has_table_privilege(current_user,'public.epr_returns','DELETE') as can_delete_returns,
  has_table_privilege(current_user,'public.epr_returns','TRUNCATE') as can_truncate_returns,
  has_table_privilege(current_user,'public.epr_returns','REFERENCES') as can_reference_returns,
  has_table_privilege(current_user,'public.epr_returns','TRIGGER') as can_trigger_returns,
  has_table_privilege(current_user,'public.epr_schemes','SELECT') as can_select_schemes,
  has_table_privilege(current_user,'public.epr_schemes','INSERT') as can_insert_schemes,
  has_table_privilege(current_user,'public.epr_schemes','UPDATE') as can_update_schemes,
  has_table_privilege(current_user,'public.epr_schemes','DELETE') as can_delete_schemes,
  has_table_privilege(current_user,'public.epr_schemes','TRUNCATE') as can_truncate_schemes,
  has_table_privilege(current_user,'public.epr_schemes','REFERENCES') as can_reference_schemes,
  has_table_privilege(current_user,'public.epr_schemes','TRIGGER') as can_trigger_schemes,
  has_table_privilege(current_user,'app_security.request_context_keys','SELECT') as can_read_signing_keys,
  has_table_privilege(current_user,'app_security.request_context_keys','INSERT') as can_insert_signing_keys,
  has_table_privilege(current_user,'app_security.request_context_keys','UPDATE') as can_update_signing_keys,
  has_table_privilege(current_user,'app_security.request_context_keys','DELETE') as can_delete_signing_keys,
  has_table_privilege(current_user,'app_security.request_context_keys','TRUNCATE') as can_truncate_signing_keys,
  has_table_privilege(current_user,'app_security.request_context_keys','REFERENCES') as can_reference_signing_keys,
  has_table_privilege(current_user,'app_security.request_context_keys','TRIGGER') as can_trigger_signing_keys,
  has_schema_privilege(current_user,'public','CREATE') as can_create_public,
  has_schema_privilege(current_user,'app_security','CREATE') as can_create_security_schema,
  has_database_privilege(current_user,current_database(),'CREATE') as can_create_database,
  has_schema_privilege(current_user,'app_security','USAGE') as verifier_schema_usage,
  has_function_privilege(current_user,'app_security.current_request_context_claims()','EXECUTE') as verifier_execute,
  exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      join pg_catalog.pg_roles owner_role on owner_role.oid=p.proowner
     where n.nspname='app_security'
       and p.proname='current_request_context_claims'
       and p.pronargs=0
       and p.prosecdef
       and p.proconfig @> ARRAY['search_path=pg_catalog, app_security']
       and owner_role.rolname='rupaykg_security_definer'
  ) as verifier_valid,
  has_table_privilege(current_user,'public.organization_memberships','SELECT') as can_read_memberships,
  has_table_privilege(current_user,'public.roles','SELECT') as can_read_roles,
  has_schema_privilege(current_user,'auth_private','USAGE') as permission_schema_usage,
  has_function_privilege(current_user,'auth_private.has_organization_permission(uuid,uuid,text[])','EXECUTE') as permission_helper_execute,
  exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
     where n.nspname='auth_private'
       and p.proname='has_organization_permission'
       and p.pronargs=3
       and exists (
         select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
          where acl.grantee=0 and acl.privilege_type='EXECUTE'
       )
  ) as permission_helper_public_execute,
  exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      join pg_catalog.pg_roles owner_role on owner_role.oid=p.proowner
     where n.nspname='auth_private'
       and p.proname='has_organization_permission'
       and p.pronargs=3
       and p.prosecdef
       and p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp']
       and owner_role.rolname='rupaykg_auth_owner'
       and p.prosrc ilike '%current_request_context_claims%'
       and p.prosrc ilike '%organization_memberships%'
       and p.prosrc ilike '%role_row.organization_id%'
       and p.prosrc ilike '%permissions%'
  ) as permission_helper_valid,
  exists (
    select 1 from pg_catalog.pg_roles owner_role
     where owner_role.rolname='rupaykg_auth_owner'
       and not owner_role.rolcanlogin and not owner_role.rolsuper
       and not owner_role.rolbypassrls and not owner_role.rolcreatedb
       and not owner_role.rolcreaterole and not owner_role.rolinherit
       and not owner_role.rolreplication
  ) as permission_owner_valid,
  not exists (
    select 1 from pg_catalog.pg_auth_members membership
    join pg_catalog.pg_roles owner_role on owner_role.oid=membership.member
     where owner_role.rolname='rupaykg_auth_owner'
  ) as permission_owner_no_memberships,
  has_function_privilege(current_user,'auth_private.resolve_session(text)','EXECUTE') as session_resolver_execute,
  exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
     where n.nspname='auth_private'
       and p.proname='resolve_session'
       and p.pronargs=1
       and exists (
         select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
          where acl.grantee=0 and acl.privilege_type='EXECUTE'
       )
  ) as session_resolver_public_execute,
  exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      join pg_catalog.pg_roles owner_role on owner_role.oid=p.proowner
     where n.nspname='auth_private'
       and p.proname='resolve_session'
       and p.pronargs=1
       and p.prosecdef
       and p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp']
       and owner_role.rolname='rupaykg_auth_owner'
       and p.prosrc ilike '%identity_sessions%'
       and p.prosrc ilike '%revoked_at%'
       and p.prosrc ilike '%expires_at%'
       and p.prosrc ilike '%suspended_at%'
  ) as session_resolver_valid
from pg_catalog.pg_roles r
join pg_catalog.pg_class epr_table
  on epr_table.oid = 'public.epr_returns'::regclass
where r.rolname=current_user`;

export async function assertEprReturnReadDatabaseContract(pool: Pick<Pool, "query">): Promise<void> {
  const result = await pool.query<EprReturnReadContractRow>(EPR_RETURN_READ_CONTRACT_SQL);
  const row = result.rows[0];
  if (
    !row ||
    row.connection_role !== "rupaykg_app_runtime" ||
    !row.runtime_role_valid ||
    !row.no_role_memberships ||
    !row.returns_rls_enabled ||
    !row.returns_force_rls ||
    row.returns_owner === "rupaykg_app_runtime" ||
    Number(row.policy_count) !== 1 ||
    Number(row.expected_policy_count) !== 1 ||
    !row.can_select_returns ||
    row.can_insert_returns ||
    row.can_update_returns ||
    row.can_delete_returns ||
    row.can_truncate_returns ||
    row.can_reference_returns ||
    row.can_trigger_returns ||
    !row.can_select_schemes ||
    row.can_insert_schemes ||
    row.can_update_schemes ||
    row.can_delete_schemes ||
    row.can_truncate_schemes ||
    row.can_reference_schemes ||
    row.can_trigger_schemes ||
    row.can_read_signing_keys ||
    row.can_insert_signing_keys ||
    row.can_update_signing_keys ||
    row.can_delete_signing_keys ||
    row.can_truncate_signing_keys ||
    row.can_reference_signing_keys ||
    row.can_trigger_signing_keys ||
    row.can_create_public ||
    row.can_create_security_schema ||
    row.can_create_database ||
    !row.verifier_schema_usage ||
    !row.verifier_execute ||
    !row.verifier_valid ||
    row.can_read_memberships ||
    row.can_read_roles ||
    !row.permission_schema_usage ||
    !row.permission_helper_execute ||
    row.permission_helper_public_execute ||
    !row.permission_helper_valid ||
    !row.permission_owner_valid ||
    !row.permission_owner_no_memberships ||
    !row.session_resolver_execute ||
    row.session_resolver_public_execute ||
    !row.session_resolver_valid
  ) {
    throw new Error("EPR_RETURN_READ_DATABASE_CONTRACT_INVALID");
  }
}
