-- 107: Shakti tenant-isolation activation for the next explicit tenant-direct domain.
-- Forward-only. Production activation remains separately gated.
--
-- Scope: tables with a first-class organization_id boundary already verified
-- in the 2026-11-13 production catalogue. Global catalogues, identity secrets,
-- bilateral records, and workflow/control-plane tables are intentionally
-- excluded until their operation-specific authorization contracts are tested.

do $$
declare
  t text;
begin
  foreach t in array array[
    'bwg_profiles',
    'bwg_reporting_periods',
    'esg_reporting_periods',
    'cpcb_swm_stakeholder_workspaces',
    'organization_bwg_assessments',
    'organization_epr_applicability',
    'organization_geography_scopes',
    'organization_statutory_profiles',
    'organization_verification_evidence'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

drop policy if exists shakti_bwg_profiles_tenant on public.bwg_profiles;
create policy shakti_bwg_profiles_tenant
  on public.bwg_profiles for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

drop policy if exists shakti_bwg_reporting_periods_tenant on public.bwg_reporting_periods;
create policy shakti_bwg_reporting_periods_tenant
  on public.bwg_reporting_periods for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

drop policy if exists shakti_esg_reporting_periods_tenant on public.esg_reporting_periods;
create policy shakti_esg_reporting_periods_tenant
  on public.esg_reporting_periods for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

drop policy if exists shakti_cpcb_swm_stakeholder_workspaces_tenant on public.cpcb_swm_stakeholder_workspaces;
create policy shakti_cpcb_swm_stakeholder_workspaces_tenant
  on public.cpcb_swm_stakeholder_workspaces for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

drop policy if exists shakti_organization_bwg_assessments_tenant on public.organization_bwg_assessments;
create policy shakti_organization_bwg_assessments_tenant
  on public.organization_bwg_assessments for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

drop policy if exists shakti_organization_epr_applicability_tenant on public.organization_epr_applicability;
create policy shakti_organization_epr_applicability_tenant
  on public.organization_epr_applicability for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

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

drop policy if exists shakti_organization_statutory_profiles_tenant on public.organization_statutory_profiles;
create policy shakti_organization_statutory_profiles_tenant
  on public.organization_statutory_profiles for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

drop policy if exists shakti_organization_verification_evidence_tenant on public.organization_verification_evidence;
create policy shakti_organization_verification_evidence_tenant
  on public.organization_verification_evidence for all
  to rupaykg_app_runtime
  using (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  )
  with check (
    organization_id = app.current_organization_id()
    and app.is_verified_org_member(organization_id)
  );

grant select, insert, update, delete on
  public.bwg_profiles,
  public.bwg_reporting_periods,
  public.esg_reporting_periods,
  public.cpcb_swm_stakeholder_workspaces,
  public.organization_bwg_assessments,
  public.organization_epr_applicability,
  public.organization_geography_scopes,
  public.organization_statutory_profiles,
  public.organization_verification_evidence
to rupaykg_app_runtime;

-- Explicitly record the rollout boundary so later migrations cannot silently
-- broaden this policy set into global, identity, bilateral, or control-plane data.
comment on table public.bwg_profiles is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.bwg_reporting_periods is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.esg_reporting_periods is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.cpcb_swm_stakeholder_workspaces is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.organization_bwg_assessments is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.organization_epr_applicability is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.organization_geography_scopes is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.organization_statutory_profiles is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
comment on table public.organization_verification_evidence is
'Shakti tenant boundary: organization-owned runtime rows require verified membership.';
