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
