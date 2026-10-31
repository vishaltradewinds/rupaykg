# Execution Status — 2026-10-31

**Canonical repository:** `vishaltradewinds/rupaykg`, branch `main`.  
**Authoritative live database:** Neon `rupaykg-production-fresh` / project `steep-mud-79906940` / branch `main` / database `rupaykg`.  
**Detailed database policy:** [Authoritative Database and Repository Policy](engineering/RUPAYKG_AUTHORITATIVE_DATABASE_AND_REPOSITORY_POLICY_2026-10-31.md).  
**Current checkpoint:** [Current Source of Truth](CURRENT_SOURCE_OF_TRUTH.md).  
**Append-only execution log:** [Execution Log](engineering/EXECUTION_LOG.md).

## Gate summary

| Gate | Status | Evidence / next action |
|---|---|---|
| Authoritative database | IDENTIFIED | One Neon project; production main is the sole system of record. |
| Production worker schema | ABSENT | Main has 92 migration rows; inbox/event/crosswalk/source-snapshot relations are absent. |
| Legacy staging | NON-AUTHORITATIVE / INCOMPLETE | 95 migration rows; inbox/event exist; crosswalk/source snapshots absent. |
| Older rehearsal | SUPERSEDED / NON-AUTHORITATIVE | Derived from staging; same partial worker schema. |
| Fresh rehearsal | CANDIDATE ONLY | Derived from main; no compute endpoint; no migration rehearsal performed. |
| Worker PR #161 | DRAFT / OPEN / UNMERGED | Runtime SHA `fd2e52e...` passed CI #41205115744; current PR head has docs-only update. |
| Queue authority and RLS | BLOCKED | Explicit national-vs-tenant scope and RLS/security decision remain open. |
| Deployment identity | UNVERIFIED | Confirm exact principal without disclosing secret values. |
| Full-chain migration rehearsal | OPEN | Rehearse ordered chain on a fresh disposable branch from production main. |
| Production deployment / scheduler | HOLD / OFF | Requires independent review and explicit approval. |
| Certification / TRL 9 | OFF / NOT CLAIMED | Requires Shakti and real-world independent evidence. |

## Next coherent batch

1. Review and merge the database/repository cleanup PR only after documentation and CI review.
2. Reconcile every worker migration against the actual production-main baseline; do not apply isolated migrations.
3. Use one fresh production-main-derived disposable branch for the approved migration rehearsal; preserve exact schema/migration evidence.
4. Resolve national system-queue versus tenant-scoped authority and the RLS model before worker activation.
5. Verify the exact deployment principal safely.
6. Obtain independent security review and explicit change-window approval before production/staging writes or deployment.

## Safety

No live Neon schema/data/role/grant/RLS writes, migration replay/rollback, worker or scheduler activation, Render changes, production deployment or certification is authorized by this status file.


**Migration source status:** production-applied migration `096_verification_authorization_provenance.sql` has been restored to the cleanup review branch and its four expected production columns were confirmed read-only. It is not yet merged to `main`. Staging-only migrations `20261022`–`20261025` remain pending feature history on the worker PR stack; they are not part of the production baseline. Do not edit or replay either live ledger.


**Migration source repair in review:** exact production-applied migration `096_verification_authorization_provenance.sql` has been restored to the cleanup branch; live production catalog confirms its four expected verification columns. It is not yet merged to `main`. Staging-only migrations `20261022`–`20261025` remain pending feature history and are not part of the production baseline.


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
