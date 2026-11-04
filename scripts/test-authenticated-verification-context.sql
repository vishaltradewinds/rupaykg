-- End-to-end proof for the active authenticated verification migration.
-- Runs only on ephemeral GitHub Actions PostgreSQL; all fixtures roll back.
\set ON_ERROR_STOP on

BEGIN;

CREATE ROLE rupaykg_test_verification_api
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO rupaykg_test_verification_api;
GRANT INSERT ON public.verifications TO rupaykg_test_verification_api;
GRANT EXECUTE ON FUNCTION public.rupaykg_set_authenticated_context(text,uuid)
  TO rupaykg_test_verification_api;

DO $privilege_checks$
BEGIN
  IF (SELECT rolcanlogin OR rolsuper OR rolbypassrls FROM pg_roles
      WHERE rolname='rupaykg_auth_context_owner') THEN
    RAISE EXCEPTION 'auth context owner must be NOLOGIN/NOSUPERUSER/NOBYPASSRLS';
  END IF;
  IF has_table_privilege('rupaykg_test_verification_api','public.identity_sessions','SELECT')
     OR has_table_privilege('rupaykg_test_verification_api','public.evidence','SELECT')
     OR has_table_privilege('rupaykg_test_verification_api','public.activities','SELECT')
     OR has_table_privilege('rupaykg_test_verification_api','public.verifications','SELECT')
     OR has_table_privilege('rupaykg_test_verification_api','public.verifications','DELETE')
     OR has_table_privilege('rupaykg_test_verification_api','public.verifications','TRUNCATE')
     OR has_schema_privilege('rupaykg_test_verification_api','rupaykg_private','USAGE') THEN
    RAISE EXCEPTION 'API role has direct protected-table or private-key access';
  END IF;
  IF has_table_privilege('rupaykg_auth_context_owner','public.identity_sessions','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.identities','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.organization_memberships','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.organizations','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.activities','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.evidence','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.roles','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.geography','UPDATE')
     OR has_table_privilege('rupaykg_auth_context_owner','public.organization_geography_scopes','UPDATE') THEN
    RAISE EXCEPTION 'auth context owner unexpectedly has table-wide UPDATE';
  END IF;
END;
$privilege_checks$;

INSERT INTO public.organizations(name,organization_type,status)
VALUES ('CI-ACTIVE-AUTHCTX-ORG-A','test_fixture','VERIFIED'::record_status),
       ('CI-ACTIVE-AUTHCTX-ORG-B','test_fixture','VERIFIED'::record_status);
INSERT INTO public.geography(kind,name,source,source_version)
VALUES ('STATE_UT','CI-ACTIVE-AUTHCTX-GEO','ci-fixture','v1');

INSERT INTO public.identities(external_subject,display_name,status)
VALUES ('ci-active-authctx-verifier-a','CI Active Auth Context Verifier A','VERIFIED'::record_status),
       ('ci-active-authctx-verifier-b','CI Active Auth Context Verifier B','VERIFIED'::record_status),
       ('ci-active-authctx-actor','CI Active Auth Context Actor','VERIFIED'::record_status);

INSERT INTO public.roles(organization_id,name,permissions,geography_scope)
SELECT id,'ci_active_authctx_verifier','["VERIFY_EVIDENCE"]'::jsonb,'[]'::jsonb
FROM public.organizations
WHERE name IN ('CI-ACTIVE-AUTHCTX-ORG-A','CI-ACTIVE-AUTHCTX-ORG-B');

ALTER TABLE public.organization_memberships
  DISABLE TRIGGER stakeholder_membership_application_guard;
