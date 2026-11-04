-- Runs only against the ephemeral GitHub Actions PostgreSQL database after
-- the repository migrations and the exact PR #247 candidate migration fixture.
-- This proves the candidate SECURITY INVOKER migration's real-schema privilege
-- requirements; it is not a production-role or RLS certification.
\set ON_ERROR_STOP on

DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_actual_schema_api_proof') THEN
    EXECUTE 'DROP OWNED BY rupaykg_actual_schema_api_proof';
    EXECUTE 'DROP ROLE rupaykg_actual_schema_api_proof';
  END IF;
END;
$cleanup$;
CREATE ROLE rupaykg_actual_schema_api_proof
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO rupaykg_actual_schema_api_proof;
GRANT INSERT ON public.verifications TO rupaykg_actual_schema_api_proof;

-- SECURITY INVOKER means the API identity itself needs these read privileges
-- and column-scoped UPDATE privileges for every SELECT ... FOR SHARE.
GRANT SELECT ON public.evidence, public.activities,
  public.organization_memberships, public.roles, public.identities
  TO rupaykg_actual_schema_api_proof;
GRANT UPDATE (id) ON public.evidence, public.activities,
  public.organization_memberships, public.roles, public.identities
  TO rupaykg_actual_schema_api_proof;
GRANT SELECT ON public.geography, public.organization_geography_scopes
  TO rupaykg_actual_schema_api_proof;
GRANT EXECUTE ON FUNCTION public.organization_has_geography_scope(uuid, uuid)
  TO rupaykg_actual_schema_api_proof;

DO $role_assertions$
BEGIN
  IF (SELECT rolsuper OR rolbypassrls OR rolcanlogin
        FROM pg_roles WHERE rolname='rupaykg_actual_schema_api_proof') THEN
    RAISE EXCEPTION 'proof API role must be NOLOGIN/NOSUPERUSER/NOBYPASSRLS';
  END IF;
  IF has_table_privilege('rupaykg_actual_schema_api_proof','public.verifications','SELECT')
     OR has_table_privilege('rupaykg_actual_schema_api_proof','public.verifications','UPDATE')
     OR has_table_privilege('rupaykg_actual_schema_api_proof','public.verifications','DELETE') THEN
    RAISE EXCEPTION 'proof API role has excess verification-table privileges';
  END IF;
  IF has_table_privilege('rupaykg_actual_schema_api_proof','public.evidence','UPDATE')
     OR has_table_privilege('rupaykg_actual_schema_api_proof','public.activities','UPDATE')
     OR has_table_privilege('rupaykg_actual_schema_api_proof','public.organization_memberships','UPDATE')
     OR has_table_privilege('rupaykg_actual_schema_api_proof','public.roles','UPDATE')
     OR has_table_privilege('rupaykg_actual_schema_api_proof','public.identities','UPDATE') THEN
    RAISE EXCEPTION 'proof API role unexpectedly has table-wide UPDATE';
  END IF;
  IF NOT has_column_privilege('rupaykg_actual_schema_api_proof','public.evidence','id','UPDATE')
     OR NOT has_column_privilege('rupaykg_actual_schema_api_proof','public.activities','id','UPDATE')
     OR NOT has_column_privilege('rupaykg_actual_schema_api_proof','public.organization_memberships','id','UPDATE')
     OR NOT has_column_privilege('rupaykg_actual_schema_api_proof','public.roles','id','UPDATE')
     OR NOT has_column_privilege('rupaykg_actual_schema_api_proof','public.identities','id','UPDATE') THEN
    RAISE EXCEPTION 'proof API role lacks a required row-lock column privilege';
  END IF;
  IF has_column_privilege('rupaykg_actual_schema_api_proof','public.evidence','activity_id','UPDATE')
     OR has_column_privilege('rupaykg_actual_schema_api_proof','public.activities','organization_id','UPDATE')
     OR has_column_privilege('rupaykg_actual_schema_api_proof','public.organization_memberships','status','UPDATE')
     OR has_column_privilege('rupaykg_actual_schema_api_proof','public.roles','permissions','UPDATE')
     OR has_column_privilege('rupaykg_actual_schema_api_proof','public.identities','suspended_at','UPDATE') THEN
    RAISE EXCEPTION 'proof API role has UPDATE on protected business data columns';
  END IF;
END;
$role_assertions$;

INSERT INTO public.organizations(name,organization_type,status)
VALUES ('CI-ACTUAL-SCHEMA-ORG-A','test_fixture','VERIFIED'),
       ('CI-ACTUAL-SCHEMA-ORG-B','test_fixture','VERIFIED');

INSERT INTO public.geography(kind,name,source,source_version)
VALUES ('STATE_UT','CI-ACTUAL-SCHEMA-GEO','ci-fixture','v1');

INSERT INTO public.identities(external_subject,display_name,status)
VALUES ('ci-actual-schema-verifier','CI Actual Schema Verifier','VERIFIED'),
       ('ci-actual-schema-outsider','CI Actual Schema Outsider','VERIFIED');

