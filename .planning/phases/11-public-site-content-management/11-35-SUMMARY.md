---
phase: 11-public-site-content-management
plan: 35
subsystem: orders-public-website-ui
tags: [orders, consent, gallery, privacy, react, zod, react-hook-form, playwright, a11y]
created: 2026-11-13T02:08:56-06:00
updated: 2026-11-13T02:08:56-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-27 PublicWebsiteFields, publicWebsiteSchema, publicWebsiteCopy and useProductLineOptionsQuery; 11-33 the optional publicWebsite block on POST /api/v1/orders and PUT /api/v1/orders/{id}"
provides:
  - "PublicWebsiteFormCard: the Public website card on the New Order form (after Order details, before Images) and on the Edit Order form (last card)"
  - "Both order form schemas carry the four public values with the order window's rules and words"
  - "The create and details requests send a publicWebsite block only once the card was changed"
  - "Server field errors under publicWebsite. land on their fields; an order cancelled while the edit form was open shows the locked banner"
  - "Shared pieces: checkPublicWebsite, blankPublicWebsite, publicWebsiteValuesOf, toPublicWebsiteBlock, PublicWebsiteFormLike"
  - "e2e @order-form-public: three tests in five projects"
affects: [11-37]

actuals:
  tokens: 12900
  tasks: 2
  commits: 3

# commits is measured: git rev-list --count plan_head_before..plan_head_after. The SUMMARY commit follows plan_head_after.
# tokens is chars/4 over the added lines of the realized diff (51,585 chars), the same scale as the estimate.
plan_head_before: effa01f1f95fd2dc781e1c3f64e86bc9804d0488
plan_head_after: 2f35d835545744bf84d1f0ba247e6cdbbef65eb1

tech-stack:
  added: []
  patterns:
    - "The order forms hold the four public values flat beside the order fields; the card gets a PublicWebsiteFormLike (control and setValue) narrowed once with a cast, as the shared detail cards already do"
    - "A form sends a publicWebsite block only when it differs from the values it opened with (blank on a create, the order's own on an edit)"
    - "One rule function (checkPublicWebsite) serves the window and both forms; a form passes hasTeam from the team typed and lineRequired false on a new order"

key-files:
  created:
    - web/src/modules/admin/components/PublicWebsiteFormCard.tsx
    - web/src/modules/admin/components/PublicWebsiteFormCard.test.tsx
  modified:
    - web/src/modules/admin/components/PublicWebsiteFields.tsx
    - web/src/modules/admin/components/PublicWebsiteModal.tsx
    - web/src/modules/admin/components/orderForm.recipe.ts
    - web/src/modules/admin/components/OrderItemsEditor.test.tsx
    - web/src/modules/admin/orderFormSchemas.ts
    - web/src/modules/admin/orderFormSchemas.test.ts
    - web/src/modules/admin/pages/OrderFormPage.tsx
    - web/src/modules/admin/pages/OrderFormPage.test.tsx
    - web/src/modules/admin/publicWebsiteCopy.ts
    - web/src/modules/admin/publicWebsiteSchemas.ts
    - web/e2e/order-public-website.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "On the New Order form the line is not checked in the browser: the server works the auto line out from the items on save and answers under publicWebsite.productLineId when there is none. On the Edit Order form the line is required once Show is ticked, as in the window (see Open items)"
  - "An unchanged card sends nothing; a changed card sends the whole block, so an all-off block is how the OK is taken back on an edit"
  - "The card has no preview and no new wording: the title and hint are the UI-SPEC's, the empty option is the window's 'Choose a line'"

patterns-established:
  - "toPublicWebsiteBlock(values, before): undefined while nothing changed"

requirements-completed: [GAL-03]

