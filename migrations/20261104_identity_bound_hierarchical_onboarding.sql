-- Identity-bound hierarchical onboarding review and legal verification.
-- Every operation derives the actor from a live session token hash inside PostgreSQL.
-- SECURITY DEFINER routines are owned by the dedicated NOLOGIN auth owner.

GRANT UPDATE ON public.organization_verification_evidence,
  public.stakeholder_application_approvals TO rupaykg_auth_owner;
GRANT INSERT ON public.organization_statutory_profiles TO rupaykg_auth_owner;
GRANT SELECT (organization_id,framework,rule_reference,effective_from)
  ON public.organization_statutory_profiles TO rupaykg_auth_owner;
CREATE OR REPLACE FUNCTION public.ensure_organization_governance_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $governance_profile$
BEGIN
  -- Platform authority is an internal governance principal, not a regulated
  -- operating organization; do not seed an operator statutory profile for it.
  IF NEW.organization_type = 'PLATFORM_AUTHORITY' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_statutory_profiles
    (organization_id, framework, rule_reference, effective_from, applicability_status, basis)
  VALUES
    (NEW.id, 'SWM_BWG', 'SWM_RULES_2026_S_O_388_E', date '2026-04-01', 'UNKNOWN',
     jsonb_build_object('source', 'RupayKG governance catalogue', 'externalAcceptance', false,
       'thresholds', jsonb_build_object('floorAreaSqM', 20000,
         'waterConsumptionLpd', 40000, 'solidWasteKgpd', 100)))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$governance_profile$;

ALTER FUNCTION public.ensure_organization_governance_profile() OWNER TO rupaykg_auth_owner;
ALTER FUNCTION public.ensure_organization_governance_profile() SECURITY DEFINER;
ALTER FUNCTION public.ensure_organization_governance_profile() SET search_path = pg_catalog, pg_temp;

SET ROLE rupaykg_auth_owner;

