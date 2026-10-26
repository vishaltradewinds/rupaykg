# RupayKg No-Cost IoT Simulation Runbook

**Status:** Offline test-only prototype; no physical device connected  
**Branch:** feat/mrv-evidence-bound-parameters  
**Cost posture:** No hardware purchase, paid API, paid cloud activation or external service required  
**Evidence status:** Synthetic fixtures only; never site evidence

## Aim

Exercise the existing RupayKg instrument approval and parameter-validation functions before selecting a physical controller. The goal is to demonstrate that a numerically plausible value cannot become an approved MRV measurement without an exact registered instrument, applicable approval evidence, calibration/security gates and an exact parameter/unit specification.

## What was added

- apps/src/hardware-simulation.test.ts — offline-only tests using explicitly synthetic instrument IDs and values.
- Existing validation modules are reused; no second ingestion API, database, evidence vault or trust service is introduced.
- The tests do not connect to a live API or database and do not represent real site measurements.

## Test scenarios

1. Synthetic observation with no registered instrument is blocked.
2. Synthetic instrument with PENDING approval is blocked.
3. A value can be numerically within an example range but still fails the instrument approval gate.
4. Values outside the example range and values with the wrong unit are rejected by the parameter specification validator.

## Run locally without external services

From a checkout of the repository branch, use the repository's existing Node/npm workspace setup:

1. Install dependencies using the repository's existing lockfile and normal workspace instructions.
2. Run the API workspace test command: npm run test -w @rupaykg/api
3. Confirm the new hardware-simulation.test.ts cases pass alongside the existing instrument-approval tests.
4. Run typecheck/build and the repository CI workflow for the exact commit.

No production database URL or secrets are required for these pure unit tests. Do not configure production credentials merely to run this simulation.

## Safety boundary

- Do not post these fixtures to a live or staging ingestion endpoint.
- Do not create a field-device record or instrument approval for the synthetic identifier.
- Do not store these fixtures in the evidence vault as physical evidence.
- Do not describe passing unit tests as physical sensor accuracy, hardware compatibility, MeitY approval, calibration, field acceptance or production certification.
- The word SIMULATED in a fixture is a human-readable warning, not a security control. Safety comes from keeping this prototype offline and from the production instrument approval gates.

## Acceptance criteria

- All new unit tests pass.
- Existing instrument approval/parameter tests remain passing.
- Exact-head CI build/typecheck/test checks pass.
- No physical equipment, paid service, production data, credentials or deployment is changed.

## Next gate

After the no-cost software contract passes, obtain the exact site workflow and instrument inventory. The current site-reality HOLD remains: do not assume a landfill-methane methodology or buy methane-specific sensors without evidence of the actual project boundary and eligible operating process. Only then compare existing instrument interfaces against SHAKTI, C-DAC VEGA/ARIES and suitable existing gateways. Any purchase requires a completed free-first cost/viability record and explicit approval.
