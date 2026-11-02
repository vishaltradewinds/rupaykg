-- One-time, two-custodian bootstrap of the first platform authority.
-- Production role provisioning and the ceremony itself require separate founder/DBA approval.
DO $preflight$
DECLARE owner_role record;
BEGIN
  SELECT * INTO owner_role FROM pg_catalog.pg_roles WHERE rolname = 'rupaykg_bootstrap_owner';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOTSTRAP_OWNER_ROLE_MISSING: DBA must provision rupaykg_bootstrap_owner before migration';
  END IF;
  IF owner_role.rolcanlogin OR owner_role.rolsuper OR owner_role.rolbypassrls
     OR owner_role.rolcreatedb OR owner_role.rolcreaterole
     OR owner_role.rolinherit OR owner_role.rolreplication THEN
    RAISE EXCEPTION 'rupaykg_bootstrap_owner must be NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOINHERIT and NREPLICATION';
  END IF;
  IF NOT pg_catalog.pg_has_role(current_user, owner_role.oid, 'MEMBER') THEN
    RAISE EXCEPTION 'BOOTSTRAP_OWNER_MEMBERSHIP_MISSING: migration principal must be able to SET ROLE rupaykg_bootstrap_owner';
  END IF;
  IF NOT pg_catalog.has_database_privilege(owner_role.oid, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'BOOTSTRAP_OWNER_DATABASE_CREATE_MISSING: DBA must grant CREATE temporarily for schema creation';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member = owner_role.oid) THEN
    RAISE EXCEPTION 'rupaykg_bootstrap_owner must not be a member of any other role';
  END IF;
END
$preflight$;

DO $capability_role$
DECLARE capability_role record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rupaykg_bootstrap_custodian') THEN
    CREATE ROLE rupaykg_bootstrap_custodian
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION;
  END IF;
  SELECT * INTO capability_role FROM pg_catalog.pg_roles WHERE rolname = 'rupaykg_bootstrap_custodian';
  IF capability_role.rolcanlogin OR capability_role.rolsuper OR capability_role.rolbypassrls
     OR capability_role.rolcreatedb OR capability_role.rolcreaterole
     OR capability_role.rolinherit OR capability_role.rolreplication THEN
    RAISE EXCEPTION 'rupaykg_bootstrap_custodian must be NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOINHERIT and NREPLICATION';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member = capability_role.oid) THEN
    RAISE EXCEPTION 'rupaykg_bootstrap_custodian must not be a member of any other role';
  END IF;
END
$capability_role$;

GRANT USAGE ON SCHEMA public TO rupaykg_bootstrap_owner;
GRANT SELECT ON public.identities, public.roles, public.organization_memberships,
  public.organizations, public.stakeholder_applications, public.platform_access_change_requests
  TO rupaykg_bootstrap_owner;
GRANT INSERT ON public.organizations, public.roles, public.organization_memberships
  TO rupaykg_bootstrap_owner;
GRANT REFERENCES ON public.identities, public.organizations TO rupaykg_bootstrap_owner;
GRANT EXECUTE ON FUNCTION public.rupaykg_default_role_permissions(text)
  TO rupaykg_bootstrap_owner;
GRANT EXECUTE ON FUNCTION public.digest(text, text) TO rupaykg_bootstrap_owner;

CREATE SCHEMA bootstrap_private AUTHORIZATION rupaykg_bootstrap_owner;
SET LOCAL ROLE rupaykg_bootstrap_owner;
REVOKE ALL ON SCHEMA bootstrap_private FROM PUBLIC;

CREATE TABLE bootstrap_private.bootstrap_ceremonies (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONSUMING','CONSUMED','REVOKED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  organization_id uuid,
  role_id uuid
);

CREATE TABLE bootstrap_private.bootstrap_claims (
  ceremony_id uuid NOT NULL REFERENCES bootstrap_private.bootstrap_ceremonies(id),
  identity_id uuid NOT NULL REFERENCES public.identities(id),
  custodian_role_name text NOT NULL,
  secret_hash text NOT NULL CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  submitted_by text,
  consumed_at timestamptz,
  PRIMARY KEY (ceremony_id, identity_id),
  UNIQUE (ceremony_id, custodian_role_name)
);

CREATE TABLE bootstrap_private.bootstrap_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  status text NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE','CONSUMING','CONSUMED')),
  active_ceremony_id uuid,
  active_organization_id uuid,
  active_role_id uuid,
  consumed_ceremony_id uuid,
  consumed_organization_id uuid,
  consumed_role_id uuid,
  consumed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO bootstrap_private.bootstrap_state(singleton,status)
