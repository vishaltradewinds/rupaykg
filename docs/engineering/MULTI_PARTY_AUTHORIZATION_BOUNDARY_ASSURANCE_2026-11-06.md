# Shakti Batch C — Multi-Party Authorization Boundary Assurance

Date: 2026-11-06  
Status: Validation-only / engineering evidence  
Production posture: READ-ONLY / HOLD

## Purpose

Batch C must not turn every tenant-sensitive table into a single organization RLS problem. Nine tables have multiple organizational actors or multiple ownership paths. A blanket tenant predicate could silently deny legitimate cross-party operations or, worse, authorize one party to see another party's data.

The rehearsal therefore treats these tables as explicit-domain-authorization surfaces rather than applying a single-owner policy.

## Multi-party surfaces

| Table | Authorization shape |
|---|---|
| bwg_waste_reports | Reporting-period organization + processor organization + evidence/verification relationships |
| chain_of_custody_links | Resource flow + actor organization + activity + geography + evidence |
| credentials | Issuer organization + activity + verification + methodology |
| epr_credit_allocations | Credit + obligation ownership |
| epr_credit_transfers | From organization + to organization + credit + evidence/verification |
| epr_credits | Issuer + recycler + activity + evidence/verification |
| registry_events | From owner + to owner + credential + verification + recorder |
| settlements | Payer + payee + obligation/credential |
| settlement_events | Settlement-derived authorization + actor identity |

## Engineering assertions

The executable rehearsal verifies:

1. all nine tables exist;
2. required multi-party authorization columns exist;
3. expected FK topology is intact;
4. these tables are not silently converted into a blanket single-organization policy;
5. settlement_events derives authorization from its parent settlement rather than inventing an independent tenant owner.

This is an authorization-boundary specification, not a claim that the final production policies are implemented.

## Required next step

Each table now requires a separate business authorization matrix defining, at minimum:

- actor/organization role;
- allowed operation;
- subject ownership;
- counterparty visibility;
- evidence/verification dependency;
- geography constraints;
- lifecycle/status constraints;
- suspension/revocation behavior;
- audit/provenance requirements;
- fail-closed behavior when any required relationship is missing.

Only after that matrix is independently reviewed should production RLS/policy implementation be designed.

No production DDL, DML, RLS, role, grant, ownership, deployment, merge, certification, or TRL 9 declaration is authorized by this rehearsal.
