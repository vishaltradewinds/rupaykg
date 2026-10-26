# Database migrations

Apply migrations in filename order against a fresh PostgreSQL database:

1. `001_core.sql` — authoritative core entities and lifecycle enums.
2. `002_regulatory.sql` — versioned regulatory source catalog; this historical seed migration is immutable and later provenance corrections belong in subsequent migrations.
3. `003_identity_geography_operations.sql` — source-versioned geography, identity credentials, assignments and offline operation intake.
4. `004_security_auth.sql` — organization memberships and opaque identity sessions.
5. `005_carbon_epr_esg.sql` — carbon projects/calculations, EPR and ESG reporting records.
6. `006_registry_settlement_guardrails.sql` — database-level issuance and settlement safety guards.
7. `007_resource_flow_mrv.sql` — resource custody links and MRV observation/verification requirements.
8. `008_verification_integrity.sql` — independent verifier authorization and verification integrity controls.
9. `009_field_sync.sql` — durable offline field envelopes, conflicts and cursors.
10. `010_integrity_controls.sql` — tamper-evident registry/settlement event hashing and append-only guards.
11. `011_field_sync_application.sql` — authoritative entity-application metadata for field envelopes.
12. `012_geography_authorization.sql` — organization geography roots and database-enforced descendant scope.
13. `013_settlement_external_confirmation.sql` — external authority confirmation and reconciliation gates before settlement finalization.
14. `014_registry_settlement_idempotency.sql` — idempotency constraints for registry and settlement mutations.
15. `015_high_risk_action_permissions.sql` — explicit high-risk action permissions for registry and settlement operations.
16. `016_field_device_enrollment.sql` — field-device enrollment and lifecycle controls.
17. `017_field_device_provenance.sql` — field-device provenance metadata and integrity controls.
18. `018_value_mutation_permissions.sql` — authorization boundaries for value-layer mutations.
19. `019_settlement_reconciliation_immutability.sql` — immutable settlement reconciliation evidence and state controls.
20. `020_carbon_calculation_provenance.sql` — evidence-bound carbon calculation provenance.
21. `021_methodology_governance.sql` — methodology source lock, applicability/parameter/equation mapping and production-eligibility governance.
22. `022_carbon_provenance_integrity.sql` — database integrity controls for carbon provenance.
23. `024_methodology_governance_immutability.sql` — forward-only methodology governance and immutable mapped/reconciled state.
24. `025_methodology_reconciliation_evidence.sql` — independent numerical reconciliation and regression-verification evidence required for production eligibility.
25. `026_regulatory_source_provenance.sql` — exact verified official-source corrections and verification dates for regulatory records; does not rewrite the historical seed migration.
26. `027_verification_permission_guard.sql` — database verification authorization guard requiring explicit `VERIFY_EVIDENCE` permission rather than legacy role-name elevation.
27. `028_settlement_retired_credential_guard.sql` — prevents settlement creation for retired credentials and prevents retirement while an attached settlement remains open.

Migration `023` is intentionally absent from the current repository history; do not renumber later migrations to fill the gap. Migration numbering is identity, not a requirement for contiguous integers.

Migration files are intentionally ordered and each numbered migration must have one authoritative owner. Do not reintroduce duplicate numbered migrations containing the same tables or enums.

Migration `088_waste_custody_event_integrity.sql` extends the existing `chain_of_custody_links` ledger with typed, idempotent custody-event provenance, server-assigned per-flow sequence numbers, separate occurrence and recording timestamps, measured-quantity provenance, reason/supersession references, evidence references, event hashes, and database-enforced append-only behavior for typed events. New untyped custody-link inserts are rejected; pre-existing legacy rows remain readable and are not retroactively rewritten. The online API and offline field-sync application are wired to the typed contract, but PostgreSQL migration execution and database-backed integration tests must pass before operational use. The migration does not add a parallel ledger or authorize any regulated activity.

## Production rule

A migration runner must stop on the first error. Never silently continue after a partial schema application. Run against a controlled migration ledger in deployment infrastructure before accepting application traffic.

Verification requires a verified organization membership with an explicit `VERIFY_EVIDENCE` permission (or one of its documented aliases). Role names such as `VERIFIER`/`AUDITOR` are not privilege grants, and an activity actor cannot approve their own evidence. Registry and settlement event hashes are generated by PostgreSQL from canonical event fields rather than trusting caller-provided hashes.

