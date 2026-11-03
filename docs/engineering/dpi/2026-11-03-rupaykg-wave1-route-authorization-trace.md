# RupayKg Wave 1 — route-to-actor and authorization trace (static mainline audit)

**Date:** 2026-11-03  
**Mainline inspection baseline:** a3fecc0abd2c46549a201058d3963afc0e3a73c9  
**Status:** Engineering discovery / NOT an approved security assessment or API release contract.  
**Method:** Static inspection of route declarations and route-handler source in mainline. Signals below indicate patterns found in the handler text; they are not proof that the pattern is correctly implemented, called on every branch, or enforced by PostgreSQL. No production calls or database writes were made.

## 1. Executive findings

1. Mainline has a broad API surface spanning operations, geography, evidence, MRV, credentials, settlement, compliance, offline sync and onboarding.
2. Authentication is implemented inconsistently: some handlers call the shared authentication helper, some use module-local wrappers, and some route handlers delegate to helper functions. A static string match is not sufficient to prove route protection.
3. Organisation context is not uniformly derived from a single verified signed tenant context. Some handlers use the active organisation; some accept an organisation identifier in request data or headers; others derive access from membership/geography or record ownership.
4. Multiple handlers perform auth/permission reads and protected reads/writes through separate pool queries or separately acquired clients. A route-level transaction in one operation does not automatically make the earlier authentication/permission decision atomic with the protected mutation.
5. Offline sync has stronger explicit idempotency/replay handling and transaction use than several synchronous routes, but device-to-organisation binding and every downstream operation still need adversarial two-tenant tests.
6. Some read endpoints are permission-gated and others use scoped queries; the precise permission key and active-organisation behaviour must be tested route by route.
7. The current inventory is not sufficient to generate a trustworthy OpenAPI security section. Route auth, request/response schema and error semantics must be traced to runtime validators and serializers before publication.

## 2. Signal legend

- **AUTH** — handler text calls authenticate or a module auth wrapper.
- **MEM** — verified membership or organisation membership lookup is visible.
- **PERM** — permission helper or explicit permission/role check is visible.
- **ACTIVE** — active organisation or explicit organisation header context is visible.
- **GEO** — geography scope check or geography ownership/scope field is visible.
- **TX** — explicit transaction commands or a transaction-scoped client is visible.
- **WRITE** — insert/update/delete statement is visible.
- **AUDIT** — audit table/event reference is visible.
- **IDEMP** — idempotency/replay logic is visible.
- **EXT** — external authority/provider reference is visible.

A missing signal means the simple static scan did not find the pattern; it is a review flag, not proof that no protection exists. A present signal is not proof of correctness.

## 3. Route-by-route trace

