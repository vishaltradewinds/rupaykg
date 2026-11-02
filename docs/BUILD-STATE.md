# RupayKg Build State

**Date:** 2026-09-02

## Source of truth

`vishaltradewinds/rupaykg` is the production source of truth. The legacy `rupaykg-aistudio` repository is reference-only and must not be modified for this rebuild.

## Product direction

RupayKg is India's Circular Economy Operating System for urban and rural resource flows, combining resource/waste operations, digital MRV, carbon accounting, EPR compliance, ESG reporting, registry and governed settlement.

Authoritative lifecycle:

`Generate → Aggregate → Measure → Transport → Process → Evidence → Verify → Calculate Value → Certify/Issue → Registry → Transfer/Retire → Settle → Report`

The backend is authoritative. The platform must never present unverified activity, measurement, compliance, credential, registry transition, payment or settlement as completed.

## Implemented foundation

- Monorepo with web, API and domain-oriented packages.
- PostgreSQL migrations 001–008 covering core, regulatory, identity/geography/operations, security/auth, carbon/EPR/ESG, registry/settlement guardrails, resource-flow/MRV, and verification integrity.
- Migration validation script and CI workflow.
- Domain state machines and regulatory applicability rules.
- Carbon, compliance, ESG and AI-advisory packages with tests.
- Authenticated API patterns with database-backed sessions.
- Resource-flow, measurement, evidence and verification APIs.
- Carbon calculation, EPR assessment and ESG metric APIs.
- Governed credential registry and settlement workflow APIs.
- Database-level anti-self-verification, verifier authorization, append-only registry/settlement events and event hashes.
- Shared frontend API client and live operational refresh.
- Responsive institutional UI foundation and Stitch-compatible `DESIGN.md`.

## Current known next work

1. Replace placeholder registry/settlement tests with meaningful API/domain guardrail tests.
2. Add field/offline sync persistence with idempotency, server acknowledgements, conflict records and authoritative-state protection.
3. Add field/offline sync API endpoints and conflict resolution workflow.
4. Add mobile/field queue UI states: pending, syncing, accepted, conflict, rejected, retry and last sync.
5. Add real workspace data endpoints and wire all frontend workspaces to authoritative data.
6. Add explicit route-level verifier permission checks in addition to database triggers.
7. Add registry/settlement idempotency and external-authority confirmation boundaries.
8. Run and verify CI after each coherent batch; never claim green without an actual successful run.

## Design workflow

Google Stitch is the UI/UX exploration and prototyping layer. `DESIGN.md` is the reusable design-system contract. Production React code remains authoritative for application behavior. Stitch supports importing/exporting `DESIGN.md` and working with existing code/design files, so the project should keep the design contract versioned with the repository.

## Truthfulness rules

- AI findings are advisory and must not directly mutate authoritative state.
- Evidence precedes value claims.
- Verification is distinct from evidence capture.
- Credentials require approved verification.
- Settlement completion requires external/authoritative confirmation and reconciliation.
- Use `verified`, `pending`, `rejected`, `unavailable`, `demo`, and `simulated` states explicitly.
- Prefer `tamper-evident, cryptographically anchored audit trails` unless true immutability is actually established.
