-- Disposable PostgreSQL proof for the verification guard-role pattern.
-- This is a focused privilege/RLS mechanics test, not a production migration.
-- Run only against the ephemeral GitHub Actions PostgreSQL service.
\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS verification_guard_role_proof CASCADE;
DROP ROLE IF EXISTS rupaykg_guard_proof_api;
DROP ROLE IF EXISTS rupaykg_guard_proof_owner;

CREATE ROLE rupaykg_guard_proof_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE rupaykg_guard_proof_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE SCHEMA verification_guard_role_proof;
CREATE TABLE verification_guard_role_proof.evidence (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  activity_id uuid NOT NULL
);
CREATE TABLE verification_guard_role_proof.activities (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  geography_id uuid NOT NULL
);
CREATE TABLE verification_guard_role_proof.memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  role_id uuid NOT NULL,
  status text NOT NULL
);
CREATE TABLE verification_guard_role_proof.roles (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  permissions jsonb NOT NULL
);
CREATE TABLE verification_guard_role_proof.identities (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  suspended boolean NOT NULL DEFAULT false
);
CREATE TABLE verification_guard_role_proof.verifications (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  verifier_identity_id uuid NOT NULL,
  authorization_membership_id uuid,
  authorization_role_id uuid,
  authorization_permissions_snapshot jsonb,
  authorization_checked_at timestamptz
);

ALTER TABLE verification_guard_role_proof.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_guard_role_proof.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_guard_role_proof.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_guard_role_proof.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_guard_role_proof.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY guard_evidence_scope ON verification_guard_role_proof.evidence
  FOR SELECT TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY guard_activity_scope ON verification_guard_role_proof.activities
  FOR SELECT TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY guard_membership_scope ON verification_guard_role_proof.memberships
  FOR SELECT TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY guard_role_scope ON verification_guard_role_proof.roles
  FOR SELECT TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY guard_evidence_lock_scope ON verification_guard_role_proof.evidence
  FOR UPDATE TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY guard_activity_lock_scope ON verification_guard_role_proof.activities
  FOR UPDATE TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY guard_membership_lock_scope ON verification_guard_role_proof.memberships
  FOR UPDATE TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY guard_role_lock_scope ON verification_guard_role_proof.roles
  FOR UPDATE TO rupaykg_guard_proof_owner
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
CREATE POLICY api_verification_insert_scope ON verification_guard_role_proof.verifications
  FOR INSERT TO rupaykg_guard_proof_api
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

INSERT INTO verification_guard_role_proof.identities VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','VERIFIED',false);
INSERT INTO verification_guard_role_proof.roles VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','["VERIFY_EVIDENCE"]');
INSERT INTO verification_guard_role_proof.memberships VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','VERIFIED');
INSERT INTO verification_guard_role_proof.activities VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
INSERT INTO verification_guard_role_proof.evidence VALUES
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd');

-- The NOLOGIN/NOBYPASSRLS function owner gets SELECT plus column-scoped
-- UPDATE(id), which PostgreSQL requires for SELECT ... FOR SHARE.
-- It is not granted broad table UPDATE and cannot be assumed by the API role.
GRANT USAGE ON SCHEMA verification_guard_role_proof TO rupaykg_guard_proof_owner;
GRANT SELECT ON verification_guard_role_proof.evidence,
                verification_guard_role_proof.activities,
                verification_guard_role_proof.memberships,
                verification_guard_role_proof.roles,
                verification_guard_role_proof.identities
  TO rupaykg_guard_proof_owner;
GRANT UPDATE (id) ON verification_guard_role_proof.evidence,
                    verification_guard_role_proof.activities,
                    verification_guard_role_proof.memberships,
                    verification_guard_role_proof.roles,
                    verification_guard_role_proof.identities
  TO rupaykg_guard_proof_owner;
GRANT USAGE ON SCHEMA verification_guard_role_proof TO rupaykg_guard_proof_api;
GRANT INSERT ON verification_guard_role_proof.verifications TO rupaykg_guard_proof_api;

CREATE FUNCTION verification_guard_role_proof.enforce_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, verification_guard_role_proof
AS $function$
DECLARE
  resolved_org uuid;
  resolved_activity uuid;
  resolved_geography uuid;
  selected_membership uuid;
  selected_role uuid;
  selected_permissions jsonb;
BEGIN
  SELECT e.activity_id, a.organization_id, a.geography_id
    INTO resolved_activity, resolved_org, resolved_geography
    FROM verification_guard_role_proof.evidence e
    JOIN verification_guard_role_proof.activities a ON a.id = e.activity_id
   WHERE e.id = NEW.evidence_id
   FOR SHARE OF e, a;

  IF resolved_org IS NULL OR resolved_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'verification evidence/organization binding failed';
  END IF;

  SELECT m.id, r.id, r.permissions
    INTO selected_membership, selected_role, selected_permissions
    FROM verification_guard_role_proof.memberships m
    JOIN verification_guard_role_proof.roles r
      ON r.id = m.role_id AND r.organization_id = m.organization_id
    JOIN verification_guard_role_proof.identities i ON i.id = m.identity_id
   WHERE m.identity_id = NEW.verifier_identity_id
     AND m.organization_id = resolved_org
     AND m.status = 'VERIFIED'
     AND i.status = 'VERIFIED'
     AND i.suspended = false
     AND r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
   ORDER BY m.id
   LIMIT 1
   FOR SHARE OF m, r, i;

  IF selected_membership IS NULL THEN
    RAISE EXCEPTION 'verification requires active explicit verifier permission in the activity organization';
  END IF;

  NEW.authorization_membership_id := selected_membership;
  NEW.authorization_role_id := selected_role;
  NEW.authorization_permissions_snapshot := selected_permissions;
  NEW.authorization_checked_at := clock_timestamp();
  RETURN NEW;
