---
phase: 09-order-images-maintenance-jobs
plan: 20
subsystem: api
tags: [orders, photos, reorder, cover, description, audit, openapi, row-version]
created: "2026-11-03T21:20:00-06:00"
updated: "2026-11-03T21:20:00-06:00"

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "Order.Images and AddImage, OrderImageRules (plan 09-01); OrderImagesController and the order-image.added audit code (09-01); the order photo reads (09-13, 09-14); the photo contract page (09-09)"
provides:
  - "Order.MoveImage and Order.DescribeImage (domain moves with the closed-order lock)"
  - "PUT /api/v1/orders/{orderId}/images/{imageId}/position (move, and Make Cover with position 0)"
  - "PUT /api/v1/orders/{orderId}/images/{imageId} (set or clear a description, default follows the place)"
  - "Audit codes order-image.moved, order-image.cover-changed and order-image.description-changed"
  - "OpenAPI snapshot and generated web types for both routes"
affects: [09-27 order photo page wiring, 09-18 photo delete, web order photo grid]

actuals:
  tokens: 31500
  tasks: 3
  commits: 5
plan_head_before: 37ba6bf403cc6a52bc583fc3e737c9511edef2b5
plan_head_after: 9e15c77bfcbfb769bc9fff4ce114906f8ee71cb8

tech-stack:
  added: []
  patterns:
    - "Cover is derived from Position 0; no cover flag and no second ordering"
    - "A form change goes through OrderChildWrite.SaveFormAsync with the order row version and an optional second audit entry (Then)"

key-files:
  created:
    - src/Csps.Application/Orders/MoveOrderImageRequest.cs
    - src/Csps.Application/Orders/MoveOrderImageRequestValidator.cs
    - src/Csps.Application/Orders/MoveOrderImageHandler.cs
    - src/Csps.Application/Orders/DescribeOrderImageRequest.cs
    - src/Csps.Application/Orders/DescribeOrderImageRequestValidator.cs
    - src/Csps.Application/Orders/DescribeOrderImageHandler.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderImageRequestValidatorTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Orders/OrderImage.cs
    - src/Csps.Domain/Orders/OrderImageRules.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Server/Controllers/OrderImagesController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - docs/api/order-images.md
    - docs/api/orders.md
    - docs/operations/audit-log.md
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "A move writes order-image.moved, and also order-image.cover-changed in the same save whenever the photo at place 0 is now a different photo (a photo goes to the front, or the cover leaves it)"
  - "cover-changed names the place (counting from 1) the new cover had before the move; moved names from and to places; no id or address in any detail"
  - "A description change shows the default text of the place on a side that has no stored text, and each side is cut (never mid-character) to keep the detail under 400 characters"
  - "The 200 character limit is checked in the validator (400 before any lookup) and again in the domain, with the same UTF-16 length the web schema counts"

patterns-established:
  - "Second audit entry in one save through OrderChildAudit.Then for a derived fact (cover change)"
  - "Domain move returns a record (OrderImageMove) or null for a no-op, so the handler saves and audits nothing for a repeat"

requirements-completed: [ORD-04]

coverage:
  - id: D1
    description: "Moving a photo to a place shifts the others and keeps places 0 to n-1; Make Cover is a move to 0; the answer is the whole order with a new version"
    requirement: ORD-04
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs#EveryMoveOfEveryPhotoAmongOneToFivePhotosKeepsThePlacesWholeAndTheOthersInOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs#MovingTheSecondPhotoToTheFrontMakesItTheCoverAndAnswersTheWholeOrderWithANewVersion"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stale version answers 409 and changes nothing; two moves with one version give one 200 and one 409"
    requirement: ORD-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs#TwoMovesSentTogetherWithOneVersionGiveOneOkAndOneStaleAndLeaveWholePlaces"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs#TheOldVersionAnswers409StaleAndThePositionsStay"
        status: pass
    human_judgment: false
  - id: D3
    description: "Description is trimmed; empty or the default of the current place is stored as none; over 200 characters is a 400 with the plain message"
    requirement: ORD-04
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs#AnEmptyDescriptionOrTheDefaultTextOfThePhotoPlaceClearsTheStoredText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs#ADescriptionOf201CharactersAnswers400WithThePlainMessage"
        status: pass
    human_judgment: false
  - id: D4
    description: "Closed orders answer 422 orders.locked; a photo not on the order answers 404 with the plain message"
    requirement: ORD-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs#ACompletedOrderAnswers422LockedOnAMove"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs#APhotoOfAnotherOrderOrAnUnknownPhotoAnswers404AndChangesNothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "Moves, cover changes and description changes are audited with no photo id or address; a no-op writes nothing; both roles get 200 and anonymous 401"
    requirement: ORD-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageArrangeEndpointTests.cs#MovingAPhotoToThePlaceItHasAnswers200WithTheSameVersionAndWritesNoAuditRow"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus"
        status: pass
    human_judgment: false
  - id: D6
    description: "The contract (docs, OpenAPI snapshot, generated types) lists both routes and every status"
    requirement: ORD-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 105min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 20: Move photos, choose the cover and describe photos (API) Summary

