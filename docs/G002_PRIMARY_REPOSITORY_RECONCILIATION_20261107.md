# G-002 Primary Repository Reconciliation — 2026-11-07

## Authority

- Primary engineering/release repository: `vishaltradewinds/rupaykg`
- Primary branch: `main`
- Reconciliation branch: `cto/g002-authority-reconciliation-20261107`
- Secondary source/evidence repository: `vishaltradewinds/rupaykg-aistudio`
- Secondary G-002 source branch: `shakti/trl9-gap-register-20261107`

## Evidence

The secondary G-002 branch is materially divergent from its own mainline (113 commits ahead, 6 behind). It contains the G-002 authority guards, tenant-context controls, legacy workflow fail-closed boundary, tenant workflow adapters, rehearsal RLS, and runtime isolation tests.

The primary `rupaykg/main` is a newer production-lineage architecture and must not be overwritten by the older aistudio branch.

## Porting rule

G-002 controls are being reimplemented/reconciled against the current primary architecture rather than blindly cherry-picked.

This batch ports the three authority guards as root-level Node ESM scripts:

1. `scripts/g002-migration-authority-guard.mjs`
2. `scripts/g002-runtime-db-role-guard.mjs`
3. `scripts/g002-live-schema-authority-guard.mjs`

They are intentionally fail-closed and observational. They do not mutate production state.

## Current blocking gates

1. Production migration authority remains unresolved until the 92-row live ledger is reconciled against the 91 repository migration SQL files and the actual live schema.
2. Runtime DB identity remains unproven until the deployed application is observed using a dedicated NOBYPASSRLS, non-administrative role.
3. Tenant A/B runtime isolation remains unproven until executed against a rehearsal database using the dedicated runtime identity.
4. No production RLS/role mutation is performed by this reconciliation batch.

## Next controlled batch

Reconcile the primary repository's migration inventory against the live ledger, then port tenant authorization and legacy workflow boundaries using the primary monorepo's actual package/service boundaries. Only after static reconciliation should runtime rehearsal be executed.
