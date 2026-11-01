-- Dedicated non-login function owner. BYPASSRLS is confined to a role
-- that can SELECT only identity/session rows; the API login never inherits it.
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rupaykg_auth_verifier_owner') THEN
    CREATE ROLE rupaykg_auth_verifier_owner
      NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname = 'rupaykg_auth_verifier_owner'
         AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb
         AND NOT rolcreaterole AND NOT rolreplication AND rolbypassrls AND rolinherit
    ) THEN
      RAISE EXCEPTION 'rupaykg_auth_verifier_owner role exists with unsafe attributes';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rupaykg_auth') THEN
    CREATE ROLE rupaykg_auth
      NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname = 'rupaykg_auth'
         AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb
         AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolinherit
    ) THEN
      RAISE EXCEPTION 'rupaykg_auth role exists with unsafe attributes';
    END IF;
  END IF;
END
$block$;

GRANT USAGE ON SCHEMA public TO rupaykg_auth_verifier_owner;
GRANT SELECT ON public.identity_sessions, public.identities TO rupaykg_auth_verifier_owner;

CREATE OR REPLACE FUNCTION public.verify_identity_session(p_token_hash text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
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

-- Temporarily allow the migration owner to transfer function ownership.
GRANT rupaykg_auth_verifier_owner TO rupaykg;
GRANT CREATE ON SCHEMA public TO rupaykg_auth_verifier_owner;
ALTER FUNCTION public.verify_identity_session(text) OWNER TO rupaykg_auth_verifier_owner;
REVOKE CREATE ON SCHEMA public FROM rupaykg_auth_verifier_owner;
REVOKE rupaykg_auth_verifier_owner FROM rupaykg;
REVOKE ALL ON FUNCTION public.verify_identity_session(text) FROM PUBLIC;

-- The API's non-login capability grants only the function, not table reads.
GRANT USAGE ON SCHEMA public TO rupaykg_auth;
GRANT EXECUTE ON FUNCTION public.verify_identity_session(text) TO rupaykg_auth;
