# Checkpoint: ICVCM Integration

Checkpoint date: 2026-10-27 (Asia/Kolkata)
Repository: `vishaltradewinds/rupaykg`
Working branch: `feature/icvcm-ccp-integrity-controls`
Pull request: #95 — Add ICVCM CCP integrity controls to RupayKg Carbon OS
PR URL: https://github.com/vishaltradewinds/rupaykg/pull/95
PR state at checkpoint: OPEN, DRAFT, UNMERGED
Production certification: OFF

## Exact resume position

Latest migration-renumbering commit on the working branch:
`467514bed0c9d29d2dd086f89d3bb53a37a7defa`

Previous CI run for the pre-fix commit:
https://github.com/vishaltradewinds/rupaykg/actions/runs/40516522244

Previous CI status: FAILED at `npm run validate:migrations` with duplicate migration number `20261027`. The three timestamp-prefixed migrations have now been renamed to unique ordered migrations 097, 098 and 099, references in `migrations/README.md` and this checkpoint have been updated, and the old duplicate-number files have been deleted. CI has not yet been confirmed on the corrected head; do not assume SQL integration tests have run successfully.

## Batch implemented before checkpoint

- `097_icvcm_ccp_assessments.sql`: append-only internal ICVCM evidence assessment table and organization/activity binding.
- `098_evidence_artifact_chain_binding.sql`: immutable evidence artifact-series identity/scope; exact artifact-version review binding; reviewer must not be uploader; active review and verification permissions required within owning organization.
- `099_vault_content_verification_binding.sql`: stored-byte SHA-256 and byte-length checks; binds artifact to canonical evidence activity/type/hash and binds vault-backed verification to an append-only review by the same verifier and decision.
- `apps/src/evidence-vault.integration.test.ts`: added regression assertions for series reassignment and mismatched artifact-version review.
- `migrations/README.md`: documents these integrity controls and clarifies they do not prove claim truth or statutory acceptance.

## Existing work retained in this PR

The PR already includes the ICVCM Core Carbon Principles catalogue and supplementary integrity benchmark, append-only assessment revisions, India-first regulatory applicability documentation, fail-closed evidence/geography/organization/permission checks, EPR external-confirmation evidence controls, and a series of database provenance and immutability guardrails through migration 096. See the branch history, migration files and PR diff for full implementation details.

## Required next gates (Shakti Standards)

1. Confirm CI reruns on the corrected head; validate migration numbering and ordering.
2. Rerun migration validation and inspect failures rather than weakening checks.
3. Run full build/unit tests and disposable-PostgreSQL integration suite against the latest head.
4. Review new SQL triggers for ordering/schema correctness and verify evidence-vault route/review/verification transaction behavior.
5. Audit evidence artifact version deletion/reassignment, review and verification history, and cross-organization bindings with PostgreSQL regression tests.
6. Verify latest CI commit SHA matches PR head; record actual result.
7. Keep PR open/draft/unmerged until required review and validation gates are satisfied.
8. Keep production certification OFF. No claim of regulatory approval, independent verification, live-environment readiness, or achieved TRL without evidence.

## Safety and scope

RupayKg is a greenfield, pan-India platform. Preserve historical evidence; corrections should append new records rather than rewriting the evidentiary basis. ICVCM remains a voluntary supplementary integrity benchmark and must not replace applicable Indian statutory requirements. Do not invent test passes or skip Shakti Standards gates.
