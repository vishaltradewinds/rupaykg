-- Shakti Batch D: direct tenant-anchor RLS assurance.
-- VALIDATION ONLY. Run solely against disposable PostgreSQL CI databases.
-- Never execute against production.
\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_ci_batchd_org_a') THEN
    CREATE ROLE rupaykg_ci_batchd_org_a NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_ci_batchd_org_b') THEN
    CREATE ROLE rupaykg_ci_batchd_org_b NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$roles$;

-- Test-only identity and organization context. These GUCs are trusted backend
-- transaction context, not end-user supplied HTTP parameters.
CREATE OR REPLACE FUNCTION public.shakti_batchd_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE v text;
BEGIN
  v := current_setting('app.organization_id', true);
  IF v IS NULL OR btrim(v) = '' THEN RETURN NULL; END IF;
  BEGIN RETURN v::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
END
$fn$;

CREATE OR REPLACE FUNCTION public.shakti_batchd_identity_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE v text;
BEGIN
  v := current_setting('app.identity_id', true);
  IF v IS NULL OR btrim(v) = '' THEN RETURN NULL; END IF;
  BEGIN RETURN v::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
END
$fn$;

GRANT EXECUTE ON FUNCTION public.shakti_batchd_org_id() TO rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;
GRANT EXECUTE ON FUNCTION public.shakti_batchd_identity_id() TO rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;

-- Parent and domain fixtures. The preceding Batch C test seeds organizations
-- A/B and their activity rows. This script adds isolated C/D targets and the
-- minimum valid lookup/identity/obligation records needed by table triggers.
DO $seed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id='00000000-0000-0000-0000-0000000000a1') OR
     NOT EXISTS (SELECT 1 FROM public.organizations WHERE id='00000000-0000-0000-0000-0000000000b1') OR
     NOT EXISTS (SELECT 1 FROM public.activities WHERE id='00000000-0000-0000-0000-00000000a001') OR
     NOT EXISTS (SELECT 1 FROM public.activities WHERE id='00000000-0000-0000-0000-00000000b001') THEN
    RAISE EXCEPTION 'Batch D requires Batch C organization and activity fixtures';
  END IF;
END
$seed$;

INSERT INTO public.organizations (id,name,organization_type,verification_status)
VALUES
 ('00000000-0000-0000-0000-0000000000c1','Shakti Batch D Target C','TEST','PENDING'),
 ('00000000-0000-0000-0000-0000000000d1','Shakti Batch D Deny Target D','TEST','PENDING')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.identities (id,display_name,status)
