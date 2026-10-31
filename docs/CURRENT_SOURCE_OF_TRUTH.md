# RupayKg — Current Source of Truth

**Checkpoint:** 2026-10-31  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Canonical implementation branch:** `main`  
**Authoritative live database:** Neon `rupaykg-production-fresh` / project `steep-mud-79906940` / branch `main` (`br-restless-base-b44cip2h`) / database `rupaykg`.  
**Detailed database inventory:** [Authoritative Database and Repository Policy](engineering/RUPAYKG_AUTHORITATIVE_DATABASE_AND_REPOSITORY_POLICY_2026-10-31.md).

## Release decision

**Production HOLD · worker OFF · scheduler OFF · certification OFF · TRL 9 not claimed.** Do not merge, deploy, certify, replay/rollback migrations or enable scheduled processing until the applicable Shakti, security, migration, operational and independent acceptance gates pass.

A live service, HTTP 200, successful build or green CI is not by itself proof of regulatory readiness, complete production acceptance or certification.

## Current worker engineering

- PR #157 is the worker integration parent.
- PR #161 is the atomic claim / concurrency hardening follow-up; it remains draft/open/unmerged.
- Runtime-code head `fd2e52e3f73d03f73632bdccd0f0b6a03193f8b5` passed GitHub Actions run [#41205115744](https://github.com/vishaltradewinds/rupaykg/actions/runs/41205115744).
- Current PR #161 head `1b0d972b3b8899f4960e5030856fff645b177941` is one documentation-only commit beyond the tested runtime head.
- The worker migration set is not applied to authoritative production main. Production main lacks inbox/event/crosswalk/source-snapshot relations. Legacy staging contains only inbox/event tables and is not a valid worker target.

## Remaining blockers

1. Approve national system-queue versus tenant-scoped processing authority.
2. Define RLS/tenant isolation or formally approve a narrowly bounded global queue model.
3. Verify the exact deployment principal without exposing secrets.
4. Rehearse the complete ordered migration chain on a fresh disposable branch derived from authoritative production main.
5. Independently review role ownership, grants, SECURITY DEFINER functions, trigger semantics, search_path and worker access.
6. Obtain exact-head CI and separate change-window/deployment approval.

## Database and repository rules

Production main is the only system of record. Staging, rehearsal, local and CI databases are test environments only. Do not write to production or use stale staging as a substitute. Preserve migration history; resolve discrepancies only through reviewed forward-only changes. See the authoritative database policy linked above.

The current implementation repository is authoritative; the former `rupaykg-aistudio` repository is reference-only. Preserve historical documents and legacy domain references as historical knowledge, but do not treat them as current implementation specifications.

## Shakti and TRL

Apply Shakti Standards across discovery, evidence, statutory boundaries, feasibility, design, engineering, testing, independent review, approval, deployment, operation, measurement and continuous assurance. CI is engineering evidence only. TRL 9 is not claimed.


## Migration provenance status after source repair

The production-applied migration `096_verification_authorization_provenance.sql` has been restored to this review branch from the exact reviewed worker-stack Git blob. Read-only production catalog inspection confirms its four expected columns exist. The file is not yet merged to `main`. Staging migrations `20261022`–`20261025` are staging/feature history only; they are not in the production ledger and must remain on the pending worker/feature stack until independently reviewed and rehearsed. Preserve both live ledgers; do not replay or renumber migrations. Details: [authoritative database policy](engineering/RUPAYKG_AUTHORITATIVE_DATABASE_AND_REPOSITORY_POLICY_2026-10-31.md).


## Render runtime identity boundary

Read-only Render metadata confirms the live service `rupaykg` deploys `vishaltradewinds/rupaykg` branch `main`; latest live deploy source is commit `862512c8c904cef0f604df0350f02672318953af`. This does not reveal the service's Neon connection target. The secret was not retrieved. Confirm the runtime database identity through a safe non-secret metadata check before claiming the live application is connected to the authoritative Neon main branch.


## Migration source restoration update — 2026-10-31

The production-applied migration `096_verification_authorization_provenance.sql` has now been restored to the canonical-source cleanup branch from the exact reviewed Git blob already on the worker stack. Read-only production catalog inspection confirms all four columns introduced by it exist on `public.verifications`. This repairs the source-control omission on the review branch; main remains unchanged until PR review/merge. Staging migrations `20261022`–`20261025` remain feature/staging history, not production-applied migrations, and must not be promoted to production without the full release gate.


## 2026-10-31 — Production-derived worker migration rehearsal and event-writer migration repair

- Created isolated Neon branch `shakti-prod-main-worker-migration-rehearsal-20261031` (`br-young-mouse-b4jhqbci`) from authoritative production main (`br-restless-base-b44cip2h`) at parent LSN `0/2ABCA50`. It is not a source of truth. Its temporary 0.25 CU endpoint `ep-divine-lake-b4fgub83` was suspended after testing; branch retained for evidence. No production branch/endpoint was changed.
- Confirmed rehearsal began from the exact production baseline: PostgreSQL 18.6, 92 migration rows, version `096` present. Applied 23 proposed migrations sequentially from `20261022` through `20261113` (each migration and its ledger row in one transaction). Rehearsal ended with 115 migration rows and all required inbox, event, crosswalk, source-snapshot and regulatory-rule-version relations present.
- Rehearsal revealed a real defect in `20261112_inbox_event_trigger_security_definer.sql`: the first implementation transferred function ownership before attempting function ACL revocation and COMMENT. The Neon migration principal then no longer owned the function, so those owner-only operations failed. Reordered all owner-only ACL/comment operations before the ownership transfer; the corrected order succeeded on the production-derived rehearsal under the observed non-superuser owner login.
- Further hardened the migration's temporary membership grant to `ADMIN FALSE, INHERIT FALSE, SET TRUE`, revoked the temporary grant, and added a guard requiring a non-superuser migration login to be unable to SET ROLE or inherit the NOLOGIN capability. Neon provider-owned membership rows were observed with SET=false and INHERIT=false; read-only checks confirmed the migration login cannot SET ROLE or inherit the capability. The migration owner role remains a provider-managed role-membership edge requiring security review; it is not a worker login.
- The first full CI attempt on head `0c225e6` correctly failed the new guard because CI's migration runner is PostgreSQL superuser and superusers can SET ROLE to any role by definition. Added a superuser-aware guard: enforce the SET/INHERIT check for non-superuser migration logins, but do not incorrectly reject a superuser test runner. The next CI attempt on `507ac9d` exposed a PL/pgSQL dollar-quote delimiter typo; corrected it. Current final migration blob is `dde5e66853e58d8da2a5121c4561e6ceec897bb7` on worker branch `shakti/atomic-inbox-claim-2026-10-31`; exact-head CI run `41208097244` is in progress at this checkpoint.
- Verified on the Neon rehearsal that the dedicated `rupaykg_inbox_event_writer` role is NOLOGIN, NOSUPERUSER, NOCREATEROLE, NOCREATEDB and NOBYPASSRLS; it owns `record_async_mirror_inbox_event()`, which is SECURITY DEFINER with pinned `search_path=pg_catalog, public`. PUBLIC cannot execute it. The writer can INSERT event rows and use the event sequence, but cannot SELECT/UPDATE/DELETE events, read/update inbox rows or CREATE in public. Migration login cannot SET ROLE or inherit the writer capability.
- Synthetic rehearsal-only inbox insert and status transition generated exactly two append-only event rows through the trigger. An attempted event-row UPDATE was rejected with `async_mirror_inbox_events is append-only`. No real tenant or production queue rows were touched.
- RLS remains disabled with zero policies on inbox, event, crosswalk, source-snapshot and regulatory-rule-version tables in the rehearsal. This is a hard worker activation blocker pending approved national-system-queue versus tenant-scoped authority model and separate RLS/security design. Do not claim tenant isolation.
- Rechecked authoritative production main after rehearsal: still 92 migration rows through `20261021`; inbox, event, crosswalk and source-snapshot tables remain absent. No production SQL/data/ledger/role/grant/RLS change was made. Production HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed.


## 2026-10-31 — Final exact-head CI result for worker migration correction

- Final worker migration source blob for `20261112_inbox_event_trigger_security_definer.sql`: `dde5e66853e58d8da2a5121c4561e6ceec897bb7`.
- Exact worker branch head `9159ddfafa1282f65b1ae78a2aaa076cbc48d765` passed full GitHub Actions run [#41208097244](https://github.com/vishaltradewinds/rupaykg/actions/runs/41208097244), run number 3879.
- All workflow steps passed: dependency audit; migration validation; exact 92-row production-baseline reconstruction; baseline schema capture; proposed upgrade migration application; migration runner idempotency; typecheck; build; browser smoke; disposable PostgreSQL acceptance; production-shaped migration evidence upload; production container build.
- Artifact `production-shaped-migration-report` ID `13044673842`, SHA-256 `6b5de416512a7e13b8b33532732f2654ff8bc95d1ecdd5dfecd256c547f4ed58`, uploaded successfully.
- Two preceding failed CI attempts were retained as evidence: run #41207845477 exposed the superuser false-positive in the role guard; run #41208008538 exposed the malformed dollar-quote delimiter. Both were corrected before the final passing head. No failed run was hidden or relabelled.
- Validation-only PR #174 was closed unmerged after the final pass. Engineering PR #161 remains draft/open/unmerged, stacked on PR #157.
- The passing CI reconstructs and upgrades a disposable PostgreSQL baseline; the separate Neon production-derived rehearsal applied the 23 proposed migrations and verified the trigger/role behavior. Neither is production deployment approval.
- Production main was rechecked and remains at 92 migration rows with worker relations absent. No live production writes or Render changes. Production HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed.


## 2026-10-31 — Master architecture audit and runtime hardening checkpoint

The controlling audit is [RupayKg National Environmental Infrastructure — Master Architecture, Execution and TRL 9 Assurance Audit](RUPAYKG_NATIONAL_ENVIRONMENTAL_INFRASTRUCTURE_MASTER_ARCHITECTURE_EXECUTION_TRL9_AUDIT_2026-10-31.md). The separate Render runtime findings are in [Render Runtime and Deployment Security Audit](engineering/RENDER_RUNTIME_DEPLOYMENT_SECURITY_AUDIT_2026-10-31.md).

- Production main was inspected read-only: 67 public base tables, zero RLS-enabled tables, zero FORCE RLS tables and zero public RLS policies. Tenant isolation is not database-enforced; worker activation remains blocked.
- Render confirms the deployed source branch is main and the latest observed deployment SHA is 862512c8c904cef0f604df0350f02672318953af. The effective Neon database target remains unverified; no Render secrets were accessed.
- The previous Docker startup command ran database migrations and the acceptance seed before starting the API. The cleanup review branch now makes web startup migration-free and fixture-free; acceptance seeding explicitly rejects NODE_ENV=production. This is review-only and has not been merged or deployed.
- Added a test for the production acceptance-seed prohibition. Exact-head CI is pending.
- Production remains HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed.
