---
created: 2026-11-13T21:55:00-06:00
updated: 2026-11-13T21:55:00-06:00
phase: quick-261113-tiq
plan: 01
subsystem: orders, public-gallery
tags: [orders, soft-delete, restore, public-website, consent, audit]
requires: [D-P11-BL-29, D-41, D-11, D-15]
provides: "A delete takes a shown order off the website; a restore never puts it back"
affects: [ORD-06, GAL-03, PUB-03]
key-files:
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Application/Orders/DeleteOrderHandler.cs
    - src/Csps.Application/Orders/RestoreOrderHandler.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs
    - .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md
    - .planning/phases/11-public-site-content-management/11-VERIFICATION.md
decisions:
  - "D-P11-BL-29 built: SoftDelete and Restore clear the shown date in the Domain, both handlers remove the gallery entry and record order.taken-off-website"
status: complete
commits: 3
plan_head_before: 64843bfc7fbff7777959ce1a092ddf37741bdc62
plan_head_after: c0268c59b7c861f0dbf0382c33a6ee3a7a60789f
actuals:
  tokens: 14000
  tasks: 3
  commits: 3
---

# Quick 261113-tiq: Deleting an order turns "Show on the website" off Summary

A delete now takes a shown order off the website (shown date cleared, gallery entry removed, customer's OK kept, one `order.taken-off-website` entry after `order.deleted`), and a restore never puts it back, including an order deleted while shown before this change.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 2c7298aa | fix(11): take a shown order off the website when it is deleted (D-P11-BL-29) |
| 2 | 7cd52e75 | fix(11): a restore takes off an order that was deleted while shown (D-P11-BL-29) |
| 3 | c0268c59 | docs(11): record that D-P11-BL-29 is built and park the delete and restore wording |

## RED then GREEN

Task 1 RED:
- Domain: `DeletingAShownOrderTurnsShowingOffKeepsTheOkAndARestoreDoesNotPutItBack` failed `order.IsShownOnWebsite should be False but was True` (1 failed of 1897).
- Application: compile error `CS1729: 'DeleteOrderHandler' does not contain a constructor that takes 6 arguments`.
- Server: `DeletingAShownOrderTakesItOff...` failed `stored.ShownSince should be null but was 11/14/2026 3:34:03 AM +00:00`; `EveryWriteToAShownOrderClearsThePublicCache` failed `should be ["restore"] but was []` (2 failed of 30).

Task 1 GREEN: build 0 warnings 0 errors; `dotnet format --verify-no-changes` exit 0; Domain 1897 passed; Application 3036 passed; Server `OrderPublicSettingsEndpointTests` + `PublicCacheInvalidationTests` + `OrderDeletionTests` 44 passed, 0 failed.

Task 2 RED:
- Domain: `RestoringAnOrderDeletedWhileStillShownTurnsShowingOffAndKeepsTheOk` failed `order.IsShownOnWebsite should be False but was True`.
- Application: compile error `CS1729: 'RestoreOrderHandler' does not contain a constructor that takes 5 arguments`.
- Server: `RestoringAnOrderDeletedWhileStillShownTakesItOff...` failed `shownOnWebsite should be False but was True` (1 failed of 19).

Task 2 GREEN: build 0 warnings 0 errors; format exit 0; Domain 1900 passed; Application 3037 passed; Architecture 290 passed; Server `OrderPublicSettingsEndpointTests` + `PublicCacheInvalidationTests` + `OrderDeletionTests` + `OrderAuditViewerTests` 56 passed, 0 failed.

## Coverage gate (Invoke-CoverageGate.ps1)

- Csps.Domain: line 100% (4227/4227), branch 100% (1813/1813), PASS.
- Csps.Application: line 98% (11569/11794), PASS (rule 95%).

## Deviations from Plan

**1. [Rule 3 - Blocking] Domain coverage gate failed on a line this task did not touch**
- **Found during:** Task 2 verify (coverage gate).
- **Issue:** `Order.IsShownWithoutName` (Order.cs line 186) had 0 of 4 branches covered by Domain tests (only Application tests reach it), so Domain read line 99.9% and branch 99.7% and the gate failed. No Domain test calls it, and nothing this plan changed touches it, so the gap was already there.
- **Fix:** added `AShownOrderIsWithoutANameOnlyWhenBothThePublicNameAndTheTeamNameAreBlank` to `OrderPublicSettingsTests.cs` (a file already in the plan). No production change.
- **Commit:** 7cd52e75

Otherwise the plan ran as written. No schema, migration, trigger, inline SQL, package or web change.

## Notes

- No flakes seen. Every database-backed run was preceded by the preflight (all ports free, no other dev or test processes).
- No stubs, no new network surface, no threat flags. T-tiq-01 to T-tiq-06 are mitigated as the plan listed (Domain rule, gallery entry removal, audit entry after the main entry, number-only audit detail, cache cleared by the existing interceptor).
- Not committed, by instruction: this SUMMARY, STATE.md and the PLAN. ROADMAP.md not updated.

## Open for the owner

- **P11-BL-63** (parked in `DECISIONS.md`): words about the website when an order is deleted or restored. Built as option A (no new words, the order card reads "Not shown" as after a cancel). Option B: the owner gives the wording for the restore message and optionally the delete question. No wording was proposed.

## Self-Check: PASSED

Commits 2c7298aa, 7cd52e75 and c0268c59 are on the branch; the nine files in `key-files` were changed as listed.
