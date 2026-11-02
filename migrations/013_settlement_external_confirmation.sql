-- Settlement truth controls.
-- Internal workflow state must never be sufficient to claim that funds moved.

alter table settlements
  add column if not exists external_confirmed_at timestamptz,
  add column if not exists reconciliation_reference text;

create index if not exists settlements_reconciliation_reference_idx
  on settlements(reconciliation_reference)
  where reconciliation_reference is not null;

create or replace function prevent_unconfirmed_settlement_finalization()
returns trigger language plpgsql as $$
begin
  if new.status = 'SETTLED' then
    if new.external_reference is null or btrim(new.external_reference) = '' then
      raise exception 'settled transaction requires external settlement reference';
    end if;
    if new.external_confirmed_at is null then
      raise exception 'settled transaction requires external authority confirmation';
    end if;
    if new.reconciliation_reference is null or btrim(new.reconciliation_reference) = '' then
      raise exception 'settled transaction requires reconciliation reference';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_external_confirmation_guard on settlements;
create trigger settlements_external_confirmation_guard
before insert or update on settlements
for each row execute function prevent_unconfirmed_settlement_finalization();

create or replace function prevent_confirmation_rollback()
returns trigger language plpgsql as $$
begin
  if old.external_confirmed_at is not null and new.external_confirmed_at is null then
    raise exception 'external settlement confirmation cannot be cleared';
  end if;
  if old.reconciliation_reference is not null and new.reconciliation_reference is null then
    raise exception 'settlement reconciliation reference cannot be cleared';
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_confirmation_rollback_guard on settlements;
create trigger settlements_confirmation_rollback_guard
before update on settlements
for each row execute function prevent_confirmation_rollback();
