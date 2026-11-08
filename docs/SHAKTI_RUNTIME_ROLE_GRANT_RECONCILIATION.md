# Shakti Runtime Role & Grant Reconciliation

Date: 2026-11-08

## Authoritative production finding

Live Neon production branch is `br-restless-base-b44cip2h`, database `rupaykg`.

The database owner/application role `rupaykg` remains privileged:

- LOGIN: yes
- SUPERUSER: no
- CREATEROLE: yes
- CREATEDB: yes
- REPLICATION: yes
- BYPASSRLS: **yes**

The dedicated non-login `rupaykg_app_runtime` role is provisioned on production:

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

## Application-path grant inventory

The audited API routes now provide a concrete runtime privilege baseline.

### Read surface

The runtime contract grants SELECT only to tables actually referenced by the audited application paths, including:

- authentication/context: `identity_sessions`, `identities`, `organization_memberships`, `roles`, organization/geography scope tables;
- operational/MRV: `activities`, `measurements`, `evidence`, `verifications`, `mrv_observations`, `mrv_provenance_events`, `resource_flows`;
- carbon/registry: `carbon_calculations`, `methodology_versions`, `credentials`, `registry_events`, `obligations`, `settlements`, `settlement_events`;
- EPR/ESG/BWG: `epr_obligations`, `epr_returns`, `epr_schemes`, `epr_credits`, `esg_reporting_periods`, `esg_metrics`, BWG workspace/report tables;
- CPCB/SWM: stakeholder workspace and status-history tables;
- field/sync: device, cursor, envelope and conflict tables;
- authority/platform: organization verification, stakeholder application, platform access/audit tables;
- regulatory/global catalog: regulatory source/requirement and methodology governance tables.

The runtime contract deliberately does **not** grant access to `schema_migrations` or unrelated database objects.

### Write surface

Write privileges are derived from observed application mutations rather than blanket DML. The contract contains only the operations observed in the audited route set, including INSERT/UPDATE for operational evidence/MRV, EPR returns, CPCB workspace state, field sync, organization membership/application workflows, registry events, settlements, and approved platform audit paths.

The exact grant contract is now codified in:

`migrations/20261107_runtime_grant_reconciliation.sql`

It does not enable RLS and does not create or expose a production credential.

## Candidate-role hardening

The LOGIN candidate was initially created with a broader Neon scoped read/write envelope for assurance. That direct broad grant was removed.

The candidate now inherits the curated `rupaykg_app_runtime` privilege contract instead.

Live privilege proof after reconciliation:

- `activities` SELECT: true
- `activities` INSERT: true
- `organizations` SELECT: true
- `schema_migrations` SELECT: false
- `rolbypassrls`: false

This is a materially stronger runtime boundary than the initial assurance role.

## Required production cutover

The production deployment must:

- use the non-BYPASSRLS LOGIN runtime identity;
- switch the application's DATABASE_URL to that identity;
- prove the live web/API process connection identity independently;
- run representative cross-tenant negative business-route tests;
- activate the approved core RLS policies;
- verify rollback before considering FORCE RLS.

The owner role must remain reserved for migrations/privileged maintenance and must not be used by the web/API runtime.

## CI gate

PR #331 currently has no workflow run for its latest head. The repository workflow is configured for `pull_request` events targeting `main`, so the absence of a run is an execution/status problem, not evidence of a pass.

No CI result is being inferred or fabricated.

## 2026-11-08 DML grant closure

A second application-path reconciliation confirmed that authentication, onboarding, legal-verification and platform-audit mutations require explicit runtime DML privileges. The controlled grant contract now explicitly covers:

- `identities` INSERT;
- `identity_password_credentials` INSERT/UPDATE;
- `identity_sessions` INSERT/UPDATE;
- `organizations` INSERT/UPDATE;
- `roles` INSERT/UPDATE;
- `organization_geography_scopes` INSERT/UPDATE;
- `organization_verification_evidence` INSERT/UPDATE;
- `stakeholder_applications` INSERT/UPDATE;
- `stakeholder_application_approvals` UPDATE;
- `audit_events` INSERT.

No DELETE privilege was added. The accompanying static contract `scripts/test-shakti-runtime-dml-grants-contract.mjs` is wired into CI and fails if these required grants disappear or a runtime DELETE grant is introduced.

## CI trigger reconciliation

The controlled branch now contains additional CI-enforced runtime privilege reconciliation. The repository workflow remains configured for `pull_request` events targeting `main`; absence of a workflow run for the exact controlled head remains an execution/status problem, not evidence of a pass.

The resulting workflow run, if created, must still be evaluated by its actual GitHub Actions conclusion; the commit itself is not evidence of CI success.

## Safety rule

Do not switch DATABASE_URL, enable RLS, or enable FORCE RLS from an unattended application migration. These are controlled deployment operations requiring a verified runtime connection and rollback path.

## Current gate

**FAIL-CLOSED / PRODUCTION HOLD**

Completed in this batch:

- application-path privilege inventory baseline;
- curated runtime grant contract;
- production LOGIN-role hardening;
- live non-BYPASSRLS privilege proof;
- CI trigger reconciliation commit.

Remaining gate:

**fresh CI result → application connection cutover → representative route-level negative tests → persistent RLS activation → live isolation verification → FORCE RLS decision.**


## Runtime-process assurance test
A dedicated integration gate is now present at `apps/src/runtime-identity.integration.test.ts`.

When explicitly enabled with:
- `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`
- `RUPAYKG_REQUIRE_NON_BYPASSRLS=1`
- `DATABASE_URL` pointing to the candidate application runtime connection
- `RUPAYKG_TEST_OWNER_DATABASE_URL` pointing only to a fixture/cleanup owner connection

the test proves from the runtime connection itself that:
- `current_user` is not SUPERUSER, CREATEROLE or CREATEDB;
- `rolbypassrls=false`;
- a tenant-A context can see tenant-A activity but not tenant-B activity;
- a cross-tenant activity insert is rejected by RLS.

The owner connection is used only for deterministic fixture creation/cleanup; protected assertions run through the candidate runtime connection. The test is opt-in and does not alter the default CI credential posture.

