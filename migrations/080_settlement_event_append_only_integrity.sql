-- Settlement event trail is append-only evidence.
-- Lifecycle state integrity is incomplete if historical settlement events can be
-- altered or deleted after the fact.

create or replace function prevent_settlement_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'settlement events are immutable and append-only';
end;
$$;

drop trigger if exists settlement_event_immutable_guard on settlement_events;
create trigger settlement_event_immutable_guard
before update or delete on settlement_events
for each row execute function prevent_settlement_event_mutation();

alter table settlement_events
  add constraint settlement_event_hash_nonempty
  check (btrim(event_hash) <> '');
