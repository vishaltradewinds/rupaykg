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


## Additional lifecycle guardrails retained from the migration history

The following behaviors are documented to help reviewers understand the purpose of the existing migration files. Always inspect the named SQL migration and exact target schema before relying on a statement as deployed fact.

### Settlement truth and credential retirement

A settlement may enter `SETTLED` only when the authoritative settlement record contains an external settlement reference, an external-authority confirmation timestamp, and a reconciliation reference. These fields cannot be cleared after confirmation. Internal workflow transitions alone must never be treated as proof that funds moved.

A credential in `RETIRED` state cannot be used to create a settlement. A credential cannot be retired while it has an open settlement (`CREATED`, `AUTHORIZED`, `EXECUTING`, or `RECONCILING`). These lifecycle constraints are intended to be enforced at the PostgreSQL boundary, not only in HTTP routes.

### Guardian, Hedera and Mirror Node acceptance

Migration `083_mrv_mirror_node_registry_gate.sql` adds the persisted `mirror_node_verified_at` acceptance marker and tightens the PostgreSQL credential-issuance trigger. A Guardian `VERIFIED` result and Hedera `CONSENSUS_CONFIRMED` response are not sufficient by themselves; the exact anchored payload must also be successfully verified through Mirror Node. Existing provenance rows remain ineligible until that verification is performed. The authenticated Mirror Node verification endpoint checks the exact payload/hash and persists the marker only if the anchored tuple has not changed during verification. Credential issuance requires that persisted marker, and PostgreSQL independently checks it on inserts and transitions into value-bearing credential states.

### Platform-admin audit chain

Migration `084_platform_audit_chain_head.sql` bootstraps a singleton chain head using the latest existing audit row as a migration-time anchor. Older audit writers do not all participate in the platform-admin chain, so the bootstrap is not a certification of the entire historical audit table. After cutover, platform-admin appends lock the head row inside the same transaction, use its hash as the predecessor, insert the event, and advance the head atomically. Append order therefore does not depend on transaction-start timestamps or random UUID ordering. A failed transaction rolls back both event and head update. Audit events are append-only; tests must not delete them or rewind the head.

### Reserved-role dual control and restoration

Migration `085_platform_access_dual_control.sql` records requests to grant reserved platform roles or restore a revoked reserved-role membership. The request and decision are separately authenticated, require distinct active Super Admin requester and approver identities, prohibit the target identity from approving its own change, revalidate the target and role at decision time, apply the membership change in the same transaction as approval, and append a hash-linked audit event. Ordinary membership grant and restoration routes remain blocked for reserved roles.

Migration `086_reserved_role_restoration_db_guard.sql` protects status reactivation of a revoked `super_admin` or `platform_admin` membership. It requires a matching approved dual-control request, a different requester and approver, a target distinct from both, active Super Admin authority for requester and approver, and a request created after the revocation. Ordinary reserved-role grant/restoration APIs remain blocked; new grants are applied only by the authenticated dual-control workflow. Initial Super Admin bootstrap is an out-of-band privileged provisioning step and is not exposed through the ordinary API.

### Acceptance fixture exclusion

Migration `087_acceptance_fixture_registry_exclusion.sql` prevents activities or evidence explicitly marked with `metadata.acceptanceFixture=true` from backing credentials in value-bearing states. It also binds the database gate to the exact activity, verification, and evidence tuple. The MRV API reports acceptance fixtures as not registry eligible even after real Guardian/Hedera/Mirror Node verification. External anchoring proves message integrity and consensus; it does not validate the underlying activity as a real eligible carbon project.

### Catalog maintenance rule

The SQL filenames and their content are the authoritative migration catalog. Avoid maintaining a partial hand-written numbered list that silently stops at an old migration. If a human-readable catalog is needed, generate or validate it from the repository inventory in CI and include intentional gaps and date-stamped migrations. The unresolved migration 096 issue described above must remain an explicit blocker until the production target and artifact provenance are established.
