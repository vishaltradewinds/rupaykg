-- Shakti credential/registry lifecycle atomicity.
-- A value-bearing credential lifecycle state is authoritative only when the
-- corresponding registry provenance event exists in the same transaction.
-- The deferred gate requires the matching event to be present and to be the
-- latest lifecycle event for the credential at commit.

create or replace function enforce_credential_registry_event_atomicity()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  required_event text;
  latest_event_type text;
begin
  required_event := case new.status
    when 'ISSUED' then 'ISSUED'
    when 'ACTIVE' then 'ACTIVATED'
    when 'TRANSFERRED' then 'TRANSFERRED'
    when 'RETIRED' then 'RETIRED'
    else null
  end;

  if required_event is not null then
    select re.event_type
      into latest_event_type
      from public.registry_events re
     where re.credential_id = new.id
     order by re.created_at desc, re.id desc
     limit 1;

    if latest_event_type is distinct from required_event then
      raise exception 'credential lifecycle state requires matching latest registry event: %', required_event;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists credential_registry_event_atomicity_guard on public.credentials;
create constraint trigger credential_registry_event_atomicity_guard
after insert or update of status on public.credentials
deferrable initially deferred
for each row execute function enforce_credential_registry_event_atomicity();
