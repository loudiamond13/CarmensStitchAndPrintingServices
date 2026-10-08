# Phase 2: Web Foundation & Design System - Research

*Created: 2026-10-07T20:29:34-05:00 · Updated: 2026-10-08T06:51:22-05:00*

**Researched:** 2026-10-07 (first pass) · **Refreshed:** 2026-10-08 for owner ruling **D-33** (full Tailwind conversion) and the from-scratch replan
**Domain:** React 19 + strict TypeScript SPA (Vite 8 / Rolldown, **Tailwind v4 utilities for all UI styling**, React Router 8, TanStack Query 5, nuqs) served from ASP.NET Core 10 `wwwroot`, with the approved CSPS design system re-expressed in utilities, a visual-parity proof against the approved CSS, and the quality gates (ESLint, axe, budgets, Lighthouse, Playwright)
**Confidence:** HIGH for versions, dates, advisories, Tailwind 4.3.3 compile output, the CSP behaviour of each style mechanism, and the visual-parity method (all measured this session in scratch probes outside the repo, in Chromium, Firefox and WebKit). MEDIUM for the bundle-size forecasts after conversion (estimates from a synthetic conversion). Every claim is tagged.

> **How this was researched.** Context7 is not available in this session. The first pass (2026-10-07) used official docs through WebFetch, `registry.npmjs.org`, the npm bulk-advisory endpoint, GitHub security-advisory APIs and a local probe build of the verbatim Appendix A–D code. **This refresh (2026-10-08)** adds four new scratch probes (session scratchpad only, never the repo): (1) `tailwindcss@4.3.3` + `@tailwindcss/cli@4.3.3` compiling the CSPS theme, custom variants and every rule category of Appendix B/C; (2) an **A/B parity probe** that renders the spec CSS (App. A–C compiled exactly as App. A.2 wires it) and a hand-converted Tailwind version of buttons, badge, field, tabs, sidebar nav and the responsive table in **Chromium 1243, Firefox 1543 and WebKit 2359** with `@playwright/test@1.63.0`, comparing computed styles and pixels; (3) a CSP probe of every style mechanism under the project's exact `StrictCsp`; (4) ESLint 10.11.0 selector probes and an `eslint-plugin-better-tailwindcss@4.7.0` probe. It also re-read the npm registry (dates, deprecations, advisories) for every D-25 package and the D-33 candidates, diffed lucide-react 1.52.0 against 1.53.0, and read the superseded execution history (archived plans, SUMMARYs, UAT, SECURITY, debug file, backlog 999.1) plus the superseded code at commit `74621f5` through `git show`. Probe results are tagged `[VERIFIED: local probe]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All 12 owner decisions the roadmap lists for this phase (OD-14, C-10, C-11, C-22, C-25, C-34, C-35, S-1, S-2, S-6, S-7, S-8) are closed below. The owner ruled each one in chat on 2026-10-07.

#### Accessibility vs the approved design (OD-14, C-34, C-35, A11Y-04)
All reconciliations live in one owner-approved `overrides.css`, loaded after the verbatim spec CSS. Appendix A–C CSS stays byte-for-byte. Each override rule carries a comment naming its decision ID.

- **D-01 (C-34):** iOS input zoom. On small screens only, text inside **text-entry fields** (input, textarea, select, search boxes, table filters, item-row inputs) is **16px**. Desktop and tablet keep the designed 14px. Labels, table text and buttons are untouched. **Never** use `maximum-scale` or `user-scalable=no`.
- **D-02 (C-35):** Inactive user rows. **No opacity fade.** Inactive rows are "muted but readable": a softer row background plus the existing neutral `Inactive` badge, with all text at ≥ 4.5:1 contrast. This replaces the spec/design `op: 0.72` (3.69:1). Dimmed `.is-zero` cascade tiles follow the same rule.
- **D-03 (C-35):** Orange `--accent` must never be the only state indicator. It fails WCAG 1.4.11 at 2.29:1 on Blush. Keep the orange and **add a second cue**:
  - the selected tab and current nav item get bold weight and darker ink
  - the checked "Keep me signed in" checkbox gets a dark border/tick

  The cue applies on **both** Blush and Espresso so behaviour is consistent, even though Espresso's orange already passes at 6.51:1.
- **D-04 (C-35):** Toasts.
  - **Danger toasts persist until the user closes them.**
  - Success and info toasts keep the designed 4.5 s auto-dismiss.
  - The other spec behaviour stays: at most 3 stacked, newest on top, manual dismiss.
- **D-05 (C-35):** Hover-hidden actions. These are the image-thumb cover, delete and grip actions (`.csp-thumb-actions`, `.csp-thumb-grip` at `opacity: 0`). They become **visible on keyboard focus** (`:focus-within`) and are **always visible on touch devices**. No focusable element may ever be invisible.
- **D-06 (C-35, GAL-02, WCAG 2.5.1 Level A):** On phones, the lightbox gets **invisible full-height left/right tap zones** on the photo instead of visible prev/next buttons. They are real `<button>`s with accessible names ("Previous photo" / "Next photo"), keyboard-focusable with a visible focus ring. Swipe, Esc, ← and → keep working. The owner chose this over visible small arrows to keep the clean look. Phase 2 only records the ruling, because the lightbox itself is built in the public-site phase. The planner of that phase must treat this as the GAL-02 "button alternative".

#### Design code: copy or fix (C-22, C-25, WEB-02, WEB-07)
- **D-07 (C-22):** Bring in Appendix A–D in this order:
  1. **Copy verbatim**, then compile and lint it under the full PRD §17.2 settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, typescript-eslint `strictTypeChecked`, jsx-a11y strict, react-hooks 7 compiler rules).
  2. **Report the delta.**
  3. Apply the **smallest fixes**, each marked `// SPEC-DEVIATION: <reason>`, with **no DOM or markup change**.

  Known fixes already required by WEB-02: the focus-trapping Modal, Tabs ARIA, `Mark` without `dangerouslySetInnerHTML`, and no non-null assertions.
- **D-08:** If a strict-rule fix **would change rendered markup or visuals**, **stop and ask the owner** with a plain-words before/after. Never decide it silently. — **Reversibility:** reversible. Rationale: it is only a process gate.
- **D-09 (C-25):** The client `round2` in `csps.ts` changes to **integer-centavo, half-away-from-zero** rounding to match the server's `MidpointRounding.AwayFromZero`. It is recorded as a `// SPEC-DEVIATION`. Example: 7.5% of ₱17.00 must preview ₱1.28, not ₱1.27.
  - A shared golden-vector file holds ≥ 200 cases, including half-centavo midpoints, ORD-2026-0148, ORD-2026-0151, 100% discounts, zero items and multiple discounts. Vitest and xUnit both consume it, and CI fails on any disagreement.
  - Pin the operation order in one documented place: round the items total, round each discount, sum, subtract.
  - Once a save returns, screens show the **server's** figures.

#### Icons and theme (C-10, C-11)
- **D-10 (C-10):** Icons come from the **`lucide-react` package** (ISC), **not** the spec's in-house `icons.ts` (Appendix D.5). This overrides UI-SPEC §2.6 "Don't add lucide-react".
  - Keep the spec's `Icon` component **API** (`<Icon name=… />` with a typed `IconName` union of the icons the spec uses) as a thin wrapper over per-icon named imports, so call sites and tree-shaking both work.
  - Record the wrapper as a `// SPEC-DEVIATION`.
  - Credit comes via the license notice pipeline (Vite `build.license` / THIRD-PARTY-NOTICES).
- **D-11:** **lucide-react version = the newest stable release at install time** (1.52.0 as of 2026-10-07). The **owner explicitly waives the 14-day cool-down for lucide-react only**, recorded 2026-10-07. At install, the executor still checks that exact version for npm advisories, deprecation or yank, and open regressions, and shows the owner before adopting it, per the standing package-approval rule. Record the waiver in `docs/dependencies.json`.
- **D-12:** Icon drift review. For every icon the spec uses (57 in Appendix D.5), check that the name still exists in the installed lucide-react and render it next to the 0.460 drawing. **Show the owner each icon that was renamed or looks noticeably different.** The owner approves the new look or picks the closest alternative. The DOM-snapshot comparison against Appendix D compares the icon `<svg>` wrapper (class, size, stroke, aria attributes), not the inner path data. The owner approves the path drawings through this review.
- **D-13 (C-11, PROF-04 groundwork):** The admin theme is a **manual Blush/Espresso toggle** persisted in `localStorage['csps-theme']`. With no saved choice the admin **always starts in Blush** and does **not** follow `prefers-color-scheme`. The `localStorage` access is guarded with try/catch.
- **D-14:** The **public site is light (Blush) only**, even for visitors in OS dark mode.

#### Developer tooling (S-1, S-2, S-6, S-7, S-8)
- **D-15 (S-1):** Use the TypeScript alias pair:
  - `typescript` → `npm:@typescript/typescript6@6.0.2`, the stable API used by typescript-eslint and other tools
  - `@typescript/native` → `npm:typescript@7.0.2`, for the fast `tsc --noEmit` type check

  Both versions are pinned exactly and updated in step.
- **D-16 (S-8):** API types are generated by **openapi-typescript 7.13, isolated in `tools/openapi-gen/`** with its own TypeScript, so it doesn't clash with D-15. Generated types are **committed**. A CI drift check fails if the API's OpenAPI document changes without regenerating the types. `api.ts` is the only consumer.
- **D-17 (S-2):** Lint uses **`eslint-plugin-jsx-a11y-x` 0.2.0** (the maintained fork that supports ESLint 10), not `eslint-plugin-jsx-a11y`.
- **D-18 (S-6):** Component-level axe uses an **in-house matcher** of about 20 lines over `axe-core` 4.13.x. It does **not** use `vitest-axe`.
- **D-19 (S-7):** Record these doc corrections; the PRD's stated versions are superseded:
  - **MSW v3** (`msw/node`), not v2
  - **react-router 8**: import from `react-router`, with `RouterProvider` from `react-router/dom`, and never `react-router-dom`
  - TanStack Query stays on **v5**

#### Shells, showcase and visual review (discussed beyond the roadmap list)
- **D-20:** The **admin layout and routes exist only in local development** in this phase. Builds intended for a server (`npm run build` → `wwwroot`) **exclude admin routes entirely** until Phase 4 adds sign-in, so nothing unprotected is ever deployed. — **Reversibility:** reversible. Rationale: Phase 4 adds the routes back behind auth.
- **D-21:** The **public layout** shows the real designed header and footer with a **simple placeholder** in the main area (for example, "Site update in progress"). The real Home page belongs to the public-site phase. There is still one `h1` per page, plus a skip link and labelled landmarks.
- **D-22:** A **dev-only component showcase** at `/dev/components` lists every primitive in Blush and Espresso: buttons, badges, fields, PasswordInput, OtpInput, money input, Select, SegmentedControl, Tabs, DataTable (with card view on phones), Pagination, FilterBar/SearchBox, Modal, ConfirmDialog, Toast, Skeletons, EmptyState, error states, LazyImage and the icons. It is excluded from production builds, and it uses **no Storybook** or other extra tools. It doubles as the page-level axe and Playwright target.
- **D-23:** Owner review is by **screenshots**. Capture the showcase and both layouts at **390, 820 and 1440 px**, in light and dark (admin only for dark), and send them to the owner.
- **D-24:** **Local-only side-by-side visual report.** A local script screenshots our layouts and components next to the matching screens rendered from `.planning/design/*.html`, at 390/820/1440 px in light and dark, into one report for the owner. Differences the owner flags become fixes. The script and its output must **never** commit, upload or deploy the design files or their renders. Output goes to a gitignored folder. The script does not run in CI, because the design files are not in git.

#### Owner rulings on research open questions (2026-10-07, at plan-phase)
- **D-25 (packages):** The owner **approved the full "Packages Requiring Owner Approval" table in `02-RESEARCH.md` as recommended**, at the exact versions listed there. The ruling includes:
  - **Vite 8.3.3** is accepted as a security-fix cool-down exception. It fixes 3 advisories in 8.3.0–8.3.2. Record it as `accepted: security fix` in `docs/dependencies.json`.
  - **`lighthouse` 13.5.0 plus an in-house assert script replaces `@lhci/cli`**, which brings 11 high-severity audit findings. This supersedes the `@lhci/cli` named in CLAUDE.md.
  - **MSW is deferred** to the first phase with real endpoints. Phase 2 HTTP tests use a fake `fetch`.
  - The optional `@tanstack/eslint-plugin-query` and `rollup-plugin-visualizer` are **not** adopted.
  - Installs need no further approval checkpoint, but the executor must stop and ask if an install would resolve a different exact version than the table, or if `npm audit` shows a new advisory.
- **D-26 (licenses):** The owner **approved these dev/build-only license exceptions**, recorded in `docs/license-exceptions.json`:
  - MPL-2.0 widened from test to **build** scope (`lightningcss`, needed by Vite 8 and Tailwind 4)
  - CC-BY-4.0 (`caniuse-lite`)
  - CC0-1.0 (`language-subtag-registry`)
  - BlueOak-1.0.0 (`minimatch`)
  - 0BSD (`tslib`)

  The production (shipped) tree stays strictly MIT/ISC/Apache-2.0/BSD plus the OFL fonts.
  - **D-26 addendum (2026-10-08, by owner, decision D-BL-01, "Approve all three (Recommended)"):** three more dev/build-only, license-level exceptions on the same terms (never in the production tree), recorded in `docs/license-exceptions.json`. **MIT-0**, test scope (`@csstools/color-helpers`, `@csstools/css-syntax-patches-for-csstree` via jsdom). **CC-BY-3.0**, tool scope (`spdx-exceptions`, `spdx-ranges` via license-checker-rseidelsohn). **Python-2.0**, tool scope (`argparse` via openapi-typescript → @redocly/openapi-core → js-yaml, tools/openapi-gen). No package changed, and `node web/scripts/license-gate.mjs` now passes with 16 production packages, 522 dev/build packages and no stale exceptions.
- **D-27 (O-9):** The Sidebar "Logout" `<a href="#">` becomes a **`<button>`**, recorded as a `// SPEC-DEVIATION`. It needs `compat` styling so it looks identical, and before/after screenshots go to the owner.
- **D-28 (O-10):** The owner **accepts** the `lucide lucide-<name>` classes that lucide-react 1.52.0 adds to every icon `<svg>`. The DOM-equality test normalizes those classes away, and the difference is recorded as a `// SPEC-DEVIATION`.
- **D-29 (Pitfall 12):** In production, `/scalar` and `/openapi` (and their sub-paths) answer **404**. They do not fall through to the SPA shell. `ProductionHasNoApiDocs` keeps asserting 404.
- **D-30 (E2E environment):** Local E2E runs the host in **Development over HTTPS on 5199**, with secrets from user-secrets. HTTPS is needed because WebKit upgrades `http://localhost` under `upgrade-insecure-requests`. Phase 3 CI supplies its own per-process secrets.

#### Owner rulings on the plan 02-09 review pack (2026-10-08, in chat; backlog D-BL-03 and D-BL-02)
The owner answered "Option A: accept all (Recommended)" for D-BL-03 and "Option B: hide it" for D-BL-02. Plan 02-11 applies these rulings; nothing here is code yet.

