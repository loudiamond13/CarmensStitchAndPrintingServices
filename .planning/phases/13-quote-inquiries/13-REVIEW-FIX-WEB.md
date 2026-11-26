---
phase: 13
created: 2026-11-25T08:20:00-06:00
updated: 2026-11-25T08:20:00-06:00
fixed_at: 2026-11-25T08:20:00-06:00
review_path: .planning/phases/13-quote-inquiries/13-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
---

# Phase 13: Code Review Fix Report (web slice)

*Created: 2026-11-25T08:20:00-06:00 · Updated: 2026-11-25T08:20:00-06:00*

**Source review:** `.planning/phases/13-quote-inquiries/13-REVIEW.md`
**Scope:** `web/src` and its Vitest tests only (no e2e, no .NET). Warning findings G5-WR-01 to G5-WR-03, G6-WR-01, G6-WR-02, G7A-WR-01 to G7A-WR-03.
**Branch:** `gsd/phase-13-quote-inquiries`, main checkout (no worktree, so the gates ran in the main checkout and can be reproduced there).

## Fixed Issues

### G5-WR-01: Photo preview stays a grey skeleton when the photo being drawn is removed
**Commit:** 1a0afca9
**Files:** `web/src/modules/public/components/QuotePhotoPicker.tsx`, `QuotePhotoPicker.test.tsx`
**Fix:** The draw-finished step now always sets a new previews map (a removed photo is just not added), so the effect runs again and draws the next photo.
**Red:** new test "goes on to the next preview when the photo being drawn is removed" failed at `expect(previewImage).toHaveBeenCalledTimes(2)`. **Green:** `QuotePhotoPicker.test.tsx` 38 of 38 passed.

