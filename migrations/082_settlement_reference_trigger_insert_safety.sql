-- Repair insert-time trigger safety without rewriting already-applied migration history.
-- Existing settlement reference migrations are immutable; this migration only replaces their trigger functions.

create or replace function prevent_settlement_confirmation_reference_mutation()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE'
     and old.confirmation_reference is not null
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

create or replace function prevent_settlement_authorization_reference_mutation()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE'
     and old.authorization_reference is not null
     and new.authorization_reference is distinct from old.authorization_reference then
    raise exception 'settlement authorization reference cannot be changed after assignment';
  end if;

  if TG_OP = 'UPDATE'
     and old.verified_at is not null
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
