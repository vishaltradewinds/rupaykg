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