# Shakti Batch C — Multi-Party Authorization Matrix

**Status:** validation-only engineering specification. No production policy or authorization mutation.

## Rule
These nine surfaces are not covered by a blanket single-organization RLS predicate. Authorization must be evaluated from the business domain relationship, actor identity, subject ownership, counterparty visibility, evidence/verification dependency, geography, lifecycle state, suspension/revocation, and audit provenance. Missing or ambiguous authorization MUST fail closed.

| Surface | Primary subject | Actor / authority | Counterparty | Required dependencies | Fail-closed rule |
|---|---|---|---|---|---|
| bwg_waste_reports | reporting period + processor org | verified processor/member with explicit report permission | reporting-period org | evidence + verification | missing org/member/evidence/verification => deny |
| chain_of_custody_links | resource-flow/activity custody edge | verified actor org with custody permission | from/to geography/org | evidence + activity/resource flow | any unresolved owner/edge/geography => deny |
| credentials | credential issuance | verified issuer identity/org with explicit credential permission | activity/verification subject | methodology + verification | unverified issuer or subject => deny |
| epr_credit_allocations | credit allocation | authorized credit/obligation actor | credit owner + obligation owner | credit + obligation lifecycle | ownership mismatch or inactive obligation => deny |
| epr_credit_transfers | credit transfer | verified transferor actor | from/to organizations | evidence + verification + credit lifecycle | either party unresolved/revoked => deny |
| epr_credits | issued credit | verified issuer/recycler authority | issuer/recycler | activity + evidence + verification | unresolved issuer/recycler/verification => deny |
| registry_events | registry state transition | verified registry authority | from/to owner | credential + verification + recorded identity | unauthorized transition or missing provenance => deny |
| settlements | settlement obligation | authorized payer/payee actor | payer/payee | obligation + credential lifecycle | unresolved counterparty or lifecycle mismatch => deny |
| settlement_events | event on settlement | authorized actor under parent settlement | inherited payer/payee | parent settlement authorization | parent authorization failure => deny |

## Operation matrix

For SELECT, expose only records for which the caller has an explicit business visibility grant and every required subject/counterparty relationship is valid.

For INSERT, require explicit operation permission plus valid subject ownership/authority, verified identity and organization, active lifecycle state, and all required evidence/verification dependencies. WITH CHECK must enforce the same domain boundary as the read predicate.

For UPDATE, re-evaluate the complete authorization tuple using current authoritative state. Do not authorize from a client-supplied organization identifier or stale role name.

For DELETE, default deny for regulated provenance, registry, custody, credit, verification, and settlement records. Corrections must use an approved superseding event/version mechanism where the domain permits it.

For TRUNCATE, deny to runtime application identities; only controlled maintenance identities may possess any such capability, outside normal request paths.

## Cross-cutting invariants

1. Identity must be verified and non-suspended.
2. Organization must be verified and active.
3. Membership must be verified, current, and bound to the organization.
4. Permission must be an explicit permission key; role names are never authorization authority.
5. Geography must be explicitly verified where the domain requires geography; missing scope fails closed.
6. Subject and counterparty relationships must be resolved from authoritative foreign-key/domain state, never trusted from bearer input alone.
7. Verification dependencies must satisfy the canonical verification authorization guard.
8. Suspension/revocation/lifecycle changes must invalidate authorization immediately for new decisions.
9. Decision-time provenance must be immutable and auditable.
10. Concurrent revocation, suspension, reassignment, or lifecycle transition must resolve to deny unless authorization remains unambiguously valid under the transaction's locking/serialization rules.

## Required implementation sequence

1. Complete this matrix with domain-owner review for each operation.
2. Build disposable PostgreSQL negative/positive tests for every surface.
3. Test concurrent revocation, suspension, geography reassignment and counterparty change.
4. Reconcile the resulting policy/function/trigger design against the 67-table production catalog without modifying production.
5. Obtain independent DBA/security review.
6. Only after explicit release approval may production RLS/role/grant/ownership changes be considered.

**Evidence boundary:** this document is an engineering authorization specification. It is not production evidence, regulatory approval, certification, field acceptance, or TRL 9 evidence.