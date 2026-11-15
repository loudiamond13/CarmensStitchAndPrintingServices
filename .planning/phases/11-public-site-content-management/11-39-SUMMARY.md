---
phase: 11-public-site-content-management
plan: 39
subsystem: web-upload
tags: [privacy, images, prepareImage, gap-closure, G-11-19, D-P11-BL-65]
requires: [D-P11-BL-65]
provides:
  - "prepareImage redraws every photo the browser can decode, at its own size when within 2000 px"
affects: [order photos, product line photos, gallery uploads, share picture]
tech-stack:
  added: []
  patterns: ["one canvas redraw path for every decodable photo; only an undecodable HEIC is passed through"]
key-files:
  modified:
    - web/src/utils/images.ts
    - web/src/utils/images.test.ts
    - .planning/phases/09-order-images-maintenance-jobs/09-UI-SPEC.md
    - .planning/phases/11-public-site-content-management/11-UAT.md
    - .planning/phases/11-public-site-content-management/deferred-items.md
decisions:
  - "Size limit counts the redrawn file (planner's choice, owner question below)"
status: complete-with-gaps
gaps_closed: []
gaps_pending: [G-11-19 (stays failed until /gsd-verify-work re-tests test 19; e2e passed, see Gate results)]
requirements: [GAL-03, CONT-02, PUB-04]
commits: 4
plan_head_before: 3435461b86aadae495f02c3e8962662ed7b2f608
plan_head_after: f3dcd1c8af716cd55b279768f404ebdae3bc3361
actuals:
  tokens: 9000
  tasks: 2
  commits: 4
created: "2026-11-14T20:06:00-06:00"
updated: "2026-11-14T20:19:16-06:00"
---

# Phase 11 Plan 39: Redraw every photo before upload Summary

*Created: 2026-11-14T20:06:00-06:00 · Updated: 2026-11-14T20:19:16-06:00*

**Every photo the browser can open is now redrawn on a canvas before it is sent, at its own size when it needs no shrink, so its location and camera data never leave the phone. Only a HEIC the browser cannot open still goes as it is.**

START sha: `3435461b86aadae495f02c3e8962662ed7b2f608`. End sha: `f3dcd1c8af716cd55b279768f404ebdae3bc3361`.

## What changed

- `web/src/utils/images.ts`: removed the branch that returned the picked File when no shrink was needed. Every decoded photo that passes the pixel checks now goes through `encodeSameFamily` at the planned size. Then cleaned up: `planDownscale` returns only width and height, one `HEIC_MIME` constant replaces the kind-to-type map, and the comments say every decodable photo is redrawn (D-P11-BL-65).
- `web/src/utils/images.test.ts`: seven tests rewritten or added to pin the rule, plus the encode-not-called assertions on the two pass-through and refuse cases.
- `09-UI-SPEC.md` step 3 and the "Upright photos" bullet match the new rule.
- `11-UAT.md` G-11-19 carries `fix_plan: "11-39-PLAN.md"`; status stays failed until `/gsd-verify-work` re-tests test 19.
- No caller, server, package or schema change.

## Commits

| Hash | Message |
| ---- | ------- |
| 0a44e64e | test(11-39): pin that every decodable photo is redrawn before upload |
| ab3ef670 | fix(11-39): redraw every decodable photo before upload, so its metadata never leaves the device |
| 852ea4dd | refactor(11-39): drop the unused scaled flag and say every decodable photo is redrawn |
| f3dcd1c8 | docs(11-39): amend the Phase 9 upload step and point gap G-11-19 at this plan |

The deferred-items.md note (D-39-1, D-39-2) is committed with this SUMMARY.

## TDD evidence

RED (`npm --prefix web run test -- --run src/utils/images.test.ts`): `Test Files 1 failed (1)`, `Tests 7 failed | 57 passed (64)`. The seven failing, each because the picked File came back with no encode call:

1. `prepareImage > redraws a 1800 x 1200 JPEG at its own size into a new file, not the picked File (D-P11-BL-65)`
2. `prepareImage > keeps a small PNG as a PNG when it is redrawn, so its transparency stays (D-P11-BL-65)`
3. `prepareImage > redraws a small WebP as a JPEG when the browser cannot make WebP`
4. `prepareImage > judges a file by its bytes: a small heic named photo.png that decodes is redrawn as a JPEG`
5. `prepareImage > accepts a small photo whose picked file is over the size when the redrawn file is within it`
6. `prepareImage > refuses a small photo whose redrawn file is over the size, and closes the bitmap`
7. `prepareImage > refuses a small photo as unreadable when the encoder gives nothing, and closes the bitmap`

This matched the plan exactly, so the Diagnosis check did not fire.

GREEN (same command): `Test Files 1 passed (1)`, `Tests 64 passed (64)`.

## Gate results

| Gate | Result |
| ---- | ------ |
| `npm --prefix web run test -- --run src/utils/images.test.ts src/test/no-long-dash.node.test.ts` | `Test Files 2 passed (2)`, `Tests 65 passed (65)` |
| `npm --prefix web run lint` | exit 0, no output after `eslint . --max-warnings 0` |
| `npm --prefix web run typecheck` | exit 0, no errors |
| `npm run build`, `build:budget`, `notices:check` | each `step-exit=0` |
| `npm --prefix web run verify` | **exit 1** at `format:check` (see below); typecheck and lint passed before it |
| `@site-content-share` e2e (five projects) | run by the orchestrator from the main checkout: `15 passed (1.9m)` (pixel, chromium, firefox, webkit, iphone) |
| `@order-photos-upload\|@site-content-gallery\|@site-content-photos` e2e (chromium) | run by the orchestrator from the main checkout: `9 passed (48.3s)` |
| `license:check` and `scripts/license-policy.test.ts` (main checkout) | `License gate passed.`; `Tests 64 passed (64)` |

