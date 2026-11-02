# RupayKg UI/UX Reference Parity Audit — 2026-11-02

## Executive decision

Use `vishaltradewinds/rupaykg-aistudio` as the visual and public-entry UX reference. Keep `vishaltradewinds/rupaykg` as the sole functional source of truth. Port the reference design language and guided information architecture into the current repository; do not transplant the AI Studio application's business logic, data model, authentication, or unrelated features.

This is a design specification and source-level audit, not a claim that the parity implementation has been completed. No production deployment, database operation, or user-data change is authorized by this document.

## Repositories reviewed

- Reference: `vishaltradewinds/rupaykg-aistudio`, default branch `main`.
- Target: `vishaltradewinds/rupaykg`, current engineering work based on PR #192 integration branch.
- Reference source reviewed: `src/components/MinimalPublicLanding.tsx`, `src/App.tsx` and associated component structure.
- Target source reviewed: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/styles.css`, `apps/web/public/minimal-stakeholder.css`, mobile and domain CSS, and the earlier source-level UI audit.
- Review method: static source review. This does not certify rendered pixel parity, accessibility conformance, browser performance, or user-tested usability.

## What makes rupaykg-aistudio the reference

### Visual language

The public landing implementation in `MinimalPublicLanding.tsx` establishes these concrete design decisions:

- Page canvas: near-black / black.
- Primary accent: emerald green, used for primary actions, active stakeholder selection, section eyebrow labels and key icons.
- Text: white for primary headings and active labels; muted white/grey for explanatory text.
- Surfaces: subtle translucent white-on-black panels, low-contrast thin borders, rounded cards and restrained shadows.
- Layout: centered wide content container (maximum width approximately 7xl), generous vertical section spacing, responsive grids.
- Typography: bold, high-contrast, large section headings; compact uppercase eyebrow labels with expanded tracking; readable body copy with generous line height.
- Interaction: clear active states, restrained motion, simple choice cards, no unnecessary dashboard-like density on the public entry page.

The source uses Tailwind utility classes and emerald colour tokens such as `emerald-400` and `emerald-500`; it does not establish one single CSS hex token for every surface. Implementation should define central CSS variables and visually tune them against the rendered reference rather than guess a purported exact pixel palette.

### Public content and journey

The reference public journey is:

1. Hero / introduction to RupayKg and its purpose.
2. Choose operating context: **Urban** or **Rural**.
3. Choose stakeholder identity from context-relevant stakeholder cards.
4. Show the selected stakeholder's plain-language description and expected outcomes.
5. Continue to registration / onboarding.
6. Explain the four-step operating model: **Record → Move → Verify → Realize**.
7. Explain compliance by design: waste traceability, digital MRV, EPR evidence and carbon accounting remain available without burdening the public entry experience with jargon.
8. Explain impact: one record, one evidence trail, one accountable network.

The landing component includes stakeholder selection, context switching, outcome statements and a direct registration action. Its page sections include `stakeholders`, `how`, `compliance` and `impact`.

## Comparison with current rupaykg

| Dimension | rupaykg-aistudio reference | Current rupaykg target | Required outcome |
|---|---|---|---|
| First impression | Minimal, dark, stakeholder-first public experience | More application/workbench-oriented and technically dense | Public landing should adopt reference hierarchy; authenticated workspace remains a work area |
| Colour | Black/near-black + emerald + muted white | Earlier audit identified competing cyan/navy and forest/dark-green visual systems | One black/emerald/white design-token system |
| Surfaces | Quiet translucent panels, fine borders, rounded cards | Multiple CSS/panel systems and independently mounted UI pieces | Shared tokens and reusable components |
| Navigation | Guided section journey with clear choices | Earlier audit found landing navigation and its controlled panels hidden by `display:none!important` rules in `minimal-stakeholder.css` | Visible, keyboard-operable navigation and visible sections |
| Information architecture | Urban/Rural → stakeholder → outcomes → registration | Role-oriented entry exists but technical panels and separate context controls can fragment the journey | One coherent entry journey and a unified authenticated shell |
| Language | Plain-language outcomes before technical layers | MRV, EPR, registry and compliance terms can appear too early | Explain user task first; disclose technical detail progressively |
| Mobile | Responsive grids and compact choice cards in reference | Earlier audit identified collision risk among floating controls and small controls | Mobile-first responsive header, navigation and task cards |
| Localization | Reference provides context-specific stakeholder content | Target has partial language support, not complete shell/domain localization | Preserve RupayKg localization; translate all user-facing journeys consistently |
| Offline | Not the central public landing concern | Target has offline queue/replay capabilities | Preserve and redesign as a clear Pending Sync workflow |
| Security / governance | Not transferable from reference | Target has governed onboarding, role checks, evidence and audit workflows | Preserve all existing authorization and evidence boundaries |

## Exact target theme specification

Adopt the following as the canonical RupayKg web design direction:

### Colour and tokens

Define one shared token layer and remove conflicting page-level palettes over time.

- `--rk-bg: #050505` — primary page canvas.
- `--rk-surface: #0b0f0d` — elevated dark surface.
- `--rk-surface-soft: rgba(255,255,255,0.035)` — subtle card fill.
- `--rk-border: rgba(255,255,255,0.10)` — standard border.
- `--rk-border-soft: rgba(255,255,255,0.07)` — quiet separators.
- `--rk-text: #f5f7f5` — primary text.
- `--rk-muted: rgba(255,255,255,0.58)` — body/supporting text.
- `--rk-subtle: rgba(255,255,255,0.38)` — tertiary metadata.
- `--rk-primary: #10b981` — emerald primary action (emerald-500 family).
- `--rk-primary-strong: #34d399` — highlighted text/icon (emerald-400 family).
- `--rk-primary-contrast: #04110b` — text on solid emerald buttons.

