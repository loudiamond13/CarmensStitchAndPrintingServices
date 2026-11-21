---
created: 2026-11-21T07:51:00-06:00
updated: 2026-11-21T07:51:00-06:00
phase: quick-261121-9qz
plan: 01
subsystem: public-legal, admin-visitor-stats, rate-limiting
tags: [privacy-policy, a11y, tailwind-tokens, rate-limit]
requirements: [LEGAL-01, LEGAL-05, ANL-06, ANL-08]
status: complete
key-decisions:
  - "D-134: Privacy map and settings wording, and the site-busy 429 text, use the 12.1-UAT test 1 suggestions (owner, 2026-11-21)"
key-files:
  created:
    - src/Csps.Server/Security/SiteWideCeilingLimiter.cs
    - web/src/modules/admin/components/visitorStats.recipe.node.test.ts
  modified:
    - web/src/modules/public/legalPrivacy.ts
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - web/src/components/data/VisitorTrendChart.tsx
    - web/src/modules/admin/components/visitorStats.recipe.ts
    - web/src/modules/public/components/legal.recipe.ts
    - web/src/ui/app.css
    - web/src/ui/base.css
commits: 6
plan_head_before: 3ef1a60dcb26fc9dace5b7119e8469470cdd20a0
plan_head_after: 4ec2666270b667324b70ebd79765c94726ab0332
actuals:
  tokens: 60000
  tasks: 3
  commits: 6
---

# Phase quick-261121-9qz Plan 01: Fix UI review findings for phases 12 and 12.1 Summary

Privacy Policy wording corrected per D-134, a "site is busy" 429 for the site-wide page view limit, named tokens for the legal reading width and the Visitor Stats sizes and bar colour, a one-column Visitor Stats layout, and a hidden figures table for the trend chart.

## Commits

| Step | Hash | Subject |
|------|------|---------|
| A | 1d6521a5 | fix(261121-9qz): Privacy Policy map and saved settings wording per D-134 |
| B | 6ed7d8d6 | fix(261121-9qz): name the legal reading width and pin the DRAFT notice contrast |
| D | 86017edf | fix(261121-9qz): Visitor Stats named sizes, one-column rows and the chart-views bar token |
| C | a3b5a482 | fix(261121-9qz): the site-wide page view limit says the site is busy (D-134) |
| E | dcef091b | fix(261121-9qz): give screen readers the page view figures in a hidden table |
| F | 4ec26662 | docs(261121-9qz): record D-134 and the Phase 12 and 12.1 UI review outcomes |

Commit C (server) was made after D because the server tests and build were still running when D was ready. The two do not touch the same files.

## What changed

