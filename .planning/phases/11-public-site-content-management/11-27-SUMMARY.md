---
phase: 11-public-site-content-management
plan: 27
subsystem: orders-public-website-ui
tags: [orders, consent, gallery, privacy, react, zod, react-hook-form, playwright, a11y]
created: 2026-11-12T17:10:00-06:00
updated: 2026-11-12T17:30:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-23 PUT /api/v1/orders/{id}/public, the publicWebsite block in every order detail and GET /api/v1/product-lines/options"
provides:
  - "The Public website card in the order page side column, after Customer, for Admin and Manager"
  - "The Public Website window: the customer's OK, Show on the website, Show under, Name shown, the Visitors see preview"
  - "PublicWebsiteFields, shared with the order form card of plan 11-35"
  - "publicWebsiteSchema (OR-3 mirror of OrderPublicSettings), publicWebsiteService, useSavePublicWebsite, useProductLineOptionsQuery"
  - "Checkbox gains ariaDisabled (focusable, unchanged by a click)"
  - "e2e spec @order-public-website (five tests, five projects)"
affects: [11-35, 11-26, 11-37]

actuals:
  tokens: 22368
  tasks: 3
  commits: 7

# commits is the measured git rev-list count from plan_head_before to plan_head_after (the seven work commits; the SUMMARY commit follows).
# tokens is chars/4 over the added lines of the realized diff (89,474 chars), the same scale as the estimate.
plan_head_before: 2930cf3e060ed8baa463e99c3884015c53ea7317
plan_head_after: e000d9c52aaf49c9f29c04006ebf66a8bdd47e31

tech-stack:
  added: []
  patterns:
    - "A window over useOrderChildSave with quiet: true and its own toast, because what a save did to the website matters more than the balance"
    - "Safari does not focus a button on a click: the card names its Edit button for the focus return, and the e2e opens windows with press()"
    - "Test modules the RED commit needs are inert stubs, so each test fails on its assertion and not on an import"

key-files:
  created:
    - web/src/modules/admin/publicWebsiteCopy.ts
    - web/src/modules/admin/publicWebsiteSchemas.ts
    - web/src/modules/admin/publicWebsiteSchemas.test.ts
    - web/src/modules/admin/services/publicWebsiteService.ts
    - web/src/modules/admin/services/publicWebsiteService.test.ts
    - web/src/modules/admin/hooks/usePublicWebsite.ts
    - web/src/modules/admin/hooks/usePublicWebsite.test.tsx
    - web/src/modules/admin/components/PublicWebsiteCard.tsx
    - web/src/modules/admin/components/PublicWebsiteCard.test.tsx
    - web/src/modules/admin/components/PublicWebsiteModal.tsx
    - web/src/modules/admin/components/PublicWebsiteModal.test.tsx
    - web/src/modules/admin/components/PublicWebsiteFields.tsx
    - web/e2e/order-public-website.spec.ts
  modified:
    - web/src/modules/admin/pages/OrderPage.tsx
    - web/src/modules/admin/pages/OrderPage.test.tsx
    - web/src/modules/admin/pages/DeletedOrderPage.test.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/orderWindowsCopy.ts
    - web/src/components/entry/Checkbox.tsx
    - web/src/components/entry/entry.recipe.ts
    - web/src/components/entry/entry.test.tsx
    - web/src/test/orderFixtures.ts
    - docs/web/e2e.md

key-decisions:
  - "Name shown is required only when the order is shown and has no team: this mirrors 11-23 as built (parked P11-BL-30); the form and zod follow the server"
  - "The window closes through the card, which owns the Edit button and names it for the focus return"
  - "A Cancelled order is told by the server's canShow flag: no Edit, a note, and the rows read Not shown"
  - "The line options are read again every time the window opens, and an order's current line is listed even when it was hidden after the order chose it"
  - "The gallery check of the e2e reads GET /api/v1/public/gallery under the site content lock and is noted as pending while that read does not exist (plan 11-26)"

patterns-established:
  - "PublicWebsiteFields takes the react-hook-form object, the order (or null on a new order), the line options and showPreview, so plan 11-35 reuses it on the order form"
  - "publicWebsiteSchema(hasTeam) keeps the server's order of checks: name length, then the OK, the line and the name when the order is shown"

requirements-completed: [GAL-03, CONT-03]

