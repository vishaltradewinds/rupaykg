# Shakti Tenant-Isolation Residual Audit — 2026-11-07

## Scope
Repository: vishaltradewinds/rupaykg
Audit ref: f881599ff4bb4130636cc5e9d1a5566c2d62b15d
Purpose: identify remaining application paths that access tenant-sensitive PostgreSQL data without the new `withTenantTransaction` request-context boundary.

This is an engineering audit only. It does not establish production exploitability, production RLS status, regulatory acceptance, or TRL.

## Confirmed residual paths

### 1. Onboarding hierarchy
File: `apps/src/onboarding-hierarchy-routes.ts`
- `GET /api/v1/onboarding/review-queue` performs direct pool queries against stakeholder applications, organizations, geography, identities and approval-chain data.
- `POST /api/v1/onboarding/applications/:applicationId/verify-legal` uses a manually opened transaction and `set_platform_context`, not tenant context.
- `POST /api/v1/onboarding/applications/:applicationId/:action` uses authority context and direct organization/membership updates.
Assessment: platform/authority workflows require separate policy treatment, but they must remain explicitly bounded and must not be assumed tenant-safe merely because an authenticated identity is present.

### 2. Evidence vault
File: `apps/src/evidence-vault-routes.ts`
- `activityContext()` uses direct pool queries.
- Evidence list/download/permission checks use direct pool queries.
- Review uses a manual transaction without `app.set_request_context`.
Assessment: tenant-sensitive evidence/activity access is a priority Batch E remediation surface before production RLS activation.

### 3. MRV
File: `apps/src/mrv-routes.ts`
- Multiple activity/evidence/measurement/provenance queries use the pool directly.
- Provenance reads/writes and MRV acceptance checks require tenant-bound request context when RLS is active.
Assessment: high-priority because this is core MRV evidence/provenance functionality.

### 4. CPCB SWM
File: `apps/src/cpcb-swm-routes.ts`
- Read/write permission and geography checks use direct pool queries.
- Several mutation paths open manual transactions without the tenant request-context helper.
Assessment: high-priority because this surface feeds statutory reporting workflows.

### 5. Value/workspace
File: `apps/src/value-routes.ts`
- Activity/evidence/ESG/BWG/workspace queries include direct pool access and multi-organization ID arrays.
Assessment: requires reconciliation against the active-organization rule and the 67-table policy matrix; broad organization iteration must not bypass tenant context.

## Control conclusion
The new `withTenantTransaction` boundary is implemented on selected routes, but the repository is not yet demonstrably uniform. The residual paths above are therefore NOT VERIFIED tenant-safe for a future production RLS-enabled runtime.

## Required remediation order
1. Evidence vault: convert tenant-sensitive reads/writes to one active-organization tenant transaction.
2. MRV/provenance: apply the same boundary and add negative cross-tenant acceptance coverage.
3. CPCB SWM: separate platform-authority operations from tenant-scoped stakeholder workspaces and bind the latter to tenant context.
4. Value/workspace: remove broad multi-organization request execution from tenant-sensitive paths and use active-organization context.
5. Re-audit onboarding hierarchy separately under authority/platform context rules.
6. Reconcile each changed table against `docs/RUPAYKG_RLS_TABLE_POLICY_MATRIX_20261107.md` before any production RLS proposal.

## Release impact
- Production RLS activation: HOLD.
- Production migration/DDL/DML: HOLD.
- TRL 9: not claimed.
- This audit is evidence for the next safe engineering batch, not a production certification.
