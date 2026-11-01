-- The API authentication login receives EXECUTE on this narrowly scoped
-- verifier only; it does not receive SELECT on identity/session tables.
-- The migration owner must be the trusted security-definer owner.
CREATE OR REPLACE FUNCTION public.verify_identity_session(p_token_hash text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $function$
  SELECT s.identity_id
    FROM public.identity_sessions AS s
    JOIN public.identities AS i ON i.id = s.identity_id
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
     AND s.expires_at > now()
     AND i.status = 'VERIFIED'
     AND i.suspended_at IS NULL
   LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.verify_identity_session(text) FROM PUBLIC;

-- A non-login capability role is the only role that should receive EXECUTE.
-- Provision the actual LOGIN role separately, inherit this role, and set its
-- password outside migrations/secrets in the deployment environment.
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rupaykg_auth') THEN
    CREATE ROLE rupaykg_auth
      NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$block$;

GRANT EXECUTE ON FUNCTION public.verify_identity_session(text) TO rupaykg_auth;
