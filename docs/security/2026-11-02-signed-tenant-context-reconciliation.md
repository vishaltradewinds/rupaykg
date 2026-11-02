# Signed tenant-context integration reconciliation — 2026-11-02

## Purpose

Track safe integration of PR #205 (`shakti/signed-request-tenant-context-bridge-2026-11-02`) onto the current authentication/bootstrap foundation in PR #192. This checkpoint is an engineering record, not approval to merge, enable RLS, or alter production.

## Exact Git evidence

- PR #192 head: `c48d3e274acadb22db9968f894278786c1a74d89`
- PR #192 branch: `shakti/auth-bootstrap-application-integration-2026-11-01`
- PR #205 head: `e1f1c952d6d1e24e8e8bd522fa3a4fbcc482901e`
- PR #205 base: `e34536c0fec929b02640cf1cfb79a3a28d47d4f3`
- Compare: PR #192 current head is 74 commits ahead of PR #205's recorded base; the base is therefore stale.
- PR #205 exact-head Actions lookup returned zero workflow runs. This is NOT a passing CI result.
- Exact-head CI observed on PR #192 current head: run `41475438403`, success.

## File overlap requiring a real rebase/merge

PR #205 changes eight files. Six also changed in PR #192:

1. `.env.example`
2. `apps/src/auth.ts`
3. `apps/src/production-config.test.ts`
4. `apps/src/production-config.ts`
5. `apps/src/production-server.ts`
6. `apps/src/server.ts`

The two PR #205-only additions are:

7. `apps/src/tenant-db-context.test.ts`
8. `apps/src/tenant-db-context.ts`

Do not overwrite the six overlapping files with the old PR #205 snapshots. Resolve each file against the current PR #192 versions, preserving the newer authentication/bootstrap changes and integrating only compatible tenant-context changes. Re-check imports, initialization order, pool ownership, and route registration after reconciliation.

## Integration sequence

1. Rebase PR #205 onto the current PR #192 head using a normal Git rebase/merge workflow; inspect and resolve all six overlaps.
2. Keep request-context mode explicitly `disabled` by default. No production activation.
3. Prove the auth resolver is called once per request and that the validated AuthContext is cached only for that request.
4. Confirm every protected route module and every direct pool consumer receives the context-aware pool. Explicitly account for excluded sync routes, internal delegation, webhook routes, scheduled jobs and worker processes.
5. Add real PostgreSQL integration tests using restricted application/auth roles. Fake-pool tests are useful unit tests but do not prove PostgreSQL transaction-local GUC behavior, RLS, role grants, or connection-pool isolation.
6. Test concurrent tenant A/B requests, connection reuse, nested transactions/savepoints, error/timeout/connection loss, rollback, revoked sessions, missing/malformed/expired signatures and bilateral settlement rejection.
7. Validate verifier schema, key table, function owner and grants on a disposable Neon clone, never production.
8. Run exact-head GitHub Actions CI after the rebase. Record run URL, commit SHA, job conclusions and test summary.
9. Obtain independent DBA/security review before any migration or runtime-mode change.

## Production database boundary

Read-only production baseline in Neon project `rupaykg-production-fresh`, primary branch `main`:

- 67 public tables.
- 0/67 tables have RLS enabled.
- 0/67 have FORCE RLS enabled.
- Production login role `rupaykg` has BYPASSRLS, CREATEROLE and CREATEDB.

The policy matrix is still a draft. The application runtime role, table owner, migration principal, authentication role and SECURITY DEFINER owner must be distinct and least-privileged. Do not apply broad RLS policies or use the privileged owner as the app runtime.

## Disposition

- PR #205: keep open; dependency reconciliation and exact-head CI required.
- PR #192: keep in its existing review posture; do not merge based solely on CI.
- Production Neon: read-only; no DDL, DML, grants, role changes, secrets or migrations.
- Production certification: OFF / HOLD.
- TRL 9: NOT ESTABLISHED.

## Acceptance evidence to attach

- Rebased commit SHA and resolved-file review.
- Exact-head CI run with all required jobs successful.
- PostgreSQL integration test report under exact proposed runtime roles.
- Complete route/worker-to-table/function coverage matrix.
- Two-tenant negative test results.
- Independent DBA/security approval and rollback rehearsal.


## Source-level integration review — follow-on

The PR #205 patch was inspected against the current PR #192 snapshots. The following are verified patch-level deltas and review requirements:

