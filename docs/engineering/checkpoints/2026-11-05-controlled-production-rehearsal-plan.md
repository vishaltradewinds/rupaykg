# RupayKg Controlled Production-Rehearsal Plan — 2026-11-05

## Status

**Planning / validation artifact only. Production remains READ-ONLY / HOLD.**

This document defines the next release gate after the synchronized engineering stack (#289, #290, #291, #298, #299). It does not authorize production migration, deployment, RLS activation, role/grant changes, or certification.

## Objective

Prove the complete release path against a disposable PostgreSQL target that is structurally representative of the authoritative production schema, while preserving production data and credentials.

The rehearsal must prove:

1. web startup performs no schema migration or acceptance fixture seeding;
2. the protected migrator is the only migration execution path;
3. the protected migrator rejects `DATABASE_URL` reuse;
4. the protected migrator verifies target database and user identity;
5. strict TLS/CA validation is enforced for production mode;
6. the frozen migration manifest exactly matches active migration source;
7. orphaned ledger versions fail closed before any pending migration executes;
8. migration execution is serialized by the single-session advisory lock;
9. security-context ownership is non-superuser / NOLOGIN / NOBYPASSRLS;
10. verification authorization converges to one canonical trigger and preserves authenticated context;
11. geography-scope revocation serializes against verification approval;
12. rollback/restore evidence is produced before any production release decision.

## Required evidence package

The rehearsal record must contain, at minimum:

- reviewed source commit SHA;
- reviewed migration manifest SHA-256;
- exact migration inventory and lineage disposition;
- disposable target database identity;
- migration start/end timestamps;
- migration stdout/stderr;
- schema migration ledger before/after;
- orphan-ledger negative test output;
- helper-owner security test output;
- verification-trigger convergence output;
- authenticated-context negative/positive test output;
- geography concurrency output;
- backup/restore or equivalent disposable rollback proof;
- production-container startup assertion;
- exact-head CI run identifier;
- independent reviewer sign-off.

## Production-specific unresolved gates

Before any controlled production execution:

- migration 096 must have an independently reviewed disposition;
- actual Render runtime database/role/branch identity must be proven;
- production backup/restore capability must be evidenced;
- an immutable reviewed production migration manifest must be frozen;
- DBA/security review must be independently recorded;
- release operator and rollback owner must be identified;
- the protected migrator target identity must be verified without exposing production credentials in CI;
- the production migration plan must be forward-only and must not silently rewrite `schema_migrations`.

## Prohibited shortcuts

Do not:

- restore migration 096 to active source merely to equalize counts;
- delete or rewrite the production 096 ledger row;
- replay 096 without an approved forward-only dependency plan;
- copy staging-only 20261022–20261025 into production by inference;
- use the web-service `DATABASE_URL` as the migration credential;
- run the protected migrator from the ordinary web startup path;
- enable RLS globally as an unreviewed production change;
- merge individual green PRs as if they were independent release units;
- declare TRL 9 from CI or rehearsal evidence alone.

## Exit criteria

The release stack may move from HOLD to controlled-release consideration only when every required evidence item is present, independently reviewed, and traceable to the exact release commit and target environment.

Until then:

**Production = READ-ONLY / HOLD.**
