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


## Function ACL, ownership and trigger dependency refinement — live read-only query

A follow-up catalog pass refined the earlier aggregate counts on the same authoritative production branch (main, database rupaykg). It did not read or export function bodies.

### Function ownership and PUBLIC EXECUTE

| Owner | Language | Functions | PUBLIC can EXECUTE |
|---|---:|---:|---:|
| rupaykg | PL/pgSQL | 71 | 71 |
| rupaykg | SQL | 7 | 7 |
| cloud_admin | C | 37 | 37 |
| **Total** | | **115** | **115** |

- All 78 application-owned functions are executable by PUBLIC according to PostgreSQL privilege evaluation.
- The 37 C-language functions are owned by cloud_admin and also evaluate as PUBLIC-executable. These appear to be extension-provided functions; their extension membership and intended exposure must be verified before any permission decision.
- For all 115 functions, proacl is NULL (default ACL behavior), no function-level proconfig is set, and none is marked SECURITY DEFINER.
- This is stronger evidence than merely counting rows in information_schema.routine_privileges: has_function_privilege('public', oid, 'EXECUTE') returned true for every function in the catalog result.
- PUBLIC EXECUTE is a real over-broad exposure and must be treated as a P1/P0 candidate pending function-body/call-graph review. It is not by itself proof of remote exploitability: actual reachability depends on API exposure, language, owner rights, argument validation and function behavior.

### Trigger dependency map

- 70 non-internal triggers are installed on 33 public tables.
- All 70 are enabled in ordinary origin mode (tgenabled='O').
- They invoke 67 distinct trigger functions; several functions are shared or a table has multiple controls.
- Trigger functions are part of the effective write authorization and integrity boundary. Any proposed RLS/role/EXECUTE change must preserve their ability to enforce immutable evidence, methodology governance, credential lifecycle, settlement constraints, EPR quantities/evidence, geography and field-device/sync integrity.
- Do not blindly revoke EXECUTE from trigger functions or transfer ownership: PostgreSQL trigger execution and function privilege semantics must be tested against the exact role model and actual DML paths in a disposable clone.

### Login and role-membership refinement

The live role catalog returned four privileged/service role records:
- cloud_admin: superuser, login, BYPASSRLS.
- neon_service: login, CREATEROLE/CREATEDB, BYPASSRLS; member of neon_superuser.
- neon_superuser: non-login, CREATEROLE/CREATEDB, BYPASSRLS; granted elevated maintenance/read/write roles.
- rupaykg: login, CREATEROLE/CREATEDB, BYPASSRLS; member of neon_superuser.

This does not mean the application has access to cloud_admin or neon_service credentials. It confirms the production rupaykg login inherits a powerful neon_superuser membership and must not remain the application runtime identity. Neon-managed service roles are platform-managed; do not attempt to modify them as part of app hardening.

### Default ACL observation

The inspected pg_default_acl rows for cloud_admin in public covered tables and sequences and did not return a function default-ACL row. The NULL function ACLs therefore require review against PostgreSQL built-in default function privileges and extension installation behavior, not an assumption that a custom function default-ACL entry exists.

### Next exact engineering actions

1. Inventory all 78 application-owned function definitions in controlled batches; classify pure read helpers, mutation functions, trigger-only functions, privileged operations, dynamic SQL and external effects.
2. Identify the 37 C functions' owning extensions and extension version/schema provenance; separate vendor-managed functions from application functions.
3. Generate the full trigger → table → function → affected-data-scope matrix and map each trigger function to its underlying table references.
4. Inspect PUBLIC EXECUTE callability through API roles and PostgREST/RPC exposure, if any; do not assume every SQL function is externally callable.
5. Define a least-privilege role split that removes the app's inherited neon_superuser authority, while preserving migration ownership and platform-managed roles.
6. Prove all intended trigger and application paths under exact proposed roles on a disposable branch before proposing a production migration.

No production role, ACL, function, trigger, schema, table, sequence or data was changed. No function bodies were exported into this checkpoint.


## Second live schema pass — table ownership and trigger coverage

Read-only production catalog reconciliation confirms the complete 67-table register against pg_class:

- 67/67 base tables have RLS disabled and FORCE RLS disabled.
- 67/67 base tables are owned by the current application login role (rupaykg).
- PUBLIC has no direct SELECT, INSERT, UPDATE or DELETE privilege on these tables according to has_table_privilege checks. This is not a substitute for reviewing inherited role grants, function execution, application endpoints or privileged owner bypass.
- The 70 enabled non-internal triggers span 33 tables. Highest trigger concentrations are settlements (11), registry_events (7), settlement_events (6), credentials (5), carbon_calculations (3), field_sync_envelopes (3), and stakeholder_applications (3). This highlights where policy and trigger regression coverage must be deepest.
- The 67-table ownership/RLS matrix already present in the PR #192 audit remains a proposed semantic classification, not approved live policy. Every ownership path and FK must be verified before policy generation.

The production catalog exposes 11 application-owned non-trigger functions: 3 boolean capability helpers (can_assess_epr, can_manage_field_device, can_write_esg), 3 authorization helpers (has_verification_permission, identity_has_permission, organization_has_geography_scope), 3 mutating workflow functions (allocate_environmental_attribute_claim, allocate_epr_credit, release_epr_credit_allocation), one assertion helper, and one immutable role-default helper. All are PUBLIC EXECUTE under the current catalog privilege evaluation. These are first-priority body/callsite review targets; names and return types alone do not prove safety or exploitability.