VALUES
 ('00000000-0000-0000-0000-00000000c001','Shakti Batch D Identity A','VERIFIED'),
 ('00000000-0000-0000-0000-00000000c002','Shakti Batch D Identity B','VERIFIED'),
 ('00000000-0000-0000-0000-00000000c003','Shakti Batch D Identity C','VERIFIED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id,organization_id,name,permissions,geography_scope)
VALUES
 ('00000000-0000-0000-0000-00000000e101','00000000-0000-0000-0000-0000000000a1','CI_BATCH_D_APPLICANT','[]'::jsonb,'[]'::jsonb),
 ('00000000-0000-0000-0000-00000000e102','00000000-0000-0000-0000-0000000000b1','CI_BATCH_D_APPLICANT','[]'::jsonb,'[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.geography (id,kind,name,code,metadata)
VALUES ('00000000-0000-0000-0000-00000000e201','DISTRICT','Shakti Batch D Test District','SHK-CI-BATCH-D','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carbon_market_mechanisms (code,name,participation_model,authority,source_url,description)
VALUES ('SHK_CI_BATCH_D','CI-only Batch D mechanism','VOLUNTARY_PROJECT_BASED','CI TEST AUTHORITY','https://example.invalid/shakti-ci-batch-d','Disposable CI fixture only')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.methodology_versions
 (id,methodology_code,version,rules,governance_status,carbon_mechanism)
VALUES
 ('00000000-0000-0000-0000-00000000e301','SHK-CI-BATCH-D','1.0.0','{"fixture":true}'::jsonb,'SOURCE_LOCKED','SHK_CI_BATCH_D')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.epr_schemes (id,code,name,authority,metadata)
VALUES
 ('00000000-0000-0000-0000-00000000e401','SHK_CI_BATCH_D','Shakti CI Batch D Scheme','CI TEST AUTHORITY','{"fixture":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- BWG applicability is deliberately VERIFIED/APPLICABLE because the live
-- reporting-period trigger requires this before a reporting-period row exists.
INSERT INTO public.bwg_profiles
 (id,organization_id,applicability_status,status)
VALUES
 ('00000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-0000000000a1','APPLICABLE','VERIFIED'),
 ('00000000-0000-0000-0000-00000000b101','00000000-0000-0000-0000-0000000000b1','APPLICABLE','VERIFIED'),
 ('00000000-0000-0000-0000-00000000c101','00000000-0000-0000-0000-0000000000c1','APPLICABLE','VERIFIED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bwg_reporting_periods (id,organization_id,period_start,period_end,reporting_basis)
VALUES
 ('00000000-0000-0000-0000-00000000a102','00000000-0000-0000-0000-0000000000a1','2025-01-01','2025-12-31','CI_BATCH_D_A'),
 ('00000000-0000-0000-0000-00000000b102','00000000-0000-0000-0000-0000000000b1','2025-01-01','2025-12-31','CI_BATCH_D_B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carbon_projects (id,organization_id,project_code,title,methodology_version_id,carbon_mechanism)
VALUES
 ('00000000-0000-0000-0000-00000000a103','00000000-0000-0000-0000-0000000000a1','SHK-CI-BATCH-D-A','CI test carbon project A','00000000-0000-0000-0000-00000000e301','SHK_CI_BATCH_D'),
 ('00000000-0000-0000-0000-00000000b103','00000000-0000-0000-0000-0000000000b1','SHK-CI-BATCH-D-B','CI test carbon project B','00000000-0000-0000-0000-00000000e301','SHK_CI_BATCH_D')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cpcb_swm_stakeholder_workspaces
 (id,organization_id,stakeholder_type,title,created_by_identity_id,updated_by_identity_id)
VALUES
 ('00000000-0000-0000-0000-00000000a104','00000000-0000-0000-0000-0000000000a1','ULB','CI Batch D Workspace A','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c001'),
 ('00000000-0000-0000-0000-00000000b104','00000000-0000-0000-0000-0000000000b1','ULB','CI Batch D Workspace B','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.environmental_attribute_claims
 (id,organization_id,activity_id,claim_type,framework_code,claim_quantity,claim_unit,basis_key,consumption_mode,source_type,source_id)
VALUES
 ('00000000-0000-0000-0000-00000000a105','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000a001','OTHER','CI_BATCH_D',1,'kg','SHK_CI_BATCH_D_A','REPORTING_REFERENCE','CI_FIXTURE','00000000-0000-0000-0000-00000000a1a5'),
 ('00000000-0000-0000-0000-00000000b105','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000b001','OTHER','CI_BATCH_D',1,'kg','SHK_CI_BATCH_D_B','REPORTING_REFERENCE','CI_FIXTURE','00000000-0000-0000-0000-00000000b1b5')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.obligations (id,organization_id,obligation_type,period_start,period_end)
VALUES
 ('00000000-0000-0000-0000-00000000a110','00000000-0000-0000-0000-0000000000a1','CI_BATCH_D_EPR','2025-01-01','2025-12-31'),
 ('00000000-0000-0000-0000-00000000b110','00000000-0000-0000-0000-0000000000b1','CI_BATCH_D_EPR','2025-01-01','2025-12-31'),
 ('00000000-0000-0000-0000-00000000d110','00000000-0000-0000-0000-0000000000d1','CI_BATCH_D_EPR','2025-01-01','2025-12-31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.epr_obligations
 (id,obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,target_basis)
VALUES
 ('00000000-0000-0000-0000-00000000a120','00000000-0000-0000-0000-00000000a110','00000000-0000-0000-0000-00000000e401','00000000-0000-0000-0000-0000000000a1','CI','100',0,'{"fixture":true}'::jsonb),
 ('00000000-0000-0000-0000-00000000b120','00000000-0000-0000-0000-00000000b110','00000000-0000-0000-0000-00000000e401','00000000-0000-0000-0000-0000000000b1','CI','100',0,'{"fixture":true}'::jsonb),
 ('00000000-0000-0000-0000-00000000d120','00000000-0000-0000-0000-00000000d110','00000000-0000-0000-0000-00000000e401','00000000-0000-0000-0000-0000000000d1','CI','100',0,'{"fixture":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.epr_returns
 (id,scheme_id,organization_id,period_start,period_end,return_type,reported_quantity,fulfilled_quantity,obligation_id)
VALUES
 ('00000000-0000-0000-0000-00000000a106','00000000-0000-0000-0000-00000000e401','00000000-0000-0000-0000-0000000000a1','2025-01-01','2025-12-31','ANNUAL',10,0,'00000000-0000-0000-0000-00000000a120'),
 ('00000000-0000-0000-0000-00000000b106','00000000-0000-0000-0000-00000000e401','00000000-0000-0000-0000-0000000000b1','2025-01-01','2025-12-31','ANNUAL',10,0,'00000000-0000-0000-0000-00000000b120')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.esg_reporting_periods (id,organization_id,period_start,period_end,framework)
VALUES
 ('00000000-0000-0000-0000-00000000a107','00000000-0000-0000-0000-0000000000a1','2025-01-01','2025-12-31','CI_BATCH_D'),
 ('00000000-0000-0000-0000-00000000b107','00000000-0000-0000-0000-0000000000b1','2025-01-01','2025-12-31','CI_BATCH_D')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.evidence_artifact_series (id,organization_id,activity_id,evidence_type,created_by_identity_id)
VALUES
 ('00000000-0000-0000-0000-00000000a108','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000a001','CI_BATCH_D','00000000-0000-0000-0000-00000000c001'),
 ('00000000-0000-0000-0000-00000000b108','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000b001','CI_BATCH_D','00000000-0000-0000-0000-00000000c002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.field_devices (id,device_id,identity_id,organization_id)
VALUES
 ('00000000-0000-0000-0000-00000000a109','SHK_CI_BATCH_D_DEVICE_A','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000b109','SHK_CI_BATCH_D_DEVICE_B','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000a10a','SHK_CI_BATCH_D_DEVICE_UNBOUND',NULL,NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_bwg_assessments (id,organization_id)
VALUES
 ('00000000-0000-0000-0000-00000000a111','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000b111','00000000-0000-0000-0000-0000000000b1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_epr_applicability (id,organization_id,scheme)
VALUES
 ('00000000-0000-0000-0000-00000000a112','00000000-0000-0000-0000-0000000000a1','CI_BATCH_D'),
 ('00000000-0000-0000-0000-00000000b112','00000000-0000-0000-0000-0000000000b1','CI_BATCH_D')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_geography_scopes (id,organization_id,geography_id,status)
VALUES
 ('00000000-0000-0000-0000-00000000a113','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000e201','VERIFIED'),
 ('00000000-0000-0000-0000-00000000b113','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000e201','VERIFIED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_statutory_profiles (id,organization_id,framework,rule_reference)
VALUES
 ('00000000-0000-0000-0000-00000000a114','00000000-0000-0000-0000-0000000000a1','CI_BATCH_D','RULE-A'),
 ('00000000-0000-0000-0000-00000000b114','00000000-0000-0000-0000-0000000000b1','CI_BATCH_D','RULE-B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_verification_evidence (id,organization_id,evidence_type)
VALUES
 ('00000000-0000-0000-0000-00000000a115','00000000-0000-0000-0000-0000000000a1','CI_BATCH_D'),
 ('00000000-0000-0000-0000-00000000b115','00000000-0000-0000-0000-0000000000b1','CI_BATCH_D')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.resource_flows (id,organization_id,origin_type,resource_form,material_code,declared_quantity,unit)
VALUES
 ('00000000-0000-0000-0000-00000000a116','00000000-0000-0000-0000-0000000000a1','CI_BATCH_D','MATERIAL','CI-TEST',10,'kg'),
 ('00000000-0000-0000-0000-00000000b116','00000000-0000-0000-0000-0000000000b1','CI_BATCH_D','MATERIAL','CI-TEST',20,'kg')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stakeholder_applications
 (id,identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id)
VALUES
 ('00000000-0000-0000-0000-00000000a117','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000e101','CI_BATCH_D_APPLICANT','TEST','00000000-0000-0000-0000-00000000e201'),
 ('00000000-0000-0000-0000-00000000b117','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000e102','CI_BATCH_D_APPLICANT','TEST','00000000-0000-0000-0000-00000000e201'),
 ('00000000-0000-0000-0000-00000000a118','00000000-0000-0000-0000-00000000c003','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000e101','CI_BATCH_D_APPLICANT','TEST','00000000-0000-0000-0000-00000000e201')
ON CONFLICT (id) DO NOTHING;

GRANT USAGE ON SCHEMA public TO rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;
GRANT SELECT,INSERT,UPDATE,DELETE ON
 public.bwg_profiles, public.bwg_reporting_periods, public.carbon_projects,
 public.cpcb_swm_stakeholder_workspaces, public.environmental_attribute_claims,
 public.epr_returns, public.esg_reporting_periods, public.evidence_artifact_series,
 public.field_devices, public.obligations, public.organization_bwg_assessments,
 public.organization_epr_applicability, public.organization_geography_scopes,
 public.organization_statutory_profiles, public.organization_verification_evidence,
 public.resource_flows, public.stakeholder_applications
TO rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;
GRANT SELECT ON public.activities, public.evidence, public.verifications TO rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;
-- epr_returns' database trigger locks the matching obligation row with SELECT ... FOR UPDATE.
GRANT SELECT, UPDATE ON public.epr_obligations TO rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;

-- Tenant rows are scoped directly by organization_id except where the table
-- has an additional row-ownership invariant (activity-backed evidence or
-- identity-bound stakeholder applications).
DO $policies$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('bwg_profiles','organization_id = public.shakti_batchd_org_id()'),
      ('bwg_reporting_periods','organization_id = public.shakti_batchd_org_id()'),
      ('carbon_projects','organization_id = public.shakti_batchd_org_id()'),
      ('cpcb_swm_stakeholder_workspaces','organization_id = public.shakti_batchd_org_id()'),
      ('environmental_attribute_claims',
       'organization_id = public.shakti_batchd_org_id() AND EXISTS (SELECT 1 FROM public.activities a WHERE a.id = environmental_attribute_claims.activity_id AND a.organization_id = public.shakti_batchd_org_id()) AND (environmental_attribute_claims.evidence_id IS NULL OR EXISTS (SELECT 1 FROM public.evidence e JOIN public.activities ea ON ea.id=e.activity_id WHERE e.id=environmental_attribute_claims.evidence_id AND ea.organization_id=public.shakti_batchd_org_id())) AND (environmental_attribute_claims.verification_id IS NULL OR EXISTS (SELECT 1 FROM public.verifications v JOIN public.activities va ON va.id=v.activity_id WHERE v.id=environmental_attribute_claims.verification_id AND va.organization_id=public.shakti_batchd_org_id()))'),
      ('epr_returns','organization_id = public.shakti_batchd_org_id()'),
      ('esg_reporting_periods','organization_id = public.shakti_batchd_org_id()'),
      ('evidence_artifact_series','organization_id = public.shakti_batchd_org_id() AND EXISTS (SELECT 1 FROM public.activities a WHERE a.id = evidence_artifact_series.activity_id AND a.organization_id = public.shakti_batchd_org_id())'),
      ('field_devices','organization_id = public.shakti_batchd_org_id()'),
      ('obligations','organization_id = public.shakti_batchd_org_id()'),
      ('organization_bwg_assessments','organization_id = public.shakti_batchd_org_id()'),
      ('organization_epr_applicability','organization_id = public.shakti_batchd_org_id()'),
      ('organization_geography_scopes','organization_id = public.shakti_batchd_org_id()'),
      ('organization_statutory_profiles','organization_id = public.shakti_batchd_org_id()'),
      ('organization_verification_evidence','organization_id = public.shakti_batchd_org_id()'),
      ('resource_flows','organization_id = public.shakti_batchd_org_id()'),
      ('stakeholder_applications','organization_id = public.shakti_batchd_org_id() AND identity_id = public.shakti_batchd_identity_id()')
    ) AS x(table_name, predicate)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',r.table_name);
    EXECUTE format('CREATE POLICY shakti_batchd_%I ON public.%I FOR ALL USING (%s) WITH CHECK (%s)',
      r.table_name,r.table_name,r.predicate,r.predicate);
  END LOOP;
END
$policies$;

-- Assert the exact policy inventory and forced-RLS state for all 17 targets.
DO $inventory$
DECLARE r record; n integer;
BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'bwg_profiles','bwg_reporting_periods','carbon_projects','cpcb_swm_stakeholder_workspaces',
    'environmental_attribute_claims','epr_returns','esg_reporting_periods','evidence_artifact_series',
    'field_devices','obligations','organization_bwg_assessments','organization_epr_applicability',
    'organization_geography_scopes','organization_statutory_profiles','organization_verification_evidence',
    'resource_flows','stakeholder_applications'
  ]) AS table_name
  LOOP
    SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
      WHERE s.nspname='public' AND c.relname=r.table_name AND c.relrowsecurity AND c.relforcerowsecurity;
    IF n <> 1 THEN RAISE EXCEPTION 'Batch D RLS/FORCE RLS missing on %',r.table_name; END IF;
    SELECT count(*) INTO n FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
      WHERE c.relname=r.table_name AND p.polname=format('shakti_batchd_%s',r.table_name)
        AND p.polcmd='*' AND p.polqual IS NOT NULL AND p.polwithcheck IS NOT NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'Batch D USING/WITH CHECK policy missing on %',r.table_name; END IF;
  END LOOP;
END
$inventory$;

-- A single reusable assertion validates row filtering, own-row UPDATE and
-- invisible foreign-row DELETE for each table under a non-owner NOBYPASSRLS role.
BEGIN;
SET LOCAL ROLE rupaykg_ci_batchd_org_a;
SELECT set_config('app.organization_id','00000000-0000-0000-0000-0000000000a1',true);
SELECT set_config('app.identity_id','00000000-0000-0000-0000-00000000c001',true);

DO $org_a$
DECLARE r record; visible_count integer; own_count integer; foreign_count integer; changed integer;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('bwg_profiles','00000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-00000000b101'),
    ('bwg_reporting_periods','00000000-0000-0000-0000-00000000a102','00000000-0000-0000-0000-00000000b102'),
    ('carbon_projects','00000000-0000-0000-0000-00000000a103','00000000-0000-0000-0000-00000000b103'),
    ('cpcb_swm_stakeholder_workspaces','00000000-0000-0000-0000-00000000a104','00000000-0000-0000-0000-00000000b104'),
    ('environmental_attribute_claims','00000000-0000-0000-0000-00000000a105','00000000-0000-0000-0000-00000000b105'),
    ('epr_returns','00000000-0000-0000-0000-00000000a106','00000000-0000-0000-0000-00000000b106'),
    ('esg_reporting_periods','00000000-0000-0000-0000-00000000a107','00000000-0000-0000-0000-00000000b107'),
    ('evidence_artifact_series','00000000-0000-0000-0000-00000000a108','00000000-0000-0000-0000-00000000b108'),
    ('field_devices','00000000-0000-0000-0000-00000000a109','00000000-0000-0000-0000-00000000b109'),
    ('obligations','00000000-0000-0000-0000-00000000a110','00000000-0000-0000-0000-00000000b110'),
    ('organization_bwg_assessments','00000000-0000-0000-0000-00000000a111','00000000-0000-0000-0000-00000000b111'),
    ('organization_epr_applicability','00000000-0000-0000-0000-00000000a112','00000000-0000-0000-0000-00000000b112'),
    ('organization_geography_scopes','00000000-0000-0000-0000-00000000a113','00000000-0000-0000-0000-00000000b113'),
    ('organization_statutory_profiles','00000000-0000-0000-0000-00000000a114','00000000-0000-0000-0000-00000000b114'),
    ('organization_verification_evidence','00000000-0000-0000-0000-00000000a115','00000000-0000-0000-0000-00000000b115'),
    ('resource_flows','00000000-0000-0000-0000-00000000a116','00000000-0000-0000-0000-00000000b116'),
    ('stakeholder_applications','00000000-0000-0000-0000-00000000a117','00000000-0000-0000-0000-00000000b117')
  ) AS x(table_name,a_id,b_id)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN (%L::uuid,%L::uuid)',r.table_name,r.a_id,r.b_id) INTO visible_count;
    IF visible_count <> 1 THEN RAISE EXCEPTION 'Org A sees % of two tenant rows in %, expected 1',visible_count,r.table_name; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=%L::uuid',r.table_name,r.a_id) INTO own_count;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=%L::uuid',r.table_name,r.b_id) INTO foreign_count;
    IF own_count <> 1 OR foreign_count <> 0 THEN RAISE EXCEPTION 'Org A row visibility failed for %',r.table_name; END IF;

    EXECUTE format('UPDATE public.%I SET id=id WHERE id=%L::uuid',r.table_name,r.a_id);
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Org A UPDATE own row failed for %',r.table_name; END IF;

    EXECUTE format('DELETE FROM public.%I WHERE id=%L::uuid',r.table_name,r.b_id);
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN RAISE EXCEPTION 'Org A DELETE crossed tenant boundary for %',r.table_name; END IF;
  END LOOP;

  IF (SELECT count(*) FROM public.field_devices WHERE id='00000000-0000-0000-0000-00000000a10a') <> 0 THEN
    RAISE EXCEPTION 'Unassigned field device is visible to organization runtime';
  END IF;

  -- A tenant member must not enumerate another applicant's application in
  -- the same organization merely because the organization context matches.
  IF (SELECT count(*) FROM public.stakeholder_applications
      WHERE id='00000000-0000-0000-0000-00000000a118') <> 0 THEN
    RAISE EXCEPTION 'Stakeholder application leaked across applicant identity';
  END IF;

  -- USING and WITH CHECK: cloned rows target another organization. All other
  -- values are copied from a valid source row so business constraints are met.
  FOR r IN SELECT * FROM (VALUES
    ('bwg_profiles','00000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-0000000000d1'),
    ('carbon_projects','00000000-0000-0000-0000-00000000a103','00000000-0000-0000-0000-0000000000d1'),
    ('cpcb_swm_stakeholder_workspaces','00000000-0000-0000-0000-00000000a104','00000000-0000-0000-0000-0000000000d1'),
    ('environmental_attribute_claims','00000000-0000-0000-0000-00000000a105','00000000-0000-0000-0000-0000000000d1'),
    ('esg_reporting_periods','00000000-0000-0000-0000-00000000a107','00000000-0000-0000-0000-0000000000d1'),
    ('evidence_artifact_series','00000000-0000-0000-0000-00000000a108','00000000-0000-0000-0000-0000000000d1'),
    ('field_devices','00000000-0000-0000-0000-00000000a109','00000000-0000-0000-0000-0000000000d1'),
    ('obligations','00000000-0000-0000-0000-00000000a110','00000000-0000-0000-0000-0000000000d1'),
    ('organization_bwg_assessments','00000000-0000-0000-0000-00000000a111','00000000-0000-0000-0000-0000000000d1'),
    ('organization_epr_applicability','00000000-0000-0000-0000-00000000a112','00000000-0000-0000-0000-0000000000d1'),
    ('organization_geography_scopes','00000000-0000-0000-0000-00000000a113','00000000-0000-0000-0000-0000000000d1'),
    ('organization_statutory_profiles','00000000-0000-0000-0000-00000000a114','00000000-0000-0000-0000-0000000000d1'),
    ('organization_verification_evidence','00000000-0000-0000-0000-00000000a115','00000000-0000-0000-0000-0000000000d1'),
    ('resource_flows','00000000-0000-0000-0000-00000000a116','00000000-0000-0000-0000-0000000000d1'),
    ('stakeholder_applications','00000000-0000-0000-0000-00000000a117','00000000-0000-0000-0000-0000000000d1')
  ) AS x(table_name,a_id,target_org)
  LOOP
    DECLARE col_list text; expr_list text; obligation_target text;
    BEGIN
      SELECT string_agg(format('%I',a.attname),', ' ORDER BY a.attnum),
             string_agg(
               CASE
                 WHEN a.attname='source_id' AND r.table_name='environmental_attribute_claims' THEN 'gen_random_uuid()'
                 WHEN a.attname='basis_key' AND r.table_name='environmental_attribute_claims' THEN format('src.%I || %L',a.attname,'_DENIED')
                 WHEN a.attname='project_code' AND r.table_name='carbon_projects' THEN format('src.%I || %L',a.attname,'_DENIED')
                 WHEN a.attname='device_id' AND r.table_name='field_devices' THEN format('src.%I || %L',a.attname,'_DENIED')
                 WHEN a.attname='status' AND r.table_name='stakeholder_applications' THEN quote_literal('REJECTED')
                 WHEN a.attname='obligation_id' AND r.table_name='epr_returns' THEN quote_literal('00000000-0000-0000-0000-00000000d120') || '::uuid'
                 ELSE format('src.%I',a.attname)
               END,', ' ORDER BY a.attnum)
        INTO col_list,expr_list
      FROM pg_attribute a
      WHERE a.attrelid=format('public.%I',r.table_name)::regclass
        AND a.attnum>0 AND NOT a.attisdropped
        AND a.attname NOT IN ('id','organization_id');
      EXECUTE format('INSERT INTO public.%I (id,organization_id,%s) SELECT gen_random_uuid(),%L::uuid,%s FROM public.%I src WHERE src.id=%L::uuid',
        r.table_name,col_list,r.target_org,expr_list,r.table_name,r.a_id);
      RAISE EXCEPTION 'Cross-tenant INSERT unexpectedly succeeded for %',r.table_name;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
END
$org_a$;

-- BWG reporting-period trigger reads bwg_profiles before the target-table RLS
-- WITH CHECK runs. In this disposable CI transaction only, add a temporary
-- SELECT policy to bwg_profiles so the target's business precondition passes
-- for Org C; then assert the reporting-period target's own RLS rejects Org C
-- under Org A context. The temporary policy is immediately removed.
RESET ROLE;
CREATE POLICY shakti_batchd_bwg_profile_guard_fixture
  ON public.bwg_profiles FOR SELECT USING (true);
-- The epr_returns quantity trigger locks its referenced obligation under the
-- caller's RLS context. Expose this fixture obligation only during the target
-- epr_returns WITH CHECK assertion; the policy is dropped below.
CREATE POLICY shakti_batchd_epr_obligation_guard_fixture
  ON public.epr_obligations FOR SELECT USING (true);
-- SELECT ... FOR UPDATE also requires the UPDATE RLS visibility policy.
CREATE POLICY shakti_batchd_epr_obligation_lock_fixture
  ON public.epr_obligations FOR UPDATE USING (true) WITH CHECK (true);
SET LOCAL ROLE rupaykg_ci_batchd_org_a;

-- The EPR return trigger uses SELECT ... FOR UPDATE against epr_obligations.
-- The temporary SELECT and UPDATE policies above allow that business guard to
-- validate the target obligation; the epr_returns WITH CHECK must still reject
-- the row because the current organization context is Org A, not Org D.
DO $epr_insert$
BEGIN
  BEGIN
    INSERT INTO public.epr_returns
      (id,scheme_id,organization_id,period_start,period_end,return_type,
       reported_quantity,fulfilled_quantity,obligation_id)
    VALUES
      ('00000000-0000-0000-0000-00000000a198',
       '00000000-0000-0000-0000-00000000e401',
       '00000000-0000-0000-0000-0000000000d1',
       '2025-01-01','2025-12-31','ANNUAL',10,0,
       '00000000-0000-0000-0000-00000000d120');
    RAISE EXCEPTION 'Cross-tenant INSERT unexpectedly succeeded for epr_returns';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$epr_insert$;

DO $bwg_insert$
BEGIN
  BEGIN
    INSERT INTO public.bwg_reporting_periods
      (id,organization_id,period_start,period_end,reporting_basis)
    VALUES
      ('00000000-0000-0000-0000-00000000a199',
       '00000000-0000-0000-0000-0000000000c1',
       '2026-01-01','2026-12-31','CI_BATCH_D_CROSS_ORG');
    RAISE EXCEPTION 'Cross-tenant INSERT unexpectedly succeeded for bwg_reporting_periods';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$bwg_insert$;

RESET ROLE;
DROP POLICY shakti_batchd_bwg_profile_guard_fixture ON public.bwg_profiles;
DROP POLICY shakti_batchd_epr_obligation_guard_fixture ON public.epr_obligations;
DROP POLICY shakti_batchd_epr_obligation_lock_fixture ON public.epr_obligations;
SET LOCAL ROLE rupaykg_ci_batchd_org_a;
DO $bwg_visibility$
BEGIN
  IF (SELECT count(*) FROM public.bwg_profiles
      WHERE id IN ('00000000-0000-0000-0000-00000000a101',
                   '00000000-0000-0000-0000-00000000b101',
                   '00000000-0000-0000-0000-00000000c101')) <> 1 THEN
    RAISE EXCEPTION 'Temporary BWG fixture SELECT policy was not fully removed';
  END IF;
  IF (SELECT count(*) FROM public.epr_obligations
      WHERE id='00000000-0000-0000-0000-00000000d120') <> 0 THEN
    RAISE EXCEPTION 'Temporary EPR obligation fixture SELECT policy was not fully removed';
  END IF;
END
$bwg_visibility$;

COMMIT;
RESET ROLE;

-- Identity-only access to another applicant's application is explicitly tested
-- for the same organization. This is applicant self-service, not reviewer access.
BEGIN;
SET LOCAL ROLE rupaykg_ci_batchd_org_b;
SELECT set_config('app.organization_id','00000000-0000-0000-0000-0000000000a1',true);
SELECT set_config('app.identity_id','00000000-0000-0000-0000-00000000c003',true);
DO $applicant$
BEGIN
  IF (SELECT count(*) FROM public.stakeholder_applications WHERE id='00000000-0000-0000-0000-00000000a118') <> 1 THEN
    RAISE EXCEPTION 'Applicant C cannot see own same-organization application';
  END IF;
  IF (SELECT count(*) FROM public.stakeholder_applications WHERE id='00000000-0000-0000-0000-00000000a117') <> 0 THEN
    RAISE EXCEPTION 'Applicant C can see another identity application in same organization';
  END IF;
END
$applicant$;
COMMIT;
RESET ROLE;

-- Reverse-tenant proof under organization B.
BEGIN;
SET LOCAL ROLE rupaykg_ci_batchd_org_b;
SELECT set_config('app.organization_id','00000000-0000-0000-0000-0000000000b1',true);
SELECT set_config('app.identity_id','00000000-0000-0000-0000-00000000c002',true);
DO $org_b$
DECLARE r record; visible_count integer; own_count integer; foreign_count integer; changed integer;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('bwg_profiles','00000000-0000-0000-0000-00000000b101','00000000-0000-0000-0000-00000000a101'),
    ('bwg_reporting_periods','00000000-0000-0000-0000-00000000b102','00000000-0000-0000-0000-00000000a102'),
    ('carbon_projects','00000000-0000-0000-0000-00000000b103','00000000-0000-0000-0000-00000000a103'),
    ('cpcb_swm_stakeholder_workspaces','00000000-0000-0000-0000-00000000b104','00000000-0000-0000-0000-00000000a104'),
    ('environmental_attribute_claims','00000000-0000-0000-0000-00000000b105','00000000-0000-0000-0000-00000000a105'),
    ('epr_returns','00000000-0000-0000-0000-00000000b106','00000000-0000-0000-0000-00000000a106'),
    ('esg_reporting_periods','00000000-0000-0000-0000-00000000b107','00000000-0000-0000-0000-00000000a107'),
    ('evidence_artifact_series','00000000-0000-0000-0000-00000000b108','00000000-0000-0000-0000-00000000a108'),
    ('field_devices','00000000-0000-0000-0000-00000000b109','00000000-0000-0000-0000-00000000a109'),
    ('obligations','00000000-0000-0000-0000-00000000b110','00000000-0000-0000-0000-00000000a110'),
    ('organization_bwg_assessments','00000000-0000-0000-0000-00000000b111','00000000-0000-0000-0000-00000000a111'),
    ('organization_epr_applicability','00000000-0000-0000-0000-00000000b112','00000000-0000-0000-0000-00000000a112'),
    ('organization_geography_scopes','00000000-0000-0000-0000-00000000b113','00000000-0000-0000-0000-00000000a113'),
    ('organization_statutory_profiles','00000000-0000-0000-0000-00000000b114','00000000-0000-0000-0000-00000000a114'),
    ('organization_verification_evidence','00000000-0000-0000-0000-00000000b115','00000000-0000-0000-0000-00000000a115'),
    ('resource_flows','00000000-0000-0000-0000-00000000b116','00000000-0000-0000-0000-00000000a116'),
    ('stakeholder_applications','00000000-0000-0000-0000-00000000b117','00000000-0000-0000-0000-00000000a117')
  ) AS x(table_name,a_id,b_id)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN (%L::uuid,%L::uuid)',r.table_name,r.a_id,r.b_id) INTO visible_count;
    IF visible_count <> 1 THEN RAISE EXCEPTION 'Org B sees % of two tenant rows in %, expected 1',visible_count,r.table_name; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=%L::uuid',r.table_name,r.a_id) INTO own_count;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=%L::uuid',r.table_name,r.b_id) INTO foreign_count;
    IF own_count <> 1 OR foreign_count <> 0 THEN RAISE EXCEPTION 'Org B row visibility failed for %',r.table_name; END IF;
    EXECUTE format('UPDATE public.%I SET id=id WHERE id=%L::uuid',r.table_name,r.a_id);
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Org B UPDATE own row failed for %',r.table_name; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id=%L::uuid',r.table_name,r.b_id);
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN RAISE EXCEPTION 'Org B DELETE crossed tenant boundary for %',r.table_name; END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.field_devices WHERE id='00000000-0000-0000-0000-00000000a10a') <> 0 THEN
    RAISE EXCEPTION 'Unassigned field device is visible to organization B runtime';
  END IF;
END
$org_b$;
COMMIT;
RESET ROLE;

-- Missing/malformed tenant context is closed for every one of the 17 tables.
BEGIN;
SET LOCAL ROLE rupaykg_ci_batchd_org_a;
SELECT set_config('app.organization_id','not-a-uuid',true);
SELECT set_config('app.identity_id','not-a-uuid',true);
DO $fail_closed$
DECLARE r record; n integer;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('bwg_profiles','00000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-00000000b101'),
    ('bwg_reporting_periods','00000000-0000-0000-0000-00000000a102','00000000-0000-0000-0000-00000000b102'),
    ('carbon_projects','00000000-0000-0000-0000-00000000a103','00000000-0000-0000-0000-00000000b103'),
    ('cpcb_swm_stakeholder_workspaces','00000000-0000-0000-0000-00000000a104','00000000-0000-0000-0000-00000000b104'),
    ('environmental_attribute_claims','00000000-0000-0000-0000-00000000a105','00000000-0000-0000-0000-00000000b105'),
    ('epr_returns','00000000-0000-0000-0000-00000000a106','00000000-0000-0000-0000-00000000b106'),
    ('esg_reporting_periods','00000000-0000-0000-0000-00000000a107','00000000-0000-0000-0000-00000000b107'),
    ('evidence_artifact_series','00000000-0000-0000-0000-00000000a108','00000000-0000-0000-0000-00000000b108'),
    ('field_devices','00000000-0000-0000-0000-00000000a109','00000000-0000-0000-0000-00000000b109'),
    ('obligations','00000000-0000-0000-0000-00000000a110','00000000-0000-0000-0000-00000000b110'),
    ('organization_bwg_assessments','00000000-0000-0000-0000-00000000a111','00000000-0000-0000-0000-00000000b111'),
    ('organization_epr_applicability','00000000-0000-0000-0000-00000000a112','00000000-0000-0000-0000-00000000b112'),
    ('organization_geography_scopes','00000000-0000-0000-0000-00000000a113','00000000-0000-0000-0000-00000000b113'),
    ('organization_statutory_profiles','00000000-0000-0000-0000-00000000a114','00000000-0000-0000-0000-00000000b114'),
    ('organization_verification_evidence','00000000-0000-0000-0000-00000000a115','00000000-0000-0000-0000-00000000b115'),
    ('resource_flows','00000000-0000-0000-0000-00000000a116','00000000-0000-0000-0000-00000000b116'),
    ('stakeholder_applications','00000000-0000-0000-0000-00000000a117','00000000-0000-0000-0000-00000000b117')
  ) AS x(table_name,a_id,b_id)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN (%L::uuid,%L::uuid)',
      r.table_name,r.a_id,r.b_id) INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'Malformed tenant context exposed rows in %',r.table_name; END IF;
  END LOOP;
  IF public.shakti_batchd_org_id() IS NOT NULL OR public.shakti_batchd_identity_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Malformed Batch D context did not fail closed';
  END IF;
END
$fail_closed$;
COMMIT;
RESET ROLE;

-- Prove transaction-local context does not leak across pooled connection reuse.
DO $pool$
BEGIN
  IF public.shakti_batchd_org_id() IS NOT NULL OR public.shakti_batchd_identity_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Batch D identity or tenant context leaked beyond transaction';
  END IF;
END
$pool$;

-- Disposable CI cleanup only.
DO $cleanup$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bwg_profiles','bwg_reporting_periods','carbon_projects','cpcb_swm_stakeholder_workspaces',
    'environmental_attribute_claims','epr_returns','esg_reporting_periods','evidence_artifact_series',
    'field_devices','obligations','organization_bwg_assessments','organization_epr_applicability',
    'organization_geography_scopes','organization_statutory_profiles','organization_verification_evidence',
    'resource_flows','stakeholder_applications'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS shakti_batchd_%I ON public.%I',t,t);
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY',t);
  END LOOP;
END
$cleanup$;

DROP FUNCTION public.shakti_batchd_org_id();
DROP FUNCTION public.shakti_batchd_identity_id();
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM rupaykg_ci_batchd_org_a, rupaykg_ci_batchd_org_b;
DROP ROLE rupaykg_ci_batchd_org_a;
DROP ROLE rupaykg_ci_batchd_org_b;

SELECT 'SHK_BATCH_D_DIRECT_TENANT_RLS: PASS (17 tables; two organizations; identity, nullable-device and activity-parent boundary checks)' AS result;
