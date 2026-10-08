# Phase 2: Web Foundation & Design System - Context

*Created: 2026-10-07T19:31:36-05:00 · Updated: 2026-10-08T07:09:18-05:00*

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the React 19 + strict TypeScript + Vite + Tailwind v4 app in `web/`, built into `src/Csps.Server/wwwroot`. It holds the UI-spec design system, the public and admin layouts, the shared primitives, formatters, order-math preview, `httpClient.ts`/`api.ts`, TanStack Query defaults, nuqs URL state, and every quality gate: lint, types, Prettier, axe, bundle budgets, Lighthouse CI, and the Playwright host on 5199. Feature phases then only compose.

Requirements: WEB-01..10, ORD-09, QUAL-02, QUAL-04, A11Y-01, A11Y-02, A11Y-04, PERF-01, PERF-02, PERF-03, PERF-05.

Out of this phase:
- Sign-in, 2FA and auth flows (Phase 4)
- Real public pages: Home, Products, Gallery, Contact, legal, 404 (public-site phase)
- Feature screens: orders, expenses, users, dashboard, profile
- CI/deploy (Phase 3)

This phase only builds the frames and building blocks those screens use.
</domain>

<decisions>
## Implementation Decisions

All 12 owner decisions the roadmap lists for this phase (OD-14, C-10, C-11, C-22, C-25, C-34, C-35, S-1, S-2, S-6, S-7, S-8) are closed below. The owner ruled each one in chat on 2026-10-07.

### Accessibility vs the approved design (OD-14, C-34, C-35, A11Y-04)
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

### Design code: copy or fix (C-22, C-25, WEB-02, WEB-07)
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

### Icons and theme (C-10, C-11)
- **D-10 (C-10):** Icons come from the **`lucide-react` package** (ISC), **not** the spec's in-house `icons.ts` (Appendix D.5). This overrides UI-SPEC §2.6 "Don't add lucide-react".
  - Keep the spec's `Icon` component **API** (`<Icon name=… />` with a typed `IconName` union of the icons the spec uses) as a thin wrapper over per-icon named imports, so call sites and tree-shaking both work.
  - Record the wrapper as a `// SPEC-DEVIATION`.
  - Credit comes via the license notice pipeline (Vite `build.license` / THIRD-PARTY-NOTICES).
- **D-11:** **lucide-react version = the newest stable release at install time** (1.52.0 as of 2026-10-07). The **owner explicitly waives the 14-day cool-down for lucide-react only**, recorded 2026-10-07. At install, the executor still checks that exact version for npm advisories, deprecation or yank, and open regressions, and shows the owner before adopting it, per the standing package-approval rule. Record the waiver in `docs/dependencies.json`.
- **D-12:** Icon drift review. For every icon the spec uses (57 in Appendix D.5), check that the name still exists in the installed lucide-react and render it next to the 0.460 drawing. **Show the owner each icon that was renamed or looks noticeably different.** The owner approves the new look or picks the closest alternative. The DOM-snapshot comparison against Appendix D compares the icon `<svg>` wrapper (class, size, stroke, aria attributes), not the inner path data. The owner approves the path drawings through this review.
- **D-13 (C-11, PROF-04 groundwork):** The admin theme is a **manual Blush/Espresso toggle** persisted in `localStorage['csps-theme']`. With no saved choice the admin **always starts in Blush** and does **not** follow `prefers-color-scheme`. The `localStorage` access is guarded with try/catch.
- **D-14:** The **public site is light (Blush) only**, even for visitors in OS dark mode.

### Developer tooling (S-1, S-2, S-6, S-7, S-8)
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

