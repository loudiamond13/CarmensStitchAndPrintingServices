---
created: 2026-10-26T22:10:00-05:00
updated: 2026-10-26T22:10:00-05:00
phase: quick-261026-ooe
plan: 01
subsystem: web accessibility (WCAG 2.2 AA 2.4.11 Focus Not Obscured)
tags: [a11y, scroll-padding, sticky-bars, e2e, axe, tailwind]
requires: [D-70, D-71, D-72, D-73, D-74]
provides:
  - "scroll padding and margin utilities that keep a focused control clear of the phone tab bar, the admin top bar and the public header"
  - "e2e specs and helpers for the three bars (@focus-not-obscured), the real-scrollbar tab bar window, and the axe re-check (D-71)"
  - "dev-only /dev/public page (the real PublicLayout) for testing the public header"
affects: [web/src/modules/admin/components/admin.recipe.ts, web/src/layouts/PublicLayout.tsx, web/e2e/fixtures.ts]
key-files:
  created:
    - web/e2e/focus.ts
    - web/e2e/focus-not-obscured.spec.ts
    - web/e2e/focus-scrollbars.spec.ts
    - web/src/modules/public/pages/PublicLayoutCheckPage.tsx
  modified:
    - web/src/modules/admin/components/admin.recipe.ts
    - web/src/layouts/PublicLayout.tsx
    - web/src/layouts/PublicLayout.test.tsx
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/scripts/budget.ts
    - web/scripts/budget.test.ts
    - web/playwright.config.ts
    - web/e2e/fixtures.ts
    - web/e2e/fixture-selftest.spec.ts
    - web/e2e/profile.spec.ts
    - web/e2e/audit-log.spec.ts
    - web/e2e/users.spec.ts
    - docs/web/e2e.md
    - docs/web/budgets.md
status: complete
commits: 14
plan_head_before: a8c408bf828d61ed85a1f2fb8773077900d68f8e
plan_head_after: 5413711c2a22579ecb323f9135bb581b3b212c20
actuals:
  tokens: 12500
  tasks: 7
  commits: 14
---

# Phase quick-261026-ooe Plan 01: Focused controls stay clear of the sticky bars Summary

Root scroll padding (CSS utilities only) keeps a Tab or Shift+Tab target 24px clear of the phone tab bar, the admin top bar and the public header, and the e2e axe check now re-checks a target that only a fixed or sticky bar covers.

Branch `fix/phone-focus-not-obscured`. Nothing was pushed. No package, lockfile, `base.css`, `app.css` or `sweep.ts` change.

## Owner rulings recorded (2026-10-26)

- **D-70:** the fix for the focused field hidden behind the phone tab bar (Confirm new password on My Profile, Security) is approved: scroll padding for the bars, and the e2e axe helper re-checks a target axe reports as partially obscured.
- **D-71:** the helper re-checks a `target-size` "partially obscured" target when at least one covering control sits in a fixed or sticky bar; it scrolls the target into view, re-runs target-size on it alone, restores the scroll, and a target still covered fails.
- **D-72:** the fix also covers the sticky admin top bar at every width, the sticky public header, desktop windows 768 to about 782 px wide with classic scrollbars (the tab bar shows there), and the three redundant e2e scroll workarounds are removed.
- **D-73:** CSS only. Safari with classic scrollbars in a 768 to about 782 px window is the one known limit (see "Known limit").
- **D-74:** the dev-only `/dev/public` page (`PublicLayoutCheckPage`, in `devRoutes` and `DEV_ONLY_MODULE_PREFIXES`) is approved so the public header can be tested before Phase 11. Production falls through to the holding page. Toasts stay as they are (transient, dismissible).

## What changed

