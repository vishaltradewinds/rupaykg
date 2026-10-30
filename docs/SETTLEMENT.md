# Settlement

Settlement converts eligible verified obligations or transactions into governed financial workflows.

## Lifecycle
`ELIGIBLE -> CREATED -> AUTHORIZED -> EXECUTING -> RECONCILING -> SETTLED`

Failure states: `REJECTED`, `FAILED`, `CANCELLED`.

Settlement must reference the exact source records and amounts that made it eligible. Financial state is not inferred from a UI event. Payment-provider or ledger responses are persisted with external identifiers and reconciliation status.

Automated payment or smart-contract execution may be used where configured, but it is a downstream execution mechanism, not evidence that the underlying physical activity occurred.

## MRV evidence revocation and existing obligations

A later rejection, expiry, or invalidation of instrument evidence is a prospective eligibility stop, not an automatic reversal of historical events:

- New credential issuance, registry transfer, and value-bearing settlement transitions must fail closed when required instrument evidence is no longer current.
- A previously committed registry anchor does not override current evidence eligibility.
- Do not silently rewrite, delete, or auto-retire an issued credential solely because supporting evidence is rejected. Preserve the audit trail and route the case for authorized compliance review under the applicable registry, methodology, contract, and statutory rules.
- An open settlement that has not reached a terminal state must not progress to execution/reconciliation/settlement after evidence becomes stale. The responsible authorized operator must decide whether it can be cancelled, marked failed, or must be held for investigation; preserve payment-provider identifiers, reconciliation history, and all prior events.
- A settlement already in a terminal SETTLED state is historical financial state. Evidence rejection alone does not reverse a payment or delete settlement records. Any correction, reversal, or credit adjustment must use a separately authorized, auditable workflow and applicable payment/contract rules.
- Evidence review and value-bearing use must serialize at the database boundary in a consistent instrument-then-evidence lock order. If a transaction acquired the required locks and committed the value-bearing action before rejection, that action remains recorded; after rejection commits, later value-bearing actions must fail closed.

These controls establish a technical eligibility gate only. They do not decide legal invalidation, credit cancellation, customer remedies, payment reversal, or statutory reporting obligations. Those decisions require an approved policy for the relevant registry/methodology and jurisdiction before production certification. Synthetic CI provenance and fixtures are not real-world evidence.
