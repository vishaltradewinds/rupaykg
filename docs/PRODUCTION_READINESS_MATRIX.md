# RupayKG Production Readiness Matrix

This matrix converts the useful readiness discipline from the former AI Studio repository into the current canonical architecture.

## Status legend

- **GREEN** — implemented in the current repository and supported by tests or authoritative code controls.
- **AMBER** — implemented or structurally supported, but an external/configuration/runtime gate remains.
- **RED** — critical defect blocks the target.
- **NOT_IMPLEMENTED** — intentionally absent or not yet verified.

A status must never be inferred from legacy documentation alone.

## Current evidence snapshot

The canonical `main` branch has passed the full CI validation chain through GitHub Actions run **#315** on commit **`afdb0927a4aada0098279511768c660fb6c8598a`**: migration validation, clean PostgreSQL migration, typecheck, production build and the complete discovered test suite all passed. Run #315 also verifies the corrected compiled production CORS runtime acceptance test. Earlier CI run **#307** verified the production CORS allowlist and configuration changes, and run **#268** independently verified the carbon runtime-acceptance correction on commit **`6f5d91cf2dc90fc87c609383a602c66eedeecf8`**. These are repository/CI evidence only; they do not replace external acceptance or production configuration.

| Domain | Current status | Acceptance evidence / remaining gate |
|---|---|---|
| Authoritative database | GREEN | PostgreSQL is the business-state source of truth; clean CI migration and DB-backed tests pass. |
| Lifecycle state model | GREEN | Current target defines authoritative lifecycle and value gates; lifecycle integration tests execute in CI. |
| Organization authorization | GREEN | Verified membership required for protected organization operations; authorization tests pass. |
| Geography authorization | GREEN | Organization geography scope is checked server-side and exercised at runtime. |
| Field-device enrollment | GREEN | Device must be verified and bound to authorized identity/org; pending-device runtime acceptance passes. |
| Offline synchronization | GREEN | Envelopes carry identity, sequence/timestamp/idempotency data and are replay-aware; runtime replay and cross-identity rejection pass. |
| MRV measurements | GREEN | Measurement writes require authorized activity geography; lifecycle runtime acceptance passes. |
| Evidence | GREEN | Evidence requires activity linkage and content URI/hash; provenance is retained and independently verified. |
| Verification | GREEN | Verifier authorization, self-verification rejection and database permission guard are covered. |
| Carbon calculations | AMBER | Generic deterministic calculation is evidence-bound with dataset/formula/calculation hashes and mismatched-activity evidence fails closed at runtime; methodology-specific production eligibility and external acceptance remain gated. |
| Methodology governance | AMBER | Source lock, applicability/parameter/equation mappings, independent numerical-reconciliation evidence and independent regression evidence are database-enforced and tested; actual regulatory/production methodology approval remains external. |
| EPR/compliance | GREEN | Evidence/authorization controls are present in current value routes and tests. |
| ESG reporting | GREEN | Organization-scoped reporting path exists and is built in CI. |
| Credential issuance | GREEN | High-risk DB permission boundary prevents unauthorized registry issuance; HTTP runtime acceptance covers permission denial, issuance, activation and non-synthetic production response. |
| Credential transfer/retirement | GREEN | High-risk DB permission boundary applies to registry events; HTTP runtime acceptance covers denied transfer, governed transfer and retirement. |
| Registry auditability | GREEN | Registry events are protected as append-only/auditable state; runtime fixtures are isolated rather than deleting immutable events during teardown. |
| Settlement authorization | GREEN | Explicit high-risk settlement authorization is required and HTTP runtime acceptance covers the transition. |
| Settlement finalization | GREEN | External reference + confirmation + reconciliation are required by database controls and HTTP runtime acceptance; premature direct `SETTLED` transition is rejected. |
| Settlement evidence immutability | GREEN | Database guard and HTTP runtime acceptance prevent clearing/changing confirmation/reconciliation evidence. |
| AI/intelligence | GREEN | Advisory boundary; authoritative state is not delegated to AI and runtime acceptance verifies non-mutation. |
| UI truthfulness | GREEN | UI consumes backend-authorized data and distinguishes authoritative state; frontend production build/typecheck and smoke checks pass through the workspace test chain. |
| Regulatory source catalog | AMBER | Current catalog is PostgreSQL-backed and exact BEE source provenance corrections are recorded; maintained real regulatory/reference data still requires operational provisioning and ongoing verification. |
| External carbon-market submission | AMBER | Must remain manual/controlled until an official external interface is actually connected and tested. |
| Physical instrumentation | AMBER | Hardware/site integration is an external acceptance gate, not simulated. |
| External trust rails | NOT_VERIFIED | Legacy Hedera/VC capabilities are not assumed in the current repository without current implementation and live acceptance evidence. |
| Production identity/role provisioning | AMBER | Requires controlled deployment-time provisioning with real identities and explicit permissions. |
| Production PostgreSQL/TLS acceptance | AMBER | Production startup is fail-closed on PostgreSQL URL/TLS/auth/origin configuration and CI verifies the configuration contract, but the target managed PostgreSQL certificate chain and connection must be accepted in the actual deployment environment. |
| Runtime CORS policy | GREEN | Production entrypoint validates HTTPS origins and the authoritative Fastify runtime uses the explicit allowlist; CI run #315 executes the HTTP runtime regression. |
| Cloud Run | AMBER | Final deployment gate after production PostgreSQL/configuration, external acceptance and runtime acceptance. |

