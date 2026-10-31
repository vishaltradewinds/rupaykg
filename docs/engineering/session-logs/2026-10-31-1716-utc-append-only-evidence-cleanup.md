# 2026-10-31 17:16 UTC — append-only evidence audit cleanup correction

- CI #4015 / run `41222627288` for SHA `0216ab466825eacd6fbb4a2c7a8a3738acffb878` passed typecheck, build and browser smoke but PostgreSQL integration failed because `evidence_artifact_reviews` is intentionally append-only and rejects DELETE.
- Corrected disposable fixture cleanup in code SHA `5d5fa698cca0800de84eaac72d93ddcc5b7db330`: evidence review, artifact version, evidence, series, activity, organization, geography and referenced identities are preserved in the ephemeral CI database; dependent report rows, verification rows, sessions and memberships are cleaned. This preserves the audit trail rather than weakening immutability.
- CI #4018 / run `41222826961` is in progress for the corrected exact SHA. Full acceptance remains unconfirmed.
- This confirms the evidence review audit log is append-only in the tested migration baseline. No production DB or production evidence was touched.
