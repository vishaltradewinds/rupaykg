-- DBA-only ownership and privilege bootstrap for controlled Shakti migrations 101-107.
-- Run once, before migrations 101-107, using the database owner login.
-- This does not enable RLS, change application credentials, or grant privileged
-- roles to application runtime. All temporary function-owner membership is
-- removed before this script completes.

do $bootstrap$
declare
  login_role name := session_user;
  table_name text;
  table_names text[] := array[
    'organizations','roles','activities','obligations','audit_events',
    'field_devices','resource_flows','organization_memberships',
    'measurements','evidence','verifications','carbon_calculations',
    'mrv_observations','evidence_verification_requirements',
    'credentials','chain_of_custody_links','settlements',
    'evidence_artifact_series','evidence_artifact_versions',
    'evidence_artifact_reviews','field_sync_envelopes','field_sync_cursors',
    'field_sync_conflicts','mrv_provenance_events',
    'organization_geography_scopes','registry_events','settlement_events',
    'environmental_attribute_claims','identities','identity_sessions'
  ];
begin
  if not exists (select 1 from pg_roles where rolname='rupaykg_ddl') then
    raise exception 'SHAKTI_DDL_ROLE_MISSING: apply migration 100 first';
  end if;

  if not exists (select 1 from pg_roles where rolname='rupaykg_app_runtime' and not rolsuper and not rolbypassrls and not rolcanlogin) then
    raise exception 'SHAKTI_RUNTIME_ROLE_UNSAFE_OR_MISSING';
  end if;

  if not exists (select 1 from pg_roles where rolname='rupaykg_security_definer') then
    execute 'create role rupaykg_security_definer nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication';
  end if;

  if exists (
    select 1 from pg_roles
    where rolname='rupaykg_security_definer'
      and (rolsuper or rolbypassrls or rolcanlogin or rolinherit or rolcreatedb or rolcreaterole or rolreplication)
  ) then
    raise exception 'SHAKTI_SECURITY_DEFINER_ROLE_UNSAFE';
  end if;

  -- The migration login needs an explicit SET edge to the non-login DDL role.
  execute format('grant rupaykg_ddl to %I with set true', login_role);
  execute 'grant usage, create on schema app, public to rupaykg_ddl';

  -- Reconcile ownership of all tenant tables plus the two identity source
  -- tables from which the isolated authentication functions read.
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'SHAKTI_REQUIRED_TABLE_MISSING: public.%', table_name;
    end if;
    execute format('alter table public.%I owner to rupaykg_ddl', table_name);
  end loop;

  -- Existing trigger functions are DDL-owned; migration 105/106 replaces them.
  execute 'alter function public.require_guardian_hcs_mrv_for_credential() owner to rupaykg_ddl';
  execute 'alter function public.prevent_credential_out_of_scope_issue() owner to rupaykg_ddl';
  execute 'alter function public.prevent_unverified_registry_transfer_recipient() owner to rupaykg_ddl';
  execute 'alter function public.prevent_unverified_credential_issue() owner to rupaykg_ddl';

  -- Transfer the existing authentication/context functions to the isolated
  -- NOLOGIN owner before migrations 101-103 replace their implementations.
  execute format('grant rupaykg_security_definer to %I', login_role);
  execute 'grant usage on schema app, public to rupaykg_security_definer';
  execute 'grant create on schema app to rupaykg_security_definer';
  execute 'alter function app.authenticate_bearer_session(text) owner to rupaykg_security_definer';
  execute 'alter function app.set_request_context(uuid, uuid) owner to rupaykg_security_definer';
  execute 'alter function app.current_identity_id() owner to rupaykg_security_definer';
  execute 'alter function app.current_organization_id() owner to rupaykg_security_definer';
  execute 'alter function app.is_verified_org_member(uuid) owner to rupaykg_security_definer';

  -- Preserve the existing authentication path during the short bootstrap-to-
  -- migration interval. Migration 104 resets and reasserts this exact surface.
  execute 'grant select (id, status, suspended_at) on public.identities to rupaykg_security_definer';
  execute 'grant select (id, identity_id, token_hash, expires_at, revoked_at) on public.identity_sessions to rupaykg_security_definer';
  execute 'grant select (identity_id, organization_id, role_id, status) on public.organization_memberships to rupaykg_security_definer';
  execute 'grant select (id, status) on public.organizations to rupaykg_security_definer';
  execute 'revoke create on schema app from rupaykg_security_definer';
  execute format('revoke rupaykg_security_definer from %I', login_role);
  execute 'comment on role rupaykg_security_definer is ''NOLOGIN/NOBYPASSRLS isolated owner for narrowly scoped SECURITY DEFINER functions; no application runtime membership.''';

  -- The DDL role is not allowed to inherit the function-owner role outside the
  -- controlled migration transaction. The runner enables this only temporarily.
  execute 'alter role rupaykg_ddl noinherit';
end
$bootstrap$;

-- Read-only completion checks. Expected: 30 tables owned by rupaykg_ddl,
-- 5 bootstrap functions owned by rupaykg_security_definer, and no runtime path
-- into the isolated owner.
select
  count(*) filter (where pg_get_userbyid(c.relowner)='rupaykg_ddl') as ddl_owned_tables,
  count(*) as required_tables
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relkind in ('r','p')
  and c.relname = any(array[
    'organizations','roles','activities','obligations','audit_events',
    'field_devices','resource_flows','organization_memberships',
    'measurements','evidence','verifications','carbon_calculations',
    'mrv_observations','evidence_verification_requirements',
    'credentials','chain_of_custody_links','settlements',
    'evidence_artifact_series','evidence_artifact_versions',
    'evidence_artifact_reviews','field_sync_envelopes','field_sync_cursors',
    'field_sync_conflicts','mrv_provenance_events',
    'organization_geography_scopes','registry_events','settlement_events',
    'environmental_attribute_claims','identities','identity_sessions'
  ]);

select
  count(*) filter (where p.proowner='rupaykg_security_definer'::regrole) as isolated_auth_functions,
  count(*) as expected_auth_functions
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app'
  and p.proname in ('authenticate_bearer_session','set_request_context','current_identity_id','current_organization_id','is_verified_org_member');

select
  pg_has_role('rupaykg_app_runtime','rupaykg_security_definer','MEMBER') as runtime_can_assume_security_definer,
  coalesce((select pg_has_role(runtime_login.oid,'rupaykg_security_definer'::regrole,'MEMBER') from pg_roles runtime_login where runtime_login.rolname='rupaykg_runtime_login'), false) as runtime_login_can_assume_security_definer,
  has_schema_privilege('rupaykg_security_definer','app','CREATE') as isolated_owner_has_app_create;
