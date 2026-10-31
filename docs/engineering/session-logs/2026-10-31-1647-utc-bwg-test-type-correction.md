# 2026-10-31 16:47 UTC — BWG integration test TypeScript correction

- Latest code commit: `3a94f5304e0365779aeda5132eb94be3b841287b`.
- CI #3989 / run `41221030798` is QUEUED for this exact code SHA.
- CI #3986 / run `41220915961` failed at typecheck: the optional geography cleanup array was declared on the fixture collection type but not included in the inferred return type of `makeFixture`. Corrected by initializing `extraGeographyIds: [] as string[]` on the returned fixture in the latest commit.
- Earlier #3978/#3982 also failed at typecheck on intermediate commits due duplicate `Pool` import; the latest source has a single runtime import.
- Test cases include denied read/write, pending membership, cross-org payload substitution, denied geography with a different verified scope, positive profile intake with matching verified scope, statutory state remaining `REVIEW_REQUIRED`, external registration remaining `UNKNOWN`, and no writes for denied requests.
- No production changes. CI disposable PostgreSQL remains sole test execution authority.
- Next: verify #3989. Do not describe this integration suite as passed until CI completes.
