-- Shakti disposable convergence rehearsal: #252 + #251 + #272 + #284 semantics.
-- This is NOT a numbered production migration.
-- It deliberately does not apply #284's competing auth_context_owner role.
-- Instead, the authenticated-context primitives from #284 are owned by the
-- canonical verification guard established by #272, leaving one authoritative
-- SECURITY DEFINER owner and one verification authorization trigger.
\set ON_ERROR_STOP on

BEGIN;

\i scripts/fixtures/verification-convergence/2026110401_membership_role_tenant_binding.sql
\i scripts/fixtures/verification-convergence/20261105_geography_scope_fail_closed.sql
\i scripts/fixtures/verification-convergence/20261104_verification_authorization_tenant_binding.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname='rupaykg_verification_guard'
      AND rolcanlogin=false
      AND rolsuper=false
      AND rolbypassrls=false
  ) THEN
    RAISE EXCEPTION 'canonical verification guard role is not present with the required least-privilege posture';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_auth_context_owner') THEN
    RAISE EXCEPTION 'competing auth_context_owner role must not exist in the converged design';
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS rupaykg_private;
ALTER SCHEMA rupaykg_private OWNER TO rupaykg_verification_guard;
REVOKE ALL ON SCHEMA rupaykg_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS rupaykg_private.auth_context_key (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret bytea NOT NULL
);
ALTER TABLE rupaykg_private.auth_context_key OWNER TO rupaykg_verification_guard;
REVOKE ALL ON rupaykg_private.auth_context_key FROM PUBLIC;
INSERT INTO rupaykg_private.auth_context_key(singleton,secret)
VALUES (true,gen_random_bytes(32))
ON CONFLICT (singleton) DO NOTHING;

GRANT USAGE ON SCHEMA rupaykg_private TO rupaykg_verification_guard;
GRANT USAGE ON SCHEMA public TO rupaykg_verification_guard;
GRANT SELECT ON rupaykg_private.auth_context_key TO rupaykg_verification_guard;

CREATE OR REPLACE FUNCTION public.rupaykg_context_is_valid()
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_identity text; v_org text; v_session text; v_expiry text; v_xid text;
  v_current_xid text; v_signature text; v_secret bytea; v_payload text; v_expected text;
BEGIN
  v_identity := current_setting('rupaykg.context.identity',true);
  v_org := current_setting('rupaykg.context.organization',true);
  v_session := current_setting('rupaykg.context.session',true);
  v_expiry := current_setting('rupaykg.context.expiry',true);
  v_xid := current_setting('rupaykg.context.xid',true);
  v_signature := current_setting('rupaykg.context.signature',true);
  v_current_xid := pg_current_xact_id_if_assigned()::text;
  IF v_identity IS NULL OR v_org IS NULL OR v_session IS NULL
     OR v_expiry IS NULL OR v_xid IS NULL OR v_signature IS NULL
     OR v_current_xid IS NULL OR v_xid <> v_current_xid THEN RETURN false; END IF;
  IF v_expiry !~ '^[0-9]+$' OR to_timestamp(v_expiry::bigint) <= clock_timestamp() THEN RETURN false; END IF;
  SELECT k.secret INTO v_secret FROM rupaykg_private.auth_context_key k WHERE k.singleton;
  IF v_secret IS NULL THEN RETURN false; END IF;
  v_payload := v_identity || '|' || v_org || '|' || v_session || '|' || v_expiry || '|' || v_xid;
  v_expected := encode(public.hmac(convert_to(v_payload,'UTF8'),v_secret,'sha256'),'hex');
  RETURN v_signature = v_expected;
EXCEPTION WHEN others THEN RETURN false;
END;
$$;
ALTER FUNCTION public.rupaykg_context_is_valid() OWNER TO rupaykg_verification_guard;
REVOKE ALL ON FUNCTION public.rupaykg_context_is_valid() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.rupaykg_authenticated_identity()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT CASE WHEN public.rupaykg_context_is_valid()
    THEN current_setting('rupaykg.context.identity',true)::uuid ELSE NULL END
$$;
ALTER FUNCTION public.rupaykg_authenticated_identity() OWNER TO rupaykg_verification_guard;
REVOKE ALL ON FUNCTION public.rupaykg_authenticated_identity() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.rupaykg_authenticated_organization()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT CASE WHEN public.rupaykg_context_is_valid()
    THEN current_setting('rupaykg.context.organization',true)::uuid ELSE NULL END
