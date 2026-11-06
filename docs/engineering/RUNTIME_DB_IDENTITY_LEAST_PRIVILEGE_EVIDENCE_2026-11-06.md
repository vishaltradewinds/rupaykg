# RupayKg — Runtime DB Identity & Least-Privilege Evidence
Date: 2026-11-06
Status: READ-ONLY EVIDENCE / REMEDIATION DESIGN REQUIRED

## Scope
Workstream H of the Shakti execution matrix: verify the live database identity, role capabilities, object ownership, and whether a least-privilege runtime identity is evidenced. Production was inspected read-only. No role, grant, ownership, DDL, DML, RLS, or deployment mutation was performed.

## Live Neon evidence
Project: `steep-mud-79906940`
Production/default branch: `br-restless-base-b44cip2h` / `main`
Database: `rupaykg`

A disposable child branch was already available for this rehearsal:
`br-dry-base-b42zrepz` / `rupaykg-role-split-rehearsal-20261106`
Parent timestamp: 2026-11-06T14:42:39Z

Read-only SQL on the disposable branch returned:

- Current database role: `rupaykg`.
- Non-system roles visible: `cloud_admin`, `neon_service`, `neon_superuser`, `rupaykg`, `token_roles`.
- `rupaykg` has: `rolcreaterole=true`, `rolcreatedb=true`, `rolreplication=true`, `rolbypassrls=true`.
- `token_roles` is the only inspected non-system role without those elevated capabilities; it has `rolcreaterole=false`, `rolcreatedb=false`, `rolreplication=false`, `rolbypassrls=false`.
- The inspected public application tables are owned by `rupaykg`.

## Security interpretation
The evidence is sufficient to keep Workstream H **BLOCKED for production release**: the live application identity remains an elevated database owner and bypasses RLS. This is incompatible with the target least-privilege architecture.

The presence of `token_roles` does not prove that it is a suitable application runtime role; its grants, object privileges, and application connectivity contract still require explicit review. No assumption is made that it can replace `rupaykg`.

## Required remediation architecture
1. Preserve a separately controlled schema/object owner identity.
2. Establish a least-privilege runtime identity with no `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, or replication privilege.
3. Establish a separately controlled migrator identity for schema changes.
4. Grant runtime access only to the intended schemas/tables/sequences/functions.
5. Transfer object ownership away from the runtime identity where required by the final architecture.
6. Ensure ordinary request paths cannot select the migrator/owner identity through application headers or service-mode flags.
7. Validate runtime role + transaction-local identity context + RLS together on a disposable branch before any production proposal.

## Gate status
**H — READ-ONLY EVIDENCE COMPLETE / REMEDIATION NOT YET APPLIED.**

Production remains READ-ONLY/HOLD. The next safe engineering action is to turn the remediation architecture into a reviewed, disposable-branch-only role/grant rehearsal and acceptance suite. Production role/grant/ownership changes remain prohibited by the execution matrix until the independent security/release gates are satisfied.
