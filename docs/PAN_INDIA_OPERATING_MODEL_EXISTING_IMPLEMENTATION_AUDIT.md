# Pan-India Operating Model — Existing Implementation Audit

**Status:** Gate 1 baseline audit; engineering planning evidence only.  
**Audit reference:** `main` as inspected on 2026-10-26.  
**Scope:** National operating model across bulk waste generators, aggregators/collection centres, transporters, recyclers/processors, treatment/disposal facilities, and public/regulatory/audit stakeholders.  
**Shakti Standards:** No production eligibility, hardware approval, methodology approval, or statutory compliance is inferred from route/schema presence.

## AIM

Build one Pan-India RupayKg operating platform with a shared, hardware-neutral core and configurable organization/facility/activity/methodology profiles. Do not fork the product per state, facility, or pilot. A site-specific project may supply evidence, but must not define national defaults.

## Gate 1 — Existing capabilities confirmed from source

| Concern | Existing source evidence | Initial assessment |
|---|---|---|
| Authoritative store and runtime readiness | `apps/src/server.ts`: PostgreSQL source of truth; `/health` reports READY only when database query succeeds | Good fail-closed baseline; live database health must be checked separately |
| Organization/identity membership | `apps/src/auth.ts` and `organization_memberships` use verified memberships and explicit permissions | Reuse; test every new path for cross-tenant and active-organization isolation |
| Geographic jurisdiction | `organization_has_geography_scope`, `geography`, `apps/src/onboarding-hierarchy-routes.ts`, `apps/src/workspace-routes.ts` | Existing scope mechanism; validate state/district/local hierarchy and root/descendant semantics against national operating needs |
| Stakeholder onboarding | `stakeholder_applications`, legal evidence and staged approvals; `apps/src/onboarding-hierarchy-routes.ts` | Existing staged onboarding; must connect verified legal organization, operational facility, roles and jurisdiction without treating application approval as facility/permit approval |
| Waste/resource custody | `apps/src/workspace-routes.ts`, `resource_flows`, sync operation `RESOURCE_FLOW_CREATE` | Existing flow foundation; needs explicit custody events, reconciliation, weights/units, handover evidence and exception workflows reviewed end-to-end |
| Bulk Waste Generator / EPR | `apps/src/bwg-routes.ts` and `apps/src/epr-return-routes.ts` | Existing EPR routes; role profiles and facility coverage need systematic gap review |
| SWM / stakeholder reporting | `apps/src/cpcb-swm-routes.ts` | Has stakeholder categories including BWG, facility, ULB, Panchayat, transporter and processor; checklist is local preparation, not proof of official filing/approval |
| Offline sync | `apps/src/sync-routes.ts`, `apps/src/sync-validation.ts`, `field_sync_envelopes`, `field_sync_cursors` | Durable envelope/idempotency/cursor framework exists; test ordering, retries, conflicts, replay and server/client clock skew |
| Instrument/MRV trust | Main contains MRV routes and field-device controls; exact-model instrument approval changes are in draft PR #51, not yet merged to main | Do not describe instrument approval as merged or production-enabled until PR review and merge gates pass |
| Evidence vault and provenance | Evidence, verification, Guardian/Hedera and Mirror Node paths exist in the current product lineage | Each integration has a distinct acceptance gate; software records do not imply statutory approval or registry eligibility |

## High-priority gaps and risks

1. **Facility is not interchangeable with organization or geography.** The national model needs an explicit facility record/profile linked to its operating organization, physical/geographic boundary, facility type, operational status, jurisdiction, and applicable process. Do not infer a facility from an organization name or a geography node.
2. **Stakeholder role and facility role are different.** One organization may operate multiple facilities and one facility may have multiple contracted parties (generator, transporter, aggregator, processor, verifier). Permissions must be scoped to organization and, where required, facility/activity/geography.
3. **Methodology applicability must be versioned and site-specific.** A measurement parameter or waste category alone does not establish eligibility under a carbon methodology. Keep methodology, version, applicability decision, monitoring plan, parameter/unit constraints, evidence and reviewer decision linked.
4. **Custody needs explicit events.** Resource flow alone must not imply a completed handover, verified quantity, accepted material, recycling outcome or avoided emissions. Capture source/destination, parties, event times, declared and accepted quantities, unit, weighing/evidence references, discrepancy and adjudication.
5. **Hardware onboarding must be hardware-neutral.** Support manual entry, structured file import and existing-system/device integration before optional new hardware. A gateway, sensor, weighbridge, analyser and meter are separate assets with separate intended uses and evidence.
6. **Offline idempotency is not sufficient by itself.** Enforce envelope uniqueness, monotonic device sequence handling, duplicate payload detection, conflict resolution, transactional application and tenant/facility authorization on every replay/retry.
7. **National operations are a product requirement.** Provide configurable language, low-bandwidth/mobile workflows, assisted onboarding, accessible error recovery, audit export, support/escalation and cost monitoring. Do not make AI/network availability a prerequisite for authoritative recordkeeping.
8. **Regulatory statuses must remain distinct.** “Prepared”, “submitted by user”, “under review”, “approved by authority”, “instrument verified”, “methodology applicable”, “Guardian verified”, “Hedera consensus confirmed” and “Mirror Node verified” are separate states.

