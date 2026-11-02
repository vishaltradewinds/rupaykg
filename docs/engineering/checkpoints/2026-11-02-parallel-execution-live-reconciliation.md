# RupayKg — Parallel Execution Live Reconciliation
Date: 2026-11-02
Governing standard: Shakti Standards
Canonical repository: `vishaltradewinds/rupaykg`
Reference UI repository: `vishaltradewinds/rupaykg-aistudio`

## Purpose and evidence boundary

This checkpoint reconciles the founder-provided ten-workstream register against live GitHub and Neon read-only evidence and the canonical 2 November engineering checkpoint. It is a documentation checkpoint only. It does not authorize production mutation, merge, deployment, worker activation, external registry submission, field operation, or certification.

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
- The current PR head is two documentation commits ahead of code/test commit `bde761f9a5b3640081ed9383a5b4b5a48feeb211`; comparison shows no code-file changes in those two commits. Thus the expiry-fix code at that base is included in the current tested tree.
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

## Canonical 2 November checkpoint findings retained

The founder-supplied checkpoint commit `1f15ff2c00257a8f85351a887bedc79d401b045a` and file `docs/engineering/checkpoints/2026-11-02-parallel-platform-execution.md` are valid in the canonical repository. The checkpoint records, among other items:
- Stakeholder pilot demonstration readiness plan and stakeholder dashboard route matrix are documentation/source maps, not real-site acceptance.
- The shared test helper that directly updates membership/approval state is not proof of the governed onboarding path; the dedicated synthetic PostgreSQL bootstrap integration test does exercise the actual two-custodian and review functions.
- Bootstrap claim-expiry hardening commits: migration `d1516653229bb043a29762e882ff54a4adfadac6` and regression test `bde761f9a5b3640081ed9383a5b4b5a48feeb211`. The checkpoint itself recorded exact-head CI as pending at that point. The current PR #192 head is two documentation commits ahead of the test commit, with no code changes in those two commits, and its exact-head CI run `41454624258` is SUCCESS.
- Guardian policy remains unpublished and lacks real Guardian IDs, signatures and execution evidence; Hedera HCS transaction/consensus and Mirror Node read-back are separate proof requirements.
- Settlement bilateral consent/authority and registry event ordering/ownership semantics remain policy and regression gaps.
- No production migration, production bootstrap ceremony, production database mutation, or live external registry proof is established by that checkpoint.

## Route-to-data authorization audit — additional findings

The PR #192 branch contains `docs/security/2026-11-02-route-to-data-tenant-authorization-audit-draft.md`, a static inventory of 90 HTTP route declarations across 15 route-bearing modules. It is an audit draft, not a complete authorization proof. It explicitly requires reconciliation against helpers, dynamic SQL, functions, triggers and workers.

Key findings from that inventory:
- `withRlsRequestTransaction` binds a signed short-lived identity and one verified active-organization claim to a transaction-local setting, but it is not yet the universal data-access path.
- Route modules still contain direct pool queries and route-local transactions. A blind outer transaction wrapper is unsafe; each route must use one checked-out client for context, authorization and protected SQL, with nested transaction behavior deliberately refactored.
- The single-organization helper rejects bilateral context. Settlement and inter-organization transfers need a dedicated bilateral authorization contract binding both parties and current credential ownership; do not force them into a single-org policy.
- The signed request-context migration does not itself enable RLS or create policies. The production schema remains unprotected by RLS.
- The geography helper currently allows organizations with no verified geography roots through a compatibility behavior. National production policy must explicitly decide whether such organizations are onboarding-only, default-scoped or blocked from regulated writes.
- JSON/polymorphic ownership, evidence/blob storage, derived carbon/ESG records, async workers/webhooks and append-only histories need explicit ownership and execution-path treatment.

P0/P1 release blockers recorded by the route audit:
1. No production tenant RLS on 67/67 public tables.
2. Privileged production owner/runtime role with BYPASSRLS and elevated role privileges.
3. Signed transaction-context helper not integrated across all route data access.
4. Bilateral settlement authority model unresolved.
5. Route-local transaction/pool usage can separate context from protected statements.
6. Geography compatibility default needs explicit national policy.
7. JSON/polymorphic ownership and async/background paths remain incompletely reconciled.

