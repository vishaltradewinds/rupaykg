-- Shakti tenant-isolation migration schema compatibility preflight.
-- Read-only. Run against the target database before applying migrations 097-099.
-- Checks that migration references match the canonical schema.
--
-- Important: do not require the hardened 097 function to already exist.
-- Migration 097 establishes that function and its hardened search_path.

with required_tables(table_name) as (
  values ('organizations'),('roles'),('activities'),('obligations'),('credentials'),('settlements'),('audit_events'),('resource_flows'),('field_devices'),('organization_memberships'),('measurements'),('evidence'),('verifications'),('carbon_calculations'),('mrv_observations'),('evidence_verification_requirements'),('chain_of_custody_links'),('identity_sessions'),('identities')
), required_columns(table_name,column_name) as (
  values ('organizations','id'),('roles','organization_id'),('activities','organization_id'),('obligations','organization_id'),('credentials','issuer_organization_id'),('settlements','payer_id'),('settlements','payee_id'),('audit_events','organization_id'),('resource_flows','organization_id'),('field_devices','organization_id'),('organization_memberships','identity_id'),('organization_memberships','organization_id'),('organization_memberships','status'),('measurements','activity_id'),('evidence','activity_id'),('verifications','activity_id'),('carbon_calculations','activity_id'),('mrv_observations','activity_id'),('evidence_verification_requirements','activity_id'),('chain_of_custody_links','resource_flow_id'),('identity_sessions','identity_id'),('identity_sessions','token_hash'),('identity_sessions','revoked_at'),('identity_sessions','expires_at'),('identities','id'),('identities','status'),('identities','suspended_at')
)
select 'required_tables_present' as check_name, count(*) = (select count(*) from required_tables) as pass, count(*) as found, (select count(*) from required_tables) as required from required_tables rt join information_schema.tables t on t.table_schema='public' and t.table_name=rt.table_name;

select 'required_columns_present' as check_name, count(*) = (select count(*) from required_columns) as pass, count(*) as found, (select count(*) from required_columns) as required from required_columns rc join information_schema.columns c on c.table_schema='public' and c.table_name=rc.table_name and c.column_name=rc.column_name;

select 'preexisting_tenant_context_function_shape' as check_name,
       count(*) = 1 as pass,
       count(*) as matching_functions
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app'
  and p.proname='set_request_context'
  and pg_get_function_identity_arguments(p.oid)='p_identity_id uuid, p_organization_id uuid';

select 'tenant_isolation_policies_absent_before_foundation' as check_name,
       count(*) = 0 as pass,
       count(*) as policy_count
from pg_policies
where schemaname='public'
  and tablename in ('organizations','roles','activities','obligations','credentials','settlements','audit_events','resource_flows','field_devices','organization_memberships','measurements','evidence','verifications','carbon_calculations','mrv_observations','evidence_verification_requirements','chain_of_custody_links');
