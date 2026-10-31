# RupayKg canonical migration reconciliation — 2026-10-31

## Status

**Engineering proposal only. Production remains HOLD. Scheduler remains OFF. Certification remains OFF.**

This document records a live, read-only comparison of Neon database branches and defines a safe reconciliation sequence. No database was altered.

## Evidence captured

Neon project: `rupaykg-production-fresh`  
Project ID: `steep-mud-79906940`  
Database: `rupaykg`

| Evidence | Production/main | Government inbox staging | Migration rehearsal |
|---|---|---|---|
| Neon branch ID | `br-restless-base-b44cip2h` | `br-spring-hill-b4544vz5` | `br-broad-glade-b46npw8o` |
| `schema_migrations` rows | 92 | 95 | 4 relevant rows confirmed |
| Migration `096` | Present | Absent | Absent |
| `20261022`–`20261025` | Absent | All four present | All four present |
| Verification authorization snapshot columns | Present | Absent | Absent |
| `prevent_invalid_verification()` | Strong organization-scoped authorization and snapshot implementation | Weaker legacy implementation | Same weaker legacy implementation |
| `async_mirror_inbox` status constraint | Table not present | Does not allow `UNRESOLVED` | Allows `UNRESOLVED` |

### Production verification controls observed

The production `verifications` table contains `authorization_membership_id`, `authorization_role_id`, `authorization_permissions_snapshot` and `authorization_checked_at`, with foreign keys to `organization_memberships` and `roles`.

The production trigger function binds evidence to its activity and rejects mismatches; requires an organization for APPROVED verification; rejects self-verification; requires a VERIFIED membership and VERIFIED, non-suspended identity in the activity's organization; checks verifier permission against that organization's role; and stores the membership, role, permissions snapshot and authorization-check timestamp.

This is the control baseline. Do not replace it with the weaker function observed in staging/rehearsal.

### Async inbox observations

Staging's `async_mirror_inbox` has payload hash validation, unique authority/batch identity, lifecycle timestamps, lease fields, retry metadata and quarantine metadata. Its status check allows:

`RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED`

The rehearsal branch adds `UNRESOLVED`. Its documented meaning is an internal, non-authoritative state for structurally valid intake that cannot be matched to one unambiguous, current, verified jurisdiction crosswalk. It is not an official acceptance or rejection and must not be represented as an MRV result.

## Reconciliation decision

**Do not choose either staging or rehearsal as the new production baseline. Do not copy either branch wholesale.**

The target must be a forward-only, additive reconciliation that preserves production authorization semantics while introducing reviewed async-ingestion capabilities.

## Required source-of-truth work before SQL is authored

1. Identify and pin exact Git commit SHAs and migration source files for migration 096 and migrations 20261022–20261025.
2. Verify each migration's checksum, ordering, dependencies, idempotency assumptions and whether its effects are already represented in production.
3. Compare migration source against the live catalog, not only the migration ledger.
4. Determine whether rehearsal-only `UNRESOLVED` status and worker behavior are represented by reviewed source code and tests.
5. Build a single canonical ordered migration manifest. Never renumber or rewrite an already-applied migration to conceal branch divergence.
6. Prepare a new forward migration for any missing production capability. Preserve existing production objects and decision history.

## Implementation sequence

### Gate A — source provenance

- Pin repository commit SHAs for all relevant SQL and worker code.
- Produce a checksum manifest for each migration.
- Map every migration to prerequisites and affected objects.
- Resolve duplicate, renamed or missing migration identities without mutating applied history.

### Gate B — disposable PostgreSQL rehearsal

Use a fresh disposable database, not production and not the only copy of staging.

- Reconstruct production baseline through its recorded migration history.
- Apply the proposed forward-only migration set.
- Verify production verification trigger and authorization snapshot semantics remain intact.
- Apply async inbox, lease, rate-limit and AI evidence-intake migrations in canonical order.
- Verify `UNRESOLVED` is internal-only, non-authoritative and cannot trigger a carbon-credit, EPR or official authority decision.
- Test replay behavior, partial failure, recovery and duplicate execution.
- Compare resulting schema, constraints, indexes, triggers, functions and grants against the intended schema manifest.

### Gate C — security and reliability acceptance

Required automated PostgreSQL tests:

- Unverified, suspended or wrong-organization verifier cannot approve.
- A verifier cannot approve their own activity's evidence.
- Evidence/activity mismatch is rejected.
- Historical authorization snapshot remains unchanged after role or membership changes.
- `UNRESOLVED` cannot become accepted, verified, issued or settled without required independent authority workflow.
- Duplicate authority/batch intake is idempotently rejected or deduplicated.
- Expired worker lease recovery is safe.
- Stale fencing token cannot commit after a newer lease is acquired.
- Exhausted retry transitions to quarantine without losing original evidence.
- No failed or unresolved intake creates authoritative MRV, Guardian, registry or credit side effects.
- All intended tests execute; no relevant test is skipped.

### Gate D — release review

- Obtain independent review from an authorized reviewer.
- Require exact-head PR CI and PostgreSQL acceptance evidence.
- Attach migration checksums, schema diff, test logs and recovery evidence.
- Require explicit production change approval and tested backup/restore plan before any production migration.
- Keep scheduler disabled until operational acceptance is complete.

## Explicit non-actions

No production or staging SQL writes, DDL, migration, data copy/deletion, worker activation, deployment, merge or certification were performed.

## TRL and Shakti Standards

This is an engineering evidence task, not a TRL advancement. Database schema inspection and CI do not establish integrated operational readiness or TRL 9. Any TRL claim must be supported by component, subsystem and real operating-environment evidence under Shakti Standards.

## Evidence references

- Release gate and worker CI/review blockers: https://github.com/vishaltradewinds/rupaykg/issues/145
- Production and staging Neon branch IDs are recorded in the evidence table above.
