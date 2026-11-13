---
created: 2026-11-13T11:40:00-06:00
updated: 2026-11-13T12:20:00-06:00
---

# Phase 11 end-of-phase browser test pass

*Created: 2026-11-13T11:40:00-06:00 · Updated: 2026-11-13T12:20:00-06:00*

Branch: worktree of `gsd/phase-11-public-site-content-management`, base `71486425`. Plain summary: the known e2e issues are fixed, the missing checks are added, and the full suite was run alone. Two real defects turned up and were fixed (a stale-state bug in the Testing reset and a page-widening bug on the Edit Order form). The rest of the red was load flakes, recorded below.

## Items 1 to 11

| # | Outcome |
|---|---|
| 1 | Fixed in the test. The Site Content tab strip has five tabs and scrolls inside itself at 320px by design (11-UI-SPEC: "The strip scrolls sideways at 320px"). The test now checks the strip stays inside the window and the selected tab is in view. The WebKit `openSiteContent` timeout did not reproduce (all 20 `@site-content-business` runs passed in 2.2 minutes). |
| 2 | Fixed. The Firefox gallery test now needs part of the focused tile in view (P11-BL-46); every other engine needs the whole tile clear. It also waits for the scroll to settle (a WebKit run read a tile mid-scroll). Also found: `public-sweep.spec.ts` collected `problems` but never asserted them, so an entirely hidden control could never fail it. It now asserts, and its probes use the visible part of the box (a pill part-way across the window was wrongly "hidden"). |
| 3 | Already fine. The gallery specs count their tiles at run time. `site-content-gallery` pins 6 and 7 rows, which are right for the 6-item seed. They only failed because of item 4's cause (below). |
| 4 | Cause found (not the pixel project itself): the dev seed (plan 11-38) shows three orders (ORD-2026-0142, 0148, 0157) with gallery entries, and order specs left shown orders behind. The Testing reset only cleared `DEMO-GALLERY-*` and `E2E-` items, so exact counts in the gallery and Home specs broke. Fixed in the Testing seeder (new .NET test first): the reset takes every other shown order off the website and removes its gallery entry. Order specs now also show, read and delete their order under the site content lock (WR-F-01). |
| 5 | `@gallery` and `@gallery-lightbox`: all five projects pass (full-suite run, plus the targeted 85-test run). |
| 6 | Done. `@order-public-website` has no `pending` annotation: the branch is removed and the gallery read must answer 200 (WR-F-03). |
| 7 | Added to `site-content-hours.spec.ts`: Contact shows the Sunday row (`10:00 AM - 3:00 PM`) and the new closure under `Closed on` with its date and note. |
| 8 | Added to `site-content-testimonials.spec.ts`: Home `/` shows the new quote and name in the first testimonial card. |
| 9 | Done. The Testing seeder stores a 1 x 1 PNG for each demo order photo, demo upload photo and the demo share picture (Testing builds only; .NET test first). Every 404 declaration for `/api/testing/images/` is removed from the specs. A later fix makes the seeder take the `IImageStorage` port and store only when it is the in-memory store, because the Development host failed to build with a concrete dependency (caught by the `*DevelopmentDoesNotMapTheRoute` tests). |
| 10 | Already fine. `scripts/e2e.mjs` checks port 5199 before it plans any step; a busy port gives a refuse-only plan and nothing is seeded. `scripts/e2e.test.ts` pins this ("refuses ... when port 5199 is busy", "spawns nothing"). The docs list the same order. |
| 11 | Both recurred and are recorded as flakes with evidence (see Flakes). |

## Review findings (WR-F and IN-F)

- WR-F-01 fixed (order specs delete their shown orders under the lock; the Testing reset also unshows leftovers).
- WR-F-02 fixed: the site content lock waits 7 minutes (was 4) and its timeout message names "site content" (a vitest test pins it).
- WR-F-03 fixed (same as item 6).
- WR-F-04 fixed: the 768px check is now `scrollWidth > clientWidth`, and it passed in all projects.
- IN-F-01 fixed (`boxOf` names its slot). IN-F-04 fixed (the sweep deletes both orders, and the demo reset runs even if a cleanup step throws; the same for the two product line specs). IN-F-05 fixed (the comment now says 15 seconds).

## Real defects found and fixed

1. Edit Order form scrolled sideways on 320 to 414px phones (`@orders-sweep /admin/orders/{id}/edit`, `UIC-65..68`): the Name shown hint carries the team name, and a long name with no spaces widened the page. `Field` hints and errors now use `wrap-anywhere`. This is a small shared-component layout fix (Field test updated first).
2. Testing reset left other shown orders on the gallery and Home (item 4).

## Full suite

