# RupayKg — Latest Engineering Resume Point

> This file is the current hand-off pointer. Read `AGENTS.md` first. Update this file at the end of every coherent batch.

## Snapshot
- Checkpoint date: 2026-10-31
- Repository: `vishaltradewinds/rupaykg`
- Active review branch: `shakti/atomic-inbox-claim-2026-10-31`
- Latest recorded branch HEAD: `571aef12d9dbe54389ec50b8c80c1d5bbfab355a`
- Review PR: [#175](https://github.com/vishaltradewinds/rupaykg/pull/175) — OPEN, DRAFT; do not merge.
- Exact-head CI: run #3908 / ID `41213087762`, commit `571aef12d9dbe54389ec50b8c80c1d5bbfab355a`; status COMPLETED, conclusion SUCCESS; job `validate` SUCCESS.
- Previous exact-head run #3907 / ID `41212669395` passed for the preceding head. Run #3908 supersedes it for the current recorded head.
- Architecture audit: [RUPAYKG_REPOSITORY_ARCHITECTURE_AUDIT_2026-10-31.md](./RUPAYKG_REPOSITORY_ARCHITECTURE_AUDIT_2026-10-31.md).
- Audit report commit: `571aef12d9dbe54389ec50b8c80c1d5bbfab355a`.

## Product and architecture decision
RupayKg is intended as **pan-India national environmental infrastructure** for evidence-backed environmental operations, statutory/EPR workflows, digital MRV and carefully governed environmental value/registry workflows. The current engineering architecture is a **PostgreSQL-centred modular monolith** (React/Vite/TypeScript web; Fastify/Node/TypeScript API; PostgreSQL; shared domain packages; controlled workers and external adapters). Retain this architecture unless evidence demonstrates a real need to change it.

## Authoritative database — single source of truth
- VERIFIED from read-only Neon inspection: Neon project `rupaykg-production-fresh`.
- Sole authoritative production branch: `main`, branch ID `br-restless-base-b44cip2h`.
- At inspection: 92 migration ledger rows (latest 20261021), 67 public tables.
- Other branches are rehearsal/staging/test only. In particular `br-young-mouse-b4jhqbci` is a production-derived migration/worker rehearsal, not production.
- Do not treat a higher migration count or newer schema on another branch as authority. Do not delete any branch or database object without full reconciliation, backup evidence and approval.
- Production DB was NOT modified in the work summarized here.

## Work completed and evidence
1. **Government inbox worker reliability fix**
   - Commit: `c44e53ba9467eaf6f42cb191f30043825c87624c`.
   - Heartbeat renewal failure normalized to `LEASE_RENEWAL_FAILED`; validation aborts and retry behavior is exercised.
   - CI run #3850 / ID `41204073487`: SUCCESS.
2. **Atomic government inbox processing / safety**
   - Bounded atomic claims using `FOR UPDATE SKIP LOCKED`; lease tokens/expiry and stale-worker fencing; heartbeat; timeout; retry/backoff/quarantine; payload hash/timestamp/metadata validation; serializable source/crosswalk resolution; scoped locks; unresolved mappings remain unresolved; append-only payload-free transition events.
   - Tests cover concurrent disjoint claims, stale fencing, expiry, retry/quarantine, payload validation and ambiguous crosswalk behavior.
   - Code implementation is in the review branch; this does not mean a live worker is running.
3. **Repository architecture audit**
   - Added `docs/engineering/RUPAYKG_REPOSITORY_ARCHITECTURE_AUDIT_2026-10-31.md`.
   - Captures architecture, capabilities, database branch comparison, RLS/role observations, government inbox posture, P1/P2 gaps, TRL and execution order.
   - Scope is repository inventory plus targeted deep review, not independent line-by-line certification of every route, SQL statement, provider contract or UI state.
4. **CI**
   - Run #3908 exact recorded SHA: SUCCESS. This is a CI/engineering pass only.
5. **Repository continuity rules**
   - This file and `AGENTS.md` establish mandatory checkpoint/resume discipline.

## Verified database/security findings (read-only inspection)
- Production `main` has migration 096 and four verifier authorization provenance columns: `authorization_membership_id`, `authorization_role_id`, `authorization_permissions_snapshot`, `authorization_checked_at`.
- Production verifier function MD5 observed: `934a7be13f08c034bbd15e96285eb1be`; same function hash and columns observed in the newer production-derived rehearsal.
- Older staging branches diverge; an older rehearsal has schema effects without matching migration-ledger provenance. Do not blindly replay/copy or rewrite ledger rows.
- RLS was enabled on zero inspected public tables and no RLS policies were found in inspected branches. The Neon inspection role had `BYPASSRLS`, `CREATEROLE`, `CREATEDB` (and replication privilege in newer rehearsal). This is NOT proof of the Render runtime role; actual application runtime principal remains unverified.
- These observations make database-enforced tenant isolation a release blocker until route/table mapping, runtime principal verification, least-privilege roles, carefully designed RLS policies and cross-tenant tests exist.

## Current blockers / NOT DONE
### P1 — release blockers
1. Verify the actual Render runtime DB principal and all connection-string/role usage.
2. Complete route × table × operation × tenant × permission matrix.
3. Design separate API, migration, worker, event-writer and read-only operations DB identities.
4. Implement and test transaction-local tenant/identity context and table-specific RLS; do not blanket-enable RLS.
5. Reconcile migration histories safely; preserve production migration 096 and investigate out-of-band schema/ledger divergence.
6. Government inbox scope ADR remains PROPOSED / NOT APPROVED (national system-level queue recommended; tenant-scoped alternative must be evaluated). Worker is OFF: no proven scheduler/long-running process, dedicated live least-privilege worker principal or approved operational scope.
7. Source snapshot dual control is not DB-enforced.
8. BWG statutory assessment contains hardcoded thresholds; bind to approved versioned statutory sources/rules.
9. Guardian/Hedera correlation, ambiguous-submit recovery and duplicate prevention are not proven end-to-end.
10. No verified live official CPCB/BEE source contract, signed transport, acknowledgement or regulator acceptance.

### P2 — hardening and operational assurance
- Identity/contact verification, privileged MFA, password recovery assurance and abuse/rate limits.
- Evidence malware scanning/quarantine, parser isolation, retention/lifecycle and scale tests.
- Backup restore drills, SLOs, monitoring, incident drills, secret rotation, privacy/retention, support and rollback evidence.
- Hardware device/model approvals, firmware/BOM, calibration/metrology, provisioning/key rotation, field trials and maintenance.
- Complete pan-India state/UT/district/local-body directories, statutory applicability, languages, support and performance evidence.
- Do not present `BASELINE_SUPPORTED` as CPCB registration, statutory approval or organization authorization.

## TRL and release posture
- Software: provisional estimate around TRL 4–5 based on controlled development/CI evidence; not an independent formal assessment.
- Hardware/IoT: NOT ASSESSED / NOT ESTABLISHED.
- Integrated national service: NOT ESTABLISHED.
- TRL 9: NOT ESTABLISHED.
- Production certification: BLOCKED / evidence incomplete.
- Live CPCB acceptance, external carbon-credit issuance/registration, payment settlement and nationwide operations: NOT PROVEN.

## Explicitly not performed
- No production DDL/DML, migration, role/grant change or data cleanup.
- No branch/database deletion or promotion.
- No worker activation or live CPCB source integration.
- No production deployment, certification, external registry issuance or TRL 9 claim.
- PR #175 was not merged.

## Next execution batch — start here
**Gate 1: database security foundation, read-only discovery and test design.**
1. Reconfirm branch/HEAD and PR #175 status; verify CI for exact current HEAD.
2. Inventory all DB connection strings, pool factories, environment-variable names, connection-role assumptions and deployment service configuration. Identify the actual Render runtime principal without exposing secrets.
3. Build the route-to-table/operation/tenant/permission matrix from source code and SQL.
4. Inspect ownership/grants/default privileges and transaction boundaries for identity/tenant context.
5. Propose a least-privilege role matrix and table-by-table RLS policy design; include positive and negative cross-tenant tests.
6. Validate the design in a disposable/production-derived rehearsal branch only, with no production writes. Preserve migration 096.
7. Update the checkpoint, add a dated immutable checkpoint, run relevant tests and exact-head CI.
8. Only after Gate 1 evidence is reviewed, proceed to migration reconciliation and then approved government inbox operationalization.

## Mandatory resume instruction
On the next session, do not start with a generic repo audit. Read `AGENTS.md` and this file, verify the recorded HEAD/CI/PR state, then begin **Gate 1, step 1**. If branch/HEAD has changed, reconcile and update this checkpoint before making changes.


## Continuity-documentation commits (2026-10-31)
- `AGENTS.md` rules commit: `5e358706a5fad88f6842e3b94d9a0a05709eb603`.
- Initial resume pointer commit: `d16bb63d155b8dc6b82a17c2228aee2ae418934b`.
- Immutable checkpoint commit: `d23bb60e347f8a8c5ea18242e682b6d5bb7482b6`.
- Architecture audit addendum commit: `76218ff3893fff11529d66664849cbf0e80d78a0`.
- This resume pointer is now being refreshed after those documentation commits. On the next session, verify actual branch HEAD and exact-head CI before proceeding; documentation commits must not be mistaken for application changes.
- Exact-head CI run #3908 passed for the application/audit baseline commit `571aef12d9dbe54389ec50b8c80c1d5bbfab355a`. CI for subsequent continuity-documentation commits must be rechecked against the latest branch HEAD.


## Gate 1 progress — 2026-10-31 (read-only source discovery)
- Added `docs/engineering/GATE1_DATABASE_SECURITY_PRELIMINARY_INVENTORY_2026-10-31.md` (commit `d3c585ec50f7e6fbbb82acf5f381762c064d4c82`).
- Confirmed in source: Render manifest defines one web service and one `DATABASE_URL`; API bootstrap builds one Pool from `DATABASE_URL`; production migration runner creates a separate pool but also uses `DATABASE_URL`. Separate pools/processes do not establish separate DB principals.
- Tenant transaction helper sets identity and organization using transaction-local settings, but helper comments and source usage show it is not universal. Prior Neon read-only catalog inspection found no RLS policies on inspected public tables.
- Preliminary route-module inventory now exists for 11 imported route modules. It is explicitly not yet the complete route × operation × table × tenant × permission matrix.
- Actual Render runtime DB role remains UNVERIFIED. Do not infer from Neon inspection role or expose connection secrets.
- PR search confirms PR #175 remains open/draft; overlapping open drafts include #173, #161, #160 and #159. Their scope and dependencies require triage; do not merge or close automatically.
- CI run #3908 passed for `571aef12d9dbe54389ec50b8c80c1d5bbfab355a`. The GitHub commit-workflow lookup returned no PR-triggered run for the documentation pointer head `f0b1f47285d2bdd34f53b56d3f7835520c0158cf`; do not claim the subsequent documentation commits have passed exact-head CI until a run is found.
- No application code, production DB, RLS, grants, role, migration, worker or deployment was changed in Gate 1 discovery.

### Next Gate 1 action
Complete central-server and route-module SQL authorization mapping, then inventory every `new Pool`/database connection variable across worker, scripts and tests. After that prepare a least-privilege role matrix and table-specific RLS design plus negative cross-tenant tests. Rehearse only in a disposable/production-derived branch; do not modify production.