coverage:
  - id: D1
    description: "The New Order form has a Public website card after Order details and before Images, with the hint and no preview; both boxes start unticked and Show is blocked until the OK is ticked (D-11)"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteFormCard.test.tsx#the card, web/src/modules/admin/pages/OrderFormPage.test.tsx#sits after Order details and before Images, starts with both boxes unticked (D-11)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@an Admin creates an order with the customer OK and Show ticked on the form (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ticking the OK and Show on the New Order form saves them with the order: POST /orders carries publicWebsite {customerConsent true, showOnWebsite true, productLineId null, publicName null}; the order page reads Yes, recorded and Shown. A card nobody touched, or ticked and unticked again, sends no block"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#posts the OK and Show with no line and no name, posts the line and the trimmed name, sends no publicWebsite block when the card was left alone"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/orderFormSchemas.test.ts#the public website block in the requests"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@an Admin creates an order with the customer OK and Show ticked on the form (5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Edit Order form has the card as its last card, filled from the order; unticking the OK unticks Show; an untouched card sends no block with a details save; a changed card sends the whole block; an all-off block takes the OK back"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#the Public website card on the Edit Order form"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@a Manager edits a shown order, changes Name shown (5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "OR-3: every public website rule is checked in the browser in the window's words (Show needs the OK, name at most 80 after trimming, a name when the form has no team, a line on an edit); the form's own team is the one typed"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderFormSchemas.test.ts#the public website block on the New Order form, #the public website block on the Edit Order form"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#needs a name to show an order that has no team, and sends nothing until it has one"
        status: pass
    human_judgment: false
  - id: D5
    description: "Server field errors under publicWebsite.* land on Show under and Name shown with focus there; an order cancelled while the edit form was open (422 orders.public-cancelled) shows the locked banner; Load Latest refills the card"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#puts a server 400 under publicWebsite.productLineId, #puts a server 400 under publicWebsite.publicName, #shows the locked banner when the order was cancelled meanwhile, #fills the card again from the latest order on Load Latest"
        status: pass
    human_judgment: false
  - id: D6
    description: "ORD-15: a change in the card counts for the form's Discard changes? guard on both forms"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#counts a change in the card for the Discard changes? guard (ORD-15)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The card passes axe in each state on both forms, and at 320px it stacks with every part inside the screen and no sideways scroll"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PublicWebsiteFormCard.test.tsx#has no axe violations in any state, web/src/modules/admin/pages/OrderFormPage.test.tsx#has no axe violations with the card in each state (F1 and F2)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@at 320px the card stacks on the New Order and Edit Order forms (5 projects)"
        status: pass
    human_judgment: false
  - id: D8
    description: "After the Name shown edit on the Edit Order form, the public gallery lists the order under the new name"
    requirement: GAL-03
    verification:
      - kind: e2e
        ref: "web/e2e/order-public-website.spec.ts@a Manager edits a shown order, changes Name shown (GET /api/v1/public/gallery under the site content lock, 5 projects)"
        status: pass
    human_judgment: false

duration: about 55min (the start time was not recorded; first command about 01:15 -06:00)
completed: 2026-11-13
status: complete
---

# Phase 11 Plan 35: Staff record the customer's OK in the New Order and Edit Order forms Summary

**The New Order and Edit Order forms now carry a Public website card (the OK, Show, Show under, Name shown) that saves with the order through plan 11-33's routes: both boxes start unticked, Show waits for the OK, every rule uses the window's words, an untouched card sends nothing, and a card change counts for the Discard changes? guard.**

## Open items for the owner

None that block. Two small interpretation points are listed so they can be changed cheaply if the owner disagrees. Recommendation first in each.

- **O-1, Show under on the New Order form (recommend: as built).** The browser does not require a line on a new order, because the items are still being added and the server works the auto line out on save. If there is no auto line and none was picked, the server answers 400 under `publicWebsite.productLineId` and the message lands on Show under with focus there (tested). Option B: require a line in the browser as soon as Show is ticked on a new order, which is stricter but forces a pick even when the items would have given the line. Say if you want B; it is a one-flag change (`lineRequired: true` in `createOrderSchema`, no `lineFromItems` on the card).
- **O-2, ticking only the OK on an edit stores the preset line (as the window does).** The Edit Order card starts on the line the order is shown under, else the server's auto line. A change to any one value sends the whole block, so a never-shown order whose OK is ticked here also stores that auto line as its chosen line. This is the same behaviour as the Public Website window since 11-27. No action unless you want the line left empty until the order is shown.

