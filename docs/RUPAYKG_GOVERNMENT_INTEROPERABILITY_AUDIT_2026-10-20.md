# RupayKg — Government Interoperability, Compliance, Audit and Verification Audit

**Review date:** 2026-10-20  
**Repository:** `vishaltradewinds/rupaykg`  
**Review branch:** `intelligence/ai-evidence-intake-middleware`  
**Scope:** Source-level review of the government-data bridge, CPCB SWM workspace, statutory/EPR workflows, authentication/RBAC, audit chain, evidence vault, MRV, Guardian/Hedera adapters, field-device/offline sync, migrations, production configuration, CI and the existing regulatory/conformance documentation.  
**Status:** Engineering remediation in progress. **Production release remains HOLD.** This is not a penetration test, legal opinion, government accreditation, or proof of live integration.

## 1. Executive decision

RupayKg has a substantial internal compliance-support foundation: authenticated organization-scoped routes, source/evidence storage, status histories, statutory applicability, MRV provenance, Guardian/Hedera adapters, a durable government-data inbox, and explicit controls against treating AI output or a calculated result as an issued carbon credit.

However, source code and existing conformance documentation do **not** demonstrate an authorized live CPCB SWM portal integration. The CPCB workspace currently exposes local preparation/read/update operations, not the complete official portal lifecycle or an approved government API connector. The bridge is an inbound signed inbox, not a CPCB/BEE/ICM production connection. These boundaries must remain visible in the product and API.

### Non-negotiable source-of-truth boundary

- **CPCB SWM portal / competent local body / SPCB-PCC / DM:** owns official SWM registration, application decisions, official portal acknowledgements, grievances/appeals and official EBWGR certificate issuance.
- **RupayKg:** may prepare and reconcile evidence, retain user-provided portal references with provenance, create draft reports, flag missing/conflicting records and exchange data only through an approved, documented interface.
- **BEE / Indian Carbon Market:** governs the relevant CCTS methodologies and verification/registry framework. The official registry is operated by Grid Controller of India; validation/verification under CCTS is performed by appropriately accredited Carbon Verification Agencies. A RupayKg measurement, internal verification flag, Guardian result or HCS anchor does not itself issue a Carbon Credit Certificate.
- **Guardian/Hedera:** can provide policy execution and integrity/provenance evidence when the live system and Mirror Node are actually verified. Neither substitutes for government acceptance or an accredited carbon verification process.

## 2. Official workflow and authority mapping

Primary sources reviewed:
- CPCB SWM 2026 portal homepage currently surfaced by CPCB: https://swm.cpcb.gov.in/
- CPCB SWM 2026 user guide referenced in prior workflow mapping: https://swmp.cpcb.gov.in/en/user-guide
- **Host verification gate:** confirm the canonical production hostname, API/export contract and authentication onboarding with CPCB before enabling any connector. Do not infer an API from the public web UI.
- SWM Rules, 2026: https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf
- BEE — Indian Carbon Market/CCTS framework: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=189
- BEE — published list of Accredited Carbon Verification Agencies: https://beeindia.gov.in/view_content.php?lang=1&lid=568

The CPCB portal describes workflows for Bulk Waste Generators, waste facilities, Urban Local Bodies, District Panchayats/Gram Panchayats, SPCBs/PCCs and District Magistrates, including registration, authority review, correction/rejection, appeals, grievances and event intimation. The SWM Rules, 2026 became effective on 1 April 2026. The BWG screening thresholds are alternatives (any one): building floor area at least 20,000 m², water consumption at least 40,000 litres/day, or solid-waste generation at least 100 kg/day. Applicability and reporting still require current rule/norm and jurisdiction checks.

### Workflow conformance snapshot

| Workflow | Repository support observed | Audit result |
|---|---|---|
| Organization identity, membership and RBAC | PostgreSQL-backed session auth; verified membership and permission checks in reviewed handlers | Foundation present; requires endpoint-by-endpoint negative authorization tests |
| CPCB SWM stakeholder workspace | `GET/POST/PATCH /api/v1/cpcb-swm/workspaces`; canonical checklist; eligibility observations; user-reported status source; history and audit writes | **Partial.** Local readiness only; not a CPCB application |
| CPCB application submission/receipt and official status | User-entered application reference/status and source reference | **Not independently verified.** No live portal exchange proven |
| Corrections, amendments, Level 1/2 appeals | Local stage labels/checklist support | **Incomplete.** No full end-to-end case lifecycle demonstrated |
| Grievances and event intimation | Preparation stage labels and documentation | **Incomplete.** No full persisted portal-linked case lifecycle demonstrated in reviewed route |
| BWG annual / facility quarterly and annual return | Statutory/EPR and report-preparation foundations | **Partial.** Exact current portal schema, official receipt and acceptance not proven |
| Official EBWGR certificate | Internal evidence/reference support | RupayKg must not issue or impersonate the local body's official certificate |
| Government-data inbound bridge | HMAC inbox with batch limits, idempotency, PostgreSQL persistence | **Engineering-only.** No official authority API contract, sandbox, onboarding, or live data source verified |
| EPR registration/returns | Internal applicability and return records, external reference capture | **Partial.** A stored external reference is not proof of portal filing/acceptance |
| MRV evidence and Guardian/Hedera | Evidence vault, guarded MRV route, Guardian adapter, HCS anchoring and Mirror Node verification path | **Separate technical gate.** Live execution and real acceptance must be proven independently |
| CCTS methodology and CCC claim | Methodology registry and issuance evidence gate | Guardrails exist; method-specific calculation validation, ACVA verification and ICM Registry issuance remain separate official gates |
| Audit chain | Shared `platform_audit_chain_head` plus audit events; legacy direct writers identified and updated in this branch | Remediation applied to CPCB workspace and field-device writers; full CI/integration confirmation pending |

