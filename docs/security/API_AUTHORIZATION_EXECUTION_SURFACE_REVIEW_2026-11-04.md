# API authorization and execution-surface review — 2026-11-04

## Scope and method

Static source review against repository `main` at base commit `a3fecc0abd2c46549a201058d3963afc0e3a73c9`, plus read-only production Neon catalog evidence recorded in `PRODUCTION_TENANT_ISOLATION_INVENTORY_2026-11-04.md`.

The route scan covers the API server and all route registrar files imported by `apps/src/server.ts`, including nested registrars `auth-routes.ts`, `epr-return-routes.ts`, and `statutory-routes.ts`. It identifies 90 route declarations across 15 source files (includes public health/status/catalog routes and nested registration modules). This is a static review, not a substitute for route-by-route dynamic tests with actual runtime DB identity.

## Route surface map

| Module | Route declarations | Main data families / controls |
|---|---:|---|
| `server.ts` | 10 | health/status/overview, regulatory source catalog, geography, operation sync, resource flows, measurements |
| `auth-routes.ts` | 8 | registration/login/logout, identity session, onboarding applications |
| `onboarding-hierarchy-routes.ts` | 3 | stakeholder review queue, legal verification, approval/rejection chain |
| `value-routes.ts` | 9 | carbon calculations, EPR assessment, ESG metrics, BWG profile/reporting |
| `registry-routes.ts` | 8 | credentials, registry events, bilateral settlements |
| `sync-routes.ts` | 7 | field device enrollment/verification, field sync envelopes, apply, conflicts |
| `workspace-routes.ts` | 8 | resource flow, MRV, compliance, carbon, registry, settlement, ESG and evidence verification workspaces |
| `bwg-routes.ts` | 1 | EPR obligations workspace |
| `epr-return-routes.ts` | 4 | EPR return draft, submit, external reference |
| `cpcb-swm-routes.ts` | 3 | CPCB SWM stakeholder workspace read/write |
| `intelligence-routes.ts` | 1 | intelligence workspace |
| `mrv-routes.ts` | 4 | MRV status, activity submission, provenance, Mirror Node verification |
| `statutory-routes.ts` | 5 | statutory applicability, BWG/EPR preparation and external-reference recording |
| `evidence-vault-routes.ts` | 4 | evidence upload, list, download, independent review |
| `platform-admin-routes.ts` | 15 | super-admin identity, role, membership, access-change and audit controls |

## Positive authorization controls observed in source

- Authenticated operational routes use opaque bearer sessions, verified/non-suspended identities and verified organization memberships. Multi-organization identities must select an organization through the request context.
- High-risk registry/settlement actions require explicit permission keys and use transactions/row locks for state transitions. Settlement creation checks authority for both payer and payee.
- MRV submission binds activity, verification and evidence to the same activity, checks completed/approved/verified states, organization membership, geography authorization and `guardian:operate`.
- EPR return submission locks the return and obligation, checks same-organization evidence/activity binding, approved verification, evidence state/hash-or-URI, geography and remaining obligation balance.
- Field sync intake binds a verified field device to the authenticated identity; apply checks envelope identity, status and per-operation organization permission. Client operation sync delegates to the protected field-sync routes.
- Platform-admin routes have a separate `super_admin` authority gate plus explicit permission checks; this is distinct from the ordinary tenant permission model.
- Statutory preparation endpoints label their boundary as internal applicability preparation and user-reported external references as unverified; they do not claim CPCB external submission.

These controls are useful application-layer safeguards, but cannot compensate for production RLS being disabled and the application role having BYPASSRLS/table ownership.

## New route-context finding — geography reads

`GET /api/v1/geography/roots` first builds a recursive geography set by joining all VERIFIED `organization_geography_scopes` for the authenticated identity. It does not constrain that query to `auth.activeOrganizationId`. Its fallback path calls `canReadGeography`, which also checks any verified organization membership rather than the selected active organization. `GET /api/v1/geography/children/:parentId` uses the same any-membership helper.

The geography catalog itself may be shared/reference data, so this is not presently classified as proven cross-tenant disclosure of business records. It is nevertheless inconsistent with the explicit active-organization context contract for multi-organization identities and can return geography scopes belonging to another organization selected by the same identity.

