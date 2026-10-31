# RupayKg session preflight — 2026-10-31 17:18 UTC

## Scope
Resume preflight under mandatory repository rules. This note records read-only verification only and authorizes no production or release action.

## Repository and PR state — VERIFIED
- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Exact branch HEAD before this note: `66375f1691bcca0464ad9db0a9b95be3ab30cdc4`.
- Main base: `862512c8c904cef0f604df0350f02672318953af`.
- PR #175: OPEN, DRAFT, unmerged; head SHA matches branch HEAD; zero submitted reviews and zero inline review threads.
- PR #161: also OPEN/DRAFT/unmerged and points to the same branch/head, but is stacked on `shakti/integrate-government-inbox-worker-2026-10-31`. Preserve both PRs; do not merge either without dependency/review analysis.
- Branch protection: this working branch is unprotected. GitHub main protection read returned 403 (NOT ASSESSED).
- Current exact-head CI before this note: run #4030 / ID `41223840050`, IN_PROGRESS on `66375f1691bcca0464ad9db0a9b95be3ab30cdc4`. Prior green runs on earlier SHAs are not substitutes.

## Read-only Neon verification — VERIFIED
- Sole authoritative project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative primary/default production branch: `main`, ID `br-restless-base-b44cip2h`; state READY; branch protection disabled.
- Database: `rupaykg`; current inspection identity: `rupaykg` (not assumed to be the application runtime principal).
- Public base tables: 67; RLS-enabled tables: 0; public RLS policies: 0.
- Migration ledger: 92 rows, first version `001`, latest version `20261021`; latest applied timestamp `2026-10-27T13:46:14.262Z`; latest filename by applied timestamp `096_verification_authorization_provenance.sql`.
- Inspected roles: `rupaykg` and `neon_service` are LOGIN, CREATEROLE, CREATEDB, REPLICATION and BYPASSRLS; `cloud_admin` is SUPERUSER and BYPASSRLS. Least-privilege application runtime identity NOT ESTABLISHED.
- Staging and migration-rehearsal branches remain non-authoritative; none was modified.

## Provider deployment verification — BLOCKED / NOT ASSESSED
- Render workspace listing returned one workspace named `My Workspace`, ID `tea-dakh7k142hec73aj2kr0`.
- Render service listing requires explicit workspace selection; no service/deployment/runtime-principal inspection was performed. Do not infer Render runtime identity from Neon inspection role.
- GitHub main branch protection endpoint returned 403; no claim is made about its state.

## Code/test inspection — VERIFIED
- EPR BWG route validation rejects fulfilled quantity greater than obligated quantity before opening a transaction.
- Exact PostgreSQL check-constraint mapping to HTTP 409 is implemented.
- `apps/src/value-routes.test.ts` contains HTTP tests for both cases; the prior resume pointer's statement that these route-level tests were still NOT DONE is stale and must be corrected after confirming current exact-head CI.
- BWG positive verified-evidence paths for waste, EPR and ESG are present in the latest passing checkpoint (CI #4021 on SHA `b7f2889813c5f354fec1f40ecc8bab549f0e1389`) and the resume pointer records a subsequent exact-head CI #4026 on SHA `452cd4a54e2197b4103539e3279bf60e66625c15`.
- The current exact-head CI #4030 is still IN_PROGRESS; no current-head test pass is claimed.

## Production safety / NOT DONE
- No production SQL writes, DDL, DML, grants, role changes, RLS changes, migrations, deployment, worker/scheduler activation, queue replay or certification activation.
- Production remains HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.
- P0 tenant isolation, least-privilege runtime identity, branch protection, migration ledger/schema reconciliation, independent worker review and statutory BWG approval linkage remain unresolved.
- No Render service/runtime inspection; no GitHub main branch protection verification.

## Next execution
1. Complete the read-only preflight note before source changes (this note).
2. Confirm the current CI #4030 conclusion for the exact branch HEAD.
3. Continue with the highest-value safe BWG/evidence acceptance gap, prioritising cross-tenant evidence/verification rejection and replay/idempotency; do not weaken dual control or auto-promote BWG applicability.
4. Create an immutable checkpoint and update the latest resume pointer with the exact final HEAD and exact-head CI state.
5. Keep PRs draft and production HOLD until independent review, migration/security, runtime identity, backup/restore and explicit approval gates are satisfied.