### Shells, showcase and visual review (discussed beyond the roadmap list)
- **D-20:** The **admin layout and routes exist only in local development** in this phase. Builds intended for a server (`npm run build` → `wwwroot`) **exclude admin routes entirely** until Phase 4 adds sign-in, so nothing unprotected is ever deployed. — **Reversibility:** reversible. Rationale: Phase 4 adds the routes back behind auth.
- **D-21:** The **public layout** shows the real designed header and footer with a **simple placeholder** in the main area (for example, "Site update in progress"). The real Home page belongs to the public-site phase. There is still one `h1` per page, plus a skip link and labelled landmarks.
- **D-22:** A **dev-only component showcase** at `/dev/components` lists every primitive in Blush and Espresso: buttons, badges, fields, PasswordInput, OtpInput, money input, Select, SegmentedControl, Tabs, DataTable (with card view on phones), Pagination, FilterBar/SearchBox, Modal, ConfirmDialog, Toast, Skeletons, EmptyState, error states, LazyImage and the icons. It is excluded from production builds, and it uses **no Storybook** or other extra tools. It doubles as the page-level axe and Playwright target.
- **D-23:** Owner review is by **screenshots**. Capture the showcase and both layouts at **390, 820 and 1440 px**, in light and dark (admin only for dark), and send them to the owner.
- **D-24:** **Local-only side-by-side visual report.** A local script screenshots our layouts and components next to the matching screens rendered from `.planning/design/*.html`, at 390/820/1440 px in light and dark, into one report for the owner. Differences the owner flags become fixes. The script and its output must **never** commit, upload or deploy the design files or their renders. Output goes to a gitignored folder. The script does not run in CI, because the design files are not in git.

### Owner rulings on research open questions (2026-10-07, at plan-phase)
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

### Owner rulings on the plan 02-09 review pack (2026-10-08, in chat; backlog D-BL-03 and D-BL-02)
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

### Owner ruling: UI styles in Tailwind (2026-10-08, in chat, during `/gsd-execute-phase 2`)
- **D-33 (UI styles are Tailwind utilities; supersedes the verbatim-CSS rule):** The owner asked to convert the stylesheets in `web/src/styles` "into tailwind css? Strictly tailwind for ui styles", and then chose **"Full conversion to Tailwind"** from these options: keep the spec CSS / hybrid / full conversion. This ruling:
  - **Supersedes** the "Appendix A–C CSS stays byte-for-byte" rule (Accessibility section above), the CSS part of D-07, and UI-SPEC §0 rule 2 and §2.3 ("utilities are layout glue only"), for UI styles. The owner rules that the UI spec yields here (CLAUDE.md: "the UI spec wins … unless the owner rules otherwise").
  - **Keeps the approved look.** The spec stays the visual source of truth: every token value, size, spacing, radius, shadow, breakpoint, state and theme (Blush and Espresso) must render the same as it does today, plus the owner rulings D-01..D-05, D-27, D-31 (including the D-BL-02 "hide the Manager tag on the selected row") and D-32. Rule 1 still applies: no invented values and no Tailwind default palette, radii or shadows, only CSPS tokens through `@theme`.
  - **"Strictly Tailwind" in practice:** UI styling moves into Tailwind utility classes in the markup. Only what Tailwind v4 itself needs stays in CSS: the token `@theme`/custom properties, `@font-face`, `@keyframes`, the theme switch, and the minimal base/compat layer. Hand-written component or screen selectors (`.csp-*`/`.s-*` rule bodies, `overrides.css`, `spec-gaps.css`) are retired. Whether `.csp-*` / `.s-*` names survive as hooks is left to planning.
  - **Proof replaces "verbatim":** the 245-case DOM-differential test against the frozen App. D markup no longer fits (markup classes change by design). A rendered-look comparison takes its place: screenshots or computed styles against today's rendering in both themes and at 320/390/820/1440 px. Zero axe violations, the strict CSP (no inline styles) and the CSS budget (≤ 35 KB gz) stay.
  - **Reversibility:** costly but reversible. Rationale: owner preference for one styling approach across the UI. Plans 02-05, 02-09 and 02-11..02-18 are re-planned; recorded rulings D-31/D-32 still apply.

