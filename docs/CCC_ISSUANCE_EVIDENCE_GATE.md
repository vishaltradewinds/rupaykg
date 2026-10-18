# Carbon Credit Certificate issuance evidence gate

**Purpose:** Prevent a calculated MRV result or internal review count from being represented as an issued Carbon Credit Certificate (CCC).

## Rule

A calculation has status `CALCULATED_PENDING_VERIFICATION`. It is not an issued credit. An internal verification count, local workflow stage, or user-entered certificate reference is not evidence of official issuance.

The carbon domain helper now returns true for an issuance claim only when:
- the external lifecycle state is `ISSUED`;
- evidence is marked `VERIFIED` by a trusted server-side review/integration;
- the authority name, official HTTPS source URL, issuance reference, verification record ID and verification timestamp are present; and
- the evidence artifact has a valid SHA-256 digest.

This helper is a domain guard, not an authentication mechanism. A client must never be allowed to set `verificationStatus=VERIFIED` or write an official issuance state directly. Only a trusted server-side verification workflow may construct accepted evidence after checking an authoritative source or a documented authorized review.

## Scope and limits

This is an internal control to prevent a known semantic error: the previous `isIssuableCarbonValue` helper treated a pending calculation plus any positive verification count as issuable. That behavior has been removed.

This does not connect to BEE, the Indian Carbon Market registry, or any government certificate endpoint. It does not prove that a certificate exists, validate ownership/transfer/retirement, or certify methodology calculations. Those require a separately authorized official evidence workflow and server-side permission tests.

## Acceptance tests

- Pending calculations cannot be reported as issued, even when issuance evidence is supplied.
- `ISSUED` without evidence fails closed.
- Unverified evidence, malformed artifact hash, non-HTTPS source, or missing verification record fails closed.
- Only complete, explicitly verified evidence can pass this domain predicate.
