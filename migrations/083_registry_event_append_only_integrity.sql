-- Registry provenance evidence integrity.
-- Registry events are historical audit evidence and must be append-only.

create or replace function prevent_registry_event_mutation()
returns trigger
language plpgsql
set search_path = public, app
as 'begin
  raise exception ''registry events are immutable and append-only'';
end;';

drop trigger if exists registry_event_immutable_guard on registry_events;
create trigger registry_event_immutable_guard
before update or delete on registry_events
for each row execute function prevent_registry_event_mutation();

alter table registry_events
  add constraint registry_event_hash_nonempty
  check (btrim(event_hash) <> '');
