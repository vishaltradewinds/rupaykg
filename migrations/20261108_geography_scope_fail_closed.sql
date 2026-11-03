-- Fail closed when an organization has no verified geography assignment.
-- Bound hierarchy traversal and stop on repeated nodes to prevent malformed
-- cyclic reference data from causing unbounded recursion.
CREATE OR REPLACE FUNCTION public.organization_has_geography_scope(
  p_organization_id uuid,
  p_geography_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH RECURSIVE ancestors(id, path, depth) AS (
    SELECT g.id, ARRAY[g.id]::uuid[], 0
      FROM public.geography g
     WHERE g.id = p_geography_id
    UNION ALL
    SELECT g.parent_id, a.path || g.parent_id, a.depth + 1
      FROM public.geography g
      JOIN ancestors a ON a.id = g.id
     WHERE g.parent_id IS NOT NULL
       AND a.depth < 63
       AND NOT (g.parent_id = ANY(a.path))
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_geography_scopes s
      JOIN ancestors a ON a.id = s.geography_id
     WHERE s.organization_id = p_organization_id
       AND s.status = 'VERIFIED'
  );
$function$;
