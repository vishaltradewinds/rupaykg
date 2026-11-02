# WA03.001 Guardian Policy Specification

**Status:** BUILD SPECIFICATION — NOT YET PUBLISHED  
**Controlling methodology:** BEE BM WA03.001 — Landfill Methane Recovery, Version 1.0  
**Effective/publication date:** 27 March 2025  
**Policy identifier (target):** `rupaykg:wa03.001:landfill-methane-recovery:v1`

## 1. Authority hierarchy

1. **Primary regulatory authority:** BEE BM WA03.001 v1.0.
2. **Methodology lineage/reference:** UNFCCC CDM AMS-III.G, only where WA03.001 explicitly relies on it.
3. **Companion BEE methodology:** BM WA03.002 only where the actual project pathway requires flaring/use of landfill gas.
4. **Supporting BEE tools:** BM-T-001, BM-T-002, BM-T-003, BM-T-004, BM-T-006, BM-T-011 and BM-T-012 as separately evidenced calculation/monitoring dependencies.
5. **Guardian methodology examples:** CAR U.S. Landfill and other Guardian policies are implementation-pattern references only. They are not substituted for Indian regulatory authority.

## 2. Non-substitution rule

The Guardian policy MUST encode WA03.001 requirements. A different Guardian policy must not be copied, relabelled, or treated as WA03.001.

Every imported/reference methodology must carry:
- authority;
- version;
- scope;
- applicability;
- exact dependency or mapping;
- compatibility decision.

## 3. Guardian workflow

### Gate A — Project applicability
Capture and validate:
- project/site identity;
- landfill boundary;
- waste-management pathway;
- methane recovery pathway;
- project start/crediting information;
- regulatory eligibility;
- ownership/control;
- monitoring boundary.

Reject when mandatory applicability evidence is absent.

### Gate B — Baseline
Capture:
- baseline scenario;
- baseline methane generation/emission evidence;
- BM-T-011 calculation inputs and outputs;
- baseline period and data lineage;
- assumptions and source evidence.

The BM-T-011 result is a dependency, not a free-form user assertion.

### Gate C — Monitoring system
Capture:
- methane flow/quantity measurement;
- methane concentration/composition where required;
- operating hours;
- instrument identity;
- calibration status;
- calibration evidence;
- measurement uncertainty;
- data gaps and treatment;
- electricity/fuel data where applicable.

Each measurement must remain traceable to source evidence.

### Gate D — Methane recovery
Capture the measured project methane quantity for the monitoring period and preserve:
- source instrument;
- measurement interval;
- raw evidence reference;
- transformed/aggregated value;
- calculation lineage.

### Gate E — Oxidation
Capture the applicable oxidation factor `OX` and its authoritative basis.

No default value may be silently inserted when the methodology requires project-specific evidence.

### Gate F — Project emissions
Capture `PEy` and its supporting calculations/evidence, including relevant electricity/fuel procedures where applicable.

### Gate G — Leakage
Capture `LEy` and the applicable methodology basis.

### Gate H — Deterministic Equation 4
The policy calculation must resolve:

`ERy,calculated = (FCH4,PJ,y − FCH4,BL,y) × GWPCH4 × (1 − OX) − PEy − LEy`

with:
- `GWPCH4 = 29.8 tCO2e/tCH4`;
- explicit units on every input;
- immutable calculation inputs after verification freeze;
- complete calculation lineage.

### Gate I — Verification freeze
Before Guardian verification can be accepted:
- all mandatory evidence is present;
- methodology version is locked;
- calculation inputs are frozen;
- unresolved data gaps are rejected or explicitly treated under the methodology;
- verifier decision is recorded;
- policy output is bound to the exact activity/verification/evidence identifiers.

### Gate J — Provenance / external submission
Only a verified result may cross the RupayKg → Guardian submission boundary.

The Guardian execution must return a real execution identifier. RupayKg must persist:
- policy identifier;
- execution identifier;
- Guardian verification result;
- correlation/idempotency key;
- evidence references;
- timestamps;
- methodology code/version.

## 4. Required Guardian-native block families

The final .policy bundle must implement, using Guardian-native workflow blocks rather than descriptive placeholders:

- role/application blocks;
- form/schema blocks for project, baseline, monitoring and verification data;
- document/evidence collection;
- calculation/math blocks;
- conditional validation/rejection;
- data transformation/aggregation;
- verifier approval/signature;
- policy tags for stable integration points;
- final verification/provenance transition;
- required VC/schema definitions.

Exact block UUIDs and schemas are generated/validated by Guardian and must not be fabricated in source documentation.

## 5. RupayKg integration contract

The policy integration tag must map to:

- methodologyCode: `WA03.001`
- policyId: the **real published Guardian policy ID**
- activityId: RupayKg activity
- verificationId: RupayKg verification
- evidenceId: RupayKg evidence
- correlationId: deterministic request correlation
- idempotencyKey: deterministic submission key

Acceptance requires:

`RupayKg → Guardian VERIFIED → real executionId → Hedera HCS CONSENSUS_CONFIRMED → persisted provenance → Mirror Node verification`

## 6. Acceptance criteria

The policy is **not production eligible** until all are true:

1. Guardian accepts the actual .policy bundle.
2. Guardian assigns a real policy identifier.
3. Policy is published through the real Guardian workflow.
4. WA03.001 applicability/baseline/monitoring/calculation/verification gates validate.
5. A real RupayKg acceptance fixture reaches Guardian.
6. Guardian returns VERIFIED with a real execution identifier.
7. Hedera HCS returns CONSENSUS_CONFIRMED with a real consensus timestamp.
8. RupayKg provenance persists both Guardian and Hedera evidence.
9. Hedera Mirror Node verification succeeds.
10. The live acceptance workflow passes without synthetic data.

## 7. Explicit non-claims

This specification does **not** claim:
- a Guardian policy has already been published;
- a Guardian policy ID exists;
- Hedera acceptance has occurred;
- Mirror Node verification has occurred;
- WA03.001 production eligibility has been achieved.

Those claims require live evidence.
