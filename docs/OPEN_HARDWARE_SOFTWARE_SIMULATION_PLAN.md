# RupayKg Edge Collector — No-Cost Software Simulation Plan

**Status:** Proposed engineering test plan only. Not a device selection, production design, field test, certification, or authorization to purchase hardware.

**Applies to:** PR #59 / Shakti Standards; initially software-only, using synthetic fixtures on a developer workstation or free local tooling. No paid APIs, cloud services, or hardware are required.

## 1. Objective

Validate the data contract and fail-closed behavior between a future edge collector and RupayKg before any physical board or sensor is selected. The simulation proves only software behavior against fixtures; it does not prove physical measurement accuracy, calibration, instrument identity, MeitY approval, site suitability, or methodology eligibility.

## 2. Isolation boundary

- Run tests locally or in an isolated CI job using generated synthetic fixtures.
- Do not send fixtures to production, staging, Guardian, external anchoring, evidence-vault approval, or authoritative MRV submission routes.
- Never register synthetic devices as real instruments or label synthetic values as field evidence.
- Do not use a free-text source label as proof of physical origin.
- Use no credentials, paid services, external APIs, hardware procurement, or deployment.
- Any integration test that could write to a shared environment must be disabled by default and require an explicit isolated test database.

### 2A. Enforced network and credential isolation (mandatory gate)

The isolation rules above are not satisfied by documentation or by an expectation that tests will not call external services. The harness/CI job must enforce the boundary before executing any test:

- Run in a disposable container/job with no inherited production, staging, Guardian, Hedera, cloud, or deployment credentials; explicitly unset known credential variables and do not mount developer credential stores or cloud CLI configuration.
- Deny outbound network by default at the job/container boundary. Allow-list only the disposable local test database and explicitly started local test services needed by the test. A test-level mock or an assertion that a request was not expected is not a network boundary.
- Use a disposable PostgreSQL instance with a unique test database/schema and a verified non-production connection target. Abort before tests if the target host/database is not on the explicit local allow-list.
- Add a negative-control test that attempts a connection to a non-allow-listed destination and proves it is blocked before any HTTP request or payload can be transmitted. Record the network-policy result in CI artifacts.
- If the CI provider cannot enforce outbound denial, classify the run as **ISOLATION NOT PROVEN** and do not mark the simulation acceptance gate PASS.

This gate protects against accidental synthetic writes to shared MRV/Guardian/anchoring services. It does not replace application authorization tests.

## 3. Minimal synthetic event contract

A fixture may contain:
- `event_id`: stable unique identifier for retry/deduplication tests;
- `fixture_class`: exactly `SYNTHETIC_TEST_ONLY`;
- `device_id`: test-only identifier, never a production instrument UUID;
- `parameter_code`: test parameter name;
- `value` and `unit`: numeric value and explicit unit;
- `measured_at`: timestamp with timezone;
- `sequence`: monotonically increasing integer within the fixture stream;
- `schema_version`: explicit contract version.

The test harness must reject a fixture if its synthetic-only marker is missing, and must have no code path that translates this fixture marker into production instrument approval.

## 4. Required deterministic tests

| Test | Fixture / fault | Expected result |
|---|---|---|
| Valid synthetic event | Well-formed event in isolated harness | Accepted by simulator only; remains registry-ineligible |
| Missing marker | Remove `fixture_class` | Reject |
| Unknown parameter | Unregistered test parameter | Reject or quarantine; never infer meaning |
| Unit mismatch | Parameter and unit do not match test contract | Reject; no implicit unit conversion |
| Invalid numeric | NaN, infinity, non-numeric or missing value | Reject |
| Out-of-range | Value outside the test-only bounds | Reject |
| Timestamp quality | Missing timezone, implausibly stale or future timestamp | Reject/quarantine according to explicit test policy |
| Sequence regression | Lower sequence after a higher sequence | Reject/quarantine |
| Duplicate retry | Same event ID submitted twice | Idempotent outcome; no second measurement |
| Replay mutation | Same event ID but altered payload | Reject and surface integrity conflict |
| Offline/reconnect | Queue events, disconnect simulator transport, reconnect | Preserve order and deduplicate; no silent loss |
| Power-loss simulation | Interrupt persistence between staged writes | Recover consistently or report an explicit failure |
| Payload corruption | Alter payload after digest creation | Integrity check fails |
| Unknown device | Device ID not in test fixture registry | Reject; no real device identity inferred |
| Production boundary | Attempt to invoke production/staging endpoint from test harness | No network call; test passes only when blocked |