## 3. Findings and remediation

### G-01 — High: authority impersonation risk in shared-secret government inbox
**Affected:** `apps/src/async-mirror-routes.ts`, `.env.example`, `docs/GOVERNMENT_DATA_MIRROR_BRIDGE.md`.

Previously, a shared HMAC secret authenticated a request and a separate allow-list accepted the claimed authority code. A sender holding that shared secret could claim any allow-listed authority.

**Fix applied on this branch:** The active inbox now requires `RUPAYKG_GOV_BRIDGE_AUTHORITY_CREDENTIALS`, a JSON map from each authority code to a unique secret and an explicit list of permitted municipal codes. The request signature is checked against the key for its claimed authority; out-of-scope municipality codes are rejected. The old shared-secret/allow-list configuration is not accepted by the active route. Tests now cover cross-authority signature reuse and municipality-scope rejection.

**Still required:** Provision real unique secrets through a secret manager, confirm the source authority's identity/onboarding contract, and exercise credential rotation/revocation operationally. Do not put real secrets in Git.

### G-02 — High: audit-chain writers bypassed the shared chain head
**Affected:** `apps/src/cpcb-swm-routes.ts`, `apps/src/sync-routes.ts`, `migrations/084_platform_audit_chain_head.sql`.

CPCB workspace events and field-device enrollment/verification events wrote directly to `audit_events` without locking and advancing `platform_audit_chain_head`. Concurrent writes can fork ordering or leave the head behind security-relevant events.

**Fix applied on this branch:** CPCB workspace and field-device audit writers now lock the durable chain-head row, hash the event using the shared event shape, append the audit event, and advance the head in the same transaction. This is intended to serialize these writers with platform-admin audit operations.

**Still required:** CI and PostgreSQL integration tests must confirm rollback behavior and concurrent append ordering. Reconstruct and verify the stored event hashes from the audit rows in a production-equivalent database; older pre-cutover rows are a historical anchor, not proof that every past event was chained.

### G-03 — Medium: idempotency digest depended on JSON property order
**Affected:** `apps/src/async-mirror-routes.ts`.

Previously the payload digest used `JSON.stringify(request.body)`, which could differ when equivalent JSON objects arrived with a different property order.

**Fix applied on this branch:** The bridge now hashes canonical JSON of the validated/normalized batch for idempotency. The sender HMAC contract remains explicitly bound to the agreed sender serialization. Tests cover property-order independence.

### G-04 — Medium: sync-window timestamp format was too permissive
**Affected:** `apps/src/async-mirror-routes.ts`.

Previously, `Date.parse()` alone accepted a wider set of date strings than a strict API timestamp contract.

**Fix applied on this branch:** The inbox now requires a timezone-bearing RFC 3339-shaped timestamp, validates calendar/time components, and retains the ±7-day freshness window. Tests reject missing time zones, impossible dates and nonconforming formats.

### G-05 — High: no complete official CPCB portal integration demonstrated
**Affected:** `apps/src/cpcb-swm-routes.ts`, `apps/src/statutory-routes.ts`, `apps/src/epr-return-routes.ts`, current conformance documentation.

The reviewed CPCB workspace supports local preparation and status claims; it does not implement the full official application, submission receipt, authority decision, correction, appeal, grievance, event-intimation and certificate lifecycle. The existing workflow documentation references `swmp.cpcb.gov.in`, while CPCB's current public portal search result resolves to `swm.cpcb.gov.in`; both are CPCB subdomains, but the canonical production host and any API endpoint must be confirmed with CPCB before integration. A user-supplied status or reference must not become portal-confirmed by itself.

**Fix approach / release boundary:** Do not invent endpoints, scrape authenticated portal screens, automate CAPTCHA/OTP, replay user credentials or submit forms without authorization. Until CPCB provides a written API/export contract and onboarding, keep the product as preparation, evidence reconciliation, and user-controlled hand-off. Add a distinct evidence-backed state for source-confirmed portal facts only after an authorized reviewer or approved machine interface verifies them.

### G-06 — High: inbox is durable intake, not yet a processing integration
**Affected:** `apps/src/async-mirror-routes.ts`, `migrations/20261022_async_mirror_inbox.sql`.

The inbox stores data and returns HTTP 202. No worker was demonstrated that claims records, maps official identifiers to existing organizations/geographies/activities, normalizes evidence, retries safely, quarantines unmatched data and reconciles outcomes. The response correctly declares that AI processing and Guardian submission have not started.

**Required before operational use:** Implement a durable worker with row-lock/lease or equivalent claim semantics, bounded retries/backoff, dead-letter/quarantine, idempotent processing, operator metrics, original-payload retention and manual reconciliation. Never turn an unmatched or conflicting record into a measurement by inference.

### G-07 — High: AI evidence intake can be repeated and consumes synchronous resources
**Affected:** `apps/src/intelligence-routes.ts`, AI provider adapter.

The route stores source evidence and then invokes inference synchronously. No durable extraction-job/retry record or route-specific rate/concurrency limiter was demonstrated in the reviewed handler. Repeated requests can create duplicate artifacts and consume database/provider capacity.

**Required:** Add idempotency keys, per-identity/per-organization rate limits, bounded provider concurrency/timeouts, durable job states, retry/quarantine and a reconciliation dashboard. Keep raw source evidence immutable and model output review-only. This was not represented as fixed by the bridge changes in this branch.

