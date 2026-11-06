---
phase: 09-order-images-maintenance-jobs
plan: 33
subsystem: web / photo viewer
tags: [gap-closure, G-09-10, viewer, layout, e2e]
requires: [09-UAT.md gap G-09-10]
provides: "viewer image box centred in its stage column on wide windows; three @order-photos-view checks, run on the real order page in all five projects"
affects: [web/src/components/media/photoViewer.recipe.ts]
key-files:
  modified:
    - web/src/components/media/photoViewer.recipe.ts
    - web/src/components/media/PhotoViewer.test.tsx
    - web/e2e/order-photos-view.spec.ts
    - docs/web/e2e.md
    - .planning/phases/09-order-images-maintenance-jobs/09-UAT.md
status: complete
commits: 4
plan_head_before: 7b9b7236a978b3550fb4fb0e4f51847b079b6a4b
plan_head_after: 251d8e9dc780fcd74caab8e23ea4ac93d5f45433
actuals:
  tasks: 3
  commits: 4
created: "2026-11-05T19:30:00-06:00"
updated: "2026-11-05T20:30:00-06:00"
---

# Phase 9 Plan 33: Centre the photo viewer's picture on wide windows Summary

*Created: 2026-11-05T19:30:00-06:00 · Updated: 2026-11-05T20:30:00-06:00*

**One-liner:** The viewer box is now centred between Previous and Next above 639 px with its size unchanged (proved on the dev showcase viewer in three engines), but the real-order-page Playwright checks were written and NOT run, because LocalDB would not start in this agent shell. Status is partial.

## What was done

- `photoViewer.recipe.ts`: `viewerImageClasses` now has `justify-self-center`, `vp-lt-sm:justify-self-auto`, and a width set from the height cap and the photo ratio:
  `w-[calc(min(680px,100dvh-200px)*var(--ratio))] max-w-full`, with `vp-lt-sm:w-auto vp-lt-sm:max-w-none` so phones keep today's layout. One doc line says why.
