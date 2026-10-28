---
created: 2026-10-26T18:04:21-05:00
updated: 2026-10-26T18:19:52-05:00
phase: quick-261026-ooe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/e2e/focus.ts
  - web/e2e/focus-not-obscured.spec.ts
  - web/e2e/focus-scrollbars.spec.ts
  - web/playwright.config.ts
  - web/src/modules/admin/components/admin.recipe.ts
  - web/src/modules/public/pages/PublicLayoutCheckPage.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/routes.test.tsx
  - web/scripts/budget.ts
  - web/scripts/budget.test.ts
  - web/src/layouts/PublicLayout.tsx
  - web/src/layouts/PublicLayout.test.tsx
  - web/e2e/fixtures.ts
  - web/e2e/fixture-selftest.spec.ts
  - web/e2e/profile.spec.ts
  - web/e2e/audit-log.spec.ts
  - web/e2e/users.spec.ts
  - docs/web/e2e.md
autonomous: true
requirements: [D-70, D-71, D-72, A11Y-01, QUAL-04]

estimate:
  tokens: 260000
  raw_tokens: 260000
  tasks: 7
  confidence: low

must_haves:
  truths:
    - "On pixel and iphone, on /admin/profile?tab=security, New password then Tab, Tab puts focus on Confirm new password, and once scrolling settles its whole box is below the top bar, above the tab bar and inside the visual viewport (WCAG 2.2 AA 2.4.11, D-70)"
    - "A control placed 30px under the phone tab bar is scrolled fully clear when Tab reaches it, on pixel, iphone, and in a 775px window with classic scrollbars (chromium-classic-scrollbars), where the tab bar shows because the page's width is under 768px (D-72)"
    - "At every tested width in every project, the bottom spacing is on exactly when the tab bar is drawn: html scroll-padding-bottom on phone viewports, or a scroll-margin-bottom on the controls in main when the viewport is 768px or wider but the page is in its phone layout; never both, never without the bar (D-72)"
    - "A control placed 30px under the sticky admin top bar is scrolled fully clear when Shift+Tab reaches it at desktop (1280px), tablet (820px) and phone widths in chromium, firefox, webkit, pixel and iphone; a Tab pass down and a Shift+Tab pass back through every Security control on the phones keep each control clear of both bars (D-72)"
    - "A control placed 30px under the sticky public site header is scrolled fully clear when Shift+Tab reaches it, on the dev-only /dev/public page (the real PublicLayout), at 1280, 820 and 390px in the desktop engines and on pixel and iphone (D-72)"
    - "expectNoAxeViolations re-checks a target-size node reported as partially obscured when at least one covering control sits in a fixed or sticky bar: it scrolls the node to the middle of the padded viewport, runs target-size for it alone, restores every scroll position, and fails only if it is still covered; every other violation and the output format are unchanged (D-71)"
    - "The three scroll workarounds before axe calls (profile.spec.ts, audit-log.spec.ts, users.spec.ts) are gone and those specs pass in all five projects; the @profile tabs test passes 60 of 60 on pixel (D-72)"
    - "npm --prefix web run verify passes with zero warnings and the e2e suite passes in all seven projects (or the local scope and what is left to CI are stated)"
  artifacts:
    - path: web/e2e/focus-not-obscured.spec.ts
      provides: "@focus-not-obscured tests for the tab bar, the admin top bar, the public header and the real-page axe re-check"
    - path: web/e2e/focus-scrollbars.spec.ts
      provides: "@focus-not-obscured tests that run only in the two scrollbar projects: spacing follows the tab bar from 760 to 800px, and the classic-scrollbar 775px case"
    - path: web/src/modules/admin/components/admin.recipe.ts
      provides: "adminClasses: root scroll-padding-top at every width and scroll-padding-bottom on phone viewports; adminBodyClasses: scroll-margin-bottom for main's controls in the classic-scrollbar gap"
    - path: web/src/layouts/PublicLayout.tsx
      provides: "root scroll-padding-top for the sticky site header while the public layout is mounted"
    - path: web/src/modules/public/pages/PublicLayoutCheckPage.tsx
      provides: "dev-only page of labelled fields inside the real PublicLayout at /dev/public (never in production, D-20)"
    - path: web/e2e/fixtures.ts
      provides: "expectNoAxeViolations with the D-71 re-check"
    - path: docs/web/e2e.md
      provides: "the new tag rows, the scrollbar projects' new spec, the dev route and the re-check rule"
  key_links:
    - from: web/src/layouts/AdminLayout.tsx
      to: web/src/modules/admin/components/admin.recipe.ts
      via: "AdminFrame renders adminClasses (frame) and adminBodyClasses (main#main), so :root:has(<frame class>) pads html and the main rule reaches every control"
    - from: web/src/modules/admin/routes.tsx
      to: web/src/modules/public/pages/PublicLayoutCheckPage.tsx
      via: "devRoutes /dev/public lazily mounts PublicLayout with the check page; production drops devRoutes (__DEV_ROUTES__ false) and budget.ts lists the page as dev-only"
    - from: web/playwright.config.ts
      to: web/e2e/focus-scrollbars.spec.ts
      via: "scrollbarSpecs lists the new spec, so only the two scrollbar projects run it and every other project ignores it"
    - from: web/e2e/fixtures.ts
      to: "@axe-core/playwright AxeBuilder"
      via: "the re-check builds its run from pageAxe(page), then withRules(['target-size']) and include(<the node's selector>)"
---

# Quick 261026-ooe: focused controls stay clear of the sticky bars (D-70, D-71, D-72)

<objective>
Fix WCAG 2.2 AA 2.4.11 (Focus Not Obscured) for every sticky bar, test first, as the owner ruled in D-70, D-71 and D-72 (2026-10-26):
- the admin phone tab bar (the cited bug: Confirm new password on My Profile Security is fully behind it after Tab), including desktop windows 768 to about 782px wide with classic scrollbars, where the page is in its phone layout and the tab bar shows;
- the sticky admin top bar at phone, tablet and desktop widths;
- the sticky public site header at every width (the real PublicLayout, tested on a dev-only route because no shipped route mounts it until Phase 11).
Then make the e2e axe helper re-check a target that only a fixed or sticky bar covers (D-71), and remove the three scroll workarounds that existed only for that.

