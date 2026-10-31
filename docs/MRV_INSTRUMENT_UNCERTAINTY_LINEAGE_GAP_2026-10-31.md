# MRV instrument uncertainty lineage gap — 2026-10-31

## Finding

The current exact-model instrument approval implementation has strong controls for identity, evidence-vault review, calibration validity, firmware/security lifecycle and per-parameter unit/range/resolution/accuracy metadata. However, it does not yet preserve a complete, parameter-specific measurement-uncertainty record from calibration evidence through a submitted observation.

Source inspection found:

1. `mrv_instruments.calibration_uncertainty` is a single instrument-level numeric field. It cannot safely represent different units/uncertainties for a multi-parameter instrument.
2. `mrv_instrument_parameter_specs` has an optional `uncertainty_unit`, but no parameter-specific uncertainty magnitude, coverage factor/confidence, uncertainty decision rule or uncertainty evidence binding.
3. The shared `instrumentParameterFailure` checks that accuracy metadata exists and enforces value range/resolution. It does not validate an uncertainty budget or propagate measurement uncertainty.
4. The current `measurements` table has no uncertainty fields. `mrv_observations` has a numeric `uncertainty`, but the instrument-bound measurement query in `mrv-routes.ts` does not carry uncertainty from `measurements` into the MRV observation set.

Therefore an instrument-bound measurement can pass the model/range/resolution gate without a persisted parameter-specific calibration uncertainty record at the measurement/MRV boundary.

## Required design before production MRV eligibility

Do not invent a universal acceptance ratio (for example, a blanket 4:1 TUR) or uncertainty threshold. The acceptance rule must be derived from the exact instrument certificate/manual, calibration scope, applicable Legal Metrology/BIS/standard requirements, contract and methodology.

The follow-on data model should:
- store uncertainty per instrument parameter, not as one scalar for a multi-parameter instrument;
- distinguish absolute and relative uncertainty and bind units correctly;
- capture whether the stated uncertainty is standard or expanded, the coverage factor and confidence level when stated;
- bind uncertainty values to the exact reviewed calibration/evidence-vault artifact version and its current independent review;
- record the documented uncertainty decision rule and the authority/standard/methodology it comes from;
- copy the approved parameter uncertainty metadata into each measurement/MRV observation as an immutable snapshot, including the evidence reference/hash;
- preserve historical measurement uncertainty when an instrument calibration or approval is later revoked/expired;
- test missing, mismatched-unit, expired/rejected-evidence, multi-parameter, and post-capture mutation cases.

If the exact instrument's certificate does not provide a usable uncertainty statement, the instrument remains HOLD until a competent calibration laboratory supplies a traceable calibration/uncertainty result or an authorized technical decision records why the applicable method does not require it.

## Current decision

This is an OPEN P1/P0 measurement-integrity gap for production MRV eligibility. The current approval register and edge adapter remain useful engineering foundations, but they do not close measurement uncertainty lineage. Do not claim complete metrological qualification, field acceptance or TRL 9 until this gate is implemented and validated against an actual selected instrument and methodology.

No production database, instrument, calibration record, or MRV data was modified by this audit.
