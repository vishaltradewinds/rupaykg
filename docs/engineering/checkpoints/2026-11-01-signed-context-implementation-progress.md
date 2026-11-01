# Signed tenant-context implementation checkpoint — 2026-11-01

## Objective
Implement database-enforced tenant isolation without trusting caller-writable PostgreSQL custom GUCs, while preserving a single authoritative Neon production database and keeping production untouched until all gates pass.

## Completed evidence

### Design and PostgreSQL mechanics
- PR #198: https://github.com/vishaltradewinds/rupaykg/pull/198
- Production inspection found 67 public tables, none with RLS enabled/FORCE RLS; the inspected rupaykg role has BYPASSRLS and elevated privileges.
- A disposable Neon rls_lab schema proved signed actor/organization context, verified membership, row isolation, cross-tenant write rejection, protected key storage, fail-closed invalid contexts, FORCE RLS owner behavior, and the BYPASSRLS limitation.
- Static SQL scan of 16 API modules mapped 52 directly referenced tables; 15 require trigger/worker/migration tracing.

### Application-side primitives
- PR #199: https://github.com/vishaltradewinds/rupaykg/pull/199
- createSignedRequestContextToken produces HMAC-SHA256 signed actor/org/issued/expiry/key-ID envelopes, with UUID validation and a maximum 120-second lifetime.
- createSignedRequestContextForAuth derives claims only from a validated AuthContext and requires a selected VERIFIED membership.
- withSignedRequestDatabaseContext pins BEGIN, transaction-local app.request_context, callback queries, COMMIT/ROLLBACK and PoolClient release to one connection.
- Unit tests cover wire-format compatibility, auth binding, invalid claims and rollback/release behavior.
- Disposable PostgreSQL integration tests prove the context is available within the transaction and cleared after COMMIT and ROLLBACK on pooled connection reuse.
- Exact-head CI #4363 / run 41334659660 passed for commit a07702799dbf8bcfed5b8b853399b062f1cda637.

### Database-side verifier
- PR #201: https://github.com/vishaltradewinds/rupaykg/pull/201
- Migration 20261101_signed_request_context_verifier.sql creates restricted app_security, protected key store and pinned-search-path SECURITY DEFINER verifier.
- Verifier checks envelope structure, actor/org UUIDs, issue/expiry, active key ID and HMAC-SHA256; missing, malformed, expired, unknown-key and forged contexts return NULL.
- PUBLIC schema/table/function privileges are revoked. The migration grants no app-role privileges.
- Disposable PostgreSQL test creates a temporary NOLOGIN/NOBYPASSRLS role and verifies valid claims, invalid-context denial and inability to read the key table.
- Exact-head CI #4364 / run 41335060619 passed for commit 066a1725e3f39872fa02f09cd2cdf5b21307146b.

## Current state
- PRs #198, #199 and #201 remain draft/unmerged; no independent security review has been recorded.
- PR #199 and #201 have full exact-head CI passes.
- No production schema, role, data, secret, DATABASE_URL, deployment or branch-protection changes were made.
- The database verifier is not yet granted to a production runtime role and no production table RLS policies are enabled.

## Mandatory next gates
1. Confirm exact Render service DB role and credential usage without exposing credentials.
2. Provision a dedicated Neon NOBYPASSRLS runtime role and a separately constrained authentication/migration role; no production credential cutover until tested.
3. Provision and rotate HMAC key material out-of-band; document recovery and rotation.
4. Integrate the signed context into Fastify request handling and ensure every tenant query shares one transaction/connection; account for pooled connections and explicit multi-party settlement scope.
5. Trace all 67 tables including triggers, views, workers, sync, scheduled tasks and database-only paths.
6. Implement least-privilege RLS policies for all classified tables and test using the actual runtime login role, not the BYPASSRLS owner.
7. Validate tenant isolation and cross-tenant writes across all routes and asynchronous workflows.
8. Independent security review, non-production deployment, rollback drill and production approval.
9. Reassess TRL only against operational field evidence; this work alone does not certify TRL 9.

## Release decision
**HOLD — engineering primitives and disposable PostgreSQL proofs only.** Production tenant isolation is not yet active or certified.