- `apps/src/auth.ts`: PR #205 adds a request-keyed `WeakMap`, an exported cache setter, and a cache read at the start of `authenticate`. The current PR #192 implementation has no such cache. Preserve PR #192's current authentication resolver and membership logic; port only the cache behavior after proving the Fastify request lifecycle cannot retain stale auth across reuse (Fastify request objects are per request) and that null results are intentionally cached.
- `apps/src/production-config.ts`: PR #205 adds a strict `disabled | enforced` parser with default `disabled`. This is a small additive delta, but the returned type and tests must be updated together.
- `apps/src/production-config.test.ts`: PR #205 adds default-disabled, explicit-enforced and invalid-mode tests. Preserve the current PR #192 production contract assertions.
- `apps/src/production-server.ts`: PR #205 forwards the mode, secret and key ID to the server process. Preserve the existing validated TLS/auth configuration and ensure no secret is logged or exposed to the browser.
- `.env.example`: PR #205 adds a documented `RUPAYKG_REQUEST_CONTEXT_MODE=disabled` default. Keep this disabled until all security gates pass.
- `apps/src/server.ts`: This is the highest-risk overlap. PR #205 wraps the domain pool, introduces a raw pool, conditionally registers Fastify hooks, adds production database-verifier/role probes, and changes pool shutdown to close the raw pool. These hunks must be reconciled against the latest PR #192 pool/auth startup and production assertions; do not copy the old whole file.
- PR #205-only files `tenant-db-context.ts` and `tenant-db-context.test.ts` are additive candidates, but they are not production assurance by themselves.

### Newly identified behavior requiring explicit negative tests

1. `registerRequestTenantContext` skips non-`/api/v1/` paths, `/api/v1/operations/sync`, and requests without a bearer header. Inventory these bypasses and prove each is either intentionally public/authenticated elsewhere or covered by a dedicated worker/device principal.
2. Bilateral settlement paths are explicitly rejected with `RLS_BILATERAL_CONTEXT_UNSUPPORTED`. This is fail-closed and should remain so until the two-party policy is independently approved.
3. Authentication is resolved before the request transaction is opened. Verify that this is safe with the separate auth runtime role and that the context-aware pool does not accidentally scope the auth resolver query.
4. The context-aware pool redirects `pool.query` and `pool.connect` only while AsyncLocalStorage has a request context. Prove propagation from the Fastify callback-style `preHandler` completion into every asynchronous route handler and downstream callback.
5. Route-local `BEGIN/COMMIT/ROLLBACK` are translated into savepoints. Add tests for nested failure recovery, unsupported transaction commands, open savepoints at response time, release-with-error, and connection loss.
6. `onSend` commits for status codes below 400 and rolls back for 400+. Test response serialization failure, streaming/aborted responses, thrown errors and hooks ordering; never allow a response to claim success if transaction finalization fails.
7. The startup verifier check inspects RLS presence and SECURITY DEFINER ownership/grants. It must be validated against actual disposable Neon runtime roles and schema, not merely mocked catalog rows.

### Integration decision

The patch is not ready to be transplanted as a mechanical six-file overlay. Proceed only with a conflict-aware merge/rebase in a normal Git environment, then run the exact-head CI and disposable-PostgreSQL test suite. No production setting change is authorized by this review.


## Existing repository foundation discovered in the current PR #192 head

A further repository-tree pass found that PR #192 already contains a first-generation signed RLS transaction boundary and an opt-in PostgreSQL integration test:

- `apps/src/rls-request-transaction.ts` exports `withRlsRequestTransaction`. It validates a single active organization backed by a VERIFIED membership, rejects bilateral context, opens one client transaction, installs the signed transaction-local `app.request_context`, invokes the operation on that client, and commits/rolls back before releasing it.
- `apps/src/rls-request-transaction-postgres.integration.test.ts` tests transaction-local context clearing on pooled connection reuse and rollback. It is skipped when `DATABASE_URL` is absent; therefore its existence is not evidence that it ran in CI or against PostgreSQL.
- `apps/src/rls-request-transaction.test.ts` supplies unit-level coverage.
- The route SQL inventory already documents 90 HTTP route declarations and 218 direct query/connect call-site indicators in the core route/server/auth cohort; it explicitly says the signed helper is not yet used by those modules.
- The worker runtime inventory found no dedicated queue consumer, cron or background worker entrypoint; API field sync/offline queue is present. Treat worker support as unproven, not implemented.

### Architecture decision required before transplant

PR #205 introduces a second, broader mechanism: `createContextAwarePool` + `AsyncLocalStorage` + Fastify hooks + implicit transaction/savepoint translation. The existing helper instead uses an explicit callback receiving one `PoolClient`. These are two different transaction integration models.

Do not combine them or enable both by default. The safer initial integration path is to adapt one representative, lower-risk route to the existing explicit `withRlsRequestTransaction` contract, preserving the route's single checked-out client for every protected query. Measure the refactor and test it end-to-end before deciding whether the implicit pool proxy is necessary. This avoids silently translating existing route-level transaction boundaries across the entire application before behavior is proven.

### Suggested staged implementation gate

1. Select one representative read-only or simple single-organization route with no bilateral, sync-device, admin, streaming or nested transaction semantics.
2. Refactor that route to obtain validated AuthContext, call `withRlsRequestTransaction`, and execute every tenant-owned SQL statement through the provided client; do not leave helper calls using the global pool inside the transaction callback.
3. Add route-level tests for missing auth, no active organization, unverified membership, tenant A/B isolation and query failure rollback.
4. Run the existing PostgreSQL integration test and new route-level integration test against a disposable Neon branch with the exact restricted runtime role and a minimal test policy/table.
5. Only after this passes should the same explicit-client pattern be extended to the next route cohort. Keep auth lifecycle, public catalog, platform-control and bilateral settlement paths separately classified.
6. Revisit PR #205's proxy only if a measured migration plan proves the explicit-client refactor is impractical; if chosen, it must replace—not duplicate—the first-generation transaction abstraction and must pass the full route/worker matrix.

