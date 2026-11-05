# Staging-only migration classification — 2026-11-05

## Decision

The four migration identifiers below are **NOT recovered source migrations** and are **NOT authorized for production replay**:

- 20261022_async_mirror_inbox.sql
- 20261023_async_mirror_worker_leases.sql
- 20261024_ai_intake_rate_limits.sql
- 20261025_ai_evidence_intake_jobs.sql

## Evidence

A prior read-only audit of the non-authoritative Neon staging branch `br-spring-hill-b4544vz5` recorded all four entries in its `public.schema_migrations` ledger, with the same recorded timestamp.

The repository's accessible GitHub history was searched for each exact identifier. No repository commit containing those exact migration identifiers was found.

The existing audit evidence at `docs/audit/evidence/2026-11-04-staging-migrations-20261022-20261025-schema-fingerprint.md` contains catalog-level schema fingerprints for the four resulting feature areas. It explicitly classifies the fingerprint as **not recovered migration source**.

## What this proves

It proves that the four migration identifiers existed in the inspected staging ledger and that the resulting schema objects were observed there.

It does **not** prove:
- original SQL source;
- original SQL hashes;
- original statement ordering;
- transaction boundaries;
- exact dependency sequence;
- production applicability;
- whether the features were ever deployed to production.

## Production decision

Do not copy reconstructed SQL into `migrations/`.

Do not insert or edit `schema_migrations` rows.

Do not replay these migrations against production.

Do not treat the staging schema snapshot as a migration artifact.

## Recovery gate

Original source must be recovered from an approved deployment artifact, Git/PR evidence, CI artifact, backup, or source owner before any production migration decision is made. Once recovered, the exact source must be fingerprinted and executed only in an isolated disposable PostgreSQL rehearsal before any controlled release decision.

Production remains READ-ONLY/HOLD.
