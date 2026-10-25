-- Prevent caller-supplied audit timestamps from bypassing the verifier's
-- "unlinked events since anchor" anomaly check. Every new audit event receives
-- a database-generated timestamp before its canonical hash is calculated.
-- CREATE OR REPLACE preserves the existing trigger attachment; retain the
-- pinned SECURITY DEFINER boundary and search_path established in migration 20261034.
create or replace function public.chain_audit_event_before_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  chain_previous_hash text;
  canonical_event jsonb;
begin
  select last_event_hash
    into chain_previous_hash
    from public.platform_audit_chain_head
   where singleton = true
   for update;

  if not found then
    raise exception 'PLATFORM_AUDIT_CHAIN_HEAD_MISSING';
  end if;

  new.previous_hash := chain_previous_hash;
  -- Never trust a timestamp supplied by the INSERT caller.
  new.created_at := clock_timestamp();

  canonical_event := jsonb_build_object(
    'id', new.id,
    'actor_identity_id', new.actor_identity_id,
    'organization_id', new.organization_id,
    'action', new.action,
    'target_type', new.target_type,
    'target_id', new.target_id,
    'request_id', new.request_id,
    'payload', new.payload,
    'created_at', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'previous_hash', new.previous_hash
  );

  new.event_hash := encode(digest(convert_to(canonical_event::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;
