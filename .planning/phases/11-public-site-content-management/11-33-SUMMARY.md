---
phase: 11-public-site-content-management
plan: 33
subsystem: orders-public-website
tags: [orders, consent, gallery, privacy, audit, validation, openapi]
created: 2026-11-12T23:58:00-06:00
updated: 2026-11-12T23:58:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-23 Order.SetPublicSettings, OrderPublicFiling.AutoLine, GalleryEntries, the five public audit codes and PUT /api/v1/orders/{id}/public; 11-26 GET /api/v1/public/gallery"
provides:
  - "POST /api/v1/orders and PUT /api/v1/orders/{id} accept an optional publicWebsite block {customerConsent, showOnWebsite, productLineId, publicName}, applied in the same transaction as the order save"
  - "OrderPublicWebsiteFieldsValidator: one rule set for the order window, the New Order form and the Edit Order form"
  - "OrderPublicWebsiteWriter: the one place that applies the settings, adds or removes the gallery entry and writes the public audit entries"
  - "Field errors from a form's block come back under the publicWebsite. prefix; the order window keeps the plain names"
affects: [11-35, 11-37]

actuals:
  tokens: 28200
  tasks: 2
  commits: 4

# commits is measured: git rev-list --count plan_head_before..plan_head_after. The SUMMARY commit follows plan_head_after.
plan_head_before: 8b9defc5b3215dd87b09c9874df2d815eec60c01
plan_head_after: 048052ca9963dda29f09032219ab190f7330c1bf

tech-stack:
  added: []
  patterns:
    - "One writer service shared by three handlers, in two steps: Apply (domain check and set, before the number is taken) and Record (gallery and audit, after the number is set); the caller saves"
    - "A nested block validated by the same AbstractValidator<interface> through When(...) and SetValidator, so the 400 carries publicWebsite.* paths"
    - "Members that must stay out of the JSON contract are methods, not properties (SetsNothing())"

key-files:
  created:
    - src/Csps.Application/Orders/OrderPublicWebsiteFields.cs
    - src/Csps.Application/Orders/OrderPublicWebsiteFieldsValidator.cs
    - src/Csps.Application/Orders/OrderPublicWebsiteWriter.cs
    - tests/Csps.Application.UnitTests/Orders/OrderPublicWebsiteFieldsValidatorTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs
  modified:
    - src/Csps.Application/Orders/CreateOrderRequest.cs
    - src/Csps.Application/Orders/CreateOrderRequestValidator.cs
    - src/Csps.Application/Orders/CreateOrderHandler.cs
    - src/Csps.Application/Orders/UpdateOrderDetailsRequest.cs
    - src/Csps.Application/Orders/UpdateOrderDetailsRequestValidator.cs
    - src/Csps.Application/Orders/UpdateOrderDetailsHandler.cs
    - src/Csps.Application/Orders/SetOrderPublicSettingsRequest.cs
    - src/Csps.Application/Orders/SetOrderPublicSettingsRequestValidator.cs
    - src/Csps.Application/Orders/SetOrderPublicSettingsHandler.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/LegacyEditHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/SetOrderPublicSettingsHandlerTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md

key-decisions:
  - "The shared validator holds the two rules that need no order data (name at most 80, show needs the OK). The line-required, name-required-with-no-team and Cancelled rules stay in the domain and the writer, because they need the order, so the forms and the window get the same words from one place each"
  - "A form's block errors carry the publicWebsite. prefix so a form can put each message on its own control; the order window keeps the plain names"
  - "On a create, a block that sets nothing is treated as no block (no lock, no audit entry). On a details update an empty block means off, because a form that sends the block is stating the whole state"
  - "On a details update the Cancelled-order answer for a block is the Cancelled website message (422 orders.public-cancelled), checked before the details lock, as the plan asks. A Completed order keeps its details lock answer"
  - "The site-content lock is taken only when a block is applied; a timeout is orders.busy on a create and auth.session-busy on a details update, the same answer the order window gives"

patterns-established:
  - "OrderPublicWebsiteWriter is the single writer of order public settings; handlers never call Order.SetPublicSettings directly"

requirements-completed: [GAL-03]

