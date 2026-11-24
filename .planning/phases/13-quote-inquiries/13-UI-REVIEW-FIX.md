---
created: 2026-11-24T04:26:59-0600
updated: 2026-11-24T04:26:59-0600
phase: 13
review_path: .planning/phases/13-quote-inquiries/13-UI-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 2
skipped: 2
status: partial
---

# Phase 13: UI Review Fix Report

**Source review:** `13-UI-REVIEW.md` (17/24, code-only audit)
**Where it ran:** the main checkout `C:\Work\CarmensStitchAndPrintingServices`, branch `gsd/phase-13-quote-inquiries`. No worktree was used.

**Summary:**
- In scope: fix 1, fix 2, the `gap-[6px]` point, and fix 3 if a jsdom test can do it.
- Fixed: 2 (fix 1, fix 2).
- Left as is: 1 (the 6 px pill gap, which the base spec sets).
- Deferred: 1 (fix 3, which needs a browser).
- Out of scope, not touched: fix 4 (screenshots), fix 5 (empty-state copy, owner's call), fix 6 (screen reader pass).

## Fixed

### Fix 1: selected status pill used `font-bold`

**File:** `web/src/modules/admin/components/quoteRequests.recipe.ts`
**Commit:** `cbb87679`
**Change:** `quotePillOnClasses` now uses `font-semibold` (600) in place of `font-bold` (700). The maroon fill stays as the cue. The doc comment now says "at 600" in place of "bold".
**Test first:** the new `quoteRequests.recipe.node.test.ts` pinned `font-semibold` and failed on the old class ("Received: border-primary bg-primary font-bold text-on-primary"), then passed. The file also runs the class gate on the recipe.
**Note:** the Gallery pill (`gallery.recipe.ts`, `galleryPillOnClasses`) still uses `font-bold`. It is inherited, not Phase 13 code, so it was not touched. The two pills now differ by one weight step when selected.

### Fix 2: raw `text-[14px]` instead of the size token

**File:** `web/src/modules/admin/components/quoteRequests.recipe.ts`
**Commit:** `1e1d9a43`
**Change:** the six `text-[14px] leading-5` lines (lines 10, 22, 77, 92, 95, 107) now use `text-14 leading-5`, the same form as `quoteForm.recipe.ts`. Line 80 (`quoteValueClasses`) had the same issue at 16 px, so `text-[16px] leading-6` became `text-16 leading-6`, to keep one form across the file.
**Same render:** `app.css` defines `--text-14: 14px` and `--text-16: 16px`. The compiled `.text-14` rule is `font-size: var(--text-14)` and sets no line height, the same as `text-[14px]`. The `leading-5` (20 px) and `leading-6` (24 px) classes are unchanged.
**Test first:** two new tests failed on the old source (a raw px size was found, and `--text-16` was missing from the compiled CSS), then passed. The raw-size check was then narrowed to the declared 13, 14 and 16 px sizes, so it does not flag the inherited h1 sizes below; the old `text-[14px]` lines still match it. They pin each class list and check the compiled sizes and line heights.
**Left alone:** the R2 h1 keeps `text-[34px]` and `text-[30px]`. The review lists them as the allowed inherited `.s-ph-title` look, there is no `--text-34` token, and `layout.recipe.node.test.ts` pins that same raw form for the shared page title.

## Left as is

### The `gap-[6px]` in `quotePillClasses`

**File:** `web/src/modules/admin/components/quoteRequests.recipe.ts:35`
**Reason:** the 13-UI-SPEC says the filter pills use "the Gallery `.s-pill` look", and the base spec sets that look explicitly: `docs/CSPS-UI-SPEC.md` App. C, `.s-pill { ... gap: 6px; ... }`. The Gallery pill recipe uses the same `gap-[6px]`. The 13-UI-SPEC spacing table names no gap for the space between a pill's label and its count. Its "8px apart" means the space between pills, which is already `gap-2`. So no 4 px step is called for here, and changing it would make the admin pills differ from the Gallery pills.
**Spec gap:** the 13-UI-SPEC "Declared exceptions" list ends with "No other exception" and does not name this inherited 6 px gap, as it does for the 6 px card head gap. Adding it to that list is a spec edit for the owner to approve. It was not made here.

## Deferred

### Fix 3: a test for the form placeholder heights

**File:** `web/src/modules/public/components/quoteForm.recipe.ts:65` (`min-h-[696px]`, `pg-phone:min-h-[1000px]`)
**Reason:** the test has to compare the placeholder's height with the real form's height at 1440 px and 320 px. jsdom does no layout: every element measures 0 px tall. A jsdom test could only repeat the class string, which proves nothing about layout shift. This needs a Playwright test (measure both boxes, or check CLS while the form loads), which is out of scope for this run.
**Suggested follow-up:** add a Playwright check to the Contact page E2E suite that measures the placeholder and the loaded form at 320, 768 and 1440 px and fails if they differ by more than a few pixels.

## Checks run (main checkout, `web/`)

- `npx vitest run` on `quoteRequests.recipe.node.test.ts`, `QuoteStatusFilter.test.tsx`, `QuoteStatusMenu.test.tsx`, `QuoteNotesCard.test.tsx`, `QuoteRequestsPage.test.tsx`, `QuoteRequestPage.test.tsx` and `no-long-dash.node.test.ts`: 7 files passed, 138 tests passed.
- `npm run typecheck`: exit 0, no errors.
- `npm run lint` (`--max-warnings 0`): exit 0, no findings.
- `npm run format:check`: "All matched files use Prettier code style!"
- `npm run build:budget`: exit 0, every row "ok", no limit changed. Contact public JS 148.39 / 150.00 KB, admin JS 226.06 / 250.00 KB, Quote form 44.40 / 45.00 KB, CSS 20.55 / 35.00 KB. The build also printed its standing note that public JS (149.16 KB) is past the 135 KB barrel-split trigger. That note was there before this change.
- gitleaks (pre-commit hook) on both fix commits: "no leaks found".
- Playwright and servers were not run, as instructed.

## Other notes

- The working tree had an uncommitted change to `.planning/phases/999.9-owner-items-parked-during-phase-13-execution/DECISIONS.md` that this run did not make. It was left alone and not staged.
