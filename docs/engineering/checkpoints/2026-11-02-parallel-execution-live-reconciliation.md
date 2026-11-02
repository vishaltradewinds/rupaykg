# RupayKg — Parallel Execution Live Reconciliation
Date: 2026-11-02
Governing standard: Shakti Standards
Canonical repository: `vishaltradewinds/rupaykg`
Reference UI repository: `vishaltradewinds/rupaykg-aistudio`

## Purpose and evidence boundary

This checkpoint reconciles the founder-provided ten-workstream register against live GitHub and Neon read-only evidence. It is a documentation checkpoint only. It does not authorize production mutation, merge, deployment, worker activation, external registry submission, field operation, or certification.

## Canonical source and deployment boundary

- Canonical application repository: `vishaltradewinds/rupaykg`.
- UI reference repository: `vishaltradewinds/rupaykg-aistudio`; use it for visual reference, not as the national platform source of truth.
- GitHub `main` at inspection: `a3fecc0abd2c46549a201058d3963afc0e3a73c9`.
- PR #192 and PR #203 are separate draft branches, both based on `main`; neither is merged.
- The latest Render deployment commit is recorded in PR #192 as `a3fecc0`, matching the inspected GitHub `main` short SHA. Runtime-to-Neon connection identity still requires direct deployment evidence.

## Live PR verification

### PR #192 — authentication/bootstrap integration
- State: OPEN / DRAFT / UNMERGED.
- Current PR head: `8c2b45656a0db3b53b28e846a75f23813d47026a`.
- Exact-head CI run: `41454624258`, completed SUCCESS.
- The branch contains identity/session lifecycle, separate auth runtime pool, signed request context and transaction wrapper foundation, two-custodian synthetic bootstrap tests, and hierarchical/geography-scoped reviewer authorization.
- CI success is engineering evidence only. The production auth pool, least-privilege database roles, route/worker authorization reconciliation, independent review, founder-authorized two-custodian ceremony, and release approval remain open.

### PR #203 — UI/UX reference parity
- State: OPEN / DRAFT / UNMERGED.
- Current PR head: `18b551cecdeb61ad1e22bbc4bd66cc648eb3a1e3`.
- Exact-head CI run: `41454665904`, completed SUCCESS.
- Browser UX assertions, desktop/mobile smoke checks and build/test workflow are represented in the CI run.
- Independent keyboard/focus, screen-reader, contrast/zoom, localization and field usability acceptance remain open.

## Authoritative Neon production snapshot

Read-only Neon inventory identified:
- Project: `rupaykg-production-fresh` (`steep-mud-79906940`).
- Sole primary/default production branch: `main` (`br-restless-base-b44cip2h`).
- Database: `rupaykg`.
- Public base tables: 67.
- RLS enabled: 0.
- FORCE RLS: 0.
- `public.schema_migrations`: 92 rows; latest version `20261021`.
- Inspected login role `rupaykg`: BYPASSRLS, CREATEROLE and CREATEDB.
- Dedicated `rupaykg_app_runtime`, `rupaykg_auth_runtime`, and `rupaykg_migrator` login roles were not present in the queried role set.

Production tenant isolation is therefore FAIL/BLOCKED. Do not enable RLS until application and worker transaction-context coverage, table policy predicates, role separation, adversarial tests, backup/restore and rollback rehearsals are complete.

## Neon branch classification

The Neon project inventory also returned non-primary branches for staging, migration rehearsal, RLS assurance and authentication/bootstrap labs. These are not production authorities. Preserve them until each is explicitly classified, evidence-retained and approved for retirement. Do not delete or reset branches as part of this checkpoint.

## Ten-workstream convergence status

1. Core platform engineering: continue integrated regression, worker and release-integrity validation; do not treat isolated PR CI as full platform acceptance.
2. Database/migrations: production migration ledger is 92 / latest 20261021; live source reconciliation and exact runtime branch binding remain open.
3. Authentication/tenant security: PR #192 CI passes, but production has 0/67 RLS and no dedicated least-privilege application/auth roles.
4. Hardware/IoT: engineering architecture only; real instrument identity, calibration, communications and field qualification remain open.
5. MRV/evidence: WA03.001 / BM-T-011 remains subject to live Guardian execution and Hedera write/consensus/read-back evidence.
6. Statutory/regulatory: maintain authoritative source, effective-date and applicability evidence; GRI/ICVCM cross-mapping does not substitute for Indian statutory acceptance.
7. Stakeholder/pilot: maintain isolated synthetic demonstration until Jabalpur SITE-JBP-01 access, site evidence and operational acceptance are established.
8. UI/UX: PR #203 exact-head CI passes; independent accessibility and field usability acceptance remain open.
9. Registry/settlement: bilateral counterparty authority, ownership/event ordering, replay/idempotency and external settlement proof remain open.
10. Evidence/assurance/TRL: preserve requirement-to-test-to-operation lineage, recovery evidence and independent assessment; platform-wide TRL 9 is NOT ESTABLISHED.

## Immediate critical path

1. Freeze production as read-only / HOLD.
2. Complete route + worker → SQL/table → role/function → tenant/geography/bilateral scope matrix.
3. Implement and adversarially test request-scoped transaction context and least-privilege role split on disposable Neon branches.
4. Reconcile all 67 table policies, helper functions, triggers and worker access before any production RLS rollout.
5. Complete production migration provenance, DBA review, backup/restore and rollback rehearsal.
6. Integrate PR #192 with the actual production runtime contract only after role and secret custody gates are satisfied.
7. Continue PR #203 review independently; do not let UI completion substitute for security or operational readiness.
8. Complete integrated stakeholder workflows, real instrument qualification, Guardian/Hedera proof, site operation and independent assurance.

## Checkpoint provenance discrepancy

The founder-provided reference commit `1f15ff2c00257a8f85351a887bedc79d401b045a` could not be resolved in the canonical repository during this inspection, and the named checkpoint file was not retrievable at that ref. This document records the verified live state without asserting that the supplied commit is valid or replacing historical records.

## Release posture

- Production database mutation: NOT AUTHORIZED by this checkpoint.
- Production RLS/role/migration changes: HOLD.
- Render deployment: HOLD.
- Worker/scheduler activation: OFF.
- Guardian/Hedera external writes: NOT PROVEN / NOT AUTHORIZED by this checkpoint.
- Production certification: OFF / HOLD.
- Platform-wide TRL 9: NOT ESTABLISHED.

A passing CI run, a disposable database lab, a draft PR, or a planning document is not proof of real-site operational qualification.
