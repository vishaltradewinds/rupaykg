# RupayKg Resume Checkpoint — 2026-10-20 13:00 UTC

## Repository / branch
- Repository: `vishaltradewinds/rupaykg`
- PR: https://github.com/vishaltradewinds/rupaykg/pull/41
- Branch: `intelligence/ai-evidence-intake-middleware`
- Latest HEAD at checkpoint: `6f673ba9938e51ee189281bc30926c5f4d16ced2`
- PR remains open, draft, unmerged and undeployed. Production was not modified.

## Fixes since 12:41 UTC checkpoint
1. Runtime acceptance test port collision:
   - CI run #1485 failed because runtime acceptance attempted to listen on a fixed port already in use.
   - Changed the default runtime test port to a process-derived port, retaining `RUNTIME_ACCEPTANCE_PORT` override.
   - Fixed the no-database readiness assertion to check the actual no-database server port (`port + 10)), not unrelated `port + 1`.
   - CI run #1489 passed typecheck, build, browser smoke test and the test stage on its tested head `f0e5c3ec40ce61652d680e2261d5c694bd5f3d10`; container-build step was still running at last check.

2. Stakeholder authorization dual control:
   - Added migration `20261027_stakeholder_authorization_dual_control.sql`.
   - Added evidence-backed request ledger with VERIFY/REVOKE actions, SHA-256 evidence hash, reason, request integrity hash, expiry, separate requester and approver, and approval/rejection timestamps.
   - PostgreSQL trigger prevents VERIFIED mappings unless a matching approved VERIFY request exists, requester and approver differ, the reviewer identity matches, evidence reference/hash match, and expiry matches the approved request.
   - Added platform-admin endpoints:
     - `POST /api/v1/admin/stakeholder-authorization-requests` (action VERIFY by default; REVOKE supported)
     - `GET /api/v1/admin/stakeholder-authorization-requests`
     - `POST /api/v1/admin/stakeholder-authorization-requests/:requestId/approve`
     - `POST /api/v1/admin/stakeholder-authorization-requests/:requestId/reject`
   - Requester and approver must be distinct active Super Admin identities with `admin:users`; organization verification is rechecked at decision time; approval/mapping mutation/audit append are transactional.
   - REVOKE requires independent approval and changes the mapping to REVOKED with an audit event.
   - Updated `apps/src/cpcb-swm-routes-db.test.ts` so synthetic approved mappings use an explicit dual-control fixture and direct VERIFIED inserts without approval are rejected.
   - Added a platform-admin unit test that rejects requester self-approval.
   - Updated gate documentation and migration README.

3. Government inbox worker disposable-PostgreSQL acceptance:
   - Added `apps/src/async-mirror-worker-db.test.ts`.
   - Exercises transient failure -> RETRY -> recovery -> internal VALIDATED, exhausted attempt -> QUARANTINED, lease cleanup, validation summary and append-only status history.
   - The test uses CI's disposable PostgreSQL only. It does not touch inherited Neon staging inbox rows or production.

## CI
- Latest tested commit at previous run #1498: `a2a609808647b64e5aee7080989d890fc97bd0ea`; its test stage passed, including the new worker DB test, but that run predates the final VERIFY/REVOKE extension.
- CI run #1504: https://github.com/vishaltradewinds/rupaykg/actions/runs/39426582783
  - Associated with latest HEAD `6f673ba9938e51ee189281bc30926c5f4d16ced2`.
  - In progress at checkpoint; must wait for complete result and inspect any failing step before claiming latest HEAD green.
- Do not treat a previous green run as certification of a later commit.

## Remaining gates
- Verify CI #1504 completes green, repair any failure on this branch and repeat CI.
- Add/complete end-to-end approval/revocation integration coverage beyond the existing self-approval and DB-trigger tests.
- Worker acceptance against a clean/approved staging dataset remains blocked: inherited Neon staging branch `br-spring-hill-b4544vz5` has 8 expired PROCESSING leases plus one each RETRY, RECEIVED, QUARANTINED and VALIDATED; do not inspect payloads or mutate those inherited records without approved triage.
- External alert delivery, escalation, monitoring and on-call ownership remain unverified.
- No authorized CPCB/BEE/Indian Carbon Market API contract, sandbox or credentials are verified.
- Real Guardian execution, Hedera consensus and Mirror Node retrieval bound to matching evidence hashes remain unverified.
- Do not deploy, apply migrations to production, enable the scheduler, or merge PR #41 until applicable Shakti Standards release gates and explicit production change approval are satisfied.
- Preserve existing Guardian/Hedera configuration and topic/account `0.0.10121000`; do not create or request replacement keys/topics/accounts.

## Truthful status
Engineering work is progressing, but the audit and production release remain **IN PROGRESS / HOLD**. The internal stakeholder mapping workflow is not CPCB registration, statutory approval, BEE accreditation, CCTS verification or an official Carbon Credit Certificate. The inbox worker's VALIDATED state is structural intake validation only.
