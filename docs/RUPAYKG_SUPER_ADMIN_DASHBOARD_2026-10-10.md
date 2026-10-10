# RupayKg Super Admin Governance — 10 October 2026

## Scope and repository state

- Repository: `vishaltradewinds/rupaykg`
- Workspace: `C:\Users\Vishal\rupaykg-live`
- Branch: `fix/guardian-hedera-gate-20261010`
- This work is repository-only. It does not apply database migrations to production, merge the pull request, or deploy a service.

## Implemented in the branch

### Platform overview
- Dedicated responsive Super Admin Control Centre.
- Platform-wide aggregate counts for verified active identities, organizations, verified memberships, pending applications, pending legal reviews, and Guardian-verified/HCS-consensus-confirmed MRV records.
- Operational data remains organization-scoped. Configuration indicators do not claim that an actual Guardian/Hedera verification succeeded.

### Server-side administration APIs
- `GET /api/v1/admin/overview`: platform aggregate counts.
- `GET /api/v1/admin/identities?search=&limit=`: bounded identity directory with suspension and active-session status.
- `POST /api/v1/admin/identities/:identityId/suspend`: suspends a verified identity and revokes active sessions; self-suspension and platform-reserved administrator suspension are blocked.
- `POST /api/v1/admin/identities/:identityId/reactivate`: reactivates only an identity whose verification status remains VERIFIED; sessions stay revoked. Platform-reserved administrator reactivation is blocked for separate governance.
- `POST /api/v1/admin/identities/:identityId/revoke-sessions`: revokes all active sessions for an identity.
- `GET /api/v1/admin/roles` and `PATCH /api/v1/admin/roles/:roleId/permissions`: lists roles and permits edits only from a low-risk permission allowlist. Reserved and high-risk roles cannot be edited by this path.
- `GET /api/v1/admin/memberships`, `POST /api/v1/admin/memberships`, and `PATCH /api/v1/admin/memberships/:membershipId/status`: grants eligible existing roles, revokes membership access, and restores only previously administratively revoked memberships. Pending/rejected onboarding applications cannot be bypassed. Self-escalation and reserved-role grant/restoration are blocked; the last active Super Admin cannot be revoked.
- `GET /api/v1/admin/audit-events?limit=`: bounded security/audit event listing.

### Audit and identity controls
- Each administrative mutation requires a reason and records the actor, target, request ID, organization scope, payload, prior hash and SHA-256 event hash in the same database transaction.
- Audit writes from this route use a PostgreSQL advisory lock to serialize the hash-link operation.
- Identity authentication now rejects identities with an active `suspended_at` marker.
- Migration `082_super_admin_identity_governance.sql` adds identity suspension metadata and membership revocation metadata.
- The UI provides identity search, suspend/reactivate, session revocation, a low-risk role permission editor, membership grant/revoke/restore, and recent audit-event review.
- The UI does not offer generic super_admin/platform_admin assignment. High-risk permission edits and reserved-administrator recovery require a separate dual-control workflow.

## Local verification

- API TypeScript build: passed.
- Web production build: passed.
- Workspace unit tests: 98 passed, 0 failed, 5 skipped across API and other packages. API tests report 64 passed, 0 failed, 5 skipped; skips require database-backed / production-lifecycle acceptance infrastructure.
- Added a PostgreSQL integration test for persisted identity suspension, session revocation, audit evidence and rejection of subsequent authentication. It only runs when both `DATABASE_URL` and `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` are explicitly set; it was skipped locally because no database URL is configured.
- Migration structure validation: passed; 82 migration files validated.
- `git diff --check`: passed.
- Full database-backed acceptance of migration 082 and authenticated browser acceptance remain outstanding.

## Not yet accepted / remaining

1. Run the five skipped database-backed / production-lifecycle acceptance gates in CI or against a dedicated test database.
2. Apply migration 082 only to a dedicated test PostgreSQL database and test real transactions, session revocation, audit hash continuity, last-Super-Admin concurrency, and identity/membership lifecycle.
3. Add a separate dual-control approval process for platform-reserved role grants/recovery and high-risk permission changes.
4. Add authenticated browser acceptance tests for the Super Admin UI and verify authorization failures for non-admin identities.
5. Run Guardian/Hedera production acceptance separately: real Guardian VERIFIED, HCS CONSENSUS_CONFIRMED, Mirror Node verification, policy import/publish and database-backed retry acceptance.

Do not merge or deploy based on frontend/API compilation and unit tests alone. Production acceptance is not verified by this document.
