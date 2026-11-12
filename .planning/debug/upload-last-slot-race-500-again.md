---
status: awaiting_human_verify
trigger: "OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos: the losing upload sometimes answers 500 under full-suite load (3 times in full runs on 2026-11-12), after the 2601 fix in 89d723cd."
goal: find_and_fix
created: 2026-11-12T16:15:00-06:00
updated: 2026-11-12T17:32:00-06:00
---

# Two uploads for the last photo slot: a 500 still happens under load

## Current Focus

hypothesis: CONFIRMED. The upload handler's check before storage (UploadOrderImageHandler line 59) reads the order outside ConflictRetry; a winner's save during that split read makes OrderStore.FindAsync throw ConcurrencyConflictException, which nothing catches, so the answer is 500.
test: RED tests committed in e3799fea (endpoint 500 four runs out of four; both handler tests show the escaped exception)
expecting: GREEN after the check runs through ConflictRetry with EditErrors.Stale as the busy answer
next_action: owner confirms in a full gate run that TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos no longer answers 500; then archive to resolved/ and add the knowledge-base entry
bug_class: Concurrency trigger; deterministic (Bohrbug) once the interleaving is fixed by the interceptor

reasoning_checkpoint:
  hypothesis: "The check before storage calls IOrders.FindAsync outside ConflictRetry. FindAsync throws ConcurrencyConflictException when the order's row version moves between the header read and the version re-read, so a winner's save that lands during the loser's check escapes as an unhandled exception and the exception handler answers 500."
  confirming_evidence:
    - "Stress with 6 isolated databases: 15 of 90 races answered 200/500; all 15 logged ConcurrencyConflictException 'The order was changed while it was being read.' at OrderStore.FindAsync:91 from UploadOrderImageHandler.HandleAsync:59"
    - "Deterministic endpoint test (interceptor saves the fifth photo just before the check reads the photo list) answers 500 in 4 of 4 runs"
    - "Handler unit tests with a first read that throws the conflict see the exception escape HandleAsync at line 59"
  falsification_test: "If the check is retried and the endpoint test still answers 500, or the stress still shows 500s from another place, the hypothesis is incomplete."
  fix_rationale: "The check is a read that can lose a race just like the save. Running it through ConflictRetry (FindAsync already clears the tracked state on that conflict) reads the order again, so the loser sees the winner's photo and answers the 422 photo limit; two lost reads answer the 409 the handler already uses for two lost saves. No file is stored on either path."
  blind_spots: "Deadlocks (1205) inside reads are not translated anywhere in the upload path; they did not occur in same-order races here, but they do between uploads to different orders sharing a database. That is a separate issue and is reported, not fixed."
  candidate_causes:
    - "code: precheck FindAsync outside ConflictRetry (confirmed)"
    - "environment: LocalDB load widening the window between the header read and the version re-read (contributing trigger, not a cause)"
    - "data/schema: unique slot index clash 2601 (eliminated, already translated)"
  and_gate: "yes, two conditions: the untranslated precheck conflict (code) AND a winner's save landing inside the loser's precheck window, which load makes likely. Only the first is a defect; the second is normal concurrency."

## Symptoms

expected: one 200, the other 409 or 422; exactly 5 rows, slots 0..4
actual: under full-suite load the loser sometimes answers 500
errors: 500 InternalServerError (exception not captured in the test output)
reproduction: full suite (about 9000 tests on LocalDB); alone it passes 5/5 and 20/20
started: seen before 89d723cd (fixed then for 2601); seen again 3 times on 2026-11-12

## Eliminated

- hypothesis: the photo slot unique index clash (2601) is still untranslated
  evidence: OrderStore.TranslateSaveFailure maps IX_OrderImages_OrderId_Slot to ConcurrencyConflictException (89d723cd); none of the 15 captured 500s carried a SqlException
  timestamp: 2026-11-12T16:50:00-06:00
- hypothesis: a deadlock (1205) or a failed rollback to the savepoint (3903) between the two uploads of one order
  evidence: in the isolated-database stress (6 databases, 90 races) every 500 was the precheck's ConcurrencyConflictException; no 1205 or 3903 appeared for same-order races
  timestamp: 2026-11-12T16:50:00-06:00

## Evidence

- timestamp: 2026-11-12T16:15:00-06:00
  checked: .planning/debug/upload-last-slot-race-500.md (prior session)
  found: 2601 on IX_OrderImages_OrderId_Slot is translated to ConcurrencyConflictException in OrderStore.TranslateSaveFailure
  implication: the remaining 500 comes from a different error or a different place