These are implementation tokens derived from the reference's Tailwind emerald/black visual language, not a claim that every reference element uses these exact hex values. Validate in browser screenshots and adjust centrally.

### Typography and layout

- Use one consistent sans-serif family already licensed/available in the target build; avoid adding a paid font dependency.
- Use a clear type scale: large landing hero; 30–36px section headings on desktop; 22–28px on mobile; 14–16px body; 12px minimum metadata only where nonessential.
- Keep body line-height around 1.55–1.7.
- Center primary content in a max-width 7xl-equivalent container.
- Use generous section spacing, consistent 8px spacing rhythm, 12–16px card radius for controls and 20–28px for feature panels.
- Use subtle transitions; honour `prefers-reduced-motion`.
- All interactive controls must have visible focus, accessible names, clear disabled/loading/error/success states, and at least 44px touch targets.

### Component rules

- Header: RupayKg mark, concise section links, language control and one primary action. No floating duplicate navigation.
- Public landing: hero, Urban/Rural selector, stakeholder cards, selected-role outcome panel, four-step process, compliance-by-design and impact.
- Authenticated shell: same palette, typography, cards, buttons, form controls and status semantics; do not force the marketing landing page layout onto complex workbench screens.
- Workbench: one persistent header showing active organisation, role, geography and environment; one primary navigation model; content panel with consistent page heading and task actions.
- Forms: guided sections, plain-language labels, why-this-is-needed helper text, save/resume, validation and clear required/optional markers.
- Offline: dedicated Pending Sync view with per-record status, reason, retry/resolve/discard where supported; never silently discard unsynced records.
- Governance: privileged operations remain visibly distinct, explain dual-control and audit consequences, and preserve server-side enforcement.

## Exact public-facing content direction

Use the following as the canonical content hierarchy. It is draft copy for UI implementation and must not overstate legal status, carbon-credit issuance, government approval, certification, or measured environmental impact.

### Hero

**RupayKg**
**Make every waste and resource movement traceable.**

A shared digital infrastructure that helps communities, businesses and public institutions record material flows, organise evidence and verify environmental outcomes.

Primary action: **Get started**
Secondary action: **Explore how it works**

Supporting line: **From local collection to verified environmental evidence — one accountable chain.**

### Operating context

**Where do you work?**

Choose the environment that best describes your work. We will show the relevant people, activities and next steps.

- **Urban** — Cities, ULBs, wards, collection systems and material recovery.
- **Rural** — Villages, Gram Panchayats, farms, biomass and forest-produce networks.

### Stakeholder selection

**Who are you working as?**

Choose the role closest to your work. Your account access and tasks will depend on the organisation's verified onboarding and permissions.

