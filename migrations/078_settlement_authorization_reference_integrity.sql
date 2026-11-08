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
  if TG_OP = 'UPDATE' and old.authorization_reference is not null
     and new.authorization_reference is distinct from old.authorization_reference then
    raise exception 'settlement authorization reference cannot be changed after assignment';
  end if;

  if old.verified_at is not null
     and new.verified_at is distinct from old.verified_at then
    raise exception 'settlement authorization verification timestamp cannot be changed after authorization';
  end if;

  if new.status in ('AUTHORIZED','EXECUTING','RECONCILING','SETTLED') then
    if new.authorization_reference is null or btrim(new.authorization_reference) = '' then
      raise exception 'authorized settlement requires authorization reference';
    end if;
    if new.verified_at is null then
      raise exception 'authorized settlement requires verification timestamp';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_authorization_reference_guard on settlements;
create trigger settlement_authorization_reference_guard
before insert or update on settlements
for each row execute function prevent_settlement_authorization_reference_mutation();
