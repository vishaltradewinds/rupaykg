# RupayKg — G-002 Rehearsal Gate — 2026-11-09

## Completed
- Canonical repository confirmed: vishaltradewinds/rupaykg.
- Live Neon production schema reconciled read-only.
- Migration compatibility preflight: PASS — 19/19 required tables and 27/27 required columns present.
- Production activation was NOT performed.

## Controlled rehearsal requirement
Migrations 097/098/099 are structurally compatible with the live schema, but the production database remains pre-activation: RLS is disabled, protected tenant policies are absent, and the owner role `rupaykg` has BYPASSRLS.

The next safe step is a controlled Neon rehearsal branch/database. Execute migrations 097/098/099 there, then run:
1. VERIFY_SECURITY_DEFINER_BOUNDARIES.sql
2. VERIFY_PRE_RLS.sql using the intended runtime login
3. controlled DDL/owner separation verification
4. ACTIVATE_RLS.sql
5. VERIFY_RLS_NEGATIVE_TEST.sql
6. application runtime acceptance suite
7. rollback rehearsal/evidence

## Fail-closed rule
Do not apply 097/098/099 or ACTIVATE_RLS.sql directly to production until rehearsal gates pass. Do not claim TRL 9 from repository completion alone.

## Current production evidence
- `rupaykg`: non-superuser, BYPASSRLS=true.
- `rupaykg_app_runtime`: exists, non-BYPASSRLS.
- protected public policy count: 0.
- tenant function count: 1 of the expected three.
