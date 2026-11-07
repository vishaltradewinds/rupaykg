# RupayKg — Request-Path Database Access Boundary Evidence
Date: 2026-11-06

Status: ENGINEERING EVIDENCE — release approval pending.

## Scope

The inspected request-path modules are:

- apps/src/server.ts
- apps/src/value-routes.ts
- apps/src/sync-routes.ts
- apps/src/registry-routes.ts
- apps/src/platform-admin-routes.ts
- apps/src/mrv-routes.ts
- apps/src/workspace-routes.ts
- apps/src/evidence-vault-routes.ts
- apps/src/statutory-routes.ts
- apps/src/auth-routes.ts
- apps/src/onboarding-hierarchy-routes.ts
- apps/src/bwg-routes.ts
- apps/src/cpcb-swm-routes.ts
- apps/src/intelligence-routes.ts

## Result

A source-level scan of the inspected modules found no request-path occurrences of:

- pool.query
- pool.connect
- Pool | PoolClient helper signatures

The server health probe and regulatory catalog are explicitly wrapped in the bootstrap database context. Operational request paths use the tenant context or a transaction-scoped PoolClient.

The acceptance fixture is intentionally excluded from this request-path control because it is a controlled test utility and is no longer invoked by the production start command.

## Regression control

apps/src/runtime-access-path-boundary.test.ts now enforces the inspected request-path boundary in CI.

This evidence is code-level only. It does not prove production RLS, production role separation, production grants, or live tenant isolation.

## Release boundary

Production remains READ-ONLY/HOLD. No production DDL, DML, RLS activation, role/grant/ownership mutation, deployment, merge, certification, or TRL 9 declaration is authorized by this evidence alone.