INSERT INTO public.organization_memberships(identity_id,organization_id,role_id,status)
SELECT i.id,o.id,r.id,'VERIFIED'::record_status
FROM public.identities i
JOIN public.organizations o ON o.name='CI-ACTIVE-AUTHCTX-ORG-A'
JOIN public.roles r ON r.organization_id=o.id
WHERE i.external_subject='ci-active-authctx-verifier-a'
UNION ALL
SELECT i.id,o.id,r.id,'VERIFIED'::record_status
FROM public.identities i
JOIN public.organizations o ON o.name='CI-ACTIVE-AUTHCTX-ORG-B'
JOIN public.roles r ON r.organization_id=o.id
WHERE i.external_subject='ci-active-authctx-verifier-b';
ALTER TABLE public.organization_memberships
  ENABLE TRIGGER stakeholder_membership_application_guard;

INSERT INTO public.organization_geography_scopes(organization_id,geography_id,status)
SELECT o.id,g.id,'VERIFIED'::record_status
FROM public.organizations o CROSS JOIN public.geography g
WHERE o.name IN ('CI-ACTIVE-AUTHCTX-ORG-A','CI-ACTIVE-AUTHCTX-ORG-B')
  AND g.name='CI-ACTIVE-AUTHCTX-GEO';

INSERT INTO public.identity_sessions(identity_id,expires_at,token_hash)
SELECT i.id,now()+interval '10 minutes',
       encode(public.digest(convert_to('ci-active-authctx-valid-token-a','UTF8'),'sha256'),'hex')
FROM public.identities i WHERE i.external_subject='ci-active-authctx-verifier-a';
INSERT INTO public.identity_sessions(identity_id,expires_at,token_hash)
SELECT i.id,now()+interval '10 minutes',
       encode(public.digest(convert_to('ci-active-authctx-valid-token-b','UTF8'),'sha256'),'hex')
FROM public.identities i WHERE i.external_subject='ci-active-authctx-verifier-b';

INSERT INTO public.activities(organization_id,actor_identity_id,geography_id,activity_type,status)
SELECT o.id,a.id,g.id,'CI_ACTIVE_AUTHCTX_ACTIVITY','COMPLETED'
FROM public.organizations o
CROSS JOIN public.identities a
CROSS JOIN public.geography g
WHERE o.name IN ('CI-ACTIVE-AUTHCTX-ORG-A','CI-ACTIVE-AUTHCTX-ORG-B')
  AND a.external_subject='ci-active-authctx-actor'
  AND g.name='CI-ACTIVE-AUTHCTX-GEO';
INSERT INTO public.evidence(activity_id,evidence_type,status,captured_at,content_hash)
SELECT a.id,'CI_ACTIVE_AUTHCTX_EVIDENCE','UNDER_REVIEW'::evidence_status,now(),repeat('e',64)
FROM public.activities a
WHERE a.activity_type='CI_ACTIVE_AUTHCTX_ACTIVITY';

SELECT e.id evidence_a,a.id activity_a,i.id verifier_a,o.id org_a
FROM public.evidence e JOIN public.activities a ON a.id=e.activity_id
JOIN public.organizations o ON o.id=a.organization_id
JOIN public.identities i ON i.external_subject='ci-active-authctx-verifier-a'
WHERE o.name='CI-ACTIVE-AUTHCTX-ORG-A'
  AND e.evidence_type='CI_ACTIVE_AUTHCTX_EVIDENCE'
\gset
SELECT e.id evidence_b,a.id activity_b,i.id verifier_b,o.id org_b
FROM public.evidence e JOIN public.activities a ON a.id=e.activity_id
JOIN public.organizations o ON o.id=a.organization_id
JOIN public.identities i ON i.external_subject='ci-active-authctx-verifier-b'
WHERE o.name='CI-ACTIVE-AUTHCTX-ORG-B'
  AND e.evidence_type='CI_ACTIVE_AUTHCTX_EVIDENCE'
\gset

CREATE OR REPLACE FUNCTION public.rupaykg_test_expect_spoof_rejected(
  p_evidence uuid,p_activity uuid,p_verifier uuid
) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale)
  VALUES (p_evidence,p_activity,p_verifier,'APPROVED','CI_SPOOF','must be rejected');
  RETURN false;
