# Shakti RLS Policy Matrix Reconciliation — 2026-11-08

## Purpose

Controlled-branch reconciliation artifact for deciding which RupayKg tables may receive Row Level Security (RLS), what authoritative scope must govern access, and which tables must remain outside ordinary tenant RLS.

This is an engineering gate. It does not activate production RLS, alter production Neon, establish certification, or establish TRL 9.

## Governing rules

1. Active organization context is authoritative for ordinary tenant data.
2. A request-body organization ID never establishes tenant authority.
3. Tenant-scoped application access must execute through withTenantTransaction.
4. Identity/onboarding context is distinct from tenant context.
5. Platform and regulatory-authority workflows use explicit platform/authority transaction context.
6. Multi-party registry/settlement operations require authoritative current-owner/payer context plus explicit authorization for every counterparty.
7. Global/reference data must not be accidentally hidden by tenant RLS.
8. Production RLS remains HOLD until disposable non-BYPASSRLS runtime tests pass.
9. FORCE RLS remains a separate gate until runtime ownership/role separation is proven.

## Controlled policy matrix

| Table | Scope | RLS posture | Authoritative scope |
|---|---|---|---|
| activities | TENANT | PROTECTED CORE | organization_id = active organization |
| measurements | TENANT-CHILD | PROTECTED CORE | parent activity organization |
| evidence | TENANT-CHILD | PROTECTED CORE | parent activity organization |
| carbon_calculations | TENANT-CHILD | PROTECTED CORE | parent activity organization |
| epr_obligations | TENANT | PROTECTED CORE | obligated_organization_id = active organization |
| activity_assignments | TENANT-DERIVED | HOLD | owning activity / organization |
| audit_events | PLATFORM/AUDIT | HOLD | authoritative audit context |
| bwg_epr_reports | TENANT | HOLD | organization ownership |
| bwg_esg_reports | TENANT | HOLD | organization ownership |
| bwg_profiles | TENANT | HOLD | organization ownership |
| bwg_reporting_periods | TENANT | HOLD | organization/reporting ownership |
| bwg_waste_reports | TENANT | HOLD | organization ownership |
| carbon_market_mechanisms | GLOBAL/REFERENCE | NO ORDINARY TENANT RLS | global reference |
| carbon_projects | TENANT | HOLD | project organization ownership |
| ccts_methodology_registry | GLOBAL/REGULATORY | NO ORDINARY TENANT RLS | governed registry authority |
| chain_of_custody_links | MULTI-PARTY | HOLD | authoritative party + relationship authorization |
| cpcb_swm_stakeholder_workspaces | TENANT | HOLD | active organization |
| cpcb_swm_status_history | TENANT-DERIVED | HOLD | parent workspace organization |
| credentials | MULTI-PARTY REGISTRY | HOLD | issuer/current owner + lifecycle authorization |
| environmental_attribute_claims | TENANT/MULTI-PARTY | HOLD | claim owner/current authoritative party |
| epr_credit_allocations | TENANT/MULTI-PARTY | HOLD | obligated/allocation party |
| epr_credit_transfers | MULTI-PARTY | HOLD | current owner + counterparty authorization |
| epr_credits | TENANT/MULTI-PARTY | HOLD | current owner / authoritative organization |
| epr_returns | TENANT | HOLD | obligated/reporting organization |
| epr_schemes | GLOBAL/REGULATORY | NO ORDINARY TENANT RLS | governed scheme registry |
| esg_metrics | TENANT | HOLD | organization ownership |
| esg_reporting_periods | TENANT | HOLD | organization ownership |
| evidence_artifact_reviews | TENANT-DERIVED | HOLD | parent evidence/artifact organization |
| evidence_artifact_series | TENANT | HOLD | organization/evidence ownership |
| evidence_artifact_versions | TENANT-DERIVED | HOLD | parent artifact organization |
| evidence_verification_requirements | GLOBAL/REFERENCE | NO ORDINARY TENANT RLS | governed requirement definition |
| field_devices | TENANT | HOLD | registered organization/device ownership |
| field_sync_conflicts | TENANT | HOLD | organization/device ownership |
| field_sync_cursors | TENANT | HOLD | organization/device ownership |
| field_sync_envelopes | TENANT | HOLD | organization/device ownership |
| geography | GLOBAL/REFERENCE | NO ORDINARY TENANT RLS | geographic reference |
| geography_sources | GLOBAL/REFERENCE | NO ORDINARY TENANT RLS | source registry |
| identities | IDENTITY | NO ORDINARY TENANT RLS | identity authority |
| identity_credentials | IDENTITY | NO ORDINARY TENANT RLS | identity owner / credential lifecycle |
| identity_password_credentials | IDENTITY | NO ORDINARY TENANT RLS | identity owner / credential lifecycle |
| identity_sessions | IDENTITY | NO ORDINARY TENANT RLS | identity/session authority |
| methodology_governance_evidence | GLOBAL/REGULATORY | HOLD | methodology authority |
| methodology_versions | GLOBAL/REGULATORY | NO ORDINARY TENANT RLS | governed methodology registry |
| mrv_observations | TENANT | HOLD | active organization / MRV ownership |
| mrv_provenance_events | TENANT-DERIVED/AUDIT | HOLD | originating tenant + provenance authority |
| obligations | TENANT | HOLD | obligated organization |
| operation_sync_envelopes | TENANT | HOLD | organization/device operation scope |
| organization_bwg_assessments | TENANT | HOLD | organization ownership |
| organization_epr_applicability | TENANT | HOLD | organization ownership |
| organization_geography_scopes | TENANT/PLATFORM AUTHORITY | HOLD | organization + authority context |
| organization_memberships | TENANT/PLATFORM AUTHORITY | HOLD | membership organization + platform authority |
| organization_statutory_profiles | TENANT | HOLD | organization ownership |
| organization_verification_evidence | TENANT/PLATFORM AUTHORITY | HOLD | organization + verification authority |
| organizations | TENANT/PLATFORM | HOLD | organization identity / platform authority |
| platform_access_change_requests | PLATFORM | NO ORDINARY TENANT RLS | platform authorization workflow |
| platform_audit_chain_head | PLATFORM/AUDIT | NO ORDINARY TENANT RLS | global authoritative audit chain |
| registry_events | MULTI-PARTY REGISTRY/AUDIT | HOLD | authoritative registry actor/context |
| regulatory_requirements | GLOBAL/REGULATORY | NO ORDINARY TENANT RLS | governed regulatory reference |
| regulatory_sources | GLOBAL/REGULATORY | NO ORDINARY TENANT RLS | governed source registry |
| resource_flows | TENANT/MULTI-PARTY | HOLD | owning organization + transfer authorization |
| roles | PLATFORM/REFERENCE | NO ORDINARY TENANT RLS | governed role catalog |
| settlement_events | MULTI-PARTY/AUDIT | HOLD | settlement authority + lifecycle authorization |
| settlements | MULTI-PARTY | HOLD | payer/current owner + bilateral authorization |
| stakeholder_application_approvals | PLATFORM/AUTHORITY | HOLD | authority workflow |
| stakeholder_applications | IDENTITY/ONBOARDING | HOLD | authenticated identity; governed organization binding |
| verifications | TENANT/AUTHORITY | HOLD | subject organization + verifier authority |

