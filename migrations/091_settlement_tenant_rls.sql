-- Shakti settlement tenant-boundary hardening.
-- Settlement is bilateral data: payer and payee may read it, but only the
-- authenticated payer tenant may mutate settlement state. Settlement events
-- are append-only from the application runtime and readable by both parties.
-- This migration is a protected deployment gate; production application is
-- not permitted to activate it implicitly.

alter table public.settlements enable row level security;
alter table public.settlement_events enable row level security;

drop policy if exists shakti_settlements_select_bilateral on public.settlements;
create policy shakti_settlements_select_bilateral on public.settlements
  for select
  using (
    payer_id = app.current_organization_id()
    or payee_id = app.current_organization_id()
  );

drop policy if exists shakti_settlements_insert_payer on public.settlements;
create policy shakti_settlements_insert_payer on public.settlements
  for insert
  with check (payer_id = app.current_organization_id());

drop policy if exists shakti_settlements_update_payer on public.settlements;
create policy shakti_settlements_update_payer on public.settlements
  for update
  using (payer_id = app.current_organization_id())
  with check (payer_id = app.current_organization_id());

drop policy if exists shakti_settlement_events_select_bilateral on public.settlement_events;
create policy shakti_settlement_events_select_bilateral on public.settlement_events
  for select
  using (
    exists (
      select 1
      from public.settlements s
      where s.id = settlement_events.settlement_id
        and (
          s.payer_id = app.current_organization_id()
          or s.payee_id = app.current_organization_id()
        )
    )
  );

drop policy if exists shakti_settlement_events_insert_payer on public.settlement_events;
create policy shakti_settlement_events_insert_payer on public.settlement_events
  for insert
  with check (
    exists (
      select 1
      from public.settlements s
      where s.id = settlement_events.settlement_id
        and s.payer_id = app.current_organization_id()
    )
  );

grant select, insert, update on public.settlements to rupaykg_app_runtime;
grant select, insert on public.settlement_events to rupaykg_app_runtime;

-- No UPDATE or DELETE grant is provided for settlement_events.
-- No DELETE grant is provided for settlements.
