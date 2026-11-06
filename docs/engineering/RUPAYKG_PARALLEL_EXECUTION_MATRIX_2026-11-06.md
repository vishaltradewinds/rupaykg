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
- CI #5793 on commit `eb5c3e505e9223d24e25ea45557a67a8989ee0e4` completed successfully with all 20 validation gates passed, including migration validation/execution, typecheck, build, browser smoke, disposable PostgreSQL acceptance, tenant-isolation RLS acceptance, production container build, bounded backup/restore rehearsal, and startup migration/fixture isolation.
- Migration 096 is now exactly restored in the repository: the restored file blob is `258b1f4534efbf915688f78aa84d4ec24a47cbc0`, matching the recovered historical blob byte-for-byte.
- Live Neon `schema_migrations` evidence confirms version `096` with filename `096_verification_authorization_provenance.sql` and applied timestamp `2026-10-27T13:46:14.262Z`.
- Live database object inspection independently confirmed the four 096 provenance columns, the verification integrity trigger, and the organization-scoped approval authorization logic.
- No production DDL/DML, role/grant/ownership mutation, RLS enablement, deployment, or replay of migration 096 was performed.

## Current blockers
1. RLS is verified disabled on all 67 inspected public tables and PostgreSQL policy count is zero.
2. Complete repository-wide protected-route migration and independent semantic audit remain release gates.
3. Disposable cross-tenant/RLS evidence must be validated against the actual production-representative schema before any production RLS proposal.
4. Runtime DB identity/least-privilege production posture remains blocked: the inspected runtime role is `rupaykg`, which owns the inspected public application tables and has `CREATEROLE`, `CREATEDB`, `REPLICATION`, and `BYPASSRLS`. A suitable least-privilege runtime identity is not yet evidenced.
5. Independent release governance and production role/ownership remediation remain pending.

## Completion rule
A workstream is not marked complete because code exists. It requires its defined evidence gate.

## Runtime-context closure update — 2026-11-06

- Workstream C advanced: the remaining inspected route-helper signatures that accepted `Pool | PoolClient` were narrowed to `PoolClient`.
- The affected helpers are in evidence-vault, onboarding-hierarchy, statutory, and value route modules.
- Their call sites were inspected and use the transaction-scoped client.
- Static protected-pattern scan now reports no remaining `Pool | PoolClient` helper signatures in the inspected API route set.
- CI #5793 now validates the current head, including the full disposable acceptance sequence.
- This closes a type-level escape hatch and validates the current CI gate; it does not by itself prove complete route/worker coverage or production RLS.

## Migration 096 lineage recovery — 2026-11-06

**Workstream D advanced to SOURCE RECOVERED / LIVE RECONCILED / EXACT SOURCE RESTORED / CI VALIDATED.**

Evidence:

- Exact historical source is recoverable at commit `ca8f4100782e13f8d72106187fafc8e1e446214f`.
- Corresponding original blob: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.
- Commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` removed that exact file with message: `Remove accidentally placed unreviewed verification migration from main`.
- The restored repository file now has the exact original blob SHA `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.
- Live ledger confirms version `096` and the exact filename.
- Live trigger/function inspection confirms the intended verification provenance/authorization behavior.
- CI #5793 passed migration validation and migration execution against the restored tree.

**Release interpretation:** this is a reconciled lineage state, not authorization to replay 096 in production. The forward release path must continue to respect the existing live ledger and avoid duplicate application.

## Runtime identity / least privilege update — 2026-11-06

**Workstream H advanced to READ-ONLY EVIDENCE COMPLETE / REMEDIATION DESIGN REQUIRED.**

- Production/default Neon branch remains read-only/HOLD.
- A disposable role-split rehearsal branch `br-dry-base-b42zrepz` was inspected read-only.
- Current database role is `rupaykg`.
- `rupaykg` has `rolcreaterole=true`, `rolcreatedb=true`, `rolreplication=true`, and `rolbypassrls=true`.
- Inspected public application objects are owned by `rupaykg`.
- `token_roles` exists without those four elevated capabilities, but its suitability as the runtime role is not yet proven by grants/connectivity analysis.
- No role/grant/ownership mutation was performed.

The remediation target is a separated owner/migrator/runtime model with a least-privilege runtime identity and explicit application connectivity contract. The next action is a disposable-branch-only role/grant rehearsal and acceptance suite; production changes remain prohibited until independent security/release gates pass.
