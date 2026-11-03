-- Preserve the authorization facts used at the exact time each verifier decision is recorded.
-- Historical rows remain NULL: this migration does not fabricate past authorization evidence.
ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS authorization_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS authorization_snapshot_hash text;

CREATE OR REPLACE FUNCTION public.capture_verification_authorization_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_activity_id uuid;
  v_snapshot jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.authorization_snapshot IS DISTINCT FROM OLD.authorization_snapshot
       OR NEW.authorization_snapshot_hash IS DISTINCT FROM OLD.authorization_snapshot_hash THEN
      RAISE EXCEPTION 'verification authorization snapshot is immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.authorization_snapshot IS NOT NULL OR NEW.authorization_snapshot_hash IS NOT NULL THEN
    RAISE EXCEPTION 'verification authorization snapshot is database-generated';
  END IF;

  v_activity_id := NEW.activity_id;
  IF v_activity_id IS NULL AND NEW.evidence_id IS NOT NULL THEN
    SELECT e.activity_id INTO v_activity_id
      FROM public.evidence e WHERE e.id = NEW.evidence_id;
  END IF;
  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'cannot snapshot verifier authorization without a subject activity';
  END IF;

  SELECT jsonb_build_object(
    'schema_version', 1,
    'captured_at', clock_timestamp(),
    'decision', NEW.decision,
    'verifier_identity_id', NEW.verifier_identity_id,
    'identity', (SELECT jsonb_build_object(
      'id', i.id, 'status', i.status, 'suspended_at', i.suspended_at
    ) FROM public.identities i WHERE i.id = NEW.verifier_identity_id),
    'subject_activity_id', a.id,
    'subject_organization_id', a.organization_id,
    'subject_organization_status', o.status,
    'subject_geography_id', a.geography_id,
    'verified_memberships', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'membership_id', m.id, 'status', m.status, 'role_id', r.id,
        'role_permissions', r.permissions
      ) ORDER BY m.id)
      FROM public.organization_memberships m
      JOIN public.roles r ON r.id = m.role_id
      WHERE m.identity_id = NEW.verifier_identity_id
        AND m.organization_id = a.organization_id
        AND m.status = 'VERIFIED'
        AND r.organization_id = a.organization_id
    ), '[]'::jsonb),
    'verified_geography_scopes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'scope_id', s.id, 'geography_id', s.geography_id, 'status', s.status
      ) ORDER BY s.id)
      FROM public.organization_geography_scopes s
      WHERE s.organization_id = a.organization_id AND s.status = 'VERIFIED'
    ), '[]'::jsonb)
  ) INTO v_snapshot
  FROM public.activities a
  JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.id = v_activity_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'cannot capture authorization snapshot for missing subject activity';
  END IF;
  NEW.authorization_snapshot := v_snapshot;
  NEW.authorization_snapshot_hash := encode(digest(v_snapshot::text, 'sha256'), 'hex');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS verification_authorization_snapshot_guard ON public.verifications;
CREATE TRIGGER verification_authorization_snapshot_guard
  BEFORE INSERT OR UPDATE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.capture_verification_authorization_snapshot();
