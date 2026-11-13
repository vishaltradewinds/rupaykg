# CTO Tenant Boundary and Context Authenticity Audit — 2026-11-13

Repository: `vishaltradewinds/rupaykg`  
Branch: `cto/20261113-holistic-release-convergence`  
Production Neon project: `steep-mud-79906940`  
Production branch: `br-restless-base-b44cip2h`  
Database: `rupaykg`

## Scope and safety

This audit used PostgreSQL catalog reads and transaction/statement-local custom setting changes through the existing `rupaykg_runtime_login` role. It did not write business rows, apply migrations, alter roles, change credentials, or mutate production schema/data.

## Live production table inventory

Read-only catalog inventory returned:

| Measure | Count |
|---|---:|
| Public ordinary tables | 67 |
| RLS enabled | 17 |
| RLS disabled | 50 |
| FORCE ROW LEVEL SECURITY enabled | 0 |

All 17 currently RLS-enabled tables are owned by `rupaykg_ddl`; none has FORCE RLS enabled in the inspected snapshot.

### Current RLS-enabled tables

`activities`, `audit_events`, `carbon_calculations`, `chain_of_custody_links`, `credentials`, `evidence`, `evidence_verification_requirements`, `field_devices`, `measurements`, `mrv_observations`, `obligations`, `organization_memberships`, `organizations`, `resource_flows`, `roles`, `settlements`, `verifications`.

### RLS-disabled tables — 50