coverage:
  - id: D1
    description: "An Admin creates an order with the customer's OK and Show on the website: consent by the caller, shown, auto line, gallery entry; after a photo is added the public gallery lists it"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#AnAdminCreatesAnOrderWithTheOkAndShowOnTheWebsiteAndItIsInThePublicGalleryOncePhotographed"
        status: pass
    human_judgment: false
  - id: D2
    description: "A create without the block, or with an empty block, has no consent, is not shown and writes no public audit entry"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ACreateWithoutTheBlockHasNoConsentAndIsNotShown"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ACreateWithAnEmptyBlockWritesNoPublicAuditEntryAndNoGalleryEntry"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rules and messages are the order window's: show needs the OK, a name over 80, no team and no name, an unknown line. A refusal saves no order and takes no number"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderPublicWebsiteFieldsValidatorTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs#AnOrderWithNoTeamNeedsANameAndTheDomainRefusalTakesNoNumberAndSavesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#AnOrderWithNoTeamNeedsANameAndAnUnknownLineIsRefusedAndNothingIsSaved"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-11: consent who and when come only from the token and the clock, on a create and on a details update; client stamps inside the block are ignored"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#AConsentTimeAndPersonSentInsideTheBlockAreIgnored"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#AConsentTimeAndPersonSentInsideTheBlockOfADetailsPutAreIgnored"
        status: pass
    human_judgment: false
  - id: D5
    description: "A details PUT with the block saves the details and the public settings together; without the block nothing public changes; Completed keeps its lock answer; Cancelled with a block answers the Cancelled website message and saves nothing"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ADetailsPutWithTheBlockOnAnEditableOrderSavesTheDetailsAndThePublicSettingsTogether"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ADetailsPutWithoutTheBlockLeavesTheOkAndShowingAsTheyWere"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ACompletedOrderKeepsTheDetailsLockAnswerAndItsPublicSettingsAreNotReachedThroughThisRoute"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ACancelledOrdersPutWithShowIsRefusedWithTheCancelledMessageAndNothingIsSaved"
        status: pass
    human_judgment: false
  - id: D6
    description: "AUDIT-01: the public audit codes are written when the block changes something, after order.created or order.changed, with no customer data"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ACreateWithTheBlockWritesTheCreatedEntryAndTheOkAndShownEntriesAndNoCustomerData"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#ABlockThatTakesTheOrderOffRemovesItsEntryAndWritesTheRemovedAndTakenOffEntries"
        status: pass
    human_judgment: false
  - id: D7
    description: "Legacy import never sets consent or showing (D-11, T-11-84)"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderFormPublicWebsiteTests.cs#AnOrderImportedThroughTheTestingRouteIsNeverConsentedOrShown"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' src/Csps.Application/Orders/ImportOrderHandler.cs | grep -c SetPublicSettings = 0"
        status: pass
    human_judgment: false

duration: 67min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 33: Staff can record the customer's OK while creating or editing an order Summary

**The New Order and Edit Order requests now carry an optional `publicWebsite` block that records the customer's OK and Show on the website in the same transaction as the order, under one shared rule set and one shared writer (gallery entry and audit entries included), with consent who and when taken only from the token and the clock, and with imports kept private.**

## Open items for the owner

None. Nothing in this plan needed a ruling beyond 11-CONTEXT.md. Two small interpretation points are listed under "Decisions" and "Deviations" so they can be changed cheaply if the owner disagrees.

## Performance

- **Duration:** about 67 min (start time was not recorded exactly; first command about 22:50 -06:00)
- **Completed:** 2026-11-12T23:57-06:00
- **Tasks:** 2 of 2
- **Files:** 22 changed (1,434 insertions, 92 deletions), including the two generated contract files

## Accomplishments

- `POST /api/v1/orders` and `PUT /api/v1/orders/{id}` accept `publicWebsite { customerConsent, showOnWebsite, productLineId, publicName }`. It is applied in the same transaction, with the auto line worked out from the saved items.
- One validator (`OrderPublicWebsiteFieldsValidator`) now serves the order window, the New Order form and the Edit Order form: show needs the OK, name at most 80 after trimming.
- One writer (`OrderPublicWebsiteWriter`) applies the settings, adds or removes the gallery entry and writes the audit entries for all three callers. `SetOrderPublicSettingsHandler` was moved onto it, with no behaviour change.
- A create refused for its block saves no order and takes no number: the block is applied inside the transaction before the number is taken.
- On a details update the details and the public settings save together or not at all. The Completed lock answer is unchanged. A Cancelled order with a block answers `422 orders.public-cancelled`.
- Field errors from the forms come back under `publicWebsite.` so form 11-35 can place each message.
- The import never calls `SetPublicSettings` (grep and a Testing-route test).
- Contract refreshed (additive: one schema, two properties) and `docs/api/orders.md` documents the block.

## Task Commits

1. **Task 1 (tracer): create with the OK and Show, and the public gallery**
   - RED `99f8b96b` (test): 10 integration tests, 8 failed on the planned assertions
   - GREEN `8e6f654a` (feat): shared fields, validator and writer, create request and handler, Set handler moved onto the writer, contract
2. **Task 2: the details update, the import and the rules**
   - RED `84f44a35` (test): 9 more integration tests, 5 failed on the planned assertions
   - GREEN `048052ca` (feat): update request, validator and handler, docs, contract
   - No REFACTOR commit: the code needed no cleanup after GREEN.

