-- Narrow, signed-context-bound permission resolvers for restricted application roles.
-- The application role receives EXECUTE only; it never receives broad SELECT on memberships or roles.
-- The NOLOGIN auth owner has narrowly granted SELECT and does not bypass RLS.

DO $preflight$
DECLARE owner_role record;
BEGIN
  SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole,
         rolinherit, rolreplication
    INTO owner_role
    FROM pg_catalog.pg_roles
   WHERE rolname = 'rupaykg_auth_owner';
  IF NOT FOUND OR owner_role.rolcanlogin OR owner_role.rolsuper
     OR owner_role.rolbypassrls OR owner_role.rolcreatedb
     OR owner_role.rolcreaterole OR owner_role.rolinherit
     OR owner_role.rolreplication THEN
    RAISE EXCEPTION 'AUTH_PERMISSION_OWNER_INVALID: rupaykg_auth_owner must be a restricted NOLOGIN role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='rupaykg_app_runtime')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='rupaykg_auth_runtime') THEN
    RAISE EXCEPTION 'AUTH_PERMISSION_RUNTIME_ROLE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
     WHERE n.nspname='app_security'
       AND p.proname='current_request_context_claims'
       AND p.pronargs=0
       AND p.prosecdef
       AND p.proconfig @> ARRAY['search_path=pg_catalog, app_security']
       AND r.rolname='rupaykg_security_definer'
  ) THEN
    RAISE EXCEPTION 'AUTH_PERMISSION_SIGNED_CONTEXT_VERIFIER_INVALID';
  END IF;
END
$preflight$;

-- Permit the auth owner to call the signed verifier; the verifier itself retains
-- ownership of the signing key table and does not disclose the key material.
SET LOCAL ROLE rupaykg_security_definer;
GRANT USAGE ON SCHEMA app_security TO rupaykg_auth_owner;
GRANT EXECUTE ON FUNCTION app_security.current_request_context_claims() TO rupaykg_auth_owner;
RESET ROLE;

-- Exact column-level reads required by the two auth resolvers. No direct
-- application-role membership/role grants are made.
GRANT SELECT (id, activity_id) ON public.evidence TO rupaykg_auth_owner;
GRANT SELECT (id, organization_id, geography_id, actor_identity_id, occurred_at, created_at)
  ON public.activities TO rupaykg_auth_owner;
GRANT SELECT (identity_id, token_hash, revoked_at, expires_at)
  ON public.identity_sessions TO rupaykg_auth_owner;
GRANT SELECT (id, status, suspended_at)
  ON public.identities TO rupaykg_auth_owner;
GRANT SELECT (id, status, verification_status)
  ON public.organizations TO rupaykg_auth_owner;
GRANT SELECT (identity_id, organization_id, role_id, status)
  ON public.organization_memberships TO rupaykg_auth_owner;
GRANT SELECT (id, organization_id, permissions)
  ON public.roles TO rupaykg_auth_owner;

SET LOCAL ROLE rupaykg_auth_owner;

