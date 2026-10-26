# RupayKg Greenfield Data Migration Strategy

**Status:** Proposed migration policy — source inventory and retention decisions required  
**Scope:** Transition to the intended pan-India RupayKg platform  
**Standard:** Shakti Standards  
**Critical distinction:** Greenfield refers to the target platform/data model and migration approach. It does not mean blindly deleting existing data or rebuilding all application code.

## 1. Decision

RupayKg must not inherit legacy database structure, migration numbering, pilot-specific assumptions, seeded acceptance records, or old workflows merely because they exist. Equally, existing operational, contractual, statutory, audit, financial, identity, or evidence records must not be discarded or altered without an evidence-based retention and migration decision.

The target data model is defined by the pan-India operating requirements. Source data is evaluated independently for whether it should be migrated, retained in a controlled archive, transformed into a reference record, quarantined for review, or excluded.

**No production migration, destructive cleanup, or source-system shutdown is authorized by this document.**

## 2. Migration outcomes by data class

| Source-data class | Default disposition | Required decision/evidence |
|---|---|---|
| Organization, account, user and role records | Migrate only if still relevant and legally permissible; revalidate identities and permissions | Owner, identity provenance, consent/notice where applicable, tenant mapping, access review |
| Facility and geography records | Reuse only with verified source, identifiers, version and current status | Source authority, duplicate resolution, jurisdiction, authorization kept separate from registration |
| Waste/material/activity records | Migrate only where useful to live workflows, reporting, reconciliation or required history | Provenance, units, classification mapping, effective date, quality status, duplicate and conflict handling |
| Custody, dispatch, receipt, weighbridge and transport events | Preserve traceability where records represent real transactions or are required for audit | Original event/evidence references, actor attribution, time and timezone, correction history, reconciliation |
| Environmental, MRV, EPR and carbon-related records | Preserve original evidence and historical methodology context where required; do not silently recalculate or promote status | Methodology version, boundaries, evidence lineage, verification status, scheme/source reference, authority for status |
| Contracts, invoices, payments and settlements | Migrate only under accountable business/legal approval and reconciliation | Counterparty, amounts/currency, tax/accounting requirements, external transaction references, opening-balance reconciliation |
| Regulatory approvals, permits, certificates and audit records | Preserve as evidence if relevant/required; re-check validity and applicability separately | Issuer, identifier, issue/expiry dates, jurisdiction, scope, authenticity and verification source |
| Application configuration and business rules | Recreate in the target model after review; do not copy blindly | Owner, purpose, version, approved behavior and change history |
| Credentials, session tokens, API secrets, private keys | **Do not migrate as ordinary data**; rotate/reissue through the secret-management process | Revocation/rotation evidence and least-privilege review |
| Demo, test, acceptance and synthetic data | Exclude from operational datasets; retain only in clearly isolated test environments if useful | Synthetic provenance and proof of environment separation |
| Logs, telemetry and temporary caches | Usually exclude or aggregate; preserve only where needed for security, legal hold or incident investigation | Retention policy, privacy review, purpose and time window |
| Duplicate, malformed, orphaned, unverified or conflicting records | Quarantine for review; never silently merge, delete, or treat as authoritative | Exception report, decision owner, disposition reason and audit trail |
| Personal or sensitive information without a clear continuing purpose | Exclude, minimize, redact, or retain under restricted legal hold as approved | Applicable legal basis, purpose, retention rule, access controls and approval |

These are default dispositions, not blanket legal determinations. Applicable statutory, contractual, privacy, accounting, scheme and litigation-hold requirements must be verified for the actual dataset and jurisdiction.

## 3. Source inventory before implementation

For every source system/database/export, record:

- System owner, environment, provider/project, database/schema identity and accountable contact;
- Whether it is production, staging, test, acceptance, or synthetic;
- Data domains, table/collection names, record counts, approximate size, date range and last-write timestamp;
- Data lineage, source authority, tenant/organization ownership and external identifiers;
- Personal, commercially sensitive, regulated, financial, environmental, and evidentiary content;
- Dependencies, foreign keys, triggers, jobs, API consumers and external systems;
- Current retention/legal-hold obligations, quality issues, duplicates and known gaps;
- Backup/restore evidence, export method, encryption and access controls;
- Disposition proposed per data class, with decision owner and approval status.

Do not copy secrets or raw personal data into tickets, logs, pull-request comments, or this inventory document. Use aggregate counts and sanitized metadata wherever possible.

## 4. Target-first schema and mapping

