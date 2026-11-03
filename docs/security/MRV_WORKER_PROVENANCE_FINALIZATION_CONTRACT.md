# MRV Worker Provenance Finalization Contract

Status: IMPLEMENTATION GATE / DESIGN ONLY. This document does not install database functions, grants, policies, roles, or production changes.

## Canonical digest and field mapping

The restricted worker reconstructs the canonical `rupaykg:mrv:v1` anchor payload from the locked durable job and computes SHA-256 immediately before finalization. The PostgreSQL finalizer must independently reconstruct the same canonical payload from the locked job row and its immutable `payload_snapshot`, compute the digest using an approved database implementation or verify it against a separately trusted, persisted digest source, and require exact equality with the caller-supplied digest. It must not treat the caller-supplied digest as proof.

| Durable job / worker field | Provenance representation | Required rule |
|---|---|---|
| `activity_id`, `verification_id`, `evidence_id` | Same-named columns | Exact equality with the locked job and current verified source rows |
| `guardian_policy_id` | `guardian_policy_id` | Exact equality; non-empty |
| `guardian_execution_id` | `guardian_execution_id` | Exact equality; non-empty |
| Guardian result | `guardian_status='VERIFIED'` and `metadata.guardian` | Persist verified outcome and the canonical result evidence needed for audit |
| HCS status | `hcs_status='CONSENSUS_CONFIRMED'` | Never infer from transaction submission alone |
| `hedera_topic_id`, `hedera_transaction_id`, `hedera_consensus_timestamp` | `hcs_topic_id`, `hcs_transaction_id`, `hcs_consensus_timestamp` | Exact equality with the persisted, lease-fenced job bindings |
| `hedera_network` | `metadata.hederaNetwork` (no dedicated column exists) | Preserve the network explicitly; do not silently drop it |
| `mirror_verification_digest` | `integrity_hash` and `metadata.mirrorVerificationDigest` | Both equal the independently recomputed canonical anchor digest |
| `mirror_verified_at` | `mirror_node_verified_at` and `metadata.mirrorVerifiedAt` | Persist only after successful Mirror Node confirmation for the same HCS tuple and digest |
| `methodology_code` | `methodology_code` | Exact equality, including null semantics |

The existing provenance table has no dedicated `mirror_verification_digest` or `hedera_network` columns. The mapping above intentionally uses the existing `integrity_hash` and JSONB `metadata`; do not invent columns or assume names that are absent from migrations. If the database implementation cannot reliably reproduce the canonical JSON and SHA-256 contract, stop and propose a separately reviewed schema/API design rather than trusting a caller digest.

## Atomic finalization requirements

Within one database transaction, the SECURITY DEFINER finalizer must:

1. Lock the job by ID and matching, unexpired lease token; require status `MIRROR_VERIFIED`.
2. Re-authorize the job against live organization, identity, membership, role permission, activity, evidence, independent verification, geography, observations and latest measurement.
3. Reconstruct the canonical anchor payload from the locked immutable job snapshot and compute/verify the digest. Require exact equality with the supplied digest and the job's persisted `mirror_verification_digest`.
4. Require non-empty Guardian execution, HCS network, topic, transaction ID and consensus timestamp; require persisted Mirror verification timestamp and a successful Mirror result bound to that exact transaction/topic/digest.
5. Insert the complete provenance tuple with `guardian_status='VERIFIED'`, `hcs_status='CONSENSUS_CONFIRMED'`, `integrity_hash=digest`, `mirror_node_verified_at=mirror_verified_at`, and the metadata mapping above.
6. On unique-key conflict `(activity_id, verification_id, integrity_hash)`, lock and compare **every** tuple field: evidence, policy, Guardian execution/status, HCS status/topic/transaction/consensus, methodology, network metadata, Mirror timestamp/digest metadata and the durable job reference. Any mismatch is a hard idempotency conflict; a matching unique key alone is not success.
7. Transition the job through `PROVENANCE_PERSISTED` to `COMPLETED` under the same live lease fence, allowing existing append-only event triggers to record both transitions in the same transaction. Clear lease fields only on successful completion.
8. Roll back the provenance insert and all job transitions together on any failed comparison, authorization check, lease fence, trigger or write.

The existing legacy direct-SQL finalizer is not a sufficient implementation template for conflict validation: it checks only a subset of the provenance tuple on conflict. The restricted database function must implement the full comparison above and must not inherit that incomplete check.

## Required adversarial PostgreSQL tests

- Caller supplies a digest different from the canonical job payload: reject, zero provenance writes, job remains uncompleted.
- Job digest differs from Mirror digest: reject.
- Same digest but altered evidence, policy, Guardian execution, HCS topic, transaction, consensus timestamp, network metadata, methodology or Mirror timestamp on an existing row: reject as idempotency conflict.
- Exact retry with the complete tuple identical: idempotent success without duplicate provenance.
- Stale/expired lease or non-`MIRROR_VERIFIED` job: no write.
- Revoked identity/membership/permission or changed source evidence/measurement: no write.
- Failure during either job transition or event trigger: entire transaction rolls back.
- Attempt to mutate the anchored provenance tuple after credential issuance: existing anchor immutability/Mirror invalidation triggers continue to reject it.

## Release gate

No eight-function SQL implementation, API-owner grants, worker runtime provisioning, RLS policy activation, live Neon migration, worker enablement, deployment or certification until the canonical digest implementation is proven in disposable PostgreSQL with the full migration chain, FORCE RLS, cross-tenant negative tests and independent DBA/security review.
