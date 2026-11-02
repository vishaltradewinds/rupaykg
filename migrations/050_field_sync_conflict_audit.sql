-- Field-sync conflict resolution changes authoritative PostgreSQL state.
-- Persist an audit event at the database boundary so direct SQL/API mutation
-- cannot silently bypass the audit trail maintained by the application route.

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
      event_hash,
      payload
    ) values (
      new.resolved_by_identity_id,
      organization_id,
      'FIELD_SYNC_CONFLICT_RESOLVED',
      'field_sync_conflict',
      new.id,
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

drop trigger if exists field_sync_conflict_resolution_audit on field_sync_conflicts;

create trigger field_sync_conflict_resolution_audit
after update of resolution_status, resolution_reason, resolved_by_identity_id, resolved_at
on field_sync_conflicts
for each row
execute function audit_field_sync_conflict_resolution();
