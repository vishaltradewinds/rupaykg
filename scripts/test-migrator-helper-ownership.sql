-- Prove the PostgreSQL 16 CREATEROLE migration-principal ownership-transfer
-- mechanics using disposable GitHub Actions PostgreSQL only.
\set ON_ERROR_STOP on

DROP FUNCTION IF EXISTS public.migrator_owner_transfer_proof();
DROP ROLE IF EXISTS rupaykg_migrator_helper_proof;
DROP ROLE IF EXISTS rupaykg_migrator_proof;

CREATE ROLE rupaykg_migrator_proof
  NOLOGIN CREATEROLE NOSUPERUSER NOCREATEDB NOINHERIT NOBYPASSRLS;
GRANT CREATE ON SCHEMA public TO rupaykg_migrator_proof WITH GRANT OPTION;

CREATE FUNCTION public.migrator_owner_transfer_proof()
RETURNS integer
LANGUAGE sql
AS $function$ SELECT 1 $function$;
ALTER FUNCTION public.migrator_owner_transfer_proof() OWNER TO rupaykg_migrator_proof;

SET ROLE rupaykg_migrator_proof;

-- A non-superuser CREATEROLE principal can create and administer its helper
-- role, temporarily enable SET ROLE for ownership transfer, then turn SET off.
CREATE ROLE rupaykg_migrator_helper_proof
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT rupaykg_migrator_helper_proof TO CURRENT_USER
  WITH ADMIN TRUE, SET TRUE, INHERIT FALSE;
GRANT CREATE ON SCHEMA public TO rupaykg_migrator_helper_proof;
ALTER FUNCTION public.migrator_owner_transfer_proof()
  OWNER TO rupaykg_migrator_helper_proof;
REVOKE CREATE ON SCHEMA public FROM rupaykg_migrator_helper_proof;
GRANT rupaykg_migrator_helper_proof TO CURRENT_USER
  WITH ADMIN TRUE, SET FALSE, INHERIT FALSE;

RESET ROLE;

DO $assert$
DECLARE
  helper_oid oid;
  migrator_oid oid;
BEGIN
  SELECT oid INTO helper_oid FROM pg_roles WHERE rolname='rupaykg_migrator_helper_proof';
  SELECT oid INTO migrator_oid FROM pg_roles WHERE rolname='rupaykg_migrator_proof';

  IF (SELECT proowner FROM pg_proc WHERE oid='public.migrator_owner_transfer_proof()'::regprocedure) <> helper_oid THEN
    RAISE EXCEPTION 'non-superuser migrator failed to transfer function ownership';
  END IF;
  IF (SELECT rolcanlogin OR rolsuper OR rolbypassrls FROM pg_roles WHERE oid=helper_oid) THEN
    RAISE EXCEPTION 'helper proof role must be NOLOGIN/NOSUPERUSER/NOBYPASSRLS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_auth_members
     WHERE roleid=helper_oid AND member=migrator_oid
       AND admin_option AND NOT set_option
  ) THEN
    RAISE EXCEPTION 'migrator must retain ADMIN-only membership without SET ROLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members
     WHERE roleid=helper_oid AND member<>migrator_oid
  ) THEN
    RAISE EXCEPTION 'helper proof role has an unexpected member';
  END IF;
END;
$assert$;

DROP FUNCTION public.migrator_owner_transfer_proof();
DROP OWNED BY rupaykg_migrator_helper_proof;
DROP ROLE rupaykg_migrator_helper_proof;
REVOKE CREATE ON SCHEMA public FROM rupaykg_migrator_proof;
DROP ROLE rupaykg_migrator_proof;
