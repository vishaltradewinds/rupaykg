-- ICVCM CCP internal evidence assessment register.
-- This is an internal readiness aid, not a crediting decision or certification.
CREATE TABLE IF NOT EXISTS icvcm_ccp_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  activity_id uuid NOT NULL REFERENCES activities(id),
  assessed_by_identity_id uuid NOT NULL REFERENCES identities(id),
  assessment jsonb NOT NULL,
  summary jsonb NOT NULL,
  status text NOT NULL DEFAULT 'INTERNAL_DRAFT'
    CHECK (status IN ('INTERNAL_DRAFT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, activity_id)
);

CREATE INDEX IF NOT EXISTS icvcm_ccp_assessments_org_updated_idx
  ON icvcm_ccp_assessments (organization_id, updated_at DESC);

COMMENT ON TABLE icvcm_ccp_assessments IS
  'Internal ICVCM Core Carbon Principles evidence completeness records. Not certification, independent verification, or credit issuance.';