No route has been modified in this checkpoint. This is an architecture finding and sequencing decision, not a code-completion claim.


## Mobile-executable parallel audit batch — 2026-11-02 16:04Z

This batch used GitHub repository/API access only. The authorized Desktop Commander device was checked and remained OFFLINE (last seen 72 hours ago). No local shell, browser, build, PostgreSQL integration, Neon write, Render mutation or deployment was attempted.

### 1. Canonical integration branch CI recheck

- PR #192 head: `c48d3e274acadb22db9968f894278786c1a74d89`.
- Exact-head GitHub Actions run: `41475438403` / run #4840 — **SUCCESS**.
- This is a verified CI result for the current PR #192 head, not production acceptance and not proof that the separate optional local PostgreSQL test ran against the authoritative production database.
- PR #192 remains draft and open. No merge or deployment is authorized by this result.

### 2. Stakeholder dashboard / pilot demonstration source audit

The existing `docs/pilot/STAKEHOLDER_DASHBOARD_ROUTE_MATRIX.md` maps the current frontend/backend surfaces for platform administration, onboarding, ULB, waste/resource operations, evidence, MRV, CPCB/SWM, EPR, statutory applicability, carbon/methodology, registry, settlement, ESG/BRSR, intelligence, field devices and multilingual UX.

Important demo boundaries retained:
- CPCB/SWM preparation records are not proof of CPCB portal submission or acceptance.
- EPR internal submission/external reference is not proof of an external portal receipt.
- Local evidence review is not Guardian/Hedera verification.
- Registry issuance is blocked absent real independent verification, Guardian VERIFIED, HCS consensus and Mirror Node verification.
- Internal settlement state is not proof that money moved or that both counterparties authorized it.
- Carbon calculations/eligibility are not production credit issuance.
- Synthetic fixtures must be visibly labelled and isolated from production.

The matrix is source-level mapping, not end-to-end role acceptance. The next evidence unit is a role-specific walkthrough backed by persisted server state and cross-tenant/cross-geography negative tests, not another dashboard panel.

### 3. MRV asynchronous execution readiness

The repository contains draft migration `migrations/20261109_durable_mrv_submission_jobs.sql` with an idempotent job ledger, activity/evidence/verification composite bindings, lease fields, provider state, retry states and event history. However:
- The migration itself states it is not deployed.
- It deliberately contains no grants, RLS, worker SECURITY DEFINER functions or production role changes.
- The worker runtime inventory found no dedicated worker/queue-consumer/cron entrypoint or Render worker service.
- Therefore a durable MRV queue/worker is not yet an operational capability. Do not enqueue real pilot work or claim automated Guardian→Hedera→Mirror processing.
- Before implementation, reconcile the migration's dependency on the signed geography helper, add exact least-privilege worker role and claim/lease functions, tenant RLS, idempotent provider submission/reconciliation, dead-letter and recovery tests, and a separate worker deployment/runbook. Run it only against disposable PostgreSQL until independently reviewed.

### 4. Parallel work register — mobile-safe vs. machine-dependent

| Workstream | Mobile-safe work completed/available | Machine-dependent gate |
|---|---|---|
| Tenant isolation | Compared existing explicit transaction helper with PR #205 proxy model; documented staged decision | Rebase/refactor, route integration, concurrency and PostgreSQL tests |
| Auth/bootstrap | Reviewed PR #192 source and latest exact-head CI | Production role provisioning, founder-approved two-custodian ceremony, independent review |
| Stakeholder UI/pilot | Audited existing role/surface map and external-truth labels | Browser role walkthroughs, responsive/accessibility testing, persisted API acceptance |
| MRV/Guardian/Hedera | Inspected draft durable-job schema and missing worker runtime | Implement worker, provider adapters, real testnet proof, retry/recovery and Mirror verification |
| Database/RLS | Read-only production baseline and table policy draft already documented | Complete route/table/function matrix; disposable two-tenant policies and migration rehearsal |
| Field sync/IoT | Source inventory and security requirements documented | Hardware connectivity, device signatures, RS232/weighbridge tests, offline replay under real conditions |
| Regulatory/EPR | Source-level feature surfaces and evidence boundaries documented | Effective-date/source verification and actual external portal/API receipts |
| Release/TRL | CI result and current HOLD boundary recorded | Backup/restore, rollback, production SLO/monitoring, pilot acceptance and independent TRL evidence |

### 5. Resume trigger when Desktop Commander returns online

