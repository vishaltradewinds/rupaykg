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

External mediator contract now has a concrete tenant-safe persistence and API intake path.

### Runtime implementation

- Persistence: `migrations/20261108_external_integration_mediator.sql`
- Tenant-safe service: `apps/src/external-integration-mediator.ts`
- API boundary: `POST /api/v1/integrations/messages`
- Route registration: `apps/src/external-integration-routes.ts` and `apps/src/server.ts`
- Runtime acceptance uses `withTenantTransaction()` and requires the authenticated active organization to equal the envelope organization.
- Idempotency is persisted by `(integration_id, organization_id, idempotency_key)`.
- Duplicate delivery is acknowledged without creating a second authoritative integration message.

This closes the prior gap of having only a transport-neutral type without a runtime intake path. It does **not** mean any external government/PSU/registry connector is production accepted; provider-specific authentication, schema conformance, remote-call execution, external-response validation and field/production acceptance remain separate gates.



### Provider adapter registry

`apps/src/external-integration-adapter-registry.ts` now provides a controlled adapter registry. It fails closed when no provider adapter is registered, rejects duplicate adapter registration, converts adapter exceptions into classified non-authoritative failures, and rejects correlation mismatches. This is an execution boundary only; no provider is represented as production accepted until its authentication, schema conformance, remote acceptance and field/production evidence are independently recorded.

### Adapter conformance gate

`apps/src/external-integration-adapter-conformance.test.ts` provides a provider-neutral conformance harness for the adapter execution boundary. It verifies:

- successful adapter correlation preservation;
- explicit non-authoritative mutation boundary;
- remote exception isolation and retry classification;
- correlation mismatch rejection;
- missing-provider fail-closed behaviour.

This is an engineering conformance gate for the mediator boundary. It is not evidence of conformance to any specific government, PSU, registry or external provider API. Provider-specific schema, authentication, remote endpoint behaviour and field/production acceptance remain mandatory before that provider is marked accepted.