### Owner rulings on the D-33 research refresh (2026-10-08, in chat, during `/gsd-plan-phase 2 --tdd`)
- **D-34 (lucide-react version, research R-1; updates D-11 and the D-25 pin):** the owner chose **"Move to 1.53.0"**. The pin becomes **lucide-react 1.53.0** (ISC, published 2026-10-08T06:15Z, not deprecated). The D-11 cool-down waiver for lucide-react applies. At install, the executor still checks that exact version for npm advisories and stops if one appears. All 56 spec icons are byte-identical to 1.52.0 (research), so the D-32 icon rulings carry over unchanged.
- **D-35 (third-party credits, backlog D-BL-04, research R-6):** the owner chose **"Repo only"**. Vite's `build.license` is **off** (`false`), so no license file is written into the web root. The complete `THIRD-PARTY-NOTICES` stays in the repository, and nothing is published on the site. This narrows D-10's "Vite build.license / THIRD-PARTY-NOTICES" to the repository notices.
- **D-36 (Tailwind tooling packages, research R-3/R-4):** the owner chose **"Add both plugins"** and approves, at exact versions, **prettier-plugin-tailwindcss 0.8.1** (MIT, 2026-07-15) and **eslint-plugin-better-tailwindcss 4.7.0** (MIT, 2026-07-19). Both are dev-only and past the 14-day cool-down. Any other version needs a fresh check and approval. The in-house class checker from the research may still be planned if it covers something the plugin does not; the planner decides.
- **D-37 (reuse of the reverted code, research Q-4):** the owner chose **"Yes, as reference"**. Executors may read the style-independent code reverted in `bb6ef76` (available at commit `74621f5`: SPA host, HiddenSegmentFileProvider, HTTP client, order math and golden vectors, URL state, API contract, form logic, e2e host, license gate) for proven designs and pitfalls. Every plan stays TDD (RED first) and is re-verified. Nothing is restored wholesale without its tests.

- **D-38 (UI-SPEC OQ-1, phone list-card title separator):** the owner chose **"A: keep as approved"** (2026-10-08, in chat, during `/gsd-ui-phase 2`). The Tailwind build reproduces the approved computed result: the last phone list card has no separator line under its title. This is not an intentional difference, so the look-equality proof expects it to match the approved CSS.

### Carried forward (already decided; do not re-ask)
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
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth
- `CSPS-UI-SPEC.md`: approved visual design and the source of truth. Precedence: Appendix › tables › prose. §0 rules for implementers, §2 technical setup (theme toggle §2.7, icons §2.6), §3 tokens, §6 components, §7/§8 layouts, §10 interaction rules, §11 accessibility, §13 acceptance checklist (1440/820/390). Appendices: A tokens/globals/compat CSS, B components.css, C screens.css, D.1 `csps.ts`, D.2 `csps.test.ts`, D.3 `ui/index.tsx`, D.4 `mark.ts`, D.5 `icons.ts` (replaced by lucide-react per D-10), D.6 `main.tsx`, D.6b `RouterLink.tsx`, D.7 `vite.config.ts`, D.7b `tsconfig.json` (superseded by D-07), D.7c `index.html`, E reference page markup, F `mark.svg`.
- `.planning/design/CSPS Website Public Face.html` and `.planning/design/CSPS Website Admin and Manager.html`: the owner's Claude Design exports that the spec was derived from. **Local-only and gitignored: never commit, upload or deploy them.** They are self-unpacking bundles (a gzip+base64 `__bundler/manifest`, with each screen a nested bundle carrying its own template and an `x-dc` JSX script). They contain:
  - 10 public screens: Home, Products, Gallery, lightbox, Contact (desktop and mobile)
  - 30 admin screens: Sign in, Dashboard, Orders, New order, ORD-2026-0148, Add payment, Delete order, Company expenses, Add expense, Users, Add user, My profile (desktop, tablet and mobile)

  Every screen has a light/dark prop, and a shared design-system bundle holds 33 components (Icon through Skeleton; compare with Appendix D.3 before relying on it). Use them as a visual reference and for `// SPEC-GAP` items; **the spec wins on any disagreement** unless the owner rules otherwise. Files are large (1.5 MB and 4.2 MB), so unpack them or search them rather than reading them whole.