CREATE OR REPLACE FUNCTION auth_private.get_onboarding_review_queue(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $queue$
DECLARE
  v_actor uuid;
  v_row record;
  v_approvals jsonb;
  v_next jsonb;
  v_can_review boolean;
  v_can_verify boolean;
  v_roles text[];
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000';
  END IF;

  SELECT s.identity_id INTO v_actor
    FROM public.identity_sessions s
    JOIN public.identities i ON i.id=s.identity_id
   WHERE s.token_hash=p_token_hash AND s.revoked_at IS NULL AND s.expires_at>now()
     AND i.status='VERIFIED'::public.record_status AND i.suspended_at IS NULL;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000';
  END IF;

  FOR v_row IN
    SELECT sa.id,sa.organization_id,sa.identity_id AS applicant_identity_id,
           sa.requested_role_key,sa.requested_organization_type,sa.geography_id,
           sa.status,sa.applicant_note,sa.created_at,sa.reviewed_at,sa.review_note,
           o.name AS organization_name,o.legal_name,o.legal_form,
           o.registration_identifier,o.registration_authority,o.verification_status,
           o.verification_note,
           (SELECT count(*) FROM public.organization_verification_evidence e
             WHERE e.organization_id=o.id) AS evidence_count,
           g.name AS geography_name,g.kind AS geography_kind,
           i.display_name AS applicant_name,i.email AS applicant_email
      FROM public.stakeholder_applications sa
      JOIN public.organizations o ON o.id=sa.organization_id
      LEFT JOIN public.geography g ON g.id=sa.geography_id
      LEFT JOIN public.identities i ON i.id=sa.identity_id
     WHERE sa.status='PENDING'
     ORDER BY sa.created_at
  LOOP
    SELECT coalesce(jsonb_agg(to_jsonb(ap) ORDER BY ap.step_order),'[]'::jsonb)
      INTO v_approvals
      FROM public.stakeholder_application_approvals ap
     WHERE ap.application_id=v_row.id;

    SELECT to_jsonb(ap) INTO v_next
      FROM public.stakeholder_application_approvals ap
     WHERE ap.application_id=v_row.id AND ap.status='PENDING'
     ORDER BY ap.step_order LIMIT 1;

    v_can_review := false;
    IF v_next IS NOT NULL THEN
      v_roles := CASE v_next->>'approval_level'
        WHEN 'PLATFORM' THEN ARRAY['platform_admin','super_admin']
        WHEN 'STATE' THEN ARRAY['state_admin','regulator']
        WHEN 'DISTRICT' THEN ARRAY['regulator','state_admin']
        WHEN 'LOCAL' THEN CASE WHEN v_row.geography_kind IN ('ULB','WARD','LOCALITY')
                               THEN ARRAY['municipal_admin'] ELSE ARRAY['regulator'] END
        ELSE ARRAY[]::text[]
      END;
      SELECT EXISTS(
        SELECT 1 FROM public.organization_memberships om
        JOIN public.roles r ON r.id=om.role_id
        WHERE om.identity_id=v_actor AND om.status='VERIFIED'
          AND r.name=ANY(v_roles)
          AND ((v_next->>'approval_level')='PLATFORM'
               OR v_row.geography_id IS NULL
               OR public.organization_has_geography_scope(om.organization_id,v_row.geography_id))
      ) INTO v_can_review;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.organization_memberships om
      JOIN public.roles r ON r.id=om.role_id
      JOIN public.organizations authority_org ON authority_org.id=om.organization_id
      WHERE om.identity_id=v_actor AND om.status='VERIFIED'
        AND authority_org.status='VERIFIED'
        AND authority_org.organization_type='PLATFORM_AUTHORITY'
        AND r.name IN ('platform_admin','super_admin')
        AND jsonb_typeof(r.permissions)='array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(r.permissions) permission(value)
          WHERE permission.value='admin:users'
        )
    ) AND v_row.requested_organization_type<>'individual'
      AND v_row.verification_status IS DISTINCT FROM 'VERIFIED'
      INTO v_can_verify;

    IF v_can_review OR v_can_verify THEN
      v_result := v_result || jsonb_build_array(
        to_jsonb(v_row) || jsonb_build_object(
          'approvals',v_approvals,'nextApproval',v_next,
          'canReview',v_can_review,'canVerifyLegal',v_can_verify
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('source','postgresql','syntheticData',false,'applications',v_result);
END;
$queue$;

CREATE OR REPLACE FUNCTION auth_private.verify_stakeholder_legal(
  p_token_hash text,p_application_id uuid,p_verification_status text,p_verification_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $legal$
DECLARE
  v_actor uuid;
  v_organization_id uuid;
  v_organization_type text;
  v_evidence_count integer;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash)<>64 THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000';
  END IF;
  IF p_application_id IS NULL OR p_verification_status IS NULL OR p_verification_status NOT IN ('VERIFIED','REJECTED')
     OR p_verification_note IS NULL OR length(btrim(p_verification_note))=0 THEN
    RAISE EXCEPTION 'LEGAL_REVIEW_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT s.identity_id INTO v_actor
    FROM public.identity_sessions s JOIN public.identities i ON i.id=s.identity_id
   WHERE s.token_hash=p_token_hash AND s.revoked_at IS NULL AND s.expires_at>now()
     AND i.status='VERIFIED'::public.record_status AND i.suspended_at IS NULL;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.organization_memberships om
    JOIN public.roles r ON r.id=om.role_id
    JOIN public.organizations authority_org ON authority_org.id=om.organization_id
    WHERE om.identity_id=v_actor AND om.status='VERIFIED'
      AND authority_org.status='VERIFIED'
      AND authority_org.organization_type='PLATFORM_AUTHORITY'
      AND r.name IN ('platform_admin','super_admin')
      AND jsonb_typeof(r.permissions)='array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(r.permissions) permission(value)
        WHERE permission.value='admin:users'
      )
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_AUTHORITY_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  SELECT sa.organization_id,sa.requested_organization_type
    INTO v_organization_id,v_organization_type
    FROM public.stakeholder_applications sa
   WHERE sa.id=p_application_id AND sa.status='PENDING'
   FOR UPDATE;
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF v_organization_type='individual' THEN
    RAISE EXCEPTION 'LEGAL_VERIFICATION_NOT_REQUIRED' USING ERRCODE='22023';
  END IF;

  IF p_verification_status='VERIFIED' THEN
    SELECT count(*) INTO v_evidence_count
      FROM public.organization_verification_evidence e
     WHERE e.organization_id=v_organization_id
       AND e.document_reference IS NOT NULL AND btrim(e.document_reference)<>''
       AND e.content_hash IS NOT NULL AND btrim(e.content_hash)<>'';
    IF v_evidence_count<1 THEN
      RAISE EXCEPTION 'LEGAL_EVIDENCE_MISSING' USING ERRCODE='23514';
    END IF;
  END IF;

  UPDATE public.organization_verification_evidence
     SET status=p_verification_status,verification_note=p_verification_note,
         verified_by_identity_id=v_actor,verified_at=now()
   WHERE organization_id=v_organization_id AND status IN ('PENDING','REJECTED');

  UPDATE public.organizations
     SET verification_status=p_verification_status,
         verification_note=p_verification_note,
         verified_by_identity_id=CASE WHEN p_verification_status='VERIFIED' THEN v_actor ELSE NULL END,
         verified_at=CASE WHEN p_verification_status='VERIFIED' THEN now() ELSE NULL END
   WHERE id=v_organization_id;

  RETURN jsonb_build_object('status',p_verification_status,'organizationId',v_organization_id);
END;
$legal$;

CREATE OR REPLACE FUNCTION auth_private.review_stakeholder_application(
  p_token_hash text,p_application_id uuid,p_action text,p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $review$
DECLARE
  v_actor uuid;
  v_app record;
  v_next record;
  v_roles text[];
  v_remaining integer;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash)<>64 THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000';
  END IF;
  IF p_application_id IS NULL OR p_action IS NULL OR p_action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'INVALID_DECISION' USING ERRCODE='22023';
  END IF;
  IF p_action='reject' AND (p_review_note IS NULL OR length(btrim(p_review_note))=0) THEN
    RAISE EXCEPTION 'REVIEW_NOTE_REQUIRED' USING ERRCODE='22023';
  END IF;

  SELECT s.identity_id INTO v_actor
    FROM public.identity_sessions s JOIN public.identities i ON i.id=s.identity_id
   WHERE s.token_hash=p_token_hash AND s.revoked_at IS NULL AND s.expires_at>now()
     AND i.status='VERIFIED'::public.record_status AND i.suspended_at IS NULL;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;

  SELECT sa.id,sa.identity_id,sa.organization_id,sa.requested_organization_type,
         sa.geography_id,g.kind AS geography_kind,o.verification_status
    INTO v_app
    FROM public.stakeholder_applications sa
    LEFT JOIN public.geography g ON g.id=sa.geography_id
    JOIN public.organizations o ON o.id=sa.organization_id
   WHERE sa.id=p_application_id AND sa.status='PENDING'
   FOR UPDATE OF sa,o;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF v_actor=v_app.identity_id THEN
    RAISE EXCEPTION 'STAKEHOLDER_SELF_APPROVAL_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  PERFORM 1 FROM public.stakeholder_application_approvals ap
   WHERE ap.application_id=p_application_id ORDER BY ap.step_order FOR UPDATE;

  SELECT * INTO v_next
    FROM public.stakeholder_application_approvals ap
   WHERE ap.application_id=p_application_id AND ap.status='PENDING'
   ORDER BY ap.step_order LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPROVAL_CHAIN_COMPLETE' USING ERRCODE='23514';
  END IF;

  v_roles := CASE v_next.approval_level
    WHEN 'PLATFORM' THEN ARRAY['platform_admin','super_admin']
    WHEN 'STATE' THEN ARRAY['state_admin','regulator']
    WHEN 'DISTRICT' THEN ARRAY['regulator','state_admin']
    WHEN 'LOCAL' THEN CASE WHEN v_app.geography_kind IN ('ULB','WARD','LOCALITY')
                           THEN ARRAY['municipal_admin'] ELSE ARRAY['regulator'] END
    ELSE ARRAY[]::text[]
  END;
  IF NOT EXISTS(
    SELECT 1 FROM public.organization_memberships om
    JOIN public.roles r ON r.id=om.role_id
    JOIN public.organizations reviewer_org ON reviewer_org.id=om.organization_id
    WHERE om.identity_id=v_actor AND om.status='VERIFIED'
      AND reviewer_org.status='VERIFIED'
      AND r.name=ANY(v_roles)
      AND (v_next.approval_level<>'PLATFORM' OR (
        reviewer_org.organization_type='PLATFORM_AUTHORITY'
        AND jsonb_typeof(r.permissions)='array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(r.permissions) permission(value)
          WHERE permission.value='admin:users'
        )
      ))
      AND (v_next.approval_level='PLATFORM' OR v_app.geography_id IS NULL
           OR public.organization_has_geography_scope(om.organization_id,v_app.geography_id))
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_AUTHORITY_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  IF v_next.approval_level='PLATFORM' AND p_action='approve'
     AND v_app.requested_organization_type<>'individual'
     AND v_app.verification_status IS DISTINCT FROM 'VERIFIED' THEN
    RAISE EXCEPTION 'LEGAL_VERIFICATION_REQUIRED' USING ERRCODE='23514';
  END IF;

  IF p_action='reject' THEN
    UPDATE public.stakeholder_application_approvals
       SET status='REJECTED',approved_by_identity_id=v_actor,reviewed_at=now(),review_note=p_review_note
     WHERE id=v_next.id;
    UPDATE public.stakeholder_applications
       SET status='REJECTED',reviewed_by_identity_id=v_actor,reviewed_at=now(),review_note=p_review_note
     WHERE id=p_application_id;
    UPDATE public.organization_memberships SET status='REJECTED'
     WHERE organization_id=v_app.organization_id AND identity_id=v_app.identity_id AND status='PENDING';
    UPDATE public.organization_geography_scopes SET status='REJECTED'
     WHERE organization_id=v_app.organization_id AND status='PENDING';
    UPDATE public.organizations
       SET status='REJECTED',
           verification_status=CASE WHEN verification_status='VERIFIED' THEN verification_status ELSE 'REJECTED' END,
           verification_note=coalesce(verification_note,p_review_note)
     WHERE id=v_app.organization_id;
    RETURN jsonb_build_object('status','REJECTED','approvalLevel',v_next.approval_level);
  END IF;

  UPDATE public.stakeholder_application_approvals
     SET status='APPROVED',approved_by_identity_id=v_actor,reviewed_at=now(),review_note=p_review_note
   WHERE id=v_next.id;
  SELECT count(*) INTO v_remaining
    FROM public.stakeholder_application_approvals
   WHERE application_id=p_application_id AND status<>'APPROVED';

  IF v_remaining=0 THEN
    UPDATE public.stakeholder_applications
       SET status='APPROVED',reviewed_by_identity_id=v_actor,reviewed_at=now(),review_note=p_review_note
     WHERE id=p_application_id;
    UPDATE public.organizations
       SET status='VERIFIED',verification_status='VERIFIED',
           verified_by_identity_id=v_actor,verified_at=now()
     WHERE id=v_app.organization_id;
    UPDATE public.organization_memberships SET status='VERIFIED'
     WHERE organization_id=v_app.organization_id AND identity_id=v_app.identity_id AND status='PENDING';
    UPDATE public.organization_geography_scopes SET status='VERIFIED'
     WHERE organization_id=v_app.organization_id AND status='PENDING';
  END IF;

  RETURN jsonb_build_object(
    'status',CASE WHEN v_remaining=0 THEN 'APPROVED' ELSE 'PENDING' END,
    'approvalLevel',v_next.approval_level
  );
END;
$review$;

REVOKE ALL ON FUNCTION auth_private.get_onboarding_review_queue(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_private.verify_stakeholder_legal(text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_private.review_stakeholder_application(text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.get_onboarding_review_queue(text) TO rupaykg_auth_runtime;
GRANT EXECUTE ON FUNCTION auth_private.verify_stakeholder_legal(text,uuid,text,text) TO rupaykg_auth_runtime;
GRANT EXECUTE ON FUNCTION auth_private.review_stakeholder_application(text,uuid,text,text) TO rupaykg_auth_runtime;

RESET ROLE;
