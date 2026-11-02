-- Settlement party integrity boundary.
-- A settlement must involve the credential's current registry owner.
-- This prevents an API caller with settlement permission from creating a value
-- settlement between unrelated organizations for an otherwise valid credential.

create or replace function enforce_settlement_party_integrity()
returns trigger language plpgsql as $$
declare
  current_owner_id uuid;
begin
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

drop trigger if exists settlements_party_integrity on settlements;
create trigger settlements_party_integrity
before insert or update of credential_id, payer_id, payee_id on settlements
for each row execute function enforce_settlement_party_integrity();