`npm run e2e`, all projects, run alone (the machine was busy with other sessions' .NET tests): **2438 tests: 2264 passed, 115 failed, 59 skipped (3.8 h).**

Failures by project: chromium 1, firefox 21, webkit 64, iphone 26, pixel 3. Re-runs:

- `--last-failed` (4 workers): 76 passed, 38 failed, 1 skipped.
- WebKit and iPhone, the dialog-fit, showcase, shell, keyboard, long-text and a11y-rulings tests that failed (2 workers, 108 tests): 92 passed, 2 failed (both the new `@site-content-showcase` in WebKit, the `/dev/components` h1 timeout below), 14 skipped. With 1 worker and no other load, `@dialog-fit 1440x900` and the `@keyboard` skip link test passed in WebKit.
- Chromium, pixel, firefox, workers 1 (87 tests): 81 passed, 6 failed. Four of the six were the 320px and 820px Public website measurements (read too early, 316 to 319 instead of 320); fixed by polling, then all projects passed. The other two are the intermittent Firefox `@home` tile click and a Users-page control count (below).

After the fixes no test failed on a re-run except the ones listed under Flakes. The final fix commits (the box polling, the Development host fix) were checked with targeted runs and the .NET Testing tests, not with another 3.8 hour full run.

## Flakes (each re-run alone before calling it a flake)

- **Firefox "downloadable font: download failed" (status 2152398850, a cancelled download)**: 15 failures in the full run (for example `@audit ... Back from Users`, `@expenses-list`, `@orders-edit`, `@order-photos-a11y`). Each passed when re-run alone. Same cause as the 11-37 note. See Owner items.
- **WebKit and iPhone `/dev/components` h1 not found in 5 s** (the `Component Showcase` h1 is in the page snapshot taken after the timeout): about 60 of the 115 failures (dialog-fit, showcase, shell, keyboard, expenses-sweep, a11y-rulings). They passed with 1 or 2 workers. Evidence: CPU load was 91% with other sessions' `Csps.Server.IntegrationTests` (1.9 GB) running, and `@dialog-fit 1440x900` plus the skip link test passed in 9.7 s and 7.0 s with 1 worker. Two `@site-content-showcase` WebKit runs failed the same way at 2 workers.
- **Firefox `@home` "a tile opens the Gallery" (click did not navigate)**: failed 2 of 3 mixed runs and 1 of 6 alone, passed in the full run. Not yet explained. It may be tied to the demo photos now loading in the scroll-snap strip (before, they were 404 placeholders). I tried waiting for the image to complete; the image never reports complete, so I reverted that change. Owner item.
- **`@target-size` Users page "controls checked > 10" (chromium)**: fails only when the spec runs on a fresh database with few users (it needs more than 10 controls); passed in the full run. It depends on users other specs have made. Not changed.
- Site content lock queue: three tests timed out at about 8 minutes waiting for the lock (`@site-content-products`, `@site-content-gallery`, `@site-content-hours`, Firefox), then passed alone. About 25 spec files share one lock across 5 projects and 4 workers.

## Other checks

- `npm --prefix web run lint`: clean (`--max-warnings 0`).
- `npm --prefix web run typecheck`: clean.
- Vitest touched files: `scripts/photo-host-lock.test.ts`, `scripts/lighthouse.test.ts`, `scripts/e2e.test.ts`, `src/components/forms/Field.test.tsx`: 89 tests passed. `src/components/forms` plus `src/modules/admin/components`: 96 files, 2204 tests passed.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-namespace "*Testing"`: 68 passed. `tests/Csps.Infrastructure.IntegrationTests --filter-class "*ImagesRegistrationTests"`: 12 passed. `dotnet test --solution Csps.slnx`: 9448 tests, 9445 passed, 1 failed (`AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus`, a 500 on `POST /api/testing/site-content` from a parallel caller), 2 skipped (live HIBP and one more). Re-run alone twice it passed, and the whole `Csps.Server.IntegrationTests` project passed: 2808 of 2808. Recorded as a flake; the machine was under load from other sessions. If it comes back, look at concurrent Testing resets against the shared database.

## Owner items

1. **Firefox cancelled font download counts as a console error.** About 15 failures per full run. Options: (a) ignore exactly this Firefox message in the guard, with the same limits as the WebKit rule D-111 (Firefox only, exact status code, app's own font files); recommended, because the browser itself cancelled the download on a navigation and the app did nothing wrong; (b) leave it and re-run failures each time; (c) preload the fonts so none is in flight at navigation.
2. **WebKit `/dev/components` h1 wait is 5 s.** The showcase is a very large page. Options: (a) raise the h1 wait in the shared showcase helper to 15 s; recommended, cheap and changes no behaviour; (b) run WebKit with fewer workers; (c) split the showcase.
3. **Suite length (3.8 h) and the one site content lock.** Options: (a) leave it and run the suite on a quiet machine; recommended for now; (b) shorten what the sweeps hold the lock for; (c) lock only the specs that write.
4. **Firefox `@home` Recent work tile click.** Options: (a) I look at a trace in the next pass; recommended; (b) accept as a Firefox flake.
5. **I changed `Field` (shared component) to wrap long unbroken words in hints and errors.** It only changes the page when a word has no spaces and is wider than the box. Say if you want it narrower (only the Name shown hint).

## Deleted files

None.