1. Re-check device status and repository branch/head before touching files.
2. Confirm PR #192 head still matches the recorded SHA; fetch latest before any rebase.
3. Create an isolated working branch from the current PR #192 head.
4. Implement one representative, low-risk, single-tenant route using the explicit `withRlsRequestTransaction` callback and one checked-out client for every protected query.
5. Add route-level positive/negative tests; run typecheck/build and the real disposable-PostgreSQL integration suite.
6. Only after that evidence passes, expand to the next route cohort. Keep bilateral settlement, platform administration, authentication lifecycle, sync/device and public catalog outside the first slice.
7. Keep PR #205 and request-context mode disabled until a single transaction architecture is selected and full route/worker semantics are tested.

**Current boundary:** mobile source/documentation audit advanced; no application code was changed in this batch. Production remains HOLD, worker activation OFF, certification OFF, and TRL 9 is not established.


## TRL and pilot-demonstration evidence reconciliation — 2026-11-02 16:05Z

### Evidence delta since the 2026-11-01 provisional TRL assessment

The earlier TRL note references an incomplete/failed PR #192 run at code head `003f4e29...`. The current PR #192 head is `c48d3e274acadb22db9968f894278786c1a74d89`, and its exact-head CI run `41475438403` completed SUCCESS. This is a genuine positive engineering-evidence update. It does not invalidate the earlier recorded failure at its historical head; it supersedes it for current-head CI status.

The current PR #192 branch description reports its latest integrated test evidence as including disposable migrations, typecheck, build, two-custodian bootstrap, reviewer/geography PostgreSQL acceptance, browser smoke, full test suite and production container build. Treat those as CI-reported test stages for the branch's exact-head successful run; retain the run as the authoritative execution record.

### TRL decision — no score increase

Keep the previous conservative system-level assessment at **TRL 3** pending real operational demonstration. The new CI result strengthens laboratory validation only. It does not prove:
- A live production tenant with a least-privilege runtime identity and enforced table RLS.
- Real Jabalpur facility onboarding, measured material flow and calibrated weighbridge/sensor evidence.
- Real field-device enrollment, secure sync and offline conflict resolution.
- Live authorized Guardian submission, Hedera HCS consensus and Mirror Node verification.
- CPCB/EPR/CCTS portal acceptance or legally valid external acknowledgements.
- Bilateral settlement authorization and actual payment/financial reconciliation.
- Sustained operations, incident response, backup restoration and independent field evaluation.

### Pilot demonstration acceptance ledger

| Demonstration claim | Required evidence before presenting as achieved | Current classification |
|---|---|---|
| National/platform overview | Persisted data, platform authority permission, audit trail and freshness metadata | UI/source surface exists; end-to-end acceptance pending |
| Stakeholder onboarding | Two-custodian initial authority ceremony; identity proof; approved application; geography-bound reviewer chain | CI synthetic acceptance exists; production ceremony not performed |
| ULB/local command centre | Verified ULB identity, ward/geography scope, persisted resource flows and negative cross-geography test | UI/source surface exists; real ULB pilot not accepted |
| Waste handover / mass balance | Calibrated instrument record, source/destination custody signatures, timestamps, unit normalization and discrepancy workflow | API/UI source exists; real measured chain not evidenced |
| Evidence vault | Original bytes/hash, uploader and reviewer identities, version lineage, access-denial tests and retention evidence | Source/UI exists; full security/operational acceptance pending |
| MRV | Approved methodology version, activity/evidence lineage, uncertainty and independent verification | Partial software/lab evidence; no real independent MRV acceptance |
| Guardian/Hedera | Actual Guardian workflow response, HCS transaction ID/consensus timestamp and Mirror Node proof linked to exact evidence tuple | Not verified; never show a synthetic/placeholder status as live |
| CPCB/SWM | Authoritative submission receipt, portal reference and accepted/rejected response from authorized channel | Internal preparation only; no portal acceptance evidence |
| EPR | Actual authorized portal submission and acknowledgement, separately reconciled to internal return | Internal return/external-reference recording only |
| Registry issuance | All methodology, evidence, independent verification, Guardian, HCS and Mirror gates, with issuer authority | Blocked until all gates pass |
| Bilateral settlement | Two party-specific authorizations, credential ownership proof, immutable reconciliation and external payment evidence if claiming payment | UI/source exists; bilateral RLS and real payment not verified |
| Field sync | Enrolled device certificate/key, signed envelope, replay protection, tenant binding and offline conflict acceptance | Source/UI exists; physical-device acceptance pending |
| ESG/BRSR | Traceable source evidence, approved calculation basis, reviewer and assurance state | Reporting surface exists; audited disclosure not established |

### Demo truthfulness controls

For the pilot presentation:
- Use separate demo tenant/database; do not seed synthetic rows in production.
- Put a persistent `DEMO / SYNTHETIC DATA` label on every screen, export and screenshot containing fixtures.
- Distinguish `prepared`, `submitted internally`, `externally acknowledged`, `independently verified` and `issued/settled` as different states.
- Display evidence timestamps, source, responsible organization, verification authority and freshness.
- Show unavailable external integrations as `NOT CONNECTED` or `NOT VERIFIED`; never use green success badges for simulated responses.
- Include a live negative-path demonstration: user from tenant B cannot read tenant A evidence; reviewer outside assigned geography cannot approve; unverified evidence cannot advance to registry issuance.
- Use only real authorized pilot data after consent, lawful basis, security controls and site acceptance have been documented.

