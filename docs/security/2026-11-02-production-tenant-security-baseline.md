# RupayKg production tenant-security baseline reconciliation — 2026-11-02

## Scope and method

Read-only inspection of the authoritative Neon project `rupaykg-production-fresh` (project ID `steep-mud-79906940`), default `main` branch (`br-restless-base-b44cip2h`), database `rupaykg`. No production SQL writes, migrations, role changes, grants, secrets, or deployments were performed.

Two existing non-production Neon branches were also inspected read-only:
- `rupaykg-rls-assurance-lab-20261101` (`br-red-salad-b4oqb4nx`)
- `rupaykg-tenant-isolation-lab-20261101` (`br-blue-tooth-b4kvuut7`)

The audit intentionally did not retrieve or print secret values.

## Production main — verified database state

A catalog-only query returned:

| Check | Observed state |
|---|---:|
| Public base tables | 67 |
| Public tables with RLS enabled | 0 |
| Public tables with FORCE RLS | 0 |
| `app_security` schema | Absent |
| `app_security.request_context_keys` | Absent |
| `app_security.current_request_context_claims()` | Absent |
| Expected runtime/security roles found among `rupaykg`, `rupaykg_app_runtime`, `rupaykg_auth_runtime`, `rupaykg_security_definer` | Only `rupaykg` |
| `rupaykg` login | Enabled |
| `rupaykg` BYPASSRLS | Enabled |

The migration ledger's most recently applied row by `applied_at` was `096_verification_authorization_provenance.sql`, applied 2026-10-27. The signed request-context verifier is not deployed to production.

**Conclusion:** production has no database-enforced tenant RLS or signed request-context verifier. The existing `rupaykg` owner/login with BYPASSRLS cannot be accepted as the least-privilege application runtime identity. Production must remain HOLD.

## Existing RLS assurance lab — verifier ownership mismatch

On `rupaykg-rls-assurance-lab-20261101`, catalog inspection found:

- `app_security`, `request_context_keys`, and `current_request_context_claims()` exist.
- The key table contains 0 rows.
- Public RLS-enabled tables: 0; FORCE RLS tables: 0; public policies: 0.
- The verifier function owner and key-table owner both resolve to `rupaykg`, not `rupaykg_security_definer`.
- No `rupaykg_security_definer` role was present among the expected roles.
- No matching signed-context migration row was present in `schema_migrations`.

This branch is not a passing signed-context/RLS rehearsal. Its current catalog state does not satisfy the owner-role contract documented in `migrations/20261101_signed_request_context_verifier.sql`. The discrepancy must be explained and the lab recreated or repaired through a reviewed, reproducible migration sequence before it can be used as evidence.

## Existing tenant-isolation lab — partial RLS only

On `rupaykg-tenant-isolation-lab-20261101`, catalog inspection found RLS and FORCE RLS enabled on:
- `public.identities`
- `public.identity_password_credentials`
- `public.identity_sessions`
- `public.organization_memberships`
- `tenant_isolation_lab.records` (isolated lab table)

The four public authentication tables had 18 policies in total (4, 6, 6 and 2 respectively). The four public tables were owned by `rupaykg`; the isolated lab table was owned by `rupaykg_rls_lab_owner_20261101`. The expected `rupaykg_app_runtime` and `rupaykg_auth_runtime` roles were present with BYPASSRLS false, while `rupaykg` retained BYPASSRLS true.

A connection attempt explicitly pinned to the app/auth runtime role could not be completed because Neon reported missing authentication credentials. Therefore effective role-level query behavior, actual policy isolation, and connection-level acceptance remain unproven. The presence of policies alone is not a passing test.

## Required next steps — fail-closed

1. Treat production as read-only and do not apply migrations or role changes.
2. Reconcile the two lab branches and choose one disposable, reproducible acceptance baseline. Do not use either current lab as a production-readiness pass.
3. Provision `rupaykg_security_definer` as a dedicated NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOINHERIT role through a reviewed DBA procedure. It must not be a member of another role, and the application runtime must not be a member of it.
4. Apply the signed-context verifier migration only on the disposable branch. Verify that both the key table and SECURITY DEFINER function are owned by `rupaykg_security_definer`; verify the protected key table has no PUBLIC read grants and the function has no PUBLIC execute grant.
5. Add a separate reviewed migration for narrowly scoped schema USAGE/function EXECUTE grants and actual table-specific RLS policies. The verifier migration intentionally does not grant app runtime access or create tenant policies.
6. Create/activate a key ID and HMAC secret using a DBA-controlled secret manager/secure input path. Never commit the secret, place it in SQL history, expose it to Vite/client variables, or log it. Verify key ID and HMAC match between application config and protected database store without returning the secret.
7. Use restricted runtime credentials to test valid, missing, malformed, forged, expired, revoked, wrong-key and rotated contexts; two-tenant and two-geography isolation; transaction rollback; and pooled-connection reuse.
8. Only after independent DBA/security approval, extend the explicit `withRlsRequestTransaction` pattern to one low-risk route. No blanket RLS activation.

## Relationship to PR #208

PR #208 wires validated request-context environment values into the server process. It does not provision the database key, create roles/grants/policies, deploy the verifier, or migrate routes. Its exact-head CI is still pending because the current workflow only triggers pull requests targeting `main`, whereas PR #208 currently targets the open authentication/bootstrap foundation branch.

## Disposition

- Production database: unchanged; read-only inspection only.
- Production RLS: not enabled.
- Production certification: OFF / HOLD.
- Route migration: not authorized.
- TRL 9: not established.
- This document is an evidence checkpoint, not approval to modify production.