END;
$function$;

GRANT CREATE ON SCHEMA verification_guard_role_proof TO rupaykg_guard_proof_owner;
ALTER FUNCTION verification_guard_role_proof.enforce_authorization()
  OWNER TO rupaykg_guard_proof_owner;
REVOKE CREATE ON SCHEMA verification_guard_role_proof FROM rupaykg_guard_proof_owner;
GRANT EXECUTE ON FUNCTION verification_guard_role_proof.enforce_authorization()
  TO rupaykg_guard_proof_api;
CREATE TRIGGER verification_authorization_guard
  BEFORE INSERT ON verification_guard_role_proof.verifications
  FOR EACH ROW EXECUTE FUNCTION verification_guard_role_proof.enforce_authorization();

-- Prove the helper role is non-login, non-owner and non-bypass, and the API
-- role cannot assume it or directly read/modify protected authorization rows.
DO $check$
DECLARE role_state record;
BEGIN
  SELECT rolcanlogin, rolbypassrls, rolsuper INTO role_state
    FROM pg_roles WHERE rolname = 'rupaykg_guard_proof_owner';
  IF role_state.rolcanlogin OR role_state.rolbypassrls OR role_state.rolsuper THEN
    RAISE EXCEPTION 'guard owner must be NOLOGIN/NOBYPASSRLS/NOSUPERUSER';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'verification_guard_role_proof'
       AND c.relkind IN ('r', 'p')
       AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname='rupaykg_guard_proof_owner')
  ) THEN
    RAISE EXCEPTION 'guard owner must not own any protected table';
  END IF;
  IF NOT has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.evidence', 'id', 'UPDATE')
     OR NOT has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.activities', 'id', 'UPDATE')
     OR NOT has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.memberships', 'id', 'UPDATE')
     OR NOT has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.roles', 'id', 'UPDATE')
     OR NOT has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.identities', 'id', 'UPDATE') THEN
    RAISE EXCEPTION 'guard owner is missing a required row-lock column privilege';
  END IF;
  IF has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.evidence', 'organization_id', 'UPDATE')
     OR has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.activities', 'organization_id', 'UPDATE')
     OR has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.memberships', 'organization_id', 'UPDATE')
     OR has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.roles', 'permissions', 'UPDATE')
     OR has_column_privilege('rupaykg_guard_proof_owner', 'verification_guard_role_proof.identities', 'suspended', 'UPDATE') THEN
    RAISE EXCEPTION 'guard owner unexpectedly has UPDATE on protected data columns';
  END IF;
END;
$check$;

SET ROLE rupaykg_guard_proof_api;
SELECT set_config('app.organization_id','11111111-1111-4111-8111-111111111111',false);
INSERT INTO verification_guard_role_proof.verifications
  (id,organization_id,evidence_id,verifier_identity_id)
VALUES
  ('99999999-9999-4999-8999-999999999999',
   '11111111-1111-4111-8111-111111111111',
   'ffffffff-ffff-4fff-8fff-ffffffffffff',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
RESET ROLE;

DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM verification_guard_role_proof.verifications
     WHERE id='99999999-9999-4999-8999-999999999999'
       AND authorization_membership_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
       AND authorization_role_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
       AND authorization_permissions_snapshot @> '["VERIFY_EVIDENCE"]'::jsonb
       AND authorization_checked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'security-definer trigger did not capture authorization provenance';
  END IF;
END;
$assert$;

-- The helper has the narrow row-lock UPDATE column grant; API has no UPDATE,
-- no direct SELECT, and no membership allowing it to assume the helper owner.
SET ROLE rupaykg_guard_proof_api;
DO $denials$
BEGIN
  IF has_table_privilege(current_user, 'verification_guard_role_proof.evidence', 'SELECT')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.activities', 'SELECT')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.memberships', 'SELECT')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.roles', 'SELECT')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.identities', 'SELECT') THEN
    RAISE EXCEPTION 'API role unexpectedly has direct SELECT on protected authorization rows';
  END IF;
  IF has_table_privilege(current_user, 'verification_guard_role_proof.evidence', 'UPDATE')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.activities', 'UPDATE')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.memberships', 'UPDATE')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.roles', 'UPDATE')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.identities', 'UPDATE')
     OR has_table_privilege(current_user, 'verification_guard_role_proof.verifications', 'UPDATE') THEN
    RAISE EXCEPTION 'API role unexpectedly has direct UPDATE on protected rows';
  END IF;
  IF has_table_privilege(current_user, 'verification_guard_role_proof.verifications', 'DELETE') THEN
    RAISE EXCEPTION 'API role unexpectedly has direct DELETE on verification decisions';
  END IF;
  IF has_column_privilege(current_user, 'verification_guard_role_proof.evidence', 'id', 'UPDATE') THEN
    RAISE EXCEPTION 'API role unexpectedly has the helper row-lock column privilege';
  END IF;
  IF pg_has_role(current_user, 'rupaykg_guard_proof_owner', 'MEMBER') THEN
    RAISE EXCEPTION 'API role unexpectedly can assume guard owner';
  END IF;
END;
$denials$;
RESET ROLE;

-- This harness deliberately does not claim the production RLS policies,
-- tenant-context provenance, trigger DELETE/TRUNCATE policy, or full schema
-- are validated. Those require exact application policy and role evidence.
DROP SCHEMA verification_guard_role_proof CASCADE;
DROP ROLE rupaykg_guard_proof_api;
DROP ROLE rupaykg_guard_proof_owner;
