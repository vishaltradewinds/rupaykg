# Verification trigger guard-role proof

**Status:** disposable PostgreSQL design proof only; not a production role migration, deployment instruction, or approval.

## Why this exists

The candidate verification trigger uses SELECT ... FOR SHARE as SECURITY INVOKER. PostgreSQL requires the executing role to have UPDATE privilege on at least one column of each relation it row-locks. Granting broad UPDATE to the API role would create an unacceptable mutation surface.

The CI proof in 'scripts/test-verification-guard-role.sql' tests a narrower alternative:

- API role: NOLOGIN, NOBYPASSRLS, no table ownership, no direct SELECT on evidence/authorization tables, no UPDATE on roles, and no membership in the helper role.
- Trigger owner: separate NOLOGIN, NOSUPERUSER, NOBYPASSRLS role; not owner of the protected tables.
- Helper owner privileges: SELECT plus column-scoped UPDATE(id) on only the rows it must lock. This is sufficient for the proof's FOR SHARE clauses without granting table-wide UPDATE.
- Trigger function: SECURITY DEFINER, fixed search_path, schema-qualified object references, and a narrowly scoped trigger entry point.
- RLS: enabled on the proof's tenant-owned tables; the helper role has explicit tenant-filtered SELECT and UPDATE policies for the row-lock operation, and does not bypass RLS. The first CI attempt demonstrated that SELECT policies alone are insufficient for this locking path.
- The API role can insert a decision only through the trigger; the trigger resolves evidence/activity organization, validates active explicit verifier permission, and writes authorization provenance.

## Acceptance boundary

The test proves PostgreSQL privilege mechanics for this isolated schema on the CI PostgreSQL version. It is deliberately not evidence that the current RupayKg schema can safely adopt the pattern.

Before any candidate migration can be approved, the design must still be adapted and tested against the exact RupayKg catalog, including:

1. Actual API runtime role identity and exact grants.
2. Actual table ownership and RLS/FORCE RLS policies for evidence, activities, memberships, roles, identities, organizations and geography.
3. A trusted tenant-context model; a caller-controlled session setting must not be treated as authenticated authority.
4. Organization verification/suspension and geography-scope concurrency, with a documented global lock order.
5. Append-only decision protections against UPDATE, DELETE, TRUNCATE, owner/replication paths, and linked superseding decisions.
6. Exact production-compatible tests using the intended runtime role, with no broad API UPDATE grants.
7. Independent DBA/security review.

The CI test uses a minimal fixture model. It does not establish production RLS policy correctness, runtime identity, tenant isolation, full concurrency safety, production migration readiness, or TRL 9.

## Execution safety

The workflow runs this script only against the ephemeral GitHub Actions PostgreSQL service. It creates and drops test-only roles and a test-only schema in that disposable database. It does not connect to Neon, Render, or any persistent environment.
