# RupayKg — latest engineering resume point

Updated: 2026-11-03 17:39 UTC  
Canonical repository: vishaltradewinds/rupaykg  
Reference UI repository: vishaltradewinds/rupaykg-aistudio  
Governing standard: Shakti Standards — one lifecycle standard, project-specific operating systems.

## Release posture

- **Production Neon: READ-ONLY / HOLD.**
- Tenant isolation: **FAIL/BLOCKED** — 0/67 public base tables have RLS; 0/67 have FORCE RLS; 0 public policies were returned.
- Runtime separation: **NOT ESTABLISHED** — production login role rupaykg still has BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION and INHERIT. No rupaykg_app_runtime or rupaykg_auth_runtime role exists.
- Worker/scheduler: OFF. Certification: OFF.
- National platform: provisional TRL 3. Tested software components at most TRL 4. TRL 9 NOT ESTABLISHED.
- No regulator acceptance, live-site operation, calibrated field instrumentation, live Guardian/Hedera/Mirror Node acceptance, independent field evaluation or disaster-recovery acceptance is established.
- No production DDL/DML, migration, role/grant/RLS change, Neon branch operation, secret write, deployment, provider write, worker activation or certification without required independent gates and explicit founder approval.

## Read first

1. This resume point.
2. Immutable checkpoint: docs/engineering/checkpoints/2026-11-03-cto-run-05-tenant-auth-and-release-controls.md
3. Session log: docs/engineering/session-logs/2026-11-03-cto-session-05.md
4. Append-only execution log: docs/engineering/EXECUTION_LOG.md
5. P0 issues: #195 founder authority/bootstrap, #196 tenant isolation, #214 migration source/ledger, #215 verification authorization.
6. Current PRs and their exact-head CI below. No PR is merged by this run.

## Canonical repository and current integration state

- Current main: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- PR #192 auth/bootstrap/MRV integration spine: head 070c2f9982406b91c8fe7b6354044c1def1467ae; OPEN / DRAFT / UNMERGED; exact-head CI 41597790231 passed. It remains 537 commits ahead and 2 behind current main. Do not blindly rebase or merge this large branch.
- PR #213 EPR read-only signed-RLS route: head 8d708f59a2b9f9bfe7265ce7e525f77e481af32a; OPEN / DRAFT / UNMERGED; stacked on PR #192. This latest head has no exact-head CI run; earlier green CI does not validate it. Feature flag RUPAYKG_EPR_RETURN_READ_ENABLED remains OFF.
- PR #237 migration checksum integrity: head 6f1c1da2bf54da6afee2da78dad325d7b661598b; OPEN / DRAFT / UNMERGED; base is PR #192; exact-head CI 41675740886 passed. Historical exact-byte provenance remains incomplete.
- PR #238 verification provenance fixture: head 33d229181f3057158ab27c8fbf5de5fe2e9a3747; OPEN / DRAFT / UNMERGED; base main; exact-head CI 41679597943 passed. It is an unnumbered disposable proposal, not a production migration.
- PR #242 active-organization/EPR transaction hardening: head 8c0522b4ff1e2c75203490ce14488aa8830361f6; OPEN / DRAFT / UNMERGED; base main; exact-head CI 41685695043 passed. Five Fastify route tests were added. This route module is not registered by main server.ts; it is dormant and does not activate an API route.
- PR #193 BWG independent-review correction: head 29e1c29254ff81db341bc55da5f2031e68928846; OPEN / UNMERGED; exact-head CI 41500716186 passed.
- PR #194 BWG reports:read gate: head 5008a04038f2002a48949044c7389acc9eabe66f; OPEN / UNMERGED; exact-head CI 41500726098 passed.
- PR #203 UI parity: CLOSED / UNMERGED. Its UI work is not integrated into main.
- PR #204 is the documentation/checkpoint handoff branch. This checkpoint advances it; check the new documentation head separately. The prior head 626a6fa had CI 41502282292 SUCCESS.
- No PR is merged. CI success is engineering evidence, not independent security, statutory, DBA or production approval.

## Authoritative Neon production — read-only evidence

