-- Shakti Batch C: disposable tenant-isolation RLS rehearsal.
-- VALIDATION ONLY. Never execute against production.
-- Purpose: prove actual FK-path tenant predicates under distinct non-owner/NOBYPASSRLS runtime roles.
\set ON_ERROR_STOP on

-- CI database is disposable. Roles are deliberately created outside a transaction.
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_ci_org_a') THEN
    CREATE ROLE rupaykg_ci_org_a NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_ci_org_b') THEN
    CREATE ROLE rupaykg_ci_org_b NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;

GRANT USAGE ON SCHEMA public TO rupaykg_ci_org_a, rupaykg_ci_org_b;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.organizations,
  public.activities,
  public.evidence,
  public.measurements,
  public.mrv_observations,
  public.epr_obligations,
  public.activity_assignments,
  public.bwg_epr_reports,
  public.bwg_esg_reports,
  public.carbon_calculations,
  public.esg_metrics,
  public.evidence_artifact_reviews,
  public.evidence_artifact_versions,
  public.evidence_verification_requirements,
  public.field_sync_conflicts,
  public.field_sync_cursors,
  public.field_sync_envelopes,
  public.mrv_provenance_events,
  public.stakeholder_application_approvals,
  public.verifications
TO rupaykg_ci_org_a, rupaykg_ci_org_b;

CREATE OR REPLACE FUNCTION public.shakti_current_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE v text;
BEGIN
  v := current_setting('app.organization_id', true);
  IF v IS NULL OR btrim(v) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END
$fn$;

GRANT EXECUTE ON FUNCTION public.shakti_current_org_id() TO rupaykg_ci_org_a, rupaykg_ci_org_b;

-- Direct tenant root.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_org_isolation ON public.organizations
  FOR ALL
  USING (id = public.shakti_current_org_id())
  WITH CHECK (id = public.shakti_current_org_id());

-- Direct tenant table used for CRUD proof.
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_activity_isolation ON public.activities
  FOR ALL
  USING (organization_id = public.shakti_current_org_id())
  WITH CHECK (organization_id = public.shakti_current_org_id());

-- Single-path FK predicates.
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_evidence_isolation ON public.evidence
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = evidence.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = evidence.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_measurement_isolation ON public.measurements
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = measurements.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = measurements.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.mrv_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrv_observations FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_mrv_observation_isolation ON public.mrv_observations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = mrv_observations.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = mrv_observations.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.epr_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epr_obligations FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_epr_obligation_isolation ON public.epr_obligations
  FOR ALL
  USING (obligated_organization_id = public.shakti_current_org_id())
  WITH CHECK (obligated_organization_id = public.shakti_current_org_id());

