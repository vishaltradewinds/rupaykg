# RupayKg Build State

**Current checkpoint:** 2026-10-30  
**Canonical status:** [Current Source of Truth](CURRENT_SOURCE_OF_TRUTH.md)

## Current release posture

**Production HOLD · scheduler OFF · certification HOLD/OFF.**

The canonical application repository is `vishaltradewinds/rupaykg`; the legacy `rupaykg-aistudio` repository is reference-only and is not the Render production source. Render service `rupaykg` deploys this repository's `main` branch. Do not confuse a live service or healthy endpoint with complete release acceptance.

## Product and lifecycle

RupayKg is a pan-India circular-economy operating platform for resource/waste operations, digital MRV, carbon accounting, EPR compliance, ESG reporting, environmental attributes, registry and governed settlement.

Authoritative lifecycle:

`Generate → Aggregate → Measure → Transport → Process → Evidence → Verify → Calculate Value → Certify/Issue → Registry → Transfer/Retire → Settle → Report`

Backend and database state are authoritative. The platform must never present unverified activity, measurement, compliance, credential, registry transition, payment or settlement as completed.

## Engineering evidence and limits

The repository includes a monorepo, web/API/domain packages, PostgreSQL migration runner and validation, CI, regulatory applicability, lifecycle state machines, resource-flow/MRV, evidence and verification APIs, carbon/EPR/ESG workflows, registry/settlement controls, and frontend workspaces. The precise readiness of each component must be determined from current code, tests and independent runtime evidence—not this summary alone.

### Critical unresolved gate: migration provenance

Neon main recorded migration `096_verification_authorization_provenance.sql` at `2026-10-27T13:46:14.262221Z`, and the expected authorization snapshot schema/function state was observed there. The current repository `main` does not contain that migration. Render logs reported it applied about one second later. Render's exact Neon target, immutable deployed image digest, exact SQL SHA-256 and execution/approval provenance remain unproven. Staging and rehearsal have separate history discrepancies.

No migration replay, rollback, ledger edit, production database write, merge or deployment is authorized by this checkpoint. See [Current Source of Truth](CURRENT_SOURCE_OF_TRUTH.md) and [Issue #145](https://github.com/vishaltradewinds/rupaykg/issues/145).

## Operational truthfulness rules

- AI findings are advisory; AI must not directly mutate authoritative state.
- Evidence precedes value claims; verification is distinct from evidence capture.
- Credentials require approved verification.
- Settlement completion requires external/authoritative confirmation and reconciliation.
- Use explicit `verified`, `pending`, `rejected`, `unavailable`, `demo`, and `simulated` states.
- Prefer “tamper-evident, cryptographically anchored audit trail” unless true immutability is established.
- Never claim CI green without a successful run on the exact candidate commit.
- Preserve historical artifacts for auditability; label them historical instead of treating them as current truth.
