# SECURITY DEFINER owner boundary — 13 November 2026

## Objective

Prevent application runtime sessions from inheriting the authority of a privileged database role through SECURITY DEFINER functions.

## Candidate design

The five authentication and tenant-context functions are assigned to
`rupaykg_security_definer`, a dedicated role provisioned with:

- NOLOGIN and NOINHERIT
- NOSUPERUSER and NOBYPASSRLS
- NOCREATEDB, NOCREATEROLE and NOREPLICATION
- no membership granted to `rupaykg_app_runtime` or `rupaykg_runtime_login`
- no CREATE privilege on `app` or `public` after ownership transfer

The role receives SELECT on identities, identity sessions, organization
memberships and organizations; SELECT/INSERT/DELETE on the opaque context
grant table; and narrow SELECT RLS policies on organizations and memberships.
It does not own those tables.

The application runtime receives EXECUTE on the five approved functions.
PUBLIC EXECUTE is revoked. The runtime role cannot SET ROLE to the isolated
owner. CI asserts owner attributes, ownership of all five functions, effective
runtime membership, and schema CREATE boundaries.

## Provisioning and deployment boundary

- CI provisions the role only in its disposable PostgreSQL service.
- `ops/tenant-isolation/PROVISION_SECURITY_DEFINER_OWNER.sql` is a DBA-only
  preflight/provisioning script for a separately approved database change.
- Migration 104 fails closed if the owner role is absent or unsafe.
- Production Neon has not been changed. No production role provisioning,
  migration, credential change, or deployment is authorized by this candidate
  branch alone.

## Validation status

Candidate commit `2a18c4e36422bc8fc915dce1921860f1e5dfb3d1` completed migration
validation, disposable migration execution, SECURITY DEFINER boundary
acceptance, typecheck, build and browser smoke acceptance. Its remaining
full-test, rollback-only negative-acceptance and container-build steps are
tracked in CI run 6863.

A subsequent hardening edit also requires NOINHERIT in migration 104. That exact
latest branch head must receive its own complete CI result before the PR can be
considered validated.

## Residual scope

This closes only the SECURITY DEFINER owner design gap for the five listed
functions in the candidate schema. It does not establish full tenant isolation
across all 67 production tables, prove the live Render database login identity,
or establish Urban/Rural field acceptance, statutory approval or TRL 9.
