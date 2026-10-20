---
phase: 05-profile-user-management
plan: 51
subsystem: ui
tags: [gap-closure, wr-20, touch-target, tailwind, e2e, tdd, look-equality]
created: "2026-10-19T04:50:00-05:00"
updated: "2026-10-19T04:50:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-50 targetAreaClasses and the @target-size probe helpers; D-51 owner ruling (space)"
provides:
  - "Every RowAction (Edit, Deactivate or Activate, Delete, the own-row Edit link, the audit-log row toggle) has a 44 x 44 px invisible tap area"
  - "Row actions sit 8 px apart, so no tap area reaches a neighbour's drawn box"
  - "The top bar user menu has a 44 px tall tap area"
  - "A roster sweep with an explicit O8_EXCEPTIONS list that fails on any new small control and on any stale entry"
affects: [05-VERIFICATION gap 5 (WR-20 closed), phase gate (@target-size in all five projects)]

actuals:
  tokens: 9000
  tasks: 3
  commits: 4
plan_head_before: f360b7ea065d43038486573640b3623ac2dc48eb
plan_head_after: 2c12d5ee4ea7955d47984883c2a97d423f1c6feb

tech-stack:
  added: []
  patterns:
    - "A tap area is composed at the use site with clsx(control, targetAreaClasses) (square) or clsx(control, hitAreaClasses) (as wide as the control)"
    - "A look-equality ruling group in rulings.css for each invisible ::before tap area, because the parity proof compares pseudo-elements"
    - "The roster sweep reports each control under 44 px by accessible name and drawn size and matches it against a reasoned exception list"

key-files:
  created: []
  modified:
    - web/src/components/lists/cells.tsx
    - web/src/components/lists/lists.recipe.ts
    - web/src/components/navigation/UserMenu.tsx
    - web/e2e/target-size.spec.ts
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts

key-decisions:
  - "D-51 (owner, 2026-10-19): space. Row actions are 8 px apart with a full 44 x 44 px tap area each. Quote: \"space\" (8 px between row buttons, full 44 x 44 px tap area each)."
  - "The top bar user menu (40 px tall, not an O-8 kind) gets hitAreaClasses: 44 px tall, as wide as the button, no visible change"
  - "The only O-8 exception on /admin/users is the theme switch (36 px .csp-iconbtn); the pagination arrows are already 44 x 44"
  - "The sweep treats a control drawn 44 x 44 px or larger as passing without probes, and skips visually hidden controls (the 1 px skip link)"

requirements-completed: [USER-01, USER-03]

coverage:
  - id: D1
    description: "Edit, Deactivate or Activate, Delete and the own-row Edit link answer a tap anywhere in a 44 px square, are still drawn 36 px and sit 8 px apart, at 390 and 1280 px"
    requirement: "USER-01"
    verification:
      - kind: e2e
        ref: "web/e2e/target-size.spec.ts#@target-size at 390 px / 1280 px each row action answers a tap anywhere in a 44 px square, is drawn 36 px and sits 8 px from the next (chromium)"
        status: pass
      - kind: e2e
        ref: "web/e2e/target-size.spec.ts#@target-size at 390 px / 1280 px the own row's Edit link answers a tap anywhere in a 44 px square and is drawn 36 px (chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The audit log row toggle answers a tap anywhere in a 44 px square at 390 and 1280 px"
    requirement: "USER-03"
    verification:
      - kind: e2e
        ref: "web/e2e/target-size.spec.ts#@target-size at 390 px / 1280 px the audit log row toggle answers a tap anywhere in a 44 px square and is drawn 36 px (chromium)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every visible button and link on /admin/users at 390 and 1280 px is a 44 px target or a listed O-8 exception, with no stale entry"
    requirement: "USER-01"
    verification:
      - kind: e2e
        ref: "web/e2e/target-size.spec.ts#@target-size on the Users page at 390 px and 1280 px every control is a 44 px target or a listed O-8 exception (chromium)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The look-equality proof expects the 8 px row-action spacing and the invisible tap areas (D-51, WR-20)"
    verification:
      - kind: unit
        ref: "web/visual/reference/rulings.test.ts#D-51 and #WR-20"
        status: pass
      - kind: other
        ref: "npm --prefix web run parity -- --grep \"@parity @(navigation|layouts-admin|lists)\" (122 passed, all five projects)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-19
---

# Phase 5 Plan 51: Row-action tap areas and the roster sweep Summary

**Row actions get an invisible 44 x 44 px tap area with 8 px between them (owner ruling D-51, "space"), the top bar user menu gets a 44 px tall one, and a roster sweep with an explicit O-8 exception list keeps any later small control from slipping in.**

## Performance

- **Duration:** about 45 min
- **Tasks:** 3 (Task 1 answered by the owner, Tasks 2 and 3 TDD)
- **Files:** 6 modified
- **Commits:** 4 (two RED tests, two fixes)

## Owner decision (Task 1)

The owner answered the checkpoint in chat on 2026-10-19: **"space"** (8 px between row buttons, full 44 x 44 px tap area each). It was already recorded as D-51 in `05-CONTEXT.md` (Gap-closure rulings); the executor confirmed it and did not rewrite it.

## Accomplishments