| Method and path | Module | Static signals | First review requirement |
|---|---|---|---|
| GET /health | server.ts | DB readiness | Public liveness/readiness response must not leak secrets or topology |
| GET /api/v1/status | server.ts | None | Explicitly classify as public metadata; constrain fields |
| GET /api/v1/overview | server.ts | AUTH, PERM, GEO, DB reads | Verify active-organisation default, multi-org aggregation and every count's scope |
| GET /api/v1/regulatory/sources | server.ts | DB read | Confirm public/reference-data policy and source freshness |
| GET /api/v1/geography/roots | server.ts | AUTH, MEM, GEO | Ensure fallback and recursive branches have equivalent scope |
| GET /api/v1/geography/children/:parentId | server.ts | AUTH, MEM, GEO | Parent scope and child rows must be constrained in the same query/transaction |
| POST /api/v1/operations/sync | server.ts | AUTH header, delegated intake, IDEMP | Confirm header org is bound to verified device and same authorised tenant |
| POST /api/v1/resource-flows | server.ts | AUTH, MEM, PERM, GEO, WRITE | Body organisationId must be bound to verified membership and tenant context atomically |
| POST /api/v1/activities/:activityId/measurements | server.ts | AUTH, MEM, PERM, GEO, WRITE | Activity ownership/scope and measurement insert must share tenant-bound client |
| POST /api/v1/credentials | registry-routes.ts | MEM, PERM, WRITE, EXT | Prove issuer authority, evidence prerequisites, transaction and credential state machine |
| POST /api/v1/credentials/:credentialId/activate | registry-routes.ts | MEM, PERM, WRITE | Prove issuer/owner authority and state transition under row lock |
| POST /api/v1/credentials/:credentialId/transfer | registry-routes.ts | MEM, PERM, WRITE | Bilateral sender/receiver policy, acceptance, replay and ownership visibility |
| POST /api/v1/credentials/:credentialId/retire | registry-routes.ts | MEM, PERM, WRITE | Prove authorised retirement and immutable lifecycle history |
| POST /api/v1/settlements | registry-routes.ts | MEM, PERM, WRITE | Keep private until financial authority, reconciliation and regulatory boundary review |
| POST /api/v1/settlements/:settlementId/authorize | registry-routes.ts | MEM, PERM, WRITE | Separation of duties, payer/payee rights, amount/currency and idempotency |
| POST /api/v1/settlements/:settlementId/settle | registry-routes.ts | MEM, PERM, WRITE | External payment proof/reconciliation; no false settled state |
| POST /api/v1/settlements/:settlementId/confirm | registry-routes.ts | MEM, PERM, WRITE | Confirm only against authoritative settlement evidence |
| POST /api/v1/evidence-vault/upload | evidence-vault-routes.ts | AUTH (authFor), MEM snapshot, PERM, GEO, TX, WRITE | Auth and permission checks exist, but activityContext and permission are evaluated via pool before the write transaction; revalidate activity owner/geography/permission on the same transaction client before insert |
| GET /api/v1/evidence-vault | evidence-vault-routes.ts | AUTH (authFor), MEM snapshot, PERM, GEO | Actor and activity scope are checked, but checks and list query use separate pool operations; bind all checks and listing to one tenant-scoped client/transaction |
| GET /api/v1/evidence-vault/:evidenceId | evidence-vault-routes.ts | AUTH (authFor), MEM snapshot, PERM, GEO | Existence query precedes tenant and geography checks on separate pool queries; consolidate lookup and authorisation to avoid timing/existence leaks and TOCTOU |
| POST /api/v1/evidence-vault/:evidenceId/review | evidence-vault-routes.ts | AUTH (authFor), MEM snapshot, PERM, GEO, TX, WRITE | Stronger path: locks evidence and performs permission/geography/self-review checks and writes on one transaction client; membership snapshot still originates before transaction and needs signed tenant-context binding |
| GET /api/v1/mrv/status | mrv-routes.ts | PERM, ACTIVE, EXT | Restrict provider diagnostics; ensure active org and permission semantics |
| POST /api/v1/mrv/activities/:activityId/submit | mrv-routes.ts | MEM, PERM, WRITE, EXT, IDEMP | Same-client source/evidence snapshot, external submission and persisted outcome |
| GET /api/v1/mrv/provenance/:activityId | mrv-routes.ts | MEM, PERM, EXT | Prove activity visibility and external provenance separation |
| GET /api/v1/mrv/hedera/verify/:consensusTimestamp | mrv-routes.ts | MEM, PERM, EXT, WRITE | Read-only verification must not mutate local trust state without an explicit audited action |
| GET /api/v1/workspaces/resource-flows | workspace-routes.ts | GEO | Verify AUTH and waste:read path, active org and every joined resource |
| GET /api/v1/workspaces/mrv | workspace-routes.ts | GEO | Verify AUTH and evidence/MRV read scopes and each aggregate join |
| POST /api/v1/evidence/:evidenceId/verification | workspace-routes.ts | AUTH, PERM, ACTIVE, TX, WRITE | Reviewer authority, evidence ownership, same-client transaction and immutable audit |
| GET /api/v1/workspaces/compliance | workspace-routes.ts | GEO | Verify compliance permission and statutory/jurisdiction filtering |
| GET /api/v1/workspaces/carbon | workspace-routes.ts | GEO | Verify MRV read permission, methodology version and activity scope |
| GET /api/v1/workspaces/registry | workspace-routes.ts | GEO | Verify registry read permission and issuer/holder visibility |
| GET /api/v1/workspaces/settlement | workspace-routes.ts | GEO | Verify settlement read permission and bilateral visibility |
| GET /api/v1/workspaces/esg | workspace-routes.ts | AUTH, ACTIVE, verified membership-derived orgIds, PERM via route preHandler | Shared workspace preHandler maps esg to WORKSPACE_READ_PERMISSIONS.esg = reports:read/epr:read/csr:read/audit:read and denies before handler. Preserve and test hook; no duplicate gate needed |
| GET /api/v1/epr/obligations | bwg-routes.ts | PERM, ACTIVE | Verify authenticated actor, active organisation and jurisdiction/source filtering |
| GET /api/v1/cpcb-swm/workspaces | cpcb-swm-routes.ts | MEM, PERM, ACTIVE, GEO, AUDIT | Confirm read query and audit data share identical tenant scope |
| POST /api/v1/cpcb-swm/workspaces | cpcb-swm-routes.ts | MEM, PERM, ACTIVE, GEO, TX, WRITE, AUDIT | Confirm tenant context, validation, audit and insert are one client transaction |
| PATCH /api/v1/cpcb-swm/workspaces/:workspaceId | cpcb-swm-routes.ts | MEM, PERM, ACTIVE, GEO, TX, WRITE, AUDIT | Lock row, prevent tenant reassignment and atomically write history |
| POST /api/v1/carbon/calculations | value-routes.ts | PERM, GEO, WRITE | Trace AUTH, tenant ownership, deterministic methodology and numeric precision |
| POST /api/v1/epr/obligations/:obligationId/assess | value-routes.ts | MEM, PERM, GEO, WRITE | Verify source obligation, jurisdiction, actor and assessment transaction |
| POST /api/v1/esg/reporting-periods/:periodId/metrics | value-routes.ts | MEM, PERM, GEO, WRITE | Verify period ownership, metric schema/unit and duplicate semantics |
| GET /api/v1/workspaces/bwg | value-routes.ts | AUTH (authFor), ACTIVE, verified membership-derived orgIds, PERM metadata | Data queries execute for authenticated organisation members before permission booleans are returned; enforce a read permission before returning profiles/reports, then test tenant isolation |
| POST /api/v1/bwg/profile | value-routes.ts | MEM, PERM, GEO, WRITE | Verify organisation profile owner and unique identity constraints |
| POST /api/v1/bwg/reporting-periods | value-routes.ts | MEM, PERM, WRITE | Verify profile/organisation linkage and period uniqueness |
| POST /api/v1/bwg/reporting-periods/:periodId/waste | value-routes.ts | MEM, PERM, WRITE | Verify reporting period owner and source evidence |
| POST /api/v1/bwg/reporting-periods/:periodId/epr | value-routes.ts | MEM, PERM, WRITE | Verify obligation linkage, statutory scheme and source provenance |
| POST /api/v1/bwg/reporting-periods/:periodId/esg | value-routes.ts | MEM, PERM, WRITE | Verify reporting period owner, metric schema and unit |
| POST /api/v1/field-devices/enroll | sync-routes.ts | AUTH, MEM, PERM, TX, WRITE, AUDIT | Device owner, enrollment authority, key lifecycle and revocation |
| POST /api/v1/field-devices/:deviceId/verify | sync-routes.ts | AUTH, PERM, TX, WRITE, AUDIT | Independent verifier, device owner and key attestation |
| GET /api/v1/field-devices | sync-routes.ts | AUTH, MEM | Prove device list tenant scope and role-based visibility |
| POST /api/v1/field-sync/envelopes | sync-routes.ts | AUTH, TX, WRITE, IDEMP | Bind device to identity + organisation; sequence collision and payload hash |
| POST /api/v1/field-sync/envelopes/:envelopeId/apply | sync-routes.ts | AUTH, TX, WRITE | Apply only under same authenticated identity and authorised organisation context |
| GET /api/v1/field-sync/conflicts | sync-routes.ts | AUTH | Current query is identity-scoped; verify organisation-level delegation requirements |
| POST /api/v1/field-sync/conflicts/:conflictId/resolve | sync-routes.ts | AUTH, WRITE | Identity ownership check exists; add/verify reviewer role and organisation scope |
| GET /api/v1/onboarding/review-queue | onboarding-hierarchy-routes.ts | GEO, role eligibility | Verify auth wrapper errors, authority levels, geography and data minimisation |
| POST /api/v1/onboarding/applications/:applicationId/verify-legal | onboarding-hierarchy-routes.ts | TX, WRITE, platform role | Verify identity authentication and platform authority on same transaction; evidence sufficiency |
| POST /api/v1/onboarding/applications/:applicationId/:action | onboarding-hierarchy-routes.ts | MEM, GEO, TX, WRITE | Verify authenticated reviewer, ordered approvals, conflict-of-interest and membership activation |

