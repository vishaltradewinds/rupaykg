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
| Durable inbox processing | Worker, lease/retry/dead-letter/quarantine/reconciliation tests | Not implemented |
| AI extraction operations | Rate limiting, idempotency, durable jobs, retention and monitoring | Not implemented |
| MRV / Guardian / Hedera | Real execution + consensus + Mirror Node evidence on existing configuration | Not verified in this audit |
| CCTS/CCC issuance | Applicable approved methodology, accredited verification, official ICM Registry evidence | Not proven by this platform audit |
| Production operations | Deployment health, TLS, secret manager, backups, retention, incident response and rollback | Separate acceptance gate |

## 6. Release decision and next execution order

**Release decision: HOLD. Do not merge or deploy this branch as a certified government integration.**

1. Run and repair CI for the exact latest branch head.
2. Add PostgreSQL integration tests for the new audit-chain writer paths and CPCB workspace authorization/status history.
3. Implement the durable inbox worker and reconciliation/quarantine path.
4. Implement route-level rate limits/idempotency and durable job tracking for AI intake.
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
