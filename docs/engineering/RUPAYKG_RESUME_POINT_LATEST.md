# RupayKg — latest engineering resume point

Updated: 2026-11-02 18:37 UTC
Canonical repository: vishaltradewinds/rupaykg
Reference UI repository: vishaltradewinds/rupaykg-aistudio
Governing standard: Shakti Standards — one lifecycle standard, project-specific operating systems.

## Release posture

- Production Neon: READ-ONLY / HOLD.
- Tenant isolation: FAIL/BLOCKED — 0/67 production public base tables have RLS; 0/67 have FORCE RLS.
- Production runtime separation: NOT ESTABLISHED — only the rupaykg application login role was observed; it has BYPASSRLS, CREATEROLE, CREATEDB, INHERIT and REPLICATION.
- Worker/scheduler: OFF. Certification: OFF.
- National platform: provisional TRL 3. Tested software components at most TRL 4. TRL 9 NOT ESTABLISHED.
- No regulator acceptance, live-site operation, calibrated field instrumentation, live Guardian/Hedera/Mirror Node acceptance, independent field evaluation or disaster-recovery acceptance is established.
- No production DDL/DML, migrations, role/grant/RLS changes, secret writes, branch operations, deployments, provider writes, worker activation or certification without independent gates and explicit founder approval.

## Read first

1. This resume point.
2. Immutable checkpoint: checkpoints/2026-11-02-cto-run-04-security-integration-and-verification-boundary.md
3. Session log: session-logs/2026-11-02-cto-session-04.md
4. Append-only execution log: EXECUTION_LOG.md
5. Recovered historical SQL evidence: recovered-migrations/096_verification_authorization_provenance.sql and its provenance note. This is NOT an active migration.
6. P0 bootstrap issue #195: https://github.com/vishaltradewinds/rupaykg/issues/195
7. P0 tenant isolation issue #196: https://github.com/vishaltradewinds/rupaykg/issues/196
8. P0 migration source/ledger reconciliation issue #214: https://github.com/vishaltradewinds/rupaykg/issues/214
9. P0 verification authorization issue #215: https://github.com/vishaltradewinds/rupaykg/issues/215

## Current GitHub integration state

- Current main: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- PR #192 auth/bootstrap/MRV integration spine: head 51b673dcf662dbae3f6a04ff84682083f6295fee; OPEN / DRAFT / UNMERGED. Exact-head CI 41498504841 passed all 22 steps. Relative to current main it is 537 commits ahead and 2 behind. The two main-only commits are the AUTH_DATABASE_URL add/revert sequence. Do not blindly rebase or merge this large branch; review the dedicated auth-pool contract and ancestry first. P0 verification authorization blocker #215 must be resolved before merge.
- PR #213 EPR read-only tenant route: head cd96ec579e2eda726b3fbe9e2d261f5b2ce9d832; OPEN / DRAFT / UNMERGED; stacked on the current #192 head, 30 commits ahead and 0 behind. Exact-head CI 41499847180 passed all 22 steps. Route is opt-in, default OFF, GET-only. Database contract rejects non-SELECT EPR privileges, any direct request-signing-key table privilege and CREATE on app_security. No production activation.
- PR #193 BWG profile independent-review correction: head 29e1c29254ff81db341bc55da5f2031e68928846; OPEN / UNMERGED; rebased onto current main. Exact-head CI 41500716186 passed all 17 steps. Applicant-submitted profile evidence remains PENDING / REVIEW_REQUIRED; it does not self-certify statutory applicability.
- PR #194 BWG workspace reports:read gate: head 5008a04038f2002a48949044c7389acc9eabe66f; OPEN / UNMERGED; rebased onto current main. Exact-head CI 41500726098 passed all 17 steps. Independent review remains required.
- PR #203 UI/UX parity: head 18b551cecdeb61ad1e22bbc4bd66cc648eb3a1e3; OPEN / DRAFT / UNMERGED; exact-head CI 41454665904 passed. Accessibility, localization and field-usability acceptance remain open.
- PR #204 is the documentation/checkpoint handoff branch. This checkpoint advances it; exact-head CI must be checked on the new documentation commit before accepting it.
- No PR is merged. CI success is not independent security, statutory or DBA approval.

## Authoritative Neon production

