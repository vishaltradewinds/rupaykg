-- Ensure the global audit-chain triggers can maintain the chain head when the
-- application runtime role is granted INSERT on audit_events but no direct
-- UPDATE privilege on platform_audit_chain_head.
-- The migration/schema-owner role must own these trigger functions and tables.
-- Pin the function search_path and remove PUBLIC's ability to shadow objects in
-- public before relying on SECURITY DEFINER execution.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

ALTER FUNCTION public.chain_audit_event_before_insert()
  SECURITY DEFINER
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.chain_audit_event_after_insert()
  SECURITY DEFINER
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.reject_audit_event_mutation()
  SECURITY DEFINER
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.reject_audit_chain_anchor_mutation()
  SECURITY DEFINER
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.reject_audit_chain_head_removal()
  SECURITY DEFINER
  SET search_path = pg_catalog, public;
