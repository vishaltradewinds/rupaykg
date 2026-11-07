# RupayKg Runtime Privilege Model — 2026-11-06

Status: DISPOSABLE REHEARSAL VALIDATED — production remediation NOT approved.

## Objective

Separate database ownership from application execution and derive runtime privileges from the 67-table policy register.

PostgreSQL ownership is a control boundary: the owner retains implicit object control and grant options, so the application login must not own application tables. Privileges are granted explicitly and without grant option.

## Disposable rehearsal result

Branch: `br-dry-base-b42zrepz` (`rupaykg-role-split-rehearsal-20261106`).

Validated:

- NOLOGIN owner role: `rupaykg_owner_model_20261106`
- LOGIN runtime role: `rupaykg_runtime_model_20261106`
- runtime role: NOSUPERUSER, NOCREATEROLE, NOCREATEDB, NOREPLICATION, NOBYPASSRLS
- 67/67 public application tables transferred to the separate NOLOGIN owner role
- 0/67 application tables owned by runtime role
- PUBLIC table privileges: 0
- runtime has no privilege on `schema_migrations`
- runtime has no privilege on credential tables
- runtime has explicit access to the tested tenant/bilateral/inherited classes
- no production database was modified

## Baseline privilege posture

| Policy class | Default application runtime posture |
|---|---|
| TENANT (23) | SELECT/INSERT/UPDATE/DELETE, subject to RLS |
| BILATERAL (8) | SELECT/INSERT/UPDATE/DELETE, subject to bilateral policies |
| INHERITED (22) | SELECT/INSERT/UPDATE/DELETE, subject to inherited parent-chain policies |
| SHARED/ROOT catalog | SELECT only unless a reviewed service/bootstrap path requires more |
| identity/session/credential control plane | Separate bootstrap/auth path; not blanket runtime access |
| schema_migrations | Migrator only |
| ownership/DDL | Owner/migrator only |
| grant administration | Owner/migrator only |

This is a privilege-design baseline, not final release approval. Table-by-table application access-path review remains required before production grants are generated.

## Required role separation

1. **Owner role** — NOLOGIN; owns application objects; no application connection.
2. **Runtime role** — LOGIN; application DML only; no ownership, DDL, role administration, migration-ledger writes, or RLS bypass.
3. **Bootstrap/control-plane role** — restricted access for authentication/session/identity operations.
4. **Migrator role** — migration execution only; never used by application request paths.

## Acceptance gates

Production remediation remains blocked until:

- all 67 table access paths are reconciled against application routes/workers;
- bilateral and inherited visibility is explicitly verified;
- service-mode exceptions are explicitly enumerated;
- sensitive identity/credential fields are reviewed;
- sequence/function privileges are enumerated;
- PUBLIC privileges are zero where unintended;
- ownership is separated;
- adversarial runtime/RLS tests pass;
- backup/restore rehearsal passes;
- independent release review approves production changes.

## Safety boundary

No production RLS, DDL/DML, role, grant, ownership, deployment, merge, certification, or TRL-9 declaration was performed by this batch.
