---
status: fixed
trigger: "CreateUserEndpointTests.TwoCreatesWithTheSameEmailSentTogetherGiveOneAccountAndOneEmailFieldErrorEveryTime failed on PR 24 CI (run 4 of 20 answered 500) on 2026-11-10."
goal: find_and_fix
created: 2026-11-10T22:40:00-06:00
updated: 2026-11-10T23:05:00-06:00
---

# Two creates of one email: a deadlock answered 500

## What happened

The CI full run at 2c8714e9 sent two "add person" requests with the same email together, 20 times. In run 4 one answered 201 and the other 500, where a 400 "Another account already uses this email." was expected. 120 local races did not repeat it.

## Cause

`UserAccounts.CreateAsync` creates through Identity's `UserManager`, which reads (the unique email and user name checks) and saves on its own, outside `CspsUnitOfWork`. Two creates of one address can each hold an index key the other's read or insert needs, so SQL Server ends one as the deadlock victim (1205). Only the duplicate-key errors (2601, 2627) were caught, so the raw `SqlException` became a 500.

`CreateUserDeadlockTests` makes the deadlock on purpose (the victim holds a category row at low deadlock priority, the holder creates the address first and then reaches for that row) and saw the raw `SqlException` before the fix.

## Fix

- `CreateUserHandler` takes the Manager roster lock first in the create's transaction, so two creates of one address run one after the other and Identity's own check sees the address taken (the 400). A retry alone was not enough: under a heavily loaded LocalDB the race test then answered 409, because the retry lost a second deadlock to the winner's later writes.
- `UserAccounts.CreateAsync` turns a deadlock during the create into `ConcurrencyConflictException`, with the deadlock as its cause, and the handler runs the email check and the create through `ConflictRetry`. This stays as the safety net for any other deadlock. Two lost races in a row answer 409 `SessionBusy`, now declared on `POST /api/v1/users` (OpenAPI snapshot and web types regenerated).

## Related

P10-BL-22 (the order-number lock deadlock) is the same kind of gap and stays parked.
