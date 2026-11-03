# Authentication Architecture Decision Record — Provisional Source-of-Truth Assessment

**Assessment date:** 2026-11-03  
**Repository baseline:** `main` at `a3fecc0abd2c46549a201058d3963afc0e3a73c9`  
**Decision status:** PROVISIONAL — source implementation observed; architecture approval and production readiness not established.

## Decision under assessment

The current web/API implementation uses **RupayKg-native PostgreSQL-backed authentication** (password credentials plus opaque database sessions). This is the implementation visible in the inspected source paths. Firebase Authentication is described by an older authentication document and remains wired into Cloud Build's web-build configuration. The source/configuration disagreement must be resolved.

This ADR does not authorize production configuration changes, removal of Firebase resources, changes to credentials, database migrations, or deployment.

## Evidence inspected

| Area | Repository evidence | Observation |
|---|---|---|
| Web sign-in | `apps/web/src/main.tsx`, blob `a9cd8da0631b00096645e71be2953e58f7898a96` | Registration and login call `/api/v1/auth/register` and `/api/v1/auth/login`; login stores returned session token. |
| Registration/login | `apps/src/auth-routes.ts`, blob `95860bba8cc6c74367478c699e35d9e5494fcca4` | Native identity and password credential writes; scrypt password hashing; failed-attempt counter and temporary lockout after 10 failures; opaque session issuance with 8-hour expiry; membership/application reads. |
| Session validation | `apps/src/auth.ts`, blob `49a16d3c0ac7399c8a677b6530f0c6ab72e9b8c3` | SHA-256 token-hash lookup; rejects revoked/expired sessions and inactive/suspended identities; loads verified memberships; requires explicit organisation selection for multi-membership identities; checks requested organisation membership. |
| Production configuration | `apps/src/production-config.ts`, blob `21b386d95e88babd6708f522a9ea1aff33d9ea8f` | Requires `RUPAYKG_AUTH_MODE=real`, a production PostgreSQL URL and HTTPS allowed origins; rejects a browser session token build variable. |
| Runtime server | `apps/src/server.ts`, blob `ecdd9c49b27f1aef02c07e3f7a79f872d07a7f06` | Constructs one PostgreSQL pool from `DATABASE_URL`; auth and operational routes use that pool in this server entrypoint. |
| Production bootstrap | `apps/src/production-server.ts`, blob `f7daed3f98d8d1eb2afbd2701d222deabeafc9a5` | Loads validated production config and passes `DATABASE_URL`, TLS and auth mode to the server. |
| Environment example | `.env.example`, blob `2b836da780eba8d178b5def8719f1cee284d63ed` | Describes native PostgreSQL-backed authentication. |
| Conflicting auth document | `docs/AUTHENTICATION.md`, blob `c8c32fff1decaa94caa3ff76547728b075657bfa` | Describes Firebase Authentication, Firebase ID-token exchange and verified-email requirements. |
| Conflicting build config | `cloudbuild.yaml`, blob `a9d88152dfe05c82d76bb9cedec88f4292e0729d` | Requires Firebase web config values and passes them into the web build. |
| Conflicting deployment contract | `docs/CLOUD_RUN_PRODUCTION_CONTRACT.md`, blob `9dc57a17250c93a576bfbb2e7748b6f492439dad` | Requires Firebase web configuration at build time. |

## Security controls visible in source

- Passwords are stored as scrypt-derived hashes with per-credential salts, not plaintext.
- Login compares derived hashes using `timingSafeEqual`.
- Login increments failed attempts and applies a 15-minute lock after the threshold of 10 failures.
- Session bearer tokens are generated from 32 random bytes; only SHA-256 token hashes are persisted.
- Sessions expire after eight hours and logout marks a matching session revoked.
- Authentication rejects revoked or expired sessions and identities that are not VERIFIED or are suspended.
- Multi-organisation identities must select an organisation; the selected organisation must be among verified memberships.
- Evidence-vault routes enforce organisation/geography scope and explicit permissions; the reviewed source includes a self-review prohibition and immutable reviewed-state check.

These are source-level observations, not an independent security certification.

## Important limitations and open questions

1. **No auth-specific automated test file was found in the inspected `apps/src` inventory.** This is not proof that no tests exist elsewhere. Search the full repository and package test inventory, then add targeted auth lifecycle and abuse tests if absent.
2. `.github/workflows/ci.yml` provisions PostgreSQL, applies migrations, sets `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`, and runs `npm test`; therefore the evidence-vault integration test is intended to execute in CI. No workflow run was returned for the current PR head commit, so no pass/fail result is established for this change.
3. The production build still requires Firebase variables even though the inspected current web sign-in path uses native API routes. Trace every Firebase reference, package dependency, CI validator and deployment variable before editing.
4. Confirm all server entrypoints, worker processes and background jobs use the same approved authentication contract.
5. Confirm session rotation, password reset/recovery, email verification, abuse throttling, account enumeration protections, CSRF/CORS boundaries, audit events and secret handling.
6. Confirm production database pool identity and privileges, tenant/RLS policies, and cross-tenant negative tests.
7. Review password input handling and credential lifecycle edge cases with security tests.
8. Verify session cleanup/retention and operational revocation procedures.

## Required acceptance tests before approving this architecture

- Register: valid, duplicate, malformed email, short/long password, concurrent duplicate registration.
- Login: correct password, wrong password, lockout threshold and recovery, inactive/suspended identity.
- Session: random token, malformed token, expired token, revoked token, logout, replay after logout.
- Organisation scope: zero, one and multiple verified memberships; missing, malformed, unauthorized and switched organisation headers.
- Authorization: unverified membership, revoked membership, permission mismatch, geography mismatch, cross-tenant reads and writes.
- Production config: real auth mode required; no browser-injected session token; no Firebase build variables required unless an independently verified runtime dependency exists.
- CI: unit and database integration tests run on exact commit with results retained as evidence.

## Safe disposition

**Provisional direction:** Treat the native PostgreSQL-backed authentication implementation as the current source-code reality. Treat Firebase authentication documentation and Firebase build-time requirements as conflicting artifacts pending full dependency trace.

**Do not yet:**
- remove Firebase packages, project resources, build arguments or secrets;
- alter authentication or production environment settings;
- change database topology or privileges;
- enable RLS globally;
- promote production or claim certification.

Once the complete trace and tests pass, create a separate narrowly scoped implementation PR to synchronize the authentication documentation and build pipeline. Require exact-head CI and rollback plan before deployment.

## Approval

- Engineering source trace: partial; recorded above.
- Security review: pending.
- Architecture owner approval: pending.
- Production change authorization: not granted by this ADR.
