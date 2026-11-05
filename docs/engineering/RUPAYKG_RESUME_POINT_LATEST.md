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

## Latest engineering batch
Branch: shakti/2026-11-05-bounded-recovery-rehearsal.
PR #303.
Latest branch commit: 97717d6f7c4e29a9c6549616f16e5dbbc5d29bec (documentation checkpoint commit).
CI #5624 at prior head 321e5bdf: steps 1–14 passed; step 14 proved disposable pg_dump/pg_restore recovery and preserved schema_migrations count 91/latest 20261021. Step 15 failed because Dockerfile still used migrate.js and acceptance-seed.js at web startup.
The Dockerfile has now been corrected on PR #303 to CMD ["node","apps/dist/src/production-server.js"]. Fresh CI is required; this is not yet validated.

## Parallel release/security work
- #291 protected migrator: open, unmerged, non-draft; CI previously green.
- #298 combined security convergence: draft/open/unmerged validation-only; CI previously green.
- #302 oversized production-representative rehearsal stack: open, unmerged; do not merge.
- #303 clean bounded recovery branch: open, unmerged; current focused validation spine.

## Production evidence already established
- Render service auto-deploys main; current live deploy is commit 5bdb3875.
- Authoritative Neon project: steep-mud-79906940; main branch is the sole live database baseline.
- Production lineage read-only evidence: migration 096 is ledger-applied; 20261022–20261025 are not production-applied.
- Render previously logged web startup migration check (Database migrations are current (91 files)), proving the old web startup path executed migration logic.

## Next safe action
Verify fresh CI for the current branch head 97717d6f7c4e29a9c6549616f16e5dbbc5d29bec, fix only observed failures, then preserve exact CI evidence in this resume point/checkpoint. Do not merge/deploy or touch production without the required independent gates and explicit founder approval.
