---
phase: 08-order-screens
plan: 08
subsystem: ui
tags: [react, tanstack-query, nuqs, tabs, msw, vitest, playwright, a11y, tdd, order-lists]
created: "2026-10-29T21:55:00-05:00"
updated: "2026-10-29T21:55:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-03/08-04: order list services, query hooks, ListEntrySelect, ORDER_LISTS_COPY"
  - phase: 06-expenses
    provides: "the Settings category card, CategoryModal, expense category service"
provides:
  - "Settings page with four tabs (Product Types, Payment Methods, Order Expense Categories, Company Expense Categories), tab in ?tab="
  - "ListSettingsSection: the Phase 6 category card driven by a ListSettingsConfig"
  - "CategoryModal with an optional list config (words, schema, calls); default is the company expense categories"
  - "orderListEntrySchema (OR-3), useSettingsTab, useListEntryQuery, useRefreshList, LIST_SETTINGS configs"
  - "Settings list words for the three lists in orderListsCopy.ts; tab labels in settingsCopy.ts"
affects: [08-order-form, 08-money-windows, 08-order-list-filter]

actuals:
  tokens: 60000
  tasks: 3
  commits: 6
plan_head_before: 008a269cb21000cc923dbfe080993e19c786a90d
plan_head_after: b35a01aa79b34dc9fd7a8a56bdc2d2fb13580dfa

tech-stack:
  added: []
  patterns:
    - "One card component driven by a config object (service, query hook, cache key, count rule, words, schema) instead of one component per list"
    - "Only the chosen tab's card is mounted, so each list is read when its tab opens"

key-files:
  created:
    - web/src/modules/admin/components/ListSettingsSection.tsx
    - web/src/modules/admin/components/ListSettingsSection.test.tsx
    - web/src/modules/admin/listSettingsConfigs.ts
    - web/src/modules/admin/orderListSchemas.ts
    - web/src/modules/admin/orderListSchemas.test.ts
    - web/src/modules/admin/hooks/useSettingsTab.ts
    - web/src/modules/admin/hooks/useSettingsTab.test.tsx
    - web/src/modules/admin/hooks/useListEntryQuery.ts
    - web/src/modules/admin/hooks/useRefreshList.ts
    - web/src/test/orderListFixtures.ts
  modified:
    - web/src/modules/admin/pages/SettingsPage.tsx
    - web/src/modules/admin/pages/SettingsPage.test.tsx
    - web/src/modules/admin/components/CategoryModal.tsx
    - web/src/modules/admin/components/CategoryModal.test.tsx
    - web/src/modules/admin/settingsCopy.ts
    - web/src/modules/admin/orderListsCopy.ts
    - web/src/modules/admin/routes.test.tsx
    - web/e2e/settings.spec.ts
    - web/e2e/expenses-sweep.spec.ts
    - docs/web/e2e.md
  deleted:
    - web/src/modules/admin/hooks/useExpenseCategoryQuery.ts

key-decisions:
  - "The list config lives in listSettingsConfigs.ts (not in the section file), so CategoryModal, the section and the entry hook share it without a cycle"
  - "useExpenseCategoryQuery was replaced by useListEntryQuery (same fresh-read rules) and deleted; nothing else used it"
  - "Only the active tab's card is mounted; the other three panels stay empty until chosen"
  - "The company card heading is now 'Company Expense Categories' (D-55 / UI-SPEC S1); its table caption and every other Phase 6 word are unchanged"
  - "Server refusal for a delete of a used entry is 422 {list}.in-use (as in docs/api/order-lists.md and Phase 6), not 409 as the plan text said"

patterns-established:
  - "ListSettingsWords: one type for the words of a Settings card; order lists are built by a small settingsWords() helper that reuses the shared Phase 6 words"

requirements-completed: [ORD-07]

duration: 72min
completed: 2026-10-29
status: complete