coverage:
  - id: D1
    description: "The Public website card sits after Customer and before Status history for Admin and Manager, with the four rows, the Shown badge since its date, and the empty value for a missing line or name"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteCard.test.tsx#a never-shown order, #a shown order"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the Public website card sits after the Customer card and before the Status history card"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@an Admin ticks the customer OK (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Show on the website cannot be ticked or sent while the customer's OK is unticked (D-11): aria-disabled with its hint, unticking the OK unticks Show, the schema refuses it, and the server refuses it too"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteModal.test.tsx#keeps Show on the website aria-disabled ... until the OK is ticked, #unticks Show on the website when the OK is unticked"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/publicWebsiteSchemas.test.ts#refuses Show on the website while the customer OK is unticked"
        status: pass
      - kind: unit
        ref: "web/src/components/entry/entry.test.tsx#keeps an aria-disabled box focusable and unchanged by a click or Space"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every rule in the server's words: line needed to show, name at most 80, name needed when no team; server field errors land on their fields; the Visitors see preview uses the server's pieces"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/publicWebsiteSchemas.test.ts (the line, the name shown)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteModal.test.tsx#the rules, in the server words, #the line to show under, #the preview"
        status: pass
    human_judgment: false
  - id: D4
    description: "Save sends PUT /orders/{id}/public with the order version, sets the order from the answer, closes the window, returns focus to Edit and shows the right toast (shown, taken off, or saved)"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteModal.test.tsx#saving, #the toasts of a save"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/usePublicWebsite.test.tsx#useSavePublicWebsite"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@an Admin ticks the customer OK, @a Manager takes a shown order off the website (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A 409 shows the conflict banner with the choices kept; a changed window asks Discard changes? before it closes"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteModal.test.tsx#a stale save and a window that was changed"
        status: pass
    human_judgment: false
  - id: D6
    description: "A Cancelled order reads Not shown with its note and no Edit; a Completed order can still be edited; a shown order with no photo says so; a deleted order has no card"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteCard.test.tsx, web/src/modules/admin/pages/DeletedOrderPage.test.tsx#draws no Public website card"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@a Cancelled order says it cannot be shown (5 projects)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The card and window fit every width and pass axe in every state: a bottom sheet at 320px with a footer that fits and no sideways scroll, the card across the side grid at 820px"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#has no axe violations on the page with the card never shown / shown with no photo / on a Cancelled order"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@at 320px, @at 820px (5 projects)"
        status: pass
    human_judgment: false
  - id: D8
    description: "After the save the order is in the public gallery data, and after taking it off it is gone while its photos stay on the order"
    requirement: CONT-03
    verification:
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts (the GET /api/v1/public/gallery check inside the first two tests)"
        status: unknown
    human_judgment: true
    rationale: "GET /api/v1/public/gallery is built by plan 11-26, which is not in this branch yet, so the spec notes that check as pending. It starts asserting by itself once 11-26 is merged: run npm --prefix web run e2e -- --grep @order-public-website after the merge. The photo staying on the order is asserted and passes."

duration: 73min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 27: Staff tick the customer's OK and show an order on the website from the order page Summary

**The order page has a Public website card and a Public Website window for Admin and Manager: tick the customer's OK, show the order under a line with a name, take it off again. Show waits for the OK in the browser (aria-disabled, hint, schema) as well as on the server, every rule uses the server's words, and the Visitors see preview uses the server's pieces. One check is still open: the public gallery read that proves the order appears there is plan 11-26's, so that assertion is pending.**

## Performance

- **Duration:** about 73 min (2026-11-12T22:17Z to about 23:30Z), much of it waiting for builds and test runs on a machine busy with other sessions
- **Tasks:** 3 of 3
- **Files:** 23 changed (13 new, 10 modified), 2,123 lines added

## Accomplishments

- `PublicWebsiteCard`: four rows (Customer OK, On the website, Shown under, Name shown), Edit named "Edit public website settings", the Cancelled note with no Edit, the no-photo line, and the Completed case. It spans both columns of the tablet side grid.
- `PublicWebsiteModal` over `OrderWindow`: the order version, the 409 banner, Discard changes?, server field errors on their fields, Load Latest.
- `PublicWebsiteFields`: the two ticks (Show is `aria-disabled` and focusable until the OK is ticked, with its hint as its description), `Show under` (preset to the server's auto line, and an order's current line even if it was hidden later), `Name shown` (placeholder the team), and the labelled `Visitors see: BRGY. SAN ROQUE BALLERS · Basketball · 17 pcs` preview.
- `publicWebsiteSchema(hasTeam)`: the OK, the line, the 80 characters and the name of an order with no team, in the server's words and order.
- Toasts: shown, taken off ("Its photos stay on the order.") and saved.
- `Checkbox` accepts `ariaDisabled`.
- The e2e spec `@order-public-website`: five tests in all five projects.

