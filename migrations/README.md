# Database migrations — authoritative policy

## Current inventory and critical discrepancy

The current `main` source inventory contains 91 SQL migration files: numbered migrations `001`–`087` (with intentional numbering gaps) plus four date-stamped migrations `20261018`–`20261021`. Migration `096_verification_authorization_provenance.sql` is **not present on current main**.

Read-only Neon inspection on 2026-10-30 found:
- Neon main ledger: 92 rows, including version `096` / filename `096_verification_authorization_provenance.sql`, applied at `2026-10-27T13:46:14.262221Z`.
- The expected four authorization snapshot columns and the authorization snapshot logic were present on Neon main.
- Staging and rehearsal each had 95 ledger rows, no version 096, and lacked those four columns.
- Staging and rehearsal recorded migrations `20261022`–`20261025` at `2026-10-20T10:48:38.647496Z`, before the dates encoded in those filenames.

**This is an unresolved source/ledger divergence. Production HOLD; scheduler OFF; certification HOLD/OFF. Do not run migrations to “make counts match,” delete/rewrite history, or infer the deployed database target from a matching timestamp.** See [Current Source of Truth](../docs/CURRENT_SOURCE_OF_TRUTH.md) and [Issue #145](https://github.com/vishaltradewinds/rupaykg/issues/145).

## Candidate-branch identity collision — unresolved

Unmerged PR branches #104 and #106 each contain `096_epr_acceptance_evidence_immutability.sql` (Git blob `28ea4b350fe5074d2e59e59fc38c714019d00c10`) and `102_verification_authorization_provenance.sql` (Git blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`). That second blob is identical to the historical `096_verification_authorization_provenance.sql` retrieved from commit `ca8f410...`. Candidate branches therefore use migration number 096 for a different migration and renumber the authorization-provenance migration to 102. These branches contain broader, differing implementation work, so do not classify them as safe duplicates or close/delete them without full diff and dependency review.

This is a candidate-history conflict, not permission to modify the production ledger. No candidate sequence is authoritative until migration identity, source history, observed production/staging ledger and exact deployment provenance are reconciled. Do not merge, replay, rollback, or renumber migrations to force a match.

## Migration authoring rules

1. Migration filenames and content are historical identity. Never edit, renumber, reuse, or delete a migration that may have been applied.
2. Numbering gaps are allowed; identity does not require contiguous integers.
3. Each migration must have one authoritative owner. Do not introduce duplicate numbered migrations that create the same tables, enums, indexes, triggers or functions.
4. Add forward-only migrations for reviewed schema changes. Keep statutory/regulatory corrections source-versioned and evidence-backed.
5. The migration runner must acquire the required PostgreSQL advisory lock and validate the entire ledger/inventory relationship before applying SQL or bootstrap DDL.
6. Stop on the first error. Never silently continue after partial schema application.
7. Never accept traffic after an unsuccessful or partially applied migration.
8. Production/staging recovery requires authorized read-only evidence, a reviewed reconciliation plan, tested recovery steps and explicit approval.

## Validation

Use the repository's `npm run validate:migrations` and the CI workflow's disposable PostgreSQL migration/integration checks. Confirm the exact commit SHA tested. A clean disposable database proves that candidate migrations run in that test environment; it does not prove historical production provenance or the exact artifact deployed.

## Authorization and verification invariants

Verification approval must require active, verified organization membership and explicit permission; role names alone are not privilege grants, and an activity actor cannot approve their own evidence. Decision-time authorization provenance must be retained where the applicable schema implements it. Verify these controls against the exact target branch and deployed artifact before making release claims.

## Field-sync application rule

Receiving an offline envelope does not mutate authoritative business state. Apply an envelope only through an explicit authenticated application step. Supported operation types are deliberately allow-listed. The domain mutation and envelope status change must commit in the same database transaction; failures roll back both.

## Geography authorization rule

Where an organization has verified geography roots, activities and resource flows must be constrained to the assigned root or a descendant. Validate scope server-side; do not rely on UI filtering.
