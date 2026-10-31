# RupayKg repository architecture and engineering audit — 2026-10-31

## 1. Executive conclusion

RupayKg is a PostgreSQL-centred modular-monolith / modular operating-system architecture for national circular-economy operations. The intended product is broader than a carbon calculator: it combines stakeholder operations, resource-flow capture, evidence-backed MRV, statutory/EPR workflow preparation, carbon methodology and value accounting, registry/settlement controls, field synchronization, and separately governed external trust integrations.

The codebase is substantial and has passed the latest exact-head CI run for the current review branch. This is an engineering pass, not production certification. Production remains HOLD; the worker remains OFF; TRL 9 and pan-India production readiness are not established.

## 2. Audit identity and scope

- Repository: `vishaltradewinds/rupaykg`
- Default branch: `main`
- Review branch: `shakti/atomic-inbox-claim-2026-10-31`
- Review PR: #175 (open, draft)
- Current review head inspected: `672682bbfe0d835494b4321d0836b42b09513436`
- Latest exact-head CI: run #3907 / `41212669395`, SUCCESS on the current review head.
- Earlier worker-code CI: run #3850 / `41204073487`, SUCCESS on `c44e53ba9467eaf6f42cb191f30043825c87624c`.
- PR review surface: 79 files changed, 7,623 additions, 565 deletions; branch comparison reports 249 commits ahead and 1 behind `main`.

The prior repository inventory snapshot recorded 352 tracked blobs: 50 API/server source files, 43 web files, 113 SQL migration files, 73 documentation files, 43 test files, 36 shared-package files and 2 GitHub workflows. This count is a prior inventory snapshot, not a fresh recount at this head.

This audit combines that repository-wide inventory with targeted source, migration, worker, security, deployment, database and test review. It is not an independent line-by-line security certification of every source file, every route, every historical SQL statement, all UI states or every external provider contract.

## 3. Identified architecture

### 3.1 Architectural style

The implementation is best described as a **modular monolith with explicit external-integration and worker boundaries**, not a microservice fleet.

- Web: React, Vite, TypeScript.
- API: Node.js, TypeScript, Fastify.
- Database: PostgreSQL through `pg`.
- Shared packages: domain, carbon, compliance, ESG and intelligence.
- Build/test: npm workspaces, TypeScript, Node test runner and disposable PostgreSQL acceptance tests.
- Runtime packaging: Docker.
- Deployment target described in operations documentation: Render.
- External ledger integration: Hedera SDK, with Guardian policy/MRV integration.

### 3.2 Logical layers

1. **Experience layer:** stakeholder dashboards, guided workflows, mobile/offline field UX and administration views.
2. **API/application layer:** Fastify routes, sessions, authentication, RBAC, organization membership and geography authorization.
3. **Domain layer:** domain model, resource flows, carbon calculations, compliance/EPR, ESG, intelligence/AI, registry and settlement logic.
4. **Evidence and trust layer:** evidence vault, hash/version provenance, verification, methodology/source snapshots, audit trail and approval controls.
5. **Persistence layer:** PostgreSQL is the operational system of record; SQL migrations define schema and integrity controls.
6. **External integration layer:** government/regulatory source adapters, Guardian/Hedera, registry/payment providers and field devices.
7. **System-control layer:** migrations, AI intake jobs, government inbox/leases, reconciliation and separately operated background processing.

### 3.3 Core truth lifecycle

The documented lifecycle is:

`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`

The boundaries are correct and must remain distinct. Local capture is not authority; persistence is not verification; internal value calculation is not credit issuance; internal registry state is not external registration; and settlement requires external confirmation and reconciliation.

### 3.4 System of record

PostgreSQL is the authoritative operational store. Guardian/Hedera is an external trust/anchoring rail, not a replacement for the RupayKg operational database. External responses must be independently verified and must not be fabricated or inferred from local workflow state.

## 4. Implemented capability inventory

- **Core operations:** organizations, identities, memberships, roles, geography, activities, obligations and resource flows.
- **Field operations:** device enrollment/provenance, offline capture, synchronization envelopes, idempotency and conflict handling.
- **Evidence/MRV:** evidence vault, file/content checks, SHA-256 hashes, immutable artifact versions, reviewer controls and verification provenance.
- **Statutory preparation:** CPCB/SWM stakeholder workspaces, BWG profiles/assessment workflows, EPR applicability/returns and regulatory catalogs.
- **Carbon/value:** CCTS methodology registry, methodology governance, calculation provenance, environmental claims and allocations.
- **Registry/settlement:** credential lifecycle, append-only registry events, transfer/retirement, payer/payee controls and external settlement confirmation.
- **External trust:** Guardian/Hedera adapters, policy artifacts, correlation/idempotency concepts and Mirror Node verification code.
- **AI intake:** rate-limit and evidence-intake job schema/flows.
- **Government intake proposal:** asynchronous inbox, hash validation, leases, retry/backoff, quarantine, jurisdiction crosswalk resolution and append-only transition events.