The 37 C-language functions are extension members of pgcrypto 1.4 in public; preserve extension-managed ownership and versioning. Do not apply application-function ACL scripts to these extension objects.

Validation provenance: production-only catalog reads on authoritative Neon main. No data, DDL, grants, role membership, schema ACL, trigger, function or migration was changed. No disposable compute was started.


## Priority function-body review — read-only production definitions

A bounded pg_get_functiondef review was completed for the 9 highest-priority application-owned callable functions. No function source was modified.

Findings:

1. allocate_epr_credit and release_epr_credit_allocation perform multi-table writes and row locks, but accept only record IDs/quantity and do not accept an authenticated actor or organization scope. Their bodies validate status, scheme, quantity and capacity, but do not themselves prove caller authorization or tenant ownership. Treat PUBLIC EXECUTE as a critical access-control risk if these functions are reachable from an untrusted database/API caller. Verify all call sites and runtime connectivity before determining exploitability.
2. allocate_environmental_attribute_claim accepts organization/activity/evidence/verification IDs and validates claim type, positive quantity and unit, then inserts an active value claim. The inspected body does not itself bind the supplied organization to a verified caller identity. Caller authorization and FK/trigger constraints must be proven end-to-end; this function is not safe to expose as a general RPC under the current privilege model.
3. has_verification_permission(identity_id) and identity_has_permission(actor_id, permission_code, role_names) test verified membership across organizations without taking a subject organization/activity parameter. They are global capability predicates and must not be used alone for organization/geography-scoped decisions.
4. organization_has_geography_scope returns true when the organization has no VERIFIED geography roots. This is a confirmed compatibility fail-open. The verifier migration under PR #192 introduces an explicit verified-root check in its newer branch helper, but that branch change is not production deployed. Regulated writes should remain blocked until onboarding ensures a verified root or a specific onboarding-only exception is enforced.
5. can_assess_epr, can_manage_field_device and can_write_esg do bind identity to organization and require VERIFIED membership, but do not include geography in their own predicates. Callers must add the relevant resource geography and operation-specific checks.

Risk interpretation: PUBLIC EXECUTE is confirmed for these functions, and their bodies reveal authorization assumptions that are not uniformly enforced internally. This is a high-priority security finding, not proof that an unauthenticated internet user can call the functions: actual exposure depends on database credential custody, API/RPC exposure, route callsites and database role. Do not expose them through PostgREST/RPC or grant broader application connectivity until an actor-bound contract and exact ACL are tested.

Required next steps: map all route and worker callsites; introduce actor-bound, organization/geography/bilateral-scoped database APIs where needed; classify trigger-only functions separately; restrict function EXECUTE to the minimum runtime roles in a disposable rehearsal; add negative tests for cross-tenant IDs, wrong actor, unverified membership, missing geography root, stale credential owner and concurrent EPR allocation/release.

No production data, DDL, function definition, ACL, role, schema or trigger was changed. This body review is read-only evidence from the authoritative production branch.


## Targeted geography authorization correction — PR #192 branch

A source-level pass of `apps/src/value-routes.ts` found an organization-binding defect: the carbon calculation geography helper previously accepted any verified membership of the actor that passed the geography helper, rather than requiring the activity's actual organization. A multi-organization identity could therefore satisfy the geography predicate using another organization's verified scope. The helper now receives `access.organization_id` and binds the membership query to that organization.

The same branch now contains:
- `migrations/20261108_geography_scope_fail_closed.sql`: shared geography scope helper returns true only when a VERIFIED scope ancestor exists; missing roots now fail closed.
- `apps/src/value-routes.test.ts`: unit coverage for exact organization binding, missing geography and failed scope.
- `apps/src/registry-settlement-runtime.test.ts`: PostgreSQL integration assertion that scoped organization succeeds and unscoped organization is denied.
- Updated route-to-data audit describing the finding, fix, and mandatory organization onboarding/backfill gate.

Code commit head before documentation-only follow-up: `9d6664ba06f8264655606eaa8853062e518fadd1`; exact-head CI run `41456990898` was QUEUED at last check. The route audit update is documentation-only and follows the code changes on the same PR branch. No production migration was applied. The stricter helper will block existing organizations lacking VERIFIED geography roots, so production rollout requires a complete organization-by-organization scope backfill, negative tests and rollback rehearsal.

## Completed CI confirmation for documentation checkpoint

The prior PR #204 documentation validation run `41456297642` completed SUCCESS across dependency audit, migration validation, migration execution in disposable PostgreSQL, typecheck, build, browser smoke test, disposable PostgreSQL acceptance and production container build. It validates that documentation commit's repository checks, not live production security or platform TRL.


## Exact CI tracking — geography correction PR #192

