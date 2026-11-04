-- Disposable actual-schema SECURITY DEFINER/RLS proof.
-- This deliberately tests both a scoped helper owner and the caller-controlled
-- GUC spoofing limitation. Never run against Neon, Render or a persistent DB.
\set ON_ERROR_STOP on

DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_actual_schema_guard_owner') THEN
    EXECUTE 'DROP OWNED BY rupaykg_actual_schema_guard_owner';
    EXECUTE 'DROP ROLE rupaykg_actual_schema_guard_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_actual_schema_api_definer_proof') THEN
    EXECUTE 'DROP OWNED BY rupaykg_actual_schema_api_definer_proof';
    EXECUTE 'DROP ROLE rupaykg_actual_schema_api_definer_proof';
  END IF;
END;
$cleanup$;

CREATE ROLE rupaykg_actual_schema_guard_owner
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE rupaykg_actual_schema_api_definer_proof
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

-- Activate tenant-filtered policies on the exact candidate trigger read/lock
-- set. These policies are a test fixture, not approved production policies.
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_geography_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_geography_scopes FORCE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO rupaykg_actual_schema_guard_owner,
  rupaykg_actual_schema_api_definer_proof;
GRANT SELECT ON public.evidence, public.activities,
  public.organization_memberships, public.roles, public.identities
  TO rupaykg_actual_schema_guard_owner;
GRANT UPDATE (id) ON public.evidence, public.activities,
  public.organization_memberships, public.roles, public.identities
  TO rupaykg_actual_schema_guard_owner;
GRANT SELECT ON public.geography, public.organization_geography_scopes
  TO rupaykg_actual_schema_guard_owner;
GRANT EXECUTE ON FUNCTION public.organization_has_geography_scope(uuid, uuid)
  TO rupaykg_actual_schema_guard_owner;
GRANT INSERT ON public.verifications TO rupaykg_actual_schema_api_definer_proof;

CREATE POLICY definer_activity_select ON public.activities
  FOR SELECT TO rupaykg_actual_schema_guard_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY definer_activity_lock ON public.activities
  FOR UPDATE TO rupaykg_actual_schema_guard_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY definer_evidence_select ON public.evidence
  FOR SELECT TO rupaykg_actual_schema_guard_owner
  USING (EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = evidence.activity_id
      AND a.organization_id = current_setting('app.organization_id', true)::uuid
  ));
CREATE POLICY definer_evidence_lock ON public.evidence
  FOR UPDATE TO rupaykg_actual_schema_guard_owner
  USING (EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = evidence.activity_id
      AND a.organization_id = current_setting('app.organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = evidence.activity_id
      AND a.organization_id = current_setting('app.organization_id', true)::uuid
  ));

CREATE POLICY definer_membership_select ON public.organization_memberships
  FOR SELECT TO rupaykg_actual_schema_guard_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY definer_membership_lock ON public.organization_memberships
  FOR UPDATE TO rupaykg_actual_schema_guard_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY definer_role_select ON public.roles
  FOR SELECT TO rupaykg_actual_schema_guard_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY definer_role_lock ON public.roles
  FOR UPDATE TO rupaykg_actual_schema_guard_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY definer_identity_select ON public.identities
  FOR SELECT TO rupaykg_actual_schema_guard_owner
  USING (EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.identity_id = identities.id
      AND m.organization_id = current_setting('app.organization_id', true)::uuid
  ));
CREATE POLICY definer_identity_lock ON public.identities
  FOR UPDATE TO rupaykg_actual_schema_guard_owner
  USING (EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.identity_id = identities.id
      AND m.organization_id = current_setting('app.organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.identity_id = identities.id
      AND m.organization_id = current_setting('app.organization_id', true)::uuid
  ));

CREATE POLICY definer_geography_scope_select ON public.organization_geography_scopes
  FOR SELECT TO rupaykg_actual_schema_guard_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);

-- Make only the candidate trigger SECURITY DEFINER, with a non-login,
-- non-owner, non-bypass function owner and fixed search_path.
GRANT CREATE ON SCHEMA public TO rupaykg_actual_schema_guard_owner;
ALTER FUNCTION public.enforce_verification_authorization()
  SECURITY DEFINER;
