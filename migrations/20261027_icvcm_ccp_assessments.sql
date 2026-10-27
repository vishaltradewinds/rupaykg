-- ICVCM CCP internal evidence assessment register.
-- This is an internal readiness aid, not a crediting decision or certification.
CREATE TABLE IF NOT EXISTS icvcm_ccp_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  activity_id uuid NOT NULL REFERENCES activities(id),
  assessed_by_identity_id uuid NOT NULL REFERENCES identities(id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  assessment jsonb NOT NULL,
  summary jsonb NOT NULL,
  status text NOT NULL DEFAULT 'INTERNAL_DRAFT'
    CHECK (status IN ('INTERNAL_DRAFT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, activity_id, revision_number)
);

CREATE INDEX IF NOT EXISTS icvcm_ccp_assessments_latest_idx
  ON icvcm_ccp_assessments (organization_id, activity_id, revision_number DESC);

CREATE OR REPLACE FUNCTION prevent_icvcm_ccp_assessment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ICVCM CCP assessment history is append-only; create a new revision instead';
END;
$$;

DROP TRIGGER IF EXISTS icvcm_ccp_assessments_append_only ON icvcm_ccp_assessments;
CREATE TRIGGER icvcm_ccp_assessments_append_only
BEFORE UPDATE OR DELETE ON icvcm_ccp_assessments
FOR EACH ROW EXECUTE FUNCTION prevent_icvcm_ccp_assessment_mutation();

COMMENT ON TABLE icvcm_ccp_assessments IS
  'Append-only internal ICVCM Core Carbon Principles evidence completeness history. Not certification, independent verification, or credit issuance.';