- PR #192 code commit `9d6664ba06f8264655606eaa8853062e518fadd1` includes the organization-bound activity geography predicate, fail-closed geography migration, unit tests and PostgreSQL acceptance assertion.
- Exact code-commit CI run `41456990898` is IN_PROGRESS. At last job inspection: dependency audit, migration validation, restricted owner provisioning, disposable migration application, bootstrap owner teardown and synthetic custodian provisioning passed; typecheck was running; build/bootstrap/browser/PostgreSQL tests/container build were pending.
- A later documentation-only commit updates the route audit; current PR #192 head is `09d4cd335b4726241cc155884f51ebcc3b3767d7`. CI run `41457065615` was also IN_PROGRESS at last inspection.
- PR #192 remains draft, open and unmerged. Do not treat queued/in-progress CI as acceptance. Production remains unchanged and the fail-closed migration is not approved for production until the organization geography backfill and rollback gates are satisfied.

## Follow-on CI failure diagnosis and write-boundary hardening

Exact-head CI run `41457065615` completed with 155/156 tests passing. The sole failing test was `evidence vault enforces tenant scope, versioned storage, integrity and independent review` in `apps/src/evidence-vault.integration.test.ts`. PostgreSQL raised `activity geography is outside organization authorization scope` when the fixture inserted the activity before inserting its VERIFIED organization geography scope. This is a test-fixture ordering defect exposed by the new fail-closed trigger/migration, not a reason to weaken the guard.

Correction committed on PR #192:
- `apps/src/evidence-vault.integration.test.ts` now creates the VERIFIED organization geography scope before inserting the geography-bound activity, matching the real onboarding invariant.
- Evidence upload now resolves activity ownership/geography and checks `evidence:upload` using the same checked-out transaction client that creates the evidence series, evidence row and artifact version. This closes the preflight-pool-check to write-transaction gap for uploads.
- Credential issuance now checks `ISSUE_CREDENTIAL` using the same transaction client that locks and creates the credential.
- Bilateral settlement creation now checks `settlement:authorize` for both payer and payee on the write transaction client. Authorization, execution and confirmation now require the relevant high-risk permission for both parties on that transaction client. Missing bilateral create permission is mapped to HTTP 403 rather than generic 503.

Latest PR #192 code head: `ce51503601555b38cf4b66d6c615cc07422b4e8f`. Exact-head CI run `41457553245` was QUEUED at checkpoint time. The preceding run `41457065615` is FAILED solely on the geography fixture ordering test described above; migration validation, typecheck, build, bootstrap and browser smoke all passed. No production changes.

Remaining source-level critical review:
- MRV submit retains a session advisory lock on one checked-out client but performs most reads and provenance writes through `pool.query` on other connections. It is not yet a single tenant-context transaction; external Guardian/Hedera calls need a deliberate idempotent outbox/claim/finalize design rather than holding a database transaction across network calls.
- Registry, evidence and MRV route adoption of signed RLS transaction context remains incomplete. The production database still has 0/67 tables with RLS enabled and the live role is privileged.
- Registry settlement routes now require bilateral party permissions, but full end-to-end two-party actor-context tests and independent review are still required.

Do not merge or deploy on the basis of a queued CI run. Keep production HOLD; certification OFF; TRL 9 not established.

## Geography fixture regression resolved in CI

CI run `41457369818` for code commit `0c5107585d744b2e8377b9e594fe26b1594593af` completed **SUCCESS**. This exact run includes the reordered evidence-vault integration fixture and passed the complete workflow, including the full test suite and production container build. This validates the fail-closed geography migration plus fixture correction at that commit; it does not include later evidence-upload transaction and bilateral settlement permission changes.

Subsequent exact-head runs for later code changes are still running:
- `41457553245` — code commit `ce51503601555b38cf4b66d6c615cc07422b4e8f`
- `41457603965` — docs/branch follow-up commit `6659af4414ef1b93d876692b8bf1fde4e2e8c140`
- `41457631324` — latest PR #192 head `7945acec86d78c7720d3873d07238687007c7d35`

Do not extrapolate the earlier success to later commits. Exact latest-head CI acceptance remains pending.

## Exact CI acceptance for evidence and bilateral settlement code

CI run `41457510422` for code commit `aae20cdedff4832ae95b0ba49ef0ef83576aeb61` completed **SUCCESS**. It includes the fail-closed geography migration, fixture-order correction, evidence-upload authorization on the write client, credential issuance authorization on the write client and bilateral settlement permission checks. This is an exact-head successful verification for that code commit, not for later commits.

The latest MRV connection-consistency code is commit `bb878aa90c3b348e8ccb85933372d59080522fb4`. It moves MRV submit-path authorization, source reads, replay lookup and provenance persistence to the same checked-out client that holds the idempotency advisory lock. Exact-head CI run `41457821676` was QUEUED at last check. The code still does not establish a transaction-local signed RLS context; durable claim/outbox and actor-bound finalize remain open.


## MRV durable execution contract added

Added `docs/architecture/MRV_DURABLE_EXECUTION_AND_OUTBOX_CONTRACT.md` on PR #192 branch. It defines the staged REQUESTED → CLAIMED → Guardian → HCS → Mirror Node → provenance finalization state machine; unique idempotency key and immutable payload hash; lease-token compare-and-set; actor/organization/geography revalidation; short transaction boundaries; crash recovery; and 12 required negative/concurrency/fault-injection tests.

Critical finding: Guardian adapter already sends a deterministic idempotency key, but safe retry depends on Guardian honoring it. Hedera adapter currently creates a fresh SDK transaction ID internally; a process crash after HCS acceptance but before DB persistence can lead to a duplicate anchor on retry. The contract requires a persisted, reusable Hedera transaction ID or explicit NEEDS_RECONCILIATION state; no blind retry. This adapter and worker implementation remains open.

