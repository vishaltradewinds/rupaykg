-- Shakti Batch C: connection/pool context reuse and worker boundary rehearsal.
-- VALIDATION ONLY. Never execute against production.
\set ON_ERROR_STOP on

CREATE ROLE rupaykg_ci_pool_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO rupaykg_ci_pool_worker;
GRANT SELECT ON public.organizations, public.activities TO rupaykg_ci_pool_worker;

CREATE OR REPLACE FUNCTION public.shakti_ci_context_org()
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

GRANT EXECUTE ON FUNCTION public.shakti_ci_context_org() TO rupaykg_ci_pool_worker;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities FORCE ROW LEVEL SECURITY;

CREATE POLICY shakti_ci_pool_org ON public.organizations
  FOR ALL USING (id = public.shakti_ci_context_org())
  WITH CHECK (id = public.shakti_ci_context_org());

CREATE POLICY shakti_ci_pool_activity ON public.activities
  FOR ALL USING (organization_id = public.shakti_ci_context_org())
  WITH CHECK (organization_id = public.shakti_ci_context_org());

INSERT INTO public.organizations(id,name,organization_type,verification_status)
VALUES
('00000000-0000-0000-0000-00000000c001','Pool Org A','TEST','PENDING'),
('00000000-0000-0000-0000-00000000c002','Pool Org B','TEST','PENDING');

INSERT INTO public.activities(id,organization_id,activity_type)
VALUES
('00000000-0000-0000-0000-00000000c101','00000000-0000-0000-0000-00000000c001','POOL_A'),
('00000000-0000-0000-0000-00000000c102','00000000-0000-0000-0000-00000000c002','POOL_B');

-- Execute authorization assertions as a non-bypass runtime identity.
SET ROLE rupaykg_ci_pool_worker;

BEGIN;
SET LOCAL app.organization_id='00000000-0000-0000-0000-00000000c001';
DO $a$
BEGIN
  IF public.shakti_ci_context_org() <> '00000000-0000-0000-0000-00000000c001'::uuid THEN
    RAISE EXCEPTION 'SET LOCAL Org A context failed';
  END IF;
  IF (SELECT count(*) FROM public.activities) <> 1 THEN
    RAISE EXCEPTION 'Org A pool-session isolation failed';
  END IF;
END
$a$;
COMMIT;

-- Same database session, new transaction: prior transaction-local context must be gone.
BEGIN;
DO $b$
BEGIN
  IF public.shakti_ci_context_org() IS NOT NULL THEN
    RAISE EXCEPTION 'transaction-local context leaked into reused pool session';
  END IF;
  IF (SELECT count(*) FROM public.activities) <> 0 THEN
    RAISE EXCEPTION 'reused pool session exposed tenant rows without context';
  END IF;
END
$b$;
COMMIT;

-- Second checkout/transaction on the same session can safely establish a different tenant.
BEGIN;
SET LOCAL app.organization_id='00000000-0000-0000-0000-00000000c002';
DO $c$
BEGIN
  IF public.shakti_ci_context_org() <> '00000000-0000-0000-0000-00000000c002'::uuid THEN
    RAISE EXCEPTION 'SET LOCAL Org B context failed';
  END IF;
  IF (SELECT count(*) FROM public.activities) <> 1 THEN
    RAISE EXCEPTION 'Org B pool-session isolation failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.activities WHERE organization_id <> public.shakti_ci_context_org()) THEN
    RAISE EXCEPTION 'Org B cross-tenant row visible';
  END IF;
END
$c$;
COMMIT;

-- Worker/system actor: no tenant context means no tenant rows.
BEGIN;
RESET app.organization_id;
DO $worker$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname='rupaykg_ci_pool_worker'
      AND rolsuper=false
      AND rolbypassrls=false
      AND rolcreaterole=false
      AND rolcreatedb=false
  ) THEN
    RAISE EXCEPTION 'worker role is privileged';
  END IF;
  IF public.shakti_ci_context_org() IS NOT NULL THEN
    RAISE EXCEPTION 'worker unexpectedly inherited tenant context';
  END IF;
  IF (SELECT count(*) FROM public.activities) <> 0 THEN
    RAISE EXCEPTION 'worker accessed tenant rows without explicit context';
  END IF;
END
$worker$;
COMMIT;
RESET ROLE;

-- Cleanup disposable rehearsal.
DROP POLICY IF EXISTS shakti_ci_pool_org ON public.organizations;
DROP POLICY IF EXISTS shakti_ci_pool_activity ON public.activities;
ALTER TABLE public.organizations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
DROP FUNCTION public.shakti_ci_context_org();
REVOKE ALL PRIVILEGES ON public.organizations, public.activities FROM rupaykg_ci_pool_worker;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM rupaykg_ci_pool_worker;
DROP ROLE rupaykg_ci_pool_worker;