| Where | Utility | Effect |
|---|---|---|
| `adminClasses` | `[:root:has(&)]:scroll-pt-[calc(var(--topbar-height)+var(--space-6))]` | html `scroll-padding-top` 88px at every width (admin top bar) |
| `adminClasses` | `vp-lt-md:[:root:has(&)]:scroll-pb-[calc(71px+var(--space-6)+env(safe-area-inset-bottom))]` | html `scroll-padding-bottom` 95px on phone viewports (tab bar 71px) |
| `adminBodyClasses` | `md:pg-phone:[&_:not([aria-modal=true]_*)]:scroll-mb-[calc(71px+var(--space-6)+env(safe-area-inset-bottom))]` | controls in main get `scroll-margin-bottom` 95px only when the window is 768px or wider but the page is in its phone layout (classic scrollbar); dialog contents excluded |
| `PublicLayout` main | `[:root:has(&)]:scroll-pt-[calc(var(--header-height)+1px+var(--space-6))]` | html `scroll-padding-top` 89px while the public layout is shown |
| `fixtures.ts` | `expectNoAxeViolations` re-check | D-71 rule, below |

Measured bar heights (printed by the red runs): tab bar 71px on My Profile (top at 768 on pixel, 588 on iphone), admin top bar bottom 64, public header bottom 65 on desktop widths and 57 on phones (56 + 1px border).

## Commits (14)

| Hash | Subject |
|---|---|
| b359e414 | test: controls the phone tab bar covers must be scrolled clear (RED) |
| cd5232b6 | fix: keep focused controls clear of the phone tab bar (D-70) |
| 59ab5ee4 | test: the tab bar spacing must follow the bar with classic scrollbars (RED) |
| a15f79ef | fix: keep the tab bar spacing when classic scrollbars keep the phone layout (D-72) |
| a6563fcf | test: controls the admin top bar covers must be scrolled clear (RED) |
| b1c4ab8d | fix: keep focused controls clear of the admin top bar at every width (D-72) |
| 492c5f9a | test: a dev-only page must show the public layout (RED) |
| 80f8fd91 | feat: add a dev-only public layout check page at /dev/public (D-72) |
| c56e35a8 | test: controls the public header covers must be scrolled clear (RED) |
| 83e4f737 | fix: keep focused controls clear of the public site header (D-72) |
| 4c6b0578 | test: the axe check must re-check a target only a bar covers (RED) |
| 754d1014 | fix: re-check a bar-covered axe target after scrolling it clear (D-71) |
| ef4bd2a9 | test: drop the scroll workarounds the bar fixes made redundant (D-72) |
| 5413711c | docs: record the sticky bar focus tests and the axe re-check |

All subjects are `type(quick-261026-ooe): ...` and end with the Co-Authored-By line. gitleaks (`--pre-commit --staged`) passed before every commit ("no leaks found").

## Red outputs (each failed for the stated reason, then passed)

**Task 1 (b359e414), `--grep @focus-not-obscured`, five projects: 9 failed, 6 skipped.**
- pixel T1: `bottom of the box must be at or above 768; Confirm new password after Tab, Tab: {"box":{"top":785.875,"bottom":829.875,...},"topBarBottom":64,"tabBarTop":768,"tabBarHeight":71,"scrollY":0}`. iphone: bottom 671.875 vs tab bar top 588.
- pixel T2: `Update Password after Tab: bottom 797.875` vs 768 (scrollY 114); iphone bottom 618.875 vs 588.
- T3 in chromium, firefox, webkit: `375px: tab bar 71px drawn but {"paddingTop":0,"paddingBottom":0,"marginBottom":0}` and the same at 767px; pixel and iphone: `devicepx: tab bar 71px drawn but {...0,0,0}`. The 768, 1024 and 1280px rows passed.
- Green: `9 passed`, 6 skipped; contract + class gate + lint + typecheck exit 0.

**Task 2 (59ab5ee4), classic and overlay projects: 2 failed, 1 passed, 1 skipped.**
- classic S1: `760px: scrollbar 15px, bar drawn; 768px: scrollbar 15px, bar drawn; 775px ...; 782px ...; 790px: scrollbar 15px, bar not drawn`, with `768px/775px/782px: tab bar 71px drawn but {0,0,0}`.
- classic S2: `Update Password after Tab at 775px with classic scrollbars: bottom 559.19 must be at or above 529` (`innerWidth 775, clientWidth 760, tabBarTop 529`).
- overlay S1 passed. Green: 3 passed, 1 skipped in the scrollbar projects; 9 passed, 6 skipped in the five others.

