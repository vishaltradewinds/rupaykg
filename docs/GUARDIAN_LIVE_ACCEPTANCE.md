# RupayKG Guardian + Hedera Live Acceptance

## Purpose

This document defines the final external acceptance gate for the RupayKG MRV trust rail. Automated CI proves the RupayKG code, database migrations, tests, browser smoke test, and production container build. It does **not** prove that a deployed Guardian instance has executed the intended MRV workflow or that Hedera HCS has returned authoritative consensus.

## Authoritative architecture

RupayKG remains the operational system of record:

`Activity -> Measurement -> Evidence -> Verification -> Guardian MRV -> Hedera HCS -> Provenance -> Registry eligibility -> Settlement/Reporting`

Guardian is the policy/MRV trust rail. Hedera HCS is the immutable anchoring rail. Registry eligibility must remain fail-closed until both external stages are authoritative.

## Guardian contract boundary

RupayKG uses the server-side `apps/src/guardian-mrv.ts` provider contract:

- contract: `rupaykg:guardian-mrv:v1`
- endpoint: `GUARDIAN_MRV_SUBMIT_URL`
- optional bearer token: `GUARDIAN_API_TOKEN`
- bounded timeout: `GUARDIAN_MRV_TIMEOUT_MS`
- correlation ID and deterministic idempotency key on every request
- `VERIFIED` is accepted only with an authoritative Guardian execution identifier

The configured URL is deliberately an adapter/provider boundary. It must not be treated as a native Guardian endpoint unless the deployed integration actually implements the RupayKG contract.

### Native Guardian reference

The official open-source Guardian distribution includes an `mrv-sender` service. Its current sender API exposes `POST /mrv-generate` and generates a Verifiable Credential document before posting it to the configured Guardian URL. That API is not, by itself, the RupayKG `VERIFIED + executionId` contract. Therefore RupayKG must retain its provider boundary rather than inventing a native Guardian response schema.

## Required live acceptance sequence

1. Deploy/run a real Guardian environment using an approved Guardian release and real Hedera credentials.
2. Configure the Guardian policy/workflow, schema, DID/VC configuration, and required storage/services for the target MRV methodology.
3. Configure RupayKG `GUARDIAN_MRV_SUBMIT_URL` to the real deployed integration adapter implementing `rupaykg:guardian-mrv:v1`.
4. Create or select a real RupayKG activity with:
   - completed operational state;
   - approved verification;
   - verified evidence;
   - real measurement observations.
5. Submit the activity through `POST /api/v1/mrv/activities/:activityId/submit`.
6. Verify that Guardian returns an authoritative execution identifier and `VERIFIED` status.
7. RupayKG then anchors the exact provenance payload to the configured Hedera HCS topic.
8. Verify that Hedera returns a transaction ID and consensus timestamp.
9. Query the Hedera Mirror Node using the persisted topic ID and consensus timestamp.
10. Verify the retrieved payload matches:
    - activity ID;
    - verification ID;
    - evidence ID;
    - Guardian execution ID;
    - `mrvStatus=VERIFIED`;
    - integrity hash.
11. Confirm the persisted provenance record is `GUARDIAN VERIFIED + CONSENSUS CONFIRMED`.
12. Confirm the authenticated `GET /api/v1/mrv/hedera/verify/:consensusTimestamp` response reports `verified=true` and persists `mirror_node_verified_at` for that exact provenance row.
13. Confirm the downstream registry/value lifecycle remains ineligible until that persisted Mirror Node verification exists; credential issuance requires that persisted verification marker for the exact provenance row and fails closed if it is absent. The database trigger independently requires the same marker.

## Acceptance-fixture boundary

The optional `RUPAYKG_ACCEPTANCE_SEED_ON_START=true` dataset is a test fixture. It may be used to exercise the real external Guardian/Hedera/Mirror Node integration, but it is not evidence of a real waste activity or a carbon-credit project. Activities/evidence marked `metadata.acceptanceFixture=true` must remain ineligible for registry issuance even when external anchoring succeeds. PostgreSQL independently rejects any credential transition into a value-bearing state for these fixtures; MRV API responses must also report `eligibleForRegistry=false`.

## Negative acceptance cases

The live gate is not passed unless all of these remain fail-closed:

