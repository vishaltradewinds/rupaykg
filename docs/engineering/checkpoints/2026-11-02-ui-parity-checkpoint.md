# RupayKg CTO checkpoint — 2026-11-02 UI parity isolation

## Canonical repository and release boundary
- Repository: `vishaltradewinds/rupaykg`
- Production branch: `main` (observed head `a3fecc0abd2c46549a201058d3963afc0e3a73c9`)
- Production remains HOLD; certification OFF; system-level TRL 9 is not established.
- No production database, credentials, Render environment, or deployment was changed in this UI batch.

## UI reference and decision
- Reference: `vishaltradewinds/rupaykg-aistudio`, public landing component and its guided stakeholder journey.
- Target: canonical RupayKg repository.
- Design direction: near-black canvas, emerald accents, white/muted text, restrained translucent surfaces, rounded cards, accessible focus and reduced-motion support.
- Content journey: Hero → Urban/Rural → stakeholder → role outcomes → registration; explain Record → Move → Verify → Realize; progressively disclose compliance and MRV detail.
- Preserve the authenticated workbench and all server-side role, tenant, geography, audit, evidence and offline controls. Do not copy reference-app business logic.

## Branch hygiene
- Original UI working branch `shakti/ui-ux-aistudio-parity-audit-2026-11-02` had 270 commits ahead of main and 2 behind because it inherited the broader auth/RLS integration stack. It was not suitable as a UI-only PR.
- Rebuilt the public UI changes on current main in `shakti/ui-ux-aistudio-parity-clean-2026-11-02`.
- PR #203 is open as draft: https://github.com/vishaltradewinds/rupaykg/pull/203
- At creation the clean PR had 8 commits, 8 changed files, and no unrelated API/database/auth/migration changes.
- The UX parity specification, UI audit, deterministic validator and CI invocation are included.

## Implementation present in PR #203
- Shared black/emerald design tokens and responsive landing styles.
- Visible stakeholder landing navigation and section panels.
- Reference-aligned hero and four-step journey content.
- Browser theme metadata aligned with the new visual system.
- Static source-level UX validator added to CI.
- No production or authenticated access policy changes.

## Validation status
- Static source-level parity assertions are encoded in `scripts/validate-rupaykg-landing-ux.mjs`.
- PR #203 is draft. Exact-head CI has not yet returned a run/status in the latest check; do not report it as passed.
- No rendered desktop/mobile screenshot comparison, axe/WCAG audit, screen-reader test, or field usability validation has been completed in this batch.
- Static source review is not a certification of pixel parity or accessibility.

## Next execution gates
1. Obtain exact-head CI for PR #203; fix any deterministic validator/build/test failures.
2. Verify visible landing navigation, all four sections, Urban/Rural switching, stakeholder selection and registration handoff in a real browser.
3. Capture desktop and Android-sized screenshots and compare against the reference.
4. Test keyboard navigation, focus, reduced motion, 320–430px layouts, 200% zoom and accessible names/contrast.
5. Audit stakeholder labels against actual supported onboarding roles; remove any UI-only role that lacks a legitimate server-side onboarding path.
6. Continue authenticated shell/workbench parity separately, without changing authorization, tenant scoping or evidence semantics.
7. Keep PR #203 draft until all applicable gates and review pass. Do not deploy or merge as a side effect of this work.

## Resume instruction
Continue from PR #203 and this checkpoint. Do not re-run initial repository discovery. Preserve the production HOLD and the canonical Neon production branch as read-only until separately approved security and release gates pass.
## Implementation and CI follow-up — 2026-11-02 10:36Z
- PR #203 current head: `5a594bf1e5ffa49a23a4527423b6076d8d1ab0db`; open/draft; mergeable at last check.
- Exact-head CI run `41429980540`: **SUCCESS**. Passed production dependency audit, migration validator, all 25 landing parity assertions, disposable PostgreSQL migrations, typecheck, full build, Chrome browser smoke, full tests including disposable PostgreSQL acceptance, and production container build.
- Browser smoke now asserts rendered brand, navigation labels and hero copy in Chrome DOM, captures desktop screenshot and 390×844 mobile screenshot. Screenshot capture is automated; it has not yet been independently visually reviewed from the artifact.
- Theme tokens now match the reference values: page `#050505`, card `#151619`, border `rgba(255,255,255,.08)`, glass `rgba(255,255,255,.05)`, emerald `#10b981`, white primary text and muted white secondary text.
- Extended reference styling across public landing and authenticated workbench surfaces, forms, metrics, tabs, panels, lifecycle cards, admin/evidence surfaces, review panels, notices and responsive layouts. Brand casing standardized to `RupayKg`.
- First CI failure was a journey-copy mismatch; corrected the copy. Second failure was over-escaped regular expressions in the exact-token validator; corrected the regex. Both root causes are now covered by the passing exact-head CI.
- Static parity assertions: 25/25 pass. No API, database, migration, auth, tenant policy, role, production configuration or deployment changes were introduced in PR #203.
- Remaining UX gates: inspect actual desktop/mobile screenshots; test tab interaction with a real user/browser session; keyboard-only and screen-reader review; contrast/zoom and 320px viewport validation; role label and registration handoff review; field usability and localization review. Do not merge or deploy until these are completed and independently reviewed.
## Rendered screenshot review and responsive corrections — 2026-11-02
- Retrieved and visually inspected the desktop, 390×844 and 320×844 Chrome screenshots from CI artifact `rupaykg-landing-ux` (run `41432785214`).
- First screenshot review identified four concrete defects: the account-access panel was always open and covered the landing; unauthenticated visitors saw internal `DATA SOURCE UNAVAILABLE` diagnostics; the language selector was fixed over the brand on mobile; and an empty offline-status button rendered as a floating dot.
- Corrected all four:
  - Account drawer is closed by default; hero CTAs open it; Escape and a close control dismiss it; email/password fields are required.
  - Health diagnostics render only for authenticated members.
  - National language selector waits for React header mount and docks inside the responsive topbar.
  - Offline status control is hidden until a real online/offline event provides a message.