### Immediate mobile-safe follow-up

Before any further UI feature work, complete a source-level action matrix for the demo-critical slice (onboarding → ULB → resource flow → evidence → MRV → CPCB/EPR → registry gates). For every action record actor, permission, organization/geography scope, API route, SQL objects, transaction boundary, audit event, external dependency, positive test and negative test. The existing 90-route inventory is a baseline, not a completed matrix.

**Decision:** keep TRL 3 system-level, production HOLD, certification OFF and pilot status PRE-VALIDATION until the evidence above is independently demonstrated.


## Follow-on mobile audit — authorization inventory and policy design blockers (2026-11-02 16:16Z)

### Source evidence reviewed

Read the full route-to-data authorization draft on the current PR #192 code head, the hierarchical reviewer authority hardening record, the TRL assessment and the stakeholder dashboard route matrix. This is source/document review only; no database was queried or changed in this batch.

### Additional findings that must govern RLS design

1. **67-table ownership register is provisional, not policy-ready.** The existing route audit enumerates all 67 live production base-table names and proposed ownership classes, but many rows explicitly remain pending FK/column verification. Do not translate the CSV directly into RLS policies. First extract exact live columns, FK graph, unique constraints, triggers, views, functions, JSON ownership references and all query call sites for each table.
2. **At least four data families require multi-party or non-tenant scope models:** `chain_of_custody_links`, `epr_credit_transfers`, `credentials/registry_events`, and `resource_flows`; settlements are also bilateral. A generic single `organization_id` policy will either leak records or block legitimate counterparties. Model party membership and permitted action per lifecycle state, with database-enforced source/destination ownership and immutable transfer events.
3. **Unverified geography default is a policy blocker.** The existing geography helper returns true when an organization has no verified geography roots. For a regulated national platform, this compatibility behavior must not be interpreted as unrestricted national authority. Proposed safe default: onboarding/read-only access until a verified and approved geography scope exists; allow only explicitly enumerated national/platform authorities through separate capability grants. This is a design recommendation, not an implemented production rule.
4. **Identity and platform governance are not ordinary tenant tables.** Identity sessions/password material, platform audit chain heads, access-change requests, schema migrations and reserved roles require narrow auth/governance/migration paths. Tenant runtime should have no direct read/write privileges to secret identity material, migration metadata or platform-only audit chain state.
5. **The route audit confirms transaction consistency risk can exist even before RLS.** EPR return submit and external-reference handlers were previously found to check `epr:manage` via the pool while mutating through a checked-out client. A targeted PR code fix binds both checks to the same PoolClient. This fix is not a substitute for tenant context/RLS and its exact historical CI run must not be misrepresented as current-head verification.
6. **Hierarchical reviewer hardening is a separate positive laboratory control.** Organization type is now bound to authority tier; a verified ordinary processor cannot gain regulator access by spoofing a role label. Restricted search_path geography helper references were schema-qualified. The exact historical code head's CI passed, but production still has no RLS and no live authorities.

### Required policy design deliverables before any RLS migration

- A canonical schema manifest generated from the authoritative production schema (tables, columns, PKs, FKs, indexes, constraints, triggers, views, routines, owners and grants), reviewed against the latest migration head.
- A per-table access matrix with principal class, read/create/update/delete, ownership path, geography rule, append-only rule, cross-party exception, service-worker access and explicit deny cases.
- A per-routine manifest for every SECURITY DEFINER function: owner, fixed search_path, schema qualification, EXECUTE grants, caller/actor derivation, dynamic SQL review, and transaction assumptions.
- A cross-table integrity suite proving child rows cannot reference another tenant's parent even when the caller knows a valid foreign UUID.
- A dedicated multi-party policy design for transfers, resource flows, credentials, registry events and settlements; do not weaken single-tenant rules to make these work.
- A documented no-verified-geography state and explicit onboarding-only behavior.
- A disposable PostgreSQL acceptance matrix using exact restricted runtime roles (NOBYPASSRLS, not owner, no inherited function-owner privileges), at least two tenants and disjoint geographies, plus worker/device and bilateral counterparties.
- A separate backup/restore and rollback rehearsal, independent DBA/security review, and signed release approval before production migration.

### Current decision

No RLS migration is ready for production. Do not enable RLS with generic policies, do not grant the existing broad `rupaykg` owner to runtime, and do not assume a signed transaction-local context alone provides data isolation. Production remains HOLD; TRL 3 system-level; certification OFF.


## Follow-on MRV job-ledger security review — 2026-11-02 16:16Z

Reviewed the full draft `migrations/20261109_durable_mrv_submission_jobs.sql`, the signed-context verifier migration, the geography helper migration, the explicit RLS transaction helper and the sync/registry route source. Static source review only; no migration was executed.

### Positive controls already present in the draft

