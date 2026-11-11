---
status: fixed
trigger: "OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos answered 500 on PR 24 CI at 1abf5087 (2026-11-11)."
goal: find_and_fix
created: 2026-11-11T01:40:00-06:00
updated: 2026-11-11T01:40:00-06:00
---

# Two uploads for the last photo slot: one answered 500

## What happened

Two photo uploads for an order's fifth slot, sent together, should give one 200 and one 409 or 422. On CI one answered 500.

## Cause

Both uploads read the order with four photos and pick slot 4. When the loser's save reached the photo insert before the order's version check, the unique index `IX_OrderImages_OrderId_Slot` refused it (2601). `OrderStore.TranslateSaveFailure` only translated the order number index, so the raw `DbUpdateException` became a 500. When the version check came first, the save was already a lost race, which is why it was rare.

## Fix

`OrderStore.TranslateSaveFailure` turns a clash on the photo slot index into `ConcurrencyConflictException`. The upload's `ConflictRetry` then reads the order again, finds five photos and answers the photo limit (422). A duplicate key ends only the statement, so the retry also works inside the idempotency gate's transaction.

Test first: `OrderImageSchemaTests.ASaveThatLosesTheSlotToAnotherUploadIsALostRaceSoTheCallerReadsTheOrderAgain` takes the slot behind a loaded order and saw the raw `DbUpdateException` before the fix.