ALTER TABLE public.activity_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_activity_assignment_isolation ON public.activity_assignments
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = activity_assignments.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = activity_assignments.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.bwg_epr_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bwg_epr_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_bwg_epr_report_isolation ON public.bwg_epr_reports
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.bwg_reporting_periods p
    WHERE p.id = bwg_epr_reports.reporting_period_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bwg_reporting_periods p
    WHERE p.id = bwg_epr_reports.reporting_period_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.bwg_esg_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bwg_esg_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_bwg_esg_report_isolation ON public.bwg_esg_reports
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.bwg_reporting_periods p
    WHERE p.id = bwg_esg_reports.reporting_period_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bwg_reporting_periods p
    WHERE p.id = bwg_esg_reports.reporting_period_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.carbon_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carbon_calculations FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_carbon_calculation_isolation ON public.carbon_calculations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = carbon_calculations.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = carbon_calculations.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.esg_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esg_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_esg_metric_isolation ON public.esg_metrics
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = esg_metrics.source_activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = esg_metrics.source_activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.evidence_artifact_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_artifact_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_evidence_artifact_review_isolation ON public.evidence_artifact_reviews
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.evidence e
    JOIN public.activities a ON a.id = e.activity_id
    WHERE e.id = evidence_artifact_reviews.evidence_id
      AND a.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evidence e
    JOIN public.activities a ON a.id = e.activity_id
    WHERE e.id = evidence_artifact_reviews.evidence_id
      AND a.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.evidence_artifact_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_artifact_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_evidence_artifact_version_isolation ON public.evidence_artifact_versions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.evidence_artifact_series p
    WHERE p.id = evidence_artifact_versions.series_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evidence_artifact_series p
    WHERE p.id = evidence_artifact_versions.series_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.evidence_verification_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_verification_requirements FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_evidence_verification_requirement_isolation ON public.evidence_verification_requirements
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = evidence_verification_requirements.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = evidence_verification_requirements.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.field_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_sync_cursors FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_field_sync_cursor_isolation ON public.field_sync_cursors
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.field_devices p
    WHERE p.id = field_sync_cursors.device_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.field_devices p
    WHERE p.id = field_sync_cursors.device_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.field_sync_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_sync_envelopes FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_field_sync_envelope_isolation ON public.field_sync_envelopes
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.field_devices p
    WHERE p.id = field_sync_envelopes.device_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.field_devices p
    WHERE p.id = field_sync_envelopes.device_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.field_sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_sync_conflicts FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_field_sync_conflict_isolation ON public.field_sync_conflicts
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.field_sync_envelopes e
    JOIN public.field_devices d ON d.id = e.device_id
    WHERE e.id = field_sync_conflicts.envelope_id
      AND d.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.field_sync_envelopes e
    JOIN public.field_devices d ON d.id = e.device_id
    WHERE e.id = field_sync_conflicts.envelope_id
      AND d.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.mrv_provenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrv_provenance_events FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_mrv_provenance_event_isolation ON public.mrv_provenance_events
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = mrv_provenance_events.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = mrv_provenance_events.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.stakeholder_application_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholder_application_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_stakeholder_application_approval_isolation ON public.stakeholder_application_approvals
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.stakeholder_applications p
    WHERE p.id = stakeholder_application_approvals.application_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stakeholder_applications p
    WHERE p.id = stakeholder_application_approvals.application_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY shakti_ci_verification_isolation ON public.verifications
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = verifications.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activities p
    WHERE p.id = verifications.activity_id
      AND p.organization_id = public.shakti_current_org_id()
  ));

-- Seed only the minimum rows needed for CRUD and context-reset proof.
INSERT INTO public.organizations (id,name,organization_type,verification_status)
VALUES
 ('00000000-0000-0000-0000-0000000000a1','Shakti CI Org A','TEST','PENDING'),
 ('00000000-0000-0000-0000-0000000000b1','Shakti CI Org B','TEST','PENDING');

INSERT INTO public.activities (id,organization_id,activity_type)
VALUES
 ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-0000000000a1','TEST_ACTIVITY'),
 ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000b1','TEST_ACTIVITY');

INSERT INTO public.measurements
 (id,activity_id,value,unit,method,source,measured_at)
VALUES
 ('00000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-00000000a001',10,'kg','CI','CI',now()),
 ('00000000-0000-0000-0000-00000000b101','00000000-0000-0000-0000-00000000b001',20,'kg','CI','CI',now());

INSERT INTO public.evidence
 (id,activity_id,evidence_type,captured_at,content_hash)
VALUES
 ('00000000-0000-0000-0000-00000000a201','00000000-0000-0000-0000-00000000a001','CI',now(),'ci-evidence-a201'),
 ('00000000-0000-0000-0000-00000000b201','00000000-0000-0000-0000-00000000b001','CI',now(),'ci-evidence-b201');

INSERT INTO public.mrv_observations
 (id,activity_id,parameter_code,observed_value,unit,method,observed_at)
VALUES
 ('00000000-0000-0000-0000-00000000a301','00000000-0000-0000-0000-00000000a001','CI_TEST',1,'kg','CI',now()),
 ('00000000-0000-0000-0000-00000000b301','00000000-0000-0000-0000-00000000b001','CI_TEST',2,'kg','CI',now());

-- Owner can bypass RLS, so all security assertions below are executed after SET ROLE.
BEGIN;
SET ROLE rupaykg_ci_org_a;
SELECT set_config('app.organization_id','00000000-0000-0000-0000-0000000000a1',true);

