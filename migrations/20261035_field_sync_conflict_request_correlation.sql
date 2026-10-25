-- Preserve request correlation in the database-owned field-sync conflict audit event.
-- The route sets this transaction-local value before updating the conflict row.
-- The existing AFTER UPDATE trigger remains the sole writer of this audit event.

create or replace function audit_field_sync_conflict_resolution()
returns trigger
language plpgsql
as $$
declare
  organization_id uuid;
  event_hash text;
begin
  if new.resolution_status is distinct from old.resolution_status
     and new.resolution_status <> 'OPEN' then
    select fd.organization_id
      into organization_id
      from field_sync_envelopes e
      join field_devices fd on fd.id = e.device_id
     where e.id = new.envelope_id;

    if organization_id is null then
      raise exception 'field-sync conflict must reference an organization-bound envelope';
    end if;

    event_hash := md5(
      'FIELD_SYNC_CONFLICT_RESOLVED:' ||
      new.id::text || ':' ||
      new.resolution_status || ':' ||
      coalesce(new.resolution_reason, '') || ':' ||
      coalesce(new.resolved_by_identity_id::text, '')
    );

    insert into audit_events(
      actor_identity_id,
      organization_id,
      action,
      target_type,
      target_id,
      request_id,
      event_hash,
      payload
    ) values (
      new.resolved_by_identity_id,
      organization_id,
      'FIELD_SYNC_CONFLICT_RESOLVED',
      'field_sync_conflict',
      new.id,
      nullif(current_setting('rupaykg.request_id', true), ''),
      event_hash,
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
