# Shakti Tenant-Isolation Residual Audit — 2026-11-07 (Re-audit)

## Scope
Repository: vishaltradewinds/rupaykg  
Controlled ref: cto/20261107-protected-migration-ci  
Latest controlled head at this checkpoint: 925b61c317e677d67a91a3b79c6048f7af141aab

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

### 1. Statutory routes — REMEDIATED ON CONTROLLED BRANCH
File: `apps/src/statutory-routes.ts`

Tenant-sensitive applicability, BWG and EPR operations now use a tenant transaction helper backed by `withTenantTransaction`; the evidence-binding helper also uses tenant context. Body-supplied organization IDs are rejected when they differ from the active organization.

Validation still required:
- compile/typecheck;
- disposable runtime execution under the non-BYPASSRLS role;
- behavioral negative cross-tenant acceptance tests.

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


## 2026-11-08 registry boundary re-audit

Registry mutation routes are classified as mixed tenant and multi-party authority surfaces. Credential issuance/activation/retirement are anchored to the authoritative issuer/current owner transaction context. Credential transfer and settlement lifecycle operations are multi-party: the transaction context is anchored to the current owner/payer while explicit authorization remains required for each participating organization. Request-body organization IDs do not replace the authoritative active tenant context.

A disposable CI contract is now embedded in the controlled workflow to assert registry mutation transaction binding and bilateral settlement authorization. Registry RLS remains HOLD until the master policy matrix is reconciled and non-BYPASSRLS negative counterparty tests pass.


## 2026-11-08 RLS policy matrix reconciliation

The controlled branch now contains `docs/engineering/SHAKTI_RLS_POLICY_MATRIX_20261108.md`.

The matrix classifies the reviewed application tables into tenant, tenant-derived, identity, platform/authority, global/reference, and multi-party registry/settlement scopes. It confirms that only the five deterministic core tables currently have an explicit RLS activation-gate migration:

- `activities`
- `measurements`
- `evidence`
- `carbon_calculations`
- `epr_obligations`

The matrix deliberately keeps identity, platform, regulatory-reference, and multi-party surfaces out of ordinary tenant RLS until their distinct authority semantics are validated.

This is a controlled policy baseline, not runtime evidence. Production Neon, production RLS activation, production DDL/DML/role/grant changes, and FORCE RLS remain HOLD.

### Next execution gate

1. Controlled CI execution against the latest branch head.
2. Disposable non-BYPASSRLS positive/negative core-RLS acceptance.
3. Disposable negative counterparty acceptance for registry/settlement.
4. Runtime-grant reconciliation against the policy matrix.
5. Only after those pass, prepare a production RLS deployment gate.

TRL 9 remains NOT CLAIMED.


## 2026-11-08 auth/onboarding identity-boundary hardening

The authenticated onboarding application route is now explicitly bound to `withIdentityTransaction(pool, auth.identityId, ...)`. Geography validation, duplicate-application checks, organization creation, role creation, pending membership, geography scope, verification evidence, and stakeholder-application creation execute within the same identity transaction boundary.

A disposable static contract was added at `scripts/test-shakti-onboarding-identity-boundary-contract.mjs` and wired into the controlled CI workflow. It asserts that the onboarding application route uses the identity transaction helper, keeps identity-scoped checks and onboarding writes inside that boundary, and does not fall back to direct `pool.query` / `pool.connect` within that route.

This contract has been added to CI but has not yet executed because GitHub Actions reports zero workflow runs for the controlled head. Therefore this change is implementation evidence only, not CI-pass evidence.

Latest controlled head after this hardening: 367f8e2691acfab5819605fde26f95e979f546d8.

Production Neon, production RLS activation, production DDL/DML/role/grant changes, and TRL 9 remain HOLD / NOT CLAIMED.
