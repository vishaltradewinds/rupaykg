# RupayKg route-to-data authorization inventory — 2026-11-02

Status: engineering audit draft; not a policy approval and not a production change.

## Scope and method

Static inspection of the canonical backend branch at application code head `3b34b10a7277d3aaecfb1883d2f36924dc530635`, plus latest docs-only checkpoint. Reviewed the 15 route-bearing modules in `apps/src` and selected security/tenant migrations. Route/table extraction is lexical and must be reconciled against every helper, dynamic SQL statement, database function, trigger and worker before it is called complete.

The inventory found 90 registered HTTP route declarations across these modules:
- `auth-routes.ts` (8)
- `bwg-routes.ts` (1)
- `cpcb-swm-routes.ts` (3)
- `epr-return-routes.ts` (4)
- `evidence-vault-routes.ts` (4)
- `intelligence-routes.ts` (1)
- `mrv-routes.ts` (4)
- `onboarding-hierarchy-routes.ts` (3)
- `platform-admin-routes.ts` (15)
- `registry-routes.ts` (8)
- `statutory-routes.ts` (5)
- `sync-routes.ts` (7)
- `value-routes.ts` (9)
- `workspace-routes.ts` (8)
- `server.ts` (10; includes health/status/overview/catalog/geography/operations routes and static fallback)

## Route cohort → principal data objects → authorization scope

| Route cohort | Primary data objects observed | Expected authorization dimensions | Main assurance work still required |
|---|---|---|---|
| Native auth/session | identities, identity_sessions, identity_password_credentials, organization_memberships; auth_private functions | Identity/session validity; credential lifecycle; auth runtime only | Confirm every function owner, execute grant, search_path, token hashing, rate limits, revocation and transaction isolation |
| Onboarding applications | stakeholder_applications, organizations, organization_verification_evidence, stakeholder_application_approvals, organization_statutory_profiles; auth_private functions | Applicant identity; reviewer role + organization type + verified geography; staged approval hierarchy | Verify all SECURITY DEFINER functions and trigger side effects, applicant read/withdraw scope, and dual-control boundaries |
| Platform administration | identities, roles, organization_memberships, identity_sessions, platform_access_change_requests, audit_events | Platform authority capability; distinct requester/approver; reserved-role restrictions | Confirm every mutation is SECURITY DEFINER or tightly scoped; test no direct admin table grants; ensure audit chain atomicity |
| CPCB/SWM workspaces | cpcb_swm_stakeholder_workspaces, cpcb_swm_status_history, organization_memberships, audit_events | Active organization; verified membership; geography; actor provenance | Current routes use pool queries and route-local BEGIN/COMMIT. Integrate tenant context on the same checked-out client; audit append-only history and ownership |
| BWG/EPR obligations and returns | epr_schemes, epr_obligations, obligations, epr_returns, geography, evidence, activities, verifications | Obligated organization; scheme/period binding; evidence ownership; approved verification; geography | Ensure every lookup locks and scopes organization before mutation; no unscoped returnId-only reads; preserve atomic obligation balance |
| Evidence vault and review | evidence, activities, evidence_artifact_series, evidence_artifact_versions, evidence_artifact_reviews, verifications | Activity organization; uploader/reviewer identity; geography; immutable artifact provenance | Blob bytes and metadata must share one tenant-bound transaction; review must bind evidence and activity owner; inspect content access and storage retention |
| MRV and provenance | activities, measurements, evidence, verifications, mrv_observations, mrv_provenance_events | Activity organization; geography; verified evidence; authorized verifier; external anchor state | Validate all state transitions, external consensus callbacks, append-only provenance and organization-scoped reads |
| Registry/credentials | credentials, registry_events, evidence, verifications, activities, organizations | Issuer/current owner; activity scope; high-risk permissions; transfer recipient | Multi-party ownership must be modeled separately from single-org RLS context; validate lock ordering and event-chain integrity |
| Settlements | settlements, settlement_events, credentials, registry_events, organizations | Payer and payee separately; credential current owner; authorization from both parties; dual approval | Existing signed request transaction helper rejects bilateral context. Do not force settlements into a single-organization context. Define and test a dedicated bilateral claim/policy contract first |
| Field device and sync | field_devices, field_sync_envelopes, field_sync_conflicts, audit_events | Device enrollment identity; verified device; organization binding; idempotency and replay state | Ensure worker/apply path is equally scoped; device identity and tenant must be enforced at DB boundary; check replay/conflict transitions |
| Carbon, value, ESG, BWG | carbon_calculations, methodology_versions, obligations, epr_credits, esg_reporting_periods, esg_metrics, bwg_* | Organization ownership; source activity/evidence; methodology governance; geography | Audit JSON input/output ownership, evidence/verification references, period ownership and cross-table joins |
| Workspace/read models | resource_flows, activities, measurements, evidence, verifications, obligations, credentials, settlements, ESG metrics | Active organization set; geography; current registry ownership; bilateral settlement visibility | Verify all aggregate joins constrain every row by a valid ownership path; avoid scope widening through arrays of organization IDs |
| Public catalog/system | regulatory_sources, geography, /health, /status | Explicitly public/read-only where intended; operational health only | Confirm no private notes or unverified sources leak; geography routes should use active org scope consistently |

