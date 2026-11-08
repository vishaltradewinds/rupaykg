-- Settlement authorization references identify a single authorization decision.
-- Persisted authorization evidence must not be reused across settlements or rewritten.

create unique index if not exists settlements_authorization_reference_uq
  on settlements(authorization_reference)
  where authorization_reference is not null and btrim(authorization_reference) <> '';

create or replace function prevent_settlement_authorization_reference_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.authorization_reference is not null
     and new.authorization_reference is distinct from old.authorization_reference then
    raise exception 'settlement authorization reference cannot be changed after assignment';
  end if;
  return new;
end;
$$;

drop trigger if exists settlement_authorization_reference_guard on settlements;
create trigger settlement_authorization_reference_guard
before update on settlements
for each row execute function prevent_settlement_authorization_reference_mutation();
