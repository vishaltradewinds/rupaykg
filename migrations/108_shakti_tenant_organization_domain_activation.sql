-- 108: Activate tenant isolation for explicitly organization-owned regulatory
-- and reporting domains. This migration intentionally excludes identity/auth
-- bootstrap tables, global reference catalogues, bilateral EPR credits and
-- obligations, and platform control-plane records; those require separate
-- authorization designs rather than a guessed organization predicate.
--
-- Stakeholder applications are tenant-visible to their applicant organization.
-- Cross-organization regulator/platform review is NOT enabled by this migration
-- and must use a separately audited, narrow authorization boundary.

do $preflight$
begin
  if not exists (
    select 1 from pg_roles
     where rolname = 'rupaykg_app_runtime'
       and not rolsuper
       and not rolbypassrls
       and not rolcanlogin
  ) then
    raise exception 'SHAKTI_108_RUNTIME_ROLE_UNSAFE_OR_MISSING';
  end if;
end
$preflight$;

-- Tables with a direct organization_id ownership key.
do $activate$
declare
  t text;
  policy_name text;
begin
  foreach t in array array[
    'bwg_profiles',
    'bwg_reporting_periods',
    'carbon_projects',
    'cpcb_swm_stakeholder_workspaces',
    'cpcb_swm_status_history',
    'epr_returns',
    'esg_reporting_periods',
    'organization_bwg_assessments',
    'organization_epr_applicability',
    'organization_statutory_profiles',
    'organization_verification_evidence',
    'stakeholder_applications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    policy_name := 'shakti_' || t || '_tenant';
    execute format('drop policy if exists %I on public.%I', policy_name, t);
    execute format(
      'create policy %I on public.%I for all to rupaykg_app_runtime using (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id)) with check (organization_id = app.current_organization_id() and app.is_verified_org_member(organization_id))',
      policy_name, t
    );
    execute format('grant select, insert, update on public.%I to rupaykg_app_runtime', t);
  end loop;
end
$activate$;

-- Approval steps inherit the organization boundary from their parent
-- stakeholder application. This is tenant-local only; no global review bypass.
alter table public.stakeholder_application_approvals enable row level security;
alter table public.stakeholder_application_approvals force row level security;

drop policy if exists shakti_stakeholder_application_approvals_tenant
  on public.stakeholder_application_approvals;
create policy shakti_stakeholder_application_approvals_tenant
  on public.stakeholder_application_approvals
  for all to rupaykg_app_runtime
  using (
    exists (
      select 1
        from public.stakeholder_applications application_row
       where application_row.id = stakeholder_application_approvals.application_id
         and application_row.organization_id = app.current_organization_id()
         and app.is_verified_org_member(application_row.organization_id)
    )
  )
  with check (
    exists (
      select 1
        from public.stakeholder_applications application_row
       where application_row.id = stakeholder_application_approvals.application_id
         and application_row.organization_id = app.current_organization_id()
         and app.is_verified_org_member(application_row.organization_id)
    )
  );

grant select, insert, update
  on public.stakeholder_application_approvals
  to rupaykg_app_runtime;

comment on table public.stakeholder_applications is
'Shakti tenant boundary: applicant organization only. Cross-organization reviewer access requires a separately audited platform/regulator authorization path.';
comment on table public.stakeholder_application_approvals is
'Shakti tenant boundary inherited from stakeholder_applications. Cross-organization reviewer access is not granted by this policy.';
