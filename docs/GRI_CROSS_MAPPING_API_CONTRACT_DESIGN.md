# GRI Cross-Mapping API Contract — Design Only

**Status:** DESIGN_ONLY — not implemented or production-approved  
**Scope:** Authenticated, organization-scoped GRI cross-mapping workflow  
**Related work:** PR #121 (schema/evaluator/source-binding helper), PR #119 (research-only India regulatory source register), PR #108 (migration-ledger reconciliation), PR #120 (concurrent ESG/EPR work)

This contract defines the next integration boundary without changing shared ESG/EPR routes, package root exports, migration history, or database schema. It is a design artifact, not evidence that routes exist.

## Non-negotiable boundaries

1. The authenticated server principal determines the organization and actor. Never trust `organizationId`, `workspaceId`, reviewer identity, role, or approval state from the request body.
2. Every mapping, reporting period, evidence reference and audit event must be scoped to the authorized organization. Cross-organization identifiers return a non-enumerating `404` response.
3. GRI mapping status cannot set or imply Indian statutory compliance, BRSR/EPR return acceptance, CPCB acceptance, CCTS compliance, independent assurance or carbon-credit eligibility.
4. Only `BLOCKED` and `READY_FOR_HUMAN_REVIEW` are evaluator decisions. Human approval is a separate authorized action and does not certify statutory compliance.
5. Source provenance must be resolved server-side from the trusted, version-pinned source register. Client-submitted validation status and hash are never authoritative.
6. Do not fetch arbitrary client-supplied URLs from privileged server infrastructure. Source archives are retrieved through a governed registry/archive adapter with redirect and destination policy.
7. Fail closed on unknown schema versions, missing evidence, invalid source binding, stale versions, missing actor permissions or audit-write failure.
8. No migration is permitted until PR #108 migration-ledger reconciliation and PR #120 integration coordination are complete.

## Proposed API surface

### Create draft mapping

`POST /api/v1/esg/gri-mappings`

Required request fields: `reportingPeriodId`, `sourceId`, `sourceVersion`, `targetStandardId`, `targetDisclosureId`, `relationship`, `rationale`, `applicability`, `evidenceReferences`, and schema version.

Server steps:
1. Authenticate actor and resolve organization/workspace from trusted session/claims.
2. Verify organization-scoped access to the reporting period and every evidence reference.
3. Resolve source ID/version from the server-controlled registry; require approved archive/hash and applicability metadata.
4. Validate full request against the pinned schema version.
5. Bind canonical source URL/version/archive hash to the trusted record using `validateGriSourceBinding`.
6. Evaluate review blockers; persist as a versioned draft only if policy allows. If blockers exist, return blockers and do not represent the record as review-ready.
7. Write an append-only audit event in the same transaction as the mapping write.

### Read mapping

`GET /api/v1/esg/gri-mappings/:mappingId`

Return only if the authenticated organization is authorized for the mapping. Include immutable version, source-register version, reporting-period snapshot, evidence references, decision, blockers and audit metadata. Never return another organization's existence.

### List mappings for a reporting period

`GET /api/v1/esg/reporting-periods/:periodId/gri-mappings`

Require organization-scoped access to the period. Paginate deterministically and filter only by validated fields. Do not expose cross-tenant counts or IDs.

### Request human review

`POST /api/v1/esg/gri-mappings/:mappingId/review-requests`

Require reviewer/requester permissions and an optimistic concurrency token. Reject if evaluator decision is not `READY_FOR_HUMAN_REVIEW`, source binding is stale, evidence has changed, or the record version is not current. Requesting review is not approval.

### Record human review decision

`POST /api/v1/esg/gri-mappings/:mappingId/reviews`

Require a separately authorized reviewer, reason, decision, current mapping version and idempotency key. Enforce separation of duties where organizational policy requires it. Append a new review event; never overwrite historical decisions. An approval changes only GRI workflow state, not any statutory or credit state.

### Read audit trail

`GET /api/v1/esg/gri-mappings/:mappingId/audit-events`

Require authorized access and return append-only events in stable order. Events record actor, organization, action, timestamp, mapping version, source-register version, evidence digests, outcome and correlation ID. Never include secrets or unrestricted personal data.

## Error contract

- `400`: malformed payload or unsupported enum.
- `401`: unauthenticated.
- `403`: authenticated but missing required role/action permission.
- `404`: mapping/period/evidence not found **or not visible to this organization**.
- `409`: stale version, idempotency conflict, source version changed, or review precondition failed.
- `422`: schema/evidence/source-binding validation blockers.
- `503`: trusted registry unavailable or audit persistence unavailable; fail closed.

Responses must not reveal whether a foreign organization's record exists. Return stable machine-readable error codes, correlation ID, and safe remediation guidance.

## Persistence invariants — for a later migration proposal

- Tenant/organization key is mandatory on each mapping and all query paths.
- Mapping versions are immutable; updates create a new version linked to its predecessor.
- Unique idempotency key scoped by organization and operation.
- Foreign keys and transaction-level checks bind reporting period/evidence to the same organization.
- Review events and audit events are append-only; application code alone is not sufficient to guarantee immutability.
- Source register ID, source version, canonical URL, archived-object reference, SHA-256 and effective-date metadata are snapshotted with each mapping.
- Evidence records retain stable content digests, custody/lineage references and integrity state.
- Database constraints and route-level authorization both enforce the tenant boundary.
- No cross-system transaction may silently mutate EPR, CPCB, CCTS, MRV or credit issuance state.

## Required test matrix before implementation can be accepted

- Anonymous request; authenticated actor without permission; wrong organization.
- Foreign reporting-period ID and foreign evidence ID return non-enumerating 404.
- Missing or stale source-register record; unapproved source; ID/URL/version/hash mismatch.
- Lookalike domain, URL credentials, redirect to an untrusted host, stale source/effective date.
- Evidence missing, rejected, quarantined, hash mismatch, incomplete lineage, changed after review request.
- Stale optimistic concurrency token, replayed idempotency key and duplicate review submission.
- Unauthorized self-approval and required separation-of-duties cases.
- Audit write failure rolls back the state-changing operation.
- Mapping approval does not alter EPR/CPCB/CCTS/MRV/credit state.
- Historical report period retains the exact schema, GRI version, source version and evidence snapshot used at the time.
- Existing ESG/EPR/MRV tests and production-container build remain green.

## Release gates (Shakti Standards)

1. **Architecture:** API contract and data-flow review approved.
2. **Regulatory:** exact official documents archived, hashes verified, current/effective/superseded versions checked, applicability independently reviewed.
3. **Security:** threat model, RBAC/tenant isolation, redirect/SSRF controls, rate limits and audit integrity verified.
4. **Migration:** PR #108 ledger reconciliation completed; forward-only migration plan and rollback/recovery evidence reviewed.
5. **Integration:** PR #120 shared route/package/migration changes reconciled; no parallel conflicting edits.
6. **Verification:** unit, API, PostgreSQL integration, cross-tenant negative, regression and production-container tests pass on one final head.
7. **Operations:** monitoring, incident handling, backup/restore, retention and operator runbooks approved.
8. **Assurance:** independent legal/domain and security review recorded; no unsupported certification claims.
9. **TRL:** current GRI extension remains an engineering estimate of TRL 3 (isolated prototype). API contract completion alone does not raise TRL; end-to-end validation evidence is required.

**Implementation decision:** defer routes, persistence and migrations until the dependency gates above are cleared. This document deliberately avoids modifying the concurrent ESG/EPR route files and migration ledger.
