# RupayKg worker security and bounded-queue checkpoint — 2026-10-31

**Checkpoint type:** Immutable engineering checkpoint  
**Repository:** `vishaltradewinds/rupaykg`  
**Working branch:** `shakti/atomic-inbox-claim-2026-10-31`  
**Exact branch HEAD at checkpoint:** `19ee83a52f5f29617df0b135bbce9129b746be13`  
**Main HEAD observed:** `b5e91241d84a6712ff544d3deec1805702f45efd`  
**Canonical worker review:** PR #161 (OPEN / DRAFT / unmerged), stacked on PR #157  
**Temporary CI mirror:** PR #175 (OPEN / DRAFT / unmerged), same branch/head, targets main only to maintain CI while workflow trigger is broadened  
**Other related PRs:** #157 (OPEN / DRAFT); #178 and #179 remain separate draft workstreams  
**Production status:** HOLD. Worker OFF. Scheduler OFF. Certification OFF. TRL 9 NOT ESTABLISHED.

## Work completed in this batch

1. **Database principal guard strengthened**
   - Dedicated worker URL is mandatory; there is no fallback to `DATABASE_URL`.
   - Worker URL must include an explicit PostgreSQL role name.
   - Application and worker role names are compared after URL decoding, independent of password, host alias, port and database path.
   - Missing or malformed application role identity fails closed; malformed URLs are not accepted as proof of distinct roles.
   - Tests cover same role with rotated password, URL-encoded role names, endpoint/port aliases, missing role names and malformed application URLs.

2. **Worker TLS policy hardened**
   - Worker pool reuses repository `databaseTlsConfig`.
   - TLS certificate verification is enabled by default.
   - Optional `DATABASE_CA_CERT` is passed through for private CA deployments.
   - TLS is disabled only with explicit `DATABASE_SSL=false` (the disposable local PostgreSQL CI service uses this explicit setting).
   - Tests cover default verification, CA propagation and explicit opt-out.

3. **Exhausted queue sweep bounded and observable**
   - Exhausted-row quarantine now selects a bounded batch using row locks and `SKIP LOCKED`, instead of updating every exhausted row in one statement.
   - Atomic claim query returns both claimed rows and the number quarantined by the sweep.
   - Worker quarantine metrics now include sweep-driven quarantines.
   - Unit test covers bounded sweep and counter reporting.

4. **Lease heartbeat interval bounded**
   - Heartbeat interval is constrained to at most half of the lease lifetime, with a 300-second absolute cap.
   - Invalid/excessive configured values fall back to a safe interval.
   - Unit tests cover default, valid maximum and excessive interval behavior.

5. **CI workflow supports stacked PRs**
   - Removed the `pull_request.branches: [main]` restriction.
   - CI now runs for pull requests targeting any base branch, so PR #161 can be validated while stacked on PR #157.
   - PR #175 was reopened as a temporary CI mirror because the previous workflow did not run on non-main PR bases. It is not the canonical review and must be closed again after exact-head CI is recorded.

6. **Documentation and governance**
   - Updated `docs/engineering/GOVERNMENT_INBOX_WORKER_LEAST_PRIVILEGE_GATE_2026-10-31.md`.
   - Updated PR #161 body with exact head, CI evidence, failure correction record, stack drift and production safety boundaries.
   - PR #175 was initially closed as a duplicate, then reopened only as a temporary CI mirror; no branch or commit was deleted.

## Exact-head CI evidence

- Earlier code head `30ea27b13921661bbf0364af71dc177b64f673f0`: CI run #41227038280 SUCCESS, including worker principal/TLS tests and disposable PostgreSQL acceptance.
- Docs head `26f2e46a27a5c689d541d45b14b9c93b6b3b979a`: CI run #41227119005 SUCCESS.
- Queue hardening intermediate runs #41227203012, #41227214839, #41227234273, #41227243507, #41227259635 and #41227322837 failed in the API unit suite because two assertions still expected the old CTE name `exhausted`; the SQL now uses `exhausted_candidates`. The new bounded-sweep/count test passed, and the two PostgreSQL concurrency/fencing tests plus the restricted event-writer privilege test passed in the failed run. The stale assertions were corrected in commit `bc2f4221b01a887c75ce92dc16bb7016cc3ad47b`.
- Exact source head before workflow update `30b28df9795c912591cb1902992788c5da815935`: workflow run pending at checkpoint.
- Exact current HEAD `19ee83a52f5f29617df0b135bbce9129b746be13`: CI runs #41227554040 and #41227554234 are IN PROGRESS. Do not claim exact-head CI pass until a run for this exact SHA completes successfully.
- CI workflow now supports stacked PRs. Once the current run is green, close temporary PR #175 and retain PR #161 as the canonical stacked review.

## Current blockers and safety boundaries

- The worker remains a code candidate only. No worker entrypoint/service is registered or active.
- No actual worker login has been provisioned or tested with the deployment credential.
- No production role, grant, secret, migration, Render environment, deployment, queue row or lease was changed.
- No RLS or tenant isolation change was made. Production still has the known RLS/role-authority gap; tenant isolation remains a release blocker.
- The worker's schema readiness check is not proof of role grants. A separate read-only principal/grant preflight using the actual candidate worker credential is still required.
- No proof exists that Render runtime connects to the authoritative Neon project/branch. Sole authoritative live DB remains Neon project `rupaykg-production-fresh` (`steep-mud-79906940`), primary branch `br-restless-base-b44cip2h`, database `rupaykg`.
- PR #157 is based on old main SHA `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`; current main is `b5e91241d84a6712ff544d3deec1805702f45efd`, four commits ahead. The four intervening main commits add BWG acceptance checkpoint docs and an authorization-provenance SQL fixture. Reconcile this drift before any merge.
- PR #161 is the canonical stacked worker review; PR #175 is a temporary CI mirror only. Neither may be merged wholesale.

## Next executable sequence

1. Poll exact-head CI for `19ee83a52f5f29617df0b135bbce9129b746be13`; inspect job logs and fix any failures on the same branch.
2. Once exact-head CI passes, close PR #175 and verify PR #161 still receives CI on its non-main base.
3. Build a read-only worker principal/grant preflight against a disposable production-shaped Neon branch; do not create production roles or secrets.
4. Reconcile the 4-commit main drift and historical migration 096/source ledger exception before proposing any merge.
5. Independently review worker lease/fencing, role grants, migration chain, tenant boundary and rollback evidence.
6. Keep worker OFF and production HOLD until all approvals and evidence gates are met.
