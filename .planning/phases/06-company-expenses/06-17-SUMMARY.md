---
phase: 06-company-expenses
plan: 17
subsystem: web
tags: [react, tanstack-query, msw, playwright, a11y, settings, categories, confirm-dialog, or-3, or-4]
created: "2026-10-25T17:32:00-05:00"
updated: "2026-10-25T17:32:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: The seven expense category routes with the Manager policy, expenseCount in the list and the detail route (plan 06-13); useExpenseAction, useRefreshExpenses, useRowFocus, requireManagerLoader, CategoryBadge, the five icons and the ConfirmDialog patterns (plans 06-07, 06-16)
provides:
  - SETTINGS_NAV_ITEM: a Manager-only Settings item after the Audit Log in the sidebar and the phone drawer (not the tab bar); 'settings' in AdminSection; adminNavItemForPath maps /admin/settings
  - The lazy /admin/settings route behind requireManager (an Admin is sent to /admin) and the Settings page with the Expense Categories card
  - CategoryModal (add and edit) with the live-preview color radios, RecordMeta, ConflictBanner and the Others rule; categorySchemas.ts (OR-3)
  - expenseCategoriesService create, get, update, retire, reactivate and remove; useExpenseCategoryQuery; useRefreshCategories
  - Retire, Use again and Delete row actions and the Delete Category confirmation with the in-use refusal
  - The @settings e2e in all five projects
affects: [06-18, 06-19]

actuals:
  tokens: 32068
  tasks: 3
  commits: 6
plan_head_before: 03797f31ee8c7aa65a9e71c3a5cf10a157f76dc8
plan_head_after: eb5ba785801521ef493f438f49422678b043b978

tech-stack:
  added: []
  patterns:
    - "A row action that flips (Retire / Use again) is one keyed RowAction whose icon, label and handler change, so the same button element keeps focus; the cache is flipped at once and the lists then read again"
    - "Every category change refreshes through one hook, useRefreshCategories (category list plus the expense lists, KPIs and deleted list), so a page cannot forget one"
    - "useExpenseAction (built for expenses) is reused as-is for category actions: it only needs an id"
    - "The category detail is read fresh on every open under its own query root ('expense-category'), so a list refresh never replaces the version an open form holds"
    - "A server refusal that needs special words in a ConfirmDialog goes through describeFailure, so the dialog keeps its alert line and focus rules"

key-files:
  created:
    - web/src/modules/admin/pages/SettingsPage.tsx
    - web/src/modules/admin/pages/SettingsPage.test.tsx
    - web/src/modules/admin/components/CategoryModal.tsx
    - web/src/modules/admin/components/CategoryModal.test.tsx
    - web/src/modules/admin/components/settings.recipe.ts
    - web/src/modules/admin/categorySchemas.ts
    - web/src/modules/admin/categorySchemas.test.ts
    - web/src/modules/admin/settingsCopy.ts
    - web/src/modules/admin/hooks/useExpenseCategoryQuery.ts
    - web/src/modules/admin/hooks/useRefreshCategories.ts
    - web/e2e/settings.spec.ts
  modified:
    - web/src/components/navigation/Sidebar.tsx
    - web/src/components/navigation/Sidebar.test.tsx
    - web/src/components/navigation/MobileNavDrawer.test.tsx
    - web/src/components/navigation/index.ts
    - web/src/components/index.test.ts
    - web/src/modules/admin/sections.ts
    - web/src/modules/admin/sections.test.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/modules/admin/services/expenseCategoriesService.ts
    - web/src/modules/admin/services/expenseCategoriesService.test.ts
    - web/src/layouts/AdminLayout.test.tsx
    - web/src/test/expenseFixtures.ts
    - docs/web/e2e.md

