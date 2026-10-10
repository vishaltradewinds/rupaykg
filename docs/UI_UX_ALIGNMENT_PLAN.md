# RupayKG UI/UX Alignment and Acceptance Plan

## Scope and deployment boundary

This work targets the canonical repository `vishaltradewinds/rupaykg`. The existing dark-green theme is retained. `rupaykg-aistudio` is a design/reference source only; it is not a second production deployment or data source. This branch is not deployed.

## Verified issues addressed in this branch

1. **Lifecycle status overstatement:** the stakeholder dashboard previously marked a lifecycle stage as "Observed" based on a global overview counter and marked unrepresented stages as "Not observed". That can be misread as per-record stage completion. The dashboard now labels this section "Lifecycle visibility"; it shows counts only for stages represented in the overview response and says "Not tracked in overview" for stages without a matching counter. These aggregate counts are not presented as completion, eligibility, certification or settlement proof.
2. **Mobile navigation hidden:** the public landing-page tabs were hidden below 800px, preventing mobile users from opening Stakeholders, How it works and Trust. The tabs now remain visible as a horizontally scrollable navigation row.
3. **Component/style drift:** the current React workspace uses `.metrics`, `.stage`, `.workspace-tabs`, `.workspace-panel`, `.records`, `.review-list` and `.auth-drawer`, while the stylesheet was largely styled for a prior component vocabulary. Styles have been added for the current component tree, responsive layout, keyboard focus visibility, empty/error/notice states, and narrow-screen workspace controls.

## UI/backend contract rules

- PostgreSQL-backed API responses and backend authorization are authoritative; UI state is a projection, not a source of truth.
- A count is an aggregate count, not evidence that any individual lot/activity has completed every upstream stage.
- Keep physical operations, measurement, evidence, local verification, Guardian execution, Hedera consensus, Mirror Node confirmation, regulatory acceptance, credential issuance, transfer/retirement, settlement and reporting semantically distinct.
- Missing, loading, stale, denied, unavailable and empty data must not render as success. A 401/403 is not an empty dataset.
- Buttons must map to a documented, permission-checked backend action. Do not add controls for actions that do not have a real API contract.
- Do not infer government authorization, CPCB issuance, CCTS eligibility, carbon credit issuance, Guardian acceptance, Hedera consensus or settlement from client-side counters.
- Organization selection and all visible workspaces must follow verified memberships; server-side permission and geography checks remain mandatory.
- Keep keyboard focus visible, labels associated with inputs, error text actionable, and navigation usable on mobile.

## Remaining UI/UX work — ordered gates

### Gate A — authentication and shell consistency
- Trace the primary native-session flow and the Firebase-to-native-session exchange used by the MRV provenance and verification panels.
- Decide and document one supported sign-in/session experience. Do not remove the Firebase exchange until dependencies and deployed configuration are verified.
- Ensure logout, active-organization switching, token expiry, 401/403 handling and panel loading/error states behave consistently across the main shell and MRV panels.

### Gate B — role-to-workspace mapping
- Validate every stakeholder role against actual backend permission keys, organization type and geography rules.
- Replace generic raw-object dumps with role-relevant summaries and task queues where supported by existing endpoints.
- Show explicit read-only / action-available states. Do not rely on presentation-only role names for authorization.

### Gate C — domain-specific task journeys
- Map each proposed action to an existing route, request schema, permission, response state and recovery path before adding UI controls.
- Prioritize material intake/collection, measurement and evidence capture; then verification/provenance; then compliance/EPR; then carbon/value, registry, settlement and reporting.
- If a required action has no backend endpoint, label it as unavailable/not implemented rather than presenting a fake working control.

### Gate D — data quality and operational feedback
- Standardize loading, empty, stale, permission-denied, dependency-unavailable and mutation-success states.
- Show record identifiers and source/state metadata where useful, but avoid exposing sensitive fields unnecessarily.
- Make retry behavior safe for non-idempotent actions and show an operation reference where the backend provides one.
- Distinguish aggregate dashboards from per-record lifecycle timelines.

### Gate E — accessibility and responsive validation
- Verify 320px mobile width, tablet and desktop layouts; long organization names; large record IDs; keyboard-only navigation; focus order; contrast; form labels; and screen-reader status announcements.
- Test the real production build and all route/API interactions against the actual backend contract before release.

## Acceptance evidence required before deployment

- Frontend build/typecheck and repository CI pass on the final candidate commit.
- Route → permission → response → rendered-state checks for each visible action.
- Mobile navigation and workspace interactions manually or automatically verified at narrow viewport widths.
- No unsupported action, synthetic production record, or misleading success state.
- MRV UI separately presents local verification, Guardian result, Hedera consensus and Mirror Node verification.
- Deployment and live external acceptance remain separate gates; this UI branch itself does not establish production readiness.
