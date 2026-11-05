# RUPAYKG RESUME POINT — 2026-11-05

## Controlled integration spine
Authoritative repository: vishaltradewinds/rupaykg.
Current main: 5bdb3875f947aa53adad1768ab13657749d71a3f.
Production remains READ-ONLY / HOLD.

## Current critical path
1. P0 web startup isolation: remove implicit production migrations/fixtures from long-lived web startup.
2. Protected migrator remains separate and unmerged (#291).
3. Migration lineage remains unresolved because production ledger contains 096 while active source is absent; no ledger rewrite or reintroduction without independent review.
4. Tenant isolation/RLS and runtime DB identity remain release gates.
5. Recovery/restore evidence must be disposable and bounded; never use production for rehearsal.

## Latest engineering batch — VERIFIED
Branch: shakti/2026-11-05-bounded-recovery-rehearsal.
PR #303.
Verified branch head: 27ab49e775775f6bebc39d5a51466ed67a5c06f0.
CI #5628 / run 42067352947: SUCCESS.
All validation job steps 1–15 completed successfully, including:
- migration validation
- API migration execution in CI
- typecheck/build
- browser smoke test
- disposable PostgreSQL acceptance tests
- production container build
- bounded disposable pg_dump/pg_restore rehearsal
- explicit assertion that the production web container CMD is exactly ["node","apps/dist/src/production-server.js"] and therefore does not invoke migrate.js or acceptance-seed.js at long-lived web startup.

This validates the branch-level engineering gate in CI. It does not validate production deployment, production database state, field acceptance, statutory/regulatory approval, certification, or TRL 9.

## Parallel release/security work
- #291 protected migrator: open, unmerged, non-draft; CI previously green.
- #298 combined security convergence: draft/open/unmerged validation-only; CI previously green.
- #302 oversized production-representative rehearsal stack: open, unmerged; do not merge.
- #303 clean bounded recovery branch: open, unmerged; CI #5628 SUCCESS.

## Production evidence already established
- Render service auto-deploys main; current live deploy is commit 5bdb3875.
- Authoritative Neon project: steep-mud-79906940; main branch is the sole live database baseline.
- Production lineage read-only evidence: migration 096 is ledger-applied; 20261022–20261025 are not production-applied.
- Render previously logged web startup migration check (Database migrations are current (91 files)), proving the old web startup path executed migration logic.

## Next safe action
Treat #303 as a verified validation artifact, not a production release. Reconcile its startup-isolation change with protected migrator #291 and security convergence #298 without duplicating migration logic. Continue the P0 release gates: authoritative Neon migration lineage, tenant isolation/RLS, runtime DB identity, and least privilege. Do not merge/deploy or touch production without the required independent gates and explicit founder approval.
