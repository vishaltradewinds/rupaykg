-- Read-only verification for migration 102 runtime-auth handoff.
-- Fails closed if the runtime role is missing, privileged, or lacks EXECUTE
-- on the session-bound request-context/authentication functions.

DO $$
DECLARE
  v_superuser boolean;
  v_bypassrls boolean;
  v_canlogin boolean;
BEGIN
  SELECT rolsuper, rolbypassrls, rolcanlogin
    INTO v_superuser, v_bypassrls, v_canlogin
  FROM pg_roles
  WHERE rolname = 'rupaykg_app_runtime';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFY_102: runtime role missing';
  END IF;

  IF v_superuser OR v_bypassrls THEN
    RAISE EXCEPTION 'VERIFY_102: runtime role is privileged (SUPERUSER/BYPASSRLS)';
  END IF;

  IF v_canlogin THEN
    RAISE EXCEPTION 'VERIFY_102: runtime role must not receive LOGIN from this migration';
  END IF;

  IF NOT has_function_privilege('rupaykg_app_runtime', 'app.authenticate_bearer_session(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_102: authenticate_bearer_session EXECUTE missing';
  END IF;

  IF NOT has_function_privilege('rupaykg_app_runtime', 'app.set_request_context(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_102: set_request_context EXECUTE missing';
  END IF;

  IF NOT has_function_privilege('rupaykg_app_runtime', 'app.current_identity_id()', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_102: current_identity_id EXECUTE missing';
  END IF;

  IF NOT has_function_privilege('rupaykg_app_runtime', 'app.current_organization_id()', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_102: current_organization_id EXECUTE missing';
  END IF;


  IF has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'SELECT')
     OR has_table_privilege('rupaykg_app_runtime', 'app.request_context_grants', 'INSERT') THEN
    RAISE EXCEPTION 'VERIFY_102: runtime role must not directly access request context grants';
  END IF;

  RAISE NOTICE 'VERIFY_102 PASS: runtime auth handoff is privilege-bounded and LOGIN remains unchanged';
END
$$;

SELECT
  r.rolname,
  r.rolsuper,
  r.rolbypassrls,
  r.rolcanlogin,
  has_function_privilege(r.rolname, 'app.authenticate_bearer_session(text)', 'EXECUTE') AS can_authenticate,
  has_function_privilege(r.rolname, 'app.set_request_context(uuid,uuid,uuid)', 'EXECUTE') AS can_set_context,
  has_function_privilege(r.rolname, 'app.current_identity_id()', 'EXECUTE') AS can_read_identity,
  has_function_privilege(r.rolname, 'app.current_organization_id()', 'EXECUTE') AS can_read_organization
FROM pg_roles r
WHERE r.rolname = 'rupaykg_app_runtime';