VALUES (true,'IDLE')
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE bootstrap_private.bootstrap_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ceremony_id uuid NOT NULL UNIQUE REFERENCES bootstrap_private.bootstrap_ceremonies(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  identity_a uuid NOT NULL REFERENCES public.identities(id),
  identity_b uuid NOT NULL REFERENCES public.identities(id),
  custodian_a text NOT NULL,
  custodian_b text NOT NULL,
  previous_hash text,
  event_hash text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (identity_a <> identity_b),
  CHECK (custodian_a <> custodian_b)
);

CREATE OR REPLACE FUNCTION bootstrap_private.reject_bootstrap_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'BOOTSTRAP_AUDIT_IMMUTABLE';
END;
$$;

CREATE TRIGGER bootstrap_audit_no_update_delete
BEFORE UPDATE OR DELETE ON bootstrap_private.bootstrap_audit_events
FOR EACH ROW EXECUTE FUNCTION bootstrap_private.reject_bootstrap_audit_mutation();

CREATE TRIGGER bootstrap_audit_no_truncate
BEFORE TRUNCATE ON bootstrap_private.bootstrap_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION bootstrap_private.reject_bootstrap_audit_mutation();

CREATE OR REPLACE FUNCTION bootstrap_private.assert_custodian_session()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  custodian_role record;
  capability_member_count integer;
  membership_count integer;
BEGIN
  IF NOT pg_catalog.pg_has_role(session_user, 'rupaykg_bootstrap_custodian', 'MEMBER') THEN
    RAISE EXCEPTION 'BOOTSTRAP_CUSTODIAN_REQUIRED';
  END IF;

  SELECT * INTO custodian_role
    FROM pg_catalog.pg_roles
   WHERE rolname = session_user;
  IF NOT FOUND OR NOT custodian_role.rolcanlogin OR custodian_role.rolsuper
     OR custodian_role.rolbypassrls OR custodian_role.rolcreatedb
     OR custodian_role.rolcreaterole OR custodian_role.rolreplication
     OR custodian_role.rolinherit THEN
    RAISE EXCEPTION 'BOOTSTRAP_CUSTODIAN_ROLE_INVALID';
  END IF;

  SELECT count(*) INTO membership_count
    FROM pg_catalog.pg_auth_members m
   WHERE m.member = custodian_role.oid;
  SELECT count(*) INTO capability_member_count
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles login_role ON login_role.oid = m.member
    JOIN pg_catalog.pg_roles capability_role ON capability_role.oid = m.roleid
   WHERE capability_role.rolname = 'rupaykg_bootstrap_custodian'
     AND login_role.rolcanlogin;
  IF capability_member_count <> 2 THEN
    RAISE EXCEPTION 'BOOTSTRAP_REQUIRES_EXACTLY_TWO_CUSTODIAN_LOGINS';
  END IF;
  IF membership_count <> 1 OR NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members m
      JOIN pg_catalog.pg_roles r ON r.oid = m.roleid
     WHERE m.member = custodian_role.oid
       AND r.rolname = 'rupaykg_bootstrap_custodian'
  ) THEN
    RAISE EXCEPTION 'BOOTSTRAP_CUSTODIAN_MEMBERSHIP_INVALID';
  END IF;

  RETURN session_user;
END;
$$;