key-decisions:
  - "Retire and Use again flip the status in the cached list at once and then read the lists again; if the refresh leaves focus on the page body, the flipped action takes it back."
  - "Delete is offered when expenseCount is 0 and the row is not Others; the server stays the authority (422 expense-categories.in-use keeps the dialog open with the contract refusal line and refetches, so Delete disappears)."
  - "A 404 on Delete (someone else removed it first) keeps the dialog open with the shared mapper line and refreshes the list. The contract has no wording for it, so none was invented (owner item below)."
  - "Others' read-only Name is still sent on save (the server treats its own name as a no-op), and focus opens on the saved color radio by its value, not by the checked state, so a late form reset cannot leave focus on the wrong radio."
  - "The category zod schema trims the name and checks the tone with the CategoryTone guard; maxLength 40 stops typing, the schema still guards a paste."

patterns-established:
  - "Settings cards reuse the My Profile card recipe (profile.recipe.ts) and add only what it lacks in settings.recipe.ts"
  - "E2E: on a phone the drawer's sidebar is still closing after a link press, so a current-item check takes the first match"

requirements-completed: [CEXP-02]

coverage:
  - id: D1
    description: "A Manager opens a new Manager-only Settings item (after the Audit Log, in the sidebar and the phone drawer, not the tab bar) and sees every expense category in the server's order with its badge, Active or Retired status and expense count, Others last with 'Always listed last', retired rows dimmed; an Admin has no item and is sent to /admin (D-14, D-15, OQ-3)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/SettingsPage.test.tsx (S1 the page, S1 the list states); Sidebar.test.tsx (Sidebar Settings item); MobileNavDrawer.test.tsx; routes.test.tsx (Settings for Managers, Manager-only routes); sections.test.ts; AdminLayout.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/settings.spec.ts @settings (Manager journey, Admin check; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Manager adds a category or renames and recolors one in a modal with six named colors and a live badge preview of the typed name; every rule is checked in the browser first; a duplicate name shows under Name; a stale save keeps the typed values and offers Load Latest; Others keeps a read-only name and focus opens on its color (D-08, D-12, D-13, OQ-6, SEC-07, OR-3)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/CategoryModal.test.tsx; categorySchemas.test.ts; expenseCategoriesService.test.ts; SettingsPage.test.tsx (S1 add, rename and recolor)"
        status: pass
      - kind: e2e
        ref: "web/e2e/settings.spec.ts @settings (add in Blue, duplicate refused, rename and recolor, Others read-only name; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Retire and Use again act at once with no confirmation, flip the status and keep focus on the flipped action; a failure is a danger toast that stays; a category with no expense can be deleted behind a confirmation and a used category and Others offer no Delete; the Add Expense picker hides a retired category and the list filter shows it as retired (D-10, D-11, D-30, OQ-4, OQ-5)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/SettingsPage.test.tsx (S1 retire, use again and delete); expenseCategoriesService.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/settings.spec.ts @settings (retire, picker and filter, use again, delete a never-used one, used category and Others have no Delete; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every category change reads the category list, the expense list, the KPIs and the deleted list again, so a rename or recolor shows everywhere at once (D-12)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/SettingsPage.test.tsx (expectRefreshed after add, edit, retire and delete)"
        status: pass
    human_judgment: false
  - id: D5
    description: "If an expense started using a category meanwhile, the server refuses the delete and the dialog stays open with '{name} is now used by an expense, so it can't be deleted.' / 'Retire it instead...' while the list reads again and Delete disappears"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/SettingsPage.test.tsx (keeps the dialog open on 422 in-use ...)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The page, the Add Category dialog and the Delete confirmation fit a 320 px phone with no sideways scroll and the buttons in view; the look of the Settings page, the color radios with their previews and the dimmed retired rows in both themes"
    verification:
      - kind: e2e
        ref: "web/e2e/settings.spec.ts @settings (the page and its dialogs fit a 320 px phone; 5 of 5 projects)"
        status: pass
    human_judgment: true
    rationale: "The visual look of S1 and S2 is part of the owner's UI-SPEC Visual Review (plan 06-19); the e2e proves fit and accessibility only"

duration: 41min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 17: Settings and the Expense Categories Summary

**Managers get a Settings page (a new Manager-only sidebar and drawer item) where they add, rename, recolor, retire, bring back and delete expense categories, with a live color preview, stale-save protection and every expense list refreshed at once; Admins never see it.**

