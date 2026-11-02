# RupayKg production database and release-boundary re-verification — 2026-11-02

## Scope
Read-only verification against the Neon project `rupaykg-production-fresh` and its default `main` branch. No SQL mutation, DDL/DML, migration, role/grant/RLS change, branch change, deployment or secret access was performed.

## Authoritative database
- Neon project: `rupaykg-production-fresh` (`steep-mud-79906940`).
- Sole authoritative production branch: `main` (`br-restless-base-b44cip2h`).
- Database: `rupaykg`.
- Database owner: `rupaykg`.
- Production branch is the default and primary branch.

## Exact read-only results
- Public base tables: **67**.
- RLS enabled: **0 / 67**.
- FORCE RLS enabled: **0 / 67**.
- Applied migration ledger rows: **92**.
- Latest applied migration: `20261021`.
- Schemas `auth_private` and `app_security`: absent on production.
- These facts reconfirm that the signed request-context verifier and RLS migration work on PR branches is not installed in production and that production is not tenant-isolated at the database layer.

## Other Neon branches observed
The project currently contains multiple non-primary branches, including:
- `shakti-unresolved-migration-rehearsal-20261028` — child of the staging/rehearsal branch.
- `rupaykg-rls-assurance-lab-20261101`.
- `rupaykg-onboarding-auth-functions-lab-2026-11-01`.
- `rupaykg-tenant-isolation-lab-20261101`.
- `rupaykg-gov-inbox-staging-20261020`.
- `shakti-prod-main-worker-migration-rehearsal-20261031`.
- `shakti-prod-main-rehearsal-20261031`.

These are branches within the same Neon project, not separate authoritative production databases. They must remain classified as rehearsal/staging until their lineage, purpose, retention and outstanding evidence are reconciled. No branch was deleted or reset; those operations are destructive and require explicit approval.

## Release decision
**HOLD — production certification OFF — system TRL 9 not established.**

Do not:
- enable RLS on production while the current broad owner/runtime role and route coverage remain unresolved;
- apply the PR #192 migrations or create production roles/secrets;
- merge/deploy the authentication integration while Render auto-deploys `main` and the production auth pool, owner, grants and secret ceremony are not ready;
- enable workers or schedulers.

## Next engineering actions
1. Complete the 67-table policy matrix, including tenant ownership, parent/child scope, cross-tenant/bilateral semantics, service principals, read/write actors, FK edges, and audit immutability.
2. Complete route/worker coverage for the signed transaction context. Current static API inventory: 218 direct query/connect call lines across 14 modules; 0/14 route/server/auth modules use the helper.
3. Finish negative authorization acceptance: wrong geography, non-platform forged roles, session revocation/suspension, replay, concurrent decisions, and immutable audit.
4. Validate all migration and grant changes on disposable Neon using exact restricted roles, then rehearse from the current production catalog/ledger.
5. Obtain founder-approved two-identity/two-custodian ceremony, independent security review, DBA approval, backup/restore and rollback evidence before any production change.

## Evidence integrity
This checkpoint records catalog metadata and read-only SQL results observed on 2026-11-02. It is not a security certification, migration approval or production readiness sign-off.
## Additional role-catalog check (read-only)
- Non-system PostgreSQL roles visible: `cloud_admin` and `rupaykg`.
- `cloud_admin`: SUPERUSER, CREATEROLE, CREATEDB, LOGIN, BYPASSRLS.
- `rupaykg`: NOSUPERUSER but CREATEROLE, CREATEDB, LOGIN, BYPASSRLS.
- No separate least-privilege application, authentication, migrator or restricted function-owner roles are currently visible in the production catalog.
- This confirms the production role boundary is not ready for RLS. Do not enable RLS until the production role architecture, ownership, grants and controlled provisioning are independently reviewed and rehearsed.
## GitHub main and Render release-path re-verification
- GitHub `main` head: `a3fecc0abd2c46549a201058d3963afc0e3a73c9`.
- Render service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`) is configured for auto-deploy on commits to `main`.
- Latest Render deployment `dep-dbjo4dqvcj2c73f7bt00` is LIVE on the same `a3fecc0` revert commit. The preceding auth-pool deployment for `14b7356` failed and was superseded by the successful revert deployment.
- Operational consequence: merging PR #192 to `main` would initiate the Render deployment path. Do not merge until the separate auth pool, least-privilege production roles, grants, secrets, database functions/migrations, rollback and release checks are provisioned and validated. PR #192 remains draft.