CREATE OR REPLACE FUNCTION bootstrap_private.submit_initial_platform_authority_claim(
  p_ceremony_id uuid,
  p_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  state_status text;
  claim_identity_id uuid;
  expected_secret_hash text;
  claim_expires_at timestamptz;
  actual_secret_hash text;
BEGIN
  PERFORM bootstrap_private.assert_custodian_session();

  SELECT status INTO state_status
    FROM bootstrap_private.bootstrap_state
   WHERE singleton = true
   FOR UPDATE;
  IF state_status IS DISTINCT FROM 'IDLE' THEN
    RAISE EXCEPTION 'BOOTSTRAP_ALREADY_CONSUMED';
  END IF;

  IF p_secret IS NULL OR length(p_secret) < 43 OR length(p_secret) > 128
     OR p_secret !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'BOOTSTRAP_CLAIM_INVALID';
  END IF;

  SELECT cl.identity_id, cl.secret_hash, cl.expires_at
    INTO claim_identity_id, expected_secret_hash, claim_expires_at
    FROM bootstrap_private.bootstrap_ceremonies bc
    JOIN bootstrap_private.bootstrap_claims cl ON cl.ceremony_id = bc.id
   WHERE bc.id = p_ceremony_id
     AND bc.status = 'PENDING'
     AND bc.expires_at > now()
     AND cl.custodian_role_name = session_user
     AND cl.submitted_at IS NULL
     AND cl.consumed_at IS NULL
     AND cl.expires_at > now()
   FOR UPDATE OF bc, cl;

  IF NOT FOUND OR claim_expires_at <= now() THEN
    RAISE EXCEPTION 'BOOTSTRAP_CLAIM_INVALID';
  END IF;

  actual_secret_hash := encode(public.digest(p_secret, 'sha256'), 'hex');
  IF actual_secret_hash <> expected_secret_hash THEN
    RAISE EXCEPTION 'BOOTSTRAP_CLAIM_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.identities i
     WHERE i.id = claim_identity_id
       AND i.status = 'VERIFIED'
       AND i.suspended_at IS NULL
       AND i.external_subject IS NOT NULL
       AND btrim(i.external_subject) <> ''
  ) THEN
    RAISE EXCEPTION 'BOOTSTRAP_IDENTITY_NOT_VERIFIED';
  END IF;

  UPDATE bootstrap_private.bootstrap_claims
     SET submitted_at = now(), submitted_by = session_user
   WHERE ceremony_id = p_ceremony_id
     AND identity_id = claim_identity_id;

  RETURN jsonb_build_object('status','CLAIM_ACCEPTED');
END;
$$;

