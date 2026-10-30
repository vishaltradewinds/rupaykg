# RupayKg Migration-History Reconciliation Plan
**Date:** 2026-10-30  
**Status:** Evidence and planning only — no live database changes authorized  
**Applies to:** production and staging migration history; Shakti Standards release gate

## 1. Executive finding

The migration runner's canonical history validator is available in draft PR #134. Its current head `c5bb999dcc5343a4e3cc911d7bb703552c1f166c` passed exact-head CI run [#41065339143](https://github.com/vishaltradewinds/rupaykg/actions/runs/41065339143). The job passed dependency audit, migration validation, the migration-runner command, typecheck, build, browser smoke, disposable PostgreSQL acceptance, and production-container build. The runner log explicitly reports `Validated 91 migrations and 73 schema objects` and `Database migrations are current (91 files)`.

This is isolated CI evidence, not approval to merge, run against production/staging, or certify the platform.

## 2. Observed history mismatch

Prior read-only inspection found:
- Production `schema_migrations`: 92 rows; the applied ledger includes `096_verification_authorization_provenance.sql`; the four corresponding `verifications.authorization_*` columns were present.
- Staging `schema_migrations`: 95 rows; it includes date-prefixed migrations `20261022` through `20261025` that are absent from the current main migration catalogue; the four production authorization columns were absent in staging.
- Main's migration catalogue contains 91 numbered/date-prefixed SQL files, ending with `20261021_evidence_artifact_vault.sql`.
- Checked branches `main`, `fix/migration-ledger-preflight-isolated`, and `shakti/dual-ledger-compatibility-tests` each exposed the same 91-file catalogue. Checked branches `cto/batch1-production-safety` and `integration/migration-runner-p0-reconciliation` exposed 95 files, including `088`–`091`, but did not expose the missing `096` or `20261022`–`20261025` sources.
- Git path history for `migrations/096_verification_authorization_provenance.sql` shows it was added in commit `ca8f4100782e13f8d72106187fafc8e1e446214f` and then removed from main in commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`, whose message states: “Remove accidentally placed unreviewed verification migration from main.” Therefore, restoring that SQL merely because production records it would be unsafe without locating its reviewed/approved provenance.
- Git path history returned no commits for the four staging date-prefixed migration paths checked. This means source provenance is not yet established in the inspected history; it does not prove that no source exists in any other branch, artifact, or deployment bundle.

## 3. Non-negotiable controls

1. Keep migration runner fail-closed when catalogue/history mismatches are detected.
2. Never edit applied ledger rows, drop/recreate objects, fake migration versions, or renumber migrations to make the histories appear aligned.
3. Do not replay historical SQL against either live database during investigation.
4. Do not infer migration content from names, schema columns, or downstream effects.
5. Keep production certification **HOLD/OFF** until independent review and all release gates pass.
6. Keep this reconciliation work isolated from parallel EPR/ESG/CCTS, GRI, IoT hardware, and TRL workstreams.

## 4. Required evidence collection

### A. Establish immutable database evidence
For each environment, export a read-only ordered ledger with at least: recorded version, filename, applied timestamp, checksum if recorded, execution status, and runner metadata. Capture schema-only definitions for affected objects and triggers/functions. Redact credentials and personal data. Hash and timestamp each export.

### B. Find authoritative source artifacts
Search every accessible branch, pull request, commit, release artifact, container image/build context, and deployment bundle for the exact original SQL source and associated review/approval. For each candidate record:
- exact repository/ref/commit and blob SHA;
- SQL file SHA-256;
- review/approval and change record;
- migration version/filename and intended ordering;
- idempotency and rollback/forward-repair assessment;
- objects and constraints changed;
- proof the source corresponds to what was applied, not just a similarly named file.

### C. Reconcile each environment independently
Create a row-by-row matrix: applied ledger entry → authoritative source → hash comparison → current schema effect → status (matched, source missing, version mismatch, duplicate/ambiguous, or schema drift). Never collapse production and staging into one assumed history.

### D. Produce a forward-only remediation proposal
Only after source provenance and actual schema are independently confirmed, propose a reviewed, additive forward migration if needed. Include preconditions, lock/availability impact, transactional behaviour, idempotency, rollback/compensation, data preservation, backups, monitoring, and explicit operator approval. The proposal must not execute automatically.

## 5. Acceptance gates

- [ ] Exact applied ledgers exported and hashed, read-only.
- [ ] Authoritative source and approval located for production `096`.
- [ ] Authoritative source and approval located for each staging date-prefixed migration `20261022`–`20261025`.
- [ ] Source hashes and applied schema effects reconciled independently for production and staging.
- [ ] Canonical validator and runner reviewed by a second engineer.
- [ ] Tests prove failure occurs before pending SQL on missing source, wrong version, duplicate catalogue prefix, and empty catalogue.
- [ ] A separate forward-only remediation plan is approved by the database owner and release authority.
- [ ] Staging rehearsal, backup/restore validation, observability, and rollback/compensation plan accepted.
- [ ] Shakti Standards / TRL evidence updated with test environment, scope, limitations, and independent sign-off.

## 6. Current decision

**Engineering validation may continue. Merge, production/staging writes, deployment, and certification are not authorized by this document.** The missing migration sources and their approval history remain unresolved until the evidence gates above are met.
