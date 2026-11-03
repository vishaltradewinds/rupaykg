# Immutable engineering checkpoint — 2026-11-03 CTO run 05

## Purpose

Preserve the exact evidence and engineering changes from the 3 November 2026 RupayKg execution run. This checkpoint is documentation/evidence only; application changes remain in their own draft pull requests.

## Canonical source and live repository state

- Repository: vishaltradewinds/rupaykg.
- Main head observed: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- PR #192 current head: 070c2f9982406b91c8fe7b6354044c1def1467ae; exact-head CI 41597790231 SUCCESS; 537 commits ahead and 2 behind main; remain DRAFT.
- PR #213 current head: 8d708f59a2b9f9bfe7265ce7e525f77e481af32a; no exact-head CI run; stacked on #192; EPR read-only feature flag OFF.
- PR #237 current head: 6f1c1da2bf54da6afee2da78dad325d7b661598b; exact-head CI 41675740886 SUCCESS; draft migration checksum reconciliation.
- PR #238 current head: 33d229181f3057158ab27c8fbf5de5fe2e9a3747; exact-head CI 41679597943 SUCCESS; unnumbered verification provenance fixture.
- PR #242 current head: 8c0522b4ff1e2c75203490ce14488aa8830361f6; exact-head CI 41685695043 SUCCESS; draft EPR transaction/authorization hardening.
- PR #193 exact-head CI 41500716186 SUCCESS; PR #194 exact-head CI 41500726098 SUCCESS.
- PR #203 is CLOSED/UNMERGED; UI parity is not in main.
- PR #204 documentation branch is the current home of this resume point and checkpoint. No PR was merged.

## Engineering changes preserved in PR #242

The EPR route module on branch fix/epr-active-org-scope was re-read before each update; no force-push or history rewrite was used.

- The branch already contained a same-transaction EPR return create path at commit f17cd37ef2f8fb9933e5325a7c4955e5abe9c25b.
- Commit 7ff97c23b3a76f98801ed9eba94e985143c35be6 adds the internal SHA-256 session-token hash to AuthContext and an opt-in transaction-bound authorization check. It revalidates the exact active session, verified/non-suspended identity, same-organization verified membership and explicit role permission, using FOR SHARE locks on session, identity, membership and role.
- The EPR list read now uses the same checked-out transaction client for permission and data read. Create uses the same client for permission, scheme/obligation eligibility row locks and insert. Submit and external-reference mutation use the locked authorization helper while holding the target-return row lock.
- Five Fastify tests cover transaction ordering, session/current-authorization denial, ineligible obligation, tenant-scoped list read and explicit active-organization selection.
- The first exact-head run for 7ff97c2 failed because the fake client test matchers were case-sensitive while SQL uses lowercase FOR SHARE. Commit 8c0522b4ff1e2c75203490ce14488aa8830361f6 corrected the test matchers to be case-insensitive.
- Exact-head CI run 41685695043 passed dependency audit, migration validation, disposable PostgreSQL migration execution, typecheck, production build, browser smoke, automated tests (including the five new route tests), production container build and cleanup.
- Read-only Neon EXPLAIN (COSTS OFF), without ANALYZE, confirmed both authorization-lock and scheme/obligation-lock SELECT statements parse and plan against the current schema. No rows were locked or changed by EXPLAIN.
- Limitation: these route tests use a deterministic fake pool. A real two-tenant PostgreSQL concurrency test for session revocation, identity suspension, membership revocation and role-permission changes remains mandatory.

## EPR integration conflict discovered

- Main apps/src/server.ts does not import/register registerEprReturnRoutes; PR #242 changes a dormant module and does not activate an API route.
- PR #213 separately registers registerEprReturnReadRoute only when RUPAYKG_EPR_RETURN_READ_ENABLED=true, after signed request-context/database contract checks. It declares the same GET /api/v1/epr/returns path.
- Do not register both modules. The current integration direction is one canonical signed-RLS GET route from #213, with required write/session-lock guarantees from #242 ported into the same tenant transaction architecture after two-tenant acceptance.
- PR #213's current head has no exact-head CI run. Feature flag remains OFF.

## Authoritative Neon production — read-only

Project rupaykg-production-fresh / steep-mud-79906940; default main branch br-restless-base-b44cip2h; database rupaykg.

