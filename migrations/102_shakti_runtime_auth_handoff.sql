-- 102: Shakti runtime-auth handoff
-- Forward-only. This migration does not create credentials or enable LOGIN.
-- It makes the already-defined SECURITY DEFINER authentication/context functions
-- executable by the non-BYPASSRLS application runtime role.

DO $$
DECLARE
  v_superuser boolean;
  v_bypassrls boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'rupaykg_app_runtime'
  ) THEN
    RAISE EXCEPTION 'Required runtime role rupaykg_app_runtime does not exist';
  END IF;

  SELECT rolsuper, rolbypassrls
    INTO v_superuser, v_bypassrls
  FROM pg_roles
  WHERE rolname = 'rupaykg_app_runtime';

  IF v_superuser OR v_bypassrls THEN
    RAISE EXCEPTION 'rupaykg_app_runtime must be non-SUPERUSER and non-BYPASSRLS';
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION app.authenticate_bearer_session(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.set_request_context(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.current_identity_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.current_organization_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.authenticate_bearer_session(text) TO rupaykg_app_runtime;
GRANT EXECUTE ON FUNCTION app.set_request_context(uuid, uuid) TO rupaykg_app_runtime;
GRANT EXECUTE ON FUNCTION app.current_identity_id() TO rupaykg_app_runtime;
GRANT EXECUTE ON FUNCTION app.current_organization_id() TO rupaykg_app_runtime;