### G-08 — Medium: CPCB route-level acceptance coverage is incomplete
**Affected:** `apps/src/cpcb-swm-routes.test.ts`.

The existing test file primarily tests checklist, observation and status validators; it does not demonstrate full authenticated route tests for cross-organization access, geography scope, status-history immutability, transaction rollback and audit-chain updates.

**Required:** Add route-level tests using a PostgreSQL integration fixture for unauthorized organization/geography, malformed input, user-reported versus source-confirmed statuses, update history, concurrent writes and rollback.

### G-11 — Medium: CPCB workspace stakeholder type is not bound to the verified organization type

**Affected:** `apps/src/cpcb-swm-routes.ts`, onboarding organization types in `apps/src/auth-routes.ts`.

The workspace handler validates that `stakeholderType` is in a known list, but the reviewed handler does not compare it with the organization's verified `organization_type` or approved stakeholder role. The saved status is explicitly `USER_REPORTED_UNVERIFIED`, so this does not by itself confer official authority; however, it can create misleading internal workspaces where a generator account labels its record as a ULB, District Panchayat or other authority.

**Required fix:** Define and approve a mapping between verified RupayKg organization types/roles and CPCB stakeholder categories. If a user is tracking another party, model that party as a separately verified linked stakeholder instead of relabeling the user's organization. Authority-only workflows must require verified role and geographic jurisdiction. Do not invent mappings where onboarding semantics are ambiguous.

### G-09 — Medium: live Guardian/Hedera acceptance is separate and not proven by source inspection
**Affected:** `apps/src/mrv-routes.ts`, `apps/src/guardian-mrv.ts`, `apps/src/hedera-anchor.ts`.

The code checks activity/verification/evidence binding, authorization, verified evidence and approved verification before submission; it also has a Mirror Node verification path. Static code and mock tests do not prove the deployed Guardian policy is the intended policy, HCS consensus exists on the configured network/topic, or Mirror Node returns the exact committed message.

**Required:** Use the existing configured Guardian services and existing Hedera account/topic; capture real Guardian execution ID/policy result, HCS transaction ID/consensus timestamp, Mirror Node message and integrity-hash comparison, then verify database persistence and retry behavior. No new account/topic/key should be invented to satisfy the gate.

### G-10 — Medium: production readiness and external source-of-truth claims must remain separate
**Affected:** production configuration, API responses, carbon methodology/CCC evidence gates, deployment acceptance.

A green build or passing test suite is not a government integration approval, a methodology validation, an ACVA verification, or ICM Registry issuance. The official CCTS ecosystem assigns verification and registry functions to designated actors; RupayKg must only represent official status after evidence from an authorized source.

**Required:** Keep release fail-closed until source-specific acceptance, method-specific calculations, reviewer separation of duties, audit proof, incident/rollback procedures, privacy/retention controls, and official issuance evidence are tested.

## 4. Changes made in this branch

- Replaced shared government inbox secret + allow-list with authority-specific secret and municipal scope configuration.
- Added route tests for cross-authority signature reuse, municipality-scope denial, canonical idempotency hash, and strict timestamps.
- Consolidated the historical `gov-bridge-routes.ts` into compatibility re-exports of the active implementation to avoid two divergent handlers for the same endpoint.
- Changed CPCB workspace and field-device audit writers to append through the durable shared audit-chain head.
- Updated `.env.example` and government bridge documentation to describe the new contract and its trust boundary.

These are committed to the review branch only. They do not enable a government endpoint or change official records.

## 5. Required acceptance matrix before release

| Gate | Minimum evidence | Status |
|---|---|---|
| Typecheck/build and full CI after latest changes | Green GitHub Actions run on exact final branch head | Pending |
| Authority identity | Distinct credential per authority; cross-authority replay test; key rotation/revocation procedure | Code path updated; real credential onboarding pending |
| Municipality scope | Wrong-scope request rejected before DB write; positive scoped request accepted | Tests added; CI pending |
| Batch idempotency | Reordered-equivalent batch hashes consistently; changed content with same ID conflicts | Tests added; CI pending |
| Timestamp schema | Invalid/no-timezone/impossible dates rejected | Tests added; CI pending |
| Audit-chain integrity | Concurrent CPCB/device/admin appends serialize; rollback does not advance head; verifier can recompute hashes | Code updated; DB acceptance pending |
| CPCB official API | Written authorization, documented schema, sandbox, credentials, source-specific acceptance test | Not provided / not verified |
| CPCB workflow | Applicant and authority lanes, corrections, appeals, grievances, events and reporting periods mapped to official evidence | Partial; incomplete |
| Durable inbox processing | Worker, lease/retry/quarantine/reconciliation, real PostgreSQL concurrency/lease-recovery tests | Worker and unit tests added; staging SQL tested for concurrent disjoint claims (5+5), expired lease reclamation, stale-token fencing, and append-only history; full runner/retry/quarantine runtime pending |
| AI extraction operations | Rate limiting, idempotency, durable jobs, retention and monitoring | DB-backed 10-attempt/identity/organization/minute rate limit added with tests and 48-hour counter cleanup; idempotency, durable jobs and monitoring pending |
| MRV / Guardian / Hedera | Real execution + consensus + Mirror Node evidence on existing configuration | Not verified in this audit |
| CCTS/CCC issuance | Applicable approved methodology, accredited verification, official ICM Registry evidence | Not proven by this platform audit |
| Production operations | Deployment health, TLS, secret manager, backups, retention, incident response and rollback | Separate acceptance gate |

## 6. Release decision and next execution order

**Release decision: HOLD. Do not merge or deploy this branch as a certified government integration.**