These are implemented code/schema capabilities. Their presence does not prove that all external counterparties, instruments, legal workflows or production operations are live and accepted.

## 5. Latest CI evidence

Current review head `672682bbfe0d835494b4321d0836b42b09513436` has a completed successful CI run #3907 (`41212669395`). The validate job passed:
- production dependency audit;
- migration validator;
- exact production migration baseline reconstruction;
- pre-upgrade schema/verifier capture;
- proposed migration upgrade;
- migration runner idempotency;
- typecheck and build;
- browser smoke test;
- test suite including disposable PostgreSQL acceptance;
- production-shaped evidence artifact upload;
- production Docker image build.

This is controlled CI evidence. It is not a live production migration, live data rehearsal, regulator acceptance, external Guardian/Hedera acceptance, or independent security review.

## 6. Live Neon database inventory — read-only inspection

Neon project: `rupaykg-production-fresh` (`steep-mud-79906940`).

| Branch | Role | Migration rows | Latest version | Public tables | Inbox / crosswalk / source snapshots |
|---|---|---:|---|---:|---|
| `br-restless-base-b44cip2h` (`main`) | Primary/default; authoritative live database | 92 | 20261021 | 67 | Absent / absent / absent |
| `br-young-mouse-b4jhqbci` | New production-derived worker/migration rehearsal | 115 | 20261113 | 78 | Present / present / present |
| `br-spring-hill-b4544vz5` | Government inbox staging | 95 | 20261025 | 71 | Present / absent / absent |
| `br-broad-glade-b46npw8o` | Older rehearsal | 95 | 20261025 | 71 | Present / absent / absent |
| `br-spring-lab-b4hqez2o` | New production rehearsal branch | Not queried; endpoint lookup returned 404 | Unknown | Unknown | Unknown |

Only `main` is the primary/default authoritative live database. The other branches are staging/rehearsal, not competing authorities. Do not promote them or copy them wholesale into production. The new worker/migration rehearsal is a useful controlled validation branch, not the production system of record.

Read-only comparison confirms:
- Production `main` retains migration 096 and all four verifier authorization provenance columns.
- The new production-derived worker/migration rehearsal also has migration 096, the same four columns and the same `prevent_invalid_verification()` function MD5 (`934a7be13f08c034bbd15e96285eb1be`) as production.
- Older staging has no migration 096, none of those four columns, and a different verifier function MD5 (`43e9af83f5031460689f7943d697a50a`).
- Older rehearsal has the four columns and same verifier function as production, but its 096 ledger row is absent; its execution provenance must not be assumed.
- The new rehearsal has the complete 115-row chain through 20261113 and the dedicated event-writer capability role/function. This is useful rehearsal evidence, not approval to apply the chain to production.

### 6.1 Critical database security observation

Read-only catalog inspection on production, staging, older rehearsal and the new worker/migration rehearsal found:
- RLS enabled on zero public tables; zero public RLS policies.
- The inspected Neon `rupaykg` role has `BYPASSRLS`, `CREATEROLE`, `CREATEDB` (and replication privilege in the new rehearsal).
- This is the Neon inspection identity. The actual Render runtime database principal is still unverified; do not assume it is identical.

This is a P1 release blocker. Application-level membership/RBAC/geography checks are useful but are not a database-enforced tenant boundary. Do not switch on blanket RLS. Complete table-by-table policy design, transaction-local identity/organization context, dedicated non-owner runtime roles, actual Render role verification and positive/negative tenant tests first.

## 7. Government inbox architecture and status

The worker is an internal, bounded, asynchronous queue processor. It includes:
- bounded atomic claim using `FOR UPDATE SKIP LOCKED`;
- lease tokens, lease expiry and stale-worker fencing;
- heartbeat renewal and abort on heartbeat failure;
- validator timeout, retries, backoff and exhausted-attempt quarantine;
- canonical payload hash and timestamp checks;
- serializable crosswalk/source resolution;
- per-authority/municipality/source-version advisory locking;
- row locking of approved crosswalk/source snapshots;
- unresolved status for missing/ambiguous/expired/revoked/retired mappings;
- append-only, payload-free transition events.

The latest code tests include concurrent disjoint claims, stale fencing, lease expiry, retry/quarantine, hash/timestamp validation, crosswalk ambiguity and source-scope checks. The current exact-head CI passes.

**The worker is not operationally integrated.** The worker pool factory requires `GOVERNMENT_INBOX_DATABASE_URL` and has no application `DATABASE_URL` fallback, but URL comparison is not proof of a distinct database principal. There is no active long-running worker process, scheduler, cron or HTTP trigger. No dedicated least-privilege worker login has been proven in a live environment. The separate `rupaykg_inbox_event_writer` capability role is present in the new rehearsal, not proof of a production worker identity.

ADR-20261031 leaves the authority scope decision PROPOSED / NOT APPROVED:
- Option A: a national system-level government intake queue with tightly scoped worker access (recommended in the ADR, not approved).
- Option B: organization/tenant-scoped queues.

