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

## Limitations and next gate
This slice does not yet link resource-flow source/destination facilities, certify custody transfer, or determine methodology applicability. Those are separate additive work items requiring schema mapping, authorization, idempotency, reconciliation and regression tests. No hardware qualification, MeitY approval, statutory permit, MRV eligibility, production certification or deployment is implied.
