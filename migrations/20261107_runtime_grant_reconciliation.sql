-- Shakti runtime grant reconciliation.
-- Does NOT enable RLS and does NOT create or expose a production credential.
-- Apply only after the runtime role exists and the reviewed application-path inventory is current.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_app_runtime') THEN
    RAISE EXCEPTION 'rupaykg_app_runtime role is required before runtime grant reconciliation';
  END IF;
END $$;

grant usage on schema public to rupaykg_app_runtime;
grant select on table public.activities, public.activity_assignments, public.audit_events, public.bwg_epr_reports, public.bwg_esg_reports, public.bwg_profiles, public.bwg_reporting_periods, public.bwg_waste_reports, public.carbon_calculations, public.carbon_market_mechanisms, public.carbon_projects, public.ccts_methodology_registry, public.chain_of_custody_links, public.cpcb_swm_stakeholder_workspaces, public.cpcb_swm_status_history, public.credentials, public.environmental_attribute_claims, public.epr_credit_allocations, public.epr_credit_transfers, public.epr_credits, public.epr_obligations, public.epr_returns, public.epr_schemes, public.esg_metrics, public.esg_reporting_periods, public.evidence, public.evidence_artifact_reviews, public.evidence_artifact_series, public.evidence_artifact_versions, public.evidence_verification_requirements, public.field_devices, public.field_sync_conflicts, public.field_sync_cursors, public.field_sync_envelopes, public.geography, public.geography_sources, public.identities, public.identity_credentials, public.identity_password_credentials, public.identity_sessions, public.measurements, public.methodology_governance_evidence, public.methodology_versions, public.mrv_observations, public.mrv_provenance_events, public.obligations, public.operation_sync_envelopes, public.organization_bwg_assessments, public.organization_epr_applicability, public.organization_geography_scopes, public.organization_memberships, public.organization_statutory_profiles, public.organization_verification_evidence, public.organizations, public.platform_access_change_requests, public.platform_audit_chain_head, public.registry_events, public.regulatory_requirements, public.regulatory_sources, public.resource_flows, public.roles, public.settlement_events, public.settlements, public.stakeholder_application_approvals, public.stakeholder_applications, public.verifications to rupaykg_app_runtime;
grant insert on table public.activities to rupaykg_app_runtime;
grant insert on table public.audit_events to rupaykg_app_runtime;
grant insert on table public.bwg_epr_reports to rupaykg_app_runtime;
grant insert on table public.bwg_esg_reports to rupaykg_app_runtime;
grant insert on table public.bwg_profiles to rupaykg_app_runtime;
grant insert on table public.bwg_reporting_periods to rupaykg_app_runtime;
grant insert on table public.bwg_waste_reports to rupaykg_app_runtime;
grant insert on table public.carbon_calculations to rupaykg_app_runtime;
grant insert on table public.cpcb_swm_stakeholder_workspaces to rupaykg_app_runtime;
grant update on table public.cpcb_swm_stakeholder_workspaces to rupaykg_app_runtime;
grant insert on table public.cpcb_swm_status_history to rupaykg_app_runtime;
grant insert on table public.credentials to rupaykg_app_runtime;
grant update on table public.credentials to rupaykg_app_runtime;
grant update on table public.epr_obligations to rupaykg_app_runtime;
grant insert on table public.epr_returns to rupaykg_app_runtime;
grant update on table public.epr_returns to rupaykg_app_runtime;
grant insert on table public.esg_metrics to rupaykg_app_runtime;
grant insert on table public.evidence to rupaykg_app_runtime;
grant update on table public.evidence to rupaykg_app_runtime;
grant insert on table public.evidence_artifact_reviews to rupaykg_app_runtime;
grant insert on table public.evidence_artifact_series to rupaykg_app_runtime;
grant insert on table public.evidence_artifact_versions to rupaykg_app_runtime;
grant insert on table public.field_devices to rupaykg_app_runtime;
grant update on table public.field_devices to rupaykg_app_runtime;
grant insert on table public.field_sync_conflicts to rupaykg_app_runtime;
grant update on table public.field_sync_conflicts to rupaykg_app_runtime;
grant insert on table public.field_sync_cursors to rupaykg_app_runtime;
grant update on table public.field_sync_cursors to rupaykg_app_runtime;
grant insert on table public.field_sync_envelopes to rupaykg_app_runtime;
grant update on table public.field_sync_envelopes to rupaykg_app_runtime;
grant update on table public.identities to rupaykg_app_runtime;
grant update on table public.identity_sessions to rupaykg_app_runtime;
grant insert on table public.measurements to rupaykg_app_runtime;
grant insert on table public.mrv_provenance_events to rupaykg_app_runtime;
grant update on table public.mrv_provenance_events to rupaykg_app_runtime;
grant update on table public.obligations to rupaykg_app_runtime;
grant insert on table public.organization_bwg_assessments to rupaykg_app_runtime;
grant insert on table public.organization_epr_applicability to rupaykg_app_runtime;
grant update on table public.organization_epr_applicability to rupaykg_app_runtime;
grant insert on table public.organization_memberships to rupaykg_app_runtime;
grant update on table public.organization_memberships to rupaykg_app_runtime;
grant insert on table public.platform_access_change_requests to rupaykg_app_runtime;
grant update on table public.platform_access_change_requests to rupaykg_app_runtime;
grant update on table public.platform_audit_chain_head to rupaykg_app_runtime;
grant insert on table public.registry_events to rupaykg_app_runtime;
grant insert on table public.resource_flows to rupaykg_app_runtime;
grant update on table public.roles to rupaykg_app_runtime;
grant insert on table public.settlement_events to rupaykg_app_runtime;
grant insert on table public.settlements to rupaykg_app_runtime;
grant update on table public.settlements to rupaykg_app_runtime;
grant insert on table public.verifications to rupaykg_app_runtime;

-- Authentication/onboarding/platform writes observed in the audited application paths.
-- These are explicit DML grants; no DELETE/DDL privilege is granted to the runtime role.
grant insert on table public.identities to rupaykg_app_runtime;
grant insert, update on table public.identity_password_credentials to rupaykg_app_runtime;
grant insert, update on table public.identity_sessions to rupaykg_app_runtime;
grant insert, update on table public.organizations to rupaykg_app_runtime;
grant insert on table public.roles to rupaykg_app_runtime;
grant insert, update on table public.organization_geography_scopes to rupaykg_app_runtime;
grant insert on table public.organization_verification_evidence to rupaykg_app_runtime;
grant insert, update on table public.stakeholder_applications to rupaykg_app_runtime;
grant update on table public.stakeholder_application_approvals to rupaykg_app_runtime;

-- Security-definer tenant/identity context helpers.
grant usage on schema app to rupaykg_app_runtime;
grant execute on function app.current_identity_id() to rupaykg_app_runtime;
grant execute on function app.current_organization_id() to rupaykg_app_runtime;
grant execute on function app.set_request_context(uuid,uuid) to rupaykg_app_runtime;
grant execute on function app.set_identity_context(uuid) to rupaykg_app_runtime;
grant execute on function app.set_platform_context(uuid) to rupaykg_app_runtime;
grant execute on function app.set_authority_context(uuid,text,uuid) to rupaykg_app_runtime;

-- No blanket grant on schema_migrations or unrelated database objects.