1. Define the target domain model from national operating requirements—not from the source table layout.
2. Create a versioned mapping for each source field to a target field, controlled reference, derived value, archive-only field, or rejected field.
3. Document transformations, units, timezone normalization, identifier strategy, deduplication keys, defaults, null handling, and rejected-row behavior.
4. Preserve original source identifiers and provenance references for migrated records where legally and technically appropriate.
5. Keep original evidence immutable. Corrections should create attributable correction events rather than silently overwrite evidence.
6. Keep source status separate from target status; unverified source claims must not become verified target claims.
7. Do not translate a facility registration, membership, measurement, calculated environmental benefit, or historical credit record into a legal approval or verified outcome without authoritative evidence.
8. Make migrations idempotent, resumable, observable, and reversible where feasible; document explicitly any operation that cannot be rolled back.

## 5. Migration waves and gates

### Gate A — Discovery and authorization
- Source owner and actual source target confirmed.
- Data inventory and classification complete.
- Legal/contractual retention and privacy review complete where applicable.
- Per-class disposition approved by accountable owner.
- Backup/restore and export integrity verified.

**Exit condition:** no unknown source or data class is silently included.

### Gate B — Mapping and dry run
- Target schema and mapping reviewed.
- Counts, required-field coverage, duplicates, orphans, rejected rows and transformation exceptions reported.
- Sensitive fields and credentials handled under explicit controls.
- Dry run performed on a controlled, non-production copy.

**Exit condition:** exceptions are within explicitly approved tolerances; otherwise stop and remediate.

### Gate C — Reconciliation
- Source-to-target counts reconciled by entity type, tenant, date range and status.
- Financial, custody, measurement, evidence and registry relationships reconciled where applicable.
- Hashes or other integrity checks used for evidence/artifacts where appropriate.
- Sample records traced end-to-end back to source evidence.
- Rejected/quarantined rows have disposition owners.

**Exit condition:** signed reconciliation evidence, not merely a successful script exit code.

### Gate D — Cutover readiness
- Target environment and database identity confirmed from sanitized authoritative metadata.
- Backup/restore and recovery objectives evidenced.
- Write freeze or delta-capture plan agreed, including external integrations.
- Cutover, rollback, monitoring, communication and accountable authorization documented.
- Tenant isolation, access rights and production secrets revalidated.

**Exit condition:** accountable release approval; no unresolved critical data-integrity or access-control issue.

### Gate E — Post-cutover assurance
- Compare post-cutover counts, deltas, error rates and key business totals.
- Verify authentication, authorization, audit history, evidence retrieval, custody workflows, reports and integrations.
- Monitor reconciliation exceptions and provide an operational support window.
- Preserve source data under the approved retention/archival plan until exit criteria are met.
- Decommission source systems only after explicit approval and retention obligations are satisfied.

## 6. Greenfield database and migration-history rule

The target database should be created from the approved target schema and reviewed migrations. Existing migration history is not automatically a product requirement.

First establish whether a source database contains data that must be migrated and whether the target is:
- a new empty database;
- a replacement for an existing operational database;
- a new database alongside a retained/archive source; or
- a fresh application environment that still depends on specific existing operational records.

If the target is a genuinely new empty database, validate a clean install from the approved migration inventory. Do not spend time supporting obsolete migration histories without a demonstrated retention/business need.

If existing data must be retained or moved, use a separately reviewed **data migration** pipeline and explicit source-to-target mapping. Do not conflate data migration with replaying old schema migrations against an arbitrary live database.

If historical schema upgrades are genuinely required, identify only the supported starting schema versions from evidence, then test those exact upgrade paths on disposable database copies. Do not renumber released migrations merely to close numerical gaps; resolve migration conflicts according to actual applied history and the intended target.

## 7. Prohibited shortcuts

- No production writes before source and target identity, authorization, backup, and rollback/recovery readiness are confirmed.
- No blind full-database copy from a legacy or pilot environment.
- No automatic migration of synthetic/demo/acceptance identities into operational tenants.
- No copying credentials or tokens as part of a data dump.
- No silent deletion, deduplication, overwriting, or promotion of unverified records.
- No assumption that a CI pass proves data reconciliation or real-world acceptance.
- No claim that the new platform is production-ready merely because the clean schema installs.
- No shutdown of a source system until retention, reconciliation and accountable sign-off gates pass.

## 8. Current evidence gaps

At the time of this document, the following are not established by this strategy alone:

- Whether the currently configured database is an actual operational source, a temporary environment, or an unrelated/suspended resource;
- Which real user, business, regulatory, financial, audit or evidence records exist and must be retained;
- Which datasets are synthetic, test-only, duplicate, stale, or pilot-specific;
- Which schema versions are actually applied to any source database;
- The legally approved retention and migration disposition for each data class;
- Source/target data counts, mapping, dry-run results, reconciliation, restore tests, and cutover authorization.

Until evidence resolves these questions, source data disposition remains **UNASSESSED**, and destructive actions remain **NOT AUTHORIZED**.
