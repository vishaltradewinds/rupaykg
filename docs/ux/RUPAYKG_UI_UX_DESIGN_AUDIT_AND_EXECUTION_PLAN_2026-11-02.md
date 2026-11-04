# RupayKg UI/UX Design and Usability Audit

**Audit date:** 2026-11-02  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `shakti/auth-bootstrap-application-integration-2026-11-01`  
**Scope reviewed:** `apps/web` entry point, React shell, CSS, role dashboard, stakeholder journeys, citizen/farmer panel, field capture, operating context, mobile CSS, offline queue and representative domain panels.  
**Method and limitation:** Static source audit of the current branch. This is not a live browser/device usability session, WCAG conformance certification, translation quality review, field study, or proof that every route renders correctly. Findings below distinguish directly visible implementation facts from usability risks that require runtime validation.

## 1. Executive assessment

**Decision: UI foundation exists; design system and end-to-end experience are not yet coherent enough for nationwide production onboarding.**

Useful foundations already present:
- Stakeholder/role-oriented workspace and onboarding concepts.
- Citizen/farmer guided activity capture with a language selector.
- Urban/rural operating-context model.
- Offline operation queue and field-capture drafts.
- 44px mobile minimum targets in the additive mobile stylesheet for buttons and form controls.
- 23 listed Indian language choices, with RTL metadata for Kashmiri, Sindhi and Urdu.
- Explicit provenance and regulatory-state boundaries in several operational views.

Main design weakness: the web experience is assembled from one large React shell plus separately mounted plain-JavaScript panels and scripts. Some components create their own inline styles, colors, spacing, storage behavior and event listeners. The result is a collection of useful features, not yet one consistent product experience.

## 2. Findings by priority

### P0 — Fix before nationwide user onboarding

**P0.1 — Landing-page navigation is hidden while its content is tab-controlled.**
- `main.tsx` renders Overview / Stakeholders / How it works / Trust controls inside `.landing-nav`.
- `public/minimal-stakeholder.css` applies `.landing-nav{display:none!important}` and `.landing-panel{display:none!important}`.
- The four content states are changed only by the hidden navigation controls. A first-time visitor cannot reach those explanatory sections through the visible landing UI.
- Required fix: retain visible accessible navigation or convert to a single coherent page with visible section links. Do not hide both navigation and the content it controls. Add browser tests for every landing destination.

**P0.2 — Multiple independently mounted UI systems compete for page space and state.**
- `index.html` loads the offline queue, React shell, citizen assistance, language selector, role dashboard and stakeholder journey as separate scripts.
- Operating-context selector/bridge/experience and workflow experience also mount DOM outside the main React tree.
- Context and workflow panels use a cyan/navy inline visual language while the primary shell uses forest/dark green. Some floating controls are positioned independently.
- Risk: overlap, duplicate controls, stale state, inconsistent keyboard behavior, layout shifts and hard-to-debug rendering differences.
- Required fix: establish one application shell, one navigation/context header and one design-token layer. Migrate independently mounted UI into owned components incrementally; avoid a risky big-bang rewrite.

**P0.3 — First-time journey is not sufficiently simple for low-digital-literacy users.**
- The product exposes technical domains such as MRV, EPR, registry, settlement, ESG/BRSR, Guardian and HCS alongside the broad role-based experience.
- The role dashboard adds quick links, but the primary workflow still presents a domain/workspace navigation model.
- Required fix: role-first task home with 3–5 plain-language actions, e.g. “Record material”, “Add proof”, “Track collection”, “See pending work”. Put technical detail behind progressive disclosure. Provide guided steps and a clear “what happens next” status.

### P1 — High priority

**P1.1 — Multilingual capability is uneven.**
- The language catalog contains 23 choices and the citizen/farmer panel has translations for a subset.
- The primary React shell and many domain panels use hard-coded English labels and descriptions. Language selection updates document language/direction but does not demonstrate complete localization of every workspace.
- RTL metadata is present, but no complete RTL layout verification was evidenced.
- Required fix: central translation catalog with completeness checks; prioritize Hindi, English and the languages required by the first field cohorts, then expand. Translate errors, help, status, form validation, dates/units and offline/sync states, not just headings. Run native-speaker review.

**P1.2 — Accessibility support is partial, not verified.**
- Some forms use explicit labels and some panels set ARIA labels.
- Accessibility controls include high contrast and voice input; mobile CSS sets 44px minimum heights for many controls.
- Source scan did not find a global reduced-motion treatment or a consistent global focus-visible treatment in the primary stylesheet. Several custom controls are built with direct DOM and inline styles; not all expose labels, roles, live status or keyboard semantics consistently.
- Some UI text in dashboard panels is 8–11px, which is too small for many field users and outdoor conditions.
- Required fix: adopt WCAG 2.2 AA as the target; enforce semantic landmarks, visible focus, keyboard operation, accessible names, error association, status announcements, contrast, zoom/reflow, reduced motion and larger field typography. Test with keyboard and screen reader.

**P1.3 — Mobile layout needs real device testing.**
- Mobile breakpoints and 44px target rules exist; workspace tabs use horizontal scrolling.
- The page also has several separately positioned controls: language selector, operating-context selector, accessibility controls and offline status. Their combined placement can collide on narrow screens or when browser text scaling is enabled.
- Some panel controls use custom 38–40px heights despite the additive 44px baseline.
- Required fix: test 320px–430px widths, Android Chrome, portrait/landscape, 200% text zoom, browser safe areas, long translations and keyboard-open states. Use a single responsive utility/control dock.

