\set ON_ERROR_STOP on

-- The protected migration stack must establish a dedicated non-login owner for
-- authentication-context SECURITY DEFINER objects. This is a disposable-CI
-- structural proof only; it does not alter production authorization state.

DO $$
DECLARE
  v_super boolean;
  v_login boolean;
  v_bypass boolean;
  v_schema_owner text;
  v_table_owner text;
  v_context_owner text;
BEGIN
  SELECT rolsuper, rolcanlogin, rolbypassrls
    INTO v_super, v_login, v_bypass
    FROM pg_roles
   WHERE rolname='rupaykg_auth_context_owner';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rupaykg_auth_context_owner was not created';
  END IF;

  IF v_super OR v_login OR v_bypass THEN
    RAISE EXCEPTION 'auth context owner must be NOLOGIN, NOSUPERUSER and NOBYPASSRLS';
  END IF;

  SELECT n.nspowner::regrole::text
    INTO v_schema_owner
    FROM pg_namespace n
   WHERE n.nspname='rupaykg_private';

  IF v_schema_owner <> 'rupaykg_auth_context_owner' THEN
    RAISE EXCEPTION 'rupaykg_private owner is %, expected rupaykg_auth_context_owner', v_schema_owner;
  END IF;

  SELECT c.relowner::regrole::text
    INTO v_table_owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='rupaykg_private' AND c.relname='auth_context_key';

  IF v_table_owner <> 'rupaykg_auth_context_owner' THEN
    RAISE EXCEPTION 'auth_context_key owner is %, expected rupaykg_auth_context_owner', v_table_owner;
  END IF;

  SELECT p.proowner::regrole::text
    INTO v_context_owner
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname='rupaykg_context_is_valid'
     AND pg_get_function_identity_arguments(p.oid)='';

  IF v_context_owner <> 'rupaykg_auth_context_owner' THEN
    RAISE EXCEPTION 'rupaykg_context_is_valid owner is %, expected rupaykg_auth_context_owner', v_context_owner;
  END IF;
END;
$$;

SELECT
  'non-superuser migration helper ownership transfer verified' AS result;
