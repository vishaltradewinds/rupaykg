# Field Device Principal and Sync Transaction Controls — 2026-10-31

## Scope

This review and implementation batch covers `apps/src/sync-routes.ts` on PR #157. It is a narrow hardening step for device-to-organization binding. It does not establish a dedicated PostgreSQL device role or prove complete sync isolation.

## Implemented controls

1. Removed the pre-transaction `requireFieldDevice(pool,...)` check from sync-envelope intake.
2. Intake now checks out one client, begins a transaction, and locks the device row with `FOR UPDATE` while checking:
   - supplied device UUID;
   - authenticated identity ownership;
   - VERIFIED device status;
   - device organization equals the active organization selected by the authenticated session.
3. Envelope application now locks the envelope and joined device row in one query, requiring:
   - envelope identity equals authenticated identity;
   - device identity equals envelope identity;
   - device remains VERIFIED;
   - device organization equals the authenticated active organization.
4. `applyOperation` receives the organization obtained from the locked database device row; it does not derive device organization from payload.
5. `ACTIVITY_CREATE` and `RESOURCE_FLOW_CREATE` require payload organization to equal the locked device organization.
6. `MEASUREMENT_CREATE` and `EVIDENCE_CREATE` resolve the referenced activity only when its organization equals the locked device organization. This prevents a device enrolled for one organization from using an activity belonging to another organization.
7. Existing permission and geography checks remain in the same checked-out client transaction as the authoritative write. Idempotency, sequence collision, cursor lock, envelope persistence and device last-seen update remain in the intake transaction.

## Security boundary and limitations

- This is still an authenticated human identity plus a verified field-device record, not a cryptographically independent device principal. The bearer session is required. Device key attestation, signed payloads, key rotation/revocation and hardware-rooted identity are not implemented by this change.
- Enrollment and verification remain separate management workflows. The code does not create a separate PostgreSQL device login/role.
- The database transaction helper is not applied here because the sync protocol is device-principal and multi-step; the route uses an explicit checked-out client and row locks. RLS remains disabled.
- The field device's organization is verified from the database row, never trusted from an envelope organization field. Application operations are constrained to that organization.
- The route-level identity check does not replace an independent review of unique constraints, foreign keys, trigger behavior, queue replay, and transaction isolation.
- Conflict listing/resolution and device inventory endpoints still need a complete query-by-query tenant/device access review. Worker ingestion is a separate trust domain and remains OFF.

## Required next gates

1. Add integration tests for: wrong identity/device pair, pending/revoked device, wrong active organization, payload organization spoofing, foreign-organization activity ID, replay after device revocation, idempotency-key conflict and client-sequence collision.
2. Verify schema uniqueness and FK constraints for `field_devices`, `field_sync_envelopes`, `field_sync_cursors`, and `field_sync_conflicts`.
3. Decide cryptographic device authentication (per-device signing key, key custody, rotation, revocation and offline signature verification) before treating the device as an independent principal.
4. Create a separate least-privilege worker role for async mirror inbox processing; prove no web runtime role can claim or mutate worker inbox rows.
5. Run cross-organization negative tests against a non-owner, non-BYPASSRLS database role in a disposable clone.
6. Complete independent review, backup/restore and rollback rehearsals before any production RLS or role migration.

## Verification status

- Static source check: pre-transaction device lookup removed; device lock occurs inside intake transaction; envelope application joins/locks verified device and checks active organization; operation writes use the organization returned by the locked device row.
- CI: PR #157 exact-head workflow run is in progress. Do not treat it as passed until every job step succeeds.
- No live DB, Render environment, role/grant, deployment, worker activation, queue mutation, external authority submission, Guardian/Hedera write, carbon-credit issuance or certification was performed.
- PR #157 remains draft. Production remains HOLD.