`activity_assignments`, `bwg_epr_reports`, `bwg_esg_reports`, `bwg_profiles`, `bwg_reporting_periods`, `bwg_waste_reports`, `carbon_market_mechanisms`, `carbon_projects`, `ccts_methodology_registry`, `cpcb_swm_stakeholder_workspaces`, `cpcb_swm_status_history`, `environmental_attribute_claims`, `epr_credit_allocations`, `epr_credit_transfers`, `epr_credits`, `epr_obligations`, `epr_returns`, `epr_schemes`, `esg_metrics`, `esg_reporting_periods`, `evidence_artifact_reviews`, `evidence_artifact_series`, `evidence_artifact_versions`, `field_sync_conflicts`, `field_sync_cursors`, `field_sync_envelopes`, `geography`, `geography_sources`, `identities`, `identity_credentials`, `identity_password_credentials`, `identity_sessions`, `methodology_governance_evidence`, `methodology_versions`, `mrv_provenance_events`, `operation_sync_envelopes`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_statutory_profiles`, `organization_verification_evidence`, `platform_access_change_requests`, `platform_audit_chain_head`, `registry_events`, `regulatory_requirements`, `regulatory_sources`, `schema_migrations`, `settlement_events`, `stakeholder_application_approvals`, `stakeholder_applications`.

This list is an inventory, not a declaration that every table should receive the same tenant policy. Global reference/catalogue tables, identity/authentication control-plane tables, tenant-owned records, and child records must be classified separately. Child-table policies must follow verified FK ownership paths; multi-party records (EPR transfers, registry events, settlements) require explicit bilateral visibility rules.

## Runtime context authenticity test

The runtime role was separately confirmed in the prior live acceptance evidence to be LOGIN, non-SUPERUSER and non-BYPASSRLS.

Two existing verified identity/organization pairs were read using the administrative audit connection. Then the runtime login executed a single SELECT statement containing transaction-local `set_config` calls and queried the corresponding organization row:

- Connected role: `rupaykg_runtime_login`
- Directly set `app.identity_id` to a valid identity UUID.
- Directly set `app.organization_id` to that identity's verified organization UUID.
- The SELECT returned `visible_organization_rows = 1`.
- No call to `app.set_request_context(uuid,uuid)` was made.

A second read-only test set Identity A with Organization B; it returned `visible_mismatched_org_rows = 0`, showing that the existing `app.is_verified_org_member` policy predicate rejects a mismatched pair.

### Finding

**The request-context setter is not a non-forgeable authentication boundary.** PostgreSQL custom GUCs `app.identity_id` and `app.organization_id` can be set directly by the runtime login. Existing policies verify that the selected identity is a member of the selected organization, but they do not prove that the identity came from the bearer token authenticated by `app.authenticate_bearer_session`.

This does not show that an ordinary HTTP user can directly issue SQL. It does show that a compromised runtime DB session or SQL-injection path can choose a known valid identity/organization pair and satisfy RLS as that member. The database context is membership-consistent but is not cryptographically/session-bound to the authenticated bearer session.

**Release blocker:** design and test an authenticated context hand-off bound to the bearer session, or an equivalent non-forgeable DB context mechanism, before claiming tenant isolation is robust against a compromised runtime SQL path. Do not treat membership validation alone as proof of context authenticity.

## Migration 101 policy correction

Review found that migration 101's newly named permissive policies were weaker than the existing policy foundation in migration 099: several new policies checked only the organization GUC and omitted `app.is_verified_org_member(...)`. Because PostgreSQL permissive policies are OR-combined, these new policies could weaken the existing guard.

The convergence branch has now been corrected so migration 101's new policies retain the verified-membership predicate for direct organization, activity-derived, credential, custody and settlement scopes.

The rollback-only negative-test harness has also been extended to reject an organization-only GUC context with no identity. This test is intended to prevent the policy regression above. It does **not** solve the separate valid-identity/valid-organization GUC spoof finding.

## Tenant boundary classification plan

Before adding policies for the 50 remaining tables, classify each as:

1. **Tenant-direct:** owns an organization key (e.g. BWG profiles/reporting periods, carbon projects, CPCB workspaces, EPR returns, ESG reporting periods, organization assessments/applicability/profiles/evidence).
2. **Tenant-child:** inherits scope through a verified parent FK (e.g. report rows through reporting periods, evidence artifacts through evidence/series, field-sync rows through verified devices/envelopes, provenance through activities, registry events through credentials, settlement events through settlements, stakeholder approvals through applications).
3. **Multi-party:** explicitly model both participating organizations and the permitted view/action semantics (e.g. EPR credits/transfers/allocations, registry events, settlements).
4. **Identity/control plane:** identity credentials, password credentials, sessions, access-change requests; use identity ownership and narrowly scoped auth/admin functions rather than organization-only predicates.
5. **Global reference/configuration:** geography/source catalogue, regulatory sources/requirements, methodology registry/catalogues, carbon/EPR scheme reference data, schema migration state; define read-only/public or privileged administration rules and do not invent tenant ownership.
6. **Platform integrity:** global audit-chain head and shared integrity metadata; expose only via narrowly scoped privileged functions.

This is a candidate classification based on production catalog columns and foreign keys, not a final approved policy map. Each table still needs code-path, FK, permission, write-path and negative-test review.

## Status

- Production inventory: READ-ONLY PASS (67 tables; 17 RLS; 50 no RLS; 0 FORCE RLS).
- Runtime role posture: PARTIAL PASS (non-BYPASSRLS login exists).
- Context authenticity: **OPEN / RELEASE BLOCKER** (valid identity/org GUC pair can be set directly).
- Migration 101 policy guard regression: corrected on the convergence branch; CI pending.
- Full 67-table tenant coverage: OPEN.
- Production migrations 101/102: NOT APPLIED.
- Production release: HOLD.


## Production operational-data readiness snapshot

Additional read-only queries against the same production branch found:

| Operational record | Rows |
|---|---:|
| Organizations | 2 |
| Activities | 0 |
| Resource flows | 0 |
| Measurements | 0 |
| Evidence | 0 |
| Verifications | 0 |
| Field devices | 0 |
| MRV provenance events | 0 |
| Credentials | 0 |
| Registry events | 0 |
| Settlements | 0 |

Both production organizations are `test_fixture` type and VERIFIED. The only geography row is `CLUSTER / RUPAYKG-ACCEPTANCE-V1`, sourced from `RupayKG Acceptance Fixture Geography` version `v1`. There are no source-versioned ULB, Ward, Block, Gram Panchayat or Village rows in the inspected production geography table.

**Urban/Rural conclusion:** production currently has no persisted real operational activity, measurement, evidence, verification, field-device or downstream MRV/registry/settlement records to support either real Golden Transaction. The existing acceptance seed and CI fixtures are synthetic, and are correctly excluded from real-site acceptance. The platform cannot honestly mark Urban or Rural Golden Transactions accepted until real authorized organizations, source-backed geographies, field/device measurement and evidence are supplied and recorded.
