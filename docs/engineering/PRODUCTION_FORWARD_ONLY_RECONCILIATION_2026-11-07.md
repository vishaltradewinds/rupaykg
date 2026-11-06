# P0 #214/#215 Production Forward-Only Reconciliation — 2026-11-07

## Scope

Read-only reconciliation of the authoritative Neon production database against the current Shakti verification-convergence engineering baseline.

No production DDL/DML, migration, trigger replacement, role/grant change, RLS change, deployment, worker activation, or certification was performed.

## Authoritative production target

- Neon project: `steep-mud-79906940`
- branch: `br-restless-base-b44cip2h` (`main`)
- database: `rupaykg`

## Migration lineage

The production `public.schema_migrations` table contains 92 rows.

The ledger contains:

- `001` through `087`
- `20261018`
- `20261019`
- `20261020`
- `20261021`
- `096_verification_authorization_provenance.sql`

Version 096 was applied at `2026-10-27T13:46:14.262Z`.

The ledger table has only `version`, `filename`, and `applied_at`; it does not contain a source checksum. Therefore exact source-to-ledger checksum reconciliation cannot be established from the production ledger alone and must use the recovered Git blob plus deployment/build evidence.

This confirms the existing P0 #214 finding: active repository source and production ledger are not currently a one-to-one source lineage.

## Verification trigger divergence

Production `public.verifications` currently has exactly two non-internal triggers:

1. `verification_independence_guard` → `enforce_verification_independence()`
2. `verifications_integrity_guard` → `prevent_invalid_verification()`

Both functions are owned by `rupaykg`.

The legacy `enforce_verification_independence()` function still:

- performs membership authorization without binding the membership to the subject activity organization;
- accepts role names `VERIFIER` / `AUDITOR` as authorization.

The production `prevent_invalid_verification()` function contains the stricter same-organization and explicit-permission checks, but only inside the `APPROVED` decision path.

Therefore the live database is **not yet converged** to the canonical Shakti verification guard rehearsed by PR #322.

## Runtime/RLS posture

Read-only catalog reconciliation confirms:

- 67 public ordinary tables;
- 0 tables with RLS enabled;
- 0 tables with FORCE RLS;
- runtime role `rupaykg` has LOGIN, CREATEROLE, CREATEDB and BYPASSRLS;
- runtime role is not SUPERUSER.

These facts remain production release blockers and are not changed by successful disposable CI.

## Engineering convergence status

The disposable PR #322 convergence and negative-assurance rehearsals establish the intended forward-only design:

- one canonical `rupaykg_verification_guard`;
- NOLOGIN/NOSUPERUSER/NOBYPASSRLS guard posture;
- no competing `rupaykg_auth_context_owner`;
- transaction-local signed authenticated context;
- exact activity-organization tenant binding;
- explicit permission keys only;
- fail-closed verified identity/organization/membership/geography;
- server-derived authorization snapshots;
- append-only verification records;
- DELETE/TRUNCATE protection;
- no legacy competing verification triggers.

CI #5874 passed these engineering rehearsals on exact head `84c142f7638cbd816e4872863e0a8de968bcdbda`.

## Release decision

**HOLD / READ-ONLY.**

CI PASS is engineering evidence only. It does not authorize production migration or establish live RLS, live role/grant separation, independent DBA/security approval, field acceptance, regulatory approval, certification, or TRL 9.

## Required forward-only gate

Before any production change:

1. independently reconcile all 92 ledger entries against authoritative source/checksum/deployment evidence;
2. preserve historical 096 without blind replay;
3. reconcile the live verification trigger/function definitions against the canonical PR #322 rehearsal;
4. independently review the final forward-only migration;
5. rehearse on a production-derived disposable branch;
6. independently verify runtime role/RLS/grant posture and rollback;
7. obtain explicit release approval.

No production mutation is authorized by this document.