EXCEPTION WHEN SQLSTATE '28000' THEN
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rupaykg_test_expect_revoked_rejected(
  p_organization uuid
) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.rupaykg_set_authenticated_context('ci-active-authctx-valid-token-a',p_organization);
  RETURN false;
EXCEPTION WHEN SQLSTATE '28000' THEN
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rupaykg_test_delete_guard(p_verification uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.verifications WHERE id=p_verification;
  RETURN false;
EXCEPTION WHEN raise_exception THEN
  RETURN SQLERRM LIKE 'verification records are append-only%';
END;
$$;

CREATE OR REPLACE FUNCTION public.rupaykg_test_truncate_guard()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'TRUNCATE public.verifications';
  RETURN false;
EXCEPTION WHEN raise_exception THEN
  RETURN SQLERRM LIKE 'verification records are append-only%';
END;
$$;

SAVEPOINT valid_context;
SET LOCAL ROLE rupaykg_test_verification_api;
SELECT public.rupaykg_set_authenticated_context('ci-active-authctx-valid-token-a', :'org_a');
INSERT INTO public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale)
VALUES (:'evidence_a',:'activity_a',:'verifier_a','APPROVED','CI_ACTIVE_AUTHCTX','valid signed context')
RETURNING id AS verification_a \gset
RESET ROLE;
SELECT CASE WHEN public.rupaykg_test_delete_guard(:'verification_a') THEN 1 ELSE 0 END AS delete_guard_passed \gset
\if :delete_guard_passed
\else
  \echo 'verification DELETE guard failed'
  \quit 1
\endif
SELECT CASE WHEN public.rupaykg_test_truncate_guard() THEN 1 ELSE 0 END AS truncate_guard_passed \gset
\if :truncate_guard_passed
\else
  \echo 'verification TRUNCATE guard failed'
  \quit 1
\endif
ROLLBACK TO SAVEPOINT valid_context;

SAVEPOINT forged_context;
SET LOCAL ROLE rupaykg_test_verification_api;
SELECT set_config('rupaykg.context.identity', :'verifier_b', true);
SELECT set_config('rupaykg.context.organization', :'org_b', true);
SELECT set_config('rupaykg.context.session','00000000-0000-4000-8000-000000000000',true);
SELECT set_config('rupaykg.context.expiry',(extract(epoch FROM now()+interval '5 minutes')::bigint)::text,true);
SELECT set_config('rupaykg.context.signature',repeat('0',64),true);
SELECT NOT public.rupaykg_context_is_valid() AS forged_context_invalid \gset
\if :forged_context_invalid
\else
  \echo 'caller-forged context unexpectedly validated'
  \quit 1
\endif
SELECT public.rupaykg_test_expect_spoof_rejected(
  :'evidence_b',:'activity_b',:'verifier_b') AS spoof_rejected \gset
\if :spoof_rejected
\else
  \echo 'caller-forged verification insert unexpectedly succeeded'
  \quit 1
\endif
RESET ROLE;
ROLLBACK TO SAVEPOINT forged_context;

SAVEPOINT revoked_context;
UPDATE public.identity_sessions s SET revoked_at=now()
FROM public.identities i
WHERE s.identity_id=i.id AND i.external_subject='ci-active-authctx-verifier-a';
SET LOCAL ROLE rupaykg_test_verification_api;
SELECT public.rupaykg_test_expect_revoked_rejected(:'org_a') AS revoked_rejected \gset
\if :revoked_rejected
\else
  \echo 'revoked bearer session unexpectedly accepted'
  \quit 1
\endif
RESET ROLE;
ROLLBACK TO SAVEPOINT revoked_context;

DROP FUNCTION public.rupaykg_test_expect_spoof_rejected(uuid,uuid,uuid);
DROP FUNCTION public.rupaykg_test_expect_revoked_rejected(uuid);
DROP FUNCTION public.rupaykg_test_delete_guard(uuid);
DROP FUNCTION public.rupaykg_test_truncate_guard();
ROLLBACK;
