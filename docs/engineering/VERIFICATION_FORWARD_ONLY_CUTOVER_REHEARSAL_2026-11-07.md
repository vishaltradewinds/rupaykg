# P0 #214/#215 Forward-Only Verification Cutover Rehearsal — 2026-11-07

This rehearsal models the required production transition without mutating production.

## Preconditions

The rehearsal requires the historical authorization-provenance columns introduced by migration 096 to already exist. It does **not** replay 096 and does not recreate its historical source.

## Forward-only operation

The disposable transaction applies the already-reviewed canonical verification convergence:

- one guard-owned SECURITY DEFINER authorization boundary;
- transaction-local authenticated context;
- exact activity-organization binding;
- explicit permission keys;
- verified/non-suspended identity;
- verified organization and membership;
- fail-closed geography;
- immutable authorization provenance;
- DELETE/TRUNCATE protection;
- removal of the two competing legacy verification triggers.

## Post-cutover assertions

The rehearsal requires:

- exactly three authoritative verification triggers;
- zero legacy `verification_independence_guard` / `verifications_integrity_guard` triggers;
- canonical guard owner `rupaykg_verification_guard`;
- no `rupaykg_auth_context_owner`;
- no replay of migration 096.

## Release boundary

This is disposable engineering evidence only. It does not authorize production mutation, establish live RLS/role/grant posture, establish field acceptance, regulatory approval, certification, or TRL 9.

Production remains READ-ONLY/HOLD pending independent DBA/security review and explicit release approval.
