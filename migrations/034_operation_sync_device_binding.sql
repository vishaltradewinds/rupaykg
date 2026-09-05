-- Bind the legacy operation-sync intake path to the same verified field-device
-- identity boundary enforced by the current field-sync path. The API accepts an
-- authenticated identity plus device_id, so the database must reject forged or
-- cross-identity device claims even if a future caller bypasses route checks.

create or replace function enforce_operation_sync_device_binding()
returns trigger
language plpgsql
as $$
declare
  device_identity uuid;
  device_status record_status;
begin
  if new.device_id is null or btrim(new.device_id) = '' then
    raise exception 'Operation sync device_id is required'
      using errcode = '23514';
  end if;

  select fd.identity_id, fd.status
    into device_identity, device_status
    from field_devices fd
   where fd.device_id = new.device_id
   for update;

  if device_identity is null then
    raise exception 'Operation sync device is not enrolled'
      using errcode = '23514';
  end if;

  if new.actor_identity_id is null or new.actor_identity_id <> device_identity then
    raise exception 'Operation sync identity does not match enrolled device'
      using errcode = '23514';
  end if;

  if device_status <> 'VERIFIED' then
    raise exception 'Operation sync device is not verified'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists operation_sync_device_binding_guard on operation_sync_envelopes;
create trigger operation_sync_device_binding_guard
before insert on operation_sync_envelopes
for each row
execute function enforce_operation_sync_device_binding();