MRV route connection consistency correction is commit `bb878aa90c3b348e8ccb85933372d59080522fb4`; its exact-head CI run `41457821676` was still IN_PROGRESS at last check (production container build stage). Latest PR #192 head `9edfb1e91a9377ffc90c076c4d66de15345719a9` run `41457874949` and latest checkpoint head `1874f8c998d8af64a096835fe817318734346dfd` run `41457900115` were still IN_PROGRESS at last check. Earlier code revision `aae20cdedff4832ae95b0ba49ef0ef83576aeb61` passed full CI run `41457510422`; do not extend that success to later code commits.

No production schema, role, data, provider or deployment changes. Production HOLD; certification OFF; TRL 9 not established.


## MRV connection-consistency correction — exact CI passed

The MRV route correction commit `bb878aa90c3b348e8ccb85933372d59080522fb4` completed exact-head CI run `41457821676` with **SUCCESS**. Later PR #192 heads also completed successfully:
- `9edfb1e91a9377ffc90c076c4d66de15345719a9` — run `41457874949`, SUCCESS.
- `1874f8c998d8af64a096835fe817318734346dfd` — run `41457900115`, SUCCESS.

These verify the MRV same-client connection correction and repository checkpoint state. They do not implement the durable outbox or prove external exactly-once behavior. The new MRV durable execution contract was committed as `8e8f5e1712b0dac01a518e7aabfd93a03bc6a6a3`; its exact-head CI run `41458198658` is IN_PROGRESS. This commit is documentation-only beyond the already CI-verified code.

PR #204 compare against main is cleanly ahead by 13 commits and 0 behind; GitHub PR metadata temporarily reports `mergeable=false`, so recheck mergeability before any merge. PR #192 and #204 remain draft/unmerged. Production remains untouched.


## Durable MRV job ledger — implementation slice and CI correction

Added migration `migrations/20261109_durable_mrv_submission_jobs.sql` on PR #192 branch:
- durable idempotent job key and immutable payload hash/snapshot;
- activity, verification, evidence, organization and geography binding;
- explicit Guardian/HCS/Mirror Node state fields and bounded lease metadata;
- status constraints and guarded state transitions;
- append-only job-event table and mutation rejection trigger;
- indexes for job claiming, activity/org history and unique Hedera transaction IDs.

Added `apps/src/mrv-submission-jobs.integration.test.ts` to exercise fixture creation, initial event capture, immutable request binding, invalid state-transition rejection and append-only event enforcement. Expected SQL failures use savepoints so the test transaction can continue safely.

**CI caught a real migration defect:** first exact migration CI run `41458539725` failed because a JavaScript string replacement collapsed the PL/pgSQL `$$` function delimiter to `$`. Corrected the migration in commit `34dc6273277ee43b5a1524a72993f13b23f32e0b`. Do not call the migration accepted until the new exact-head CI (including disposable PostgreSQL migration and integration test) passes.

This is an initial ledger schema only, not a complete worker. Claim/lease acquisition, signed actor context, provider-stage persistence, deterministic Hedera transaction-ID retry, Mirror Node reconciliation and least-privilege grants/RLS remain implementation gates. The migration is not deployed to Neon production. Production remains HOLD.


## Follow-up: PL/pgSQL delimiter fix re-applied and verified in source

The first two disposable PostgreSQL runs (`41458539725`, `41458607059`, and `41458639443`) exposed the same syntax error at character 6806: the append-only trigger body still contained a single-dollar delimiter. The previous correction did not survive the text replacement operation. Re-applied the fix using a callback-based replacement and re-fetched the repository file to verify the exact source now contains `as $$ ... $$;`. Corrected migration commit: `07cf79538700a6fccb233a9d96800090064aeb1d`.

The exact-head CI for `07cf795...` is pending. Do not claim the durable ledger migration/test is accepted until that run applies all migrations and executes the PostgreSQL integration test successfully. This failure is recorded rather than hidden.


## MRV job-ledger integration test regression found and corrected

After the delimiter fix, the migration advanced through disposable PostgreSQL and the suite reached the new integration test. The fixture was rejected by the existing independent-verification invariant because it reused the activity actor as verifier. Corrected the test to create a distinct verifier identity; commit `ebb112300a5aa14c36f77b09a398eea8e15eaeb9`. This is a fixture correction, not a weakening of the anti-self-approval rule. Exact-head CI is pending.


## 14:12 UTC CI correction

Run `41459321801` confirmed the verifier fixture passed the independent-identity check but failed the next database authorization guard: the verifier also needs `VERIFY_EVIDENCE`. Added this explicit permission alongside `verification:approve` in commit `77c8f8be5365ca541dd57b60ed0a05d765499151`. Exact-head CI run `41459617407` is progressing through build; acceptance remains pending. Inspection also reconfirmed that the existing `/api/v1/mrv/activities/:activityId/submit` route still performs Guardian and Hedera calls synchronously while holding a session advisory lock. The durable ledger is not yet wired into that route; this remains a major reliability gap and must be replaced by short-transaction enqueue/claim/provider/finalize stages before claiming durable orchestration.


## Exact-head CI acceptance update — 2026-11-02