- timestamp: 2026-11-12T16:20:00-06:00
  checked: upload path (OrderImagesController, IdempotencyMiddleware, UploadOrderImageHandler, OrderChildWrite, ConflictRetry, OrderStore, CspsUnitOfWork)
  found: the whole request runs in the idempotency gate's transaction; the handler's precheck `orders.FindAsync` (line 59) is outside ConflictRetry; FindAsync throws ConcurrencyConflictException when the row version read after the split query differs from the header's; no global handler maps that exception, so it becomes a 500. Every other IOrders.FindAsync call in Application sits inside ConflictRetry or a catch.
  implication: a winner's save that lands during the loser's precheck gives a 500
- timestamp: 2026-11-12T16:45:00-06:00
  checked: scratch stress (not committed): 6 lanes, each its own CSPS_Test database and host, 15 same-order last-slot races per lane in parallel
  found: 200/422 = 75, 200/500 = 15. All 15 500s logged `ConcurrencyConflictException: Another request changed the same data first. ---> InvalidOperationException: The order was changed while it was being read.` at OrderStore.FindAsync line 91 called from UploadOrderImageHandler.HandleAsync line 59
  implication: H1 confirmed by direct observation; load widens the window, which is why the test passes alone
- timestamp: 2026-11-12T16:40:00-06:00
  checked: scratch stress with 4 hosts sharing ONE database (uploads to different orders at the same time)
  found: many 500s from deadlocks (1205) inside reads (precheck FindAsync, OrderReader.GetDetailAsync after the save) and 3903 "ROLLBACK TRANSACTION request has no corresponding BEGIN TRANSACTION"; order creation also answered 500 under that load
  implication: a separate cross-order deadlock problem exists (reads are not translated, and the savepoint rollback fails after a deadlock). It does not explain the suite failure (each test class has its own database). Reported as a follow-up, not fixed here.
- timestamp: 2026-11-12T16:35:00-06:00
  checked: RED tests (commit e3799fea) before the fix
  found: endpoint test answered 500 in 4 of 4 runs; both handler tests saw ConcurrencyConflictException escape HandleAsync at line 59
  implication: the bug reproduces deterministically without the full suite
- timestamp: 2026-11-12T17:00:00-06:00
  checked: after the fix, the RED tests and the isolated-database stress again
  found: handler class 12 of 12, endpoint test 3 of 3; stress 200/422 = 90 of 90 (6 lanes x 15) and 160 of 160 (8 lanes x 20), no error events logged
  implication: the loser now always gets the photo limit; the falsification test (500s from another place) did not fire

## Resolution

root_cause: "UploadOrderImageHandler checks the order before the file goes to storage with IOrders.FindAsync, outside ConflictRetry. When the winning upload's save lands while that split read runs, OrderStore.FindAsync sees the row version move and throws ConcurrencyConflictException ('The order was changed while it was being read.'). Nothing catches it, so the exception handler answers 500. Load widens the window between the header read and the version re-read, which is why it showed only in full runs."
fix: "The check runs through ConflictRetry with EditErrors.Stale as the busy answer: on a lost read the order is read again (FindAsync already cleared the tracked state), so the loser sees the winner's photo and answers the 422 photo limit; two lost reads answer the 409 the handler already gives for two lost saves. No file reaches storage on either path. No new status code or wording."
oracle_type: specified (the endpoint's documented answers: 422 orders.images-full, 409 edit.stale)
verification:
  target_test: { result: pass, detail: "endpoint test 3 of 3 after the fix; handler tests 2 of 2" }
  mutation_check: { result: pass, detail: "no Stryker in the repo; a hand-seeded mutant (busy answer null) was killed by ACheckThatSeesTheOrderChangeTwiceAnswersTheConflictBeforeAnyFileIsStored" }
  no_op_deletion: { result: pass, detail: "the diff adds a retry around the check; no behaviour removed" }
  adjacent_tests: { result: pass, detail: "OrderImagesEndpointTests 10 runs x 21 tests, Application unit 2897 of 2897, Domain unit 1809 of 1809, coverage gate PASS (Domain 100%/100%, Application line 98.1%), Server Orders folder 385 of 386; the one failure is OrderListTimingTests p95 324.5 ms over its 300 ms budget, which does not touch the upload path; re-run alone it read 320.8 ms while another session's integration run held the CPU at 100%, and passed (1 of 1) on a third run at lower load (a load flake, not fixed here)" }
  revert_and_reconfirm: { result: pass, detail: "fix reverted: handler tests 2 of 2 failed and the endpoint test answered 500; fix reapplied: green" }
  stress: { result: pass, detail: "isolated databases: 90 of 90 and 160 of 160 races answered 200/422 (before the fix 15 of 90 answered 200/500)" }
  guardrail_verdict: accepted
files_changed:
  - src/Csps.Application/Orders/UploadOrderImageHandler.cs
  - tests/Csps.Application.UnitTests/Orders/UploadOrderImageCompensationTests.cs
  - tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs
