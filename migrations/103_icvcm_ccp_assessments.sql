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

-- Database-level tenant binding for ICVCM assessment history.
create or replace function enforce_icvcm_assessment_activity_organization()
returns trigger
language plpgsql
as $$
declare
  activity_organization_id uuid;
begin
  select a.organization_id into activity_organization_id
  from activities a where a.id = new.activity_id;
  if activity_organization_id is null then
    raise exception 'ICVCM assessment activity must exist and have an organization';
  end if;
  if activity_organization_id is distinct from new.organization_id then
    raise exception 'ICVCM assessment organization must match the activity organization';
  end if;
  return new;
end;
$$;

drop trigger if exists icvcm_assessment_activity_organization_guard on icvcm_ccp_assessments;
create trigger icvcm_assessment_activity_organization_guard
before insert or update of organization_id, activity_id
on icvcm_ccp_assessments
for each row execute function enforce_icvcm_assessment_activity_organization();