ALTER FUNCTION public.enforce_verification_authorization()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.enforce_verification_authorization()
  OWNER TO rupaykg_actual_schema_guard_owner;
REVOKE CREATE ON SCHEMA public FROM rupaykg_actual_schema_guard_owner;

DO $owner_assertions$
BEGIN
  IF (SELECT rolcanlogin OR rolsuper OR rolbypassrls
        FROM pg_roles WHERE rolname='rupaykg_actual_schema_guard_owner') THEN
    RAISE EXCEPTION 'actual-schema helper owner must be NOLOGIN/NOSUPERUSER/NOBYPASSRLS';
  END IF;
  IF (SELECT relowner FROM pg_class WHERE oid='public.evidence'::regclass)
       = (SELECT oid FROM pg_roles WHERE rolname='rupaykg_actual_schema_guard_owner') THEN
    RAISE EXCEPTION 'actual-schema helper must not own evidence table';
  END IF;
  IF has_table_privilege('rupaykg_actual_schema_api_definer_proof','public.evidence','SELECT')
     OR has_table_privilege('rupaykg_actual_schema_api_definer_proof','public.activities','SELECT')
     OR has_table_privilege('rupaykg_actual_schema_api_definer_proof','public.verifications','SELECT')
     OR has_table_privilege('rupaykg_actual_schema_api_definer_proof','public.verifications','UPDATE')
     OR has_table_privilege('rupaykg_actual_schema_api_definer_proof','public.verifications','DELETE') THEN
    RAISE EXCEPTION 'actual-schema API role unexpectedly has direct protected-table privileges';
  END IF;
END;
$owner_assertions$;

INSERT INTO public.organizations(name,organization_type,status)
VALUES ('CI-DEFINER-ORG-A','test_fixture','VERIFIED'),
       ('CI-DEFINER-ORG-B','test_fixture','VERIFIED');
INSERT INTO public.geography(kind,name,source,source_version)
VALUES ('STATE_UT','CI-DEFINER-GEO','ci-fixture','v1');
INSERT INTO public.identities(external_subject,display_name,status)
VALUES ('ci-definer-verifier-a','CI Definer Verifier A','VERIFIED'),
       ('ci-definer-verifier-b','CI Definer Verifier B','VERIFIED'),
       ('ci-definer-actor','CI Definer Actor','VERIFIED');
INSERT INTO public.roles(organization_id,name,permissions,geography_scope)
SELECT id,'ci_definer_verifier','["VERIFY_EVIDENCE"]'::jsonb,'[]'::jsonb
FROM public.organizations WHERE name IN ('CI-DEFINER-ORG-A','CI-DEFINER-ORG-B');

ALTER TABLE public.organization_memberships
  DISABLE TRIGGER stakeholder_membership_application_guard;
INSERT INTO public.organization_memberships(identity_id,organization_id,role_id,status)
SELECT i.id,o.id,r.id,'VERIFIED'::record_status
FROM public.identities i
JOIN public.organizations o ON o.name='CI-DEFINER-ORG-A'
JOIN public.roles r ON r.organization_id=o.id
WHERE i.external_subject='ci-definer-verifier-a'
UNION ALL
SELECT i.id,o.id,r.id,'VERIFIED'::record_status
FROM public.identities i
JOIN public.organizations o ON o.name='CI-DEFINER-ORG-B'
JOIN public.roles r ON r.organization_id=o.id
WHERE i.external_subject='ci-definer-verifier-b';
ALTER TABLE public.organization_memberships
  ENABLE TRIGGER stakeholder_membership_application_guard;

INSERT INTO public.activities(organization_id,actor_identity_id,geography_id,activity_type,status)
SELECT o.id,a.id,g.id,'CI_DEFINER_ACTIVITY','COMPLETED'
FROM public.organizations o
CROSS JOIN public.identities a
CROSS JOIN public.geography g
WHERE o.name IN ('CI-DEFINER-ORG-A','CI-DEFINER-ORG-B')
  AND a.external_subject='ci-definer-actor'
  AND g.name='CI-DEFINER-GEO';
INSERT INTO public.evidence(activity_id,evidence_type,status,captured_at,content_hash)
SELECT a.id,'CI_DEFINER_EVIDENCE','UNDER_REVIEW',now(),repeat('c',64)
FROM public.activities a WHERE a.activity_type='CI_DEFINER_ACTIVITY';

