---
phase: 07-order-domain-api
created: 2026-10-28T23:30:00-05:00
updated: 2026-10-28T23:30:00-05:00
review_path: .planning/phases/07-order-domain-api/07-REVIEW.md
rulings: D-46, D-49 (owner, 2026-10-28)
findings: 31
fixed: 25
deferred: 4
accepted: 2
---

# Phase 7 Code Review Disposition

Every finding in `07-REVIEW.md` has one outcome below. A fix has a red-test commit and a green commit; a short hash is given for each. A fix that only changes words, comments or dead code has one commit and no test, because there is no behavior to test first.

Counts: 31 findings, 25 fixed, 4 deferred, 2 accepted. Every critical and warning finding is fixed or accepted by the owner (APO-WR-02, D-49c).

## Findings

| Id | Severity | Outcome | Commit or reason |
|---|---|---|---|
| DOM-CR-01 | Critical | fixed | Red `6ce12673`, green `d37d9d77`. Removing a payment, or lowering one, that would leave paid below refunded is refused with 422 `orders.payment-below-refunds` and the owner's wording (D-49a). Import keeps refunds as they were (D-47), so it is not judged. Documented in `docs/api/orders.md`. |
| IWB-CR-01 | Critical | fixed | Red `8d6a4388`, green `d779f35b`. The product type filter no longer lifts the soft-delete filter of the outer query. |
| DOM-WR-01 | Warning | fixed | Red `b7bf6854`, green `b161542f`. `AddItem` runs the same discount cap check as `UpdateItem`. |
| DOM-WR-02 | Warning | fixed | Red `5955cb5d`, green `522c93a3`. Under the strict import rules the status history must chain, run in time order, end in the order's status and have no same-status row. The default rules still accept any history. Phase 7.1 decides any relaxation (noted in `OrderImportRules` and `docs/api/orders.md`). `StatusChangedAtUtc` needed no change: on a checked history the last row is also the latest. |
| DOM-WR-03 | Warning | fixed | Red `0b51328b`, green `2ac51422`, branch coverage `afe5e4b1`. An amount, a line total or a worked-out figure above what a `decimal(18,2)` column holds is a field error under every rules instance, and a percentage that overflows a decimal is a field error on `discounts`. |
| DOM-WR-04 | Warning | fixed | Red `a415cbd6`, green `514649d8`, branch coverage `afe5e4b1`. Edits of details, items, discounts, payments, expenses and refunds re-check only the fields they change (D-49b). The domain and the six edit handlers both apply it; a handler reads the order only when the form fails. The D-05 lock, the discount cap, the payment balance cap and the refund caps are unchanged. The due date is still required on a details edit (D-22). Marked for a human check: a logic change. |
| APO-WR-01 | Warning | fixed | Red `89bcef94`, green `529510b1`. A deadlock inside the idempotency transaction's savepoint is a lost race (409), not a failed rollback (500), and `ConflictRetry` answers busy at once instead of retrying in a dead transaction. Proved with a real two-connection deadlock, which showed "The ROLLBACK TRANSACTION request has no corresponding BEGIN TRANSACTION" before the fix. Marked for a human check: concurrency logic. |
| APO-WR-02 | Warning | accepted | Owner ruling D-49c: a full create body keeps its single `order.created` audit entry; no per-child entries. |
| APX-WR-01 | Warning | fixed | Red `6d46cd1b`, green `5a34caf4`. A list entry create that loses a deadlock answers 409 `auth.session-busy`, the same code the other list writes use (see APX-IN-04), and is not retried. |
| IWB-WR-01 | Warning | fixed | Red `94b9b4b6`, green `d2d4bc75`. The audit viewer reads a first due date as "Due date: Not set to Nov 18, 2026" (D-49d). |
| IWB-WR-02 | Warning | fixed | Red `9a6e52dc`, green `2dea35a1`. Every order write declares the 422 `orders.locked` answer and says so in its docs; payment changes also name `orders.payment-below-refunds`. The OpenAPI snapshot and generated types were refreshed in the documented order. |
| IWB-WR-03 | Warning | fixed | Red `9a6e52dc`, green `2dea35a1`. Renaming Others is documented as a 400 on `name`, and the 422 is no longer declared on the update action. |
| IWB-WR-04 | Warning | fixed | Red `69f31d70`, green `13ccadfb`. The order detail read checks the row version after the lists, as `OrderStore.FindAsync` does, and reads again (up to three attempts) when a save landed. It now runs eight statements, not seven. |
| DOM-IN-01 | Info | deferred | The error path style (`items[3].quantity` against `quantity`) is a Phase 8 form-mapping concern. My new item checks keep the existing paths. |
| DOM-IN-02 | Info | fixed | Red `d43e3ea6`, green `541276ae`. Import drops spaces around the order number, and `OrderNumber.TryParse` refuses sequence 0 and year 0. |
| DOM-IN-03 | Info | fixed | Red `596a5733`, green `d40c19f6`. Import checks throw `ArgumentNullException` for a missing snapshot list. |
| DOM-IN-04 | Info | fixed | `a3f7edb8`. "An order expense category" and "cancelled" in the audit action summaries. Words only. |
| APO-IN-01 | Info | fixed | Red `dfb84f8c`, green `64303d3d`. An import whose list entry is deleted during the save answers a 400 on `items`, `payments` or `expenses`. |
| APO-IN-02 | Info | deferred | The time gap between the retired and eligibility checks and the save is low risk: a just-retired value on one row, and no foreign key can fail. |
| APO-IN-03 | Info | fixed | `2dea35a1`, with IWB-WR-02. The handler `<returns>` docs name the locked 422 (and the 20-discount cap), and the create validator cites D-01 and D-02. |
| APO-IN-04 | Info | fixed | `e558c38a`. The order audit target type is defined once in `OrderAuditDetail`. Refactor only. |
| APX-IN-01 | Info | deferred | The audit lines leave out the current payer, receiver, refunder and the created total. The owner decides in the Phase 8 UI review. |
| APX-IN-02 | Info | fixed | Red `a2fe2b8b`, green `b72f0c70`. The audit reader leaves out a category tone that is not one of the six. |
| APX-IN-03 | Info | fixed | `d8b5e5e7`. The audit port docs list the order and list target types and the D-48 match. Comments only. |
| APX-IN-04 | Info | deferred | `auth.session-busy` is shared with Phase 6 and with all list handlers. A list-scoped busy code is a contract change across both phases. Question for the owner: should the list writes get their own busy code? APX-WR-01 uses the existing shared code. |
| APX-IN-05 | Info | fixed | `7ce5f21d`. Removed the unused `NameField` and `VersionField` constants. Dead code only. |
| APX-IN-06 | Info | fixed | Red `93fa62f5`, green `299415ae`. The descriptor names the order expense categories explicitly and throws for an unknown list. |
| IWB-IN-01 | Info | fixed | `13ccadfb`, with IWB-WR-04. The `OrderReader` summary gives the real statement count. |
| IWB-IN-02 | Info | fixed | Red `03ff8fae`, green `63a11302`. A lock wait that times out or loses a deadlock is a `ConcurrencyConflictException`. |
| IWB-IN-03 | Info | fixed | Red `537d7745`, green `1148e104`. The testing order route answers 400 for a null list member. |
| IWB-IN-04 | Info | accepted | The seed phone number `0917 123 4567` is the UI spec's own sample (owner). |

## Verification

Run on the main tree, branch `gsd/phase-07-order-domain-api`, after the last fix:

- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 5915 tests, 5914 passed, 1 skipped (the live Pwned Passwords test), 0 failed.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain 100% line and 100% branch, Csps.Application 99.1% line. Passed.
- `npm --prefix tools/openapi-gen run check`: generated types match the snapshot.
- Web: typecheck, lint (`--max-warnings 0`) and `prettier --check` clean; `npx vitest run` 202 files, 6034 tests passed.
- No package, migration, schema change or trigger was added.