## Performance

- **Duration:** about 55 min (estimated: the start time was not recorded)
- **Completed:** 2026-11-13T02:08-06:00
- **Tasks:** 2 of 2
- **Files:** 14 changed (2 new, 12 modified), 1,134 lines added, 73 removed

## Accomplishments

- `PublicWebsiteFormCard` (SPEC-GAP, as the plan names): a form card with the title "Public website" and the hint "Only with the customer's OK.", holding the four `PublicWebsiteFields` and no preview. On the New Order form it sits after Order details and before Images; on the Edit Order form it is the last card. Both Admin and Manager see it (D-16).
- Both order form schemas carry the four public values and run one shared rule function (`checkPublicWebsite`) in the window's words. The form's own team (the one typed) decides whether a name is needed.
- The create and details requests add a `publicWebsite` block only once the card was changed (`toPublicWebsiteBlock`): blank on a create, the order's own values on an edit. An unchanged card sends nothing, so the server leaves the public settings as they were. A changed card sends the whole block, so an all-off block takes the OK back.
- Server field errors under `publicWebsite.` land on their fields with focus there. A save that finds the order cancelled meanwhile (`422 orders.public-cancelled`) reads the order again and shows the locked banner, like `orders.locked`.
- The card's values are in the form, so a change makes the form dirty and the Discard changes? guard asks (ORD-15). Load Latest refills the card from the latest order.
- `PublicWebsiteFields` now watches only its four values (an order form holds many more) and takes the typed team and a `lineRequired` flag; the Public Website window and the forms share `publicWebsiteValuesOf` and the rules.
- e2e `@order-form-public`: three tests in five projects.

## Task Commits

1. **Task 1 (tracer): create with the OK and Show ticked**
   - RED `0b101668` (test): the failing tests of both tasks (unit) and the tracer e2e, with an inert stub card
   - GREEN `02186154` (feat): the card, schemas, requests, page changes (both tasks, see Deviation 1)
2. **Task 2: the Edit Order card, the rules and the server's field errors**
   - `2f35d835` (test): the Edit Order and 320px e2e checks and the `docs/web/e2e.md` row. They passed on their first run because the behaviour came with `02186154`.
   - No REFACTOR commit: the code needed no cleanup after GREEN.

**Plan metadata:** the SUMMARY commit follows this file.

## Tracer feedback gate

Task 1 is `type="tracer"` with no `gate="blocking-human"`. After its GREEN, its `<verify>` was re-run end to end before expanding: the three unit files passed, and `npm --prefix web run e2e -- --grep @order-form-public` gave **5 passed (40.7s)**. Tracer verified end to end, expanded to Task 2.

## TDD Gate Compliance

RED (`test(11-35)`) then GREEN (`feat(11-35)`) exist in order. `gsd_run check tdd-red-evidence` takes TAP, JUnit (Maven), swift-testing or unittest reports; this repository's vitest and Playwright runs do not produce one of those for it, so the classifier was not run. The RED run was inspected by hand against the real output (kept in the session scratchpad).

- **RED, unit** (`PublicWebsiteFormCard.test.tsx`, `OrderFormPage.test.tsx`, `orderFormSchemas.test.ts`: 163 run, **42 failed, 121 passed**). Semantic assessment: the card file was an inert stub that renders nothing, so 33 failures were `Unable to find an accessible element with the role "region" and name "Public website"` (11) or `Unable to find role="option" and name "Basketball Jerseys"` (22: the line options never appear without the card); 9 were assertion failures in the schema tests (`expected undefined to be 'Tick Customer said OK to show first.'`, `expected undefined to deeply equal { customerConsent: true, ... }` and similar). Every failure is on a planned behaviour. None was a syntax, import, load or fixture fault.
- **RED, e2e** (`@order-form-public`, chromium): failed at `expect(getByRole('region', { name: 'Public website' })).toBeVisible()` on the New Order form after sign-in and page load, the planned assertion.
- **Not a RED, stated plainly:** the negatives passed on their first run because they pin behaviour that already held: a card nobody touched sends no block, an untouched schema accepts a blank card, ticked-then-unticked sends nothing, and the existing journeys. The Task 2 e2e tests (`2f35d835`) were written after the behaviour existed and were not run RED.
- **Written after the code:** the fixes in `OrderItemsEditor.test.tsx` and the existing schema tests (they build a form without the new values, so a compile or parse error, not a RED).

