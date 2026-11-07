# Shakti Runtime Role & Grant Reconciliation

Date: 2026-11-07

## Authoritative production finding

Live Neon production branch is `br-restless-base-b44cip2h`, database `rupaykg`.

The database owner/application role `rupaykg` remains privileged:

- LOGIN: yes
- SUPERUSER: no
- CREATEROLE: yes
- CREATEDB: yes
- REPLICATION: yes
- BYPASSRLS: **yes**

The non-login `rupaykg_app_runtime` role is also provisioned on production:

- LOGIN: no
- SUPERUSER: no
- CREATEROLE: no
- CREATEDB: no
- REPLICATION: no
- BYPASSRLS: **no**

A managed LOGIN candidate role, `rupaykg_runtime_login`, was provisioned for controlled runtime-identity assurance:

- LOGIN: yes
- SUPERUSER: no
- CREATEROLE: no
- CREATEDB: no
- REPLICATION: no
- BYPASSRLS: **no**

## Live LOGIN-role assurance

The managed LOGIN candidate was exercised directly against the authoritative production branch, without using `SET ROLE`.

Verified:

1. `current_user` was `rupaykg_runtime_login`.
2. `rolbypassrls=false`.
3. Tenant A context was established through `app.set_request_context()`.
4. A tenant-A activity was visible.
5. A tenant-B activity was invisible.
6. A cross-tenant insert was rejected by PostgreSQL RLS with SQLSTATE 42501.
7. RLS and all temporary fixture data were removed after the test.

This is live database/runtime-role evidence, but it is **not yet application cutover evidence** because the deployed web/API process has not been switched to this credential.

## Grant reconciliation

The managed LOGIN candidate was created with scoped read/write access to the public schema for this assurance exercise. That privilege envelope is broader than the final Shakti runtime boundary and must not be treated as the production least-privilege configuration.

The final runtime role must receive only the application privileges actually required by the audited routes, plus execute privileges for approved security-definer context functions. The core RLS activation migration currently grants DML on:

- activities
- measurements
- evidence
- carbon_calculations
- epr_obligations

This remains intentionally incomplete until the full application-path grant inventory is reconciled.

## Required production cutover

The production deployment must:

- use a non-BYPASSRLS LOGIN runtime identity;
- switch the application's DATABASE_URL to that identity;
- prove the live web/API process connection identity independently;
- run representative cross-tenant negative business-route tests;
- activate the approved core RLS policies;
- verify rollback before considering FORCE RLS.

The owner role must remain reserved for migrations/privileged maintenance and must not be used by the web/API runtime.

## Safety rule

Do not switch DATABASE_URL, enable RLS, or enable FORCE RLS from an unattended application migration. These are controlled deployment operations requiring a verified runtime connection and rollback path.

## Current gate

**FAIL-CLOSED / PRODUCTION HOLD**

The live LOGIN-role proof is now complete. The remaining gate is application connection cutover plus route-level isolation evidence, followed by controlled persistent RLS activation.