- 67 public base tables; 0 RLS; 0 FORCE RLS; 0 public policies.
- 92 schema_migrations rows; latest version 20261021; latest applied_at 2026-10-27T13:46:14.262Z; version 096 exists once.
- organizations 0; identities 0; organization_memberships 0; verifications 0.
- rupaykg login remains BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION and INHERIT. No rupaykg_app_runtime or rupaykg_auth_runtime role exists.
- information_schema has no platform_access_requests relation; do not report a zero-row count for that nonexistent relation.
- organization_has_geography_scope remains fail-open when no VERIFIED scope exists.
- verification_independence_guard still performs a global membership lookup and role-name fallback. verifications_integrity_guard enforces same-org active membership and explicit permission for APPROVED decisions and writes four authorization snapshot fields. Both functions are SECURITY INVOKER with no pinned function-level search_path.
- No production DDL/DML, migration, role/grant/RLS change, branch operation or certification was performed.

## Verification design reconciliation — P0

- Current PR #192 migrations 20261106/07 do not contain the role-name fallback stated in an older issue note. Migration 20261106 drops the legacy trigger and uses subject-organization explicit-permission checks for inserted decisions; 20261108 is fail-closed geography candidate.
- PR #192's candidate verifier path does not yet lock identity, membership and role rows during authorization.
- PR #238's unnumbered fixture tests historical approval snapshot behavior and row-lock concurrency for its APPROVED path, but does not install/remove the live legacy trigger in its harness. Rejected-decision authorization/snapshot semantics differ from PR #192's immutable-decision model.
- The branches are complementary but not yet one approved design. Issue #215 was updated with this source correction and the required reconciliation. No numbered migration was created or applied.

## Migration lineage — P0

- Production ledger has 92 rows; version 096 exists once, applied 2026-10-27T13:46:14.262Z.
- PR #237 reports 91 executable migration files matching 91 ledger versions; 096 has no active executable source. Exact source recovered from commit ca8f4100782e13f8d72106187fafc8e1e446214f, blob 258b1f4534efbf915688f78aa84d4ec24a47cbc0.
- Exact-byte proof is still absent for the 91 matching files; do not synthesize checksums. Staging-only 20261022–20261025 source/tables remain non-authoritative.
- Issue #214 was updated with this evidence. No production migration or ledger change was performed.

## Render/GitHub release controls — read-only

- Render workspace inspection found the rupaykg Docker web service auto-deploys from GitHub main. Latest visible live deployment: commit a3fecc0abd2c46549a201058d3963afc0e3a73c9, deployment dep-dbjo4dqvcj2c73f7bt00, started 2026-11-01 18:17:27 UTC and completed 18:19:04 UTC.
- Render web-service allowlist is 0.0.0.0/0; this is web ingress, not a database allowlist.
- No managed Render Postgres instances were returned. The previous rupaykg-db database-specific state could not be re-identified; no database setting was changed.
- No environment-variable values or secrets were read.
- GitHub rulesets endpoint returned an empty list; main branch-protection endpoint returned HTTP 403, so protection remains unverified.
- Issues #101 and #112 were updated to distinguish web-service exposure from database networking and to record auto-deploy/branch-protection risk.

## TRL and release decision

National platform remains provisional TRL 3; tested software components at most TRL 4. TRL 9 is not established. No regulatory acceptance, live field operation, calibrated instrumentation, production RLS, independent DBA/security acceptance or disaster recovery evidence is established.

Production HOLD; worker OFF; certification OFF. No merge, deployment, production write, production migration, role/grant/RLS change, Neon branch operation, provider write or worker activation was performed.

## Next actions

1. Reconcile one immutable/traceable verification-decision model; same-org active membership and explicit permission for every decision; remove legacy trigger; fail-closed geography for approvals; lock authorization rows; add two-tenant and concurrency regressions. Keep production unchanged.
2. Complete migration 096 exact provenance and staging-only source reconciliation; keep PR #237 draft pending independent review.
3. Complete 67-table tenant/policy/function/trigger/endpoint matrix and restricted runtime roles; no blanket production grants or RLS activation.
4. Reconcile EPR registration to one signed-RLS GET path and port write guarantees into the same tenant transaction architecture; add real PostgreSQL concurrency tests; keep feature flags OFF.
5. Keep PR #192 as the single auth/bootstrap/MRV integration spine; no blind rebase/merge.
6. Complete worker system-actor/RLS, lease-loss and provider reconciliation; keep worker OFF.
7. Obtain founder authority/two-custodian approval and independent security/DBA/release approvals before production operations.