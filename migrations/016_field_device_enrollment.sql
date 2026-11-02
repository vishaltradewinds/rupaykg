-- Field-device enrollment and verification.
-- A device is never self-authorized: creation is PENDING and only an explicitly
-- permitted organization actor can bind/verify it for field synchronization.

create or replace function can_manage_field_device(p_identity_id uuid, p_organization_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from organization_memberships om
    join roles r on r.id = om.role_id
    where om.identity_id = p_identity_id
      and om.organization_id = p_organization_id
      and om.status = 'VERIFIED'
      and (
        lower(r.name) in ('admin','administrator','org_admin','organization_admin','field_manager','operations_manager')
        or r.permissions @> '["MANAGE_FIELD_DEVICES"]'::jsonb
        or r.permissions @> '["field_device:manage"]'::jsonb
        or r.permissions @> '["field_device.manage"]'::jsonb
      )
  );
$$;

create or replace function prevent_field_device_identity_mutation()
returns trigger language plpgsql as $$
begin
  if old.status = 'VERIFIED' then
    if new.identity_id is distinct from old.identity_id
       or new.organization_id is distinct from old.organization_id
       or new.device_id is distinct from old.device_id then
      raise exception 'verified field device identity and organization binding cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists field_device_identity_mutation_guard on field_devices;
create trigger field_device_identity_mutation_guard
before update on field_devices
for each row execute function prevent_field_device_identity_mutation();

create index if not exists field_devices_org_status_idx on field_devices(organization_id, status);
create index if not exists field_devices_identity_idx on field_devices(identity_id);
