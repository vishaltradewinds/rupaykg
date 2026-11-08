-- Shakti SECURITY DEFINER schema boundary.
--
-- SECURITY DEFINER functions must not resolve objects through schemas writable
-- by untrusted callers, and their default PUBLIC EXECUTE privilege must be
-- removed before selective runtime grants are relied upon.

revoke create on schema public from public;
revoke create on schema app from public;

-- PostgreSQL grants EXECUTE on newly-created functions to PUBLIC by default.
-- Remove that default for the migration owner so future SECURITY DEFINER
-- functions do not reopen the PUBLIC execution boundary after this migration.
do $shakti$
begin
  execute format(
    'alter default privileges for role %I revoke execute on functions from public',
    current_user
  );
end
$shakti$;

do $shakti$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef
       and n.nspname = 'app'
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  end loop;
end
$shakti$;

-- Preserve the explicit least-privilege runtime execution surface.
grant execute on function app.current_identity_id() to rupaykg_app_runtime;
grant execute on function app.current_organization_id() to rupaykg_app_runtime;
grant execute on function app.set_request_context(uuid,uuid) to rupaykg_app_runtime;
grant execute on function app.set_identity_context(uuid) to rupaykg_app_runtime;
grant execute on function app.set_platform_context(uuid) to rupaykg_app_runtime;
grant execute on function app.set_authority_context(uuid,text,uuid) to rupaykg_app_runtime;
grant execute on function app.is_assigned_approved_verifier(uuid) to rupaykg_app_runtime;
