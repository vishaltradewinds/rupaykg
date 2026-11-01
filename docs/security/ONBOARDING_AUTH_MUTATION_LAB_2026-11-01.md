# Auth-scoped onboarding mutation lab — 2026-11-01

## Scope and safety
- Work is on PR branch `shakti/auth-bootstrap-application-integration-2026-11-01` and disposable Neon branch `br-polished-darkness-b4u7db1a`, cloned from production.
- No production schema, data, credentials, Render configuration, deployment, or RLS settings were changed.
- Production certification remains OFF. This lab is not production approval.

## Implemented in PR branch
- Added `migrations/20261026_auth_scoped_onboarding_mutations.sql`.
- Adds dedicated NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS auth owner/runtime roles.
- Adds token-hash-bound SECURITY DEFINER create and withdraw functions. The identity is derived from a live, unrevoked, unexpired session; caller cannot choose an identity.
- Enforces allowlisted stakeholder role mapping and requires legal identity/evidence fields for non-individual applicants.
- Creates pending organization, role, membership, optional geography scope/evidence, and application atomically.
- Withdrawal is scoped to the session identity and pending application; it marks the pending membership/geography scope and organization rejected/withdrawn rather than deleting records.
- Functions use a restricted search_path and schema-qualified table references.
- Corrected existing governance/hierarchical trigger function search paths and qualified referenced tables.

## Lab execution findings
- Migration DDL and role/function creation applied successfully to the disposable Neon branch.
- A synthetic verified identity and session were created on that disposable branch.
- First create call inserted one pending application, demonstrating that the function reached its write path.
- A subsequent create attempt correctly failed with `APPLICATION_EXISTS`.
- Withdrawal through the auth runtime role then failed with `permission denied for table identities`. This is an unresolved execution-context/trigger privilege issue. Do not treat withdrawal as passed.
- Trigger search-path errors were encountered and trigger definitions were hardened; full create/withdraw regression must be rerun after resolving the remaining permission failure.
- Runtime role direct table access, negative authorization cases, trigger side effects, and rollback behavior have not yet all been independently verified.

## Required before this migration can be considered complete
1. Identify exact execution context causing the identities privilege failure (function owner, nested trigger execution, FK/trigger path); fix least-privilege grants or function design without broad grants.
2. Rerun create + withdraw using the actual auth runtime role and assert all affected records and trigger-generated approval-chain/governance rows.
3. Test expired/revoked/unknown sessions, another identity's application, unsupported role, incomplete legal evidence, duplicate pending application, and concurrent duplicate submissions.
4. Verify no direct auth-table privileges for runtime role and no privilege escalation via role membership.
5. Add automated disposable-Postgres migration and route integration tests, including rollback and idempotent migration behavior.
6. Reconcile migration ordering and function inventory against production schema; review email verification (the lab's existing registration behavior must not imply unverified identities are verified).
7. Only then update PR CI and request independent security review. No production role provisioning, migration, RLS enablement, merge, or deploy is authorized by this lab.

## Current status
**Engineering in progress — not production-ready.** PR #192 remains draft/open. No production mutation was performed.
