# RupayKg authenticated PostgreSQL context rollout gate

**Assessment date:** 7 November 2026  
**Repository authority:** `vishaltradewinds/rupaykg` / `main`  
**Database authority:** Neon project `rupaykg-production-fresh`, branch `main`, database `rupaykg`  
**Status:** **P0 BLOCKER — design proof exists; full application integration is not implemented on main**  
**Execution boundary:** Read-only source audit and engineering plan only. No production database, role, grant, migration, RLS, deployment or credential change was made.

## 1. Executive determination

RupayKg's database-backed authorization logic already identifies a bearer-session identity and selected organization in application memory. However, the current production-source baseline does not bind that authenticated identity and organization to the PostgreSQL transaction that performs protected reads and writes.

The RLS rehearsal scripts use test-only settings such as `app.organization_id` and `app.identity_id`. Those are adequate to test policy predicates in a disposable database, but a plain custom GUC is caller-controlled and is not proof of the authenticated user. They must not be copied into production as a trust mechanism.

The repository contains an earlier cryptographically signed transaction-context prototype:
- PR #282 proves an HMAC-authenticated context issuer, transaction binding and a non-owner role on disposable PostgreSQL.
- PR #284 adds a candidate migration and integrates the context issuer into one verification-write route.

Both PRs remain open and draft. Neither is merged to `main`. The migration and helper are not present in the authoritative mainline. More importantly, the #284 application change covers one route; it does not install context across all authenticated API reads, writes, pooled transactions or workers.

**Decision:** Do not enable production RLS or treat the RLS policy suites as production cutover readiness until the authenticated transaction-context mechanism is securely deployed, applied before every tenant-scoped read/write, and tested under the intended non-owner `NOBYPASSRLS` runtime identity.

## 2. Mainline source audit — 7 November 2026

The following files were inspected on `main`:

| File | Mainline finding |
|---|---|
| `apps/src/auth.ts` | `authenticate()` reads `identity_sessions`, `identities` and `organization_memberships` using `pool.query`; it returns `identityId`, verified memberships and an `activeOrganizationId`. It does not establish PostgreSQL transaction context. |
| `apps/src/server.ts` | Creates one shared `pg.Pool`; `query()` uses `pool.query`; `withClient()` obtains a client but does not begin a transaction or set authenticated context. Multiple protected routes use pool-level reads. |
| `apps/src/production-server.ts` | Loads production config and imports the server; it does not install authenticated request context. |
| Protected route modules | Direct `pool.query`, route-local `pool.connect()` transactions and helper calls are used, with no signed database context on mainline. |

The source scan found **90 literal route registrations** across 15 source files. This includes health/status/catalog endpoints as well as protected routes; it is a source inventory count, not a claim that all 90 routes require the same treatment.

| Source file | Literal route registrations |
|---|---:|
| `auth-routes.ts` | 8 |
| `bwg-routes.ts` | 1 |
| `cpcb-swm-routes.ts` | 3 |
| `epr-return-routes.ts` | 4 |
| `evidence-vault-routes.ts` | 4 |
| `intelligence-routes.ts` | 1 |
| `mrv-routes.ts` | 4 |
| `onboarding-hierarchy-routes.ts` | 3 |
| `platform-admin-routes.ts` | 15 |
| `registry-routes.ts` | 8 |
| `statutory-routes.ts` | 5 |
| `sync-routes.ts` | 7 |
| `value-routes.ts` | 9 |
| `workspace-routes.ts` | 8 |
| `server.ts` | 10 |
| **Total** | **90** |

The inspected route set includes identity and onboarding, platform-admin, tenant profile and compliance, MRV/evidence, field-device and field-sync, carbon/EPR/ESG, registry and credential, settlement, CPCB SWM and statutory operations. A route-level and worker-level register must be maintained through implementation; the 90-route count must not substitute for a complete query-path map.

### Mainline transaction-context gap

On `main`, no inspected route module calls:
- `establishAuthenticatedDatabaseContext(...)`;
- `rupaykg_set_authenticated_context(...)`; or
- the signed `rupaykg.context.*` GUC contract.

The mainline context gap is not limited to writes. Protected GET routes also issue tenant-scoped reads with `pool.query`. Route-local transactions in the registry, sync, platform-admin and evidence paths likewise do not establish signed context on mainline.

### Authentication-bootstrap dependency

`authenticate()` currently queries session, identity and membership tables before a PostgreSQL tenant context exists. If these tables are protected by RLS, the bootstrap path itself must have an explicit, narrowly controlled access design. It must not be solved by leaving broad API access to every identity/session/membership row or by restoring a BYPASSRLS application credential.

The chosen design must support both:
1. safe bearer-session authentication and selected-organization resolution; and
2. the protected tenant transaction which then performs the business operation.

This may require a tightly scoped SECURITY DEFINER authentication/context issuer or a separate, carefully restricted auth bootstrap contract. Its owner, grants, row-locking behavior and ability to read only the authenticated caller's session/membership must be independently tested.

## 3. Existing signed-context prototypes — evidence and limitations

### PR #282 — mechanics proof

