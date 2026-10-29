# EPR Return Quantity Integrity Gate — CTO Design Record (2026-10-29)

## Decision
Production certification remains on HOLD. An approved verification and verified evidence row do not by themselves prove that epr_returns.reported_quantity is the correct eligible quantity for the selected EPR obligation. The endpoint's externalSubmission state remains NOT_SUBMITTED.

## Repository evidence inspected
- migrations/007_resource_flow_mrv.sql: resource_flows includes material_code, declared_quantity and unit; chain_of_custody_links includes quantity/unit, activity, evidence and custody sequence; mrv_observations includes activity, optional measurement, parameter_code, observed_value, unit, method, time, uncertainty and quality status.
- migrations/025_methodology_reconciliation_evidence.sql: production-eligible methodology requires source reference/hash, applicability, parameter and equation mappings, numerical reconciliation and regression evidence.
- migrations/036_bwg_epr_esg_reporting.sql: BWG EPR reports carry category code, quantities, evidence and verification, but are separate from epr_returns; authoritative reconciliation between them is not demonstrated.
- migrations/069_epr_evidence_guards.sql: registration/transfer guards check evidence provenance, approval, organization and geography, not reported return quantity.
- migrations/070_epr_obligations_returns.sql and 071_epr_return_obligation_binding.sql: returns store reported/fulfilled quantity and bind to one obligation; the guard limits quantity against remaining obligation balance, not measured eligible material.
- migrations/008_verification_integrity.sql: database verification guard checks verifier authorization and self-verification. Current PR branch adds submission-time organization-scoped verifier authorization.

## Required canonical binding
Before a return can be production eligible, the system must bind and retain:
1. Return/obligation: organization, scheme, obligation, period and jurisdiction.
2. Material eligibility: canonical material/category code mapped to scheme category and obligation basis.
3. Quantity/unit: authoritative measurement or eligible custody quantity, canonical unit, versioned conversion, precision/rounding and uncertainty policy.
4. Activity/evidence: source activity, evidence and immutable artifact version/hash, scoped to organization/geography.
5. Verification: approved verification for evidence/activity, current verifier membership/permission in the return organization, independence from activity actor, and revocation/supersession rules.
6. Time: event timestamp and evidence artifact period compatible with return period, with date-boundary rules.
7. Methodology: exact version, applicability, parameter/equation mapping, and production-eligibility evidence.
8. Allocation: source quantity cannot be double-counted; partial allocations need an allocation ledger.
9. Accounting: submission, acceptance, rejection, correction and resubmission must reconcile through an auditable ledger.
10. Audit output: source IDs/hashes, methodology, conversion steps, derived quantity, verifier snapshot, timestamps, decisions and deterministic reconciliation result.

## Engineering gates
A. Inventory actual schema, seeded scheme catalog, target_basis examples, source links, status transitions and applicable statutory scheme definitions. Do not invent fields, category codes, units or methodology IDs.
B. Obtain independent approval of each supported scheme/category's mapping, derivation, conversion, period, uncertainty and correction rules.
C. Add forward-only schema only after approval; preserve history and quarantine ambiguous legacy rows.
D. Derive quantity server-side from approved bindings; lock source allocations and obligation; commit return and ledger atomically.
E. Test with disposable PostgreSQL: category/unit/period mismatches, wrong organization/geography, unverified or revoked verifier, activity/evidence mismatch, stale artifact, duplicate/concurrent consumption, partial allocations, obligation overrun, rejected-return reconciliation, rollback and idempotency.
F. Require independent numerical reconciliation, recovery rehearsal, legal/compliance review and explicit production approval.

## Acceptance criteria
- Independent reviewer can reproduce every submitted quantity from retained sources and exact methodology version.
- Client-supplied reportedQuantity alone cannot establish compliance.
- Mismatched category, unit, period, activity, organization, geography, verifier or methodology fails closed.
- Concurrent submissions cannot consume the same source quantity twice.
- Rejection/correction/resubmission leaves fulfillment equal to the reconciled ledger.
- External submission is not marked submitted/accepted without authoritative external evidence.
- Exact-head tests pass and independent review signs off.

## Status
- EPR geography/verifier hardening: implemented on draft PR #118. Commit c5fb3f91c64064e41febc4ce9309181700071088 passed CI run 40849394059.
- Route-level adversarial lifecycle tests: not demonstrated.
- Quantity-to-measurement/category/unit/period/methodology binding: NOT IMPLEMENTED; BLOCKER.
- Rejection fulfillment reconciliation: NOT DEMONSTRATED; BLOCKER.
- Production certification: HOLD.

This is a documented engineering gate, not a claim that quantity integrity is implemented or legally approved.
