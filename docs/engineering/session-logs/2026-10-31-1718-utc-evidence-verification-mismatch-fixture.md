# 2026-10-31 17:18 UTC — evidence verification mismatch fixture correction

- CI #4018 / run `41222826961` for SHA `5d5fa698cca0800de84eaac72d93ddcc5b7db330` passed typecheck, build and browser smoke, but the authenticated BWG integration test failed because the mismatch fixture used a second uploaded evidence item that was still CAPTURED. The route correctly returned `EVIDENCE_NOT_VERIFIED` before reaching the verification-ID mismatch branch.
- Corrected current test in SHA `b7f2889813c5f354fec1f40ecc8bab549f0e1389`: independently review/approve the second evidence item too, then submit the first evidence item's verification ID with the second independently verified evidence. The test now isolates the intended mismatch condition and expects `VERIFICATION_INVALID`.
- CI #4021 / run `41222991003` is queued for exact current SHA. Full green status pending.
- Append-only evidence review records remain preserved in disposable CI DB; no production modifications.