- Composite foreign keys bind activity, organization and geography; evidence to activity; verification to evidence and activity.
- Enqueue trigger requires completed activity, VERIFIED evidence, APPROVED independent verifier distinct from activity actor, and geography helper acceptance.
- Immutable request tuple, constrained state machine, lease-required transitions, append-only event mutation guard and provider HCS transaction uniqueness are present.
- The signed-context verifier rejects malformed, expired, overlong and invalid HMAC context and returns no claims on exceptions.
- The request transaction helper binds signed context with transaction-local `set_config(..., true)` and commits/rolls back before returning the pooled connection.

### MRV migration blockers before a worker can be implemented or enabled

1. **Lease fencing is incomplete at the schema contract level.** The update trigger requires an unexpired old lease for most state changes and a fresh lease when claiming, but it does not itself prove that the caller presents the same lease token currently stored on the row. A worker repository/claim function must atomically compare job id + lease token + lease owner + expiry on every heartbeat and transition; stale workers must be unable to overwrite a newer claimant. Test lease expiry/reclaim races with two concurrent workers.
2. **No restricted worker execution contract is included.** The draft defines tables and trigger functions but does not create a least-privilege worker role, claim/heartbeat/transition functions, table grants or RLS policies. Do not give a worker broad UPDATE access to job/provider columns or SELECT access to every tenant's evidence. Prefer narrowly scoped functions that atomically claim eligible work and enforce lease-token equality.
3. **Trigger function execution context needs hardening.** The job validation/update/event trigger functions use default invoker execution and mostly unqualified object references/default search_path. Before granting worker access, set a safe fixed search_path (`pg_catalog, pg_temp`), schema-qualify all application relations and explicitly test function ownership/grants. Do not turn these into SECURITY DEFINER functions without a dedicated NOLOGIN NOBYPASSRLS owner and independent review.
4. **Geography validation inherits an unsafe compatibility default.** The enqueue guard calls `organization_has_geography_scope`; the current helper returns true if the organization has no VERIFIED geography roots. This means the job migration's geography check does not establish a verified geography scope for such an organization. Change the approved policy semantics before deployment: no verified scope must fail regulated MRV enqueue, except an explicitly authorized national authority path.
5. **Enqueue caller authorization is not proven by this trigger.** The trigger checks activity/evidence/verification bindings but does not prove the submitting identity is an active verified member with permission to request MRV submission for that organization. The API boundary and/or narrowly scoped DB function must derive actor from authenticated context and re-check membership, permission, geography and revocation atomically at enqueue and before every external provider side effect.
6. **Provider state and evidence freshness require reconciliation rules.** Guardian result, Hedera transaction, consensus timestamp and Mirror digest fields need strict validation against provider responses and the immutable payload hash. A status field or caller-supplied JSON must never be sufficient proof. Define canonical serialization, hash/signature validation, network/topic allowlists, callback authentication, duplicate/out-of-order response handling and reconciliation for provider timeout after remote success.
7. **Event history is not yet a complete audit contract.** Current event trigger records status/selected provider changes and classifies worker activity based on lease presence. Define event coverage for claim, heartbeat, lease expiry/reclaim, cancellation, retry scheduling, provider request/response, reconciliation and operator override; actor identity must be authenticated, not inferred solely from a non-null lease field.
8. **Operational worker runtime is absent.** There is no accepted dedicated worker/cron runtime, deployment, health/readiness, concurrency cap, dead-letter operator workflow, alerting, key rotation or disaster-recovery runbook. A SQL job ledger alone is not an operational queue.
9. **Migration dependency and replay test remain open.** Rehearse this migration only after its exact prerequisite migrations and schema objects are verified on a disposable PostgreSQL database. Test clean install, repeated application/idempotency, rollback, pre-existing index collisions, trigger replacement, concurrent enqueue, duplicate provider response and restore.

### Explicit worker acceptance gate

Before any real pilot job can be enqueued:
- Dedicated API and worker roles are separate, both NOBYPASSRLS and neither owns tables or inherits the verifier function-owner role.
- Two-tenant + disjoint-geography RLS integration tests pass for enqueue, list, claim, provider update, event read and retry/reconciliation.
- Claim and transition are atomic, lease-token fenced and concurrency-tested with two workers; expired/stale worker writes fail.
- Provider adapters use idempotency keys and reconcile remote-success/local-timeout without duplicate submissions.
- Only verified evidence and an independent APPROVED verifier are accepted; revocation and evidence state changes are rechecked before each external side effect.
- Guardian VERIFIED, Hedera consensus and Mirror Node proof are persisted from authoritative provider evidence and tied to exact payload/evidence digest.
- Retry, permanent failure, dead-letter, manual reconciliation and operator override all produce immutable attributable events.
- Worker deployment, secrets, key rotation, observability, alerts, backup/restore and incident runbook are reviewed.
- Disposable PostgreSQL and provider sandbox evidence passes; independent security/DBA review signs off.

### Related route integration caution

The explicit `withRlsRequestTransaction` helper is a safe narrow foundation, but the current sync and registry modules still use direct pool reads and their own transaction wrappers. A future route migration must ensure authentication, permission lookup, membership, geography and all protected reads/writes occur on the same checked-out transaction client. Do not wrap an existing `BEGIN/COMMIT` handler around a second transaction helper or leave permission checks on the pool. Bilateral registry transfers and settlements need their own multi-party policy rather than a single-org token.

