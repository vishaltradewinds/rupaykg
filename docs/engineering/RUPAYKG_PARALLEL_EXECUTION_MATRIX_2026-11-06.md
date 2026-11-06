# RupayKg — Parallel Shakti Execution Matrix
Date: 2026-11-06

## Objective
Reach a controlled, evidence-backed tenant-isolation/release gate without mutating production. Engineering completion, operational readiness, statutory acceptance, certification, and TRL 9 remain separate gates.

## Parallel workstreams

| Workstream | Scope | Deliverable | Gate |
|---|---|---|---|
| A — CI recovery | Correct current CI #5710 test failure | Passing full CI on current tenant-isolation head | CI 1–17 PASS |
| B — Authentication bootstrap | Integrate and prove organization-neutral bootstrap | Bootstrap boundary test + auth integration evidence | No tenant projection / no service bypass |
| C — Protected access | Repository-wide semantic audit of DB access | No unsafe shared-pool protected access; every exception documented | Static + semantic audit PASS |
| D — Migration 096 | Reconcile ledger filename to authoritative source/history | Exact source/tree/history evidence | Lineage PASS; otherwise BLOCKED |
| E — Policy matrix | Complete 67-table tenant/bilateral/root classification | Reviewed policy matrix with every table classified | Coverage PASS |
| F — RLS implementation | Implement complete policies only after context gate | Disposable RLS migration + policy tests | Disposable migration PASS |
| G — Recovery | Full disposable migration/backup/restore rehearsal | Reproducible recovery evidence | Recovery PASS |
| H — Runtime identity/least privilege | Verify runtime DB role, grants, BYPASSRLS and service identity boundaries | Read-only evidence + remediation design | Security gate PASS |
| I — Integrated acceptance | Cross-route, multi-org, bilateral, pooled-connection, revoked/suspended tests | Integrated acceptance suite | Independent gate PASS |
| J — Release governance | Reconcile branches/PRs and prepare controlled release proposal | Single integration spine + release packet | Founder approval required |
| K — Field/TRL | Jabalpur SITE-JBP-01 operational evidence, measurement, MRV, field acceptance, assurance | Field/operational evidence pack | TRL 9 only when all required gates are evidenced |

## Execution order
A/B/C/D/E run in parallel. F begins only when B/C/E policy semantics are sufficiently proven. G runs against disposable databases only. H runs read-only until a reviewed remediation plan exists. I consumes the validated context + policy implementation. J remains blocked from merge/deploy until independent gates pass. K remains separate from engineering CI and cannot be inferred from repository tests.

## Non-negotiable safety boundary
- Neon production remains READ-ONLY / HOLD.
- No production RLS enablement.
- No production DDL/DML.
- No role/grant/ownership mutation.
- No deployment, worker activation, merge, certification, or TRL 9 declaration without the required independent gates and explicit founder approval.

## Current evidence update — 2026-11-06
- PR #311 head `f266900065049e7eb1ce34605c0fdcf982ff3def` completed CI run #5736 successfully.
- CI completed all 17 validation steps, including migration validation, migration-manifest validation, protected-migrator configuration contract, API migration execution, typecheck/build, browser smoke, disposable PostgreSQL acceptance, production container build, bounded backup/restore rehearsal, and startup-isolation assertion.
- Authentication bootstrap integration is therefore validated at the repository/CI gate level on this head.
- This does not validate production RLS state, production migration lineage, production deployment, field acceptance, statutory approval, certification, or TRL 9.

## Current blockers
1. RLS is verified disabled on all 67 inspected public tables and PostgreSQL policy count is zero.
2. Migration 096 source/ledger lineage remains unresolved. Exact filename searches across the active migration paths and inspected historical refs did not locate `096_verification_authorization_provenance.sql`; no replacement source is being invented.
3. Complete repository-wide protected-route migration and independent semantic audit remain release gates.
4. Disposable cross-tenant/RLS evidence must be validated against the actual production-representative schema before any production RLS proposal.
5. Runtime DB identity/least-privilege evidence and independent release governance remain pending.

## Completion rule
A workstream is not marked complete because code exists. It requires its defined evidence gate.

## Runtime-context closure update — 2026-11-06

- Workstream C advanced: the remaining inspected route-helper signatures that accepted `Pool | PoolClient` were narrowed to `PoolClient`.
- The affected helpers are in evidence-vault, onboarding-hierarchy, statutory, and value route modules.
- Their call sites were inspected and use the transaction-scoped client.
- Static protected-pattern scan now reports no remaining `Pool | PoolClient` helper signatures in the inspected API route set.
- This closes a type-level escape hatch; it does not by itself prove complete route/worker coverage or production RLS.

The latest code changes remain unvalidated by an exact-head CI run. Therefore Workstream C is **implementation advanced / CI gate pending**, not complete.
