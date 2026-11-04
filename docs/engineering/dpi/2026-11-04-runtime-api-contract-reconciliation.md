# RupayKg runtime API contract reconciliation — Wave 1

**Date:** 2026-11-04  
**Repository:** `vishaltradewinds/rupaykg`  
**Inspection baseline:** `main` at `a3fecc0abd2c46549a201058d3963afc0e3a73c9`  
**CDPI adoption audit branch:** `shakti/cdpi-source-licence-audit-2026-11-04`  
**Status:** Static source reconciliation and contract backlog; NOT an OpenAPI release contract, penetration test, independent assurance or production approval.

## 1. Decision

Do not publish a guessed OpenAPI document. Mainline has route declarations and handwritten validation, but no general runtime schema/serializer contract from which a complete, trustworthy partner specification can currently be generated. The first deliverable is a route-to-validator-to-response-to-authorisation matrix. Generate OpenAPI only from reviewed runtime schemas or an equivalently tested source of truth.

This audit does not change route code, migrations, database roles, RLS, runtime configuration, deployments or production data. It does not modify the isolated EPR/MRV/pilot branches.

## 2. Mainline source snapshots inspected

| File | Blob SHA | Contract responsibility |
|---|---|---|
| `apps/src/server.ts` | `ecdd9c49b27f1aef02c07e3f7a79f872d07a7f06` | Core routes, route registration, operational APIs |
| `apps/src/auth.ts` | `49a16d3c0ac7399c8a677b6530f0c6ab72e9b8c3` | Session authentication, membership, active organisation, permission helper |
| `apps/src/value-routes.ts` | `7e02adc1d4f1cf170c09bd7010b54637934f4a6f` | Carbon, EPR, ESG, BWG |
| `apps/src/evidence-vault-routes.ts` | `797f9ff77e8442d3752c20bc1698b400777c8ea3` | Evidence upload/list/download/review |
| `apps/src/workspace-routes.ts` | `17de4663018f6b9293d5663a9f99cf116a40c8ab` | Workspace read pre-handler and workspace data |
| `apps/src/onboarding-hierarchy-routes.ts` | `2a92730980d5b229ab0fd882f930762b61599da6` | Stakeholder review and legal verification |
| `apps/src/sync-routes.ts` | `457e8a53a3efa0b6e045a0b4e737212a36b0b63f` | Device enrollment and offline sync |
| `apps/src/registry-routes.ts` | `a2d82ee7d9ae94adc8dfbbdc0e3a751f0d0a3f03` | Credentials and settlement |
| `docs/API.md` | `91262df2f606c3f2fb772dbad300024072d58878` | High-level API principles |

These are pinned snapshots, not assurances about future branch heads. Re-fetch the current source before coding against any path.

## 3. Contract source-of-truth findings

### 3.1 No complete machine-readable API contract yet

- `docs/API.md` states useful principles but is not an endpoint specification.
- No general OpenAPI/Swagger document was found in the inspected mainline tree.
- No general runtime JSON Schema contract set was found; the Wave 1 field-sync envelope is explicitly labelled draft target and not attached to Fastify runtime validation.
- Request validation is implemented through per-handler handwritten field checks and helper functions.
- Response shapes are handwritten in handlers and vary by route; generic success/error schemas cannot safely be inferred from route declarations alone.

**Action:** introduce schemas in a route-by-route sequence, bind them to Fastify request/response validation where compatible, and generate OpenAPI from those exact schemas. Do not claim a route is documented merely because its path appears in an OpenAPI file.

### 3.2 Authentication and tenant context

The shared `authenticate` helper:
- hashes opaque bearer tokens and checks session expiry/revocation and verified/non-suspended identity;
- reads verified memberships;
- accepts `x-rupaykg-organization-id` only when it matches a verified membership;
- rejects multi-organisation identities that omit an explicit active organisation;
- derives active organisation and bilateral settlement route context.

This is an application-level context helper, not a signed tenant-context token and not PostgreSQL-enforced tenant isolation. Its membership snapshot is read separately from many later data operations. API contracts must document the active-organisation header as a selector only, never as proof of authority. The server must resolve authority from the authenticated identity and authoritative database state.

### 3.3 Error contract is not uniform

