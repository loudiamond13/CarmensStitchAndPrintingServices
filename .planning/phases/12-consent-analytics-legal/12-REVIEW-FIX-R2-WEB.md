---
phase: 12-consent-analytics-legal
created: 2026-11-20T20:45:00-06:00
updated: 2026-11-20T20:45:00-06:00
fixed_at: 2026-11-20T20:45:00-06:00
review_path: .planning/phases/12-consent-analytics-legal/12-REVIEW.md
iteration: 1
findings_in_scope: 19
fixed: 17
skipped: 2
status: partial
---

# Phase 12 and 12.1: Code Review Fix Report, web slice (R2-WEB)

*Created: 2026-11-20T20:45:00-06:00 · Updated: 2026-11-20T20:45:00-06:00*

**Source review:** `.planning/phases/12-consent-analytics-legal/12-REVIEW.md`
**Iteration:** 1
**Scope:** R2W-WR-01 to R2W-WR-03, R2W-IN-01 to R2W-IN-04, carried G3-IN-01 to G3-IN-05, G4-IN-01 to G4-IN-04, G5-IN-01, G5-IN-03, and the web remainder of G5-IN-02. No .NET source or test was touched.

**Summary:**
- Findings in scope: 19 (G5-IN-02 counted once, R2W-WR-01 and R2W-WR-02 counted as two)
- Fixed: 17 in 16 commits (R2W-WR-01 and R2W-WR-02 share one commit, because their tests overlap). R2W-IN-04 is counted as fixed for its `baseURL` part.
- Skipped: 2 (G3-IN-04 waiting on the owner, G5-IN-01 already fixed). The five-engine run of R2W-IN-04 is recorded as a ship check below.

All work ran in an isolated worktree under `.claude/worktrees/`. The commits were fast-forwarded onto `gsd/phase-12-consent-analytics-legal` (head `6a1a2966`). The worktree, temp branch and recovery sentinel were removed. The worktree got its own `node_modules` from `npm ci --ignore-scripts` (same lock file, no new package).

## Verification

Where it ran: the worktree for each fix, then the main checkout for the final targeted run after the fast-forward.