**Task 3 (a6563fcf), five projects: 11 failed, 9 skipped, 5 passed (T3 and T4 in all five, T5 on iphone; T5 passed on pixel).**
- T3 top assertion: `top bar 64px but html scroll-padding-top is 0px` in every row.
- T4 chromium: `top of the box must be at or below 64; Current password after Shift+Tab at 1280x400: top 34.19, scrollY 406`; iphone top 34.875, scrollY 507; pixel top 33.875, scrollY 508.
- T5 iphone: `Show password after Shift+Tab (step 3): top 49.875, topBarBottom 64, scrollY 588`.
- Green: `--grep @focus-not-obscured` in all seven projects: 19 passed, 10 skipped.

**Task 4 (492c5f9a), unit:** `Unable to find role="heading" and name "Public layout check"` (the /dev/public test), and the two budget rows `expected true to be false`; 3 failed, 108 passed. The production fall-through test passed before and after, as planned. Green: 111 passed; `npm run build` and `npm run build:budget` exit 0; the string "Public layout check" is not in any production asset.

**Task 5 (c56e35a8):** all five projects: `html scroll-padding-top at 1280x480 for a 65px header` (soft) and `top of the box must be at or below 65; Field 6 after Shift+Tab at 1280x480: top 34.69, scrollY 581` (phones: 57px header, top 26.5 and 27.5). Unit: the `PublicLayout` main class test failed. Green: 27 unit tests; full `--grep @focus-not-obscured` 24 passed, 10 skipped.

**Task 6 (4c6b0578):** self-test 1 in chromium, firefox and webkit: `axe found 1 violation(s): target-size: #e2e-fixture-covered`; T7 on pixel and iphone: `axe found 1 violation(s): target-size: <the Confirm field's selector>`. Self-test 2 (still covered fails) passed before and after. Green: `--grep "@fixture|@focus-not-obscured"` 53 passed, 13 skipped. **`@profile the tabs follow the URL ... --project pixel --repeat-each 60`: `60 passed (2.1m)`.**

## Verification

