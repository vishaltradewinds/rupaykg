# RupayKg EPR Quantity-Binding Engineering Checkpoint — 2026-10-29

## Scope
Branch: `shakti/epr-geography-authorization`
PR: #118 (draft; not merged)
Master audit issue: #112
Production certification: HOLD
No production migration, deployment, statutory submission, or external credit issuance has been performed.

## Current migration sequence
- `097_epr_authoritative_quantity_binding.sql`: adds empty source-linked scheme/category/unit mapping catalogue, categorized obligation field, source measurement/evidence/verification/custody bindings, and append-only allocation/reversal event ledger.
- `098_epr_quantity_binding_integrity_correction.sql`: explicit source-row existence checks; protects eligible/allocated bindings from mutation/deletion.
- `099_epr_quantity_binding_geography_and_null_safety.sql`: null-safe evidence/verifier identity checks; activity/source-flow/custody geography checks; mapping approval provenance guard.
- `100_epr_flow_level_allocation_serialization.sql`: locks physical resource flow during allocations and introduces allocation quantity unit.
- `101_epr_allocation_unit_reconciliation_fix.sql`: corrects dimensional comparison by converting allocation quantities back to source-equivalent units before checking against flow-declared quantity; preserves NOT VALID constraint semantics for any legacy rows.

## Validation evidence
- Commit `56632b1a5946880ae7f3c281ca8436c889f6ee4a`, CI run `40866476323`: passed all listed stages, including migration validation/application, typecheck, build, browser smoke, tests including disposable PostgreSQL acceptance, and production container build. This does not validate later commits.
- Commit `9b4bedbd4d4ab2edae541dcb1f229c23b5733fc3`, CI run `40867775093`: passed all listed stages. This validates migrations 097–099.
- Commit `b9136130677e66b0d3558d8c5efcee205350897e`, CI run `40868187102`: queued/in progress at checkpoint time. Do not call this passed until exact-head CI completes.

## Remaining engineering and assurance gates
1. Focused PostgreSQL tests for approved mapping/source hashes, effective-date/category/unit mismatch, missing/forged source records, geography/custody mismatch, duplicate measurement use, cross-binding allocation reuse, concurrent allocation serialization, obligation balance, and partial/full reversal limits.
2. Validate the final migration 100/101 sequence against the disposable PostgreSQL environment and review any failure before further changes.
3. Implement API/service endpoints for creating approved mappings and source bindings only after RBAC/approval workflow is defined; current EPR submission/assessment routes remain fail-closed.
4. Reconcile production/staging migration ledgers, including historical migration records absent from the current release catalogue. Never fabricate ledger entries or edit already-applied migrations.
5. Obtain authoritative scheme/category/unit mappings and approvals from applicable scheme owner/legal/compliance reviewer. No statutory mapping or conversion factor has been invented.
6. Independent compliance review, full adversarial tests, and production-readiness review before changing the HOLD gate.

## Non-claims
Schema and database guards are an engineering foundation, not proof of statutory EPR compliance, external submission, verified fulfillment, carbon-credit issuance, or production certification. No real mapping catalogue entries have been approved or populated.
