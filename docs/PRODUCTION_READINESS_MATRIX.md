# RupayKG Production Readiness Matrix

This matrix converts the useful readiness discipline from the former AI Studio repository into the current canonical architecture.

## Status legend

- **GREEN** — implemented in the current repository and supported by tests or authoritative code controls.
- **AMBER** — implemented or structurally supported, but an external/configuration/runtime gate remains.
- **RED** — critical defect blocks the target.
- **NOT_IMPLEMENTED** — intentionally absent or not yet verified.

A status must never be inferred from legacy documentation alone.

| Domain | Current status | Acceptance evidence / remaining gate |
|---|---|---|
| Authoritative database | GREEN | PostgreSQL is the business-state source of truth. |
| Lifecycle state model | GREEN | Current target defines authoritative lifecycle and value gates. |
| Organization authorization | GREEN | Verified membership required for protected organization operations. |
| Geography authorization | GREEN | Organization geography scope is checked server-side. |
| Field-device enrollment | GREEN | Device must be verified and bound to authorized identity/org. |
| Offline synchronization | GREEN | Envelopes carry identity, sequence/timestamp/idempotency data and are replay-aware. |
| MRV measurements | GREEN | Measurement writes require authorized activity geography. |
| Evidence | GREEN | Evidence requires activity linkage and content URI/hash; provenance is retained. |
| Verification | GREEN | Verifier authorization and lifecycle controls are present. |
| Carbon calculations | GREEN | Deterministic package calculates pending-verification value; methodology version is required. |
| EPR/compliance | GREEN | Evidence/authorization controls are present in current value routes. |
| ESG reporting | GREEN | Organization-scoped reporting path exists. |
| Credential issuance | GREEN | High-risk DB permission boundary prevents unauthorized registry issuance. |
| Credential transfer/retirement | GREEN | High-risk DB permission boundary applies to registry events. |
| Registry auditability | GREEN | Registry events are protected as append-only/auditable state. |
| Settlement authorization | GREEN | Explicit high-risk settlement authorization is required. |
| Settlement finalization | GREEN | External reference + confirmation + reconciliation are required. |
| Settlement evidence immutability | GREEN | Database guard prevents clearing/changing confirmation/reconciliation evidence. |
| AI/intelligence | GREEN | Advisory boundary; authoritative state is not delegated to AI. |
| UI truthfulness | GREEN | UI consumes backend-authorized data and distinguishes authoritative state. |
| Regulatory source catalog | AMBER | Current catalog is PostgreSQL-backed; real regulatory/reference data must be provisioned and maintained. |
| Methodology-specific carbon adapters | AMBER | Current generic carbon calculation exists; each production methodology requires source-locked equation/tool mapping and independent reconciliation before official claims. |
| External carbon-market submission | AMBER | Must remain manual/controlled until an official external interface is actually connected and tested. |
| Physical instrumentation | AMBER | Hardware/site integration is an external acceptance gate, not simulated. |
| External trust rails | NOT_VERIFIED | Legacy Hedera/VC capabilities are not assumed in the current repository without current implementation and live acceptance evidence. |
| Production identity/role provisioning | AMBER | Requires controlled deployment-time provisioning. |
| Cloud Run | AMBER | Final deployment gate after production PostgreSQL/configuration and runtime acceptance. |

## Required production acceptance

Before declaring the platform production-ready, execute the following against the actual target environment:

1. Apply and validate all migrations on clean PostgreSQL.
2. Confirm readiness fails when authoritative PostgreSQL is unavailable.
3. Authenticate with a real provisioned identity and verified organization membership.
4. Confirm out-of-scope geography is rejected for reads and writes.
5. Confirm a pending field device cannot submit authoritative envelopes.
6. Confirm duplicate envelope replay is idempotent and cross-identity reuse is rejected.
7. Execute the activity → measurement → evidence → verification lifecycle.
8. Confirm value calculation cannot bypass evidence/verification requirements.
9. Confirm unauthorized registry issuance/transfer/retirement fails at the database boundary.
10. Confirm settlement cannot reach `SETTLED` without external confirmation and reconciliation.
11. Confirm settlement confirmation/reconciliation evidence cannot be cleared or mutated.
12. Confirm AI/intelligence operations cannot mutate authoritative lifecycle state.
13. Confirm UI displays only backend-authorized organization/geography data.
14. Confirm no demo/simulated record is represented as real production activity.
15. Where a regulatory methodology or external provider is used, independently verify the exact source/version and preserve its provenance.

## Carbon methodology discipline

Legacy AI Studio documents contain useful examples such as BM WA03.001 and BM WA03.002. They must be treated differently:

- A mathematical reconciliation is a reference case, not evidence that a current adapter is legally or regulatorily approved.
- A source-locked implementation mapping is required before production methodology claims.
- Missing required parameters or evidence must fail closed.
- Deterministic intermediate values should be preserved so an auditor can reproduce the final result.
- Official issuance must remain externally confirmed; internal `ISSUED` state must not impersonate government/registry issuance.

## Release gate

The correct progression is:

`CODE READY → CONFIGURATION READY → RUNTIME ACCEPTANCE → EXTERNAL ACCEPTANCE → CLOUD RUN DEPLOYMENT`

Cloud Run deployment must remain the final step, not a substitute for unresolved application or production-readiness work.