The corrected MRV verifier fixture commit `77c8f8be5365ca541dd57b60ed0a05d765499151` has passed the disposable PostgreSQL integration test suite, including `durable MRV job ledger enforces immutable request, legal transitions and append-only events`. The same run passed migration validation/execution, bootstrap privilege revocation, TypeScript type-check, production build, two-custodian bootstrap acceptance and browser smoke. Workflow run `41459617407` is still completing the production-container build; do not call the overall workflow fully successful until its final conclusion is SUCCESS.

This validates the initial ledger schema and invariant tests only. It does not establish a functioning outbox/worker: the existing MRV submit route still performs external Guardian/Hedera calls under a session advisory lock and persists provider results afterwards. Worker claim/lease, short-transaction stage orchestration, durable Hedera transaction ID/reconciliation and tenant/RLS integration remain release blockers. No production change was made.


## Final workflow result

Workflow `41459617407` for exact code commit `77c8f8be5365ca541dd57b60ed0a05d765499151` completed with conclusion **SUCCESS**. This includes the durable MRV ledger PostgreSQL integration test and production-container build. The documentation checkpoint update is in commit `4b55a04ec3fc6a9c6fff240db806cdd275967cd8`; its own workflow is separate and must be tracked independently. PR #192 remains draft/unmerged. Production is unchanged. TRL 9 and production readiness are not established by this CI pass.


## Atomic worker lease primitives added

On the PR #192 code branch, added `apps/src/mrv-submission-jobs.ts` with:
- Atomic one-job claim using `FOR UPDATE SKIP LOCKED`, due-time filtering and bounded 10–900 second leases.
- Unique per-claim UUID fencing token, worker identity and attempt counter.
- Reclaim of expired leases across resumable non-terminal provider stages without erasing the persisted stage.
- Compare-and-set stage advancement requiring the current, unexpired lease token; stage advancement clears the lease atomically.
- Explicit retry release with bounded error metadata and caller-supplied retry time.

Extended `apps/src/mrv-submission-jobs.integration.test.ts` to verify single-worker exclusivity, attempt increment, stale-token rejection and atomic lease release. Commit `cdd4968df2721adf593759d28a3122678b19e3ea` is under exact-head CI run `41460158865`; acceptance is pending. These are database orchestration primitives, not yet a running worker process or provider integration. External calls must remain outside DB transactions. Stable Hedera transaction ID persistence/reuse and Mirror Node reconciliation are still open, and the synchronous legacy MRV route remains in place. No production database or service was changed.


Lease renewal follow-up: `apps/src/mrv-submission-jobs.ts` now also exposes `renewMrvSubmissionJobLease`, a compare-and-set extension that only the current unexpired lease token can perform. Commit `e34536c0fec929b02640cf1cfb79a3a28d47d4f3`. This is still a library primitive; worker heartbeat policy and integration tests remain to be added before any long-running provider processing is enabled.


## Subsequent worker and Hedera safety work — 2026-11-02 14:17 UTC

- Exact-head workflow for worker claim/advance and stale-token integration tests: `41460225243` completed SUCCESS on `cdd4968df2721adf593759d28a3122678b19e3ea`.
- Exact-head workflow for worker lease module and initial integration tests: `41460158865` completed SUCCESS on `961b6303d0a62eb9e73a3c065c06e409c79b48b1`.
- Added `createHcsTransactionId()` and optional persisted transaction-ID submission support in `apps/src/hedera-anchor.ts` (`eb1ba4b0af10a70190d060c6a28df4299540e4cb`). This allows a caller to generate and persist an SDK transaction ID before HCS submission, then reuse the same ID on retry. It is not yet wired into the job worker or legacy submit route.
- Added explicit lease-renewal integration coverage in commit `d65d311d09e7d8be7b617ea2c1b1507ae837bdbb`; CI pending.
- Checkpoint branch updated through the lease-renewal note in its own documentation commits; latest docs CI and code CI remain independently tracked.

**Safety boundary:** no autonomous production worker is started. The production DB audit still found no RLS enabled on the public base tables and no dedicated least-privilege worker runtime role/policy. The job migration deliberately has no grants/RLS policy yet. A runnable worker must fail closed until a separate worker credential, forced RLS, job-table policies, actor/organization/geography binding, tenant-negative tests and DBA-reviewed migration are available. Guardian idempotency is deterministic but still depends on the Guardian endpoint honoring the key. HCS transaction-ID persistence is only a helper until wired into the job state machine. Mirror Node reconciliation and provenance finalization remain open. Do not claim end-to-end durable orchestration or TRL 9.


HCS transaction-ID helper coverage added: `apps/src/hedera-anchor.test.ts` now verifies an SDK transaction ID can be generated before submission with the configured operator account, suitable for persisting before the provider side effect. Commit `18a4fffde580a9bb9c1e054ddc125b1d2e42224e`; exact-head CI pending. This test does not submit a live transaction or prove retry behavior against Hedera; those require controlled testnet acceptance with a persisted ID and Mirror Node confirmation.


## Pre-submit HCS transaction persistence primitive — 2026-11-02 14:21 UTC