Stakeholder categories must be sourced from the actual RupayKg role and onboarding model, not invented UI-only roles. Candidate presentation groups: public institutions and local bodies; waste generators and producer organisations; collection and processing partners; recyclers and aggregators; project developers; auditors/verifiers; community and producer groups. Only display a group if the current application supports its legitimate onboarding path.

### Four steps

**A clear chain from activity to evidence**

1. **Record** — Capture what was collected, moved, processed or measured.
2. **Move** — Track material through the responsible organisations and locations.
3. **Verify** — Review supporting evidence and apply the relevant methodology and checks.
4. **Realize** — Report verified operational and environmental outcomes. Do not imply automatic carbon-credit issuance or guaranteed revenue.

### Compliance by design

**The compliance layer works behind the task.**

RupayKg organises traceability, supporting evidence, audit history and reporting workflows. Applicable statutory rules, EPR obligations, carbon methodologies and programme requirements remain distinct and are applied according to the activity, jurisdiction and authorised role.

Capability cards:
- Material traceability
- Digital MRV and evidence
- EPR reporting support
- Carbon accounting and audit trail

### Impact

**One activity. A connected evidence trail. Clear accountability.**

Each authorised participant sees the information needed for their part of the chain, while records retain their provenance and review history.

## Current target-repository issues to fix

1. Resolve the public landing navigation visibility defect already identified: `apps/web/public/minimal-stakeholder.css` hides `.landing-nav` and `.landing-panel` with `display:none!important`. Navigation and its controlled content must be visible and keyboard operable.
2. Consolidate competing cyan/navy and forest/dark-green styling into shared black/emerald tokens. Do not blanket-replace every colour without checking status semantics (errors, warnings, success).
3. Unify the React shell and independently mounted panels incrementally. Avoid two sources of truth for active organisation, role, geography, language, navigation and accessibility preferences.
4. Keep public marketing/entry experience separate from authenticated operator workbench while sharing the design system.
5. Rework first-time dashboard into role-first tasks; technical terms become progressive-disclosure details and glossary links.
6. Redesign mobile floating controls into one accessible menu/header; test 320–430px, Android Chrome, orientation, keyboard, safe areas and 200% zoom.
7. Make localization end-to-end, not just a language selector or partial panel translation.
8. Add accessible focus, contrast, semantic landmarks, error announcements, reduced-motion handling and WCAG 2.2 AA testing.
9. Improve offline queue management without weakening evidence integrity or losing drafts.
10. Preserve all server-side tenant isolation, verified membership, role/geography checks, dual-control, evidence provenance and append-only audit semantics. A visual redesign must never grant access or bypass a workflow.

## Implementation sequence and acceptance gates

### Gate 1 — Design system and landing parity
- Create canonical tokens, typography, buttons, cards, navigation and responsive container primitives.
- Fix hidden landing navigation and visible section content.
- Implement reference-style public landing hierarchy and content.
- Add browser tests for visible nav, keyboard activation, active section, Urban/Rural selection, stakeholder selection and registration handoff.
- Capture desktop and mobile screenshots and compare with reference.

### Gate 2 — Authenticated application shell
- One header, one navigation system, one organisation/role/geography context display.
- Migrate representative dashboard and task pages to shared components.
- Ensure route-level access and data scope remain unchanged.
- Add tests for context changes, loading/error/empty states and mobile navigation.

### Gate 3 — Workflows and usability
- Simplify onboarding, waste/activity capture, evidence upload/review, MRV, compliance and admin journeys.
- Preserve field-level validation, audit events, role checks, geography scope and offline semantics.
- Conduct moderated usability checks with representative ULB, field operator, recycler, producer and verifier users.

### Gate 4 — Accessibility, localization and release
- Automated axe checks, keyboard-only checks, screen-reader review, contrast and zoom/reflow.
- Verify every visible journey in supported languages and RTL where applicable.
- Run full browser/API/CI suite, security checks and exact-role regression tests.
- Keep deployment gated separately; do not merge or deploy until release approvals and production readiness criteria are met.

## Acceptance criteria

- Public landing has the same black/emerald visual language and guided journey as the reference.
- No hidden or unreachable navigation or section content.
- All pages use one shared design token system; no accidental cyan/green competing themes.
- Public entry is understandable without knowing MRV, EPR, HCS or registry terminology.
- Authenticated workbench remains functionally complete and uses the same design language without copying the landing page structure.
- Mobile navigation and all primary actions are keyboard and touch accessible.
- Existing role, organisation, geography, tenant, audit, evidence and offline controls remain intact.
- Browser screenshot comparisons, automated tests and user validation evidence are stored in the repository.
- No claim of full parity or accessibility certification until tests are actually run and evidence is attached.

