-- Shakti production RLS activation gate.
-- NOT executed by application startup. Apply only after runtime identity,
-- non-BYPASSRLS role, grants and representative negative tests are verified.

alter table public.activities enable row level security;
alter table public.measurements enable row level security;
alter table public.evidence enable row level security;
alter table public.carbon_calculations enable row level security;
alter table public.epr_obligations enable row level security;

drop policy if exists shakti_activities_tenant on public.activities;
create policy shakti_activities_tenant on public.activities
  using (organization_id = app.current_organization_id())
  with check (organization_id = app.current_organization_id());

drop policy if exists shakti_measurements_tenant on public.measurements;
create policy shakti_measurements_tenant on public.measurements
  using (exists (select 1 from public.activities a where a.id = measurements.activity_id and a.organization_id = app.current_organization_id()))
  with check (exists (select 1 from public.activities a where a.id = measurements.activity_id and a.organization_id = app.current_organization_id()));

drop policy if exists shakti_evidence_tenant on public.evidence;
create policy shakti_evidence_tenant on public.evidence
  using (exists (select 1 from public.activities a where a.id = evidence.activity_id and a.organization_id = app.current_organization_id()))
  with check (exists (select 1 from public.activities a where a.id = evidence.activity_id and a.organization_id = app.current_organization_id()));

drop policy if exists shakti_carbon_calculations_tenant on public.carbon_calculations;
create policy shakti_carbon_calculations_tenant on public.carbon_calculations
  using (exists (select 1 from public.activities a where a.id = carbon_calculations.activity_id and a.organization_id = app.current_organization_id()))
  with check (exists (select 1 from public.activities a where a.id = carbon_calculations.activity_id and a.organization_id = app.current_organization_id()));

drop policy if exists shakti_epr_obligations_tenant on public.epr_obligations;
create policy shakti_epr_obligations_tenant on public.epr_obligations
  using (obligated_organization_id = app.current_organization_id())
  with check (obligated_organization_id = app.current_organization_id());

-- Minimum DML privileges for the dedicated runtime role on the protected core.
-- Broader application grants must be reconciled before production cutover.
grant select, insert, update, delete on public.activities, public.measurements, public.evidence, public.carbon_calculations, public.epr_obligations to rupaykg_app_runtime;

-- FORCE ROW LEVEL SECURITY remains a separate deployment gate until runtime
-- ownership/role separation has been independently proven.
