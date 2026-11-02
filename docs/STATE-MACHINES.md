# Authoritative State Machines

State transitions are backend-controlled. The frontend may request transitions but cannot invent or force them.

## Activity
`DRAFT -> SUBMITTED -> ACCEPTED -> COMPLETED` or `REJECTED`

An activity can reach `COMPLETED` only when required measurements/evidence are persisted.

## Evidence
`CAPTURED -> SUBMITTED -> UNDER_REVIEW -> VERIFIED`
Alternative terminal state: `REJECTED`.

## Verification
`REQUESTED -> IN_REVIEW -> APPROVED` or `REJECTED`.

## Credential
`ELIGIBLE -> ISSUED -> ACTIVE -> TRANSFERRED -> RETIRED`
Issuance requires verified source records and configured issuer trust.

## Obligation/compliance
`OPEN -> EVIDENCE_PENDING -> UNDER_REVIEW -> COMPLIANT` or `NON_COMPLIANT`.
`COMPLIANT` requires all configured evidence and verifier conditions.

## Settlement
`ELIGIBLE -> CREATED -> AUTHORIZED -> EXECUTING -> RECONCILING -> SETTLED`
Failure paths include `REJECTED`, `FAILED` and `CANCELLED`.

## Registry
Registry mutations are append-only domain events plus a current projection. Transfers and retirements fail closed when the authoritative registry integration is unavailable.

## General invariant
A downstream state must never imply completion of an upstream state that has not been authoritatively persisted and satisfied.
