-- Settlement ownership and confirmation integrity.
-- A settlement is payable by the credential's current registry owner.
alter table settlements
  add column if not exists confirmation_reference text;

create unique index if not exists settlements_confirmation_reference_uq
  on settlements(confirmation_reference)
  where confirmation_reference is not null and btrim(confirmation_reference) <> '';

create or replace function enforce_settlement_registry_owner()
returns trigger language plpgsql as $$
declare
  current_owner uuid;
begin
  if new.credential_id is not null and new.payer_id is not null then
    select coalesce(to_owner_id, from_owner_id)
      into current_owner
    from registry_events
    where credential_id = new.credential_id
      and event_type in ('ISSUED','TRANSFERRED')
    order by created_at desc, id desc
    limit 1;

    if current_owner is null then
      raise exception 'settlement requires an authoritative registry owner';
    end if;

    if new.payer_id <> current_owner then
      raise exception 'settlement payer must be the current registry owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_registry_owner_guard on settlements;
create trigger settlements_registry_owner_guard
before insert or update on settlements
for each row execute function enforce_settlement_registry_owner();

create or replace function prevent_transfer_with_open_settlement()
returns trigger language plpgsql as $$
begin
  if new.event_type = 'TRANSFERRED' then
    if exists (
      select 1
      from settlements
      where credential_id = new.credential_id
        and status not in ('SETTLED','CANCELLED')
    ) then
      raise exception 'credential cannot be transferred while a settlement is open';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists registry_transfer_settlement_guard on registry_events;
create trigger registry_transfer_settlement_guard
before insert on registry_events
for each row execute function prevent_transfer_with_open_settlement();

create or replace function persist_settlement_confirmation_reference()
returns trigger language plpgsql as $$
begin
  if new.event_type = 'SETTLED' and new.external_reference is not null and btrim(new.external_reference) <> '' then
    update settlements
      set confirmation_reference = new.external_reference
      where id = new.settlement_id;
  end if;
  return new;
end;
$$;

drop trigger if exists settlement_confirmation_reference_guard on settlement_events;
create trigger settlement_confirmation_reference_guard
after insert on settlement_events
for each row execute function persist_settlement_confirmation_reference();
