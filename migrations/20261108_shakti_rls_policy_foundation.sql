-- Shakti tenant-isolation RLS policy foundation.
--
-- This migration creates fail-closed RLS policies for organization-scoped
-- business state. It intentionally does NOT enable RLS yet.
--
-- Enabling RLS is a deployment gate: the application must first run under
-- rupaykg_app_runtime (NO BYPASSRLS) and every authenticated transaction must
-- establish app.identity_id/app.organization_id through app.set_request_context.
--
-- This separation prevents a false security posture where policies exist but
-- the current owner/BYPASSRLS application role silently bypasses them.

create or replace function app.is_verified_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1
      from organization_memberships om
     where om.identity_id = app.current_identity_id()
       and om.organization_id = target_organization_id
       and om.status = 'VERIFIED'
  )
$$;

revoke all on function app.is_verified_org_member(uuid) from public;
grant execute on function app.is_verified_org_member(uuid) to rupaykg_app_runtime;
grant usage on schema public to rupaykg_app_runtime;

-- RLS is the row-level boundary; the runtime role still needs ordinary table
-- privileges to reach the protected relations. These grants do not bypass RLS.
grant select, insert, update, delete on table
  organizations,
  roles,
  activities,
  obligations,
  credentials,
  settlements,
  audit_events,
  resource_flows,
  field_devices,
  organization_memberships,
  measurements,
  evidence,
  verifications,
  carbon_calculations,
  mrv_observations,
  evidence_verification_requirements,
  chain_of_custody_links
to rupaykg_app_runtime;


-- Direct organization-scoped tables.
-- RLS enablement is a deployment gate; do not enable here until the runtime role/context contract is proven.
-- alter table organizations enable row level security;
-- alter table roles enable row level security;
-- alter table activities enable row level security;
-- alter table obligations enable row level security;
-- alter table credentials enable row level security;
-- alter table settlements enable row level security;
-- alter table audit_events enable row level security;
-- alter table resource_flows enable row level security;
-- alter table field_devices enable row level security;

create policy organizations_tenant_select on organizations
  for select using (id = app.current_organization_id() and app.is_verified_org_member(id));

create policy organizations_tenant_modify on organizations
  for all using (id = app.current_organization_id() and app.is_verified_org_member(id))
  with check (id = app.current_organization_id() and app.is_verified_org_member(id));

create policy roles_tenant_select on roles
  for select using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy roles_tenant_modify on roles
  for all using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy activities_tenant_select on activities
  for select using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy activities_tenant_modify on activities
  for all using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy obligations_tenant_select on obligations
  for select using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy obligations_tenant_modify on obligations
  for all using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy credentials_tenant_select on credentials
  for select using (issuer_organization_id = app.current_organization_id() and app.is_verified_org_member(issuer_organization_id));

create policy credentials_tenant_modify on credentials
  for all using (issuer_organization_id = app.current_organization_id() and app.is_verified_org_member(issuer_organization_id))
  with check (issuer_organization_id = app.current_organization_id() and app.is_verified_org_member(issuer_organization_id));

create policy settlements_tenant_select on settlements
  for select using (
    (payer_id = app.current_organization_id() or payee_id = app.current_organization_id())
    and app.is_verified_org_member(app.current_organization_id())
  );

create policy settlements_tenant_modify on settlements
  for all using (
    (payer_id = app.current_organization_id() or payee_id = app.current_organization_id())
    and app.is_verified_org_member(app.current_organization_id())
  )
  with check (
    (payer_id = app.current_organization_id() or payee_id = app.current_organization_id())
    and app.is_verified_org_member(app.current_organization_id())
  );

create policy audit_events_tenant_select on audit_events
  for select using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy audit_events_tenant_insert on audit_events
  for insert with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy resource_flows_tenant_select on resource_flows
  for select using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy resource_flows_tenant_modify on resource_flows
  for all using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy field_devices_tenant_select on field_devices
  for select using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

create policy field_devices_tenant_modify on field_devices
  for all using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))
  with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id));

-- Memberships are identity-scoped. An authenticated identity can only inspect
-- its own verified membership rows; organization-wide administration remains
-- behind explicit privileged paths.
-- RLS enablement is a deployment gate; do not enable here until the runtime role/context contract is proven.
-- alter table organization_memberships enable row level security;

create policy verifications_tenant_select on verifications
  for select using (
    exists (
      select 1 from activities a
       where a.id = verifications.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy organization_memberships_identity_select on organization_memberships
  for select using (
    identity_id = app.current_identity_id()
    and status = 'VERIFIED'
  );

-- Relationship-owned tables inherit tenant scope from their activity/resource.
-- alter table measurements enable row level security;
-- alter table evidence enable row level security;
-- alter table verifications enable row level security;
-- alter table carbon_calculations enable row level security;
-- alter table mrv_observations enable row level security;
-- alter table evidence_verification_requirements enable row level security;
-- alter table chain_of_custody_links enable row level security;

create policy measurements_tenant_select on measurements
  for select using (
    exists (
      select 1 from activities a
       where a.id = measurements.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy measurements_tenant_modify on measurements
  for all using (
    exists (
      select 1 from activities a
       where a.id = measurements.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    exists (
      select 1 from activities a
       where a.id = measurements.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy evidence_tenant_select on evidence
  for select using (
    exists (
      select 1 from activities a
       where a.id = evidence.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy evidence_tenant_modify on evidence
  for all using (
    exists (
      select 1 from activities a
       where a.id = evidence.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    exists (
      select 1 from activities a
       where a.id = evidence.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy verifications_tenant_select on verifications
  for select using (
    exists (
      select 1 from activities a
       where a.id = verifications.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy carbon_calculations_tenant_select on carbon_calculations
  for select using (
    exists (
      select 1 from activities a
       where a.id = carbon_calculations.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy carbon_calculations_tenant_modify on carbon_calculations
  for all using (
    exists (
      select 1 from activities a
       where a.id = carbon_calculations.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  )
  with check (
    exists (
      select 1 from activities a
       where a.id = carbon_calculations.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy mrv_observations_tenant_select on mrv_observations
  for select using (
    exists (
      select 1 from activities a
       where a.id = mrv_observations.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy evidence_requirements_tenant_select on evidence_verification_requirements
  for select using (
    exists (
      select 1 from activities a
       where a.id = evidence_verification_requirements.activity_id
         and a.organization_id = app.current_organization_id()
         and app.is_verified_org_member(a.organization_id)
    )
  );

create policy custody_tenant_select on chain_of_custody_links
  for select using (
    exists (
      select 1 from resource_flows rf
       where rf.id = chain_of_custody_links.resource_flow_id
         and rf.organization_id = app.current_organization_id()
         and app.is_verified_org_member(rf.organization_id)
    )
  );

comment on schema app is
'Shakti tenant-isolation runtime context. RLS policies are installed by migration; production enablement requires non-BYPASSRLS runtime provisioning and transaction-local context.';
