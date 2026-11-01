# RLS Request Transaction Boundary — 2026-11-01

## Status

Engineering primitive added in draft PR #200. This is not an application-wide RLS integration or production release gate pass.

## Implemented

- `apps/src/rls-request-transaction.ts` adds `withRlsRequestTransaction`.
- Actor and organization claims are sourced from the authenticated `AuthContext`; caller-controlled request fields are not accepted by this boundary.
- Active organization must exist and match a `VERIFIED` membership.
- Bilateral settlement requests fail closed until multi-party RLS context semantics are designed and tested.
- A single pooled client is acquired, transaction begins, signed HMAC request context is set using transaction-local `set_config(..., true)`, callback executes, transaction commits or rolls back, and client is released.
- Unit tests cover transaction ordering, signed token wire format, rollback/release and fail-closed missing/pending/bilateral contexts.

## Integration gaps — remain blocking

1. Existing route modules still issue direct `pool.query` calls and some use direct `pool.connect`; they do not yet use this boundary.
2. Authentication bootstrap currently queries identity/session/membership tables using the same supplied pool. A separate, least-privilege auth bootstrap path is required before the runtime role can be made `NOBYPASSRLS`.
3. API signing-key delivery and DB verifier key-store synchronization/rotation are not yet wired.
4. Route-level request context and connection-pool reuse acceptance is not yet implemented.
5. All 67 public tables, database triggers, background workers and multi-party settlement paths still require policy classification and tests under the real NOBYPASSRLS runtime login.

## Safety

No production DB schema, role, secret, deployment or data changes. The PR is draft. Production release remains HOLD until all integration gaps and independent review are complete.
