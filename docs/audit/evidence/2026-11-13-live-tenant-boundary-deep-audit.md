# Live tenant-boundary deep audit — 13 Nov 2026

## Scope and method

Read-only catalogue and privilege inspection of authoritative Neon project steep-mud-79906940, branch br-restless-base-b44cip2h, database rupaykg. No schema, role, credential, or data writes were made. This point-in-time audit does not establish that the Render production service uses the inspected login.

## Findings

### RLS coverage

The live database contains 67 public base tables:
- 17 have RLS enabled.
- 50 have RLS disabled.
- 0 have FORCE ROW LEVEL SECURITY enabled.
- All 17 RLS-enabled tables are therefore not forced.

The 17 RLS-enabled tables are:
activities, audit_events, carbon_calculations, chain_of_custody_links, credentials, evidence, evidence_verification_requirements, field_devices, measurements, mrv_observations, obligations, organization_memberships, organizations, resource_flows, roles, settlements, verifications.

The 50 tables without RLS are:
activity_assignments, bwg_epr_reports, bwg_esg_reports, bwg_profiles, bwg_reporting_periods, bwg_waste_reports, carbon_market_mechanisms, carbon_projects, ccts_methodology_registry, cpcb_swm_stakeholder_workspaces, cpcb_swm_status_history, environmental_attribute_claims, epr_credit_allocations, epr_credit_transfers, epr_credits, epr_obligations, epr_returns, epr_schemes, esg_metrics, esg_reporting_periods, evidence_artifact_reviews, evidence_artifact_series, evidence_artifact_versions, field_sync_conflicts, field_sync_cursors, field_sync_envelopes, geography, geography_sources, identities, identity_credentials, identity_password_credentials, identity_sessions, methodology_governance_evidence, methodology_versions, mrv_provenance_events, operation_sync_envelopes, organization_bwg_assessments, organization_epr_applicability, organization_geography_scopes, organization_statutory_profiles, organization_verification_evidence, platform_access_change_requests, platform_audit_chain_head, registry_events, regulatory_requirements, regulatory_sources, schema_migrations, settlement_events, stakeholder_application_approvals, stakeholder_applications.

### Runtime roles and SECURITY DEFINER boundary

Observed roles:
- rupaykg: LOGIN, non-superuser, BYPASSRLS.
- rupaykg_app_runtime: NOLOGIN, non-superuser, non-BYPASSRLS.
- rupaykg_runtime_login: LOGIN, non-superuser, non-BYPASSRLS.
- rupaykg_ddl: NOLOGIN, non-superuser, non-BYPASSRLS.

Membership:
- rupaykg_runtime_login is a member of rupaykg_app_runtime with INHERIT and SET enabled.
- rupaykg is a member of rupaykg_app_runtime with ADMIN OPTION, but INHERIT and SET disabled.

Schema CREATE privilege:
- The runtime role and runtime login have no CREATE privilege on app or public.

Function catalogue (live):
- app.authenticate_bearer_session(text), app.is_verified_org_member(uuid), and app.set_request_context(uuid,uuid) are SECURITY DEFINER, owned by rupaykg (a BYPASSRLS role), with fixed search_path=pg_catalog, public, app.
- app.current_identity_id() and app.current_organization_id() are not SECURITY DEFINER, have no function-level search_path setting, and are executable by PUBLIC.
- The old two-argument app.set_request_context(uuid,uuid) exists in the inspected live database.
- The private app.request_context_grants table does not exist in this live database, so migration 103's session-bound grant design is not active here.

### Security interpretation