**Plan metadata:** the SUMMARY commit follows this file.

## Tracer feedback gate

Task 1 is `type="tracer"` with no `gate="blocking-human"`. Its `<verify>` was run end to end before expanding: `*OrderFormPublicWebsiteTests` + `*OrderPublicSettingsEndpointTests` + `*OpenApiSnapshotTests` gave 38 passed, 0 failed, and `npm --prefix tools/openapi-gen run check` printed "Generated API types match tools/openapi-gen/openapi.v1.json." Tracer verified end to end, expanded to Task 2.

## TDD Gate Compliance

RED and GREEN commits exist in order for both tasks (`test(11-33)` then `feat(11-33)`, twice). `gsd_run check tdd-red-evidence` takes TAP, JUnit, swift-testing or unittest reports; this repository's runner (xunit.v3 on Microsoft Testing Platform) writes none of those here, so the classifier was not run. Each RED was inspected by hand against the real console output (kept in the session scratchpad):

- **Task 1 RED** (`*OrderFormPublicWebsiteTests`: 10 run, 8 failed, 2 passed). Semantic assessment: every failure was on the planned assertion: `customerConsent` false where true was expected, `201 Created` where `400` was expected, the audit list holding only `order.created`, `productLineId` missing. None was a compile, load or fixture fault.
- **Task 2 RED** (19 run, 5 failed, 14 passed). Semantic assessment: the failures were the missing gallery removal and audit entries, the consent person not the caller, `customerConsent` false after a PUT with the block, `orders.locked` where `orders.public-cancelled` was expected, and `200` where `400` was expected for a refused block. All on the planned assertions.
- **Not a RED, stated plainly:** `ACreateWithoutTheBlockHasNoConsentAndIsNotShown` and `ABlockThatChangesNothingOnAnUnchangedFormKeepsTheVersionAndWritesNoEntry`, `ADetailsPutWithoutTheBlockLeavesTheOkAndShowingAsTheyWere`, `ACompletedOrderKeepsTheDetailsLockAnswer...` and `AnOrderImportedThroughTheTestingRouteIsNeverConsentedOrShown` passed on their first run. They pin behaviour that already held (negatives and unchanged locks) and guard it now that the block exists.
- **Written after the code, for coverage:** `OrderPublicWebsiteFieldsValidatorTests` (the validator did not exist at RED time, and a missing type would have been a compile error, not a RED), and the new tests in `CreateOrderHandlerTests` (9) and `UpdateOrderDetailsHandlerTests` (12), because a new handler constructor parameter breaks compilation of the existing tests. The plan lists the validator tests under Task 2; they sit with Task 1's code, where the validator was built.

## Evidence (real results)