## Field-sync application rule

Receiving an offline envelope does not mutate authoritative business state. An envelope is applied only through an explicit authenticated application step. Supported operation types are deliberately allow-listed: `ACTIVITY_CREATE`, `MEASUREMENT_CREATE`, `EVIDENCE_CREATE`, and `RESOURCE_FLOW_CREATE`. The domain mutation and envelope status change commit in the same database transaction; failures roll back both.

## Geography authorization rule

An organization may have explicit verified geography roots. When roots exist, activities and resource flows are accepted only when their geography is the assigned root or a descendant of an assigned root. This is enforced in PostgreSQL so API and offline paths cannot bypass the authorization boundary. Organizations without configured geography roots remain governed by their existing organization-membership authorization until scopes are provisioned.

## Settlement truth rule

A settlement may enter `SETTLED` only when the authoritative settlement record contains an external settlement reference, an external-authority confirmation timestamp, and a reconciliation reference. These fields cannot be cleared after confirmation. Internal workflow transitions alone must never be treated as proof that funds moved.

A credential in `RETIRED` state cannot be used to create a settlement. A credential cannot be retired while it has an open settlement (`CREATED`, `AUTHORIZED`, `EXECUTING`, or `RECONCILING`). These lifecycle constraints are enforced at the PostgreSQL boundary rather than relying only on HTTP route behavior.

## Guardian/Hedera registry acceptance migration

Migration `083_mrv_mirror_node_registry_gate.sql` adds the persisted `mirror_node_verified_at` acceptance marker and tightens the PostgreSQL credential-issuance trigger. A Guardian `VERIFIED` result and Hedera `CONSENSUS_CONFIRMED` response are not sufficient by themselves; the exact anchored payload must also be successfully verified through Mirror Node. Existing provenance rows remain ineligible until that verification is performed. The authenticated Mirror Node verification endpoint checks the exact payload/hash and persists the marker only if the anchored tuple has not changed during verification. Credential issuance requires that persisted marker, and PostgreSQL independently checks it on inserts and transitions into value-bearing credential states.

## Platform-admin audit chain head

Migration `084_platform_audit_chain_head.sql` bootstraps a singleton chain head using the latest existing audit row as a migration-time anchor. Older audit writers do not all participate in the platform-admin chain, so the bootstrap is not a certification of the entire historical audit table. After cutover, platform-admin appends lock the head row inside the same transaction, use its hash as the predecessor, insert the event, and advance the head atomically. Append order therefore does not depend on transaction-start timestamps or random UUID ordering. A failed transaction rolls back both event and head update. Audit events are append-only; tests must not delete them or rewind the head.

## Reserved-role dual control

Migration `085_platform_access_dual_control.sql` records requests to grant reserved platform roles or restore a revoked reserved-role membership. The request and decision are separately authenticated, require distinct active Super Admin requester and approver identities, prohibit the target identity from approving its own change, revalidate the target and role at decision time, apply the membership change in the same transaction as approval, and append a hash-linked audit event. Ordinary membership grant and restoration routes remain blocked for reserved roles.


## Reserved-role restoration guard

Migration `086_reserved_role_restoration_db_guard.sql` protects status reactivation of a revoked `super_admin` or `platform_admin` membership. It requires a matching approved dual-control request, a different requester and approver, a target distinct from both, active Super Admin authority for requester and approver, and a request created after the revocation. Ordinary reserved-role grant/restoration APIs remain blocked; new grants are applied only by the authenticated dual-control workflow. Initial Super Admin bootstrap is an out-of-band privileged provisioning step and is not exposed through the ordinary API.


## Acceptance fixture registry exclusion

Migration `087_acceptance_fixture_registry_exclusion.sql` prevents activities or evidence explicitly marked with `metadata.acceptanceFixture=true` from backing credentials in value-bearing states. It also binds the database gate to the exact activity, verification, and evidence tuple. The MRV API reports acceptance fixtures as not registry eligible even after real Guardian/Hedera/Mirror Node verification. External anchoring proves message integrity and consensus; it does not validate the underlying activity as a real eligible carbon project.
