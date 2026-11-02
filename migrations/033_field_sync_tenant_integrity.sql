-- Field-sync tenant integrity hardening.
-- The API authorizes device/identity membership before accepting an envelope, but
-- the authoritative database must also prevent a direct or future code path from
-- binding an envelope to another identity or to an unverified device.

create or replace function enforce_field_sync_envelope_binding()
returns trigger
language plpgsql
as $$
declare
  device_identity uuid;
  device_status record_status;
begin
  select fd.identity_id, fd.status
    into device_identity, device_status
    from field_devices fd
   where fd.id = new.device_id;

  if device_identity is null or new.identity_id is distinct from device_identity then
    raise exception 'field sync envelope identity must match enrolled device identity';
  end if;

  if device_status <> 'VERIFIED' then
    raise exception 'field sync envelope requires a verified field device';
  end if;

  if tg_op = 'UPDATE'
     and old.status in ('APPLIED','REJECTED','CONFLICT')
     and (new.identity_id is distinct from old.identity_id
          or new.captured_at is distinct from old.captured_at
          or new.payload_hash is distinct from old.payload_hash) then
    raise exception 'processed sync envelope provenance is append-only';
  end if;

  return new;
end;
$$;

drop trigger if exists field_sync_envelope_binding_guard on field_sync_envelopes;
create trigger field_sync_envelope_binding_guard
before insert or update on field_sync_envelopes
for each row execute function enforce_field_sync_envelope_binding();