$$;
ALTER FUNCTION public.rupaykg_authenticated_organization() OWNER TO rupaykg_verification_guard;
REVOKE ALL ON FUNCTION public.rupaykg_authenticated_organization() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.rupaykg_set_authenticated_context(
  p_bearer_token text, p_organization_id uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_identity uuid; v_session uuid; v_expiry bigint; v_xid text;
  v_secret bytea; v_payload text; v_signature text;
BEGIN
  IF p_bearer_token IS NULL OR length(p_bearer_token) < 20 OR p_organization_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='authenticated bearer token and organization are required';
  END IF;
  SELECT s.identity_id,s.id,extract(epoch FROM s.expires_at)::bigint
    INTO v_identity,v_session,v_expiry
    FROM public.identity_sessions s
   WHERE s.token_hash=encode(public.digest(convert_to(p_bearer_token,'UTF8'),'sha256'),'hex')
     AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
   ORDER BY s.issued_at DESC,s.id DESC LIMIT 1 FOR SHARE;
  IF v_identity IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.identities i WHERE i.id=v_identity AND i.status='VERIFIED' AND i.suspended_at IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id=p_organization_id AND o.status='VERIFIED')
     OR NOT EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.identity_id=v_identity AND m.organization_id=p_organization_id AND m.status='VERIFIED') THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='bearer session, identity, membership or organization is not currently authorized';
  END IF;
  v_xid := pg_current_xact_id()::text;
  SELECT k.secret INTO v_secret FROM rupaykg_private.auth_context_key k WHERE k.singleton;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'authenticated context signing key is unavailable'; END IF;
  v_payload := v_identity::text || '|' || p_organization_id::text || '|' || v_session::text || '|' || v_expiry::text || '|' || v_xid;
  v_signature := encode(public.hmac(convert_to(v_payload,'UTF8'),v_secret,'sha256'),'hex');
  PERFORM set_config('rupaykg.context.identity',v_identity::text,true);
  PERFORM set_config('rupaykg.context.organization',p_organization_id::text,true);
  PERFORM set_config('rupaykg.context.session',v_session::text,true);
  PERFORM set_config('rupaykg.context.expiry',v_expiry::text,true);
  PERFORM set_config('rupaykg.context.xid',v_xid,true);
  PERFORM set_config('rupaykg.context.signature',v_signature,true);
  RETURN v_identity;
