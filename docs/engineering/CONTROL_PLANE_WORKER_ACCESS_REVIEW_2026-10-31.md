# Identity, Governance, Platform-Admin and Worker DB Access Review — 2026-10-31

## Scope

Bounded source review of the PR #157 candidate branch:
- `apps/src/auth-routes.ts`
- `apps/src/onboarding-hierarchy-routes.ts`
- `apps/src/platform-admin-routes.ts`
- `apps/src/async-mirror-worker.ts`
- `apps/src/acceptance-seed.ts`
- cross-check: `apps/src/workspace-routes.ts`

This is source inspection, not a complete query graph. Helper internals, every migration-defined FK/trigger, deployed runtime identity and all dynamic SQL are not fully established here.

## 1. Authentication routes — identity/control-plane data, not tenant data

### `POST /api/v1/auth/register`
- Direct pool pre-check reads `identities` by normalized email.
- Then a checked-out client transaction inserts `identities` and `identity_password_credentials`.
- The duplicate pre-check is outside the transaction. Concurrent registrations can race; a database unique constraint must be the authoritative arbiter and its conflict must map to ACCOUNT_EXISTS. Do not rely on the pre-check for uniqueness.
- Session creation is separate from account creation and occurs during login, not registration.

### `POST /api/v1/auth/login`
- Pool query joins `identities` and `identity_password_credentials`.
- Failed password updates `identity_password_credentials.failed_attempts/locked_until` via a separate pool query.
- Successful login resets failure counters, creates an `identity_sessions` row through `issueSession(pool,...)`, then separately queries `organization_memberships`, `roles`, `organizations`, `stakeholder_applications` and `organization_verification_evidence`.
- These are identity/session/control-plane reads. They must not be assigned a user tenant context before authentication is established.
- Concurrency-sensitive lockout counters should use atomic SQL updates/locking; verify unique/session constraints and ensure failures do not leak account-existence information.

### `GET /api/v1/auth/me`
- Three concurrent pool reads: `identities`, `organization_memberships` joined to `roles`/`organizations`, and `stakeholder_applications` joined to `organizations` with evidence count.
- Identity-scoped reads; use an explicit identity/session context or a dedicated least-privilege identity role, not a tenant RLS context inferred from an unauthenticated request.

### `POST /api/v1/auth/logout`
- Pool update revokes matching `identity_sessions` token hash.
- Identity/session control-plane operation. Keep token hash only; never log or return bearer token.

## 2. Onboarding application — transaction is present, but preconditions sit outside it

### `POST /api/v1/onboarding/applications`
- Authenticated identity is established first.
- Optional geography existence lookup reads `geography` through pool before transaction.
- Active application duplicate check reads `stakeholder_applications` through pool before transaction.
- Transaction then inserts `organizations`, `roles`, `organization_memberships`, optional `organization_geography_scopes`, optional `organization_verification_evidence`, and `stakeholder_applications`.
- Race: duplicate application pre-check is not atomic with insert. Require a database uniqueness/partial-unique constraint or an explicit identity-scoped lock and a regression test. Geography existence should be revalidated inside the transaction (or protected by FK and handled deterministically).

### `GET /api/v1/onboarding/applications`
- Identity-scoped direct pool read of `stakeholder_applications`, joined to `organizations`, with count of `organization_verification_evidence`.
- Identity/control-plane read.

### `POST /api/v1/onboarding/applications/:applicationId/withdraw`
- Checked-out client transaction locks the state transition through conditional UPDATE of the applicant's PENDING row, then updates `organization_memberships`, `organization_geography_scopes`, and `organizations`, then commits.
- This is a good atomic pattern; confirm foreign-key/tenant scoping and add concurrency tests for duplicate withdrawal/review races.

## 3. Onboarding hierarchy — platform governance and jurisdiction approval

### `GET /api/v1/onboarding/review-queue`
- Pool query reads pending `stakeholder_applications` joined to `organizations`, `geography`, `identities`, and evidence count.
- Per application, separate pool queries read `stakeholder_application_approvals`, evaluate `eligible(...)`, and `hasAuthority(...)`.
- Multiple independent queries can produce inconsistent review-queue snapshots and multiply round trips. This is a platform-governance control-plane path, not a normal tenant route. It needs explicit reviewer/jurisdiction authority and audited read access. A single read transaction or bounded batch query is preferable.

### `POST /api/v1/onboarding/applications/:applicationId/verify-legal`
- Platform authority check occurs before the checked-out client transaction.
- Transaction locks pending application, checks persisted evidence references/content hashes, updates `organization_verification_evidence` and `organizations`, commits.
- Authority can be revoked between pre-check and mutation. Revalidate/lock reviewer authority inside the same transaction using a stable database authorization helper and ensure audit event is appended atomically.

### `POST /api/v1/onboarding/applications/:applicationId/:action`
- Uses checked-out client and transaction for approval/rejection. Review authority and hierarchical approvals must be checked in-transaction and remain bound to the same application/geography/approval step. Inspect remaining function body before considering this path complete.

## 4. Platform-admin routes — separate privileged trust domain

File: `apps/src/platform-admin-routes.ts`