## Required production acceptance

Before declaring the platform production-ready, execute the following against the actual target environment:

1. Apply and validate all migrations on clean PostgreSQL.
2. Confirm readiness fails when authoritative PostgreSQL is unavailable.
3. Authenticate with a real provisioned identity and verified organization membership.
4. Confirm out-of-scope geography is rejected for reads and writes.
5. Confirm a pending field device cannot submit authoritative envelopes.
6. Confirm duplicate envelope replay is idempotent and cross-identity reuse is rejected.
7. Execute the activity → measurement → evidence → verification lifecycle.
8. Confirm carbon calculation rejects missing/mismatched evidence and records deterministic provenance hashes.
9. Confirm a methodology cannot be marked `PRODUCTION_ELIGIBLE` without source provenance, implementation mapping, independent numerical-reconciliation evidence and independent regression evidence required by database controls.
10. Confirm unauthorized registry issuance/transfer/retirement fails at the database boundary.
11. Confirm settlement cannot reach `SETTLED` without external confirmation and reconciliation.
12. Confirm settlement confirmation/reconciliation evidence cannot be cleared or mutated.
13. Confirm AI/intelligence operations cannot mutate authoritative lifecycle state.
14. Confirm UI displays only backend-authorized organization/geography data.
15. Confirm no demo/simulated record is represented as real production activity.
16. Where a regulatory methodology or external provider is used, independently verify the exact source/version and preserve its provenance.
17. Confirm the target managed PostgreSQL TLS certificate chain is trusted by the production runtime with `DATABASE_SSL=require`; do not weaken certificate verification to make deployment pass.
18. Confirm production identity/session provisioning uses real identities and explicit PostgreSQL permissions; no bundled client session token or development authentication fallback is permitted.
19. Confirm the production web origin is the exact HTTPS origin allowlisted in `RUPAYKG_ALLOWED_ORIGINS` and non-allowlisted origins receive no CORS authorization.

## Carbon methodology discipline

Legacy AI Studio documents contain useful examples such as BM WA03.001 and BM WA03.002. They must be treated differently:

- A mathematical reconciliation is a reference case, not evidence that a current adapter is legally or regulatorily approved.
- A source-locked implementation mapping is required before production methodology claims.
- Missing required parameters or evidence must fail closed.
- Deterministic intermediate values should be preserved so an auditor can reproduce the final result.
- Official issuance must remain externally confirmed; internal `ISSUED` state must not impersonate government/registry issuance.

The current methodology governance lifecycle is:

`SOURCE_LOCKED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PRODUCTION_ELIGIBLE`

Database controls prevent a methodology from claiming `PRODUCTION_ELIGIBLE` without source provenance, independent reconciliation evidence and independent regression evidence. This is a readiness control, not a regulatory approval claim.

## Release gate

The correct progression is:

`CODE READY → CONFIGURATION READY → RUNTIME ACCEPTANCE → EXTERNAL ACCEPTANCE → CLOUD RUN DEPLOYMENT`

Cloud Run deployment must remain the final step, not a substitute for unresolved application or production-readiness work.