- **D-31 (O-items and D-08 items, UI-SPEC "Owner Confirmations"):**
  - **O-1** (2026-10-08, by owner): approved as recommended. The `Avatar` `<span aria-label>` gets `role="img"`. No visible change.
  - **O-2** (2026-10-08, by owner): approved as recommended. The `TestimonialCard` stars `<div aria-label>` get `role="img"`. No visible change.
  - **O-3** (2026-10-08, by owner): approved as recommended. The current public phone-drawer link gets `aria-current="page"` and turns 800 **italic** as its second cue (the one visible change).
  - **O-4** (2026-10-08, by owner): approved as recommended. The footer social labels "CSPS onFacebook / onInstagram / onTikTok" become "CSPS on Facebook / on Instagram / on TikTok". Spoken label only.
  - **O-5** (2026-10-08, by owner): approved as recommended. `.s-toast-layer` stays mounted (empty when there are no toasts) as the live region. Behaviour only.
  - **O-6** (2026-10-08, by owner): approved as recommended. Under `prefers-reduced-motion`, the skeleton shimmer and the modal and toast entry animations stop. Visible only to people who ask for reduced motion.
  - **O-7** (2026-10-08, by owner): approved as recommended. Warning toasts persist until closed, like danger toasts (D-04). Success and info timers pause while the pointer is over the toast stack or focus is inside it (WCAG 2.2.1). Behaviour only.
  - **O-8** (2026-10-08, by owner): **keep the smaller designed controls as designed** and record the exception. These are the sm buttons and `.csp-iconbtn` / `.s-iconbtn` at 36 px, `.csp-seg-btn` at 32 px tall, the filter-chip clear button at 22 px and the label-wrapped login checkbox at 20 px. **Recorded exception:** they meet WCAG 2.2 AA **2.5.8 Target Size (Minimum)** (24 px or the spacing exception, checked by axe `target-size`), and spec §11 accepts 36 px with spacing. They are below the project's own 44 px touch-target goal (CLAUDE.md) by owner decision. Every other new control still targets 44 px.
  - **D-27 confirmation** (2026-10-08, by owner): the Sidebar Logout `<button type="button" class="csp-nav">` look is **confirmed identical** to the old link. Chromium measured all 34 values equal, and the owner saw the before/after renders. The `/* D-27 */ button.csp-nav` compat rule stays as built in plan 02-09.
  - **D-BL-02** (2026-10-08, by owner, Option B, a D-08 item from plan 02-05): **hide** the "Manager" tag on the selected sidebar row. When its row is current, `.csp-nav-tag` is not shown, because the page title already says where you are. Plan 02-11 implements it as one rule in `overrides.css` that targets the App. B selectors `.csp-nav.is-on` / `.csp-nav-tag`, `/* D-31 D-BL-02 */ .csp-nav.is-on .csp-nav-tag { display: none; }`. Unselected rows keep the tag (with FYI-01's opacity 1 under D-02), and the tablet rule in App. C (`.s-admin-side .csp-nav-tag { display: none; }`) is unchanged.
  - **New D-08 items from plan 02-09:** none were found, so there is nothing more to rule.
- **D-32 (icon drift review, D-12; lucide 0.460 → lucide-react 1.52.0):** all 20 changed drawings are approved by owner (2026-10-08) as the new lucide-react 1.52.0 drawing, with no replacement icon. The other 36 of the 56 spec icons are identical.
  - **search**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **trash-2**: approved as the new 1.52.0 drawing. The lucide alias `trash-2` → `trash` is approved (lid and handle redrawn, about the same). The `Icon` name stays `trash-2`.
  - **receipt**: approved as the new 1.52.0 drawing (small curve changes).
  - **users**: approved as the new 1.52.0 drawing (small curve changes).
  - **log-out**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **menu**: approved as the new 1.52.0 drawing. The bars moved from y = 6/12/18 to **5/12/19** and look slightly wider apart. This is the one noticeable change, and it is approved.
  - **phone**: approved as the new 1.52.0 drawing (small curve changes).
  - **message-circle**: approved as the new 1.52.0 drawing (small curve changes).
  - **mail**: approved as the new 1.52.0 drawing (small curve changes).
  - **clock**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **circle-check**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **list**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **filter**: approved as the new 1.52.0 drawing. The lucide alias `filter` → `funnel` is approved (rounded joins, very similar). The `Icon` name stays `filter`.
  - **calendar**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **palette**: approved as the new 1.52.0 drawing (small curve changes).
  - **zap**: approved as the new 1.52.0 drawing (small curve changes).
  - **trending-up**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **trending-down**: approved as the new 1.52.0 drawing (shape rebuilt, looks the same).
  - **package**: approved as the new 1.52.0 drawing (small curve changes).
  - **moon**: approved as the new 1.52.0 drawing (small curve changes).

#### Owner ruling: UI styles in Tailwind (2026-10-08, in chat, during `/gsd-execute-phase 2`)
- **D-33 (UI styles are Tailwind utilities; supersedes the verbatim-CSS rule):** The owner asked to convert the stylesheets in `web/src/styles` "into tailwind css? Strictly tailwind for ui styles", and then chose **"Full conversion to Tailwind"** from these options: keep the spec CSS / hybrid / full conversion. This ruling:
  - **Supersedes** the "Appendix A–C CSS stays byte-for-byte" rule (Accessibility section above), the CSS part of D-07, and UI-SPEC §0 rule 2 and §2.3 ("utilities are layout glue only"), for UI styles. The owner rules that the UI spec yields here (CLAUDE.md: "the UI spec wins … unless the owner rules otherwise").
  - **Keeps the approved look.** The spec stays the visual source of truth: every token value, size, spacing, radius, shadow, breakpoint, state and theme (Blush and Espresso) must render the same as it does today, plus the owner rulings D-01..D-05, D-27, D-31 (including the D-BL-02 "hide the Manager tag on the selected row") and D-32. Rule 1 still applies: no invented values and no Tailwind default palette, radii or shadows, only CSPS tokens through `@theme`.
  - **"Strictly Tailwind" in practice:** UI styling moves into Tailwind utility classes in the markup. Only what Tailwind v4 itself needs stays in CSS: the token `@theme`/custom properties, `@font-face`, `@keyframes`, the theme switch, and the minimal base/compat layer. Hand-written component or screen selectors (`.csp-*`/`.s-*` rule bodies, `overrides.css`, `spec-gaps.css`) are retired. Whether `.csp-*` / `.s-*` names survive as hooks is left to planning.
  - **Proof replaces "verbatim":** the 245-case DOM-differential test against the frozen App. D markup no longer fits (markup classes change by design). A rendered-look comparison takes its place: screenshots or computed styles against today's rendering in both themes and at 320/390/820/1440 px. Zero axe violations, the strict CSP (no inline styles) and the CSS budget (≤ 35 KB gz) stay.
  - **Reversibility:** costly but reversible. Rationale: owner preference for one styling approach across the UI. Plans 02-05, 02-09 and 02-11..02-18 are re-planned; recorded rulings D-31/D-32 still apply.

#### Carried forward (already decided; do not re-ask)
- Ports: Vite **5180** (`strictPort`), API **5115/7028**, Playwright host **5199** (`reuseExistingServer: false`); HostProbe 5116/7029. The dev proxy has `/api` targets hard-coded, and no machine-level env vars are set. Run the preflight script before any dev server, Playwright or full test run.
- Locale `₱` / `en-PH` (`₱12,450.00`, U+2212 minus for negatives, `Oct 6, 2026`) in business zone `Asia/Manila` (Phase 1 D-01..D-03).
- nuqs **2.10.1** (owner-approved) or a newer stable version ≥ 14 days old **with fresh owner approval at install**. Use the `nuqs/adapters/react-router/v8` adapter and follow the WEB-10 rules; ESLint rejects the deprecated adapters, `startTransition` and `shallow: false`.
- Free only, with allowed licenses MIT/Apache-2.0/BSD/ISC plus the approved exceptions. Every new dependency is recorded in `docs/dependencies.json` with its purpose, license, maintenance status and legitimacy, and each exact version gets an advisory check and the owner's OK before install.
- Phase 1 note: unknown non-API paths currently answer 401 to anonymous callers, so **this phase must map and allow-list the SPA host anonymously** (static files plus fallback to `index.html` for client routes) while `/api/*` unknowns stay ProblemDetails 404 (FND-05).
- Strict CSP: no `unsafe-inline` or `unsafe-eval`. Zero console errors, zero axe violations, zero warnings everywhere.

### Claude's Discretion
- The exact softer background token and darker-ink values for D-02/D-03, as long as they come from the existing palette where possible and meet the contrast ratios. They will be shown in the D-23 screenshots.
- Placeholder wording for D-21 (plain English, owner can change it later).
- How admin routes are excluded from server builds (D-20): a separate entry, a build flag or route-module exclusion. The bundle-budget gate must still measure an admin bundle.
- Folder layout inside `web/`, the test file organisation, and the screenshot tooling used for D-23/D-24, as long as it is free and Playwright-based where possible.

### Deferred Ideas (OUT OF SCOPE)
- Public dark theme (Espresso for public pages) was rejected for now. It would need newly designed and approved public screens, so it belongs in a future phase if wanted.
- Lightbox tap zones (D-06) are implemented in the public-site phase, not here.
- A 404 page belongs to the public-site phase (PUB-01/PUB-04).

> **Reading note for the planner (not a decision).** D-33 supersedes the CSS half of several older rulings that are quoted verbatim above: the "overrides.css / byte-for-byte" sentence of the Accessibility section, D-07's CSS part, D-12's and D-28's "DOM-snapshot comparison" wording, D-27's "compat styling", and D-31 D-BL-02's "one rule in overrides.css". Their **visual and behavioural outcome stays binding**; only the mechanism changes (utilities instead of CSS rules, visual-parity proof instead of DOM equality). Section "Owner rulings expressed in utilities" maps each one.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (abridged from REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| WEB-01 | Vite app in `web/` builds into `src/Csps.Server/wwwroot`; dev server 5180 strictPort, `/api` proxy, no machine env vars | §Standard Stack; Pattern 1 (vite.config); Pattern 7 (SPA host, revised with lessons L-01..L-06); Pitfalls 1, 3, 11, 12 |
| WEB-02 | **(amended by D-33)** Design system implemented with **Tailwind v4 utilities for all UI styling**; tokens via `@theme`; only theme/`@font-face`/`@keyframes`/base left in CSS; rendered look **proven equal** (Blush + Espresso, 320/390/820/1440); `// SPEC-DEVIATION` reconciliation; focus-trapping Modal, Tabs ARIA, `Mark` without `dangerouslySetInnerHTML`, no non-null assertions | **§Tailwind v4 Conversion Design** (theme, variants, rule-category mapping, owner rulings in utilities); **§Where Class Strings Live**; **§Proving the Look Is Unchanged** (A/B parity harness, verified pixel-equal in 3 engines); Flag 2 (compiler); Pitfalls 21–33 |
| WEB-03 | `httpClient.ts`: fetch-based, interceptors, timeout/abort, single-flight 401 refresh, capped retries, normalized `HttpError`, 100% coverage | Pattern 5; Don't-Hand-Roll; Pitfalls 14, 15; L-14 |
| WEB-04 | `api.ts` is the only endpoint module; ESLint forbids `fetch`/`httpClient`/`axios` elsewhere | Pattern 6 (lint rules + lint-rule tests; one merged `no-restricted-syntax` array, L-19) |
| WEB-05 | Public/Admin layouts, mobile nav drawer, route-level splitting, global error boundary | Pattern 2 (router); Pitfall 10; conversion scope §"What App. C Phase 2 converts" |
| WEB-06 | Shared primitives with unit + axe tests | §Where Class Strings Live (recipes); SPEC-GAP table in 02-UI-SPEC; Pattern 4; Pitfall 20 |
| WEB-07 | `formatPeso`/`formatDate`/`orderTotals` agree with server on ≥ 200 golden vectors in xUnit and Vitest | Pattern 8; Pitfall 13; L-11, L-12 |
| WEB-08 | TanStack Query defaults, keep-previous pagination, 300 ms debounced cancellable search, intent prefetch | Pattern 9; Pitfall 16; **L-15 (`prefetchQuery` deprecated in 5.103.2)** |
| WEB-09 | One `Idempotency-Key` per submission, reused on retry; pending button `aria-disabled` | Pattern 5; Pitfall 15; aria-disabled look in utilities (verified variant composition) |
| WEB-10 | nuqs URL state, adapter v8 in lazy layout route, parsers, push/replace rules, lint bans | Pattern 10; **L-16 (nuqs shallow writes bypass `useLocation`)**, L-17 |
| ORD-09 | `₱12,450.00`, U+2212 negatives, `Oct 6, 2026`; 2-decimal money input with numeric keypad | Pattern 8; Code Example `formatBusinessDate`; UI-SPEC MoneyInput contract |
| QUAL-02 | TS/ESLint/Prettier at `--max-warnings 0`, PRD §17.2 rule set | Flag 1; Pattern 6; D-33 lint bans (verified selectors); Pitfall 4; L-18..L-21 |
| QUAL-04 | Playwright on 5199, 3 engines + phones, fails on console/CSP/axe | Pattern 11; Pitfalls 2, 8; L-22, L-23 |
| A11Y-01 | Zero axe violations, component and page level | Pattern 4; Pattern 11; parity suite also runs axe |
| A11Y-02 | Keyboard, skip link, focus trap/return, labelled landmarks, one `h1` | UI-SPEC Interaction Contract; Pitfall 9 |
| A11Y-04 | UI-spec vs WCAG conflicts ruled by owner | D-01..D-06, D-27, D-31; **§Owner rulings expressed in utilities** |
| PERF-01 | Budgets: public ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz, build fails | Flag 4; Pattern 12; **§CSP and Budgets** (converted CSS estimated 12.3 KB gz vs 15.05 KB gz reference; JS +~5–10 KB gz) |
| PERF-02 | Lighthouse ≥ 95 mobile, LCP < 2.0 s, CLS < 0.05 | Pattern 13; Pitfall 3 |
| PERF-03 | 320–1920 px, no horizontal scroll, ≥ 16 px inputs, `inputmode` | D-01 in utilities; Pattern 11 viewport matrix; exact container-query variants |
| PERF-05 | Self-hosted woff2, subset, swap, preload, metric fallbacks, ₱ in brand font | Pattern 14 (revised: fallback faces in the base layer, `font-sans`/`font-display` utilities read the token); Pitfalls 17, 18 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same authority as locked decisions. Sources: `./CLAUDE.md`, `./.claude/CLAUDE.md`, user memory rules.

- **Ports:** Vite 5180 (`strictPort: true`); API 5115 http / 7028 https; Playwright host 5199 (`reuseExistingServer: false`). Never 5173, 5023, 5099. Avoid 49152–65535.
- **Preflight** before any dev server, Playwright or full test run: `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`. If a port is in use by another project, wait; never kill another project's processes. This applies to the new route-served visual-parity suite too (it opens no port, but it is a Playwright run).
- **Never set** `ASPNETCORE_URLS`, `ASPNETCORE_HTTPS_PORT`, `DEV_SERVER_PORT`, `ASPNETCORE_ENVIRONMENT` or any variable at User/Machine level. Per-process only (CLI args or a child-process `env` block).
- **LocalDB:** `(localdb)\CSPS` only; E2E database `CSPS_E2E`. **No Docker or Testcontainers locally.**
- **Never touch** `C:\Work\TheBETSLLC`. `_local/` and `.planning/design/` are never committed, uploaded or deployed.
- **Free only.** Allowed licenses MIT, Apache-2.0, BSD, ISC; exceptions MPL-2.0 (axe, dev/test; widened to build by D-26), OFL-1.1 (@fontsource fonts), the two pinned Microsoft SqlClient parts, and the D-26 / D-26-addendum dev-only licenses. Never GPL/AGPL/SSPL/commercial. Explain licenses in plain words to the owner.
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, **any UI kit**, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks. (A class-variance helper is not a UI kit; it is still a new dependency needing approval.)
- **New dependencies:** purpose, license, maintenance status and legitimacy recorded in RESEARCH.md; **14-day release cool-down** (security fixes may skip with a recorded reason); exact versions; the owner approves each exact version before install (user memory rule).
- **Architecture:** onion enforced by ArchUnitNET; default-deny authorization with an authorization-matrix test that discovers every endpoint; `Result<T>` → RFC 9457 ProblemDetails; UTC storage + `TimeProvider`; money `decimal(18,2)`, server-computed only. `/health`, `/openapi`, `/scalar` (and the SPA fallbacks) stay framework-mapped.
- **Quality:** TDD red → green → refactor; zero warnings everywhere (build, lint, types, tests, browser console); coverage Domain 100%, Application ≥ 95%, `lib/http` 100%, web ≥ 90%.
- **Security:** CWE Top 25 drives the security review; strict CSP with no `unsafe-inline`/`unsafe-eval`; append-only audit log; no secrets or data in git.
- **A11y:** WCAG 2.2 AA, zero axe violations at component and page level.
- **Perf budgets:** public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz; Lighthouse ≥ 95 mobile; LCP < 2.0 s, CLS < 0.05, INP < 200 ms.
- **Responsive:** 320–1920 px, touch targets ≥ 44 px (O-8 exception recorded), no horizontal scroll.
- **Workflow:** `/gsd-plan-phase 2 --tdd`; `/gsd-ui-phase 2` for UI phases (02-UI-SPEC.md needs a D-33 refresh, see Open Question Q-5); `/gsd-secure-phase 2` and `/gsd-ui-review 2` before `/gsd-ship 2`. GitHub default branch `dev`; PRs target `dev`.
- **Markdown files** created or edited carry `Created · Updated` timestamps (ISO 8601 with offset).

## Summary

Phase 2 starts again from Phase 1's code: commit `bb6ef76` reverted every Phase 2 file to `880713c`, so there is **no `web/` folder**, no SPA host, no fixture web root and no `OrderMath` today `[VERIFIED: git show --stat bb6ef76; ls web → no such file]`. Everything the first pass verified about the stack still holds. Every D-25 exact version was re-read on 2026-10-08: none is deprecated, none has a new advisory, and all still install together `[VERIFIED: npm registry, bulk advisory endpoint]`. One day of age has changed three things: the **rolldown 1.2.11 exception is no longer needed** after 2026-10-08 14:30 UTC, **vitest 5.0.2** becomes eligible on 2026-10-09, and **lucide-react 1.53.0** was released today (all 56 spec icons are byte-identical to 1.52.0). These go to the owner as confirm-only items.

The real change is **D-33**. Every App. B/C rule has to become utilities on the markup, and nothing may be lost. Four probes this session show this is feasible, and they also show where it breaks:

1. **Tailwind 4.3.3 can express every rule category in App. A–C.** That includes container queries with the exact spec query text, `::before`/`::after` with `attr()`, compound and descendant state, reduced motion and keyframes. It needs **one small set of custom variants**, a fully cleared theme, and arbitrary values for spec literals. Some built-in variants do *not* match the spec exactly: `@max-[767px]/pg`, `max-sm`, `hover:` and `enabled:`.
2. **The look can be proven equal without the old DOM test.** A same-browser A/B harness renders the approved spec CSS and the Tailwind conversion side by side. In Chromium, Firefox and WebKit the converted buttons, badge, field, tabs and sidebar nav came out **pixel-identical and computed-style-equal** at 390 and 1440 px in both themes. The same harness also caught two real conversion bugs that a review would likely miss: `[font:inherit]` silently resetting the button type, and a **specificity accident in App. C that is part of the approved look** (the last table row's card title has no rule on phones).
3. **The strict CSP stays intact.** React's `style={{…}}` writes go through the CSSOM. In all three engines they were applied with no CSP violation, while `style=""` attributes, `setAttribute('style')` and `<style>` elements were blocked. The policy can therefore be "no `style` prop except CSS custom properties", enforced by ESLint selectors that were verified in this session.
4. **The budgets are comfortable.** A pessimistic synthetic conversion of every App. B/C declaration compiles to **12.3 KB gz of CSS**, against 15.05 KB gz for the spec CSS. The JavaScript grows by roughly 5–10 KB gz of class strings.

The superseded run (13 SUMMARYs, UAT and the security register) leaves **30 concrete lessons** for the new plans. They are listed in "Lessons from the Superseded Execution". The style-independent code it produced is still in history at `74621f5`: the SPA host, `HiddenSegmentFileProvider`, `OrderMath`, golden vectors, `httpClient`, nuqs/Query, `api.ts`, the license gate and the Playwright fixtures. New plans can use it as a reference implementation (Open Question Q-4).

**Primary recommendation:** Rebuild Phase 2 tracer-first. The first wave delivers the scaffold, the SPA host (with every server lesson applied from day 1, including the fixture web root and the dot-folder provider) and the Tailwind token theme on the placeholder page. Next comes a **visual-parity harness tracer**: a test-only reference built from the spec appendices plus a rulings layer, compared to the real showcase through route-served Playwright A/B, with one converted component green in all three engines. The style-independent plans then run in parallel, and App. D.3 converts in slices, each gated by the parity harness. Ship no hand-written selectors. Enforce that with ESLint bans, a stylesheet-contract test and an in-house class gate built on `tailwindcss`'s public `compile()`, so no new package is needed.

## What Changed in This Refresh (D-33 delta)

| Section | Status | Why |
|---|---|---|
| Standard Stack, D-25 approval table, legitimacy audit | **Kept** (re-verified 2026-10-08) + refresh notes | D-25 is owner-approved; only age-driven deltas noted |
| Research Flags 1, 3 | Kept | Unaffected |
| Flag 2 (React Compiler vs verbatim code) | **Revised** | Verbatim D.3 is now the *reference*, not the shipped code; compiler notes still apply to the converted components |
| Flag 4 (public budget) | **Revised** | Class strings move bytes from CSS to JS |
| Pattern 3 (differential DOM proof) | **Replaced** by §Proving the Look Is Unchanged | D-33: markup classes change by design |
| Pattern 7 (SPA host) | **Revised** with lessons L-01..L-06 | Execution found 6 server facts |
| Pattern 14 (fonts) | **Revised** | Fallback faces move to the base layer; utilities read the font token |
| Pitfalls 5, 6 (verbatim CSS line endings, `??` autofix on verbatim code) | **Retired / narrowed** | No verbatim CSS ships; Pitfall 6 still applies to the frozen reference copy and to converted components |
| Tailwind v4 Conversion Design; Where Class Strings Live; Proving the Look; CSP and Budgets; Lessons; Plan-Shaping Guidance | **New** | D-33 research items 1–6 |
| Validation Architecture | **Refreshed** | New test map for D-33 |

## Research Flags (from ROADMAP, answered explicitly)

### Flag 1: The TypeScript 7 alias setup — WORKS AS DOCUMENTED (unchanged)

- **Setup.** Microsoft's recipe is `"@typescript/native": "npm:typescript@^7.0.2"` plus `"typescript": "npm:@typescript/typescript6@^6.0.2"`: "This setup allows tools like typescript-eslint to access the TypeScript 6.0 API through the `typescript` package while enabling `npx tsc` to invoke version 7.0." `[CITED: devblogs.microsoft.com/typescript/?p=5246]` Pin both exactly (D-15): `npm:@typescript/typescript6@6.0.2` and `npm:typescript@7.0.2`.
- **Probe results (2026-10-07).** `npm install` produced no ERESOLVE. `node_modules/.bin/tsc` → `Version 7.0.2`. `require('typescript').version` → `6.0.3`. typescript-eslint 8.70.1 resolved every internal `typescript` to the alias, and type-aware lint ran without an "unsupported TypeScript version" warning. The superseded execution used this setup for 13 plans with zero type-gate surprises. `[VERIFIED: local probe; superseded 02-02 SUMMARY]`
- **`@typescript/typescript6@6.0.2` is a wrapper** over `"@typescript/old": "npm:typescript@^6"` → typescript **6.0.3**. Record it as a transitive dependency. `[VERIFIED: npm registry]`
- **One `tsconfig` valid for both compilers:** no `baseUrl` (removed in 7), `moduleResolution: "bundler"`, explicit `types` (TS 7 defaults to `types: []`), `"types": ["vite/client"]` so CSS and fontsource side-effect imports type-check under TS 7's default `noUncheckedSideEffectImports`. `[CITED: TS 7.0 announcement]`
- **Node-side tests need the node program.** Every test that imports `node:fs`/`node:url`, ESLint or `vite.config.ts` must be listed in `tsconfig.node.json` and excluded from `tsconfig.app.json`, with `allowImportingTsExtensions` in the node config. This includes the new stylesheet-contract and class-gate tests. `[VERIFIED: superseded 02-02/02-04/02-05 SUMMARY deviations]`
- **openapi-typescript 7.13.0 peers `typescript ^5.x`**: keep it isolated in `tools/openapi-gen/` with `typescript@5.9.3` (D-16). `[VERIFIED: npm registry]`

### Flag 2: The React Compiler vs the design code — COMPATIBLE; now applies to the converted components

- **Wiring (unchanged).** `@vitejs/plugin-react` 6.1.1 exports `reactCompilerPreset`: `plugins: [react(), babel({ presets: [reactCompilerPreset()] })]` with `@rolldown/plugin-babel` 0.2.4, `@babel/core` 7.29.7 and `babel-plugin-react-compiler` 1.0.0. `[VERIFIED: tarball read of @vitejs/plugin-react 6.1.1]` The `@rolldown/plugin-babel` filter callback receives `filename: string | undefined`; type the predicate accordingly. `[VERIFIED: superseded 02-02 SUMMARY, TS2322 fix]`
- **The verbatim D.3 compiled with zero bail-outs** (44 `CompileSuccess`, 0 `CompileError`) `[VERIFIED: local probe 2026-10-07]`. Under D-33 the shipped components are *converted*, not verbatim. Two compiler facts carry over:
  - **Static class strings and module-level variant maps are ideal for the compiler.** They are constants, and a `clsx()` call over constants and props is a pure expression. Nothing in the utility approach adds compiler risk. `[ASSUMED, low risk; the lint gate eslint-plugin-react-hooks 7.1.1 compiler rules will flag any problem]`
  - **`{...rest}` prop spreads defeat the compiler's memo cache**, so the cache-hit branches are never exercised and branch coverage drops below 90%. Use explicit props where possible, and add equal-props re-render tests where a spread is kept. `[VERIFIED: superseded 02-09 / 02-12 / 02-13 SUMMARY]`
- **The frozen reference copy of App. D.3** (test-only, see §Proving the Look) is built **without** the compiler and is excluded from `tsc`, ESLint, Prettier and coverage.
- **Lint finding still relevant:** `react-hooks/static-components` flags the `UiLink` context component pattern (`const L = useContext(LinkCtx); return <L/>`). The converted `UiLink` renders react-router's `Link` directly. `[VERIFIED: local probe 2026-10-07]`
- Narrow `@rolldown/plugin-babel` to `src/**/*.{ts,tsx}`.

### Flag 3: CSP behaviour of JSON-LD data blocks — NOT BLOCKED (unchanged)

- The HTML "prepare the script element" algorithm returns at step 13 for non-JavaScript types, before the CSP check at step 21. `[CITED: html.spec.whatwg.org/multipage/scripting.html]` React 19.3 renders a JSON-LD block from a string child with no console error. `[VERIFIED: react-dom 19.3.0 source]`
- **Phase 2 ships no JSON-LD.** Record it for the public-site phase.

### Flag 4: The public bundle budget — FITS; D-33 moves some bytes from CSS to JS

The first-pass measurements are still the baseline. They come from the verbatim code with CSS classes: production public initial JS **118.5 KB gz**, CSS **16.7 KB gz**, and the dev topology at 132.4 KB public and 142.8 KB admin `[VERIFIED: local probe 2026-10-07]`. Under D-33 the numbers change as follows:

| Quantity | Spec CSS (reference) | Converted (synthetic, pessimistic) | Source |
|---|---|---|---|
| Compiled CSS, no fonts, gzip -9 | **15,050 B** | **12,300 B** | `[VERIFIED: local probe — App. A.2 compiled with tailwindcss 4.3.3; every App. B/C declaration (2,792 declarations → 902 unique arbitrary-property utilities with their variants) compiled with the CSPS theme]` |
| Same, brotli | 13,029 B | 9,953 B | same probe |
| Extra JS: class strings for all of App. B / App. C | — | ≈ 4.7 KB gz / ≈ 5.0 KB gz | `[VERIFIED: local probe — rule bodies rendered as class-string literals and gzipped; an over-estimate because arbitrary-property names are longer than real utilities]` |

- **CSS:** the 35 KB gz budget has more than 20 KB of headroom (add about 1.7 KB for the fontsource `@font-face` rules).
- **JS:** expect the Phase 2 production public initial JS to land around **123–128 KB gz** (MEDIUM: an estimate, not a measurement). Only the App. B-equivalent strings of components reachable from the public entry count. The **Phase 4 trigger stands**: the build plugin measures both topologies from the first build, and a barrel split happens if public initial JS in the admin-included topology passes 135 KB gz.
- **The `Icon` name map** still keeps all 56 lucide components in the chunk that holds `Icon` (+3.3 KB gz). `[VERIFIED: local probe 2026-10-07]`
- **nuqs** stays out of the public entry when `NuqsAdapter` sits in the lazy admin layout (3.35 KB gz shared admin chunk). `[VERIFIED: local probe 2026-10-07]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layouts, primitives, theme toggle, showcase | Browser / Client | — | Pure SPA rendering; theme in `localStorage` (D-13) |
| **UI styling (utilities + token theme)** | **Build tooling (Tailwind compile)** → Browser | — | Styles are generated at build time from source class literals; the browser only receives one hashed CSS file |
| **Visual-parity proof (reference vs implementation)** | **Test tooling (Playwright, route-served)** | Build tooling (reference build) | Test-only; never in `wwwroot` (CWE-489) |
| URL list state (nuqs) | Browser / Client | API (authoritative caps) | URL is untrusted input; server re-validates page size/search (SEC-03) |
| Money/date formatting + order-math **preview** | Browser / Client | API / Domain (authoritative) | Client previews; server figures win after save (D-09); golden vectors bind both |
| Order-math reference implementation for golden vectors | API / Domain (`Csps.Domain`) | — | Server is authoritative; Domain needs 100% coverage |
| HTTP client, idempotency keys, 401 refresh | Browser / Client | API (honours keys from SEC-06 later) | Client generates keys; server-side dedupe is a later phase |
| SPA hosting (static files + `index.html` fallback, dot-folder refusal) | Frontend Server (ASP.NET Core) | CDN/Static (IIS in Phase 3) | Same origin as API; CSP/security headers already in middleware |
| Strict CSP + security headers | Frontend Server | — | `SecurityHeadersMiddleware` (Phase 1) covers every response incl. static files |
| Response compression for static text | Frontend Server | IIS (Phase 3) | Needed for Lighthouse in Phase 2 |
| Bundle budgets, license gate, cool-down, class gate | Build tooling | CI (Phase 3) | Fail locally first; Phase 3 wires the same commands into Actions |
| OpenAPI → TS types + drift check | Build tooling (`tools/openapi-gen`) | API test (snapshot of `/openapi/v1.json`) | Isolated TS 5.9 (D-16) |

## Standard Stack

> **Status: owner-approved (D-25) at these exact versions, but not installed** (the code was reverted). Re-verified on 2026-10-08: every version still exists, none is deprecated, and the bulk-advisory endpoint reports no advisory for any of them `[VERIFIED: npm registry, npm bulk advisory endpoint 2026-10-08]`. `min-release-age=14` in `web/.npmrc` re-checks the whole tree at install. **D-25's stop rule stands:** if an install resolves a different exact version, or `npm audit` shows a new advisory, stop and ask.

### Core (runtime, ships to the browser)

| Library | Version | Published | Purpose | Why standard |
|---|---|---|---|---|
| react / react-dom | 19.3.0 | 2026-09-09 | UI | UI-spec tested on 19.3; RR8 needs ≥ 19.2.7 `[VERIFIED: npm registry]` |
| react-router | 8.4.0 | 2026-09-15 | Data router, `route.lazy` splitting | v8 dropped `react-router-dom`; import `RouterProvider` from `react-router/dom` `[VERIFIED: npm registry; local probe]` |
| @tanstack/react-query | 5.103.2 | 2026-09-21 | Server state | Approved pin. 5.103.3 / 5.104.0 age out on 2026-10-10 (5.104.1 is latest); staying on 5.103.2 is fine, but it marks `prefetchQuery` deprecated (L-15) `[VERIFIED: npm registry]` |
| nuqs | 2.10.1 | 2026-08-25 | URL state (WEB-10) | Owner-approved; still `latest`, no stable 2.10.2 `[VERIFIED: npm registry 2026-10-08]` |
| clsx | 2.1.1 | 2024-04-23 | Class joining (D.3 uses it; the variant-recipe helper builds on it) | Finished, stable `[VERIFIED: npm registry]` |
| lucide-react | 1.52.0 (approved) | 2026-10-04 | Icons (D-10) | Cool-down waived (D-11). **1.53.0 published 2026-10-08 06:15 UTC; see owner item R-1** `[VERIFIED: npm registry]` |
| @fontsource/barlow-condensed | 5.3.0 | 2026-07-19 | Display font | OFL-1.1 |
| @fontsource-variable/archivo | 5.3.0 | 2026-07-19 | UI font; has ₱ in latin-ext | OFL-1.1 `[VERIFIED: cmap read 2026-10-07]` |

Transitive runtime: `@standard-schema/spec` 1.1.0 (via nuqs), `scheduler`, `@tanstack/query-core`, `cookie`, `set-cookie-parser`. All are MIT. `[VERIFIED: local probe license scan]`

### Build / lint / type (devDependencies, never shipped)

| Library | Version | Published | Purpose |
|---|---|---|---|
| `typescript` → `npm:@typescript/typescript6@6.0.2` | 6.0.2 (wraps typescript 6.0.3) | 2026-07-06 | TS API for typescript-eslint (D-15) **and for the in-house class gate's AST walk** |
| `@typescript/native` → `npm:typescript@7.0.2` | 7.0.2 | 2026-07-08 | `tsc --noEmit` gate (D-15) |
| @types/react / @types/react-dom | 19.3.0 | 2026-09-09 | Types |
| @types/node | 24.13.6 | 2026-09-19 | Types for config/scripts |
| vite | 8.3.3 | 2026-10-06 | Build/dev server. **Security-fix cool-down exception (D-25)** |
| @vitejs/plugin-react | 6.1.1 | 2026-08-28 | JSX + `reactCompilerPreset` (6.1.2 ages out 2026-10-19) |
| @rolldown/plugin-babel | 0.2.4 | 2026-09-07 | Babel pass for the compiler |
| @babel/core | 7.29.7 (stay on 7.x; 8.0.6 exists, not approved) | 2026-05-25 | Compiler engine |
| @types/babel__core | 7.20.5 | 2023-11-20 | Types |
| babel-plugin-react-compiler | 1.0.0 | 2025-10-07 | React Compiler |
| **tailwindcss / @tailwindcss/vite** | **4.3.3** | 2026-07-16 | **All UI styling (D-33).** Still the latest 4.x; peer `vite ^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8` `[VERIFIED: npm registry]`. `tailwindcss` also exports `compile()` / `__unstable__loadDesignSystem`, which the in-house class gate uses `[VERIFIED: local probe]` |
| eslint | 10.11.0 | 2026-09-18 | Lint (10.12.0 ages out 2026-10-16) |
| @eslint/js | 10.0.1 | 2026-02-06 | `js.configs.recommended` |
| typescript-eslint | 8.70.1 | 2026-09-21 | `strictTypeChecked` + `stylisticTypeChecked` |
| eslint-plugin-react-hooks | 7.1.1 | 2026-04-17 | Hooks + compiler rules |
| eslint-plugin-jsx-a11y-x | 0.2.0 | 2026-05-10 | `configs.strict` (D-17) |
| globals | 17.12.0 | 2026-09-01 | Browser/node globals |
| prettier | 3.9.9 | 2026-09-23 | Formatting |
| eslint-config-prettier | 10.1.8 | 2025-07-18 | Disable stylistic conflicts |

### Test (devDependencies)

| Library | Version | Published | Purpose |
|---|---|---|---|
| vitest / @vitest/coverage-v8 | 5.0.1, **or 5.0.2 when installing on or after 2026-10-09 09:00 UTC** (already approved in D-25) | 2026-09-15 / 2026-09-25 | Unit/component tests + coverage (peer must match exactly) |
| jsdom | 30.1.1 | 2026-09-22 | DOM env (Node ^24.15) |
| @testing-library/react / dom / user-event / jest-dom | 16.3.3 / 10.4.2 / 14.6.7 / 7.0.1 | 2026-08/09 | Component tests |
| axe-core | 4.13.0 (MPL-2.0, test) | 2026-08-05 | In-house axe helper (D-18); pinned via `overrides` |
| @playwright/test | 1.63.0 | 2026-09-04 | E2E **and the visual-parity suite**; browsers chromium 1243 / firefox 1543 / webkit 2359 already in `%LOCALAPPDATA%\ms-playwright` `[VERIFIED: ls 2026-10-08]` |
| @axe-core/playwright | 4.13.0 (MPL-2.0, test) | 2026-08-11 | Page-level axe |
| lighthouse | 13.5.0 | 2026-09-18 | Lighthouse gate (replaces `@lhci/cli`, D-25) |
| license-checker-rseidelsohn | 5.0.1 | 2026-05-27 | npm license gate |

### Tool package `tools/openapi-gen/` (isolated, D-16)

| Library | Version | Published | Purpose |
|---|---|---|---|
| openapi-typescript | 7.13.0 | 2026-02-11 | Generate `web/src/types/api.generated.ts` |
| typescript | 5.9.3 | 2025-09-30 | Peer of openapi-typescript (`^5.x`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| In-house variant recipes (clsx + `as const` maps, about 15 lines) | `class-variance-authority` 0.7.1 (Apache-2.0) or `tailwind-variants` 3.3.1 (MIT, peers `tailwind-merge`) | Adds a package and an approval for something 15 lines of typed code does. cva hasn't had a release since 2024-11. tailwind-variants drags in tailwind-merge. **Not recommended.** |
| Disjoint-property rule + lint (no merging) | `tailwind-merge` 3.7.0 (MIT, 107M/wk) | Resolves conflicting classes at runtime. It costs about 7–8 KB gz in the public entry `[ASSUMED]` plus a config so it knows the custom theme (the default config doesn't know `rounded-pill` or the cleared palette). **Not needed** if every recipe keeps base and variant property sets disjoint, and if `className` passthrough is limited to layout glue. **Not recommended.** |
| In-house class gate on `tailwindcss` `compile()` | `eslint-plugin-better-tailwindcss` 4.7.0 (MIT) | The plugin gives `no-unknown-classes`, `no-conflicting-classes`, ordering and `no-restricted-classes` in the editor (all verified in a probe). It is one new package with 8 deps, plus a CC0-1.0 data dep that D-26 already covers. **Optional; owner choice (R-3).** |
| No class sorting | `prettier-plugin-tailwindcss` 0.8.1 (MIT, official) | Class order is cosmetic. The plugin is official and well maintained, but it is a new dependency. **Optional; owner choice (R-4).** |
| `lighthouse` 13.5.0 + assert script | `@lhci/cli` 0.15.1 | 11 high audit findings (ruled D-25) |
| Defer MSW | MSW 3 | Ruled D-25 |
| Per-subset fontsource CSS | Weight CSS (`800.css`) | Per-subset files have no `unicode-range` (Pitfall 18) |
| `MapStaticAssets` (.NET 9+) | `UseStaticFiles` + `MapFallbackToFile` | MapStaticAssets floods the authorization matrix with build-specific endpoints `[CITED: learn.microsoft.com static-files]` |
| Committed screenshot baselines | Same-run A/B (reference vs implementation) | Baselines differ between Windows and ubuntu font rasterization; A/B in the same browser and run needs no baseline (see §Proving the Look) |

### Installation (after owner confirmation of the refresh items)

`web/.npmrc` (committed). `min-release-age` was verified on npm 11.19.0 to reject too-new versions across the whole tree. `[VERIFIED: local npm 11.19.0, 2026-10-07 and 2026-10-08]`

```ini
save-exact=true
engine-strict=true
min-release-age=14
# Owner waiver D-11 (2026-10-07): lucide-react follows the newest stable release.
min-release-age-exclude[]=lucide-react
# Security fix GHSA-rq7h-c2jc-7f22 / GHSA-vfpm-58rq-9qcg / GHSA-9jrq-w75r-8gcw (vite 8.3.3), owner-approved D-25.
min-release-age-exclude[]=vite
# Security fix GHSA-68fv-2mgg-jv7q (high), owner-approved 2026-10-07: source-map-js 1.2.2 (ages out 2026-10-14T14:08Z).
min-release-age-exclude[]=source-map-js
# Security fix GHSA-ch52-4w7c-c8xp (high), owner-approved 2026-10-07: http-cache-semantics 4.3.0 (ages out 2026-10-18T02:56Z).
min-release-age-exclude[]=http-cache-semantics
# rolldown: NO exclusion needed when installing after 2026-10-08T14:30:23Z (1.2.11 is then 14 days old).
```

```bash
cd web
npm i react@19.3.0 react-dom@19.3.0 react-router@8.4.0 @tanstack/react-query@5.103.2 nuqs@2.10.1 clsx@2.1.1 \
  lucide-react@1.52.0 @fontsource/barlow-condensed@5.3.0 @fontsource-variable/archivo@5.3.0
npm i -D "typescript@npm:@typescript/typescript6@6.0.2" "@typescript/native@npm:typescript@7.0.2" \
  @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@24.13.6 \
  vite@8.3.3 @vitejs/plugin-react@6.1.1 @rolldown/plugin-babel@0.2.4 @babel/core@7.29.7 @types/babel__core@7.20.5 \
  babel-plugin-react-compiler@1.0.0 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 \
  eslint@10.11.0 @eslint/js@10.0.1 typescript-eslint@8.70.1 eslint-plugin-react-hooks@7.1.1 eslint-plugin-jsx-a11y-x@0.2.0 \
  globals@17.12.0 prettier@3.9.9 eslint-config-prettier@10.1.8 \
  vitest@5.0.2 @vitest/coverage-v8@5.0.2 jsdom@30.1.1 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 axe-core@4.13.0 \
  @playwright/test@1.63.0 @axe-core/playwright@4.13.0 lighthouse@13.5.0 license-checker-rseidelsohn@5.0.1
# package.json: "overrides": { "axe-core": "4.13.0", "source-map-js": "1.2.2", "http-cache-semantics": "4.3.0" },
#               "engines": { "node": ">=24.15 <25", "npm": ">=11.19" }
# vitest 5.0.1 instead of 5.0.2 if installing before 2026-10-09T09:00:46Z.
```

## Packages Requiring Owner Approval

### A. The approved D-25 table (owner-approved 2026-10-07; unchanged, re-verified 2026-10-08)

**This table is the owner-approved D-25 contract.** It is reproduced unchanged, so the planner and executors can cite it. "Advisories" means the npm bulk-advisory endpoint **and** the GitHub repo-level security-advisory API, both checked on 2026-10-07. The bulk endpoint was checked again on 2026-10-08 and found nothing new.

| # | Package | Exact version | Published | License (plain words) | Purpose | Advisories / issues found | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | react, react-dom | 19.3.0 | 2026-09-09 | MIT (free) | UI runtime | Repo advisories exist only for `react-server-dom-*` (RSC), not used | Approve |
| 2 | react-router | 8.4.0 | 2026-09-15 | MIT | Routing | GHSA-qwww-vcr4-c8h2 fixed in 8.3.0 (RSC mode, not used); 8.4.0 unaffected | Approve |
| 3 | @tanstack/react-query | 5.103.2 | 2026-09-21 | MIT | Server state | None | Approve |
| 4 | nuqs | 2.10.1 | 2026-08-25 | MIT | URL state | None; already owner-approved | Approved (2026-10-07) |
| 5 | clsx | 2.1.1 | 2024-04-23 | MIT | Classes | None | Approve |
| 6 | lucide-react | 1.52.0 | 2026-10-04 | ISC (free, like MIT) | Icons | None; **cool-down waived (D-11)**; 20/56 drawings differ from 0.460 (D-12 review) | Approve with D-12 review |
| 7 | @fontsource/barlow-condensed, @fontsource-variable/archivo | 5.3.0 | 2026-07-19 | OFL-1.1 (free font license, approved D-18) | Fonts | None; **Barlow has no ₱ glyph** (Pitfall 17) | Approve |
| 8 | typescript (alias → @typescript/typescript6) | 6.0.2 (+ transitive typescript 6.0.3) | 2026-07-06 | Apache-2.0 | TS API for lint | None | Approve |
| 9 | @typescript/native (alias → typescript) | 7.0.2 | 2026-07-08 | Apache-2.0 | Type check | None | Approve |
| 10 | @types/react, @types/react-dom | 19.3.0 | 2026-09-09 | MIT | Types | None | Approve |
| 11 | @types/node | 24.13.6 | 2026-09-19 | MIT | Types | None | Approve |
| 12 | vite | 8.3.3 | **2026-10-06** | MIT | Build | **3 advisories on 8.3.0–8.3.2 fixed here** → cool-down "accepted: security fix" | Approve as security exception |
| 13 | @vitejs/plugin-react | 6.1.1 | 2026-08-28 | MIT | JSX/compiler preset | Repo advisories are for `@vitejs/plugin-rsc` only | Approve |
| 14 | @rolldown/plugin-babel | 0.2.4 | 2026-09-07 | MIT | Compiler bridge | None; pre-1.0 (official path) | Approve |
| 15 | @babel/core | 7.29.7 | 2026-05-25 | MIT | Compiler engine | GHSA-4x5r-pxfx-6jf8 fixed in 7.29.6 → 7.29.7 clean | Approve |
| 16 | @types/babel__core | 7.20.5 | 2023-11-20 | MIT | Types | None | Approve |
| 17 | babel-plugin-react-compiler | 1.0.0 | 2025-10-07 | MIT | React Compiler | None | Approve |
| 18 | tailwindcss, @tailwindcss/vite | 4.3.3 | 2026-07-16 | MIT | CSS | None | Approve |
| 19 | eslint | 10.11.0 | 2026-09-18 | MIT | Lint | None | Approve |
| 20 | @eslint/js | 10.0.1 | 2026-02-06 | MIT | Lint config | None | Approve |
| 21 | typescript-eslint | 8.70.1 | 2026-09-21 | MIT | Typed lint | None | Approve |
| 22 | eslint-plugin-react-hooks | 7.1.1 | 2026-04-17 | MIT | Hooks/compiler lint | None | Approve |
| 23 | eslint-plugin-jsx-a11y-x | 0.2.0 | 2026-05-10 | MIT | a11y lint (D-17) | None; low downloads (159k/wk) but maintained e18e fork | Approve |
| 24 | globals | 17.12.0 | 2026-09-01 | MIT | Lint globals | None | Approve |
| 25 | prettier | 3.9.9 | 2026-09-23 | MIT | Format | None | Approve |
| 26 | eslint-config-prettier | 10.1.8 | 2025-07-18 | MIT | Lint/format bridge | None | Approve |
| 27 | vitest, @vitest/coverage-v8 | 5.0.1 (or 5.0.2 ≥ 2026-10-09) | 2026-09-15 | MIT | Tests/coverage | Repo advisories affect `@vitest/browser`/mocker pre-releases, not 5.0.x node mode | Approve |
| 28 | jsdom | 30.1.1 | 2026-09-22 | MIT | Test DOM | None | Approve |
| 29 | @testing-library/react / dom / user-event / jest-dom | 16.3.3 / 10.4.2 / 14.6.7 / 7.0.1 | 2026-08-27 / 09-13 / 09-02 / 08-09 | MIT | Component tests | None | Approve |
| 30 | axe-core | 4.13.0 | 2026-08-05 | MPL-2.0 (free; test-only exception D-18) | a11y engine | None | Approve |
| 31 | @playwright/test | 1.63.0 | 2026-09-04 | Apache-2.0 | E2E | None; 1.64.0 released today (too new) | Approve |
| 32 | @axe-core/playwright | 4.13.0 | 2026-08-11 | MPL-2.0 (test) | Page axe | None | Approve |
| 33 | lighthouse | 13.5.0 | 2026-09-18 | Apache-2.0 | Lighthouse gate | `npm audit`: 0 vulnerabilities; brings `@sentry/node` (opt-in error reporting; run with `--no-enable-error-reporting`) | **Owner decision: replaces `@lhci/cli`** |
| 34 | license-checker-rseidelsohn | 5.0.1 | 2026-05-27 | BSD-3-Clause | npm license gate | None | Approve |
| 35 | openapi-typescript (tools/openapi-gen) | 7.13.0 | 2026-02-11 | MIT | DTO generation (D-16) | None | Approve |
| 36 | typescript (tools/openapi-gen) | 5.9.3 | 2025-09-30 | Apache-2.0 | openapi-typescript peer | None | Approve |
| 37 | @tanstack/eslint-plugin-query *(optional)* | 5.103.2 | 2026-09-21 | MIT | Query lint | None | Optional |
| 38 | rollup-plugin-visualizer *(optional)* | 7.1.1 | 2026-08-14 | MIT | Bundle treemap | None | Optional |
| — | @lhci/cli | 0.15.1 | 2025-06-25 | Apache-2.0 | (named in CLAUDE.md) | **11 high + 4 moderate + 2 low** transitive audit findings; bundles stale lighthouse 12.6.1 | **Not recommended** |
| — | msw | 3.0.x | 2026-09-28+ | MIT | Component mocks | Whole v3 line inside cool-down | **Defer** to Phase 4+ |

D-25 outcome: rows 1–36 approved (lighthouse replacing `@lhci/cli`); rows 37–38 not adopted; MSW deferred. Owner-approved transitive security exceptions (2026-10-07, "now-plus-rolldown" decision recorded in superseded 02-01): **source-map-js 1.2.2** (GHSA-68fv-2mgg-jv7q, high) and **http-cache-semantics 4.3.0** (GHSA-ch52-4w7c-c8xp, high), pinned via `overrides`; **rolldown 1.2.11 + bindings** (11.5 h short of 14 days on 2026-10-07).

**Transitive licenses outside the allow-list (dev/build tree only; owner-approved D-26 + addendum):** MPL-2.0 build (`lightningcss`), MPL-2.0 test (axe-core), CC-BY-4.0 (`caniuse-lite`), CC0-1.0 (`language-subtag-registry`, and **`mdn-data` if the optional ESLint plugin is adopted**), BlueOak-1.0.0 (`minimatch`), 0BSD (`tslib`), MIT-0 (`@csstools/*` via jsdom), CC-BY-3.0 (`spdx-exceptions`, `spdx-ranges`), Python-2.0 (`argparse`, tools/openapi-gen). **The revert removed these entries from `docs/license-exceptions.json`**: today it holds only the two Microsoft SqlClient entries `[VERIFIED: docs/license-exceptions.json read 2026-10-08]`. The replan must re-create the npm section from the D-26 rulings (L-08).

### B. Refresh items for owner confirmation (new on 2026-10-08)

| # | Item | Facts | Recommendation | Needs |
|---|---|---|---|---|
| **R-1** | **lucide-react 1.53.0** (published 2026-10-08 06:15 UTC) vs the approved **1.52.0** | D-11 says "newest stable at install time". D-25 pins 1.52.0 exactly and says stop if a different version would resolve. **All 56 spec icons are byte-identical between 1.52.0 and 1.53.0** (only the license banner differs). `Icon.mjs`, `createLucideIcon.mjs` and `defaultAttributes.mjs` are identical too. 1.53.0 only adds `groceries`, `hiking-stick`, `scratch-blocks`. No advisories for either version. ISC. `[VERIFIED: npm pack + diff of dist/esm/icons/*.mjs, 2026-10-08; npm bulk advisory endpoint]` | **Install 1.52.0** (D-25 exact pin; the D-32 review was done on 1.52.0). Moving to 1.53.0 would be visually identical, so either answer is safe. | Owner: "keep 1.52.0" or "take 1.53.0 under D-11" |
| **R-2** | **rolldown exception no longer needed** | 1.2.11 was published 2026-09-24T14:30:23Z, so it is 14 days old from **2026-10-08T14:30Z**. vite 8.3.3 depends on `rolldown ~1.2.11`. With `min-release-age=14`, npm then picks 1.2.11 by itself until 1.2.12 ages out on 2026-10-14T14:43Z. `[VERIFIED: npm registry times]` | Drop the 16 `min-release-age-exclude[]` rolldown lines and the 16 `overrides`. That removes an exception rather than adding one, and the lockfile pins whatever resolves. If installing before 14:30Z today, the approved exception still applies. | Inform owner (no new approval) |
| **R-3** | *(optional new package)* **eslint-plugin-better-tailwindcss 4.7.0** | MIT, published 2026-07-19 (81 d; 4.9.0 is latest at 2.6 d, too new). 1.5M/wk downloads. Repo github.com/schoero/eslint-plugin-better-tailwindcss. Peers `eslint ^7–^10`, `tailwindcss ^3.3 \|\| ^4.1.17` (oxlint optional). 8 deps: jiti, synckit, valibot, @valibot/to-json-schema, @eslint/css-tree (→ mdn-data **CC0-1.0**, source-map-js), enhanced-resolve, tailwind-csstree (Apache-2.0), tsconfig-paths-webpack-plugin (→ chalk 4, tsconfig-paths, json5, minimist). No install scripts. Bulk advisories: none for its own tree, but **it pulls source-map-js 1.2.1 (GHSA-68fv-2mgg-jv7q) unless the approved 1.2.2 override applies**, and it does. Legitimacy seam: SUS (too-new latest only). **Probe:** with the cleared theme it flags `shadow-lg`, `text-gray-600` (unknown), `p-4 p-2` (conflict), `bg-[#ff6600]` (restricted pattern) and wrong order. It does **not** lint strings in arbitrary variables (such as a `tone` map) unless they are configured by name. `[VERIFIED: npm registry; local probe with eslint 10.11.0 + tailwindcss 4.3.3]` | **Optional; not required.** The in-house gate (§Where Class Strings Live) covers unknown classes with no new package. Adopt this only if the owner wants editor-time feedback. | Owner: approve or decline |
| **R-4** | *(optional new package)* **prettier-plugin-tailwindcss 0.8.1** | MIT, 2026-07-15 (85 d), 11.6M/wk, official Tailwind Labs repo, 0 deps, peer `prettier ^3.0`. Legitimacy seam: OK. No advisories. `[VERIFIED: npm registry; gsd legitimacy seam]` | **Not recommended.** Class order is cosmetic. If R-3 is adopted, its `enforce-consistent-class-order` (auto-fixable) covers it with no second package. | Owner: decline unless they want sorted classes |
| **R-5** | *(not recommended)* tailwind-merge 3.7.0 (MIT), class-variance-authority 0.7.1 (Apache-2.0), tailwind-variants 3.3.1 (MIT) | All legitimate (seam OK or SUS for age only), no advisories. `[VERIFIED: npm registry; bulk advisories; legitimacy seam]` | **Do not adopt.** The no-package recipe pattern is enough (see §Where Class Strings Live). | Nothing unless the owner asks |
| **R-6** | **D-BL-04 (still open):** publish third-party credits? | `build.license: true` writes `.vite/license.md` into `wwwroot`. The server fix (HiddenSegmentFileProvider) hides it either way. `web/THIRD-PARTY-NOTICES.txt` (generated, drift-checked) was more complete than Vite's file (16 vs 5 packages). `[VERIFIED: .planning/phases/999.1…/DECISIONS.md; debug/wwwroot-vite-license-served.md]` | Ask the owner at plan time. **Option A, recommended in backlog:** `build.license: false` plus the committed notices published as a deliberate public file or a credits page. The plan should not decide it. | Owner ruling |
| **R-7** | vitest **5.0.2** | Already approved by D-25 ("5.0.2 ≥ 2026-10-09"). Becomes 14 days old on 2026-10-09T09:00:46Z. It fixes "`Request` with `Blob` body on jsdom 28+". `[VERIFIED: npm registry]` | Install 5.0.2 if on or after that time | None (inform) |

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check --ecosystem npm` ran on 2026-10-07 on all 43 D-25 candidate names, and on 2026-10-08 on the six D-33 candidates and lucide-react. It checks only the **latest** version. `[VERIFIED: gsd legitimacy seam]`

| Package | Registry | Age (recommended version) | Downloads/wk | Source repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| react / react-dom | npm | 29 d | 224M / 212M | github.com/react/react | SUS (too-new latest) | Approved (D-25) |
| react-router | npm | 23 d | 69M | github.com/remix-run/react-router | SUS (too-new latest) | Approved (D-25) |
| @tanstack/react-query | npm | 17 d (5.103.2) | 83M | github.com/TanStack/query | SUS (too-new latest) | Approved (D-25) |
| nuqs | npm | 44 d | 6.2M | github.com/47ng/nuqs | OK | Approved (owner) |
| lucide-react | npm | 4 d (1.52.0); latest 1.53.0 is 0.2 d | 135M | github.com/lucide-icons/lucide | SUS (too-new) | Owner waiver D-11; R-1 |
| vite | npm | 2 d | 232M | github.com/vitejs/vite | SUS (too-new) | Security exception (D-25) |
| tailwindcss / @tailwindcss/vite | npm | 84 d | very high | github.com/tailwindlabs/tailwindcss | OK | Approved (D-25) |
| eslint-plugin-jsx-a11y-x | npm | 151 d | 159k | github.com/es-tooling/eslint-plugin-jsx-a11y-x | OK | Approved (D-25) |
| lighthouse | npm | 20 d | 6.1M | github.com/GoogleChrome/lighthouse | SUS (too-new latest) | Approved (D-25) |
| prettier-plugin-tailwindcss | npm | 85 d (0.8.1) | 11.6M | github.com/tailwindlabs/prettier-plugin-tailwindcss | OK | Optional (R-4), not recommended |
| eslint-plugin-better-tailwindcss | npm | 81 d (4.7.0); latest 4.9.0 is 2.6 d | 1.5M | github.com/schoero/eslint-plugin-better-tailwindcss | SUS (too-new latest only) | Optional (R-3); if adopted, `checkpoint:human-verify` before install |
| tailwind-merge | npm | 26 d | 107M | github.com/dcastil/tailwind-merge | SUS (too-new latest only) | Not adopted (R-5) |
| class-variance-authority | npm | 681 d | 84M | github.com/joe-bell/cva | OK | Not adopted (R-5) |
| tailwind-variants | npm | 66 d | 5.1M | github.com/heroui-inc/tailwind-variants | OK | Not adopted (R-5) |
| *(all other D-25 rows)* | npm | ≥ 14 d | ≥ 0.4M | official repos | OK / SUS-too-new | Approved (D-25) |

**Postinstall scripts:** none on any recommended exact version. The superseded 600-package lockfile had no `hasInstallScript` entry. `[VERIFIED: registry metadata; git show 74621f5:web/package-lock.json]` Note: npm 11.19 warns on install scripts not covered by `allowScripts`. The probe saw this only for `@parcel/watcher` (via `@tailwindcss/cli`, which the project does **not** use; `@tailwindcss/vite` doesn't depend on it). `[VERIFIED: local probe]`
**Packages removed ([SLOP]):** none.
**Packages flagged [SUS] for a reason other than age:** none.

## Tailwind v4 Conversion Design (D-33)

### What MUST remain in CSS ("strictly Tailwind for UI styles")

One stylesheet entry, `web/src/styles/app.css`. It may also `@import` a `base.css` into `layer(base)`. Only these constructs are allowed, and a node-environment Vitest **stylesheet-contract test** parses both files and fails on anything else:

| Construct | Why it must be CSS | Example |
|---|---|---|
| `@import "tailwindcss" source("../src");` + `@source not …` | Tailwind entry and scan scope | see skeleton |
| `@custom-variant …` | The exact spec queries/states (below) | `@custom-variant pg-phone (@container pg (max-width: 767px));` |
| `@theme { --*: initial; … }` and `@theme inline { … }` | Token theme (rule 1: CSPS tokens only) | colors → `var(--surface)` |
| `@keyframes` (inside `@theme`) | Animations | `csp-spin`, `csp-fade`, `csp-rise`, `csp-slide`, `csp-shimmer` |
| `@layer base` **token custom properties** per theme: `:root, [data-theme="light"] {…}`, `[data-theme="dark"] {…}`, `:root {layout tokens}` | **The theme switch**: tokens change by `data-theme`; `@theme inline` utilities read them live | App. A blocks verbatim (minus the type classes) |
| `@layer base` **`@font-face`** for the PERF-05 metric fallbacks, and the font-stack tokens | Fonts (fontsource supplies the brand `@font-face` via package CSS) | `'Archivo Fallback'`, `'Barlow Condensed Fallback'` with `unicode-range: U+0000-20B0, U+20B2-10FFFF` |
| `@layer base` global element rules: `body {…}`, `:focus-visible {…}`, the reduced-motion `* { transition-duration: 0s !important }`, `main[tabindex="-1"]:focus { outline: none }` | Element defaults that no single component owns | App. B lines 1–8 |
| Nothing else | — | **No class selector** (`.x {}`), no `@utility`, no `@apply`, no `overrides.css`/`spec-gaps.css` |

The App. A type classes (`.display-hero`, `.body-sm`, …) are **retired**. App. D/E markup never uses them; a grep over App. D.3–E found 0 uses of the `display-*`, `body-lg`, `body-sm`, `stat`, `button` and `caption` classes. `[VERIFIED: grep CSPS-UI-SPEC.md lines 3058–6229]` App. A.3's two compat restores become utilities on their elements (`my-[1em]` on the two `<dl>`s, `px-[2px] py-px` on the two search inputs).

### Token theme skeleton (verified to compile with tailwindcss 4.3.3)

```css
/* web/src/styles/app.css — the only stylesheet entry (D-33). */
@import "tailwindcss" source("../src");   /* scan src only (verified: tests, src/test and e2e excluded below) */
@source not "../src/**/*.test.{ts,tsx}";
@source not "../src/test";
@import "./base.css" layer(base);        /* tokens per theme, fallback @font-face, body, focus, reduced motion */

/* Exact spec queries (App. B/C). Never the built-in @max-*/max-* forms (Pitfall 22). */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));   /* App. A.2, verbatim */
@custom-variant hover (&:hover);          /* spec :hover applies on every device (Pitfall 21) */
@custom-variant pg-phone  (@container pg (max-width: 767px));
@custom-variant pg-tablet (@container pg (min-width: 768px) and (max-width: 1023px));
@custom-variant pg-md-up  (@container pg (min-width: 768px));
@custom-variant pg-lt-lg  (@container pg (max-width: 1023px));
@custom-variant pg-lt-xl  (@container pg (max-width: 1279px));
@custom-variant pg-xs     (@container pg (max-width: 420px));
@custom-variant vp-lt-sm  (@media (max-width: 639px));
@custom-variant vp-lt-md  (@media (max-width: 767px));
@custom-variant vp-xs     (@media (max-width: 420px));
@custom-variant no-hover  (@media (hover: none));
/* min-width media queries use the built-ins sm/md/lg (verified exact: width >= 640/768/1024px). */

