# RupayKg Immutable Engineering Checkpoint — 2026-10-31 15:27 UTC

## 1. Identity and status
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`
- Pre-documentation HEAD: `f51acf7fcf5a8730e0e15d115a119f87b02a05b2`
- PR #175: OPEN / DRAFT; base `main`; head branch above. Not merged.
- PR #161: OPEN / DRAFT; stacked against `shakti/integrate-government-inbox-worker-2026-10-31`; shares the same head branch. Do not merge separately without stack reconciliation.
- PR #173: OPEN / DRAFT; separate authoritative database/repository cleanup stream. Do not merge independently without migration and scope reconciliation.
- PR #160: read-only runtime DB-role diagnostic candidate; not deployed. Do not infer runtime principal from it.
- Exact-head CI for pre-documentation HEAD: run #3928 / ID `41214689174`, workflow CI, COMPLETED / SUCCESS.
- This checkpoint and its companion resume-pointer commits will create a new HEAD and trigger/require a new exact-head CI check. Do not transfer the above SUCCESS status to the documentation commit.

## 2. Product purpose and architecture
RupayKg is intended to become pan-India national environmental infrastructure supporting evidence-backed waste/environmental operations, statutory and EPR workflows, digital MRV, and governed environmental-value/registry workflows. National scope is the target; individual pilots are evidence sites, not the product boundary.

Current architecture is a PostgreSQL-centred modular monolith:
1. Stakeholder experience: ULBs, Gram Panchayats, BWGs, Collectors, enterprises, processors, auditors, platform administrators; mobile/offline field capture.
2. Application/API: React + Vite + TypeScript frontend; Node.js + Fastify + TypeScript API; authentication, sessions, RBAC, membership, geography and workflow authorization.
3. Domain packages: waste/resource flows, compliance/EPR, carbon/MRV, ESG, evidence, intelligence/AI, registry and settlement.
4. Evidence/trust: artifact vault, hashes, provenance, verification, methodology/rule snapshots and audit history.
5. PostgreSQL operational system of record.
6. External adapters: official regulatory sources, Guardian/Hedera, registries, payments and field devices.
7. System control: migrations, government inbox, offline sync, reconciliation and controlled workers.

Keep this modular-monolith architecture unless measured evidence justifies service decomposition. Do not create competing authoritative databases.

Truth lifecycle must remain explicit:
`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`.
These states are not interchangeable. A field record, database write, evidence hash, calculation, verification, credit issuance, external registration or settlement requires its own evidence.

## 3. Mandatory engineering standards
- Shakti Standards applies to every relevant workstream: context/reality discovery, evidence, statutory boundaries, feasibility, validation, solution selection, design, engineering, testing, approval, certification, deployment, operation, measurement and continuous assurance.
- Golden Rule: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**
- TRL must be assessed with evidence separately for software, hardware, integrated service and operational deployment. TRL 9 is not established.
- Indian statutory requirements (CPCB, SWM, EPR, CCTS as applicable) remain distinct from voluntary integrity benchmarks. ICVCM Core Carbon Principles are complementary only.
- No claim of regulator acceptance, certification, credit issuance, Hedera consensus, external registry confirmation, payment settlement, nationwide operation or TRL 9 without independent evidence.

## 4. Work completed and repository records
### 4.1 Worker reliability and atomic processing
- Heartbeat renewal failure is normalized to `LEASE_RENEWAL_FAILED`; worker abort/retry behavior is tested.
- Atomic bounded queue claim uses `FOR UPDATE SKIP LOCKED`.
- Lease tokens/expiry and stale-worker fencing; heartbeat renewal; abort on heartbeat failure; validator timeout; retry/backoff; exhausted-attempt quarantine.
- Canonical payload hash, timestamp and metadata validation.
- Serializable source/crosswalk resolution and scoped advisory/row locks.
- Ambiguous, missing, expired or revoked mappings remain unresolved.
- Append-only, payload-free transition events.
- Tests cover concurrent disjoint claims, fencing, expiry, retry/quarantine, payload validation and crosswalk ambiguity.
- These are code/test foundations only. No live worker/scheduler/cron/HTTP trigger or approved production worker identity has been proven or activated.

### 4.2 Architecture and security decisions
- `docs/architecture/ADR-20261031-government-inbox-worker-authority-scope.md`: hybrid architecture selected as review baseline, not production approval.
  - National layer ingests public government source data and maintains source versions/crosswalks.
  - National worker may access only named queue/source snapshots/crosswalk/resolver capabilities.
  - It must not read private tenant evidence or measurements.
  - Minimal dispatch envelope routes to tenant-bound downstream workflows.
  - Tenant consumer revalidates identity, membership, organization, jurisdiction, rule version and evidence.
- `docs/security/PRODUCTION_AUTHORIZATION_RLS_GAP_ASSESSMENT_2026-10-31.md`: production authorization/RLS gap.
- `docs/security/DATABASE_IDENTITY_PRIVILEGE_MATRIX_2026-10-31.md`: intended separation of API, migration, worker, event-writer and read-only operations identities.
- `docs/engineering/INTEGRATED_MIGRATION_WORKER_RELEASE_PLAN_2026-10-31.md`: ordered migration and worker release gates.
- These are design/assessment artifacts. They do not mean security controls are implemented or signed off.

### 4.3 Repository continuity and prior audits
- `AGENTS.md` is mandatory: every session starts by reading the latest resume/checkpoint, verifying exact branch/HEAD/PR/CI, rechecking Neon and Render, recording preflight before writes, and updating an immutable checkpoint plus latest pointer after each coherent batch.
- Architecture audit: `docs/engineering/RUPAYKG_REPOSITORY_ARCHITECTURE_AUDIT_2026-10-31.md`.
- Earlier Gate 1 inventory: `docs/engineering/GATE1_DATABASE_SECURITY_PRELIMINARY_INVENTORY_2026-10-31.md`.
- Prior checkpoint history is retained; never rewrite historical checkpoint files.

## 5. Authoritative database — current recheck
- Neon project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative production branch: `main`, ID `br-restless-base-b44cip2h`; currently primary/default/ready.
- Other branches (government inbox staging, migration rehearsal, worker rehearsal) are non-authoritative. Do not promote, reset or delete them merely because their migration count/schema is newer.
- Read-only query to database `rupaykg`: `session_user=rupaykg`, `current_user=rupaykg`, 67 public base tables, 0 RLS-enabled tables, 0 public policies, 92 migration rows, max version `20261021`.
- Role previously inspected has elevated attributes (including BYPASSRLS/CREATEROLE/CREATEDB and membership in Neon superuser); this inspection role is not suitable as routine API/worker identity.
- The current session principal is the Neon inspection connection; it does not prove Render's runtime principal.
- Neon branch protection currently reports `protected=false`; project history retention is 21,600 seconds (6 hours). Independent restore rehearsal is NOT VERIFIED.
- No production DDL/DML, role/grant/credential changes, migration, branch promotion/deletion, backup-setting change or deployment was performed.

## 6. Runtime and deployment verification
- Render inspection was blocked because no workspace is selected in the connected account. The tool requires user selection; no workspace was guessed or selected.
- Therefore deployed Render service, production deployment commit, environment's actual Neon target and runtime DB principal are NOT VERIFIED in this checkpoint.
- PR #160 diagnostic is not deployed; it cannot be used as proof of runtime identity.

## 7. Migration and tenant-security blockers
- Production migration ledger: 92 rows through `20261021`.
- Production migration 096 verifier authorization provenance must be preserved: `authorization_membership_id`, `authorization_role_id`, `authorization_permissions_snapshot`, `authorization_checked_at`; observed verifier function hash previously recorded as `934a7be13f08c034bbd15e96285eb1be`.
- Repository migration-file history and rehearsal histories have known divergence. Do not copy a newer rehearsal schema wholesale, rewrite migration ledgers, renumber migrations or apply a selected migration to make counts match.
- Prior catalog inventory: all 67 public tables owned by `rupaykg`; 23 have direct `organization_id`, 8 have direct `identity_id`, 3 overlap, and 39 have neither direct key and require FK/participant/global classification.
- RLS is not enabled on any of the 67 public tables. No public RLS policies observed. Database-enforced tenant isolation is therefore NOT ESTABLISHED.
- Plain caller-controlled custom GUC identity/tenant context is not an acceptable standalone security boundary.
- Need full route × SQL × table × operation × principal × tenant-context map, including child FK ownership, views, triggers, functions, sequences, grants, default privileges, background jobs and offline sync.
- Table-specific RLS and least-privilege roles require disposable production-shaped tests, positive/negative tenant isolation, pooled-connection tests, adversarial context-forgery tests and independent review.
- Production backup/restore RPO/RTO and a restore rehearsal remain unverified.

## 8. Release posture and TRL
- Production release posture: HOLD.
- Government inbox: code foundation exists; operational activation NOT DONE.
- Tenant isolation: NOT ESTABLISHED.
- Render runtime principal: NOT VERIFIED.
- Backup/restore assurance: NOT VERIFIED.
- Official CPCB/BEE source contract, signed transport, acknowledgement and regulator acceptance: NOT PROVEN.
- Guardian/Hedera code presence is not proof of external anchoring/consensus; end-to-end correlation, ambiguous-submit recovery and duplicate prevention remain unproven.
- Hardware/IoT approvals, calibration, field trials and national operating support remain NOT ASSESSED/NOT ESTABLISHED.
- Earlier provisional software estimate around TRL 4–5 was an internal estimate only, not formal independent assessment. Hardware and integrated national service TRL are NOT ESTABLISHED. TRL 9 NOT ESTABLISHED.

## 9. Exact session preflight record
See `docs/engineering/session-logs/2026-10-31-1527-utc-resume-checkpoint-preflight.md`.
- Pre-documentation branch HEAD was verified as `f51acf7fcf5a8730e0e15d115a119f87b02a05b2`.
- CI run #3928 / ID `41214689174` completed SUCCESS for that exact SHA.
- PR #175 is OPEN/DRAFT and not merged.
- Neon evidence and Render limitation are detailed in the preflight record.

## 10. Explicitly NOT DONE
- No production deployment, schema migration, data mutation, role/grant change, RLS activation or worker activation.
- No Render runtime role/service verification.
- No branch protection change or independent backup restore proof.
- No independent review/approval of ADR, security model or migration reconciliation.
- No full route-to-database authorization matrix or complete table classification.
- No proof of official regulator acceptance, credit issuance, registry settlement, nationwide operation or TRL 9.
- No deletion of obsolete files, tables, roles or database branches.

## 11. Ordered next executable plan
1. **Render identity gate:** ask user to select the correct Render workspace, then read service list/deployments without exposing secrets. Identify deployed service, commit, database host/database name and actual runtime role through a controlled non-public diagnostic. Do not change env vars.
2. **Production resilience gate:** document current backup/PITR/snapshot capabilities, retention, RPO/RTO and independent restore rehearsal. Obtain explicit approval before changing production protection settings.
3. **Authorization inventory:** finish route × SQL × table × operation × principal × tenant context matrix; include every route module, repository/query helper, FK child path, views, triggers, functions, sequences, defaults and worker/sync/reporting paths.
4. **Data classification:** classify all 67 production tables as tenant-owned, identity-owned, multi-party, global reference/control-plane, append-only audit/evidence or maintenance-only. Document owner/participant semantics and deny-by-default exceptions.
5. **Least-privilege design:** approve separate API, migration, worker, event-writer and operations identities. Prototype signed request context or compare tenant-specific identities; reject plain GUC-only enforcement.
6. **Disposable rehearsal:** build a fresh production-derived disposable branch, preserve migration 096, reconcile exact migration SQL bytes and ledger/schema differences, test forward-only migrations and rollback/recovery plan.
7. **RLS implementation proposal:** table-specific policies and FORCE RLS decisions with cross-tenant negative tests, pooled connection leakage tests, revoked membership tests, forged context tests and immutable evidence protections. No production changes before independent review and explicit authorization.
8. **Worker operationalization:** separate least-privilege worker identity, minimal queue grants, hybrid scope boundary, tenant-scoped consumer revalidation, monitoring/alerting, idempotency, recovery and approval.
9. **National assurance:** authoritative CPCB/BEE statutory sources and source contracts, Guardian/Hedera external verification, field hardware approvals/calibration, operational drills, pan-India coverage evidence and formal Shakti/TRL assessment.
10. After each coherent batch, run targeted tests and exact-head CI, update this resume pointer and create a new immutable checkpoint. Keep PRs draft until independent review and all release gates pass.

## 12. Resume instruction
Next session: read `AGENTS.md`, this checkpoint and `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md`; verify branch and exact HEAD/CI/PR; ask the user to select the correct Render workspace before inspecting Render; then execute step 1 above. Do not restart with a generic audit, do not switch branches silently, and do not change production.