- Per fix: the touched Vitest files, ESLint on the touched files, Prettier on the touched files. Tests for behavior changes were written first and seen failing: R2W-WR-02, R2W-IN-03, G3-IN-01 and G3-IN-02. R2W-WR-01 was checked by changing the constant by hand. R2W-WR-03, G3-IN-03 and the other test-only items have no red step.
- `npm run typecheck` (app, node and reference configs): no errors, after the last change.
- `npm run lint` (`eslint . --max-warnings 0`): no output, exit 0, whole web project.
- `prettier --check .`: "All matched files use Prettier code style!"
- Full `vitest run` in the worktree: 420 of 421 files passed, 11,248 of 11,249 tests passed. The one failure is `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions" with "No packages found in this path". I re-ran that file alone and it failed again in the worktree, so it is not a flake. It does not touch anything I changed. It passes in the main checkout (64 of 64), so the cause is the worktree's `node_modules` made with `--ignore-scripts`. I did not change it.
- Final targeted run in the main checkout after the fast-forward: 23 files, 1,017 tests, all passed. That run included `VisitorTrendChart`, `usePageViewBeacon`, `cookie-inventory`, `legal-content`, `urlPath`, `format`, `SiteFooter`, `VisitorStatsPage`, `downloadCsv`, `LegalPages`, `license-policy`, `source-layout` and `no-long-dash`. `npm run typecheck` also passed there.
- Long dash check: no em or en dash on any added line under `web/`.
- `gitleaks protect --staged` ran before every commit (the repo's commit hook also ran it): no leaks.
- Preflight ran before the full test run: all four ports free, no dev or test processes. No dev server and no Playwright run were started.
- Not run: any Playwright E2E. The three E2E edits (R2W-IN-02, R2W-IN-04, G5-IN-03) are checked by lint, Prettier and `tsc -p tsconfig.node.json` only. They need a real run before ship.

## Fixed Issues

### R2W-WR-01: The 28px month label rule was not covered by any test
**Files modified:** `web/src/components/data/VisitorTrendChart.test.tsx`
**Commit:** 789d1bac (shared with R2W-WR-02)
**Applied fix:** Added a single-year month chart test at 29px a month (all 12 labels) and at 22px (every other label, counting back from Dec). The two old tests are renamed to say they cover a range that crosses a year. I checked by hand that setting `MIN_LABEL_GROUP` to 0 or to 40 now fails one test each.

### R2W-WR-02: Two labels that both carry a year could touch
**Files modified:** `web/src/components/data/VisitorTrendChart.tsx`, `web/src/components/data/VisitorTrendChart.test.tsx`
**Commit:** 789d1bac
**Applied fix:** New `MIN_YEAR_LABEL_GROUP = 56`, used by `labelStep` for month charts that cross a year. A new test at 46px a month checks that no two year labels are closer than 56px (seen failing before the change).
**Status:** fixed: requires human verification. This changes how many labels a year-crossing month chart shows: 12 months in a card about 650px wide now show every other label (it showed all 12 before). The visual check the earlier fix report asked for is still worth doing.

### R2W-WR-03: Three beacon tests used a fixed 60 ms wait for a negative result
**Files modified:** `web/src/modules/public/hooks/usePageViewBeacon.test.tsx`
**Commit:** eb07bf51
**Applied fix:** The StrictMode and failed-send tests now navigate to a second path as a control and check the request list is exactly the first path then the control. The machine test sends a control path after a microtask and checks the three calls. The `settle` helper is gone.

### R2W-IN-01: The cookie inventory did not see a cookie written as a raw header
**Files modified:** `web/src/test/cookie-inventory.node.test.ts`
**Commit:** 8cecac26
**Applied fix:** New `rawCookieHeaderLines` scans all C# under `src/` (not only `Csps.Server`) for `Set-Cookie`, `SetCookie` and `ResponseCookiesFeature`. Comment lines and the one read-only check in the idempotency middleware are left out. Guard tests cover each flagged form. I also added a raw header line to a server file by hand, saw the new test fail, and reverted it.

### R2W-IN-02: Exact count tests could flake once a day when the 30 day window moves
**Files modified:** `web/e2e/visitor-stats.spec.ts`
**Commit:** f9e9b254
**Applied fix:** New `withStableWindow`. If a before and after block fails and the business date changed during it, the whole block runs once more. Both exact count tests use it, inside the site content lock. Not run against a real stack.

### R2W-IN-03: The link check accepted a protocol-relative target
**Files modified:** `web/src/test/legal-content.node.test.ts`
**Commit:** e9f3cc03
**Applied fix:** `SAFE_HREF` now refuses `//host`. A guard test shows a `//host` link marked `external` fails. Seen failing first.

### R2W-IN-04 (baseURL part): the no-cookies origin was hard coded
**Files modified:** `web/e2e/no-cookies.spec.ts`
**Commit:** 5a2e3d6f
**Applied fix:** The old-cookie test takes `baseURL` from the Playwright fixture and uses it as the cookie `url`. The `ORIGIN` constant is gone. The test throws if the config sets no `baseURL`. The five-engine run is listed under Skipped.

### G3-IN-01: Export CSV could save a different range than the toolbar shows
**Files modified:** `web/src/modules/admin/pages/VisitorStatsPage.tsx`, `web/src/modules/admin/components/VisitorStatsToolbar.tsx`, `web/src/modules/admin/pages/VisitorStatsPage.test.tsx`
**Commit:** 44cf1bd8
**Applied fix:** `exportQuery` can now be null. It is null when the business today could not be read (`noToday`), or when a shared custom link has never had its dates resolved. The Export CSV button is then disabled. It turns on once the dates resolve. The existing "keeps the last applied range" behavior is unchanged. Test written first and seen failing.
**Status:** fixed: requires human verification. A disabled Export CSV button is a visible change, though it is the fix the review asked for.

### G3-IN-02: Footer Legal links ignored a trailing slash for `aria-current`
**Files modified:** `web/src/utils/urlPath.ts` (new), `web/src/utils/urlPath.test.ts` (new), `web/src/modules/public/components/SiteFooter.tsx`, `web/src/modules/public/components/SiteFooter.test.tsx`, `web/src/layouts/PublicLayout.tsx`
**Commit:** d87d105b
**Applied fix:** New `withoutTrailingSlash` helper, used by the footer and by the header's `currentSiteLink`. Tests for `/privacy/` in both footer variants were seen failing first. Two new small files, both needed for the shared helper.

