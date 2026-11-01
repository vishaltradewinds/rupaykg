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

## PostgreSQL connection-reuse test

Added `apps/src/rls-request-transaction-postgres.integration.test.ts`. It uses a one-connection PostgreSQL pool to verify the signed context is visible inside the transaction and cleared after both COMMIT and ROLLBACK before that same pooled connection is reused. This tests transaction-local GUC lifecycle against the disposable CI PostgreSQL service; it does not yet exercise production RLS policies or the API's full authentication path.

## 2026-11-02 canonical token consolidation
- PR #199 and PR #200 initially duplicated `signed-request-context-token.ts` and its tests. The implementations were compared; the core wire-format signer was identical.
- Consolidated the AuthContext-derived helper `createSignedRequestContextForAuth` and its tests into this PR #200 branch. It now rejects missing active organization, unverified membership and bilateral scope until explicit multi-party RLS policy semantics exist.
- Updated `withRlsRequestTransaction` to use the canonical AuthContext helper rather than independently rebuilding actor/organization claims.
- The simpler PR #199 `withSignedRequestDatabaseContext` wrapper is not carried forward; PR #200's transaction wrapper has explicit single-org and bilateral-scope guards, rollback-error handling and pooled-connection discard behavior.
- Exact-head CI #4414 / run `41338613533` passed all steps for head `bc3a7f083a14410ac101d1d5b4d714ed24e63504`: migration validation, full disposable PostgreSQL migrations, typecheck, build, browser smoke, all unit + PostgreSQL integration tests, production container build and cleanup.
- PR #199 is now redundant and will be closed as superseded by PR #200. No production changes; PR #200 remains draft pending independent review and integrated-base CI.
