-- Shakti tenant-isolation SECURITY DEFINER boundary acceptance.
-- Read-only. Run with the intended non-BYPASSRLS application runtime login.
-- Fail closed if any privileged tenant function is missing, publicly
-- executable, missing the hardened search_path, or callable by an unsafe role.

with expected(function_name, identity_args) as (
  values
    ('app.set_request_context', 'p_identity_id uuid, p_organization_id uuid'),
    ('app.is_verified_org_member', 'target_organization_id uuid'),
    ('app.authenticate_bearer_session', 'p_token_hash text')
),
actual as (
  select
    e.function_name,
    e.identity_args,
    count(p.oid) as function_count,
    bool_or(p.prosecdef) as security_definer,
    bool_or(pg_get_functiondef(p.oid) like '%set search_path = pg_catalog, public, app%') as hardened_search_path
  from expected e
  left join pg_proc p
    on p.pronamespace = 'app'::regnamespace
   and p.proname = split_part(e.function_name, '.', 2)
   and pg_get_function_identity_arguments(p.oid) = e.identity_args
  group by e.function_name, e.identity_args
)
select *
from actual
order by function_name;

select
  has_function_privilege(current_user, 'app.set_request_context(uuid,uuid)', 'EXECUTE')
    as set_context_runtime_execute,
  has_function_privilege('public', 'app.set_request_context(uuid,uuid)', 'EXECUTE')
    as set_context_public_execute,
  has_function_privilege(current_user, 'app.is_verified_org_member(uuid)', 'EXECUTE')
    as membership_runtime_execute,
  has_function_privilege('public', 'app.is_verified_org_member(uuid)', 'EXECUTE')
    as membership_public_execute,
  has_function_privilege(current_user, 'app.authenticate_bearer_session(text)', 'EXECUTE')
    as bootstrap_runtime_execute,
  has_function_privilege('public', 'app.authenticate_bearer_session(text)', 'EXECUTE')
    as bootstrap_public_execute;

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
          and pg_get_function_identity_arguments(p.oid) = 'p_identity_id uuid, p_organization_id uuid')
         or (p.proname = 'is_verified_org_member'
          and pg_get_function_identity_arguments(p.oid) = 'target_organization_id uuid')
         or (p.proname = 'authenticate_bearer_session'
          and pg_get_function_identity_arguments(p.oid) = 'p_token_hash text')
       )
       and p.prosecdef
       and pg_get_functiondef(p.oid) like '%set search_path = pg_catalog, public, app%'
   ) = 3
   and has_function_privilege(current_user, 'app.set_request_context(uuid,uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.is_verified_org_member(uuid)', 'EXECUTE')
   and has_function_privilege(current_user, 'app.authenticate_bearer_session(text)', 'EXECUTE')
   and not has_function_privilege('public', 'app.set_request_context(uuid,uuid)', 'EXECUTE')
   and not has_function_privilege('public', 'app.is_verified_org_member(uuid)', 'EXECUTE')
   and not has_function_privilege('public', 'app.authenticate_bearer_session(text)', 'EXECUTE')
  then 1
  else 0
end as security_definer_boundary_assertion;