SELECT e.id AS evidence_a, a.id AS activity_a, i.id AS verifier_a
FROM public.evidence e
JOIN public.activities a ON a.id=e.activity_id
JOIN public.organizations o ON o.id=a.organization_id
JOIN public.identities i ON i.external_subject='ci-definer-verifier-a'
WHERE o.name='CI-DEFINER-ORG-A'
  AND e.evidence_type='CI_DEFINER_EVIDENCE'
\gset
SELECT e.id AS evidence_b, a.id AS activity_b, i.id AS verifier_b
FROM public.evidence e
JOIN public.activities a ON a.id=e.activity_id
JOIN public.organizations o ON o.id=a.organization_id
JOIN public.identities i ON i.external_subject='ci-definer-verifier-b'
WHERE o.name='CI-DEFINER-ORG-B'
  AND e.evidence_type='CI_DEFINER_EVIDENCE'
\gset
SELECT id AS org_a FROM public.organizations WHERE name='CI-DEFINER-ORG-A' \gset
SELECT id AS org_b FROM public.organizations WHERE name='CI-DEFINER-ORG-B' \gset

BEGIN;
SET ROLE rupaykg_actual_schema_api_definer_proof;
SELECT set_config('app.organization_id', :'org_a', true);
INSERT INTO public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale)
VALUES (:'evidence_a', :'activity_a', :'verifier_a',
        'APPROVED','CI_DEFINER','Actual-schema helper owner RLS proof');
COMMIT;

-- SECURITY DEFINER + RLS hides direct protected reads from API, but the
-- caller can set arbitrary custom GUC values and choose a different verifier.
-- This second insert intentionally demonstrates why a caller-set GUC is NOT
-- authenticated tenant/identity provenance.
BEGIN;
SET ROLE rupaykg_actual_schema_api_definer_proof;
SELECT set_config('app.organization_id', :'org_b', true);
INSERT INTO public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale)
VALUES (:'evidence_b', :'activity_b', :'verifier_b',
        'APPROVED','CI_DEFINER_SPOOF','Caller-controlled GUC spoofing proof');
COMMIT;

RESET ROLE;
DO $spoof_assertion$
BEGIN
  IF (SELECT count(*) FROM public.verifications v
      JOIN public.evidence e ON e.id=v.evidence_id
      WHERE e.evidence_type='CI_DEFINER_EVIDENCE'
        AND v.scope='CI_DEFINER_SPOOF') <> 1 THEN
    RAISE EXCEPTION 'expected caller-controlled tenant context spoof to succeed in this negative proof';
  END IF;
  RAISE NOTICE 'CONFIRMED RELEASE BLOCKER: API role can set app.organization_id and supply another tenant verifier identity; SECURITY DEFINER/RLS alone does not authenticate tenant or verifier context';
END;
$spoof_assertion$;

-- Restore the ephemeral database so the rest of CI tests run on the normal
-- repository schema. No production object is affected.
ALTER FUNCTION public.enforce_verification_authorization()
  OWNER TO postgres;
ALTER FUNCTION public.enforce_verification_authorization()
  SECURITY INVOKER;
DROP POLICY definer_activity_select ON public.activities;
DROP POLICY definer_activity_lock ON public.activities;
DROP POLICY definer_evidence_select ON public.evidence;
DROP POLICY definer_evidence_lock ON public.evidence;
DROP POLICY definer_membership_select ON public.organization_memberships;
DROP POLICY definer_membership_lock ON public.organization_memberships;
DROP POLICY definer_role_select ON public.roles;
DROP POLICY definer_role_lock ON public.roles;
DROP POLICY definer_identity_select ON public.identities;
DROP POLICY definer_identity_lock ON public.identities;
DROP POLICY definer_geography_scope_select ON public.organization_geography_scopes;
ALTER TABLE public.evidence NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evidence DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.identities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.identities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_geography_scopes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_geography_scopes DISABLE ROW LEVEL SECURITY;
DROP OWNED BY rupaykg_actual_schema_guard_owner;
DROP OWNED BY rupaykg_actual_schema_api_definer_proof;
DROP ROLE rupaykg_actual_schema_guard_owner;
DROP ROLE rupaykg_actual_schema_api_definer_proof;
