-- Shakti tenant-isolation SECURITY DEFINER boundary acceptance.
-- Read-only. Run with the intended non-BYPASSRLS application runtime login.
-- Fail closed if any privileged tenant function is missing, publicly
-- executable, missing the hardened search_path, or callable by an unsafe role.

with expected(function_name, identity_args) as (
  values
    ('app.set_request_context', 'p_identity_id uuid, p_organization_id uuid, p_context_token uuid'),
    ('app.is_verified_org_member', 'target_organization_id uuid'),
    ('app.authenticate_bearer_session', 'p_token_hash text'),
    ('app.current_identity_id', ''),
    ('app.current_organization_id', ''),
    ('app.current_credential_owner_id', 'target_credential_id uuid'),
    ('app.organization_has_verified_members', 'target_organization_id uuid'),
    ('app.is_verified_organization', 'target_organization_id uuid'),
    ('app.activity_belongs_to_organization', 'target_activity_id uuid, target_organization_id uuid'),
    ('app.activity_has_verified_geography_scope', 'target_activity_id uuid, target_organization_id uuid'),
    ('app.credential_has_verified_mrv_provenance', 'target_activity_id uuid, target_verification_id uuid'),
    ('app.credential_is_acceptance_fixture', 'target_activity_id uuid, target_verification_id uuid'),
    ('app.review_authority_allowed', 'p_identity_id uuid, p_approval_level text, p_geography_id uuid, p_geography_kind geography_kind'),
    ('app.onboarding_review_queue', 'p_identity_id uuid'),
    ('app.onboarding_verify_legal', 'p_identity_id uuid, p_application_id uuid, p_status text, p_note text'),
    ('app.onboarding_decide', 'p_identity_id uuid, p_application_id uuid, p_action text, p_note text')
),
actual as (
  select
    e.function_name,
    e.identity_args,
    count(p.oid) as function_count,
    bool_or(p.prosecdef) as security_definer,
    bool_or(coalesce(p.proconfig::text, '') like '%search_path=pg_catalog, public, app%') as hardened_search_path
  from expected e
  left join pg_proc p
    on p.pronamespace = 'app'::regnamespace
   and p.proname = split_part(e.function_name, '.', 2)
   and (e.identity_args = '' or pg_get_function_identity_arguments(p.oid) = e.identity_args)
  group by e.function_name, e.identity_args
)
select *
from actual
order by function_name;