DO $assert$
BEGIN
  IF (SELECT count(*) FROM public.activities) <> 1 THEN RAISE EXCEPTION 'Org A SELECT isolation failed'; END IF;
  IF (SELECT count(*) FROM public.measurements) <> 1 THEN RAISE EXCEPTION 'Org A measurement isolation failed'; END IF;
  IF (SELECT count(*) FROM public.evidence) <> 1 THEN RAISE EXCEPTION 'Org A evidence isolation failed'; END IF;
  IF (SELECT count(*) FROM public.mrv_observations) <> 1 THEN RAISE EXCEPTION 'Org A MRV isolation failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.activities WHERE organization_id <> public.shakti_current_org_id()) THEN RAISE EXCEPTION 'Org A cross-tenant row visible'; END IF;
END
$assert$;

UPDATE public.activities
SET activity_type='ORG_A_UPDATED'
WHERE id='00000000-0000-0000-0000-00000000a001';

DO $assert$
BEGIN
  IF (SELECT activity_type FROM public.activities WHERE id='00000000-0000-0000-0000-00000000a001') <> 'ORG_A_UPDATED'
    THEN RAISE EXCEPTION 'Org A UPDATE failed'; END IF;
END
$assert$;

DELETE FROM public.measurements WHERE id='00000000-0000-0000-0000-00000000b101';
DO $assert$
BEGIN
  IF EXISTS (SELECT 1 FROM public.measurements WHERE id='00000000-0000-0000-0000-00000000b101')
    THEN RAISE EXCEPTION 'Org A DELETE leaked across tenant'; END IF;
END
$assert$;

-- WITH CHECK must reject an Org A session from creating an Org B activity.
DO $insert$
BEGIN
  BEGIN
    INSERT INTO public.activities (id,organization_id,activity_type)
    VALUES ('00000000-0000-0000-0000-00000000a999','00000000-0000-0000-0000-0000000000b1','SHOULD_FAIL');
    RAISE EXCEPTION 'cross-tenant INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$insert$;

-- Transaction-local context must not leak after commit.
COMMIT;
SELECT set_config('app.organization_id', NULL, false);

DO $reset$
BEGIN
  IF public.shakti_current_org_id() IS NOT NULL THEN
    RAISE EXCEPTION 'connection context leaked after transaction';
  END IF;
END
$reset$;

-- Re-enter as Org B and prove the opposite boundary.
RESET ROLE;
BEGIN;
SET ROLE rupaykg_ci_org_b;
SELECT set_config('app.organization_id','00000000-0000-0000-0000-0000000000b1',true);

DO $assert$
BEGIN
  IF (SELECT count(*) FROM public.activities) <> 1 THEN RAISE EXCEPTION 'Org B SELECT isolation failed'; END IF;
  IF (SELECT count(*) FROM public.measurements) <> 1 THEN RAISE EXCEPTION 'Org B measurement isolation failed'; END IF;
  IF (SELECT count(*) FROM public.evidence) <> 1 THEN RAISE EXCEPTION 'Org B evidence isolation failed'; END IF;
  IF (SELECT count(*) FROM public.mrv_observations) <> 1 THEN RAISE EXCEPTION 'Org B MRV isolation failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.activities WHERE organization_id <> public.shakti_current_org_id()) THEN RAISE EXCEPTION 'Org B cross-tenant row visible'; END IF;
END
$assert$;

UPDATE public.activities
SET activity_type='ORG_B_UPDATED'
WHERE id='00000000-0000-0000-0000-00000000b001';

DO $assert$
BEGIN
  IF (SELECT activity_type FROM public.activities WHERE id='00000000-0000-0000-0000-00000000b001') <> 'ORG_B_UPDATED'
    THEN RAISE EXCEPTION 'Org B UPDATE failed'; END IF;
END
$assert$;

DELETE FROM public.measurements WHERE id='00000000-0000-0000-0000-00000000a101';
DO $assert$
BEGIN
  IF EXISTS (SELECT 1 FROM public.measurements WHERE id='00000000-0000-0000-0000-00000000a101')
    THEN RAISE EXCEPTION 'Org B DELETE leaked across tenant'; END IF;
END
$assert$;

-- Invalid / absent context is fail-closed.
SELECT set_config('app.organization_id','not-a-uuid',true);
DO $invalid$
BEGIN
  IF public.shakti_current_org_id() IS NOT NULL THEN
    RAISE EXCEPTION 'invalid context did not fail closed';
  END IF;
  IF (SELECT count(*) FROM public.activities) <> 0 THEN
    RAISE EXCEPTION 'invalid context exposed tenant rows';
  END IF;
