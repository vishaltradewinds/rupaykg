# ESG / BWG Reporting Integrity Audit — 2026-10-29

## Scope and evidence inspected

Repository: `vishaltradewinds/rupaykg`
Working branch: `shakti/epr-geography-authorization`
Related controls: PR #118, master audit issue #112.

Inspected:
- `apps/src/value-routes.ts` on the working branch
- `apps/web/src/esg-panel.ts` on the working branch
- `packages/esg/src/index.ts`
- `migrations/036_bwg_epr_esg_reporting.sql`
- `migrations/070_epr_obligations_returns.sql`
- `migrations/071_epr_return_obligation_binding.sql`

## Findings

### ESG metric evidence state is not independent assurance

The ESG metric API verifies:
- reporting period exists;
- active organization authorization and ESG write permission;
- evidence belongs to the reporting organization and an authorized geography;
- evidence status is VERIFIED when evidence is supplied;
- verification, when supplied, is APPROVED and linked to the same evidence.

The package `classifyMetric()` labels a metric VERIFIED when both evidenceId and verificationId exist. This is an evidence/verification state, not proof of independent ESG assurance. The current ESG UI correctly labels the user-selected assurance state as “Declared assurance state (unverified)” and displays it as “declared assurance (unverified)”; the API stores the value inside caller-provided metadata. Consumers must not treat `metadata.assuranceStatus` as an assurance opinion or regulator acceptance.

**Required control:** preserve the explicit distinction between evidence verification, metric assessment, independent assurance and external filing/acceptance in all API contracts, exports, dashboards and downstream calculations. Do not infer independent assurance from `esg_metrics.status = VERIFIED` or caller-provided metadata.

### ESG reporting-period boundary is not demonstrated as geography-bound

The metric route checks the supplied evidence against the reporting organization's geography scope, but the inspected reporting-period lookup selects only `organization_id`. The inspected schema and route do not demonstrate a versioned, immutable reporting-boundary/geography binding on the period itself. Consequently, the API evidence-scope check alone does not prove the completeness or consistency of the reporting boundary for all disclosures in a period.

**Required control:** define and approve reporting-boundary semantics (including organizational boundary, geography/jurisdiction where applicable, framework, period, and version/effective dates) before claiming completeness. Existing periods must not be retroactively assigned inferred boundaries without an auditable migration/reconciliation.

### BWG EPR report quantities are not shown as reconciled to authoritative EPR returns

Migration `036_bwg_epr_esg_reporting.sql` defines `bwg_epr_reports.category_code` as free text and stores obligated/fulfilled quantities, evidence and verification references. The inspected schema does not demonstrate a transactional binding from these report quantities to the authoritative EPR obligation/return/credit-allocation ledger. A record with evidence references is not, by itself, proof that the quantities are eligible, correctly categorized, period-bound, allocated once, or accepted by an authority.

Migrations `070` and `071` provide obligation/return relationships and balance checks, but these do not independently prove that reported quantities derive from an approved source measurement and a scheme/category/unit/methodology mapping.

**Required control:** do not promote `bwg_epr_reports.fulfilled_quantity` to verified/statutory fulfillment until source evidence, approved scheme/category/unit mapping, reporting period, obligation, immutable allocations and correction/reversal lifecycle are reconciled transactionally. Keep submission and external acceptance distinct.

### Waste reporting quantities also need evidence and workflow gates

The BWG waste report schema includes non-negative quantity checks and internal arithmetic checks, which are useful structural controls. They do not alone establish calibrated measurement provenance, custody continuity, processor receipt, reconciliation of generated/segregated/channelized/processed mass, or regulatory acceptance. Treat these as reported data until the required source and verification gates pass.

## Acceptance gates

1. **Legal/regulatory:** verify current applicable national/state/local requirements and reporting templates against authoritative sources; do not hard-code unverified applicability or mappings.
2. **Data lineage:** trace each report line to source observation, evidence hash, custody events, measurement method/instrument, uncertainty/quality status, approved mapping version, organization, geography, and reporting period.
3. **Accounting integrity:** enforce immutable, idempotent allocations, double-count prevention, correction/reversal handling and concurrent-submit safety.
4. **Assurance integrity:** evidence verification, assessment, independent assurance and external filing/acceptance must be separate states with authorized actors and provenance.
5. **Testing:** add adversarial route and database tests for cross-organization/geography access, missing evidence, mismatched scheme/category/unit/period, duplicate allocation, concurrency, rejected/corrected returns, and attempts to forge assurance metadata.
6. **Operations:** monitor failed/rejected workflows, reconciliation drift, audit logs, backups, access changes and external submission outcomes.
7. **TRL / Shakti Standards:** retain engineering-only status until system-level acceptance evidence, independent review and operational/regulatory gates are satisfied.

## Decision

- This is an evidence-based repository audit checkpoint, not a legal opinion or certification.
- PR #118 remains draft/unmerged.
- Production certification remains **HOLD**.
- Indian statutory requirements remain primary; ICVCM Core Carbon Principles are a complementary integrity benchmark only.
- No live database mutation, deployment, official submission, or invented regulatory mapping is authorized by this audit.
