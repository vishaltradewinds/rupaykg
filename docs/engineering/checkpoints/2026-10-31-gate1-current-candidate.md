# RupayKg Gate 1 current-candidate checkpoint — 2026-10-31

- Repository: `vishaltradewinds/rupaykg`
- Branch: `shakti/atomic-inbox-claim-2026-10-31`
- Base HEAD reviewed: `26227aa6ec2ab695948c3698549750c4d643a8d7`
- Candidate source review: `docs/engineering/GATE1_CURRENT_CANDIDATE_SOURCE_REVIEW_2026-10-31.md` (commit `e129165aa3fb50b65d2a42057cafd87add205a97`)
- Existing access inventory, priority review and tenant isolation design were reconciled with the current candidate in commits `c5e25240713eb05217c82262a9efa05e0bee8f7f`, `f00cd64d6af3bdd0efab07bde6a891f460a39385`, and `26227aa6ec2ab695948c3698549750c4d643a8d7`.
- Exact-head CI for base HEAD `26227aa6ec2ab695948c3698549750c4d643a8d7`: run #3921 / `41214115325` was QUEUED at checkpoint creation; must be rechecked. The immediately preceding HEAD `ca71c1857a71ed73ca700bbeb2d49be251e85f49` passed CI run #3918 / `41213646257`.
- PR #175 targets main and is open/draft. PR #161 shares the same head branch but targets a stacked feature branch. Do not merge or deploy based on green CI alone.
- Compared with deployed main commit `862512c8c904cef0f604df0350f02672318953af`, branch was 261 commits ahead, 1 behind, with 85 changed files at inspection. Recompute before action.
- Render live service `rupaykg` still deploys main at observed commit `862512c8c904cef0f604df0350f02672318953af`; review branch code is not live.

## Completed in this batch
1. Re-read the full current candidate source tree and route registration.
2. Identified earlier access inventory and priority-route review as historical snapshots; appended explicit reconciliation addenda rather than deleting history.
3. Added current-candidate route/execution-context review.
4. Confirmed statutory route handlers now use tenant transaction helper and are registered by `registerMrvRoutes`.
5. Confirmed BWG profile and report routes now use tenant transaction helper; earlier direct-pool statements are stale.
6. Confirmed remaining direct/alternate execution contexts: identity/auth, governance/onboarding, platform admin, intelligence, server overview/geography, field-device sync, registry/settlement and worker.
7. Confirmed worker runner requires `GOVERNMENT_INBOX_DATABASE_URL` with no fallback and checks principal difference; Render manifest has one web service, no worker service/worker URL, and Docker CMD starts only the production API server.
8. Confirmed migration runner and API runtime both read `DATABASE_URL`; separate pool/process does not imply separate database role.
9. Confirmed current source uses `async-mirror-worker.ts` and `async-mirror-worker-runner.ts`; do not refer to nonexistent `government-inbox-worker.ts`.
10. No application code, production DB, role, grant, migration, worker, deployment, or branch deletion was changed.

## Current P1 findings
- RLS remains disabled on inspected production public tables; no policy migration exists.
- Actual live Render database principal and endpoint target remain unverified; diagnostic exists on review branch only, not deployed main.
- Full route × statement × table × action × tenant × execution-role map is not complete.
- Intelligence direct-pool reads and server overview/geography access checks need transaction-consistent access context.
- Auth, governance and platform-admin need dedicated control-plane contexts and same-transaction authority revalidation.
- Sync needs device-specific context; registry/settlement need bilateral ownership/party policy; MRV advisory lock lifetime needs review.
- BWG assessment hardcoded thresholds still require exact approved statutory rule/source verification.
- Worker remains unactivated and its live least-privilege principal/authority scope is not approved.

## Next execution batch
1. Complete source-level transaction and race review of server overview/geography and intelligence.
2. Review auth/onboarding preflight races and governance authority revalidation.
3. Review platform-admin same-transaction authorization and audit controls.
4. Define device principal context and tests for sync.
5. Define bilateral registry/settlement policies and review MRV advisory-lock lifecycle.
6. Finish all-table ownership/grant/function/sequence inventory against a controlled schema snapshot.
7. Only then produce RLS policy SQL and positive/negative tests for disposable production-shaped DB. Do not modify production.
8. Recheck exact-head CI, PR bases, Render deployment and Neon authority before every write.

## Release posture
P1 HOLD. RLS NOT IMPLEMENTED. Actual Render DB role NOT VERIFIED. Worker NOT ACTIVATED. No production changes. TRL 9 NOT ESTABLISHED.
