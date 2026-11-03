-- Fail closed when an organization has no verified geography assignment.
-- Detect malformed cycles instead of accepting a scope found inside a cycle.
-- Bound hierarchy traversal; an over-depth hierarchy is unresolved and denied.
CREATE OR REPLACE FUNCTION public.organization_has_geography_scope(
  p_organization_id uuid,
  p_geography_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH RECURSIVE ancestors(id, parent_id, path, depth, is_cycle) AS (
    SELECT g.id, g.parent_id, ARRAY[g.id]::uuid[], 0, false
      FROM public.geography g
     WHERE g.id = p_geography_id
    UNION ALL
    SELECT g.id, g.parent_id, a.path || g.id, a.depth + 1,
           g.id = ANY(a.path)
      FROM public.geography g
      JOIN ancestors a ON g.id = a.parent_id
     WHERE NOT a.is_cycle
       AND a.depth < 63
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_geography_scopes s
      JOIN ancestors a ON a.id = s.geography_id
     WHERE s.organization_id = p_organization_id
       AND s.status = 'VERIFIED'
       AND NOT EXISTS (SELECT 1 FROM ancestors c WHERE c.is_cycle)
       AND NOT EXISTS (
         SELECT 1 FROM ancestors d
          WHERE d.depth >= 63 AND d.parent_id IS NOT NULL
       )
  );
$function$;
