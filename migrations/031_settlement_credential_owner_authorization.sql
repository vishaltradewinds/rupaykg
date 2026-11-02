-- A settlement may only name organizations that include the credential's
-- authoritative current owner. The HTTP route separately requires the caller
-- to be a verified member of one of those parties. This database invariant
-- prevents a caller from creating a settlement around an unrelated credential.

create or replace function enforce_settlement_credential_owner_authorization()
returns trigger
language plpgsql
as $$
declare
  current_owner uuid;
begin
  -- Legacy/internal rows may omit parties; the HTTP contract does not.
  if new.payer_id is null and new.payee_id is null then
    return new;
  end if;

  if new.payer_id is null or new.payee_id is null then
    raise exception 'Settlement payer and payee are both required'
      using errcode = '23514';
  end if;

  select coalesce(re.to_owner_id, re.from_owner_id)
    into current_owner
    from registry_events re
   where re.credential_id = new.credential_id
     and re.event_type in ('ISSUED','TRANSFERRED')
   order by re.created_at desc
   limit 1;

  if current_owner is null then
    select c.issuer_organization_id
      into current_owner
      from credentials c
     where c.id = new.credential_id;
  end if;

  if current_owner is null
     or new.payer_id <> current_owner and new.payee_id <> current_owner then
    raise exception 'Settlement party must include the credential current owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists settlements_credential_owner_authorization on settlements;
create trigger settlements_credential_owner_authorization
before insert on settlements
for each row
execute function enforce_settlement_credential_owner_authorization();
