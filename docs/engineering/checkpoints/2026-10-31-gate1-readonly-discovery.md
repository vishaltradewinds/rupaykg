# RupayKg Gate 1 read-only discovery checkpoint — 2026-10-31

## Snapshot
- Repository: `vishaltradewinds/rupaykg`
- Working/review branch: `shakti/atomic-inbox-claim-2026-10-31`
- Branch HEAD observed before this checkpoint write: `20433344a9ec42473f7ac4249c42cb1e4ae20c59`
- PR #175: open/draft from prior verified PR search; not merged.
- Exact-head CI for the architecture audit baseline `571aef12d9dbe54389ec50b8c80c1d5bbfab355a`: run #3908 / `41213087762`, SUCCESS.
- CI lookup for documentation head `20433344a9ec42473f7ac4249c42cb1e4ae20c59`: no PR-triggered workflow run returned. Do not claim later documentation commits passed CI.
- Deployed Render service: `rupaykg`, ID `srv-daki4d7qj5pc73b8qksg`, branch `main`, latest observed live deploy `dep-dbis4nm417fc73a8m7ng`, commit `862512c8c904cef0f604df0350f02672318953af`.
- Compare deployed commit to review branch at inspection: diverged; 259 commits ahead, 1 behind; 84 files in compare result. Reconfirm before use because branch moves.

## Work recorded in this batch
1. Added mandatory repository-wide engineering rules in `AGENTS.md`.
2. Added canonical resume pointer `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md`.
3. Added immutable 2026-10-31 initial engineering checkpoint.
4. Added architecture audit CI/continuity addendum.
5. Added preliminary Gate 1 DB security source inventory and Render live-deployment comparison.
6. Inspected Render workspace/service inventory read-only. No Render-hosted Postgres instances were returned.
7. Inspected source for root/package workspaces, Render manifest, API bootstrap, production config, migration runner, authentication, tenant transaction helper and 11 API route modules.
8. Confirmed review-branch source has role diagnostic and tenant-context helper; deployed `main` at the observed commit does not contain those helpers.
9. Confirmed Render service metadata does not expose env var values in this read-only response. No secret values were accessed. Role diagnostic log query returned no matching logs.
10. No production SQL, migration, role/grant, worker, environment-variable, deploy or branch-destructive action was performed.

## Gate 1 facts and risk
- Review-branch API and migration pools both read `DATABASE_URL`; separate pools do not establish separate database roles.
- Render manifest declares one service and `DATABASE_URL`; no separate worker/migration connection variable appears in the inspected manifest.
- Existing tenant transaction helper sets transaction-local identity and organization context, but route modules show mixed usage. It is not universal.
- Prior Neon read-only catalog evidence: no RLS enabled/policies on inspected public tables. Tenant isolation at the DB layer is not established.
- Actual live Render database principal and whether its `DATABASE_URL` targets Neon production `main` remain unverified.
- Existing live Render service deploys from `main`; PR #175 changes are not live.
- A preliminary 11-module route/table extraction is in `GATE1_DATABASE_SECURITY_PRELIMINARY_INVENTORY_2026-10-31.md`; not a complete authorization matrix.
- Other overlapping open drafts were found (#173, #161, #160, #159); triage them, do not auto-merge or close.

## Next step
Complete full route × operation × table × tenant scope × permission mapping, include central `server.ts`, all imported modules, workers, scripts and tests; inventory all Pool constructors and connection-string names. Then prepare least-privilege roles and table-specific RLS policy design with positive/negative cross-tenant tests. Rehearse only in a disposable/production-derived Neon branch. Preserve production migration 096. Do not modify production or deploy until independently reviewed and explicitly approved.

## Canonical resume
Read `AGENTS.md` and `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md` first. Verify actual branch HEAD, PR status and exact-head CI before doing work.
