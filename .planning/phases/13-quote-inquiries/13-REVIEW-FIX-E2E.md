---
phase: 13-quote-inquiries
created: 2026-11-25T08:55:00-06:00
updated: 2026-11-25T08:55:00-06:00
fixed_at: 2026-11-25T08:55:00-06:00
review_path: .planning/phases/13-quote-inquiries/13-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report (e2e slice)

*Created: 2026-11-25T08:55:00-06:00 · Updated: 2026-11-25T08:55:00-06:00*

**Fixed at:** 2026-11-25
**Source review:** `.planning/phases/13-quote-inquiries/13-REVIEW.md` (group g7b)
**Iteration:** 1
**Scope:** Warning findings G7B-WR-01 to G7B-WR-04, in `web/e2e` only. Info findings were not in scope.

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

**Where the checks ran:** in the main checkout (no worktree), with `node scripts/e2e.mjs` (the project script: run lock, preflight wait, CSPS_E2E reseed, e2e build, Playwright on port 5199, `reuseExistingServer: false`). No environment variable was set. Preflight showed ports 5180, 5115, 7028 and 5199 free and no other dev or test processes before and after. Every run was in the five browser projects (chromium, firefox, webkit, pixel, iphone) unless noted as chromium only for a red check.

## Fixed Issues

### G7B-WR-01: Two quote form tests upload photos without the photo host lock

**Files modified:** `web/e2e/quote-form.spec.ts`
**Commit:** 0eee6e26
**Applied fix:** The click, the create wait and the upload wait of the two photo tests now run inside `withPhotoHost`, with a 240 s test timeout (the later G7B-WR-02 commit raised the whole file to 480 s).
**Evidence:**
- Red: a temporary probe spec held one armed `fail-next` failure under the photo lock for 20 s. With the old test file, the photo test got `503` on the upload (`Expected: 200, Received: 503`).
- Green: with the fix and the same probe, both photo tests passed in all five projects (15 of 15 including the probe). The tests waited for the lock (up to 1.1 min in chromium).
- The probe file was deleted and never committed.

### G7B-WR-02: Contact page tests read the shared site content without the site content lock

**Files modified:** `web/e2e/quote-form.spec.ts`, `web/e2e/quote-sweep.spec.ts`
**Commit:** 4b52245b
**Applied fix:** Every quote form test (the product line test already had it) and the four Contact sweep tests now run inside `withSiteContentLock` after `seedDemoSiteContent`, the same pattern as `contact.spec.ts`. `quote-form.spec.ts` got a file-wide 480 s timeout (the sweep already had one), because the lock wait can be 6 minutes. The two photo tests take the site content lock first and the photo lock inside it, the same order the site content specs use. I used the inline pattern rather than a new helper because `scripts/e2e-lock-timeouts.test.ts` finds lock users by the text `withSiteContentLock(`; that test still passes (4 of 4).
**Evidence:**
- Red: a temporary probe held the site content lock for 25 s. With the old files, the form and Contact sweep tests finished in 1.3 to 3.7 s, so they ignored the lock.
- Green: with the fix and the same probe, the first two tests waited for the lock (28.0 s and 30.5 s) and all passed.
- Full run of `quote-form.spec.ts` and the four Contact sweep tests in all five projects: 65 passed (3.5 min).

### G7B-WR-03: The nav count test compares two reads of a counter that other specs also lower

**Files modified:** `web/e2e/quote-nav.spec.ts`
**Commit:** 2a9b3a11
**Status of the earlier fix:** the earlier commit `b9f85cf0` (fix(13-24)) did not fix this. It only made the test use a desktop window and wait for the dashboard fonts. The old `expect(after).toBeGreaterThanOrEqual(before + 2)` was still in the file, so this finding was open.
**Applied fix:** The `before` read is gone. The test creates two requests with names that share one unique tag, and checks the count the page read afterwards is at least 2 (the two stay New, and no other spec touches them). It then opens the inbox with `?q=<tag>` and checks both names are listed, and keeps the existing sidebar and current-page checks. The review suggested `>= 1`; I used `>= 2` because the test's own two requests are always in the count, which is stricter and still sound.
**Evidence:**
- Red: a temporary probe made two other requests, read the count, made two of its own, then moved the two others to Spam, as a parallel spec would. The count read `2` then `2`: the old `before + 2` check was false (would fail), the new `>= 2` check held.
- Green: `quote-nav.spec.ts` passed in all five projects (inside a 90 of 90 run, 8.6 min, also covering the WR-04 specs).
- The probe file was deleted and never committed.

### G7B-WR-04: `img.complete` is true for a broken image, so the photo checks cannot see one

**Files modified:** `web/e2e/quote-request.spec.ts`, `web/e2e/quote-sweep.spec.ts`
**Commit:** 79f337ad
**Applied fix:** After the `complete` check, both places now also `expect.poll` the image `naturalWidth` to be above 0, as the review suggested.
**Evidence:**
- Red: I temporarily swapped the tile image for a broken one (a new `<img>` pointing at a 404 address). The old `complete` check passed ("OLD CHECK PASSED on a broken image") and the new check failed (`Expected: > 0, Received: 0`).
- Note: when the thumbnail request itself answered 200 with non-image bytes, the app already replaces the image on error, so the old check failed there too (element not found). The new check closes the remaining case where the image element stays and is broken.
- Green: `quote-request.spec.ts` and `quote-sweep.spec.ts` passed in all five projects (the 90 of 90 run above).
- The temporary edits were reverted before the commit; the commit holds only the two `naturalWidth` additions.

## Checks at the end

- `npm run lint` (`eslint . --max-warnings 0`): clean.
- `npm run typecheck`: clean.
- `npx prettier --check` on the four changed specs: clean.
- `scripts/e2e-lock-timeouts.test.ts`: 4 of 4 passed.
- No em dash or en dash in the four changed specs.
- gitleaks (staged) ran on each commit: no leaks. Staged by path only. The two other modified planning files (`deferred-items.md`, `DECISIONS.md`) and the untracked `13-REVIEW-FIX-WEB.md` were not mine and were never staged.
- No flake seen: every run passed on the first try, and the three red runs failed only where a break was added on purpose.
- Cleanup: all temporary probe specs removed, Playwright hosts and browsers ended with each run, final preflight shows ports free and no dev or test processes, no background shell left.

---

_Fixed: 2026-11-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