- Added `persistMrvHcsTransactionId` to `apps/src/mrv-submission-jobs.ts` (commits `878975b2299d6d30e12bafbca2077db93bfc23ef`, parameter correction `4a71fd41e126c2f4f65ce396102e635a0f00c990`). It compare-and-sets against the live lease token, moves `GUARDIAN_VERIFIED` to `HCS_SUBMITTED`, persists network/topic/transaction ID before the network call, and refuses to replace an already persisted ID or change its network/topic. The lease remains active while the provider call executes outside the DB transaction.
- Extended PostgreSQL integration test to walk REQUESTED → CLAIMED → GUARDIAN_SUBMITTED → GUARDIAN_VERIFIED → HCS_SUBMITTED → HCS_CONSENSUS_CONFIRMED, assert transaction ID survives, and reject a conflicting retry ID. Test commit `70755746f29e9dd3886972b655ce27be052332d3`; exact-head CI pending.
- This remains a tested orchestration primitive, not a live worker. Worker role/RLS policy, API enqueue path, actual Guardian/HCS calls, Mirror Node polling, and final provenance transaction still need wiring and test coverage.


### CI correction record — HCS ID helper test

- CI run `41460930848` failed only the newly added transaction-ID regex assertion: SDK output was a valid `0.0.1234@seconds.nanos` string, while the test regex was over-escaped. No production code failure was reported by that test run; the run is still a failed overall gate.
- Corrected the assertion in commit `dc4d0f4db809ba13eb090bf6ea9369d077ed122e`. Exact-head CI pending. Do not count the helper test as passed until that new run completes.


### Transaction ID assertion follow-up — 2026-11-02 14:24 UTC

- First regex correction remained over-escaped in the emitted test; exact CI on `dc4d0f4db809ba13eb090bf6ea9369d077ed122e` reproduced the same assertion failure. Replaced regex matching of the full identifier with explicit account-ID equality plus timestamp-component validation using `[.]` in commit `30f6eabb99f3fd0ac29bc1c2f1bffdaf95ef3de2`.
- Exact-head CI run `41461603873` is currently running; do not treat this test as green until it completes. The broader build for docs checkpoint commit `daf4090ad091aaaaac837d0a674ca324c0874400` passed (`41461340133`).


### HCS pre-submit persistence test result — 2026-11-02 14:25 UTC

- Exact-head run `41461603873` for code commit `30f6eabb99f3fd0ac29bc1c2f1bffdaf95ef3de2` has passed migration validation, typecheck, build, browser smoke, and the full disposable PostgreSQL acceptance suite, including the new HCS transaction-ID persistence/replacement-rejection path. Production container build is still in progress; do not mark the whole workflow successful until the run completes.


## Guardian pre-submit idempotency persistence — 2026-11-02 14:26 UTC

- Added `persistMrvGuardianIdempotencyKey` in `apps/src/mrv-submission-jobs.ts` (`7656471dbab80cc778060b0ebac0019ca088790c`). It requires the current unexpired lease, persists the deterministic key before the provider side effect, advances to `GUARDIAN_SUBMITTED`, retains the fence during the external call, and rejects attempts to replace a previously persisted key.
- Extended the PostgreSQL integration path to verify Guardian key persistence and conflicting-key rejection, then Guardian verification, HCS transaction persistence and HCS consensus stage. Test commit `9094a4222148bb20690f1f7e8ea7d43b51268e0c`; CI pending.
- This completes two provider-side pre-submit persistence primitives, not the worker. No live provider calls or production execution have been enabled.


### Exact-head result — 2026-11-02 14:26 UTC

- Run `41461603873` completed SUCCESS for code commit `30f6eabb99f3fd0ac29bc1c2f1bffdaf95ef3de2`: migrations, typecheck, build, browser smoke, disposable PostgreSQL acceptance (including HCS transaction-ID persistence path), and production container build all passed.
- This validates the HCS persistence helper and preceding lease renewal/worker primitives at CI level. It does not validate the later Guardian idempotency helper/test commits; those are queued/running separately.


## Mirror Node reconciliation by persisted HCS transaction ID — 2026-11-02 14:28 UTC

- Added `reconcileHcsTransaction` in `apps/src/hedera-anchor.ts` (commits `265a827d4536b3fd6f28868d42a9011cf2ed7253`, parser correction `82a6a502ab65ab382a8e943ea0ec70068332d29d`). It looks up the already-persisted transaction ID at the network Mirror Node, confirms transaction type `CONSENSUS_SUBMIT_MESSAGE`, exact topic, successful result and consensus timestamp, then verifies the exact HCS message payload/hash and activity/verification/evidence/Guardian execution binding.
- Mirror Node 404 or empty results are explicitly `PENDING` (indexing lag), never proof of non-submission and never authorization to generate a replacement transaction ID. Network errors are `UNAVAILABLE`; topic/type/payload mismatches are fail-closed; failed transaction results are terminal `FAILED`.
- Added tests for successful end-to-end transaction lookup + exact payload verification and 404-as-pending (`38ee5b58cd790f970177b683e2bddbb46369ebbe`). CI pending.
- Reference: Hedera Mirror Node API documents `GET /api/v1/transactions/{transactionId}` and transaction metadata, alongside topic message APIs. See official Mirror Node Swagger: https://mainnet-public.mirrornode.hedera.com/api/v1/docs/ and Hedera docs. This is lookup support only; it is not yet wired into a live worker or the production MRV route.


