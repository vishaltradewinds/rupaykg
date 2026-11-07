# Disposable Runtime Role Rehearsal — 2026-11-06

## Scope
Workstream H disposable-only role split rehearsal. Production/default Neon branch was not mutated.

## Rehearsal branch
- Project: `steep-mud-79906940`
- Branch: `br-dry-base-b42zrepz`
- Database: `rupaykg`

## Probe role
Created disposable role: `rk_runtime_probe_20261106` using Neon scoped `read_write` access to database `rupaykg`, schema `public`.

Read-only verification while connected as the probe role:
- `current_user = rk_runtime_probe_20261106`
- `rolsuper = false`
- `rolcreaterole = false`
- `rolcreatedb = false`
- `rolreplication = false`
- `rolbypassrls = false`
- schema USAGE on `public`: true
- table DML privilege on representative `activities`: true
- table DML privilege on representative `organizations`: true

## Security conclusion
The disposable role demonstrates the desired basic capability boundary: a runtime identity can have application DML access without PostgreSQL superuser, role-creation, database-creation, replication, or RLS-bypass capabilities.

This is **not yet the final production runtime-role design**. The Neon scoped role currently grants read/write access across the public schema, while the target architecture requires table/function/sequence privileges derived from the 67-table policy classification and service-mode requirements. PUBLIC privileges and ownership dependencies also require explicit review.

## Cleanup
The probe role is disposable rehearsal state and must not be treated as a production credential or application identity.
