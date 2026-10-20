# AI-Assisted Unstructured Log Intake — Safe Middleware Boundary

**Status:** Feature-branch implementation with an opt-in OpenAI-compatible provider adapter. No provider is selected or contacted unless server-side base URL and model settings are explicitly configured. This is not production-certified.

## Data flow

1. An authenticated user submits an unstructured source log for an existing activity.
2. API verifies the user's organization membership, activity geography scope and `evidence:upload` permission.
3. The original log is persisted first in the existing Evidence Vault as `AI_SOURCE_LOG`, with a SHA-256 digest and `UNTRUSTED_SOURCE` metadata.
4. If an extraction provider is configured, its output is treated as untrusted JSON and passed through a strict TypeScript schema validator. No string-to-number coercion is allowed; unknown keys, invalid enums, invalid timestamps, unbounded fields and confidence outside 0..1 are rejected.
5. A valid extraction is persisted separately as `AI_EXTRACTION_PROPOSAL`, linked to the source evidence ID, with provider/model/prompt version and `PENDING_HUMAN_REVIEW`.
6. A failed or invalid extraction does not erase the original source. The response returns its evidence ID and an explicit failure status.

## API

`POST /api/v1/intelligence/evidence-intake`

Request:
```json
{
  "activityId": "existing-authorized-activity-uuid",
  "sourceReference": "meter-log-2026-10-19.csv",
  "rawLog": "Unstructured source log text..."
}
```

The configured provider returns a strict proposal object:
```json
{
  "recordType": "WASTE_MEASUREMENT",
  "observedAt": "2026-10-19T08:30:00Z",
  "quantity": 125.5,
  "unit": "kg",
  "wasteStream": "WET",
  "facilityReference": "FAC-001",
  "notes": "Transcribed from the source log",
  "confidence": 0.92,
  "warnings": []
}
```

The API validates the provider output server-side. The confidence value is model-reported metadata, not a calibrated probability or proof.

## Durable idempotency and recovery

Migration `20261025_ai_evidence_intake_jobs.sql` adds a database-backed ledger keyed by authenticated identity, organization, and `Idempotency-Key`. The ledger stores a request hash, status, lease token/expiry, attempt count, source/proposal evidence IDs, and completed response JSON—not raw source text. A matching key with different request content returns a conflict; completed submissions replay the response; an active lease returns processing status; retryable/expired jobs may be reclaimed with a new fencing token. Source evidence ID is linked inside the source-evidence transaction, and proposal persistence plus job completion are committed together. The lease is five minutes; provider timeout must remain below that limit until lease renewal is implemented.

## Persistence design

`apps/src/evidence-vault-store.ts` extracts the transactional artifact persistence primitive shared by the existing evidence upload route and AI intake route. The route does not write directly to measurements, carbon calculations, EPR lifecycle tables or certificates. Source and proposal are separate immutable/versioned evidence artifacts. The proposal references the source evidence ID in its metadata.

## Fail-closed behaviour

- Provider configuration is opt-in through `RUPAYKG_AI_BASE_URL`, `RUPAYKG_AI_MODEL`, and a valid encrypted runtime prompt (`RUPAYKG_AI_PROMPT_CIPHERTEXT` plus `RUPAYKG_AI_PROMPT_KEY_HEX`). If any are missing/invalid, the endpoint captures the original source and returns `AI_PROVIDER_NOT_CONFIGURED`; it does not pretend AI extraction ran.
- Provider failure returns an error with the source evidence ID retained.
- Invalid model output returns `AI_EXTRACTION_SCHEMA_INVALID`; it is not stored as a valid proposal.
- Schema-valid output is still `SCHEMA_VALIDATED_NOT_FACT_VERIFIED` and `PENDING_HUMAN_REVIEW`.
- No automatic measurement insert/update, activity completion, verification approval, carbon calculation, credit creation, Guardian submission or Hedera anchoring occurs.
- The adapter sends logs as JSON data and the encrypted runtime prompt instructs the model to ignore embedded instructions; it requests JSON output, pins provider/model/prompt identifiers in proposal metadata, uses a 20-second timeout, caps provider input at 20,000 characters and provider response bytes at 128 KiB, and does not log raw content. Remote providers require HTTPS; plain HTTP is accepted only for loopback development endpoints. The adapter has no database credentials or mutation tools.
- The source log limit is 1 MiB. The evidence vault's established file-size limit remains 5 MiB.

## Required next gates

1. Select and configure the permitted model provider using server-side secret management; do not ship provider keys to the browser.
2. Implement provider adapter with bounded timeout, output/token limits, model/prompt version pinning, and explicit refusal/error mapping.
3. Add end-to-end tests for scope denial, missing provider, provider failure, malformed output, successful source+proposal linkage, rollback on persistence failure, and duplicate/retry handling.
4. Add a human-review queue that compares every extracted field against the original artifact and requires an authorized reviewer before any domain measurement is created.
5. Add prompt-injection, oversized-input, Unicode, data leakage and cross-organization isolation tests.
6. Keep Guardian/Hedera trust gates separate. A database hash is an integrity aid, not proof of Hedera consensus. The existing Shakti production gate still requires live Guardian VERIFIED → Hedera consensus → Mirror Node verification and persisted provenance.


## Protected runtime prompt configuration

The extraction system prompt is no longer embedded in the provider source. The provider is disabled unless the operator supplies a valid AES-256-GCM encrypted prompt and a 32-byte key through runtime configuration:

- `RUPAYKG_AI_PROMPT_CIPHERTEXT`: `v1:<12-byte-IV-hex>:<16-byte-auth-tag-hex>:<ciphertext-hex>`
- `RUPAYKG_AI_PROMPT_KEY_HEX`: 32-byte key represented as 64 hexadecimal characters
- `RUPAYKG_AI_PROMPT_VERSION`: version identifier persisted with the proposal

Use a private prompt file stored outside the repository and `scripts/encrypt-ai-prompt.mjs` to create the ciphertext. Configure the key and ciphertext using the deployment's runtime secret mechanism; where supported, keep them under separate access controls. Never commit either value, the plaintext prompt, or a key-generation output. Rotate the key and ciphertext together when the prompt changes, and increment the prompt version. The utility writes only the ciphertext payload to standard output.

AES-GCM authenticates encrypted configuration at rest/in transit between secret stores and the process; it does not protect against a compromised runtime, a person authorized to inspect process memory, or a deployment administrator who can access both key and ciphertext. JavaScript cannot guarantee secure zeroization of strings. Assigning `null` or requesting garbage collection is not a reliable memory wipe, so this implementation makes no such claim. This is defense-in-depth, not a guarantee that prompts are impossible to copy.

The encrypted prompt must be operator-authored and reviewed against the strict output schema. It must not embed claims that schema-valid data is fact-verified, CPCB-approved, or sufficient to issue credits. No inference provider is configured by this code change, and no prompt secret or model is deployed automatically.
