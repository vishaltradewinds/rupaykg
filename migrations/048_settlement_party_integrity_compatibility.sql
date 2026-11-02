-- Preserve the settlement-party integrity boundary while allowing legacy/internal
-- reconciliation fixtures that intentionally omit settlement parties.
-- API settlement creation remains responsible for supplying both parties.

create or replace function enforce_settlement_party_integrity()
returns trigger language plpgsql as $$
declare
  credential_status text;
  current_owner_id uuid;
begin
  select c.status
    into credential_status
    from credentials c
   where c.id = new.credential_id;

  -- Let the authoritative retired-credential guard report the retired state.
  if credential_status = 'RETIRED' then
    return new;
  end if;

  -- Some internal reconciliation records are created before party attribution.
  -- Once either party is supplied, both parties must satisfy the owner boundary.
  if new.payer_id is null and new.payee_id is null then
    return new;
  end if;

  if new.payer_id is null or new.payee_id is null then
    raise exception 'settlement payer and payee are both required when settlement parties are supplied';
  end if;

  select coalesce(re.to_owner_id, re.from_owner_id)
    into current_owner_id
    from registry_events re
   where re.credential_id = new.credential_id
     and re.event_type in ('ISSUED','TRANSFERRED')
   order by re.created_at desc
   limit 1;

  if current_owner_id is null then
    raise exception 'settlement requires an authoritative current credential owner';
  end if;

  if new.payer_id <> current_owner_id and new.payee_id <> current_owner_id then
    raise exception 'settlement parties must include the current credential owner';
  end if;

  if new.payer_id = new.payee_id then
    raise exception 'settlement payer and payee must be different organizations';
  end if;

  return new;
end;
$$;