## Concrete structural observations

1. `withRlsRequestTransaction` exists and correctly binds a signed short-lived identity + one verified active organization claim to a transaction-local setting. It rejects absent active organization, unverified membership and bilateral context. This is a safe foundation, not a complete integration.
2. The route modules still contain route-local `pool.query` and `pool.connect` paths. Several mutation handlers manage their own BEGIN/COMMIT/ROLLBACK. Blindly wrapping them in a second transaction would be unsafe. The route must acquire one client, set tenant context on that client, and execute every protected statement on it; nested transaction behavior must not be assumed.
3. Settlement routes are intentionally not covered by the single-organization helper. A separately designed bilateral scope must bind both parties and current credential ownership and must not permit a forged party header.
4. Migration `20261101_signed_request_context_verifier.sql` provisions the `app_security` verifier foundation and a restricted SECURITY DEFINER function, but contains **zero ENABLE/FORCE ROW LEVEL SECURITY statements and zero CREATE POLICY statements**. It does not itself protect application tables.
5. Selected migrations `004_security_auth.sql`, `012_geography_authorization.sql`, `033_field_sync_tenant_integrity.sql`, `047_settlement_party_integrity.sql`, `20261102_platform_authority_bootstrap.sql`, `20261104_identity_bound_hierarchical_onboarding.sql` and `20261105_geography_scope_search_path_hardening.sql` also contain no RLS enable/force or policy statements. They establish identity, geography, triggers, function ownership and governance controls, which are not substitutes for RLS.
6. The geography helper in migration `012_geography_authorization.sql` intentionally returns true when an organization has no verified geography roots. This compatibility behavior must be explicitly reviewed for a national production policy; it must not silently become an assumption that all organizations are geographically unrestricted.
7. The production baseline previously read from the authoritative Neon branch reported 67 public tables, zero RLS and zero FORCE RLS, with no production `auth_private`/`app_security` schemas. The production DB owner has BYPASSRLS and elevated role privileges. Production cannot safely enable policies until runtime roles, owner roles, grants, policies and every route/worker access path are reconciled.

## Priority findings

- **P0 — no production tenant RLS:** verified baseline is 0/67 public tables protected by RLS. App-side checks alone are not an adequate national multi-tenant isolation boundary.
- **P0 — privileged production role posture:** current production owner/runtime identity has BYPASSRLS and elevated privileges. A policy cannot constrain a BYPASSRLS role.
- **P0 — route integration incomplete:** signed request-context helper is not yet the universal path for tenant data. Direct pool queries remain.
- **P0 — bilateral settlement model unresolved:** must have explicit two-party authorization and separate policy design.
- **P1 — route transaction refactor risk:** route-local transactions and pooled helper calls can split tenant context from protected statements.
- **P1 — geography compatibility default:** unscoped organizations currently pass geography helper checks; production needs a deliberate onboarding/coverage rule.
- **P1 — JSON/polymorphic ownership:** carbon calculations, ESG metrics, metadata, evidence and registry links require explicit authoritative owner mapping before policy generation.
- **P1 — background/async paths:** static HTTP route scan is not proof that every scheduled, worker, webhook, queue or external callback is covered. Each must be separately inventoried and bound to tenant/actor provenance.

## Required next artifacts and gates

1. Machine-readable endpoint inventory with HTTP method/path, auth mode, SQL call site, tables + operation, client/pool, transaction boundary, organization owner column, geography path, function/trigger side effects, and negative tests.
2. Complete 67-table ownership classification: single-org, bilateral, platform-global, reference/catalog, append-only evidence, derived/JSON-linked, or explicitly public.
3. Complete function/trigger/grant inventory with owner role, SECURITY DEFINER, fixed search_path, execute grants, dynamic SQL and side effects.
4. Disposable PostgreSQL test matrix using the exact proposed app/auth runtime roles: two tenants, cross-tenant SELECT/INSERT/UPDATE/DELETE, geography ancestor/descendant, membership revocation, session revocation, pool reuse, rollback and concurrency.
5. Dedicated bilateral settlement policy and tests.
6. Independent security + DBA review, backup/restore and rollback rehearsal.

## Release boundary

No production database DDL/DML, grants, role changes, secrets, RLS enablement, migration, branch deletion, merge or deployment was performed by this audit. Keep PR #192 and PR #203 draft. Production remains HOLD, certification OFF and TRL 9 not established.
## Follow-up code change — EPR mutation authorization transaction binding

During this audit, both `POST /api/v1/epr/returns/:returnId/submit` and `POST /api/v1/epr/returns/:returnId/external-reference` were found to lock and mutate the return on a checked-out client while evaluating `epr:manage` through the pool (a separate connection). The permission read could therefore run outside the row-locking transaction and observe a different snapshot.

Commit `0b06f342290d3b8fa9444db5038b4d90854c4899` changes both checks to use the same `PoolClient` as the mutation. This is a targeted transaction-consistency correction, not full tenant RLS integration. Exact-head CI run `41436296516` is in progress; keep the finding open until CI and independent review pass.