**Two versioned PUT routes let staff move an order's photo (position 0 is the cover, so Make Cover is a move to 0) and set or clear its description, with the default text following the photo's place, a 409 on a stale version, a 422 on closed orders and an audit entry per change.**

## Performance

- **Duration:** about 105 min
- **Started:** 2026-11-03T19:35:00-06:00
- **Completed:** 2026-11-03T21:20:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 25 (13 source and docs, 12 tests and generated)

## Accomplishments

- `Order.MoveImage` removes and reinserts the photo in place order and renumbers 0 to n-1. It never touches `Slot`. A move to the same place returns null, so nothing is saved or audited and the version stays.
- `Order.DescribeImage` trims, checks 200 characters, and stores null for empty text or the default text of the photo's current place. A repeat of the stored text is a no-op.
- `PUT .../images/{imageId}/position` and `PUT .../images/{imageId}` run through `OrderChildWrite.SaveFormAsync`: 400 before the lookup, 409 on a stale version or a lost race, 404 for a photo not on that order, 422 for closed orders.
- Audit: `order-image.moved` (`number;from;to`), `order-image.cover-changed` (`number;cover`) and `order-image.description-changed` (`number;position;description=old>new`, encoded and cut to fit 400 characters). No detail holds a photo id or address.
- Contract: docs, authorization matrix rows, locked-write contract rows, OpenAPI snapshot and generated web types.

## Task Commits

1. **Task 1 (tracer): Make the second photo the cover** - `1336577e` (test, RED) then `73221734` (feat, GREEN)
2. **Task 2: Every move keeps positions whole** - `7fb3d782` (test; green on arrival, see below)
3. **Task 3: Describe a photo and publish the contract** - `40b2dcf6` (test, RED) then `9e15c77b` (feat, GREEN)

**Plan metadata:** the docs commit that holds this summary follows these five.

## Evidence (quoted from the runs)

- Domain: `OrderImageTests` plus `AuditActionsTests` 120 of 120 pass; full Domain project 1229 of 1229, **line 100%, branch 100% (1168 of 1168)**.
- Application: `OrderImageRequestValidatorTests` plus `OrderAuditDetailTests` 75 of 75 pass; full Application project 2154 of 2154, **line 97.1%** (gate is 95%), branch 95.2%.
- Integration: `OrderImageArrangeEndpointTests`, `AuthorizationMatrixTests`, `OpenApiSnapshotTests` and `OpenApiOrderWriteContractTests` together: 423 of 423 pass. `OrderImageArrangeEndpointTests` alone: 14 of 14 (before the Task 3 tests).
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `dotnet format Csps.slnx --verify-no-changes`: no output (clean). `dotnet build Csps.slnx`: 0 Warning(s), 0 Error(s).
- gitleaks (`protect --staged`) before each of the five commits: "no leaks found".

## TDD Gate Compliance

- **Task 1 RED (`1336577e`):** committed against compile shells (a `MoveImage` that always fails, the audit constants not yet in `All`). Domain run: 6 failed, 91 passed, all on the planned assertions: `AuditActions.All.Count should be 95 but was 93`, `All should contain "order-image.moved"`, and `A failed result has no value` from the move tests. Integration run: the two endpoint tests and the three matrix rows for the PUT position route failed with Shouldly "should be" assertions (status not 200 or not the matrix status) and `DiscoveredEndpointsAreFullyCovered` failed. The runner output was filtered to the failing test names and the first assertion line, so the full assertion text for the endpoint tests was not kept. Semantic assessment: the targets ran and failed for the intended reason (behavior not built), not for build, fixture or discovery faults. The machine classifier (`gsd_run check tdd-red-evidence`) was not run: xUnit v3 under the Microsoft Testing Platform here gave console output, not one of the supported report formats, and no report file was written. This is the same limit the 09-01 summary recorded.
- **Task 1 GREEN (`73221734`):** 97 of 97 domain tests and 364 of 364 integration tests (including the whole matrix) pass.
- **Tracer gate:** after the tracer commit the verify commands were re-run end to end and passed; expansion continued.
- **Task 2:** the plan's Task 1 action already named every domain branch (lock, not found, range, same place), so the Task 2 tests were green on arrival. That is an unexpected GREEN, investigated: the tests are right and the behavior was built in the tracer as the plan asked. To show the tests can fail, a mutation run (range check and same-place check broken in `Order.MoveImage`) failed 6 of 25 `OrderImageTests`, then the code was restored. There is no feat commit for Task 2.
- **Task 3 RED (`40b2dcf6`):** against shells (`DescribeImage` always fails, an empty validator, an empty detail string). Domain: 12 failed of 120. Application: 9 failed of 75 (for example `_describe.Validate(DescribeOrderImageRequest.Empty).Errors ... should be ["Version"]`). Integration: 16 failed of 413 (the 11 describe endpoint tests, 3 matrix rows, `DiscoveredEndpointsAreFullyCovered`, and the locked-write contract row for the describe route). A few tests (not found and locked on the describe path, the emoji cut) passed against the shells by coincidence; they carry real checks once the code exists.
- **Task 3 GREEN (`9e15c77b`):** 120 of 120, 75 of 75 and 423 of 423 pass; the snapshot was refreshed with the one-process switch.
- No REFACTOR commit was needed.