## Performance

- **Duration:** about 41 min
- **Started:** 2026-10-25T21:49Z
- **Completed:** 2026-10-25T22:30Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD), each a RED and GREEN commit pair
- **Files changed:** 25 (11 created)

## Accomplishments

- **Settings (tracer, D-14, D-15, OQ-3):** `SETTINGS_NAV_ITEM` ('Settings', `settings` icon, Manager tag hidden on the current row) follows the Audit Log under the real-shell flag, so the parity scenarios stay equal and the tab bar is untouched. `/admin/settings` is a lazy chunk behind `requireManager`; the page has the `Manager only` badge, the subline, the `Expense Categories` card and a table of every category in the server's order: the badge, `Active` / `Retired` with a dot, the server's count (`0` for none) and the actions; Others carries `Always listed last`; retired rows use the inactive look; loading is `Loading categories…` and a failure is `Couldn't load categories.` with Try Again.
- **Category modal (D-08, D-12, D-13, OQ-6, SEC-07):** `Add Category` and `Edit {name}` open a centered modal with Name (max 40) and the `Badge color` group of six native radios named Taupe, Orange, Blue, Plum, Amber and Green, each described by a live `CategoryBadge` of the typed name (or `Sample`). Add preselects Taupe and starts empty on every open; Edit reads the category fresh, preselects the saved tone and shows RecordMeta (`System` for a seeded one). Rules are checked in the browser first (OR-3); a duplicate name shows under Name; a 409 keeps the typed values and shows the ConflictBanner, and Load Latest replaces the values and the version and focuses Name. For Others the Name is `readOnly` with its hint and focus opens on the saved color. Only the edit save sends the row version.
- **Retire, Use again, Delete (D-10, D-11, D-30, OQ-4, OQ-5):** Retire (`archive`) and Use again (`archive-restore`) act at once: the status and the action flip, focus stays on the flipped action, the toast states the effect and a failure is a persistent danger toast with the mapper line (a retry keeps its key). Delete (`trash-2`) shows only for a non-Others category whose count is 0, behind the plain ConfirmDialog (Cancel focused); success removes the row, moves focus to the next row's Edit (else the previous, else the card heading) and toasts; a 422 in-use keeps the dialog open with the contract refusal line and the list reads again so Delete disappears.
- **Freshness (D-12):** every category change reads the category list, the expense list, the KPIs and the deleted list again through `useRefreshCategories`.
- **E2E:** `@settings` (4 tests x 5 projects): the Manager journey (open from the sidebar or drawer, add in Blue, duplicate refused, rename and recolor, retire, the Add Expense picker hides it and the list filter shows `{name} (retired)`, use again, delete a never-used one), a used category and Others have no Delete, an Admin has no item and is sent away, and the page and the Add Category dialog fit 320 px; axe at each step.

## Task Commits

1. **Task 1: Tracer, a Manager opens Settings and sees every category (D-14, D-15, OQ-3)**
   - RED `67bdb62` (test)
   - GREEN `6748ab3` (feat)
2. **Task 2: Add, rename and recolor with a live preview and conflict protection (D-08, D-12, D-13, OQ-6, SEC-07)**
   - RED `9b0359b` (test)
   - GREEN `4657e6c` (feat)
3. **Task 3: Retire, bring back or delete a never-used category, proved end to end (D-10, D-11, D-30, OQ-4, OQ-5)**
   - RED `4eb0710` (test)
   - GREEN `eb5ba78` (feat)

**Plan metadata:** the `docs(06-17)` commits that follow this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks; no REFACTOR commits. The `gsd_run check tdd-red-evidence` classifier reads JUnit from the MTP runner and does not apply to Vitest or Playwright, so the evidence is the quoted run with the semantic assessment, as in plans 06-12, 06-14 and 06-16.

