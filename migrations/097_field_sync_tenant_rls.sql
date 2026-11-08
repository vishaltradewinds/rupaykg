-- Shakti tenant boundary for field-sync evidence.
-- The runtime must not be able to read, mutate, or create sync evidence outside
-- the authenticated identity's verified device/organization scope.

alter table public.field_sync_envelopes enable row level security;
alter table public.field_sync_conflicts enable row level security;
alter table public.field_sync_cursors enable row level security;

create policy shakti_field_sync_envelopes_select
on public.field_sync_envelopes
for select
using (
  identity_id = app.current_identity_id()
  and exists (
    select 1 from public.field_devices fd
    where fd.id = field_sync_envelopes.device_id
      and fd.organization_id = app.current_organization_id()
      and fd.identity_id = app.current_identity_id()
  )
);

create policy shakti_field_sync_envelopes_insert
on public.field_sync_envelopes
for insert
with check (
  identity_id = app.current_identity_id()
  and exists (
    select 1 from public.field_devices fd
    where fd.id = field_sync_envelopes.device_id
      and fd.organization_id = app.current_organization_id()
      and fd.identity_id = app.current_identity_id()
      and fd.status = 'VERIFIED'
  )
);

create policy shakti_field_sync_envelopes_update
on public.field_sync_envelopes
for update
using (
  identity_id = app.current_identity_id()
  and exists (
    select 1 from public.field_devices fd
    where fd.id = field_sync_envelopes.device_id
      and fd.organization_id = app.current_organization_id()
      and fd.identity_id = app.current_identity_id()
  )
)
with check (
  identity_id = app.current_identity_id()
  and exists (
    select 1 from public.field_devices fd
    where fd.id = field_sync_envelopes.device_id
      and fd.organization_id = app.current_organization_id()
      and fd.identity_id = app.current_identity_id()
  )
);

create policy shakti_field_sync_conflicts_select
on public.field_sync_conflicts
for select
using (
  exists (
    select 1
      from public.field_sync_envelopes e
      join public.field_devices fd on fd.id = e.device_id
     where e.id = field_sync_conflicts.envelope_id
       and e.identity_id = app.current_identity_id()
       and fd.organization_id = app.current_organization_id()
  )
);

create policy shakti_field_sync_conflicts_update
on public.field_sync_conflicts
for update
using (
  exists (
    select 1
      from public.field_sync_envelopes e
      join public.field_devices fd on fd.id = e.device_id
     where e.id = field_sync_conflicts.envelope_id
       and e.identity_id = app.current_identity_id()
       and fd.organization_id = app.current_organization_id()
       and field_sync_conflicts.resolution_status = 'OPEN'
       and field_sync_conflicts.resolved_by_identity_id is null
  )
)
with check (
  resolved_by_identity_id = app.current_identity_id()
);

create policy shakti_field_sync_cursors_select
on public.field_sync_cursors
for select
using (
  exists (
    select 1 from public.field_devices fd
    where fd.id = field_sync_cursors.device_id
      and fd.organization_id = app.current_organization_id()
      and fd.identity_id = app.current_identity_id()
  )
);

create policy shakti_field_sync_cursors_update
on public.field_sync_cursors
for update
using (
  exists (
    select 1 from public.field_devices fd
    where fd.id = field_sync_cursors.device_id
      and fd.organization_id = app.current_organization_id()
      and fd.identity_id = app.current_identity_id()
  )
)
with check (
  exists (
    select 1 from public.field_devices fd
    where fd.id = field_sync_cursors.device_id
      and fd.organization_id = app.current_organization_id()
      and fd.identity_id = app.current_identity_id()
  )
);

revoke delete on public.field_sync_envelopes, public.field_sync_conflicts, public.field_sync_cursors from rupaykg_app_runtime;
grant select, insert, update on public.field_sync_envelopes to rupaykg_app_runtime;
grant select, update on public.field_sync_conflicts to rupaykg_app_runtime;
grant select, update on public.field_sync_cursors to rupaykg_app_runtime;
