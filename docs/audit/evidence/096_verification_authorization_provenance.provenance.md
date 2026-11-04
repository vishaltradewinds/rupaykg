# Recovered migration 096 — archival evidence only

**Status:** Recovered verbatim from Git history; not an active migration and not approved for execution.

## Provenance
- Original path: `migrations/096_verification_authorization_provenance.sql`
- Introducing commit: `ca8f4100782e13f8d72106187fafc8e1e446214f`
- Original Git blob SHA: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`
- Removal commit: `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`
- Original commit message: “Bind verification to organization and snapshot authority”
- Removal commit message: “Remove accidentally placed unreviewed verification migration from main”
- Production ledger evidence recorded in issue #214: the production ledger contains this migration filename, applied at `2026-10-27T13:46:14.262Z`.

## Handling rule
The adjacent SQL file is retained byte-for-byte as historical evidence. It MUST NOT be placed in the active `migrations/` directory, replayed, or treated as the current authorization implementation. The current forward-only security correction is being independently reviewed in PR #247 and its dependent changes. The recovered migration's trigger is materially weaker than the current candidate: it only constrains the role through the membership's organization ID filter, does not bind `roles.organization_id`, does not lock authorization rows, does not require a VERIFIED organization, and does not establish the current immutable decision policy.

## Reconciliation still required
1. Compare the original blob and recovered file by Git blob identity/checksum during independent review.
2. Reconcile the production ledger row, exact deployed SQL, function/trigger definitions and deployment provenance without changing production.
3. Keep staging-only migrations 20261022–20261025 separate until exact sources and schema effects are recovered.
4. Do not rewrite the production ledger or replay migration 096.