## Scope and status

- This audit is based on static source review, not full runtime testing.
- The reference's public landing component is the design authority for the public entry experience; the rest of the reference application should be sampled further before claiming whole-application visual parity.
- This document does not change production, database schema, access policy, or deployment state.
- PR #192 remains draft and must not be merged as a side effect of UI work.


## Implementation progress — 2026-11-02

### Gate 1 source changes committed to the PR #192 engineering branch

- `apps/web/src/styles.css`: canonical black / emerald / muted-white tokens and reference-aligned styling for the public landing, shared header, forms, cards and workspace surfaces; responsive rules, visible focus and reduced-motion handling.
- `apps/web/public/minimal-stakeholder.css`: removed the blanket `display:none!important` rules that hid `.landing-nav` and `.landing-panel`; retained only responsive landing refinements.
- `apps/web/src/main.tsx`: updated the hero and overview content to plain-language material traceability; changed the public process to Record → Move → Verify → Realize; changed the trust tab label to Compliance; added `aria-pressed` state to the tab controls.
- `apps/web/index.html`: near-black browser theme colour, revised page title and description.
- `scripts/validate-rupaykg-landing-ux.mjs`: static acceptance checks for required copy, visible navigation/panels, theme tokens, focus and reduced-motion rules.
- `.github/workflows/ci.yml`: runs the UX parity validator during CI after the production web build.

### Validation status

- Changes are on the existing draft PR #192 engineering branch so the established CI suite covers them.
- CI run #4542 (run ID `41417677832`) was queued when this checkpoint was written; do not report it as passed until GitHub reports a successful conclusion.
- No production deployment or database change was performed.
- Visual parity is not yet certified: inspect the CI browser screenshot and perform viewport/browser checks after the run. This batch is Gate 1 source implementation, not the complete authenticated-shell and workflow redesign.


### Additional Gate 1 work

- Added an actual **Urban / Rural** context selector to the Stakeholders tab.
- Stakeholder cards now change by operating context and are selectable, with a selected-role explanation panel and account-creation handoff.
- Added `aria-pressed` state to both context choices and stakeholder cards.
- Extended black / emerald / muted-white surface styling into authenticated workspace cards, navigation tabs, forms, governance panels, evidence and compliance surfaces.
- Expanded the static UX validator to check the context selector, selected stakeholder panel and their styling.

### CI evidence update

- CI run #4547 (run ID `41418192634`): typecheck, production build, UX parity validator, synthetic two-custodian bootstrap, browser smoke and full test suite all reported success; production container build was still running at the time of this update.
- CI run #4548 (run ID `41418306339`) includes the final shared-workspace surface CSS change; typecheck, production build, UX parity validator and synthetic bootstrap had passed, while browser smoke / remaining tests were still running.
- The first four failed runs were caused by a test assertion expecting the phrase `Record what happened` while the implemented card copy correctly says `Capture what happened`; the validator was corrected to match the rendered content. The corrected validator passed in #4547 and #4548.
- Do not treat a run as fully green until its final workflow conclusion is SUCCESS.


### Browser screenshot review and correction

- Inspected the CI-rendered desktop screenshot artifact from run #4551. It confirmed the reference theme, visible landing navigation and four-step process, but exposed an always-visible fixed account drawer overlapping the lower-right landing content.
- Corrected the UX: account access now opens only after the user selects Sign in / Create account / Continue from a stakeholder card; it has an explicit accessible close control. Initial landing render no longer mounts the drawer.
- Added validator assertions for opt-in account drawer behavior and a browser DOM smoke assertion that the initial landing does not render the account-access dialog.
- Run #4552 (source change with opt-in drawer) completed SUCCESS. Runs #4553–#4555 cover the shared styling, validator and final CI workflow evidence changes; wait for final conclusions before declaring the latest head fully green.
- Browser screenshot evidence is retained as a short-lived CI artifact for review. The inspected pre-fix screenshot is not the accepted final UI; inspect the latest artifact after #4555 completes.
