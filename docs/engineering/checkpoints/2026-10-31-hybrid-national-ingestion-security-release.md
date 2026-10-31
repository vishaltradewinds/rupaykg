# RupayKg hybrid architecture and production security checkpoint

**Date:** 2026-10-31 (UTC)  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `shakti/atomic-inbox-claim-2026-10-31`  
**Parent HEAD before checkpoint commit:** `2bf8e69a54264dab4c9f7eb764181746ffd00f92`  
**Exact-head CI at parent:** run for `2bf8e69a54264dab4c9f7eb764181746ffd00f92` was `in_progress` when last checked; check-run `validate` pending. Prior parent `d36ef5b81c3fcfbfe047f90b5ca8f9d45d9b3934` CI run #3922 / `41214177450` SUCCESS.  
**PR #175:** open/draft, base `main`; PR #161 open/draft, same branch head but stacked base; PR #173 and #160 open/draft separate workstreams. No merge/deploy.

## Architecture decision
- Replaced the binary Option A/Option B decision framing with the hybrid target: national system-level government-source ingestion and organization-scoped downstream workflows.
- National worker may claim the national queue and read approved source snapshots/crosswalk metadata only; no broad private tenant data access.
- It emits minimal dispatch envelopes; tenant-bound downstream processing verifies organization context, membership, authority, statutory rule version and evidence.
- The earlier ADR history is retained; the addendum explicitly supersedes the binary framing.
- Security/compliance sign-off and production release approval remain pending.

## Four requested deliverables recorded
1. Revised architecture ADR: `docs/architecture/ADR-20261031-government-inbox-worker-authority-scope.md`.
2. Production authorization/RLS gap assessment: `docs/security/PRODUCTION_AUTHORIZATION_RLS_GAP_ASSESSMENT_2026-10-31.md`.
3. Database identity/privilege matrix: `docs/security/DATABASE_IDENTITY_PRIVILEGE_MATRIX_2026-10-31.md`.
4. Integrated migration and worker release plan: `docs/engineering/INTEGRATED_MIGRATION_WORKER_RELEASE_PLAN_2026-10-31.md`.

## Live Neon evidence (read-only)
- Sole authoritative live DB remains Neon project `steep-mud-79906940`, branch `main` / `br-restless-base-b44cip2h`, database `rupaykg`.
- Production catalog: 67 public tables; 0 RLS enabled; 0 FORCE RLS; 0 policies; 92 migration ledger rows, max `20261021`.
- All 67 public tables owned by `rupaykg`; direct `organization_id` in 23 tables; direct `identity_id` in 8 tables; 3 overlap.
- No explicit non-owner or PUBLIC table ACL entries in the inspected ACL snapshot.
- Role `rupaykg`: LOGIN, BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION; member of `neon_superuser`. It is not an acceptable routine API/worker principal.
- 115 public functions, 0 SECURITY DEFINER public functions in inspected catalog.
- Production branch protection is OFF; project history retention is 6 hours. Backup/restore proof not established.
- Render runtime role is NOT VERIFIED; Neon inspection identity must not be equated with Render.

## Repository rule strengthened
`AGENTS.md` now mandates a session-start preflight: read latest resume/checkpoint/ADR, verify branch+HEAD+PR+exact-head CI, inspect Neon production authority/RLS/roles/branch protection and Render deployment identity, and record a dated preflight before engineering writes. At session end, update LATEST resume and immutable checkpoint. If exact-head CI is still running, mark pending and recheck.

## Current release posture
- P0/P1 HOLD.
- RLS not implemented; actual Render DB role not verified.
- Production branch unprotected; backup/restore not evidenced.
- National worker not deployed or activated.
- Migration drift still requires production-derived rehearsal and approval.
- No production DDL/DML, role/grant/secret change, branch-protection setting change, migration, worker activation, deployment, or certification was performed in this batch.
- TRL 9 NOT ESTABLISHED.

## Next ordered work
1. Verify backup/restore options and protect main branch only under an explicitly approved, reversible operational change.
2. Obtain actual Render runtime role evidence through a controlled diagnostic path; do not expose secrets.
3. Finish full route × statement × table × operation × principal × tenant-context mapping, including all FK child tables, views, triggers, sequences and function privileges.
4. Design and test table-specific RLS and exact least-privilege role grants on a production-shaped disposable clone.
5. Reconcile the migration chain while preserving production migration 096 verifier provenance.
6. Deploy national worker only after separate least-privilege role, narrow grants, exact service configuration, negative isolation tests, monitoring and independent approval.
7. Implement tenant-scoped dispatch consumer and verify cross-organization denial.
8. Complete regulatory, external integration, operations, field and TRL assurance gates.