## 4. Highest-priority route findings

### P0 — resolve before publishing partner APIs

- **ESG workspace:** manual review of the shared workspace preHandler confirms authentication and authorizeWorkspaceRead run before the handler; ESG is mapped to reports:read, epr:read, csr:read or audit:read. The initial route-local scan missed this shared hook. Add route-level tests proving the hook is not bypassed and results remain tenant-scoped.
- **Evidence upload/list:** permission signal exists but direct AUTH was not detected in the handler; trace module wrapper, activity ownership, reviewer and same-client behaviour.
- **EPR obligations and BWG workspace:** active organisation and permission signals exist; verify actor authentication, scope derivation and statutory jurisdiction filters.
- **Resource flow and measurement writes:** organisation/permission/geography checks appear, but separate pool/client calls can create TOCTOU risk. Move to one signed tenant-context client transaction before RLS enforcement.
- **Onboarding review queue:** handler obtains authenticated context via a module wrapper, but queries pending applications before filtering which rows the actor can review. Ensure no data is returned for unauthorised applications and limit applicant PII to minimum necessary.
- **Field sync apply:** checks envelope identity and state under transaction, but organisation/device authority must be proven for every operation applied from its payload.
- **Overview:** aggregates several domains and permission classes; test no cross-organisation counts and no widening when a user has multiple memberships.

