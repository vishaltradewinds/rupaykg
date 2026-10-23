-- Canonical append path for the post-cutover platform audit chain.
-- Existing rows are an anchor only; this migration does not rewrite history.
-- All migrated writers must call this function in the same transaction as their business mutation.
create or replace function append_platform_audit_event(
  p_actor_identity_id uuid,
  p_organization_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_previous_hash text;
  v_event_id uuid;
  v_created_at timestamptz;
  v_event jsonb;
  v_event_hash text;
begin
  if p_action is null or btrim(p_action) = '' then
    raise exception 'audit action is required';
  end if;
  if p_target_type is null or btrim(p_target_type) = '' then
    raise exception 'audit target type is required';
  end if;

  -- Ensure the singleton exists and serialize every append across all writers.
  insert into platform_audit_chain_head(singleton)
  values (true)
  on conflict (singleton) do nothing;

  select last_event_hash
    into v_previous_hash
    from platform_audit_chain_head
   where singleton = true
   for update;

  if not found then
    raise exception 'PLATFORM_AUDIT_CHAIN_HEAD_MISSING';
  end if;

  -- Timestamp only after obtaining the serialization lock, so it cannot predate
  -- the preceding event merely because this transaction waited for the head row.
  v_created_at := clock_timestamp();

  v_event := jsonb_build_object(
    'actorIdentityId', p_actor_identity_id,
    'organizationId', p_organization_id,
    'action', p_action,
    'targetType', p_target_type,
    'targetId', p_target_id,
    'requestId', p_request_id,
    'payload', coalesce(p_payload, '{}'::jsonb),
    'previousHash', v_previous_hash,
    'createdAt', v_created_at
  );
  v_event_hash := encode(digest(convert_to(v_event::text, 'UTF8'), 'sha256'), 'hex');

  insert into audit_events(
    actor_identity_id, organization_id, action, target_type, target_id,
    request_id, previous_hash, event_hash, payload, created_at
  )
  values (
    p_actor_identity_id, p_organization_id, p_action, p_target_type, p_target_id,
    p_request_id, v_previous_hash, v_event_hash, coalesce(p_payload, '{}'::jsonb), v_created_at
  )
  returning id into v_event_id;

  update platform_audit_chain_head
     set last_event_id = v_event_id,
         last_event_hash = v_event_hash,
         updated_at = v_created_at
   where singleton = true;

  if not found then
    raise exception 'PLATFORM_AUDIT_CHAIN_HEAD_UPDATE_FAILED';
  end if;

  return v_event_id;
end;
$$;

-- Route the database-trigger writer through the same serialized append contract.
create or replace function audit_field_sync_conflict_resolution()
returns trigger
language plpgsql
as $$
declare
  v_organization_id uuid;
begin
  if new.resolution_status is distinct from old.resolution_status
     and new.resolution_status <> 'OPEN' then
    select fd.organization_id
      into v_organization_id
      from field_sync_envelopes e
      join field_devices fd on fd.id = e.device_id
     where e.id = new.envelope_id;

    if v_organization_id is null then
      raise exception 'field-sync conflict must reference an organization-bound envelope';
    end if;

    perform append_platform_audit_event(
      new.resolved_by_identity_id,
      v_organization_id,
      'FIELD_SYNC_CONFLICT_RESOLVED',
      'field_sync_conflict',
      new.id,
      null,
      jsonb_build_object(
        'conflictId', new.id,
        'envelopeId', new.envelope_id,
        'resolutionStatus', new.resolution_status,
        'resolutionReason', new.resolution_reason,
        'resolvedByIdentityId', new.resolved_by_identity_id,
        'resolvedAt', new.resolved_at
      )
    );
  end if;
  return new;
end;
$$;