1. Run and repair CI for the exact latest branch head, including the new rate-limit migration and tests.
2. Add PostgreSQL integration tests for the new audit-chain writer paths and CPCB workspace authorization/status history.
3. Implement the durable inbox worker and reconciliation/quarantine path.
4. Rate limiting is implemented as a PostgreSQL-backed fixed-window control; next implement idempotency and durable job tracking for AI intake.
5. Obtain written CPCB/source-authority API authorization and schemas before building any live connector.
6. Validate SWM reporting periods and applicable requirements against current official rules/norms and competent jurisdiction.
7. Complete real Guardian/Hedera/Mirror Node acceptance using the existing configuration.
8. Complete independent security review and Shakti production gates before release.

No government system was accessed with credentials, no official submission was made, no official status was altered, and no carbon credit was issued by this work.


## 6. Follow-up remediation — durable intake worker

**Added on the review branch after the initial audit:**

- `apps/src/async-mirror-worker.ts`: bounded PostgreSQL `FOR UPDATE SKIP LOCKED` claims, lease tokens/fencing checks, structural payload validation, deterministic rejection, bounded exponential retry, quarantine after exhausted attempts, and read-only status/age/expired-lease reconciliation.
- `apps/src/government-inbox-worker-runner.ts` and API workspace script `worker:gov-inbox`: one-shot runner using the validated production configuration; aggregate-only logs; no source payload logging.
- `migrations/20261023_async_mirror_worker_leases.sql`: lease, retry, quarantine and internal validation-summary fields/indexes.
- `apps/src/async-mirror-worker.test.ts`: tests for claims, validation, rejection, retry/quarantine and reconciliation.

The worker records only **internal structural validation**. `VALIDATED` is not a CPCB filing acknowledgement, official authority decision, verified MRV measurement, CCTS validation/verification, CCC issuance, or Guardian/Hedera submission. The worker has no code path to mutate authoritative MRV or send an external transaction.

**Deployment is not yet complete:** CI must pass on the final commit; the migration must be applied and tested on a controlled staging database; concurrency/lease recovery must be exercised against real PostgreSQL; and an authorized scheduler must be configured and monitored. No production scheduler has been configured and no production data has been processed by this change. CPCB authorization/API contract and live Guardian/Hedera/Mirror Node acceptance remain separate release gates.


## 7. Follow-up remediation — AI intake rate limiting

Migration `20261024_ai_intake_rate_limits.sql` adds a database-backed fixed-window counter keyed by identity, organization and minute. `consumeAiIntakeRateLimit()` uses an atomic PostgreSQL upsert and permits at most 10 attempts per identity/organization/minute across API instances; requests over the limit return HTTP 429 before source evidence persistence or provider invocation. The table stores counters only, not source logs, prompts, or model output. Automated tests cover SQL shape, scope keys and deny-on-cap behavior. Counter rows older than 48 hours are cleaned during limiter calls. This does not provide idempotency, durable inference jobs, or monitoring by itself. The migration is not applied to production.

## 8. Superseding status addendum — 2026-10-20 12:34 UTC

This addendum supersedes earlier status statements in this report wherever they conflict with the evidence below. The historical findings above are retained as audit history, not as a claim that every original finding remains unfixed.

### Exact review head and automated evidence

- Review branch: `intelligence/ai-evidence-intake-middleware`.
- Audited head at addendum time: `640f6d6656d74aebdc401ea1d8a2c8ae83de72e7`.
- PR #41 remains **open, draft, unmerged and undeployed**: https://github.com/vishaltradewinds/rupaykg/pull/41.
- GitHub Actions run #1484 completed successfully on this head. The workflow reported success for dependency audit, migration validation, migration execution, typecheck, build, browser smoke test, disposable PostgreSQL acceptance tests, production-container build and cleanup.
- Branch validation reports 96 migrations and 78 schema objects. The isolated disposable PostgreSQL API suite passed 144 tests (0 failed, 0 skipped); the focused CPCB route database test also passed. These are engineering test results, not production acceptance.

### G-11 update — stakeholder authorization gate implemented; reviewer governance still open

Commit `640f6d6656d74aebdc401ea1d8a2c8ae83de72e7` adds `migrations/20261026_organization_stakeholder_authorization.sql`, the `organization_stakeholder_authorizations` table, a fail-closed authorization check in `apps/src/cpcb-swm-routes.ts`, PostgreSQL acceptance coverage, and `docs/ORGANIZATION_STAKEHOLDER_AUTHORIZATION_GATE.md`.

CPCB SWM workspace create/update now requires both a RupayKg organization with `verification_status='VERIFIED'` and an exact stakeholder-type mapping whose status is `VERIFIED`, with reviewer identity, verification timestamp, and a non-expired authorization. Missing or mismatched authorization is denied; a BWG mapping does not authorize a PROCESSOR workspace. No stakeholder mappings are seeded automatically. Tests cover missing mapping, non-persistence on denial, and stakeholder-type mismatch.

**Remaining gap:** the reviewer approval/dual-control workflow, reviewer eligibility and separation-of-duties policy, evidence acceptance criteria, revocation process, and independent governance approval have not been completed or operationally validated. This gate is internal RupayKg authorization only. It is not CPCB registration, statutory approval, BEE accreditation, ACVA verification, or government confirmation.

### Other open gates remain open

