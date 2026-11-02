# RupayKg stakeholder dashboard and function route matrix

**Inspection basis:** static source inspection of the canonical web/API code on 2026-11-02. This is a route-to-UI mapping, not an end-to-end acceptance result. Paths below are implementation evidence; functionality is not certified until browser/API/DB tests pass for each role and negative scope.

## Existing frontend surface inventory

| Capability / stakeholder surface | Frontend implementation | Backend routes / data source observed | Current evidence and gaps |
|---|---|---|---|
| National/platform overview | `apps/web/src/main.tsx` administrative workbench and platform overview | `GET /api/v1/overview`, `GET /api/v1/admin/overview`, admin identities, roles, memberships, audit events, access-change requests | Platform view and privileged access request workflow exist. Verify all queries/actions require platform authority and audit writes are atomic. |
| Stakeholder onboarding and hierarchy | `apps/web/src/main.tsx` onboarding/review queue | `GET /api/v1/onboarding/options`, `GET /api/v1/onboarding/review-queue`, legal verification, approve/reject routes | UI supports legal review and hierarchical application review. First-platform-authority bootstrap remains P0; production has no initial identities/organizations. |
| ULB / local-body command centre | `apps/web/src/ulb-command-center.tsx`, `apps/web/src/ulb-command-center.css` | `GET /api/v1/overview`, workspaces resource-flows, MRV and compliance | Institutional overview is present. Confirm it binds to a verified ULB organization and verified ward/ULB geography; ensure all cards link to executable actions, not just aggregate counts. |
| Waste/resource operations | `apps/web/src/resource-flow-panel.ts`, field capture and device panels | `POST /api/v1/resource-flows`, activity measurements, operation sync, resource-flow workspace | Resource flow and measurements have write APIs; device/sync trust and replay tests are separate gates. Validate custody transfer and mass-balance end-to-end. |
| Evidence vault | Main workbench evidence-vault UI | `POST /api/v1/evidence-vault/upload`, list/detail/download/review routes | Upload, retrieval and review controls exist. Need prove exact role/geography access, immutable versioning, malware/content validation, retention and cross-tenant denial. |
| MRV / independent verification | `apps/web/src/mrv-provenance-panel.ts`, `apps/web/src/mrv-verification-actions.ts` | `GET /api/v1/workspaces/mrv`, `POST /api/v1/evidence/:id/verification`, `GET /api/v1/mrv/status`, provenance and Hedera verification routes | Evidence review UI distinguishes local verification from Guardian/Hedera trust gates. Current verifier migration acceptance is blocked; test identity must not be the activity actor. |
| CPCB / SWM readiness | Main workbench CPCB-SWM preparation panel | `/api/v1/cpcb-swm/workspaces` GET/POST/PATCH | Saved preparation records exist. These are internal preparation records, not proof of CPCB portal submission or acceptance. |
| EPR producer / PRO returns | `apps/web/src/epr-return-panel.ts` | EPR obligations/returns; create, submit and external-reference routes | Draft creation, evidence-backed submission and recording of external reference are implemented. External portal submission must remain separately labelled until a real integration receipt exists. |
| Statutory applicability | `apps/web/src/statutory-applicability-panel.ts` | `GET /api/v1/statutory/applicability`, regulatory source catalog | Must verify source authority, publication/effective dates, jurisdiction, applicability and last validation. Do not hard-code legal conclusions. |
| Carbon / methodology / value | Carbon command centre and value lifecycle panels | Carbon/value workspaces and methodology records | Calculation and eligibility surfaces exist. Need locked source/methodology version, applicability, parameters, equations, uncertainty, independent reconciliation and regression evidence before production eligibility. |
| Registry / market participants | `apps/web/src/registry-issuance-panel.ts`, `apps/web/src/registry-settlement-panel.ts` | Registry workspace; create/activate/transfer/retire credential routes | UI supports credential lifecycle actions. Issuance remains blocked unless evidence, independent verification, methodology, Guardian VERIFIED, HCS consensus and Mirror Node verification are all genuinely present. |
| Settlement / finance counterparties | `apps/web/src/registry-settlement-panel.ts`, `apps/web/src/settlement-reconciliation-panel.ts` | Settlement workspace and create/authorize/settle/confirm routes | UI and lifecycle endpoints exist. Bilateral party authorization, external authority confirmation and immutable reconciliation need dedicated tests; do not label internal state as money moved. |
| ESG / BRSR | `apps/web/src/esg-panel.ts` | ESG workspace and reporting data | Reporting panel exists. Validate traceability to source evidence and avoid presenting estimates as audited disclosures. |
| Intelligence / advisory | Main workbench intelligence workspace | Intelligence workspace routes | Advisory outputs must be marked advisory and linked to source/evidence; not an authority decision. |
| Field devices / offline capture | `apps/web/src/field-device-panel.tsx`, `apps/web/src/field-capture-experience.ts` | field-device and sync routes | Device enrollment, signature, replay, conflict and worker authorization must pass independently before field data is trusted. |
| Multilingual national UX | `apps/web/src/multilingual-national.ts`, responsive/mobile styles | UI localization layer | Language support exists in source. Complete real-language review, terminology consistency and field usability tests. |

## Cross-cutting integration observations

- Main workbench declares capability workspaces for Operations, MRV & Evidence, Compliance & EPR, Carbon & Value, Registry, Settlement, ESG/BRSR and Intelligence, and filters workspace visibility using membership permissions.
- The central API helper attaches the session token and active organization header. Each API route still must verify that the organization is a verified membership and that the action's geography/permission is in scope.
- Some specialist panels exchange Firebase ID tokens for RupayKg sessions independently. Consolidate or formally document these auth flows so no component uses stale organization context or inconsistent session lifecycle.
- ULB command centre loads overview plus resource-flow, MRV and compliance workspaces. It does not, by itself, prove that every ULB workflow action is available or that each dataset is ward-scoped.
- Evidence verification panel explicitly describes Guardian/Hedera as downstream gates. Preserve this separation throughout the UI and demo.
- EPR panel's status text correctly separates internal return submission from external CPCB submission. Keep this boundary.
- Registry/settlement specialist panel uses authoritative PostgreSQL workspaces and backend mutations. Do not replace unavailable data with synthetic success.
- The frontend has more implemented surface area than the last demo readiness summary implied. The remaining gap is not merely building panels: it is proving each panel's end-to-end permission, transaction, audit, external evidence, exception and negative-path behavior.

## Required next checks

1. Generate a machine-readable mapping for every visible route/action: stakeholder role, permission, API method/path, SQL tables, transaction boundary, geography owner path, audit event, external dependency, positive test and negative test.
2. Test every panel with two verified organizations and at least two disjoint geographies; cross-tenant and cross-geography reads/writes must fail.
3. Verify the active organization selector cannot retain an organization after membership revocation or session refresh.
4. Ensure every mutating control shows pending, success and failure states and reloads persisted server state.
5. Check empty/unavailable/forbidden/loading states, keyboard/focus/screen reader/contrast/zoom and 320/390px mobile layouts.
6. Create a clean demo seed only in an isolated demo database. Synthetic data must be visibly labelled in every relevant page/export.
7. Produce role-specific walkthroughs and a demo operator reset/rehearsal runbook.

## Release boundary

This matrix is source-level evidence only. It does not certify the current production database, pilot environment, statutory integrations, live Guardian/Hedera anchoring, carbon-credit issuance, or external settlement. Production remains HOLD; certification OFF; TRL 9 not established.