## Immediate controlled RLS set

Only these five tables have an explicit activation-gate migration in the controlled branch:

- activities
- measurements
- evidence
- carbon_calculations
- epr_obligations

The migration is separate from application startup and remains a deployment gate.

## Critical policy decisions

### Tenant core

The deterministic tenant relationship is:

activities.organization_id -> active organization context

Child tables measurements, evidence and carbon_calculations inherit scope through their parent activity.

epr_obligations.obligated_organization_id -> active organization context

A child-row organization field must not become an independent authority source.

### Identity and onboarding

Identity, credential/session and authenticated onboarding workflows are not ordinary tenant tables. They require identity-context controls. The controlled branch now provides set_identity_context(uuid) and withIdentityTransaction() for this boundary.

### Platform and authority

Platform administration, statutory authority, geography-scoped regulatory access, verification and reserved-role workflows require explicit platform/authority context and must not be made accidentally dependent on an ordinary tenant RLS predicate.

### Multi-party registry and settlement

Registry and settlement tables cannot safely be modeled as single-tenant tables without losing counterparty semantics. Their eventual policies must combine authoritative current owner/payer/issuer context, explicit counterparty authorization, lifecycle-state constraints, and append-only/audit constraints where applicable.

A request-body organizationId, payerId or payeeId is never sufficient to establish authority.

## Required validation before production RLS

1. Controlled CI must pass against the latest controlled head.
2. Disposable PostgreSQL acceptance must run under rupaykg_app_runtime with NOBYPASSRLS.
3. Positive same-tenant access must be verified for every protected core table.
4. Negative cross-tenant access must be verified for every protected core table.
5. Child-row leakage through parent relationships must be ruled out.
6. Representative negative counterparty tests must pass for registry/settlement surfaces.
7. Runtime grants must be reconciled with this inventory.
8. Runtime ownership/role separation must be independently proven before FORCE RLS.
9. Only then prepare a production deployment gate.

## Status

**Policy matrix reconciliation: INITIAL CONTROLLED BASELINE COMPLETE.**

This document is a classification and gate artifact, not evidence that RLS is active, that every policy has passed runtime acceptance, or that TRL 9 has been achieved.


## 2026-11-08 disposable runtime contract added

A disposable PostgreSQL contract was added at `scripts/test-shakti-rls-policy-runtime-contract.sql` and wired into controlled CI. It verifies, inside the disposable database, that:

- all five protected core tables have RLS enabled;
- the five expected Shakti tenant policies exist;
- both USING and WITH CHECK policy expressions bind to `app.current_organization_id()`;
- the disposable runtime role is login-capable but neither superuser nor BYPASSRLS;
- the protected policies do not use `current_user` as a substitute for authoritative tenant context.

This remains CI evidence only when the workflow actually executes. The latest controlled branch still has no associated GitHub Actions run, so no runtime pass is claimed.