### P1 — high-impact lifecycle / external boundaries

- Credential transfer must model both issuer/holder parties and avoid single-tenant assumptions.
- Settlement endpoints remain internal until payment rail/partner authority, regulated scope, reconciliation and independent security review are approved.
- Guardian/Hedera/Mirror Node statuses must remain distinct; provider response alone is not local proof of a valid, persisted MRV state.
- CPCB workspace changes require immutable audit/history and organisation scope in the same transaction.
- Offline sync conflict resolution needs clear distinction between device owner, organisation reviewer and platform operator.

## 5. Route-to-actor model to standardise

Every route contract must declare:
- **Principal:** human identity, organisation client, field device, platform service or external verifier.
- **Actor organisation:** derived from verified membership and signed tenant context; never trusted from request body alone.
- **Delegation:** grantor, delegate, scope, resource, purpose, issued/expiry time, revocation and proof.
- **Permission:** stable permission key and action; no UI role name substituted for a permission.
- **Geography:** jurisdiction/resource scope and authoritative source version.
- **Resource owner:** tenant/organisation and, where bilateral, both counterparties.
- **Transaction boundary:** one tenant-bound database client for context, permission, resource read, mutation and audit.
- **Idempotency:** key, payload hash, replay response, collision behaviour and expiry/retention.
- **Audit:** actor, organisation, purpose, target, decision, timestamp, correlation id and before/after reference.
- **Response policy:** no cross-tenant existence disclosure; stable Problem error envelope.

## 6. Required next technical actions

1. Inspect route handlers and auth wrappers for all P0 findings, especially ESG workspace, evidence list/upload and onboarding queue.
2. Build disposable PostgreSQL two-tenant tests that create same-shaped data in tenants A and B, then assert every read, write, list, aggregate, export, retry and sync path is isolated.
3. Bind auth, permission, active tenant and protected SQL to one transaction-scoped client, with PostgreSQL role unable to bypass RLS.
4. Test cross-tenant ID substitution for every resource path and parent/child mismatch.
5. Add contract schemas only after actual route validators and response serializers are traced.
6. Add an independent partner-client test suite using API contracts only, with no database credentials.
7. Keep settlements and credential exchange disabled for external partners until separate assurance sign-off.

## 7. Explicit non-claims

- This is not a completed penetration test.
- Static signals do not prove authentication, authorisation, RLS, transaction isolation or audit completeness.
- No route is declared production-safe by this inventory.
- This does not authorise global RLS enablement, production migration, external partner access, payment integration, VC issuance, or DPI qualification.


## 8. Existing mainline test coverage discovered

Static test-file inventory (test titles and file presence only; this audit did not execute tests):

| Test file | Existing coverage indicated by test names | Gap against Wave 1 |
|---|---|---|
| apps/test/auth-permissions.test.ts | Canonical high-risk permissions, authoritative PostgreSQL role query, active organisation match, fail-closed role query, explicit evidence permission | Does not prove all 56 routes use the same signed tenant context and same-client transaction |
| apps/src/evidence-vault-routes.test.ts | Filename/path traversal, malformed/empty/oversized base64, media signature validation | Unit validation only; no route-level two-tenant proof |
| apps/src/evidence-vault.integration.test.ts | Tenant scope, versioned storage, integrity, independent review (environment-gated) | Must confirm test actually runs in CI against disposable PostgreSQL; add list/download/review cross-tenant negative cases |
| apps/src/guardian-mrv.test.ts | Provider disabled state and authoritative execution ID requirements | Does not prove cross-tenant MRV submission/read isolation |
| apps/src/mrv-integration.test.ts | Fail-closed provider config and deterministic integrity hash | No full tenant-context acceptance |
| apps/src/operation-sync-security.test.ts | Device cannot be unverified or another identity's device | Add organisation transfer/revocation, cross-tenant replay and payload parent-child substitution |
| apps/src/registry-routes.test.ts | Governed credential and settlement state transitions | State-machine unit coverage is not authorisation or persistence isolation |
| apps/src/registry-settlement-runtime.test.ts | Permission before issuance, persisted Mirror Node proof, evidence/verification gate, settlement lifecycle, transfer/retirement permission | Add bilateral cross-tenant visibility, same-client atomicity and replay tests |
| apps/src/sync-validation.test.ts | Envelope validation, device ID and conflict-resolution field validation | Add full route integration with two organisations and device ownership changes |
| apps/src/workspace-context.test.ts | Urban/rural geography rails and SQL parameter placement | Does not prove all workspace route permissions and row-level scope |
| apps/src/epr-registration-input.test.ts | Avoids asserting externally registered CPCB status without proof | Does not prove EPR route tenant scope, source authority or assessment transaction |

