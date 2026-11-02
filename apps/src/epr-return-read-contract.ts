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
  can_select_schemes: boolean;
  can_insert_schemes: boolean;
  can_update_schemes: boolean;
  can_delete_schemes: boolean;
  can_read_signing_keys: boolean;
  verifier_schema_usage: boolean;
  verifier_execute: boolean;
  verifier_valid: boolean;
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
  has_table_privilege(current_user,'public.epr_schemes','SELECT') as can_select_schemes,
  has_table_privilege(current_user,'public.epr_schemes','INSERT') as can_insert_schemes,
  has_table_privilege(current_user,'public.epr_schemes','UPDATE') as can_update_schemes,
  has_table_privilege(current_user,'public.epr_schemes','DELETE') as can_delete_schemes,
  has_table_privilege(current_user,'app_security.request_context_keys','SELECT') as can_read_signing_keys,
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
       and owner_role.rolname='rupaykg_security_definer'
  ) as verifier_valid
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
    !row.can_select_schemes ||
    row.can_insert_schemes ||
    row.can_update_schemes ||
    row.can_delete_schemes ||
    row.can_read_signing_keys ||
    !row.verifier_schema_usage ||
    !row.verifier_execute ||
    !row.verifier_valid
  ) {
    throw new Error("EPR_RETURN_READ_DATABASE_CONTRACT_INVALID");
  }
}
