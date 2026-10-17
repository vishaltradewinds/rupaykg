# RupayKG Stakeholder & Dashboard Repository Audit

**Date:** 10 October 2026
**Repository:** `vishaltradewinds/rupaykg`
**Workspace:** `C:\\Users\\Vishal\\rupaykg-live`
**Branch:** `fix/guardian-hedera-gate-20261010` (continuing the existing draft PR)

## Executive conclusion

The repository contains a real PostgreSQL-backed stakeholder identity, membership, permission, geography and approval hierarchy, plus eight dashboard workspaces. It is not yet a complete role-specific operational dashboard. The active React app mostly renders generic read-only record lists; several operational mutation APIs exist without corresponding dashboard forms. This audit fixed several concrete initialization, onboarding, reviewer-routing, presentation and count-authorization defects. Production acceptance and a live authenticated browser walkthrough remain outstanding.

## What is implemented

- Native registration/login/logout, expiring database sessions, membership retrieval, failed-login counters and temporary lockout.
- Stakeholder application creation, role options, organization legal identity fields, evidence reference/hash persistence, withdrawal, legal verification, and geography-dependent approval steps.
- Server-side permission checks and geography-scope checks on workspace reads and operational writes.
- Read workspaces: Operations/resource flows; MRV & evidence; Compliance/EPR; Carbon & value; Registry; Settlement; ESG/BRSR; Intelligence.
- Existing write APIs include resource-flow creation, measurements, field-sync envelope/apply/conflict resolution, evidence verification, EPR returns, ESG metrics, settlement lifecycle actions and Guardian/Hedera MRV submission.
- Overview counts backed by PostgreSQL; no synthetic production records are intended.

## Findings and changes in this recovery

### 1. P1 — Dashboard initialization could load counts without loading workspaces

**Finding:** `session()` called `setMe()` and then `refresh()` in the same render closure. `refresh()` relied on `visibleWorkspaces`, which was derived from the old membership state. React state updates are asynchronous, so first login could leave the workspace data unloaded. Organization switching had the same stale-membership issue.

**Change:** Pass the selected verified membership explicitly into refresh/workspace loading and MRV trust loading. Organization switching now refreshes against the selected membership and clears stale organization-specific data first.

### 2. P1 — Overview counts were not permission-gated by domain

**Finding:** `/api/v1/overview` returned operations, evidence, compliance, credential and settlement counts to any verified member of an organization, regardless of the member's domain permissions.

**Change:** Count queries now run only for organizations where the current identity has a permission for that domain. Unauthorized count fields return `null`; the dashboard displays an em dash instead of falsely showing zero.

**Remaining:** The count queries for obligations, credentials and settlements still need a dedicated geography-scope reconciliation against the corresponding workspace query semantics, especially for multi-geography and transferred-credential cases.

### 3. P1 — Organization-backed stakeholder onboarding form omitted required legal fields

**Finding:** The API requires legal name, legal form, registration identifier/authority, and a document reference/content hash for non-individual organizations, but the active form collected only organization name, role, geography and a note.

**Change:** Added conditional legal identity/evidence-reference fields and client-side completeness checks. Individual/household applications do not require organization legal fields.

**Remaining:** A document reference and hash are not the same as a secure document upload or independent document authenticity check. Validate accepted hash format, evidence storage/access controls and real legal-document review procedures before treating this as production-ready.

### 4. P1 — Hierarchical reviewer work was hidden from non-platform reviewers

**Finding:** The API's queue is designed to return approvals to eligible local/district/state/platform authorities, but the UI only loaded and rendered the queue for `platform_admin` / `super_admin`. Also, legal verification had an API endpoint but no action in the UI.

**Change:** The UI now loads the server-filtered queue for verified members, renders items returned for the current authority, shows the next approval level, and exposes separate legal-verification and approval-step actions according to server-returned eligibility. The API queue includes legal-verification-only items for authorized platform reviewers.

**Change:** The legal-verification API now refuses `VERIFIED` when there is no persisted legal evidence reference with a non-empty content hash.

**Remaining:** Legal verification remains an authorized human attestation, not an automated authenticity check. Test the entire local → district → state → platform chain against a dedicated database and representative geography hierarchy.

### 5. P2 — Dashboard styling was partly disconnected from active markup

**Finding:** Several active React class names (including dashboard header, review, workspace head, panel head and record lists) had no matching CSS selectors; existing selectors targeted older component names. The result was inconsistent hierarchy, raw record presentation and weak mobile behavior.

**Change:** Added styles for the active dashboard selectors, responsive review forms, legal onboarding fields, metrics, workspace tabs and record lists.

### 6. P2 — Operational dashboards are primarily read-only projections

**Finding:** Workspace screens render up to 20 records using the first five object fields. They have no general search/filter/pagination, no record-specific detail views, and no forms for the existing resource-flow, measurement, evidence, EPR, ESG, settlement or field-sync write APIs. This is a real workflow-completeness gap, not merely a styling issue.

**Recommendation:** Implement role- and permission-aware actions per domain, with field validation, geography selection from the authorized hierarchy, evidence capture, idempotency, explicit lifecycle status, and clear server error handling. Do not expose a write button unless its matching API and authorization are verified.

### 7. P2 — Lifecycle strip overstates observation for stages with no metric

**Finding:** Several lifecycle stages are marked `Not observed` even though the overview has no corresponding metric for those stages. That conflates “not instrumented” with “measured and absent.”

**Change:** The strip now distinguishes `NOT MEASURED`, `RESTRICTED`, `OBSERVED`, and `NOT OBSERVED` where the overview supplies an authorized metric.

## Verification

- Production TypeScript/web build: run as part of this recovery; final result recorded after completion.
- Workspace test suite: run as part of this recovery; final result recorded after completion.
- Existing test suite includes RBAC policy, runtime acceptance, CORS, settlement lifecycle, carbon provenance and domain tests.
- Database-dependent tests are skipped when `DATABASE_URL` is absent; no production database was modified.
- No production deployment or PR merge was performed by this audit.

## Acceptance gates still required

1. Authenticated browser walkthrough for citizen/individual, operator, verifier, local authority, district/state authority, platform reviewer, carbon buyer and EPR/ESG roles.
2. Negative tests for cross-organization, cross-geography and unauthorized domain access.
3. Dedicated database integration tests for stakeholder onboarding, legal evidence, each hierarchy approval level and organization switching.
4. Complete UI workflows for core operational writes and their lifecycle states.
5. Geography-scope reconciliation for overview counts and registry/settlement data.
6. Mobile viewport/accessibility checks, including long organization names, slow connections, offline field sync and API error recovery.
7. Independent Shakti production gate before deployment.

## Final verification result (10 October 2026)

- `npm run build`: PASS (domain, carbon, compliance, ESG, intelligence, API and web workspaces).
- `npm test`: PASS — 87 passed, 0 failed, 4 skipped. The four skips are database/production-lifecycle acceptance gates unavailable without the required database/provider configuration.
- `git diff --check`: PASS before commit.
