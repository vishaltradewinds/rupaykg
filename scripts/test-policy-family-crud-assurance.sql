-- Shakti Batch C: policy-family CRUD assurance.
-- VALIDATION ONLY. Disposable PostgreSQL CI database. Never execute against production.
\set ON_ERROR_STOP on

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_ci_policy_a') THEN
    CREATE ROLE rupaykg_ci_policy_a NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_ci_policy_b') THEN
    CREATE ROLE rupaykg_ci_policy_b NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;

GRANT USAGE ON SCHEMA public TO rupaykg_ci_policy_a, rupaykg_ci_policy_b;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.organizations, public.activities, public.evidence, public.measurements, public.mrv_observations,
  public.epr_obligations, public.activity_assignments, public.bwg_epr_reports, public.bwg_esg_reports,
  public.carbon_calculations, public.esg_metrics, public.evidence_artifact_reviews,
  public.evidence_artifact_versions, public.evidence_verification_requirements,
  public.field_sync_cursors, public.field_sync_envelopes, public.field_sync_conflicts,
  public.mrv_provenance_events, public.stakeholder_application_approvals, public.verifications
TO rupaykg_ci_policy_a, rupaykg_ci_policy_b;

CREATE OR REPLACE FUNCTION public.shakti_ci_policy_org_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE v text;
BEGIN
  v := current_setting('app.organization_id', true);
  IF v IS NULL OR btrim(v) = '' THEN RETURN NULL; END IF;
  BEGIN RETURN v::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
END
$fn$;

GRANT EXECUTE ON FUNCTION public.shakti_ci_policy_org_id() TO rupaykg_ci_policy_a, rupaykg_ci_policy_b;

