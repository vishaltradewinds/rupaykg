# Agentic domain-tool execution gates

- Use fixed parameterized read-only handlers; never execute model-supplied SQL.
- Enforce per-tool permission checks before querying.
- Scope every query to the authenticated organization and authorized geography.
- Bound result sets and return only minimum metadata; never return evidence bytes or secrets.
- Test denial paths, cross-organization access, geography boundaries, missing database, query failure, and allow-list mapping.
- Onboarding never approves identity or membership. Compliance planning never certifies compliance.
- Run typecheck, unit tests, build, database acceptance tests, browser smoke tests, and production-container build on the exact commit.
- Require independent review and integrated validation before merge. Production certification remains HOLD/OFF until Shakti Standards gates have objective evidence and authorized approval.
- Each workflow may query only the aggregate domains in its allow-list: measurement review excludes evidence/verification counts; resource-flow tracing excludes measurement/verification counts; compliance preparation may read all three required aggregate domains.
- Regression tests assert disallowed aggregate tables are absent from each goal's generated fixed SQL, and unavailable aggregate fields return zero rather than leaking other domains' counts.
- Model-explanation tests assert tenant/geography/source-record identifiers are not sent to the provider; blocker input and model output remain bounded; malformed provider responses fail closed.
- Aggregate counts derived from the latest bounded activity result set must be labelled as bounded in plan explanations; never present a capped sample as an exhaustive organization-wide total.