CREATE OR REPLACE FUNCTION bootstrap_private.finalize_initial_platform_authority_bootstrap(
  p_ceremony_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  state_status text;
  ceremony_expires_at timestamptz;
  claim_count integer;
  identity_count integer;
  custodian_count integer;
  submitter_count integer;
  submitted_count integer;
  bindings_valid boolean;
  verified_identity_count integer;
  identity_a uuid;
  identity_b uuid;
  custodian_a text;
  custodian_b text;
  v_organization_id uuid;
  v_role_id uuid;
  permissions jsonb;
  previous_hash text;
  event_hash text;
  payload jsonb;
BEGIN
  PERFORM bootstrap_private.assert_custodian_session();

  SELECT status INTO state_status
    FROM bootstrap_private.bootstrap_state
   WHERE singleton = true
   FOR UPDATE;
  IF state_status IS DISTINCT FROM 'IDLE' THEN
    RAISE EXCEPTION 'BOOTSTRAP_ALREADY_CONSUMED';
  END IF;

  SELECT expires_at INTO ceremony_expires_at
    FROM bootstrap_private.bootstrap_ceremonies
   WHERE id = p_ceremony_id
     AND status = 'PENDING'
   FOR UPDATE;
  IF NOT FOUND OR ceremony_expires_at <= now() THEN
    RAISE EXCEPTION 'BOOTSTRAP_CEREMONY_INVALID';
  END IF;

  PERFORM 1
    FROM bootstrap_private.bootstrap_claims
   WHERE ceremony_id = p_ceremony_id
   ORDER BY identity_id
   FOR UPDATE;

  SELECT count(*),
         count(DISTINCT identity_id),
         count(DISTINCT custodian_role_name),
         count(DISTINCT submitted_by),
         count(*) FILTER (WHERE submitted_at IS NOT NULL AND consumed_at IS NULL),
         coalesce(bool_and(submitted_by = custodian_role_name), false)
    INTO claim_count, identity_count, custodian_count, submitter_count, submitted_count, bindings_valid
    FROM bootstrap_private.bootstrap_claims
   WHERE ceremony_id = p_ceremony_id;

  IF claim_count <> 2 OR identity_count <> 2 OR custodian_count <> 2
     OR submitter_count <> 2 OR submitted_count <> 2 OR NOT bindings_valid THEN
    RAISE EXCEPTION 'BOOTSTRAP_REQUIRES_TWO_DISTINCT_CUSTODIANS';
  END IF;

  SELECT count(*) INTO verified_identity_count
    FROM bootstrap_private.bootstrap_claims cl
    JOIN public.identities i ON i.id = cl.identity_id
   WHERE cl.ceremony_id = p_ceremony_id
     AND i.status = 'VERIFIED'
     AND i.suspended_at IS NULL
     AND i.external_subject IS NOT NULL
     AND btrim(i.external_subject) <> '';
  IF verified_identity_count <> 2 THEN
    RAISE EXCEPTION 'BOOTSTRAP_IDENTITY_NOT_VERIFIED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.organization_memberships om
      JOIN public.roles r ON r.id = om.role_id
     WHERE r.name = 'super_admin'
       AND om.status = 'VERIFIED'
  ) OR EXISTS (
    SELECT 1 FROM public.organizations o
     WHERE o.organization_type = 'PLATFORM_AUTHORITY'
  ) THEN
    RAISE EXCEPTION 'BOOTSTRAP_ALREADY_HAS_PLATFORM_AUTHORITY';
  END IF;

  permissions := public.rupaykg_default_role_permissions('super_admin');
  IF jsonb_typeof(permissions) <> 'array' OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(permissions) p(value) WHERE p.value = 'admin:users'
  ) THEN
    RAISE EXCEPTION 'BOOTSTRAP_SUPER_ADMIN_PERMISSION_SET_INVALID';
  END IF;

  UPDATE bootstrap_private.bootstrap_state
     SET status = 'CONSUMING',
         active_ceremony_id = p_ceremony_id,
         updated_at = now()
   WHERE singleton = true;

  INSERT INTO public.organizations
    (name, organization_type, status, verification_status, verified_at,
     verified_by_identity_id, verification_note)
  VALUES
    ('RupayKG Platform Authority', 'PLATFORM_AUTHORITY', 'VERIFIED',
     'VERIFIED', now(),
     (SELECT identity_id FROM bootstrap_private.bootstrap_claims
       WHERE ceremony_id = p_ceremony_id ORDER BY identity_id LIMIT 1),
     'Initial two-custodian platform authority bootstrap ceremony ' || p_ceremony_id::text)
  RETURNING id INTO v_organization_id;

  INSERT INTO public.roles (organization_id, name, permissions)
  VALUES (v_organization_id, 'super_admin', permissions)
  RETURNING id INTO v_role_id;

  UPDATE bootstrap_private.bootstrap_state
     SET active_organization_id = v_organization_id,
         active_role_id = v_role_id,
         updated_at = now()
   WHERE singleton = true;

  UPDATE bootstrap_private.bootstrap_ceremonies
     SET status = 'CONSUMING',
         organization_id = v_organization_id,
         role_id = v_role_id
   WHERE id = p_ceremony_id;

  PERFORM set_config('app.platform_authority_bootstrap_ceremony', p_ceremony_id::text, true);

  INSERT INTO public.organization_memberships (organization_id, identity_id, role_id, status)
  SELECT v_organization_id, identity_id, v_role_id, 'VERIFIED'::public.record_status
    FROM bootstrap_private.bootstrap_claims
   WHERE ceremony_id = p_ceremony_id
   ORDER BY identity_id;

  UPDATE bootstrap_private.bootstrap_claims
     SET consumed_at = now()
   WHERE ceremony_id = p_ceremony_id;

  UPDATE bootstrap_private.bootstrap_ceremonies
     SET status = 'CONSUMED', consumed_at = now()
   WHERE id = p_ceremony_id;

  UPDATE bootstrap_private.bootstrap_state
     SET status = 'CONSUMED',
         active_ceremony_id = NULL,
         active_organization_id = NULL,
         active_role_id = NULL,
         consumed_ceremony_id = p_ceremony_id,
         consumed_organization_id = v_organization_id,
         consumed_role_id = v_role_id,
         consumed_at = now(),
         updated_at = now()
   WHERE singleton = true;

  SELECT identity_id, custodian_role_name
    INTO identity_a, custodian_a
    FROM bootstrap_private.bootstrap_claims
   WHERE ceremony_id = p_ceremony_id
   ORDER BY identity_id
   LIMIT 1;

  SELECT identity_id, custodian_role_name
    INTO identity_b, custodian_b
    FROM bootstrap_private.bootstrap_claims
   WHERE ceremony_id = p_ceremony_id
   ORDER BY identity_id
   LIMIT 1 OFFSET 1;

  SELECT event_hash INTO previous_hash
    FROM bootstrap_private.bootstrap_audit_events
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  payload := jsonb_build_object(
    'event', 'PLATFORM_AUTHORITY_BOOTSTRAP_COMPLETED',
    'ceremonyId', p_ceremony_id,
    'organizationId', v_organization_id,
    'identityIds', jsonb_build_array(identity_a, identity_b),
    'custodianRoles', jsonb_build_array(custodian_a, custodian_b),
    'createdAt', now()
  );
  event_hash := encode(public.digest(coalesce(previous_hash, '') || '|' || payload::text, 'sha256'), 'hex');

  INSERT INTO bootstrap_private.bootstrap_audit_events
    (ceremony_id, organization_id, identity_a, identity_b, custodian_a, custodian_b,
     previous_hash, event_hash, payload)
  VALUES
    (p_ceremony_id, v_organization_id, identity_a, identity_b, custodian_a, custodian_b,
     previous_hash, event_hash, payload);

  RETURN jsonb_build_object(
    'status', 'BOOTSTRAPPED',
    'organizationId', v_organization_id,
    'roleId', v_role_id,
    'identityIds', jsonb_build_array(identity_a, identity_b),
    'auditEventHash', event_hash
  );
