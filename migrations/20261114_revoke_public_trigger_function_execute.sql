-- Trigger-returning functions are invoked by PostgreSQL through their
-- attached triggers. Application callers do not need direct EXECUTE on them.
-- Keep callable (non-trigger) functions unchanged until route/function call
-- sites and runtime-role grants have been reviewed per signature.
DO $migration$
DECLARE
  routine record;
  qualified_signature text;
BEGIN
  FOR routine IN
    SELECT p.oid, n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.prokind='f'
       AND p.prorettype='pg_catalog.trigger'::pg_catalog.regtype
       AND NOT EXISTS (
         SELECT 1
           FROM pg_catalog.pg_depend d
          WHERE d.classid='pg_catalog.pg_proc'::regclass
            AND d.objid=p.oid
            AND d.deptype='e'
       )
       AND EXISTS (
         SELECT 1 FROM pg_catalog.pg_trigger t
          WHERE t.tgfoid=p.oid AND NOT t.tgisinternal
       )
     ORDER BY p.proname,p.oid
  LOOP
    qualified_signature := format('%I.%I(%s)',
      routine.nspname,routine.proname,routine.identity_arguments);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',
      qualified_signature);
  END LOOP;
END;
$migration$;
