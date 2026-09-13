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
12. Confirm only then that the downstream registry/value lifecycle marks the record eligible.

## Negative acceptance cases

The live gate is not passed unless all of these remain fail-closed:

- Guardian URL missing.
- Guardian timeout.
- Guardian HTTP failure.
- Guardian returns `VERIFIED` without an authoritative execution ID.
- Guardian returns malformed JSON.
- Hedera credentials missing.
- Hedera transaction failure.
- Hedera response without consensus timestamp.
- Mirror Node cannot locate the consensus message.
- Activity/evidence/verification identifiers do not match the anchored payload.
- Integrity hash mismatch.
- Duplicate submission with the same deterministic idempotency key.

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

## Deployment gate

Cloud Run deployment remains the final step. The production deployment gate is:

`CI green -> runtime/container green -> UI/backend contract green -> statutory/governance checks green -> live Guardian acceptance -> live Hedera consensus verification -> final production smoke test -> Cloud Run deployment`