No worker activation or official source acceptance is established.

## 8. Principal findings and remaining gaps

### P1 — release blockers

1. **Tenant isolation:** no RLS policies in live production; runtime role and complete grants not verified. Implement a table-specific RLS/role strategy only after query-context refactoring and negative tests.
2. **Live migration divergence:** production 92 rows through 20261021; staging/rehearsal 95 rows through 20261025; older rehearsal has out-of-band UNRESOLVED schema effect without ledger provenance. Preserve production 096. Do not replay, edit ledgers or copy schemas blindly.
3. **Production migration governance:** candidate now removes implicit migration-on-start, separates one-off production migration, verifies TLS and requires explicit approval/change/backup evidence plus exact 92-row baseline identity. Keep this control; no production run is authorized.
4. **Worker authorization:** authority scope ADR not approved; worker login/role/grants and actual least privilege not proven; no worker activation.
5. **Regulatory rule provenance:** BWG statutory assessment still uses hard-coded thresholds and does not bind to an APPROVED rule-version/source snapshot row. Treat as internal preparation only.
6. **Source-snapshot dual control:** database does not yet enforce that source retriever and reviewer are distinct active/verified identities.
7. **External trust idempotency:** Guardian returned correlation/idempotency matching and Hedera ambiguous-submit recovery are not independently proven. Timeout-after-acceptance could cause duplicate HCS submission without provider reconciliation.
8. **Government interoperability:** no live official CPCB/BEE source contract, signed authority transport, government acknowledgement or regulator acceptance is demonstrated.

### P2 — important production hardening

9. Identity registration/login: email/contact verification, password recovery assurance, privileged-role MFA and IP/device-aware abuse/rate limiting remain incomplete.
10. Evidence vault: malware scanning/quarantine, stronger parser isolation, object-storage lifecycle/retention and scale/throughput tests remain outstanding.
11. Stakeholder taxonomy: `BASELINE_SUPPORTED` must never be mistaken for CPCB registration, statutory approval or organization authorization; exact official source/version review remains required.
12. Operational assurance: verified backup restore, SLOs, alerting, incident drills, rate limits, secrets rotation, support/retention/privacy and rollback rehearsal need evidence.
13. Hardware/IoT: approved device models, firmware/PCB/BOM, calibration/metrology, environmental/safety approvals, provisioning/key rotation, field trials and maintenance evidence are not established by this repository audit.
14. Pan-India readiness: national data-model design exists, but verified completeness and freshness of all India state/UT/district/local-body directories, statutory applicability, languages, support and service performance are not proven.

## 9. TRL / Shakti Standards assessment

- **Software:** controlled laboratory/CI validation only; provisional evidence is approximately TRL 4–5, not a formal independent assessment.
- **Hardware/IoT:** NOT ASSESSED / NOT ESTABLISHED.
- **Integrated national service:** NOT ESTABLISHED.
- **TRL 9:** NOT ESTABLISHED.
- **Production certification:** BLOCKED / evidence incomplete.

TRL must be assessed separately for software, hardware and the integrated service. Passing CI cannot be inherited as hardware or national-operational TRL evidence.

## 10. Recommended target architecture and execution sequence

1. Keep one authoritative production database: Neon primary/default `main`. Label all other branches explicitly as staging, historical rehearsal or disposable rehearsal. Never allow multiple branches to be described as production authorities.
2. Maintain the modular-monolith core while keeping government intake, scheduled jobs and external adapters as separately deployable processes with independent service identities.
3. Complete the route × table × permission inventory and verify the actual Render DB role. Then implement dedicated API runtime, migration, read-only operations, and worker identities; design RLS per data class and test cross-tenant denial.
4. Resolve migration history with evidence: preserve production migration 096, document older rehearsal 20261101 provenance, and use the new production-derived rehearsal to verify exact migration chain, data compatibility, function/trigger behavior, rollback and restore.
5. Approve the worker authority scope ADR, source scope model and source-snapshot separation-of-duties controls. Prove least privilege using the actual worker login before deployment.
6. Bind BWG/EPR statutory preparation to versioned approved rule/source records. Keep internal preparation labels distinct from official determinations and filings.
7. Prove Guardian/Hedera correlation, provider idempotency, ambiguous timeout recovery and Mirror Node reconciliation before describing external anchoring as complete.
8. Complete real source integrations, field-device calibration and field trials, operational monitoring, privacy/retention, incident response and independent validation.
9. Conduct separate Shakti/TRL gates for software, hardware and integrated service. Only then consider production certification and TRL9.

## 11. Safety and change record

- All Neon SQL inspection for this audit was read-only.
- No live production/staging/rehearsal DDL, data mutation, migration replay, role/grant change, worker activation, deployment or certification action was performed.
- PR #175 remains open and draft. Current exact-head CI is green, but the PR is a large review surface and still requires independent review and migration/release gates.
- Production remains HOLD; worker/scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.

This report is an engineering architecture and evidence assessment, not legal advice, independent security certification, regulator acceptance or production authorization.