## Task Commits

1. **Task 1 (tracer): the OK and Show from the order page**
   - RED `bee1ba83` (test)
   - GREEN `5c5e4a08` (feat)
2. **Task 2: every rule, the cancelled and completed cases, taking an order off**
   - RED `3fd0a7af` (test)
   - GREEN `c7c46317` (feat)
   - REFACTOR `1f8ac7f4` (comments only)
3. **Task 3: every width and every state**
   - `d1e18975` (test): the tests passed on their first run and no code change was needed, so there is no feat commit (see TDD Gate Compliance)
4. **Fix found by the full web run:** `e000d9c5` (fix): the dimmed look of an aria-disabled checkbox used `opacity-60`, which the class gate refuses; it now uses `aria-disabled:opacity-45`

**Plan metadata:** the SUMMARY commit follows this file.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` takes a TAP, JUnit, swift-testing or unittest report. Vitest here writes its own JUnit file (`web/.vitest/junit/output.xml`) but the run was not fed to the classifier, and Playwright's list report is not one of the supported formats, so the classifier was not run. Each RED was inspected by hand against the real output (kept in the session scratchpad).

- **Task 1 RED** (19 of 103 tests in the six files failed). The modules the tests import were inert stubs, so every failure was on its own assertion: the schema returned no error for Show without the OK, the service returned `[]` for the options and rejected the save, the card and window rendered nothing (`Unable to find an accessible element with the role "region" and name "Public website"`, `Unable to find role="dialog"`), the order page lacked the card (`['Customer', 'Status history']` for `['Customer', 'Public website', 'Status history']`). One failure is the stub's own throw: `useSavePublicWebsite` threw `not built`. The e2e RED (chromium) failed at `getByRole('region', { name: 'Public website' })` after sign-in, the order and a drawn photo had worked.
- **Task 1 extra RED:** the `Checkbox` `ariaDisabled` test failed against the old `Checkbox` (checked by putting the old file back, then re-applying the change).
- **Task 2 RED** (14 of 77 failed): the schema gave no line, name-length or name-required error; the card showed Edit on a Cancelled order and had no no-photo line; the window had no preview, no taken-off toast and said "Order shown on the website" for a details-only change; the no-team order was not marked invalid.
- **Not a RED, stated plainly (Task 2):** the unticking-the-OK rule, the 409 banner, Discard changes?, the closing of a clean window, the preset line and the hidden-line option, the server field error and the team placeholder passed on their first run, because Task 1 or `OrderWindow` already do them. So did the Completed card, the deleted-order page test and the Cancelled axe test. The e2e take-off and Cancelled/Completed tests were not run RED on their own: the RED run of the unit tests proved the missing behaviour and the e2e run came after GREEN.
- **Not a RED, stated plainly (Task 3):** the three OrderPage axe tests and the two layout e2e tests (320px bottom sheet, 820px side grid) passed on their first run. The behaviour came with Tasks 1 and 2 (the card class `pg-tablet:col-span-2`, the existing Modal bottom sheet), so Task 3 is verification only and has no `feat` commit.

## Evidence (real results)

- Unit, after GREEN of Task 2: `PublicWebsiteSchemas`, `PublicWebsiteCard`, `PublicWebsiteModal`, `DeletedOrderPage`, `usePublicWebsite` files: **5 files, 80 tests passed**. The Task 1 set with `entry.test.tsx`, the service test and `OrderPage.test.tsx` (82 tests): **7 files, 124 passed** at the end of Task 1.
- e2e, Task 1 GREEN: `npm --prefix web run e2e -- --grep @order-public-website`: first run **3 passed, 2 failed** (webkit and iphone: focus did not return to Edit, because Safari does not focus a button on a click). Fixed by naming the Edit button for the focus return and opening windows with `press()`; second run **5 passed (1.1m)**.
- e2e, Task 2 GREEN: **14 of 15 passed**. The one failure was webkit, first test, at `signInAs` ("Check your email" heading not shown in 5 s) on a machine busy with other sessions. Nothing in this plan was involved: the same test passed in webkit in the earlier run and again in the final run below. Recorded as a sign-in timing flake.
- e2e, Task 3: `@order-public-website at 320px|at 820px`: **10 passed (1.4m)**.
- e2e, final run after the last commit: `--grep "@order-public-website|@orders-page"`: **35 passed (4.2m)** (25 of this spec, 10 of the order page spec, five projects each). The plan names `@order-page`, which matches no test (the order page spec's tag is `@orders-page`), so that tag was used.
- `npm --prefix web run typecheck`: clean. `npm --prefix web run lint` (`--max-warnings 0`, whole project): exit 0 with no output. Targeted eslint and `prettier --check` on every changed file: clean.
- `*.node.test.ts` files (layout, no long dash, class gate): **21 files, 343 tests passed**.
- `npm --prefix web run build:budget` (PERF-03), gzip, run on the final code: home 148.89 KB, products 145.66, gallery 146.73, contact 149.16 (0.84 KB left), notFound 141.94, admin 220.14, CSS 18.84, all under their limits. Against the figures the orchestrator quoted after wave 10 (home 148.88, contact 149.15) this plan moves the public pages by 0.01 KB (the shared `Checkbox` gained a prop and a class).
- Full web vitest run (`npm --prefix web run test -- --run`, on a machine busy with other sessions): **12 of 374 files failed, 27 of 10,211 tests**. One was a real regression of this plan: `scripts/tailwind-classes.test.ts` (the class gate refused `opacity-60` in `entry.recipe.ts`), fixed in `e000d9c5`; it and the `entry` tests then passed (5 files, 187 tests). Ten failures (EditUserPanel, ExpenseModal, ListSettingsSection, AuditLogPage, OrderFormPage, OrdersPage, ProfilePage, SettingsPage, UsersPage, routes) were timeouts under load (those files ran for 60 to 135 s each); re-run on their own, 9 of those files passed (707 tests) and OrderFormPage passed alone earlier (62 tests). The last one, `scripts/license-policy.test.ts` ("exits 1 on a stricter policy given through --exceptions"), is the failure the orchestrator already named for fresh worktrees ("No packages found in this path"); it was not chased.
- `gitleaks` on every staged change: no leaks. No long dash in any new file (the OR-4 node test passed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The public gallery read the e2e must check does not exist yet**
- **Found during:** Task 1 (the e2e tracer)
- **Issue:** The plan's e2e checks `GET /api/v1/public/gallery` after showing an order, but that read belongs to plan 11-26, which runs in the same wave and is not in this branch. The plan lists only 11-23 as a dependency.
- **Fix:** the spec reads the gallery under the site content lock; while the route answers 404 or non-JSON it adds a `pending` annotation and goes on, and once 11-26 is merged the same assertion runs (the team is listed after showing, and is gone after taking off). What is asserted today: the card, the toast, the focus, the Shown state and, for the take-off, that the photo stays on the order.
- **Files modified:** web/e2e/order-public-website.spec.ts
- **Open item for the orchestrator:** after 11-26 merges, run `npm --prefix web run e2e -- --grep @order-public-website` and confirm the gallery assertions ran (no `pending`). Coverage item D8 stays `human_judgment: true` until then.
- **Committed in:** `bee1ba83`, `3fd0a7af`

**2. [Rule 1 - Bug] Safari does not return focus to the Edit button**
- **Found during:** Task 1 (e2e in webkit and iphone)
- **Issue:** the Modal returns focus to the element that had it when it opened, and Safari gives a clicked button no focus, so focus was lost after the window closed. The order Discounts tab already works around this.
- **Fix:** the card names its Edit button and focuses it after every close; the e2e opens windows with `press()`.
- **Files modified:** web/src/modules/admin/components/PublicWebsiteCard.tsx, web/e2e/order-public-website.spec.ts
- **Verification:** second e2e run, 5 of 5 passed.
- **Committed in:** `5c5e4a08`

**3. [Rule 2 - Missing critical] `Checkbox` could not be aria-disabled**
- **Found during:** Task 1. The spec needs Show to be `aria-disabled` and focusable, so its hint can be read; `Checkbox` only knew the native `disabled`.
- **Fix:** an optional `ariaDisabled` prop: sets `aria-disabled`, dims the box, and ignores a click or Space. Its own test was seen failing first. The existing pinned class list of the box is untouched (a separate `checkInactiveClasses`).
- **Files modified:** web/src/components/entry/Checkbox.tsx, entry.recipe.ts, entry.test.tsx
- **Committed in:** `5c5e4a08`

**4. [Rule 3 - Blocking] The window needed a toast and a save path the order windows did not have**
- `OrderThing` gained `order` (title "Order") so `useOrderChildSave` can be used for a save that is not a child row, and the window passes `quiet: true` to show its own toast. No existing toast changed.
- **Committed in:** `5c5e4a08`

**5. [Plan wording] `@order-page` matches no test**
- The Task 3 verify greps `@order-public-website|@order-page`. The order page spec's tag is `@orders-page`, so the final run used that.

**6. [Rule 1 - Bug] The class gate refused the checkbox dimming**
- **Found during:** the final full web test run (after Task 3)
- **Issue:** `checkInactiveClasses` used `opacity-60`, and `scripts/tailwind-classes.test.ts` allows only `aria-disabled:opacity-45` (D-02).
- **Fix:** the box now uses `aria-disabled:opacity-45`, the dimming a disabled button has. Verified: the class gate test and the entry tests pass (5 files, 187 tests).
- **Files modified:** web/src/components/entry/entry.recipe.ts
- **Committed in:** `e000d9c5`

**Total deviations:** 6 (2 bugs, 1 missing critical, 2 blocking, 1 plan wording). **Impact on plan:** none on scope. Item 1 leaves one check pending until 11-26.

## Open items (owner and orchestrator)

- **P11-BL-30 (already parked by 11-23), kept as built:** the name is required only when the order is shown and has no team. The window, the hint and the zod rule follow that, so an order with no team can record the OK first. If the owner rules "always required", change the schema (`name === '' && !hasTeam` without the `showOnWebsite` guard) and the `required` flag of `Name shown`.
- **New wording the spec does not name (SPEC-GAP, for the owner's review):** the empty option of `Show under` reads "Choose a line".
- **Shown under on a never-shown order:** the card prints the line the server worked out from the items (the DTO's `productLineTitle` is the effective line), so an order that was never shown can still read "Shown under: Basketball Jerseys". If the owner wants it empty until shown, that is a one-line change in `rowsOf`.
- **11-23 O-3 (parked P11-BL-31):** the card offers no Edit on a Cancelled order, as the UI spec says, so removing the customer's OK there is not possible from the page even if the server later allows it.
- **For plan 11-35:** `PublicWebsiteFields` takes `form`, `order` (null on a new order), `lineOptions` and `showPreview`; pass `showPreview={false}` on the new order form. Build the form with `publicWebsiteSchema(hasTeam)` and `toPublicWebsiteRequest`.
- **For plan 11-37:** the audit labels are not touched here.

## Known flakes (recorded, not hidden)

- webkit sign-in timeout (`signInAs`, "Check your email" not shown in 5 s) in one of 15 tests of the Task 2 run, on a busy machine. It passed in the same project in the run before and the run after.
- A whole-project `npm --prefix web run lint` takes over 10 minutes while other sessions load the machine; it finished with exit 0.
- Ten web test files failed by timeout in the full vitest run under load and passed on their own (see Evidence). Not related to this plan.

## Known Stubs

None. The RED commit's inert stubs were all replaced in GREEN (`grep -rn "STUB for the RED" web/src web/e2e` finds nothing).

## Authentication Gates

None.

## Threat Flags

None new. T-11-68 (publishing without consent) is covered at every layer in the browser: `aria-disabled` Show with its hint, unticking the OK unticks Show, and the schema refuses Show without the OK (tests listed under D2); the server refuses it too (11-23). T-11-69 (stale or repeated saves): the window sends the order version and answers 409 with the banner and the choices kept; a double click sends one request through `useSubmission`. T-11-SC: no package was added or bumped (`package.json` and the lockfile are untouched; `npm ci --ignore-scripts` installed the lockfile versions in this worktree).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 11-35 can import `PublicWebsiteFields`, `publicWebsiteSchema` and `toPublicWebsiteRequest` for the New Order and Edit Order card.
- 11-26 is needed for the public gallery assertions of this spec to run.
- Orchestrator merge notes: the shared files touched are `web/src/test/orderFixtures.ts` (handlers for `PUT /orders/:id/public` and `GET /product-lines/options`, `publicWebsiteBlock`, `PRODUCT_LINE_OPTIONS`), `web/src/modules/admin/components/orderPage.recipe.ts`, `OrderPage.tsx` and `docs/web/e2e.md` (one new row before `@admin`, `@showcase`). No contract file, migration or audit code was touched.

## Self-Check

PASSED. The 13 files listed under key-files.created exist on disk. The commits `bee1ba83`, `5c5e4a08`, `3fd0a7af`, `c7c46317`, `d1e18975`, `1f8ac7f4` and `e000d9c5` are all ancestors of HEAD. The acceptance greps hold (`PublicWebsiteCard` in OrderPage.tsx 2, the blocked hint in the copy 2, the Cancelled sentence in the copy 1, SPEC-GAP in the card 1, "Customer said OK to show" in the fields 1). The working tree held nothing uncommitted except this file. STATE.md and ROADMAP.md were not touched. No shell of mine is left running.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
