# Government Data Mirror Bridge — Safe Intake Boundary

**Status: engineering implementation only. Not a live NAPIX/API Setu integration and not production-certified.**

## Purpose and trust boundary

`POST /api/v1/bridge/gov/inbox` is an inbound, asynchronous inbox for data batches from an explicitly authorized source. It does not connect to, query, or write to a government production database. The source authority must provide an approved read-only export or webhook and authorize this receiving endpoint through its own integration process.

This implementation does **not** claim NAPIX/API Setu registration, MeitY approval, or a government-issued signature. The HMAC below is a bridge-side sender authentication mechanism to be replaced or complemented by the source authority's approved identity, transport, and gateway controls.

## Intake contract

Payload:
```json
{
  "batchMetadata": {
    "authorityCode": "MH-PCB",
    "municipalCode": "MCGM-MUM",
    "syncWindowTimestamp": "2026-10-19T02:30:00Z",
    "batchId": "b5e74bb0-b3a1-4fd7-ae67-c3c2a68d56ab"
  },
  "rawDataLogs": ["Untrusted source record text..."]
}
```

Headers:
- `x-rupaykg-timestamp`: Unix timestamp in seconds or milliseconds.
- `x-rupaykg-signature`: `sha256=<hex>`.

For this initial bridge adapter, the sender computes HMAC-SHA256 over the UTF-8 bytes of `<timestampHeader>.<JSON.stringify(parsedPayload)>`, using a randomly generated shared secret of at least 32 characters. Sender and receiver must use the same JSON serialization convention. Timestamps older than five minutes are rejected. Use a secret manager; never place the secret in source control or client-side code.

Configure `RUPAYKG_GOV_BRIDGE_AUTHORITY_CREDENTIALS` as a JSON object mapping each authority code to its own unique secret and permitted municipal codes. Example shape (use real random secrets only in the deployment secret manager; never copy example values):

```json
{
  "MH-PCB": {
    "secret": "<unique-random-secret-at-least-32-characters>",
    "municipalCodes": ["MCGM-MUM"]
  },
  "MPPCB": {
    "secret": "<different-unique-random-secret-at-least-32-characters>",
    "municipalCodes": ["BHOPAL-MUNI"]
  }
}
```

The old single shared-secret and comma-separated authority allow-list variables are no longer accepted by the active inbox route. Each request's claimed authority selects its own key; the signature must validate with that authority's key, and the municipality must be in that credential's explicit scope. Unknown authorities, invalid configuration, and out-of-scope municipalities fail closed. Provision one secret per authority, rotate/revoke independently, and never commit secrets to source control.

The endpoint enforces a 1 MiB request limit, bounded record count/length, strict timezone-bearing RFC 3339 sync timestamps, timestamp freshness, constant-time HMAC comparison, authority-specific credentials, municipal scope, and idempotency by authority + batch ID. The HMAC remains bound to the agreed sender JSON serialization, while the stored idempotency digest is calculated from canonical JSON of the validated/normalized batch, so property ordering does not create a false content conflict. Reuse of a batch ID with different normalized content returns conflict. Accepted payloads are persisted in `async_mirror_inbox` and return HTTP 202 with status `RECEIVED_NOT_PROCESSED`; this confirms durable receipt only, not worker execution. Repeat delivery of the same batch returns the same non-processing receipt until a worker changes the persisted state.

## What happens after receipt

The inbox stores untrusted raw source data with a SHA-256 digest and a queue state. It does **not** yet run AI normalization, create evidence artifacts, map external facilities to RupayKg activities, create measurements, calculate emissions, issue credits, or submit anything to Guardian/Hedera. Those steps require a separate worker and approved, auditable authority/facility/activity mapping. Do not mark a batch PROCESSED until that worker and its retry/dead-letter/reconciliation controls are implemented and tested.

The batch's sync timestamp is source metadata, not proof of when the source record was originally created or independently verified. A SHA-256 digest supports integrity checks but is not a government signature, Guardian verification, Hedera consensus, or Mirror Node proof.

## Non-disruption and operations

- The bridge has no government database connection string or credentials. Prefer source-authorized webhooks, API exports, or replicas with explicit read-only permissions.
- A 02:00–04:00 IST schedule may be agreed with the source operator, but is not hard-coded: the source may have different service windows and timezone configuration.
- Webhooks reduce polling but must be explicitly supported and approved by the source operator; never ask a team to modify a production application without their authorization.
- TLS, source-gateway identity, network allow-listing, rate limits, retention and data minimization, incident response, and production secret storage must be configured at the deployment/gateway layer before live use.
- Before onboarding a real authority, document its data-sharing authority, purpose limitation, permitted fields, retention, consent/legal basis where applicable, security review, API contract, source-of-truth semantics, and operational contact/escalation path.

## Required next Shakti gates

1. Confirm the exact authority, NAPIX/API Setu onboarding status, official API contract and permitted data scope.
2. Implement and test a durable worker: row locking/claiming, bounded batches, retries/backoff, dead-letter status, replay protection, and operational metrics.
3. Map source identifiers to existing RupayKg geography/organization/activity records without guessing; unmatched records remain quarantined.
4. Preserve original payloads as Evidence Vault artifacts and keep normalized AI output as review-only proposals.
5. Add route-level integration tests for signature rejection, allow-list denial, idempotency, duplicate batch ID with altered content, DB failures, queue recovery, and cross-authority isolation.
6. Require authorized human review before authoritative measurements; maintain separate Guardian VERIFIED → Hedera consensus → Mirror Node verification gates before any credit/certificate claims.

No production service, government system, NAPIX gateway, AI provider, or Hedera workflow is activated by this change.
