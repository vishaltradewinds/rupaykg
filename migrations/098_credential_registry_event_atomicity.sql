-- Shakti credential/registry lifecycle atomicity.
-- A value-bearing credential lifecycle state is authoritative only when the
-- corresponding registry provenance event exists in the same transaction.
-- This is a deferred database gate so the API may write credential state first
-- and append its event second, but commit cannot succeed without both.

create or replace function enforce_credential_registry_event_atomicity()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  required_event text;
begin
  required_event := case new.status
    when 'ISSUED' then 'ISSUED'
    when 'ACTIVE' then 'ACTIVATED'
    when 'TRANSFERRED' then 'TRANSFERRED'
    when 'RETIRED' then 'RETIRED'
    else null
  end;

  if required_event is not null
     and not exists (
       select 1
         from public.registry_events re
        where re.credential_id = new.id
          and re.event_type = required_event
     ) then
    raise exception 'credential lifecycle state requires matching registry event: %', required_event;
  end if;

  return new;
end;
$$;

drop trigger if exists credential_registry_event_atomicity_guard on public.credentials;
create constraint trigger credential_registry_event_atomicity_guard
after insert or update of status on public.credentials
deferrable initially deferred
for each row execute function enforce_credential_registry_event_atomicity();