coverage:
  - id: D1
    description: "Settings shows four tabs in order (Product Types default); the active tab is in ?tab= and a tab change replaces the history entry; an unknown tab falls back to Product Types"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useSettingsTab.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/SettingsPage.test.tsx#S1 the four tabs (D-31, WEB-10; plan 08-08)"
        status: pass
      - kind: e2e
        ref: "web/e2e/settings.spec.ts#@settings-order-lists"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each order list is managed from its tab: add (Idempotency-Key), edit (row version, 409 banner), retire, use again, delete only when never used, with per-list words and badge colors"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ListSettingsSection.test.tsx#S1 list card"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/CategoryModal.test.tsx#S2 order list modal"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/orderListSchemas.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/settings.spec.ts#@settings-order-lists"
        status: pass
    human_judgment: false
  - id: D3
    description: "Order Expense Categories keeps Others: Edit (color only) and 'Always listed last'; the Company Expense Categories tab behaves as Phase 6 (every Phase 6 Settings test and @settings e2e pass)"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/CategoryModal.test.tsx#S2 order expense Others (plan 08-08)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/SettingsPage.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/settings.spec.ts#@settings"
        status: pass
    human_judgment: false
  - id: D4
    description: "Load failure shows 'Couldn't load {things}.' with Try Again; empty and Others-only lists keep the P6 pattern; the first load announces each list's loading name (UIC-18, UIC-41, UIC-72, UIC-73)"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ListSettingsSection.test.tsx#S1 list states"
        status: pass
    human_judgment: true
    rationale: "The first-column headings and the 'order expense categories' plural are SPEC-GAP wording the owner reviews"
---

# Phase 8 Plan 08: Settings tabs for the order lists Summary

**Settings becomes four list tabs: the Phase 6 category card is now a config-driven ListSettingsSection, so a Manager adds, renames, recolors, retires, reuses and deletes product types, payment methods and order expense categories, with the company expense categories tab unchanged.**

## Performance

- **Duration:** about 72 min
- **Started:** 2026-10-29T20:40:38-05:00
- **Completed:** 2026-10-29T21:52:00-05:00
- **Tasks:** 3
- **Files:** 22 changed (10 new source or test files, 1 deleted)

## Accomplishments

- `/admin/settings` shows `Tabs` in the order Product Types, Payment Methods, Order Expense Categories, Company Expense Categories. The tab is the `tab` URL parameter, Product Types is the default and stays out of the URL, and a change replaces the history entry.
- `ListSettingsSection` holds the whole Phase 6 card: name badge, Status, the count column ("Items", "Payments", "Expenses"), Edit, Retire or Use again, Delete only when nothing used the entry, the caption, focus handling and toasts. A `ListSettingsConfig` supplies the list's service, query hook, cache key, count rule, words and in-use code.
- `CategoryModal` takes an optional `config`. The three order lists use `orderListEntrySchema` (required message per list, 40 characters after trim, six tones) and the server's own words. The default config is the company expense categories, so all Phase 6 modal tests pass unchanged.
- Every write refreshes the list and the `['orders']` queries (the Orders filter shows entry names).
- Others in Order Expense Categories offers Edit (color only), keeps its name read-only and reads "Always listed last".

## Task Commits

1. **Task 1: Settings opens on Product Types and shows the real list (tracer)**
   - RED `0a4c86d5` (test)
   - GREEN `bbf594ff` (feat)
2. **Task 2: add, rename, recolor, retire, use again and delete for each order list**
   - RED `ccfd026a` (test)
   - GREEN `d4722cec` (feat)
3. **Task 3: Others, the company tab, empty and loading tabs, and the Settings journey**
   - tests `78bd3b30` (test; passed on first run, see TDD Gate Compliance)
   - e2e, route test, docs `b35a01aa` (test)

**Plan metadata:** the SUMMARY commit that follows this file (docs).

## TDD Gate Compliance

- **Task 1 RED:** the hook was a skeleton returning a constant and the page had no tabs. 21 tests failed on their own assertions (the tab was not read from the URL, no `tab` role existed, no "Product types" table, the card heading was not "Company Expense Categories"). The Phase 6 axe test on the company tab passed on the old page, as expected. Semantic assessment: valid RED, the planned behavior was missing.
- **Task 2 RED:** the schema was a skeleton that accepts anything and the modal ignored `config`. 8 schema tests, the modal add and edit tests for each list, and the add and edit flows of the list card failed on their assertions (wrong title, a POST to the wrong route, no required message). The retire, use again and delete tests passed at RED because Task 1's section already runs them from the config; they are regression guards.
- **Task 3:** the Others row, empty, loading and failure tests passed on first run, because the config design from Tasks 1 and 2 already covers them. There was no RED to see; the tests lock the behavior. The e2e work had no separate RED run: the Phase 6 `openSettings` expects the Expense categories table on the first tab, which the new default tab removes by construction.
- `gsd_run check tdd-red-evidence` was not run: the plan is `type: execute`, and the Vitest reporter here does not write the TAP report that classifier reads. Evidence is the Vitest output.

## Verification

