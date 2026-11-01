# RupayKg tenant-isolation discovery checkpoint — 2026-11-01

**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `shakti/tenant-isolation-inventory-2026-11-01`  
**Related PR:** [#180 — Map tenant ownership and application route boundaries](https://github.com/vishaltradewinds/rupaykg/pull/180)  
**State:** Draft / documentation-only / review required

## Work completed

1. Re-read the existing tenant-isolation architecture decision and resumed from the 2026-10-31 engineering checkpoint.
2. Inspected the current `main` source for authentication, organization selection, workspace queries, evidence vault, field sync, value-chain and BWG/EPR workflows.
3. Inspected the relevant migration sources for identity/geography/field devices, stakeholder onboarding and approvals, organization legal verification, BWG workspaces/status history, and evidence artifact storage.
4. Created `docs/security/TENANT_OWNERSHIP_ROUTE_INVENTORY_2026-11-01.md`, a first-pass classification of direct tenant records, parent-inherited records, bilateral/platform-control records, identity-private/global reference data, and sync/queue records.
5. Opened draft PR #180 for review. No application code or database schema changed.

## Material findings

- Application authentication already resolves verified identities and memberships; the organization selection header is accepted only when it matches a verified membership.
- Application-level checks are not database-enforced RLS. The previously inspected production snapshot had no RLS policies.
- Many operational records are scoped directly by `organization_id`; other records inherit ownership through activities, evidence, reporting periods, or field devices and need composite consistency controls.
- Settlements and registry transfers are genuinely cross-organization workflows and cannot be forced into a simplistic one-tenant policy.
- Field sync currently binds envelopes to identity/device, while the device has organization ownership. The relational chain needs explicit tenant integrity and adversarial tests.
- The candidate government inbox/event queue remains without tenant ownership in the inspected staging snapshot; worker remains OFF.
- The first-pass source inventory is not yet exhaustive and must be reconciled with the live Neon catalog and every SQL read/write path.

## Safety and release posture

- No production or staging database DDL/DML was performed.
- No roles, grants, RLS policies, credentials, secrets, Render settings or deployments were changed.
- No production mutation is authorized by this checkpoint.
- Worker OFF; scheduler OFF; production HOLD.
- TRL 9 is not established.

## Next execution gates

1. Expand route/query inventory to every application route and background process, capturing exact SQL and authorization path.
2. Reconcile repository schema/migrations with live production and staging catalog; identify legacy/unused tables and untracked schema.
3. Resolve ownership and relationship constraints for settlements, credentials/registry events, sync envelopes, audit events, onboarding review and government inbox.
4. Produce canonical ERD, threat model, data classification, and principal/privilege matrix.
5. Implement only on a disposable database branch, then prove two-tenant positive/negative isolation and application regression.
6. Independent security review before any explicit production release proposal.

**Decision:** continue tenant-isolation design and evidence gathering. Do not enable RLS globally or activate any worker.


## Expanded route scan — 2026-11-01

- Performed a static query/table-reference scan across all route modules in `apps/src` plus `server.ts`.
- Added additional families to the ownership backlog: MRV observations/provenance events, field-sync cursors, settlement events, EPR returns/obligations/credits, statutory profiles/applicability, audit events and platform-admin governance.
- Flagged registry and settlement unscoped-ID lookup/locking paths for statement-level authorization and information-disclosure review.
- Flagged platform onboarding review queue as a dedicated control-plane query, not an ordinary tenant route.
- Updated the inventory with coverage limitations: lexical SQL scanning does not resolve dynamic SQL or database function behavior and is not a complete authorization proof.
- Latest inventory document commit: `fe5d42492dce4ae4a04cb831c4f1bac61f0bf109`.
- No code, database schema, role, grant, secret, Render configuration or deployment changed.


## Second security-review batch — confirmed relational integrity gaps

Created `docs/security/TENANT_ISOLATION_INTEGRITY_FINDINGS_2026-11-01.md` (commit `2ed00d81925d1b03e7c7e6db2af73d06696bc782`).

Source-level findings:
1. Evidence artifact series can have an organization that does not match its activity; versions/reviews have independent FKs that do not bind exact series/evidence pairs.
2. CPCB status history can attribute a workspace history row to a different organization than the workspace parent.
3. Stakeholder approval geography is not constrained to the application's geography.
4. Field-device identity and organization are separate FKs; route checks and trigger do not yet provide immutable relational membership/tenant binding.
5. Legacy operation-sync envelopes bind actor to device but have no explicit immutable organization FK and interpret target entity from payload/application path.
6. Activity assignments do not constrain assigned identity/role to the activity's organization.

Additional boundary review:
- Registry events and credentials are multi-party provenance; issuer, project organization, current owner and recipient must remain distinct.
- Settlement routes require payer and payee membership but apply the high-risk permission check to payer; payee consent/approval semantics need business/legal policy confirmation.
- Onboarding review queue and platform audit are explicit control-plane access paths and must not become blanket tenant bypasses.

**Implementation remains documentation-only.** No application code, schema, database, role, grant, RLS, secret, Render configuration or deployment changed. The new findings are source-confirmed, not a claim of a live production exploit. RLS remains blocked pending integrity remediation and disposable two-tenant tests.


## Read-only production preflight — 2026-11-01

- Inspected the production Neon catalog for the relevant evidence, CPCB history, onboarding, field-device, sync, assignment, registry and settlement tables.
- Confirmed the relevant production FK definitions are independent single-column constraints; the composite ownership constraints described in the findings are absent.
- Ran eight read-only anti-join checks for existing mismatched organization/activity/evidence/history/geography/device/assignment relationships. All eight returned **0 mismatches** in the inspected production snapshot.
- Interpretation: the checked data is currently consistent for these predicates, but database write integrity is not enforced by composite constraints. Zero current mismatches is not proof against future invalid writes.
- Updated `docs/security/TENANT_ISOLATION_INTEGRITY_FINDINGS_2026-11-01.md` with production catalog and data preflight evidence. Latest findings doc commit: `b497f57106acf4c769fdba3c93fe9be342d4747b`.
- All production operations were SELECT-only. No DDL, DML, role/grant, RLS, secret, Render or deployment changes.
