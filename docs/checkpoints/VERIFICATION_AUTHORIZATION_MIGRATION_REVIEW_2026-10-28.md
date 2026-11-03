# Verification Authorization Migration — Review Notes (2026-10-28)

## Disposition

**Recovered for evidence only. Not approved for release.** Source commit: `ca8f4100782e13f8d72106187fafc8e1e446214f`; source blob: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`. The follow-up commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` explicitly removed the migration from main as unreviewed. The preserved copy under `scripts/fixtures/legacy-migrations/` is a test fixture, not a release migration.

## Intended security behaviour

The SQL adds authorization provenance columns to `verifications` and replaces `prevent_invalid_verification()` to:
- bind verification evidence to its owning activity;
- reject a mismatch between the submitted activity and evidence activity;
- require an activity with an organization for APPROVED decisions;
- prevent an activity actor from verifying their own evidence;
- require a verified, non-suspended identity with a verified membership in the activity's organization and a recognized verification permission;
- record the membership, role, permissions snapshot, and timestamp used at approval time.

This is consistent with the stricter trigger/function definition observed in the production catalog audit.

## Required independent review before reintroduction

1. **Historical record treatment:** determine how existing APPROVED verification rows with null provenance fields should be classified. Do not fabricate historical snapshots; consider explicit “legacy/unavailable” provenance and audited backfill only where source evidence supports it.
2. **Decision changes:** when an existing row changes from APPROVED to another decision, determine whether authorization snapshot fields should be cleared, retained as historical approval provenance, or represented in an append-only decision history. Current SQL leaves prior snapshot fields on the row if the decision changes away from APPROVED.
3. **Constraint parity:** `ADD COLUMN IF NOT EXISTS ... REFERENCES` will not repair a pre-existing same-named column that lacks the intended foreign key. Validate actual constraints separately; do not rely on the IF NOT EXISTS clause alone.
4. **Trigger identity and privileges:** verify the expected trigger exists exactly once, ownership is correct, app roles cannot bypass it, and table/function privileges match the threat model.
5. **Search-path hardening:** review whether the trigger function should use a fixed safe `search_path` and schema-qualified object names for the deployed privilege model.
6. **Permission semantics:** confirm all three accepted permission spellings are intentionally equivalent, and test role changes, membership revocation/suspension, suspended identities, cross-organization membership, missing activity, missing evidence, self-verification, and non-APPROVED decisions.
7. **Concurrency and auditability:** confirm membership/role updates concurrent with approval have acceptable transaction semantics; establish whether row-level snapshots are sufficient or an append-only audit event is also required.
8. **Forward migration strategy:** do not edit applied history or replay this migration on production. Prepare a reviewed forward migration and explicit validation queries, backup/restore plan, staged rollout, and post-deployment checks.

## Acceptance evidence required

- Unit tests for all positive and negative authorization cases.
- Disposable PostgreSQL integration tests that execute the actual migration and prove constraints/triggers, not only mocked/fake-pool tests.
- Existing approved records inventoried without mutation, with an explicit legacy provenance disposition.
- Canonical production/staging object definition diff after approved changes.
- Independent security review sign-off.

Until these gates are evidenced, production certification and any release depending on this migration remain **HOLD**.
