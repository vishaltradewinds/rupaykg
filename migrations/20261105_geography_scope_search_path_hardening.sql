-- Fail-closed hierarchical geography authorization.
-- Cycles, over-depth chains, missing scopes and invalid historical geography rows deny access.
-- valid_from is inclusive; valid_to is exclusive. Activity authorization supplies the
-- activity's occurred_at (falling back to created_at), not the current wall-clock time.

CREATE OR REPLACE FUNCTION public.organization_has_geography_scope_at(
  p_organization_id uuid,
  p_geography_id uuid,
  p_as_of timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH RECURSIVE ancestors(id, parent_id, path, has_cycle, depth, is_valid) AS (
    SELECT g.id,
           g.parent_id,
           ARRAY[g.id]::uuid[],
           false,
           1,
           (g.valid_from IS NULL OR g.valid_from <= p_as_of)
             AND (g.valid_to IS NULL OR g.valid_to > p_as_of)
      FROM public.geography g
     WHERE g.id = p_geography_id
       AND p_as_of IS NOT NULL

    UNION ALL

    SELECT parent.id,
           parent.parent_id,
           array_append(child.path, parent.id),
           parent.id = ANY(child.path),
           child.depth + 1,
           (parent.valid_from IS NULL OR parent.valid_from <= p_as_of)
             AND (parent.valid_to IS NULL OR parent.valid_to > p_as_of)
      FROM ancestors child
      JOIN public.geography parent ON parent.id = child.parent_id
     WHERE NOT child.has_cycle
       AND child.depth < 128
  ),
  chain_health AS (
    SELECT count(*) > 0 AS chain_exists,
           coalesce(bool_and(is_valid), false) AS all_nodes_valid,
           coalesce(bool_or(has_cycle), false) AS has_cycle,
           coalesce(bool_or(depth = 128 AND parent_id IS NOT NULL), false) AS exceeded_depth
      FROM ancestors
  )
  SELECT coalesce(
    health.chain_exists
    AND health.all_nodes_valid
    AND NOT health.has_cycle
    AND NOT health.exceeded_depth
    AND EXISTS (
      SELECT 1
        FROM public.organization_geography_scopes scope
        JOIN ancestors ancestor ON ancestor.id = scope.geography_id
       WHERE scope.organization_id = p_organization_id
         AND scope.status = 'VERIFIED'
    ),
    false
  )
    FROM chain_health health;
$function$;

-- Preserve existing two-argument callers while applying current-time validity
-- semantics to non-historical activity/resource operations.
CREATE OR REPLACE FUNCTION public.organization_has_geography_scope(
  p_organization_id uuid,
  p_geography_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT public.organization_has_geography_scope_at(
    p_organization_id, p_geography_id, statement_timestamp()
  );
$function$;

COMMENT ON FUNCTION public.organization_has_geography_scope_at(uuid, uuid, timestamptz) IS
  'Fail-closed ancestor scope check. Rejects missing scope, invalid effective-date nodes, cycles and chains exceeding 128 levels; valid_to is exclusive.';

CREATE OR REPLACE FUNCTION public.enforce_activity_geography_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF NEW.geography_id IS NOT NULL
     AND NOT public.organization_has_geography_scope_at(
       NEW.organization_id,
       NEW.geography_id,
       coalesce(NEW.occurred_at, NEW.created_at, statement_timestamp())
     ) THEN
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
