# Hierarchical onboarding authority hardening — 2026-11-02

## Scope
This change closes two defects exposed while expanding disposable-PostgreSQL acceptance for hierarchical onboarding. It is PR-branch work only. No production database or deployment was changed.

## Finding 1 — role-name spoofing across organization types
The review queue and approval mutation previously relied on membership role names and geography scope without binding the reviewer organization type to the authority tier. A verified ordinary processing organization could potentially receive a `regulator` / `state_admin` role label and be treated as a State/District reviewer.

### Fix
Both `auth_private.get_onboarding_review_queue` and `auth_private.review_stakeholder_application` now enforce organization-type matching:
- `PLATFORM`: `PLATFORM_AUTHORITY` plus existing `admin:users` capability.
- `STATE` and `DISTRICT`: verified `regulator` organization.
- `LOCAL`: `ulb` organization for `ULB`, `WARD`, `LOCALITY`; `regulator` for `GRAM_PANCHAYAT`, `VILLAGE`, `CLUSTER`.
- Existing role-name allowlist and verified hierarchical geography-scope checks remain required.
- A role name alone cannot create authority.

## Finding 2 — restricted search_path broke geography scope resolution
The new review queue acceptance test called `public.organization_has_geography_scope` from an identity-bound function with a restricted `search_path`. The older helper used unqualified references to `geography` and `organization_geography_scopes`, causing PostgreSQL `relation "geography" does not exist`.

### Fix
New migration `20261105_geography_scope_search_path_hardening.sql` replaces the helper and its activity/resource-flow trigger functions with:
- Explicit `public.` qualification for all public relations and helper calls.
- `SET search_path = pg_catalog, pg_temp`.
- Same scope semantics and exception messages; no change to tenant policy or production data.

## Disposable PostgreSQL acceptance added
The CI bootstrap test now:
1. Creates a synthetic regulator organization and membership through the approved onboarding lifecycle.
2. Assigns a verified root geography scope in the disposable fixture.
3. Gives a verified processing-facility member a forged `regulator` role label and confirms the ordinary organization receives no review-queue access.
4. Creates separate in-scope and out-of-scope applicant organizations.
5. Confirms the regulator reviewer sees only the in-scope application.
6. Confirms an out-of-scope decision mutation is denied.
7. Approves the in-scope District step, confirms the reviewer can see the next State step, approves it, then confirms visibility is removed when the next step becomes Platform.
8. Restores the original processing-facility membership role after the synthetic negative test.

The synthetic fixture does not provision production authorities or grant production roles.

## Exact verification
- Code head: `6362242235ed7c1841d260f8d8f9321730fd79fd`.
- Exact-head GitHub Actions run: `41432595295`.
- At checkpoint creation, the run had passed migration validation, restricted verifier-owner provisioning and privilege teardown, migrations, typecheck, build, UX validator, two-custodian bootstrap exercise, browser smoke and full disposable PostgreSQL acceptance. Production container build was still running.
- Do not claim the entire run passed until container build and job completion are confirmed.

## Release boundary
- PR #192 remains draft.
- Production Neon remains 67 public tables, 0 RLS, 0 FORCE RLS, broad owner `rupaykg` with BYPASSRLS; dedicated least-privilege production roles and auth schemas are absent.
- Render auto-deploys `main`; PR #192 must not be merged before production role/auth pool/secret/migration/rollback gates are independently completed.
- No production DDL/DML, migrations, grants, role changes, deployment, worker activation or certification.
## Exact-head CI completion — 2026-11-02
- Exact-head run `41432595295` for code head `6362242235ed7c1841d260f8d8f9321730fd79fd` completed **SUCCESS**.
- The disposable PostgreSQL acceptance, all tests, browser smoke, migration validation, typecheck, build and production container build all passed.
- This is engineering CI evidence only. It does not authorize production migration, role provisioning, RLS enablement, merge or deployment.
