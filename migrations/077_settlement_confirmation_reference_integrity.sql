-- Settlement confirmation reference is authoritative external evidence.
-- It must be persisted atomically with confirmation and remain immutable once assigned.

alter table settlements
  add column if not exists confirmation_reference text;

create unique index if not exists settlements_confirmation_reference_uq
  on settlements(confirmation_reference)
  where confirmation_reference is not null and btrim(confirmation_reference) <> '';

create or replace function prevent_settlement_confirmation_reference_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.confirmation_reference is not null
     and new.confirmation_reference is distinct from old.confirmation_reference then
    raise exception 'settlement confirmation reference cannot be changed after assignment';
  end if;
  if new.status = 'SETTLED' then
    if new.confirmation_reference is null or btrim(new.confirmation_reference) = '' then
      raise exception 'settled transaction requires external confirmation reference';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists settlement_confirmation_reference_guard on settlements;
create trigger settlement_confirmation_reference_guard
before insert or update on settlements
for each row execute function prevent_settlement_confirmation_reference_mutation();