1. Production/live schema has not received candidate migration 103. Do not infer the opaque context-token control is active.
2. PUBLIC EXECUTE on the two context-reader functions is a least-privilege defect. They currently expose session GUC-derived context values and should be narrowed in a controlled migration after call-site verification.
3. The current SECURITY DEFINER owner is a BYPASSRLS role. This is a high-impact trust boundary: each such function needs narrow purpose, fixed search_path, audited SQL, explicit ACLs, and a controlled owner strategy. Do not change function ownership or role attributes in production as an ad hoc fix.
4. The 17 RLS tables are not FORCE RLS. Table owners may bypass policies; runtime login behavior must be tested using the exact Render connection identity.
5. Fifty unprotected tables need ownership classification before policy design. Do not blanket-enable RLS on reference, authentication, audit-chain, and cross-organization workflow tables without explicit access semantics.

## Classification work queue for the 50 currently unprotected tables

- Identity/authentication: identities, identity_credentials, identity_password_credentials, identity_sessions. Requires identity-self access, auth-service-only access, and secret-handling boundaries; never a generic organization policy.
- Stakeholder and access governance: activity_assignments, platform_access_change_requests, stakeholder_applications, stakeholder_application_approvals. Requires actor/requester/reviewer and organization/geography-scoped approval rules.
- BWG/ESG/CPCB reporting: bwg_epr_reports, bwg_esg_reports, bwg_profiles, bwg_reporting_periods, bwg_waste_reports, cpcb_swm_stakeholder_workspaces, cpcb_swm_status_history, esg_metrics, esg_reporting_periods. Requires organization ownership and parent-period/workspace joins; regulator-facing status must remain source-backed.
- EPR and environmental claims: environmental_attribute_claims, epr_credit_allocations, epr_credit_transfers, epr_credits, epr_obligations, epr_returns, epr_schemes. Requires issuer, obligated party, transfer counterparty, and allocation parent semantics; credits/transfers are not necessarily single-tenant.
- Evidence and provenance: evidence_artifact_reviews, evidence_artifact_series, evidence_artifact_versions, mrv_provenance_events, registry_events, settlement_events. Requires ownership through evidence/activity/credential/settlement and independent verifier/auditor access.
- Field operations: field_sync_conflicts, field_sync_cursors, field_sync_envelopes, operation_sync_envelopes. Requires device and identity binding, idempotency, and service-mediated processing.
- Organization profiles and geography scopes: organization_bwg_assessments, organization_epr_applicability, organization_geography_scopes, organization_statutory_profiles, organization_verification_evidence, carbon_projects. Requires organization ownership plus delegated verifier/regulator access.
- Reference/standards data: carbon_market_mechanisms, ccts_methodology_registry, epr_schemes, geography, geography_sources, methodology_governance_evidence, methodology_versions, regulatory_requirements, regulatory_sources. Determine whether these are immutable globally readable reference data or governed administrative data; avoid tenant isolation where global reference semantics are intended, but restrict mutation.
- Platform control/metadata: platform_audit_chain_head, schema_migrations. Restrict to privileged migration/audit services; never expose as ordinary tenant DML.

This classification is a first-pass design queue derived from live column metadata, not an approved final policy specification. Each table still requires FK/trigger/RPC/call-site review and SELECT/INSERT/UPDATE/DELETE negative tests.

## Release decision

HOLD. No production migrations, RLS activation, role changes, credential changes, or deployment performed. Candidate PR #355 remains the controlled change path. Production activation requires:
- migration 103 and corrected verifier fully tested on disposable PostgreSQL;
- effective function ACL/owner/search_path and role-membership acceptance;
- confirmed Render DB login identity without disclosing secrets;
- table-by-table policy matrix and full negative acceptance suite;
- rollback/restore plan and explicit production change approval.

## Next actions

1. Correct and execute the SECURITY DEFINER verifier in disposable PostgreSQL; verify ACL handling uses aclexplode for the PUBLIC pseudo-grantee (OID 0).
2. Audit migration 103 owner privileges, session expiry/revocation behavior, concurrent membership revocation, and context-token entropy/lifetime.
3. Add per-table ownership/relationship classification and tests for the remaining 50 tables.
4. Keep field readiness and Urban/Rural Golden Transaction acceptance separate from synthetic CI fixtures. SITE-JBP-01 remains pre-validation pending official records and field evidence.
