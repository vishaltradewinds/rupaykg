-- Settlement confirmation is authoritative evidence, not a mutable annotation.
-- Once a settlement has external confirmation/reconciliation data, those values
-- cannot be replaced or cleared.

create or replace function prevent_settlement_confirmation_mutation()
returns trigger language plpgsql as $$
begin
  if old.external_confirmed_at is not null then
    if new.external_confirmed_at is distinct from old.external_confirmed_at
       or new.reconciliation_reference is distinct from old.reconciliation_reference then
      raise exception 'settlement external confirmation and reconciliation evidence cannot be changed after confirmation';
    end if;
  end if;
  if old.reconciliation_reference is not null
     and new.reconciliation_reference is distinct from old.reconciliation_reference then
    raise exception 'settlement reconciliation reference cannot be changed after assignment';
  end if;
  return new;
end;
$$;

drop trigger if exists settlement_confirmation_mutation_guard on settlements;
create trigger settlement_confirmation_mutation_guard
before update on settlements
for each row execute function prevent_settlement_confirmation_mutation;

alter table settlements
  add constraint settlement_reconciliation_requires_confirmation
  check (reconciliation_reference is null or external_confirmed_at is not null);

alter table settlements
  add constraint settlement_confirmation_requires_reference
  check (external_confirmed_at is null or reconciliation_reference is not null);