The current principles identify authentication, authorization, validation, conflict, dependency and internal failures, but handlers return differing envelopes and some omit stable codes. Before external publication, standardise a versioned Problem Details-style envelope with:
- stable machine-readable `code`;
- appropriate HTTP status;
- non-sensitive human-readable `detail`;
- correlation/request ID;
- field-level validation errors only where safe;
- no foreign-tenant existence disclosure or internal SQL/provider detail.

Do not replace dependency failures with 401/400, and do not expose exception messages or PII in production responses.

## 4. High-priority route contract reconciliation

| Route | Source-observed request/response behaviour | Contract blocker / next proof |
|---|---|---|
| `GET /api/v1/workspaces/bwg` | No request body; returns source/syntheticData and BWG profiles, periods, waste/EPR/ESG reports, jurisdictions, schemes and capability metadata. | Mainline fetches data before permission metadata; draft PR #231 adds explicit `reports:read` gate before reads and two runtime tests. Keep blocked until PR #231 independent review and merge. |
| `GET /api/v1/workspaces/esg` | No request body; returns ESG reporting-period and metric data. | Shared workspace preHandler maps ESG to reports:read/epr:read/csr:read/audit:read and runs before handler. Preserve and test the hook; do not add a conflicting duplicate check. |
| `POST /api/v1/evidence-vault/upload` | JSON body includes activityId, evidenceType, fileName, mediaType, contentBase64 and optional series/source/measurement-period fields; body limit is 7 MiB. | Authentication/permission/activity context is obtained before the upload transaction in the inspected source. Revalidate activity, geography, membership and permission inside the same transaction before insert. Define encoded-size vs decoded-size bounds, media allowlist, hash and idempotency. |
| `GET /api/v1/evidence-vault` | Query-driven evidence/artifact listing; response includes series/version and evidence metadata. | Bind authorisation and list query to one tenant-scoped client; define pagination, sorting, filters and no cross-tenant existence leakage. |
| `GET /api/v1/evidence-vault/:evidenceId` | Path ID selects artifact/evidence content. | Consolidate existence and authorisation query; do not reveal foreign record existence; define content disposition, media type, range/size and audit semantics. |
| `POST /api/v1/evidence-vault/:evidenceId/review` | Body has decision APPROVED/REJECTED and rationale (5–2000 characters). | Keep reviewer independence, evidence/activity tenant scope, permission, membership and write/audit on one transaction-scoped client; add negative cross-tenant/self-review tests. |
| `GET /api/v1/onboarding/review-queue` | No request body; currently queries pending applications and applicant/org details, then filters response by eligible authority. | Restrict query at source to the actor's eligible approval scope; avoid loading unnecessary applicant PII; bind eligibility and data projection to one request-scoped transaction/client; test local/district/state/platform scope. |
| `POST /api/v1/onboarding/applications/:applicationId/verify-legal` | Body has verificationStatus VERIFIED/REJECTED and verificationNote; requires platform authority and persisted legal evidence reference/hash for VERIFIED. | Authority check occurs before transaction; revalidate platform authority inside the transaction and bind evidence/org status changes to one client. Define immutable reviewer/audit provenance. |
| `POST /api/v1/onboarding/applications/:applicationId/:action` | Action path is approve/reject; reject requires reviewNote. | Revalidate identity status/authority in the transaction; test approval-chain ordering, duplicate/replay, conflict of interest and concurrent decisions. |
| `POST /api/v1/credentials` | Body includes activityId, trustRootId, verificationId, issuerOrganizationId, positive quantity and unit. | Issuer permission is checked before transaction; revalidate issuer authority and exact active tenant inside transaction. Credential issuance remains non-public pending P0 verification authorization and independent review. |
| `POST /api/v1/credentials/:credentialId/transfer` | Body includes toOwnerId. | Require bilateral sender and receiver acceptance/authority, replay protection and immutable event history; keep internal. |
| `POST /api/v1/settlements` and lifecycle | Financial amount/currency and payer/payee lifecycle. | No partner API or payment integration until regulated/authorised provider, reconciliation, idempotency, dispute/refund and separation-of-duties controls are independently approved. |
| `POST /api/v1/field-sync/envelopes` and apply | Uses device identity, envelope, sequence/idempotency and operation payload. | Existing draft schema is not runtime-enforced. Prove device-to-identity-to-organisation binding on every intake/apply path, payload hash replay semantics and two-tenant/two-device isolation. |