- Project: rupaykg-production-fresh / steep-mud-79906940.
- Primary/default branch: main / br-restless-base-b44cip2h. Neon reports protected=false.
- Database: rupaykg.
- 67 public base tables; 0 RLS; 0 FORCE RLS.
- 92 schema_migrations rows; latest date-version 20261021.
- 0 organizations, 0 identities, 0 organization memberships and 0 platform access requests.
- Only rupaykg-prefixed role observed: LOGIN, BYPASSRLS, CREATEROLE, CREATEDB, INHERIT and REPLICATION. No rupaykg_app_runtime or rupaykg_auth_runtime exists in production.
- Production verifications table has 0 rows. Four authorization snapshot columns exist.
- Production is the sole authoritative live database. Rehearsal and lab branches are not release authority.

### Non-authoritative Neon branches — read-only/rehearsal only

- rupaykg-tenant-isolation-lab-20261101: 67 tables; 4 RLS / 4 FORCE RLS. Dedicated app/auth runtime prototypes are NOBYPASSRLS and NOINHERIT; auth owner roles are NOLOGIN and NOBYPASSRLS. RLS tables remain owned by rupaykg, so this does not prove owner/migrator/runtime separation.
- rupaykg-rls-assurance-lab-20261101: 67 tables; 1 RLS / 1 FORCE RLS on epr_returns. App runtime is NOBYPASSRLS; table owner remains rupaykg.
- rupaykg-gov-inbox-staging-20261020: 71 tables; 0 RLS / 0 FORCE RLS; 95 migration rows through 20261025. Four staging-only migration rows/tables and no production 096 row. Do not copy this schema into production.
- Disposable geography/verifier rehearsal on br-red-salad-b4oqb4nx: seven candidate function replacements succeeded in one transaction; missing organization/geography and unknown verifier context returned FALSE; pinned search_path was observed. The branch had zero organizations/activities, so this is missing-context smoke only, not a two-tenant acceptance test. Production unchanged.

## Migration source and schema drift

- Production ledger includes 096_verification_authorization_provenance.sql, applied at 2026-10-27T13:46:14.262Z, but the file is absent from the active migrations directory.
- Git history shows the exact file in commit ca8f4100782e13f8d72106187fafc8e1e446214f, then removal in commit 54a7fe1ceb41b37a68720a71c10a1dd03af30dea with message “Remove accidentally placed unreviewed verification migration from main”.
- Exact recovered source is preserved under docs/engineering/recovered-migrations, outside the migration runner path. Do not restore to active migrations or replay until independent review. Issue #214 tracks reconciliation.
- Staging-only migrations 20261022 through 20261025 have no source in current repository path history; their four extra tables are only in the non-authoritative staging branch.
- The old migrations README statement that version 023 is absent was incorrect: 023_lifecycle_state_guards.sql exists and is recorded in production, applied 2026-10-17T10:48:22.078Z. The README is corrected in this checkpoint.
- Production verifications has 0 rows and four authorization snapshot columns. The current prevent_invalid_verification function matches recovered 096. A legacy verification_independence_guard remains, using a global membership lookup and role-name fallback. No dedicated immutable authorization-snapshot trigger was observed.

## Verification authorization and geography — P0

- Production organization_has_geography_scope returns TRUE when no VERIFIED scope exists. This is fail-open. The candidate 20261108 migration in PR #192 changes the no-scope case to FALSE, but is not deployed.
- Candidate migrations 20261106 and 20261107 reintroduce role-name fallback (VERIFIER/AUDITOR) alongside permission keys. This conflicts with explicit-permission-only hardening in migration 027 and recovered production migration 096.
- Candidate same-organization checks are applied inside the APPROVED decision branch; the legacy verification_independence_guard still uses a global membership lookup for other decisions.
- The stricter prevent_invalid_verification trigger does require same-organization VERIFIED membership, active/non-suspended identity and explicit permission for APPROVED decisions. This is a defense-in-depth inconsistency, not evidence that the approved path is wholly unguarded.
- A separate global platform-role lookup exists in prevent_unauthorized_stakeholder_approval; confirm its reserved governance boundary and active/non-suspended identity requirement.
- Issue #215 tracks the forward-only correction: same-org active membership for all decisions, explicit permissions only, verified organization/geography for approvals, removal/replacement of the legacy trigger, immutable approved snapshots, restricted function owner and disposable negative tests.
- No production trigger/function change was made.

## Tenant isolation and function exposure

