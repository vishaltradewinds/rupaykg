# Production Migration Lineage Disposition — 2026-11-05

## Status

**Production release gate: HOLD.**

This document records a read-only reconciliation of the authoritative production migration ledger against the active repository source. It is an evidence/disposition artifact only. It does not authorize migration, DDL/DML, ledger rewriting, deployment, role/grant changes, RLS activation, or certification.

## Authoritative production target

- Neon project: `steep-mud-79906940`
- Branch: `br-restless-base-b44cip2h`
- Database: `rupaykg`
- Reconciliation access: read-only
- Current audit identity: `rupaykg`

## Confirmed production lineage

The production `public.schema_migrations` ledger contains:

| Version | Ledger filename | Applied |
|---|---|---|
| 096 | `096_verification_authorization_provenance.sql` | 2026-10-27T13:46:14.262Z |

The active `main` source tree at `934062ef8af2ca47bbcf5e37c12de12a4f9f743` does not contain this migration source.

The production ledger therefore contains an applied migration version for which no active migration source is present in the current main tree.

## Historical source disposition

Git history establishes that:

1. `migrations/096_verification_authorization_provenance.sql` existed in commit `ca8f4100782e`.
2. Commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` removed that exact file with the message `Remove accidentally placed unreviewed verification migration from main`.
3. The historical SQL was inspected as evidence and is **not** being restored to main by this change.

### Disposition

Migration 096 is classified as:

**PRODUCTION-APPLIED / ACTIVE-SOURCE-MISSING / HISTORICAL-EVIDENCE-ONLY**

It must not be silently replayed, rewritten in the production ledger, or restored into the active migration sequence solely to make source and ledger counts equal.

## Staging-only migrations

Versions beginning `20261022`, `20261023`, `20261024`, and `20261025` are not present in the authoritative production ledger checked during this reconciliation.

They remain separately classified historical/staging items. They are **not production-applicable by inference**.

## Required forward-only reconciliation

Before production release:

1. Preserve migration 096 as immutable historical evidence.
2. Complete independent review of why 096 reached production and why its source was removed.
3. Determine whether any current production schema objects depend on 096 and document that dependency.
4. Do not rewrite `schema_migrations` solely to remove the orphaned record.
5. Do not reintroduce 096 as an active migration without explicit architecture/security review and a new forward-only migration plan.
6. Freeze a reviewed migration-source manifest for the release commit.
7. Run the protected migrator only with a dedicated migrator identity, explicit target database/user expectations, strict TLS/CA validation, manifest validation, and orphan-ledger fail-closed behavior.
8. Obtain independent release/DBA/security approval before any production migration execution.

## Evidence boundary

This artifact records facts actually established by read-only inspection and repository history. It does not claim:

- that migration 096 has been repaired;
- that production migration lineage is currently clean;
- that the Render runtime identity has been proven;
- that production RLS/tenant isolation is active;
- that PR #298 is production-ready;
- that TRL 9 has been achieved.

**Decision: production remains READ-ONLY / HOLD.**
