-- Shakti credential value immutability.
-- Once a credential is value-bearing, its evidence/issuer/value identity cannot
-- be rewritten through the generic runtime UPDATE path. Lifecycle transitions
-- remain governed by the existing registry/permission guards.

create or replace function prevent_credential_authority_field_mutation()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if old.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED')
     or new.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED') then
    if new.activity_id is distinct from old.activity_id
       or new.issuer_organization_id is distinct from old.issuer_organization_id
       or new.trust_root_id is distinct from old.trust_root_id
       or new.verification_id is distinct from old.verification_id
       or new.quantity is distinct from old.quantity
       or new.unit is distinct from old.unit
       or new.credential_uri is distinct from old.credential_uri
       or new.issued_at is distinct from old.issued_at then
      raise exception 'credential authority fields are immutable after value-bearing lifecycle';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists credential_authority_field_immutability_guard on public.credentials;
create trigger credential_authority_field_immutability_guard
before update on public.credentials
for each row execute function prevent_credential_authority_field_mutation();
