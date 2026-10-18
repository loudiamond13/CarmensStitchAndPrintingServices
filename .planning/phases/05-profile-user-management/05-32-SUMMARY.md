---
phase: 05-profile-user-management
plan: 32
subsystem: ui
tags: [react, tailwind, responsive-table, select, date-input, sidebar, audit-log, tdd]
created: "2026-10-18T08:47:00-05:00"
updated: "2026-10-18T08:47:00-05:00"

requires:
  - phase: 05-profile-user-management
    provides: "05-20 and 05-25 (shell and nav pieces this plan extends); icon history from 05-03"
provides:
  - "ResponsiveTable detail / expandedKeys / onToggleRow (expandable rows, D-27)"
  - "SelectOption.group (native optgroup)"
  - "DateInput primitive (SPEC-GAP) in components/forms"
  - "AUDIT_NAV_ITEM, Sidebar withAuditLog, AdminFrame withAuditLog, AdminSection 'audit'"
affects: [05-33 audit log page]

actuals:
  tokens: 6556
  tasks: 3
  commits: 7
plan_head_before: 990ba4018e5ab8158d05b1f08ae90f0cd9cbc1a2
plan_head_after: 27a59ee3328298fbabc5c07ea051edd6c1ef4660

tech-stack:
  added: []
  patterns:
    - "Opt-in extension by prop so existing look-equality cases stay equal (no scenario passes detail or withAuditLog)"
    - "Row-group data-edge attribute drops the parent row rule when a detail row follows"

key-files:
  created:
    - web/src/components/forms/DateInput.tsx
    - web/src/components/forms/DateInput.test.tsx
    - web/src/modules/admin/sections.test.ts
  modified:
    - web/src/components/lists/ResponsiveTable.tsx
    - web/src/components/lists/ResponsiveTable.test.tsx
    - web/src/components/lists/lists.recipe.ts
    - web/src/components/lists/lists.recipe.node.test.ts
    - web/src/components/forms/Select.tsx
    - web/src/components/forms/Select.test.tsx
    - web/src/components/forms/index.ts
    - web/src/components/index.test.ts
    - web/src/components/navigation/Sidebar.tsx
    - web/src/components/navigation/Sidebar.test.tsx
    - web/src/components/navigation/index.ts
    - web/src/modules/admin/sections.ts
    - web/src/layouts/AdminLayout.tsx
    - web/src/layouts/AdminLayout.test.tsx

key-decisions:
  - "AdminFrame takes withAuditLog (default false) and only the real AdminShell sets it, because the dev parity scenarios render AdminFrame with the Manager DEV_USER and must stay equal to the frozen reference"
  - "DateInput takes the caller's message through error (zod owns range and format rules, OR-3); no built-in range message"
  - "The expanded row and its detail row use their own phone-card class sets (openRowClasses, detailRowClasses) so the existing rowCard strings are untouched"

requirements-completed: [AUDIT-02, USER-08]

duration: 20min
completed: 2026-10-18
status: complete
---

# Phase 05 Plan 32: Audit Log building blocks Summary

**Opt-in expandable detail rows in ResponsiveTable, grouped Select options, a native DateInput primitive and a Manager-only Audit Log sidebar and drawer item, all test-first and with existing look-equality cases untouched.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-18T13:26:06Z
- **Completed:** 2026-10-18T13:46:18Z
- **Tasks:** 3
- **Files modified:** 17 (3 new)

## Accomplishments

- ResponsiveTable renders a second `tr` after any row when `detail` is passed: `hidden` while collapsed, one `td` with `colSpan` of every column, `data-label="Details"`, 16px padding on `--surface-2`, no top divider. On phones the open row gives up its bottom corners, border and margin and the detail row is the lower half of the same card (D-27). Tables that pass no `detail` render the same markup as before.
- Select takes `group` on an option; consecutive options with the same group sit in one native `optgroup`; ungrouped options render as before.
- DateInput is a Field with a native `type="date"` (44px, 16px text), `min`, `max`, `onChange(value: 'YYYY-MM-DD')` and the caller's `error` under the field. Exported from the forms barrel and pinned in the components barrel test.
- The Sidebar gets `AUDIT_NAV_ITEM` (`audit`, Audit Log, `history`, `/admin/audit-log`, manager) behind `withAuditLog`, after Users, with the Manager tag hidden on the current row. `AdminSection` includes `audit`, `adminNavItemForPath` matches the path, and the real admin shell passes `withAuditLog` to both the side column and the drawer. The phone tab bar is unchanged and Admins never see the item.

## Task Commits