- Project: rupaykg-production-fresh / steep-mud-79906940.
- Primary/default branch: main / br-restless-base-b44cip2h. Neon reports protected=false.
- Database: rupaykg.
- Public base tables: 67; RLS: 0; FORCE RLS: 0; public policies: 0.
- schema_migrations: 92 rows; first version 001; latest version 20261021; latest applied_at 2026-10-27T13:46:14.262Z. Ledger version 096 exists exactly once.
- Organizations: 0; identities: 0; organization_memberships: 0; verifications: 0.
- No rupaykg_app_runtime or rupaykg_auth_runtime role exists. The rupaykg login role has BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION and INHERIT.
- A read-only information_schema query returned no platform_access_requests relation. Do not repeat the earlier unsupported claim that this table has zero rows; the relation is absent from the inspected database.
- Production is the sole authoritative live database. Rehearsal/lab branches are not release authority.

### Verification triggers and geography — P0

- Live organization_has_geography_scope returns TRUE when no VERIFIED scope exists. This is fail-open. Candidate migration 20261108 changes the no-scope case to FALSE but is not deployed.
- Live verification_independence_guard is a BEFORE INSERT trigger using a global membership lookup and role-name fallback (VERIFIER/AUDITOR).
- Live verifications_integrity_guard is BEFORE INSERT OR UPDATE. It enforces same-organization verified membership, active/non-suspended identity and explicit permission for APPROVED decisions, and writes the four authorization snapshot fields.
- Both inspected trigger functions are SECURITY INVOKER and have no pinned function-level search_path.
- Current PR #192 migrations 20261106/20261107 do not contain the role-name fallback described in an older issue comment. Migration 20261106 drops the legacy independence trigger and checks subject-organization membership/explicit permissions for inserted decisions; migration 20261108 is the candidate fail-closed geography correction. These remain candidate-only.
- PR #192's candidate verifier path does not yet lock identity, membership and role rows during authorization. A concurrent suspension, membership revocation or permission edit is not proven to serialize with a decision.
- PR #238's unnumbered provenance fixture adds row-lock/concurrency tests for its APPROVED path, but does not install/remove the live legacy trigger in its harness; rejected-decision authorization/snapshot semantics differ from PR #192's immutable-decision model. The two proposals must be reconciled into one independently reviewed trigger design before a migration number is assigned. Issue #215 tracks this.
- No production trigger/function change was made.

## Migration source and checksum reconciliation — P0

- Production ledger includes 096_verification_authorization_provenance.sql, applied at 2026-10-27T13:46:14.262Z, but that source is absent from the active migration directory.
- Exact source was recovered from immutable Git commit ca8f4100782e13f8d72106187fafc8e1e446214f, blob 258b1f4534efbf915688f78aa84d4ec24a47cbc0. It is preserved outside the migration runner in the evidence branch and recovered-migrations documentation. Do not replay it or restore it to active migrations without independent review.
- PR #237 reports 91 executable migration files: 91 filenames match live ledger versions; one ledger row (096) has no executable source. Filename parity is not proof of exact applied bytes; the other 91 ledger rows still lack exact-byte execution provenance.
- Non-authoritative staging had four additional migration rows (20261022–20261025) and four extra tables. Do not copy staging schema into production or rewrite production ledger history.
- Issue #214 tracks exact source, checksum and staging-lineage reconciliation. Do not synthesize/backfill hashes from current files.

## Tenant isolation, authorization and least privilege — P0

- Issue #196 remains open. Production has 0/67 RLS and 0 public policies; rupaykg is BYPASSRLS/CREATEROLE/CREATEDB.
- Complete the 67-table table/column/policy/owner/function/trigger/search_path/grant manifest and endpoint → SQL → pool/client/transaction → role/function → tenant/geography/bilateral-scope matrix.
- Define separate NOLOGIN/NOBYPASSRLS owner roles, a restricted application runtime, a restricted authentication runtime and a separately controlled migration principal. Prove RLS under the actual runtime roles in two-tenant PostgreSQL tests.
- No blanket grants/revokes, RLS enablement or role changes are authorized.

## EPR integration — do not duplicate route registration

