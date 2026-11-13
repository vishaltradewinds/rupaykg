-- 101: Shakti tenant-isolation activation for the first protected domain.
-- Forward-only migration. This migration is intentionally limited to tables
-- whose tenant boundary is explicit in the current schema. It does not create
-- credentials or change the production runtime login. Production activation
-- remains gated by the controlled runtime-role/authentication acceptance.

create or replace function app.current_identity_id()
returns uuid
language sql
stable
set search_path = pg_catalog, public, app
as $$
  select nullif(current_setting('app.identity_id', true), '')::uuid
$$;

create or replace function app.current_organization_id()
returns uuid
language sql
stable
set search_path = pg_catalog, public, app
as $$
  select nullif(current_setting('app.organization_id', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rupaykg_app_runtime') then
    raise exception 'RUPAYKG_RUNTIME_ROLE_MISSING: create the controlled non-BYPASSRLS runtime role before activation';
  end if;

  if exists (
    select 1 from pg_roles
    where rolname = 'rupaykg_app_runtime'
      and (rolsuper or rolbypassrls)
  ) then
    raise exception 'RUPAYKG_RUNTIME_ROLE_UNSAFE: runtime role must be non-SUPERUSER and non-BYPASSRLS';
  end if;
end
$$;

-- Tenant-direct tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations',
    'roles',
    'activities',
    'obligations',
    'audit_events',
    'field_devices',
    'resource_flows',
    'organization_memberships'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

drop policy if exists shakti_organizations_tenant_select on public.organizations;
create policy shakti_organizations_tenant_select
  on public.organizations for select
  to rupaykg_app_runtime
  using (id = app.current_organization_id() and app.is_verified_org_member(id));

drop policy if exists shakti_organizations_tenant_write on public.organizations;
create policy shakti_organizations_tenant_write
  on public.organizations for all
  to rupaykg_app_runtime
  using (id = app.current_organization_id())
  with check (id = app.current_organization_id() and app.is_verified_org_member(id));

drop policy if exists shakti_roles_tenant on public.roles;
create policy shakti_roles_tenant
  on public.roles for all
  to rupaykg_app_runtime
  using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

drop policy if exists shakti_activities_tenant on public.activities;
create policy shakti_activities_tenant
  on public.activities for all
  to rupaykg_app_runtime
  using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

drop policy if exists shakti_obligations_tenant on public.obligations;
create policy shakti_obligations_tenant
  on public.obligations for all
  to rupaykg_app_runtime
  using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

drop policy if exists shakti_audit_events_tenant on public.audit_events;
create policy shakti_audit_events_tenant
  on public.audit_events for all
  to rupaykg_app_runtime
  using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

drop policy if exists shakti_field_devices_tenant on public.field_devices;
create policy shakti_field_devices_tenant
  on public.field_devices for all
  to rupaykg_app_runtime
  using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

drop policy if exists shakti_resource_flows_tenant on public.resource_flows;
create policy shakti_resource_flows_tenant
  on public.resource_flows for all
  to rupaykg_app_runtime
  using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

drop policy if exists shakti_organization_memberships_tenant on public.organization_memberships;
create policy shakti_organization_memberships_tenant
  on public.organization_memberships for all
  to rupaykg_app_runtime
  using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

-- Child records derive tenant scope from their owning activity/organization.
do $$
begin
  execute 'alter table public.measurements enable row level security';
  execute 'alter table public.measurements force row level security';
  execute 'alter table public.evidence enable row level security';
  execute 'alter table public.evidence force row level security';
  execute 'alter table public.verifications enable row level security';
  execute 'alter table public.verifications force row level security';
  execute 'alter table public.carbon_calculations enable row level security';
  execute 'alter table public.carbon_calculations force row level security';
  execute 'alter table public.mrv_observations enable row level security';
  execute 'alter table public.mrv_observations force row level security';
  execute 'alter table public.evidence_verification_requirements enable row level security';
  execute 'alter table public.evidence_verification_requirements force row level security';
  execute 'alter table public.credentials enable row level security';
  execute 'alter table public.credentials force row level security';
  execute 'alter table public.chain_of_custody_links enable row level security';
  execute 'alter table public.chain_of_custody_links force row level security';
  execute 'alter table public.settlements enable row level security';
  execute 'alter table public.settlements force row level security';
end
$$;

drop policy if exists shakti_measurements_tenant on public.measurements;
create policy shakti_measurements_tenant
  on public.measurements for all
  to rupaykg_app_runtime
  using (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)));

drop policy if exists shakti_evidence_tenant on public.evidence;
create policy shakti_evidence_tenant
  on public.evidence for all
  to rupaykg_app_runtime
  using (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)));

drop policy if exists shakti_verifications_tenant on public.verifications;
create policy shakti_verifications_tenant
  on public.verifications for all
  to rupaykg_app_runtime
  using (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)));

drop policy if exists shakti_carbon_calculations_tenant on public.carbon_calculations;
create policy shakti_carbon_calculations_tenant
  on public.carbon_calculations for all
  to rupaykg_app_runtime
  using (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)));

drop policy if exists shakti_mrv_observations_tenant on public.mrv_observations;
create policy shakti_mrv_observations_tenant
  on public.mrv_observations for all
  to rupaykg_app_runtime
  using (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)));

drop policy if exists shakti_evidence_requirements_tenant on public.evidence_verification_requirements;
create policy shakti_evidence_requirements_tenant
  on public.evidence_verification_requirements for all
  to rupaykg_app_runtime
  using (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.organization_id = app.current_organization_id() and app.is_verified_org_member(a.organization_id)));

drop policy if exists shakti_credentials_tenant on public.credentials;
create policy shakti_credentials_tenant
  on public.credentials for all
  to rupaykg_app_runtime
  using (issuer_organization_id = app.current_organization_id() and app.is_verified_org_member(issuer_organization_id))
  with check (issuer_organization_id = app.current_organization_id() and app.is_verified_org_member(issuer_organization_id));

drop policy if exists shakti_chain_of_custody_tenant on public.chain_of_custody_links;
create policy shakti_chain_of_custody_tenant
  on public.chain_of_custody_links for all
  to rupaykg_app_runtime
  using (actor_organization_id = app.current_organization_id() and app.is_verified_org_member(actor_organization_id))
  with check (actor_organization_id = app.current_organization_id() and app.is_verified_org_member(actor_organization_id));

drop policy if exists shakti_settlements_tenant on public.settlements;
create policy shakti_settlements_tenant
  on public.settlements for all
  to rupaykg_app_runtime
  using ((payer_id = app.current_organization_id() or payee_id = app.current_organization_id()) and app.is_verified_org_member(app.current_organization_id()))
  with check ((payer_id = app.current_organization_id() or payee_id = app.current_organization_id()) and app.is_verified_org_member(app.current_organization_id()));

-- Explicitly grant only the protected-domain DML surface to the runtime role.
grant select, insert, update, delete on
  public.organizations,
  public.roles,
  public.activities,
  public.obligations,
  public.audit_events,
  public.field_devices,
  public.resource_flows,
  public.organization_memberships,
  public.measurements,
  public.evidence,
  public.verifications,
  public.carbon_calculations,
  public.mrv_observations,
  public.evidence_verification_requirements,
  public.credentials,
  public.chain_of_custody_links,
  public.settlements
to rupaykg_app_runtime;