### G3-IN-03: Range text was built twice
**Files modified:** `web/src/utils/format.ts`, `web/src/utils/format.test.ts`, `web/src/components/data/copy.ts`, `web/src/components/data/VisitorTrendChart.tsx`, `web/src/modules/admin/pages/VisitorStatsPage.tsx`, `web/src/modules/admin/visitorStatsCopy.ts`
**Commit:** 11a9404b
**Applied fix:** One `formatRangeText(from, to)` in `@/utils/format`, with tests. The page and the chart both use it. `COPY.dates` is removed and `groupName` now takes the finished range text. The new tests were written with the function, with no separate red run. One small change in an unreachable case: a malformed date in the chart name now falls back to the raw "from to to" text for both dates together.

### G3-IN-05: MapCard header comment still opened with the pre-D-65 rule
**Files modified:** `web/src/modules/public/components/MapCard.tsx`
**Commit:** 1d9ea3a2
**Applied fix:** Reworded the first paragraph as the review suggested. Comment only.

### G4-IN-01: Hard-coded "Version 1.0" in a legal page test
**Files modified:** `web/src/modules/public/pages/LegalPages.test.tsx`
**Commit:** 200e5926
**Applied fix:** Deleted the line. The line above it already checks the full version line against the fixture.

### G4-IN-02: Stubbed `URL.createObjectURL` and `revokeObjectURL` were never removed
**Files modified:** `web/src/modules/admin/downloadCsv.test.ts`, `web/src/modules/admin/pages/VisitorStatsPage.test.tsx`
**Commit:** 81f21e5f
**Applied fix:** Both files delete the two functions in `afterEach`. I did not add the shared helper, because the two stubs differ (one counts blobs, the other records saves).

### G4-IN-03: Only the Accessibility module was asserted to exist in the legal text scan
**Files modified:** `web/src/test/legal-content.node.test.ts`
**Commit:** 6648d0c3
**Applied fix:** The guard now expects `legalAccessibility.ts`, `legalPrivacy.ts` and `legalTerms.ts`.

### G4-IN-04: `.catch(() => null)` on `findBy` calls hid the real failure
**Files modified:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx`
**Commit:** 0301411f
**Applied fix:** Removed the three `.catch` calls. The tests now assert on the element `findBy*` returns.

### G5-IN-02 (web remainder): "four legal pages" in `usePrivacyContact.ts`
**Files modified:** `web/src/modules/public/hooks/usePrivacyContact.ts`
**Commit:** 6a1a2966
**Applied fix:** "four" is now "three" in the header comment. Other "four" mentions in the repo are about the four public pages or old measurements, so I left them.

### G5-IN-03: Small consistency items in the specs
**Files modified:** `web/e2e/contact.spec.ts`, `web/e2e/link-preview.spec.ts`
**Commit:** 71798172
**Applied fix:** The "clearing the saved map" test now asserts the `csps-maps` key exists before it clears it. `link-preview.spec.ts` reads its fixture with `fileURLToPath(new URL(..., import.meta.url))`. Not run against a real stack.

## Skipped Issues

### G3-IN-04: Privacy Policy describes quote-request collection for a form that is not live
**File:** `web/src/modules/public/legalPrivacy.ts:35,64-67,130-133`
**Reason:** Waiting on owner. The wording is the owner's (D-73), so I did not touch it.
**Question for the owner:** The Privacy Policy talks about quote-request details and files, with a legal basis and a 6-month retention, but the inquiry form only returns in Phase 13. Do you want to (1) keep it as forward-looking text, or (2) mark those lines to be added when the form ships? My suggestion is option 2, because the page is a draft and the text should match what the site does today.
**Original issue:** The policy describes collection that does not happen yet.

### G5-IN-01: `docs/web/e2e.md` described the old first `@visitor-stats` check
**File:** `docs/web/e2e.md:130`
**Reason:** Already fixed. The `@visitor-stats` row now says each of the three page counts rises by exactly one, read from the CSV export under the site content lock. It matches the spec. No change made.

### R2W-IN-04 (five-engine run): `@no-cookies` ran in one engine only
**File:** `web/e2e/no-cookies.spec.ts`
**Reason:** A ship check, not a code change. It needs the full stack (API, LocalDB `CSPS_E2E`, the five Playwright projects), which I did not start. Please run `@no-cookies` in chromium, firefox, webkit, pixel and iphone before ship. The same goes for the edited `@visitor-stats`, `@contact` and `@link-preview` specs.
**Original issue:** G5-WR-03's header and storage checks were run in chromium only.

---

_Fixed: 2026-11-20T20:45:00-06:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
