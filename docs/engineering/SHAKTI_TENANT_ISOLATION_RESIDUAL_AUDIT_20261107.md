# Shakti Tenant-Isolation Residual Audit — 2026-11-07 (Re-audit)

## Scope
Repository: vishaltradewinds/rupaykg  
Controlled ref: cto/20261107-protected-migration-ci  
Latest controlled head at this checkpoint: 7ddef5142899fc1f3222eaec586b51061d52a65b

This is an engineering re-audit. It does not establish production exploitability, production RLS activation, regulatory acceptance, certification, or TRL 9.

## Re-audit result

The previously identified high-risk surfaces have been remediated on the controlled branch:

- Evidence Vault: tenant-sensitive operations use `withTenantTransaction`.
- MRV/provenance: tenant-sensitive operations use `withTenantTransaction`; route-level session advisory locking was moved to transaction-scoped locking.
- CPCB SWM: tenant-sensitive workspace operations use `withTenantTransaction`.
- Value/BWG/ESG: tenant-sensitive operations use `withTenantTransaction`; broad organization fallback paths were removed.
- Workspace: tenant-sensitive operations use `withTenantTransaction`; arbitrary-membership fallback was removed.
- Sync/field routes: tenant-sensitive operations use `withTenantTransaction`.
- Onboarding hierarchy: platform and authority workflows use explicit `withPlatformTransaction` / `withAuthorityTransaction` boundaries.
- Platform admin: platform operations use explicit platform transaction context.
- EPR returns: the current controlled branch now binds list/create/submit/external-reference operations to tenant transaction context.

Static checks on the controlled branch found zero direct `pool.query` / `pool.connect` calls in the remediated Evidence Vault, CPCB SWM, BWG, Sync, Workspace and Intelligence route files. Remaining `pool.query` calls in MRV/Value are helper functions that accept the transaction client and require continued review rather than being treated as automatic violations.

## Remaining priority surfaces

### 1. Statutory routes — NOT YET REMEDIATED
File: `apps/src/statutory-routes.ts`

Tenant-sensitive applicability, BWG and EPR operations still contain direct pool access and require active-organization transaction binding.

Required next action:
- convert all organization-scoped reads/writes and evidence-binding checks to `withTenantTransaction`;
- reject body-supplied organization IDs that differ from the active organization;
- retain explicit statutory boundary labels.

### 2. Auth/onboarding routes — SPECIAL BOUNDARY REVIEW REQUIRED
File: `apps/src/auth-routes.ts`

Authentication/session operations are intentionally pre-tenant in some paths, but authenticated onboarding application reads/writes still need classification and explicit platform/tenant boundaries.

Required next action:
- separate identity/session operations from tenant-scoped onboarding operations;
- bind tenant-scoped application access to active organization context;
- keep registration/login/session issuance outside ordinary tenant RLS where appropriate.

### 3. Registry routes — SPECIAL BOUNDARY REVIEW REQUIRED
File: `apps/src/registry-routes.ts`

A manual transaction helper remains. Registry operations need classification as tenant, platform, or multi-party registry authority before any RLS activation proposal.

### 4. RLS policy matrix reconciliation
Every changed table must be reconciled against the authoritative policy matrix before production RLS activation.

## Current release gate

- Production Neon: READ-ONLY / HOLD.
- Production RLS activation: HOLD.
- Production DDL/DML/role/grant changes: HOLD.
- Controlled CI execution: NOT VERIFIED for the latest head.
- TRL 9: NOT CLAIMED.

## Next execution order

1. Finish statutory-route tenant boundary remediation.
2. Re-audit auth/onboarding and registry boundary classification.
3. Reconcile affected tables against the RLS policy matrix.
4. Execute disposable CI and runtime tenant-isolation acceptance.
5. Only after those gates pass, prepare the next production-readiness gate.
