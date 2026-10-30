# RupayKg migration and release-gate PR dependency map

**Snapshot:** 2026-10-30 20:49 UTC  
**Repository:** `vishaltradewinds/rupaykg`  
**Purpose:** reduce overlapping review paths without deleting unique implementation, changing production, or treating CI as release authorization.

## Current release boundary

**Production HOLD · scheduler OFF · certification HOLD/OFF.** No migration replay, rollback, renumbering, ledger editing, merge, or deployment is authorized by this map. Neon/Render findings are read-only. The Render-to-Neon target and immutable artifact/SQL-byte provenance remain unproven.

## Canonical dependency lanes

| Lane | PRs / refs | Relationship and disposition |
|---|---|---|
| Migration catalog/history guard | #134 `shakti/canonical-migration-history-verified` → #146 (history conflict fixtures), #148 (preflight order + advisory lock), #147 (CI routing to feature base) | Treat #134 as the current parent candidate, not as production truth. Review each child against the exact parent SHA. #146 adds fixtures for observed main/staging discrepancies; #148 hardens preflight ordering/locking; #147 changes workflow routing only. These are complementary, not interchangeable. |
| Dual-ledger acceptance / test-host safety | #108 `shakti/dual-ledger-compatibility-tests` → #115 `shakti/guard-disposable-db-tests` (same head commit as #131, but stacked base); #131 is the main-targeted validation candidate | #115 and #131 point to the same head SHA `3a0f88e0546c2379edaedbf91a1fd038456ed553` but have different bases, so their PR diffs and purpose differ. Keep #131 as the main-targeted validation surface and #115 as a stacked review surface until dependency/test coverage is reconciled. Do not merge both blindly. The loopback-only host guard is important because acceptance scripts create/drop disposable schemas. |
| Earlier migration runner candidate | #124 `integration/migration-runner-p0-reconciliation` based on `ci/migration-p0-validation-path`; #107 orphan guard; #105 validator hardening; #56/#46 locking/TLS; #38 earlier migration work | Overlapping history. Preserve until per-file diff and dependency comparison establishes a successor. Do not choose based on PR age or title alone. #105 adds collision validation but does not resolve historical source/ledger divergence. |
| ICVCM/product integration with migration collision | #97 integration; #102 Guardian/Mirror Node hardening; #104 synthetic-candidate validation only; #106 combined diagnostic candidate; #105 migration validator | #97 contains potentially valuable product/security work, but its candidate migration set must not be merged until identity conflict is resolved. #104 explicitly says validation-only/do not merge. #106 is a diagnostic combined candidate, not a merge target. #104 and #106 differ materially; do not close either as a duplicate merely because both reference #97. |
| Authorization decision provenance | #139 forward-fix fixture proposal; #140 main-based regression/forward-fix gate | Distinct bases and scopes. Compare the trigger semantics and test assertions before selecting a single forward-only correction. Do not create a numbered migration until the applied migration identity and target branch are authoritatively reconciled. |
| Worker lease recovery (adjacent but separate) | #142 recovery implementation → #149 null-lease reconciliation correction → #150 PostgreSQL regression; #143 CI routing; #122 older worker test | #149 and #150 are stacked on #142's recovery head. #144 was closed as superseded by #149. #122 is older/stale-base coverage and must be compared with #150 before any further closure. Do not merge the stack without base/CI and integration review. |

## Provenance discrepancy to close first

Read-only observations recorded in [Current Source of Truth](CURRENT_SOURCE_OF_TRUTH.md) and [Issue #145](https://github.com/vishaltradewinds/rupaykg/issues/145):

1. Render logs report migration 096 applied around `2026-10-27T13:46:15Z`.
2. Neon main records `096_verification_authorization_provenance.sql` at `2026-10-27T13:46:14.262221Z` and has the expected authorization snapshot columns/trigger logic.
3. Current `main` does not contain that filename; the historical SQL recovered from commit `ca8f4100782e13f8d72106187fafc8e1e446214f` has Git blob ID `258b1f4534efbf915688f78aa84d4ec24a47cbc0`. A Git blob ID is not the SQL file's SHA-256.
4. Staging/rehearsal show different migration inventories and omit those columns. Their early timestamps for date-stamped migrations need separate investigation.
5. PR candidate branches #104/#106 assign version 096 to `096_epr_acceptance_evidence_immutability.sql` and place the historical authorization-provenance SQL at version 102. The branches have different overall diffs and divergent histories.

### Required evidence sequence

1. Obtain an authorized, metadata-only confirmation that Render's configured database target is this exact Neon project/branch/database; never expose or print secret values.
2. Preserve Render build/deploy event records and identify the immutable deployed image/artifact digest.
3. Recover exact SQL bytes from that immutable artifact or equivalent authoritative release artifact; calculate SHA-256 and compare against repository candidates. Do not substitute a Git blob ID for a file digest.
4. Independently reconcile main, staging, and rehearsal ledger/catalog/schema differences, including date-stamped migration timestamps.
5. Run the chosen migration guard and relevant fixture/integration suites against isolated disposable PostgreSQL on the exact candidate SHA.
6. Obtain independent database/security review and explicit release approval before any production remediation.

## Cleanup rules for this inventory

- Keep implementation PRs open until a reviewed successor demonstrably contains their unique changes and tests.
- Close validation-only or superseded PRs only when evidence and successor links are recorded.
- Do not delete branches solely because refs match; confirm no PR, automation, or deployment dependency and use a supported write path.
- Record exact head/base SHA and CI run for each decision.
- A green CI run validates only the tested commit and environment. It does not establish historical production SQL-byte provenance, statutory acceptance, TRL, or certification.

**Current next action:** continue evidence gathering for Render target/artifact provenance while reviewing the migration guard stack in dependency order. Do not merge or deploy as part of cleanup.
