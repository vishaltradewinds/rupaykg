# RupayKg worker, scheduler and sync runtime inventory — 2026-11-02

## Scope and method
Read-only inspection of the canonical repository tree at PR #192 head `57e28b8a23fc468f87a29c0936686b2424ee0986` and the connected Render workspace/service list. No deployment, worker activation, schedule change or production data operation was performed.

## Findings

### Repository
- No first-class background worker entrypoint, queue consumer, cron handler, scheduler process or dedicated job package was found in the repository tree.
- Worker/sync-related source paths discovered:
  - `apps/src/sync-routes.ts`
  - `apps/src/sync-validation.ts`
  - `apps/src/operation-sync-security.test.ts`
  - `apps/src/sync-validation.test.ts`
  - `apps/web/public/offline-operation-queue.js`
  - migrations `009_field_sync.sql`, `011_field_sync_application.sql`, `033_field_sync_tenant_integrity.sql`, `034_operation_sync_device_binding.sql`, `050_field_sync_conflict_audit.sql`
- Production data model includes `field_devices`, `field_sync_envelopes`, `field_sync_cursors`, `field_sync_conflicts` and `operation_sync_envelopes`.
- The current implementation evidence is API-driven field synchronization and offline queue UX, not a separately deployed worker service. Do not describe the existence of a durable background worker/consumer without a real entrypoint and operational proof.

### Render
- Connected Render workspace was enumerated read-only.
- RupayKg has one Render web service: `rupaykg` (`srv-daki4d7qj5pc73b8qksg`), Docker runtime, health path `/health`, auto-deploy from `main`.
- No RupayKg background worker or cron service was present in the returned service inventory.
- The service's latest live deployment is the production `main` commit `a3fecc0abd2c46549a201058d3963afc0e3a73c9`.

## Security implications
1. Field sync must remain authenticated, device-bound, organization-bound, idempotent, replay-protected and geography-aware at the API/database boundary.
2. If async workers are introduced, each must use a distinct non-login/service principal with explicit tenant or bilateral scope; it must not inherit the broad database owner.
3. Worker queue leases, visibility timeout, retry/backoff, dead-letter handling, deduplication, atomic apply, recovery, audit and side-effect idempotency are not established merely by the presence of envelope/cursor/conflict tables.
4. Do not activate any worker or scheduler until its source entrypoint, service principal, route/table matrix, operational runbook and failure/recovery tests exist.

## Next actions
- Decide whether sync processing is intentionally synchronous through the API or requires a dedicated worker. Document the decision.
- If a worker is required, design it as a separate service only after the database role and signed tenant-context contract is complete.
- Add exact-role integration tests for device ownership, identity binding, cross-organization replay, duplicate envelopes, concurrent apply, cursor monotonicity and conflict resolution.
- Add operational acceptance for queue backlog, lease expiry, retry, dead-letter and replay recovery before any live activation.

## Status
Inventory only. Production remains HOLD; workers/schedulers remain OFF; no TRL advancement or production readiness claim is implied.
