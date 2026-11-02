-- Registry transfer boundary: credentials may only be transferred to a verified organization.
-- PostgreSQL remains authoritative even if a future integration bypasses the HTTP route.

create or replace function prevent_unverified_registry_transfer_recipient()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'TRANSFERRED' then
    if new.to_owner_id is null then
      raise exception 'Registry transfer requires a destination organization';
    end if;

    if not exists (
      select 1
      from organizations o
      where o.id = new.to_owner_id
        and o.status = 'VERIFIED'
    ) then
      raise exception 'Registry transfer destination must be a verified organization';
    end if;

    if new.from_owner_id is not null and new.from_owner_id = new.to_owner_id then
      raise exception 'Registry transfer destination must differ from current owner';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists registry_transfer_recipient_guard on registry_events;
create trigger registry_transfer_recipient_guard
before insert or update of event_type, from_owner_id, to_owner_id on registry_events
for each row execute function prevent_unverified_registry_transfer_recipient();
