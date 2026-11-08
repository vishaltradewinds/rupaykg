# Shakti Registry Boundary Classification — 2026-11-08

## Scope
Repository: vishaltradewinds/rupaykg
Controlled ref: cto/20261107-protected-migration-ci

This is an engineering boundary-classification gate. It does not establish production RLS activation, regulatory acceptance, certification, or TRL 9.

## Classification

| Surface | Authority model | Required execution boundary | Status |
|---|---|---|---|
| Credential issuance | Tenant-owned issuer + registry authority | Tenant transaction bound to issuer organization | Remediated |
| Credential activation | Tenant-owned issuer | Tenant transaction bound to active issuer organization | Remediated |
| Credential transfer | Multi-party registry state transition; current owner is authoritative actor; destination is a counterparty | Tenant transaction bound to current owner + explicit destination validation | Remediated |
| Credential retirement | Tenant-owned current registry owner | Tenant transaction bound to current owner | Remediated |
| Settlement creation | Multi-party payer/payee | Tenant transaction bound to payer + explicit bilateral authorization | Remediated |
| Settlement authorization | Multi-party payer/payee | Tenant transaction bound to payer + explicit bilateral authorization | Remediated |
| Settlement execution | Multi-party payer/payee | Tenant transaction bound to payer + explicit bilateral authorization | Remediated |
| Settlement confirmation | Multi-party payer/payee + external reconciliation authority | Tenant transaction bound to payer + explicit bilateral authorization + external reference gates | Remediated |

## Boundary rule

The registry is **not** classified as an ordinary single-tenant subsystem.

Its mutation paths are:
1. tenant-authorized when one organization is the authoritative owner/issuer; or
2. multi-party when a payer, payee, current owner, or destination organization participates.

For multi-party operations, the transaction context is anchored to the authoritative actor (currently the payer/current owner), while authorization for every participating organization remains explicit at the application layer. A request body must not be allowed to replace the authoritative tenant context.

## RLS implication

The current controlled RLS activation gate protects the core MRV tables only. Registry tables are therefore **not automatically cleared for production RLS activation** by this classification.

Before production RLS is enabled on registry tables, the following must be separately proven:
- authoritative owner/actor mapping for every registry table;
- policy behavior for current-owner and counterparty access;
- non-BYPASSRLS runtime execution;
- negative cross-tenant and unauthorized-counterparty tests;
- event/provenance visibility rules;
- reconciliation of registry policies with the master Shakti RLS policy matrix.

## CI gate

The registry tenant-boundary contract provides a static regression guard ensuring registry mutation routes remain transaction-bound and settlement routes retain bilateral authorization.

## Release status

Production Neon: READ-ONLY / HOLD.

Production registry RLS activation: HOLD pending policy-matrix reconciliation and disposable runtime acceptance.

TRL 9: NOT CLAIMED.
