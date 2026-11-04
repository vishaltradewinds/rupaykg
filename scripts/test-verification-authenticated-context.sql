-- Prove authenticated PostgreSQL context using an opaque bearer token,
-- a protected HMAC key, and transaction-local signed context.
-- Disposable GitHub Actions PostgreSQL only. Never run against persistent DBs.
\set ON_ERROR_STOP on

DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_context_owner') THEN
    EXECUTE 'DROP OWNED BY rupaykg_context_owner';
    EXECUTE 'DROP ROLE rupaykg_context_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_context_api') THEN
    EXECUTE 'DROP OWNED BY rupaykg_context_api';
    EXECUTE 'DROP ROLE rupaykg_context_api';
  END IF;
END;
$cleanup$;

CREATE ROLE rupaykg_context_owner
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE rupaykg_context_api
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE SCHEMA rupaykg_private AUTHORIZATION rupaykg_context_owner;
REVOKE ALL ON SCHEMA rupaykg_private FROM PUBLIC;
CREATE TABLE rupaykg_private.auth_context_key (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret bytea NOT NULL
);
ALTER TABLE rupaykg_private.auth_context_key OWNER TO rupaykg_context_owner;
INSERT INTO rupaykg_private.auth_context_key(singleton,secret)
VALUES (true, decode(repeat('5a',32),'hex'));

GRANT USAGE ON SCHEMA public TO rupaykg_context_owner,rupaykg_context_api;
GRANT CREATE ON SCHEMA public TO rupaykg_context_owner;
GRANT SELECT ON public.identity_sessions,public.identities,
  public.organization_memberships,public.organizations,public.activities
  TO rupaykg_context_owner;
GRANT SELECT ON public.evidence,public.activities,public.organization_memberships,
  public.roles,public.identities,public.geography,public.organization_geography_scopes
  TO rupaykg_context_api;
GRANT UPDATE (id) ON public.evidence,public.activities,
  public.organization_memberships,public.roles,public.identities
  TO rupaykg_context_api;
GRANT INSERT ON public.verifications TO rupaykg_context_api;
GRANT EXECUTE ON FUNCTION public.organization_has_geography_scope(uuid,uuid)
  TO rupaykg_context_api;

CREATE OR REPLACE FUNCTION public.rupaykg_context_is_valid()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, rupaykg_private
AS $$
DECLARE
  v_identity text;
  v_org text;
  v_session text;
  v_expiry text;
  v_signature text;
  v_secret bytea;
  v_payload text;
  v_expected text;
BEGIN
  v_identity := current_setting('rupaykg.context.identity',true);
  v_org := current_setting('rupaykg.context.organization',true);
  v_session := current_setting('rupaykg.context.session',true);
  v_expiry := current_setting('rupaykg.context.expiry',true);
  v_signature := current_setting('rupaykg.context.signature',true);
  IF v_identity IS NULL OR v_org IS NULL OR v_session IS NULL
     OR v_expiry IS NULL OR v_signature IS NULL THEN
    RETURN false;
  END IF;
  IF v_expiry !~ '^[0-9]+$' OR to_timestamp(v_expiry::bigint) <= clock_timestamp() THEN
    RETURN false;
  END IF;
  SELECT k.secret INTO v_secret
    FROM rupaykg_private.auth_context_key k WHERE k.singleton;
  IF v_secret IS NULL THEN RETURN false; END IF;
  v_payload := v_identity || '|' || v_org || '|' || v_session || '|' || v_expiry;
  v_expected := encode(public.hmac(convert_to(v_payload,'UTF8'),v_secret,'sha256'),'hex');
  RETURN v_signature = v_expected;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;
ALTER FUNCTION public.rupaykg_context_is_valid() OWNER TO rupaykg_context_owner;
REVOKE ALL ON FUNCTION public.rupaykg_context_is_valid() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.rupaykg_authenticated_identity()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN public.rupaykg_context_is_valid()
    THEN current_setting('rupaykg.context.identity',true)::uuid ELSE NULL END
$$;
ALTER FUNCTION public.rupaykg_authenticated_identity() OWNER TO rupaykg_context_owner;
REVOKE ALL ON FUNCTION public.rupaykg_authenticated_identity() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.rupaykg_authenticated_organization()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN public.rupaykg_context_is_valid()
    THEN current_setting('rupaykg.context.organization',true)::uuid ELSE NULL END