Required next artifacts are a machine-readable endpoint → SQL/table → client/transaction → owner/geography/bilateral scope matrix; a live-schema-verified 67-table classification; a function/trigger/owner/search_path/EXECUTE-grant inventory; disposable two-tenant negative tests using exact proposed runtime roles; and independent DBA/security review with restore/rollback rehearsal.

## Live database function/trigger/grant audit — read-only, 2026-11-02

A second read-only catalog query was run against the same authoritative Neon production branch. It returned:
- 115 functions in schema `public`.
- 0/115 marked `SECURITY DEFINER`.
- 0/115 with a function-level `proconfig` (no function-specific fixed search_path setting).
- 78/115 functions owned by login role `rupaykg`.
- 70 non-internal triggers on public tables.
- 67/67 public tables appear in `information_schema.role_table_grants`.
- 115 rows in `information_schema.routine_privileges` for grantee `PUBLIC` and schema `public`.

Interpretation and required caution:
- The 115 PUBLIC EXECUTE rows are a default-privilege exposure indicator, not by themselves proof that every function is exploitable. Each function's body, volatility, side effects, argument validation, owner privileges, caller reachability and intended public contract must be reviewed.
- The 0 SECURITY DEFINER result is consistent with the production baseline lacking the newer `auth_private` and `app_security` schemas; it does not mean the production function/trigger surface is harmless.
- Triggers are executed as part of table DML and their function bodies must be included in the 67-table ownership/policy and least-privilege review.
- No blanket REVOKE, owner change, search_path change, trigger change or function replacement was performed. Blanket revocation risks breaking legitimate operations and must follow a per-function privilege manifest and disposable acceptance.
- The production owner `rupaykg` being a login role with BYPASSRLS/CREATEROLE/CREATEDB remains a separate P0 boundary defect.

Next DBA/security gate:
1. Export the exact 115 function definitions, signatures, owners, ACLs, volatility, language and dependency/call graph.
2. Map all 70 triggers to their trigger functions and affected table policy classes.
3. Build an explicit EXECUTE grant manifest: PUBLIC deny by default; narrowly grant only intended safe read/reference functions to appropriate roles.
4. Identify functions with dynamic SQL, SECURITY INVOKER assumptions, unqualified relation references, external effects or privilege-sensitive operations.
5. Test the proposed ACL/owner/search_path changes on a disposable clone with the exact future runtime roles and full API/worker acceptance.
6. Independent DBA/security sign-off before any production change.

## Immediate critical path

1. Freeze production as read-only / HOLD.
2. Complete route + worker → SQL/table → role/function → tenant/geography/bilateral scope matrix.
3. Implement and adversarially test request-scoped transaction context and least-privilege role split on disposable Neon branches.
4. Reconcile all 67 table policies, helper functions, triggers and worker access before any production RLS rollout.
5. Complete production migration provenance, DBA review, backup/restore and rollback rehearsal.
6. Integrate PR #192 with the actual production runtime contract only after role and secret custody gates are satisfied.
7. Continue PR #203 review independently; do not let UI completion substitute for security or operational readiness.
8. Complete integrated stakeholder workflows, real instrument qualification, Guardian/Hedera proof, site operation and independent assurance.

## Checkpoint provenance

The canonical 2 November checkpoint is verified at commit `1f15ff2c00257a8f85351a887bedc79d401b045a`. This live reconciliation document supplements it with independently queried Neon and current PR-head evidence; it does not replace the original checkpoint.

## Release posture

- Production database mutation: NOT AUTHORIZED by this checkpoint.
- Production RLS/role/migration changes: HOLD.
- Render deployment: HOLD.
- Worker/scheduler activation: OFF.
- Guardian/Hedera external writes: NOT PROVEN / NOT AUTHORIZED by this checkpoint.
- Production certification: OFF / HOLD.
- Platform-wide TRL 9: NOT ESTABLISHED.

A passing CI run, a disposable database lab, a draft PR, or a planning document is not proof of real-site operational qualification.
