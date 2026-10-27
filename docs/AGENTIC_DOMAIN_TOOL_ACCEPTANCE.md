# Agentic domain-tool execution gates

- Use fixed parameterized read-only handlers; never execute model-supplied SQL.
- Enforce per-tool permission checks before querying.
- Scope every query to the authenticated organization and authorized geography.
- Bound result sets and return only minimum metadata; never return evidence bytes or secrets.
- Test denial paths, cross-organization access, geography boundaries, missing database, query failure, and allow-list mapping.
- Onboarding never approves identity or membership. Compliance planning never certifies compliance.
- Run typecheck, unit tests, build, database acceptance tests, browser smoke tests, and production-container build on the exact commit.
- Require independent review and integrated validation before merge. Production certification remains HOLD/OFF until Shakti Standards gates have objective evidence and authorized approval.
