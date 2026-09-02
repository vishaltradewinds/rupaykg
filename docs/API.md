# API Contract Principles

All API endpoints are versioned under `/api/v1`.

## Response rules
- HTTP success means the requested operation completed according to its contract, not merely that a request was accepted.
- Dependency failures are surfaced as dependency failures; they are not converted to authentication or validation errors.
- Resource responses expose lifecycle status and provenance where relevant.
- Synthetic/demo data must carry an explicit status and source marker.

## Mutation rules
1. Authenticate the caller.
2. Authorize organization and geography scope.
3. Load authoritative current state from PostgreSQL.
4. Validate the requested transition against domain rules.
5. Persist the state change and audit event transactionally.
6. Trigger downstream workflows only after commit where appropriate.
7. Return the persisted result.

## Integration rules
External authority calls must store external references and response status. A timeout or unavailable dependency must not create a false successful record.

## Error categories
Use stable machine-readable error codes for authentication, authorization, validation, conflict, unavailable dependency, and internal failure. Preserve the appropriate HTTP status through the frontend client.