- `npm --prefix web run verify` (second run): exit 0. 203 test files, 6000 tests passed, coverage thresholds met, both builds and the budget gate, license gate and notices check passed. The first run failed once in `useUsersListParams.test.tsx:201` (a debounce timing check) during a 302 s loaded run; it passed alone 4 of 4 times and in the second full run. Recorded as a flake.
- `profile.spec.ts`, `audit-log.spec.ts`, `users.spec.ts` (workarounds removed), five projects: 126 passed, 4 failed. The 4 failures are the audit tests that wait for the "Done to" people list (see deferred items). They fail identically with the workarounds restored and on the base code, and all four pass in webkit and iphone when the expect timeout is temporarily 30 s (config reverted, not committed). The `@profile` and `@users` tests passed in all five projects.
- Full `npm --prefix web run e2e`, seven projects: 1239 tests, **1157 passed, 32 failed, 50 skipped** (1.4 h). Rerun of the 32 (`--last-failed`): 9 passed, 23 failed. Those 23 were run on the base code (`a8c408bf`, this change's source, specs, scripts and config checked out temporarily and restored): 19 fail the same way there; the other 4 (`@expenses-edit` firefox, `@long-text` four-chip firefox, `@a11y-rulings` D-02 iphone, `@shell` pinned 1024x768 iphone) passed alone on this change. So no failure comes from this change. Every `@focus-not-obscured` and `@fixture` test passed in the full run, and the sweeps (`@responsive`, `@shell`, `@long-text`, `@expenses-sweep`, `@auth-overflow`) show no new failure at 320, 768, 1280 or the other widths: padding and margin change nothing at rest.
- Details of the 19 and of the first-run flakes are in `deferred-items.md` (data growth in the shared CSPS_E2E database: 1,994 expenses now print with a thousands comma, slow people lists in WebKit, heavy `/dev/components` pages under load).
- No background shell or Playwright process of mine is left (the closing preflight lists none).

## Flakes recorded

- First full run, passed on rerun (9): `@dialog-fit` 412x839 (firefox) and 1440x900 (webkit), `@shell` profile security at 8 widths (firefox, 240 s timeout), `@showcase` picked image (firefox), `@responsive` /dev/components dark (webkit), `@shell` audit-log at 8 widths (pixel), `@a11y-rulings` D-05 dark and O-6 (iphone), and `@audit` edits an expense amount and payer (iphone, the slow "Done to" list).
- The 4 listed above (failed in the full run and the first rerun, passed alone and on the base code).
- `useUsersListParams.test.tsx` once under load (unit).

## Sticky and fixed elements checked (no change needed)

| Element | Why it needs no change |
|---|---|
| Sidebar (`s-admin-side`) | Sticky beside the content, never over it. |
| Table header cells (`data.recipe.ts`) | Sticky inside a horizontally scrolling wrapper that never scrolls vertically. |
| Drawer and modal overlays | Fixed on purpose; they cover the page and trap focus. |
| Toast region | Fixed, transient and dismissible (D-74: unchanged). |
| Admin top bar, phone tab bar, public header | Changed (above). |

## Known limit (D-73)

In a 768 to about 782 px window with classic scrollbars, WebKit ignores a control's scroll margin when the control is already inside the viewport. Safari with always-visible scrollbars is therefore not covered there. Chromium, Edge and Firefox (Windows, where classic scrollbars are the default) are covered, and no Playwright project can draw WebKit classic scrollbars, so it cannot be tested. Phones and overlay-scrollbar windows are exact through the html padding.

## Deviations from Plan

**1. [Rule 3 - Blocking] The axe self-tests use a sticky bar, not a fixed one.**
- Found during: Task 6. A standalone probe showed axe 4.13 does not count a `position: fixed` bar as covering a target (no `partiallyObscured`), while a `position: sticky` bar (the app's own bars) does.
- Fix: the self-tests inject a sticky bottom bar and are titled "sticky bar". The helper still accepts a covering control in a fixed or sticky bar, as D-71 says. The injected page also waits until the scroll position stops moving, because WebKit moves it again a frame or two after `scrollTo`; the helper's own re-check waits the same way.
- Files: `web/e2e/fixture-selftest.spec.ts`, `web/e2e/fixtures.ts`. Commits: 4c6b0578, 754d1014.

**2. [Rule 3 - Blocking] Page scripts reach an element through a `window` slot.**
- `locator.evaluate(string)` evaluates a string as an expression and never calls it with the element, and the strict CSP forbids `eval`. A tiny typed function stores the element on `window.__e2eFocusTarget`; the string scripts read it. Files: `web/e2e/focus.ts`. Commit: b359e414 and later.

**3. [Plan allowance] T4 runs in 400px-tall windows.** At 480px the Security page could not scroll far enough to put Current password 30px behind the top bar (18.8px short at 1280x480). The plan allows down to 360px; all T4 sizes use 400px (phones keep their own width).

**4. [Rule 1 - precision] The re-check clears a node only when target-size passes for the same selector** in the single-node run (and does not report it), which is slightly stricter than "target-size is in passes".

**5. [Rule 2 - docs] `docs/web/budgets.md` also names the new dev-only page** (two sentences), so the budget guide matches `DEV_ONLY_MODULE_PREFIXES`. Only its Updated value changed. Commit: 80f8fd91.

**6. T6 uses `expect.soft` for the padding assertion**, so the red run printed both the spacing and the coverage failures. It still fails the test.

## Auth gates

None. The Testing environment's staff sign-in was used as in the other specs.

## Known Stubs

None.

## Threat Flags

None. `PublicLayoutCheckPage` makes no request, holds no data and is dev-only (proved by `routes.test.tsx` and the budget gate); the CSS utilities add no script and keep the strict CSP.

## Self-Check: PASSED

- All created files exist: `web/e2e/focus.ts`, `web/e2e/focus-not-obscured.spec.ts`, `web/e2e/focus-scrollbars.spec.ts`, `web/src/modules/public/pages/PublicLayoutCheckPage.tsx`.
- All 14 commits are ancestors of HEAD (`git rev-list --count a8c408bf..HEAD` is 14).
- `git status` shows only the orchestrator's `.planning/STATE.md` and this quick folder as changed or untracked.