### G5-WR-02: Failed-send box stays during the retry; a second identical failure is not announced
**Commit:** 7a165d66
**Files:** `web/src/modules/public/components/QuoteForm.tsx`, `QuoteForm.test.tsx`
**Fix:** `sendStatus()` returns null while `pending` (the review's fix, one condition). The next failure mounts a fresh `role="alert"`.
**Red:** new test failed with "expected document not to contain element" (the old alert was still shown during the retry). **Green:** the five `QuoteForm*` test files, 90 of 90 passed. The new test also checks the second alert is a different element from the first.

### G5-WR-03: Keyboard focus drops to the body after the first photo pick
**Commits:** 927a4ac1, then 40ce1b49 (follow-up, see below)
**Files:** `QuotePhotoSlot.tsx`, `QuotePhotoPicker.tsx`, `QuoteFormPhotos.test.tsx`
**Fix:** The picker has a new `focusOnMount` prop. When set, it starts with the focus target `photos[0] ?? 'add'` and `focusTick = 1`, so the existing focus effect focuses the first Remove button (or the add control). The Slot sets it only when the Choose Photos button still had focus at the moment the picker loaded.
**Adaptation of the review's fix:** The review passes `focusOnMount` always. I made it conditional on Choose Photos still holding focus, because always taking focus would pull focus out of a field the visitor moved to while the piece loaded, and the first version (also accepting "focus on body") broke the showcase test "leaves focus alone while the quote cases shown on load reach their states" (a showcase case with a pre-set pick has focus on body). The follow-up commit 40ce1b49 tightened it to the button only.
**Red:** new test "moves focus onto the first Remove button when the picker loads from the Choose Photos button" failed. A second new test checks focus stays on another field. **Green:** `QuoteFormPhotos`, `QuotePhotoPicker`, `QuoteFormSlot` and `ComponentShowcasePage` tests pass.

### G6-WR-01: Kept earlier page shows the wrong empty state while the next view loads
**Commit:** 9c22deb9
**Files:** `web/src/modules/admin/pages/QuoteRequestsPage.tsx`, `QuoteRequestsPage.test.tsx`
**Fix:** `empty` is false while `query.isPlaceholderData`. The empty words now read the settled `params` (status and search), not the immediate `values`. A kept page with no rows renders the table in its pending state (skeleton rows, busy region).
**Red:** new test "shows no empty state while the next pill loads after an empty one" failed ("expected null not to be null": no busy table, the empty state was showing). **Green:** `QuoteRequestsPage.test.tsx` 40 of 40 passed.
**Note:** The "typing a better search" scenario is covered by the same change (the words read `params.q`, and no empty state shows while a kept page waits), but I wrote one test, for the pill case.

### G7A-WR-01: No global async timeout for findBy and waitFor
**Commit:** 8a589018
**Files:** `web/src/test/setup.ts`, new `web/src/test/asyncTimeout.test.tsx`
**Fix:** `configure({ asyncUtilTimeout: 5000 })` inside the jsdom (`window`) guard, as the review says.
**Red:** new test (an element that appears after 1.5 s) failed with "Unable to find an element with the text: Arrived". **Green:** passes in 1.5 s.
**Not done:** I did not remove or lower the many existing per-test timeouts (out of scope, and they are harmless).

### G7A-WR-02: "Sending" tests race a real 1 second wait
**Commit:** 4e50549b
**Files:** `QuoteForm.test.tsx`, `QuoteFormPhotos.test.tsx`, `web/src/test/quoteFixtures.ts`
**Fix:** New helper `holdCreate()` holds the create call until the test calls `release()`. Three tests now use it: "shows the pending label Sending", "starts no upload before the text is saved" (asserts `create` was called once and no upload started, then releases with one photo slot), and "shows no photo line for a text-only send". They no longer use `minimumSeconds: 1`.
**Red (by stall):** the old "pending label" test with a 1.3 s stall inserted between the click and the check fails (it timed out); the new form does not depend on elapsed time. **Green:** `QuoteForm.test.tsx` and `QuoteFormPhotos.test.tsx` 78 of 78 passed.
**Left alone:** the "double press" test (`QuoteForm.test.tsx`) also uses `minimumSeconds: 1`, but a double click is synchronous, so it does not race. The review also asks to remove the matching rows from `deferred-items.md`: that file is outside the web slice, so the orchestrator should do it.

### G7A-WR-03: Count-chip failure test asserts absence before the failure is handled
**Commit:** f0a624a2
**Files:** `web/src/layouts/AdminLayout.test.tsx`
**Fix:** `countReads` now also returns an `answered` promise, set when the handler has built its answer. The test awaits it, then a 50 ms settle inside `act` (the same settle the sibling test uses), then asserts no chip and no alert.
**Check by mutation:** with `shownNewQuoteCount` temporarily returning 7 on error, the new test fails ("Expected element to have accessible name"). The old test also failed in this quiet run, because the failure is usually handled fast; the new test removes the dependence on that timing. With `NaN` the chip does not render, so that mutation was not a useful check. The source change was reverted (`git checkout`), nothing from it is committed. **Green:** `AdminLayout.test.tsx` 70 of 70 passed.

## Skipped Issues

### G6-WR-02: Send Test Email blames the internet connection for a 422 or 409
**File:** `web/src/modules/admin/components/QuoteAlertsCard.tsx:52`
**Reason:** needs owner decision. The review itself says the wording is the owner's call and not to decide it in code, so the Fix section does not settle it. Nothing was changed.
**Owner question (plain words):** When Send Test Email fails because the address is refused (422) or missing (409), the toast says "Check your internet connection". What should it say?
- **A (recommended).** A new line for 422 only: "That address can't receive email. Check the spelling and save it again." The 409 case is rare (another Manager cleared the address) and the page already says why the button waits.
- **B.** New lines for both 422 and 409.
- **C.** Keep the generic line.
**When the owner rules:** branch on `outcome.error.code` as in the review (`site-settings.quote-alerts-address-undeliverable`), add the text to `siteContentCopy.ts` next to `TEST.limited`, add a UI-SPEC R5 test line, and test it in `QuoteAlertsCard.test.tsx` (red first).

## Verification (all in the main checkout, `C:\Work\CarmensStitchAndPrintingServices\web`)

- `npm run lint` (`eslint . --max-warnings 0`): exit 0, zero warnings, run after the last test change of the first seven commits; the final follow-up file (`QuotePhotoSlot.tsx`) was linted on its own with zero warnings.
- `npm run typecheck`: clean after every commit, including the follow-up.
- Affected Vitest files all pass (see each finding). No console errors (the console guard fails any test that logs), no new axe violations (existing axe tests in the touched files pass).
- Full `npx vitest run` (before the follow-up commit 40ce1b49): 456 files, 12,214 tests, 12,210 passed, 4 failed, 630 s on a loaded machine (another fixer was running .NET at the same time).
  - Re-run alone: `GalleryPage.test.tsx` (2 failures: "puts focus back on the tile", "shows more tiles first") and `ComponentShowcasePage.lazy.test.tsx` (1 failure) passed. These are the load flakes already listed in `deferred-items.md`; the new 5 s wait does not cover the focus checks in the Gallery tests, which use `toHaveFocus` right after a click.
  - `ComponentShowcasePage.test.tsx` "leaves focus alone while the quote cases shown on load reach their states" failed alone too. It was caused by my first G5-WR-03 version and is fixed by commit 40ce1b49; the file now passes (77 of 77 across the showcase, photo form and slot test files).
- Coverage: not run (`test:coverage` is a separate, long run); the new code is covered by the new tests, so the thresholds should hold. Please let the verify step confirm.
- No packages added or changed. No em dash or en dash added to `web/src` (the dash scan test `no-long-dash.node.test.ts` passed in the full run). Each commit passed `gitleaks protect --staged`. Files staged by path.

---

_Fixed: 2026-11-25T08:20:00-06:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
