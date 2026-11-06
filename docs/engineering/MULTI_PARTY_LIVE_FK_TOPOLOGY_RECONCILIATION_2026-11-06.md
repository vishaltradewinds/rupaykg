# Multi-Party Live FK Topology Reconciliation — 2026-11-06

## Evidence boundary

Read-only inspection of production Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`. No production DDL, DML, RLS, role, grant, ownership, migration, or deployment mutation was performed.

## Confirmed foreign-key topology

### bwg_waste_reports
- reporting_period_id → bwg_reporting_periods.id
- processor_organization_id → organizations.id
- evidence_id → evidence.id
- verification_id → verifications.id

### chain_of_custody_links
- resource_flow_id → resource_flows.id
- actor_organization_id → organizations.id
- activity_id → activities.id
- from_geography_id → geography.id
- to_geography_id → geography.id
- evidence_id → evidence.id

### credentials
- activity_id → activities.id
- issuer_organization_id → organizations.id
- methodology_version_id → methodology_versions.id
- verification_id → verifications.id

### epr_credit_allocations
- epr_credit_id → epr_credits.id
- obligation_id → epr_obligations.id

### epr_credit_transfers
- credit_id → epr_credits.id
- from_organization_id → organizations.id
- to_organization_id → organizations.id
- evidence_id → evidence.id
- verification_id → verifications.id

### epr_credits
- activity_id → activities.id
- issuer_organization_id → organizations.id
- recycler_organization_id → organizations.id
- scheme_id → epr_schemes.id
- evidence_id → evidence.id
- verification_id → verifications.id

### registry_events
- credential_id → credentials.id
- from_owner_id → organizations.id
- to_owner_id → organizations.id
- recorded_by_identity_id → identities.id
- verification_id → verifications.id

### settlements
- obligation_id → obligations.id
- credential_id → credentials.id
- payer_id → organizations.id
- payee_id → organizations.id

### settlement_events
- settlement_id → settlements.id
- actor_identity_id → identities.id

All observed foreign keys use NO ACTION for DELETE and UPDATE.

## Authorization consequence

These nine surfaces cannot safely receive a blanket single-organization predicate without defining the authoritative subject, actor, counterparty, lifecycle and verification relationships.

The topology confirms the previously established design boundary:

- settlement_events derives subject authorization from settlement;
- transfers have distinct from/to organization semantics;
- credits have issuer/recycler semantics;
- allocations bridge credits and obligations;
- registry events have source/destination owner semantics;
- chain-of-custody links combine actor, activity, resource-flow and geography relationships;
- credentials combine issuer, activity, methodology and verification relationships;
- BWG reports combine processor, reporting-period, evidence and verification relationships.

## Next implementation gate

For each surface, the authorization matrix must be converted into executable disposable PostgreSQL positive/negative tests, including concurrent revocation/suspension/reassignment/lifecycle races, before any production authorization policy is considered.

This evidence does not establish live production RLS, production roles/grants/ownership, field acceptance, regulatory approval, certification, or TRL 9.