DO $policies$
DECLARE
  r record;
  using_sql text;
  check_sql text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('organizations','id = public.shakti_ci_policy_org_id()','id = public.shakti_ci_policy_org_id()'),
      ('activities','organization_id = public.shakti_ci_policy_org_id()','organization_id = public.shakti_ci_policy_org_id()'),
      ('evidence','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())'),
      ('measurements','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())'),
      ('mrv_observations','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())'),
      ('epr_obligations','obligated_organization_id = public.shakti_ci_policy_org_id()','obligated_organization_id = public.shakti_ci_policy_org_id()'),
      ('activity_assignments','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())'),
      ('bwg_epr_reports','EXISTS (SELECT 1 FROM public.bwg_reporting_periods p WHERE p.id = %I.reporting_period_id AND p.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.bwg_reporting_periods p WHERE p.id = %I.reporting_period_id AND p.organization_id = public.shakti_ci_policy_org_id())'),
      ('bwg_esg_reports','EXISTS (SELECT 1 FROM public.bwg_reporting_periods p WHERE p.id = %I.reporting_period_id AND p.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.bwg_reporting_periods p WHERE p.id = %I.reporting_period_id AND p.organization_id = public.shakti_ci_policy_org_id())'),
      ('carbon_calculations','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.activity_id AND a.organization_id = public.shakti_ci_policy_org_id())'),
      ('esg_metrics','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.source_activity_id AND a.organization_id = public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id = %I.source_activity_id AND a.organization_id = public.shakti_ci_policy_org_id())'),
      ('evidence_artifact_reviews','EXISTS (SELECT 1 FROM public.evidence e JOIN public.activities a ON a.id=e.activity_id WHERE e.id=%I.evidence_id AND a.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.evidence e JOIN public.activities a ON a.id=e.activity_id WHERE e.id=%I.evidence_id AND a.organization_id=public.shakti_ci_policy_org_id())'),
      ('evidence_artifact_versions','EXISTS (SELECT 1 FROM public.evidence_artifact_series s WHERE s.id=%I.series_id AND s.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.evidence_artifact_series s WHERE s.id=%I.series_id AND s.organization_id=public.shakti_ci_policy_org_id())'),
      ('evidence_verification_requirements','EXISTS (SELECT 1 FROM public.activities a WHERE a.id=%I.activity_id AND a.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id=%I.activity_id AND a.organization_id=public.shakti_ci_policy_org_id())'),
      ('field_sync_cursors','EXISTS (SELECT 1 FROM public.field_devices d WHERE d.id=%I.device_id AND d.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.field_devices d WHERE d.id=%I.device_id AND d.organization_id=public.shakti_ci_policy_org_id())'),
      ('field_sync_envelopes','EXISTS (SELECT 1 FROM public.field_devices d WHERE d.id=%I.device_id AND d.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.field_devices d WHERE d.id=%I.device_id AND d.organization_id=public.shakti_ci_policy_org_id())'),
      ('field_sync_conflicts','EXISTS (SELECT 1 FROM public.field_sync_envelopes e JOIN public.field_devices d ON d.id=e.device_id WHERE e.id=%I.envelope_id AND d.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.field_sync_envelopes e JOIN public.field_devices d ON d.id=e.device_id WHERE e.id=%I.envelope_id AND d.organization_id=public.shakti_ci_policy_org_id())'),
      ('mrv_provenance_events','EXISTS (SELECT 1 FROM public.activities a WHERE a.id=%I.activity_id AND a.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id=%I.activity_id AND a.organization_id=public.shakti_ci_policy_org_id())'),
      ('stakeholder_application_approvals','EXISTS (SELECT 1 FROM public.stakeholder_applications s WHERE s.id=%I.application_id AND s.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.stakeholder_applications s WHERE s.id=%I.application_id AND s.organization_id=public.shakti_ci_policy_org_id())'),
      ('verifications','EXISTS (SELECT 1 FROM public.activities a WHERE a.id=%I.activity_id AND a.organization_id=public.shakti_ci_policy_org_id())','EXISTS (SELECT 1 FROM public.activities a WHERE a.id=%I.activity_id AND a.organization_id=public.shakti_ci_policy_org_id())')
    ) AS x(table_name,using_expr,check_expr)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);
    using_sql := CASE WHEN position('%I' in r.using_expr) > 0
      THEN format(r.using_expr, r.table_name) ELSE r.using_expr END;
    check_sql := CASE WHEN position('%I' in r.check_expr) > 0
      THEN format(r.check_expr, r.table_name) ELSE r.check_expr END;
    EXECUTE format('CREATE POLICY shakti_ci_pf_%I ON public.%I FOR ALL USING (%s) WITH CHECK (%s)',
                   r.table_name, r.table_name, using_sql, check_sql);
  END LOOP;
END
$policies$;

DO $assert$
DECLARE t text; n int;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','activities','evidence','measurements','mrv_observations','epr_obligations',
    'activity_assignments','bwg_epr_reports','bwg_esg_reports','carbon_calculations','esg_metrics',
    'evidence_artifact_reviews','evidence_artifact_versions','evidence_verification_requirements',
    'field_sync_cursors','field_sync_envelopes','field_sync_conflicts','mrv_provenance_events',
    'stakeholder_application_approvals','verifications'
  ] LOOP
    SELECT count(*) INTO n FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
      WHERE c.relname=t AND p.polname = format('shakti_ci_pf_%s', t)
        AND p.polcmd='*' AND p.polpermissive;
    IF n <> 1 THEN RAISE EXCEPTION 'Shakti CRUD policy family count for % = %, expected 1', t, n; END IF;
    SELECT count(*) INTO n FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
      WHERE c.relname=t AND p.polname = format('shakti_ci_pf_%s', t)
        AND p.polcmd='*' AND p.polpermissive
        AND p.polqual IS NOT NULL AND p.polwithcheck IS NOT NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'USING/WITH CHECK missing for %', t; END IF;
    SELECT count(*) INTO n FROM pg_class c
      WHERE c.relname=t AND c.relrowsecurity AND c.relforcerowsecurity;
    IF n <> 1 THEN RAISE EXCEPTION 'RLS/FORCE RLS missing for %', t; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_policy p
    WHERE p.polname LIKE 'shakti_ci_pf_%'
      AND (pg_get_expr(p.polqual,p.polrelid) ~* '\m(role_name|current_user|session_user)\M'
       OR pg_get_expr(p.polwithcheck,p.polrelid) ~* '\m(role_name|current_user|session_user)\M')
  ) THEN
    RAISE EXCEPTION 'role-name/current-user authorization mechanism detected';
  END IF;