1. **Task 1: expandable table rows (tracer)** - RED `8ed3bce` (test), GREEN `7cc4028` (feat)
2. **Task 2: grouped Select and DateInput** - RED `b5ade4e` (test), GREEN `566aa70` (feat)
3. **Task 3: Audit Log navigation item** - RED `7440950` (test), GREEN `91edf96` (feat)
4. **Refactor:** `27a59ee` trims the forms barrel to one `DateInput` line (acceptance count)

**Plan metadata:** recorded in the docs commit that follows this file.

## TDD Gate Compliance

Each task has a `test(05-32)` commit before its `feat(05-32)` commit. One REFACTOR commit (`27a59ee`, barrel line count only, no behavior change).

RED evidence (Vitest, target assertions failing for the planned behavior, no load or syntax faults):
- Task 1: 3 of 6 new cases failed on assertions (`tbody tr` count 2 instead of 4; detail cell lacked `bg-surface-2`/`p-4`); the unchanged-markup and axe cases already passed by design.
- Task 2: 11 failed (DateInput not exported, Select produced no `optgroup`, barrel lacked `DateInput`).
- Task 3: 6 failed (`AUDIT_NAV_ITEM` undefined, no Audit Log link, path not matched, shell lacked the item).

`gsd_run check tdd-red-evidence` was not run; the semantic assessment above comes from reading the failing assertions in the Vitest output.

## Verification

- `npm --prefix web run verify` passed (typecheck, lint, format, coverage, build, budget build, license, notices): 176 test files, 5112 tests.
- Per-task Vitest runs for `src/components/lists`, `src/components/forms`, `src/components/index.test.ts`, `src/components/navigation`, `src/modules/admin`, `src/layouts` passed.
- Acceptance criteria: `grep -c expandedKeys ResponsiveTable.tsx` is 3 (at least 2); `grep -c optgroup Select.tsx` is 3; `grep -c DateInput forms/index.ts` is 1 (after the refactor commit); `grep -c "'/admin/audit-log'" Sidebar.tsx` is 1; `grep -c withAuditLog AdminLayout.tsx` is 5.
- `npm run parity` was not run: no sidebar or table scenario passes `withAuditLog` or `detail`, and `AdminFrame` defaults it to false, so no look-equality case changed.

## Decisions Made

See `key-decisions` above. The first (AdminFrame prop, shell sets it) is a refinement of the plan text, which said AdminFrame passes it to both Sidebars: doing that unconditionally would add a sixth item to the Manager dev scenarios that are compared with the frozen reference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Edge rule handling for open and last rows with a detail row**
- **Found during:** Task 1
- **Issue:** Adding a second `tr` after each row breaks the "no rule under the last row" cascade (D-38) and leaves a divider between an open row and its detail ("no top divider").
- **Fix:** Rows of a table with `detail` carry `data-edge="true"` when open or last; their cells use `group-data-[edge=true]/row:border-b-0` (`detailParentCellClasses`). The detail row is its own `group/row` so its cell drops its rule when it is last.
- **Files modified:** `ResponsiveTable.tsx`, `lists.recipe.ts`, `lists.recipe.node.test.ts`
- **Committed in:** `7cc4028`

**2. [Rule 3 - Blocking] Extra test files and one extra layout test**
- **Found during:** Task 3
- **Issue:** The plan's file list had no test for `adminNavItemForPath` and none for the shell wiring.
- **Fix:** Added `web/src/modules/admin/sections.test.ts` and a case in `AdminLayout.test.tsx` (sidebar, drawer, tab bar).
- **Committed in:** `7440950`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking). **Impact:** both inside the plan's intent; no scope creep.

## Issues Encountered

- The first full `verify` run failed once on `EditUserPanel.test.tsx` "shows Saving while the request runs" (a 1 s `findByRole` timeout under full-suite load). It passes alone and the second full run passed all 5112 tests. The panel does not use anything this plan changed; treated as load flakiness, not fixed (out of scope).
- `/admin/audit-log` has no route yet (plan 05-33), so the new nav item leads to the router's not-found page until then.

## Known Stubs

None.

## Threat Flags

None. T-05-90 (Audit Log nav shown to Admins) is mitigated by the existing `manager` flag filter with tests; the route guard and the API 403 stay the real controls.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05-33 (Audit Log page) can use `ResponsiveTable` detail rows, grouped Select options, `DateInput` and the nav item. It must add the `/admin/audit-log` route.

## Self-Check: PASSED

All created files exist and all seven plan commits are ancestors of HEAD (checked after writing).

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