@theme {
  --*: initial;                           /* no Tailwind defaults of any kind (rule 1) */
  --spacing: 4px;                         /* CSPS 4px step; px like the spec, so p-4 = 16px exactly */
  --breakpoint-sm: 640px; --breakpoint-md: 768px; --breakpoint-lg: 1024px; --breakpoint-xl: 1280px;
  --font-weight-normal: 400; --font-weight-medium: 500; --font-weight-semibold: 600;
  --font-weight-button: 650; --font-weight-bold: 700; --font-weight-heavy: 800;   /* the spec's weights (§3.3) */
  --radius-xs: 4px; --radius-sm: 8px; --radius-md: 12px; --radius-lg: 18px; --radius-pill: 999px;
  --animate-csp-spin: csp-spin .8s linear infinite;
  --animate-csp-fade: csp-fade .15s ease;
  --animate-csp-rise: csp-rise .2s ease;
  --animate-csp-slide: csp-slide .2s ease;
  --animate-csp-shimmer: csp-shimmer 1.4s ease-in-out infinite;
  @keyframes csp-spin { to { transform: rotate(360deg); } }
  @keyframes csp-fade { from { opacity: 0; } }
  @keyframes csp-rise { from { opacity: 0; transform: translateY(8px) scale(.98); } }
  @keyframes csp-slide { from { transform: translateX(24px); opacity: 0; } }
  @keyframes csp-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
}
@theme inline {                           /* utilities read the live token, so they switch with data-theme */
  --color-bg: var(--bg); --color-surface: var(--surface); /* … every App. A.2 colour, same names … */
  --color-transparent: transparent; --color-current: currentColor;
  --font-display: var(--font-display);    /* reads the token incl. PERF-05 fallbacks (fixes superseded deferred item) */
  --font-sans: var(--font-sans);
  --shadow-level-1: var(--shadow-1); --shadow-level-2: var(--shadow-2); --shadow-level-3: var(--shadow-3);
}
```

Facts behind the skeleton (all `[VERIFIED: local probe, tailwindcss 4.3.3 CLI output]`):
- `--*: initial` makes `bg-blue-500`, `rounded-xl`, `shadow-lg`, `text-gray-600`, `text-sm`, `font-bold` and `max-w-md` produce **no CSS at all, silently**. No error and no warning: a default-palette class "does not compile" by emitting nothing (Pitfall 23).
- The theme layer then emits only the declared non-inline variables (`--spacing`, weights, animations). `@theme inline` variables are not emitted and are referenced directly (`.bg-surface { background-color: var(--surface) }`, `.font-sans { font-family: var(--font-sans) }`).
- `@keyframes` inside `@theme` are emitted only when an `animate-*` utility using them appears.
- `@import "tailwindcss" source("../src")` with `@source not "../src/**/*.test.tsx"` and `@source not "../src/test"` generated utilities from `src/ui/Button.tsx` only. Strings in `*.test.tsx`, `src/test/` and `e2e/` were not scanned.
- The custom variants emit the exact query text (`@container pg (max-width: 767px)`, `@media (hover: none)`, `@media (max-width: 420px)`). `motion-reduce:` emits exactly `@media (prefers-reduced-motion: reduce)`.
- The named weights resolve through the theme (`.font-button { font-weight: var(--font-weight-button) }`, likewise `font-heavy` and `font-bold`). `bg-size-[200%_100%]`, `h-(--sk-h)` and `h-13` (52px) compile. A container variant composes with a context variant: `pg-phone:in-data-[ui=s-toolbar]:text-[16px]` → `@container pg (max-width: 767px) { :where([data-ui="s-toolbar"]) .… { font-size: 16px } }`.

### Rule category → Tailwind construct (with examples from components.css / screens.css)

| # | Spec rule category | Spec example | Tailwind construct | Verified? |
|---|---|---|---|---|
| 1 | Token property | `.csp-control { background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: var(--radius-sm) }` | `bg-surface-2 border border-line-strong rounded-sm` | ✓ A/B pixel-equal (field) |
| 2 | Spacing token | `gap: var(--space-2); padding: 0 var(--space-5); height: 44px` | `gap-2 px-5 h-11` (spacing 4px) | ✓ A/B (button) |
| 3 | Spec literal, not a token | `font-size: 15px; font-weight: 650; letter-spacing: .01em; min-height: 480px` | `text-[15px] font-button tracking-[.01em] min-h-[480px]` (literals copied verbatim; never "nearest" scale values) | ✓ A/B |
| 4 | Non-theme token variable | `width: var(--sidebar-width); z-index: var(--z-header); top: var(--header-height)` | `w-(--sidebar-width) z-(--z-header) top-(--header-height)` (v4 var shorthand) | ✓ compile + A/B (nav) |
| 5 | calc with tokens | `padding: calc(var(--space-16) + var(--cut-angle)) var(--space-4)` | `py-[calc(var(--space-16)+var(--cut-angle))] px-4` | compile ✓ |
| 6 | Property with no utility | `clip-path: polygon(…)`, `-webkit-text-stroke`, `counter-reset`, `scrollbar-width`, `mask`, `filter: drop-shadow(…)` | arbitrary property `[clip-path:polygon(0_var(--cut-angle),100%_0,100%_100%,0_100%)]`, `[scrollbar-width:none]` | ✓ compile; ✓ A/B (`[scrollbar-width:none]` in tabs) |
| 7 | Exact (multi-layer) shadow | `.csp-seg-btn.is-on { box-shadow: var(--shadow-1), inset 0 0 0 1px var(--line) }`; `.csp-btn-primary:hover { box-shadow: 0 6px 20px -10px var(--primary) }` | arbitrary **property** `[box-shadow:0_6px_20px_-10px_var(--primary)]`, not `shadow-[…]` (which wraps in the `--tw-*-shadow` stack) | ✓ A/B pixel-equal (primary hover) |
| 8 | Order-sensitive transform | `.csp-cat:hover .csp-media-ph-num { transform: scale(1.04) translateY(-52%) }` | `[transform:scale(1.04)_translateY(-52%)]` or `transform-[…]`. **Never** `scale-[1.04] -translate-y-[52%]`: v4 uses the individual `scale`/`translate` properties, which apply in a fixed order, so the visual result differs (Pitfall 25) | ✓ compile (individual properties confirmed) |
| 9 | Single transform | `.csp-btn:active:not(:disabled) { transform: translateY(1px) }`; `.csp-empty-icon { transform: rotate(-6deg) }` | `active:not-disabled:[transform:translateY(1px)]` (matches spec computed `transform`), or `translate-y-px` (same pixels, different computed property; avoid it so the comparator stays exact) | ✓ A/B (button) |
| 10 | `color-mix` | `.csp-site-header { background: color-mix(in srgb, var(--bg) 82%, transparent) }` | `bg-[color-mix(in_srgb,var(--bg)_82%,transparent)]`. **Not** `bg-bg/82`, which emits `color-mix(in oklab, …)` | ✓ compile (oklab vs srgb confirmed) |
| 11 | Gradients | `.csp-stitch`, `.csp-mesh`, `.csp-skel` | `bg-[image:repeating-linear-gradient(90deg,var(--line-strong)_0_8px,transparent_8px_14px)]` (with the `image:` type hint) | ✓ compile |
| 12 | Hover (any device) | `.csp-btn-primary:hover:not(:disabled)` | `hover:not-disabled:bg-primary-hover` plus the `hover` override → `:not(:disabled):hover` | ✓ A/B in 3 engines |
| 13 | Disabled vs enabled | `:not(:disabled)` on `.csp-btn` (also used by `<a class="csp-btn">` ButtonLink) | `not-disabled:` (`:not(:disabled)`). **Never** `enabled:` (`:enabled` doesn't match `<a>`, so ButtonLink hover would vanish) | ✓ compile |
| 14 | Focus | `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }` (global); `.csp-control:focus-within {…}` | base layer rule (global); `focus-within:border-focus focus-within:[box-shadow:0_0_0_1px_var(--focus)]` | ✓ A/B (field) |
| 15 | `::before`/`::after`, `content: ""` | `.csp-tab.is-on::after { content:""; position:absolute; left: var(--space-3); right: var(--space-3); bottom: -1px; height: 3px; … }` | `after:absolute after:left-3 after:right-3 after:-bottom-px after:h-[3px] after:rounded-[3px_3px_0_0] after:bg-accent-line` (`content: var(--tw-content)` defaults to `""`) | ✓ A/B pixel-equal (tab) |
| 16 | `content: attr()` / quotes | `.s-rt td::before { content: attr(data-label) }`; `.csp-testi-quote::before { content: "“" }` | `pg-phone:before:content-[attr(data-label)]`; `before:content-['“']` | ✓ compile + A/B (rt) |
| 17 | `::placeholder` | `.csp-input::placeholder { color: var(--ink-muted); opacity: .8 }` | `placeholder:text-ink-muted` (and **no** `placeholder:opacity-80`: FYI-01 / D-02 resets it to 1) | ✓ A/B (spec value); ruling per D-02 |
| 18 | Element-state classes `.is-on`, `.is-invalid`, `.is-collapsed`, `.is-over`, `.tone-*` | `.csp-nav.is-on {…}`, `.csp-tab.is-on {…}` | Prefer the **ARIA/data attribute that already states it**: `aria-[current=page]:bg-primary`, `aria-selected:text-ink`, `data-[over=true]:…`. Otherwise a TSX conditional map (`clsx(on ? onCls : offCls)`) | ✓ compile |
| 19 | Parent-state → child | `.csp-tab.is-on .csp-tab-count {…}`; **D-BL-02** `.csp-nav.is-on .csp-nav-tag { display: none }`; `.csp-strength.is-2 .on {…}` | Named group on the parent and a group variant on the child: `group/nav` + `group-aria-[current=page]/nav:hidden`; strength → map in TSX | ✓ compile (`:is(:where(.group\/nav)[aria-current="page"] *)`) |
| 20 | Parent-hover/focus → child | `.csp-thumb:hover .csp-thumb-actions, .csp-thumb:focus-within .csp-thumb-actions { opacity: 1 }` (+ D-05) | `group/thumb` + `opacity-0 group-hover/thumb:opacity-100 group-focus-within/thumb:opacity-100 no-hover:opacity-100` | ✓ compile |
| 21 | **Context (component inside region)** | `.s-toolbar .csp-input { height: 40px; font-size: 14px }`; `.s-item .csp-input`; `.csp-sidebar .csp-iconbtn { color: var(--nav-ink) }`; `.s-tile .csp-media-ph-label { display: none }`; `.s-admin-side .csp-nav` (tablet rail) | **(a)** an explicit prop when the parent component renders the child itself (`<Sidebar>` renders its icon button with `tone="nav"`; `<MediaPlaceholder label={false}>`); **(b)** a `data-ui` context marker on the region plus `in-data-[ui=toolbar]:h-10` on the child. That reproduces the descendant combinator exactly (any depth, `:where()` adds no specificity) | ✓ compile (`:where([data-ui="toolbar"]) .x`) |
| 22 | Structural pseudo-classes | `.s-item > :nth-child(1) { grid-column: span 3 }`; `.s-gallery > button:first-child`; `.csp-table tbody tr:last-child td { border-bottom: 0 }` | Put utilities on the children (`nth-1:col-span-3`, `first:row-span-2`), or `group/row` + `group-last/row:border-b-0` on cells | ✓ compile |
| 23 | Container queries `@container pg (…)` | every screens.css breakpoint block | `@container/pg` on the `.s-page` element (emits `container-type: inline-size; container-name: pg`) + the `pg-*` custom variants | ✓ A/B (rt phone card) |
| 24 | Media queries | `@media (min-width: 768px)`, `(max-width: 639px)`, `(max-width: 420px)`, `(hover: none)` | `md:` (exact); `vp-lt-sm:`, `vp-xs:`, `no-hover:` (custom, exact text) | ✓ compile |
| 25 | Reduced motion | `@media (prefers-reduced-motion: reduce) { .csp-spin { animation-duration: 2.4s } * { transition-duration: 0s !important } }`; O-6 | `motion-reduce:[animation-duration:2.4s]` on the spinner (`duration-*` is **transition** duration; don't use it); the `*` rule stays in the base layer; O-6: `motion-reduce:animate-none` on skeleton/modal/toast | ✓ compile |
| 26 | Keyframes/animation | `.csp-modal { animation: csp-rise .2s ease }`; `.csp-modal-slideover { animation-name: csp-slide }`; `.s-overlay > .csp-modal { animation: none }` | `animate-csp-rise`; slide-over `animate-csp-slide`; inside `.s-overlay` → `animate-none` via the overlay context marker | ✓ compile |
| 27 | Transition shorthand | `transition: background-color .15s ease, border-color .15s ease, …` | `transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[ease]`. **Always set duration and easing**: with `--*: initial`, a bare `transition` has `var(--tw-duration, 0s)` | ✓ A/B (computed equal after list normalization) |
| 28 | `font: inherit` | `.csp-btn { font: inherit; font-size: 15px; … }` | **Drop it.** Preflight already sets `font: inherit` on `button, input, select, textarea`; `<a>` inherits naturally. Never `[font:inherit]` (Pitfall 24) | ✓ A/B: with `[font:inherit]` the button rendered 16px/400/24px instead of 15px/650/20px; without it, pixel-equal |
| 29 | `border: 0` / one-side borders | `.csp-iconbtn { border: 0 }`; `.csp-tabs { border-bottom: 1px solid var(--line) }` | `border-0`; `border-b border-line`. The computed `border-*-style`/`-color` of zero-width sides differ from the spec but are invisible, and the comparator ignores them (§Proving) | ✓ A/B pixel-equal |
| 30 | `!important` (24 in C, 2 in B) | `.s-link { color: var(--accent-ink) !important }`; `.csp-site-nav { display: inline-flex !important }` inside containers | Mostly unnecessary: they beat `a { color: inherit }` and the B media/C container duplication, which utilities on one element don't have. Where a real cascade fight remains, use the v4 suffix `text-ink!` | ✓ compile (`color: var(--ink) !important`) |
| 31 | Theme-only component tokens | `[data-theme="dark"] .csp-mark { --csp-mark-ring: #1a100f; --csp-mark-stitch: #ff6a1a }` | Move them into the `[data-theme="dark"]` token block in `base.css` (they inherit into the Mark SVG; same computed value). The light value is the SVG's own `var(--csp-mark-ring, #572e2b)` fallback | reasoning; covered by A/B (mark case) |
| 32 | Hex literals in App. C (lightbox `#1a100f`/`#f6dfd1`/`#8f6c62`/`#241614`, `.s-a-dark:hover #000`, hero `rgba(0,0,0,.55)`) | screens.css lines 58, 67, 150–159, 308 | Not used in Phase 2 (the lightbox, hero and CTA are public-site phase). When they are: name each one as a theme token with the same value (`--color-lightbox-ink: #f6dfd1`), so class strings never carry hex (lint ban) | `[VERIFIED: grep of App. B/C hex literals]` |
| 33 | Print | none in App. A–C | `print:` exists if ever needed; no Phase 2 work | ✓ compile (`@media print`) |
| 34 | Global/scoped resets | `.s-page *, ::before, ::after { box-sizing }`; `:where(.s-page) a { color: inherit }`; `.s-page h1…p { margin: 0 }` | Already Tailwind preflight (`*, ::after, ::before { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid }`, `a { color: inherit }`) → nothing to write | ✓ preflight output read |

### Specificity and cascade fidelity (the approved look includes cascade accidents)

- **Spec cascade accidents are part of "today's rendering".** In App. C the phone rule `.s-rt td.is-lead { border-bottom: 1px solid var(--line) }` has specificity (0,2,1). It **loses** to the desktop rule `.s-rt tbody tr:last-child td { border-bottom: 0 }` at (0,2,3). So in the approved design, **the last row's phone card has no separator under its title, while every other row has one.** A naive conversion gives every card the separator. The A/B probe caught this as a 1px height difference (96 → 97 px) in all three engines. `[VERIFIED: local probe A/B rt case]` A faithful conversion adds `group-last/row:border-b-0` on the lead cell. **Rule for converters:** reproduce the computed result, not the CSS's intent, and let the parity harness arbitrate. A cascade accident that looks like a bug goes to the owner (D-08), never silently "fixed".
- **Utility order is Tailwind's, not the class string's.** Two utilities that set the same property on one element at the same variant level are resolved by Tailwind's internal sort, not by their position in `className`. The `[font:inherit]` case proves it: the arbitrary property was emitted after `text-[15px]` and reset it. `[VERIFIED: local probe compiled CSS + A/B]` **Rule:** base and variant property sets in a recipe must be disjoint, and `className` passthrough is for layout glue only (margin, grid placement, width) that the component never sets itself.
- **Variant utilities beat base utilities** (they are emitted later, and attribute/pseudo variants add specificity). `in-*`/`group-*` use `:where()`/`:is()`, so they add none beyond the class. `[VERIFIED: compiled selectors]`

### Owner rulings expressed in utilities (A11Y-04; outcomes binding, mechanism per D-33)

| Ruling | Utility expression | Parity treatment |
|---|---|---|
| **D-01** phone 16px text-entry | Text-entry inputs in toolbar, item row and search box: `text-[14px] pg-phone:text-[16px]`. The plain `Field` input is already 16px | Reference rulings layer has the same rule (§Proving) |
| **D-02** inactive rows; no faded text (FYI-01 five texts) | Inactive `tr` cells `bg-surface-2` (phone card too); never an `opacity-*` utility on a text-bearing element. The class gate checks an allow-list: `disabled:opacity-45`, `aria-disabled:opacity-45`, thumb actions/grip `opacity-0`, skeleton, entry-animation keyframes, the decorative profile stripe and the login numeral | rulings layer |
| **D-03** second cue | `aria-selected:font-bold`, `aria-[current=page]:font-bold` on tab / site link / sidebar item / tab-bar item; checkbox per D-03 (SPEC-GAP Checkbox: draw the tick with a `peer-checked:` sibling span rather than an input pseudo-element, which is more portable across engines `[ASSUMED]`) | rulings layer; Checkbox is SPEC-GAP (owner screenshots) |
| **D-04 / O-5 / O-7** toasts | Behaviour (timers, persistence, live region always mounted) | behaviour tests |
| **D-05** thumb actions | `group/thumb` … `group-focus-within/thumb:opacity-100 no-hover:opacity-100` on both grip and actions | rulings layer |
| **D-27** Logout `<button>` | The same utility list as the nav link plus `w-full cursor-pointer`. Tailwind v4 preflight has **no** `cursor: pointer` for buttons, while `<a href>` gets a pointer from the UA. `[VERIFIED: tailwindcss 4.3.3 preflight.css has no cursor rule for buttons]` | Structural exception in the pairing (`a` vs `button`); visual and computed equal |
| **D-31 O-3** drawer current link italic | `aria-[current=page]:italic` (800 weight already) | rulings layer |
| **D-31 O-6** reduced motion | `motion-reduce:animate-none` on skeleton shimmer, modal and toast entry | run the parity suite with `emulateMedia({ reducedMotion: 'reduce' })` as one extra pass |
| **D-31 O-8** small controls | Keep the designed sizes (`h-9`, `size-9`, `h-8`, …) | spec equal |
| **D-BL-02** hide tag on current row | `group/nav` on the link; `group-aria-[current=page]/nav:hidden` on the tag | rulings layer |
| **WEB-09** pending button look | `aria-disabled:opacity-45 aria-disabled:cursor-not-allowed` and hover/active guarded with `hover:not-disabled:not-aria-disabled:` / `active:not-disabled:not-aria-disabled:` | ✓ compile (`:hover:not(:disabled):not([aria-disabled="true"])`) |
| **D-13 / D-14** themes | `data-theme` on the page root; tokens switch; the `dark:` variant is rarely needed | both themes in the parity matrix (public: light only) |
| **PERF-05** fonts | Fallback faces + stacks in `base.css`; `font-sans`/`font-display` read the token | fonts loaded before capture (`document.fonts.ready`) |

### Hooks: do `.csp-*` / `.s-*` names survive? — Recommendation: **no class hooks**

- Drop `.csp-*`/`.s-*` from `className` entirely. They would be unknown classes for the class gate, and they invite hand-written CSS to come back.
- Where a **context marker** is needed (rule 21b), use `data-ui="<spec class name>"`, for example `data-ui="s-toolbar"` or `data-ui="s-admin-side"`. Reviewers keep a trace back to the spec, and `in-data-[ui=s-toolbar]:` reads naturally.
- Tests locate elements by role, label or text (Testing Library / Playwright), never by class. The parity harness pairs elements by DOM order inside a `[data-case]` wrapper, so it needs no hooks.

### What App. C Phase 2 converts (scope)

App. C holds the page layout of **every** approved screen: Home hero, products, gallery, contact, login, dashboard, orders, order form and detail, profile. Phase 2 renders only the frames and primitives. **Recommendation:** Phase 2 converts App. A, all of App. B, and the App. C parts that Phase 2 renders:

- `.s-page`
- public header and footer (`.s-foot*`, `.s-wrap`, `.s-socials`, `.s-staff`)
- the admin shell (`.s-admin*`, `.s-body`, `.s-tabbar`, `.s-tab-i`, `.s-ph*`, `.s-card*`)
- `.s-rt*`, `.s-toolbar`, `.s-search-box`, `.s-resultbar`, `.s-filter-chip`
- `.s-overlay`, `.s-toast-layer`, `.s-banner`, `.s-inline-empty`, `.s-check`
- every responsive container rule that touches these

Later phases convert the rest of App. C **when they build those screens**, with the same parity harness, because the reference keeps App. C verbatim. Nothing hand-written ever ships, so D-33 holds at every phase boundary.

## Where Class Strings Live

**Recommended pattern (no new package):** co-locate one typed recipe per component, built from `as const` maps, and join with `clsx`.

```tsx
// web/src/ui/button.recipe.ts — base and each axis set DISJOINT properties (no merging needed)
import clsx from 'clsx';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ghost-danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
const base =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border font-button leading-5 ' +
  'tracking-[.01em] whitespace-nowrap no-underline transition-[background-color,border-color,color,transform,box-shadow] ' +
  'duration-150 ease-[ease] active:not-disabled:not-aria-disabled:[transform:translateY(1px)] ' +
  'disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45';
const variant = {
  primary:
    'border-primary bg-primary text-on-primary hover:not-disabled:not-aria-disabled:border-primary-hover ' +
    'hover:not-disabled:not-aria-disabled:bg-primary-hover hover:not-disabled:not-aria-disabled:[box-shadow:0_6px_20px_-10px_var(--primary)]',
  secondary: 'border-line-strong bg-transparent text-ink hover:not-disabled:not-aria-disabled:border-ink-muted hover:not-disabled:not-aria-disabled:bg-surface-2',
  // …ghost, danger, ghost-danger: full literals, transcribed from App. B
} as const satisfies Record<ButtonVariant, string>;
const size = { sm: 'h-9 px-3 text-[14px]', md: 'h-11 px-5 text-[15px]', lg: 'h-13 px-6 text-[16px]' } as const satisfies Record<ButtonSize, string>;
const iconOnly = { sm: 'w-9 px-0', md: 'w-11 px-0', lg: 'w-11 px-0' } as const;   // .csp-btn-icon: width 44, padding 0; .csp-btn-icon.csp-btn-sm: width 36 (lg has no rule of its own, so 44px)
export const buttonClasses = (o: { variant: ButtonVariant; size: ButtonSize; block?: boolean; iconOnly?: boolean; className?: string }) =>
  clsx(base, variant[o.variant], size[o.size], o.block && 'w-full', o.iconOnly && iconOnly[o.size], o.className);
```

Rules:
1. **Literal strings only.** Tailwind finds classes by scanning source text, so `'csp-btn-' + variant` (App. D.3's pattern) or `` `bg-${tone}` `` produce no CSS. ESLint bans template literals and `+` inside `className`/`clsx` (verified selectors below). Maps hold complete class strings.
2. **Disjoint axes.** Base never sets a property that a variant or size sets. Example: `iconOnly` sets `px-0` while `size` sets `px-*`; that is the one intended conflict, and it is resolved by putting `iconOnly` padding under a `data-icon-only` attribute variant, or by removing `px-*` from `size` when icon-only. The plan must pick one and test it in parity. Without tailwind-merge this discipline is the guarantee, and the parity harness is the backstop.
3. **`className` passthrough = layout glue only** (margins, grid/flex placement, width), documented on every component. Feature code never restyles a primitive. That matches spec rule 3 ("extend by adding props").
4. **Shared looks share a recipe.** `Button`, `ButtonLink` and `SkipLink` all use `buttonClasses()`. The `Field` control recipe is shared by `Field`, `PasswordField`, `Select`, `MoneyInput` and `OtpInput`.
5. **Context variants come from props**, not from callers passing classes (rule 21a), for example `Field density="toolbar" | "item" | "default"`.
6. **React Compiler:** module-level constant maps and a pure `clsx` call are compiler-friendly. Avoid `{...rest}` spreads where possible (L-13).
7. **Prettier:** with no class-sorting plugin, Prettier leaves strings alone. Split long recipes into concern-grouped string concatenations at module level (as above) or arrays passed to `clsx`. Concatenating **complete** class tokens is fine for the scanner, because each token is still a literal. The lint ban targets concatenation that builds a token (`'bg-' + x`), which the selector `BinaryExpression` inside `className` catches. Recipes live outside JSX, so a module-level `+` of full strings is allowed (scope the rule to JSX attributes and `clsx`/`buttonClasses` call arguments).

**Enforcement without new packages** (each one probed this session):

| Gate | How | Verified |
|---|---|---|
| No `style` except CSS custom properties | `no-restricted-syntax`: `JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property:not([key.value=/^--/])` and `… > :not(ObjectExpression)` | ✓ ESLint 10.11.0: flags `{width}`, mixed objects and variables; allows `{'--sk-w': w}` |
| No dynamic class tokens | `JSXAttribute[name.name='className'] TemplateLiteral`, `… BinaryExpression[operator='+']` | ✓ flags template literals and `'csp-btn-' + v` inside `className` and `clsx(…)` |
| No CSSOM text/attribute styling | `MemberExpression[property.name='cssText']`, `CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']` | ✓ |
| No CSS imports except the entry and fontsource | `no-restricted-imports` patterns `*.css` with negations for `@/styles/app.css` (main.tsx only) and `@fontsource*` | `[ASSUMED]`: gitignore-style negation in `patterns.group`; prove it in the lint-rule test |
| Every class token compiles; no default palette; no hex/rgb/oklch literals | Node-env Vitest `tailwind-classes.test.ts`. It walks `src/**/*.tsx?` with the **TypeScript API** (the D-15 `typescript` alias) collecting string literals in `className`, `clsx(…)` / `*Classes(…)` calls and `*.recipe.ts` maps. It compiles each token with **`tailwindcss`'s public `compile()`** against the real `app.css`, fails on any token that yields no CSS, and regex-bans `#[0-9a-f]{3,8}`, `rgb(`, `oklch(` inside tokens | ✓ probe: `compile().build([c])` → KNOWN for `bg-surface`, `p-4`, `pg-phone:hidden`; **unknown** for `bg-blue-500`, `rounded-xl`, `shadow-lg`, `text-gray-600`, `font-bold`, `csp-btn`, `hover:bg-surfce`; `bg-[#ff6600]` is "known", hence the extra regex |
| Stylesheet contract | Node-env Vitest `stylesheet-contract.test.ts`: only the allowed constructs in `app.css`/`base.css`; no class selectors; no `@utility`/`@apply` | reasoning (simple tokenizer) |
| No text opacity (D-02) | The class gate reports `opacity-*` tokens outside the allow-list (by recipe or file) | reasoning |
| One merged `no-restricted-syntax` list | ESLint flat config **replaces** a rule's options in later blocks, so all selectors (D-33 bans, `dangerouslySetInnerHTML`, nuqs `shallow`/`startTransition`, `fetch` members) must sit in **one** array, re-spread in per-file overrides | ✓ probe: of two blocks, only the second block's selector fired (L-19) |

The optional R-3 plugin would add editor squiggles for unknown and conflicting classes on top of these. It replaces none of them.

## Proving the Look Is Unchanged (replaces the DOM-differential test)

### Method: same-run A/B in the same browser (no stored baselines)

The **reference** is the approved design as it renders today: the App. A–C CSS compiled exactly as App. A.2 wires it (Tailwind preflight + `@layer` imports), applied to the App. D.3 markup, plus a **test-only rulings layer** that reproduces the owner's look decisions. The **implementation** is the real Tailwind app. Both render the **same scenario** (component + props + seed data) in the **same browser, same viewport, same run**. The harness then compares:

1. **Computed styles.** Walk both case subtrees in DOM order, including `::before`/`::after` when `content` is set, and skip subtrees under `display: none`. Read about 80 visual properties plus the element box (`getBoundingClientRect` relative to the case root).
2. **Pixels.** Take a locator screenshot of each case with `animations: 'disabled'`.

**Probe evidence** `[VERIFIED: local probe, @playwright/test 1.63.0; chromium 1243, firefox 1543, webkit 2359; Blush + Espresso; 390 and 1440 px; rest + hover]`:

- Buttons (primary, secondary sm, ghost `<a>`), badge, field, tabs and sidebar nav: **pixel-identical (byte-equal PNG) and computed-style-equal after normalization in all three engines**.
- With `[font:inherit]` left in, every button showed `font-size 15px → 16px`, `font-weight 650 → 400`, `line-height 20px → 24px` and a 0.3–3.8 px width change.
- The responsive-table card showed the 1px last-row difference (specificity accident), in all three engines.

Same-engine, same-run comparison means **Windows vs CI ubuntu font rasterization never matters**: there is nothing to compare across machines. The reference and the implementation use the same self-hosted woff2 fonts and the same rasterizer at capture time.

### Comparator normalizations (exact list; everything else must match exactly)

| Normalization | Why | Evidence |
|---|---|---|
| Collapse repeated entries in `transition-duration` / `transition-timing-function` / `transition-property` lists | The spec shorthand yields `0.15s, 0.15s, …`; Tailwind sets one `0.15s` | ✓ probe |
| Ignore `border-*-style` and `border-*-color` on sides whose width is `0px` | Preflight `border: 0 solid` vs spec `border: 0`, and side-only borders: invisible | ✓ probe |
| Ignore `outline-style`/`-color` when `outline-width` is `0px` | Same reason | ✓ probe |
| Do not descend into `display: none` subtrees | Hidden elements (the phone `thead`'s `tr`) are irrelevant | ✓ probe |
| Icon `<svg>`: compare the wrapper (size, color, stroke, `vertical-align`, `display`); skip its children; **mask** `svg[viewBox="0 0 24 24"]` in screenshots | The reference uses App. D.5 (lucide 0.460) node data; D-32 approved the 1.52.0 drawings separately | reasoning (D-12/D-32) |
| Compare transforms by effect: the element box plus the pixels; the raw `transform`/`translate` strings are informational only | v4 individual transform properties vs the spec's `transform` | ✓ compile facts |
| Structural exceptions registry (`expectedStructure`), each with a decision ID: D-27 `a` → `button`; extra elements needed by a11y fixes (Tabs ARIA keeps the element count; the Modal focus trap adds no wrapper if done with refs) | Pairing by DOM order needs equal trees | — |

**Tolerance:** computed styles exact (after normalization); boxes exact to 0.01 px; pixels `maxDiffPixels: 0`. A per-case override needs a recorded reason and owner visibility. The probe reached 0 everywhere a conversion was correct.

### Reference harness (test-only, never shipped)

```
web/visual/                         # outside src/ → never scanned by the app's Tailwind, never in tsconfig.app
├── reference/
│   ├── extract-spec.mjs            # reads ../../CSPS-UI-SPEC.md, LF-normalizes, writes App. A, A.2, A.3, B, C + D.3/D.4/D.5
│   │                               #   into .reference-src/ (gitignored); fails if the appendix SHA-256 ≠ spec-appendix.sha256
│   ├── spec-appendix.sha256        # committed pin: an owner spec edit forces an intentional re-pin
│   ├── rulings.css                 # committed, test-only: D-01, D-02 (+FYI-01), D-03, D-05, D-27, O-3, O-6, D-BL-02,
│   │                               #   WEB-09 aria-disabled, PERF-05 font stacks; source: git show 74621f5:web/src/styles/overrides.css
│   ├── main.tsx                    # renders every scenario with the frozen D.3 components inside [data-case] wrappers
│   └── index.html
├── vite.reference.config.ts        # builds web/.reference-dist (gitignored); tailwind plugin with source(none); no compiler
├── parity.spec.ts                  # the A/B comparator (computed styles + boxes + pixels + axe + CSP listener)
└── playwright.visual.config.ts     # no webServer: page.route('https://parity.test/**') serves .reference-dist and
                                    #   .e2e-dist with the real StrictCsp header; projects chromium, firefox, webkit
web/src/dev/scenarios.ts            # ONE scenario list (id, component, props, seed data §12, themes, widths, states)
                                    #   used by the showcase (/dev/components) AND the reference app
```

- **Scenarios** drive both sides: the D-22 showcase renders `[data-case=<id>]` wrappers with the new components, and the reference renders the same ids with the frozen D.3 components. The props API is unchanged (spec rule 3), so one scenario object fits both. New impl-only props get impl-only scenarios that are excluded from parity and covered by the owner screenshots instead.
- **Layouts** (public header/footer, admin shell) are scenarios too. Their reference markup is the App. E.1/E.6 shell fragment.
- **SPEC-GAP primitives have no reference.** Pagination, OtpInput, MoneyInput, Checkbox, SkipLink, ResponsiveTable states, LazyImage, ErrorState, Skeleton family, MobileNavDrawer and UserMenu are excluded from parity and go to the owner through D-23 screenshots. The parity suite still runs axe and the CSP listener on them.
- **Serving.** Route-served (`page.route`), so no port, no dotnet host and no DB. Each response carries `SecurityHeadersMiddleware.StrictCsp`, so the reference proves that the spec's look survives the CSP too. The verbatim D.3 `style={{…}}` props are CSSOM writes and allowed (verified below). The frozen D.4 `dangerouslySetInnerHTML` is DOM insertion, not script.
- **Matrix and runtime budget.**
  - **Chromium:** every scenario at 390 px. Responsive scenarios (anything with `pg-*`/`vp-*`/`md:` utilities, plus layouts) at **320/390/820/1440**. Themes: admin scenarios light+dark, public light only (D-14). States per scenario where the component has state styles: `rest`, `hover` (mouse move), `focus-visible` (keyboard Tab), `active` (mouse down), `disabled`/`aria-disabled`, plus prop-driven states (selected, current, invalid, collapsed). One pass with `reducedMotion: 'reduce'` (O-6) and one with `hasTouch`/`no-hover` (D-05).
  - **Firefox and WebKit:** the same scenarios at 390 and 1440, rest + hover.
  - Target: **< 5 min Chromium, < 4 min each other engine** on this machine (planner sizes scenarios accordingly; tag `@parity`).
- **D-23 / D-24 still apply.**
  - D-23 (owner screenshots at 390/820/1440) covers SPEC-GAP primitives and overall impression.
  - D-24 (local side-by-side with `.planning/design/*.html`) stays local-only and git-ignored (T-02-49). It compares against the *design export*, which is a different source from the spec CSS.
  - The parity harness is the automated proof. D-24 is the owner's sanity check.

### Intentional differences (must be enumerated, never silent)

| Difference | Decision | How the harness treats it |
|---|---|---|
| Icon path drawings (20 of 56) | D-32 | Masked; wrapper compared |
| Logout `<a>` → `<button>` | D-27 | Structural exception; visual/computed equal |
| Current drawer link italic | D-31 O-3 | In the rulings layer → equal |
| Manager tag hidden on the current row | D-31 D-BL-02 | In the rulings layer → equal |
| Faded texts at full opacity (FYI-01) | D-02 | In the rulings layer → equal |
| Bold current/selected, checkbox cue | D-03 | Rulings layer; Checkbox is SPEC-GAP |
| Thumb actions visible on focus/touch | D-05 | Rulings layer |
| Phone 16px text inputs | D-01 | Rulings layer |
| Pending button look | WEB-09 | Rulings layer |
| Reduced-motion animation stop | O-6 | Rulings layer (motion pass) |
| Avatar/Testimonial `role="img"`, Tabs ARIA, focus trap | O-1/O-2, WEB-02 | Attributes are not compared; no visual change |

## CSP and Budgets

**CSP.** The strict CSP has `style-src 'self'`. Tailwind emits one external hashed CSS file, so it is CSP-safe by construction. The CSP probe measured how each **dynamic** style mechanism fares under the project's exact `StrictCsp` (minus `upgrade-insecure-requests`, served through `page.route`). The policy string was read from `src/Csps.Server/Http/SecurityHeadersMiddleware.cs:16-17`: `"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"`.

| Mechanism | Chromium | Firefox | WebKit | Violation |
|---|---|---|---|---|
| Parsed `style="…"` attribute in HTML | blocked | blocked | blocked | yes (`style-src-attr`) |
| `el.setAttribute('style', …)` | blocked | blocked | blocked | yes (`style-src-attr`) |
| `<style>` element inserted by script | blocked | blocked | blocked | yes (`style-src-elem`) |
| `el.style.width = …` (CSSOM) | applied | applied | applied | none |
| `el.style.setProperty('--w', …)` (CSSOM custom property) | applied | applied | applied | none |
| `el.style.cssText = …` | applied | applied | applied | none |

`[VERIFIED: local probe, 3 engines]` React DOM 19.3.0 applies `style={{…}}` only through the CSSOM: `style.setProperty(name, value)` for `--*` names and `style[name] = value` otherwise, never `setAttribute('style')`. `[VERIFIED: react-dom 19.3.0 cjs/react-dom-client.development.js:2853-2910]` So React style props cannot break the CSP. D-33 still says "no inline styles", so the **policy** is:

- `style` may only set CSS custom properties, for genuinely continuous values: chart tooltip `left`, Skeleton `width`/`height`/`radius` props, MediaPlaceholder `aspect-ratio`, DataTable column `width`. Utilities consume them, for example `w-(--sk-w)`, `aspect-(--ratio)`, `left-(--tip-x)` (verified var-shorthand output).
- **Finite sets become class maps.** Avatar sizes become a size map plus a `--avatar-size` custom property only if sizes are open-ended. Column `align` becomes `text-left`/`text-right`.
- `cssText` and `setAttribute('style')` are banned (verified ESLint selectors). They would work under the CSP, but they defeat review.
- Body scroll lock (`document.body.style.overflow = 'hidden'`, spec §2.8) is a CSSOM write and allowed. Keep it in one hook with a lint exception at that line only, or use an `overflow-hidden` class toggled on `<body>` through `classList`. The class is a literal in source, so Tailwind generates it. Recommend the class toggle: no lint exception needed.
- Vite's dev server injects `<style>` and inline scripts. CSP is verified **only** on the built app (E2E host and parity suite).

**Budgets (PERF-01).**
- CSS ≤ 35 KB gz: converted forecast ≈ 12–14 KB gz including fonts' `@font-face` (§Flag 4).
- JS: the forecast says +5–10 KB gz of class strings in the public entry.
- The in-house budget plugin (Pattern 12) measures both topologies from the first build. **Add a CSS-file count assertion (exactly one CSS asset per build)**: a second CSS file would mean a stray CSS import.

**Content detection** (no class missed, none bloated):
- `source("../src")` + `@source not` for tests and `src/test` (verified).
- Keep `web/visual/`, `e2e/`, build outputs and `.reference-*` outside `src`, and gitignored where they are output (Tailwind also honours `.gitignore`).
- The class gate proves every source token compiles.
- The budget proves nothing bloats.
- Superseded Pitfall 19 (scanning a stray `dist-a/`) is prevented by `source("../src")`.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌───────────────────────── developer machine ─────────────────────────┐
 npm run dev (5180) ──►   │ Vite dev server ── /api/* proxy ──► Kestrel http://localhost:5115     │
                          │   (no CSP; HMR; Tailwind JIT; admin + /dev routes)                    │
                          └──────────────────────────────────────────────────────────────────────┘

 npm run build ──► vite build (production) ──► @tailwindcss/vite scans src/** (not tests) ──► ONE hashed CSS
                         │   React Compiler (babel, src only)     budget plugin (generateBundle) ──fail?──► exit 1
                         │   admin & /dev routes dead-code-eliminated (D-20)
                         ▼
               src/Csps.Server/wwwroot/{index.html, assets/*.js|css|woff2, mark.svg, robots.txt}  (whole folder gitignored)
                         │
 browser ──HTTPS──► ASP.NET Core pipeline:
   SecurityHeaders (CSP, outermost) → ExceptionHandler → StatusCodePages → ResponseCompression(static types)
   → UseStaticFiles(HiddenSegmentFileProvider(web root); immutable /assets) → UseRouting (explicit)
   → SerilogRequestLogging → AuthN → AuthZ (fallback deny)
   → endpoints: /health | /api/{**path} 404 | /api/v1/... | {*path:file} 404 (anon) | /openapi|/scalar 404 (non-Dev)
                | GET/HEAD {*path:nonfile} → index.html (anon, no-cache)
                         │
                         ▼
   index.html → entry chunk (React, RR8 data router, Query, ui recipes) → route.lazy chunk
     PublicLayout(@container/pg, data-theme=light) ─ SkipLink / SiteHeader / <main> / footer
     [dev/e2e builds only] AdminLayout(data-theme) ─ lazy NuqsAdapter(<Outlet/>) ─ AdminPreview / ComponentShowcase
     components → hooks (nuqs list params; useQuery) → api.ts → httpClient.ts (fetch / XHR-upload) → /api/v1

 E2E:     vite build --mode e2e → web/.e2e-dist ──► dotnet run Csps.Server --urls https://localhost:5199 --webroot <.e2e-dist>
          Playwright (chromium/firefox/webkit + Pixel/iPhone) ── console/CSP/axe fixtures ──► report (gitignored)
 PARITY:  web/.reference-dist (spec CSS + frozen D.3 + rulings) ─┐
          web/.e2e-dist (/dev/components scenarios)  ─────────────┴─► page.route + StrictCsp ─► A/B: computed styles, boxes, pixels
 Lighthouse: production build in wwwroot ──► same host on 5199 ──► lighthouse 13.5 (mobile) ──► assert script
 Golden vectors: tests/fixtures/order-math-golden-vectors.json ──► xUnit (Csps.Domain OrderMath) and Vitest (csps.ts)
```

### Recommended Project Structure

```
web/
├── .npmrc                     # save-exact, engine-strict, min-release-age=14 (+ approved excludes)
├── package.json / package-lock.json
├── index.html                 # App. D.7c + meta description + preload hook (no inline script/style)
├── public/                    # mark.svg (App. F), robots.txt (+ third-party notices file if D-BL-04 = A)
├── vite.config.ts             # D.7 + compiler + port/proxy + outDir + budget/preload plugins
├── tsconfig.app.json / tsconfig.node.json   # PRD §17.2, valid for TS 6 and TS 7; node program lists every node-env test
├── eslint.config.mjs / .prettierrc.json (tabWidth 2) / .prettierignore
├── playwright.config.ts / e2e/            # host on 5199; fixtures: console, CSP (binding), axe; specs
├── visual/                    # reference harness + parity suite (test-only; §Proving)
├── scripts/                   # budget.ts (+test), lighthouse-assert.mjs, gen-golden-vectors.mjs, license-gate.mjs,
│                              #   third-party-notices.mjs, font-metrics.mjs, e2e.mjs (spawns node, not .cmd shims)
└── src/
    ├── main.tsx               # imports fontsource CSS + '@/styles/app.css' only; createRoot with error callbacks
    ├── styles/                # app.css (entry: tailwind, sources, variants, theme) + base.css (tokens, fonts, base)
    ├── app/                   # router.tsx, layouts (Public/Admin), RouterLink, ErrorBoundary, pages
    ├── dev/                   # scenarios.ts, ComponentShowcase (dev routes only)
    ├── ui/                    # converted D.3 components + *.recipe.ts; icons.ts (lucide map); mark.tsx (JSX)
    │   └── gaps/              # SPEC-GAP primitives (Tailwind from the start)
    ├── lib/                   # csps.ts (D-09), format.ts, http/, api.ts, query/, url-state/, forms/, errors/
    ├── types/api.generated.ts # openapi-typescript output (committed)
    └── test/                  # setup.ts (jest-dom, console guard, matchMedia), axe.ts, fakeFetch.ts
tools/openapi-gen/             # openapi-typescript 7.13.0 + typescript 5.9.3, openapi.v1.json snapshot, check.mjs
tests/fixtures/order-math-golden-vectors.json            # shared by xUnit + Vitest (LF)
tests/Csps.Testing/Fixtures/webroot/                     # committed stub web root (index.html, robots.txt, assets/app-fixture.js,
                                                         #   .vite/license.md and .x/y.txt regression fixtures)
```

### Pattern 1: `vite.config.ts` (D.7 + required deltas, each a `// SPEC-DEVIATION`)

```ts
// Source: App. D.7 + @vitejs/plugin-react 6.1.1 README (compiler) + probe-verified options
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { budgetPlugin } from './scripts/vite-budget-plugin';
import { preloadFontPlugin } from './scripts/vite-preload-font-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const devRoutes = mode === 'development' || env.VITE_DEV_ROUTES === 'true'; // .env.e2e / .env.budget (committed, not secret)
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }), // filter: (id: string | undefined) => !!id && /\/src\/.*\.tsx?$/.test(id)
      tailwindcss(),
      preloadFontPlugin(/archivo-latin-wght-normal-.*\.woff2$/), // fail closed: exactly one match
      budgetPlugin({ devRoutes }), // fails the build (this.error) over 150/250/35 KB gz; asserts exactly one CSS asset
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { __DEV_ROUTES__: JSON.stringify(devRoutes) },
    server: { port: 5180, strictPort: true, proxy: { '/api': { target: 'http://localhost:5115', changeOrigin: false } } },
    build: {
      outDir: mode === 'production' ? '../src/Csps.Server/wwwroot' : `.${mode}-dist`,
      emptyOutDir: true,
      assetsInlineLimit: 0, // never inline fonts as data: (font-src 'self')
      sourcemap: false,
      license: false,       // D-BL-04 open: Vite would write .vite/license.md into wwwroot; credits via THIRD-PARTY-NOTICES
    },
  };
});
```

- Proxy to **http 5115**: Development has no HTTPS redirect (`var redirectToHttps = !builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing");`). `[VERIFIED: src/Csps.Server/Program.cs:19]`
- Route exclusion (D-20): `if (__DEV_ROUTES__) routes.push(…)`. With a literal `false`, Rolldown drops the unreachable `import()`. `[VERIFIED: local probe 2026-10-07]`
- `build.license`: until D-BL-04 is ruled, `false` is the safe default. The server's dot-folder refusal stays regardless.

### Pattern 2: React Router 8 data router (replaces D.6's `<BrowserRouter>`)

```tsx
// Source: probe-verified (build + TS7 strict typecheck) with react-router 8.4.0
import { createBrowserRouter, Outlet } from 'react-router';
import { RouterProvider } from 'react-router/dom';
export const router = createBrowserRouter([
  {
    Component: Root,                 // QueryClientProvider (+ no NuqsAdapter here)
    HydrateFallback: ShellFallback,  // REQUIRED: silences RR's dev warning (Pitfall 10)
    ErrorBoundary: RootErrorBoundary,
    children: [
      { Component: PublicLayout, children: [{ path: '*', lazy: () => import('./public/PublicPlaceholderPage').then((m) => ({ Component: m.PublicPlaceholderPage })) }] },
      ...(__DEV_ROUTES__ ? adminRoutes : []), // admin: lazy AdminLayout → lazy UrlStateLayout (NuqsAdapter around <Outlet/>) → pages
    ],
  },
]);
createRoot(rootEl).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
```

### Pattern 3: Visual parity (replaces the DOM-differential proof)

See §Proving the Look Is Unchanged. In short: `scenarios.ts` is shared by the showcase and the reference, the comparison is route-served A/B in 3 engines, and the comparator is computed style + box + pixels with the listed normalizations.

```ts
// Pixel A/B with Playwright's own comparator and diff images (no new package): write the reference shot as the
// "expected" snapshot at runtime, then assert the implementation against it.
// playwright.visual.config.ts: snapshotPathTemplate: '{testDir}/../test-results/parity/{projectName}/{arg}{ext}' (gitignored)
const name = `${scenario.id}-${theme}-${width}-${state}.png`;
fs.mkdirSync(path.dirname(test.info().snapshotPath(name)), { recursive: true });
fs.writeFileSync(test.info().snapshotPath(name), await refCase.screenshot({ animations: 'disabled', mask: [refIcons] }));
expect(await implCase.screenshot({ animations: 'disabled', mask: [implIcons] })).toMatchSnapshot(name, { maxDiffPixels: 0 });
```

`testInfo.snapshotPath(...name)` and `toMatchSnapshot(name, options)` exist in @playwright/test 1.63.0 `[VERIFIED: node_modules/playwright/types/test.d.ts]`. A plain `Buffer.compare` of the two PNGs also worked in the probe (equal renders gave byte-equal PNGs).

### Pattern 4: In-house axe helper (D-18) — unchanged

```ts
// Source: axe-core 4.13 API; Vitest 5 Matchers<R, T> typing verified in @vitest/expect 5.0.1 dist/index.d.ts:182
import axe from 'axe-core';
import { expect } from 'vitest';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const r = await axe.run(container, {
    runOnly: { type: 'tag', values: TAGS },
    rules: { 'color-contrast': { enabled: false } }, // jsdom has no layout/canvas; contrast is proven in Playwright
  });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
```

Reject an empty container, and sort violations by rule id then target. axe hangs on fake timers, so always run it on real timers (L-24).

### Pattern 5: `httpClient.ts` shape (WEB-03, WEB-09) — unchanged; validated by the superseded run

- `createHttpClient({ baseURL, fetch = globalThis.fetch, timeoutMs, refresh, onUnauthorized, xhrFactory })`. Inject `fetch` and the XHR factory.
- Abort: `AbortSignal.any([...])`. Single-flight refresh. At most 2 capped retries (250/500 ms, cap 2 s, no jitter), only for GET/HEAD/PUT/DELETE/OPTIONS and a keyed POST, only on network error or 503.
- No `Idempotency-Key` on GET/HEAD/OPTIONS. Errors are normalized to `HttpError`. Secret param names are rejected before sending. `credentials: 'same-origin'`.
- "No body" is `null`, not `undefined`, under `exactOptionalPropertyTypes`.

All behaviours were reached at 100% coverage in the superseded 02-07. `[VERIFIED: superseded 02-07 SUMMARY]`

### Pattern 6: Lint rules that enforce architecture (WEB-04, WEB-10, QUAL-02, D-33)

```ts
// eslint.config.mjs excerpt — ONE no-restricted-syntax array (flat config replaces options per block; verified L-19)
const syntaxBans = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'CWE-79.' },
  { selector: "Property[key.name='shallow'][value.value=false]", message: 'nuqs #1563: keep shallow: true.' },
  { selector: "ObjectExpression > Property[key.name='startTransition']", message: 'nuqs #1567: no startTransition option.' },
  { selector: "MemberExpression[property.name='fetch'][object.name=/^(window|globalThis|self)$/]", message: 'Call api.ts.' },
  { selector: "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property:not([key.value=/^--/])", message: 'D-33: style may only set CSS custom properties.' },
  { selector: "JSXAttribute[name.name='style'] > JSXExpressionContainer > :not(ObjectExpression)", message: 'D-33: style must be an inline object of --* properties.' },
  { selector: "JSXAttribute[name.name='className'] TemplateLiteral", message: 'D-33: class names must be complete literals.' },
  { selector: "JSXAttribute[name.name='className'] BinaryExpression[operator='+']", message: 'D-33: no class-name concatenation.' },
  { selector: "MemberExpression[property.name='cssText']", message: 'D-33: no cssText.' },
  { selector: "CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']", message: 'D-33/CSP: no style attribute.' },
];
export const restrictions = {
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'axios', message: 'Forbidden (PRD Prime Directive 8).' },
        { name: 'react-router-dom', message: 'Removed in React Router 8; import from react-router.' },
        { name: 'nuqs/adapters/react-router', message: 'Deprecated; use nuqs/adapters/react-router/v8.' },
        { name: 'nuqs/adapters/react-router/v6', message: 'Use /v8.' },
        { name: 'nuqs/adapters/react-router/v7', message: 'Use /v8.' },
        { name: 'nuqs/adapters/react', message: 'Use the React Router v8 adapter.' },
        { name: 'nuqs', importNames: ['parseAsIsoDate', 'parseAsIsoDateTime'], message: 'Use parseAsBusinessDate (Manila YYYY-MM-DD).' },
      ],
      patterns: [
        { group: ['**/lib/http/**', '@/lib/http/*'], message: 'Only src/lib/api.ts may use the HTTP client (WEB-04).' },
        { group: ['*.css', '!@/styles/app.css', '!@fontsource/*', '!@fontsource-variable/*'], message: 'D-33: no stylesheet imports; style with utilities.' },
      ],
    }],
    'no-restricted-globals': ['error', { name: 'fetch', message: 'Call api.ts.' }, { name: 'XMLHttpRequest', message: 'Call api.ts.' }],
    'no-restricted-syntax': ['error', ...syntaxBans],
    'no-console': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
// Overrides re-spread syntaxBans: files ['src/lib/http/**'] allow fetch/XMLHttpRequest; src/lib/api.ts allows the http import;
// src/main.tsx alone may import '@/styles/app.css'.
```

- Prove each ban with a Vitest test through ESLint's `Linter` on virtual file paths.
- Raise every warn-level rule from shared configs to `error`, with options kept: `eslint-plugin-react-hooks` 7.1.1 ships `exhaustive-deps`, `incompatible-library` and `unsupported-syntax` at `warn` (L-18).
- `@typescript-eslint/prefer-nullish-coalescing` with `ignorePrimitives: { string: true, number: true, boolean: true }`.
- Make unused disable directives errors.

### Pattern 7: SPA host in ASP.NET Core (WEB-01, FND-05, SEC-02) — revised with the execution's findings

```csharp
// Program.cs order (validated in superseded 02-01/02-19; git show 74621f5:src/Csps.Server/Program.cs)
builder.Services.AddCspsSpaHosting();          // ResponseCompression: MimeTypes = html, css, js, svg ONLY (no JSON: BREACH)
// ...
app.UseResponseCompression();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new HiddenSegmentFileProvider(app.Environment.WebRootFileProvider), // dot/~ segments read as missing (L-04)
    OnPrepareResponse = SpaCaching.Apply,      // /assets/* public, max-age=31536000, immutable; everything else no-cache
});
app.UseRouting();                              // EXPLICIT: StaticFileMiddleware skips requests that already matched an endpoint (L-02)
// ...SerilogRequestLogging, AuthN, AuthZ...
app.MapSpaHost();  // {*path:file} → anon ProblemDetails 404; non-Dev /openapi/{**path}, /scalar/{**path} → 404 (D-29,
                   // ReservedPathMetadata); MapFallbackToFile("index.html") → GET+HEAD {*path:nonfile}, anon, no-cache
```

- **Authorization matrix.** Today it holds `new("*", "/health", "/health", Anonymous: 200, Admin: 200, Manager: 200)`, `new("*", "/api/{**path}", "/api/v1/does-not-exist", Anonymous: 404, Admin: 404, Manager: 404)` and `new("GET", "/api/v1/site-settings", "/api/v1/site-settings", Anonymous: 401, Admin: 200, Manager: 200)`, and `AnonymousAllowList` is `new[] { "* /health", "* /api/{**path}" }` `[VERIFIED: tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:55-57, 61-62]`. The shell needs **two** rows and keys, `GET {*path:nonfile}` and `HEAD {*path:nonfile}` (L-01), plus the file 404 and the two reserved-prefix fallbacks.
- **Fixture web root (fixes the latent wwwroot gap).** `CspsApiFactory` sets `builder.UseSetting(WebHostDefaults.WebRootKey, FixtureWebRoot)`, with `FixtureWebRoot = Path.Combine(AppContext.BaseDirectory, "Fixtures", "webroot")` and the csproj item `<None Include="Fixtures\webroot\**" CopyToOutputDirectory="PreserveNewest" />`. The folder is named `webroot`, not `wwwroot`, because `.gitignore` ignores `**/wwwroot/assets/`. `[VERIFIED: git show 74621f5:tests/Csps.Testing/CspsApiFactory.cs and Csps.Testing.csproj]` This makes the .NET suite independent of `src/Csps.Server/wwwroot` existing. Today two `OpenApiExposureTests` need that untracked folder, which a fresh clone lacks. Do it in the tracer plan, before any SPA test.
- **Never commit a placeholder into `src/Csps.Server/wwwroot`** (such as a `.gitkeep`). Vite's `emptyOutDir` would delete it on every build and dirty git, and a dot-file is exactly what the hidden-segment rule refuses. Ignore the whole folder: `src/Csps.Server/wwwroot/`.
- Phase 1 tests that used an unmatched page path as an auth probe change meaning once every path matches an endpoint (L-03).

### Pattern 8: Golden vectors and integer-centavo rounding (WEB-07, D-09, ORD-09) — unchanged; validated

- One JSON file, `tests/fixtures/order-math-golden-vectors.json`, with amounts as strings. A committed generator uses BigInt exact rationals and has a `--check` drift mode.
- The superseded file had **220 cases in 8 categories**: midpoint 39, ord-fixture 8 (all §12.2 seed orders), percent-100 6, zero-items 6, multi-discount 30, negative-balance 6, large-value 11, seeded-random 114.
- **The unmodified spec `round2` fails 53 of 220**: 7.5% of 17.00 previews 1.27. That is the D-09 RED evidence. `[VERIFIED: superseded 02-UAT test 28/30]`
- C#: a pure `Csps.Domain.Orders.OrderMath`. Use the literal `100m`, not a `private const decimal`, which leaves an uncovered static-constructor line (L-11).
- TS: integer centavos, half away from zero. NaN/±Infinity count as 0. Convert to number through the exact decimal text, because `Number(1e21 centavos)/100` loses precision (L-12).
- Pinned operation order: round items total → round each discount → sum → round → subtract.

### Pattern 9: TanStack Query defaults (WEB-08) — revised for 5.103.2

```ts
new QueryClient({ defaultOptions: {
  queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: false /* httpClient owns retries */, refetchOnWindowFocus: true },
  mutations: { retry: false },
} });
// Intent prefetch: queryClient.query(options).catch(() => undefined) — prefetchQuery is @deprecated in 5.103.2 (L-15)
```

### Pattern 10: nuqs list-state conventions (WEB-10) — unchanged + two execution facts

- **Adapter placement.** `UrlStateLayout` is a pathless **lazy** layout route around `<Outlet/>` with `defaultOptions={{ shallow: true, clearOnDefault: true, scroll: false }}`.
- **History.** `setPage` uses `push`. Every other setter uses `replace` and resets the page.
- **Normalization.** Parsers normalize once with `replace`.
- **Tests.** Use `withNuqsTestingAdapter`.
- **`useLocation().search` does not change after a nuqs write** (`shallow: true` calls `history.pushState` directly). List screens read list state only through their hook. Layout tests assert `window.location.search` with a `createBrowserRouter` (L-16).
- **Key order** is page, size, q, then the other keys in code-unit order, applied through the adapter's `processUrlSearchParams` (L-17).
- **Privacy.** Personal-data and secret key names are refused when a list hook is created.

### Pattern 11: Playwright host, fixtures and matrix (QUAL-04, A11Y-01/02, PERF-03) — validated

```ts
webServer: {
  command: 'dotnet run --project ../src/Csps.Server --no-launch-profile -- --urls https://localhost:5199 --webroot ' + e2eDist,
  url: 'https://localhost:5199/health', ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 120_000,
  env: { ASPNETCORE_ENVIRONMENT: 'Development', ConnectionStrings__Csps: 'Server=(localdb)\\CSPS;Database=CSPS_E2E;Integrated Security=true' },
},
use: { baseURL: 'https://localhost:5199', ignoreHTTPSErrors: true },
projects: [chromium, firefox, webkit, { name: 'pixel', use: devices['Pixel 7'] }, { name: 'iphone', use: devices['iPhone 15'] }],
```

- `--webroot` works with `WebApplication.CreateBuilder(args)` (A2 resolved).
- Axe and the listeners work under the strict CSP in all engines (A1 resolved).
- **CSP violations travel through `exposeBinding`**, so they survive navigation (a window array would lose them).
- The host's cwd is the server project.
- The fixture's auto-fixture callback is named `provide`, not `use`, so `react-hooks/rules-of-hooks` doesn't misfire.
- `e2e.mjs` spawns `process.execPath` with `node_modules/vite/bin/vite.js` and `node_modules/@playwright/test/cli.js`, because Windows can't spawn `.cmd` shims without a shell (L-22).

`[VERIFIED: superseded 02-06 SUMMARY]`

### Pattern 12: In-house budget plugin (PERF-01) — unchanged + CSS-count assertion

- **Inputs.** Rolldown `generateBundle` exposes `isEntry`, `isDynamicEntry`, `facadeModuleId`, `imports` and `viteMetadata.importedCss`. `[VERIFIED: local probe 2026-10-07]`
- **Calculation.** A pure function: `initial(route) = closure(entry.imports) ∪ closure(routeChunk.imports)`, gzip level 9, 1 KB = 1000 B.
- **Failure.** `this.error` with a table. It fails closed on missing route modules, and the D-33 addition fails on more than one CSS asset.
- **Two builds:** production for the public bundle and CSS; `--mode budget` (dev routes) for the admin bundle and the admin-topology public number.

### Pattern 13: Lighthouse gate (PERF-02) — unchanged

- **Command:** `lighthouse https://localhost:5199/ --output=json --quiet --no-enable-error-reporting --chrome-flags="--headless=new --ignore-certificate-errors"`.
- **Assertions:** every category ≥ 0.95, LCP < 2000 ms, CLS < 0.05, TBT as the INP proxy.
- **Reports** go to gitignored `artifacts/lighthouse/` and are never uploaded.

### Pattern 14: Fonts (PERF-05) — revised for D-33

- Import `@fontsource/barlow-condensed/{600,700,800,800-italic}.css` and `@fontsource-variable/archivo` in `main.tsx`. These are the weight files, and they carry `unicode-range`.
- Preload the Archivo latin woff2 through a `transformIndexHtml` plugin that requires exactly one match.
- **Fallback faces and stacks live in `base.css`** (layer base): `'Archivo Fallback'` → `local('Arial')` with `size-adjust: 101.85%; ascent-override: 86.21%; descent-override: 20.62%; line-gap-override: 0%`. `'Barlow Condensed Fallback'` → `local('Arial Narrow'), local('Arial')` with `unicode-range: U+0000-20B0, U+20B2-10FFFF; size-adjust: 68.92%; ascent-override: 145.1%; descent-override: 29.02%; line-gap-override: 0%`. The token stacks are `--font-display: 'Barlow Condensed', 'Barlow Condensed Fallback', 'Archivo Variable', 'Arial Narrow', sans-serif` and `--font-sans: 'Archivo Variable', 'Archivo Fallback', system-ui, -apple-system, 'Segoe UI', sans-serif`. `[VERIFIED: git show 74621f5:web/src/styles/overrides.css]` (The values were measured against Windows Arial, because Arial Narrow is not installed on this machine. The font-metrics test checks the committed values without reading Arial, so it runs on ubuntu.)
- **`font-sans` / `font-display` utilities read `var(--font-sans)` / `var(--font-display)`** through `@theme inline`. They therefore include the fallbacks, which fixes the superseded deferred item where A.2's literal stacks bypassed them. `[VERIFIED: compiled .font-sans { font-family: var(--font-sans) }]`

### Anti-Patterns to Avoid
- **Converting by "nearest Tailwind default"** (`text-sm` for 14px, `rounded-lg` for 18px). Defaults are cleared; transcribe the spec value.
- **Utilities that restate what preflight already does** (`m-0` on `h1`, `box-border`). Redundant, harmless, and noise for review; the parity harness proves it unnecessary.
- **Restyling a primitive from feature code via `className`.** Add a prop instead (spec rule 3).
- **Rendering the SPA shell from Vite's dev server under CSP.** CSP is verified only on built output.
- **`<Navigate>` to rewrite query params** (nuqs #1245). Use loader `redirect()`.
- **Inline theme bootstrap `<script>`.** It is blocked by `script-src 'self'`. Read `localStorage` in a lazy `useState` initializer.
- **`createPortal` to `document.body`.** Overlays lose `data-theme` and the `pg` container. Render inside the layout root (spec §2.7).
- **`npm audit fix --force` or widening `allowed-licenses.json` to pass a gate.** Report to the owner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Cool-down enforcement across the npm tree | Date-check scripts over the lockfile | npm 11 `min-release-age=14` + `min-release-age-exclude[]` | Covers transitive packages `[VERIFIED]` |
| Pixel comparison / diff images | A PNG decoder or a pixelmatch clone | Playwright's `toMatchSnapshot` comparator (reference written at runtime) | Built in; produces expected/actual/diff images |
| "Is this class valid in our theme?" | A regex over Tailwind's docs or a list of utilities | `tailwindcss` `compile().build([token])` | The real engine and theme `[VERIFIED: probe]` |
| Finding class literals in source | Regex over `.tsx` | TypeScript compiler API (D-15 `typescript` alias) | Correct with JSX, comments and strings |
| Class conflict resolution at runtime | A tailwind-merge clone | Disjoint recipe axes + parity harness | No runtime cost; conflicts are design errors |
| URL state, history semantics | Custom `useSearchParams` wrappers | nuqs 2.10.1 | Batching, `clearOnDefault`, testing adapter |
| Server-state cache, keep-previous, cancellation | Custom fetch hooks | TanStack Query 5 | `signal`, `keepPreviousData`, prefetch |
| a11y rule engine | Custom checks | axe-core 4.13 + @axe-core/playwright | Same ruleset at both levels via `overrides` |
| Contrast/layout-dependent a11y in unit tests | jsdom contrast hacks | Playwright + axe | jsdom has no layout/canvas |
| Font subsetting | Custom subset tooling | fontsource subsets + `unicode-range` | Browser fetches only needed subsets |
| License inventory | Parsing `node_modules` | license-checker-rseidelsohn (`--production` strict) | SPDX expressions, dev/prod split |
| OpenAPI → TS types | Hand-written DTOs | openapi-typescript 7.13 in `tools/openapi-gen` (D-16) | Mechanical drift check |
| React memoization | Manual `useMemo`/`memo` | React Compiler 1.0 | Verified on the design system |

**Key insight:** D-33 turns this phase's main risk into **silent visual drift**. A default-palette class emits nothing, an arbitrary property re-sorts and resets a shorthand, a built-in `max-*` variant is off by one pixel, a cascade accident disappears. Every one of these was observed in this session's probes. Each needs an automated oracle: the class gate, the parity harness and the budget, not reviewer attention.

## Common Pitfalls

### Pitfall 1: Building into `wwwroot` dirties git and gets deployed with stale content
- **What goes wrong:** `.gitignore` ignores only `**/wwwroot/assets/` `[VERIFIED: .gitignore:31]`. `index.html`, `mark.svg` and `robots.txt` written to `src/Csps.Server/wwwroot/` show up as untracked.
- **Avoid:** ignore `src/Csps.Server/wwwroot/` entirely; `emptyOutDir: true`; hand-written files belong in `web/public/`. Never put a `.gitkeep` there (Pattern 7).

### Pitfall 2: WebKit breaks on `http://localhost:5199` because of `upgrade-insecure-requests`
- **What goes wrong:** the strict CSP ends with `upgrade-insecure-requests` `[VERIFIED: SecurityHeadersMiddleware.cs:16-17]`. WebKit upgrades `http://localhost` subresources (WebKit bug 250776, still open). `[CITED: bugs.webkit.org/show_bug.cgi?id=250776]`
- **Avoid:** E2E host on **https://localhost:5199** (D-30). The route-served parity suite uses an `https://parity.test` origin, so the same rule holds.

### Pitfall 3: Lighthouse fails LCP because Kestrel serves JS uncompressed
- **Avoid:** `AddResponseCompression` (Brotli + Gzip, `EnableForHttps`) for html/css/js/svg only, **never JSON** (BREACH); immutable `/assets/*`.

### Pitfall 4: `prettier --check` fails every file on Windows
- **What goes wrong:** `core.autocrlf=true` checks files out as CRLF. **The revert removed `.gitattributes`**, so it must be re-created.
- **Avoid:** `.gitattributes` with `web/** text eol=lf`, `tools/openapi-gen/** text eol=lf`, `tests/fixtures/** text eol=lf`, `*.woff2 binary`, `*.png binary` `[VERIFIED: git show 74621f5:.gitattributes]`; renormalize after adding.

### Pitfall 5 (retired): verbatim CSS line endings
No verbatim CSS ships. The **reference** extraction is LF-normalized and hash-pinned (§Proving).

### Pitfall 6: Autofixing `prefer-nullish-coalescing` changes rendered output
- `label || 'No image yet'` → `??` keeps `''`. Keep `ignorePrimitives`, and never `eslint --fix` the converted components without the parity suite green.

### Pitfall 7: The measured lint/type delta on the App. D.3 code (still the starting point of each conversion)
- **Types.** 7 TS errors: `UiLink` spread, `Avatar` `p[0]`, `ImageUploader` `splice`, 3 × `MediaPlaceholder` optional props, `ConfirmDialog` → `Modal onClose`.
- **Lint.** 99 findings: 17 restrict-template-expressions, 17 prefer-nullish-coalescing, 16 no-confusing-void-expression, 14 restrict-plus-operands, 7 no-unnecessary-type-conversion, 7 no-useless-default-assignment, 5 array-type, 3 no-unnecessary-condition, plus 6 a11y, 1 compiler, 1 dangerouslySetInnerHTML and 6 misc. `[VERIFIED: probe 2026-10-07]`
- D.1 (csps.ts) had 15 of these, fixed as same-output `// SPEC-DEVIATION` edits in superseded 02-04.
- The structural fixes (overlay/drag handlers via `ref` + `useEffect` instead of JSX props on static elements) still apply.

### Pitfall 8: Playwright/axe under a strict CSP — RESOLVED
Axe injection and init-script listeners work in all 3 engines with no `bypassCSP` (superseded 02-06). Keep the Wave-0 self-tests that prove each guard fires.

### Pitfall 9: The Modal from App. D.3 isn't a dialog yet
- No initial focus, no Tab trap, no focus return, overlay `onMouseDown` on a `div`. Fix with a `useFocusTrap` hook (refs, no wrapper element, so the parity pairing is unchanged) and body scroll lock via a class toggle.

### Pitfall 10: React Router 8 logs "No `HydrateFallback` element provided…"
- Give the root route a `HydrateFallback`, a minimal page root with no CLS.

### Pitfall 11: Unknown static file paths answer 401 instead of 404
- Add an anonymous `{*path:file}` fallback returning ProblemDetails 404, with its own matrix row.

### Pitfall 12: `ProductionHasNoApiDocs` changes meaning after the SPA fallback
- It requests `/openapi/v1.json`, `/scalar`, `/scalar/` in Production and expects a non-success ProblemDetails `[VERIFIED: OpenApiExposureTests.cs:59-71]`. D-29: reserved-prefix 404 fallbacks outside Development, marked with metadata so `DocsRoutes` ignores them.

### Pitfall 13: Golden-vector false confidence
- ORD-2026-0148 passes with the buggy `round2` too. Include midpoints; the unmodified `round2` must fail some vectors (53/220).

### Pitfall 14: jsdom `AbortSignal` vs Node's `fetch` `[ASSUMED]`
- httpClient tests inject a fake `fetch`.

### Pitfall 15: `crypto.randomUUID()` is undefined over plain-HTTP LAN addresses
- Secure-context only `[CITED: MDN]`. Fall back to `getRandomValues`, never `Math.random` (tested).

### Pitfall 16: Retry layering
- Set Query `retry: false`; httpClient owns retries.

### Pitfall 17: Barlow Condensed has **no ₱ glyph**
- Give the Barlow fallback face `unicode-range: U+0000-20B0, U+20B2-10FFFF`, so ₱ falls through to Archivo Variable. `[VERIFIED: woff2 cmap read]`

### Pitfall 18: Fontsource per-subset CSS files have no `unicode-range`
- Use the weight files (`800.css`) as App. D.6 does.

### Pitfall 19: Tailwind v4 auto source detection scans build output
- **Avoid:** `@import "tailwindcss" source("../src")` + `@source not` for tests (verified). Keep all output outside `src`.

### Pitfall 20: jsdom gaps and noisy console
- Mock `matchMedia`, disable `color-contrast` in jsdom axe, and fail on `console.error`/`warn` through a setup guard. The guard prints React's format strings unsubstituted, which is acceptable.

### Pitfall 21: Tailwind v4 `hover:` only applies on hover-capable devices
- **What goes wrong:** the built-in `hover:` compiles to `@media (hover: hover) { …:hover }`. The spec's `:hover` applies on every device, including sticky hover after a tap. Phone Playwright projects (touch) would not apply hover styles that the reference applies. `[VERIFIED: compiled output]`
- **Avoid:** `@custom-variant hover (&:hover);`. Verified to compile and to give pixel-equal hover A/B in 3 engines.

### Pitfall 22: Built-in max-width variants are off by one or nest differently
- **What goes wrong:**
  - `@max-[767px]/pg:` → `@container pg (width < 767px)`. The spec says `max-width: 767px`, i.e. ≤ 767.
  - `max-[420px]:` → `width < 420px`.
  - `max-sm:` → `width < 640px`, while the spec's `(max-width: 639px)` differs at fractional widths.
  - `@min-[768px]/pg:@max-[1023px]/pg:` nests two `@container` rules, with `< 1023px`.
  - With `--*: initial`, `@max-md/pg:` emits nothing.

  `[VERIFIED: compiled output]`
- **Avoid:** the custom variant set with the spec's exact query text.

### Pitfall 23: Cleared-theme classes fail silently
- `bg-blue-500` emits nothing: no error, no warning. `[VERIFIED]`
- **Avoid:** the class gate (`compile()` per token) in `verify`, plus the parity harness.

### Pitfall 24: Arbitrary shorthand properties re-sort after longhands
- `[font:inherit]` is emitted after `text-[15px]`/`font-[650]` and resets them (button rendered 16px/400/24px). `[VERIFIED: compiled CSS + A/B]`
- **Avoid:** never use shorthand arbitrary properties next to their longhand utilities (`[font:…]`, `[border:…]`, `[background:…]`, `[transition:…]`, `[animation:…]`). Drop `font: inherit`, since preflight covers it.

### Pitfall 25: v4 transform utilities use individual properties
- `translate-*`, `rotate-*` and `scale-*` set the CSS `translate`, `rotate` and `scale` properties, which apply in a fixed order. `scale(1.04) translateY(-52%)` cannot be reproduced with them. `-skew-x-*` uses `transform` with a variable stack. `[VERIFIED: compiled output]`
- **Avoid:** arbitrary `[transform:…]` for any multi-function or order-sensitive transform, and for single ones too where an exact computed match is wanted.

### Pitfall 26: Opacity modifiers mix in oklab
- `bg-bg/82` → `color-mix(in oklab, …)`. The spec uses `in srgb`. `[VERIFIED]`
- **Avoid:** transcribe `color-mix` literally: `bg-[color-mix(in_srgb,var(--bg)_82%,transparent)]`.

### Pitfall 27: `enabled:` doesn't match links
- `:enabled` excludes `<a>`, so a `ButtonLink` would lose its hover. Use `not-disabled:` (→ `:not(:disabled)`). `[VERIFIED]`

### Pitfall 28: A bare `transition` has zero duration under a cleared theme
- `transition-duration: var(--tw-duration, 0s)` and `ease`. Always add `duration-*` and `ease-[…]`. `[VERIFIED]`

### Pitfall 29: Cascade accidents in App. B/C are part of the approved look
- The last-row phone card has no title separator (§Specificity). Reproduce it; if it looks like a bug, ask the owner (D-08). `[VERIFIED: A/B probe]`

### Pitfall 30: Preflight differences show up in computed styles
- `border: 0 solid` vs `border: 0` (style `solid` vs `none`). Buttons get no `cursor: pointer` in v4 preflight. Both are invisible or easy to miss; the comparator normalizes the first, and parity on `cursor` catches the second. `[VERIFIED: preflight.css read; superseded D-27 border-top-style finding]`

### Pitfall 31: The scanner can't see constructed class names
- App. D.3 builds `'csp-btn-' + variant`. A converted `'bg-' + tone` silently emits no CSS. Lint bans it (verified), and recipes hold full literals.

### Pitfall 32: Vitest stubs CSS imports, even with `?raw`
- `import css from './x.css?raw'` gives `''` in component tests. Any test that inspects a stylesheet runs in the node environment and reads the file with `fs` (and lives in `tsconfig.node.json`). `[VERIFIED: superseded 02-12/02-13 SUMMARY]`

### Pitfall 33: ESLint flat config replaces a rule's options in later blocks
- A per-file `no-restricted-syntax` override silently drops every earlier selector. Keep one exported array and re-spread it. `[VERIFIED: probe]`

## Lessons from the Superseded Execution

All lessons come from `.planning/phases/02-web-foundation-design-system/superseded-2026-10-08/` (SUMMARYs, UAT, SECURITY, deferred-items, WINDOWS) and `.planning/debug/wwwroot-vite-license-served.md`. The code they describe is in history at `74621f5` (the parent of the revert `bb6ef76`).

**Server / host**
- **L-01** `MapFallbackToFile` registers **GET and HEAD only**. The matrix keys are `GET {*path:nonfile}` and `HEAD {*path:nonfile}`, not `*`. POST on a page path stays default-deny (401). That is correct; keep it with a test (`UnservedMethodOnAPagePathIsChallenged`).
- **L-02** Call `app.UseRouting()` **explicitly after `UseStaticFiles`**. `StaticFileMiddleware` skips a request that already has a matched endpoint, and the catch-all fallbacks would otherwise match real file paths.
- **L-03** Three Phase 1 tests used an unmatched page path (`/nope`) as an auth or 500 probe. Once every path matches an endpoint they must move to the Staff `GET /api/v1/site-settings` endpoint with in-memory readers (clock skew, unhandled 500) or to `POST /nope`.
- **L-04 (G-02-2)** `PhysicalFileProvider`'s `ExclusionFilters.Sensitive` checks **only the last path segment**, so `/.vite/license.md`, `/.VITE/LICENSE.MD`, `/%2Evite/license.md`, `/assets%5C..%5C.vite%5Clicense.md` and the NTFS 8.3 alias `/VITE~1/license.md` were all served (200 text/markdown, 14,203 B). **Fix design:** `HiddenSegmentFileProvider` wraps the web-root provider. It reports any path with a segment that starts with `.` or contains `~` (split on `/` **and** `\`) as missing, for both file lookups and directory listings; `Watch` delegates. The request falls through to the `{*path:file}` ProblemDetails 404 with no ETag, Last-Modified or Accept-Ranges (HEAD included). Regression fixtures `Fixtures/webroot/.vite/license.md` and `.x/y.txt`, with a `File.Exists` guard so tests can't pass vacuously. `dir /x` showed `VITE~1`, so the 8.3 row was genuinely RED on this machine. Future `/.well-known/` files need an explicit, tested exact-path exception (accepted risk AR-02-02). Build it into the **tracer** plan this time, not as a late gap closure.
- **L-05** `dotnet publish` happens to drop `**/.*/**` (SDK default excludes), but `dotnet run`, the E2E `--webroot` host and the Lighthouse host serve the raw folder. Don't rely on publish.
- **L-06** The fixture web root (`CspsApiFactory` + csproj copy item) makes the .NET suite independent of `npm run build` and of `wwwroot` existing. It closes the latent gap where two `OpenApiExposureTests` need `src/Csps.Server/wwwroot` on a fresh clone.

**npm supply chain**
- **L-07** The D-25 dev set pulled rolldown 1.2.x and two high-advisory transitive packages. The owner approved exact `overrides` + `min-release-age-exclude[]` for source-map-js 1.2.2, http-cache-semantics 4.3.0 and rolldown 1.2.11 (+15 bindings). **Re-check today (R-2):** rolldown no longer needs it after 2026-10-08T14:30Z. source-map-js (until 2026-10-14) and http-cache-semantics (until 2026-10-18) still do. Any other drift goes to the owner.
- **L-08** Until the registry learns the `npm` kind, npm exceptions can only live under `docs/dependencies.json` `approvals`. The registry validator today accepts `Kinds = ["nuget", "tool"]` `[VERIFIED: tests/Csps.ArchitectureTests/DependencyRegistry.cs:17]`. The supply-chain plan must add `npm`, read `web/package.json` + `tools/openapi-gen/package.json` (folder-qualified ids, alias resolution, **and `overrides` as pins**), move nuqs out of `planned`, and **re-create the D-26 + addendum license exceptions**, which the revert removed.
- **L-09** The dev tree hit three licenses outside D-26 (MIT-0, CC-BY-3.0, Python-2.0). The owner has now approved them (D-26 addendum). Expect the license gate to pass with about 16 production and about 522 dev packages. The optional R-3 plugin adds `mdn-data` (CC0-1.0, already covered).
- **L-10** `vite build` with `license: true` writes `.vite/license.md` into `wwwroot` (D-BL-04 still open). `web/THIRD-PARTY-NOTICES.txt` (generated, drift-checked) listed all 16 shipped packages, against Vite's 5.

**Code-level**
- **L-11** C# `private const decimal Hundred` left one uncovered static-constructor line under the Domain 100% gate. Use the literal `100m`.
- **L-12** `Number(centavos) / 100` loses precision at 1e21. Convert through the exact decimal text. NaN/Infinity count as 0.
- **L-13** `{...rest}` spreads keep React Compiler memo branches from ever hitting, so coverage fell to 76.8–90%. Prefer explicit props, and add equal-props re-render tests.
- **L-14** `exactOptionalPropertyTypes` means "no body" is `null`. A per-folder coverage run needs `--coverage.include=<folder>/**`, because global thresholds apply to every included file.
- **L-15** TanStack Query **5.103.2 marks `prefetchQuery` `@deprecated`** and `@typescript-eslint/no-deprecated` fails on it. Use `queryClient.query(options).catch(() => undefined)` (identical behaviour).
- **L-16** **nuqs shallow writes bypass React Router's location**: `useLocation().search` keeps the old query after `setPage(2)` (memory and browser routers both). Tests assert `window.location.search` with `createBrowserRouter`.
- **L-17** nuqs keeps a key where it already was (`URLSearchParams.set`). The required order (page, size, q, rest by name) needs `processUrlSearchParams`. The nuqs testing adapter echoes typed values into raw reads, so normalize only string raw values.

**Lint / format / tooling**
- **L-18** Prettier honours the root `.editorconfig` `indent_size = 4`. Set `"tabWidth": 2, "useTabs": false` in `web/.prettierrc.json` and add `[web/**] indent_size = 2` to `.editorconfig`.
- **L-19** react-hooks 7.1.1 `recommended` ships three **warn** rules. Escalate warn → error with options kept (an `escalate()` helper), and test both the raw and resolved configs. Keep **one** `no-restricted-syntax` array (Pitfall 33).
- **L-20** `jsx-a11y-x/aria-role` treats a literal `role="manager"` prop (a user role) as an ARIA role. Pass the role as a typed variable at call sites.
- **L-21** The console guard needs a narrow `no-console: off` block for its own files. Deliberate axe-violation fixtures need per-line `eslint-disable-next-line … -- deliberate`, and unused directives are errors.
- **L-22** **Windows can't `spawnSync` `.cmd` shims without a shell.** Run `process.execPath` with the package's JS entry. Bash heredocs halve doubled backslashes on this Windows spawn path, and inline `node -e` edits mangled regex backslashes twice; use the Write/Edit tools for files.
- **L-23** Playwright CSP findings must go through `exposeBinding` to survive navigation. Name the fixture callback `provide`. MSBuild node-reuse workers linger for minutes after `dotnet run`; they are not servers, so don't kill them.
- **L-24** user-event 14 never resolves under Vitest fake timers (even with `delay: null`), and axe hangs on fake timers. Debounce tests fire input events per character on fake timers; everything else, including axe, runs on real timers.
- **L-25** A concurrency test that aborts before the request reaches `fetch` leaves a planned fake answer unconsumed. Wait (`vi.waitFor`) until requests are in flight. `JSON.stringify(undefined)` is `undefined`, so a no-data submission must serialize as a comparable sentinel to reuse its Idempotency-Key.
- **L-26** **TDD RED-evidence checker quirk:** in JUnit XML its `name="` regex matches inside `classname="` first, so Vitest records target the **test file** (name the exact case in `expected`). .NET records use the fully qualified name, and theory targets need `&quot;` entities. A RED that fails on a missing module or a compile error is **INVALID_RED**: commit inert placeholders with the RED tests.
- **L-27** `[x].flat(Infinity)` on Vite's `PluginOption` hits TS2589; use a small recursive flatten. The `@rolldown/plugin-babel` filter receives `string | undefined`.
- **L-28** The Vitest JUnit reporter writes `web/.vitest/junit/output.xml`. Gitignore `web/.vitest/`.

**Visual / owner process**
- **L-29** The superseded review pack found that `.s-page` inline-size containment shrinks flex panels in isolated renders (clipped sidebars). Give showcase/parity frames a fixed width wrapper. The pack must rebuild when sources are newer than the bundle, not only when the bundle is missing.
- **L-30** The owner was away during execution. Items that needed the owner (D-BL-01..04) were parked in backlog 999.1 rather than decided. Keep that discipline, and batch owner questions into **one** plain-words checkpoint early (R-1..R-6) so execution isn't blocked mid-phase. UAT items 7/11/12 (visual effects in the browser) were blocked because the showcase came late; the new plan brings the showcase and parity harness forward.

## Plan-Shaping Guidance (from-scratch Phase 2 under D-33)

**Principles:** tracer-first, TDD (RED with inert placeholders, never a compile error), each conversion slice gated by the parity harness, owner questions batched at the start, style-independent work in parallel.

| Wave | Plan (suggested) | Content | Superseded counterpart |
|---|---|---|---|
| 1 | **T1 Tracer: scaffold + host + theme** | Owner checkpoint R-1..R-6 (one batch); `web/` install per D-25 (`.npmrc`, lockfile, `tools/openapi-gen`); `.gitattributes`/`.editorconfig`/`.gitignore` (L-18, Pitfall 4); `app.css`/`base.css` token theme + variant set; placeholder page with the designed page root in utilities; build into `wwwroot`; SPA host with **all** server lessons (L-01..L-06: fixture web root, HiddenSegmentFileProvider, explicit UseRouting, GET/HEAD rows, D-29, compression, caching); SpaHostTests; matrix rows | 02-01 + 02-19 |
| 2 | **Static gates** | TS 7 configs (node program for node-env tests); ESLint with all bans, incl. D-33 (one array; escalate warns); Prettier; Vitest console guard + axe helper; **stylesheet-contract test**; **class gate** (`compile()` + TS AST); lint-rule tests | 02-02 (+ D-33 additions) |
| 2 | **Parity harness tracer** | `scenarios.ts`; reference extraction + hash pin + frozen D.3/D.4/D.5 (LF-equal to spec) + `rulings.css`; `vite.reference.config.ts`; showcase skeleton; `parity.spec.ts` + route-served config with StrictCsp; **Button family converted and green in chromium/firefox/webkit**, with comparator self-tests (a deliberate 1px change must fail) | new (replaces 02-09's DOM differential) |
| 3 (parallel) | Supply chain | npm kind in registry (+ overrides as pins), D-26 + addendum exceptions re-created, license gate, notices, D-BL-04 outcome | 02-03 |
| 3 | Money math | Golden vectors (≥ 200), OrderMath, csps.ts D-09, formatters | 02-04 |
| 3 | Playwright host | HTTPS 5199, fixtures (console/CSP binding/axe), self-tests, e2e.mjs (L-22) | 02-06 |
| 3 | HTTP client | httpClient 100% | 02-07 |
| 3 | URL state + Query | nuqs hooks/parsers/layout, Query defaults, debounce, prefetch via `query()` (L-15..L-17) | 02-08 |
| 3 | Fonts | fontsource imports, fallback faces in base.css, preload plugin, font-metrics test | 02-05 (font half) |
| 4 | **Convert D.3 slice A**: actions, status, forms, nav atoms | Icon (lucide map), Mark (JSX), Logo, motifs, Button/ButtonLink/IconButton/LinkButton, Badge/StatusBadge/Avatar (O-1), Field/PasswordField/Select, SegmentedControl, Tabs (ARIA) — each with parity scenarios + unit/axe | 02-09 (TS reconciliation) + 02-05 (styles) |
| 4 | API contract | OpenAPI snapshot + drift, api.ts, useSubmission, focusFirstInvalid, describeHttpError | 02-10 |
| 5 | **Convert D.3 slice B**: data display | Money, KpiCard, OrderTotals, OrderCard, DataTable, IncomeExpenseChart (custom-property tooltip), MediaPlaceholder, ImageUploader (D-05), EmptyState, Skeleton | 02-09 |
| 5 | **Convert D.3 slice C**: overlays, feedback, navigation, marketing | Modal (focus trap), ConfirmDialog, Toast/ToastProvider (D-04, O-5, O-7), SiteHeader (O-3), Sidebar (D-27, D-BL-02, tablet rail), Topbar, CategoryCard/ProcessSteps/TestimonialCard (O-2) | 02-09 + 02-11 |
| 6 | SPEC-GAP forms | MoneyInput, OtpInput, Checkbox (D-03), SkipLink, PasswordField | 02-12 |
| 6 | SPEC-GAP lists | ResponsiveTable (incl. the last-row accident), Pagination, SearchBox/FilterBar/ResultBar/FilterChip, ErrorState, Skeleton family/LoadingRegion, LazyImage | 02-13 |
| 7 | Router + public layout | Data router, error boundary, PublicLayout (header/footer parity vs App. E.1), placeholder page, D-20 exclusion | 02-14 |
| 7 | Admin dev shell | AdminLayout (parity vs App. E.6 shell), theme toggle (D-13), MobileNavDrawer, UserMenu, tab bar, UrlStateLayout placement | 02-15 |
| 8 | Showcase + budgets + verify | Full showcase over `scenarios.ts`, budget plugin (+ one-CSS assertion), final `verify`, full parity matrix | 02-16 |
| 9 | Browser gates | Lighthouse, responsive sweep (8 widths × 2 orientations), ₱ font proof, WCAG rulings on computed styles, keyboard journeys | 02-17 |
| 10 | Owner visual review | D-23 screenshots (390/820/1440), D-24 local side-by-side (guarded), parity summary, owner verdict | 02-18 |

- **Where the conversion slots in:** the theme and variant set in wave 1 (so the class gate has a theme to compile against), the harness in wave 2, the components in waves 4–7. The style-independent plans (wave 3) can start the moment the static gates exist.
- **Reuse question (Q-4):** much of wave 3 existed and was tested at `74621f5`. The planner may reference it (`git show 74621f5:<path>`) as a reference implementation, but TDD RED evidence is still required for each task.
- **Sizing note:** the parity matrix is the expensive part. Tag scenarios `responsive`/`stateful` to keep chromium under about 5 minutes.

## Code Examples

### Root error callbacks (WEB-05 "logs nothing to the console in production")
```tsx
// React 19 createRoot options exist in react-dom 19.3 (types: @types/react-dom client.d.ts:22-26) [VERIFIED 2026-10-07]
createRoot(rootEl, {
  onCaughtError: import.meta.env.PROD ? () => {} : undefined,
  onUncaughtError: import.meta.env.PROD ? () => {} : undefined,
}).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
```

### Business-zone date formatting (ORD-09)
```ts
// node 24 probe: formats 2026-10-05T16:30:00Z as "Oct 6, 2026" in Asia/Manila [VERIFIED]
const fmt = (zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric' });
export const formatBusinessDate = (utcIso: string, zone = 'Asia/Manila'): string => fmt(zone).format(new Date(utcIso));
```

### Theme init without inline script (D-13)
```tsx
const readTheme = (): 'light' | 'dark' => { try { return localStorage.getItem('csps-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
const [theme, setTheme] = useState(readTheme); // lazy initializer: no effect, no setState-in-effect lint
return <div className="@container/pg relative min-h-full bg-bg text-ink font-sans text-[16px] leading-6" data-theme={theme}>…</div>;
```

### Context marker + descendant variant (rule 21b), and the D-BL-02 tag
```tsx
// Toolbar region marks its context; the Field input reacts at any depth, exactly like `.s-toolbar .csp-input`
<div data-ui="s-toolbar" role="search" className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4">…</div>
const inputCls = 'h-11 text-[16px] in-data-[ui=s-toolbar]:h-10 in-data-[ui=s-toolbar]:text-[14px] pg-phone:in-data-[ui=s-toolbar]:text-[16px]'; // D-01
// Sidebar item: aria-current drives both the look and D-BL-02
<Link to={n.to} aria-current={on ? 'page' : undefined} className={clsx(navItemClasses, 'group/nav')}>
  <Icon name={n.icon} size={20} /><span>{n.label}</span>
  {n.manager && !collapsed && <span className="ml-auto text-[10px] font-bold tracking-[.08em] text-nav-ink uppercase group-aria-[current=page]/nav:hidden">Manager</span>}
</Link>
```

### Dynamic value through a custom property only (CSP-safe, lint-allowed)
```tsx
// Skeleton: width/height props are open-ended → custom properties; utilities consume them
<span aria-hidden="true" style={{ '--sk-w': width, '--sk-h': height }}
  className="block h-(--sk-h) w-(--sk-w) animate-csp-shimmer rounded-[6px] bg-[image:linear-gradient(90deg,var(--surface-2)_0%,var(--line)_50%,var(--surface-2)_100%)] bg-size-[200%_100%] motion-reduce:animate-none" />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Spec CSS classes + utilities as glue (App. A.2 §2.3) | **Utilities for all UI styles, CSS only for theme/fonts/keyframes/base** | Owner D-33 (2026-10-08) | This refresh |
| Verbatim-CSS byte check + DOM differential | **Same-run visual parity (computed style + pixels) vs a test-only reference** | D-33 | §Proving |
| Tailwind v3 `hover:` (any device) | v4 `hover:` gated by `@media (hover: hover)` | Tailwind 4.0 | Override with `@custom-variant hover (&:hover)` |
| v3 `transform` utilities | v4 individual `translate`/`rotate`/`scale` properties | Tailwind 4.0 | Arbitrary `[transform:…]` for order-sensitive cases |
| `react-router-dom` + `<BrowserRouter>` | `react-router` 8 data router | RR v8 | Unchanged |
| `typescript` = the compiler | TS 7 native `tsc` + TS 6 API alias | TS 7.0 | Unchanged |
| `eslint-plugin-jsx-a11y` | `eslint-plugin-jsx-a11y-x` | ESLint 10 | Unchanged |
| Manual cool-down discipline | npm `min-release-age` | npm 11.x | Unchanged |
| `@lhci/cli` | `lighthouse` 13 + assert script | D-25 | Unchanged |
| `queryClient.prefetchQuery` | `queryClient.query(...).catch(noop)` | TanStack Query 5.103 deprecation | L-15 |

**Deprecated / outdated in project docs:**
- `02-UI-SPEC.md` "CSS file contract" (verbatim files + `spec-gaps.css` + `overrides.css`) and its "Styling" row (utilities as glue only) are superseded by D-33 and need a refresh (Q-5).
- CLAUDE.md still names `@lhci/cli` (superseded by D-25).
- STACK.md "import per-subset fontsource CSS" is wrong (Pitfall 18).
- CONTEXT/UI-SPEC "57 icons": it is **56** in App. D.5. `[VERIFIED 2026-10-07]`
- A11Y-01 wording "vitest-axe per component" is superseded by D-18.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A3 | A jsdom-realm `AbortSignal` passed to Node's fetch throws | Pitfall 14 | None if fetch is injected anyway |
| A4 | `crypto.getRandomValues` is available in insecure contexts | Pitfall 15 | Fallback UUID would also fail on LAN http |
| A5 | Lighthouse treats a 4xx `robots.txt` as "no robots.txt" | Pattern 13 | Ship `web/public/robots.txt` anyway |
| A6 | IIS (Phase 3) leaves app-compressed responses alone | Pitfall 3 | web.config fix in Phase 3 |
| A7 | Chromium CDP `CSS.getPlatformFontsForNode` can prove which font rendered ₱ | Pattern 14 / Validation | Fall back to `document.fonts.check` + screenshot review |
| A10 | `no-restricted-imports` `patterns.group` honours `!` negation for the CSS-import ban | Pattern 6 | Use a custom selector on `ImportDeclaration[source.value=/\.css$/]` with an allow-list instead |
| A11 | tailwind-merge would cost about 7–8 KB gz in the public entry | Alternatives | Only matters if the owner wants it (not recommended) |
| A12 | A `peer-checked:` sibling tick is more portable than `::before` on an `appearance: none` checkbox | Owner rulings (D-03) | Either works in current engines; the parity/owner review decides |
| A13 | Module-level variant maps raise no React Compiler diagnostics | Flag 2 | Visible immediately as react-hooks lint errors; opt out with `'use no memo'` + deviation note |
| A14 | The full parity matrix fits about 5 min in Chromium with responsive/stateful tagging | §Proving | Split into `@parity` subsets per plan; run the full matrix at wave merges |

Resolved since the first pass: **A1** (axe/listeners under CSP: works, superseded 02-06), **A2** (`--webroot` works, superseded 02-06), **A8** (startTransition selector: no false positives, superseded 02-02), **A9** (compiler on nuqs hooks: clean, superseded 02-08).

## Open Questions (owner / planner decisions)

1. **Q-1 (owner, R-1):** lucide-react 1.52.0 (approved, D-32 reviewed) or 1.53.0 (D-11 "newest", drawings identical for all 56 icons)? Recommendation: 1.52.0.
2. **Q-2 (owner, R-6 = D-BL-04):** publish third-party credits (A), keep them repo-only (B), or keep Vite's file out of the web root (C)? Recommendation: A. The plan sets `build.license: false` until ruled.
3. **Q-3 (owner, R-3/R-4):** adopt the optional `eslint-plugin-better-tailwindcss` 4.7.0 and/or `prettier-plugin-tailwindcss` 0.8.1? Recommendation: neither (the in-house class gate covers correctness); R-3 only if editor feedback is wanted.
4. **Q-4 (owner/planner):** may plans use the superseded, style-independent code at `74621f5` as a reference implementation (SPA host, HiddenSegmentFileProvider, OrderMath + vectors, httpClient, nuqs/Query, api.ts, license gate, Playwright fixtures)? It saves substantial time, and RED evidence is still written first. The owner's "from scratch" instruction makes this the owner's call.
5. **Q-5 (planner):** refresh `02-UI-SPEC.md` for D-33 before planning (its CSS file contract, Styling row and the SPEC-GAP "spec-gaps.css" wording). Run `/gsd-ui-phase 2` again or have the planner patch those sections. Without it, the plan-checker will see contradictions.
6. **Q-6 (planner, discretion):** class hooks. Recommendation: no `.csp-*`/`.s-*` classes; `data-ui` markers only where a context variant needs one.
7. **Q-7 (planner, discretion):** spacing in px (`--spacing: 4px`, identical to the spec at any browser font-size setting) vs Tailwind's rem default (identical only at a 16px root). Recommendation: px, because "today's rendering" is px.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | web build/test | ✓ | 24.21.0 (≥ 24.15 for jsdom 30) | — |
| npm | install, `min-release-age` | ✓ | 11.19.0 | — |
| .NET SDK | SPA host, xUnit vectors | ✓ | 10.0.401 | — |
| ASP.NET dev HTTPS cert | E2E host on https 5199 | ✓ (valid to 2027-10-04) | — | `dotnet dev-certs https` |
| Google Chrome | Lighthouse | ✓ | installed | Playwright Chromium via `--chrome-path` |
| Playwright browsers chromium 1243 / firefox 1543 / webkit 2359 | E2E + parity | ✓ in `%LOCALAPPDATA%\ms-playwright` `[VERIFIED: ls 2026-10-08]` | exact match for 1.63.0 | `npx playwright install` (additive) |
| LocalDB `(localdb)\CSPS` | E2E DB `CSPS_E2E`, .NET tests | ✓ | SQL 2025 | — |
| `C:\Work\dev-tools\preflight.ps1` | Shared-machine rule | ✓ | — | `reuseExistingServer: false` errors on busy port |
| Docker | — | not used (forbidden locally) | — | — |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework (web unit/component) | Vitest 5.0.x + jsdom 30.1.1 + RTL 16 + in-house axe helper |
| Framework (node-env tests: stylesheet contract, class gate, config, golden vectors, scripts) | Vitest 5.0.x with `// @vitest-environment node`, typed by `tsconfig.node.json` |
| Framework (E2E) | Playwright 1.63.0 + @axe-core/playwright 4.13.0, host on HTTPS 5199 |
| Framework (visual parity) | Playwright 1.63.0, `playwright.visual.config.ts`, route-served, chromium/firefox/webkit |
| Framework (.NET) | xUnit v3 4.x on MTP (existing) |
| Config files | `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts`, `web/visual/playwright.visual.config.ts`, `web/visual/vite.reference.config.ts` — **all Wave 0** |
| Quick run (web) | `npm --prefix web run test -- --run <path-or-pattern>` |
| Quick run (.NET) | `dotnet test --project tests/Csps.Domain.UnitTests` |
| Full web suite | `npm --prefix web run verify` = typecheck + lint (`--max-warnings 0`) + `prettier --check` + `vitest run --coverage` (incl. stylesheet contract + class gate) + `build` (budgets) + license gate |
| Visual parity | preflight, then `npm --prefix web run parity` (builds `.reference-dist` + `.e2e-dist`, runs the route-served A/B) |
| E2E | preflight, then `npm --prefix web run e2e` |
| Lighthouse | `npm --prefix web run lighthouse` |
| Full .NET | `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx` (after preflight) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| WEB-01 | Build emits `index.html` + assets into `wwwroot`; dev config 5180/strictPort/proxy; `license` per D-BL-04 | unit (config) + script | `vitest run src/test/build-config.test.ts`; `npm run build` | ❌ Wave 0 |
| WEB-01 | SPA shell anonymous (GET/HEAD); `/api/*` ProblemDetails 404; missing file 404; dot/backslash/8.3 paths 404 with no file metadata; reserved docs 404 outside Dev; compression/caching; matrix rows | .NET integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHost*"`; `--filter-class "*HiddenSegmentFileProvider*"`; `--filter-class "*Authorization*"` | ❌ Wave 0 |
| WEB-01 | .NET suite independent of `src/Csps.Server/wwwroot` (fixture web root) | .NET integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiExposure*"` on a tree without `wwwroot` | ✅ tests exist; ❌ fixture root |
| WEB-02 | CSS holds only allowed constructs (no class selectors, no `@utility`/`@apply`) | unit (node) | `vitest run src/styles/stylesheet-contract.test.ts` | ❌ Wave 0 |
| WEB-02 | Every class token compiles against the CSPS theme; no default palette; no hex/rgb/oklch tokens; no text opacity outside the allow-list | unit (node) | `vitest run scripts/tailwind-classes.test.ts` | ❌ Wave 0 |
| WEB-02 | Reference = spec App. A–D (LF-equal, hash-pinned); frozen D.3/D.4/D.5 equal the spec blocks | unit (node) | `vitest run visual/reference/spec-extract.test.ts` | ❌ Wave 0 |
| WEB-02 | Rendered look equal to the reference (+ rulings) per scenario/state/theme at 320/390/820/1440; comparator self-test fails on a deliberate 1px change | visual parity | `npm --prefix web run parity` (`--grep @parity`) | ❌ Wave 0 |
| WEB-02 | Modal focus trap/return, Tabs ARIA/roving, Mark JSX, no non-null assertions | component + axe + lint | `vitest run src/ui` | ❌ |
| WEB-03 | httpClient behaviours, 100% lines/branches | unit | `vitest run src/lib/http --coverage "--coverage.include=src/lib/http/**"` | ❌ |
| WEB-04 | Lint rejects fetch/httpClient/axios outside api.ts; nuqs bans; **D-33 bans** (style prop, class concatenation/template, cssText, setAttribute style, CSS imports) | unit (ESLint `Linter`) | `vitest run src/test/lint-rules.test.ts` | ❌ |
| WEB-05 | Layout landmarks, skip link, one h1, error boundary UI, admin excluded from prod build | component + build assertion | `vitest run src/app`; budget plugin asserts no admin chunk | ❌ |
| WEB-06 | Each SPEC-GAP primitive behaviour + zero axe | component | `vitest run src/ui/gaps` | ❌ |
| WEB-07 | ≥ 200 golden vectors pass in TS; unmodified round2 fails some | unit | `vitest run src/lib/csps.golden.test.ts` | ❌ |
| WEB-07 | Same vectors pass in C# `OrderMath` | xUnit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMathGoldenVector*"` | ❌ |
| WEB-08 | Query defaults, keepPreviousData, 300 ms debounce, signal cancellation, prefetch via `query()` | component (fake timers) | `vitest run src/lib/query` | ❌ |
| WEB-09 | One key per submission, reused on retry and refresh-retry; pending button `aria-disabled` look; one request per double-click | unit + component + parity | `vitest run src/lib/http src/lib/forms src/ui`; parity `pending` state | ❌ |
| WEB-10 | Parsers, push vs replace, page reset, dropped defaults, rewrite-once, `window.location.search` assertions | unit + component | `vitest run src/lib/url-state` | ❌ |
| ORD-09 | `₱12,450.00`, `−₱…`, `Oct 6, 2026`; MoneyInput pattern, paste, blur pad, `inputMode=decimal` | unit + component | `vitest run src/lib/format src/ui/gaps/MoneyInput` | ❌ |
| QUAL-02 | 0 type errors (TS 7), 0 lint warnings, Prettier clean; no warn-level rule | gate + unit | `npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check`; `vitest run src/test/eslint-config.test.ts` | ❌ |
| QUAL-04 | E2E fails on console error/warning, CSP violation, axe violation (fixture self-tests) | E2E | `npm --prefix web run e2e -- --grep @fixture` | ❌ |
| A11Y-01 | Zero axe violations: placeholder, admin previews, showcase (both themes); parity suite also runs axe | E2E | `npm --prefix web run e2e -- --grep @axe` | ❌ |
| A11Y-02 | Skip link focuses `#main`; dialog trap/return; drawer; user menu arrows | E2E + component | `npm --prefix web run e2e -- --grep @keyboard` | ❌ |
| A11Y-04 | Rulings on computed styles: no text with opacity < 1; no focused element invisible; D-03 weight cue; D-BL-02 tag hidden; O-3 italic; O-6 reduced motion | parity (rulings layer) + E2E | `npm --prefix web run parity -- --grep @rulings`; `e2e --grep @a11y-rulings` | ❌ |
| PERF-01 | Budgets fail the build over limits; exactly one CSS asset | unit + build | `vitest run scripts/budget.test.ts`; `npm run build` | ❌ |
| PERF-02 | Lighthouse ≥ 95 all categories, LCP < 2 s, CLS < 0.05 | Lighthouse script | `npm --prefix web run lighthouse` | ❌ |
| PERF-03 | No horizontal scroll at 8 widths × 2 orientations; text inputs ≥ 16 px on phones | E2E | `npm --prefix web run e2e -- --grep @responsive` | ❌ |
| PERF-05 | `document.fonts.check('16px "Archivo Variable"','₱')`; ₱ never system font; one preload link; woff2 only `font-src 'self'`; committed fallback metrics reproduce the brand metrics | E2E + unit | `npm --prefix web run e2e -- --grep @fonts`; `vitest run scripts/font-metrics.test.ts` | ❌ |
| (registry) | `docs/dependencies.json` covers both npm manifests incl. `overrides`, kind `npm`; D-26 exceptions present | .NET arch test + node gate | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"`; `node web/scripts/license-gate.mjs` | ✅ exists; needs `npm` kind |
| (D-16) | Committed `openapi.v1.json` equals live Development doc; generated TS matches | .NET integration + node script | `dotnet test … --filter-class "*OpenApiSnapshot*"`; `npm --prefix tools/openapi-gen run check` | ❌ |

### Sampling Rate
- **Per task commit:** the quick Vitest pattern for the touched folder, plus `npm --prefix web run typecheck`. Conversion tasks also run the parity cases of the touched component (`npm --prefix web run parity -- --grep <component>`, chromium).
- **Per wave merge:** `npm --prefix web run verify`, the full parity matrix (3 engines), and `dotnet test --solution Csps.slnx`.
- **Phase gate:** the full web and .NET suites, then E2E (after preflight), parity, and Lighthouse, all green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `web/` scaffold: `package.json` (D-25 pins), `.npmrc`, lockfile, tsconfigs (node program lists node-env tests), `eslint.config.mjs`, `.prettierrc.json` (tabWidth 2), `.prettierignore`, `vite.config.ts`, `index.html`, `public/`
- [ ] `.gitattributes` (re-create) + `.editorconfig` `[web/**]` + `.gitignore` (`src/Csps.Server/wwwroot/`, `web/.e2e-dist/`, `web/.budget-dist/`, `web/.reference-dist/`, `web/visual/.reference-src/`, `web/.vitest/`, `web/test-results/`)
- [ ] `web/src/styles/app.css` + `base.css` (theme, variants, tokens) + `stylesheet-contract.test.ts` + `scripts/tailwind-classes.test.ts`
- [ ] `web/src/test/setup.ts` (jest-dom, console guard, `matchMedia`), `axe.ts`, `fakeFetch.ts`
- [ ] `web/visual/` harness (extraction + hash pin + frozen D.3–D.5 + `rulings.css` + reference config + `parity.spec.ts` + comparator self-test) and `web/src/dev/scenarios.ts`
- [ ] `web/playwright.config.ts` + `e2e/fixtures.ts` (console / CSP via `exposeBinding` / axe) + self-tests + `scripts/e2e.mjs`
- [ ] `scripts/vite-budget-plugin.ts` + pure `budget.ts` + tests; `scripts/lighthouse-assert.mjs`
- [ ] `tests/fixtures/order-math-golden-vectors.json` + generator; `src/Csps.Domain/Orders/OrderMath.cs` + xUnit theory
- [ ] `tests/Csps.Testing/Fixtures/webroot/` (incl. `.vite/license.md`, `.x/y.txt`) + `CspsApiFactory` web root + csproj copy item; SpaHostTests; HiddenSegmentFileProviderTests; matrix rows
- [ ] `tests/Csps.ArchitectureTests`: `DependencyRegistry` `Kinds` gains `"npm"` (today `private static readonly string[] Kinds = ["nuget", "tool"];` `[VERIFIED: tests/Csps.ArchitectureTests/DependencyRegistry.cs:17]`); `PackagePins` reads both npm manifests incl. `overrides`; nuqs moves from `planned` to `packages`
- [ ] npm license gate + `docs/license-exceptions.json` npm section (D-26 + addendum) + THIRD-PARTY-NOTICES (D-BL-04 outcome)

## Security Domain

`security_enforcement` is enabled with ASVS Level 1 (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V1 Architecture | yes | Default-deny auth retained; SPA host endpoints are explicit anonymous allow-list entries with matrix rows (GET/HEAD shell, file 404, reserved prefixes) |
| V2 Authentication | no (Phase 4) | — |
| V3 Session Management | no (Phase 4); httpClient designed for bearer + refresh | No tokens in URLs or `localStorage` (only theme is stored) |
| V4 Access Control | yes | Admin, `/dev` routes and the parity reference absent from production builds (D-20), proven by build/budget assertions |
| V5 Input Validation | yes | nuqs allow-list parsers (CWE-20), MoneyInput regex, search ≤ 100 chars; server authoritative (SEC-03) |
| V7 Error Handling | yes | Error boundary shows plain copy + traceId; `onCaughtError` silent in prod |
| V8 Data Protection | yes | No PII as structured URL params; no source maps in prod; build internals (dot folders) never served |
| V10 Malicious Code / supply chain | yes | `min-release-age=14`, exact pins, lockfile, `npm audit --audit-level=high`, license gate, registry test, class gate (no runtime class merging lib) |
| V14 Configuration | yes | Strict CSP unchanged (no relaxation for Tailwind; style prop limited to CSSOM custom properties); headers on static responses; compression limited to static text types |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| XSS via `dangerouslySetInnerHTML` / HTML strings (CWE-79) | Tampering | Lint ban; `Mark` as JSX; strict CSP second layer (the frozen reference's D.4 HTML stays test-only) |
| Inline style injection / CSP relaxation pressure from styling | Tampering | Tailwind emits one external CSS file; `style` prop limited to `--*` custom properties (CSSOM, verified CSP-safe); `cssText`/`setAttribute('style')` banned; parity suite serves with the real StrictCsp |
| Class-name injection from data (attacker-controlled class tokens) | Tampering | Class tokens are literals or map lookups keyed by typed unions; no class token built from API data (lint bans concatenation) |
| Build internals exposed from the web root (CWE-200/538/497; path equivalence CWE-41/58) | Info disclosure | HiddenSegmentFileProvider (dot and `~` segments, `/` and `\`), identical 404 with no file metadata (CWE-204) |
| Open redirect via URL params (CWE-601) | Spoofing | Params never reach `href`/`navigate()` unvalidated |
| Supply-chain compromise via fresh releases (T1195) | Tampering | npm `min-release-age`, exact pins, owner-approved exceptions only, advisory check at install |
| Dev-only or test-only code shipped (showcase seed data, admin routes, parity reference) (CWE-489) | Elevation / Info disclosure | Compile-time `__DEV_ROUTES__`; reference lives in `web/visual/` with its own outDir; build assertion that `wwwroot` holds no reference/dev modules |
| BREACH via compressed secrets | Info disclosure | Compress only static html/css/js/svg; never JSON |
| Sensitive data in URLs/history (CWE-598) | Info disclosure | Only `q` free text; key names refused at hook creation; Referrer-Policy strict-origin-when-cross-origin |
| Design files leaked (D-24, T-02-49) | Info disclosure | Local-only report guarded by `git check-ignore`; never in CI; never `git add -f` |
| `localStorage` tampering of theme | Tampering | Accept only `'light' \| 'dark'`; try/catch |

## Sources

### Primary (HIGH)
- **npm registry** (`registry.npmjs.org` metadata), read 2026-10-07 and again on 2026-10-08 for every D-25 package plus prettier-plugin-tailwindcss, eslint-plugin-better-tailwindcss, eslint-plugin-tailwindcss, tailwind-merge, class-variance-authority, tailwind-variants, @tailwindcss/cli, @tailwindcss/node, lucide-react 1.53.0, rolldown 1.2.10–1.2.13, source-map-js 1.2.2 and http-cache-semantics 4.3.0. Also the npm downloads API.
- **npm bulk advisory endpoint** (2026-10-08) for the candidate trees: only source-map-js < 1.2.2 (GHSA-68fv-2mgg-jv7q).
- **Local probes 2026-10-08** (session scratchpad, outside the repo):
  - **tailwindcss 4.3.3 CLI** compile output for the theme, variants and all rule categories.
  - **A/B parity probe**: spec CSS vs Tailwind conversion in Chromium 1243 / Firefox 1543 / WebKit 2359 via @playwright/test 1.63.0; computed styles, boxes, pixels.
  - **CSP probe** of 6 style mechanisms in 3 engines.
  - **ESLint 10.11.0** selector probes and flat-config override probe.
  - **eslint-plugin-better-tailwindcss 4.7.0** rule probe.
  - **tailwindcss `compile()`** known/unknown probe.
  - **synthetic conversion** CSS/JS size estimate.
  - **`min-release-age=14`** install + `npm audit` of the plugin tree.
  - **lucide-react 1.52.0 vs 1.53.0** tarball diff.
  - **react-dom 19.3.0** source read.
- **Local probe 2026-10-07** (first pass): installs, builds, TS 7/6 type checks, ESLint, React Compiler logger, woff2 cmaps, lucide icon diff.
- **Repo files read this session:**
  - `.planning/phases/02-…/02-CONTEXT.md`, `02-UI-SPEC.md`, `02-RESEARCH.md` (previous version)
  - `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
  - `CSPS-UI-SPEC.md` (§0, §2, App. A–C in full, App. D.3 excerpts, D.5 header)
  - `src/Csps.Server/Http/SecurityHeadersMiddleware.cs:1-35`, `Program.cs:19`
  - `tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs`, `Authorization/AuthorizationMatrix.cs:55-62`
  - `tests/Csps.ArchitectureTests/DependencyRegistry.cs:15-18`, `tests/Csps.Testing/CspsApiFactory.cs`
  - `docs/license-exceptions.json`, `docs/allowed-licenses.json`, `docs/dependencies.json` (nuqs planned entry), `.gitignore`
- **Superseded history (lessons):**
  - `superseded-2026-10-08/02-01..02-13, 02-19 SUMMARY`, `02-UAT.md`, `02-SECURITY.md`, `deferred-items.md`, `WINDOWS.md`
  - `.planning/debug/wwwroot-vite-license-served.md`, `.planning/phases/999.1…/DECISIONS.md`
  - `git show 74621f5:` `web/package.json`, `web/.npmrc`, `.gitattributes`, `web/src/styles/overrides.css`, `tests/Csps.Testing/CspsApiFactory.cs`, `src/Csps.Server/Endpoints/SpaHosting.cs`, `Program.cs` diff, `web/package-lock.json`

### Secondary (MEDIUM, official docs via WebFetch, first pass)
- [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/?p=5246)
- [WHATWG HTML: prepare the script element](https://html.spec.whatwg.org/multipage/scripting.html)
- [Serve static files in ASP.NET Core (aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/static-files?view=aspnetcore-10.0)
- [MDN Crypto.randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
- [WebKit bug 250776](https://bugs.webkit.org/show_bug.cgi?id=250776)
- `@vitejs/plugin-react` 6.1.1, `eslint-plugin-react-hooks` 7.1.1 and `eslint-plugin-jsx-a11y-x` 0.2.0 READMEs (tarballs)
- @playwright/test 1.63.0 type definitions (`testInfo.snapshotPath`, `toMatchSnapshot`, `snapshotPathTemplate`)

### Tertiary (LOW)
- WebSearch on CSSOM vs CSP (old W3C webappsec list posts; superseded by this session's 3-engine probe): [public-webappsec 2013-02](https://lists.w3.org/Archives/Public/public-webappsec/2013Feb/0015.html), [public-webappsec 2012-10](https://lists.w3.org/Archives/Public/public-webappsec/2012Oct/0056.html), [centralcsp style-src-attr](https://next.centralcsp.com/en/docs/web-security/policies/content-security-policy/directives/style-src-attr)
- First-pass WebSearch pages on WebKit localhost behaviour and CSP/JSON-LD (located the primary sources only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Re-read on the registry and advisory endpoint today; the D-25 set installed cleanly in the first pass and in 13 executed plans.
- Tailwind conversion design: HIGH for every compile fact (tailwindcss 4.3.3 output read directly). HIGH for parity feasibility (pixel- and style-equal in 3 engines for the converted samples). MEDIUM for the effort and runtime of the full matrix (A14).
- CSP: HIGH (3-engine probe + React source read).
- Budgets after conversion: MEDIUM (synthetic, pessimistic estimates; the real build plugin measures from day 1).
- Lessons: HIGH (taken from executed SUMMARYs, UAT and the debug session).
- Pitfalls: HIGH for 1–4, 7–13, 16–33 (probe, source read or execution evidence). MEDIUM/ASSUMED for 14, 15.

**Research date:** 2026-10-07 (first pass), refreshed 2026-10-08
**Valid until:** 2026-10-15. Fast-moving: lucide-react, vitest, react-query, eslint, typescript-eslint and the source-map-js / http-cache-semantics exceptions age within days. `min-release-age` re-checks at install, and D-25's stop rule catches any drift.