This is a static route-level review. The table is a backlog, not a declaration that a route is secure or ready for partner access.

## 5. Confirmed route-level correction already in flight

PR #231 (`fix(authz): enforce BWG workspace read permission`) changes `apps/src/value-routes.ts` to require explicit `reports:read` before BWG workspace queries and adds two disposable-PostgreSQL tests:
- verified member without `reports:read` receives 403 and `BWG_WORKSPACE_READ_FORBIDDEN`;
- separately permissioned reader receives 200 and expected data arrays.

The PR description records exact-head CI run #41614078404 passing migration checks, dependency audit, typecheck, build, browser smoke, disposable PostgreSQL acceptance and production-container build. The PR remains open/draft in the inspected state and has not been treated as merged. This is a narrow permission correction, not tenant-isolation certification.

## 6. P0 dependencies — no API release until closed

### Issue #214 — migration source/ledger parity

The open P0 issue records production ledger migration `096_verification_authorization_provenance.sql` with no corresponding current mainline source file, plus staging-only migration records whose exact source is not in the current migration tree. Preserve recovered SQL as immutable evidence; reconcile checksums, schema objects and deployment provenance; do not replay or edit production ledger entries. Production remains read-only.

### Issue #215 — verification authorization

The open P0 issue records a legacy verification trigger with global membership/role-name fallback and a fail-open geography-scope function. The forward-only correction must require verified, non-suspended identity and exact subject-organisation membership for every decision, explicit permission keys only, fail-closed geography scope for approval, immutable authorization snapshot, dedicated NOLOGIN/NOBYPASSRLS function owner and disposable-PostgreSQL adversarial tests.

Neither issue is resolved by OpenAPI, a draft PR, static inspection or a passing CI run.

## 7. Contract-first implementation order

1. **P0 route security first:** #214 and #215; preserve production read-only.
2. **BWG workspace:** independent review and merge decision for PR #231; add exact-head revalidation before any merge.
3. **Evidence Vault:** same-client tenant-bound authorisation for upload/list/download/review; adversarial tests.
4. **Onboarding:** query-level authority filtering, PII minimisation and same-transaction authority revalidation.
5. **Workspace read contracts:** verify shared preHandler for every workspace and all joined data scopes.
6. **Core operational APIs:** resource flows, measurements and offline sync with signed/verified tenant/device binding and idempotency.
7. **Credentials and settlements:** remain internal; define issuer/holder/bilateral state machines and external authority proof.
8. **OpenAPI generation:** generate from the approved runtime schemas; add compatibility checks, examples and independent partner-client tests.

## 8. Mandatory partner contract fields

Every partner-facing operation must specify:
- operationId, method, path, API version and compatibility/deprecation policy;
- principal type and authentication audience;
- active organisation selection and server-derived tenant authority;
- required permission key and geography/resource scope;
- request schema, response schema and field-level validation;
- idempotency/replay and concurrency semantics for mutations;
- stable error codes/statuses and retryability;
- timestamp format/time zone and measurement units;
- data classification, lawful purpose, retention and onward-sharing constraints;
- audit event/correlation identifier;
- source authority, provenance, freshness and correction/dispute behaviour;
- pagination, rate limits, timeouts and export/portability rules.

## 9. Acceptance tests before contract publication

- OpenAPI path/operation coverage equals registered route inventory (no undocumented or phantom operations).
- Every schema is attached to the runtime validator/serializer or generated from that exact source.
- Request and response examples validate in CI.
- Unknown fields, malformed IDs, invalid enums, boundary lengths and numeric units are tested.
- Authentication, permission, active tenant, geography and resource ownership are negative-tested.
- Same resource ID substituted across two tenants is denied without existence leakage.
- Connection-pool reuse cannot leak tenant context.
- Idempotent replay returns the same persisted result; same key/different payload conflicts.
- Audit and evidence provenance are verified from persisted rows.
- Independent client consumes the contract without database access.

## 10. Release boundary

**API publication: HOLD. Partner API access: NOT AUTHORISED. Production DB: READ-ONLY.**  
No production DDL/DML, migration, role/grant change, global RLS activation, deployment, credential issuance, payment integration or certification is authorised by this audit.

**DPI qualification: NOT ESTABLISHED. TRL 9: NOT ESTABLISHED.**
