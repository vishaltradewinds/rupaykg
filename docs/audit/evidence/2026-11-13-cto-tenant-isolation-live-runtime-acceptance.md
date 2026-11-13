# CTO Tenant Isolation Live Runtime Acceptance — 2026-11-13

Repository: `vishaltradewinds/rupaykg`
Release-convergence branch: `cto/20261113-holistic-release-convergence`
Production Neon project: `steep-mud-79906940`
Production branch: `main` (`br-restless-base-b44cip2h`)
Database: `rupaykg`

## Scope and safety

This acceptance batch used read-only SELECT statements and transaction-local request context only. It did not apply migrations, change roles/passwords, write business rows, or alter production schema/data.

## Runtime role

Connected directly as `rupaykg_runtime_login` and verified:

- `rolsuper = false`
- `rolbypassrls = false`
- `rolcanlogin = true`
- The login role is a member of `rupaykg_app_runtime`.
- `rupaykg_app_runtime` remains NOLOGIN and non-BYPASSRLS.
- The runtime login can execute the existing `app.set_request_context(uuid,uuid)` and `app.authenticate_bearer_session(text)` functions.

The administrative connection role `rupaykg` remains BYPASSRLS. It was not used for the tenant visibility tests.

## Transactional cross-tenant read acceptance

Used two existing verified identities with verified organization memberships. Within one transaction, switched request context between the two authorized tenant pairs and queried the organizations table as `rupaykg_runtime_login`.

| Test | Result |
|---|---:|
| Tenant A context sees its own organization | 1 row |
| Tenant A context sees Tenant B organization | 0 rows |
| Tenant B context sees its own organization | 1 row |
| Tenant B context sees Tenant A organization | 0 rows |
| Runtime login bypasses RLS | false |

A request using a deliberately invalid bearer-token hash returned zero authentication rows.

This is live production evidence that the existing RLS policies enforce organization-row isolation for the tested non-BYPASSRLS login role and two verified tenant contexts.

## Important limits

This is **read-isolation acceptance for the tested organizations path**, not full platform tenant-isolation acceptance.

Not yet proven:

- Cross-tenant INSERT/UPDATE/DELETE denial against every protected table.
- No-context fail-closed behavior across the protected domain.
- RLS coverage for all 67 public tables (only 17 currently have RLS enabled).
- FORCE ROW LEVEL SECURITY across the protected tables (the 17 currently enabled tables report `relforcerowsecurity = false`).
- Migration 101/102 application; both remain repository artifacts only.
- Application deployment's actual connection-string/configuration path.
- Urban/Rural golden transaction acceptance.

## Updated CTO decision

The prior statement that the production runtime role was only NOLOGIN is superseded: a separate non-BYPASSRLS login role, `rupaykg_runtime_login`, exists and successfully connected. The underlying `rupaykg_app_runtime` role remains NOLOGIN, as designed.

Tenant read-isolation is now **PARTIAL PASS** for the exact two-tenant organization SELECT test. Full tenant isolation and production release remain **HOLD** pending write-denial tests, broader table coverage, migration reconciliation/application, and end-to-end application verification.