## Evidence (real results)

- Unit, RED: 42 failed, 121 passed of 163 (above). Unit, after GREEN: `PublicWebsiteFormCard`, `OrderFormPage`, `orderFormSchemas`, `PublicWebsiteModal`, `publicWebsiteSchemas`, `OrderItemsEditor` and the two node gates: **8 files, 275 tests passed**. Wider run (`src/modules/admin/components`, `OrderPage`, `OrderFormPage`, `orderFormSchemas`, `publicWebsiteSchemas`, the boundary, layout, no-long-dash and public-paths node tests, `scripts/tailwind-classes.test.ts`): **99 files, 2,422 tests passed** (241 s).
- e2e: first GREEN of the tracer, 5 passed. First run of the Task 2 set: 25 passed, **10 failed**: the two new tests in all five projects. Both were faults in my spec, not in the code: the seeded order has no contact number, which an edit needs ("Enter a contact number." held the save), and a string page script passed to `evaluate` was evaluated as an expression and returned nothing. Fixed in the spec (fill the contact number; measure the parts through locators). Final run: `npm --prefix web run e2e -- --grep "@order-form-public|@orders-create|@orders-edit"`: **35 passed (2.3m)** (3 of this spec, 3 `@orders-create` and 1 `@orders-edit`, five projects each). The existing order form journeys still pass.
- `npm --prefix web run typecheck`: exit 0 (app, node and reference configs). `npm --prefix web run lint` (`--max-warnings 0`, whole project): exit 0 with no output.
- `npm --prefix web run build:budget` (PERF-01, gzip, final code): home 149.41 KB, products 146.06, gallery 147.41, contact 149.34, notFound 142.12 (limit 150), admin 220.93 (limit 250), CSS 19.59 (limit 35). Against the figures after 11-31 (Home 0.64 KB left, Contact 0.70 left) the public pages are about 0.05 KB and 0.04 KB heavier, from the shared-chunk regrouping noted in earlier plans; this plan adds nothing to a public page. Home has 0.59 KB left and Contact 0.66 KB left.
- gitleaks `protect --staged`: no leaks, before each of the three commits. No long dash in any new file (the OR-4 node test passed).
- Acceptance grep: `grep -c "PublicWebsiteFormCard" web/src/modules/admin/pages/OrderFormPage.tsx` = 3 (import, F1 use, F2 use). The Task 2 criterion (the SUMMARY quotes the order form e2e runs) is met above.

## Decisions Made

- The New Order form does not require a line in the browser (O-1). The Edit Order form does, once Show is ticked.
- An unchanged card sends nothing; a changed card sends the whole block.
- No new wording: the card's title and hint are the UI-SPEC's; the empty option is the window's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan shape] One GREEN commit for both tasks**
- **Found during:** Task 1
- **Issue:** the card, the two schemas, the request helpers and the two page changes sit in the same few files, so the Task 1 and Task 2 code could not be split into two clean commits without leaving the first one half-wired.
- **Fix:** one RED commit (the unit tests of both tasks and the tracer e2e) and one GREEN commit (`02186154`), then a test commit for the Task 2 e2e. The tracer gate was run on the GREEN commit before the Task 2 e2e was written.
- **Commit:** `0b101668`, `02186154`, `2f35d835`

