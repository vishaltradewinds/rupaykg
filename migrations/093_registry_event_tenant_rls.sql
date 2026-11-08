-- Shakti tenant boundary for immutable registry provenance.
-- Historical registry events remain readable only to organizations represented
-- in the event; writes are limited to the organization authorizing the event.

alter table public.registry_events enable row level security;

create policy shakti_registry_events_select_bilateral
on public.registry_events
for select
using (
  from_owner_id = app.current_organization_id()
  or to_owner_id = app.current_organization_id()
);

create policy shakti_registry_events_insert_authorized_owner
on public.registry_events
for insert
with check (
  from_owner_id = app.current_organization_id()
  or to_owner_id = app.current_organization_id()
);

revoke update, delete on public.registry_events from rupaykg_app_runtime;
grant select, insert on public.registry_events to rupaykg_app_runtime;
