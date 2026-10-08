# Phase 2: Web Foundation & Design System - Research

*Created: 2026-10-07T20:29:34-05:00 · Updated: 2026-10-07T21:47:36-05:00*

**Researched:** 2026-10-07
**Domain:** React 19 + strict TypeScript SPA (Vite 8 / Rolldown, Tailwind 4, React Router 8, TanStack Query 5, nuqs) served from ASP.NET Core 10 `wwwroot`, with an imported design system and its quality gates (ESLint, axe, bundle budgets, Lighthouse, Playwright)
**Confidence:** HIGH for versions, dates, advisories, bundle sizes, type/lint deltas and font coverage (measured this session in a scratch probe outside the repo). MEDIUM for browser behaviour taken from specs and bug trackers. Every claim is tagged.

> **How this was researched.** Context7 is not available in this session, so docs-kind questions went to official sources through WebFetch (TypeScript 7.0 announcement, WHATWG HTML spec, learn.microsoft.com, MDN, WebKit Bugzilla). Registry facts come from direct `registry.npmjs.org` reads, the npm bulk-advisory endpoint, and GitHub repo security-advisory APIs. The strongest evidence is a **local probe**: the exact candidate versions were installed in the session scratchpad (never in the repo), the verbatim Appendix A–D code was extracted from `CSPS-UI-SPEC.md`, and it was built, type-checked, linted and React-Compiled. Probe results are tagged `[VERIFIED: local probe]`. The `classify-confidence` seam rates `webfetch` LOW and `websearch --verified` MEDIUM; official-doc citations below are tagged `[CITED]`, which this file treats as MEDIUM.

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (abridged from REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| WEB-01 | Vite app in `web/` builds into `src/Csps.Server/wwwroot`; dev server 5180 strictPort, `/api` proxy, no machine env vars | §Standard Stack; Pattern 1 (vite.config); Pattern 7 (SPA host); Pitfalls 1, 3, 11 |
| WEB-02 | Appendix A–D imported verbatim, reconciled via `// SPEC-DEVIATION` without DOM change | §Research Flags 2 (measured delta: 7 type errors, 99 lint findings, 0 compiler bail-outs); Pattern 3 (differential DOM test); Pitfalls 5, 6, 7, 9 |
| WEB-03 | `httpClient.ts`: fetch-based, interceptors, timeout/abort, single-flight 401 refresh, capped retries, normalized `HttpError`, 100% coverage | Pattern 5; Don't-Hand-Roll; Pitfalls 14, 15 |
| WEB-04 | `api.ts` is the only endpoint module; ESLint forbids `fetch`/`httpClient`/`axios` elsewhere | Pattern 6 (lint rules + lint-rule tests) |
| WEB-05 | Public/Admin layouts, mobile nav drawer, route-level splitting, global error boundary | Pattern 2 (router); Pitfall 10 (HydrateFallback); Code Example "root error callbacks" |
| WEB-06 | Shared primitives with unit + axe tests | UI-SPEC SPEC-GAP table; Pattern 4 (in-house axe helper); Pitfall 12 (jsdom + axe) |
| WEB-07 | `formatPeso`/`formatDate`/`orderTotals` agree with server on ≥ 200 golden vectors in xUnit and Vitest | Pattern 8 (golden vectors, integer centavos); Pitfall 13 |
| WEB-08 | TanStack Query defaults, keep-previous pagination, 300 ms debounced cancellable search, intent prefetch | Pattern 9; Pitfall 16 (double retries) |
| WEB-09 | One `Idempotency-Key` per submission, reused on retry; pending button `aria-disabled` | Pattern 5; Pitfall 15 (`crypto.randomUUID` secure context) |
| WEB-10 | nuqs URL state, adapter v8 in lazy layout route, parsers, push/replace rules, lint bans | Pattern 10; measured: nuqs stays out of the public entry chunk |
| ORD-09 | `₱12,450.00`, U+2212 negatives, `Oct 6, 2026`; 2-decimal money input with numeric keypad | Pattern 8; Code Example `formatBusinessDate`; UI-SPEC MoneyInput contract |
| QUAL-02 | TS/ESLint/Prettier at `--max-warnings 0`, PRD §17.2 rule set | §Research Flag 1; Pattern 6; Pitfalls 4 (CRLF), 6 (`??` autofix) |
| QUAL-04 | Playwright on 5199, 3 engines + phones, fails on console/CSP/axe | Pattern 11; Pitfalls 2 (WebKit + `upgrade-insecure-requests`), 8 |
| A11Y-01 | Zero axe violations, component and page level | Pattern 4; Pattern 11 |
| A11Y-02 | Keyboard, skip link, focus trap/return, labelled landmarks, one `h1` | UI-SPEC Interaction Contract; Pitfall 9 (Modal overlay handler) |
| A11Y-04 | UI-spec vs WCAG conflicts ruled by owner | CONTEXT D-01..D-06; §Open Questions O-9, O-10 (new) |
| PERF-01 | Budgets: public ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz, build fails | §Research Flag 4 (measured 118.5 / 142.8 / 16.7 KB gz); Pattern 12 (in-house Vite budget plugin) |
| PERF-02 | Lighthouse ≥ 95 mobile, LCP < 2.0 s, CLS < 0.05 | Pattern 13; Pitfall 3 (no compression = LCP risk); owner question on `@lhci/cli` |
| PERF-03 | 320–1920 px, no horizontal scroll, ≥ 16 px inputs, `inputmode` | UI-SPEC D-01 overrides; Pattern 11 viewport matrix |
| PERF-05 | Self-hosted woff2, subset, swap, preload, metric fallbacks, ₱ in brand font | Pitfall 17 (Barlow has no ₱), Pitfall 18 (per-subset CSS has no `unicode-range`); Pattern 14 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same authority as locked decisions. Sources: `./CLAUDE.md`, `./.claude/CLAUDE.md`, user memory rules.

- **Ports:** Vite 5180 (`strictPort: true`); API 5115 http / 7028 https; Playwright host 5199 (`reuseExistingServer: false`). Never 5173, 5023, 5099. Avoid 49152–65535.
- **Preflight** before any dev server, Playwright or full test run: `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`. If a port is in use by another project, wait; never kill another project's processes.
- **Never set** `ASPNETCORE_URLS`, `ASPNETCORE_HTTPS_PORT`, `DEV_SERVER_PORT`, `ASPNETCORE_ENVIRONMENT` or any variable at User/Machine level. Per-process only (CLI args or a child-process `env` block).
- **LocalDB:** `(localdb)\CSPS` only; E2E database `CSPS_E2E`. **No Docker or Testcontainers locally.**
- **Never touch** `C:\Work\TheBETSLLC`. `_local/` and `.planning/design/` are never committed, uploaded or deployed.
- **Free only.** Allowed licenses MIT, Apache-2.0, BSD, ISC; exceptions MPL-2.0 (axe, dev/test only), OFL-1.1 (@fontsource fonts), the two pinned Microsoft SqlClient parts. Never GPL/AGPL/SSPL/commercial. Explain licenses in plain words to the owner.
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **New dependencies:** purpose, license, maintenance status and legitimacy recorded in RESEARCH.md; **14-day release cool-down** (security fixes may skip with a recorded reason); exact versions; the owner approves each exact version before install (user memory rule).
- **Architecture:** onion enforced by ArchUnitNET; default-deny authorization with an authorization-matrix test that discovers every endpoint; `Result<T>` → RFC 9457 ProblemDetails; UTC storage + `TimeProvider`; money `decimal(18,2)`, server-computed only.
- **Quality:** TDD red → green → refactor; zero warnings everywhere (build, lint, types, tests, browser console); coverage Domain 100%, Application ≥ 95%, `lib/http` 100%, web ≥ 90%.
- **Security:** CWE Top 25 drives the security review; strict CSP with no `unsafe-inline`/`unsafe-eval`; append-only audit log; no secrets or data in git.
- **A11y:** WCAG 2.2 AA, zero axe violations at component and page level.
- **Perf budgets:** public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz; Lighthouse ≥ 95 mobile; LCP < 2.0 s, CLS < 0.05, INP < 200 ms.
- **Responsive:** 320–1920 px, touch targets ≥ 44 px, no horizontal scroll.
- **Workflow:** `/gsd-plan-phase 2 --tdd`; `/gsd-secure-phase 2` and `/gsd-ui-review 2` before `/gsd-ship 2`. GitHub default branch `dev`; PRs target `dev`.
- **Markdown files** created or edited carry `Created · Updated` timestamps (ISO 8601 with offset).

## Summary

Phase 2 creates `web/` from nothing and wires it into the Phase 1 server. Every piece of the pinned stack works together today. In a scratch probe, the exact candidate versions installed with **zero peer conflicts and zero npm-audit findings**. The verbatim Appendix D code builds under Vite 8.3.3, type-checks under TypeScript 7.0.2 and 6.0.3 with the full PRD §17.2 flags with **only 7 errors**, and **all 37 components compile under the React Compiler with zero bail-outs**. Under the PRD lint set it raises **99 findings**. Most are mechanical. Five need structural care: `UiLink`'s context component, `Mark`'s `dangerouslySetInnerHTML`, the Modal overlay and uploader drag handlers, and the Sidebar `href="#"` logout. The last one changes markup, so it needs an owner ruling. `[VERIFIED: local probe]`

All four roadmap research flags are answered with evidence below.
- **TypeScript alias pair:** works as Microsoft documents it.
- **React Compiler:** compatible with the verbatim code.
- **JSON-LD data blocks:** never blocked by CSP.
- **Monolithic `ui/index.tsx`:** leaves the public bundle at **≈ 118.5 KB gz**, comfortably under 150. The real cost is structural. Once admin routes return to production builds in Phase 4, every component used anywhere lands in the shared entry chunk, so the public bundle rises to about 132 KB.

The research also found **six things the existing documents get wrong or don't cover**. The planner must act on them:
1. **Barlow Condensed has no ₱ glyph.** The display stack's per-character fallback to Archivo Variable keeps ₱ in a brand font. The UI-SPEC's planned metric-fallback ordering would break that.
2. **Fontsource per-subset CSS files have no `unicode-range`.** STACK.md's advice to import them is wrong.
3. **WebKit applies `upgrade-insecure-requests` to `http://localhost`.** So the Playwright host on 5199 must serve **HTTPS**.
4. **Vite 8.3.0–8.3.2 have three published advisories.** 8.3.3, the fix, is one day old, so it needs a security-fix cool-down exception.
5. **`@lhci/cli` 0.15.1 pulls 11 high-severity audit findings.** `lighthouse` 13.5.0 has none.
6. **MSW v3 is entirely inside the cool-down window.**

The project also gains a real enforcement tool for its cool-down rule. npm 11.19's `min-release-age` setting rejects too-new versions for the whole dependency tree, transitive ones included. `[VERIFIED: local npm 11.19.0]`

**Primary recommendation:** Create `web/` with an `.npmrc` that enforces `min-release-age=14` (excluding only `lucide-react`, per the owner waiver, and `vite`, for the security fix). Import Appendix A–D verbatim and prove "no DOM change" with a differential test against a frozen verbatim copy. Serve the SPA from ASP.NET Core with:
- `UseStaticFiles` before authorization
- an anonymous `MapFallbackToFile`
- response compression for static text types only

Run Playwright and Lighthouse against an **HTTPS** host on 5199 whose web root is a separate dev-routes build (`--webroot`). The deployable `wwwroot` build never contains admin or `/dev` routes. Enforce budgets with a ~60-line in-house Vite plugin that fails the build itself.

## Research Flags (from ROADMAP, answered explicitly)

### Flag 1: The TypeScript 7 alias setup — WORKS AS DOCUMENTED

- **Setup.** Microsoft's recipe is `"@typescript/native": "npm:typescript@^7.0.2"` plus `"typescript": "npm:@typescript/typescript6@^6.0.2"`: "This setup allows tools like typescript-eslint to access the TypeScript 6.0 API through the `typescript` package while enabling `npx tsc` to invoke version 7.0." `[CITED: devblogs.microsoft.com/typescript/?p=5246]` Pin both exactly (D-15): `npm:@typescript/typescript6@6.0.2` and `npm:typescript@7.0.2`.
- **Probe results.** `npm install` produced no ERESOLVE. `node_modules/.bin/tsc` → `Version 7.0.2`. `node_modules/.bin/tsc6` exists. `require('typescript').version` → `6.0.3`. typescript-eslint 8.70.1 resolved every internal `typescript` to the alias. The type-aware lint ran with no "unsupported TypeScript version" warning. `[VERIFIED: local probe]`
- **Note: `@typescript/typescript6@6.0.2` is a wrapper.** It depends on `"@typescript/old": "npm:typescript@^6"`, so the API actually loaded is **typescript 6.0.3** (published 2026-04-16). That caret range is resolved once into `package-lock.json`. Record it in the dependency notes as a transitive dependency. `[VERIFIED: npm registry]`
- **Agreement between the two compilers.** Both TS 6.0.3 and TS 7.0.2 report the same 7 errors on the verbatim code under the PRD flags. Write one `tsconfig` that is valid for both: no `baseUrl` (removed in 7), `moduleResolution: "bundler"`, and explicit `types` (TS 7 defaults to `types: []`). TS 7 also turns `noUncheckedSideEffectImports` on by default. CSS and fontsource side-effect imports type-check only because `"types": ["vite/client"]` declares `*.css` (fontsource ships `index.d.css.ts`). `[CITED: TS 7.0 announcement]` `[VERIFIED: local probe, strict tsconfig over the app wiring passed with 0 errors]`
- **Scripts.** `"typecheck": "tsc -p tsconfig.app.json && tsc -p tsconfig.node.json"`, where the bare `tsc` is TS 7. Never call `tsc6` in gates. It exists only because the wrapper ships it.
- **openapi-typescript 7.13.0 peers `typescript ^5.x`.** Keep it in `tools/openapi-gen/package.json` with `typescript@5.9.3` (2025-09-30, Apache-2.0), exactly as D-16 says. `[VERIFIED: npm registry]`

### Flag 2: The React Compiler vs the verbatim Appendix D code — COMPATIBLE; one lint finding

- **Wiring.** `@vitejs/plugin-react` 6.1.1 exports `reactCompilerPreset`. Its README wiring is `plugins: [react(), babel({ presets: [reactCompilerPreset()] })]` with `@rolldown/plugin-babel`, `@babel/core` 7 and `babel-plugin-react-compiler` 1.0.0. The native `compiler: true` path is marked "experimental". `[VERIFIED: tarball read of @vitejs/plugin-react 6.1.1 dist/index.d.ts and README]`
- **Compiler results.** With the compiler `logger` attached, the verbatim `src/ui/index.tsx` produced **44 `CompileSuccess` events and zero `CompileError`/bail-out events**: every one of the 37 components plus helpers. `[VERIFIED: local probe]`
- **Size cost.** The compiler added **≈ 7.8 KB gz** to the dev-topology entry chunk (121.0 → 128.8 KB gz) and **≈ 1.7 KB gz** to the production public build (116.5 → 118.2 KB gz). `[VERIFIED: local probe]`
- **Lint.** `eslint-plugin-react-hooks` 7.1.1 `configs.flat.recommended` raised exactly **one** compiler-family finding: `react-hooks/static-components` at `UiLink` (`const L = useContext(LinkCtx); return <L … />`). The fix needs no DOM change: `UiLink` renders react-router's `Link` directly. Keep `LinkProvider` exported for API compatibility, or delete it with a `// SPEC-DEVIATION` note, since the project only ever uses React Router. `[VERIFIED: local probe]`
- **The compiler never changes rendered DOM; it only memoizes.** The DOM-equality proof is still worth having, so run Vitest through the same plugin chain. Component tests then exercise compiled output.
- **Speed and scope.** Narrow `@rolldown/plugin-babel` to `src/**/*.{ts,tsx}` so Babel never touches `node_modules`. The probe build took 1.9 s.

### Flag 3: CSP behaviour of JSON-LD data blocks — NOT BLOCKED

- **The spec.** The HTML "prepare the script element" algorithm returns at **step 13** for any type that is not a JavaScript MIME type, `module`, `importmap` or `speculationrules`: "(No script is executed, and el's type is left as null.)" The CSP inline check is **step 21**, so a `<script type="application/ld+json">` data block never reaches CSP. It raises no violation under `script-src 'self'`. `[CITED: html.spec.whatwg.org/multipage/scripting.html]`
- **React 19.3.** react-dom's development client skips its "Encountered a script tag while rendering React component" console error when `isScriptDataBlock(props)`, so React can render a JSON-LD block from a string child with no `dangerouslySetInnerHTML` and no console error. `[VERIFIED: react-dom 19.3.0 cjs/react-dom-client.development.js:13045, 23860]`
- **Recommendation for Phase 2: ship no JSON-LD.** No real public page exists yet. Record the finding for the public-site phase. Write a static `LocalBusiness` block into `index.html`, with `<` escaped as `\u003c`, or render it from React with `JSON.stringify` as the text child. Add a Playwright `securitypolicyviolation` assertion on that page in all three engines.

### Flag 4: The public bundle budget with a monolithic `ui/index.tsx` — FITS; know where the bytes go

Measured gzip sizes (Vite 8.3.3 report; production build of the probe app). The probe app used the real Appendix D code, an RR8 data router, TanStack Query, the public header and footer, and a placeholder page. `[VERIFIED: local probe]`

| Build | Public initial JS (entry + `/` route chunk) | Admin initial JS (entry + layout + page + shared) | CSS (all) |
|---|---|---|---|
| Production, admin excluded (D-20), verbatim `icons.ts`, no compiler | 113.5 KB | — | 16.7 KB |
| Production, admin excluded, **lucide-react map**, no compiler | 116.8 KB | — | 16.7 KB |
| Production, admin excluded, **lucide-react map + compiler** (the Phase 2 target) | **118.5 KB** | — | **16.7 KB** |
| Dev topology (admin + nuqs + showcase-like page), lucide + compiler | 132.4 KB | **142.8 KB** | 16.7 KB |

- **Why the dev-topology public number grows.** Rolldown places whole modules in chunks. `src/ui/index.tsx` is imported by the public layout, so it lives in the **entry chunk**, and every component any route uses (`OrderCard`, `IncomeExpenseChart`, `ImageUploader`, …) is retained there. Lazy admin routes cannot pull them out. Unused exports are still tree-shaken. That is why the production public build (admin excluded) is smaller.
- **The `Icon` name API defeats per-icon tree-shaking.** D-10 says "tree-shaking both work", but `<Icon name="…">` looks icons up by a runtime string. The name → component map therefore keeps all **56** lucide components in whichever chunk holds `Icon`. Measured cost: **+3.3 KB gz** over the verbatim node-data `icons.ts`. That is acceptable, but record it honestly in the `// SPEC-DEVIATION`. Real per-icon tree-shaking would need `<Icon icon={X} />`, which changes the spec's API.
- **nuqs.** With `NuqsAdapter` inside the lazy admin layout, nuqs stays **out of the public entry chunk**. It went into a 3.35 KB gz shared admin chunk. `[VERIFIED: local probe]`
- **Headroom.** About 31 KB gz in Phase 2. About 18 KB gz once admin routes return in Phase 4, before forms (`react-hook-form` + `zod`, about 25–30 KB) arrive. **Recommendation:** keep the verbatim monolith in Phase 2. The budget plugin measures **both** topologies from the first build. Plan a barrel split (`ui/index.ts` re-exporting per-component modules; no DOM change, `// SPEC-DEVIATION`) as a **Phase 4 trigger** if public initial JS in the admin-included topology exceeds 135 KB gz.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layouts, primitives, theme toggle, showcase | Browser / Client | — | Pure SPA rendering; theme in `localStorage` (D-13) |
| URL list state (nuqs) | Browser / Client | API (authoritative caps) | URL is untrusted input; server re-validates page size/search (SEC-03) |
| Money/date formatting + order-math **preview** | Browser / Client | API / Domain (authoritative) | Client previews; server figures win after save (D-09); golden vectors bind both |
| Order-math reference implementation for golden vectors | API / Domain (`Csps.Domain`) | — | Server is authoritative; Domain needs 100% coverage |
| HTTP client, idempotency keys, 401 refresh | Browser / Client | API (honours keys from SEC-06 later) | Client generates keys; server-side dedupe is a later phase |
| SPA hosting (static files + `index.html` fallback) | Frontend Server (ASP.NET Core) | CDN/Static (IIS in Phase 3) | Same origin as API; CSP/security headers already in middleware |
| Strict CSP + security headers | Frontend Server | — | `SecurityHeadersMiddleware` (Phase 1) covers every response incl. static files |
| Response compression for static text | Frontend Server | IIS (Phase 3) | Needed for Lighthouse in Phase 2; IIS may take over in Phase 3 |
| Bundle budgets, license gate, cool-down | Build tooling | CI (Phase 3) | Fail locally first; Phase 3 wires the same commands into Actions |
| OpenAPI → TS types + drift check | Build tooling (`tools/openapi-gen`) | API test (snapshot of `/openapi/v1.json`) | Isolated TS 5.9 (D-16) |

## Standard Stack

> **Nothing below is adopted.** Each exact version is the newest stable release that was at least 14 days old on 2026-10-07, unless marked otherwise. At install, re-run the date check: `min-release-age=14` in `web/.npmrc` makes npm do it. The owner then approves the exact list, per the user memory rule. **Install gates on that approval.**

### Core (runtime, ships to the browser)

| Library | Version | Published | Purpose | Why standard |
|---|---|---|---|---|
| react / react-dom | 19.3.0 | 2026-09-09 | UI | UI-spec tested on 19.3; RR8 needs ≥ 19.2.7 `[VERIFIED: npm registry]` |
| react-router | 8.4.0 | 2026-09-15 | Data router, `route.lazy` splitting | v8 dropped `react-router-dom`; import `RouterProvider` from `react-router/dom` `[VERIFIED: npm registry; local probe build+typecheck]` |
| @tanstack/react-query | **5.103.2** | 2026-09-21 | Server state | 5.104.x is < 14 days old; 5.103.3/5.104.0 age out on 2026-10-10 `[VERIFIED: npm registry]` |
| nuqs | 2.10.1 | 2026-08-25 | URL state (WEB-10) | Owner-approved; still `latest` (no stable 2.10.2) `[VERIFIED: npm registry]` |
| clsx | 2.1.1 | 2024-04-23 | Class joining (verbatim D.3) | Finished, stable `[VERIFIED: npm registry]` |
| lucide-react | 1.52.0 | 2026-10-04 | Icons (D-10) | **Cool-down waived by owner (D-11)**; ISC `[VERIFIED: npm registry]` |
| @fontsource/barlow-condensed | 5.3.0 | 2026-07-19 | Display font | OFL-1.1 (font exception) `[VERIFIED: npm registry]` |
| @fontsource-variable/archivo | 5.3.0 | 2026-07-19 | UI font; has ₱ in latin-ext | OFL-1.1 `[VERIFIED: npm registry; cmap read]` |

Transitive runtime: `@standard-schema/spec` 1.1.0 (MIT, via nuqs), `scheduler`, `@tanstack/query-core` (pinned by react-query). All of them are MIT. `[VERIFIED: local probe license scan]`

### Build / lint / type (devDependencies, never shipped)

| Library | Version | Published | Purpose |
|---|---|---|---|
| `typescript` → `npm:@typescript/typescript6@6.0.2` | 6.0.2 (wraps typescript 6.0.3) | 2026-07-06 | TS API for typescript-eslint (D-15) |
| `@typescript/native` → `npm:typescript@7.0.2` | 7.0.2 | 2026-07-08 | `tsc --noEmit` gate (D-15) |
| @types/react / @types/react-dom | 19.3.0 | 2026-09-09 | Types |
| @types/node | **24.13.6** | 2026-09-19 | Types for config/scripts (Node 24 runtime) |
| vite | **8.3.3** | 2026-10-06 | Build/dev server. **Security-fix cool-down exception**: 8.3.0–8.3.2 are affected by GHSA-rq7h-c2jc-7f22 (medium), GHSA-vfpm-58rq-9qcg (medium), GHSA-9jrq-w75r-8gcw (low), all fixed in 8.3.3 `[VERIFIED: GitHub vitejs/vite security-advisories API]` |
| @vitejs/plugin-react | **6.1.1** | 2026-08-28 | JSX + `reactCompilerPreset` (6.1.2 is < 14 days old) |
| @rolldown/plugin-babel | 0.2.4 | 2026-09-07 | Babel pass for the compiler |
| @babel/core | **7.29.7** (stay on 7.x) | 2026-05-25 | Compiler engine; 7.29.6+ fixes GHSA-4x5r-pxfx-6jf8 `[VERIFIED: GitHub babel/babel advisories]` |
| @types/babel__core | 7.20.5 | 2023-11-20 | Needed with TS + Babel 7 (plugin-react README) |
| babel-plugin-react-compiler | 1.0.0 | 2025-10-07 | React Compiler |
| tailwindcss / @tailwindcss/vite | 4.3.3 | 2026-07-16 | Utilities + token theme |
| eslint | **10.11.0** | 2026-09-18 | Lint (10.12.0 is < 14 days old) |
| @eslint/js | 10.0.1 | 2026-02-06 | `js.configs.recommended` |
| typescript-eslint | **8.70.1** | 2026-09-21 | `strictTypeChecked` + `stylisticTypeChecked` |
| eslint-plugin-react-hooks | 7.1.1 | 2026-04-17 | Hooks + compiler rules |
| eslint-plugin-jsx-a11y-x | 0.2.0 | 2026-05-10 | `configs.strict` (D-17); verified loading under ESLint 10.11 |
| globals | **17.12.0** | 2026-09-01 | Browser/node globals |
| prettier | 3.9.9 | 2026-09-23 | Formatting (exactly 14 days old on 2026-10-07) |
| eslint-config-prettier | 10.1.8 | 2025-07-18 | Disable stylistic conflicts |
| @tanstack/eslint-plugin-query | **5.103.2** (optional) | 2026-09-21 | Query-key rules |
| rollup-plugin-visualizer | 7.1.1 (optional) | 2026-08-14 | Bundle treemap artifact (PRD §7.1 "bundle analysis") |

### Test (devDependencies)

| Library | Version | Published | Purpose |
|---|---|---|---|
| vitest / @vitest/coverage-v8 | **5.0.1** (prefer 5.0.2 if installing on/after 2026-10-09) | 2026-09-15 | Unit/component tests + coverage; versions must match exactly (peer `"5.0.1"`). 5.0.2 fixes "`Request` with `Blob` body on jsdom 28+" `[VERIFIED: vitest GitHub release notes]` |
| jsdom | **30.1.1** | 2026-09-22 | DOM env (Node ^24.15) |
| @testing-library/react | 16.3.3 | 2026-08-27 | Rendering |
| @testing-library/dom | 10.4.2 | 2026-09-13 | RTL peer |
| @testing-library/user-event | 14.6.7 | 2026-09-02 | Interactions |
| @testing-library/jest-dom | 7.0.1 | 2026-08-09 | DOM matchers (`/vitest` entry) |
| axe-core | 4.13.0 (MPL-2.0, test) | 2026-08-05 | In-house axe helper (D-18); pin via `overrides` so jsx-a11y-x, @axe-core/playwright and lighthouse share it |
| @playwright/test | 1.63.0 | 2026-09-04 | E2E; its browser revisions (chromium 1243, firefox 1543, webkit 2359) **already exist** in this machine's `%LOCALAPPDATA%\ms-playwright` |
| @axe-core/playwright | 4.13.0 (MPL-2.0, test) | 2026-08-11 | Page-level axe |
| lighthouse | **13.5.0** (proposed replacement for `@lhci/cli`) | 2026-09-18 | Lighthouse run + in-house assertion script; `npm audit` clean |
| license-checker-rseidelsohn | 5.0.1 | 2026-05-27 | npm license gate (needs Node ≥ 24, npm ≥ 11) |

### Tool package `tools/openapi-gen/` (isolated, D-16)

| Library | Version | Published | Purpose |
|---|---|---|---|
| openapi-typescript | 7.13.0 | 2026-02-11 | Generate `web/src/types/api.generated.ts` |
| typescript | 5.9.3 | 2025-09-30 | Peer of openapi-typescript (`^5.x`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `lighthouse` 13.5.0 + 40-line assert script | `@lhci/cli` 0.15.1 (CLAUDE.md names it) | LHCI bundles lighthouse 12.6.1 and brings **11 high + 4 moderate + 2 low** npm-audit findings (tmp, extract-zip, puppeteer-core, basic-ftp…) `[VERIFIED: npm audit in scratch]`; `npm audit --audit-level=high` would fail. Owner decision. |
| MSW 3 now | Defer MSW to the first phase with real endpoints | MSW 3.0.0 was released 2026-09-28; **no v3 version is 14 days old until 2026-10-12** (3.0.2 → 2026-10-17). Phase 2 doesn't need it: `httpClient` tests inject a fake `fetch`. |
| Per-subset fontsource CSS (`latin-800.css` + `latin-ext-800.css`) | Default weight CSS (`800.css`), as the spec's verbatim `main.tsx` does | Per-subset files have **no `unicode-range`** (Pitfall 18) |
| `MapStaticAssets` (.NET 9+) | `UseStaticFiles` + `MapFallbackToFile` | MapStaticAssets registers one endpoint per hashed asset from a build-time manifest; it would flood the authorization matrix with build-specific patterns and needs `wwwroot` populated before `dotnet build` `[CITED: learn.microsoft.com static-files]` |
| `vitest-axe` (PRD text) | In-house helper over axe-core (D-18) | Owner already ruled D-18 |
| `react-hook-form` + `zod` now | Defer to Phase 4 (first real form) | Not needed by Phase 2 primitives; keeps approval surface and bundle smaller |

### Installation (after owner approval)

`web/.npmrc` (committed). These settings are documented npm 11 project config. `min-release-age` was verified on npm 11.19.0: `vitest@5.0.3` → `ETARGET … with a date before 9/23/2026`, while `vitest@5.0.1` installs. `[VERIFIED: local npm 11.19.0]`

```ini
save-exact=true
engine-strict=true
min-release-age=14
# Owner waiver D-11 (2026-10-07):
min-release-age-exclude[]=lucide-react
# Security fix GHSA-rq7h-c2jc-7f22 / GHSA-vfpm-58rq-9qcg / GHSA-9jrq-w75r-8gcw (owner approval required):
min-release-age-exclude[]=vite
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
  vitest@5.0.1 @vitest/coverage-v8@5.0.1 jsdom@30.1.1 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 axe-core@4.13.0 \
  @playwright/test@1.63.0 @axe-core/playwright@4.13.0 lighthouse@13.5.0 license-checker-rseidelsohn@5.0.1
# package.json: "overrides": { "axe-core": "4.13.0" }, "engines": { "node": ">=24.15 <25", "npm": ">=11.19" }
```

## Packages Requiring Owner Approval

**The planner must gate every install on this table** (`checkpoint:human-verify`, one batch, plain-words licenses). nuqs 2.10.1 is already approved and is listed for completeness. "Advisories" means the npm bulk-advisory endpoint **and** the GitHub repo-level security-advisory API, both checked on 2026-10-07. The global GitHub advisory database lagged by a day on Vite, so both sources matter.

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

**Transitive licenses outside the allow-list (dev/build tree only, need owner approval as dev exceptions).** These come from scanning the probe tree and the lighthouse tree. Nothing here ships to the browser. `[VERIFIED: local probe license scan]`

| License (plain words) | Package(s) | Pulled in by | Scope |
|---|---|---|---|
| MPL-2.0 (free; keep changes to *those files* open) | `lightningcss` 1.32/1.33 (+ win32 binary) | Vite 8 and Tailwind 4 (CSS engine) | **build**. The current MPL-2.0 exception is scoped `test` only, so it needs widening to `build` |
| MPL-2.0 | axe-core | jsx-a11y-x, @axe-core/playwright, lighthouse | test |
| CC-BY-4.0 (free data license; credit the authors) | `caniuse-lite` | Babel → browserslist | build |
| CC0-1.0 (public-domain dedication) | `language-subtag-registry` | jsx-a11y-x → language-tags | build |
| BlueOak-1.0.0 (permissive, MIT-like) | `minimatch` 10 | jsx-a11y-x | build |
| 0BSD (permissive, no conditions) | `tslib` | lighthouse | test |

The **shipped** client tree is react, react-dom, scheduler, react-router (+ cookie, set-cookie-parser), @tanstack/query-core, nuqs, @standard-schema/spec, clsx and lucide-react, plus the OFL fonts. All of it is allow-listed. Gate `license-checker-rseidelsohn --production --onlyAllow` strictly. Gate dev with a reviewed list.

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check --ecosystem npm` ran on all 43 candidate names. It checks only the **latest** version. Results: **OK** for nuqs, clsx, both fontsource packages, @typescript/typescript6, typescript, tailwindcss, @tailwindcss/vite, @rolldown/plugin-babel, @types/babel__core, babel-plugin-react-compiler, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y-x, eslint-config-prettier, @testing-library/react, user-event, jest-dom, @axe-core/playwright, license-checker-rseidelsohn and openapi-typescript. **SUS with the single reason `too-new`** for the rest, because their *latest* versions are under 30 days old. Every SUS package has 6M–548M weekly downloads, the official repo, no postinstall and no deprecation. The recommended **exact** versions above are older than the flagged latest ones. **No SLOP.** `[VERIFIED: gsd legitimacy seam]`

| Package | Registry | Age (recommended version) | Downloads/wk | Source repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| react / react-dom | npm | 28 d | 224M / 212M | github.com/react/react | SUS (too-new latest) | Approved pending owner |
| react-router | npm | 22 d | 69M | github.com/remix-run/react-router | SUS (too-new latest) | Approved pending owner |
| @tanstack/react-query | npm | 16 d (5.103.2) | 83M | github.com/TanStack/query | SUS (too-new latest) | Use 5.103.2 |
| nuqs | npm | 43 d | 6.2M | github.com/47ng/nuqs | OK | Approved (owner) |
| lucide-react | npm | 3 d | 135M | github.com/lucide-icons/lucide | SUS (too-new) | Owner waiver D-11 |
| vite | npm | 1 d | 232M | github.com/vitejs/vite | SUS (too-new) | Security exception |
| eslint-plugin-jsx-a11y-x | npm | 150 d | 159k | github.com/es-tooling/eslint-plugin-jsx-a11y-x | OK | Approved pending owner |
| lighthouse | npm | 19 d | 6.1M | github.com/GoogleChrome/lighthouse | SUS (too-new latest) | Owner decision (replaces LHCI) |
| *(all others in the approval table)* | npm | ≥ 14 d | ≥ 0.4M | official repos | OK / SUS-too-new | Approved pending owner |

**Postinstall scripts:** none (`preinstall`/`install`/`postinstall` all null) on every recommended exact version. `[VERIFIED: registry metadata]`
**Packages removed ([SLOP]):** none.
**Packages flagged [SUS] for a reason other than age:** none.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌───────────────────────── developer machine ─────────────────────────┐
 npm run dev (5180) ──►   │ Vite dev server ── /api/* proxy ──► Kestrel http://localhost:5115     │
                          │   (no CSP; HMR; admin + /dev routes)                                 │
                          └──────────────────────────────────────────────────────────────────────┘

 npm run build ──► vite build (mode production) ──► budget plugin (generateBundle) ──fail?──► exit 1
                         │  admin & /dev route imports dead-code-eliminated (D-20)
                         ▼
               src/Csps.Server/wwwroot/{index.html, assets/*.js|css|woff2, mark.svg, robots.txt}
                         │
 browser ──HTTPS──► ASP.NET Core pipeline:
   SecurityHeaders (CSP, outermost) → ExceptionHandler → StatusCodePages → ResponseCompression(static types)
   → UseStaticFiles (anonymous; immutable cache for /assets) → SerilogRequestLogging → AuthN → AuthZ (fallback deny)
   → endpoints:  /health | /api/{**path} 404 | /api/v1/... (policies) | {*path:file} 404 (anon) | {*path:nonfile} → index.html (anon)
                         │
                         ▼
   index.html → entry chunk (React, RR8 data router, Query, ui/index.tsx) → route.lazy chunk
     PublicLayout(.s-page light) ─ SkipLink / SiteHeader / <main> / footer
     [dev/e2e builds only] AdminLayout(.s-page theme) ─ lazy NuqsAdapter(<Outlet/>) ─ AdminPreview / ComponentShowcase
     components → hooks (useXxxListParams via nuqs; useQuery) → api.ts → httpClient.ts (fetch / XHR-upload) → /api/v1

 E2E:  vite build --mode e2e → web/.e2e-dist ──► dotnet run Csps.Server --urls https://localhost:5199 --webroot <.e2e-dist>
       Playwright (chromium/firefox/webkit + Pixel/iPhone) ── console/CSP/axe fixtures ──► report (gitignored)
 Lighthouse: production build in wwwroot ──► same host on 5199 ──► lighthouse 13.5 (mobile) ──► assert script
 Golden vectors: tests/fixtures/order-math-golden-vectors.json ──► xUnit (Csps.Domain OrderMath)  and  Vitest (csps.ts)
```

### Recommended Project Structure

```
web/
├── .npmrc                     # save-exact, engine-strict, min-release-age=14 (+ 2 excludes)
├── package.json / package-lock.json
├── index.html                 # App. D.7c + meta description + preload hook (no inline script/style)
├── public/                    # mark.svg (App. F), robots.txt
├── vite.config.ts             # D.7 + compiler + port/proxy + outDir + budget/preload plugins (SPEC-DEVIATION)
├── tsconfig.app.json / tsconfig.node.json   # PRD §17.2, valid for TS 6 and TS 7
├── eslint.config.ts / .prettierrc / .prettierignore
├── playwright.config.ts / e2e/            # fixtures: console, CSP, axe; specs; visual scripts (D-23/D-24)
├── scripts/                   # budget.ts (pure calc, unit-tested), lighthouse-assert.mjs, gen-golden-vectors.mjs
└── src/
    ├── main.tsx               # D.6 adapted: createBrowserRouter/RouterProvider, root error callbacks
    ├── app/                   # router.tsx, layouts (Public/Admin), RouterLink, ErrorBoundary, pages (placeholder, preview, showcase)
    ├── ui/                    # index.tsx (verbatim D.3 + SPEC-DEVIATION), icons.ts (lucide map), mark.tsx (JSX),
    │   └── __reference__/     # frozen verbatim D.3/D.4 copies for the differential DOM test (lint/tsc/coverage excluded)
    ├── ui/gaps/               # SPEC-GAP primitives: ResponsiveTable, Pagination, SearchBox, FilterBar, MoneyInput,
    │                          #   OtpInput, LazyImage, ErrorState, Skeleton family, Checkbox, SkipLink, MobileNavDrawer, UserMenu
    ├── lib/
    │   ├── csps.ts            # D.1 + D-09 integer-centavo round2 (SPEC-DEVIATION)
    │   ├── format.ts          # formatBusinessDate (Asia/Manila via Intl)
    │   ├── http/httpClient.ts # WEB-03/09, 100% coverage
    │   ├── api.ts             # the only endpoint module (WEB-04)
    │   ├── query/             # QueryClient defaults, keys, useDebouncedValue, prefetch-on-intent
    │   └── url-state/         # nuqs parsers (parseAsBusinessDate, page, pageSize), defaultOptions, list-hook factory
    ├── styles/                # globals/tokens/compat/components/screens.css (byte-for-byte), spec-gaps.css, overrides.css, fonts
    ├── types/api.generated.ts # openapi-typescript output (committed)
    └── test/                  # setup.ts (jest-dom, console guard, matchMedia), axe.ts (D-18 helper)
tools/openapi-gen/             # package.json (openapi-typescript 7.13.0 + typescript 5.9.3), openapi.v1.json (committed snapshot)
tests/fixtures/order-math-golden-vectors.json   # shared by xUnit + Vitest
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
      babel({ presets: [reactCompilerPreset()] }), // narrow to src via the plugin's include/filter option
      tailwindcss(),
      preloadFontPlugin(/archivo-latin-wght-normal-.*\.woff2$/),
      budgetPlugin({ devRoutes }), // fails the build (this.error) over 150/250/35 KB gz
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { __DEV_ROUTES__: JSON.stringify(devRoutes) },
    server: { port: 5180, strictPort: true, proxy: { '/api': { target: 'http://localhost:5115', changeOrigin: false } } },
    build: {
      outDir: mode === 'production' ? '../src/Csps.Server/wwwroot' : `.${mode}-dist`,
      emptyOutDir: true,
      assetsInlineLimit: 0, // never inline fonts as data: (font-src 'self')
      sourcemap: false,
      license: true,         // .vite/license.md → THIRD-PARTY-NOTICES input (D-10 credit)
    },
  };
});
```

- Proxy to **http 5115** rather than https 7028. Node doesn't trust the ASP.NET dev certificate from the Windows store, so an https target would need `secure: false`. Development has no HTTPS redirect, so http works (`Program.cs:19`, `redirectToHttps` is false in Development). `[VERIFIED: src/Csps.Server/Program.cs:19]`
- Route exclusion (D-20): `if (__DEV_ROUTES__) routes.push({ path: 'admin', lazy: () => import('./app/admin/AdminLayout') … })`. When `__DEV_ROUTES__` is the literal `false`, Rolldown drops the unreachable `import()`, so no admin chunk is emitted. The probe proved this with a build flag: the admin-excluded build had no `AdminLayout`/`Preview` chunks. `[VERIFIED: local probe dist-b vs dist-a]`

### Pattern 2: React Router 8 data router (replaces D.6's `<BrowserRouter>`; no DOM change)

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

Why data mode: WEB-10 forbids `<Navigate>` for query rewrites and wants `loader` `redirect()`. Route `lazy` gives route-level splitting.

### Pattern 3: Differential DOM proof for "verbatim, no DOM change" (WEB-02, D-07, D-12)

- Keep frozen verbatim copies of App. D.3/D.4/D.5 under `src/ui/__reference__/`. Exclude them from `tsc` (`exclude`), ESLint (`ignores`), Prettier and coverage. Vitest still transpiles them, because Oxc strips types and does no type check.
- For each component and a prop matrix, render the reference and the reconciled component into **separate** containers inside the same `MemoryRouter`, then compare `container.innerHTML` after normalizing:
  - `useId` values (React 19 ids differ per root)
  - icon `<svg>` **inner** children (D-12 compares the wrapper only)
  - the lucide default classes (see O-10)
- For Appendix E markup (public header/footer, admin shell), extract the HTML fragments into `src/test/fixtures/*.html`. Parse them with `document.createRange().createContextualFragment()` and compare normalized trees with `isEqualNode` after whitespace normalization.

### Pattern 4: In-house axe helper (D-18)

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

A helper function avoids augmenting `Matchers<R, T>`. If a matcher is preferred, augment `declare module 'vitest' { interface Matchers<R, T> { … } }`. Vitest 5 changed the signature to `Matchers<R extends void | Promise<void>, T>`. `[VERIFIED: @vitest/expect 5.0.1 types]`

### Pattern 5: `httpClient.ts` shape (WEB-03, WEB-09)

- `createHttpClient({ baseURL, fetch = globalThis.fetch, timeoutMs, refresh, onUnauthorized, xhrFactory })`. **Inject `fetch` and the XHR factory** so tests need no MSW and reach 100% branch coverage deterministically.
- **Abort.** Combine the user signal and the timeout with `AbortSignal.any([...])`. Map `AbortError` versus timeout into distinct `HttpError.kind`s.
- **Single-flight refresh.** Keep one shared `refreshPromise`, reset in `finally`. Each 401 awaits it and retries **once** with the **same** request config, so the same `Idempotency-Key` header is reused. A second 401 → `onUnauthorized()`.
- **Retries.** At most 2, capped exponential backoff, only for GET/HEAD/PUT/DELETE and **POST that carries an `Idempotency-Key`** (WEB-09), only on network error or 503.
- **Idempotency.** `request()` never mints a key. The submission hook (`useSubmission`) mints it **once per user submission** and passes it in. Retries and refresh-retries reuse it.
- **Errors.** Normalize every failure to `HttpError { status, problem?, fieldErrors, traceId, kind }`. Never throw a raw `Response`.

### Pattern 6: Lint rules that enforce architecture (WEB-04, WEB-10, QUAL-02) — and tests for the rules

```ts
// eslint.config.ts excerpt — restriction block exported separately so a Vitest test can run it through ESLint's Linter
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
      patterns: [{ group: ['**/lib/http/**', '@/lib/http/*'], message: 'Only src/lib/api.ts may use the HTTP client (WEB-04).' }],
    }],
    'no-restricted-globals': ['error', { name: 'fetch', message: 'Call api.ts.' }, { name: 'XMLHttpRequest', message: 'Call api.ts.' }],
    'no-restricted-syntax': ['error',
      { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'CWE-79.' },
      { selector: "Property[key.name='shallow'][value.value=false]", message: 'nuqs #1563: keep shallow: true.' },
      { selector: "Property[key.name='startTransition']", message: 'nuqs #1567: no startTransition option.' },
      { selector: "MemberExpression[property.name='fetch'][object.name=/^(window|globalThis|self)$/]", message: 'Call api.ts.' },
    ],
    'no-console': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
// Overrides: files ['src/lib/http/**'] allow fetch/XMLHttpRequest; files ['src/lib/api.ts'] allow the http import.
```

Prove the success criterion "lint rejects …" with a Vitest test. Use ESLint's `Linter` (no type info needed for these rules) to lint snippets under virtual file paths, such as `src/features/x.tsx` with `import { httpClient } from '@/lib/http/httpClient'`, and assert the error.

Configure `@typescript-eslint/prefer-nullish-coalescing` with `ignorePrimitives: { string: true, number: true, boolean: true }` (Pitfall 6).

### Pattern 7: SPA host in ASP.NET Core (WEB-01, FND-05, SEC-02)

```csharp
// Program.cs order (after UseStatusCodePages, before UseSerilogRequestLogging / UseAuthentication / UseAuthorization):
app.UseResponseCompression();                 // registered with MimeTypes = html, css, js, svg ONLY (no JSON: BREACH)
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = SpaCaching.Apply }); // /assets/* immutable 1y; others no-cache
// ...auth...
app.MapApiFallback();                                      // existing "/api/{**path}" → ProblemDetails 404
app.MapFallback("{*path:file}", FileNotFound).AllowAnonymous();      // missing /x.js → 404 (not 401)
app.MapFallbackToFile("index.html").AllowAnonymous();      // "{*path:nonfile}" → SPA shell; Cache-Control: no-cache
```

- Static files served **before** `UseAuthorization` get no authorization check, even with a `FallbackPolicy`. `MapStaticAssets` endpoints would need `AllowAnonymous`. `[CITED: learn.microsoft.com/aspnet/core/fundamentals/static-files (aspnetcore-10.0, 2026-09-23)]`
- **Authorization matrix.** Add rows and allow-list entries for the two new anonymous fallbacks, using the exact `RoutePattern.RawText`. Today the matrix holds `new("*", "/health", …)`, `new("*", "/api/{**path}", "/api/v1/does-not-exist", Anonymous: 404, …)` and `new("GET", "/api/v1/site-settings", …)`, and `AnonymousAllowList` is `{ "* /health", "* /api/{**path}" }`. `[VERIFIED: tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:55-62]`
- **Test web root.** `CspsApiFactory` must point `WebRootPath` at a committed test fixture (`tests/…/Fixtures/wwwroot/index.html`, a stub). The .NET suite must not depend on a local `npm run build`. Otherwise the SPA row's 200 would be flaky.

### Pattern 8: Golden vectors and integer-centavo rounding (WEB-07, D-09, ORD-09)

- **One JSON file:** `tests/fixtures/order-math-golden-vectors.json`. **Amounts are strings** (`"17.00"`, `"7.5"`), so neither side parses binary floats from JSON.
- **Each case:** `{ id, note, items:[{qty, unitPrice}], discounts:[{type, value}], payments:[amount], expenses:[amount], expected:{ total, discount, paid, balance, expenses, profit, fullyPaid } }`. Expected values are strings with 2 decimals.
- **The generator** is a committed Node script that uses **BigInt exact rationals**, so it is independent of both implementations. It covers:
  - the PITFALLS midpoints (7.5% of 17.00 = 1.28; 2.5% of 23.00 = 0.58; 12.5% of 1.16 = 0.15; 1.005; 10.075)
  - ORD-2026-0148 and ORD-2026-0151
  - 100% discounts, zero items, multiple discounts and large values
  - seeded random cases
  
  The files are hand-reviewed and committed.
- **C# side.** `Csps.Domain` gets a pure `OrderMath` (`decimal`, `Math.Round(x, 2, MidpointRounding.AwayFromZero)`). It is held to the Domain 100% coverage gate. `tests/Csps.Domain.UnitTests` links the JSON (`<Content Include="..\fixtures\order-math-golden-vectors.json" Link="…" CopyToOutputDirectory="PreserveNewest" />`) and asserts every case with a theory.
- **TS side.** `csps.ts` `round2` → integer centavos, half away from zero. Percent discounts compute `itemsTotalCentavos × percent` with the percent scaled to an integer. Use BigInt or safe-integer arithmetic with an explicit bound. Do **not** use `Math.round(n * 100)` (`1.005*100 = 100.49999999999999` `[VERIFIED: node]`).
- **Pinned operation order**, documented once beside both implementations: round the items total → round each discount → sum the discounts → round the sum → subtract.
- **Vitest reads the file** with `fs.readFileSync(new URL('../../../tests/fixtures/…', import.meta.url))`. That avoids Vite `server.fs.allow` questions for paths outside `web/`.

### Pattern 9: TanStack Query defaults (WEB-08)

```ts
new QueryClient({ defaultOptions: {
  queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: false /* httpClient owns retries */, refetchOnWindowFocus: true },
  mutations: { retry: false },
} });
// list hooks: useQuery({ queryKey: keys.orders.list(params), queryFn: ({ signal }) => api.orders.list(params, signal),
//                        placeholderData: keepPreviousData })
```

- Build keys from parsed, defaulted nuqs values and the `useDebouncedValue(q, 300)` value.
- Do intent prefetch with `queryClient.prefetchQuery` on `pointerenter`/`focus`. Route-chunk prefetch calls the route's lazy `import()` on intent. **Do not** use RR's `<Link prefetch>`: it inserts `<link rel="prefetch">` elements after the link, which changes markup. `[VERIFIED: react-router 8.4.0 dist/development/lib/dom/lib.d.ts:737-760]`

### Pattern 10: nuqs list-state conventions (WEB-10)

- **Adapter placement.** `UrlStateLayout` is a pathless, **lazy** layout route rendering `<NuqsAdapter defaultOptions={{ shallow: true, clearOnDefault: true, scroll: false }}><Outlet/></NuqsAdapter>`. It sits above the admin routes, and above Gallery later.
- **Hook factory.** `createListParams(parsers)` returns a `useXxxListParams()` hook built on `useQueryStates`.
  - `setPage` uses `{ history: 'push' }`.
  - Every other setter uses `replace` and writes `page: null` in the same call.
- **Parsers.** `parseAsStringLiteral`, `parseAsNumberLiteral([10,20,50,100]).withDefault(20)`, a page parser rejecting values below 1, a search parser (trim, ≤ 100), and `parseAsBusinessDate` (plain `YYYY-MM-DD`, calendar-validated, so `2026-02-30` is rejected).
- **Normalize once.** A `useEffect` compares parsed versus raw values and rewrites the URL once with `replace` when they differ.
- **Tests.** Use `withNuqsTestingAdapter({ searchParams, onUrlUpdate })` and assert `history` and the query string. `[VERIFIED: quick-task 261007-kz6 research, tarball read]`

### Pattern 11: Playwright host, fixtures and matrix (QUAL-04, A11Y-01/02, PERF-03)

```ts
// playwright.config.ts (excerpt)
webServer: {
  command: 'dotnet run --project ../src/Csps.Server --no-launch-profile -- --urls https://localhost:5199 --webroot ' + e2eDist,
  url: 'https://localhost:5199/health', ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 120_000,
  env: { ASPNETCORE_ENVIRONMENT: 'Development', ConnectionStrings__Csps: 'Server=(localdb)\\CSPS;Database=CSPS_E2E;Integrated Security=true' }, // per-process only
},
use: { baseURL: 'https://localhost:5199', ignoreHTTPSErrors: true },
projects: [chromium, firefox, webkit, { name: 'pixel', use: devices['Pixel 7'] }, { name: 'iphone', use: devices['iPhone 15'] }],
```

- **HTTPS is mandatory** (Pitfall 2). The Development environment loads the user-secrets JWT key and Data Protection certificate created by `Initialize-DevSecrets.ps1`. CI (Phase 3) must supply equivalents per process.
- **Shared fixture.** It fails the test on:
  - `console` errors **and warnings**
  - `pageerror`
  - an injected `securitypolicyviolation` listener (`addInitScript`)
  - any `@axe-core/playwright` violation for the A11Y-01 tags
- **Viewport sweep.** 320/375/414/768/1024/1280/1536/1920 in portrait and landscape, on Chromium, asserting `scrollWidth <= innerWidth`, one `h1`, the skip link and labelled landmarks. Spot-check the same in Firefox, WebKit and the phone projects.
- **Preflight.** `npm run e2e` runs a small Node wrapper first. It invokes `C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` when present and aborts if 5199 is in use. Playwright's `reuseExistingServer: false` is the second guard.

### Pattern 12: In-house budget plugin (PERF-01) — the build itself fails

Vite 8 / Rolldown's `generateBundle(_, bundle)` exposes, per chunk, `isEntry`, `isDynamicEntry`, `facadeModuleId` (absolute source path), static `imports` and `viteMetadata.importedCss`. CSS is exposed as `.css` assets. `[VERIFIED: local probe printed these fields]`

- **The calculation** is a pure function, unit-tested: `initial(route) = closure(entry.imports) ∪ closure(routeChunk.imports)`, gzipped with `zlib.gzipSync(code, { level: 9 })`.
- **Route modules come from config.** Public uses `src/app/public/PublicPlaceholderPage.tsx`. Admin uses `src/app/admin/AdminLayout.tsx` and `src/app/admin/AdminPreviewPage.tsx`.
- **On a breach** the plugin calls `this.error(…)` with a table.
- **Units:** **1 KB = 1000 bytes** (matches Vite's own report; stricter than KiB).
- **Two builds.** `npm run build` runs the production build, which measures public and CSS. A second `vite build --mode budget --outDir .budget-dist` includes dev routes and measures admin and the admin-topology public number (D-20).

### Pattern 13: Lighthouse gate (PERF-02)

- **What runs.** `lighthouse https://localhost:5199/ --output=json --quiet --no-enable-error-reporting --chrome-flags="--headless=new --ignore-certificate-errors"` against the **production** build served by the host, with the default mobile form factor and simulated throttling. It uses the locally installed Chrome.
- **What `scripts/lighthouse-assert.mjs` checks:**
  - each category score ≥ 0.95
  - `largest-contentful-paint` < 2000 ms
  - `cumulative-layout-shift` < 0.05
  - `total-blocking-time` as the lab proxy for INP
- **Reports** go to `artifacts/lighthouse/`, which is gitignored. Never upload them (no `temporary-public-storage`).

### Pattern 14: Fonts (PERF-05)

- **Imports.** Import `@fontsource/barlow-condensed/{600,700,800,800-italic}.css` and `@fontsource-variable/archivo`, i.e. the spec's verbatim imports, which carry `unicode-range`. Browsers download only the subsets a page uses.
- **Preload** the Archivo latin woff2 through a `transformIndexHtml` plugin that finds the hashed asset in `ctx.bundle`. No inline script.
- **Fallback faces** in `overrides.css` use `local("Arial")` / `local("Arial Narrow")` with computed `size-adjust` / `ascent-override` / `descent-override`. Compute them once with a script that reads the woff2 and local TTF metrics, and commit them as constants.
- **Give "Barlow Condensed Fallback" `unicode-range: U+0000-20B0, U+20B2-10FFFF`.** Otherwise ₱ resolves to the local fallback before Archivo (Pitfall 17).

### Anti-Patterns to Avoid
- **Rendering the SPA shell from Vite's dev server under CSP.** Vite dev injects `<style>` and inline preamble scripts. CSP is verified only on the built app served by Kestrel.
- **`<Navigate>` to rewrite query params** (nuqs #1245). Use loader `redirect()`.
- **Copying nuqs state into `useState`/form state** (two sources of truth).
- **Inline theme bootstrap `<script>` in `index.html`.** It is blocked by `script-src 'self'`. The admin reads `localStorage` in a lazy `useState` initializer. Public is always light.
- **`createPortal` to `document.body`.** Overlays lose `data-theme` and the `pg` container. Render inside the layout's `.s-page` (spec §2.7).
- **`npm audit fix --force` or editing `allowed-licenses.json` to pass a gate.** Report to the owner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Cool-down enforcement across the whole npm tree | Date-check scripts over `package-lock.json` | npm 11 `min-release-age=14` + `min-release-age-exclude[]` in `web/.npmrc` | Covers transitive packages (e.g. vite's `rolldown ~1.2.11` resolved to **1.2.13, published today** in the probe) `[VERIFIED]` |
| URL state parsing/serialization, history semantics | Custom `useSearchParams` wrappers | nuqs 2.10.1 (approved) | Batching, `clearOnDefault`, throttling, testing adapter |
| Server-state cache, keep-previous, cancellation | Custom fetch hooks | TanStack Query 5 | `signal` per query, `keepPreviousData`, prefetch |
| a11y rule engine | Custom checks | axe-core 4.13 (component) + @axe-core/playwright (page) | Same ruleset both levels via `overrides` |
| Contrast/layout-dependent a11y in unit tests | jsdom contrast hacks | Playwright + axe | jsdom has no layout/canvas |
| Font subsetting | Custom subset tooling | fontsource subsets + `unicode-range` | Browser downloads only needed subsets |
| License inventory for npm | Parsing `node_modules` by hand in CI | license-checker-rseidelsohn `--onlyAllow` (+ `--production`) | Handles SPDX expressions, dev/prod split |
| OpenAPI → TS types | Hand-written DTOs | openapi-typescript 7.13 in `tools/openapi-gen` (D-16) | Drift check is mechanical |
| React memoization | Manual `useMemo`/`memo` everywhere | React Compiler 1.0 | Verified 0 bail-outs on the design system |

**Key insight:** this phase's risk is not missing libraries. It is **invisible drift**: a too-new transitive package, a font face silently shadowed, a DOM attribute that changed, a CSP-blocked asset on one engine only. Every gate here should be an automated assertion, not a review step.

## Common Pitfalls

### Pitfall 1: Building into `wwwroot` dirties git and gets deployed with stale content
- **What goes wrong:** `.gitignore` ignores only `**/wwwroot/assets/` `[VERIFIED: .gitignore:31]`, so `index.html`, `mark.svg` and `robots.txt` written to `src/Csps.Server/wwwroot/` show up as untracked or modified.
- **Avoid:** ignore `src/Csps.Server/wwwroot/` entirely. `emptyOutDir: true` explicitly. Never place hand-written files there; they belong in `web/public/`.

### Pitfall 2: WebKit breaks on `http://localhost:5199` because of `upgrade-insecure-requests`
- **What goes wrong:** the strict CSP ends with `upgrade-insecure-requests` `[VERIFIED: src/Csps.Server/Http/SecurityHeadersMiddleware.cs:16-17]`. WebKit upgrades http://localhost subresource requests to https (Chrome and Firefox exempt localhost). WebKit bug 250776 is still **NEW/unfixed**. So the Playwright WebKit and iPhone projects would load a blank page. `[CITED: bugs.webkit.org/show_bug.cgi?id=250776]`
- **Avoid:** run the E2E host on **https://localhost:5199** (Kestrel dev cert, `ignoreHTTPSErrors: true`). Never relax the CSP for tests.

### Pitfall 3: Lighthouse fails LCP because Kestrel serves JS uncompressed
- **What goes wrong:** the public entry is **≈ 370 KB raw vs ≈ 118 KB gz** `[VERIFIED: probe]`. Lighthouse's simulated Slow-4G uses transferred bytes. Without compression, JS download alone is about 1.8 s, so LCP < 2.0 s is unrealistic. Production IIS compression is a Phase 3 item.
- **Avoid:** `AddResponseCompression` (Brotli + Gzip, `EnableForHttps = true`) restricted to `text/html`, `text/css`, `text/javascript`/`application/javascript` and `image/svg+xml`, **never JSON** (BREACH). Also set immutable caching for `/assets/*`.

### Pitfall 4: `prettier --check` fails every file on Windows
- **What goes wrong:** `core.autocrlf=true` and there is no `.gitattributes`. Working-tree files are CRLF (`git ls-files --eol` shows `i/lf w/crlf`), and Prettier defaults to `endOfLine: "lf"`. `[VERIFIED: git config + ls-files --eol]`
- **Avoid:** add `.gitattributes` with `web/** text eol=lf` (plus `tests/fixtures/*.json`), then renormalize. Put the byte-for-byte spec CSS files in `.prettierignore`.

### Pitfall 5: Verbatim CSS "byte-for-byte" vs line endings
- **What goes wrong:** the spec markdown has CRLF/LF mixed line terminators `[VERIFIED: file(1) on extracted index.tsx]`. A byte-for-byte check against the markdown fails on line endings alone.
- **Avoid:** define the verbatim check as **LF-normalized** equality. A test extracts each Appendix block from `CSPS-UI-SPEC.md` and compares it to `src/styles/*.css`.

### Pitfall 6: Autofixing `prefer-nullish-coalescing` changes rendered output
- **What goes wrong:** there are 17 findings in `index.tsx` such as `label || 'No image yet'`. `??` keeps `''` where `||` replaced it, which is a DOM change.
- **Avoid:** `ignorePrimitives: { string: true, number: true, boolean: true }`. Never run `eslint --fix` over the design system without the differential DOM test green.

### Pitfall 7: The measured lint/type delta on verbatim code (sizing the reconciliation task)
- **Types.** 7 TS errors, identical in TS 6 and 7:
  - `UiLink` spread (`exactOptionalPropertyTypes`)
  - `Avatar` `p[0]`
  - `ImageUploader` `splice` result
  - 3 × `MediaPlaceholder` optional props
  - `ConfirmDialog` → `Modal onClose`
  
  `[VERIFIED: probe tsc7/tsc6]`
- **Lint.** 99 findings:

  | Count | Rule |
  |---|---|
  | 17 | restrict-template-expressions |
  | 17 | prefer-nullish-coalescing |
  | 16 | no-confusing-void-expression |
  | 14 | restrict-plus-operands |
  | 7 | no-unnecessary-type-conversion |
  | 7 | no-useless-default-assignment |
  | 5 | array-type |
  | 3 | no-unnecessary-condition |
  | 2 | jsx-a11y-x/no-static-element-interactions (uploader drop zone, Modal overlay) |
  | 1 | jsx-a11y-x/no-noninteractive-element-interactions (draggable `li`) |
  | 1 | jsx-a11y-x/anchor-is-valid (Sidebar logout `href="#"`) |
  | 1 | jsx-a11y-x/anchor-has-content (children via spread in `UiLink`) |
  | 1 | react-hooks/static-components |
  | 1 | no-restricted-syntax (`dangerouslySetInnerHTML`) |
  | 6 | misc |

  By file: csps.ts 15, icons.ts 1, mark.ts 1, index.tsx 82. `[VERIFIED: probe eslint]`
- **No-DOM-change fixes** for the static-element handlers: attach `mousedown`/`drag*` listeners through `ref` + `useEffect` instead of JSX props.

### Pitfall 8: Playwright/axe under a strict CSP
- **What goes wrong:** page-level axe injects axe-core into the page. Playwright's `evaluate` normally bypasses page CSP, but each engine must be confirmed.
- **Avoid:** a Wave-0 smoke test runs `AxeBuilder` on the strict-CSP placeholder page in all three engines before any other E2E work. **Never** set `bypassCSP: true` in the projects that assert CSP violations. `[ASSUMED]`

### Pitfall 9: The Modal from App. D.3 isn't a dialog yet
- **What goes wrong:** it has no initial focus, no Tab trap and no focus return, and it closes via an overlay `onMouseDown` on a `div`.
- **Avoid:** a `useFocusTrap(ref, { initialFocus, returnFocus, onEscape })` hook, focus return to the trigger, and `document.body.style.overflow` locking. CSSOM writes are allowed under `style-src 'self'`.

### Pitfall 10: React Router 8 logs "No `HydrateFallback` element provided…" with lazy initial routes
- **What goes wrong:** `react-router/dist/development/lib/hooks.js:776` calls `warningOnce("route-fallback", false, "No \`HydrateFallback\` element provided to render during initial hydration")` when the router hasn't initialized and no route supplies a fallback. That is a console warning in dev and in Vitest, which breaks zero-warnings. `[VERIFIED: react-router 8.4.0 source]`
- **Avoid:** give the root route a `HydrateFallback`, a minimal `.s-page` shell with no CLS.

### Pitfall 11: Unknown static file paths answer 401 instead of 404
- **What goes wrong:** with the default-deny fallback policy, a request that matches no endpoint gets the fallback policy. That is why non-API unknowns are 401 today (STATE). `/missing.js` would stay 401 after the SPA fallback, because `{*path:nonfile}` excludes file-like paths.
- **Avoid:** an anonymous `{*path:file}` fallback that returns ProblemDetails 404, with its own matrix row.

### Pitfall 12: The existing `ProductionHasNoApiDocs` test changes meaning
- **What goes wrong:** it requests `/openapi/v1.json`, `/scalar` and `/scalar/` in Production and expects non-success ProblemDetails `[VERIFIED: tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs:65]`. After the SPA fallback, `/scalar` and `/scalar/` (non-file) return the SPA `index.html` with 200.
- **Avoid:** either reserve `/scalar`, `/openapi` and `/health/*` from the SPA fallback (a 404 fallback per reserved prefix in non-Development; recommended), or update the test to assert "no Scalar content". Decide in the plan; don't let the test silently fail.

### Pitfall 13: Golden-vector false confidence
- **What goes wrong:** ORD-2026-0148 uses 5% of ₱22,450 = ₱1,122.50 exactly, so it passes with the buggy `round2` too (PITFALLS #1).
- **Avoid:** the generator must include explicit midpoint cases. Check that the **unmodified** spec `round2` **fails** some vectors. That is the red evidence for D-09.

### Pitfall 14: jsdom `AbortSignal` vs Node's `fetch`
- **What goes wrong:** passing a jsdom-realm `AbortSignal` to Node's undici `fetch` throws a cross-realm type error. `[ASSUMED]`
- **Avoid:** httpClient tests inject a fake `fetch`. Nothing in Vitest calls the real network.

### Pitfall 15: `crypto.randomUUID()` is undefined over plain-HTTP LAN addresses
- **What goes wrong:** `randomUUID` is secure-context only `[CITED: MDN Crypto.randomUUID]`. `localhost` and production HTTPS are fine. Opening the Vite dev server from a phone at `http://192.168.x.x:5180` is not.
- **Avoid:** document it. Optionally fall back to a `getRandomValues`-based v4 UUID. `getRandomValues` is assumed available in insecure contexts `[ASSUMED]`.

### Pitfall 16: Retry layering
- **What goes wrong:** TanStack's default `retry: 3` on top of httpClient's capped retries (max 2) can produce up to 12 requests.
- **Avoid:** set Query `retry: false`; httpClient owns retries.

### Pitfall 17: Barlow Condensed has **no ₱ glyph**
- **What goes wrong:** the cmap of every `@fontsource/barlow-condensed` 5.3.0 woff2 (latin, latin-ext, vietnamese) lacks U+20B1. Archivo Variable latin-ext has it. `[VERIFIED: woff2 cmap read in probe; parser validated against known glyphs Ā Ł ₺ ₽ €]` Today ₱ in display text (KPI values, money in Barlow) falls back per character to `"Archivo Variable"`, the next family in `--font-display`, which is still a brand font. But the UI-SPEC plan inserts `"Barlow Condensed Fallback"` (local Arial) **right after** Barlow. Then ₱ would render from **system Arial**, violating PERF-05 and the UI-SPEC's own "never a system font".
- **Avoid:** give the Barlow fallback face a `unicode-range` that excludes U+20B1. Show the owner ₱ next to Barlow digits in the D-23 screenshots, because ₱ is visibly a different face.

### Pitfall 18: Fontsource per-subset CSS files have no `unicode-range`
- **What goes wrong:** `latin-800.css` and `latin-ext-800.css` contain **0** `unicode-range` declarations, while `800.css` contains them. `[VERIFIED: grep in probe node_modules]` Importing both per-subset files declares two same-descriptor faces covering everything. The later one shadows the earlier one, and both download.
- **Avoid:** STACK.md's "import per-subset CSS" advice is wrong. Use the spec's weight files, or hand-write `@font-face` with `unicode-range`.

### Pitfall 19: Tailwind v4 auto source detection
- **What goes wrong:** the probe's CSS changed size when a previous `dist-a/` folder sat inside the project (92.67 vs 90.98 KB raw), so Tailwind scanned build output. `[VERIFIED: probe]`
- **Avoid:** keep every build/test output folder gitignored (Tailwind honors `.gitignore`), and add a CSS-size assertion to the budget.

### Pitfall 20: jsdom gaps and noisy console
- **What goes wrong:** `matchMedia`, `ResizeObserver` and canvas are missing in jsdom. axe's `color-contrast` touches canvas.
- **Avoid:** mock `matchMedia` in setup, disable `color-contrast` in the jsdom helper, and fail tests on `console.error`/`console.warn` through a setup spy (PRD §17.2).

## Code Examples

### Root error callbacks (WEB-05 "logs nothing to the console in production")
```tsx
// React 19 createRoot options exist in react-dom 19.3 (types: @types/react-dom client.d.ts:22-26) [VERIFIED]
createRoot(rootEl, {
  onCaughtError: import.meta.env.PROD ? () => {} : undefined,   // error boundaries already render the UI
  onUncaughtError: import.meta.env.PROD ? () => {} : undefined,
}).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
```

### Business-zone date formatting (ORD-09)
```ts
// node 24 probe: formats 2026-10-05T16:30:00Z as "Oct 6, 2026" in Asia/Manila [VERIFIED]
const fmt = (zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric' });
export const formatBusinessDate = (utcIso: string, zone = 'Asia/Manila'): string => fmt(zone).format(new Date(utcIso));
// Keep D.1 formatDate for plain 'YYYY-MM-DD' business dates (it parses them as local dates, which is correct for date-only values).
```

### Theme init without inline script (D-13)
```tsx
const readTheme = (): 'light' | 'dark' => { try { return localStorage.getItem('csps-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
const [theme, setTheme] = useState(readTheme); // lazy initializer: no effect, no setState-in-effect lint
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `react-router-dom` + `<BrowserRouter>` | `react-router` 8 data router (`createBrowserRouter`, `RouterProvider` from `react-router/dom`) | RR v8 (2026-06) | D.6 adapts; no DOM change |
| `typescript` = the compiler | TS 7 native `tsc` + TS 6 API alias | TS 7.0 (2026-07) | Two pinned aliases (D-15) |
| plugin-react inline `babel` option | `@rolldown/plugin-babel` + `reactCompilerPreset()` | plugin-react 6 | Extra pinned dev deps |
| `eslint-plugin-jsx-a11y` | `eslint-plugin-jsx-a11y-x` (ESLint 10) | ESLint 9 EOL 2026-08-06 | D-17 |
| Manual cool-down discipline | npm `min-release-age` | npm 11.x (local 11.19.0) | Enforced for transitive deps |
| `@lhci/cli` | `lighthouse` 13 + small assert script | LHCI stale (bundles LH 12.6.1) | Owner decision |
| MSW v2 | MSW v3 (`msw/node`, ESM-only) | 2026-09-28 | Defer until aged |

**Deprecated / outdated in project docs:**
- STACK.md "import per-subset fontsource CSS" → wrong (Pitfall 18).
- CONTEXT/UI-SPEC "57 icons" → **56** in App. D.5 (the §2.6 list and the `ICONS` object both have 56 entries). `[VERIFIED: script over CSPS-UI-SPEC.md]`
- A11Y-01 wording "vitest-axe per component" → superseded by D-18.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Playwright's `addInitScript` and AxeBuilder's injection work under the strict CSP in all three engines | Pitfall 8, Pattern 11 | Page-level axe or CSP listener fails; needs a separate non-asserting project |
| A2 | `--webroot <path>` on the `dotnet run` command line sets the web root for `WebApplication.CreateBuilder(args)` | Pattern 11 | E2E build must be copied into wwwroot instead (risk of deploying dev routes) |
| A3 | A jsdom-realm `AbortSignal` passed to Node's fetch throws | Pitfall 14 | None if fetch is injected anyway |
| A4 | `crypto.getRandomValues` is available in insecure contexts | Pitfall 15 | Fallback UUID would also fail on LAN http |
| A5 | Lighthouse treats a 4xx `robots.txt` as "no robots.txt" (pass) | Pattern 13 | Ship `web/public/robots.txt` anyway (recommended) |
| A6 | IIS (Phase 3) leaves app-compressed responses alone | Pitfall 3 | Double-compression config clash, fixable in web.config |
| A7 | Chromium CDP `CSS.getPlatformFontsForNode` can prove which font rendered ₱ | Pattern 14 / Validation | Fall back to `document.fonts.check` + screenshot review |
| A8 | `Property[key.name='startTransition']` lint selector won't false-positive on legitimate code | Pattern 6 | Narrow selector to nuqs call sites |
| A9 | React Compiler raises no diagnostics on the in-house nuqs hooks (not probed with compiler on hooks) | Pattern 10 | Opt the hook module out with `'use no memo'` + recorded deviation |

## Open Questions (owner / planner decisions) (RESOLVED)

> All nine items were settled on 2026-10-07. Items 1, 2 and 4–9 were settled by the owner rulings D-25..D-30 in `02-CONTEXT.md`. Item 3 is settled by process: D-12 requires the owner to review every changed icon, and plan 02-09 Task 3 (`checkpoint:decision`) records that review as D-32 before plan 02-11 starts.

1. **O-9 (new D-08 item): Sidebar "Logout" is `<a href="#" onClick>`.** jsx-a11y-x `anchor-is-valid` fails it (strict). **RESOLVED → D-27.**
   - Options: (a) `<button class="csp-nav">`, a DOM change that may need `compat` styling; (b) keep the anchor with one scoped, justified `eslint-disable-next-line` and an issue link (PRD §17.1 allows justified suppressions).
   - Recommendation: (a) with before/after screenshots, batched into the UI-SPEC § Owner Confirmations checkpoint.
2. **O-10 (new D-08 item): lucide-react classes.** lucide-react 1.52.0's React `Icon` always prepends `lucide lucide-<name>` (plus alias classes). React has no `includeDefaultClasses` switch (`Icon.mjs` never passes it). `[VERIFIED: tarball read]` The `<svg>` wrapper's `class` therefore differs from App. D.3's `csp-icon …`. It is invisible, because no CSS targets `.lucide`. **RESOLVED → D-28.**
   - Recommendation: accept, and normalize those classes in the differential test. Rendering our own `<svg>` from lucide's internal `__iconData` would need un-typed deep imports.
3. **Icon drift for D-12.** 20 of 56 icons have different node data in 1.52.0: **RESOLVED → D-12 → 02-09 Task 3 → D-32.**
   - search, trash-2 (now an alias of `trash`), receipt, users, log-out, menu, phone, message-circle, mail, clock, circle-check, list, filter (now an alias of `funnel`), calendar, palette, zap, trending-up, trending-down, package, moon
   
   Several are element-type rewrites that look identical (polyline/line → path). Some are visibly different: **menu's bars moved from y=6/12/18 to 5/12/19**. `[VERIFIED: script comparing App. D.5 to lucide-react 1.52.0 icon data]` The owner reviews these renders.
4. **Lighthouse tool.** Replace `@lhci/cli` (named in CLAUDE.md; 11 high audit findings) with `lighthouse` 13.5.0 + an in-house assert script? Recommendation: yes. **RESOLVED → D-25.**
5. **License exceptions for the dev/build tree.** These are free licenses: MPL-2.0 widened to **build** scope (lightningcss, required by Vite 8/Tailwind 4), CC-BY-4.0 (caniuse-lite data), CC0-1.0, BlueOak-1.0.0 and 0BSD. The owner must approve before the npm license gate can pass. The production tree stays strict. **RESOLVED → D-26.**
6. **Vite 8.3.3 security-fix cool-down exception.** It is one day old and fixes three advisories. Approve as `accepted: security fix …`? **RESOLVED → D-25.**
7. **MSW deferral.** D-19 named MSW v3, but no v3 release is 14 days old until 2026-10-12. Recommendation: Phase 2 does without MSW (fake `fetch`), and the first phase with real endpoints adds it. **RESOLVED → D-25.**
8. **Reserved server prefixes vs the SPA fallback** (Pitfall 12). Should `/scalar` and `/openapi` answer 404 in production (recommended) or fall to the SPA shell? **RESOLVED → D-29.**
9. **E2E environment.** Phase 2 runs the E2E host in `Development` (user-secrets supply the JWT key and Data Protection certificate) on HTTPS 5199. Phase 3 CI must provide per-process secrets. Confirm that this split is acceptable. **RESOLVED → D-30.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | web build/test | ✓ | 24.21.0 (≥ 24.15 for jsdom 30) | — |
| npm | install, `min-release-age` | ✓ | 11.19.0 | — |
| .NET SDK | SPA host, xUnit vectors | ✓ | 10.0.401 | — |
| ASP.NET dev HTTPS cert | E2E host on https 5199 | ✓ (valid to 2027-10-04; trust not checked, not needed with `ignoreHTTPSErrors`) | — | `dotnet dev-certs https` |
| Google Chrome | Lighthouse | ✓ | installed at Program Files | Playwright Chromium via `--chrome-path` |
| Playwright browsers (chromium 1243, firefox 1543, webkit 2359) | E2E | ✓ in shared `%LOCALAPPDATA%\ms-playwright` (exact match for 1.63.0) | — | `npx playwright install` (additive) |
| LocalDB `(localdb)\CSPS` | E2E host DB (`CSPS_E2E`), .NET tests | ✓ | SQL 2025 | — |
| `C:\Work\dev-tools\preflight.ps1` | Shared-machine rule | ✓ | — | Playwright `reuseExistingServer: false` errors on busy port |
| Docker | — | not used (forbidden locally) | — | — |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework (web unit/component) | Vitest 5.0.x + jsdom 30.1.1 + RTL 16 + in-house axe helper |
| Framework (E2E) | Playwright 1.63.0 + @axe-core/playwright 4.13.0 |
| Framework (.NET) | xUnit v3 4.x on MTP (existing) |
| Config files | `web/vitest.config.ts` (or `test` block in `vite.config.ts`), `web/src/test/setup.ts`, `web/playwright.config.ts` — **all Wave 0** |
| Quick run (web) | `npm --prefix web run test -- --run <path-or-pattern>` |
| Quick run (.NET) | `dotnet test --project tests/Csps.Domain.UnitTests` |
| Full web suite | `npm --prefix web run verify` = typecheck + lint (`--max-warnings 0`) + `prettier --check` + `vitest run --coverage` + `build` (budgets) + license gate |
| E2E | preflight, then `npm --prefix web run e2e` (builds `.e2e-dist`, starts the https 5199 host) |
| Lighthouse | `npm --prefix web run lighthouse` (production build on the 5199 host) |
| Full .NET | `dotnet test --solution Csps.slnx` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| WEB-01 | Build emits `index.html` + assets into `wwwroot`; dev config has 5180/strictPort/proxy | unit (config) + script | `vitest run src/test/build-config.test.ts`; `npm run build` | ❌ Wave 0 |
| WEB-01 | SPA shell anonymous; `/api/*` stays ProblemDetails 404; missing file 404; matrix rows | .NET integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHost*"` | ❌ Wave 0 |
| WEB-02 | Verbatim CSS equals spec blocks (LF-normalized) | unit | `vitest run src/styles/verbatim.test.ts` | ❌ Wave 0 |
| WEB-02 | Reconciled components render the same DOM as frozen verbatim reference | component | `vitest run src/ui/differential.test.tsx` | ❌ Wave 0 |
| WEB-02 | Modal focus trap/return, Tabs ARIA/roving, Mark JSX | component + axe | `vitest run src/ui` | ❌ |
| WEB-03 | httpClient: interceptors, timeout/abort, params, JSON/FormData, XHR progress, single-flight 401, capped retries, HttpError | unit, 100% lines/branches | `vitest run src/lib/http --coverage` | ❌ |
| WEB-04 | Lint rejects fetch/httpClient/axios outside api.ts; nuqs bans | unit (ESLint `Linter`) | `vitest run src/test/lint-rules.test.ts` | ❌ |
| WEB-05 | Layout landmarks, skip link, one h1, error boundary UI, admin excluded from prod build | component + build assertion | `vitest run src/app`; budget plugin asserts no admin chunk in production | ❌ |
| WEB-06 | Each SPEC-GAP primitive behaviour + zero axe | component | `vitest run src/ui/gaps` | ❌ |
| WEB-07 | ≥ 200 golden vectors pass in TS | unit | `vitest run src/lib/csps.golden.test.ts` | ❌ |
| WEB-07 | Same vectors pass in C# `OrderMath` | xUnit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMathGoldenVector*"` | ❌ |
| WEB-08 | Query defaults, keepPreviousData, 300 ms debounce, signal cancellation | component (fake timers) | `vitest run src/lib/query` | ❌ |
| WEB-09 | One key per submission, reused on retry and refresh-retry; pending button `aria-disabled`, one request per double-click | unit + component | `vitest run src/lib/http src/ui/gaps/submit` | ❌ |
| WEB-10 | Parsers (`size=9999`, `page=0`, `status=bogus`, `from=2026-02-30`), push vs replace, page reset, dropped defaults, rewrite-once | unit + component (`nuqs/adapters/testing`) | `vitest run src/lib/url-state` | ❌ |
| ORD-09 | `₱12,450.00`, `−₱…`, `Oct 6, 2026`; MoneyInput pattern, paste, blur pad, `inputMode=decimal` | unit + component | `vitest run src/lib/format src/ui/gaps/MoneyInput` | ❌ |
| QUAL-02 | 0 type errors (TS 7), 0 lint warnings, Prettier clean | gate | `npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check` | ❌ |
| QUAL-04 | E2E fails on console error/warning, CSP violation, axe violation (fixture self-tests with a deliberately bad page in a test-only route) | E2E | `npm --prefix web run e2e -- --grep @fixture` | ❌ |
| A11Y-01 | Zero axe violations: placeholder, admin previews, showcase (both themes) | E2E | `npm --prefix web run e2e -- --grep @axe` | ❌ |
| A11Y-02 | Keyboard: skip link focuses `#main`; dialog trap/return; drawer; user menu arrows | E2E + component | `npm --prefix web run e2e -- --grep @keyboard` | ❌ |
| A11Y-04 | No text-bearing element with `opacity < 1`; no focused element invisible; D-03 weight cue | unit (CSS/TSX grep) + E2E | `vitest run src/styles/overrides.test.ts`; `e2e --grep @a11y-rulings` | ❌ |
| PERF-01 | Budgets fail the build over limits (plugin unit tests with synthetic bundles) | unit + build | `vitest run scripts/budget.test.ts`; `npm run build` | ❌ |
| PERF-02 | Lighthouse ≥ 95 all categories, LCP < 2 s, CLS < 0.05 | Lighthouse script | `npm --prefix web run lighthouse` | ❌ |
| PERF-03 | No horizontal scroll at 8 widths × 2 orientations; inputs ≥ 16 px on phones | E2E | `npm --prefix web run e2e -- --grep @responsive` | ❌ |
| PERF-05 | `document.fonts.load` + `check('16px "Archivo Variable"','₱')`; ₱ never system font; preload link present; woff2 only `font-src 'self'` | E2E + build assertion | `npm --prefix web run e2e -- --grep @fonts` | ❌ |
| (registry) | `docs/dependencies.json` covers `web/package.json` + `tools/openapi-gen/package.json` pins, kind `npm` | .NET arch test | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"` | ✅ exists; needs `npm` kind + web pin reader |
| (D-16) | Committed `openapi.v1.json` equals live Development doc; generated TS matches | .NET integration + node script | `dotnet test … --filter-class "*OpenApiSnapshot*"`; `npm --prefix tools/openapi-gen run check` | ❌ |

### Sampling Rate
- **Per task commit:** the quick Vitest pattern for the touched folder, plus `npm --prefix web run typecheck` (TS 7 is fast).
- **Per wave merge:** `npm --prefix web run verify` and `dotnet test --solution Csps.slnx`.
- **Phase gate:** the full web and .NET suites, then E2E (after preflight) and Lighthouse, all green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `web/` scaffold: `package.json` (pins after owner approval), `.npmrc`, `package-lock.json`, tsconfigs, `eslint.config.ts`, Prettier config/ignore, `vite.config.ts`, `index.html`, `public/`
- [ ] `.gitattributes` (`web/** text eol=lf`, fixtures) + `.gitignore` additions (`src/Csps.Server/wwwroot/`, `web/.e2e-dist/`, `web/.budget-dist/`, `artifacts/` already present)
- [ ] `web/src/test/setup.ts` (jest-dom/vitest, console-error/warn guard, `matchMedia` mock), `web/src/test/axe.ts`
- [ ] `web/playwright.config.ts` + `e2e/fixtures.ts` (console/CSP/axe) + Wave-0 smoke: AxeBuilder + CSP listener on all engines over HTTPS 5199
- [ ] `scripts/vite-budget-plugin.ts` + pure `budget.ts` + tests; `scripts/lighthouse-assert.mjs`
- [ ] `tests/fixtures/order-math-golden-vectors.json` + generator script; `src/Csps.Domain/Orders/OrderMath.cs` + xUnit theory
- [ ] `tests/Csps.ArchitectureTests`: `DependencyRegistry` `Kinds` gains `"npm"` (today `private static readonly string[] Kinds = ["nuget", "tool"];` and `Scopes = ["runtime", "build", "test", "tool", "font"];` `[VERIFIED: tests/Csps.ArchitectureTests/DependencyRegistry.cs:17-18]`); `PackagePins` reads `web/package.json` and `tools/openapi-gen/package.json`; move nuqs from `planned` to `packages`
- [ ] npm license gate script (license-checker-rseidelsohn) + THIRD-PARTY-NOTICES client section from Vite `build.license`
- [ ] `CspsApiFactory` fixture web root + SPA host tests + matrix rows

## Security Domain

`security_enforcement` is enabled with ASVS Level 1 (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V1 Architecture | yes | Default-deny auth retained; SPA host is an explicit anonymous allow-list entry with matrix rows |
| V2 Authentication | no (Phase 4) | — |
| V3 Session Management | no (Phase 4); httpClient designed for bearer + refresh | No tokens in URLs or `localStorage` (only theme is stored) |
| V4 Access Control | yes | Admin and `/dev` routes absent from production builds (D-20), proven by budget/manifest assertion |
| V5 Input Validation | yes | nuqs allow-list parsers (CWE-20), MoneyInput regex, search ≤ 100 chars; server stays authoritative (SEC-03) |
| V7 Error Handling | yes | Error boundary shows plain copy + traceId, no stack; `onCaughtError` silent in prod |
| V8 Data Protection | yes | No PII as structured URL params; analytics path without query (ANL-05 later); no source maps in prod |
| V10 Malicious Code / supply chain | yes | `min-release-age=14`, exact pins, lockfile, `npm audit --audit-level=high`, license gate, registry test |
| V14 Configuration | yes | Strict CSP unchanged; headers on static responses; compression limited to static text types (BREACH) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| XSS via `dangerouslySetInnerHTML` / HTML strings (CWE-79) | Tampering | Lint ban; `Mark` as JSX; React escaping; strict CSP as second layer |
| Open redirect via URL params (CWE-601) | Spoofing | Params never reach `href`/`navigate()` unvalidated; local-path checks |
| Inline script/style injected by tooling (CSP bypass pressure) | Tampering | No inline bootstrap; Playwright CSP-violation fixture in all engines |
| Supply-chain compromise via fresh releases (ATT&CK T1195) | Tampering | npm `min-release-age`, exact pins, provenance-checked approvals, advisory checks at install |
| Dev-only routes shipped to production (CWE-489) | Elevation | Compile-time `__DEV_ROUTES__` + build assertion; E2E build in separate web root |
| BREACH via compressed secrets over HTTPS | Info disclosure | Compress only static html/css/js/svg; never JSON |
| Sensitive data in URLs/history (CWE-598) | Info disclosure | Only `q` free text (owner-accepted); no tokens/codes; Referrer-Policy already strict-origin-when-cross-origin |
| Stale cached `index.html` after deploy loading missing chunks | DoS (availability) | `index.html` `no-cache`; ErrorBoundary handles chunk-load failures with "Reload Page" |
| `localStorage` tampering of theme | Tampering | Accept only `'light' | 'dark'`; try/catch |

## Sources

### Primary (HIGH)
- npm registry (`registry.npmjs.org` metadata, `npm view`) for every package and version above, read 2026-10-07
- npm bulk advisory endpoint (`/-/npm/v1/security/advisories/bulk`), GitHub repo security-advisory API (vitejs/vite, remix-run/react-router, facebook/react, babel/babel, vitest-dev/vitest, TanStack/query, and others)
- Local probe (session scratchpad, outside the repo):
  - install with no peer conflicts and 0 audit findings
  - Vite 8.3.3 builds (4 variants)
  - TS 7.0.2 / 6.0.3 strict type checks
  - ESLint 10.11 typed lint
  - React Compiler logger
  - woff2 cmap reads
  - lucide-react 1.52.0 tarball read and icon diff
  - react-dom 19.3.0 and react-router 8.4.0 source reads
  - `npm audit` for @lhci/cli 0.15.1 and lighthouse 13.4.0/13.5.0
  - npm 11.19.0 `min-release-age` behaviour
- Repo files read this session:
  - `src/Csps.Server/Program.cs`, `Http/SecurityHeadersMiddleware.cs`, `Endpoints/ApiRouting.cs`, `web.config`, `Properties/launchSettings.json`
  - `tests/Csps.ArchitectureTests/DependencyRegistry.cs`, `PackagePins.cs`
  - `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`, `Http/OpenApiExposureTests.cs`
  - `tests/Csps.Testing/CspsApiFactory.cs`
  - `docs/dependencies.json`, `docs/dependencies.md`, `docs/allowed-licenses.json`, `docs/license-exceptions.json`
  - `.gitignore`

### Secondary (MEDIUM, official docs via WebFetch)
- [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/?p=5246): alias recipe, default and removed options, API in 7.1
- [WHATWG HTML: prepare the script element](https://html.spec.whatwg.org/multipage/scripting.html): data-block return (step 13) before the CSP check (step 21)
- [Serve static files in ASP.NET Core (aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/static-files?view=aspnetcore-10.0): static-file authorization, MapStaticAssets manifest
- [MDN Crypto.randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID): secure-context only
- [WebKit bug 250776](https://bugs.webkit.org/show_bug.cgi?id=250776): `upgrade-insecure-requests` applied to localhost (NEW)
- `@vitejs/plugin-react` 6.1.1 README (tarball), `eslint-plugin-react-hooks` 7.1.1 README, `eslint-plugin-jsx-a11y-x` 0.2.0 README
- Prior project research: `.planning/research/STACK.md`, `PITFALLS.md`, `.planning/quick/261007-kz6-…/261007-kz6-RESEARCH.md`

### Tertiary (LOW)
- WebSearch result pages on WebKit localhost behaviour, used only to locate the bug report: [WebKit Bugzilla](https://bugs.webkit.org/show_bug.cgi?id=250776), [dfinity forum](https://forum.dfinity.org/t/if-your-local-development-environment-isnt-working-on-safari/25295)
- WebSearch on CSP and JSON-LD (inconclusive; superseded by the WHATWG spec): [centralcsp script-src](https://next.centralcsp.com/en/docs/web-security/policies/content-security-policy/directives/script-src)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Registry dates and advisories were read today, and the tree was installed and audited in a probe.
- Architecture: HIGH for the build, bundle and router wiring (probe builds and type checks). MEDIUM for the ASP.NET host ordering (official docs; to be proven by the planned integration tests).
- Pitfalls: HIGH for the 15 items verified by probe or source read. MEDIUM/ASSUMED for A1–A9.

**Research date:** 2026-10-07
**Valid until:** 2026-10-21 (fast-moving: vitest, react-query, eslint and typescript-eslint age into newer versions within days; re-run the date check at install, because `min-release-age` will do so automatically)