- `PhotoViewer.test.tsx`: new jsdom test for the centring and phone classes.
- `order-photos-view.spec.ts`: `drawJpeg` takes optional size; `uploadPhotos` split out of `addPhotos`; three new G-09-10 tests (wide-window centring, phone layout unchanged, white band is the photo's own pixels).
- `docs/web/e2e.md` row and `09-UAT.md` `fix_plan: "09-33-PLAN.md"` (gap stays `failed`).
- No change to `PhotoViewer.tsx`, `LazyImage`, any package file.

## Commits

| Commit | Message |
| ------ | ------- |
| ca050c02 | test(09-33): add failing viewer centring checks for the wide window and the phone layout (RED) |
| 8203224b | fix(09-33): centre the photo viewer box in its column on wide windows (GREEN) |
| 0075ce7d | test(09-33): add the mockup white band check for the photo viewer |
| 251d8e9d | docs(09-33): record the viewer centring checks and the gap fix plan |

START (HEAD before the plan) was `7b9b7236`. `git diff --name-only 7b9b7236..HEAD` lists only the five files above, so nothing under `web/src/components/states`, `PhotoViewer.tsx`, `package.json` or `package-lock.json` changed.

## Evidence

**RED, jsdom (seen):** `FAIL ... PhotoViewer look and layout > centres the image box in its stage column above 639 px and keeps the phone alignment`. Received classes had no `justify-self-center`. Assertion on the planned behaviour, so a valid RED.

**GREEN, jsdom (seen):** `Test Files 1 passed (1)`, `Tests 34 passed (34)` for `PhotoViewer.test.tsx`.

**Why the real Playwright run did not happen:** `npm run e2e` stopped at the seed step: `LocalDB not reachable ... SQL Server process failed to start` then `e2e: seed failed with exit code 1.` `sqllocaldb info MSSQLLocalDB` says Stopped, and `sqllocaldb start` fails; a `sqlservr.exe` started outside the app is running. This is the known case in the owner's memory note (LocalDB started outside the app is invisible in-app). The fix is the owner's: run `sqllocaldb stop MSSQLLocalDB` in a normal terminal when TheBETSLLC is not testing, then start it from in-app. I did not use the retired CSPS instance or any other connection, and touched no `BetsLLC_*` database. Also, the agent shell refuses to run `powershell` directly, so I ran no separate preflight; `npm run e2e` runs it itself and showed port 5199 free and 5180, 5115, 7028 held by the owner's own dev servers (not started by me, not touched).

**Stand-in measurement (not the plan's gate):** I built the e2e bundle and served `web/.e2e-dist` from a throw-away static server on 5199 (script kept outside the repo, stopped afterwards), then opened the dev showcase viewer (same `PhotoViewer` and recipe) at 1899 x 951 in chromium, firefox and webkit, and at 639 x 951.

Before the fix, all three engines, 4:3 photo: box 906.7 x 680, space left 16.0, space right 65.3. Other shapes: 3:4 box 510 x 680, left 16 / right 462; 1:4 box 170 x 680, left 16 / right 802; 1:1 box 680 x 680, left 16 / right 292; 4:1 box 956 x 239, 16 / 16. This confirms the diagnosis (box at the start of its column).

After the fix, all three engines: 4:3 box 906.7 x 680, space 40.7 / 40.7; 3:4 box 510 x 680, 239 / 239; 1:4 box 170 x 680, 409 / 409; 1:1 box 680 x 680, 154 / 154; 4:1 box 956 x 239, 16 / 16. Every box size is identical to before. At 639 x 951: box left 16, width 607 (the stage), Previous and Next 44 x 44, both at top 699.1, box bottom 683.1: same before and after.

The 5:4 and 4:3 numbers on the real order page (about 16 / 122 px before, about 69 / 69 after) still need the real run.

## Deviations from plan

**1. [Rule 1 - Bug] `justify-self-center` alone collapses the box.** On the first GREEN try (only the two classes the plan names) the stand-in probe showed the box at 1.0 x 0.8 px in all three engines: a centred item with `width: auto` sizes to its content, and the picture inside is `size-full`, so it contributes no width. That would also make the box jump from nothing to full size on load. Fix: give the box an explicit width from the height cap and the ratio, at most the column (`max-w-full`), and reset both on phones. This is the plan's own anticipated "bound the width through the ratio" step, applied for all engines because the failure showed in all three. Commit 8203224b.

**2. [Environment] No real-host e2e run (see Evidence).** The plan's Task 1 RED run, Task 1 GREEN run, Task 2 five-project run and Task 3 e2e gate were not executed. The "Diagnosis check" conditional checkpoint could not be evaluated on the real page; the stand-in numbers above match the diagnosis. The e2e tests compile (`tsc -p tsconfig.node.json`), lint and format clean, but have never run, so a selector or tolerance may need a touch when they first run.

**3. [Environment] `license-checker` fails inside this worktree.** `npm run license:check` and `scripts/license-policy.test.ts > exits 1 on a stricter policy ...` fail with `No packages found in this path...` from `license-checker-rseidelsohn`, after a clean `npm ci` in the worktree (needed because the worktree had no `node_modules`; `package.json` and the lock file are unchanged). Not caused by this plan. Not fixed (out of scope).

## Gate results

- `npm --prefix web run typecheck`: exit 0, no output.
- `npm --prefix web run lint` (`--max-warnings 0`): exit 0, no output.
- `npm --prefix web run format:check`: `All matched files use Prettier code style!`
- `npm --prefix web run test -- --run`: `Test Files 1 failed | 282 passed (283)`, `Tests 1 failed | 8019 passed (8020)`. The one failure is the license-checker test above, re-run alone with the same result.
- `npm --prefix web run build`: exit 0. `build:budget`: exit 0. `notices:check`: exit 0.
- `npm --prefix web run verify` as one command was not run, because its `license:check` step fails in this worktree for the reason above; every other step was run on its own and passed except the one failing test inside `test:coverage`.
- `gitleaks protect --staged`: no leaks found, before each of the four commits. No real names, paths or emails in the staged text.

## Real-host e2e run (orchestrator, after the merge)

LocalDB answered from the orchestrator shell, so the gates ran there on the merged phase branch (preflight: 5180, 5115, 7028, 5199 free, no other test processes).

- **RED on the real order page:** with the recipe from ca050c02 put back for one run, `npm --prefix web run e2e -- --grep "G-09-10" --project chromium` failed only the wide-window check: `equal space on both sides (photo 1: box 850 x 680, left 471.5, right 1321.5, space 16 / 122, column 956)`. The phone and white-band checks passed before the fix, as planned. This matches the diagnosis, so the Diagnosis check checkpoint did not fire. The recipe was restored afterwards.
- **GREEN, five projects:** `npm --prefix web run e2e -- --grep "G-09-10"`: `11 passed`, 4 skipped (the two wide-window checks on pixel and iphone, by design).
- **Regression:** `npm --prefix web run e2e -- --grep "@order-photos-view|@order-photos-a11y"`: `113 passed`, 7 skipped, exit 0.
- **verify:** `npm --prefix web run verify` exited 0 in the main checkout (license check included), so the license-checker failure in deviation 3 was specific to the worktree.
- The white band read as the photo itself in chromium, firefox and webkit, so the second-fix checkpoint did not fire. No package changed.

## What is still open

1. Owner's eyes: ORD-2026-0161 photo 1 at about 1899 px wide should sit centred between Previous and Next, and Open Full Size should show the same white band in the full-size photo (human check from Task 3).
2. Owner's call, in plain words: phones keep today's alignment as asked, so a very tall photo on a phone still sits at the left of the stage. Do you want it centred there too?

## Known stubs

None.

## Self-Check

- Files: all five modified files exist and are committed (`git diff --name-only 7b9b7236..HEAD`).
- Commits `ca050c02`, `8203224b`, `0075ce7d`, `251d8e9d` are on this branch.
- Self-Check result: PASSED. The real-host e2e gates ran after the merge (see above).