**2. [Rule 2 - Missing critical] An order cancelled while the edit form is open**
- **Found during:** Task 2. Plan 11-33 says a details PUT with a block on a Cancelled order answers `422 orders.public-cancelled` before the details lock. Without a handler the form would show a generic failure and keep its stale state.
- **Fix:** the edit form treats `orders.public-cancelled` like `orders.locked`: it reads the order again and the locked banner takes the form's place. Test: `shows the locked banner when the order was cancelled meanwhile`.
- **Files modified:** web/src/modules/admin/pages/OrderFormPage.tsx
- **Commit:** `02186154`

**3. [Rule 3 - Blocking] Existing tests and the wider control type**
- `createOrderSchema` and `updateOrderDetailsSchema` now hold the four values, so the `OrderItemsEditor` harness and the existing schema tests that parse a form had to give them. No existing assertion was weakened or removed. The Edit Order form's customer and details cards now take the same narrowed `OrderDetailsControl` the New Order form already used, because the form's control got wider.
- **Files modified:** web/src/modules/admin/components/OrderItemsEditor.test.tsx, web/src/modules/admin/orderFormSchemas.test.ts, web/src/modules/admin/pages/OrderFormPage.tsx
- **Commit:** `0b101668`, `02186154`

**4. [Plan wording] e2e tags named in the plan match nothing**
- The Task 2 verify greps `@order-create` and `@order-edit`. The specs' tags are `@orders-create` and `@orders-edit`, so the runs used those.

**5. [Plan scope] Two files outside the plan's list**
- `PublicWebsiteModal.tsx` now uses the shared `publicWebsiteValuesOf` (its private copy was removed; its tests pass), and `orderForm.recipe.ts` gained `orderFormPublicBodyClasses` (`min-w-0 p-5`) for the card body. `web/src/test/orderFixtures.ts` was not changed: plan 11-27's fixtures already carry the block (`publicWebsiteBlock`, `PRODUCT_LINE_OPTIONS`) and the handlers.
- **Commit:** `02186154`

**Total deviations:** 5 (1 plan shape, 1 missing critical, 1 blocking, 2 plan wording or scope). **Impact on plan:** none on scope or behaviour; each keeps the plan's intent.

## Known flakes (recorded, not hidden)

None seen in this plan's runs. The 10 e2e failures of the first Task 2 run were faults in the new spec (see Evidence), fixed and re-run, not flakes.

## Known Stubs

None. The RED commit's inert card stub was replaced in GREEN (`grep -rn "STUB for the RED" web/src web/e2e` finds nothing).

## Authentication Gates

None.

## Threat Flags

None new. T-11-86 (consent preset by mistake) is mitigated: both boxes start unticked (`starts with both boxes unticked`, the e2e), Show is aria-disabled until the OK is ticked and unticking the OK unticks Show, an untouched card sends no block (`sends no publicWebsite block when the card was left alone`, `sends no block with a details save when the card was not touched`), and the server rules of plan 11-33 are the gate. T-11-SC: no package was added or bumped (`package.json` and the lockfile are untouched; `npm ci --ignore-scripts` installed the lockfile versions in this worktree).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 11-37: no new audit codes here. A create with the block writes `order.created` then the public codes; a details update writes `order.changed` then the public codes (plan 11-33).
- For the merge: the shared files touched are `docs/web/e2e.md` (one new row after `@order-public-website`), `web/src/modules/admin/publicWebsiteSchemas.ts` and `PublicWebsiteFields.tsx` (shared with the window), and `orderForm.recipe.ts`. No contract file, migration, icon or audit code was touched. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (the orchestrator owns them); GAL-03 is shared with other plans, so it is not marked complete here.

## Self-Check

PASSED. The two new files exist on disk (`PublicWebsiteFormCard.tsx`, `PublicWebsiteFormCard.test.tsx`). The commits `0b101668`, `02186154` and `2f35d835` are ancestors of HEAD. The working tree held nothing uncommitted except this file. No shell of mine is left running (the e2e, lint and test runs each exited; the wait loops had hard limits).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-13*
