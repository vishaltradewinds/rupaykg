# RupayKg Controlled Rehearsal Evidence Framework — 2026-11-05

## Status

**Engineering implementation / validation only. Production remains READ-ONLY / HOLD.**

This artifact converts the controlled production-rehearsal plan into an evidence contract. It does not authorize production migration, deployment, role/grant changes, RLS activation, or TRL 9 certification.

## Evidence chain

The rehearsal must produce a traceable chain:

`reviewed source commit -> migration inventory -> frozen manifest -> disposable target identity -> protected migrator -> migration ledger -> security convergence -> concurrency -> rollback/restore -> container startup -> independent review`

Every artifact must identify the exact source commit and target environment. Generated evidence must never be presented as production evidence unless it actually comes from the authoritative production environment.

## Evidence records

| Gate | Required evidence | Pass condition |
|---|---|---|
| Source | Reviewed commit SHA | Exact release candidate is identified |
| Lineage | 096 disposition + active inventory | No unexplained source/ledger mismatch |
| Manifest | SHA-256 manifest | Exact source inventory and hashes validate |
| Identity | Disposable DB/user/branch | Target identity matches expected values |
| Credential isolation | Protected migrator negative test | `DATABASE_URL` reuse is rejected |
| TLS | Production-mode contract test | Strict TLS/CA requirements enforced |
| Migration | Start/end + stdout/stderr + ledger diff | Only protected migrator applies migrations |
| Orphan safety | Injected orphan-ledger test | Execution fails closed before pending migration |
| Locking | Concurrent migration test | Single-session advisory lock serializes execution |
| Owner security | Helper-owner inspection | NOLOGIN + NOBYPASSRLS + non-superuser |
| Verification | Trigger/context tests | Canonical trigger and authenticated context remain enforced |
| Geography | Concurrency rehearsal | Revocation serializes against approval |
| Rollback | Disposable restore/rollback evidence | Recovery path is demonstrated and traceable |
| Startup | Container assertion | Web startup performs no migration/fixture mutation |
| Review | Independent DBA/security sign-off | Reviewer explicitly accepts evidence and scope |

## Evidence integrity rules

1. Do not substitute CI success for field or production evidence.
2. Do not substitute a disposable database for production identity proof.
3. Do not claim runtime DB role/branch identity until it is directly evidenced from the deployed runtime path.
4. Do not rewrite `schema_migrations` to make source and ledger counts equal.
5. Do not restore migration 096 to active source solely to remove the orphan condition.
6. Do not promote staging-only migrations 20261022–20261025 without recovered source and explicit applicability review.
7. Do not expose production credentials in CI artifacts or logs.
8. Do not execute production migrations from the ordinary web-service startup path.

## Current evidence boundary

The existing CI-green rehearsal is evidence that the repository validation mechanisms execute successfully against disposable CI infrastructure. It is **not** evidence that the authoritative production environment has passed these gates.

The following remain production-specific gates:

- independent disposition of migration 096;
- direct proof of Render runtime database/role/branch identity;
- production backup/restore evidence;
- immutable reviewed production migration manifest;
- independent DBA/security approval;
- controlled release and rollback ownership.

## Release decision

Until all production-specific evidence is independently reviewed and complete:

**Production = READ-ONLY / HOLD.**

**TRL 9 = NOT CERTIFIED.**
