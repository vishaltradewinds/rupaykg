# RupayKg — Authoritative Guardian + Hedera Production Acceptance Runbook

## Purpose

This runbook defines the only acceptable evidence path for the SHAKTI P0 MRV production gate:

`Guardian VERIFIED -> Hedera CONSENSUS_CONFIRMED -> persisted provenance -> Mirror Node verification`

A successful HTTP response, CI run, deployment, or local/mock test is not evidence of this chain.

## Preconditions

1. Production service is the canonical `vishaltradewinds/rupaykg` `main` deployment.
2. Production runtime uses the non-privileged `rupaykg_runtime_login` database role.
3. The authenticated operator belongs to the target organization with the required Guardian MRV permission.
4. The target activity is COMPLETED.
5. The target verification is APPROVED.
6. The target evidence is VERIFIED and bound to the same activity.
7. Activity geography is inside the organization's authorized scope.
8. `GUARDIAN_MRV_SUBMIT_URL` points to the authoritative Guardian service.
9. `GUARDIAN_MRV_POLICY_ID` identifies the approved production Guardian policy.
10. `GUARDIAN_API_TOKEN` is stored only in the production secret store when required by the Guardian deployment.
11. `HEDERA_NETWORK`, `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, and `HEDERA_TOPIC_ID` are configured with real production values.
12. No acceptance fixture is used for the production evidence record.

## Execution

### 1. Guardian verification

Submit the real activity through:

`POST /api/v1/mrv/activities/:activityId/submit`

The response must contain:

- `guardian.status = VERIFIED`
- a non-empty authoritative `guardian.executionId`
- the expected policy identifier
- `syntheticData = false`

The Guardian execution identifier becomes the immutable external reference for the subsequent HCS anchor.

### 2. Hedera HCS anchoring

The service must anchor the canonical RupayKg MRV payload containing:

- activity ID
- verification ID
- evidence ID
- Guardian policy ID
- Guardian execution ID
- `mrvStatus = VERIFIED`
- methodology/measurement metadata used by the MRV record
- deterministic integrity hash

Acceptance requires:

- `hedera.status = CONSENSUS_CONFIRMED`
- non-empty transaction ID
- non-empty consensus timestamp
- configured topic ID
- real network identity

### 3. Persisted provenance

The service must persist the Guardian and HCS references in `mrv_provenance_events`.

The persisted record must bind all of:

- activity
- verification
- evidence
- Guardian execution
- HCS topic
- HCS transaction
- HCS consensus timestamp
- integrity hash

A partial record is not production acceptance.

### 4. Mirror Node verification

Call:

`GET /api/v1/mrv/hedera/verify/:consensusTimestamp`

Mirror Node verification must confirm:

- exact consensus timestamp
- exact HCS topic
- RupayKg provenance schema
- `mrvStatus = VERIFIED`
- Guardian execution ID
- activity ID
- verification ID
- evidence ID
- integrity hash

Only after this succeeds may `mirror_node_verified_at` be persisted.

## Required evidence packet

Record the following without exposing secrets:

- UTC execution timestamp
- production deployment commit
- production deployment ID
- organization/activity/verification/evidence identifiers
- Guardian policy ID
- Guardian execution ID
- Guardian response status
- Hedera network
- HCS topic ID
- HCS transaction ID
- HCS consensus timestamp
- Mirror Node verification result
- persisted `mirror_node_verified_at`
- correlation ID
- idempotency key
- HTTP status codes
- sanitized application log excerpts

Never record:

- Guardian API tokens
- Hedera private keys
- DATABASE_URL
- database passwords
- raw bearer tokens

## Fail-closed rules

Production acceptance is FAIL if:

- Guardian is not configured.
- Guardian returns VERIFIED without an authoritative execution ID.
- Hedera credentials/topic are not configured.
- HCS submission does not return a consensus timestamp.
- persisted provenance is incomplete.
- Mirror Node cannot independently verify the exact anchored record.
- the activity is marked as an acceptance fixture.
- any external result cannot be bound to the authenticated organization/activity.

## Current gate decision

The software path for the complete chain is implemented and covered by deterministic contract tests. The remaining P0 is **real production execution with authoritative Guardian/Hedera credentials and evidence**. Until that evidence exists, RupayKg remains technically deployed but **not SHAKTI production-accepted, not externally validated, and not TRL 9 certified**.
