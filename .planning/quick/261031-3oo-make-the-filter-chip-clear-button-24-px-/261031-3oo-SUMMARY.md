---
created: 2026-10-31T02:55:00-05:00
updated: 2026-10-31T02:55:00-05:00
phase: quick-261031-3oo
plan: 01
status: complete
subsystem: web/lists
tags: [a11y, target-size, filter-chip, D-98]
requirements: [WEB-06, ORD-02]
commits: 4
plan_head_before: aa8434f9
plan_head_after: fd4ab2c2
actuals:
  tokens: 9000
  tasks: 3
  commits: 4
---

# Quick 261031-3oo: Filter chip Clear button is 24 px (D-98)

The filter chip Clear button is now drawn 24 x 24 px (`size-6`) instead of 22 px. The 44 px tap area, the 14 px x icon, the 28 px chip and the 5 px group end padding are unchanged. D-98 (owner, 2026-10-31) is recorded as a ruling that supersedes D-93 and amends O-8 for this one button.

## What changed

| Task | Commit | Change |
| ---- | ------ | ------ |
| 1 RED | `cc598815` | New test in `lists.recipe.node.test.ts`: the compiled CSS of `filterChipClearClasses` is 24 px wide and tall. |
| 1 GREEN | `305d47e7` | `size-[22px]` became `size-6` in `lists.recipe.ts`; comments in `lists.recipe.ts` and `FilterBar.tsx` updated; `web/e2e/target-size.spec.ts` expects `expectTapAreas(page, CHIP_CLEAR, 24, 2)` and the title says "drawn 24 px". |
| 2 | `c9397021` | D-98 added to `08-CONTEXT.md` (D-93 marked superseded), O-8 in `02-CONTEXT.md` amended, `PROJECT.md` key decision row points at D-98. |
| 2 (uncommitted) | none | `.planning/STATE.md` decisions list carries the D-98 line, left for the orchestrator's commit. |
| 3 | `fd4ab2c2` | Phase 2 `02-UI-SPEC.md` (O-8 line and overflow row), `docs/CSPS-UI-SPEC.md` App. E.7 (24px plus D-98 note), `08-UI-REVIEW.md` (4 places), `deferred-items.md` item 7 now point at D-98. |

## RED and GREEN evidence

RED (before the fix):

```
AssertionError: expected 22 to be 24 // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

GREEN (after the fix):

```
 ✓ src/test/no-long-dash.node.test.ts (1 test)
 ✓ src/components/lists/lists.recipe.node.test.ts (10 tests)
 ✓ src/components/lists/FilterBar.test.tsx (21 tests)
 Test Files  3 passed (3)
      Tests  32 passed (32)
```

## Gates (all run, all green, no warnings)

| Gate | Result |
| ---- | ------ |
| `eslint --max-warnings 0` on the 4 touched web files | exit 0, no output |
| `npm --prefix web run typecheck` (app, node, reference) | exit 0 |
| `npm --prefix web run format:check` | "All matched files use Prettier code style!" |
| no `size-[22px]` left in `web/src` or `web/e2e` | passed |
| `expectTapAreas(page, CHIP_CLEAR, 24, 2)` present in the e2e spec | passed |
| `git diff --quiet aa8434f9` on `web/e2e/fixtures.ts`, `web/src/components/actions`, `web/src/components/choice`, `web/package.json`, `web/package-lock.json` | unchanged (D-71 helper and the other O-8 recipes untouched; no package change) |
| Task 2 grep checks | passed |
| Task 3 grep checks plus `visual/reference/extract-spec.test.ts` (spec pin) | passed, 27 tests |
| gitleaks on every staged change | no leaks found; staged diffs read, no server or database names, emails or local user paths |

## Deviations from Plan

- Commit trailer: the plan and the orchestrator's constraints say `Claude Opus 5.5`; the harness attribution rule for this session says `Claude Sonnet 5.5`, so the four commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Line endings: several planning files are CRLF (`08-CONTEXT.md`, `02-CONTEXT.md`, `02-UI-SPEC.md`, `docs/CSPS-UI-SPEC.md`, and `deferred-items.md` is mixed); the edits kept each file's existing endings.
- Timestamps: the `updated` values I wrote in the docs were 2026-10-31T02:54:30 (Task 2 files) and 2026-10-31T02:56:30 (Task 3 files). The real clock read about 02:54:52 at the end, so the Task 3 files are about 2 minutes ahead of real time. `08-UI-REVIEW.md` had an earlier `updated` of `2026-10-31T10:30:00-05:00`, later than the real time; it was replaced with the real-time value as the plan says.

Otherwise: none, plan executed as written.

## Follow-ups (not run, by owner rule)

- The e2e runs were not started: `@target-size` (chip clear now expects 24 px), `@orders-filters` on pixel, and the four-chip `@lists @overflow` / `@long-text` toolbars. These are for the owner or CI to confirm that axe `target-size` now passes on those pages.
- `.planning/STATE.md` carries the D-98 line and is uncommitted for the orchestrator. `PLAN.md` and this SUMMARY are also left for the orchestrator.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

Files edited exist and the four commits (`cc598815`, `305d47e7`, `c9397021`, `fd4ab2c2`) are on `gsd/phase-08-order-screens`.
