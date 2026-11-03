# Shakti Standards — Migration Incident and Recovery Runbook

**Status:** Engineering runbook; not authorization to modify any live database.  
**Applies to:** RupayKg PostgreSQL migration runner and `schema_migrations` ledger.  
**Release posture:** Fail-closed. Production certification remains OFF until all required release gates are approved.

## 1. Non-negotiable safety rules

1. Never infer live migration history from repository state, a local ledger, a filename, or a CI fixture.
2. Never rewrite or delete migration ledger rows, rename a migration known to have been applied, or backfill a ledger row merely to make a deployment pass.
3. Never automatically reconcile a mismatch. Stop, preserve evidence, and require environment-specific review.
4. Do not run candidate migrations against production as a diagnostic.
5. Test recovery on a disposable database or a verified, access-controlled restore first.
6. A successful CI fixture proves only the scenario exercised. It does not prove that a live environment has the same schema or history.
7. Keep statutory, EPR, CPCB, SWM, CCTS, and ICVCM assessment records intact. ICVCM is complementary; it does not replace Indian statutory obligations.

## 2. Before investigation

Record an incident/change ID and the exact environment. Obtain explicit authorization for read-only inspection. Capture:
- database host/cluster identifier and database name, with secrets redacted;
- migration runner commit SHA, image digest, deployment version, and migration directory listing;
- timestamp and timezone of inspection, operator, and authorization;
- current migration ledger rows (`version`, `filename`, `applied_at` where present);
- table/constraint definitions for `schema_migrations`;
- relevant migration file names and repository SHAs;
- available backup/restore point and its verified timestamp;
- runner logs and exact error codes, without credentials or personal data.

Preserve evidence in access-controlled storage. Do not place connection strings, tokens, personal data, or unredacted production dumps in GitHub issues or pull requests.

## 3. Fail-closed conditions

Stop migration execution and classify the incident if any of the following occurs:
- `MIGRATION_LEDGER_SCHEMA_INVALID`;
- `MIGRATION_IDENTITY_CONFLICT`;
- `MIGRATION_VERSION_CONFLICT`;
- a candidate DDL object already exists but its ledger row is absent;
- a ledger row points to a migration filename that is absent or has a conflicting identity;
- duplicate or malformed ledger rows, unexpected constraints, schema drift, or uncertain migration completion;
- the connection drops while a migration is executing and transaction outcome cannot be proven.

Do not rerun the migration to “see if it works.” The runner's transactional rollback protects only the tested transactional execution path; it cannot undo external side effects or prove recovery for every SQL statement.

## 4. Evidence-based triage

1. **Freeze:** Stop automated and manual migration attempts for the affected environment. Do not disable guardrails.
2. **Capture:** Collect the authorized read-only evidence in Section 2.
3. **Compare:** Compare exact version/filename pairs against the intended release tree. Check known legacy identity pairs in both directions.
4. **Classify:** Distinguish at least:
   - ledger schema malformed;
   - known filename identity conflict;
   - version/filename mismatch;
   - candidate DDL already exists without ledger record;
   - migration recorded but schema object absent or incomplete;
   - unknown/ambiguous state.
5. **Reproduce:** Recreate the observed schema and ledger in a disposable PostgreSQL database. Use a sanitized fixture; do not copy sensitive production data unnecessarily.
6. **Propose:** Document root cause, exact rows/objects affected, alternatives, data-loss risk, and a forward recovery plan. Prefer a new reviewed corrective migration where technically safe; never mutate migration history to hide the discrepancy.
7. **Review:** Require independent database/release review and explicit approval from the accountable owner before any live write.
8. **Validate:** Test the approved plan on a restored copy or disposable environment, including postconditions, invariants, rollback/restore path, and audit trail.
9. **Execute:** Only the authorized operator executes the approved, environment-specific plan in the approved change window with a verified backup and monitoring.
10. **Reconcile:** Capture before/after evidence, verify application and regulatory invariants, and record the final disposition.

## 5. Required recovery approval record

No live repair is approved unless the change record includes:
- incident/change ID and affected environment;
- exact observed ledger and schema evidence;
- root-cause analysis with uncertainty explicitly stated;
- proposed SQL or code reviewed as a complete artifact;
- proof of a successful disposable/restore rehearsal;
- verified backup/restore strategy and responsible operator;
- expected before/after invariants and independent verification queries;
- application owner, database owner, security/compliance reviewer, and release approver sign-off as applicable;
- rollback/restore trigger, stop conditions, and communications plan.

A reviewer must be able to independently reproduce the decision from the evidence without relying on verbal assurances.

## 6. Release gate

A migration-safety CI pass is necessary but not sufficient. Keep release **HOLD** until:
- relevant unit and disposable-PostgreSQL tests pass on the exact candidate commit;
- the Shakti compatibility matrix reflects verified CI evidence;
- authorized read-only evidence exists for every target environment;
- any discrepancy has an independently reviewed and approved recovery plan;
- relevant integration acceptance (including Guardian/HCS/Mirror Node where in scope) is separately evidenced;
- production release approval is explicitly recorded.

**Current boundary:** This runbook documents a safe process. It does not authorize production database access, ledger reconciliation, merge, deployment, or certification.
