# RupayKg CTO Run 27 — membership-to-role tenant integrity

**Date:** 2026-11-04  
**Repository:** `vishaltradewinds/rupaykg`  
**Stacked code PR:** [#252](https://github.com/vishaltradewinds/rupaykg/pull/252)  
**Base security PR:** [#247](https://github.com/vishaltradewinds/rupaykg/pull/247)  
**Temporary CI validation PR:** [#254](https://github.com/vishaltradewinds/rupaykg/pull/254) — close after exact-head CI evidence is captured.

## Finding
The database schema originally referenced `organization_memberships.role_id -> roles.id` but did not structurally enforce that the role and membership belonged to the same organization. Multiple application authorization/display queries also joined the role by ID without the organization equality. A malformed membership could therefore associate a role from organization B with a membership in organization A. The verification-specific joins were already bound in PR #247; Run 27 hardens the broader application/schema invariant.

A read-only query against Neon production main (`steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`) found **0 mismatched membership-role pairs**: 0 VERIFIED and 0 PENDING. This is a preventive integrity defect, not evidence of existing production corruption.

## Changes in PR #252
- New forward-only migration `2026110401_membership_role_tenant_binding.sql` creates a unique referenced key on `roles(id, organization_id)`, adds a validated composite FK from `(organization_memberships.role_id, organization_memberships.organization_id)`, and adds a supporting membership-side index.
- The migration checks the existing constraint definition before accepting reapplication and validates the constraint after creation.
- Authentication membership projections, onboarding hierarchy authority checks, and platform-admin authorization/reserved-role/access-change/membership-directory/revocation joins now require `roles.organization_id = organization_memberships.organization_id`.
- Platform-admin unit tests assert the equality in every exercised membership-role authorization query.
- PostgreSQL integration harness reapplies the migration, asserts the exact validated FK, and rejects malformed role binding on INSERT and organization reassignment on UPDATE.

## Exact state and validation
- PR #252 head: `2228100e0da0a1dc9321b11e48f6b2fa4ee6ba33`; OPEN / DRAFT / UNMERGED; base is PR #247 branch `security/verification-authorization-tenant-binding-2026-11-04`.
- PR #247 head `ff75e989fcdef02cbb0719b8aaeb993e506c3a56` remains OPEN / DRAFT / UNMERGED; exact-head CI #5367 passed.
- Local validation on Run-27 worktree: migration validator PASS (93 migrations / 73 schema objects); typecheck PASS; production build PASS; focused platform-admin + auth permission tests 19/19 PASS; `git diff --check` PASS.
- Exact combined-stack CI run #5376 (`41796337375`) completed SUCCESS across all stages: dependency audit, migration validation, fresh PostgreSQL migration, typecheck, production build, browser smoke, full tests including disposable PostgreSQL acceptance, and production-container build.
- Temporary validation-only PR #254 was closed UNMERGED after CI evidence capture. PR #252 remains the authoritative stacked draft.
- PR #254 was used only to run main-branch CI for the exact combined head; it is closed without merging and has no remaining release role.

## Scope boundaries
- Historical database functions from earlier migrations still need a definition/grant/search_path audit; the composite FK now enforces the underlying data invariant for new writes and validates existing rows, but does not replace review of every historical permission function.
- The 67-table RLS programme, global geography fail-closed behavior, dedicated non-owner verification guard, production migration drift, and migrator/runtime separation remain open.
- The composite FK is a candidate migration only; it has not been applied to production.

## Next actions
1. Extend role↔membership tenant-equality review to SQL functions and remaining authorization paths using exact live definitions; do not overwrite recovered migration 096 or blindly replay absent migrations.
2. Rehearse composite FK validation on a production-like disposable copy of the recovered 096 schema/trigger composition and obtain independent DBA review.
3. Continue the dedicated non-owner verification guard prototype under FORCE RLS.

## Release posture
Production Neon remains READ-ONLY / HOLD. No production writes, migrations, grants, ownership changes, RLS activation, deployments, merges, worker activation or certification. PRs #247/#252 remain draft/unmerged. SITE-JBP-01 Kathonda remains PRE-VALIDATION. Production certification and TRL 9 are NOT ACHIEVED.
