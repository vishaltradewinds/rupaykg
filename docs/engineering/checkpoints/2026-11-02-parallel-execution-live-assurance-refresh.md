# RupayKg parallel execution checkpoint — 2026-11-02 18:30 UTC

Canonical repository: `vishaltradewinds/rupaykg`
Reference UI repository: `vishaltradewinds/rupaykg-aistudio`
Governing standard: Shakti Standards

## Exact-head GitHub verification

- PR #192 head `51b673dcf662dbae3f6a04ff84682083f6295fee`: exact-head CI run [41498504841](https://github.com/vishaltradewinds/rupaykg/actions/runs/41498504841) completed SUCCESS.
- PR #213 head `cd96ec579e2eda726b3fbe9e2d261f5b2ce9d832`: exact-head CI run [41499847180](https://github.com/vishaltradewinds/rupaykg/actions/runs/41499847180) completed SUCCESS. All 22 job steps succeeded, including migration validation, restricted verifier/runtime role provisioning in disposable CI PostgreSQL, migration application, privilege teardown, typecheck, build, synthetic bootstrap, browser smoke, full PostgreSQL tests and production-container build.
- PR #213 remains DRAFT and unmerged. Feature flag `RUPAYKG_EPR_RETURN_READ_ENABLED=false`; no EPR write route is registered. Candidate route uses the existing explicit checked-out-client signed tenant transaction for permission and protected EPR reads. No production migration, role, grant, secret or deployment was performed.
- Commit comparison: PR #213 head is 30 commits ahead of current PR #192 head `51b673d...`, 0 behind; current #192 head is its merge-base. PR #213's recorded target base SHA is still `ae41ed7...`; confirm target-branch metadata and independent DBA/security review before merge. Do not merge or retarget automatically.
- PR #203 UI/UX head `18b551cecdeb61ad1e22bbc4bd66cc648eb3a1e3`: exact-head CI run [41454665904](https://github.com/vishaltradewinds/rupaykg/actions/runs/41454665904) SUCCESS. Accessibility, localization and field usability review remain open.
- PR #193 BWG profile review head `60092778a5e836767a8b6592d0ebcea52ed2f949`: exact-head CI [41332732530](https://github.com/vishaltradewinds/rupaykg/actions/runs/41332732530) SUCCESS; independent review remains open.
- PR #194 BWG workspace permission head `08c69cbf4f40aa73ccf05a45d0589b2ca22d7d6d`: exact-head CI [41332741365](https://github.com/vishaltradewinds/rupaykg/actions/runs/41332741365) SUCCESS; independent review remains open.
- PRs #205, #211 and #212 remain closed unmerged as superseded; branches preserved.

## Fresh read-only Neon production snapshot

Project `steep-mud-79906940`, primary/default branch `br-restless-base-b44cip2h` (`main`), database `rupaykg`.

- Public base tables: 67.
- RLS enabled: 0; FORCE RLS: 0.
- Public non-internal triggers: 70.
- `public.schema_migrations`: 92 rows; latest version `20261021`, filename `20261021_evidence_artifact_vault.sql`.
- Only `rupaykg` application-named role is present in the inspected role set. It is LOGIN, BYPASSRLS, CREATEDB, CREATEROLE, INHERIT and REPLICATION. No dedicated `rupaykg_app_runtime` role was observed.
- Public-schema functions: 115 PUBLIC-EXECUTE functions total, comprising 78 owned by `rupaykg` and 37 owned by `cloud_admin` (extension functions). All 78 `rupaykg`-owned functions have PUBLIC EXECUTE; none is SECURITY DEFINER. The 37 extension functions must be classified separately rather than counted as application functions.
- Neon project settings: public connections are not blocked; allowed-IP list is empty; primary branch is not protected.
- Lab/rehearsal branches remain present. No branch operation was performed.

These are read-only catalog/API observations. No production DDL/DML, migration, role/grant/RLS change, secret write, deployment, worker activation, Guardian/Hedera write or certification occurred.

## Security and release posture

- Production Neon: READ-ONLY / HOLD.
- Tenant isolation: BLOCKED — 0/67 RLS and 0/67 FORCE RLS.
- Worker/scheduler: OFF.
- EPR read route: candidate only, feature flag OFF.
- Certification: OFF.
- National platform TRL 9: NOT ESTABLISHED; prior provisional national TRL 3 remains the planning baseline, not a new assessment.

## Next parallel execution batches

1. Classify all 78 application-owned PUBLIC-EXECUTE functions by purpose, caller, data access, SECURITY INVOKER/DEFINER behavior, search_path, owner and least-privilege grant. Separately identify extension-owned functions and avoid broad revocation without dependency evidence.
2. Map all 70 triggers to table, event, function body, owner, security mode, search_path and tenant/RLS dependency; identify trigger paths that can bypass intended runtime authorization.
3. Complete the 67-table matrix: direct/derived/multi-party/global/system classification, tenant key, geography boundary, foreign-key lineage, route/worker callers, owner and policy test.
4. Complete route → SQL → table → pool/client/transaction → role/function mapping for EPR, MRV, evidence vault, registry, settlement and BWG. Eliminate cross-client authorization/data reads before tenant RLS rollout.
5. Implement a narrow worker system-actor access contract and disposable two-tenant tests for authorization, revocation, lease loss, retry, reconciliation and external-side-effect idempotency. Worker remains OFF.
6. Reconcile the separate auth runtime-pool contract and main-branch ancestry for PR #192. Keep PR #213 draft pending target-base verification and independent review.
7. Complete UI accessibility, keyboard/focus, screen-reader, contrast/zoom, localization and field usability acceptance for PR #203.
8. Obtain founder authorization for the two-custodian authority ceremony and independent security/DBA approvals before any production bootstrap or RLS work.
9. Preserve lab branches; do not select a Render workspace until explicitly confirmed.

No production changes are authorized by this checkpoint.