- Guardian URL missing.
- Guardian timeout.
- Guardian HTTP failure.
- Guardian returns `VERIFIED` without an authoritative execution ID.
- Guardian returns malformed JSON.
- Guardian response explicitly names a different policy ID than the requested policy.
- Guardian execution identifier is blank or whitespace-only.
- Hedera credentials missing.
- Hedera transaction failure.
- Hedera response without a transaction identifier or with a blank/whitespace-only transaction identifier.
- Hedera response without consensus timestamp.
- Mirror Node cannot locate the consensus message.
- Activity/evidence/verification identifiers do not match the anchored payload.
- Integrity hash mismatch.
- Duplicate submission with the same deterministic idempotency key.
- Same idempotency key reused with changed observations, evidence or metadata.
- Eligibility decision is absent, expired, geographically mismatched, bound to another verification/evidence item, or references a different methodology version.
- Methodology governance status is not production-eligible or the verification is not approved.
- Any acceptance/test-fixture activity or evidence attempts a value-bearing credential transition.

None of these conditions may manufacture a transaction ID, consensus timestamp, Guardian execution ID, VC signature, statutory certificate, or registry eligibility.

## Evidence required for production sign-off

Record the following values in the deployment/acceptance evidence without committing secrets:

- Guardian release/version.
- Guardian policy identifier and version.
- RupayKG correlation ID.
- RupayKG deterministic idempotency key.
- Guardian execution ID.
- Hedera network.
- Hedera topic ID.
- Hedera transaction ID.
- Hedera consensus timestamp.
- persisted integrity hash.
- Mirror Node verification result.
- acceptance timestamp.

Do **not** commit operator private keys, API bearer tokens, VC private keys, or other secrets to GitHub.

## Statutory boundary

Guardian/Hedera provenance does not itself constitute CPCB registration, an EPR certificate, environmental approval, SEBI acceptance, or any other statutory approval. RupayKG may retain and report authoritative external references when actually issued by the competent authority, but must not fabricate them from internal MRV state.

## Platform-admin dual-control acceptance

Reserved platform-role grants and restoration of revoked reserved-role memberships are not permitted through ordinary membership endpoints. The separate database-backed workflow uses:

- `POST /api/v1/admin/access-change-requests` to request `GRANT_RESERVED_ROLE` or `RESTORE_RESERVED_ROLE` for a verified `super_admin` or `platform_admin` role.
- `GET /api/v1/admin/access-change-requests` to review the request queue.
- `POST /api/v1/admin/access-change-requests/:requestId/approve` or `/reject` for a distinct active Super Admin to decide.
- The approval transaction revalidates both administrators, the target identity, organization, reserved role, and membership state before applying the change.
- Requester self-approval and target-identity approval are rejected; the requester, approver, and target must be three distinct identities. Request, decision, and applied change are written to the platform audit chain.

Acceptance still requires authenticated browser testing with two separate authorized Super Admin identities, including self-approval rejection, approval, rejection, replay/duplicate decision, stale target state, and audit-chain continuity. A successful CI run alone is not production certification.

## Deployment gate

Cloud Run deployment remains the final step. The production deployment gate is:

`CI green -> runtime/container green -> UI/backend contract green -> statutory/governance checks green -> live Guardian acceptance -> live Hedera consensus verification -> final production smoke test -> Cloud Run deployment`


## Sanitized evidence packet checklist

For each authorized non-production acceptance attempt, preserve an immutable, access-controlled packet outside source control containing:
- exact RupayKG commit SHA, deployment/environment identifier, test operator and independent witness;
- UTC start/end timestamps and correlation ID;
- approved Guardian release, policy ID/version, execution ID and sanitized authoritative response;
- requested idempotency key plus canonical input digest (never private evidence contents unless approved for that packet);
- Hedera network, topic ID, transaction ID, consensus timestamp and authoritative response;
- Mirror Node request reference and sanitized returned payload, including the exact digest comparison result;
- database row identifiers and before/after state for the matching provenance record and eligibility decision;
- outcomes for each negative/retry/duplicate/mismatch test, including expected versus observed result;
- redaction record, reviewer decision, unresolved deviations and sign-off timestamp.

Do not place private keys, bearer tokens, personal data, raw sensitive evidence, or production secrets in Git, CI logs, pull-request comments, or this packet's broadly accessible copy. A screenshot, mocked response, local fixture, or CI success alone is not external acceptance evidence. Failed attempts must be retained as failures rather than rewritten as passes.
