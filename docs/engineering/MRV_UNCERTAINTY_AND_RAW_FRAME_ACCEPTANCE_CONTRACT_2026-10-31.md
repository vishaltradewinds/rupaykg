# Parameter-specific MRV uncertainty and raw-frame evidence contract — 2026-10-31

Status: engineering design and acceptance specification. No schema migration or production MRV authorization is implied.

## 1. Scope and safety boundary

Close two independent evidence gaps before a measurement can become eligible for authoritative MRV submission:

- parameter-specific uncertainty must be traceable from the currently reviewed calibration artifact into an immutable measurement/MRV snapshot;
- the raw instrument frame must be preserved as immutable bytes and independently hashed by the receiving service. A client-supplied digest alone is not evidence of frame integrity.

The edge adapter remains a validation/pre-screening component. It must never approve an instrument, certify calibration, validate a carbon methodology, or write an authoritative credit claim.

## 2. Parameter uncertainty record

A reviewed calibration parameter record should bind at minimum:

- exact instrument record and physical manufacturer serial;
- exact parameter code and measurement unit;
- uncertainty kind: absolute or relative;
- uncertainty value and unit (unit required for absolute; dimensionless convention explicitly defined for relative);
- uncertainty type: standard or expanded;
- coverage factor and confidence level when provided by the certificate;
- calibration range and calibration result date;
- certificate artifact series/version ID, SHA-256 and current independent-review decision;
- calibration laboratory identity and accreditation/scope evidence where applicable;
- applicable method/standard/certificate reference;
- uncertainty decision rule, author, reviewer and effective dates;
- instrument/firmware identity and approval version.

Do not hard-code a universal TUR ratio, confidence level, or acceptance threshold. The applicable decision rule must be supported by the selected instrument certificate, competent calibration evidence, relevant Indian Legal Metrology/BIS requirements where applicable, contract and the approved methodology.

## 3. Immutable observation snapshot

At measurement capture/submission, persist a snapshot containing the approved parameter uncertainty fields and evidence reference/hash. The snapshot must not be recomputed from the instrument's current approval row on later reads. Later expiry, revocation or calibration renewal affects future observations and eligibility; it must not rewrite historical measurement facts.

A superseding correction must create a new version/event linked to the prior observation, with actor, reason, time, evidence and approval. No in-place mutation of submitted evidence or uncertainty snapshots.

## 4. Raw-frame integrity contract

The ingestion boundary must accept raw bytes or a server-controlled immutable artifact reference. It must:

1. preserve the exact received bytes before parsing/normalization;
2. calculate SHA-256 server-side over those exact bytes;
3. store immutable object/version identity, byte length, media/protocol metadata, receipt time, device identity and digest;
4. bind parsed fields and normalized observation to that raw artifact;
5. compare any claimed device digest separately and record mismatch as a quarantine condition;
6. prevent replacement/deletion after acceptance and preserve chain-of-custody events;
7. retain parser version, protocol driver version and canonicalization version so the same raw frame can be independently reprocessed.

A client-supplied `rawPayloadSha256` without server-held bytes or an independently verified immutable artifact is insufficient.

## 5. Required acceptance tests

### Uncertainty
- two parameters on one instrument with different units and uncertainty magnitudes;
- absolute versus relative uncertainty with explicit unit rules;
- standard versus expanded uncertainty, with coverage factor/confidence handling;
- missing uncertainty, missing unit, dimension mismatch and malformed numeric values;
- evidence artifact replaced, superseded, rejected, expired or revoked;
- calibration serial mismatch and physical-unit mismatch;
- attempted post-submission mutation of parameter specs or observation snapshot;
- historical snapshot remains unchanged after calibration renewal/revocation;
- decision-rule boundary values and rounding behavior from a versioned methodology/certificate fixture.

### Raw frame
- server hash equals independently computed SHA-256 of stored bytes;
- client digest mismatch is quarantined;
- payload changed after digest generation is detected;
- same normalized payload with different raw bytes remains distinguishable;
- parser version change can replay the original immutable bytes and produce a separately versioned result;
- missing bytes/artifact, zero-byte frame, truncated frame, malformed encoding and oversized frame fail closed;
- duplicate device sequence/event IDs are idempotently quarantined or deduplicated with preserved provenance;
- artifact replacement/deletion is denied after accepted state.

### End-to-end
- accepted edge observation remains `READY_FOR_REVIEW` only;
- no test path can transition directly from edge ingestion to verified MRV or credit issuance;
- the authoritative route verifies current instrument identity, current calibration evidence, parameter-specific uncertainty snapshot, raw artifact hash and methodology rule before submission.

## 6. Pan-India and field acceptance

The schema and evidence model must support different instrument types, units, calibration scopes, languages, connectivity conditions and site operators across India. Device-specific statutory applicability must be established for the exact manufacturer/model and intended use; do not infer MeitY approval or Legal Metrology conformity from a generic device category.

Field acceptance remains a separate gate: witnessed installation, protocol conformance, calibration traceability, clock/network resilience, power-loss recovery, tamper controls, operator SOP, site safety and independent verification.

## 7. Release decision

Production MRV eligibility remains HOLD until the schema, migrations, API boundary, immutable artifact storage, authorization rules, negative tests and exact-model field evidence all pass. Software unit tests alone cannot establish metrological traceability, site acceptance or TRL 9.