**Required correction:** make the selected organization explicit for geography reads; require the selected organization to be a verified membership and evaluate scope only for that organization. Define an explicit, separately tested global-reference read policy if the product intends to expose unscoped geography. Add multi-org tests proving org A cannot enumerate org B's assigned scopes when A is active.

## Other focused review notes / gates

1. **Verification authorization:** `canVerifyEvidence` in `auth.ts` uses verified membership, geography scope and explicit permission keys, but does not accept an organization ID itself. Its current call sites add surrounding activity/active-organization checks. Keep this helper from becoming a standalone authorization API; the forward fix must bind the exact subject organization in the helper or require a pre-bound authorization context. PR #238 remains incomplete because its own review records the live legacy `verification_independence_guard` integration gap and the need to reconcile PR #192.
2. **Value/statutory permission functions:** EPR/ESG paths also call database functions `can_assess_epr` and `can_write_esg`. Their exact SQL definitions, grants, search_path and behavior under the final non-owner runtime identity must be included in the database authorization review; application call sites alone do not prove their semantics.
3. **Workspace projections:** each workspace query needs dynamic tests for active-org filtering, indirect child ownership, bilateral resources, geography and read permissions. Pay particular attention to settlements, transferred credentials, EPR credits and reports joined through reporting periods.
4. **Evidence and artifact paths:** test upload/list/download/review under actual runtime role; verify no evidence/artifact ID can be used to infer or access another organization's parent activity, and preserve immutable review/verification lineage.
5. **Geography consistency:** geography roots/children finding above should be fixed and tested before enabling tenant RLS. Geography is a shared reference table but organization scope assignments are tenant-controlled.
6. **Operation sync:** no independent queue consumer or scheduled worker entrypoint was found in the recursive repository file tree. The API performs intake and apply through synchronous internal route injection. The offline operation queue is browser-side code, not a server worker. Confirm no external Render cron/worker service exists outside repository configuration before declaring the inventory complete.
7. **Guardian/Hedera:** live acceptance is a manual `workflow_dispatch` workflow requiring explicit base URL, organization/activity/verification/evidence IDs, policy ID and a session-token secret. CI does not run a live Guardian/Hedera round-trip. No automated background retry worker was found in repository source.
8. **Startup/migrations:** the Docker CMD runs `migrate.js`, then the guarded acceptance seed, then `production-server.js` inside the web-service container. The migration job must be separated from the API deployment and use a different credential; acceptance seed must remain disabled in production unless a controlled acceptance environment explicitly requires it.

## Required non-production test matrix

- Single-org and multi-org identities; active org A versus org B; no selected org; revoked membership during concurrent requests.
- Direct and indirect resource access: activity → evidence → artifact → verification → calculation → credential → registry event → settlement; reporting period → BWG/EPR/ESG children; device → envelope → conflict.
- Read/write/insert/update/delete across tenant A/B for each of the 67 tables using the actual non-owner runtime role with RLS FORCE semantics.
- Cross-organization FKs and multi-party resources (EPR credits/transfers, settlements) with explicit participant authorization.
- Pooled connection reuse and transaction-local tenant context reset; concurrent requests with different tenant contexts.
- Background/one-shot jobs, acceptance workflow, migration runner and any externally configured worker service.
- Negative cases: forged tenant IDs, stale session, suspended identity, pending/revoked membership, wrong geography, wrong role permission, role-name-only privilege, missing evidence/verification binding and replay.

## Disposition

- Route-family static mapping completed; handler-level dynamic authorization assurance remains open.
- New geography active-organization scope inconsistency identified; not yet patched.
- No independent server worker found in repository tree; external infrastructure must be checked before declaring no workers exist.
- Production tenant isolation remains P0 FAIL/HOLD: 0/67 RLS, 0/67 FORCE RLS, all 67 tables owned by BYPASSRLS-capable role.
- No production DDL/DML, role/grant changes, RLS activation, migration, deployment, merge or certification was performed.
- PR #238 remains draft pending unified verification-trigger design, legacy trigger regression/removal, migration chronology and independent DBA/security review.
