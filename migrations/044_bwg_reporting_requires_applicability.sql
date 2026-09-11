-- BWG reporting periods are only valid for organizations that have an
-- authoritative, verified applicability determination under SWM Rules 2026.
-- This keeps non-BWG organizations from entering the BWG reporting lifecycle
-- without first completing the applicability/onboarding step.

CREATE OR REPLACE FUNCTION require_applicable_bwg_profile_for_reporting_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM bwg_profiles p
    WHERE p.organization_id = NEW.organization_id
      AND p.applicability_status = 'APPLICABLE'
      AND p.status = 'VERIFIED'
  ) THEN
    RAISE EXCEPTION 'BWG applicability must be verified before creating a reporting period'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bwg_reporting_period_requires_applicability
  ON bwg_reporting_periods;

CREATE TRIGGER bwg_reporting_period_requires_applicability
BEFORE INSERT OR UPDATE OF organization_id
ON bwg_reporting_periods
FOR EACH ROW
EXECUTE FUNCTION require_applicable_bwg_profile_for_reporting_period();
