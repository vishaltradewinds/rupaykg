# RupayKg — G-002 Rehearsal Reconciliation — 2026-11-09

## Rehearsal branches inspected

Two existing Neon rehearsal branches were inspected read-only:

### `rupaykg-role-split-rehearsal-20261106`
- Runtime role exists and is non-BYPASSRLS.
- Tenant isolation foundation is not installed: 0 RLS-enabled tables, 0 public policies.
- Only one of the expected three tenant security functions is present.
- Therefore this branch is not an acceptance-ready G-002 rehearsal.

### `rupaykg-tenant-isolation-lab-20261101`
- 22 tables have RLS enabled and 88 public policies exist.
- `rupaykg_app_runtime` exists and is non-BYPASSRLS.
- Protected tables are still owned by `rupaykg`, which is BYPASSRLS.
- The expected G-002 authentication/context functions are not present.
- This is an earlier/parallel RLS experiment, not a valid proof of the current 097/098/099 foundation.

## Decision
Do not promote either existing branch as the authoritative G-002 rehearsal. They contain materially different security states and cannot be treated as evidence for the current migration chain.

## Safe next step
Create a fresh controlled rehearsal from the canonical production branch and apply the exact canonical 097/098/099 migration sequence there. Because database mutation is a destructive operation even on a rehearsal branch under the execution tooling's safety contract, execution of those migrations requires explicit user authorization at the database-operation boundary.

## Production remains untouched
No production mutation was performed during this reconciliation.