- Server integration, full run on the final code (`CSPS_TEST_SQL=localdb`): **2783 total, 2782 passed, 1 failed.** The one failure was `OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders` (P95 330 ms against 300 ms, 4m13s) while the other parallel executor also used the machine. Run alone it passed (1 of 1). It is the same load-sensitive timing test 11-23 recorded; nothing in this plan touches the order list.
- Task 1 verify classes after GREEN: **38 passed, 0 failed.** Task 2 verify classes (`*OrderFormPublicWebsiteTests`, `*OpenApiSnapshotTests`, `*OrderPublicSettingsEndpointTests`): **47 passed, 0 failed.**
- Application unit tests: **3029 passed, 0 failed** (in the coverage gate run). Architecture tests: **290 passed, 0 failed.**
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): **Csps.Domain line 100% (4202/4202), branch 100% (1789/1789), PASS. Csps.Application line 98% (11542/11767), branch 95.8%, PASS.**
- `dotnet format Csps.slnx --verify-no-changes`: exit 0. `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The contract diff is additive (one schema `OrderPublicWebsiteFields`, one optional property on each of the create and update requests).
- Acceptance greps: `SetPublicSettings` in `CreateOrderHandler.cs` = 1 (the class comment names the writer's call; the call itself is in the writer, see Deviation 1); `OrderPublicWebsiteFieldsValidator` in `SetOrderPublicSettingsRequestValidator.cs` = 2; `PublicWebsite` in `UpdateOrderDetailsRequest.cs` = 2; `SetPublicSettings` in `ImportOrderHandler.cs` outside comments = 0.
- Web side not run: the only web change is the additive generated types file, and the plan has no web task. `web/node_modules` is not installed in this worktree.
- gitleaks `protect --staged`: no leaks found, before each of the four code commits.

## Decisions Made

- The shared validator checks only the rules that need no order data. The rest stay in the domain through the writer, so both the window and the forms get the same words from one place each.
- A block's errors carry the `publicWebsite.` prefix on the forms. The order window keeps its plain names.
- A create treats a block that sets nothing as no block. An update treats an empty block as "turn everything off".
- On a details update a Cancelled order with any block answers the Cancelled website message before the details lock, as the plan's test list asks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The call to `Order.SetPublicSettings` lives in a shared writer, not in `CreateOrderHandler`**
- **Found during:** Task 1
- **Issue:** the plan says `CreateOrderHandler` applies the settings through the domain method and lists the shared validator, but three handlers (window, create, update) need the same line list, auto line, gallery entry and audit entries. Copying the 70 lines three times would let them drift.
- **Fix:** `OrderPublicWebsiteWriter` (Application) holds the one implementation. The three handlers call it. The acceptance grep for `SetPublicSettings` in `CreateOrderHandler.cs` passes through the class comment that names the call. `SetOrderPublicSettingsHandler` was moved onto the writer; its 17 unit tests still pass with the writer built from the same fakes.
- **Files modified:** `OrderPublicWebsiteWriter.cs` (new), `CreateOrderHandler.cs`, `UpdateOrderDetailsHandler.cs`, `SetOrderPublicSettingsHandler.cs`, `OrdersApplicationRegistration.cs`
- **Commit:** `8e6f654a`

**2. [Rule 3 - Blocking] Existing unit tests had to take the new constructor parameter**
- **Found during:** Tasks 1 and 2
- **Issue:** `CreateOrderHandler`, `UpdateOrderDetailsHandler` and `SetOrderPublicSettingsHandler` take the writer, so `CreateOrderHandlerTests`, `UpdateOrderDetailsHandlerTests`, `LegacyEditHandlerTests` and `SetOrderPublicSettingsHandlerTests` build it. No existing assertion was weakened or removed.
- **Commits:** `8e6f654a`, `048052ca`

**3. [Rule 1 - Bug] A computed property would have leaked into the API contract**
- **Found during:** Task 1 (the first contract refresh showed `isEmpty?: boolean` on `OrderPublicWebsiteFields`)
- **Fix:** `IsEmpty` became the method `SetsNothing()`, then the contract was regenerated. No `isEmpty` is in the final contract.
- **Commit:** `8e6f654a`

**4. [Interpretation] The window's 400 now comes before the 404 and 409**
- `SetOrderPublicSettingsRequestValidator` now includes the shared rules, so show without the OK and a name over 80 are a `400` before the order is looked up. Before, the domain returned the same words after the 404 and 409 checks. The words and the field names (`showOnWebsite`, `publicName`) are unchanged, and all 14 `OrderPublicSettingsEndpointTests` pass.

**Total deviations:** 4 (1 bug, 2 blocking, 1 interpretation). **Impact:** none on scope; each keeps the plan's behaviour and sharpens the single-source rule.

## Known flakes (recorded, not hidden)

- `OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders` failed once in the full Server run (P95 330 ms) while another executor shared the machine. It passed alone. Same test 11-23 recorded as load sensitive.

## Authentication Gates

None.

## Issues Encountered

- A full Server run takes about 20 minutes when the machine is shared. No stub was left in the code written here. Known Stubs: none.
- Several shell wait loops were started to watch the long test run. Each had a hard limit and stopped when the test process exited; none is left running.

## Threat Flags

None new. T-11-83 (consent through the order form) is mitigated: one shared validator, the consent stamps come from the token and the clock, a missing block changes nothing, and tests cover client stamps inside the block on both routes. T-11-84 (legacy import) is mitigated: `ImportOrderHandler` never calls `SetPublicSettings` (grep) and a Testing-route test shows an imported order is never consented or shown even when the body carries the fields. T-11-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-35 (the order form card):** send `publicWebsite` on create and on the details update. Map the errors from `publicWebsite.showOnWebsite`, `publicWebsite.productLineId` and `publicWebsite.publicName`. The zod rules to mirror: show needs the OK, name at most 80 after trimming, a name is needed to show an order with no team (the team being saved on an edit), and a line is needed to show when the auto line is empty. Omit the block on a Completed or Cancelled order: a Completed order answers the lock error, a Cancelled one the Cancelled website message.
- A form that sends an all-false block on an edit turns the OK and showing off. Send the block only when the card is shown.
- 11-37: no new audit codes in this plan. Create writes `order.created` then the public codes; update writes `order.changed` then the public codes.

## Self-Check

PASSED. The five new files exist on disk (`OrderPublicWebsiteFields.cs`, `OrderPublicWebsiteFieldsValidator.cs`, `OrderPublicWebsiteWriter.cs`, `OrderPublicWebsiteFieldsValidatorTests.cs`, `OrderFormPublicWebsiteTests.cs`). The commits `99f8b96b`, `8e6f654a`, `84f44a35` and `048052ca` are ancestors of HEAD. `git status` was clean before this file. STATE.md and ROADMAP.md were not touched.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