- Added Chrome DOM assertions for closed drawer, hidden diagnostics, language selector inside header and hidden offline control. Added desktop, 390px and 320px screenshot capture and artifact retention.
- Final screenshot inspection: desktop and 390px layouts are clean; 320px layout has no visible overlap or horizontal clipping in the captured viewport. Language dropdown's selected label is naturally truncated within its constrained width but remains operable.
- Exact-head CI run `41432785214` for workflow head `8468c1afac6468ade38a509433ee00eab6dfb353`: **SUCCESS** — dependency audit, migrations, UX assertions, typecheck, build, desktop/390/320 browser smoke, full tests including disposable PostgreSQL acceptance and production container build.
- Still not completed: real click-through authentication/registration test, keyboard-only/focus-return test, screen-reader test, contrast/zoom audit, 320px scroll-width programmatic assertion, localization review and field usability validation. Keep PR draft.
## Interactive browser acceptance — 2026-11-02
- Added `scripts/validate-rupaykg-landing-interactions.mjs`, using Chrome DevTools Protocol with no new npm dependency.
- It verifies the initial anonymous state, language-selector header docking, hidden offline control, no health diagnostics, 320px document scroll width, Sign in CTA opens the panel, Escape closes it, Create account opens the registration name field, and the close control dismisses it.
- The exact-head workflow run `41433279946` passed the browser smoke step including these real click/keyboard interactions and the full disposable PostgreSQL test suite. Production container build was still running at the time of this note.
## Final exact-head CI completion — 2026-11-02
- Exact workflow head `b04c5d0153342f7f5784866a87dc00818e77a9e5`, run `41433279946`: **SUCCESS**.
- The run includes the real Chrome DevTools interaction acceptance: initial anonymous state, language selector docking, offline status hidden, 320px no-horizontal-overflow assertion, Sign in open, Escape close, Create account name field, and close control.
- The same run passed dependency audit, migration validation, UX static assertions, disposable PostgreSQL migrations, typecheck, build, desktop/390/320 browser smoke, full test suite and production container build.
- PR #203 current head includes documentation-only checkpoint commits after the verified workflow head; application code and CI workflow tested in `b04c5d0` are unchanged.
- Current PR comparison: 31 commits ahead of `main`, 0 behind, 11 changed files, mergeable; diff is limited to UI/UX, CI validation, scripts and documentation. No API or database files are changed.
- PR #203 remains draft because independent code review, screen-reader/keyboard/focus-return, contrast/zoom and field usability validation remain outstanding.


## Synchronous parallel execution revalidation — 2026-11-02 13:34Z
- PR #203 is OPEN / DRAFT / unmerged. Last verified code head: `3287ea78ccf833947b4c4f5992bc404393344d98`.
- Exact-head CI run `41433672603`, validate job: SUCCESS.
- PR #192 remains a separate authentication/security integration branch; no backend authorization or database changes are introduced by this UI branch.
- The UX audit remains a static source audit. CI does not prove visual parity, WCAG 2.2 AA conformance, screen-reader behavior, complete localization, offline conflict resolution, Android field usability or user acceptance.
- Next batch: browser walkthrough of all landing tabs and role handoff; collect desktop/mobile screenshots; test keyboard focus return and all interactive states; run axe/WCAG checks, 200% zoom, 320–430px and long-language layouts; verify UI labels map only to server-supported onboarding roles.
- Do not merge or deploy until these checks, backend handoff review and independent security/release gates pass.