### Engineering contract
- `CSPS-PRD.md`: §2 stack, §7.1 performance budgets, §9 web, §12 accessibility, §14 testing, §17.2 TypeScript/ESLint settings, §21 owner decisions, §22 Definition of Done.
- `.planning/REQUIREMENTS.md`: WEB-01..10, ORD-09, QUAL-02, QUAL-04, A11Y-01/02/04, PERF-01/02/03/05 (also GAL-02 and PROF-04 for D-06/D-13).
- `.planning/ROADMAP.md` § Phase 2: success criteria 1–6 and research flags (TS 7 alias, React Compiler vs verbatim code, CSP and JSON-LD data blocks, public budget with a monolithic `ui/index.tsx`).
- `.planning/PROJECT.md`: constraints, Key Decisions (nuqs ruling), conflict table C-1..C-21.

### Research
- `.planning/research/SUMMARY.md`: S-1..S-12, C-22..C-45 (C-22, C-25, C-34, C-35 ruled here).
- `.planning/research/STACK.md`: frontend versions, the icons trade-off table, nuqs and forbidden-import rules.
- `.planning/research/PITFALLS.md`: Pitfall 1 (rounding drift, measured cases), Pitfall 13 (verbatim code vs gates), Pitfall 23 (a11y in the design: 72% opacity, orange-only cues, 14px controls).
- `.planning/research/ARCHITECTURE.md`: web/server layout, build into `wwwroot`.

### Prior phase
- `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md`: D-00 free-only, D-01..D-03 locale/clock, D-18 license exceptions (MPL-2.0 axe test-only, OFL-1.1 fonts), D-20 SpaProxy removal and hard-coded proxy ports.
- `CLAUDE.md` (root): shared-machine rules (ports, preflight, no machine-level env vars).
- `docs/dependencies.json`, `docs/allowed-licenses.json`, `docs/license-exceptions.json`: dependency registry and license gates (nuqs planned entry already present).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Csps.Server/Http/SecurityHeadersMiddleware.cs`: strict CSP and security headers already applied. The SPA must work under it with no inline script or style. Check D.7c `index.html` and any JSON-LD data block (research flag).
- `src/Csps.Server/Endpoints/ApiRouting.cs` and `HealthEndpoint.cs`: `/api/v1` routing and the unknown-`/api` ProblemDetails 404 (FND-05). The SPA fallback must not swallow `/api/*`.
- `src/Csps.Server/Composition/OpenApiRegistration.cs`: the Development-only OpenAPI document that `tools/openapi-gen` (D-16) generates types from.
- The authorization matrix test (`DiscoveredEndpointsAreFullyCovered`) needs a row and an allow-listed `AllowAnonymous` for the static/SPA fallback endpoints.
- `docs/dependencies.json` plus the dependency-registry tests: every npm package goes here with scope `runtime|build|test|tool|font`.

### Established Patterns
- Zero warnings, central version pinning, a lock file, license gates, and TDD (red → green) with recorded red evidence.
- Ports are hard-coded per project. Preflight runs before any server or Playwright run.
- Markdown files carry `Created · Updated` timestamps.

### Integration Points
- `web/` (new) → `npm run build` emits to `src/Csps.Server/wwwroot` (gitignored build output `**/wwwroot/assets/`).
- The Vite dev server on 5180 proxies `/api` to `https://localhost:7028` / `http://localhost:5115`.
- The Playwright host on 5199 serves the built app via the server for E2E.
- The shared golden-vector JSON (D-09) is read by both `tests/Csps.Domain.UnitTests` (xUnit) and `web` Vitest.
- No `web/` folder exists yet; this phase creates it.
</code_context>

<specifics>
## Specific Ideas

- The owner reviews visuals, not code. Give everything the owner must judge plain-words before/after screenshots: icon drift (D-12), markup-changing fixes (D-08), showcase and layouts (D-23), and the design comparison report (D-24).
- Design seed data matches UI-SPEC §12 (Carmen Reyes Manager, Jomar Santos inactive, and so on), so showcase examples should use it.
</specifics>

<deferred>
## Deferred Ideas

- Public dark theme (Espresso for public pages) was rejected for now. It would need newly designed and approved public screens, so it belongs in a future phase if wanted.
- Lightbox tap zones (D-06) are implemented in the public-site phase, not here.
- A 404 page belongs to the public-site phase (PUB-01/PUB-04).
</deferred>

---

*Phase: 02-web-foundation-design-system*
*Context gathered: 2026-10-07*
