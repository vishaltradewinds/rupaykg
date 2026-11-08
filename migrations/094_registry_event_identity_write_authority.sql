-- Shakti registry provenance write authority completion.
-- RLS tenant scope alone is insufficient for append-only provenance: the
-- authenticated identity must also be the identity recorded on the event.

create or replace policy shakti_registry_events_insert_authorized_owner
on public.registry_events
for insert
with check (
  recorded_by_identity_id = app.current_identity_id()
  and (
    from_owner_id = app.current_organization_id()
    or to_owner_id = app.current_organization_id()
  )
);