### 8.1 Coverage disposition

- **Existing useful tests:** auth permission policy, evidence validation, evidence integration, MRV fail-closed behaviour, operation-sync device identity, credential/settlement lifecycle, geography context and EPR registration truthfulness.
- **Not evidenced by the inspected test titles:** exhaustive route auth matrix, cross-tenant read/write denial for every route, route-level same-client transaction proof, tenant A/B aggregate isolation, organisation switch/revocation races, cross-tenant parent-child ID substitution, all-route error envelope conformance, and external partner contract conformance.
- **CI caution:** a test file existing in mainline does not prove it runs in the required CI job, is not skipped, uses disposable PostgreSQL, or covers the exact PR head. Inspect workflow commands and test skip conditions before marking a gate passed.

### 8.2 Required two-tenant acceptance suite

Use disposable PostgreSQL with two tenants (A and B), distinct identities and at least one delegated user. Seed same-shaped activity, evidence, obligation, credential, reporting-period, device, geography and workspace records in each tenant. For every route family, run:

1. tenant A identity reads A record: allowed only with correct permission;
2. tenant A identity reads B record by direct UUID: generic not-found/forbidden without data leakage;
3. tenant A identity lists/aggregates while B has records: no B counts or rows;
4. tenant A identity mutates B record by UUID: denied and no database side effect;
5. tenant A identity supplies B parent ID with A child payload: denied;
6. revoked membership or changed active organisation during request: mutation denied;
7. same idempotency key/same payload: deterministic replay;
8. same idempotency key/different payload: conflict with no second mutation;
9. device enrolled to A replays or submits to B: denied;
10. bilateral credential/settlement operation: only explicitly authorised party views each state;
11. evidence reviewer cannot approve own submission where separation is required;
12. audit row is committed atomically with the protected mutation and records the effective actor, tenant and target.

The suite must assert persisted row counts and audit records after each denial; an HTTP status alone is insufficient.

## 9. Review sequencing

1. Close P0 handler tracing (ESG, evidence, EPR/BWG, onboarding, sync apply and overview).
2. Add missing route-level auth/tenant assertions and two-tenant database acceptance.
3. Establish one signed tenant-context transaction API and migrate route families in dependency order.
4. Only after route code is stable, publish OpenAPI and JSON Schemas from real validators/serializers.
5. Run independent partner-client conformance tests and security review.
6. Keep global RLS disabled until the production owner/role/BYPASSRLS posture and every tenant table policy have been remediated and accepted in a separate controlled change.


## 10. Precision correction after manual handler review

The first-pass signal table used a deliberately simple text-pattern scan. Manual inspection of the P0 handlers corrected several false negatives:
- The ESG workspace route is protected by the shared workspace preHandler: it calls requireAuth, maps the route to WORKSPACE_READ_PERMISSIONS.esg, and invokes authorizeWorkspaceRead before the handler. The configured ESG read permissions are reports:read, epr:read, csr:read and audit:read. The earlier claim that no read-permission gate existed was incorrect; the route-local scan missed the shared hook. Preserve and test this hook.
- The BWG workspace also authenticates and uses the active verified organisation, but appears to return reporting data before the permission booleans are calculated for the UI. Permission metadata is not a substitute for denying unauthorised reads.
- Evidence Vault handlers all call authFor. Upload/list/download do perform activity, geography and permission checks, but those checks are split across pool queries and the protected read/write. Upload's database transaction does not revalidate activity ownership/geography/permission on the same client before writing. Review is stronger: it locks the evidence row and performs geography, permission, independent-review and state checks plus writes inside one transaction client, while the authenticated membership snapshot is still established earlier.
- EPR obligations does authenticate, verify organisation membership and check EPR read permission. Remaining review is statutory jurisdiction/source correctness and same-client tenant-context binding.

This correction supersedes the earlier simplistic wording in Sections 3 and 4. It illustrates why static pattern matching is only triage; manual control-flow review is required before security conclusions.
