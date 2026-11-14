-- 108: Immutable, tenant-scoped report snapshots.
-- Runtime can read and append report runs, but cannot update or delete them.
create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_by_identity_id uuid not null references public.identities(id),
  report_type text not null check (length(btrim(report_type)) between 1 and 120),
  title text not null check (length(btrim(title)) between 1 and 240),
  period_start date not null,
  period_end date not null,
  geography_mode text not null check (geography_mode in ('URBAN','RURAL','CROSS_CONTEXT')),
  methodology_code text not null,
  methodology_version text not null,
  source_revision text not null,
  generated_at timestamptz not null,
  status text not null check (status in ('BLOCKED','DRAFT','READY_FOR_REVIEW')),
  snapshot_hash char(64) not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  check (period_end >= period_start),
  check (snapshot ->> 'snapshotHash' = snapshot_hash),
  check (snapshot ->> 'organizationId' = organization_id::text),
  check (snapshot ->> 'reportType' = report_type)
);

create index report_runs_org_created_idx
  on public.report_runs(organization_id, created_at desc, id desc);

alter table public.report_runs owner to rupaykg_ddl;
alter table public.report_runs enable row level security;
alter table public.report_runs force row level security;

create policy report_runs_tenant_select
  on public.report_runs for select
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

create policy report_runs_tenant_insert
  on public.report_runs for insert
  to rupaykg_app_runtime
  with check (
    organization_id = app.current_organization_id()
    and created_by_identity_id = app.current_identity_id()
    and app.is_verified_org_member(organization_id)
  );

-- The resource-flow owner may read custody sequence links attached to its
-- own flow. Existing actor-organization policy remains in force for each actor.
drop policy if exists shakti_chain_of_custody_flow_owner_select
  on public.chain_of_custody_links;
create policy shakti_chain_of_custody_flow_owner_select
  on public.chain_of_custody_links for select
  to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.resource_flows rf
       where rf.id = chain_of_custody_links.resource_flow_id
         and rf.organization_id = app.current_organization_id()
         and app.is_verified_org_member(rf.organization_id)
    )
  );

grant select, insert on public.report_runs to rupaykg_app_runtime;