select
  has_function_privilege(current_user, 'app.set_request_context(uuid,uuid,uuid)', 'EXECUTE')
    as set_context_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.set_request_context(uuid,uuid,uuid)'::regprocedure)
    as set_context_public_execute,
  has_function_privilege(current_user, 'app.is_verified_org_member(uuid)', 'EXECUTE')
    as membership_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.is_verified_org_member(uuid)'::regprocedure)
    as membership_public_execute,
  has_function_privilege(current_user, 'app.authenticate_bearer_session(text)', 'EXECUTE')
    as bootstrap_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.authenticate_bearer_session(text)'::regprocedure)
    as bootstrap_public_execute,
  has_function_privilege(current_user, 'app.current_identity_id()', 'EXECUTE')
    as current_identity_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_identity_id()'::regprocedure)
    as current_identity_public_execute,
  has_function_privilege(current_user, 'app.current_organization_id()', 'EXECUTE')
    as current_organization_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_organization_id()'::regprocedure)
    as current_organization_public_execute,
  has_function_privilege(current_user, 'app.current_credential_owner_id(uuid)', 'EXECUTE')
    as current_credential_owner_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_credential_owner_id(uuid)'::regprocedure)
    as current_credential_owner_public_execute,
  has_function_privilege(current_user, 'app.organization_has_verified_members(uuid)', 'EXECUTE')
    as organization_readiness_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.organization_has_verified_members(uuid)'::regprocedure)
    as organization_readiness_public_execute,
  has_function_privilege(current_user, 'app.is_verified_organization(uuid)', 'EXECUTE')
    as verified_organization_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.is_verified_organization(uuid)'::regprocedure)
    as verified_organization_public_execute,
  has_function_privilege(current_user, 'app.activity_belongs_to_organization(uuid,uuid)', 'EXECUTE')
    as activity_org_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.activity_belongs_to_organization(uuid,uuid)'::regprocedure)
    as activity_org_public_execute,
  has_function_privilege(current_user, 'app.activity_has_verified_geography_scope(uuid,uuid)', 'EXECUTE')
    as activity_geography_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.activity_has_verified_geography_scope(uuid,uuid)'::regprocedure)
    as activity_geography_public_execute,
  has_function_privilege(current_user, 'app.credential_has_verified_mrv_provenance(uuid,uuid)', 'EXECUTE')
    as credential_mrv_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.credential_has_verified_mrv_provenance(uuid,uuid)'::regprocedure)
    as credential_mrv_public_execute,
  has_function_privilege(current_user, 'app.credential_is_acceptance_fixture(uuid,uuid)', 'EXECUTE')
    as credential_fixture_runtime_execute,
  (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.credential_is_acceptance_fixture(uuid,uuid)'::regprocedure)
    as credential_fixture_public_execute;

select 1 / case
  when current_user <> 'rupaykg_app_runtime'
   and coalesce((select rolsuper from pg_roles where rolname = current_user), true) = false
   and coalesce((select rolbypassrls from pg_roles where rolname = current_user), true) = false
   and (
     select count(*)
     from pg_proc p
     where p.pronamespace = 'app'::regnamespace
       and (
         (p.proname = 'set_request_context'
          and pg_get_function_identity_arguments(p.oid) = 'p_identity_id uuid, p_organization_id uuid, p_context_token uuid')
         or (p.proname = 'is_verified_org_member'
          and pg_get_function_identity_arguments(p.oid) = 'target_organization_id uuid')
         or (p.proname = 'authenticate_bearer_session'
          and pg_get_function_identity_arguments(p.oid) = 'p_token_hash text')
         or (p.proname = 'current_identity_id'
          and pg_get_function_identity_arguments(p.oid) = '')
         or (p.proname = 'current_organization_id'
          and pg_get_function_identity_arguments(p.oid) = '')
         or (p.proname = 'current_credential_owner_id'
          and pg_get_function_identity_arguments(p.oid) = 'target_credential_id uuid')
         or (p.proname = 'organization_has_verified_members'
          and pg_get_function_identity_arguments(p.oid) = 'target_organization_id uuid')
         or (p.proname = 'is_verified_organization'
          and pg_get_function_identity_arguments(p.oid) = 'target_organization_id uuid')
         or (p.proname = 'activity_belongs_to_organization'
          and pg_get_function_identity_arguments(p.oid) = 'target_activity_id uuid, target_organization_id uuid')
         or (p.proname = 'activity_has_verified_geography_scope'
          and pg_get_function_identity_arguments(p.oid) = 'target_activity_id uuid, target_organization_id uuid')
         or (p.proname = 'credential_has_verified_mrv_provenance'
          and pg_get_function_identity_arguments(p.oid) = 'target_activity_id uuid, target_verification_id uuid')
         or (p.proname = 'credential_is_acceptance_fixture'
          and pg_get_function_identity_arguments(p.oid) = 'target_activity_id uuid, target_verification_id uuid')
       )
       and p.prosecdef
       and coalesce(p.proconfig::text, '') like '%search_path=pg_catalog, public, app%'
   ) = 12
   and has_function_privilege(current_user, 'app.set_request_context(uuid,uuid,uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.is_verified_org_member(uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.authenticate_bearer_session(text)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.current_identity_id()', 'EXECUTE')
   and has_function_privilege(current_user, 'app.current_organization_id()', 'EXECUTE')
   and has_function_privilege(current_user, 'app.current_credential_owner_id(uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.organization_has_verified_members(uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.is_verified_organization(uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.activity_belongs_to_organization(uuid,uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.activity_has_verified_geography_scope(uuid,uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.credential_has_verified_mrv_provenance(uuid,uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.credential_is_acceptance_fixture(uuid,uuid)', 'EXECUTE')
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_identity_id()'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_organization_id()'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.set_request_context(uuid,uuid,uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.is_verified_org_member(uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.authenticate_bearer_session(text)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_credential_owner_id(uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.organization_has_verified_members(uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.is_verified_organization(uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.activity_belongs_to_organization(uuid,uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.activity_has_verified_geography_scope(uuid,uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.credential_has_verified_mrv_provenance(uuid,uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.credential_is_acceptance_fixture(uuid,uuid)'::regprocedure)
  then 1
  else 0
end as security_definer_boundary_assertion;

-- Additional hardening diagnostics: function ownership, inherited grants and
-- schema CREATE rights. has_*_privilege includes privileges inherited through
-- role membership, so this checks the effective runtime privilege surface.
select
  p.oid::regprocedure as function_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  owner_role.rolsuper as owner_superuser,
  owner_role.rolbypassrls as owner_bypassrls,
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_proc p
join pg_roles owner_role on owner_role.oid = p.proowner
where p.pronamespace = 'app'::regnamespace
  and p.proname in (
    'set_request_context',
    'is_verified_org_member',
    'authenticate_bearer_session',
    'current_identity_id',
    'current_organization_id',
    'current_credential_owner_id',
    'organization_has_verified_members',
    'is_verified_organization',
    'activity_belongs_to_organization',
    'activity_has_verified_geography_scope',
    'credential_has_verified_mrv_provenance',
    'credential_is_acceptance_fixture'
  )
order by p.proname, p.oid::regprocedure::text;

select
  has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'SELECT') as runtime_select_via_any_role,
  has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'INSERT') as runtime_insert_via_any_role,
  has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'UPDATE') as runtime_update_via_any_role,
  has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'DELETE') as runtime_delete_via_any_role,
  has_schema_privilege('rupaykg_app_runtime', 'app', 'CREATE') as runtime_create_app_objects,
  has_schema_privilege('rupaykg_app_runtime', 'public', 'CREATE') as runtime_create_public_objects;

select 1 / case
  when not has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'SELECT')
   and not has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'INSERT')
   and not has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'UPDATE')
   and not has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'DELETE')
   and not has_schema_privilege('rupaykg_app_runtime', 'app', 'CREATE')
   and not has_schema_privilege('rupaykg_app_runtime', 'public', 'CREATE')
  then 1
  else 0
end as effective_runtime_privilege_assertion;


-- Fail closed unless every SECURITY DEFINER entry point is owned by the
-- isolated NOLOGIN/NOBYPASSRLS role, and neither runtime role can assume it.
select
  count(*) filter (where p.proowner = owner_role.oid) as functions_owned_by_isolated_role,
  count(*) as expected_functions,
  owner_role.rolcanlogin,
  owner_role.rolinherit,
  owner_role.rolsuper,
  owner_role.rolbypassrls,
  owner_role.rolcreatedb,
  owner_role.rolcreaterole,
  owner_role.rolreplication,
  pg_has_role('rupaykg_app_runtime', owner_role.oid, 'MEMBER') as app_runtime_can_assume_owner,
  pg_has_role(current_user, owner_role.oid, 'MEMBER') as invoking_runtime_can_assume_owner
from pg_roles owner_role
left join pg_proc p
  on p.pronamespace = 'app'::regnamespace
 and p.proname in (
   'set_request_context',
   'is_verified_org_member',
   'authenticate_bearer_session',
   'current_identity_id',
   'current_organization_id'
 )
where owner_role.rolname = 'rupaykg_security_definer'
group by owner_role.oid, owner_role.rolcanlogin, owner_role.rolsuper,
         owner_role.rolinherit, owner_role.rolbypassrls, owner_role.rolcreatedb,
         owner_role.rolcreaterole, owner_role.rolreplication;

-- Emit exact ownership coverage before the hard assertion so CI failures
-- identify missing or unexpectedly owned functions instead of only dividing by zero.
select expected.function_name,
       coalesce(owner_role.rolname, '<missing-owner-role>') as isolated_owner_role,
       coalesce(p.proowner = owner_role.oid, false) as owned_by_isolated_role
  from unnest(array[
    'set_request_context',
    'is_verified_org_member',
    'authenticate_bearer_session',
    'current_identity_id',
    'current_organization_id',
    'current_credential_owner_id',
    'organization_has_verified_members',
    'is_verified_organization',
    'activity_belongs_to_organization',
    'activity_has_verified_geography_scope',
    'credential_has_verified_mrv_provenance',
    'credential_is_acceptance_fixture'
  ]) as expected(function_name)
  left join pg_roles owner_role on owner_role.rolname = 'rupaykg_security_definer'
  left join pg_proc p
    on p.pronamespace = 'app'::regnamespace
   and p.proname = expected.function_name
   and p.prosecdef
   and p.proowner = owner_role.oid
 order by expected.function_name;

select count(*) as legacy_security_definer_functions_owned
  from pg_proc p
  join pg_roles owner_role on owner_role.rolname = 'rupaykg_security_definer'
 where p.pronamespace = 'app'::regnamespace
   and p.prosecdef
   and p.proname = any(array[
     'set_request_context',
     'is_verified_org_member',
     'authenticate_bearer_session',
     'current_identity_id',
     'current_organization_id',
     'current_credential_owner_id',
     'organization_has_verified_members',
     'is_verified_organization',
     'activity_belongs_to_organization',
     'activity_has_verified_geography_scope',
     'credential_has_verified_mrv_provenance',
     'credential_is_acceptance_fixture'
   ]);

-- Diagnose each isolated-owner boundary independently for actionable CI output.
select owner_role.rolname,
       owner_role.rolcanlogin, owner_role.rolinherit, owner_role.rolsuper,
       owner_role.rolbypassrls, owner_role.rolcreatedb, owner_role.rolcreaterole,
       owner_role.rolreplication,
       has_schema_privilege(owner_role.oid, 'app', 'CREATE') as app_create,
       has_schema_privilege(owner_role.oid, 'public', 'CREATE') as public_create,
       pg_has_role('rupaykg_app_runtime', owner_role.oid, 'MEMBER') as runtime_member,
       pg_has_role(current_user, owner_role.oid, 'MEMBER') as invoking_member
  from pg_roles owner_role
 where owner_role.rolname = 'rupaykg_security_definer';

select membership.roleid::regrole as granted_role,
       membership.member::regrole as member_role,
       pg_get_userbyid(membership.grantor) as grantor,
       membership.admin_option, membership.inherit_option, membership.set_option
  from pg_auth_members membership
 where membership.member = 'rupaykg_security_definer'::regrole
    or membership.roleid = 'rupaykg_security_definer'::regrole;

select
  has_table_privilege('rupaykg_security_definer','public.registry_events','SELECT') as registry_select,
  has_table_privilege('rupaykg_security_definer','app.request_context_grants','DELETE') as request_context_delete,
  has_table_privilege('rupaykg_security_definer','public.identities','SELECT') as identities_table_select,
  has_table_privilege('rupaykg_security_definer','public.identity_sessions','SELECT') as sessions_table_select,
  has_table_privilege('rupaykg_security_definer','public.organization_memberships','SELECT') as memberships_table_select,
  has_table_privilege('rupaykg_security_definer','public.organizations','SELECT') as organizations_table_select,
  has_table_privilege('rupaykg_security_definer','public.activities','SELECT') as activities_table_select,
  has_table_privilege('rupaykg_security_definer','public.organization_geography_scopes','SELECT') as geography_scopes_table_select,
  has_table_privilege('rupaykg_security_definer','public.mrv_provenance_events','SELECT') as provenance_table_select,
  has_table_privilege('rupaykg_security_definer','public.verifications','SELECT') as verifications_table_select,
  has_table_privilege('rupaykg_security_definer','public.evidence','SELECT') as evidence_table_select;

select 1 / case
  when exists (
    select 1
      from pg_roles owner_role
     where owner_role.rolname = 'rupaykg_security_definer'
       and not owner_role.rolcanlogin
       and not owner_role.rolinherit
       and not owner_role.rolsuper
       and not owner_role.rolbypassrls
       and not owner_role.rolcreatedb
       and not owner_role.rolcreaterole
       and not owner_role.rolreplication
       and not has_schema_privilege(owner_role.oid, 'app', 'CREATE')
       and not has_schema_privilege(owner_role.oid, 'public', 'CREATE')
       and not pg_has_role('rupaykg_app_runtime', owner_role.oid, 'MEMBER')
       and not pg_has_role(current_user, owner_role.oid, 'MEMBER')
       and not exists (
         select 1
           from pg_auth_members membership
           left join pg_roles member_role on member_role.oid = membership.member
          where membership.member = owner_role.oid
             or (
               membership.roleid = owner_role.oid
               and not (
                 member_role.rolname = 'rupaykg'
                 and pg_get_userbyid(membership.grantor) = 'cloud_admin'
                 and membership.admin_option
                 and not membership.inherit_option
                 and not membership.set_option
               )
             )
       )
       and not has_table_privilege(owner_role.oid, 'public.identities', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.identities', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'public.identities', 'UPDATE')
       and not has_table_privilege(owner_role.oid, 'public.identities', 'DELETE')
       and not has_table_privilege(owner_role.oid, 'public.identity_sessions', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.identity_sessions', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'public.identity_sessions', 'UPDATE')
       and not has_table_privilege(owner_role.oid, 'public.identity_sessions', 'DELETE')
       and not has_table_privilege(owner_role.oid, 'public.organization_memberships', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.organization_memberships', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'public.organization_memberships', 'UPDATE')
       and not has_table_privilege(owner_role.oid, 'public.organization_memberships', 'DELETE')
       and not has_table_privilege(owner_role.oid, 'public.organizations', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.organizations', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'public.organizations', 'UPDATE')
       and not has_table_privilege(owner_role.oid, 'public.organizations', 'DELETE')
       and has_table_privilege(owner_role.oid, 'public.registry_events', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.registry_events', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'public.registry_events', 'UPDATE')
       and not has_table_privilege(owner_role.oid, 'public.registry_events', 'DELETE')
       and not has_table_privilege(owner_role.oid, 'public.activities', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.activities', 'id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.activities', 'organization_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.activities', 'geography_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.activities', 'metadata', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.organization_geography_scopes', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organization_geography_scopes', 'organization_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organization_geography_scopes', 'geography_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organization_geography_scopes', 'status', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.mrv_provenance_events', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'activity_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'verification_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'evidence_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'guardian_status', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'hcs_status', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'guardian_execution_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'hcs_topic_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'hcs_transaction_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'hcs_consensus_timestamp', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'integrity_hash', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.mrv_provenance_events', 'mirror_node_verified_at', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.verifications', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.verifications', 'id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.verifications', 'activity_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.verifications', 'evidence_id', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'public.evidence', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.evidence', 'id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.evidence', 'activity_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.evidence', 'metadata', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'app.request_context_grants', 'SELECT')
       and not has_table_privilege(owner_role.oid, 'app.request_context_grants', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'app.request_context_grants', 'UPDATE')
       and has_table_privilege(owner_role.oid, 'app.request_context_grants', 'DELETE')
       and not has_any_column_privilege(owner_role.oid, 'public.identities', 'INSERT')
       and not has_any_column_privilege(owner_role.oid, 'public.identities', 'UPDATE')
       and not has_any_column_privilege(owner_role.oid, 'public.identity_sessions', 'INSERT')
       and not has_any_column_privilege(owner_role.oid, 'public.identity_sessions', 'UPDATE')
       and not has_any_column_privilege(owner_role.oid, 'public.organization_memberships', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'public.organization_memberships', 'UPDATE')
       and has_column_privilege(owner_role.oid, 'public.organization_memberships', 'status', 'UPDATE')
       and not has_any_column_privilege(owner_role.oid, 'public.organizations', 'INSERT')
       and not has_table_privilege(owner_role.oid, 'public.organizations', 'UPDATE')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'status', 'UPDATE')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'verification_status', 'UPDATE')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'verification_note', 'UPDATE')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'verified_by_identity_id', 'UPDATE')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'verified_at', 'UPDATE')
       and not exists (
         select 1
           from information_schema.columns column_row
          where (column_row.table_schema, column_row.table_name) in (
            ('public','organization_memberships'), ('public','organizations')
          )
            and not (
              (column_row.table_name = 'organization_memberships' and column_row.column_name = 'status')
              or (column_row.table_name = 'organizations' and column_row.column_name = any(array[
                'status','verification_status','verification_note','verified_by_identity_id','verified_at'
              ]))
            )
            and has_column_privilege(owner_role.oid,
              format('%I.%I', column_row.table_schema, column_row.table_name),
              column_row.column_name, 'UPDATE')
       )
       and not has_any_column_privilege(owner_role.oid, 'app.request_context_grants', 'UPDATE')
       and has_column_privilege(owner_role.oid, 'public.identities', 'id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identities', 'status', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identities', 'suspended_at', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identities', 'display_name', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identities', 'email', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identity_sessions', 'id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identity_sessions', 'identity_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identity_sessions', 'token_hash', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identity_sessions', 'expires_at', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.identity_sessions', 'revoked_at', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organization_memberships', 'identity_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organization_memberships', 'organization_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organization_memberships', 'role_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organization_memberships', 'status', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'status', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'name', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'legal_name', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'legal_form', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'registration_identifier', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'registration_authority', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'verification_status', 'SELECT')
       and has_column_privilege(owner_role.oid, 'public.organizations', 'verification_note', 'SELECT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'identity_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'organization_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'session_id', 'SELECT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'expires_at', 'SELECT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'identity_id', 'INSERT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'organization_id', 'INSERT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'session_id', 'INSERT')
       and has_column_privilege(owner_role.oid, 'app.request_context_grants', 'expires_at', 'INSERT')
       and not exists (
         select 1
           from information_schema.columns column_row
          where (column_row.table_schema, column_row.table_name) in (
            ('public','identities'),
            ('public','identity_sessions'),
            ('public','organization_memberships'),
            ('public','organizations')
          )
            and not (
              (column_row.table_name = 'identities' and column_row.column_name = any(array['id','status','suspended_at','display_name','email']))
              or (column_row.table_name = 'identity_sessions' and column_row.column_name = any(array['id','identity_id','token_hash','expires_at','revoked_at']))
              or (column_row.table_name = 'organization_memberships' and column_row.column_name = any(array['identity_id','organization_id','role_id','status']))
              or (column_row.table_name = 'organizations' and column_row.column_name = any(array['id','status','name','legal_name','legal_form','registration_identifier','registration_authority','verification_status','verification_note']))
            )
            and has_column_privilege(owner_role.oid,
              format('%I.%I', column_row.table_schema, column_row.table_name),
              column_row.column_name, 'SELECT')
       )
       and not exists (
         select 1
           from information_schema.columns column_row
          where column_row.table_schema = 'app'
            and column_row.table_name = 'request_context_grants'
            and not (column_row.column_name = any(array['id','identity_id','organization_id','session_id','expires_at']))
            and has_column_privilege(owner_role.oid, 'app.request_context_grants',
              column_row.column_name, 'SELECT')
       )
       and not exists (
         select 1
           from information_schema.columns column_row
          where column_row.table_schema = 'app'
            and column_row.table_name = 'request_context_grants'
            and not (column_row.column_name = any(array['identity_id','organization_id','session_id','expires_at']))
            and has_column_privilege(owner_role.oid, 'app.request_context_grants',
              column_row.column_name, 'INSERT')
       )
       and (
         select count(*)
           from pg_proc p
          where p.pronamespace = 'app'::regnamespace
            and p.prosecdef
            and p.proname in (
              'set_request_context',
              'is_verified_org_member',
              'authenticate_bearer_session',
              'current_identity_id',
              'current_organization_id',
              'current_credential_owner_id',
              'organization_has_verified_members',
              'is_verified_organization',
              'activity_belongs_to_organization',
              'activity_has_verified_geography_scope',
              'credential_has_verified_mrv_provenance',
              'credential_is_acceptance_fixture'
            )
            and p.proowner = owner_role.oid
       ) = 12
  )
  then 1
  else 0
end as isolated_security_definer_owner_assertion;