**Decision:** MRV job migration remains draft/not deployed; worker activation and live pilot enqueue are prohibited. Production remains HOLD, certification OFF, and TRL 3 system-level.


## Follow-on registry, settlement and field-sync source audit — 2026-11-02 16:16Z

Static review of `apps/src/registry-routes.ts` and `apps/src/sync-routes.ts` at PR #192 code head `c48d3e274acadb22db9968f894278786c1a74d89`. Findings below are review blockers to validate with targeted tests and schema constraints; they are not proof of an exploit in a live production system.

### P0 — settlement confirmation can overstate external financial truth

The settlement `/settle` handler checks state and permissions, writes `EXECUTING`, appends an event, then immediately writes `RECONCILING`. No payment rail/provider call or authoritative transaction status is visible in this route. The `/confirm` handler accepts caller-supplied `confirmationReference` and `reconciliationReference`, checks uniqueness and state, then writes `SETTLED` and `external_confirmed_at=now()`. It does not itself validate those references with a bank/payment provider or authoritative reconciliation source.

**Required disposition:** keep this workflow labelled internal `RECONCILIATION_PENDING` (or equivalent) until a verified external settlement adapter proves funds movement. A user-supplied reference is evidence metadata, not proof. Only a provider-authenticated, idempotent callback/reconciliation record with amount, currency, payer, payee, credential, timestamp and immutable provider transaction identity may authorize the financial `SETTLED` state. Add forged-reference, duplicate-callback, callback-signature, wrong-amount, wrong-party, timeout-after-success and replay tests. Until then, stakeholder demos must explicitly state that no money movement is performed or verified by this route.

### P0 — current bilateral authorization is not independent two-party consent

Settlement creation requires the same authenticated `AuthContext` to act for both payer and payee and requires that same context to have `settlement:authorize` for both parties. Later authorization and settlement operations likewise check both parties using the same caller. This is not a two-custodian/two-counterparty approval protocol: it can reject legitimate separate counterparties and does not prove that payer and payee independently approved the same immutable terms.

**Required disposition:** define separate payer-side and payee-side authorization records bound to a canonical settlement terms hash (credential, payer, payee, amount, currency, fees, expiry and external reference). Require distinct verified actors with current party-specific permissions; prevent one identity from satisfying both sides unless a separately approved legal/business rule explicitly permits it. Any change to terms invalidates both approvals. Add cross-party impersonation, one-party-only, same-actor, revoked-membership and concurrent-modification tests.

### P1 — credential transfer recipient acceptance and registry owner derivation

The transfer route checks source/current owner authority and confirms the destination organization has some VERIFIED membership, then changes credential status and appends a transfer event. The route does not show destination-party consent or a verified receiving actor accepting the exact transfer. Current-owner derivation is based on the latest ISSUED/TRANSFERRED event, so the DB constraints and ordering semantics must guarantee deterministic ownership under concurrent transfers and legacy rows.

**Required disposition:** require a destination acceptance record by a distinct authorized recipient, bind both parties to the transfer terms hash, enforce one current owner at the database boundary, use deterministic event sequence/locking, and reject stale or concurrent transfers. Verify no organization can infer ownership from a caller-provided UUID.

### P1 — field-device authorization must be transaction-bound and tenant-bound

The sync module has a helper `requireFieldDevice(pool, auth, deviceId)` that performs a direct pool query, while other sync operations use checked-out clients and local transaction wrappers. This query must not be left outside the same transaction/tenant context as device ownership, cursor, envelope and operation writes once RLS is enabled. Device lookup must bind both verified device identity and owning organization, and every envelope must be checked against the device's current organization, current identity, key/certificate status, replay cursor and revocation state at apply time.

The activity/resource-flow sync code also checks geography through `organization_has_geography_scope`; the current no-verified-roots=true compatibility behavior means these route checks do not by themselves establish a verified national/ward authorization scope. Treat missing geography as denied for regulated writes until a separately approved national authority capability is verified.

### Registry issuance gate — preserve the strong fail-closed controls

The credential issuance route does check completed activity, issuer ownership, VERIFIED evidence, APPROVED verification distinct from activity actor, and persisted Guardian VERIFIED + Hedera consensus + Mirror Node proof before issuing. This is a valuable fail-closed control. It must remain bound to the exact evidence/payload/provenance digest and be covered by cross-tenant, revoked-membership, stale-owner and concurrent-issuance tests after RLS integration. The route-level control does not replace database-enforced isolation.

### Stakeholder demonstration truth labels

- `CREATED`, `AUTHORIZED`, `EXECUTING`, `RECONCILING` are internal workflow states, not proof of funds transfer.
- Do not display `SETTLED` as a real financial outcome until the authoritative provider reconciliation gate is implemented and verified.
- Credential `TRANSFERRED` must not imply recipient acceptance until the recipient authorization record exists.
- Registry issuance may only be described as real when its Guardian/Hedera/Mirror evidence is genuine, traceable and independently reviewable.
- All demo screenshots/exports must show whether data is synthetic, internal, externally acknowledged or independently verified.