Purpose: keyboard and switch users always see the control they are on, and the e2e axe check stops failing on layouts that depend on a random email's line wrap.
Output: two e2e specs, root scroll padding and a gap scroll margin in the admin recipe, root scroll padding in PublicLayout, a dev-only public check route, the axe helper re-check with self-tests, three cleaned specs and an updated e2e guide. Its own PR on branch fix/phone-focus-not-obscured (the executor does not push).
</objective>

<owner_rules>
These come from the owner's global and project rules. The executor does not see them elsewhere, so follow every one.

- TDD: write the failing test first and see it fail, then fix. Zero warnings in build, lint, types, tests and the browser console. Evidence before "done": run the checks and quote the result and exit code. If a test fails, re-run it alone before calling it flaky, and record the flake. Never loosen a guard or an assertion to make a test pass.
- No new packages, no version bumps, no lockfile change. If anything seems to need one, stop and report.
- No script-based fix: the app gains no focus or scroll JavaScript. The fix is CSS utilities only (D-70, D-72). Do not add a token to base.css. Leave web/e2e/sweep.ts unchanged.
- Shared machine: TheBETSLLC runs on this machine. Never touch its folders, ports 5173, 5023 or 5099, any `BetsLLC_*` database or its processes, and never kill a process you did not start. Before every e2e run, full test run and `verify`, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`; if a port is held by another project or TheBETSLLC test processes are listed, wait and re-check. Port 5180 held by this project's own dev server is expected. The e2e runner (`npm --prefix web run e2e`) uses CSPS_E2E on (localdb)\MSSQLLocalDB and port 5199, takes its own lock, seeds and builds; never start the host any other way.
- Environment variables only inside the one process that needs them, never at User or Machine level.
- Never run a command that reads stdin (no `python -`, bare `cat > file`, `read`, prompts). Add `< /dev/null` to long runs. Use the Write or Edit tool for files. Leave no background shell running when you finish.
- OR-2: comments minimal and concise, saying what the code does; no plan numbers or history narration. OR-4: no em dash or en dash anywhere in web/src (code, copy, comments). Plain English everywhere. Touch targets stay at least 44 px.
- D-33 stylesheet contract: web/src/ui/base.css and app.css may not gain an `html` rule or any @media other than reduced motion (`src/ui/stylesheet-contract.node.test.ts`). Visual decisions are utilities in markup. Do not edit the contract test.
- D-20: dev-only code never reaches the production build; the budget gate (`web/scripts/budget.ts`) enforces it.
- Commits: stage files by path (never `git add -A` or `git add .`), never stage `.planning/` files (the orchestrator commits planning docs) or `artifacts/`. Before each commit run `artifacts/tools/gitleaks/8.30.1/gitleaks.exe git --pre-commit --staged --redact --config .gitleaks.toml --no-banner` and read the staged diff for real server or database names, emails other than `@csps.test`, connection strings and local paths such as `C:/Users/<name>`. Subjects are `type(quick-261026-ooe): summary`, plain English, and every message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Every markdown file created or edited carries created and updated timestamps (ISO 8601 with offset). Take the real time from `date "+%Y-%m-%dT%H:%M:%S%z"` and write the offset as `-05:00`. On an edit change only the updated value.
- Format only the files you changed: `npm --prefix web exec -- prettier --write <paths relative to web>`.
</owner_rules>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md

Owner rulings (STATE.md):
- D-70 (2026-10-26): on phone layouts a focused field can sit fully behind the bottom tab bar (Confirm new password on My Profile Security), a WCAG 2.2 AA 2.4.11 failure. Fix in its own PR (this quick task): scroll padding for the bars, and the e2e axe helper re-checks a target axe reports as partially obscured after scrolling it into view. The intermittent @profile axe failure (about 7 in 205 runs) came from the random test email wrapping to 2 lines instead of 3.
- D-71 (2026-10-26): the helper re-checks a target-size "partially obscured" target when at least one covering control sits in a fixed or sticky bar (axe always lists the field's own Show password button too); it scrolls the target into view, re-runs target-size on it alone and restores the scroll; a target still covered fails.
- D-72 (2026-10-26): the same fix also covers the sticky admin top bar at tablet and desktop widths, the sticky public header on phones (and wherever else it is sticky), desktop windows 768 to about 782px wide with classic scrollbars that show the tab bar (the spacing must follow whatever condition actually shows the bar, and be tested), and removes the three now-redundant e2e scroll workarounds (profile.spec.ts, audit-log.spec.ts, users.spec.ts), proving those specs still pass.

Facts the planner confirmed in the code (do not re-derive):

- The document scrolls, not a container: the page root (`pageRootClasses`, web/src/components/layout/layout.recipe.ts) is `@container/pg relative min-h-full ...` with no overflow. Sticky and fixed elements in web/src, all checked:
  - admin Topbar (`topbarClasses`, web/src/components/navigation/navigation.recipe.ts; a `div` right before `main#main`): sticky top-0 in the admin main column at every width, `h-(--topbar-height)` 64px;
  - admin tab bar (`tabBarClasses`, admin.recipe.ts; `nav[aria-label="Admin"]` not inside `aside`): sticky bottom-0, drawn only under the `pg-phone` container variant (page root 767px wide or less). Border 1px + `pt-[6px]` + items + `pb-[calc(12px+env(safe-area-inset-bottom))]`: 71px on a page with a current tab (My Profile), 69px otherwise. Its top is 768 on pixel (839 tall) and 588 on iphone (659 tall); the orchestrator's 775/595 was a tab link's top;
  - public site header (`siteHeaderClasses`; the `<header>` in web/src/components/navigation/SiteHeader.tsx): sticky top-0 at every width; inner row `h-(--header-height)` 64px, `pg-phone:h-14` 56px, plus a 1px bottom border. PublicLayout (web/src/layouts/PublicLayout.tsx) renders it, but no route mounts PublicLayout today (web/src/core/routes/router.tsx: "PublicLayout returns with Phase 11"); every public path shows the HoldingPage, which has no header;
  - not bars, no change: the sidebar (sticky beside the content, never over it); table header cells (`data.recipe.ts`, sticky inside a horizontally scrolling wrapper that never scrolls vertically); the drawer and modal overlays (fixed, they cover the page on purpose and trap focus); the toast region (fixed, transient, dismissible). List these in the SUMMARY with the reason.
