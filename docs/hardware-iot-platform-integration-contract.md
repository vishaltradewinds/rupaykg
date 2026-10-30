# RupayKg IoT-to-Platform Integration Contract
**Status:** Proposed interface contract for review against current application code. Not yet implemented or integration-tested.
**Workstream:** `hardware/iot-stack-foundation-2026-10-30`
**Parent:** `docs/hardware-iot-stack-foundation.md`

## 1. Integration principles
- Device ingestion is an evidence-intake boundary, not a compliance decision endpoint.
- Authenticate every device/service and authorize each device against a registered facility and tenant.
- Preserve immutable raw observations separately from normalized readings, derived metrics, and human-reviewed corrections.
- Idempotency is mandatory: retries cannot create duplicate weighment, custody, energy or emissions observations.
- Device events must not directly issue EPR certificates, ESG assurance statements, CCTS certificates, or carbon credits.
- Integrate through a versioned API/adapter rather than coupling firmware to frontend routes or internal database tables.
- Before implementation, inspect the live schema, auth model, event/custody contracts and existing migration history; do not create conflicting tables or routes.

## 2. Proposed event types
- `measurement.observed` — sensor/instrument reading with unit and quality state.
- `instrument.health` — heartbeat, firmware/config version, clock, storage, connectivity and watchdog state.
- `instrument.calibration.status` — calibration state or change reference; the certificate itself remains an evidence artifact.
- `custody.reference.observed` — instrument event correlated with an existing weighment/ticket/vehicle/facility transaction; it does not independently create a legally valid custody transfer.
- `tamper.signal` — enclosure, configuration, power or device-integrity event.
- `sync.gap.detected` — sequence gap, buffer overflow, invalid clock or unrecoverable loss.

## 3. Ingestion lifecycle
1. Authenticate device identity and transport.
2. Validate schema/version, payload size, signature where configured, timestamp and sequence.
3. Authorize tenant/facility/device/process mapping.
4. Apply idempotency key and duplicate detection.
5. Persist original payload/hash and receipt metadata before normalization.
6. Normalize units using versioned mapping; never silently replace the original value.
7. Evaluate quality rules and mark valid/suspect/invalid with explicit reason codes.
8. Emit an auditable event and link to relevant facility, process, instrument and evidence record.
9. Route exceptions to a human-review queue; do not auto-promote rejected observations into reports.
10. Return a bounded acknowledgement with event ID and accepted/rejected status; do not return secrets or internal stack traces.

## 4. Minimum response semantics
- `accepted`: authenticated and persisted; does not mean measurement is accurate or compliance is achieved.
- `duplicate`: same idempotency identity already exists; return the original event reference.
- `rejected_schema`: malformed or unsupported schema.
- `rejected_auth` / `rejected_scope`: identity or facility authorization failed.
- `quarantined_quality`: retained but excluded from eligible calculation pending review.
- `retryable_failure`: safe to retry with the same idempotency key.
- `permanent_failure`: retry will not fix the request; include a non-sensitive reason code.

## 5. Required backend data relationships
Names below are conceptual and must be mapped to the repository's actual domain model before coding:
- Device registry → device identity, status, firmware and credential lifecycle.
- Instrument registry → manufacturer/model/serial, criticality class, measurement parameter and interface.
- Facility/process registry → tenant, site, facility, process and geographic authorization.
- Calibration evidence → certificate artifact, calibration date, validity, traceability and reviewer.
- Raw observation → immutable payload/hash, receive time, device sequence and idempotency key.
- Normalized observation → parameter, value, unit, quality state, mapping version and raw-event reference.
- Evidence lineage → methodology/monitoring-plan parameter, custody transaction, report version and review decision.
- Maintenance/incident records → calibration due, failure, replacement, firmware change and commissioning evidence.

## 6. API and transport requirements
- Version every contract; reject unsupported major versions and support a documented transition window.
- Use TLS and short-lived or revocable per-device credentials where feasible; never put long-lived secrets in a browser bundle.
- Rate-limit per identity and facility, cap payloads, validate content types, and enforce request timeouts.
- Support offline store-and-forward, bounded retries, backoff, event sequence numbers and gap reporting.
- Use UTC timestamps plus explicit clock-health fields; server receipt time is separately recorded.
- Keep credentials, personal data and full raw payloads out of routine logs; audit access to evidence exports.
- If MQTT is used, require broker ACLs per device/topic, TLS, retained-message policy review, message-size limits and replay/idempotency protection.

## 7. Integration acceptance tests
- Authorized device posts valid event; persisted raw and normalized records link correctly.
- Device A cannot write to Facility B; disabled/revoked device is rejected.
- Same event retried repeatedly yields one logical observation.
- Unknown parameter/unit/schema version is rejected or quarantined with reason.
- Expired calibration results in quality quarantine where the monitoring rule requires current calibration.
- Bad clock, stale reading, sequence gap, out-of-range value and invalid signature are surfaced explicitly.
- Backend outage then reconnect preserves event ordering metadata and reports gaps.
- Facility/process reassignment requires authorized audited change; historical observations retain original association.
- Corrections are append-only and linked to prior event, reviewer and reason.
- Reports can trace each derived value to normalized and raw evidence without treating ingestion acceptance as regulatory approval.

## 8. Implementation gate
Before creating production endpoints or migrations:
1. Inspect `main` and relevant active branches/PRs for existing device, evidence, custody, auth and migration models.
2. Select the authoritative domain objects and map this contract to them.
3. Agree a unique, non-conflicting file/route ownership plan with parallel workstreams.
4. Implement in a dedicated branch with migrations, tests and rollback notes.
5. Run typecheck, unit/integration tests, security checks and existing CI without weakening baselines.
6. Keep the gate fail-closed until evidence and tests prove the integration works.