- `RowAction` composes `targetAreaClasses` on both its button and its link form. `rowActionsClasses` goes from `gap-0.5` to `gap-2` with a SPEC-DEVIATION comment citing D-51. The buttons are still drawn 36 px; only the space between them grew by 6 px.
- `rulings.css` gains a D-51 group (`.s-acts` gap, and the `.s-iconbtn` position and `::before` tap area), pinned by `rulings.test.ts`, so the look-equality proof expects the new spacing.
- `target-size.spec.ts`: row-action probes (centre and 21 px out on both axes hit the button, drawn 36 px, gaps exactly `[8, 8]`) at 390 and 1280 px; own-row Edit link and audit-log row toggle probes; and the roster sweep with `O8_EXCEPTIONS`.
- The sweep found one control that is neither 44 px nor an O-8 kind: the top bar user menu (68 x 40 at 390 px, 137 x 42 at 1280 px). It now composes `hitAreaClasses` with no visible change.
- `O8_EXCEPTIONS` holds one entry: the theme switch, a 36 px `.csp-iconbtn` kept by D-31 O-8.

## Task Commits

1. Task 2 RED: `3fd2e83` test(05-51): row actions miss the 44 px rule (RED, WR-20)
2. Task 2 GREEN: `4155711` fix(05-51): row actions get their 44 px tap area (WR-20, D-51)
3. Task 3 RED: `d533c4c` test(05-51): roster target-size sweep with the O-8 exception list
4. Task 3 GREEN: `2c12d5e` fix(05-51): the user menu gets a 44 px tap area; WR-20 tap areas join the look-equality rulings

## Verification

- `npm --prefix web run e2e -- --grep "@target-size|@users|@audit" --project chromium`: 34 passed.
- `npm --prefix web run test -- --run src/components/lists visual/reference/rulings.test.ts`: passed (rulings 54 tests).
- `npm --prefix web run verify`: exit 0 (lint, types, unit tests with coverage, class gate, bundle budgets, licence and notices gates).
- `npm --prefix web run parity -- --grep "@parity @(navigation|layouts-admin|lists)"`: 122 passed in chromium, firefox and webkit.
- RED runs: Task 2 failed at 390 and 1280 px (probe misses); Task 3 failed on the user menu only.
- Acceptance criteria: `grep -c AreaClasses cells.tsx` is 3; D-51 appears in `rulings.css` (3) and `lists.recipe.ts` (1); `O8_EXCEPTIONS` appears 5 times in the spec with a reason on every entry.
- No change to `web/package.json` or `web/package-lock.json`; no em or en dash added under `web/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 05-50's tap areas broke the navigation and layouts-admin parity cases**
- **Found during:** Task 3 (parity run after the user-menu change)
- **Issue:** 05-50 ran only e2e and `verify`, which do not run the parity proof. The parity compares `::before` boxes, so the sidebar toggle and the phone Open navigation button showed `position: relative` and an extra pseudo-element that the frozen reference lacks. 28 chromium cases failed (`@navigation`, `@layouts-admin`, `@layouts-admin-boundaries`).
- **Fix:** A WR-20 group in `rulings.css` (sidebar toggle, phone menu button, user menu), the same pattern as OQ-5, pinned in `rulings.test.ts`.
- **Files modified:** web/visual/reference/rulings.css, web/visual/reference/rulings.test.ts
- **Verification:** the three parity groups pass in all five projects.
- **Commit:** 2c12d5e

**2. [Rule 2 - Missing critical] The top bar user menu fell short of 44 px**
- **Found during:** Task 3 (the sweep)
- **Issue:** 40 and 42 px tall, not an O-8 kind.
- **Fix:** `hitAreaClasses` on the button (44 px tall, as wide as the button, nothing drawn changes).
- **Files modified:** web/src/components/navigation/UserMenu.tsx
- **Commit:** 2c12d5e

**3. [Rule 3 - Blocking] Sweep adjustments after the first run**
- **Found during:** Task 3
- **Issue:** the 44 x 44 pagination arrows failed the diagonal probes because they are rounded, and the 1 px skip link counted as a control.
- **Fix:** the sweep passes a control drawn 44 x 44 px or larger without probes, and skips a visually hidden one (under 2 px).
- **Commit:** d533c4c

**Total deviations:** 3 (1 bug, 1 missing critical, 1 blocking). **Impact:** the user menu is now a tap target; no drawn size changed other than the owner-ruled 8 px row-action spacing.

## Issues Encountered

- A garbled shell quoting attempt wrote a partial block into the spec file once; it was found and removed before any commit.
- Only chromium was run for the e2e specs, as the plan's verify commands specify; the phase gate still runs `@target-size` in all five projects.

## Known Stubs

None.

## Threat Flags

None. Pure CSS and markup. T-05-124 (a tap on Deactivate reaching Delete) is covered by the 8 px spacing, the probes and the drawn-box sweep; T-05-125 (an unapproved look change) by the owner ruling D-51 recorded in `rulings.css` and `rulings.test.ts`; T-05-SC by no dependency change.

## Next Phase Readiness

WR-20 is closed with 05-50. Gap 5 of 05-VERIFICATION.md can be re-verified.

## Self-Check: PASSED

- web/e2e/target-size.spec.ts, web/src/components/lists/cells.tsx, web/src/components/navigation/UserMenu.tsx, web/visual/reference/rulings.css: found
- Commits 3fd2e83, 4155711, d533c4c, 2c12d5e: found on the branch
- Acceptance criteria and both verify commands: pass
