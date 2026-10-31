# Facility-to-activity link contract

## Purpose
The facility registry identifies operating locations; activities remain the authoritative operational records. This contract adds an explicit, reviewable association without guessing which facility owns a legacy activity.

## API
- `POST /api/v1/facilities/{facilityId}/activity-links`: request a link using `activityId` and a 5–2000 character `note`. Requires active organization context and `facility:manage`.
- `GET /api/v1/facilities/{facilityId}/activity-links`: list links within the current organization and geography scope.
- `POST /api/v1/facility-activity-links/{linkId}/review`: independent reviewer submits `decision: VERIFIED|REJECTED` and a reason.

## Fail-closed invariants
- Facility and activity must belong to the same organization and have the same exact geography ID. Cross-geography routing is not inferred.
- Facility profile must already be independently `ACTIVE`; that state is operational only and is not a permit or regulatory certification.
- Each activity may have only one pending or verified facility link.
- Link identity fields are immutable. Only `PENDING` can transition once to `VERIFIED` or `REJECTED`.
- Requester cannot review their own link; reviewer must be a verified member of the organization.
- Link review events are append-only.
- No legacy activity is backfilled. Uncertain ownership remains unassigned until a human with authority provides evidence and requests the link.

## Resource-flow endpoint association
The follow-on migration adds optional `source_facility_id` and `destination_facility_id` references to resource flows. Existing flows remain nullable/unassigned; no historical facility is inferred. When an endpoint is supplied, both API and database checks require the facility to be ACTIVE, belong to the flow organization, and match the exact source/destination geography. This associates a declared flow with operating sites; it does not by itself prove physical custody transfer, weighbridge accuracy, transport completion, or material receipt.

## Limitations and next gate
This slice does not yet certify custody transfer or determine methodology applicability. Further work must cover transport handoffs, custody reconciliation, idempotency/offline replay, evidence lineage and method-specific MRV controls. No hardware qualification, MeitY approval, statutory permit, MRV eligibility, production certification or deployment is implied.

## Field-device-to-facility association
- `POST /api/v1/facilities/{facilityId}/device-links`: request association using `deviceId` and a 5–2000 character `note`. Requires active organization context and `facility:manage`.
- `GET /api/v1/facilities/{facilityId}/device-links`: list association records within the active organization and facility geography scope.
- `POST /api/v1/facility-device-links/{linkId}/review`: independent reviewer submits `decision: VERIFIED|REJECTED` and a reason.
- The field device must already be enrolled, independently verified, and bound to the same organization as the active facility. Link requests are pending by default; the requester cannot review their own request.
- Database constraints enforce tenant binding, facility geography authorization, independent review, immutable association identity, one open/verified link per facility-device pair, append-only review events, and geography-change blocking while a pending/verified device link exists.
- No existing field device is auto-associated with a facility. Legacy device/envelope/measurement records remain unassigned unless a governed workflow explicitly associates them.
- A verified capture-device association does not identify or qualify every sensor attached to that device. Actual instrument identity, serial number, calibration, maintenance, metrology traceability, sensor accuracy, MeitY approval evidence, and methodology eligibility require separate instrument-specific evidence and approval gates.
- This slice does not establish physical custody, weighbridge certification, or statutory compliance. Hardware options remain candidates until current official approval evidence is recorded for the exact model and intended use.
