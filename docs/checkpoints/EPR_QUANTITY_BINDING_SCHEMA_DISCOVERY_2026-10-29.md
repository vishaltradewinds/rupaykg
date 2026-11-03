# EPR Quantity Binding — Schema Discovery Addendum (2026-10-29)

## New finding: draft input and verified fulfillment are distinct
The current `POST /api/v1/epr/returns` route accepts a caller-supplied positive `reportedQuantity` and persists it on a `DRAFT` return. This value is not itself fulfillment: the submit endpoint now blocks until authoritative quantity binding exists. API consumers must not treat a draft's reported quantity as verified, eligible or submitted compliance.

## Migration evidence
- `070_epr_obligations_returns.sql`: `epr_returns.reported_quantity numeric(20,6) NOT NULL CHECK (reported_quantity >= 0)`; `fulfilled_quantity numeric(20,6) NOT NULL DEFAULT 0`; status defaults to DRAFT. It adds `epr_obligations.target_basis jsonb NOT NULL DEFAULT '{}'`, `source_evidence_id`, `source_verification_id`, and `fulfilled_at`.
- `071_epr_return_obligation_binding.sql`: adds `epr_returns.obligation_id`; trigger limits a return's fulfilled quantity to the remaining quantity on a matching obligation. This is a balance guard, not proof that reported quantity came from eligible source measurements.
- `036_bwg_epr_esg_reporting.sql`: `bwg_epr_reports` has `scheme_id`, free-text `category_code`, obligated/fulfilled quantities, evidence and verification references. The table is not shown to be reconciled transactionally to `epr_returns`.
- `007_resource_flow_mrv.sql`: resource flows, custody links and MRV observations offer source quantity/unit/activity/evidence fields, but no already-demonstrated canonical link binds them to an EPR scheme category, obligation target_basis, reporting period and conversion methodology.

## Decisions
1. Do not derive statutory fulfillment by copying `reported_quantity`.
2. Do not assume `target_basis` JSON conventions, material category identifiers, units, conversions, or regulatory methodology identifiers. No approved, seeded mapping was demonstrated by this inspection.
3. Preserve the current submit fail-closed response until a versioned mapping catalogue is sourced, reviewed and approved.
4. Expose draft quantity as explicitly unverified in any future API/UI contract; never label it verified or fulfilled before derivation and approval.
5. A production implementation needs a forward-only migration for immutable source allocations and a reconciled fulfillment ledger only after mapping and lifecycle rules are approved.

## Next test and implementation gates
- Confirm every route and dashboard distinguishes draft reported quantity, derived eligible quantity, submitted quantity and accepted external quantity.
- Route-level tests must verify draft creation cannot alter obligation fulfillment and that submit cannot write return/evidence/fulfillment state when the binding gate is absent.
- Disposable PostgreSQL tests must prove concurrent allocation cannot exceed source quantity or obligation balance.
- Rejection/correction/resubmission accounting must be ledger-based and idempotent.
- Independent statutory mapping and assurance review remain mandatory.

## Status
CI for the route-level fail-closed regression test passed on `5f560eac4bd764086cce94cee9591f4964175ce2` in run [40851066930](https://github.com/vishaltradewinds/rupaykg/actions/runs/40851066930). This validates the current test suite, not the absent quantity binding. Production certification remains HOLD.