$$;
ALTER FUNCTION public.rupaykg_authenticated_organization() OWNER TO rupaykg_context_owner;
REVOKE ALL ON FUNCTION public.rupaykg_authenticated_organization() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.rupaykg_set_authenticated_context(
  p_bearer_token text, p_organization_id uuid
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, rupaykg_private
AS $$
DECLARE
  v_identity uuid;
  v_session uuid;
  v_expiry bigint;
  v_secret bytea;
  v_payload text;
  v_signature text;
BEGIN
  IF p_bearer_token IS NULL OR length(p_bearer_token) < 20
     OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'authenticated bearer token and organization are required';
  END IF;

  SELECT s.identity_id,s.id,extract(epoch FROM s.expires_at)::bigint
    INTO v_identity,v_session,v_expiry
    FROM public.identity_sessions s
    JOIN public.identities i ON i.id=s.identity_id
    JOIN public.organization_memberships m ON m.identity_id=i.id
    JOIN public.organizations o ON o.id=m.organization_id
   WHERE s.token_hash=encode(public.digest(convert_to(p_bearer_token,'UTF8'),'sha256'),'hex')
     AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
     AND i.status='VERIFIED' AND i.suspended_at IS NULL
     AND m.organization_id=p_organization_id AND m.status='VERIFIED'
     AND o.status='VERIFIED'
   ORDER BY s.issued_at DESC,s.id DESC
   LIMIT 1
   FOR SHARE OF s,i,m,o;

  IF v_identity IS NULL THEN
    RAISE EXCEPTION 'bearer session, identity, membership or organization is not currently authorized';
  END IF;

  SELECT k.secret INTO v_secret
    FROM rupaykg_private.auth_context_key k WHERE k.singleton;
  v_payload := v_identity::text || '|' || p_organization_id::text || '|' ||
               v_session::text || '|' || v_expiry::text;
  v_signature := encode(public.hmac(convert_to(v_payload,'UTF8'),v_secret,'sha256'),'hex');

  PERFORM set_config('rupaykg.context.identity',v_identity::text,true);
  PERFORM set_config('rupaykg.context.organization',p_organization_id::text,true);
  PERFORM set_config('rupaykg.context.session',v_session::text,true);
  PERFORM set_config('rupaykg.context.expiry',v_expiry::text,true);
  PERFORM set_config('rupaykg.context.signature',v_signature,true);
  RETURN v_identity;
END;
$$;
ALTER FUNCTION public.rupaykg_set_authenticated_context(text,uuid)
  OWNER TO rupaykg_context_owner;
REVOKE ALL ON FUNCTION public.rupaykg_set_authenticated_context(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rupaykg_set_authenticated_context(text,uuid)
  TO rupaykg_context_api;
GRANT EXECUTE ON FUNCTION public.rupaykg_context_is_valid()
  TO rupaykg_context_api;
GRANT EXECUTE ON FUNCTION public.rupaykg_authenticated_identity()
  TO rupaykg_context_api;
GRANT EXECUTE ON FUNCTION public.rupaykg_authenticated_organization()
  TO rupaykg_context_api;

CREATE OR REPLACE FUNCTION public.rupaykg_require_authenticated_verifier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_activity_org uuid;
BEGIN
  IF NOT public.rupaykg_context_is_valid() THEN
    RAISE EXCEPTION 'verification requires cryptographically authenticated transaction context';
  END IF;
  IF NEW.verifier_identity_id IS DISTINCT FROM public.rupaykg_authenticated_identity() THEN
    RAISE EXCEPTION 'verification identity does not match authenticated bearer session';
  END IF;
  SELECT a.organization_id INTO v_activity_org
    FROM public.activities a WHERE a.id=NEW.activity_id FOR SHARE;
  IF v_activity_org IS DISTINCT FROM public.rupaykg_authenticated_organization() THEN
    RAISE EXCEPTION 'verification organization does not match authenticated organization context';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.rupaykg_require_authenticated_verifier()
  OWNER TO rupaykg_context_owner;
REVOKE CREATE ON SCHEMA public FROM rupaykg_context_owner;
REVOKE ALL ON FUNCTION public.rupaykg_require_authenticated_verifier() FROM PUBLIC;
CREATE TRIGGER aaa_rupaykg_authenticated_verifier_guard
BEFORE INSERT ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.rupaykg_require_authenticated_verifier();

DO $owner_checks$
BEGIN
  IF (SELECT rolcanlogin OR rolsuper OR rolbypassrls FROM pg_roles
      WHERE rolname='rupaykg_context_owner') THEN
    RAISE EXCEPTION 'context owner must be NOLOGIN/NOSUPERUSER/NOBYPASSRLS';
  END IF;
  IF has_table_privilege('rupaykg_context_api','rupaykg_private.auth_context_key','SELECT')
     OR has_schema_privilege('rupaykg_context_api','rupaykg_private','USAGE') THEN
    RAISE EXCEPTION 'API role must not read or use the private HMAC key schema';
  END IF;
  IF has_table_privilege('rupaykg_context_api','public.identity_sessions','SELECT') THEN
    RAISE EXCEPTION 'API role must not directly read identity session tokens/hashes';
  END IF;
END;
$owner_checks$;

INSERT INTO public.organizations(name,organization_type,status)
VALUES ('CI-AUTHCTX-ORG-A','test_fixture','VERIFIED'),
       ('CI-AUTHCTX-ORG-B','test_fixture','VERIFIED');
INSERT INTO public.geography(kind,name,source,source_version)
VALUES ('STATE_UT','CI-AUTHCTX-GEO','ci-fixture','v1');
INSERT INTO public.identities(external_subject,display_name,status)
VALUES ('ci-authctx-verifier-a','CI Auth Context Verifier A','VERIFIED'),
       ('ci-authctx-verifier-b','CI Auth Context Verifier B','VERIFIED'),
       ('ci-authctx-actor','CI Auth Context Actor','VERIFIED');
INSERT INTO public.roles(organization_id,name,permissions,geography_scope)
SELECT id,'ci_authctx_verifier','["VERIFY_EVIDENCE"]'::jsonb,'[]'::jsonb
FROM public.organizations WHERE name IN ('CI-AUTHCTX-ORG-A','CI-AUTHCTX-ORG-B');

ALTER TABLE public.organization_memberships
  DISABLE TRIGGER stakeholder_membership_application_guard;
INSERT INTO public.organization_memberships(identity_id,organization_id,role_id,status)
SELECT i.id,o.id,r.id,'VERIFIED'::record_status
FROM public.identities i
JOIN public.organizations o ON o.name='CI-AUTHCTX-ORG-A'
JOIN public.roles r ON r.organization_id=o.id
WHERE i.external_subject='ci-authctx-verifier-a'
UNION ALL
SELECT i.id,o.id,r.id,'VERIFIED'::record_status
FROM public.identities i
JOIN public.organizations o ON o.name='CI-AUTHCTX-ORG-B'
JOIN public.roles r ON r.organization_id=o.id
WHERE i.external_subject='ci-authctx-verifier-b';
ALTER TABLE public.organization_memberships
  ENABLE TRIGGER stakeholder_membership_application_guard;

INSERT INTO public.identity_sessions(identity_id,expires_at,token_hash)
SELECT i.id,now()+interval '10 minutes',
       encode(public.digest(convert_to('ci-authctx-valid-token-a','UTF8'),'sha256'),'hex')
FROM public.identities i WHERE i.external_subject='ci-authctx-verifier-a';
INSERT INTO public.identity_sessions(identity_id,expires_at,token_hash)
SELECT i.id,now()+interval '10 minutes',
       encode(public.digest(convert_to('ci-authctx-valid-token-b','UTF8'),'sha256'),'hex')
FROM public.identities i WHERE i.external_subject='ci-authctx-verifier-b';

INSERT INTO public.activities(organization_id,actor_identity_id,geography_id,activity_type,status)
SELECT o.id,a.id,g.id,'CI_AUTHCTX_ACTIVITY','COMPLETED'
FROM public.organizations o
CROSS JOIN public.identities a
CROSS JOIN public.geography g
WHERE o.name IN ('CI-AUTHCTX-ORG-A','CI-AUTHCTX-ORG-B')
  AND a.external_subject='ci-authctx-actor' AND g.name='CI-AUTHCTX-GEO';
INSERT INTO public.evidence(activity_id,evidence_type,status,captured_at,content_hash)
SELECT a.id,'CI_AUTHCTX_EVIDENCE','UNDER_REVIEW',now(),repeat('d',64)
FROM public.activities a WHERE a.activity_type='CI_AUTHCTX_ACTIVITY';

SELECT e.id evidence_a,a.id activity_a,i.id verifier_a,o.id org_a
FROM public.evidence e JOIN public.activities a ON a.id=e.activity_id
JOIN public.organizations o ON o.id=a.organization_id
JOIN public.identities i ON i.external_subject='ci-authctx-verifier-a'
WHERE o.name='CI-AUTHCTX-ORG-A' AND e.evidence_type='CI_AUTHCTX_EVIDENCE'
\gset
SELECT e.id evidence_b,a.id activity_b,i.id verifier_b,o.id org_b
FROM public.evidence e JOIN public.activities a ON a.id=e.activity_id
JOIN public.organizations o ON o.id=a.organization_id
JOIN public.identities i ON i.external_subject='ci-authctx-verifier-b'
WHERE o.name='CI-AUTHCTX-ORG-B' AND e.evidence_type='CI_AUTHCTX_EVIDENCE'
\gset

BEGIN;
SET ROLE rupaykg_context_api;
SELECT public.rupaykg_set_authenticated_context('ci-authctx-valid-token-a', :'org_a');
INSERT INTO public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale)
VALUES (:'evidence_a',:'activity_a',:'verifier_a','APPROVED','CI_AUTHCTX','Valid signed bearer context');
COMMIT;

-- A caller may write arbitrary custom GUC values but cannot forge the HMAC.
BEGIN;
SET ROLE rupaykg_context_api;
SELECT set_config('rupaykg.context.identity', :'verifier_b', true);
SELECT set_config('rupaykg.context.organization', :'org_b', true);
SELECT set_config('rupaykg.context.session', '00000000-0000-4000-8000-000000000000', true);
SELECT set_config('rupaykg.context.expiry',(extract(epoch FROM now()+interval '5 minutes')::bigint)::text,true);
SELECT set_config('rupaykg.context.signature',repeat('0',64),true);
DO $spoof$
BEGIN
  IF public.rupaykg_context_is_valid() THEN
    RAISE EXCEPTION 'caller-forged context unexpectedly validated';
  END IF;
  IF public.rupaykg_authenticated_identity() IS NOT NULL
     OR public.rupaykg_authenticated_organization() IS NOT NULL THEN
    RAISE EXCEPTION 'caller-forged identity/organization unexpectedly resolved';
  END IF;
END;
$spoof$;
DO $insert_spoof$
DECLARE
  v_evidence uuid;
  v_activity uuid;
  v_verifier uuid;
BEGIN
  SELECT e.id,a.id,i.id INTO v_evidence,v_activity,v_verifier
    FROM public.evidence e
    JOIN public.activities a ON a.id=e.activity_id
    JOIN public.identities i ON i.external_subject='ci-authctx-verifier-b'
   WHERE e.evidence_type='CI_AUTHCTX_EVIDENCE'
     AND a.organization_id=public.rupaykg_authenticated_organization();
  -- The forged context is invalid, so authenticated_organization is NULL.
  IF v_evidence IS NOT NULL THEN
    RAISE EXCEPTION 'invalid GUC unexpectedly resolved a tenant';
  END IF;
  SELECT e.id,a.id,i.id INTO v_evidence,v_activity,v_verifier
    FROM public.evidence e
    JOIN public.activities a ON a.id=e.activity_id
    JOIN public.identities i ON i.external_subject='ci-authctx-verifier-b'
   WHERE e.evidence_type='CI_AUTHCTX_EVIDENCE'
   ORDER BY e.id DESC LIMIT 1;
  BEGIN
    INSERT INTO public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale)
    VALUES (v_evidence,v_activity,v_verifier,'APPROVED','CI_AUTHCTX_SPOOF','Must reject forged GUC');
    RAISE EXCEPTION 'caller-forged context unexpectedly inserted a verification';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'caller-forged context unexpectedly inserted a verification' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%cryptographically authenticated transaction context%' THEN RAISE; END IF;
  END;
