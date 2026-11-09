# RupayKg G-002 Production Activation Checkpoint — 2026-11-09

Status: ENGINEERING PACKAGE PREPARED — PRODUCTION NOT ACTIVATED

## Current verified state

- Canonical repository: vishaltradewinds/rupaykg
- Canonical target: main
- Production Neon branch: br-restless-base-b44cip2h
- Production database: rupaykg
- Production migration count: 92
- Production max migration: 20261021
- Production DB owner account: non-superuser but BYPASSRLS=true
- All 17 protected tables currently remain RLS-disabled.
- Current production protected-table ownership is not yet separated from the privileged owner model.
- Production application runtime cutover has not occurred.

## Completed engineering gates

- G-002 CI acceptance: PASS.
- Isolated Neon tenant-isolation rehearsal: PASS.
- Runtime-login acceptance: PASS.
- Deployed Render staging runtime DB preflight: PASS.
- Production activation runbook: PREPARED.
- Production DDL/runtime role-separation migration: PREPARED in the canonical repository.

## Production DDL role-separation gate

Migration: migrations/100_shakti_production_ddl_runtime_role_split.sql

Latest commit: f4567ca96a83a001d4421f25522ad90c31c47b8a

The migration is fail-closed and:
- rejects application runtime roles;
- requires a dedicated non-login, non-superuser, non-BYPASSRLS rupaykg_ddl role;
- verifies all 17 protected tables exist;
- aborts on unexpected ownership;
- transfers ownership to rupaykg_ddl;
- does not activate RLS;
- does not change application runtime credentials.

## Important rehearsal finding

The existing older role-split rehearsal branch uses a historical owner model (rupaykg_owner_model_20261106) and therefore is not a faithful rehearsal of the current production ownership state. It must not be treated as production evidence.

## Remaining controlled gates

1. Execute production DDL ownership separation only in an explicitly authorized production change window.
2. Verify all 17 tables are owned by rupaykg_ddl and runtime owns none.
3. Verify the exact production runtime credential is NOSUPERUSER/NOBYPASSRLS.
4. Execute controlled RLS activation under DDL authority.
5. Run production cross-tenant negative acceptance with disposable fixtures.
6. Deploy application using only the dedicated runtime credential.
7. Capture complete evidence package and make the release decision.

## Safety boundary

Production has not been modified by this checkpoint. No production RLS activation, runtime cutover, regulatory certification, field validation, or TRL 9 claim is made.
