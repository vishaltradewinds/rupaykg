-- Shakti authentication/bootstrap pre-RLS acceptance.
-- Read-only. Run using the intended non-BYPASSRLS application runtime login.
-- This gate proves the explicit SECURITY DEFINER bootstrap boundary exists,
-- is executable by the runtime role, and is not publicly executable.

select
  p.oid::regprocedure as function,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  pg_get_functiondef(p.oid) like '%set search_path = pg_catalog, public, app%' as explicit_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app'
  and p.proname = 'authenticate_bearer_session'
  and pg_get_function_identity_arguments(p.oid) = 'p_token_hash text';

select
  has_function_privilege(current_user, 'app.authenticate_bearer_session(text)', 'EXECUTE')
    as runtime_execute_granted,
  has_function_privilege('public', 'app.authenticate_bearer_session(text)', 'EXECUTE')
    as public_execute_granted;

select
  current_user,
  session_user,
  r.rolsuper,
  r.rolbypassrls,
  r.rolname = 'rupaykg_app_runtime' as is_template_runtime_role
from pg_roles r
where r.rolname = current_user;

-- Expected:
-- exactly one function row;
-- security_definer=true;
-- explicit_search_path=true;
-- runtime_execute_granted=true;
-- public_execute_granted=false;
-- rolsuper=false;
-- rolbypassrls=false.