INSERT INTO public.roles(organization_id,name,permissions,geography_scope)
SELECT id,'ci_actual_schema_verifier','["VERIFY_EVIDENCE"]'::jsonb,'[]'::jsonb
FROM public.organizations WHERE name='CI-ACTUAL-SCHEMA-ORG-A';

ALTER TABLE public.organization_memberships
  DISABLE TRIGGER stakeholder_membership_application_guard;
INSERT INTO public.organization_memberships(identity_id,organization_id,role_id,status)
SELECT i.id,o.id,r.id,'VERIFIED'
FROM public.identities i
CROSS JOIN public.organizations o
JOIN public.roles r ON r.organization_id=o.id
WHERE i.external_subject='ci-actual-schema-verifier'
  AND o.name='CI-ACTUAL-SCHEMA-ORG-A'
  AND r.name='ci_actual_schema_verifier';
ALTER TABLE public.organization_memberships
  ENABLE TRIGGER stakeholder_membership_application_guard;

INSERT INTO public.activities(organization_id,actor_identity_id,geography_id,activity_type,status)
SELECT o.id, outsider.id, g.id, 'CI_ACTUAL_SCHEMA_VERIFICATION','COMPLETED'
FROM public.organizations o
CROSS JOIN public.identities outsider
CROSS JOIN public.geography g
WHERE o.name='CI-ACTUAL-SCHEMA-ORG-A'
  AND outsider.external_subject='ci-actual-schema-outsider'
  AND g.name='CI-ACTUAL-SCHEMA-GEO';

INSERT INTO public.evidence(activity_id,evidence_type,status,captured_at,content_hash)
SELECT a.id,'CI_ACTUAL_SCHEMA','UNDER_REVIEW',now(),repeat('a',64)
FROM public.activities a WHERE a.activity_type='CI_ACTUAL_SCHEMA_VERIFICATION';

-- A second tenant's evidence is used to prove the current schema's RLS posture.
INSERT INTO public.activities(organization_id,actor_identity_id,geography_id,activity_type,status)
SELECT o.id, i.id, g.id, 'CI_OTHER_TENANT_ACTIVITY','COMPLETED'
FROM public.organizations o
CROSS JOIN public.identities i
CROSS JOIN public.geography g
WHERE o.name='CI-ACTUAL-SCHEMA-ORG-B'
  AND i.external_subject='ci-actual-schema-outsider'
  AND g.name='CI-ACTUAL-SCHEMA-GEO';
INSERT INTO public.evidence(activity_id,evidence_type,status,captured_at,content_hash)
SELECT a.id,'CI_OTHER_TENANT_EVIDENCE','UNDER_REVIEW',now(),repeat('b',64)
FROM public.activities a WHERE a.activity_type='CI_OTHER_TENANT_ACTIVITY';

-- Resolve fixture IDs as the migration/test owner; the API proof role receives
-- no organization-table read grant merely to locate its own test fixture.
SELECT e.id AS proof_evidence_id, a.id AS proof_activity_id, i.id AS proof_identity_id
FROM public.evidence e
JOIN public.activities a ON a.id=e.activity_id
JOIN public.organizations o ON o.id=a.organization_id
JOIN public.identities i ON i.external_subject='ci-actual-schema-verifier'
WHERE e.evidence_type='CI_ACTUAL_SCHEMA'
  AND o.name='CI-ACTUAL-SCHEMA-ORG-A'
\gset

-- The proof role is not the table owner and must successfully invoke the
-- exact candidate trigger using only SELECT + UPDATE(id) on lock targets.
SET ROLE rupaykg_actual_schema_api_proof;
INSERT INTO public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale)
VALUES (:'proof_evidence_id', :'proof_activity_id', :'proof_identity_id',
        'APPROVED','CI_ACTUAL_SCHEMA','Exact candidate migration non-owner role proof');

-- Explicitly record whether another tenant's evidence is directly readable.
-- On the current migration baseline RLS is disabled; this is expected to expose
-- the gap and is a release blocker, not a success claim for tenant isolation.
DO $tenant_read_assertion$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.evidence e
    WHERE e.evidence_type='CI_OTHER_TENANT_EVIDENCE'
  ) THEN
    RAISE EXCEPTION 'unexpectedly could not observe the baseline cross-tenant read finding';
  END IF;
  RAISE NOTICE 'CONFIRMED RELEASE BLOCKER: SECURITY INVOKER API role can read another tenant evidence because RLS is not enabled on the current migration baseline';
END;
$tenant_read_assertion$;
RESET ROLE;

DO $snapshot_assertion$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.evidence e ON e.id=v.evidence_id
    WHERE e.evidence_type='CI_ACTUAL_SCHEMA'
      AND v.authorization_membership_id IS NOT NULL
      AND v.authorization_role_id IS NOT NULL
      AND v.authorization_permissions_snapshot @> '["VERIFY_EVIDENCE"]'::jsonb
      AND v.authorization_checked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'actual-schema non-owner trigger invocation did not capture authorization provenance';
  END IF;
END;
$snapshot_assertion$;

DROP OWNED BY rupaykg_actual_schema_api_proof;
DROP ROLE rupaykg_actual_schema_api_proof;
