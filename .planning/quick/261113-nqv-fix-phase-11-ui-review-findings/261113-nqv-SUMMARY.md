---
created: 2026-11-13T18:00:00-06:00
updated: 2026-11-13T18:00:00-06:00
phase: quick-261113-nqv
plan: 01
subsystem: web/public-site
tags: [ui-review, typography, tokens, csp, safe-area]
status: complete
requirements: [PUB-01, PUB-06, GAL-01, GAL-02, CONT-02, CONT-03]
commits: 3
plan_head_before: d3c64d426d23f4c4eefc255f75fbd0eeb123984c
plan_head_after: 3a2b4963
actuals:
  tasks: 3
  commits: 3
key-files:
  created:
    - web/src/test/public-look.node.test.ts
  modified:
    - web/src/ui/app.css
    - web/src/modules/public/components/ (8 recipes and components, see below)
    - web/src/layouts/PublicLayout.tsx
    - .planning/phases/11-public-site-content-management/11-UI-REVIEW.md
    - .planning/phases/11-public-site-content-management/11-UI-SPEC.md
    - .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md
---

# Quick 261113-nqv: Fix Phase 11 UI review findings Summary

The public site now uses 23 named font-size tokens, token colours on the Contact map, no style attribute anywhere in `web/src/modules/public`, and safe-area padding under the Contact bar. The look is unchanged. Every finding in 11-UI-REVIEW.md has a recorded outcome.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | b14b020c | 23 `--text-N` tokens, 64 sizes in 9 files and both 650 weights moved to tokens, 5 map strokes to Blush stroke tokens, new gate test |
| 2 | 6a706946 | Drawn gallery tile sized by an attribute-only SVG sizer, bar and scroll padding add the safe area |
| 3 | 3a2b4963 | Outcomes table (R-01 to R-11), SPEC note and three deviation rows, three parked owner items |

## RED and GREEN evidence

**Task 1 RED** (`npm --prefix web run test -- --run src/test/public-look.node.test.ts`): 5 failed, 1 passed (the Blush value pin, a regression guard).
- tokens: `expected [] to deeply equal [ [ 12, '12px' ], ...(22) ]`
- hand-typed: `expected [ ...(56) ] to deeply equal []` (56 lines, for example `contact.recipe.ts:26`, `home.recipe.ts:35`)
- text-N used: none yet
- `text-14` compile: no `font-size: var(--text-14)` in the CSS
- hex: `MapCard.tsx:116, 119, 120, 121, 125`

**Task 1 GREEN:** `public-look`, `PublicLayout`, `src/modules/public`, `stylesheet-contract` and `scripts/tailwind-classes.test.ts`: `Test Files 31 passed (31)`, `Tests 528 passed (528)`.

**Task 2 RED:** `GalleryMasonry.tsx:88` style prop found; the two new drawn-tile tests failed (`expected received to have attribute`, no sizer); the bar compile lacked `padding-bottom: calc(16px + env(safe-area-inset-bottom))`; PublicLayout got `...scroll-pb-[calc(77px+var(--space-6))]` where the safe-area class was expected.

**Task 2 GREEN:** the eight listed test files: `Test Files 8 passed (8)`, `Tests 228 passed (228)`. typecheck, lint exit 0.

## Full gates (Task 3)

Preflight (quoted): ports 5180, 5115, 7028, 5199 all `free`; `Dev/test processes: none`.

`npm --prefix web run test -- --run`: `Test Files 1 failed | 390 passed (391)`, `Tests 1 failed | 10680 passed (10681)`, 562 s. The one failure is `scripts/license-policy.test.ts > license-gate.mjs > exits 1 on a stricter policy given through --exceptions`: license-checker answers "No packages found in this path..." for this worktree's `node_modules`. It fails the same way when re-run alone (63 of 64 pass), so it is not a flake. It does not touch any file in this task. It was not run on the base commit, so I cannot say it is pre-existing; the likely cause is the worktree path under `.claude/worktrees`. Please re-run it from the main checkout.

- `npm --prefix web run typecheck`: exit 0.
- `npm --prefix web run lint` (`--max-warnings 0`): exit 0.
- `npm --prefix web run format:check`: exit 1. It lists 9 files this task did not touch (`e2e/gallery.spec.ts`, `e2e/link-preview.spec.ts`, `e2e/public-sweep.spec.ts`, `e2e/site-content-sweep.spec.ts`, `src/modules/admin/auditCopy.test.ts`, `src/modules/admin/auditCopy.ts`, `src/modules/admin/components/PhotoSlot.tsx`, `src/modules/admin/components/showcase/Phase11Demos.test.tsx`, `src/modules/admin/components/showcase/Phase11Demos.tsx`). They were already unformatted on the base commit (`npm run format` rewrote them; I reverted that with `git checkout -- <path>` so this task stays small). Every file this task changed passes Prettier. Out of scope; see Open items.
- Flake seen: `ProductsPage.test.tsx` "has no axe violations" timed out once in the first targeted run (two heavy runs in parallel with the dev machine busy); it passed in the next run and in the full run.

## Deviations from Plan

**1. [Rule 3 - Blocking] `web/node_modules` was missing in the worktree.** The plan's precondition says stop; the dispatch prompt said to run `npm ci` in `web/` (lockfile only). I ran `npm ci --no-audit --no-fund` (583 packages, no `package.json` or lockfile change; `git status` clean after).

**2. [Rule 3 - Blocking] `web/scripts/tailwind-classes.test.ts` pinned `pg-phone:text-[52px]`.** It is not in the plan's file list. I changed the one line to `pg-phone:text-52` (commit b14b020c).

**3. [Rule 1 - Bug] My first sed edit of `gallery.recipe.ts` dropped the space in `bg-surface-2 bg-[image:...]`.** The whole-app class gate caught it before the commit; fixed and re-verified.

**4. Scope note.** `npm run format` reformats the 9 pre-existing files above. I reverted them each time so no commit holds them.

Otherwise the plan ran as written. Findings 4 and 5 needed no code change (evidence in 11-UI-REVIEW.md Outcomes R-04 and R-05).

## Known Stubs

None.

## Threat Flags

None. The threat register items were applied: T-nqv-01 (no style prop, gate added), T-nqv-02 (tokens equal old px values, no line-height, class gate and module tests green), T-nqv-03 (gitleaks clean on all three commits, no local paths or names), T-nqv-SC (no package added; `npm ci` from the lockfile only).

## Open for the owner

- **P11-BL-60** Lightbox arrows on phones (A recommended: keep the C-35 tap zones; B: also show 44px arrows).
- **P11-BL-61** Edge to edge on notched phones (A recommended: keep today's viewport; B: `viewport-fit=cover` plus a notched-phone check).
- **P11-BL-62** Named font sizes for the admin and shared parts (A recommended: later quick task maps 221 sizes in 33 files and widens the gate; B: public site only).
- **Not parked, needs a decision from the orchestrator:** 9 files fail `format:check` on the base commit. Format them in a separate docs or chore commit, or leave them.
- **Not parked:** `scripts/license-policy.test.ts` fails in this worktree (see above). Re-run from the main checkout.

## Self-Check: PASSED

- Commits present: b14b020c, 6a706946, 3a2b4963 (`git log --oneline -4`).
- Files present: `web/src/test/public-look.node.test.ts`; the Outcomes table has 11 `| R-` rows; the SPEC has 3 `11-UI-REVIEW fix` rows; DECISIONS.md cites `quick 261113-nqv` 3 times.