- The isolated Neon staging branch `br-spring-hill-b4544vz5` still contains inherited inbox records including 8 expired `PROCESSING` leases, plus 1 each in `RETRY`, `RECEIVED`, `QUARANTINED`, and `VALIDATED`. No payloads were inspected and no rows were changed. Worker acceptance remains blocked until an approved, non-destructive triage/isolation procedure is agreed and tested.
- The opt-in worker scheduler is not configured or enabled in production. External log drain, alert destination, escalation ownership and on-call verification remain unproven.
- No authorized CPCB/BEE/Indian Carbon Market API contract, sandbox or production credentials have been verified. No official submission/acceptance or CCC issuance is demonstrated.
- Real Guardian execution, Hedera consensus for the existing configured topic/account (`0.0.10121000` as specified in the project checkpoint), Mirror Node retrieval and matching integrity hash remain unverified. Do not create a replacement topic/account/key to satisfy this gate.
- Production migrations/deployment and explicit production change approval remain separate gates. This PR has not been merged or deployed; migrations added on this branch must not be applied to production as part of this audit update.

### Updated release decision

**HOLD — engineering CI is green, but production certification/release is not authorized.** Keep PR #41 draft, unmerged and undeployed. Next safe order: (1) design and test reviewer approval/dual control using existing auth and audit-chain patterns; (2) prepare a clean disposable PostgreSQL worker acceptance environment and test runner/retry/quarantine lifecycle without mutating inherited staging rows; (3) establish alert delivery and named operational ownership; (4) obtain official authority integration authorization and schemas; (5) perform authorized live Guardian/Hedera/Mirror Node acceptance on existing configuration; and (6) complete independent review and Shakti release gates.

No official government record was changed and no carbon credit was issued as part of this work.


## 9. Engineering continuation addendum — 2026-10-20 13:20 UTC

This addendum records later engineering work and supersedes earlier branch/CI-head statements where they differ.

- The operational worker now supports an optional `RUPAYKG_ALERT_WEBHOOK_URL`. Only HTTPS URLs are accepted; URL userinfo and fragments are rejected; redirects are disabled; requests time out after five seconds; response bodies and URLs are not logged. Alerts contain aggregate counts/error classes only. Unit tests cover configuration rejection, success, non-2xx response, network failure, and redirect policy.
- The worker scheduler emits an explicit `alert_delivery_not_configured` event if no webhook is configured. A delivery result only proves the endpoint response, not that a person received or acknowledged an alert. Human on-call ownership, escalation, and monitoring of webhook failures remain open operational gates.
- `apps/src/server.ts` now invokes the validated production configuration when launched directly with `NODE_ENV=production`, rather than relying only on `production-server.ts` to validate and propagate the TLS/auth/origin contract. This is an accidental-bypass safeguard, not a replacement for deployment access controls.
- The PR description was refreshed to reflect current changes and release blockers.
- CI run #1517 passed all workflow steps on commit `a7ab2ab6ca54b50194f042c19016bdb3c0563c1c`. CI run #1520 caught a strict optional-property typing issue in the alert test; that was corrected. CI run #1522 then passed end-to-end on the updated PR head `77ec579553fed0da495aa751e0f1d716cde7dbc5`, including dependency audit, migrations, typecheck, build, browser smoke test, PostgreSQL acceptance suite and production-container build: https://github.com/vishaltradewinds/rupaykg/actions/runs/39429661985.
- PR #41 remains open, draft, unmerged and undeployed. No production migration, worker schedule, webhook endpoint, government connection, or Guardian/Hedera transaction was activated.

### Updated immediate order

1. Confirm CI #1520 passes on the exact current head; repair any failures and rerun.
2. Complete an isolated, synthetic-only worker lifecycle test with clean disposable PostgreSQL, including restart/retry/quarantine and no unintended record claims.
3. Verify audit-chain serialization/rollback and CPCB authorization/status-history behaviour in PostgreSQL.
4. Wire and verify monitoring/alert delivery in a controlled environment with an accountable human escalation owner.
5. Finish the independent security review, backup/restore, retention/privacy, and production change-control evidence.
6. Keep official API and real Guardian/Hedera/Mirror Node acceptance as separate, explicitly authorized gates. Production remains HOLD until the relevant Shakti approvals and evidence are recorded.


## 10. AI intake rate-limit ledger hardening — 2026-10-20 13:27 UTC

A follow-up review found that a new unique idempotency key could create a PROCESSING ledger row before the rate limiter rejected the request. The source evidence and model call were blocked, but a rate-limited caller could still leave an empty durable job row for each denied unique key.

**Fix applied:** If a newly created job is denied by the fixed-window rate limiter before source evidence is stored, the route deletes that empty job only when its ID and lease token still match, its status is PROCESSING, and `source_evidence_id IS NULL`. Existing retry jobs are marked retryable instead. This preserves lease fencing and prevents denied unique keys from accumulating empty job records.

**Acceptance evidence:** Added a disposable-PostgreSQL integration test that submits ten synthetic requests, confirms the eleventh is rejected with HTTP 429, confirms the provider is not invoked for the denied request, and asserts the job ledger contains only the ten permitted requests. Test cleanup also removes its per-fixture rate-limit counters.

CI run #1525 passed end-to-end on commit `056437963e542fd8fe06116a3f15bf6a46005e33`: dependency audit, migration validation/application in disposable PostgreSQL, typecheck, production build, browser smoke test, full test suite including PostgreSQL acceptance, and production-container build. Run: https://github.com/vishaltradewinds/rupaykg/actions/runs/39430154562.

This is a code/test improvement only. No production database or runtime configuration was changed. PR #41 remains draft, unmerged and undeployed; staging, operational ownership, independent security review and Shakti release gates remain open.


## 11. API lifecycle/readiness hardening — 2026-10-20 13:32 UTC