- PR #213 registers a separate GET /api/v1/epr/returns implementation only behind RUPAYKG_EPR_RETURN_READ_ENABLED. It uses the signed withRlsRequestTransaction boundary and an explicit-client database contract. The feature flag remains OFF; its latest head has no exact-head CI.
- PR #242 hardens the legacy registerEprReturnRoutes module: it carries only a SHA-256 session-token hash in AuthContext, revalidates/locks session, identity, membership and role in one transaction, and locks the verified scheme and obligation before create. Its five Fastify tests and full exact-head CI passed. Read-only Neon EXPLAIN confirmed the lock queries parse/plan; EXPLAIN was not ANALYZE and acquired no row locks.
- Main apps/src/server.ts does not import/register registerEprReturnRoutes. PR #242 is therefore dormant. Both PR #213 and #242 declare GET /api/v1/epr/returns. Do not register both plugins or activate either implementation.
- Integration decision: keep one canonical signed-RLS GET route from #213; port any required EPR write/session-lock guarantees from #242 into the same controlled tenant-transaction architecture only after two-tenant PostgreSQL concurrency tests and independent review.
- PR #242 still lacks real two-tenant PostgreSQL concurrency tests for session revocation, identity suspension, membership revocation and role permission changes. Route mocks are not a substitute.

## Render and release governance

- Explicitly selected Render workspace was inspected read-only. The rupaykg Docker web service auto-deploys from GitHub main. Its latest visible live deployment is commit a3fecc0abd2c46549a201058d3963afc0e3a73c9, deployment dep-dbjo4dqvcj2c73f7bt00 (started 2026-11-01 18:17:27 UTC; completed 18:19:04 UTC).
- The Render web service allowlist is 0.0.0.0/0. This is web-service ingress, not a database allowlist.
- Current Render workspace inventory returned no managed Postgres instances. This does not prove the previous rupaykg-db resource was deleted/restored; its database-specific state remains unresolved. Neon is the only identified authoritative database.
- No Render environment-variable values or secrets were read.
- GitHub repository rulesets returned an empty list. The main branch-protection endpoint returned HTTP 403 (Resource not accessible by integration); protection is unverified, not confirmed absent.
- Because main merges can auto-deploy and branch protection cannot be independently verified through this connection, do not merge security/migration PRs until all gates and explicit founder release approval are complete.
- Neon main reports protected=false.

## Shakti lifecycle and TRL

- Context/evidence discovery: current GitHub PR/CI/issue state, authoritative Neon catalog, Render service/deployment inventory and route-registration source inspected read-only.
- Statutory boundary: no CPCB/BEE/EPR/carbon regulator acceptance inferred from software tests or candidate schemas.
- Feasibility/design: EPR route transaction hardening is implemented in a dormant candidate module; verification proposals remain design-divergent and require independent reconciliation.
- Engineering/tests: PR #242 exact-head CI passed; PR #192, #237 and #238 exact-head CI passed as listed. PR #213 latest head has no exact-head run.
- Independent security/DBA review, founder authority ceremony, production migration/role provisioning, deployment, field operation, measurement and continuous assurance: NOT COMPLETE.
- National platform TRL remains provisional 3; tested software components at most TRL 4; TRL 9 NOT ESTABLISHED.

## Next actions — dependency order

1. Resolve issue #215: one immutable/traceable verification-decision model; same-organization active membership and explicit permission for every decision; remove the legacy global trigger; fail-closed geography for approvals; lock authorization rows with a reviewed lock order; add legacy-trigger, two-tenant and concurrency regressions. Do not assign a numbered migration until the design is independently approved.
2. Resolve issue #214: complete 096 source provenance, exact-byte ledger recovery and staging-only 20261022–20261025 source reconciliation. Keep PR #237 draft pending independent migration-runner review.
3. Complete the 67-table and endpoint-to-data matrix; define NOLOGIN/NOBYPASSRLS owner/runtime roles and two-tenant RLS acceptance. Keep production unchanged.
4. Reconcile EPR route registration: one signed-RLS GET route, no duplicate registration, then port write paths into the same tenant transaction model and add real PostgreSQL concurrency tests. Keep feature flags OFF.
5. Keep PR #192 as the single auth/bootstrap/MRV integration spine; resolve its 537-ahead/2-behind ancestry without blind rebase or merge. PR #213 and #237 remain stacked candidates.
6. Complete worker system-actor/RLS contract, lease-loss, retry and provider reconciliation; keep worker OFF.
7. Obtain independent review for BWG PRs #193/#194; reopen UI parity work only through a reconciled, non-duplicate branch because #203 is closed unmerged.
8. Obtain founder approval for initial platform authority identity and out-of-band two-custodian ceremony, then independent security/DBA and explicit release approval.
9. Reassess TRL only from measured field operation, statutory/independent acceptance, live integrations and continuity tests.

Production HOLD; worker OFF; certification OFF; national-platform TRL 9 NOT ESTABLISHED.