- **Task 1 RED:** `Test Files 6 failed`, `Tests 11 failed | 161 passed (172)`: the new page test file failed to load because `SettingsPage` did not exist; the rest failed on the missing behavior (`expected undefined to deeply equal { id: 'settings', ... }`, `Unable to find an accessible element with the role "link" and name /^Settings/`, `expected '/admin/settings' to be '/admin/sessions'`). Semantic assessment: every failure names the planned missing behavior; none is a syntax or fixture fault.
- **Task 2 RED:** the schema and modal test files failed to load (their modules did not exist); the service run gave `3 failed` of 5 (`service.create is not a function` and the same for get and update); the page run gave `5 failed` of 18 (no Edit buttons, no Add Category dialog). Semantic assessment: all planned.
- **Task 3 RED:** service `3 failed` of 8 (retire, reactivate, remove not functions); page `18 failed` of 37 (`expected [ 'Edit Rent' ] to deeply equal [ 'Edit Rent', 'Retire Rent' ]`, missing Retire, Use again and Delete buttons). The `@settings` e2e was written in this RED commit and run after GREEN, as in plans 06-12, 06-14 and 06-16.

## Verification evidence

- Task 1 verify (also the tracer gate re-run, `Tracer verified end-to-end - expanding`): `Test Files  6 passed (6)` / `Tests  185 passed (185)`.
- Task 2 verify set plus `src/test`: `Test Files  13 passed (13)` / `Tests  240 passed (240)`.
- Task 3 verify set: `Test Files  2 passed (2)` / `Tests  45 passed (45)`.
- E2E `--grep @settings`: first run `15 passed`, `5 failed` (the Manager journey; see Deviations 2); second run `19 passed`, `1 failed` (pixel; Deviations 3); final run `20 passed (1.8m)` across chromium, firefox, webkit, pixel and iphone.
- Plan verification `npm --prefix web run verify`: first run stopped at `test:coverage` with `1 failed | 5896 passed` (Deviations 1); after the fix it exited 0: typecheck (three programs), `eslint . --max-warnings 0`, `prettier --check .`, `Test Files  201 passed (201)` / `Tests  5897 passed (5897)`, `Statements   : 95.79%`, `Branches     : 90.82%`, bundle budgets `public JS 123.04 KB (150), admin JS 206.40 KB (250), CSS 14.77 KB (35)` all ok (Settings is the lazy `SettingsPage` chunk, 6.78 KB gz), `License gate passed.` and `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- Acceptance: `SETTINGS_NAV_ITEM` in Sidebar.tsx 2; `path: 'settings'` in routes.tsx 1; `SPEC-GAP: S1` in SettingsPage.tsx 1; `jitless: true` in categorySchemas.ts 1; `CATEGORY_TONE_LABEL` in CategoryModal.tsx 2; the Others hint in settingsCopy.ts 1; the in-use line in settingsCopy.ts 1; `@settings` in docs/web/e2e.md 1.
- Shared machine: the preflight showed ports 5180, 5115, 7028 and 5199 free and no other project's test process before every e2e and verify run; only CSPS_E2E was used; no BetsLLC database or port was touched; no background shell was left running.

## Decisions Made

- See key-decisions. The contract defaults for OQ-3, OQ-4, OQ-5, OQ-6 and OQ-10 were built as written while the owner is away.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Admin layout test still listed the old sidebar**
- **Found during:** Task 3 (first `verify` run)
- **Issue:** `AdminLayout.test.tsx` ("gives the Manager an Audit Log item after Users ...") asserted the Manager's sidebar as Dashboard ... Audit Log, My Profile. It is not in the plan's file list, but the new Settings item belongs in that list.
- **Fix:** the test now expects `Settings` after `Audit Log`, its href, and the item in the drawer; the tab-bar assertion is unchanged.
- **Files modified:** web/src/layouts/AdminLayout.test.tsx
- **Verification:** `Tests  61 passed (61)`, then the whole `verify` passed.
- **Committed in:** eb5ba78

**2. [Rule 1 - Bug] The @settings e2e did not expect the duplicate-name 400**
- **Found during:** Task 3 (first e2e run, 5 of 20 failed)
- **Issue:** the shared guard fails a test on an unexpected failed response; the duplicate-name check deliberately makes the API answer 400.
- **Fix:** `guard.expectStatus('/api/v1/expense-categories', 400)` before the request.
- **Files modified:** web/e2e/settings.spec.ts
- **Committed in:** eb5ba78

**3. [Rule 1 - Bug] A current-item check matched two sidebars on a phone**
- **Found during:** Task 3 (second e2e run, 1 of 20 failed on pixel)
- **Issue:** after a link press in the drawer, the drawer's own sidebar is still closing, so `aside nav a[aria-current=page]` matched two elements (strict mode).
- **Fix:** the check takes the first match.
- **Files modified:** web/e2e/settings.spec.ts
- **Committed in:** eb5ba78

### Plan wording notes

- Files not in the plan's list were added because the work needed them: `settings.recipe.ts` (the four classes the My Profile card recipe lacks), `useRefreshCategories.ts` (the one refresh path for a category change) and `web/src/layouts/AdminLayout.test.tsx` (Deviation 1). The Settings card, head and body reuse `profile.recipe.ts`.
- `expenseFixtures.ts` gained `categoryDetail`, the create, detail, update, retire, reactivate and delete backends, and now exports `categoryItem`.

---

**Total deviations:** 3 auto-fixed (3 bugs in tests), 0 checkpoints.
**Impact on plan:** No scope change; all three were test-side.

## Issues Encountered

- A first multi-file shell heredoc failed to parse (an apostrophe inside a Python string) before writing anything; the files were written with the Write tool instead and nothing was left half applied.
- `docs/web/e2e.md` has CRLF line endings and a table that Prettier would re-align (123 changed lines); the one new row was inserted without running Prettier on it.

## Known Stubs

None. Every control is wired to the server calls (`create`, `update`, `retire`, `reactivate`, `remove`).

## Threat Flags

None. T-06-54 (an Admin reaching Settings) is mitigated three ways and tested: the item is not rendered for an Admin, the route loader sends an Admin to /admin, and the server's Manager policy answers 403 on every write. T-06-55 (stale category save) is mitigated: the edit save sends the row version it opened with, and a 409 keeps the typed values behind the ConflictBanner. T-06-56 (stored XSS through a category name) is mitigated: names reach the screen only as React text nodes in badges, previews and toasts. T-06-SC: no package was installed.

## User Setup Required

None.

## Owner items

- New SPEC-GAP copy to review before release (05 D-48, already in the backlog): the Settings page (`Settings`, `Manager only`, `Lists and options the whole team uses.`, the card title, hint and `Add Category`, the column and status words, `Always listed last`, the caption), the row action names, the Category modal wording (titles, descriptions, `Name`, the Others hint, `Badge color`, the six color words, `Sample`), the toasts (`Category added`, `Category updated`, `Category retired`, `Category back in use`, `Category deleted` and the failure titles) and the Delete Category dialog and in-use refusal. All come from the UI-SPEC Copywriting Contract.
- Two small wordings are not in the contract and come from existing patterns: the Edit modal's load failure reads `Couldn't load this category.` (from the shared ErrorState and the `this expense` precedent), and its loading region announces `Loading category…`. A delete that meets a category someone else already removed (404) shows the shared mapper line in the dialog and refreshes the list; the contract names no wording for it.
- OQ-3, OQ-4, OQ-5, OQ-6 and OQ-10 were built with their contract defaults while the owner is away; the formal rulings are still pending and no behavior was decided here.
- Worth a look in the visual review (plan 06-19): the S1 card on a 320 px phone (Add Category under the hint at full width), the six color rows with their previews in both themes, the dimmed retired rows, and the Others row.

## Next Phase Readiness

- Plan 06-18 and later can reuse `useRefreshCategories`, `CategoryModal` and the Settings card recipe; Phase 11 can add more cards below the Expense Categories card.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the six task commits (`67bdb62`, `6748ab3`, `9b0359b`, `4657e6c`, `4eb0710`, `eb5ba78`) are ancestors of HEAD; `npm --prefix web run verify` exited 0 on the final tree; `@settings` passed 20 of 20.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
