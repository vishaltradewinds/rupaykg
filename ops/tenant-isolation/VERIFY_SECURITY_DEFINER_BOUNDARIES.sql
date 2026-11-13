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
    ('app.current_organization_id', '')
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
    as current_organization_public_execute;

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
       )
       and p.prosecdef
       and coalesce(p.proconfig::text, '') like '%search_path=pg_catalog, public, app%'
   ) = 5
   and has_function_privilege(current_user, 'app.set_request_context(uuid,uuid,uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.is_verified_org_member(uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.authenticate_bearer_session(text)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.current_identity_id()', 'EXECUTE')
   and has_function_privilege(current_user, 'app.current_organization_id()', 'EXECUTE')
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_identity_id()'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.current_organization_id()'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.set_request_context(uuid,uuid,uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.is_verified_org_member(uuid)'::regprocedure)
   and not (select coalesce(bool_or(x.grantee = 0 and x.privilege_type = 'EXECUTE'), false) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where p.oid = 'app.authenticate_bearer_session(text)'::regprocedure)
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
    'current_organization_id'
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
