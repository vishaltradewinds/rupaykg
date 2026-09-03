# RupayKG Production Provisioning Runbook

This runbook is the deployment-time configuration boundary for RupayKG. It does not create default privileged users, organizations, roles, credentials, or geography scopes.

## 1. Required production objects

Before exposing the application to real users, provision these objects in PostgreSQL through the organization's controlled administration process:

1. Organization with the correct legal/operational identity and status.
2. Verified identity records for human or service actors.
3. Organization membership for each actor with `status = VERIFIED`.
4. Organization roles with only the permissions required for the actor's duties.
5. Geography scope for each role/organization according to the approved operating boundary.
6. Field-device enrollment only for approved devices and verified field identities.
7. Regulatory/methodology reference data required by the operating workflows.

The repository intentionally does not seed privileged production identities or memberships. Membership alone is not sufficient for high-risk actions.

## 2. High-risk permissions

The production authorization model recognizes these high-risk actions:

- `VERIFY_EVIDENCE`
- `ISSUE_CREDENTIAL`
- `TRANSFER_CREDENTIAL`
- `RETIRE_CREDENTIAL`
- `AUTHORIZE_SETTLEMENT`
- `SETTLE_FUNDS`

Grant these only to explicitly approved roles. Do not add these permissions to a general-purpose operator role merely to make the UI functional.

## 3. Geography authorization

Every operational organization must have an explicit geography scope. Production configuration must reflect the approved India/state/district/sub-district/ULB/ward or Gram Panchayat/village/cluster boundary as applicable.

Do not use a nationwide scope as a convenience default. The API checks organization membership and geography scope before exposing or mutating scoped operational data.

## 4. Field devices

A field device must be enrolled and reach `VERIFIED` status before it can be used by the current authoritative field-sync path.

Enrollment must bind the device to the intended identity and organization. After verification, the device identity/organization binding is immutable through the enrollment guardrails.

Do not provision a shared field-device identity for multiple people merely to bypass enrollment controls.

## 5. Authentication configuration

Production authentication must provide:

- opaque bearer session tokens;
- hashed token storage rather than plaintext token storage;
- expiry and revocation;
- verified organization memberships;
- no default production password or hard-coded credential.

`DATABASE_URL` is mandatory for an authoritative runtime. A runtime without PostgreSQL must fail health readiness rather than serve synthetic operational state.

## 6. Settlement configuration

A settlement may reach `SETTLED` only after the required authorization and external settlement evidence exists.

Production operators must preserve:

- external settlement reference;
- external authority confirmation timestamp;
- reconciliation reference.

Once confirmation/reconciliation evidence is assigned, the database guardrails prevent mutation or clearing of that evidence.

## 7. Pre-production acceptance checklist

Run against the target PostgreSQL environment before public exposure:

- [ ] Apply all ordered migrations successfully.
- [ ] Validate migration ordering.
- [ ] Confirm `/health` returns ready only when PostgreSQL is reachable.
- [ ] Confirm an unverified identity receives `401`/`403` as appropriate.
- [ ] Confirm an organization member cannot access an out-of-scope geography.
- [ ] Confirm a field device in `PENDING` cannot submit authoritative field envelopes.
- [ ] Confirm replay of an idempotent field envelope does not duplicate authoritative records.
- [ ] Confirm unauthorized registry issuance/transfer/retirement is rejected by the database boundary.
- [ ] Confirm unauthorized settlement authorization/settlement is rejected by the database boundary.
- [ ] Confirm `SETTLED` cannot be reached without external confirmation and reconciliation evidence.
- [ ] Confirm settlement confirmation/reconciliation evidence cannot subsequently be cleared or changed.
- [ ] Confirm AI/intelligence endpoints do not mutate authoritative lifecycle state.
- [ ] Confirm the web UI displays only backend-authorized organization/geography data.
- [ ] Confirm no demo/simulated records are presented as production facts.

## 8. Cloud Run gate

Cloud Run deployment is intentionally the final step. Do not deploy until the checklist above passes against the actual production configuration and the target runtime has real organization, identity, role, permission, geography, and field-device provisioning.

The repository is the source of truth for application behavior. Production configuration must remain external to source control; never commit bearer tokens, database passwords, private keys, or other secrets.