[PR #282](https://github.com/vishaltradewinds/rupaykg/pull/282) is open and draft. Exact head: `7963719280d20d2e285d3011ea390aee5ab46e9d`. Its CI run [#5474](https://github.com/vishaltradewinds/rupaykg/actions/runs/41815073863) passed.

Its disposable PostgreSQL test demonstrates:
- an opaque bearer token is resolved against an unrevoked, unexpired `identity_sessions` row;
- identity, active verified membership and verified organization are checked;
- a private HMAC key is held outside the API role's access;
- a dedicated NOLOGIN/NOSUPERUSER/NOBYPASSRLS helper owner issues a transaction-local signed context;
- identity, organization, session, expiry and signature are bound to the current transaction;
- arbitrary caller-supplied custom-GUC values without a valid HMAC are rejected;
- a prior transaction's signed context cannot be replayed in a later transaction;
- a revoked bearer session is rejected.

This is a disposable mechanics proof. It is not an applied production migration or application-wide route integration.

### PR #284 — one verification route integration

[PR #284](https://github.com/vishaltradewinds/rupaykg/pull/284) is open and draft. Exact head: `cbd743a8d2e17100cd1607ef19f90bef6a6ccc6d`. Its CI run [#5521](https://github.com/vishaltradewinds/rupaykg/actions/runs/41875338287) passed.

It adds:
- candidate migration `migrations/20261104_authenticated_verification_context.sql`;
- `establishAuthenticatedDatabaseContext()` in `apps/src/auth.ts`;
- a call to the issuer in the verification-write handler in `apps/src/workspace-routes.ts`;
- an end-to-end disposable PostgreSQL test.

The migration intentionally does **not** grant the context issuer to a production API role until the actual runtime identity and least-privilege contract have been established. This is correct as a safety boundary.

**Integration gap in the prototype:** in the current #284 verification-handler diff, the handler first selects and row-locks `evidence`, then reads the `activities` organization, and only afterwards establishes authenticated database context. Once RLS is enabled on those tenant-owned tables, those first reads may already be blocked. The context should be established from the authenticated `AuthContext.activeOrganizationId` (or a separately approved bootstrap result) immediately after `BEGIN`, before tenant-scoped table reads; the activity's actual organization must then be checked against the signed context.

**Scope gap:** PR #284 integrates one verification-write route. It does not establish context for all protected reads/writes, platform-admin operations, resource/value routes, field-sync workers, EPR returns, CPCB history, registry/credential flows, settlements, exports or background jobs.

## 4. Required target architecture

### 4.1 Trusted transaction context

Use the signed transaction-context design as a candidate, subject to independent security and DBA review:
- A dedicated context owner must be `NOLOGIN`, `NOSUPERUSER`, `NOCREATEROLE`, `NOCREATEDB`, `NOREPLICATION` and `NOBYPASSRLS`.
- The HMAC key must live in a private schema/table inaccessible to the API runtime, PUBLIC and tenant users.
- The context issuer must be SECURITY DEFINER with a pinned `search_path`, schema-qualified objects, explicit execution grants, and narrowly bounded database privileges.
- The issuer must resolve the opaque bearer token against the actual session, identity, membership and organization records; reject revoked/expired/suspended/unverified records; and bind the selected organization to a current verified membership.
- Signed context must include identity, organization, session, expiry and the current transaction identifier. RLS helpers must fail closed for missing, malformed, expired, forged or replayed context.
- Raw `app.organization_id` / `app.identity_id` values supplied by the caller must never be accepted as trusted identity or tenant authority.
- Do not grant context-function execution to PUBLIC. Grant only to the verified runtime principal once its exact role and grants are established.

### 4.2 Transaction boundary

Every protected tenant operation must execute through one explicit `PoolClient` transaction:
1. acquire a client;
2. begin the transaction;
3. establish signed context for the identity and active organization;
4. verify the returned database identity matches the already-authenticated application identity;
5. only then perform tenant-scoped SELECT/INSERT/UPDATE/DELETE and related authorization checks on that same client;
6. commit on success, rollback on any failure, and release the client.

Do not set session-level context on pooled connections. Do not set transaction-local context on one client and then issue related protected queries through `pool.query` or a different client. Parallel reads must share the scoped transaction client or be split into separately authenticated transactions with the required isolation semantics.

### 4.3 Route classes

The implementation must explicitly classify:
- **Public/bootstrap:** health, status, login, registration, logout, public catalogue/reference reads and other intentionally unauthenticated endpoints. These require narrowly scoped service/bootstrap access rather than tenant GUC assumptions.
- **Single-organization protected:** profile, operations, MRV, evidence, reporting, EPR, statutory, CPCB SWM, audit and ordinary workspace operations. Use one active organization context.
- **Multi-party protected:** credentials, registry transfers, EPR credits/transfers and settlements. Context identifies the authenticated active participant; row policies and route authorization must explicitly check legitimate counterparty visibility and action-specific authority. Do not solve bilateral access by accepting an arbitrary list of organization IDs in a caller-controlled GUC.
- **Platform-admin:** platform-wide identity, membership, role and access-change workflows. Use explicit platform-admin permissions and a separate reviewed access path; do not mistake organization selection alone for platform authority.
- **Background workers/devices:** bind an enrolled device/worker identity to its verified organization, scope, lifecycle and job authorization. Do not impersonate a human bearer session or use the unresolved `operation_sync_envelopes` path as an identity source without a separate signed worker context.

### 4.4 Auth bootstrap

Before enabling RLS on `identity_sessions`, `identities` or `organization_memberships`, implement a bootstrap model that can safely:
- validate the bearer session without exposing other users' sessions;
- resolve the authenticated identity and currently verified memberships;
- require explicit organization selection for multi-organization identities;
- establish the signed context in the same connection/transaction used for the protected operation;
- fail closed if session, identity, membership or organization is revoked/suspended/unverified.

Do not leave the runtime login with BYPASSRLS, table ownership or broad cross-tenant grants as a workaround.

## 5. Execution batches and exit criteria

| Batch | Work | Exit evidence |
|---|---|---|
| CTX-0 — Design freeze | Reconcile PR #282 and #284 prototypes; define bootstrap, transaction lifecycle, context HMAC/key custody, role model, lock order and error behavior | Reviewed ADR, threat model, context protocol and exact migration candidate |
| CTX-1 — Disposable DB foundation | Rehearse context owner/key schema, HMAC issuer/validator, transaction-ID binding, expiry, revocation, session replay, organization/member state and least-privilege grants | Exact-head CI; spoof/replay/revocation/negative tests pass under non-owner NOBYPASSRLS roles |
| CTX-2 — Runtime transaction wrapper | Implement typed request-scoped `PoolClient` transaction/context helper; ensure same client is used for all protected queries; handle rollback, streaming and parallel reads | Runtime unit/integration tests; no authenticated tenant query escapes context wrapper |
| CTX-3 — Auth bootstrap | Replace unrestricted pre-context identity/session/membership reads with a narrowly scoped bootstrap contract | Cross-tenant negative tests; no broad session/membership visibility; revocation and multi-membership tests |
| CTX-4 — Route conversion | Convert all 90 route registrations in the 15 inventoried source files, classifying public vs protected and recording every query path; context set before first tenant read | Route coverage register, per-module integration tests, no protected pool.query bypass |
| CTX-5 — Worker and multi-party context | Add device/worker-specific signed context and explicit bilateral/counterparty policy contracts | Worker replay/scope tests; each legitimate counterparty and unauthorized third-party tests |
| CTX-6 — Runtime identity and release rehearsal | Prove actual deployed runtime login, role memberships, ownership, privileges, RLS behavior, pool reset and rollback in a disposable branch/staging environment | Exact runtime role evidence, route/worker acceptance, negative cross-tenant tests, backup/restore and independent DBA/security review |
| CTX-7 — Controlled production authorization | Prepare the final change plan only after all previous gates; production change requires explicit founder approval and change window | Signed cutover plan, rollback and recovery proof, independent approval; no inferred approval from this document |

## 6. Hard acceptance criteria

1. Every protected route and background job has an explicit context class and transaction owner.
2. No protected tenant SELECT/write runs before the signed context is established.
3. No protected tenant query uses an unscoped `pool.query` after route authentication.
4. Every context-bound operation uses the same `PoolClient` and transaction from issuer through final query.
5. Context fails closed on missing/forged settings, wrong org, token expiry, session revocation, identity suspension, membership revocation, organization status change and transaction replay.
6. A client cannot change organization/identity settings and obtain authority without the HMAC issuer.
7. Context-owner functions have fixed search path, no PUBLIC EXECUTE, a NOLOGIN/NOBYPASSRLS owner and only the minimum SELECT/column-lock privileges.
8. Bilateral participant and platform-admin workflows are tested separately from ordinary single-organization access.
9. All API route, server action, worker, job, export and direct SQL paths are mapped.
10. Actual deployed runtime role is independently proven non-owner and NOBYPASSRLS before any production RLS cutover.
11. Independent security/DBA review and explicit founder authorization occur before any production migration, role/grant/RLS change, deployment or certification.

## 7. Current release boundary

The live authoritative Neon main branch remains READ-ONLY / HOLD. The earlier read-only audit found 67 public tables, 0 RLS-enabled tables, 0 FORCE RLS tables, 0 public RLS policies, and the observed application login carried `BYPASSRLS` plus elevated role-creation/database privileges. The actual deployed Render runtime identity has not been independently proven.

Passing CI for PR #282, PR #284, Batch C or Batch D does not mean production context is installed. Passing isolated RLS tests does not prove application request coverage.

This gate does not authorize:
- production DDL, migration application, role creation/alteration, grant changes or branch protection changes;
- production RLS enablement;
- deployment or worker activation;
- statutory approval, regulatory registration, external trust acceptance or certification;
- any TRL promotion.

**RupayKg production tenant isolation remains NOT ESTABLISHED. Production release remains HOLD. TRL remains provisional software TRL 4; integrated-platform TRL is unverified and TRL 5 is not demonstrated.**