END
$invalid$;

RESET ROLE;

-- Structural assertions: runtime roles are distinct and non-bypass.
DO $roles$
BEGIN
  IF (SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb
      FROM pg_roles WHERE rolname='rupaykg_ci_org_a')
  THEN RAISE EXCEPTION 'Org A runtime role is privileged'; END IF;
  IF (SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb
      FROM pg_roles WHERE rolname='rupaykg_ci_org_b')
  THEN RAISE EXCEPTION 'Org B runtime role is privileged'; END IF;
END
$roles$;

-- Cleanup: disposable rehearsal only.
DO $cleanup$
BEGIN
  DROP POLICY IF EXISTS shakti_ci_org_isolation ON public.organizations;
  DROP POLICY IF EXISTS shakti_ci_activity_isolation ON public.activities;
  DROP POLICY IF EXISTS shakti_ci_evidence_isolation ON public.evidence;
  DROP POLICY IF EXISTS shakti_ci_measurement_isolation ON public.measurements;
  DROP POLICY IF EXISTS shakti_ci_mrv_observation_isolation ON public.mrv_observations;
  DROP POLICY IF EXISTS shakti_ci_epr_obligation_isolation ON public.epr_obligations;
  DROP POLICY IF EXISTS shakti_ci_activity_assignment_isolation ON public.activity_assignments;
  DROP POLICY IF EXISTS shakti_ci_bwg_epr_report_isolation ON public.bwg_epr_reports;
  DROP POLICY IF EXISTS shakti_ci_bwg_esg_report_isolation ON public.bwg_esg_reports;
  DROP POLICY IF EXISTS shakti_ci_carbon_calculation_isolation ON public.carbon_calculations;
  DROP POLICY IF EXISTS shakti_ci_esg_metric_isolation ON public.esg_metrics;
  DROP POLICY IF EXISTS shakti_ci_evidence_artifact_review_isolation ON public.evidence_artifact_reviews;
  DROP POLICY IF EXISTS shakti_ci_evidence_artifact_version_isolation ON public.evidence_artifact_versions;
  DROP POLICY IF EXISTS shakti_ci_evidence_verification_requirement_isolation ON public.evidence_verification_requirements;
  DROP POLICY IF EXISTS shakti_ci_field_sync_cursor_isolation ON public.field_sync_cursors;
  DROP POLICY IF EXISTS shakti_ci_field_sync_envelope_isolation ON public.field_sync_envelopes;
  DROP POLICY IF EXISTS shakti_ci_field_sync_conflict_isolation ON public.field_sync_conflicts;
  DROP POLICY IF EXISTS shakti_ci_mrv_provenance_event_isolation ON public.mrv_provenance_events;
  DROP POLICY IF EXISTS shakti_ci_stakeholder_application_approval_isolation ON public.stakeholder_application_approvals;
  DROP POLICY IF EXISTS shakti_ci_verification_isolation ON public.verifications;

  ALTER TABLE public.organizations NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.activities NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.measurements NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.mrv_observations NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.epr_obligations NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.activity_assignments NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.bwg_epr_reports NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.bwg_esg_reports NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.carbon_calculations NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.esg_metrics NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence_artifact_reviews NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence_artifact_versions NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence_verification_requirements NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.field_sync_cursors NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.field_sync_envelopes NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.field_sync_conflicts NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.mrv_provenance_events NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.stakeholder_application_approvals NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.verifications NO FORCE ROW LEVEL SECURITY;

  ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.measurements DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.mrv_observations DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.epr_obligations DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.activity_assignments DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.bwg_epr_reports DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.bwg_esg_reports DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.carbon_calculations DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.esg_metrics DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence_artifact_reviews DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence_artifact_versions DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.evidence_verification_requirements DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.field_sync_cursors DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.field_sync_envelopes DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.field_sync_conflicts DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.mrv_provenance_events DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.stakeholder_application_approvals DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.verifications DISABLE ROW LEVEL SECURITY;
END
$cleanup$;

DROP FUNCTION public.shakti_current_org_id();
DROP ROLE rupaykg_ci_org_a;
DROP ROLE rupaykg_ci_org_b;