- Added graceful SIGTERM/SIGINT handling to the API server: stop accepting requests, close Fastify, close the PostgreSQL pool, and enforce a bounded 10-second shutdown timeout. Timeout and shutdown failures are logged without request payloads or secrets.
- Added `GET /health/ready`, distinct from the existing liveness/connectivity `/health` endpoint. Readiness requires the core identity/membership, evidence vault, AI intake jobs, government inbox, stakeholder authorization, audit events, and audit-chain-head tables plus a seeded audit-chain singleton row. Missing DB/schema/anchor returns HTTP 503 and a non-sensitive readiness status.
- Runtime acceptance now checks ready status on a migrated disposable PostgreSQL instance and confirms a no-database instance returns 503 for readiness.
- CI run #1529 passed end-to-end on code head `dcca9ac6ee1a6606013a987299046511936e8c68`: dependency audit, migration validation/application, typecheck, build, browser smoke test, full PostgreSQL acceptance suite and production-container build. Run: https://github.com/vishaltradewinds/rupaykg/actions/runs/39431034419.

The readiness endpoint is a platform-operational signal, not a security certification or proof of official integrations. Production remains unchanged; PR #41 remains draft, unmerged and undeployed.


## 12. Field-sync timestamp contract hardening — 2026-10-20 13:38 UTC

- Field-sync envelope validation now requires a timezone-bearing RFC 3339 capture timestamp, with calendar/time component validation rather than relying on permissive `Date.parse()` alone.
- Unit tests accept UTC and offset-bearing timestamps and reject missing zones, impossible calendar dates, out-of-range time components and incomplete offsets.
- CI run #1532 passed on code head `424fae0233035954c9441c204fa396e8ee0c275c`: dependency audit (0 production dependency vulnerabilities reported), migration validation/application, typecheck, build, browser smoke test, PostgreSQL acceptance tests and production-container build. Run: https://github.com/vishaltradewinds/rupaykg/actions/runs/39431690572.

This narrows timestamp ambiguity in field-device provenance. It does not validate the truth of a measured quantity or grant official MRV status. Production remains unchanged and PR #41 remains draft/unmerged/undeployed.


## 13. Field-sync sequence validation — 2026-10-20 13:43 UTC

- The compatibility endpoint `POST /api/v1/operations/sync` no longer silently substitutes a current timestamp when a caller supplies an invalid `clientSequence`/`sequence`. Explicit values must be positive safe integers; invalid values return HTTP 400 `INVALID_CLIENT_SEQUENCE`.
- Legacy clients that omit the sequence still use the compatibility fallback. New integrations should send a stable positive per-device sequence to preserve collision detection and offline reconciliation semantics.
- Runtime acceptance now asserts that an explicit malformed sequence is rejected before the field-sync intake route is invoked.
- CI run #1535 passed end-to-end on code head `2a13676b8a125f79d22ca697f2945799969c3b76`: dependency audit, migration validation/application, typecheck, build, browser smoke test, PostgreSQL acceptance tests and production-container build. Run: https://github.com/vishaltradewinds/rupaykg/actions/runs/39432120027.

This prevents silently replacing malformed client metadata with an unrelated server time. The compatibility fallback for omitted sequence values remains documented and should be removed only with a versioned API contract change. Production remains unchanged; PR #41 remains draft/unmerged/undeployed.


## Resume checkpoint — 2026-10-20 13:44 UTC

Repository: `vishaltradewinds/rupaykg`; PR #41: https://github.com/vishaltradewinds/rupaykg/pull/41; branch `intelligence/ai-evidence-intake-middleware`. PR remains draft, open, unmerged and undeployed.

Latest code commit: `2a13676b8a125f79d22ca697f2945799969c3b76`. Latest code CI run #1535: https://github.com/vishaltradewinds/rupaykg/actions/runs/39432120027. It completed dependency installation, production dependency audit, migration validation/application in disposable CI PostgreSQL, typecheck, build, browser smoke test, full tests including PostgreSQL acceptance, and production-container build; final job completion was being checked at checkpoint time. Previous fully verified green CI run #1532: https://github.com/vishaltradewinds/rupaykg/actions/runs/39431690572.

Changes since prior checkpoint:
- Strict timezone-bearing RFC 3339 validation for field-sync capture timestamps, with tests for valid UTC/offset timestamps and invalid timezone/calendar/time values.
- API operation sync endpoint now rejects an explicitly supplied invalid `clientSequence` with HTTP 400 / `INVALID_CLIENT_SEQUENCE` instead of silently replacing it with the current timestamp. Added runtime acceptance assertion.
- Prior changes remain: AI evidence-intake durable idempotency and rate-limit ledger cleanup; stakeholder authorization dual control; optional HTTPS alert webhook with redirects disabled; direct-start production config validation; graceful shutdown; schema-aware `/health/ready`; async worker DB acceptance tests; runtime acceptance port collision fix; audit documentation.

Latest audit document path: `docs/RUPAYKG_GOVERNMENT_INTEROPERABILITY_AUDIT_2026-10-20.md`. It has entries covering AI intake rate-limit ledger hardening, graceful shutdown/readiness, and strict field-sync timestamps. It was updated after CI #1532 and before the newest operation-sequence validation commit, so add a fresh note about commit `2a13676...` and CI #1535 when resuming.

Important boundaries: no production deployment/migration/scheduler/webhook activation; do not mutate inherited staging worker rows; preserve existing Guardian/Hedera configuration and account/topic `0.0.10121000`; never claim official government integration, accredited verification, CCTS compliance or Carbon Credit Certificate issuance without external evidence. PR #41 must stay draft/unmerged until applicable gates pass.

