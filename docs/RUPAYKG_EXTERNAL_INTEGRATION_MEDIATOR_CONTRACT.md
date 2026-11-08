# RupayKg External Integration Mediator Contract

**Status:** Engineering contract v1.0 — 2026-11-08  
**Canonical repository:** `vishaltradewinds/rupaykg` / `main`

## Purpose

Provide one controlled boundary for government, PSU, DPI, registry and ecosystem integrations.

The contract is intentionally provider-neutral.

**Authoritative-state rule:**

`External System ↔ Adapter/Mediator ↔ RupayKg Authoritative Core`

An external system cannot become the authoritative source of RupayKg MRV, registry, evidence or tenant state merely by returning a successful response.

## Mandatory envelope

Every integration message carries:

- `contractVersion`
- `integrationId`
- `correlationId`
- `idempotencyKey`
- `organizationId`
- optional `actorIdentityId`
- `direction`
- `kind`
- `occurredAt`
- `sourceSystem`
- `targetSystem`
- `schema`
- `payload`

## Required adapter behaviour

Adapters must provide:

1. authentication;
2. authorization;
3. schema validation;
4. organization/tenant authorization;
5. idempotency;
6. replay protection;
7. correlation;
8. timeout handling;
9. retry classification;
10. external-response validation;
11. audit linkage;
12. failure isolation.

## Failure rule

A remote failure must not partially mutate authoritative RupayKg state.

A successful remote response must not automatically mark a regulatory, MRV or environmental claim as approved.

## Implementation

Canonical contract types and validation:

`apps/src/external-integration-contract.ts`

Contract tests:

`apps/src/external-integration-contract.test.ts`

This is a boundary contract, not a claim that any external connector is production accepted.

## Shakti adoption relationship

This contract implements the crosswalk recommendation for a GovStack-style information-mediator/controlled-adapter boundary while keeping RupayKg's own core authoritative.

Future connectors must implement this contract or provide a formally approved equivalent profile.

## Test gate

Minimum acceptance:

- malformed envelope rejection;
- unsupported contract-version rejection;
- invalid timestamp rejection;
- invalid payload rejection;
- idempotency enforcement;
- tenant authorization;
- replay protection;
- timeout/retry handling;
- external failure isolation;
- audit correlation;
- authoritative-state integrity.

**Shakti rule:** Reuse what is proven. Verify what is adopted. Localise what is required. Evidence what is claimed.
