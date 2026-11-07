# Shakti Batch C — Executable Multi-Party Authorization Assurance

Date: 2026-11-06

## Status

Validation-only engineering evidence. Disposable PostgreSQL rehearsal. No production authorization policy, RLS, role, grant, ownership, migration, deployment, or certification change.

## Covered surfaces

The rehearsal executes positive and negative authorization decisions across all nine explicit-domain surfaces:

- bwg_waste_reports
- chain_of_custody_links
- credentials
- epr_credit_allocations
- epr_credit_transfers
- epr_credits
- registry_events
- settlements
- settlement_events

## Assertions

The executable contract proves the disposable authorization primitive rejects:

- unverified identities;
- suspended identities;
- identities without the explicit permission;
- unverified geography;
- invalid lifecycle state;
- mutable registry provenance;
- unauthorized settlement-event actor access.

It also exercises valid same-domain authorization and the distinct actor/counterparty semantics of multi-party surfaces.

The rehearsal intentionally does not claim that this primitive is wired into the live application authorization path or production database.

## Required next gate

Reconcile these executable cases against the real application service authorization functions/routes and the live production catalog, then obtain independent DBA/security review. Only after that may production RLS/roles/grants/ownership changes be considered under explicit release approval.

## Evidence boundary

PASS here means disposable engineering authorization behavior only. It does not establish live production tenant isolation, live roles/grants, external integrations, field acceptance, regulatory approval, certification, or TRL 9.