The timestamp policy and numerical limits must be explicit test parameters, not invented site requirements.


## 4A. Stateful canonical-boundary acceptance matrix

The local adapter validator is intentionally stateless and cannot prove replay protection, tenant authorization, instrument approval or immutable database lineage. These cases must be exercised against the canonical field-sync/API + disposable PostgreSQL boundary in an isolated test environment, using synthetic-only identities and no production/staging credentials.

| Case | Test setup | Required outcome |
|---|---|---|
| Same event ID + same canonical digest | Submit, then retry byte-equivalent logical event | Idempotent success/reference to the original event; exactly one authoritative test record |
| Same event ID + changed digest | Reuse event key but mutate value, unit, instrument, timestamp or metadata | Conflict/quarantine; never overwrite the original |
| Duplicate client sequence | Two distinct event IDs share a sequence for one device stream | Reject/quarantine according to canonical contract; no silent collapse |
| Sequence regression | Submit a lower sequence after a higher accepted sequence | Reject/quarantine; preserve audit trail |
| Offline reconnect/replay | Queue multiple ordered synthetic events and replay with retries/reordered transport | Deterministic reconciliation; no duplicate accepted measurements or silent event loss |
| Corrupted local queue | Mutate stored payload after digest generation | Digest mismatch; quarantine and preserve diagnostic evidence |
| Tenant/site mismatch | Authenticated test identity submits another organization's/site's device or instrument | Authorization denial before authoritative mutation |
| Unknown/revoked device | Device is absent, unverified or revoked at submit time | Fail closed; no accepted measurement |
| Wrong instrument/model/parameter | Observation references a different instrument or unsupported parameter | Reject; exact instrument and parameter binding required |
| Unit/range/resolution/accuracy mismatch | Submit invalid unit or value outside reviewed specification; test resolution/accuracy boundaries | Reject/quarantine; no implicit unit conversion or inferred tolerance |
| Calibration absent/expired/rejected | Remove, expire or reject the calibration evidence after a prior valid fixture | New measurement/MRV eligibility denied; stale approval must not be reused |
| Evidence version/hash mismatch | Replace artifact version, alter bytes, or mismatch stored hash | Reject; recomputed content hash and current reviewed artifact version must match |
| Review revocation race | Revoke/reject instrument/evidence concurrently with measurement acceptance | Database/API serialization must prevent acceptance using stale approval |
| Clock and ordering faults | Naive timestamp, impossible date, untrusted clock, received-before-observed | Reject/quarantine; preserve source value rather than silently normalize |
| Production boundary | Configure an attempted production/staging URL in the simulator | Test harness blocks the network call before transmission; no credentials or live MRV write path exists |

Acceptance must assert both the API result and database state, including row counts, foreign-key/tenant scope, immutable digests and audit/decision records. A test that only checks an HTTP error is insufficient if a partial database write could still occur. Run concurrency cases repeatedly against a disposable PostgreSQL database to catch race-sensitive regressions.

These cases are **test requirements, not proof they already pass**. Mark each case PASS only with an exact commit, reproducible command, test output and isolated-database evidence. Do not skip a failing case to obtain a green result.

## 5. Acceptance criteria

The simulation may be marked **SOFTWARE SIMULATION PASS** only when:
1. Every required test has a deterministic assertion.
2. All tests pass on the recorded commit.
3. Test logs identify the build/commit and fixture version.
4. No test contacts production/staging MRV or external anchoring services.
5. Synthetic fixtures remain absent from authoritative registries and evidence.
6. Failures are recorded and corrected; no failing test is skipped merely to obtain a green result.

A pass must not be described as hardware qualification, calibration, field acceptance, MeitY approval, or production certification.

## 6. Gates that remain open after a simulation pass

- Verify actual site process, operator records and project boundary.
- Establish the applicable methodology and map each required parameter to its clause and monitoring plan.
- Obtain exact instrument manuals, interface details and current calibration/verification evidence.
- Verify exact-model applicable MeitY approval and all other legally required approvals.
- Evaluate SHAKTI and other boards against required interfaces, supported toolchains, lifecycle, security and total cost.
- Obtain explicit authorization before physical bench testing or any expenditure.
- Complete bench, site, safety, cybersecurity, independent MRV and operations reviews before production consideration.

## 7. Decision

**Proceed with software-only synthetic contract tests; do not select, purchase, install, merge or deploy hardware on the strength of this plan.**