CREATE OR REPLACE FUNCTION auth_private.resolve_session(
  p_token_hash text
) RETURNS TABLE(
  identity_id uuid,
  organization_id uuid,
  role_id uuid,
  membership_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT identity_row.id,
         membership_row.organization_id,
         membership_row.role_id,
         membership_row.status::text
    FROM public.identity_sessions session_row
    JOIN public.identities identity_row
      ON identity_row.id = session_row.identity_id
    JOIN public.organization_memberships membership_row
      ON membership_row.identity_id = identity_row.id
     AND membership_row.status = 'VERIFIED'
    JOIN public.organizations organization_row
      ON organization_row.id = membership_row.organization_id
     AND organization_row.status = 'VERIFIED'
     AND organization_row.verification_status = 'VERIFIED'
    JOIN public.roles role_row
      ON role_row.id = membership_row.role_id
     AND role_row.organization_id = membership_row.organization_id
   WHERE p_token_hash IS NOT NULL
     AND p_token_hash ~ '^[0-9a-f]{64}$'
     AND session_row.token_hash = p_token_hash
     AND session_row.revoked_at IS NULL
     AND session_row.expires_at > statement_timestamp()
     AND identity_row.status = 'VERIFIED'
     AND identity_row.suspended_at IS NULL
   ORDER BY membership_row.organization_id, membership_row.role_id;
$function$;

CREATE OR REPLACE FUNCTION auth_private.has_organization_permission(
  p_identity_id uuid,
  p_organization_id uuid,
  p_permissions text[]
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  signed_claims text[];
BEGIN
  IF p_identity_id IS NULL OR p_organization_id IS NULL
     OR coalesce(cardinality(p_permissions), 0) = 0 THEN
    RETURN false;
  END IF;

  signed_claims := app_security.current_request_context_claims();
  IF signed_claims IS NULL OR cardinality(signed_claims) <> 2
     OR signed_claims[1] IS DISTINCT FROM p_identity_id::text
     OR signed_claims[2] IS DISTINCT FROM p_organization_id::text THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.identities identity_row
      JOIN public.organization_memberships membership_row
        ON membership_row.identity_id = identity_row.id
       AND membership_row.organization_id = p_organization_id
       AND membership_row.status = 'VERIFIED'
      JOIN public.organizations organization_row
        ON organization_row.id = membership_row.organization_id
       AND organization_row.status = 'VERIFIED'
       AND organization_row.verification_status = 'VERIFIED'
      JOIN public.roles role_row
        ON role_row.id = membership_row.role_id
       AND role_row.organization_id = membership_row.organization_id
     WHERE identity_row.id = p_identity_id
       AND identity_row.status = 'VERIFIED'
       AND identity_row.suspended_at IS NULL
       AND EXISTS (
         SELECT 1
           FROM pg_catalog.jsonb_array_elements_text(role_row.permissions) permission(value)
          WHERE permission.value = ANY(p_permissions)
       )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION auth_private.can_verify_evidence(
  p_identity_id uuid,
  p_evidence_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  signed_claims text[];
  subject_activity_id uuid;
  subject_organization_id uuid;
BEGIN
  IF p_identity_id IS NULL OR p_evidence_id IS NULL THEN
    RETURN false;
  END IF;

  signed_claims := app_security.current_request_context_claims();
  IF signed_claims IS NULL OR cardinality(signed_claims) <> 2
     OR signed_claims[1] IS DISTINCT FROM p_identity_id::text THEN
    RETURN false;
  END IF;

  SELECT activity_row.id, activity_row.organization_id
    INTO subject_activity_id, subject_organization_id
    FROM public.evidence evidence_row
    JOIN public.activities activity_row
      ON activity_row.id = evidence_row.activity_id
   WHERE evidence_row.id = p_evidence_id;

  IF subject_activity_id IS NULL
     OR signed_claims[2] IS DISTINCT FROM subject_organization_id::text THEN
    RETURN false;
  END IF;

  RETURN public.has_verification_permission_for_activity(
    p_identity_id, subject_activity_id
  );
END;
$function$;

ALTER FUNCTION auth_private.resolve_session(text) OWNER TO rupaykg_auth_owner;
ALTER FUNCTION auth_private.has_organization_permission(uuid,uuid,text[]) OWNER TO rupaykg_auth_owner;
ALTER FUNCTION auth_private.can_verify_evidence(uuid,uuid) OWNER TO rupaykg_auth_owner;
ALTER FUNCTION auth_private.resolve_session(text) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION auth_private.has_organization_permission(uuid,uuid,text[]) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION auth_private.can_verify_evidence(uuid,uuid) SET search_path = pg_catalog, pg_temp;

REVOKE ALL ON FUNCTION auth_private.resolve_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_private.has_organization_permission(uuid,uuid,text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_private.can_verify_evidence(uuid,uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA auth_private TO rupaykg_app_runtime, rupaykg_auth_runtime;
GRANT EXECUTE ON FUNCTION auth_private.resolve_session(text) TO rupaykg_app_runtime, rupaykg_auth_runtime;
GRANT EXECUTE ON FUNCTION auth_private.has_organization_permission(uuid,uuid,text[]) TO rupaykg_app_runtime, rupaykg_auth_runtime;
GRANT EXECUTE ON FUNCTION auth_private.can_verify_evidence(uuid,uuid) TO rupaykg_app_runtime, rupaykg_auth_runtime;

COMMENT ON FUNCTION auth_private.resolve_session(text) IS
  'Resolves only active verified identity memberships for a valid bearer-session hash; exposes no session or identity secrets.';
COMMENT ON FUNCTION auth_private.has_organization_permission(uuid,uuid,text[]) IS
  'Returns only a boolean; requires a valid signed request context whose actor and organization exactly match the arguments. Exposes no membership or role rows to the app runtime.';
COMMENT ON FUNCTION auth_private.can_verify_evidence(uuid,uuid) IS
  'Evidence verifier authorization bound to the signed request actor and the evidence activity organization.';

RESET ROLE;
