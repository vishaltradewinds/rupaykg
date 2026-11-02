# RupayKg engineering checkpoint — 2026-11-02 11:17 UTC

## Exact-head backend CI recovery

- Canonical repository: `vishaltradewinds/rupaykg`.
- Backend PR: #192, branch `shakti/auth-bootstrap-application-integration-2026-11-01`.
- Exact head: `3b34b10a7277d3aaecfb1883d2f36924dc530635`.
- Prior CI run `41434493286` exposed two failures in the older `apps/test/production-config.test.ts` fixture. It omitted newly mandatory `RUPAYKG_REQUEST_CONTEXT_SECRET` and `RUPAYKG_REQUEST_CONTEXT_KEY_ID`, so the expected downstream TLS error was masked by the earlier fail-closed secret validation.
- Corrected the fixture only, using synthetic test-only signing material and asserting the corresponding returned config properties. No production secret was generated, retrieved or provisioned. Production validator was not weakened.
- Exact-head GitHub Actions run `41435258781`: **SUCCESS**. Migration validation, restricted verifier-owner provisioning and privilege teardown, disposable PostgreSQL migrations, typecheck, build, two-custodian synthetic bootstrap, browser smoke, complete tests including PostgreSQL acceptance, and production container build all passed.
- PR #192 body updated with this exact-head evidence. PR remains draft.

## UI/UX parity workstream

- PR #203 exact head: `3287ea78ccf833947b4c4f5992bc404393344d98`.
- Exact-head CI run `41433672603`: **SUCCESS**.
- PR remains draft; browser evidence covers desktop and narrow mobile viewports plus CTA/drawer/keyboard-dismissal/navigation/anonymous-diagnostic checks.
- Real backend sign-in/registration submission, accessibility/focus/screen-reader/contrast/zoom and localization remain open.

## Non-negotiable production boundary

- Production Neon baseline previously verified read-only: 67 public tables, 0 RLS, 0 FORCE RLS; 92 migrations (latest `20261021`); no production `auth_private` or `app_security` schema; no dedicated least-privilege app/auth/migrator/function-owner roles.
- The 67-table ownership matrix is a structural draft, not an approved RLS policy set.
- Route SQL inventory: 218 direct query/connect call lines across 14 API modules; signed request transaction helper is not yet integrated into those modules. No first-class worker/queue/cron process was found in the scoped repo/runtime inventory.
- The helper explicitly rejects bilateral settlement context until multi-party policies exist. Do not force bilateral workflows through a single-tenant context.
- Do not enable production RLS, alter production roles/grants/secrets, run production migrations, delete Neon branches, merge PRs, or deploy without complete reviewed gates and explicit release authorization.
- Production remains HOLD; certification OFF; system TRL 9 is not established.

## Next execution sequence

1. Extend route inventory to every endpoint, privileged/public route and SQL call site, with table + operation + role/function + tenant/geography/bilateral scope.
2. Inspect SQL migrations, SECURITY DEFINER functions, triggers, dynamic SQL, JSON/polymorphic references and grants to validate the draft table matrix.
3. Design and test transaction propagation with existing route-level BEGIN/COMMIT/ROLLBACK and PoolClient acquisition. Do not introduce an outer request transaction until nested transaction semantics, concurrency and connection lifecycle are proven.
4. Integrate in bounded route cohorts only after exact-role disposable PostgreSQL acceptance demonstrates no cross-tenant reads/writes, identity/session revocation, connection reuse isolation and rollback safety.
5. Independent security/DBA review, backup/restore and rollback rehearsal, then explicit founder release gate.

This checkpoint records verified repository/CI facts only; it does not certify production readiness.
