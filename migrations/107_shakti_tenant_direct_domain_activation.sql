-- 107: Shakti tenant-isolation activation for an explicitly verified tenant-direct table.
-- Forward-only. Production activation remains separately gated.
--
-- This batch intentionally advances one table at a time after repository/CI
-- schema reconciliation. Global catalogues, identity secrets, bilateral
-- records, and control-plane tables remain outside this migration.

alter table public.organization_geography_scopes enable row level security;
alter table public.organization_geography_scopes force row level security;

drop policy if exists shakti_organization_geography_scopes_tenant on public.organization_geography_scopes;
create policy shakti_organization_geography_scopes_tenant
  on public.organization_geography_scopes for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

grant select, insert, update, delete
  on public.organization_geography_scopes
  to rupaykg_app_runtime;

comment on table public.organization_geography_scopes is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