END;
$$;
ALTER FUNCTION public.rupaykg_set_authenticated_context(text,uuid) OWNER TO rupaykg_verification_guard;
REVOKE ALL ON FUNCTION public.rupaykg_set_authenticated_context(text,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enforce_verification_authorization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  resolved_activity_id uuid; activity_actor uuid; activity_organization_id uuid;
  activity_geography_id uuid; evidence_activity_id uuid; membership_row record;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'verification records are immutable; create a superseding verification'; END IF;
  IF NOT public.rupaykg_context_is_valid() THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='verification requires cryptographically authenticated transaction context';
  END IF;
  IF NEW.verifier_identity_id IS DISTINCT FROM public.rupaykg_authenticated_identity() THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='verification identity does not match authenticated bearer session';
  END IF;
  IF NEW.evidence_id IS NULL THEN RAISE EXCEPTION 'verification evidence is required'; END IF;
  SELECT e.activity_id INTO evidence_activity_id FROM public.evidence e WHERE e.id=NEW.evidence_id FOR SHARE;
  IF evidence_activity_id IS NULL THEN RAISE EXCEPTION 'verification evidence must be bound to an activity'; END IF;
  resolved_activity_id := evidence_activity_id;
  IF NEW.activity_id IS NOT NULL AND NEW.activity_id IS DISTINCT FROM resolved_activity_id THEN
    RAISE EXCEPTION 'verification activity must match the evidence activity';
  END IF;
  NEW.activity_id := resolved_activity_id;
  SELECT a.actor_identity_id,a.organization_id,a.geography_id INTO activity_actor,activity_organization_id,activity_geography_id
    FROM public.activities a WHERE a.id=resolved_activity_id FOR SHARE;
  IF activity_organization_id IS NULL THEN RAISE EXCEPTION 'verification requires an activity with an organization'; END IF;
  IF activity_organization_id IS DISTINCT FROM public.rupaykg_authenticated_organization() THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='verification activity organization does not match authenticated organization';
  END IF;
  PERFORM 1 FROM public.organizations o WHERE o.id=activity_organization_id AND o.status='VERIFIED' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verification requires a currently VERIFIED organization'; END IF;
  IF activity_geography_id IS NULL OR NOT public.organization_has_geography_scope(activity_organization_id,activity_geography_id) THEN
    RAISE EXCEPTION 'verification geography is outside the explicit authorized organization scope';
  END IF;
  IF activity_actor IS NOT NULL AND activity_actor=NEW.verifier_identity_id THEN
    RAISE EXCEPTION 'activity actor cannot self-approve evidence';
  END IF;
  SELECT m.id AS membership_id,m.role_id,r.permissions INTO membership_row
    FROM public.organization_memberships m
    JOIN public.roles r ON r.id=m.role_id AND r.organization_id=m.organization_id
    JOIN public.identities i ON i.id=m.identity_id
   WHERE m.identity_id=NEW.verifier_identity_id
     AND m.organization_id=activity_organization_id
     AND m.status='VERIFIED'
     AND i.status='VERIFIED' AND i.suspended_at IS NULL
     AND (r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb OR r.permissions @> '["verification:approve"]'::jsonb OR r.permissions @> '["verification.approve"]'::jsonb)
   ORDER BY m.created_at DESC,m.id DESC LIMIT 1
   FOR SHARE OF m,r,i;
  IF membership_row.membership_id IS NULL THEN
    RAISE EXCEPTION 'verification requires active explicit verifier permission in the activity organization';
  END IF;
  NEW.authorization_membership_id := membership_row.membership_id;
  NEW.authorization_role_id := membership_row.role_id;
  NEW.authorization_permissions_snapshot := membership_row.permissions;
  NEW.authorization_checked_at := clock_timestamp();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.enforce_verification_authorization() OWNER TO rupaykg_verification_guard;

CREATE OR REPLACE FUNCTION public.reject_verification_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$ BEGIN RAISE EXCEPTION 'verification records are append-only; DELETE is prohibited'; END; $$;
ALTER FUNCTION public.reject_verification_delete() OWNER TO rupaykg_verification_guard;
REVOKE ALL ON FUNCTION public.reject_verification_delete() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reject_verification_truncate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$ BEGIN RAISE EXCEPTION 'verification records are append-only; TRUNCATE is prohibited'; END; $$;
ALTER FUNCTION public.reject_verification_truncate() OWNER TO rupaykg_verification_guard;
REVOKE ALL ON FUNCTION public.reject_verification_truncate() FROM PUBLIC;

DROP TRIGGER IF EXISTS verification_independence_guard ON public.verifications;
DROP TRIGGER IF EXISTS verifications_integrity_guard ON public.verifications;
DROP TRIGGER IF EXISTS verification_authorization_guard ON public.verifications;
DROP TRIGGER IF EXISTS verification_delete_guard ON public.verifications;
DROP TRIGGER IF EXISTS verification_truncate_guard ON public.verifications;

CREATE TRIGGER verification_authorization_guard BEFORE INSERT OR UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.enforce_verification_authorization();
CREATE TRIGGER verification_delete_guard BEFORE DELETE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.reject_verification_delete();
CREATE TRIGGER verification_truncate_guard BEFORE TRUNCATE ON public.verifications FOR EACH STATEMENT EXECUTE FUNCTION public.reject_verification_truncate();

DO $assert$
DECLARE v_trigger_count integer; v_guard_owner text; v_search_path text[]; v_has_role_fallback boolean;
BEGIN
  SELECT count(*) INTO v_trigger_count FROM pg_trigger WHERE tgrelid='public.verifications'::regclass AND NOT tgisinternal;
  IF v_trigger_count <> 3 THEN RAISE EXCEPTION 'expected exactly 3 authoritative verification triggers, found %',v_trigger_count; END IF;
  SELECT pg_get_userbyid(p.proowner), p.proconfig INTO v_guard_owner,v_search_path FROM pg_proc p WHERE p.oid='public.enforce_verification_authorization()'::regprocedure;
  IF v_guard_owner <> 'rupaykg_verification_guard' OR v_search_path <> ARRAY['search_path=pg_catalog']::text[] THEN
    RAISE EXCEPTION 'verification authorization function has incorrect owner/search_path: % / %',v_guard_owner,v_search_path;
  END IF;
  SELECT position('R.NAME' in upper(pg_get_functiondef(p.oid))) > 0
      OR position('ROLE_NAME' in upper(pg_get_functiondef(p.oid))) > 0
      OR position('CURRENT_USER' in upper(pg_get_functiondef(p.oid))) > 0
      OR position('SESSION_USER' in upper(pg_get_functiondef(p.oid))) > 0
    INTO v_has_role_fallback
    FROM pg_proc p WHERE p.oid='public.enforce_verification_authorization()'::regprocedure;
  IF v_has_role_fallback THEN RAISE EXCEPTION 'role-name authorization fallback remains in converged verification guard'; END IF;
  IF position('PERMISSIONS' in upper(pg_get_functiondef((SELECT p.oid FROM pg_proc p WHERE p.oid='public.enforce_verification_authorization()'::regprocedure)))) = 0
     OR position('ORGANIZATION_ID' in upper(pg_get_functiondef((SELECT p.oid FROM pg_proc p WHERE p.oid='public.enforce_verification_authorization()'::regprocedure)))) = 0 THEN
    RAISE EXCEPTION 'explicit tenant-bound permission checks are absent from converged verification guard';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_auth_context_owner') THEN RAISE EXCEPTION 'competing authentication context owner remains'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.rupaykg_set_authenticated_context(text,uuid)'::regprocedure AND p.prosecdef AND pg_get_userbyid(p.proowner)='rupaykg_verification_guard' AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]) THEN
    RAISE EXCEPTION 'authenticated context issuer is not guard-owned with fixed search_path';
  END IF;
END
$assert$;

DO $assert$
BEGIN
  IF public.rupaykg_context_is_valid() THEN RAISE EXCEPTION 'context unexpectedly valid without authenticated transaction context'; END IF;
  IF public.rupaykg_authenticated_identity() IS NOT NULL THEN RAISE EXCEPTION 'authenticated identity unexpectedly resolved without context'; END IF;
END
$assert$;

\if :{?KEEP_CONVERGENCE}
\else
ROLLBACK;
\endif