## Files Created/Modified

See the frontmatter `key-files`. The two `PUT` actions are `MoveOrderImage` and `DescribeOrderImage` on `OrderImagesController`.

## Decisions Made

- A move that changes the cover writes two audit rows in one save (`moved` and `cover-changed`). The plan text said "the cover-changed or moved audit entry" in the Task 1 action but "a move writes moved, a move to position 0 writes cover-changed" in the truths, and D-14 says moving the cover away also changes the cover. Writing both on a cover change satisfies every reading. Recorded here as the executor's reading of the plan; see "Owner decisions pending" if the owner prefers one row.
- The description error from the validator carries `orders.invalid-request` with the field error on `description`; the upload route's domain check keeps its own code `orders.image-description-too-long`. Both give the same field and message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `OrderImage.cs` changed although it is not in `files_modified`**
- **Found during:** Task 1
- **Issue:** `Position` and `Description` have private setters, so `Order` cannot move or describe a photo.
- **Fix:** two small internal methods, `MoveTo(int)` and `Describe(string?)`, in the same style as `item.Apply(...)`. No schema or mapping change.
- **Files modified:** `src/Csps.Domain/Orders/OrderImage.cs`
- **Committed in:** `73221734` and `9e15c77b`

**2. [Rule 2 - Missing critical] Two docs outside the declared list updated**
- **Found during:** Task 1 and Task 3
- **Issue:** `docs/operations/audit-log.md` is the list of every audit code and `docs/api/orders.md` holds the route table. Leaving them out would document the new codes and routes only in `order-images.md`. No other plan in this wave declares either file.
- **Fix:** added the three audit rows and the two route rows.
- **Files modified:** `docs/operations/audit-log.md`, `docs/api/orders.md`
- **Committed in:** `73221734`, `9e15c77b`

**3. [Rule 3 - Blocking] `npm ci` in `tools/openapi-gen`**
- **Found during:** Task 3
- **Issue:** `node_modules` was missing in the new worktree, so `generate` and `check` could not run.
- **Fix:** `npm --prefix tools/openapi-gen ci`, the documented install from the existing lockfile. No package was added or bumped and no package file changed. npm printed "3 moderate severity vulnerabilities" for the dev tool's existing dependencies; that is pre-existing and out of scope.

---

**Total deviations:** 3 auto-fixed (2 Rule 3, 1 Rule 2)
**Impact on plan:** none on behavior or contract. All are needed to finish the plan.

## Issues Encountered

- A first shell for `MoveImage` tripped analyzer CA1822 (member could be static); fixed by reading `EnsureEditable()` in the shell.
- A `ShouldBe(IEnumerable, string)` overload mismatch in a new domain test; fixed with the `(expected, ignoreOrder, message)` overload.
- The sandbox refused several long shell commands that mixed `git` words with heredocs; those edits were made with the edit tools instead. No effect on the result.
- Handler unit tests: `MoveOrderImageHandler` and `DescribeOrderImageHandler` have 0% unit-test line coverage (the plan lists no handler unit tests); they are covered by the 14 plus 14 endpoint tests. The Application assembly still measures 97.1% against the 95% gate.

## Known Stubs

None.

## Owner decisions pending

1. **One audit row or two for a cover change?** Today a move that changes the cover writes `order-image.moved` and `order-image.cover-changed`. Recommendation: keep both, because the log then answers "who changed the cover" with one filter and still shows every move. The other option is only `cover-changed` for a cover change, which hides the from and to places. Needs no change if you agree.
2. **Photo description text in the audit detail.** The plan asks for the old and new text in `order-image.description-changed`. Other order audit rows never carry free text (05 D-40). A description could hold a customer's name. Recommendation: keep as planned, since the plan ruled it, and revisit if staff start typing customer details there. The alternative is `fields=description` only, like order notes.

## Threat Flags

None beyond the plan's register (T-09-47 to T-09-49 are mitigated: row version on every change with a race test, photos found only through the route's order, audit entries for all three changes).

## Next Phase Readiness

- The web page wiring (plan 09-27) can call both routes; types are generated. A client builds the default description as `Order {number} photo {position + 1}`.
- Sibling plans in this wave touched other files; this plan changed `AuditActions.All` (three entries appended after `OrderImageAdded`) and `AuditActionsTests` (count now 96), which a sibling that also adds audit codes would conflict with.

## Self-Check: PASSED

- Created files exist: all 8 new source and test files found.
- Commits found in history: `1336577e`, `73221734`, `7fb3d782`, `40b2dcf6`, `9e15c77b`.
- Acceptance greps: `order-image.cover-changed` and `order-image.description-changed` in `AuditActions.cs` (1 each); `SaveFormAsync` in both handlers (1 each); `DescribeOrderImageRequest` in `api.generated.ts` (4); `move.HandleAsync` in the controller (1).

---
*Phase: 09-order-images-maintenance-jobs*
*Completed: 2026-11-03*