- Runtime identity diagnostic is a read-only pool query behind Super Admin auth and `admin:security`. It is useful only when called through the actual deployed app pool; CI/test reports the test role.
- Overview, identities, roles, access-change requests, memberships and audit-event list endpoints include pool-level reads. These are privileged control-plane reads and should be audited and protected by platform-admin authorization, not forced through generic tenant context.
- Identity suspend/reactivate, session revoke, role permission changes, access-change request decisions, membership creation/status transitions use checked-out client transactions. Membership revocation includes advisory transaction lock and session revocation in the transaction.
- Access-change approval includes requester/approver authority and target-state checks; ensure all such authority is revalidated/locked inside the same transaction as mutation.
- Keep platform-admin operations on a dedicated privileged role with narrow grants and immutable audit trail. Do not implement an RLS bypass using the ordinary application login or a user-controlled GUC.

## 5. Async mirror worker — worker-owned inbox context

File: `apps/src/async-mirror-worker.ts`

Observed pool-level SQL call sites include inbox claim, mapping lookup, terminal/retry/quarantine state updates, queue summary and lease summary. The worker has a separate processing lifecycle from user HTTP requests and must not inherit an arbitrary tenant's transaction context.

Required worker contract:
- Dedicated non-login or narrowly scoped worker runtime role distinct from web API role.
- Claim work with safe row locking/lease semantics and bounded batch size.
- Verify source identity, approved scope, geography binding, canonical payload hash and replay/idempotency before authoritative mutation.
- Keep claim, lease token, state transition and append-only event writes atomic where possible.
- Enforce per-source/per-organization scope in the worker SQL itself; never trust inbox tenant/source fields without validated mapping.
- Preserve the eight known expired PROCESSING leases in staging; no automatic reset/replay is authorised.
- Worker must remain OFF until independent review, retry/quarantine/replay acceptance, observability, least privilege and explicit activation approval.

## 6. Acceptance seed — CI-only privileged fixture writer

File: `apps/src/acceptance-seed.ts`

- Creates its own PostgreSQL pool from `DATABASE_URL` and performs a sequence of fixture queries and writes inside a transaction.
- This is not a web-request tenant context. It should only run against disposable CI PostgreSQL with isolated credentials and deterministic fixture identity/cleanup.
- Production image/start command must never invoke it; the current PR #157 Docker command removes automatic seed execution. Retain a separate explicit CI script and fail closed if production environment or non-disposable target is detected.
- Verify that the seed transaction uses a checked-out client consistently; a pool-level `BEGIN` followed by pool-level queries is not guaranteed to stay on one connection. If the source uses `pool.query("begin")` and subsequent `pool.query`, replace with a checked-out client transaction before any acceptance claims. This is a specific implementation check to resolve before treating the seed as safe.

## 7. Workspace cross-check

`workspace-routes.ts` uses the tenant transaction helper for resource-flow, MRV, compliance, carbon, registry, settlement and ESG workspace paths, including multi-table projections. Evidence verification mutation locks/reads evidence, inserts verification and updates evidence status on one client. This is materially safer than the remaining direct-pool paths, but registry and settlement projections remain bilateral: payer/payee/current-owner semantics must be covered by table-specific policies and cross-organization tests.

## Table classification required

| Class | Representative tables | Required DB context |
|---|---|---|
| Identity/session | identities, identity_password_credentials, identity_sessions | Identity/session control-plane |
| Organization onboarding | stakeholder_applications, organizations, roles, organization_memberships | Applicant identity + governance workflow |
| Legal/jurisdiction evidence | organization_verification_evidence, stakeholder_application_approvals, organization_geography_scopes | Authorized platform/jurisdiction reviewer |
| Platform administration | access-change requests, audit events, admin-controlled memberships/roles | Separate privileged platform-admin role |
| Worker inbox | async_mirror_inbox, async_mirror_events, source mappings | Dedicated worker role |
| Acceptance fixtures | test identities, organizations, activities/evidence/verifications | Disposable CI-only role |
| Tenant business records | activities, evidence, measurements, obligations, ESG/BWG records | Verified tenant transaction |
| Bilateral registry/settlement | credentials, registry_events, settlements, settlement_events | Explicit issuer/current-owner and payer/payee relationship policies |
| Global reference | geography, regulatory_sources, verified EPR schemes | Versioned global read model with separate integrity controls |

## Next implementation gates

1. Fix/verify acceptance seed connection discipline and production guard.
2. Add uniqueness/race protections for registration and onboarding application creation.
3. Revalidate platform/jurisdiction authority inside the same transaction as legal/onboarding decisions.
4. Define explicit identity/control-plane and platform-admin DB roles; do not reuse tenant GUC for pre-auth flows.
5. Define dedicated worker role and lease/event SQL acceptance; preserve staged leases.
6. Add cross-tenant, cross-jurisdiction, reviewer revocation race, identity/session and worker replay negative tests.
7. Only then complete table-specific RLS design and disposable-clone rehearsal.

## Release posture

This review is bounded and does not prove runtime least privilege. No live production/staging DDL/DML, role/grant, Render config, deployment, worker activation or queue mutation was performed. RLS remains disabled. PR #157 remains draft; production remains HOLD.
