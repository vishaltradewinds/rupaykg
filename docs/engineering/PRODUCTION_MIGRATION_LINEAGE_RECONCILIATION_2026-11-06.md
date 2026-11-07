# RupayKg — Production Migration Lineage Reconciliation Evidence
Date: 2026-11-06

Status: ENGINEERING EVIDENCE — production release approval pending.

## Controlling production lineage finding

The authoritative production reconciliation recorded in P0 issue #214 identifies a migration-ledger/source mismatch:

- Production `public.schema_migrations` contains 92 rows and includes `096_verification_authorization_provenance.sql`.
- The active repository migration directory has 91 SQL migration files and does not currently contain that exact 096 source file.
- Historical repository evidence identified the 096 source as having been introduced and subsequently removed from the active line.
- The recovered historical source must remain evidence until its function/trigger semantics are independently reviewed.
- Production schema objects associated with 096 were reported as present during the read-only reconciliation.
- Staging has a separate set of date-prefixed 2026-10-22 through 2026-10-25 migration records that are not part of the current active migration source inventory and must not be copied into production by inference.

## Required reconciliation controls

1. Do not rewrite production migration ledger rows.
2. Do not replay 096 blindly.
3. Do not fabricate a replacement migration checksum or source file.
4. Do not copy staging-only migrations into production without exact-source recovery and independent review.
5. Reconcile every production ledger entry against exact filename, source checksum, schema-object definition and application evidence.
6. Preserve orphaned historical source as immutable audit evidence before proposing any forward-only replacement.
7. Keep production database READ-ONLY/HOLD while lineage and authorization controls remain unresolved.

## Runtime/migrator relationship

The current engineering branch also enforces a protected migration boundary:

- Production application startup must not execute migrations.
- Protected migration configuration requires a dedicated migrator database URL and production mode.
- Migration source manifest generation/checking is part of CI.
- These controls establish an engineering boundary only; they do not prove that a safe dedicated production migrator identity has been provisioned or that production grants/ownership/RLS have been changed.

## Verification authorization dependency

The production reconciliation also identifies a verification-trigger convergence requirement. The historical 096 authorization snapshot source and current verification trigger set must be independently reviewed before any forward-only authorization migration is selected.

Required verification evidence includes:

- same-organization authorization for every verification decision;
- explicit permission keys rather than role-name authority;
- active/non-suspended identity and verified membership;
- fail-closed verified geography for approval decisions;
- immutable decision-time authorization snapshots;
- removal or replacement of contradictory legacy authorization triggers;
- dedicated SECURITY DEFINER ownership and safe search_path/EXECUTE privilege boundaries;
- disposable PostgreSQL negative tests for cross-organization, role-name-only, suspended, unverified, self-approval and snapshot-mutation cases.

## Release boundary

This document records reconciliation evidence and the engineering control boundary only.

It does not authorize:

- production DDL/DML;
- migration replay;
- production RLS activation;
- production role/grant/ownership changes;
- deployment;
- worker activation;
- certification;
- regulatory approval;
- TRL 9 declaration.

Production remains READ-ONLY/HOLD until the lineage, database security, operational, field and independent-review gates are closed.
