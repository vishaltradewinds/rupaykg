# Shakti RLS Activation Gate

## Purpose
Controlled production RLS activation artifact for the core tenant data plane.

## Preconditions
1. Application runtime uses rupaykg_app_runtime, not the database owner.
2. rupaykg_app_runtime is NOSUPERUSER and NOBYPASSRLS.
3. Runtime grants are limited to required DML, sequence and function privileges.
4. Every authenticated tenant request establishes transaction-local identity and organization context on the same DB session used for protected queries.
5. Representative cross-tenant negative tests pass for activity, measurement, evidence, carbon calculation, registry, MRV and workspace paths.
6. Production runtime identity is independently proven from the live process/connection.

## Core RLS scope
- activities
- measurements
- evidence
- carbon_calculations
- epr_obligations

Child records derive tenant scope from their parent activity where appropriate.

## Explicit privileged/global boundaries
Public regulatory-source catalogues, platform administration, onboarding authority hierarchy, Guardian/Hedera anchoring and other external integration boundaries are not blindly placed under ordinary tenant RLS. They require explicit privilege/authority contracts.

## Safety rule
Do not execute this migration from application startup. Do not enable FORCE ROW LEVEL SECURITY until runtime ownership and role separation are proven.

## Current state
Production RLS remains OFF. This file is an activation artifact, not evidence of activation.
