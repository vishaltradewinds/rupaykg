-- A settlement for a registry credential must involve its current registry owner.
-- This prevents authenticated organizations from creating financially/reconciliation
-- records between unrelated parties against a valid credential.
create or replace function enforce_settlement_registry_owner()
returns trigger
language plpgsql
as $$
declare
  current_owner uuid;
  credential_status lifecycle_status;
begin
  select status
    into credential_status
  from credentials
  where id = new.credential_id;

  if credential_status is null then
    raise exception 'Settlement credential does not exist';
  end if;

  if credential_status not in ('ACTIVE','TRANSFERRED') then
    raise exception 'Settlement requires an active or transferred credential';
  end if;

  select coalesce(to_owner_id, from_owner_id)
    into current_owner
  from registry_events
  where credential_id = new.credential_id
    and event_type in ('ISSUED','TRANSFERRED')
  order by created_at desc, id desc
  limit 1;

  if current_owner is null then
    raise exception 'Settlement requires an authoritative current registry owner';
  end if;

  if new.payer_id is null or new.payee_id is null
     or new.payer_id <> current_owner and new.payee_id <> current_owner then
    raise exception 'Settlement parties must include the current registry owner';
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_registry_owner_guard on settlements;
create trigger settlement_registry_owner_guard
before insert or update of credential_id, payer_id, payee_id on settlements
for each row execute function enforce_settlement_registry_owner();