Acceptance greps: `plan.scaled` outside comments 0; "as the same File object" 0; "not the picked File" 1; `D-P11-BL-65` in images.test.ts 4 and in images.ts 2; `scaled: true|false|boolean` 0; `MIME_OF_KIND` 0; "sent as it is (D-18)" in the UI spec 0 and `D-P11-BL-65` there 1; `fix_plan: "11-39-PLAN.md"` 1. `git diff --name-only START..HEAD -- web/src/modules web/src/components web/package.json web/package-lock.json src` prints nothing.

## What did not pass, and why (needs the owner or the orchestrator)

**Orchestrator follow-up (2026-11-14):** the owner stopped LocalDB in their own terminal and the session started it in-app. From the main checkout both e2e commands then passed with no failed or flaky count (quoted in the table above), so the "Real browser refuses the redraw" checkpoint did not fire and item 1 below is closed. In the main checkout the license gate and its test also pass, so that part of item 2 was only the worktree. The nine `format:check` files remain (D-39-1), unchanged from before this plan.

**1. e2e could not run (blocks the plan's real-browser criteria).** The preflight showed the owner's dev site on 5180, 5115 and 7028 (left alone) and 5199 free. `npm --prefix web run e2e -- --grep @site-content-share` stopped at the seed step: `Failed: ... Local Database Runtime error occurred. Error occurred during LocalDB instance startup: SQL Server process failed to start.` and `e2e: seed failed with exit code 1.` `sqllocaldb info MSSQLLocalDB` shows Stopped here, and `sqllocaldb start` fails the same way. The owner's instance is running outside the agent shell (the known in-app visibility problem), so it cannot be reached or restarted from here. I did not touch that process, did not use the retired CSPS instance, and did not try another database. The GREEN commit was made on the unit result alone, so the plan's "commit after e2e" order was not followed. **Next step:** run, from the main checkout where LocalDB is reachable, `npm --prefix web run e2e -- --grep @site-content-share` (all five projects) and `npm --prefix web run e2e -- --grep "@order-photos-upload|@site-content-gallery|@site-content-photos" --project chromium`. The unit tests prove the redraw call; only a real browser proves the 1200 x 630 JPEG is accepted by the server after the redraw.

**2. `npm run verify` fails, for reasons outside this plan.** Logged in `deferred-items.md` as D-39-1 and below.
- `format:check`: nine files this plan did not touch (`web/e2e/gallery.spec.ts`, `link-preview.spec.ts`, `public-sweep.spec.ts`, `site-content-sweep.spec.ts`, `auditCopy.ts`, `auditCopy.test.ts`, `PhotoSlot.tsx`, `Phase11Demos.tsx`, `Phase11Demos.test.tsx`) have lines over 120 characters. They are unchanged from the base commit. The two files I changed pass Prettier.
- Because `verify` stops at the first failure, I ran its later steps one by one: `test:coverage` failed with `Test Files 4 failed | 387 passed (391)`, `Tests 5 failed | 10680 passed (10685)`. Re-run alone: `OrderFormPage.test.tsx` and `routes.test.tsx` passed; `GalleryPage.test.tsx` passed 28 of 28 alone (it failed a different set of tests in the full run and in a four-file run, so it is load sensitive: a flake, recorded, not hidden). `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions" fails every time here, and `license:check` fails with `Error: No packages found in this path...`: the license tool finds no packages under this worktree path. That is an environment problem; no package changed.
- Taken together, the "verify exits 0" criterion is not met in this worktree. Nothing I changed is implicated, but I could not prove a clean run.

## Owner question: the PNG size edge

The size limit now counts the redrawn copy, the file that is really sent. So a small photo whose own file is over 10 MB is now accepted when its redrawn copy is smaller. The other side: a PNG within 2000 px whose redrawn copy comes out over 10 MB is refused with the size message, the same as a large PNG today. This is rare for phone photos, which are JPEG.

Options:
- **(a, recommended)** Keep this. A PNG keeps its transparency, and the rule matches the shrink path.
- **(b)** Turn such a PNG into a JPEG so it fits. This loses transparency.

## Deviations from plan

- **[Rule 3 - environment] e2e not run** (details above). Not one of the plan's named conditional checkpoints (the redraw was not refused; nothing reached a browser), so I finished the rest and parked the e2e here instead of guessing a workaround.
- **Test header edit moved earlier:** the `D-P11-BL-65` mention in the `images.test.ts` header comment was added in Task 1 with the tests, not Task 2.
- **Commit trailer:** the plan's owner rules asked for a `Claude Opus 5.5` trailer; the session's attribution instruction named `Claude Sonnet 5.5`, which is the model that did the work, so commits carry that trailer.
- The UAT and UI-spec `updated` values were set to 19:50, later than the clock then, because 11-UAT.md already carried 19:45.

## Threat flags

None. No new endpoint, auth path or file access. T-11-93 is mitigated in code and by test (the result is the encoder's blob, never the picked File, for JPEG, PNG, WebP and decodable HEIC). T-11-94 stays accepted (a test pins the undecodable HEIC as the only pass-through).

## Known stubs

None.

## Self-Check: PASSED (with the gaps listed above)

- Commits `0a44e64e`, `ab3ef670`, `852ea4dd`, `f3dcd1c8` are in the branch history; measured count `git rev-list --count START..HEAD` is 4.
- Files exist: `web/src/utils/images.ts`, `web/src/utils/images.test.ts`, this SUMMARY.
- STATE.md and ROADMAP.md were not changed.
