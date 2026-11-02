-- Fail closed when an organization has no verified geography assignment.
-- The previous compatibility behavior treated missing scope roots as unrestricted.
-- Existing organizations must receive an explicitly verified geography assignment
-- through the governed onboarding process before geography-bound writes are enabled.
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
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_geography_scopes s
      JOIN ancestors a ON a.id = s.geography_id
     WHERE s.organization_id = p_organization_id
       AND s.status = 'VERIFIED'
  );
$function$;