- **Privacy wording (A):** the 'The map' purpose and the Google handler line say the map loads when you tap Show Map, and after the first tap this browser loads it by itself until you clear the saved setting. The saved settings line is "These settings are not cookies. They stay in your browser and are never sent to us." The 'Saved map setting' entry says it stays until you clear this website's data in your browser's settings. Privacy stays `approved: false`, version 1.0, 2026-11-19 (D-73).
- **Storage keys found in non-test `web/src`:** `csps-theme`, `csps-orders-view` (both under "Admin settings in this browser") and `csps-maps` (under "Saved map setting"). No sessionStorage write exists. The list was already complete; only the count went.
- **Legal tokens (B):** `--spacing-reading: 640px` in `app.css`; `max-w-reading` in the DRAFT notice and the article; the grid column is `minmax(0,var(--spacing-reading))`. `LegalPage.test.tsx` line 141 was updated to the new grid token (a necessary follow-on, not in the plan's file list).
- **Contrast, measured with the WCAG formula from the light tokens:** `--ink-muted` on `--warning-soft` 6.55:1; `--ink` on it 11.79:1; the `--warning` icon on it 5.05:1 (needs 3:1). No colour change. A test pins the two text ratios at 4.5:1 or more.
- **Busy answer (C):** `SiteWideCeilingLimiter` wraps the ceiling limiter and marks the request it refuses in `HttpContext.Items`; `WriteRejectionAsync` then answers `SiteBusyDetail`. Per-address answers keep their text. The D-74 order and every permit count are unchanged.
- **Visitor Stats (D):** `text-14` and `text-24`; `visitorKpiRowClasses` is one column; `visitorStatsListRowClasses` is deleted and the Most viewed pages card sits straight in the page body; `bg-chart-views` follows `--chart-views`, equal to `--chart-expense` in the light (`#572e2b`) and dark (`#d4bbab`) blocks.
- **Chart table (E):** a visually hidden table named "Page views by day, <range>" or "Page views by month, <range>" with one row per bucket (full date, page views), after the SVG. The SVG, keyboard, tooltip and live line are unchanged.
- **Docs (F):** D-134 added to 12.1-CONTEXT.md after D-78. 12.1-UAT test 1 carries a note and stays `[pending]` (3 pending in all). Both UI-REVIEW files list an outcome for every finding with commit hashes.

## Test evidence

RED first (failures quoted during the run):

- Step A: `PrivacyPolicyPage.test.tsx`, "5 failed | 46 passed" before the copy change; after it, `PrivacyPolicyPage.test.tsx` and `cookie-inventory.node.test.ts` "Tests 51 passed (51)".
- Step B: `public-look.node.test.ts`, "3 failed | 16 passed" (reading width token, notice and article class, grid column); then green with `LegalPage.test.tsx`, `LegalPages.test.tsx`, `no-long-dash.node.test.ts`, `stylesheet-contract.node.test.ts`: "Test Files 5 passed (5), Tests 76 passed (76)".
- Step C: `*AnalyticsRateLimitTests` "total: 12, failed: 1, succeeded: 11" (the ceiling detail, "Expected ... The site is busy"); after the change "total: 12, failed: 0, succeeded: 12". `*RateLimitTests` "total: 57, succeeded: 57". Architecture tests "total: 290, succeeded: 290". `dotnet build Csps.slnx -warnaserror` "0 Warning(s) 0 Error(s)". `dotnet format Csps.slnx --verify-no-changes --no-restore` exit 0.
- Step D: 12 tests failed first (recipe node test, StatBarList, page body test); then "Test Files 5 passed (5), Tests 106 passed (106)" with `stylesheet-contract` and `no-long-dash`.
- Step E: 4 table tests failed first ("Unable to find an accessible element with the role table"); then "Test Files 5 passed (5), Tests 193 passed (193)" including the month axe test.
- `npm --prefix web run verify`: exit 0. Typecheck, `eslint . --max-warnings 0`, Prettier, "Test Files 422 passed (422), Tests 11277 passed (11277)", coverage "Statements 95.6%", budgets all "ok" (public JS privacy 147.13 KB of 150, admin JS 221.24 KB of 250, CSS 20.38 KB of 35), "License gate passed.", "THIRD-PARTY-NOTICES.txt is up to date (28 packages)".

Guards that already passed before any change (not RED): the storage-key inventory in `cookie-inventory.node.test.ts`, the notice contrast ratios in `public-look.node.test.ts`, the per-address detail checks in `AnalyticsRateLimitTests`, the legend scope change, and the month-bucket axe test.

No flake was seen. Preflight was run before each .NET run and before verify: all four ports free, no other dev or test processes.

## Deviations from Plan

**1. [Rule 3 - Blocking] `LegalPage.test.tsx` pinned the old grid class**
- Found during: Step B. Line 141 expected `grid-cols-[240px_minmax(0,640px)]`.
- Fix: it expects `grid-cols-[240px_minmax(0,var(--spacing-reading))]`. Committed with B.

**2. [Rule 1 - Bug] CA2215 on the new limiter**
- Found during: Step C build. `Dispose(bool)` and `DisposeAsyncCore` did not call the base. Fixed by calling the base after disposing the inner limiter; no suppression.

**3. Prettier wrapped one long string in `legalPrivacy.ts`** (line count only; text is as planned). Also, my first edits wrote CRLF into three web test files; Prettier (`endOfLine: lf`) restored LF before commit A.

Created-after-clock timestamps: the two UI-REVIEW files carried `2026-11-21T10:00:00-06:00` while the real clock was about 07:50. I wrote the real current time in `updated:`.

## Known Stubs

None.

## Threat Flags

None. The only new server surface is a marker in `HttpContext.Items` read when a 429 is written. The site-busy text echoes no address, count or setting.

## Out of scope seen, not changed

- `home.recipe.ts` line 146 still has `max-w-[640px]` (Phase 11 home page, outside the legal pages).

## Owner questions (not decided here)

1. The dashboard `IncomeExpenseChart` has the same keyboard-only figures. Options: (a) add the same hidden table in a later quick task (recommended: same fix, same pattern); (b) leave it.
2. Other admin recipes (dashboard and shared components) still use hand-typed `text-[Npx]` sizes. Options: (a) leave them as the current admin convention (recommended: outside these reviews); (b) a later quick task to move all admin recipes to the named scale.
3. `npm --prefix web run e2e -- --grep "@visitor-stats"` and the rendered check were not run here (no Playwright, no dev server). The orchestrator runs the rendered check.
4. The 12.1-UAT test 1 re-read of /privacy and the D-73 approval stay with the owner. The Privacy Policy still shows its DRAFT notice.

## Self-Check: PASSED

- Created files exist: `src/Csps.Server/Security/SiteWideCeilingLimiter.cs`, `web/src/modules/admin/components/visitorStats.recipe.node.test.ts`.
- Commits 1d6521a5, 6ed7d8d6, 86017edf, a3b5a482, dcef091b and 4ec26662 are on `gsd/phase-12-consent-analytics-legal` (6 commits from 3ef1a60d).
