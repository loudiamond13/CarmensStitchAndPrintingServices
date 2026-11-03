# Phase 9 deferred items

*Created: 2026-11-03T07:20:00-05:00 · Updated: 2026-11-03T07:20:00-05:00*

Out-of-scope findings from plan execution. They are not fixed in the plan that found them.

## From plan 09-01

- **`ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData` fails on this machine before any Phase 9 change.** The "five years, last page, size 100" p95 was 357.3 ms on commit `9cae8634` (before plan 09-01), 313.1 ms and 334.5 ms after it, against a 300 ms limit. It reads company expenses only. Likely the shared machine (another project runs on it) or a slow local disk. Needs the owner's call on whether to loosen the limit or only run it in CI.
- **`OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders`** failed once in a full 9 minute run of the Server integration tests and passed when run alone. Recorded as a load-sensitive flake, not hidden.