- D-33 contract: base.css allows only `:root`, `[data-theme=...]`, `body`, `:focus-visible`, `main[tabindex="-1"]:focus`, @font-face and the reduced-motion @media; app.css only at-rules. So root padding must be a utility that targets the root. The planner compiled every token below with `buildCss` from web/scripts/class-gate.mjs:
  - `[:root:has(&)]:scroll-pt-[calc(var(--topbar-height)+var(--space-6))]` gives `:root:has(.<token>) { scroll-padding-top: ... }`;
  - `vp-lt-md:[:root:has(&)]:scroll-pb-[calc(71px+var(--space-6)+env(safe-area-inset-bottom))]` gives the same inside `@media (max-width: 767px)` (`vp-lt-md` is the existing custom variant in app.css);
  - `md:pg-phone:[&_:not([aria-modal=true]_*)]:scroll-mb-[calc(71px+var(--space-6)+env(safe-area-inset-bottom))]` gives `@media (width >= 768px) { @container pg (max-width: 767px) { .<token> :not([aria-modal=true] *) { scroll-margin-bottom: ... } } }`;
  - `[:root:has(&)]:scroll-pt-[calc(var(--header-height)+1px+var(--space-6))]` (89px; one value at every width, because the header's own phone height is also a container rule the root cannot see).
- Why two mechanisms for the tab bar: the bar is drawn by a container query on the page root, which html cannot see, and media queries measure the viewport including a classic scrollbar. On phones (and any overlay-scrollbar window) viewport and page widths match, so html padding under `vp-lt-md` is exact. In the 768 to about 782px classic-scrollbar gap only a rule inside the page root can see the container condition, so main's controls get `scroll-margin-bottom` there; the `md:` gate keeps the two from ever applying together, and `:not([aria-modal=true] *)` keeps dialog contents (Modal renders `role="dialog" aria-modal="true"` inside its own fixed, scrolling backdrop over the bar) out of it.
- Planner probes (standalone pages in Playwright 1.63, no app, no ports; 64px top bar, 71px bottom bar):
  - With no spacing, a control placed 30px under either bar and reached with Tab or Shift+Tab is not scrolled in any engine (chromium, firefox, webkit, pixel, iphone, classic-scrollbar chromium at 775px): a deterministic red.
  - html `scroll-padding-top: 88px`: chromium and firefox centre the control; webkit (desktop and iphone) stops 14px short of the padding, leaving 10px below a 64px bar. The same 14px shortfall holds for `scroll-padding-bottom` in webkit. So every value is bar height + 24px (`--space-6`), which also leaves room for the 2px focus outline at its 2px offset.
  - `scroll-margin-bottom` under a container query: chromium (pixel and classic-scrollbar 775px, where the page is 760px wide and the bar shows) and firefox honour it; webkit ignores it when the control is already inside the viewport. So in the classic-scrollbar gap, chromium, Edge and firefox (Windows, where classic scrollbars are the default) are covered; Safari with always-visible scrollbars in a 768 to 782px window is not, and no Playwright project can draw webkit classic scrollbars. Record this in the SUMMARY as the one residual; the orchestrator has it.
  - Webkit scrolls a Tab-focused control smoothly (done within about 300 ms); tests must wait for scrolling to settle before measuring.
- Projects (web/playwright.config.ts): chromium, firefox, webkit (desktop 1280x720), pixel (Pixel 7, 412x839), iphone (iPhone 15, 393x659), plus chromium-classic-scrollbars and chromium-overlay-scrollbars, which run only the specs in `scrollbarSpecs` (every other project ignores them). Headless chromium hides scrollbars elsewhere.
- Profile Security tab (web/src/modules/admin/pages/ProfilePage.tsx): Change Password card (Current password, New password with its meter, Confirm new password, each followed by its "Show password" button, then the submit button "Update Password"), then the Signed-in Devices card (link "View Signed-in Devices"). Tab panels are not focusable; the hidden username input has the `hidden` attribute.
- `createStaff(request, role, state?, identity?)` (web/e2e/testing-api.ts) accepts `identity.email` (unique, ending `@csps.test`, at most 256 characters). The header line is "{email} · Member since {date}"; a longer email wraps to more lines.
- axe 4.13 `target-size`: `any: [target-size, target-offset]`; a failing node has the `node.any` check id `target-size` with `data.messageKey === 'partiallyObscured'` and `relatedNodes` = every focusable widget that partly overlaps it. A fully covered target passes (`obscured`). `AxeBuilder.withRules` replaces the tag filter `withTags` set (last call wins); `include()` takes one selector per call (an array is an iframe path).
- Dev routes: `devRoutes` in web/src/modules/admin/routes.tsx is added by router.tsx only when `__DEV_ROUTES__` is true (development, e2e, budget and parity builds; production gets a literal false). routes.test.tsx builds that tree with `devTree()` and already proves `/dev/components` renders in it and falls through to the holding page in production. web/scripts/budget.ts: modules under `src/dev/` may load only from the showcase page's chunk, so a new dev page goes in `src/modules/public/pages/` and its prefix joins `DEV_ONLY_MODULE_PREFIXES` (like `src/modules/admin/pages/AdminPreviewPage`). Coverage excludes only `src/dev/**`, so the new page is covered through routes.test.tsx.
- The workarounds to remove: web/e2e/profile.spec.ts lines 200 to 201 (comment and `second.evaluate('window.scrollTo(0, 0)')` before an axe call); web/e2e/audit-log.spec.ts `centerFirstEntry` (lines 24 to 27) and its six calls (lines 128, 145, 304, 310, 320, 326); web/e2e/users.spec.ts lines 113 to 114 (comment and `scrollIntoView` before an axe call). Their tags: `@profile`, `@audit`, `@users`.
- Phone-only skips follow web/e2e/dialog-fit.spec.ts (`DEVICE_PROJECTS`, `test.skip(...)` with a reason). Page scripts are strings (the e2e TS program has no DOM types). Sign-in follows profile.spec.ts: `guard.expectStatus('/api/v1/auth/refresh', 401)` then `signInAs(page, request, await createStaff(...))`. Fixture self-tests (fixture-selftest.spec.ts) run on chromium, firefox and webkit on `/` under the strict CSP: build injected elements with CSSOM (`element.style.<property> = ...`), never a style attribute or a `<style>` element.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Controls stay clear of the phone tab bar, end to end (red focus tests, then html scroll-padding-bottom on phone viewports)</name>
  <files>web/e2e/focus.ts, web/e2e/focus-not-obscured.spec.ts, web/src/modules/admin/components/admin.recipe.ts</files>
  <read_first>web/e2e/profile.spec.ts (whole file), web/e2e/dialog-fit.spec.ts (lines 40 to 50), web/e2e/shell.spec.ts (lines 1 to 45), web/e2e/testing-api.ts (lines 60 to 90), web/src/modules/admin/components/admin.recipe.ts, web/src/layouts/AdminLayout.tsx (lines 95 to 130), web/src/ui/app.css (the @custom-variant lines)</read_first>
  <precondition>The preflight command in the owner rules reports no other project on ports 5180, 5115, 7028 and 5199 and no TheBETSLLC test processes.</precondition>
  <behavior>
    - Shared helpers in a new module web/e2e/focus.ts (not a spec, so both focus specs import it; page-script strings): settle-and-measure (wait until `scrollY` and the active element's box top are unchanged for 6 samples 50 ms apart, at most 3 s, then return whether it is inside `main#main`, its id, a label, its box, the top bar's bottom, the tab bar's top and drawn height, `visualViewport.offsetTop` and height, `innerHeight`, `innerWidth`, `document.documentElement.clientWidth` and `scrollY`); place (scroll so a control's bottom is 30px under the tab bar's top, or its top 30px under a top bar's bottom, returning where it landed); spacing (computed html `scroll-padding-top` and `scroll-padding-bottom` and a given control's `scroll-margin-bottom`). An `expectClear` assertion: the box lies between max(top bar bottom, visual viewport top) and min(tab bar top if drawn, visual viewport bottom), with the whole measurement as JSON in the message.
    - T1 "@focus-not-obscured Tab from New password lands on Confirm new password clear of the tab bar" (pixel, iphone; the other projects skip with "Needs the phone tab bar (pixel and iphone)"): Security tab, scroll to top, focus New password, Tab, Tab; Confirm new password is focused and clear.
    - T2 "@focus-not-obscured a control 30px under the tab bar is scrolled clear when Tab reaches it" (pixel, iphone): place "Update Password" 30px under the tab bar (assert the placement within 1px), focus the Confirm field's Show password button with `focus({ preventScroll: true })`, Tab; "Update Password" is focused and clear.
    - T3 "@focus-not-obscured the bottom spacing is on exactly where the tab bar shows" (all five projects; chromium, firefox and webkit at 375, 767, 768, 1024 and 1280px wide, 600px tall; the phones at their own size): on the Security tab, when the tab bar is drawn exactly one of html scroll-padding-bottom and the Confirm field's scroll-margin-bottom is set and it is at least the bar's drawn height + 18px; when it is not drawn both are 0. Asserts at least one width with the bar and one without in the desktop engines.
    - On the current code T1, T2 and the phone rows of T3 fail; after the fix all pass.
  </behavior>
  <action>Implements D-70 (the bug, the failing test) for the tab bar on phones. Red first.

Create web/e2e/focus.ts (a two-line header comment; the helpers from the behavior list, exported) and web/e2e/focus-not-obscured.spec.ts with a short header comment (WCAG 2.2 AA 2.4.11 for the sticky bars, D-70 and D-72; which tests run where). The spec imports `test` and `expect` from './fixtures.ts', `signInAs` from './auth.ts', `createStaff` from './testing-api.ts' and the helpers from './focus.ts'. Write T1 to T3 as in the behavior list. Each test signs in its own Manager the way profile.spec.ts does and waits for the Change Password heading. Find the Confirm field with `page.getByLabel('Confirm new password', { exact: true })` and its Show password button inside the same field (read the markup once to pick a stable locator). A control taller than the clear band fails with its label, never a silent skip. 90 s timeout per test; T3 may need 120 s.

Run red: preflight, then `npm --prefix web run e2e -- --grep @focus-not-obscured < /dev/null` (all five projects run the spec; T1 and T2 skip outside the phones). T1, T2 and T3's phone rows must fail for the coverage or spacing reason, not a timeout or a selector error; T3's desktop rows pass. Quote the failures and the tab bar box they print. Commit the spec and focus.ts: `test(quick-261026-ooe): controls the phone tab bar covers must be scrolled clear (RED)`.

Green: append `vp-lt-md:[:root:has(&)]:scroll-pb-[calc(71px+var(--space-6)+env(safe-area-inset-bottom))]` to `adminClasses` in admin.recipe.ts (use the bar height the red run printed on My Profile if it is not 71). Extend the `adminClasses` doc comment by one or two short lines: on phone viewports the page (html) gets bottom scroll padding so a focused or scrolled-to control stops 24px above the tab bar (WCAG 2.4.11); it is a utility because the D-33 contract keeps html out of the stylesheets. Do not touch `tabBarClasses`.

Run green with the same command: all pass. Then `npm --prefix web run test -- --run src/ui/stylesheet-contract.node.test.ts scripts/tailwind-classes.test.ts`, `node web/scripts/class-gate.mjs < /dev/null`, `npm --prefix web run lint` and `npm --prefix web run typecheck`, all with zero warnings (if better-tailwindcss asks for a canonical spelling of a token, use it and re-run the class gate). If a control is still covered in an engine with the right bar height, do not add script, change the test or raise the margin past 32px: record the numbers and stop with a report to the orchestrator. Commit: `fix(quick-261026-ooe): keep focused controls clear of the phone tab bar (D-70)`.</action>
  <verify>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- --grep @focus-not-obscured</automated>
    <automated>npm --prefix web run test -- --run src/ui/stylesheet-contract.node.test.ts scripts/tailwind-classes.test.ts && node web/scripts/class-gate.mjs && npm --prefix web run lint && npm --prefix web run typecheck</automated>
  </verify>
  <done>T1, T2 and T3's phone rows failed before the change (quoted with the bar box) and pass after; T3's desktop rows pass both times; contract, class gate, lint and typecheck pass with zero warnings; two commits exist (RED spec, then fix).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The bottom spacing follows the tab bar in desktop windows with classic scrollbars (768 to about 782px)</name>
  <files>web/e2e/focus-scrollbars.spec.ts, web/playwright.config.ts, web/src/modules/admin/components/admin.recipe.ts</files>
  <read_first>web/playwright.config.ts (the scrollbarSpecs const and the two scrollbar projects), web/e2e/dialog-scrollbars.spec.ts (lines 1 to 40, how it tells the two projects apart), web/e2e/focus.ts and web/e2e/focus-not-obscured.spec.ts (from Task 1)</read_first>
  <behavior>
    - The spec runs only in chromium-classic-scrollbars and chromium-overlay-scrollbars (it is added to `scrollbarSpecs`, which every other project ignores).
    - S1 "@focus-not-obscured the bottom spacing follows the tab bar from 760 to 800px with real scrollbars" (both projects): signed-in Manager on the Security tab at 760, 768, 775, 782, 790 and 800px wide, 600px tall; at each width the T3 rule holds (bar drawn: exactly one of html scroll-padding-bottom and the Confirm field's scroll-margin-bottom is set, at least bar height + 18px; not drawn: both 0). Classic: the scrollbar width (`innerWidth - clientWidth`) is above 0 and the bar is drawn at 768 or wider at least once. Overlay: the scrollbar width is 0 and the bar is never drawn at 768 or wider.
    - S2 "@focus-not-obscured with classic scrollbars a control 30px under the tab bar is scrolled clear at a 775px window" (classic only; overlay skips with a reason): 775 x 600, the tab bar is drawn, T2's placement and Tab, "Update Password" focused and clear.
    - On the code after Task 1, S1 fails in classic (bar drawn at 768 to about 782, no spacing) and S2 fails; overlay S1 passes. After the fix all pass.
  </behavior>
  <action>Implements D-72 item 2 (the classic-scrollbar gap: the spacing follows the condition that draws the bar). Red first.

Create web/e2e/focus-scrollbars.spec.ts with S1 and S2 and a two-line header comment, reusing the helpers from './focus.ts' (a spec never imports another spec). In web/playwright.config.ts add `'**/focus-scrollbars.spec.ts'` to `scrollbarSpecs` and extend its comment by one clause (the two scrollbar projects also prove the tab bar's bottom spacing with real scrollbars).

Run red: preflight, then `npm --prefix web run e2e -- --grep @focus-not-obscured --project chromium-classic-scrollbars --project chromium-overlay-scrollbars < /dev/null`. Classic S1 and S2 must fail for the spacing or coverage reason; quote them with the printed scrollbar width and page width. Commit the spec and the config: `test(quick-261026-ooe): the tab bar spacing must follow the bar with classic scrollbars (RED)`.

Green: append `md:pg-phone:[&_:not([aria-modal=true]_*)]:scroll-mb-[calc(71px+var(--space-6)+env(safe-area-inset-bottom))]` to `adminBodyClasses` in admin.recipe.ts (same bar height as Task 1), with one short doc line: when a classic scrollbar keeps a 768px or wider window in the phone layout, html cannot see that, so the controls in main carry the bottom spacing; dialog contents are left out. Run green with the same command, then the Task 1 command again (`--grep @focus-not-obscured`, the five projects) to prove phones still get exactly one mechanism. Lint and typecheck with zero warnings. Commit: `fix(quick-261026-ooe): keep the tab bar spacing when classic scrollbars keep the phone layout (D-72)`.</action>
  <verify>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- --grep @focus-not-obscured --project chromium-classic-scrollbars --project chromium-overlay-scrollbars</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- --grep @focus-not-obscured --project chromium --project firefox --project webkit --project pixel --project iphone</automated>
  </verify>
  <done>Classic S1 and S2 failed before the change and pass after; overlay S1 passes both times; Task 1's tests still pass in the five projects; lint and typecheck pass with zero warnings; two commits exist (RED, then fix).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Controls stay clear of the sticky admin top bar at every width</name>
  <files>web/e2e/focus-not-obscured.spec.ts, web/src/modules/admin/components/admin.recipe.ts</files>
  <read_first>web/e2e/focus-not-obscured.spec.ts and the shared helper module if Task 2 made one, web/src/modules/admin/components/admin.recipe.ts</read_first>
  <behavior>
    - T4 "@focus-not-obscured a control 30px under the admin top bar is scrolled clear when Shift+Tab reaches it" (all five projects; chromium, firefox and webkit at 1280 x 480 and 820 x 480; the phones at their own size): Security tab, place Current password 30px under the top bar (assert the placement within 1px; if a size cannot scroll that far, use a shorter height down to 360 and say so in a comment), focus its Show password button with `focus({ preventScroll: true })`, Shift+Tab; Current password is focused and clear.
    - T5 "@focus-not-obscured every Security control stays clear of both bars, tabbing down and back up" (pixel, iphone): from the focused Security tab, Tab until focus leaves main#main (cap 40), checking each focused control in main; then scroll to the end of the page, focus the last control checked, and Shift+Tab until the Security tab has focus, checking each again. At least 6 controls going down, Confirm new password among them, and the scroll position changes at least once in each pass.
    - T3 gains one assertion: on every admin row html scroll-padding-top is at least the top bar's height + 18px.
    - On the code after Task 2, T4 fails in all five projects, T3's new assertion fails, and T5's upward pass fails at least on iphone; after the fix all pass.
  </behavior>
  <action>Implements D-72 item 1 (the admin top bar at tablet and desktop widths, and on phones). Red first: add T4, T5 and the T3 assertion. Run `npm --prefix web run e2e -- --grep @focus-not-obscured --project chromium --project firefox --project webkit --project pixel --project iphone < /dev/null` after the preflight; quote the failures. Commit: `test(quick-261026-ooe): controls the admin top bar covers must be scrolled clear (RED)`.

Green: append `[:root:has(&)]:scroll-pt-[calc(var(--topbar-height)+var(--space-6))]` to `adminClasses` (no breakpoint: the top bar is sticky at every width) and fold it into the doc comment line from Task 1 (the page gets top scroll padding at every width and bottom scroll padding on phone viewports). Run the same command green, then the scrollbar command from Task 2 again. Lint and typecheck with zero warnings. Commit: `fix(quick-261026-ooe): keep focused controls clear of the admin top bar at every width (D-72)`.</action>
  <verify>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- --grep @focus-not-obscured</automated>
  </verify>
  <done>T4, the T3 top assertion and T5's upward pass failed before the change and all @focus-not-obscured tests pass after in all seven projects (the full grep runs both specs); lint and typecheck pass; two commits exist (RED, then fix).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: A dev-only page shows the real public layout, so its header can be tested</name>
  <files>web/src/modules/public/pages/PublicLayoutCheckPage.tsx, web/src/modules/admin/routes.tsx, web/src/modules/admin/routes.test.tsx, web/scripts/budget.ts, web/scripts/budget.test.ts (only if it lists dev-only modules case by case)</files>
  <read_first>web/src/modules/admin/routes.tsx (header, lines 1 to 60, and devRoutes from line 181), web/src/modules/admin/routes.test.tsx (lines 440 to 505, devTree and the dev-route tests), web/src/modules/admin/pages/AdminPreviewPage.tsx (the dev-only page pattern), web/src/layouts/PublicLayout.tsx, web/scripts/budget.ts (lines 100 to 135), web/scripts/budget.test.ts (the tests around lines 140 and 430 that name AdminPreviewPage), the shared form components used by profile forms (Field and its text input in web/src/components/forms)</read_first>
  <behavior>
    - With the dev routes, /dev/public renders the real PublicLayout (the site header banner, one main) around the check page: an h1 "Public layout check" and at least 16 labelled text fields ("Field 1" to "Field 16") built from the shared form components, tall enough to scroll twice the height of an 820 x 480 window; no session request is made.
    - The production routes have no /dev/public: it falls through to the holding page (h1 /New website/).
    - The budget gate treats `src/modules/public/pages/PublicLayoutCheckPage` as dev-only (a production build that holds it fails).
    - The page has no axe violations and no long dash (OR-4).
  </behavior>
  <action>Implements D-72 item 1's test surface for the public header: no shipped route mounts PublicLayout until Phase 11, so the real layout is mounted on a dev-only route (D-20; it never reaches production). Red first: add the two routes.test.tsx tests from the behavior list (dev tree renders /dev/public with the banner, the h1 and Field 1; production falls through), and, if budget.test.ts has a per-module dev-only case list, a row for the new page. Run `npm --prefix web run test -- --run src/modules/admin/routes.test.tsx scripts/budget.test.ts`; the dev-route test must fail. Commit: `test(quick-261026-ooe): a dev-only page must show the public layout (RED)`.

Green: create PublicLayoutCheckPage.tsx with a one-line SPEC-GAP style header comment (dev builds only, D-20: the public layout around a column of fields, for the e2e focus checks) and the content from the behavior list, setting `document.title` like AdminPreviewPage. In routes.tsx add to `devRoutes` a `dev/public` route whose lazy layout is `PublicLayout` (named export from '@/layouts/PublicLayout') with the check page as its index child, both through `lazyRoute` with the file's `@__PURE__` pattern; extend the devRoutes header comment by one clause. Add the page's prefix to `DEV_ONLY_MODULE_PREFIXES` in budget.ts (this only tightens the gate). Run the two test files green, then `npm --prefix web run build < /dev/null` and `npm --prefix web run build:budget < /dev/null` (both builds run the budget gate and fail on any violation; the production build must not hold the page), lint and typecheck, all with zero warnings. Commit: `feat(quick-261026-ooe): add a dev-only public layout check page at /dev/public (D-72)`.</action>
  <verify>
    <automated>npm --prefix web run test -- --run src/modules/admin/routes.test.tsx scripts/budget.test.ts && npm --prefix web run build && npm --prefix web run build:budget && npm --prefix web run lint && npm --prefix web run typecheck</automated>
  </verify>
  <done>The dev-route test failed first and passes now; the production fall-through test passes; the budget build passes with the page listed as dev-only; lint and typecheck pass with zero warnings; two commits exist (RED, then feat).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Controls stay clear of the sticky public site header at every width</name>
  <files>web/e2e/focus-not-obscured.spec.ts, web/src/layouts/PublicLayout.tsx, web/src/layouts/PublicLayout.test.tsx</files>
  <read_first>web/src/layouts/PublicLayout.tsx, web/src/layouts/PublicLayout.test.tsx (around line 106, the main class check), web/e2e/focus-not-obscured.spec.ts</read_first>
  <behavior>
    - T6 "@focus-not-obscured a control 30px under the public header is scrolled clear when Shift+Tab reaches it" (all five projects; chromium, firefox and webkit at 1280 x 480, 820 x 480 and 390 x 480; the phones at their own size): no sign-in; /dev/public; place "Field 6" 30px under the header's bottom (assert within 1px), focus "Field 7" with `focus({ preventScroll: true })`, Shift+Tab; "Field 6" is focused, its top is at or below the header's bottom and its bottom inside the visual viewport. Also asserts html scroll-padding-top is at least the header's drawn height + 18px.
    - PublicLayout.test.tsx: main carries the header scroll-padding token.
    - On the code after Task 4 both fail; after the fix both pass.
  </behavior>
  <action>Implements D-72 item 1 (the public header, wherever it is sticky: every width). Red first: add T6 and the PublicLayout.test.tsx `toContain` line. Run the unit test and `npm --prefix web run e2e -- --grep "@focus-not-obscured a control 30px under the public header" < /dev/null` after the preflight; quote the failures. Commit: `test(quick-261026-ooe): controls the public header covers must be scrolled clear (RED)`.

Green: add `[:root:has(&)]:scroll-pt-[calc(var(--header-height)+1px+var(--space-6))]` to the main element's className in PublicLayout.tsx, and one clause to the header comment (while the public layout is shown, the page gets top scroll padding for the sticky header, one value at every width). Run both green, then the full `--grep @focus-not-obscured` command over all projects, lint and typecheck with zero warnings. Commit: `fix(quick-261026-ooe): keep focused controls clear of the public site header (D-72)`.</action>
  <verify>
    <automated>npm --prefix web run test -- --run src/layouts/PublicLayout.test.tsx</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- --grep @focus-not-obscured</automated>
  </verify>
  <done>T6 and the unit check failed before the change and pass after; every @focus-not-obscured test passes in all seven projects; lint and typecheck pass; two commits exist (RED, then fix).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: The axe check re-checks a target only a sticky or fixed bar covers (D-71)</name>
  <files>web/e2e/fixtures.ts, web/e2e/fixture-selftest.spec.ts, web/e2e/focus-not-obscured.spec.ts</files>
  <read_first>web/e2e/fixtures.ts (lines 1 to 16 and 226 to 262), web/e2e/fixture-selftest.spec.ts (whole file), web/e2e/focus-not-obscured.spec.ts, web/node_modules/@axe-core/playwright/dist/index.d.ts (the AxeBuilder class), the `NodeResult` and `CheckResult` types in web/node_modules/axe-core/axe.d.ts</read_first>
  <behavior>
    - Self-test 1 "@fixture a target only a fixed bar partly covers passes the axe check once scrolled clear, and the scroll position is kept" (chromium, firefox, webkit): on `/`, inject a tall spacer, a fixed full-width 64px bottom bar holding one full-size link, and a 296 x 44 button `#e2e-fixture-covered` with 9px showing above the bar. A direct `pageAxe(page).analyze()` reports `target-size` for it; `expectNoAxeViolations(page)` resolves; `window.scrollY` is unchanged.
    - Self-test 2 "@fixture a target still covered after it is scrolled clear fails the axe check": the same plus an in-content link stacked over the button's lower 35px; `expectNoAxeViolations(page)` rejects with `target-size: #e2e-fixture-covered` in the existing `axe found N violation(s):` format.
    - T7 "@focus-not-obscured the axe check passes Confirm new password while the tab bar covers all but a strip of it" (pixel, iphone): a Manager with a long unique `@csps.test` email (about 150 characters from `randomUUID()`, letters and digits before the domain, so the field starts low enough to place; assert that), scroll so the Confirm field's top is 9px above the tab bar's top; a direct `pageAxe(page).analyze()` reports `target-size` naming that input; `expectNoAxeViolations(page)` resolves.
    - Before the helper change self-test 1 and T7 fail; self-test 2 passes before and after (it pins strictness). The other @fixture tests still pass.
  </behavior>
  <action>Implements D-71, D-70 part 2b and part 3. Red first.

Add self-tests 1 and 2 to fixture-selftest.spec.ts as page-script strings next to the existing INSERT_ constants (extend its header comment by one clause; import `pageAxe`). Put the button with `position: absolute` on `document.body` at document top `scrollY + innerHeight - 64 - 9`; the bar gets a solid background and a higher z-index than the button; in self-test 2 the overlay link's z-index sits between them. Plain visible text for the button and links. Add T7 to focus-not-obscured.spec.ts under the phone skip. Run red: preflight, then `npm --prefix web run e2e -- --grep "@fixture|@focus-not-obscured the axe check" < /dev/null`. Self-test 1 and T7 must fail on `target-size`; quote it. Commit: `test(quick-261026-ooe): the axe check must re-check a target only a bar covers (RED)`.

Green, in fixtures.ts, keep `pageAxe` unchanged and change `expectNoAxeViolations` only after its first `analyze()`:
- For each node of a `target-size` violation, take its `node.any` check with id `target-size`. Re-check it only when `data.messageKey` is exactly `partiallyObscured`, its `target` is one plain selector string, and at least one `relatedNodes` entry (one plain selector each) is an element that is, or sits inside, an element whose computed `position` is `fixed` or `sticky` (one page script returns that boolean). Every other node keeps its violation.
- Re-check: a page script records `window.scrollX/scrollY` and the offsets of every scrolled ancestor of the node (by depth) and calls `scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })` on it (the middle of the padded scrollport). Run `pageAxe(page).withRules(['target-size']).include(selector).analyze()`. In a `finally`, a second page script restores every recorded offset. The node is cleared only if `target-size` is in that run's `passes` and not in its `violations`; if it is in neither (not evaluated) the violation stays.
- Drop cleared nodes and any violation left with none; build the lines and message exactly as today.
- `import type` the axe result types from 'axe-core' (already installed); page scripts stay strings. Update the file header line about expectNoAxeViolations and its doc comment with one or two sentences stating the D-71 rule.

Run green with the same command, then the whole `--grep "@fixture|@focus-not-obscured"`. Then prove the flake is gone: preflight, `npm --prefix web run e2e -- --grep "@profile the tabs follow the URL" --project pixel --repeat-each 60 < /dev/null`; quote the "60 passed" line. If any run fails, re-run it alone, read its trace and fix the cause; never lower the count. Lint and typecheck with zero warnings. Commit: `fix(quick-261026-ooe): re-check a bar-covered axe target after scrolling it clear (D-71)`.</action>
  <verify>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- --grep "@fixture|@focus-not-obscured"</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- --grep "@profile the tabs follow the URL" --project pixel --repeat-each 60</automated>
  </verify>
  <done>Self-test 1 and T7 failed before the helper change and pass after; self-test 2 rejects with `target-size: #e2e-fixture-covered` before and after; every @fixture and @focus-not-obscured test passes; the @profile tabs test passed 60 of 60 on pixel (quoted); lint and typecheck pass; two commits exist (RED, then fix).</done>
</task>

<task type="auto">
  <name>Task 7: Remove the three scroll workarounds, document the checks, run the full gates</name>
  <files>web/e2e/profile.spec.ts, web/e2e/audit-log.spec.ts, web/e2e/users.spec.ts, docs/web/e2e.md</files>
  <read_first>web/e2e/profile.spec.ts (lines 190 to 205), web/e2e/audit-log.spec.ts (lines 18 to 30 and the six call sites listed in the context), web/e2e/users.spec.ts (lines 108 to 118), docs/web/e2e.md (lines 1 to 5, the project table and line 77, the axe paragraph around line 102, the section 7 tag table)</read_first>
  <action>Implements D-72 item 4. Remove the workarounds: in profile.spec.ts the comment and `second.evaluate('window.scrollTo(0, 0)')` before the axe call; in audit-log.spec.ts the `centerFirstEntry` function and all six calls (including the two before `press(...)`); in users.spec.ts the comment and the `scrollIntoView` line before the axe call. Change nothing else in those files. Prove it: preflight, then `npm --prefix web run e2e -- profile.spec.ts audit-log.spec.ts users.spec.ts < /dev/null` (all five projects); quote the counts. If a step now fails, re-run that test alone, read its trace and find why: if a sticky or fixed bar still covers something, fix the cause in the CSS utilities or the helper within the rules of Tasks 1 to 6; if it is unrelated to the bars, stop and report it. Never restore a workaround. Commit: `test(quick-261026-ooe): drop the scroll workarounds the bar fixes made redundant (D-72)`.

Docs: in docs/web/e2e.md
- line 77 and the project table: the two scrollbar projects also run `focus-scrollbars.spec.ts`;
- the axe paragraph: two plain sentences on the D-71 re-check (a control that is only partly covered, where at least one covering control sits in a fixed or sticky bar such as the admin top bar, the phone tab bar or the public header, is scrolled to the middle of the window inside the page's scroll padding, checked again for `target-size` alone, and the scroll is put back; it fails only if still covered; every other finding is reported as before), plus one sentence that admin and public pages carry scroll padding for their sticky bars and `/dev/public` (dev builds only) shows the public layout for these checks;
- the tag table: extend `@fixture` with the two bar self-tests, and add a `@focus-not-obscured` row after `@shell` (WCAG 2.2 AA 2.4.11: the tab bar on pixel and iphone and in a 775px classic-scrollbar window, the spacing following the bar from 375 to 1280px and from 760 to 800px with real scrollbars, the admin top bar at 1280, 820 and phone widths, the public header on /dev/public at 1280, 820 and 390px and on the phones, a Tab and Shift+Tab pass through the Security tab, and the axe re-check on Confirm new password; quick 261026-ooe, D-70 to D-72).
Change only the Updated value of the timestamp line. No em or en dash in new text. Commit: `docs(quick-261026-ooe): record the sticky bar focus tests and the axe re-check`.

Full gates, each after the preflight:
1. `npm --prefix web run verify < /dev/null`. Quote the end of the output and the exit code; zero warnings.
2. `npm --prefix web run e2e < /dev/null`, all seven projects (about 30 minutes or more), with the Bash tool's run_in_background option, output to a log file outside the repo (your session scratchpad); wait for the completion notice, do not poll in a loop. Quote the passed, failed and skipped counts. If the full run cannot finish locally, run at least pixel, iphone, chromium and both scrollbar projects and state plainly in the SUMMARY that firefox and webkit are left to CI. The sweeps (@shell, @responsive, @expenses-sweep, @long-text, @auth-overflow) must pass at 320, 768, 1280 and every other width they cover: scroll padding and margin change nothing at rest.
3. A failing test: re-run it alone in its project before calling it flaky; record any flake with its title, project and both results. If a test that pinned an exact scroll position now differs only because of the new spacing, stop and report it rather than editing the expectation.
Make sure no background shell or Playwright process you started is still running.

SUMMARY (`.planning/quick/261026-ooe-focused-fields-stay-clear-of-the-phone-b/261026-ooe-SUMMARY.md`, created and updated timestamps, not committed): every commit hash; each red output quoted (Tasks 1 to 6); the measured bar heights; the 60 of 60 line; the three workaround specs' counts; verify and e2e counts; any flake; the sticky and fixed element list from the context with the reason each needs no change; and the one residual: in a 768 to about 782px window with classic scrollbars, webkit ignores the controls' scroll margin, so Safari with always-visible scrollbars is not covered there (chromium, Edge and firefox are), and no project can test it.</action>
  <verify>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e -- profile.spec.ts audit-log.spec.ts users.spec.ts</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run verify</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run e2e</automated>
  </verify>
  <done>The three workarounds are gone and profile, audit-log and users specs pass in all five projects; docs/web/e2e.md describes the new spec, the dev route, the re-check and the tag, with only its Updated value changed; `npm --prefix web run verify` exits 0 with zero warnings; the e2e suite passes in all seven projects (or the stated local scope); two commits exist in this task; no background shell is left running; the SUMMARY holds the evidence, the element list and the one residual.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser layout | CSS utilities add scroll padding to the page and a scroll margin to main's controls in one narrow case. No new request, endpoint, stored data or script; the strict CSP is unchanged (no style attribute, no inline style). |
| Dev route to production | /dev/public and its page exist only where `__DEV_ROUTES__` is true; production gets a literal false. |
| Test fixture to page | The e2e helper runs page scripts and a second axe pass in the test browser only; nothing ships. |
| Repo to public | The repo is public; commits must carry no secrets, infrastructure ids or local paths. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261026-ooe-01 | Information disclosure | Commits of specs, fixtures, recipes, routes, budget and docs | medium | mitigate | gitleaks on the staged change before each commit plus a read of the staged diff for server or database names, non-`@csps.test` emails, connection strings and `C:/Users/<name>` paths; stage by path; never stage `.planning/` or `artifacts/`. Test emails are made-up `@csps.test` addresses. |
| T-261026-ooe-02 | Repudiation | expectNoAxeViolations re-check could hide a real target-size failure | medium | mitigate | Runs only for a partially obscured node with a covering control in a fixed or sticky bar (D-71), re-runs the real target-size rule, keeps the violation when the rule was not evaluated, and is pinned by self-test 2 (still covered after scrolling fails); every other rule and node is reported unchanged. |
| T-261026-ooe-03 | Information disclosure | Dev-only /dev/public page reaching production (CWE-489, D-20) | medium | mitigate | Mounted only in devRoutes (dropped when `__DEV_ROUTES__` is false); routes.test.tsx proves production falls through to the holding page; budget.ts lists the page in DEV_ONLY_MODULE_PREFIXES so a production build holding it fails. The page holds no data and makes no request. |
| T-261026-ooe-04 | Denial of service | Root scroll padding and the gap scroll margin | low | mitigate | Scoped to the admin frame or public layout being mounted, to phone viewports for the bottom padding and to the classic-scrollbar gap for the margin (dialog contents excluded); no effect at rest; the full e2e sweeps at 320 to 1920px run before the PR. |
| T-261026-ooe-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs, bumps or lockfile changes in this plan; any need for one stops the task and goes to the owner. |
</threat_model>

<verification>
- Tasks 1 to 6: each RED commit's tests failed for the stated reason (quoted) and pass after its fix.
- @focus-not-obscured passes in all seven projects; @fixture passes in the three desktop engines; the @profile tabs test passed 60 of 60 on pixel; profile, audit-log and users specs pass without the workarounds.
- `npm --prefix web run verify` exits 0 with zero warnings; the e2e suite passes (scope stated).
- `git log --oneline -14` shows the task commits in order (six RED test commits, five fixes, one feat, the workaround removal and the docs commit), each ending with the Co-Authored-By line; `git status` shows no staged or modified tracked files besides the orchestrator's `.planning/STATE.md`.
</verification>

<success_criteria>
- A keyboard user always sees the focused control under every sticky bar: the phone tab bar (including classic-scrollbar windows in chromium, Edge and firefox), the admin top bar at every width and the public header at every width (D-70, D-72, WCAG 2.2 AA 2.4.11).
- The bottom spacing is on exactly where the tab bar is drawn, and that is tested from 375 to 1280px and from 760 to 800px with real scrollbars.
- The e2e axe check treats a control a fixed or sticky bar partly covers as a user would and stays strict for everything else (D-71); the @profile flake is gone (60 of 60) and the three workarounds are removed.
- No new package, no script-based fix, no base.css token, sweep.ts unchanged, no em or en dash in web/src, zero warnings.
</success_criteria>

<output>
Create `.planning/quick/261026-ooe-focused-fields-stay-clear-of-the-phone-b/261026-ooe-SUMMARY.md` when done, with `created:` and `updated:` timestamps. Do not commit it.
</output>
