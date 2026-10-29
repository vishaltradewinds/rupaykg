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


## Evidence provenance and verification semantics
- Evidence counts indicate recorded evidence rows within the bounded activity result set; they do not establish artifact integrity, provenance, relevance, admissibility, chain of custody, or regulatory sufficiency.
- An existing `APPROVED` verification decision is surfaced as a recorded status only. The planner does not revalidate verifier identity, independence, authorization, methodology, or underlying evidence.
- Compliance and resource-flow workflows must keep human review required until those checks are backed by authoritative schema fields, validation rules, and integrated tests. Do not convert a count into a compliance claim or credit issuance decision.

## Database-level provenance regression gates
- Verification authorization is enforced through the explicit permission helper; role names alone (for example, AUDITOR or VERIFIER) must not grant verification authority.
- A verification's supplied activity must match the activity that owns its evidence; self-verification remains prohibited.
- Evidence artifact inserts must recompute SHA-256 from stored bytes and match the canonical evidence content hash. API-only digest checks are insufficient.
- Integration acceptance must attempt a forged artifact insert directly through SQL and confirm the database rejects it.
- These controls establish consistency of stored bytes and permission checks; they do not establish that the source document is genuine, legally admissible, or independently validated against a physical event.

## Cross-route role geography acceptance
- Geography-bound API reads and mutations must enforce both organization scope and the active identity's role scope through `identity_has_geography_scope`; direct role checks alone are insufficient when multiple verified roles exist.
- Multiple verified roles for one identity in one organization fail closed until the platform has an explicit, validated active-role selector.
- The shared gate is covered in agentic PostgreSQL acceptance tests and is applied to workspace reads, EPR returns/obligations, CPCB SWM workspaces, Guardian MRV operations, and evidence verification.
- Continue the audit for registry, settlement/sync, value/carbon, statutory applicability, and onboarding route families. This acceptance list is not a claim that platform-wide authorization review is complete.