END
$assert$;

-- Representative behavioral CRUD proof at root, direct tenant, and deep FK levels.
INSERT INTO public.organizations (id,name,organization_type,verification_status)
VALUES ('00000000-0000-0000-0000-00000000c0a1','Policy Family A','TEST','PENDING'),
       ('00000000-0000-0000-0000-00000000c0b1','Policy Family B','TEST','PENDING');
INSERT INTO public.activities (id,organization_id,activity_type)
VALUES ('00000000-0000-0000-0000-00000000c0a2','00000000-0000-0000-0000-00000000c0a1','PF_A'),
       ('00000000-0000-0000-0000-00000000c0b2','00000000-0000-0000-0000-00000000c0b1','PF_B');
INSERT INTO public.measurements (id,activity_id,value,unit,method,source,measured_at)
VALUES ('00000000-0000-0000-0000-00000000c0a3','00000000-0000-0000-0000-00000000c0a2',11,'kg','CI','CI',now()),
       ('00000000-0000-0000-0000-00000000c0b3','00000000-0000-0000-0000-00000000c0b2',22,'kg','CI','CI',now());

BEGIN;
SET ROLE rupaykg_ci_policy_a;
SELECT set_config('app.organization_id','00000000-0000-0000-0000-00000000c0a1',true);
DO $behavior$
BEGIN
  IF (SELECT count(*) FROM public.activities) <> 1 THEN RAISE EXCEPTION 'A SELECT isolation failed'; END IF;
  IF (SELECT count(*) FROM public.measurements) <> 1 THEN RAISE EXCEPTION 'A deep SELECT isolation failed'; END IF;
END
$behavior$;
UPDATE public.activities SET activity_type='PF_A_UPDATED'
WHERE id='00000000-0000-0000-0000-00000000c0a2';
DO $behavior$
BEGIN
  IF (SELECT activity_type FROM public.activities WHERE id='00000000-0000-0000-0000-00000000c0a2') <> 'PF_A_UPDATED'
    THEN RAISE EXCEPTION 'A UPDATE failed'; END IF;
END
$behavior$;
DELETE FROM public.measurements WHERE id='00000000-0000-0000-0000-00000000c0b3';
DO $behavior$
BEGIN
  IF EXISTS (SELECT 1 FROM public.measurements WHERE id='00000000-0000-0000-0000-00000000c0b3')
    THEN RAISE EXCEPTION 'cross-tenant DELETE leaked'; END IF;
END
$behavior$;
DO $behavior$
BEGIN
  BEGIN
    INSERT INTO public.activities(id,organization_id,activity_type)
    VALUES ('00000000-0000-0000-0000-00000000c0af4','00000000-0000-0000-0000-00000000c0b1','CROSS_TENANT');
    RAISE EXCEPTION 'cross-tenant INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$behavior$;
COMMIT;
RESET ROLE;

-- Cleanup.
DO $cleanup$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','activities','evidence','measurements','mrv_observations','epr_obligations',
    'activity_assignments','bwg_epr_reports','bwg_esg_reports','carbon_calculations','esg_metrics',
    'evidence_artifact_reviews','evidence_artifact_versions','evidence_verification_requirements',
    'field_sync_cursors','field_sync_envelopes','field_sync_conflicts','mrv_provenance_events',
    'stakeholder_application_approvals','verifications'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS shakti_ci_pf_%I ON public.%I', t, t);
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$cleanup$;

DROP FUNCTION public.shakti_ci_policy_org_id();
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM rupaykg_ci_policy_a, rupaykg_ci_policy_b;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM rupaykg_ci_policy_a, rupaykg_ci_policy_b;
DROP ROLE rupaykg_ci_policy_a;
DROP ROLE rupaykg_ci_policy_b;
