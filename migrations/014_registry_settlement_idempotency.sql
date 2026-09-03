-- Registry/settlement idempotency boundaries.
-- These constraints make repeated value operations converge safely even when clients retry.

create unique index if not exists credentials_activity_verification_unique_idx
  on credentials(activity_id, verification_id)
  where verification_id is not null;

create unique index if not exists settlements_external_reference_unique_idx
  on settlements(external_reference)
  where external_reference is not null and btrim(external_reference) <> '';

create or replace function enforce_settlement_external_reference_immutability()
returns trigger language plpgsql as $$
begin
  if old.external_reference is not null
     and new.external_reference is distinct from old.external_reference then
    raise exception 'external settlement reference cannot be changed after assignment';
  end if;
  if old.external_confirmed_at is not null
     and new.external_confirmed_at is distinct from old.external_confirmed_at then
    raise exception 'external settlement confirmation timestamp cannot be changed after confirmation';
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_external_reference_immutability on settlements;
create trigger settlements_external_reference_immutability
before update on settlements
for each row execute function enforce_settlement_external_reference_immutability();