- P0 issue #196 remains open. Production RLS coverage is 0/67; runtime role BYPASSRLS remains enabled.
- Previous production inventory: 78 rupaykg-owned public functions all have PUBLIC EXECUTE, none SECURITY DEFINER; 37 additional PUBLIC-EXECUTE functions are cloud_admin extension functions and must be classified separately. 70 public non-internal trigger instances map to 67 distinct application trigger functions; all inspected trigger functions are SECURITY INVOKER with no pinned function-level search_path.
- Three mutating non-trigger routines and global permission/geography helpers require call-site/dependency analysis before any privilege change. See checkpoints/2026-11-02-production-function-exposure-review.md and checkpoints/2026-11-02-production-trigger-tenant-boundary-audit.md.
- Complete the 67-table table/column/policy/owner/function/trigger/search_path/grant manifest and endpoint → SQL → pool/client/transaction → role/function → tenant/geography/bilateral-scope matrix.
- No blanket grants/revokes, RLS enablement or role changes are authorized.

## MRV, worker and external integrations

- MRV worker source-snapshot revalidation, deterministic ordering and ambiguous HCS retry-stage preservation have passing disposable tests on PR #192.
- Worker still uses direct SQL without the narrow system-actor SECURITY DEFINER/RLS contract; in-flight provider calls are not proven cancellable on lease loss. Worker remains OFF.
- Guardian, Hedera HCS and Mirror Node live acceptance, idempotency/reconciliation under real provider ambiguity, and operational monitoring remain unverified.
- No EPR, CPCB, BEE or statutory portal acceptance is claimed. EPR read route remains disabled.

## Release governance and connected systems

- GitHub repository rulesets endpoint returned an empty list. Branch-protection endpoint for main returned HTTP 403 “Resource not accessible by integration”; this connection cannot verify protection. No settings changed.
- Neon main branch currently reports protected=false.
- Render service inspection is blocked because a workspace must be explicitly selected; none was selected. No service, environment variable or deployment was changed.
- Issue #195 still requires founder approval of the initial authority identity/trust model and the out-of-band two-custodian ceremony. No bootstrap secret or authority identity was created.

## Shakti lifecycle and TRL

- Evidence discovery and read-only source/database inspection: completed for this run.
- Statutory boundary: BWG intake remains evidence-only and REVIEW_REQUIRED; no regulatory acceptance inferred.
- Feasibility/design/engineering: EPR read-only and BWG authorization candidates implemented in isolated PRs.
- Verification: exact-head CI passed for PRs #192, #193, #194 and #213 as listed above.
- Independent security/DBA review, founder approval, production migration/role provisioning, deployment, live operation, measurement and continuous assurance: NOT COMPLETE.
- National platform TRL remains provisional 3; tested software components at most TRL 4; TRL 9 NOT ESTABLISHED.

## Next actions — dependency order

1. Resolve issue #215 on a disposable PostgreSQL branch: same-org active membership for every verification decision, explicit permission keys only, fail-closed geography, remove/replace legacy global trigger, immutable approved decision/snapshot, restricted SECURITY DEFINER owner, and negative tests. Do not change production.
2. Resolve issue #214: review recovered 096 source, recover staging-only 20261022–20261025 source, reconcile exact filenames/checksums/catalog definitions and preserve ledger history.
3. Keep PR #192 draft; independently review auth/bootstrap/RLS design and reconcile its two-commit main ancestry without a blind rebase.
4. Keep PR #213 draft; independently review route, signed context, runtime privileges and candidate migration; run two-tenant disposable acceptance; keep feature flag OFF.
5. Finish the 67-table and endpoint-to-data authorization matrix; define dedicated NOLOGIN/NOBYPASSRLS owner roles, restricted app/auth runtimes and a separately controlled migration principal.
6. Complete worker system-actor functions, tenant/geography authorization, lease-loss, retry and reconciliation tests; keep worker OFF.
7. Obtain independent reviews for BWG PRs #193/#194 and complete UI accessibility, localization, tribal/field usability and end-to-end stakeholder workflows on PR #203.
8. Obtain founder approval for the one-time initial platform authority and two-custodian ceremony, then independent security/DBA approval.
9. Obtain explicit workspace selection before any Render inspection; do not select autonomously.
10. Reassess TRL only from field evidence, measured operation, regulatory/independent acceptance and continuity tests.

Production HOLD; worker OFF; certification OFF; national-platform TRL 9 NOT ESTABLISHED.