END;
$insert_spoof$;
COMMIT;
RESET ROLE;

-- Revocation is checked by the context issuer on every transaction.
UPDATE public.identity_sessions s SET revoked_at=now()
FROM public.identities i
WHERE s.identity_id=i.id AND i.external_subject='ci-authctx-verifier-a';
DO $revoked$
DECLARE
  v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE name='CI-AUTHCTX-ORG-A';
  BEGIN
    PERFORM public.rupaykg_set_authenticated_context('ci-authctx-valid-token-a',v_org);
    RAISE EXCEPTION 'revoked bearer session unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'revoked bearer session unexpectedly accepted' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%bearer session, identity, membership or organization%' THEN RAISE; END IF;
  END;
END;
$revoked$;


RESET ROLE;
DROP TRIGGER aaa_rupaykg_authenticated_verifier_guard ON public.verifications;
DROP FUNCTION public.rupaykg_require_authenticated_verifier();
DROP FUNCTION public.rupaykg_set_authenticated_context(text,uuid);
DROP FUNCTION public.rupaykg_authenticated_identity();
DROP FUNCTION public.rupaykg_authenticated_organization();
DROP FUNCTION public.rupaykg_context_is_valid();
DROP SCHEMA rupaykg_private CASCADE;
DROP OWNED BY rupaykg_context_owner;
DROP OWNED BY rupaykg_context_api;
DROP ROLE rupaykg_context_owner;
DROP ROLE rupaykg_context_api;
