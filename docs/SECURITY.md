# Security and Integrity Requirements

## Authentication and authorization
- Strong authentication with session/token expiry and revocation.
- Organization and geography-scoped authorization.
- High-risk actions require explicit permissions.
- No default production passwords or private keys in source code.

### High-risk permission codes
Production roles performing registry or settlement mutations must be granted the specific permission required by the action:

- `VERIFY_EVIDENCE` — approve/reject evidence verification.
- `ISSUE_CREDENTIAL` — record credential issuance in the registry.
- `TRANSFER_CREDENTIAL` — transfer registry ownership.
- `RETIRE_CREDENTIAL` — retire a registry credential.
- `AUTHORIZE_SETTLEMENT` — authorize a settlement workflow.
- `SETTLE_FUNDS` — execute/reconcile/finalize settlement events.

Membership in an organization is not sufficient for these actions. Database triggers enforce the registry and settlement event boundary even when a mutation is attempted outside the HTTP API. Legacy role-name compatibility is limited to explicitly designated operational roles (`issuer`, `registry_operator`, `settlement_operator`, `finance_operator`).

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
