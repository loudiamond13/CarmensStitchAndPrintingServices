---
phase: 12-consent-analytics-legal
group: R2-WEB
created: 2026-11-20T21:30:00-06:00
updated: 2026-11-20T21:30:00-06:00
reviewed: 2026-11-20T21:30:00-06:00
depth: standard
diff_base: 14bf277d (12.1 files) / 77f6af7d (phase 12 last review)
files_reviewed: 12
files_reviewed_list:
  - docs/web/e2e.md
  - web/e2e/no-cookies.spec.ts
  - web/e2e/visitor-stats.spec.ts
  - web/src/components/data/VisitorTrendChart.tsx
  - web/src/components/data/VisitorTrendChart.test.tsx
  - web/src/layouts/PublicLayout.test.tsx
  - web/src/modules/admin/hooks/useVisitorStatsToday.ts
  - web/src/modules/admin/hooks/useVisitorStatsToday.test.tsx
  - web/src/modules/admin/pages/VisitorStatsPage.test.tsx
  - web/src/modules/public/hooks/usePageViewBeacon.test.tsx
  - web/src/test/cookie-inventory.node.test.ts
  - web/src/test/legal-content.node.test.ts
status: issues_found
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
---

# Phase 12 and 12.1: Code Review R2-WEB

*Created: 2026-11-20T21:30:00-06:00 · Updated: 2026-11-20T21:30:00-06:00*

## Summary

The D-79 fixes are sound. The Visitor Stats today hook, the cookie inventory scan, the legal block check, the CSV based E2E counts and the no-cookies header and storage checks all do what the fix report says. No OR-3, OR-4, OR-5 or OR-6 problem was found, and there is no em or en dash in the reviewed web files.

D-79 fix check: G3-WR-01, G4-WR-01 to G4-WR-04, G5-WR-01 to G5-WR-03 are correct. G4-WR-05 is only partly done (R2W-WR-03). G3-WR-02 has the right logic but left a test gap and a layout risk (R2W-WR-01, R2W-WR-02).

## Warnings

### R2W-WR-01: The 28px month label rule is no longer covered by any test

**File:** `web/src/components/data/VisitorTrendChart.test.tsx:240-274`
**Issue:** The "keeps every month label when a group is 28px or wider" and "thins the month labels ... when a group is under 28px" tests use `TWELVE` (Dec 2025 to Nov 2026). Since G3-WR-02, a range that crosses a year uses the 44px room (`labelStep(..., wideLabels)`), not `MIN_LABEL_GROUP` (28). So both tests now exercise the 44px rule, and their names are wrong. No remaining test exercises the 28px rule for a single-year month chart: the only single-year month test runs at the fallback width, where nothing is thinned. Setting `MIN_LABEL_GROUP` to 0 would pass the whole suite, and so would setting it to 40.
**Fix:** Add a single-year month case. For example, `months(2026, 1, 12, ...)` with `from="2026-01-01"` and `to="2026-12-31"`. Resize to 320 (22.3px a group) and expect every other label counting back from Dec. Resize to 400 (29px) and expect all 12 labels. Rename the two existing tests to say they cover a range that crosses a year (44px).

### R2W-WR-02: Two labels that both carry a year can touch or overlap

**File:** `web/src/components/data/VisitorTrendChart.tsx:57-59, 87-106`
**Issue:** A year label ("Dec 2025") is about 46px wide at 11px with tabular digits, but `labelStep` gives it only 44px of room, the room sized for a day label like "Nov 15" (about 33px). The first drawn label always carries the year, and so does the first drawn label of a new year. When Dec is followed by Jan, or when Dec is followed by Feb because Jan is thinned out, two year labels sit `step * gw` apart. That distance is between 44 and about 50px for a 12-month range in a card roughly 580 to 650px wide, which is a normal desktop width. They then touch or overlap. The current tests only check the label text, never the spacing. The fix report already asks for a visual check on this.
**Fix:** Give year-bearing months their own room: `const MIN_YEAR_LABEL_GROUP = 56;`, and use it in `labelStep` when `wideLabels` is true and the bucket is a month. Add a test with 12 month buckets at a width where `gw` is about 46 (W about 604). Expect that no two non-null labels that both contain a year are adjacent.

### R2W-WR-03: Three beacon tests still use a fixed 60 ms wait for a negative result

**File:** `web/src/modules/public/hooks/usePageViewBeacon.test.tsx:29-30, 137-149, 151-164, 223-232`
**Issue:** G4-WR-05 replaced the fixed `settle()` wait in the "skips /admin", "repeat click", "hidden page" and PublicLayout tests. Three tests still assert "nothing more was sent" after `await settle()` (60 ms): the StrictMode "counts one view" test, "drops a failed send quietly: one call, no retry", and "swallows a rejected send without a retry". A retry with a back-off over 60 ms, or a late second StrictMode send, would pass all three. This is the same defect class the owner accepted in G4-WR-05.
**Fix:** Use a control, as the other tests do. Render a `/contact` view with the failing probe, navigate to a second counted path, and wait for that request. Assert that the only requests are `/contact` once, then the control path. For the machine test, call `machine.view('/products')` again as the control and assert that `send` was called exactly 3 times. That count is deterministic with no timer, because a swallowed rejection is not retried.

## Info

### R2W-IN-01: The cookie inventory does not see a cookie written as a raw header

**File:** `web/src/test/cookie-inventory.node.test.ts:23, 103-105`
**Issue:** "Every place the server sets a cookie" is checked only through `cookies.Append(`. A cookie set with `Headers.Append("Set-Cookie", ...)`, `Headers.SetCookie` or a response cookie feature would pass unseen. The check is also limited to `Csps.Server`.
**Fix:** Also scan the server C# for `Set-Cookie` and `Headers.SetCookie`, and fail on any hit outside the inventory files.

### R2W-IN-02: The exact count tests can flake once a day when the 30 day window moves

**File:** `web/e2e/visitor-stats.spec.ts:129-143, 187-199, 225-229`
**Issue:** `pageViewsByName` reads the default "Last 30 days" range twice, before and after the visit. If Manila midnight falls between the two reads, the first day drops out of the window and a page's total can fall by that day's views. The "rose by exactly one" and "unchanged" checks then fail without any product defect. The window is small (a few seconds, once a day), but runs are serialized by the lock, so a long lock wait raises the odds a little.
**Fix:** Read the business date (`manilaDate(0)`) before and after. If they differ, repeat the whole before and after block. Or use a custom range of today only for these counts.

### R2W-IN-03: The link check accepts a protocol-relative target

**File:** `web/src/test/legal-content.node.test.ts:33, 83`
**Issue:** `SAFE_HREF` starts with `\/`, so `//other.example` counts as safe. `internalLinkProblems` then lists it as a non-public path unless it is marked `external: true`. An `external` link written as `//host` skips both checks.
**Fix:** Use `/^(?:\/(?!\/)|mailto:|tel:|https:\/\/)/`, and add a guard test for `//host`.

### R2W-IN-04: The `no-cookies` additions ran in one engine only, and the origin is hard coded

**File:** `web/e2e/no-cookies.spec.ts:116, 127-151`
**Issue:** G5-WR-03 (`allHeaders()` on every response, storage spread) was run in the chromium project only. Firefox, WebKit and the two phone projects have not run it. Separately, `ORIGIN = 'https://localhost:5199'` repeats the config `baseURL`, where the other specs use `baseURL ?? ...`.
**Fix:** Run `@no-cookies` in all five projects before ship. Take the origin from `baseURL` (the `baseURL` test fixture).

---

_Reviewed: 2026-11-20T21:30:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
