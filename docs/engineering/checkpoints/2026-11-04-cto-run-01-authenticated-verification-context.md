# RupayKg CTO immutable checkpoint — 2026-11-04, run 01

**Objective:** resume canonical RupayKg engineering under Shakti Standards, inspect actual GitHub/CI/Neon state, execute the largest safe coherent batch, and preserve the next execution point.

## Exact-head engineering evidence

### PR #282 — authenticated verification context v4
- Branch: `security/verification-authenticated-context-proof-v4-2026-11-04`.
- Exact head: `7963719280d20d2e285d3011ea390aee5ab46e9d`.
- Exact-head CI: [#5474](https://github.com/vishaltradewinds/rupaykg/actions/runs/41815073863), run ID `41815073863`, SUCCESS.
- All 37 reported job steps completed successfully. Key checks: migration validation; repository migration execution on disposable CI PostgreSQL; exact candidate verification fixture; authenticated-context spoof/revocation tests; actual-schema non-owner and SECURITY DEFINER tests; least-privilege guard-role test; typecheck; build; browser smoke; PostgreSQL acceptance; production-container build.
- The test architecture uses a dedicated NOLOGIN/NOSUPERUSER/NOBYPASSRLS context owner, a private test HMAC key, SECURITY DEFINER issuer/validator functions, bearer-token hash/session validation, verified identity/membership/organization checks, row locks, transaction-local signed context and narrow column-scoped UPDATE(id) privileges for row-lock mechanics.
- The proof rejects arbitrary caller-set context GUCs and revoked bearer sessions.
- **Limit:** PR body explicitly says the architecture is not integrated into API request transactions or all RLS policies. It remains draft/unmerged and requires independent DBA/security review. This is not production authorization approval or tenant-isolation certification.
- CI evidence and limitations were recorded in PR #282 and issue #215.

### Related actual-schema and concurrency evidence
- PR #277 head `f49fb026b6651fef2822d970bf78c762283b8b25`; CI #5465 / run ID `41813321638` SUCCESS. Actual-schema test proves candidate trigger mechanics but also demonstrates current cross-tenant evidence visibility with RLS disabled and the danger of trusting caller-controlled tenant GUCs.
- PR #278 head `d785882c4befc3ecb360e7c73e2005bfdbfe3c13`; CI #5457 / run ID `41812353414` SUCCESS. Closed unmerged after evidence capture because it was explicitly a temporary CI-validation PR. PR #263 remains the authoritative prototype.
- PRs #279, #280 and #281 were earlier versions of the same authenticated-context proof. They were commented and closed unmerged as superseded by PR #282. Branches were retained; no branch deletion or merge occurred.
- PR #275 remains documentation-only ODK/CREDEBL interoperability contracts.

## Fresh authoritative Neon read-only evidence

Inspected project `steep-mud-79906940`, default branch `br-restless-base-b44cip2h` (`main`), database `rupaykg`.

A read-only catalog query returned:
- 67 public base tables.
- 0 RLS-enabled tables.
- 0 FORCE RLS tables.
- 0 public policies.
- `schema_migrations`: 92 rows; latest version `20261021`.
- Relevant login role `rupaykg`: LOGIN, BYPASSRLS, CREATEROLE and CREATEDB; not SUPERUSER.
- No dedicated `rupaykg_app_runtime` or `rupaykg_auth_runtime` role was observed.

Neon reports the default branch `protected=false`. The queries were SELECT/catalog-only. No production DDL/DML, role/grant/RLS change, migration or Neon branch operation was performed.

## Security interpretation and remaining gates

The latest proof advances the critical trust boundary: a raw caller-controlled PostgreSQL GUC is not treated as identity proof; a private-key HMAC over session-bound identity, organization, session and expiry is required. The issuer validates the opaque bearer token against the existing session/identity/membership/organization records and takes row locks. The API proof role cannot read the private key or session table.

This is a useful mechanics proof, not the end-to-end design. The following remain open:
1. Integrate context issuance into the actual API request transaction and ensure the same connection/transaction is used for protected verification writes.
2. Reconcile the new guard with the canonical verification trigger and all decision types, including pending/rejected as well as approved.
3. Confirm authenticated activity organization and verifier identity cannot diverge from evidence ownership or supplied activity identifiers.
4. Reconcile the legacy global-membership/role-name trigger and remove it only after replacement tests prove all required independence properties.
5. Lock verified organization status, identity, membership, role permissions and geography authority in one documented global lock order.
6. Add two-tenant concurrency, revocation/suspension, geography reassignment/revocation, self-review and immutability/DELETE/TRUNCATE/bypass tests.
7. Design tenant RLS policies and prove them under actual non-owner runtime identities. Current production RLS remains zero.
8. Obtain independent DBA/security review before assigning a numbered migration or proposing production changes.

## Migration lineage and release posture

Issue #214 remains open: production has 92 ledger rows, latest version 20261021, and applied migration 096 has no executable source in the active migration directory. Recovered 096 remains evidence only. Exact-byte provenance and staging-only source reconciliation are unfinished.

Production Neon remains 0/67 RLS, 0 FORCE RLS, 0 policies; the elevated `rupaykg` login role remains. No production changes are authorized by this checkpoint.

## Actions performed this run

1. Retrieved the latest Daily Engineering automation prompt and executed it inline.
2. Inspected the canonical GitHub repository, open PRs, branch inventory, issues #214/#215 and previous documentation handoff PR #204.
3. Retrieved PR #282 exact-head workflow runs and job steps; verified CI #5474 SUCCESS.
4. Retrieved PR #277 exact-head CI #5465 SUCCESS and PR #278 CI #5457 SUCCESS.
5. Added exact-head CI evidence and scope limitations to PR #282.
6. Added the 4 November evidence update to P0 issue #215.
7. Closed PRs #279–#281 as superseded by PR #282, retaining their branches.
8. Closed temporary validation PR #278 after its exact-head evidence was captured, retaining the branch and leaving PR #263 unchanged.
9. Re-inspected authoritative Neon main with read-only catalog queries.
10. Created this immutable checkpoint, updated the latest resume point and appended the execution log on a new documentation branch based on PR #204's last recorded head.

## Next execution — do not ask for routine prioritisation

1. Inspect PR #282 for remaining proof defects and compare its fixture with actual API transaction flow. Integrate only on one controlled branch after contract review.
2. Inspect the canonical verification trigger/migration candidate and reconcile it with the legacy trigger and PR #238 snapshot model. Keep migration source outside the active runner until design and independent review are complete.
3. Extend disposable PostgreSQL acceptance to all decision types, two-tenant identity spoofing, session revocation, membership/role/organization/geography races and immutable-decision paths.
4. Continue migration 096 exact-byte provenance and staging migration source recovery independently of verification integration.
5. Continue 67-table ownership, RLS and endpoint-to-data authorization matrix.
6. Keep EPR, BWG, MRV worker and national operations behind their existing dependency and release gates.

**Release:** Production READ-ONLY / HOLD. Worker OFF. Certification OFF. National platform provisional TRL 3; tested components at most TRL 4; TRL 9 NOT ESTABLISHED.

**Explicitly not performed:** production DDL/DML, migration, role/grant/RLS change, Neon branch operation, deployment, worker/scheduler activation, external provider write, merge or certification.
