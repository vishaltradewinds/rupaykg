# RupayKg Resume Checkpoint — 2026-10-21 13:18 UTC

## Project goal and mandatory rules
- RupayKg is a **Pan-India platform**, not a pilot-only product. Pilot/test environments validate components; they do not define the product's national scope.
- Follow Shakti Standards across reality/context discovery, official-source evidence, legal/compliance boundaries, feasibility, design, engineering, tests, approvals, certification, deployment, operations and continuous assurance.
- Mandatory engineering batching rule: audit the coherent problem first, implement related safe/dependency-linked changes in a batch, then validate the final combined state. Record exact commit, commands/run and limitations.
- Never claim CI as statutory approval, government acceptance, accredited MRV verification, carbon-credit issuance or production readiness.

## Repository / release posture
- Repository: https://github.com/vishaltradewinds/rupaykg
- Branch: `intelligence/ai-evidence-intake-middleware`
- PR #41: https://github.com/vishaltradewinds/rupaykg/pull/41
- Code head at checkpoint: `68fa21c4dbf0b8d4d955b4ae2a8a74ffdb832e09`
- PR remains open, draft, unmerged and undeployed. No production migration or deployment was performed.
- Full CI run #1724 passed for code head `68fa21c4dbf0b8d4d955b4ae2a8a74ffdb832e09`: https://github.com/vishaltradewinds/rupaykg/actions/runs/39606119972
- Run #1724 passed dependency audit, migration validation and disposable-PostgreSQL migration application, typecheck, build, browser smoke, automated tests including disposable PostgreSQL acceptance, production-container build and cleanup.
- A checkpoint-document-only commit will create a newer CI run; do not confuse that documentation commit's pending CI with the verified code-head run above.

## Engineering completed in this continuation
1. Crosswalk approval expiry:
   - API rejects expired crosswalk approval requests with HTTP 409 and code `GOVERNMENT_CROSSWALK_REQUEST_EXPIRED`.
   - Integration test proves the expired request remains `PENDING` after attempted approval.
   - Migration `migrations/20261108_crosswalk_request_expiry_immutability.sql` blocks changing `expires_at` after request creation, preventing the DB-level bypass of extending expiry while approving.
   - `migrations/README.md` documents the control.
2. Pan-India regulatory source provenance:
   - Existing migrations `20261104_source_snapshot_and_regulatory_rule_versions.sql`, `20261105_crosswalk_snapshot_binding.sql`, `20261106_regulatory_rule_source_gate.sql`, and `20261107_approved_source_snapshot_immutability.sql` govern source snapshot/rule provenance.
   - Earlier CI run #1719 passed on `230b2a0c136446fd7435d45a261cce183db9ba18`: https://github.com/vishaltradewinds/rupaykg/actions/runs/39604849670
3. Worker crosswalk runtime gate investigation:
   - A proposed runtime join requiring the crosswalk's bound source snapshot to remain `APPROVED` was added briefly, but it was reverted in commit `8980e70ed7466311a90e7e5aae8f5ab169df9902` as an unverified routing gate. Do not assume the worker currently enforces live source-snapshot status.
   - The attempted retired-snapshot test was removed in `68fa21c` to restore a green acceptance baseline. Do not report retired-source behavior as tested.
   - Correct next step: inspect the snapshot lifecycle semantics, rule/crosswalk audit model and DB constraints. Decide explicitly whether retirement should block *new* inbox resolution, preserve historical resolution, or require a replacement mapping. Implement only with a coherent test that respects immutable/unique source-version rules and proves intended lifecycle semantics. Keep unresolved rather than silently route if no safe decision is grounded.
4. Known CI repair history:
   - Run #1715 failed because the synthetic expired municipality code violated the DB uppercase code constraint; corrected to uppercase.
   - Run #1719 passed after the API expiry check, test fixture and expiry-immutability migration were in place.
   - Later attempt to gate crosswalk routing on source snapshot lifecycle failed in the test sequence and was deliberately reverted; latest full CI #1724 passed after reverting the unverified runtime change and its test.

## Outstanding gates (not closed)
- Pan-India official geography/jurisdiction dataset ingestion, reconciliation and completeness remain unproven.
- Complete versioned national/state/local statutory programme applicability registry is not established.
- No authorized CPCB/BEE/Indian Carbon Market API contract, sandbox or production credentials have been independently verified; user has said applications/access requests were made, but grants/credentials are not verified here.
- Worker acceptance on a clean isolated staging environment, process restart/retry/quarantine lifecycle and non-destructive handling of inherited staging rows remain open.
- Alert delivery needs a named on-call owner and verified escalation path; webhook delivery alone is not human acknowledgement.
- Audit-chain concurrency/rollback and endpoint-level authorization need final staging evidence.
- Real Guardian execution, Hedera consensus and Mirror Node hash comparison must be demonstrated using existing configured account/topic only; do not create replacements.
- CCTS methodology calculations, independent accredited verification and official registry issuance remain separate gates.
- No measured Pan-India scale/DR/capacity evidence.
- Production release, deployment, migration and Shakti certification remain on HOLD.

## Resume instructions for next chat
1. Reconfirm PR #41 head and latest CI for the exact current head. If this checkpoint document commit is newest, wait for its CI result too.
2. Continue the worker/crosswalk source snapshot lifecycle audit described above; inspect migrations, trigger constraints, runtime query and tests before deciding on behavior.
3. Build a safe coherent implementation and PostgreSQL integration test batch; avoid unrelated changes and avoid mutating inherited staging/production data.
4. Run the complete CI on the final combined head, fix root causes in coherent batches, and update the PR with evidence and remaining limitations.
5. Continue broader Pan-India architecture conformance and release blockers; keep PR draft/unmerged/undeployed until all applicable gates have evidence and explicit approval.
