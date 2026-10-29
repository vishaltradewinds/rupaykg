# EPR Rejected-Return Reconciliation — Engineering Gate

**Status:** DESIGN ONLY — NOT IMPLEMENTED; production gate remains HOLD  
**Scope:** RupayKg EPR return lifecycle, obligation fulfillment ledger and externally rejected submissions  
**Shakti Standards:** fail closed; preserve evidence; separate internal workflow state from regulator outcome.

## Problem statement

A rejected return must not be resubmitted as though no prior submission occurred. Submission may already have consumed a quantity binding and incremented an obligation's fulfilled quantity. A safe retry therefore requires a traceable reconciliation decision and a balanced accounting correction, not merely changing `status` back to `DRAFT`.

The current API deliberately returns `409 EPR_REJECTED_RETURN_RECONCILIATION_REQUIRED` for a rejected return. Keep this guard until the gates below are implemented and tested.

## Required state model

Do not overload one status field to imply all external outcomes. Model and audit separately:
- internal return lifecycle;
- external filing attempt and regulator response;
- quantity-binding consumption;
- obligation fulfillment ledger entries;
- reconciliation case and its decision.

Candidate reconciliation states (names are provisional pending schema review):
`OPEN` → `EVIDENCE_GATHERING` → `UNDER_REVIEW` → `APPROVED` or `REJECTED` → `APPLIED`.
A case may be closed without adjustment only when an authorized reviewer records a reason and evidence. State changes must be append-only audited events; never delete or rewrite the original filing or rejection evidence.

## Non-negotiable invariants

1. Never delete the original return, binding, evidence, verification, external reference, or regulator rejection response.
2. Never clear `consumed_at` or reuse a consumed measurement/custody allocation.
3. Never reverse fulfilled quantity based only on a user-supplied status or free-text reason.
4. Reversal must reference the original fulfillment ledger event and be exactly bounded by its quantity; duplicate application must be prevented by a database-enforced idempotency key/unique constraint.
5. Do not reverse fulfillment if a downstream accepted filing, issued certificate, settlement, transfer, or other irreversible external effect exists. Route such cases to a separate exception/manual review process.
6. A resubmission, if ultimately allowed, must use a new filing-attempt record and fresh valid evidence/verification as required by the applicable scheme. Preserve the rejected attempt and its external reference.
7. Require current, organization-scoped permission for the case initiator and independent approver; prevent self-approval where role policy supports that distinction. Record actor, timestamp, reason code, source artifact hashes, prior/new states and linked ledger IDs.
8. Every operation affecting case, binding and obligation balance must be one transaction with row locks and rollback on any failed precondition.
9. Regulator acceptance is only recorded from an authenticated/traceable external outcome; internal submission or a saved reference is not acceptance or certificate issuance.
10. EPR statutory requirements and scheme-specific timelines must be validated against archived, versioned official source documents before policy rules are activated.

## Implementation sequence

### Gate A — discover actual data model
- Map all writes to `epr_returns.status`, `fulfilled_quantity`, `consumed_at`, external references, certificate/credit issuance, settlement and audit tables.
- Inspect constraints, triggers, migration ledger and production/staging schema discrepancy.
- Identify whether a canonical append-only obligation fulfillment ledger exists. Do not create a parallel balance model without resolving existing sources of truth.
- Identify regulator response provenance, authentication and source retention rules.

### Gate B — define and approve the accounting contract
- Specify exact allowed transitions, reversal eligibility, no-reversal cases, actor separation and idempotency.
- Obtain product/domain and legal/regulatory review for actual scheme requirements.
- Document treatment of partial rejection, corrected filing, appeals, deadlines and accepted-but-later-reversed outcomes.
- Keep this design in research/design state until evidence and approvals are attached.

### Gate C — implement fail-closed API and audit trail
- Add a reconciliation case and append-only event model only after Gate A establishes the canonical schema.
- Use database constraints for unique application and exact linkage to original submission/fulfillment.
- Require transaction-scoped locks over the return, obligation/ledger entry, binding and case.
- Keep rejected return resubmission blocked unless the approved reconciliation state permits a narrowly defined transition.

### Gate D — tests
- Unit tests for every transition and invalid transition.
- Disposable-PostgreSQL integration tests for balance invariants, unique/idempotent application, transaction rollback, concurrent duplicate approval/application, authorization revocation and attempts to reverse accepted downstream outcomes.
- Verify binding provenance and consumption remain immutable.
- Verify external rejection evidence and original submission remain queryable after reconciliation.
- Test migration-history preflight and upgrade from verified production-shaped and staging-shaped schemas.

### Gate E — release and assurance
- Reconcile migration history before any shared database migration.
- Obtain independent security, accounting and regulatory review.
- Deploy only after approved change window, backup/restore plan, observability and rollback/forward-recovery plan.
- Keep production certification OFF until external outcome reconciliation and operational evidence are verified.

## Acceptance criteria

This design is not implementation evidence. The gate is passed only when the actual schema is mapped, the accounting contract is approved, implementation and PostgreSQL concurrency tests pass, migration history is reconciled, and operational/legal approvals are recorded. No production/staging database change is authorized by this document.
