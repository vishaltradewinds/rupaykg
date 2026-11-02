# RupayKg UI/UX Comparative Audit and AI Studio Theme Adoption Specification

**Date:** 2026-11-02  
**Reference repository:** `vishaltradewinds/rupaykg-aistudio` (`main`, inspected commit `c2380d6e0a8628588959cac43ff7a519acc0c07a`)  
**Target repository:** `vishaltradewinds/rupaykg` (PR #192 branch `shakti/auth-bootstrap-application-integration-2026-11-01`, inspected head `080fad902456c0498b7c60cec743e72662ee2957`)  
**Scope:** Static source audit of UI shell, theme, landing page, representative stakeholder content, CSS and workflow surface. No production data, identity, authorization, database or deployment changes.

## 1. Executive decision

Adopt the **RupayKg AI Studio visual design language** as the single canonical product theme for the current `rupaykg` repository. Preserve the current repository's actual API contracts, identity and organization boundaries, permission checks, regulatory workflow state, evidence provenance and fail-closed behavior. This is a presentation and information-architecture migration—not a backend or product capability port.

The reference is visually more coherent: near-black canvas, charcoal cards, white hierarchy, emerald action colour, restrained borders, Inter + Space Grotesk + JetBrains Mono typography, rounded cards, icon-led navigation, charts and contextual stakeholder experiences. The target currently uses a forest-green canvas, pale green accents, grid/radial background, a compact text-led layout, and dense custom CSS. These are visibly different systems.

**Important:** The reference repository is not a safe source of truth for production behavior or claims. Reuse its visual patterns and plain-language presentation, not its old data assumptions, demo metrics, direct DB integrations, legacy credit-minting language, Firebase/Drizzle architecture or unsupported claims.

## 2. Repository comparison

| Area | `rupaykg-aistudio` reference | Current `rupaykg` target | Decision |
|---|---|---|---|
| Visual foundation | `src/index.css`: #050505 background, #151619 cards, white text, subtle white borders/glass | `apps/web/src/styles.css`: #07100d green-black background, pale-green borders, forest-green panels and radial/grid backdrop | Replace target palette and surface styling with reference tokens |
| Typography | Inter body, Space Grotesk display, JetBrains Mono metadata | Inter only; small mono-like labels via letter spacing | Adopt all three reference families and hierarchy |
| Accent | Emerald #10b981, with restrained green highlights | Pale sage #b9dfbd / #86a991 | Use emerald #10b981 for primary actions, active states and meaningful success only |
| Theme behavior | Dark default with explicit light-mode overrides | Dark/light toggle in app state, but many styles are hard-coded | Preserve light mode only if it remains legible and tested; dark theme is canonical |
| Surfaces | `.os-card`, dark cards, rounded-2xl, subtle shadow and borders | Transparent/minimal panels, thin borders, dense rows | Convert to consistent charcoal cards and shared surface tokens |
| Landing | Dedicated public landing component with sticky nav, sections, stakeholder chooser and urban/rural context | Landing hero and tabbed sections embedded in main shell; current CSS hides `.landing-nav` and `.landing-panel` | Restore visible accessible navigation and content; use the reference landing structure |
| App navigation | Full product navigation and rich role-specific views in one React app | One compact app shell with 8 principal workspaces plus domain panels | Retain target workspaces; group them in a clearer reference-style navigation |
| Content | Strong stakeholder orientation, simple actions, role guides and public explanation | More precise compliance, evidence, authorization and operational status content; but technical and dense | Keep target truth and workflows; rewrite labels, helper text and hierarchy in reference voice |
| Responsive UX | Responsive cards, nav, modals, stakeholder landing; still requires device verification | Mobile CSS and 44px baseline, but floating controls can collide and some panels are dense | Retain mobile safeguards and test the new shell at 320–430px |
| Accessibility | Some semantic controls and labels; not certified | Some ARIA and mobile support; global focus/contrast/keyboard consistency not certified | WCAG 2.2 AA acceptance target; no conformance claim before testing |

### Inspected reference files
- `src/index.css`: canonical theme tokens and base typography.
- `src/App.tsx`: application brand identity, role-based dashboard, cards and product navigation patterns.
- `src/components/MinimalPublicLanding.tsx`: public landing, urban/rural chooser, stakeholder selector, process explanation and compliance story.
- `src/components/StakeholderGuides.tsx`: role-based guides and workflow-oriented content.
- `src/components/StakeholderDashboard.tsx`, `StakeholderOnboardingHub.tsx`, `StakeholderGuides.tsx`: representative role content and interaction patterns.
- `src/i18n.ts`: translation key approach; the reference's translation coverage itself is not proof of complete localization.

### Inspected target files
- `apps/web/index.html`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/public/minimal-stakeholder.css`
- `apps/web/src/ux-mobile.css`
- `apps/web/src/ulb-command-center.css`
- `apps/web/src/field-capture-experience.ts`, `citizen-farmer-guided-panel.ts`, `value-lifecycle-panel.tsx`, `ulb-command-center.tsx` and workspace/domain panels.

## 3. Exact canonical theme specification

Use these values as the single source of truth in target CSS custom properties. The hex values below are taken from the reference theme; derived alpha values are surface treatments, not alternative brand colours.

### Core tokens

| Token | Exact value | Use |
|---|---|---|
| `--color-bg` | `#050505` | Global page background |
| `--color-card` | `#151619` | Primary cards and panels |
| `--color-border` | `rgba(255,255,255,0.08)` | Default card/divider border |
| `--color-text` | `#ffffff` | Main text |
| `--color-text-muted` | `rgba(255,255,255,0.6)` | Secondary copy |
| `--color-glass` | `rgba(255,255,255,0.05)` | Hover/raised translucent surface |
| Primary accent | `#10b981` | Primary CTA, active icon, key status |
| Accent hover | `#34d399` | Hover/focus emphasis |
| Font body | `Inter` | Body, labels, forms |
| Font display | `Space Grotesk` | H1–H6, product/section titles |
| Font mono | `JetBrains Mono` | IDs, timestamps, evidence hashes, technical metadata |

### Visual rules
1. Dark-first, almost-black canvas. Remove the target's green-tinted radial grid as the dominant background.
2. Charcoal cards (`#151619`) with one-pixel low-contrast borders; use 12–16px radius for dense work panels and 16–24px for major cards.
3. Emerald is a functional accent, not a page wash. Do not make every icon, metric, border or label green.
4. Main headings use Space Grotesk, tight tracking, strong contrast; body copy uses Inter at readable sizes. Metadata uses JetBrains Mono, uppercase only where it conveys a real category/status.
5. Keep status colours semantically distinct: emerald = verified/success; amber = pending/review; red = blocked/rejected/error; neutral = unknown/not reported. Never colour an unverified state as successful.
6. Use restrained motion only for state transitions; honor `prefers-reduced-motion`.
7. Use clear active, hover, focus-visible, disabled, loading, empty, error and success states.
8. Preserve responsive 44px minimum touch targets and safe-area spacing; do not copy tiny 8–10px reference labels into operational forms.

## 4. Target information architecture and exact public-facing content

The target must retain its eight real workspace capabilities and organize them in a familiar, reference-style experience.

### Public landing page

**Brand lockup**
- Name: **RUPAYKG**
- Descriptor: **Circular Economy Operating System**
- Supporting line: **Sovereign digital infrastructure for waste, resource traceability and evidence-led environmental outcomes.**

**Primary navigation**
- Platform
- Stakeholders
- How it works
- Compliance
- Impact
- Actions: **Sign in** and **Get started**

**Hero (recommended exact copy)**
- Eyebrow: **INDIA'S CIRCULAR ECONOMY OPERATING SYSTEM**
- Heading: **Make every material flow traceable.**
- Supporting copy: **RupayKg connects waste generators, collectors, processors, public authorities and environmental project teams through one accountable operating record—from physical activity and measurement to evidence, verification and reporting.**
- Primary action: **Explore the platform**
- Secondary action: **Get started**
- Trust note: **Your access and actions are governed by verified organization membership and role permissions.**

Do not show fabricated live totals, carbon-credit prices, revenue, farmer counts, emissions reductions, transaction volumes or “live network” claims. Render a metric only when backed by a real authorized endpoint, show its reporting period and provenance, and distinguish zero from unavailable.

**Operating context selector**
- Prompt: **Where do you operate?**
- Options: **Urban** / **Rural**
- Urban context line: **Municipal Corporation → Ward → Facility**
- Rural context line: **Gram Panchayat → Village → Farm / FPO**
- Context changes must not silently change organization membership, permissions or data scope.

**Stakeholder selector**
- Government — **Cities, ULBs and public agencies**
  - Description: **Coordinate facilities, wards, service providers and reporting through accountable operational records.**
  - Outcomes: **Ward and facility visibility · Waste-flow oversight · Evidence-backed reporting**
- Waste & recycling — **Collectors, aggregators, transporters and processors**
  - Description: **Record collection, weighment, movement and processing with a traceable chain of custody.**
  - Outcomes: **Pickup and weighment records · Transfer tracking · Processing evidence**
- Businesses / bulk generators — **Industries, campuses, hotels and institutions**
  - Description: **Organize waste operations and compliance preparation with clear records of vendors, material flows and supporting evidence.**
  - Outcomes: **Vendor and pickup records · Compliance preparation · ESG-ready evidence**
- Farmers / FPOs — **Farmers, producer groups and rural biomass operators**
  - Description: **Record biomass activity, collection and delivery across farm and village operations.**
  - Outcomes: **Farm-level records · Biomass traceability · Evidence of delivery and processing**
- Carbon / ESG — **Project owners, assurance teams and buyers**
  - Description: **Follow the evidence trail from eligible activity through methodology, monitoring, verification and registry-related workflows.**
  - Outcomes: **MRV evidence · Methodology-linked calculations · Reporting and registry traceability**
- Regulators / public authorities — **CPCB, SPCBs and competent public authorities**
  - Description: **Review submitted information, evidence and workflow status within the authority and geography assigned to your verified role.**
  - Outcomes: **Evidence-led review · Scope-aware oversight · Auditable decisions**

Stakeholder CTA: **Continue as [stakeholder]**. It starts onboarding; it must not auto-grant a role or imply that a user is already approved.

**How it works (four steps)**
1. **Record** — Capture the physical activity, material, location, period and responsible parties.
2. **Track** — Record collection, transport, receipt and processing events.
3. **Verify** — Attach evidence and apply the relevant methodology and authorized review.
4. **Report** — Prepare compliance, MRV, registry and ESG outputs from traceable records.

**Compliance section**
- Heading: **The complexity stays behind the workflow.**
- Copy: **RupayKg organizes operational records, statutory applicability, EPR information, MRV evidence and reporting in one connected system. Each regulatory status remains tied to its source, reporting period and authorized reviewer.**
- Capability labels: **Waste traceability · CPCB / SWM workflows · EPR evidence · Digital MRV · Carbon methodology · Registry and reporting**
- Boundary note: **RupayKg supports preparation, evidence management and authorized workflows. It does not replace a competent regulator, statutory portal, independent verifier or registry authority. A locally prepared or user-reported status is not an official approval.**

**Impact section**
- Heading: **One operating record. A traceable chain of evidence.**
- Copy: **Connect the people, facilities and material flows involved in circular operations—while keeping each organization’s data and actions within its authorized scope.**
- Do not display impact numbers until live, permission-filtered, provenance-bearing data is available.

### Authenticated product shell

Use the reference's dark product shell and navigation hierarchy, but not a copy of its legacy role-specific dashboard data model.

**Global header**
- RupayKg brand mark and descriptor.
- Current organization, role and geography visibly displayed.
- Operating context (Urban / Rural) displayed as a contextual filter, not as an authorization mechanism.
- Connection/offline state and pending-sync indicator.
- Language, accessibility and account controls in a single consistent location.
- On mobile, collapse into a menu/drawer; never allow language, accessibility, offline and account controls to overlap.

**Primary navigation / workspace groups**
1. **Overview** — role-specific summary and next actions.
2. **Operations** — resource flows, facilities, collection, transport and processing.
3. **MRV & Evidence** — activities, measurement, evidence vault, provenance, verification and Guardian/Hedera status.
4. **Compliance & EPR** — statutory applicability, CPCB/SWM preparation, EPR obligations and supporting records.
5. **Carbon & Methodologies** — methodology selection, baseline, calculations, monitoring and eligibility checks.
6. **Registry** — credential state, issuance eligibility, ownership, transfer and retirement; clearly distinguish local workflow state from external registry confirmation.
7. **Settlement** — authorization, execution, reconciliation and settlement; show permissions and state clearly.
8. **ESG / BRSR** — traceable reporting outputs.
9. **Intelligence** — advisory findings, risks and recommended actions.
10. **Administration** — identity, membership, role and access governance only for authorized administrators.

The current target has the core workspace keys already: Operations, MRV & Evidence, Compliance & EPR, Carbon & Value, Registry, Settlement, ESG / BRSR and Intelligence. Keep these routes and permission gates. Add grouping and friendly labels; do not remove or rename API contracts merely to match the visual reference.

**Overview page content**
- Greeting: **Welcome to your RupayKg workspace**
- Context line: **[Organization] · [Role] · [Geography]**
- Next action cards must be derived from actual pending work and user permissions, not hard-coded demo tasks.
- KPI cards should show only real, scoped values with units, reporting periods and source status.
- Recent activity should show actor, event, time, status and evidence link where authorized.
- Empty state: **No records yet. Start by recording your first activity.**
- Unavailable state: **This information is not available right now. Your existing records have not been changed.**
- Permission state: **Your current role does not include access to this action. Contact your organization administrator if you need access.**

### Operational content language rules
- Lead with the task, not the acronym. Example: “Upload measurement evidence” with “MRV” as a secondary label.
- Explain each technical term once in a contextual help panel or glossary.
- Use “Prepare submission” rather than “File with CPCB” unless the system actually submits through an authorized official integration and has a receipt.
- Use “Reported by user” / “Source not independently verified” for user-entered regulatory statuses.
- Use “Eligible for review” rather than “Approved” until an authorized decision exists.
- Use “Potential carbon outcome” rather than “credit generated” until methodology, verification and registry conditions are met.
- Use “Registry confirmation pending” rather than “issued” until the authoritative registry confirms it.
- Do not imply RupayKg independently mints statutory credits, certifies compliance or substitutes for government portals.
- Keep IDs, hashes, transaction references and technical provenance available in expandable detail, not in the primary user-facing sentence.

## 5. Target-specific defects and migration risks

### P0 — landing navigation is hidden
Target `apps/web/public/minimal-stakeholder.css` currently contains:
- `.landing-nav{display:none!important}`
- `.landing-panel{display:none!important}`
- `.landing-orbit{display:none!important}`

The main stylesheet defines visible landing navigation and tab states. Hiding navigation and tab-controlled panels removes user access to key explanatory content. Remove the blanket hiding rules and implement visible, accessible navigation/sections. Do not hide the sections to achieve a minimal hero.

### P0 — two visual systems are competing
The target's main CSS is a custom green-black minimal system while its landing CSS is a separate presentation layer. Domain panels introduce their own styles and density. Introduce one shared theme token file and a consistent shell before broad component restyling.

### P1 — shell and context need consolidation
Target has operating-context, organization, role, language, offline and accessibility controls implemented in several places/scripts. One visible global header should own presentation of these states. Keep organization/role scope authoritative on the server; localStorage/context selection is not authorization.

### P1 — technical content is too dense for first-time stakeholders
The target's underlying workflows are more complete and precise than the reference's landing story, but user-facing copy often exposes internal terms too early. Add task-first titles, short descriptions, progressive disclosure and guided steps without removing evidence fields or mandatory source references.

### P1 — mobile controls can collide
Retain the target's mobile safeguards, 44px controls, reduced-motion support and safe-area handling. Rework floating controls into a unified mobile utility area and test keyboard, landscape and 200% zoom.

### P1 — don't transplant reference backend assumptions
The reference is a separate, older Vite/React application with its own server, DB, Firebase/Drizzle and service integrations. Do not copy its App.tsx, database, API, auth or role state into the current repository. The current repository's Neon architecture and server-side permissions remain authoritative.

## 6. Implementation sequence

1. **Freeze the design contract** — this document is the approved target specification for visual/content direction.
2. **Repair landing visibility** — remove the CSS hiding defect; ensure all sections can be reached by keyboard and touch.
3. **Add canonical theme tokens** — exact reference colours and font families, shared across public and authenticated UI.
4. **Restyle shared primitives** — header, buttons, cards, forms, tabs, alerts, status badges, tables, empty states and dialogs.
5. **Rebuild the public landing composition** — sticky navigation, hero, urban/rural chooser, stakeholder selector, four-step explanation, compliance boundary and impact story using the copy above.
6. **Unify authenticated shell** — reference-style dark shell, consistent context header, grouped navigation and role-first overview.
7. **Restyle domain panels incrementally** — Operations → MRV/Evidence → Compliance/EPR → Carbon/Methodologies → Registry → Settlement → ESG → Intelligence → Administration.
8. **Improve field UX** — guided capture, offline queue management, evidence upload/review, save/resume and clear error recovery.
9. **Localization and accessibility** — Hindi-first review plus supported languages, semantic landmarks, keyboard, visible focus, contrast, screen-reader names/status, zoom/reflow and reduced motion.
10. **Validate** — typecheck/build, browser tests for landing navigation and role navigation, 320/360/390/430px mobile, desktop, keyboard-only, reduced motion, empty/loading/error states, and permission-denied cases.

## 7. Acceptance criteria

- The current `rupaykg` app visibly uses the exact reference dark palette and typography, not a close green variation.
- Public landing navigation and every landing section are visible and keyboard reachable.
- Public copy follows the approved copy deck and contains no fabricated live metrics or unsupported certification/credit claims.
- Urban/rural context changes presentation and relevant workflow options only; it never grants or changes authority.
- Authenticated header clearly identifies current organization, role and geography.
- Existing API paths, database schema, authorization checks, regulatory workflow state and evidence provenance remain unchanged by theme work.
- Workspace visibility and actions remain permission-filtered; no action is made available solely because a navigation item is visible.
- All core operational flows remain usable at 320px–430px and desktop widths.
- CI passes on the exact commit; browser tests cover landing navigation, context switching and permission-denied UI.
- No deployment or production database change occurs as part of the UI migration.

## 8. Scope and confidence

This is a static repository-source audit, not a live browser usability study. No real user sessions, screen-reader evaluation, Lighthouse/axe run, WCAG certification, visual screenshot comparison or mobile-device test was performed. The reference is the design source, but the exact production appearance must be verified after implementation in the target application. The target branch remains a draft PR and production remains untouched.