Outstanding gates: (1) confirm CI #1535 final conclusion and exact head status; (2) isolated clean staging tests for worker restart/retry/quarantine, audit-chain concurrency/rollback and authorization history without touching inherited records; (3) configure and verify alert delivery with named on-call owner/escalation; (4) independent security, backup/restore, retention/privacy and change-control evidence; (5) authorized official CPCB/BEE/Indian Carbon Market integration contracts/sandbox/credentials; (6) real Guardian execution + Hedera consensus/Mirror Node verification using existing account/topic; (7) methodology-by-methodology CCTS validation, accredited independent verification and official registry issuance; (8) Shakti release approval. Production remains HOLD.

Resume instructions: start by checking CI #1535 at the URL above and fetch current PR head; update this checkpoint with the result, then continue the next engineering/staging gate. Do not stop at status reporting when tools permit concrete work; do not falsely mark the full project finished because CI is green.


## 9. Superseding engineering status addendum — 2026-10-21 07:26 UTC

This addendum supersedes prior CI-status statements above where they conflict with the exact current review-head evidence. Historical findings remain as audit history.

- Exact review head: `b46cf66d7d5b46a50714448ca1c85014036eec42`.
- PR #41 remains open, draft, unmerged and undeployed: https://github.com/vishaltradewinds/rupaykg/pull/41.
- GitHub Actions run #1547 completed successfully: https://github.com/vishaltradewinds/rupaykg/actions/runs/39561745252.
- Successful gates included production dependency audit, migration validation, migration execution against disposable CI PostgreSQL, typecheck, production build, browser smoke test, disposable PostgreSQL acceptance tests, production-container build and cleanup.
- The CI log reported test groups of 154, 22, 2, 29, 1 and 2 tests respectively: **210 passed, 0 failed, 0 skipped** across those reported groups. This is automated engineering evidence only, not production acceptance or independent assurance.
- Added government-bridge regression cases rejecting timezone offsets `+25:00` and `+01:60` before inbox persistence. These run on the exact head above.

### Current disposition

**Engineering CI: PASS for the exact current review head. Production/release certification: HOLD.**

Still not evidenced: controlled staging acceptance on a clean isolated database without touching inherited staging rows; audit-chain concurrent append/rollback verification beyond existing CI coverage; real alert delivery with a named on-call/escalation owner; official CPCB/BEE/Indian Carbon Market API authorization and sandbox; live Guardian execution and Hedera consensus/Mirror Node hash comparison on the existing configured account/topic; method-specific numerical reconciliation and independent accredited verification; official registry issuance evidence; operational privacy/retention, backups, incident response, rollback and explicit Shakti release approval.

No production deployment, production migration, official submission, official status change, Guardian/Hedera transaction, or carbon-credit issuance was performed by this addendum. Keep the PR draft, unmerged and undeployed until the applicable gates are evidenced and approved.


## 10. Superseding engineering status addendum — 2026-10-21 07:32 UTC

This section supersedes earlier CI-status statements above where they conflict with the evidence below. Older findings are retained as historical audit trail.