**Decision:** settlement and transfer flows remain non-production/engineering-only pending the above; do not claim two-party settlement or actual money movement. Production remains HOLD and certification OFF.


## MRV source-evidence correction and provenance digest binding — 2026-11-02 16:18Z

This section supersedes any earlier blanket statement in this checkpoint that the repository lacks lease-token-fenced job helper functions.

### Corrected source inventory

At PR #192 head `c48d3e274acadb22db9968f894278786c1a74d89`, `apps/src/mrv-submission-jobs.ts` already implements:
- Atomic single-job claim using `FOR UPDATE SKIP LOCKED`, a random lease token and bounded 10–900 second lease.
- Stage advance guarded by job id + exact lease token + unexpired lease; lease is cleared in the same update.
- Persisted Guardian idempotency key and Hedera transaction ID under the same live lease fence.
- Explicit lease release and renewal helpers.
- Pre-provider reauthorization helper checking organization/identity status, active verified membership, role permission, activity/evidence/verification binding, independent verifier and geography helper.

These are meaningful source-level controls. They do not establish that a production worker invokes them correctly, that database permissions prevent bypass, or that concurrency tests pass against a real disposable PostgreSQL instance. The earlier concern is therefore narrowed: the TypeScript lease helpers exist; the worker runtime, restricted DB execution boundary, schema-level fencing and real integration evidence remain to be proven.

### New P0/P1 provenance integrity finding

`apps/src/mrv-routes.ts` builds the Guardian request using the full ordered observation and evidence rows. However, the synchronous HCS anchor call currently constructs an `AnchorPayload` containing activity, verification, evidence IDs, Guardian policy/execution, methodology, the latest quantity/unit and a small Guardian status metadata object. It does not include the full observation snapshot, evidence content hashes/URIs, or the durable job's `payload_hash`.

The durable enqueue path separately computes `payload_hash` over its canonical `payload_snapshot`, including observations and evidence, but the currently inspected synchronous HCS call does not pass that digest into the anchored payload. Thus the on-chain hash verifies the narrower AnchorPayload, not necessarily the complete MRV source snapshot that was sent to Guardian.

**Required fix before calling the HCS anchor a complete MRV evidence anchor:**
1. Define one versioned canonical MRV evidence manifest containing all accepted measurement/observation values, units, methods, instrument identities/calibration references, uncertainty/quality metadata, evidence content hashes, capture times, verification identity/decision, methodology/version and organization/geography provenance.
2. Canonicalize and hash this manifest once; persist the exact canonical bytes or immutable canonical representation and SHA-256 digest before external side effects.
3. Send that exact manifest or digest + schema/version + immutable evidence references to Guardian; require the Guardian execution response to bind to the same digest (or persist a cryptographically verifiable request/response correlation).
4. Anchor the same digest, schema version and exact Guardian execution ID to HCS. Do not recompute from a smaller, separately assembled object.
5. On Mirror Node verification, compare the anchored digest to the persisted canonical manifest digest and re-hash the retrieved canonical bytes. Fail closed on missing, stale, substituted or malformed evidence.
6. Add mutation tests: change one observed value, unit, instrument, uncertainty, evidence hash, timestamp, methodology version or verifier identity and prove the digest changes and prior provenance cannot be reused.
7. Test duplicate request, Guardian timeout-after-success, HCS timeout-after-success, Mirror indexing delay and replay while preserving the exact original digest and provider idempotency identities.

### Related synchronous MRV route concerns

- The legacy `POST /api/v1/mrv/activities/:activityId/submit` path performs Guardian and HCS calls directly in the request path, independently of the durable queue feature flag. Keep it explicitly classified as a legacy synchronous path; do not infer that the queue flag disables all provider submissions.
- In the inspected legacy path, the route checks approved verification and verified evidence but does not visibly require `verifier_identity_id <> activity.actor_identity_id` or recheck the verifier's active independent-review authority in the route's binding query. The durable job reauthorization helper does include the distinct-verifier check. Require parity tests and enforce independence in the legacy path before it can remain enabled.
- The legacy route uses a session-level advisory lock and a checked-out client for several reads/provider writes but does not wrap the complete operation in an explicit transaction or signed tenant-context helper. A session lock is not tenant isolation. Route integration must be designed before enabling database RLS.
- The EPR return list/create handlers currently perform authorization through a pool query and data access/mutation through pool calls outside a single explicit request transaction. The EPR submit/external-reference handlers do use a checked-out client and transaction for their main mutation. Under RLS, list/create need the same signed request transaction/client boundary; no permission check should escape to the pool.

### Corrected MRV status statement

Durable job claim/lease/idempotency helper functions exist in source. The migration remains draft/not deployed, and no accepted worker service/runtime or real disposable-PostgreSQL acceptance evidence has been established in this audit. Complete manifest digest binding, legacy-path independence, tenant-bound worker execution and full route integration remain release blockers.
