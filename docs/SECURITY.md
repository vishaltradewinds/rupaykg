# Security and Integrity Requirements

## Authentication and authorization
- Strong authentication with session/token expiry and revocation.
- Organization and geography-scoped authorization.
- High-risk actions require explicit permissions.
- No default production passwords or private keys in source code.

## Data integrity
- PostgreSQL is authoritative for business state.
- No in-memory production fallback for business state.
- State transitions are validated server-side.
- Financial, registry and credential operations fail closed when their authoritative dependency is unavailable.

## Audit
Important mutations record actor, organization, request/correlation ID, timestamp, action, target and outcome. Audit data is tamper-evident and may be cryptographically anchored.

## Truthful status
Health endpoints test the actual dependency they report. Configuration presence is not equivalent to service availability. Synthetic/demo data must be explicitly labeled.

## Privacy
Collect only necessary personal data, protect sensitive fields, use least privilege, and define retention/deletion policies appropriate to the jurisdiction and purpose.