## Gate 2 — Additive implementation sequence

### Workstream A: Facility registry/profile (first code slice)
- Add an additive migration for a facility entity with stable UUID, owning organization, facility code, name, facility type, operational status, geography/jurisdiction reference, address/location evidence reference, and metadata/version fields.
- Add organization-scoped facility membership/role or a clearly defined facility-scope grant; avoid relying on client-supplied organization IDs alone.
- Add create/read/update/review APIs with strict allowlists, validation, append-only status history, optimistic concurrency/versioning and cross-tenant denial.
- Do not add unverified permit/approval booleans that users can set directly. Store evidence references and review decisions with reviewer identity/time.

### Workstream B: Link existing operations
- Add nullable facility reference to activities/resource flows and relevant operational entities using an additive migration.
- Backfill only when the relationship is unambiguous from authoritative existing data; leave ambiguous legacy rows unassigned and report them for review.
- Validate that facility organization, activity organization and geographic scope are consistent in both HTTP and offline-sync paths.
- Preserve existing APIs during transition; new facility scope must not silently widen access.

### Workstream C: Ingestion and custody
- Define versioned ingestion envelopes and stable idempotency keys for manual, file and device integrations.
- Normalize units without overwriting raw reported values; preserve source payload hash, event time, server receipt time, instrument identity, calibration/approval evidence and quality flags.
- Add custody handover/reconciliation events with duplicate, quantity mismatch, rejected-load and correction/supersession cases.
- Keep all unapproved instruments and synthetic fixtures ineligible for authoritative MRV.

### Workstream D: Profile and methodology controls
- Facility profiles declare process types and candidate monitoring parameters; a separately authorized reviewer links a versioned method only after source and applicability review.
- Require explicit unit, measurement-point, uncertainty/accuracy, calibration and evidence requirements per parameter.
- No national default may assert that a methodology or MeitY approval applies to every facility or device.

## Required automated tests before the first facility code slice is eligible

- Cross-organization and cross-facility read/write denied by API and database constraints where applicable.
- User-supplied organization/facility mismatch rejected.
- Facility cannot be attached to an activity from another organization or unauthorized geography.
- Duplicate facility code within its intended uniqueness scope rejected.
- Concurrent update/version conflict is visible and non-destructive.
- Unauthorized role cannot approve its own evidence or change a reviewed status.
- Offline duplicate envelope/replay produces one authoritative effect.
- Out-of-order device sequence and conflicting payload do not silently overwrite an accepted event.
- Unknown/unapproved/expired instrument remains ineligible for MRV.
- Synthetic fixture remains isolated from live MRV, registry and settlement.
- Migrations apply to a fresh disposable PostgreSQL database and pass rollback/forward-compatibility review; do not destructively modify production data.

## Explicit non-goals / release boundaries

- This audit does not certify legal compliance, CPCB/EPR filing, MeitY product approval, instrument calibration, methodology applicability, carbon-credit issuance or financial settlement.
- No hardware purchase, paid service activation, production migration or deployment is authorized by this document.
- Do not merge or deploy the new facility model until migration, API authorization, tenant isolation, tests, independent review and operational acceptance gates pass.
- The Jabalpur SITE-JBP-01 evidence context remains one configurable site record; it is not the national schema's default and does not establish methodology eligibility.

## Immediate next action

Implement **Workstream A only** in a separate reviewable PR after verifying the actual current migration naming/ledger and existing organization/geography constraints. Keep Workstreams B–D as follow-on slices so every schema change is small, additive, testable and rollback-reviewed.
