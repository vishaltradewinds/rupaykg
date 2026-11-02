# RupayKg — EPR route runtime registration correction

Date: 2026-11-03
Branch: shakti/verifier-identity-tenant-hardening-2026-11-02

## Why this correction exists

The focused source review inspected apps/src/epr-return-routes.ts and described its draft/submit/external-reference handlers as route risks. A follow-up registration trace in apps/src/server.ts shows that this module is not imported or registered by the current server entrypoint.

The live EPR return read path is instead apps/src/epr-return-read-route.ts, registered conditionally when EPR_RETURN_READ is enabled. That route:
- authenticates before the tenant transaction;
- requires one verified active organization and rejects bilateral context;
- uses withRlsRequestTransaction;
- checks EPR read permission on the same checked-out client and signed transaction;
- performs the protected EPR return read on that same client;
- requires RUPAYKG_REQUEST_CONTEXT_SECRET and RUPAYKG_REQUEST_CONTEXT_KEY_ID and runs assertEprReturnReadDatabaseContract before registration.

It is therefore inaccurate to count the legacy handlers in epr-return-routes.ts as currently exposed production endpoints. They remain dormant source code and must not be enabled or registered without full rewrite and acceptance testing.

## Current EPR route status

| Surface | Runtime status | Security position |
|---|---|---|
| GET /api/v1/epr/returns in epr-return-read-route.ts | Conditional feature-flag registration | Has signed single-tenant transaction boundary; activation remains gated by database contract and feature flag |
| Legacy GET/list, POST/draft, POST/submit, POST/external-reference in epr-return-routes.ts | Not registered by current server.ts | Dormant; do not register as-is |
| External statutory portal submission | Not performed by RupayKg | External reference recording must not be represented as actual portal submission |

## Required follow-up

1. Preserve the existing read-only route and its fail-closed startup contract.
2. Keep legacy write handlers unregistered.
3. Before enabling draft/submit functionality, implement new write handlers using the same signed transaction boundary, but derive tenant scope from the authenticated active organization and locked authorized parent row.
4. Add two-tenant PostgreSQL tests for draft creation, submission, obligation balance races, evidence/verification binding, geography, replay/idempotency and unauthorized tenant access.
5. Confirm the live feature flag is OFF in production; do not infer this from source defaults alone.
6. Correct route inventory metrics so only server-registered handlers count as live routes; retain dormant modules as latent code risk.

## Release posture

This is a source registration correction, not production verification. No feature flag or production setting was read or changed here. EPR activation remains HOLD until live production flag state, database startup contract and restricted-role acceptance are verified.
