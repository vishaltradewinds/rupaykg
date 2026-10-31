# 2026-10-31 16:44 UTC — BWG integration test corrections and latest CI

- Current code commit: `ce270eb9068172da677456be57bdcdb93c04d346`.
- CI #3986 / run ID `41220915961` is IN_PROGRESS for that exact code SHA at log creation.
- CI #3978 / run `41220707529` failed at typecheck because the initial test introduced duplicate `Pool` imports and attempted to instantiate a type-only import.
- CI #3982 / run `41220846345` failed at typecheck because it was run on intermediate SHA `0ea8bbce218c0a055feca8ae893acd91450e84a7`: duplicate import remained in that commit and fixture return type did not yet declare optional extra geography IDs.
- Both defects were corrected by subsequent code edits; latest source at `ce270eb9068172da677456be57bdcdb93c04d346` has one runtime `Pool` import and a typed `extraGeographyIds` fixture field. CI #3986 is the verification authority.
- Added an authorized positive path: verified member with `profile:update` and matching verified geography scope can create a BWG profile, but the result remains `REVIEW_REQUIRED` and regulatory registration remains `UNKNOWN`.
- Denied organization IDs are separately asserted to have no BWG profile writes.
- Geography denial fixture now creates a separate verified geography scope and submits a different geography, matching the current helper's semantics. Production inspection showed `organization_has_geography_scope` returns true if an organization has no verified geography scopes; this permissive default is recorded for separate security review and was not changed.
- No production database changes, DDL, role/grant changes, deployment or worker/scheduler activation.