- Targeted: `SettingsPage`, `useSettingsTab`, `ListSettingsSection`, `CategoryModal`, `orderListSchemas`, `routes.test.tsx`: all pass.
- Full web suite: `Test Files 215 passed (215)`, `Tests 6370 passed (6370)`.
- `npm --prefix web run lint` (max-warnings 0): exit 0, no output. `npm --prefix web run typecheck`: exit 0. `prettier --check src e2e`: clean after formatting the files.
- E2E (preflight clean first, run through `npm --prefix web run e2e`): `--grep @settings` first run `22 passed, 3 failed` (see below), second run `25 passed (2.0m)`; `--grep @expenses-sweep` `60 passed (14.2m)`.
- Acceptance greps: `ListSettingsSection` appears 3 times in `SettingsPage.tsx`; the tab tuple line is on one line in `useSettingsTab.ts` (kept with `prettier-ignore`); `is now used by an order item` appears once in `orderListsCopy.ts`; `@settings-order-lists` is in `settings.spec.ts`.
- gitleaks on every staged change: no leaks.
- Not run: coverage thresholds (web at least 90 percent).

## Decisions Made

- The config module is separate from the section file so no import cycle forms between the section, the modal and the entry hook.
- `useExpenseCategoryQuery` was replaced by `useListEntryQuery` and deleted (nothing else read it).
- Only the chosen tab's card is mounted, so the other lists are read when opened (and the Phase 6 tests need no extra handlers).
- Tests for a 41-character name sit at schema level only: the Name input has `maxlength` 40, so the browser cannot produce one. The modal test checks the attribute and the 40-character stop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extra files the plan did not list**
- **Found during:** Task 1 and 2
- **Issue:** The config, the entry detail hook, the refresh hook and a shared fixtures file were needed and are not in `files_modified`.
- **Fix:** Added `listSettingsConfigs.ts`, `hooks/useListEntryQuery.ts`, `hooks/useRefreshList.ts`, `web/src/test/orderListFixtures.ts`; deleted the now unused `hooks/useExpenseCategoryQuery.ts`.
- **Committed in:** `bbf594ff`, `d4722cec`

**2. [Rule 1 - Bug] Phase 6 tests that opened Settings without a tab**
- **Found during:** full-suite run after Task 3
- **Issue:** `routes.test.tsx` (Settings for Managers) opens `/admin/settings` and expects the Expense categories table. The memory router's query string does not reach nuqs there, so the test now clicks the Company Expense Categories tab and answers `GET /product-types`.
- **Files modified:** `web/src/modules/admin/routes.test.tsx`
- **Committed in:** `b35a01aa`

**3. [Rule 3 - Blocking] Other e2e files that open Settings**
- `expenses-sweep.spec.ts` opened `/admin/settings` and pressed "Add Category"; it now opens `?tab=expense-categories`. `docs/web/e2e.md` lists the new tag.
- **Committed in:** `b35a01aa`

**Phase 6 tests changed (as the plan allows):** `SettingsPage.test.tsx` now renders inside a nuqs test adapter on `?tab=expense-categories`, and its two card-heading checks read "Company Expense Categories" (D-55). `e2e/settings.spec.ts` chooses the Company Expense Categories tab first (`openSettings`, `COMPANY_TAB`) and reads the new heading. No Phase 6 test was weakened.

**Plan wording not followed:** the plan says a delete of a used entry answers 409; the server (and Phase 6) answer 422 `{list}.in-use`, which the code and tests use.

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking) plus 1 wording correction.
**Impact on plan:** No scope creep.

## Issues Encountered

- First `@settings` e2e run: 3 failures. Two were my new test asserting a table header, which phones hide (cards on phones); it now reads the `td[data-label]` cell. The third was the Phase 6 delete test on chromium (focus ended on the card heading). Re-run alone on one worker with 4 repeats: 4 of 4 passed; a second full run: 25 of 25. The cause is a shared-database race (the next row can be another project's test row, deleted at the same time; the designed fallback is the heading). Recorded as a flake in `deferred-items.md`, not hidden.
- A bash heredoc with apostrophes in it failed to parse; files with apostrophes were written with the Write tool.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or auth path; T-08-14 (the Manager loader on `/admin/settings` is unchanged) and T-08-15 (row version on edit, Idempotency-Key on add, retire and reactivate, zod mirrors the 40-character rule) are covered by the tests above. No package was added or changed (T-08-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The order form and money windows can rely on the three lists being managed from Settings.
- The owner should review the SPEC-GAP wording in `orderListsCopy.ts` (first-column headings, the "order expense categories" plural).

## Self-Check: PASSED

- All files in key-files (created, modified) exist on disk; `useExpenseCategoryQuery.ts` is gone.
- Commits `0a4c86d5`, `bbf594ff`, `ccfd026a`, `d4722cec`, `78bd3b30` and `b35a01aa` are ancestors of HEAD.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*