## Durable enqueue contract — 2026-11-02 14:29 UTC

- Added `createMrvSubmissionIdempotencyKey` and `enqueueMrvSubmissionJob` to `apps/src/mrv-submission-jobs.ts` (`c7e0e254b83ac03b30770b49f29f1175eaa13943`). The helper derives a deterministic key from activity/verification/evidence/policy/methodology, canonicalizes the payload snapshot before hashing, inserts the immutable request, returns the same job for an identical replay, and fails closed if the same key is reused with a changed payload.
- Added PostgreSQL integration coverage for same-request replay and changed-payload rejection (`745e279128a8f0e722e3ee7e0e4389c41759b7de`). Exact-head CI pending.
- This is the enqueue primitive only. The authenticated HTTP enqueue endpoint remains disabled/not wired, and no worker process is enabled. Both require the tenant-bound runtime context, dedicated non-BYPASSRLS worker identity, forced RLS policies for the jobs/events tables, and the independent security gates.


### Mirror Node typecheck correction — 2026-11-02 14:32 UTC

- First reconciliation-helper CI failed TypeScript strict-null checks because the transaction list could be empty despite the fallback expression. Added an explicit no-match `PENDING` guard in commit `ef3ee145447bbfa0536a39c5ba92c0fd9e45b4fe`. No tests were weakened. Exact-head CI pending.
- Guardian pre-submit idempotency helper and integration test passed exact-head CI (`41462022847` SUCCESS); Guardian and HCS provider key persistence is now CI-backed.


## 14:33 UTC — CI reconciliation and MRV durable-execution boundary

Exact workflow outcomes rechecked against GitHub Actions job records:
- Run `41462022847`, code commit `9094a4222148bb20690f1f7e8ea7d43b51268e0c`: **SUCCESS**. Includes the Guardian persisted-idempotency-key integration path and the full CI validate job (migration validation/execution, typecheck, build, synthetic two-custodian bootstrap, browser smoke, disposable PostgreSQL tests, production container build).
- Run `41461976164`, code commit `7656471dbab80cc778060b0ebac0019ca088790c`: **SUCCESS**. Includes the Guardian pre-submit idempotency persistence helper.
- Run `41461930332`, docs commit `8a87dd42e007c0ade73cf469324e37ff160478e6`: **SUCCESS**. Documentation checkpoint CI only.
- Current PR #192 head at reconciliation: `ef3ee145447bbfa0536a39c5ba92c0fd9e45b4fe`; exact-head workflow `41462890956` is **IN_PROGRESS**. This head includes subsequent Mirror Node reconciliation and durable enqueue work; the earlier Guardian success must not be attributed to this newer head.
- Current PR #204 head at reconciliation: `06d02107ba9417fb1cdf31d6e49cc985f593b0b7`; exact-head workflow `41462800628` is **IN_PROGRESS**.

### Durable MRV status — precise scope

The branch now contains an immutable/idempotent enqueue helper, atomic lease claim/renew/release/advance primitives, Guardian pre-submit key persistence, HCS transaction-ID pre-submit persistence, and Mirror Node transaction/message reconciliation helpers. Their presence is not equivalent to an operational worker. The synchronous legacy `/api/v1/mrv/activities/:activityId/submit` route still calls external Guardian/Hedera services directly and has not yet been replaced by enqueue → worker → finalize orchestration. No first-class worker process, queue consumer, scheduler or Render background service has been verified. Do not activate one before the signed actor-context contract, exact least-privilege worker principal, forced RLS/job-table policies, tenant-negative tests, and independent DBA/security acceptance.

### Next engineering gate

1. Wait for and inspect exact-head CI `41462890956`; fix any failing test without weakening invariants.
2. Add controlled fault-injection tests for Guardian accepted/response-lost and HCS accepted/response-lost, proving same persisted provider keys/transaction ID are reused and Mirror Node 404 remains pending.
3. Implement the worker orchestration as an injectable, testable process only after route/tenant authorization design is complete; all DB stages must use short transactions and external provider calls must occur outside them.
4. Build actor-bound finalize transaction with exact source/organization/geography revalidation and immutable provenance persistence.
5. Keep the production worker OFF and all production schema/role changes gated pending the 67-table tenant policy and least-privilege runtime-role review.

**No production database or service was changed. Production HOLD; certification OFF; platform-wide TRL 9 NOT ESTABLISHED.**


### Durable enqueue and Mirror Node CI progress — 2026-11-02 14:34 UTC

- Checkpoint/documentation exact-head workflow `41462800628` completed SUCCESS.
- Reconciliation helper's corrected strict-null code commit `ef3ee145447bbfa0536a39c5ba92c0fd9e45b4fe` had a typecheck failure before the correction; the new exact-head workflow `41462918208` for the subsequent source commit is now through typecheck/build and disposable PostgreSQL acceptance, with production-container build in progress. Do not call the full workflow green until it completes.
- Idempotent enqueue implementation/test source commits `c7e0e254b83ac03b30770b49f29f1175eaa13943` and `745e279128a8f0e722e3ee7e0e4389c41759b7de` were covered by CI runs that initially failed due to the same Mirror Node strict-null issue. The corrected branch rerun includes these changes.


### 14:34 UTC — latest-head typecheck failure recorded and repaired

