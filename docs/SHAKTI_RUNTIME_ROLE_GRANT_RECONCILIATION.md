# Shakti Runtime Role & Grant Reconciliation

Date: 2026-11-07

## Authoritative production finding

Live Neon production branch is `br-restless-base-b44cip2h`, database `rupaykg`.

The only verified database role currently present among the Shakti runtime roles is the owner/application role `rupaykg`:

- LOGIN: yes
- SUPERUSER: no
- CREATEROLE: yes
- CREATEDB: yes
- REPLICATION: yes
- BYPASSRLS: **yes**

The dedicated `rupaykg_app_runtime` role is **not yet provisioned on production**.

Therefore production cannot safely enable RLS yet.

## Rehearsal evidence

The existing RLS assurance lab has `rupaykg_app_runtime` with:

- BYPASSRLS: false
- RLS enabled on core tenant tables
- tenant policies based on `app.current_organization_id()`

This proves the role/policy pattern is technically viable in a rehearsal environment, but is not production evidence.

## Required production cutover

The production deployment must establish a dedicated login/runtime role with:

- NOSUPERUSER
- NOBYPASSRLS
- NOCREATEDB
- NOCREATEROLE
- NOREPLICATION
- controlled LOGIN credential managed outside migration source

The application DATABASE_URL must then be switched to this role.

The owner role must remain reserved for migrations/privileged maintenance and must not be used by the web/API runtime.

## Grant reconciliation

The current owner role has broad privileges across the database. This is not an acceptable runtime privilege boundary.

The runtime role must receive only the application privileges actually required by the audited routes, plus execute privileges for approved security-definer context functions. The core RLS activation migration currently grants DML on:

- activities
- measurements
- evidence
- carbon_calculations
- epr_obligations

This is intentionally incomplete until the full application-path grant inventory is reconciled.

## Safety rule

Do not change the production role, revoke owner privileges, switch DATABASE_URL, enable RLS, or enable FORCE RLS from an unattended application migration.

Those are controlled deployment operations requiring a verified runtime connection and rollback path.

## Current gate

**FAIL-CLOSED / PRODUCTION HOLD**

The next technical gate is to derive the complete runtime grant set from the already audited application paths, rehearse the role switch on a disposable Neon branch, prove the runtime identity from the application connection, then perform controlled production cutover.
