# Field Operations and Offline Sync

RupayKg supports field collection across urban and rural India, including locations with intermittent connectivity.

## Rules

- PostgreSQL is the authoritative business state.
- A field capture must identify the actor, device, capture time and idempotency key.
- Retries are safe: the same idempotency key must not create a second operation.
- Client sequence numbers are monotonic per device where supplied.
- GPS is evidence metadata, not proof of the underlying physical activity by itself.
- Evidence hashes are retained so submitted files can be integrity-checked.
- Offline payloads are first accepted into an intake envelope; business state is only advanced by validated server-side processing.
- Conflicts are explicit. The system must not silently overwrite authoritative state.

## Geography

Geography is source-versioned and hierarchical. The schema supports India, State/UT, District, Sub-District, ULB, Ward, Locality, Gram Panchayat, Village and Cluster. Authoritative external codes should be ingested from a verified government/reference source; the repository does not fabricate LGD or other government geography records.

## Current API primitives

- `GET /api/v1/geography/children/:parentId` — reads authoritative child geography records.
- `POST /api/v1/operations/sync` — accepts an idempotent offline operation envelope and returns `202` while it awaits validated application to business state.

These endpoints deliberately do not claim that an activity occurred merely because a device submitted a payload.