- Exact-head workflow `41462890956` for PR #192 head `ef3ee145447bbfa0536a39c5ba92c0fd9e45b4fe` failed at TypeScript typecheck. The error was isolated to the new enqueue idempotency integration-test block being placed in a `catch` scope, where its fixture variables were not in scope (`TS18004/TS2304`). Migration validation and disposable PostgreSQL migration execution had already passed; downstream build/test steps were skipped.
- Repaired the test in commit `3f771a63d4027629da350a79725193858e1a323d`: enqueue same-payload replay and changed-payload rejection assertions now execute inside the fixture's `try` scope; the `catch` only rolls back and rethrows. No assertion or production security check was weakened.
- PR #192 head is now `3f771a63d4027629da350a79725193858e1a323d`. Exact-head CI has not yet appeared in the commit workflow-run listing at the time of this checkpoint; do not claim this repair passed until its workflow concludes SUCCESS.
- PR #192 remains draft/open. PR #204 remains documentation-only/draft. Production HOLD; no production changes; TRL 9 NOT ESTABLISHED.


### 14:36 UTC — enqueue repair validated; ambiguous Guardian retry test added

- Run `41463161935` for code commit `3f771a63d4027629da350a79725193858e1a323d`: migration validation, restricted verifier-owner provisioning/teardown, disposable migrations, TypeScript typecheck, build, two-custodian bootstrap, browser smoke, and full test suite all **SUCCESS**. Production container build was still running at checkpoint time; do not call the run fully successful until the final job conclusion is SUCCESS.
- Added test commit `af2f3ed19d558bf172326089fa3df0c121465ec0` to simulate Guardian accepting a request while the client loses the response, then retrying with the exact same persisted idempotency key. The assertion requires both attempts to carry the identical key and the retry to recover the authoritative execution ID. Exact-head run `41463406524` was **QUEUED** at checkpoint time.
- Run `41463204727` for docs checkpoint commit `69029ca587ca848497643521359398cc6b0bfa9f`: migration validation, typecheck, build, browser smoke, full test suite passed; production container build still running at checkpoint time.
- No worker runtime is yet verified. Legacy synchronous submit route remains. Do not launch external calls from a background process until signed actor context, exact least-privilege worker role, forced RLS and job-table policies, and tenant-negative tests are accepted.
- Production HOLD; certification OFF; TRL 9 NOT ESTABLISHED. No production changes or external provider writes.


### 14:38 UTC — container build completed; HCS retry/reconciliation regression test added

- Run `41463161935`, code commit `3f771a63d4027629da350a79725193858e1a323d`: **SUCCESS**, including final production container build and job cleanup. This is the exact-head enqueue test scope repair.
- Run `41463204727`, docs commit `69029ca587ca848497643521359398cc6b0bfa9f`: **SUCCESS**, including production container build.
- Guardian ambiguous-response retry test commit `af2f3ed19d558bf172326089fa3df0c121465ec0`: workflow `41463406524`; typecheck, build, browser smoke, full test suite and container build all completed successfully; final job cleanup was still in progress at last poll. This test simulates a response lost after provider acceptance and asserts both requests carry the identical persisted Guardian idempotency key.
- Added HCS Mirror Node regression test commit `a73269dbd46158fddc8822b04e55168b68e28cd6`. It simulates first lookup returning 404/PENDING, then successful indexing, and asserts both reconciliation attempts query the exact same persisted transaction ID. Exact-head CI run `41463738956` is **IN_PROGRESS**.
- PR #204 checkpoint head `805da38c95162cf2cfe48724121ce6f3c3ac7749`, exact-head CI `41463466349`: **SUCCESS**.

**Important limit:** provider retry tests and durable lease/provider persistence primitives are not yet a production worker. The legacy synchronous submit route remains. Worker process/queue consumer, signed actor-bound finalize, tenant-isolated worker principal, forced RLS/job-table policy, complete route-to-data matrix and independent DBA/security review remain release blockers. Production HOLD; certification OFF; TRL 9 NOT ESTABLISHED; no production changes or external provider writes.


### 14:41 UTC — HCS ambiguous-indexing regression verified

- Exact-head workflow `41463738956` for HCS reconciliation test commit `a73269dbd46158fddc8822b04e55168b68e28cd6`: **SUCCESS**. Migration validation, restricted verifier-owner provisioning/teardown, disposable PostgreSQL migration, typecheck, build, two-custodian bootstrap, browser smoke, complete tests including PostgreSQL acceptance, production container build and cleanup all passed.
- Guardian retry workflow `41463406524`: **SUCCESS** with the same complete gate set. Its fault injection confirms retry after a lost response uses the same persisted Guardian idempotency key.
- HCS fault injection confirms first Mirror Node lookup can return PENDING/404, then a subsequent lookup confirms the record while querying the exact same persisted transaction ID. It does not treat 404 as proof of non-submission.
- PR #204 checkpoint commit `7d2bd99930c0cbf477ce9bfadc096f6639e0ae21` records the HCS CI evidence and remains documentation-only.

**Next engineering gate:** introduce a separate, default-disabled durable enqueue API contract while preserving the legacy synchronous endpoint for compatibility. Do not enable it until route authorization, transaction-local signed actor context, job-table RLS, least-privilege worker role, and two-tenant negative tests are independently verified. No worker runtime activation, production DB changes, deployments, or external writes.