END;
$$;

REVOKE ALL ON FUNCTION bootstrap_private.assert_custodian_session() FROM PUBLIC;
REVOKE ALL ON FUNCTION bootstrap_private.submit_initial_platform_authority_claim(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION bootstrap_private.finalize_initial_platform_authority_bootstrap(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA bootstrap_private TO rupaykg_bootstrap_custodian;
GRANT EXECUTE ON FUNCTION bootstrap_private.submit_initial_platform_authority_claim(uuid, text) TO rupaykg_bootstrap_custodian;
GRANT EXECUTE ON FUNCTION bootstrap_private.finalize_initial_platform_authority_bootstrap(uuid) TO rupaykg_bootstrap_custodian;

ALTER DEFAULT PRIVILEGES FOR ROLE rupaykg_bootstrap_owner IN SCHEMA bootstrap_private
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE rupaykg_bootstrap_owner IN SCHEMA bootstrap_private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

RESET ROLE;

-- The owner needs CREATE only for schema creation; it retains ownership of its private schema.
DO $revoke_database_create$
BEGIN
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM rupaykg_bootstrap_owner', current_database());
END
$revoke_database_create$;

-- Keep the membership guard's search_path restricted while schema-qualifying its table lookup.
-- The bootstrap SECURITY DEFINER function uses pg_catalog,pg_temp; this trigger must not
-- depend on caller search_path or resolve an attacker-controlled relation.
CREATE OR REPLACE FUNCTION public.enforce_verified_membership_role_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $membership_guard$
BEGIN
  IF NEW.status = 'VERIFIED' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.roles r
       WHERE r.id = NEW.role_id
         AND jsonb_typeof(r.permissions) = 'array'
         AND jsonb_array_length(r.permissions) > 0
    ) THEN
      RAISE EXCEPTION 'verified membership requires an explicit role permission set';
    END IF;
  END IF;
  RETURN NEW;
END;
$membership_guard$;
create or replace function public.ensure_organization_governance_profile()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.organization_type = 'PLATFORM_AUTHORITY' then
    return new;
  end if;
  insert into public.organization_statutory_profiles
    (organization_id, framework, rule_reference, effective_from, applicability_status, basis)
  values
    (new.id, 'SWM_BWG', 'SWM_RULES_2026_S_O_388_E', date '2026-04-01', 'UNKNOWN',
     jsonb_build_object('source', 'RupayKG governance catalogue', 'externalAcceptance', false,
       'thresholds', jsonb_build_object('floorAreaSqM', 20000,
         'waterConsumptionLpd', 40000, 'solidWasteKgpd', 100)))
  on conflict (organization_id, framework, rule_reference, effective_from) do nothing;
  return new;
end;
$$;

create or replace function public.prevent_direct_membership_activation()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  role_name text;
  dual_control_approved boolean := false;
  access_request_type text;
  target_membership_id uuid;
  previous_revoked_at timestamptz;
  bootstrap_ceremony_text text;
  bootstrap_ceremony_id uuid;
begin
  if new.status <> 'VERIFIED' then
    return new;
  end if;

  -- Initial platform authority is the only exception to ordinary application
  -- approval. A caller-controlled GUC is insufficient: the effective function
  -- owner, locked singleton state and two independent custodian claims must agree.
  if TG_OP = 'INSERT' and current_user = 'rupaykg_bootstrap_owner' then
    bootstrap_ceremony_text := current_setting('app.platform_authority_bootstrap_ceremony', true);
    if bootstrap_ceremony_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      bootstrap_ceremony_id := bootstrap_ceremony_text::uuid;
      if exists (
        select 1
          from bootstrap_private.bootstrap_state s
          join bootstrap_private.bootstrap_ceremonies bc on bc.id = s.active_ceremony_id
          join public.roles r on r.id = s.active_role_id
         where s.singleton = true
           and s.status = 'CONSUMING'
           and s.active_ceremony_id = bootstrap_ceremony_id
           and s.active_organization_id = new.organization_id
           and s.active_role_id = new.role_id
           and bc.status = 'CONSUMING'
           and bc.expires_at > now()
           and r.name = 'super_admin'
           and exists (
             select 1 from bootstrap_private.bootstrap_claims c
              where c.ceremony_id = bootstrap_ceremony_id
                and c.identity_id = new.identity_id
                and c.submitted_at is not null
                and c.consumed_at is null
                and c.expires_at > now()
                and c.submitted_by = c.custodian_role_name
           )
           and (
             select count(*) from bootstrap_private.bootstrap_claims c
              where c.ceremony_id = bootstrap_ceremony_id
                and c.submitted_at is not null
                and c.consumed_at is null
                and c.submitted_by = c.custodian_role_name
           ) = 2
           and (
             select count(distinct c.submitted_by) from bootstrap_private.bootstrap_claims c
              where c.ceremony_id = bootstrap_ceremony_id
                and c.submitted_at is not null
                and c.consumed_at is null
                and c.submitted_by = c.custodian_role_name
           ) = 2
      ) then
        return new;
      end if;
    end if;
  end if;

  if TG_OP = 'UPDATE' then
    if old.status = 'VERIFIED' then
      return new;
    end if;
    target_membership_id := old.id;
    previous_revoked_at := old.last_revoked_at;
  end if;

  select r.name into role_name
    from public.roles r
   where r.id = new.role_id and r.organization_id = new.organization_id;

  -- Reserved platform roles retain the original two-person database guard.
  if role_name in ('super_admin','platform_admin') then
    access_request_type := case when TG_OP = 'INSERT' then 'GRANT_RESERVED_ROLE' else 'RESTORE_RESERVED_ROLE' end;

    select exists (
      select 1
        from public.platform_access_change_requests q
        join public.identities requester on requester.id=q.requester_identity_id
        join public.identities approver on approver.id=q.approver_identity_id
       where q.request_type=access_request_type
         and q.target_identity_id=new.identity_id
         and q.organization_id=new.organization_id
         and q.role_id=new.role_id
         and (
           (TG_OP = 'INSERT' and q.membership_id is null)
           or
           (TG_OP = 'UPDATE' and q.membership_id=target_membership_id
             and previous_revoked_at is not null
             and q.created_at > previous_revoked_at)
         )
         and q.status='APPROVED'
         and q.applied_at is not null
         and q.requester_identity_id <> q.approver_identity_id
         and q.requester_identity_id <> q.target_identity_id
         and q.approver_identity_id <> q.target_identity_id
         and requester.status='VERIFIED' and requester.suspended_at is null
         and approver.status='VERIFIED' and approver.suspended_at is null
         and exists (
           select 1 from public.organization_memberships om
           join public.roles r on r.id=om.role_id
           join public.organizations o on o.id=om.organization_id and o.status='VERIFIED'
           where om.identity_id=q.requester_identity_id and om.organization_id=q.organization_id and om.status='VERIFIED'
             and r.name='super_admin'
             and exists (select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')
         )
         and exists (
           select 1 from public.organization_memberships om
           join public.roles r on r.id=om.role_id
           join public.organizations o on o.id=om.organization_id and o.status='VERIFIED'
           where om.identity_id=q.approver_identity_id and om.organization_id=q.organization_id and om.status='VERIFIED'
             and r.name='super_admin'
             and exists (select 1 from jsonb_array_elements_text(r.permissions) as permission(value) where permission.value='admin:users')
         )
    ) into dual_control_approved;

    if not dual_control_approved then
      raise exception 'RESERVED_ROLE_REQUIRES_DUAL_CONTROL';
    end if;
    return new;
  end if;

  -- Ordinary memberships require a completed stakeholder application.
  if not exists (
    select 1 from public.stakeholder_applications sa
     where sa.identity_id=new.identity_id
       and sa.organization_id=new.organization_id
       and sa.role_id=new.role_id
       and sa.status='APPROVED'
  ) then
    raise exception 'STAKEHOLDER_MEMBERSHIP_REQUIRES_APPROVED_APPLICATION';
  end if;
  return new;
end;
$$;

-- Migration runners must regain their own privileges before recording the ledger row.
RESET ROLE;