- Last code-changing review head validated: `4fade6201d0ae51ec3a20d84b15158c20ee4397d`.
- GitHub Actions run [#1550](https://github.com/vishaltradewinds/rupaykg/actions/runs/39562471929) completed successfully on that exact code head.
- The workflow passed dependency audit, migration validation and execution against disposable CI PostgreSQL, typecheck, application build, browser smoke test, PostgreSQL acceptance tests, production-container build and cleanup.
- Test groups reported by CI: 155 + 22 + 2 + 29 + 1 + 2 = **211 passed, 0 failed, 0 skipped**.
- New field-sync hardening requires `clientSequence` to be a positive safe JSON integer. Numeric strings, fractions, zero, negative values, unsafe integers and null are rejected rather than coerced. Tests also reject invalid timezone offset components `+25:00` and `+01:60` in field-sync timestamps.
- The government bridge has equivalent timezone offset-boundary regression coverage.

### Disposition

**Engineering CI: PASS on the last code-changing head. Production release and Shakti certification: HOLD.**

CI does not close the following independent gates: clean controlled staging acceptance without modifying inherited inbox rows; real operational alert delivery with named on-call/escalation ownership; approved government API contracts and credentials; live Guardian execution plus Hedera consensus and Mirror Node hash comparison on the existing configuration; method-specific numerical reconciliation and accredited verification; official registry issuance evidence; and production operations/security/rollback approvals.

No production deployment, production migration, official submission, official status change, live Guardian/Hedera transaction, or carbon-credit issuance was performed. PR #41 must remain draft, unmerged and undeployed until the applicable gates have real evidence and explicit approval.


## 11. Superseding audit-chain remediation and CI addendum — 2026-10-21 07:37 UTC

- Last code-changing review head: `77566556b119705f210461924ba48706aeda61d7`.
- GitHub Actions [run #1552](https://github.com/vishaltradewinds/rupaykg/actions/runs/39563078131) passed on that exact head: dependency audit, migration validation/application on disposable CI PostgreSQL, typecheck, production build, browser smoke test, PostgreSQL acceptance, production-container build and cleanup. Reported test groups: 211 passed, 0 failed, 0 skipped.
- Additional source-level audit found that field-device enrollment/verification audit events in `apps/src/sync-routes.ts` were still using the historical `JSON.stringify` hash format while writing payloads to PostgreSQL `jsonb`. Because JSONB does not preserve JavaScript object property order, that writer did not use the canonical independently recomputable hash format.
- Fixed the field-device writer to use shared `hashPlatformAuditEventV2` canonical recursive JSON hashing and explicitly persist `hash_version=2`. The writer continues to lock and advance the shared `platform_audit_chain_head` in the same transaction. CI passed after this change.

**Disposition remains unchanged:** engineering CI is green; production/release certification is HOLD. Real staging concurrency/rollback evidence, alert ownership and delivery, official government API authorization, live Guardian/Hedera/Mirror Node proof, method-specific accredited verification and official registry evidence, and Shakti production approval remain external/operational gates. No production mutation or official submission was performed.


## 12. Canonical audit-hash regression test and latest CI — 2026-10-21 07:40 UTC

- Code/test head `9d792b69261b0f4592a11c4d30cc3e8ffe924807` passed GitHub Actions [run #1554](https://github.com/vishaltradewinds/rupaykg/actions/runs/39563420238).
- The test suite now includes a regression check that a version-2 audit hash can be independently reproduced from row-shaped event data even when nested JSON object key order differs after JSONB normalization.
- Latest CI test groups: 156 + 22 + 2 + 29 + 1 + 2 = **212 passed, 0 failed, 0 skipped**. Dependency audit, migration validation/application on disposable CI PostgreSQL, typecheck, build, browser smoke, PostgreSQL acceptance, production-container build and cleanup all passed.
- The canonical v2 field-device audit-writer change is included in the tested code head.

**Release status remains HOLD.** Passing CI is not clean staging acceptance, an official government API authorization, live Guardian/Hedera/Mirror Node verification, accredited CCTS verification, official registry issuance, or Shakti release approval. Production was not deployed or migrated and no official submission or credit issuance occurred.


## 13. Follow-up hardening — strict numeric and reporting-period inputs (2026-10-21)

A follow-up source audit found API inputs that were converted with JavaScript `Number(...)`, which can silently coerce numeric strings into measurements. The EPR return, statutory applicability, registry settlement/credential, and MRV/ESG input validators now accept only finite JSON number values in the permitted range. Optional statutory numeric fields retain their existing omitted/null/empty behavior; non-empty invalid values are rejected. Fractional positive measured quantities remain valid where the contract permits them.

The EPR return and BWG reporting-period routes now require real ISO calendar dates in `YYYY-MM-DD` form, rejecting impossible dates and timestamp/date-format substitutions. Regression tests cover numeric strings, non-finite values, zero/negative values, valid fractions, impossible dates, and leap days.

Validation evidence: GitHub Actions CI run #1568 passed on commit `87789f0941ace1d3aeb8211374c67783a6beb44c` (dependency audit, migration validation/execution in disposable CI PostgreSQL, TypeScript typecheck, build, browser smoke test, tests including disposable PostgreSQL acceptance, and production-container build).

This is engineering hardening, not external certification. The PR remains draft and unmerged. Render's live RupayKg service is configured to deploy from `main`; this feature branch has not been deployed. Read-only service diagnostics on 2026-10-21 returned no error/fatal logs for the inspected interval. No production migration/deploy, official submission, live Guardian/Hedera transaction, or carbon-credit issuance was performed. Staging lifecycle acceptance and external approvals/API contracts remain independent release gates.


## 14. Follow-up hardening — field-operation sync inputs (2026-10-21)

The field-operation sync path was also hardened after the route-wide scan found permissive numeric coercion and date parsing for measurement/evidence timestamps. Sync operation quantities and measured values now require finite positive JSON numbers; operation timestamps require valid timezone-bearing RFC 3339 timestamps using the shared validator already applied to sync envelopes. This prevents values such as numeric strings, date-only strings, missing timezones, impossible calendar dates, and invalid offsets from entering through operation payloads.

Regression tests cover numeric-string rejection, positive fractional measurements, impossible timestamps, missing timezones, invalid hour/offset values, and valid leap-day/timezone examples. GitHub Actions run #1572 passed on `8ef247d6556dd5a9a37e9033d2eb90edab0f6142`, including dependency audit, migration validation and disposable PostgreSQL migration, typecheck, build, browser smoke test, full tests/PostgreSQL acceptance, and production-container build.

The audit status remains engineering PASS / release HOLD. Render's existing RupayKg service points to `main`; no feature-branch deployment or production data mutation was performed. The PR remains draft and unmerged pending independent staging, alert ownership/destination, external API/credential, Guardian/Hedera, and statutory verification/issuance gates.


## 15. Government inbox worker boundary and retry hardening (2026-10-21)

The strict sync-window timestamp validator now has regression coverage for impossible calendar dates, invalid hour/minute/second values, fractional-second precision limits, missing timezones, valid positive/negative offsets, and invalid offset hour/minute boundaries. CI run #1577 passed on `c997f73d99c26052c1104550e893a77c1dd0a345`.

A follow-up queue review found that records already at the retry limit could remain in `RECEIVED` or `RETRY`, because the quarantine sweep only considered expired `PROCESSING` leases. The worker now quarantines exhausted unclaimed rows as well as exhausted processing rows with expired or missing lease expiry. Regression coverage was added for this boundary. CI run #1579 passed on `eb2b0a1987155c3a19c2f53286fb15535a36917f`, including dependency audit, migration validation/application in disposable CI PostgreSQL, typecheck, build, browser smoke, PostgreSQL acceptance tests, production-container build, and cleanup.

This remains an internal engineering validation result. No inherited staging inbox rows were changed; no production deployment/migration, official submission, Guardian/Hedera transaction, accredited verification, or credit issuance was performed. PR #41 remains draft and unmerged. Release stays HOLD pending isolated staging evidence, verified alert/on-call routing, authorized official API contracts and credentials, live Guardian/Hedera/Mirror Node evidence, applicable methodology/accredited verification/registry evidence, and Shakti approval.
