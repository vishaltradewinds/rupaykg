-- Harden geography helper resolution under restricted SECURITY DEFINER search paths.
-- The helper is called by identity-bound onboarding functions whose search_path is
-- intentionally restricted to pg_catalog,pg_temp. Every public relation must be
-- schema-qualified so the same hierarchy predicate works in both invoker and
-- restricted-definer contexts.

CREATE OR REPLACE FUNCTION public.organization_has_geography_scope(
  p_organization_id uuid,
  p_geography_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH RECURSIVE ancestors(id) AS (
    SELECT g.id
      FROM public.geography g
     WHERE g.id = p_geography_id
    UNION ALL
    SELECT g.parent_id
      FROM public.geography g
      JOIN ancestors a ON a.id = g.id
     WHERE g.parent_id IS NOT NULL
  )
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
        FROM public.organization_geography_scopes s
       WHERE s.organization_id = p_organization_id
         AND s.status = 'VERIFIED'
    ) THEN true
    ELSE EXISTS (
      SELECT 1
        FROM public.organization_geography_scopes s
        JOIN ancestors a ON a.id = s.geography_id
       WHERE s.organization_id = p_organization_id
         AND s.status = 'VERIFIED'
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_activity_geography_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF NEW.geography_id IS NOT NULL
     AND NOT public.organization_has_geography_scope(NEW.organization_id, NEW.geography_id) THEN
    RAISE EXCEPTION 'activity geography is outside organization authorization scope';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_resource_flow_geography_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF NEW.source_geography_id IS NOT NULL
     AND NOT public.organization_has_geography_scope(NEW.organization_id, NEW.source_geography_id) THEN
    RAISE EXCEPTION 'resource-flow source geography is outside organization authorization scope';
  END IF;

  IF NEW.destination_geography_id IS NOT NULL
     AND NOT public.organization_has_geography_scope(NEW.organization_id, NEW.destination_geography_id) THEN
    RAISE EXCEPTION 'resource-flow destination geography is outside organization authorization scope';
  END IF;

  RETURN NEW;
END;
$function$;
