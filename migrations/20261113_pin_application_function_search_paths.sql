-- Pin the lookup path for every application-owned public routine.
-- The public schema is USAGE-only for PUBLIC (no PUBLIC CREATE), and pg_temp
-- is deliberately last so temporary objects cannot shadow application names.
DO $migration$
DECLARE
  routine record;
  qualified_signature text;
BEGIN
  FOR routine IN
    SELECT p.oid, p.prokind, n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.prokind IN ('f','p')
       AND NOT EXISTS (
         SELECT 1
           FROM pg_catalog.pg_depend d
          WHERE d.classid='pg_catalog.pg_proc'::regclass
            AND d.objid=p.oid
            AND d.deptype='e'
       )
     ORDER BY p.proname, p.oid
  LOOP
    qualified_signature := format(
      '%I.%I(%s)',
      routine.nspname,
      routine.proname,
      routine.identity_arguments
    );

    IF routine.prokind='p' THEN
      EXECUTE format(
        'ALTER PROCEDURE %s SET search_path = pg_catalog, public, pg_temp',
        qualified_signature
      );
    ELSE
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp',
        qualified_signature
      );
    END IF;
  END LOOP;
END;
$migration$;