**P1.4 — Offline state needs an understandable recovery workflow.**
- IndexedDB queue, pending/rejected states and online replay are implemented.
- The source demonstrates status events and a small floating offline indicator, but not a complete user-facing queue management journey with understandable reasons, retry, discard/resolve, per-record status and clear confirmation.
- Required fix: dedicated “Pending sync” screen showing item, timestamp, organization context, current state, failure reason, retry and safe resolution. Explain that “queued” is not “accepted”. Never lose the local draft on rejection.

**P1.5 — Urban/rural context and organization selection need stronger orientation.**
- Urban/rural context is persisted in local storage and changes the operating model.
- Organization selection is also persisted; several scripts read it independently.
- Required fix: show active organization, role, geography and operating context together in a persistent context header. Confirm context changes when unsaved work exists. Make organization/context changes explicit and announce the resulting scope.

**P1.6 — Form density and technical terminology.**
- Onboarding for legal entities asks for multiple registration and evidence fields in one surface.
- MRV, EPR, evidence, statutory and settlement panels expose many domain-specific fields.
- Required fix: progressive multi-step forms with save/resume, plain-language descriptions, examples, “why we ask”, conditional fields and clear required/optional indicators. Keep advanced metadata in an expandable section.

### P2 — Improve after P0/P1

- Establish a shared design system: tokens for color, typography, spacing, radius, elevation, focus, state, density and responsive breakpoints.
- Replace ad-hoc inline styling and duplicated panel CSS with reusable components.
- Standardize empty/loading/error/success/blocked/pending states across all workspaces.
- Improve search, filters, sorting, pagination and saved views for high-volume authority and organization workflows.
- Add contextual help, glossary and guided demos with synthetic/demo data visibly distinguished from live records.
- Add a consistent audit/history view to explain who did what, when, why and under which authority.
- Reduce excessive small uppercase labels and decorative microcopy; prioritize task, status and next action.

## 3. Recommended national UX architecture

### Layer 1 — Universal shell
- One top-level application shell and navigation.
- Persistent context strip: organization, role, geography, urban/rural context, connectivity and language.
- One notification/status system and one accessible help entry point.
- Responsive single-column field mode; richer multi-column authority mode.

### Layer 2 — Role-first home
- Citizen / household
- Farmer / rural producer
- Collection worker / Safai Mitra
- Aggregator / transporter
- MRF / recycler / processor
- Bulk waste generator / institution / industry
- ULB / Panchayat / district / state authority
- Project developer / MRV / verifier
- EPR partner / buyer / ESG user
- Platform authority

Each role sees only its next actions, tasks, assigned records and relevant status. Existing permission enforcement remains server-side; hiding a control is never a substitute for authorization.

### Layer 3 — Guided operational journeys
1. Capture a real activity.
2. Attach evidence or measurement.
3. Submit and receive an explicit accepted / queued / rejected state.
4. Track review and verification.
5. View downstream compliance or value only when authoritative records permit it.

### Layer 4 — Specialist workspaces
Keep advanced MRV, compliance, methodology, registry, settlement, ESG and platform administration for users who need them. Use progressive disclosure, not a single dense menu for every stakeholder.

### Layer 5 — Assisted field mode
- Local-language prompts and voice assistance where supported.
- Camera-first evidence capture with explicit consent and metadata review.
- Large controls, low-bandwidth pages and resilient drafts.
- Offline queue with transparent reconciliation and conflict resolution.
- Simple, tribal-friendly visual language; icons must be paired with text and tested with users.

## 4. Execution plan

| Batch | Work | Acceptance evidence |
|---|---|---|
| 0 | Repair landing navigation/content visibility and define one navigation contract | Browser tests prove all landing destinations visible and keyboard reachable |
| 1 | UI inventory and design tokens; map all mounted panels/scripts | Component and route inventory; no duplicate shell/context controls |
| 2 | Unified shell/context strip and role-first home | Organization/role/geography/context always visible; role tasks tested |
| 3 | Citizen/farmer/field guided capture and offline queue UX | End-to-end online/offline/reconnect/rejection tests on Android |
| 4 | Localization and accessibility | Translation completeness report; WCAG 2.2 AA audit; RTL and screen-reader checks |
| 5 | Specialist workflows and authority console | Task-based usability tests with representative roles |
| 6 | National readiness | Low-bandwidth, device, language, accessibility, security and field validation evidence |

## 5. Required user validation

Do not certify “tribal-friendly”, “citizen-friendly”, “accessible” or “nationally ready” from source code alone. Conduct task-based sessions with actual citizens, farmers, Safai Mitras, tribal producer groups, panchayat/ULB operators, recyclers, verifiers and administrators. Test comprehension, completion time, error rate, abandonment, offline recovery and support burden. Include users with disabilities and low-end Android devices.

## 6. Audit conclusion and guardrails

- This is a static implementation audit; no production UI was changed in this batch.
- No live user session, visual regression, Lighthouse, axe, screen-reader or physical device test was run.
- Do not treat language options, accessibility controls, offline queue or responsive CSS as proof of complete delivery.
- Preserve the existing authoritative backend/security boundaries. UX improvements must not bypass verified membership, geography scope, evidence requirements, approval workflow or registry/settlement authority.
- UI/UX readiness is separate from platform TRL and production certification.

**Immediate next engineering change:** fix the hidden landing navigation/content relationship, add browser-level accessibility/navigation tests, and then consolidate the shell/context/navigation before adding more panels.
