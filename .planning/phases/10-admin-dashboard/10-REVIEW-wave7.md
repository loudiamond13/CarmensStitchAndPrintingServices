---
phase: 10-admin-dashboard
wave: 7
plans: [10-14, 10-15]
created: 2026-11-07T21:30:00-06:00
updated: 2026-11-07T21:45:00-06:00
reviewed_range: 16ed4992..a606baa0 (excluding .planning/)
depth: deep
files_reviewed: 50
findings:
  critical: 0
  warning: 4
  info: 8
  total: 12
status: issues_found
---

# Phase 10 Wave 7 Code Review (plans 10-14 and 10-15)

*Created: 2026-11-07T21:30:00-06:00 · Updated: 2026-11-07T21:30:00-06:00*

## Summary

I reviewed the ledger read (10-14: union with transfers, reader, details, handler, running balance, controller, matrix row, docs, contract) and the transfer window (10-15: schema, window, button, hooks, refresh keys, business today, e2e), and checked each claim against its tests.

What holds:

- **Running balance.** It is right across pages and on ties. All ordering, `Take` and `Skip` happen in SQL, so the `SourceId` tie-break uses SQL Server's uniqueidentifier order, and the query tests build their expected order with `SqlGuid`.
- **D-105.** The page, the newer-rows sum, the count, the balance and the detail reads run in one serializable EF transaction. The race test fails when the isolation is lowered.
- **Query filters and SQL.** No filter is lifted, and there is no inline SQL.
- **Deleted transfers.** They count as `Signed 0` everywhere, and an Admin is refused before any read.
- **Another person's id.** It is refused until 10-16, and HTTP cannot reach that branch.
- **Matrix and policy.** The matrix row is 401/200/200, and the policy is `Staff`.
- **Validator.** The zod amount, date and note rules match the server's words and limits, apart from IN-04.
- **Idempotency.** The keys follow `useSubmission`: a new key after a 400, the same key after a 5xx or a 409, and the server does not store a 409.
- **Refresh keys.** `['staff-money']`, `['money-transfers']` and `['dashboard']` are invalidated by transfers, order writes and expense writes.
- **Strip.** The LoadingRegion still wraps only the label and figure, and Transfer and its reason sit outside it.
- **Long dashes.** No em or en dash was added under `web/src` or `web/e2e`.

No critical issue was found. Four warnings and eight info items follow.

## Critical

None.

## Warning

### WR-01: The serializable ledger read has no deadlock-victim handling, so a ledger page can answer 500 while a coworker records money

**File:** `src/Csps.Infrastructure/Money/StaffMoneyReader.cs:90-106`

**Issue:** `GetLedgerPageAsync` opens `BeginTransactionAsync(IsolationLevel.Serializable)` and runs eight or nine statements. Serializable keeps shared range locks on the person's rows in `OrderPayments`, `OrderRefunds`, `OrderExpenses`, `CompanyExpenses` and `MoneyTransfers` until commit. It also keeps shared locks on the `Orders` rows that the SoftDelete filter joins. Order writers run at read committed: they update the `Orders` row (row version) and insert or update payment, refund or expense rows. These two lock orders cross, which is the classic serializable-reader against read-committed-writer deadlock. The reader writes no log, so SQL Server normally makes it the victim (error 1205). Every write path in this codebase catches `SqlErrors.DeadlockVictim` (`CspsUnitOfWork.cs:37-45`, `OrderStore.cs:103`, `DatabaseLocks.cs:91`, `IdempotencyGate.cs:356`). The new reader does not, so the exception reaches the controller and the person sees "Something went wrong. Reference: ...". D-105 accepted the blocking, not a failed read.

**Failure scenario:**

1. Liza opens My Money, which reads `GET /staff-money/me/ledger?page=1&pageSize=20`.
2. Statement 1 (the page union) scans Liza's payments with RangeS-S locks.
3. At the same moment Carmen records a payment received by Liza on order O. Her transaction already holds X on order O's row and now needs RangeI-N in Liza's `IX_OrderPayments_ReceivedByUserId` range.
4. The reader's join (or its later count and sums statements) needs S on order O.
5. The two transactions deadlock. The reader is chosen as victim, and Liza's GET answers 500. This gets more likely as the shop grows and on the 10-17 screen, which reads the ledger on every visit and after every refresh.

**Fix:** Retry the whole read on a deadlock, inside the reader. The read is side-effect free, so a retry is safe. This uses no inline SQL and no database option change.

```csharp
public async Task<LedgerPage> GetLedgerPageAsync(Guid userId, int page, int pageSize, bool includeDeleted, CancellationToken cancellationToken)
{
    if (context.Database.CurrentTransaction is not null)
    {
        return await ReadLedgerPageAsync(userId, page, pageSize, includeDeleted, cancellationToken).ConfigureAwait(false);
    }

    for (var attempt = 1; ; attempt++)
    {
        try
        {
            var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken).ConfigureAwait(false);
            await using (transaction.ConfigureAwait(false))
            {
                var result = await ReadLedgerPageAsync(userId, page, pageSize, includeDeleted, cancellationToken).ConfigureAwait(false);
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                return result;
            }
        }
        catch (Exception error) when (attempt < 3 && SqlErrors.Has(error, SqlErrors.DeadlockVictim))
        {
            // A read lost a deadlock to a writer; reading again is safe.
        }
    }
}
```

Add a test for it. A `DbCommandInterceptor` that throws a 1205 `SqlException` on the first reader command can prove that the second attempt answers.

### WR-02: After a To refusal, the window can show "Choose a coworker" while the next submit still sends the refused person's id

**Files:** `web/src/modules/admin/components/TransferModal.tsx:183`, `:231-234`, `:264`; `web/src/modules/admin/moneySchemas.ts:53`

**Issue:** On a `toUserId` refusal the window calls `onRefreshPeople()`. When the refused person is no longer offered, the refetched list drops them. This happens to a recipient deactivated meanwhile who is owed nothing, which the D-56 list leaves out. The form state still holds their id. The shared `Select` renders a non-disabled placeholder option (`components/forms/Select.tsx:86-88`). React selects the first non-disabled option when the controlled value matches none, so the box shows "Choose a coworker" while `field.value` is the old id. The schema only checks `z.string().min(1)`, so a second Record Transfer passes the browser check and posts the hidden id. This breaks OR-3, because the browser does not catch what it can see is wrong. Every retry also earns another 400. If the person is made active again in the meantime, the transfer goes to someone the screen does not show as chosen.

**Failure scenario:**

1. Carmen chooses Liza and types 100.
2. Liza is deactivated with nothing owed.
3. Carmen presses Record Transfer. The server answers 400 under `toUserId` with "Liza Mercado can't receive transfers now. Choose someone else.", and the people are read again without Liza.
4. To now reads "Choose a coworker", but pressing Record Transfer again posts `{ toUserId: <Liza's id>, ... }`.
5. A Manager reactivates Liza, and Carmen presses Record Transfer once more. The ₱100.00 goes to Liza although no recipient is shown as chosen.

**Fix:** Clear the field when the chosen id leaves the list, and make the schema refuse an id the list does not hold.

```tsx
// TransferForm
const { setValue, getValues } = useForm(...);
useEffect(() => {
  if (!recipients.isSuccess) return;
  const chosen = getValues('toUserId');
  if (chosen !== '' && !(recipients.data ?? []).some((person) => person.id === chosen)) {
    setValue('toUserId', '', { shouldDirty: true });
  }
}, [recipients.isSuccess, recipients.data, getValues, setValue]);
```

The server line can stay as the field error until the person picks again. Add a window test in which the second recipients answer drops Liza. It should check that To shows the placeholder and that Record Transfer sends nothing and shows "Choose who got the cash.".

### WR-03: A transfer that failed in a way that may have saved leaves the strip and My Money showing the old balance

**Files:** `web/src/modules/admin/hooks/useTransferAction.ts:29-42`, `web/src/modules/admin/components/TransferModal.tsx:170-198`

**Issue:** `refreshMoney()` runs only in `onSuccess`. `useSubmission` treats a 5xx, a 408, a timeout or a dropped connection as "may have run" and keeps the key for exactly that reason. The window still never marks the money answers old after such a failure. The query defaults have `staleTime: 30_000` (`useMyMoneyQuery` overrides it to 0 but sets no refetch trigger), and the only refetch triggers are a new mount or window focus. So after a failed submit the strip keeps the pre-transfer figure until something else causes a read. That breaks the Core Value: staff "always see correct, server-computed totals and balances". It also invites a duplicate. Once the window is closed, its `useSubmission` state and key are gone. A second attempt from the strip starts a new key. The reopened window does refetch `['staff-money','me']`, but until that answer lands the description and the cap still use the old figure.

**Failure scenario:**

1. Sela holds ₱5,000.00 and sends ₱1,250.50.
2. The server commits, but the response is lost (a proxy 502, or the phone drops off Wi-Fi). The window shows "Something went wrong. Please try again."
3. Sela presses Cancel, then Discard. The strip still reads ₱5,000.00, so she believes nothing happened.
4. She presses Transfer again and types 1,250.50 at once (the old ₱5,000.00 is still in the description while the refetch runs).
5. The submit goes out under a new key, and a second transfer is recorded.

**Fix:** Mark the money answers old after any failure that may have run, and keep the toast and banner as they are.

```ts
// useTransferAction.ts
...(onFailure === undefined ? {} : { onFailure }),
// becomes
onFailure: (copy, error) => {
  if (!isHttpError(error) || error.kind !== 'http' || error.status >= 500 || error.status === 408) {
    void refreshMoney();
  }
  onFailure?.(copy, error);
},
```

Add a window test: a 500 then a re-read of `GET /staff-money/me` (the `mine` call count grows) and the strip figure updates.

### WR-04: Several claimed transfer-window behaviors have no assertion that would catch a regression

**Files:** `web/src/modules/admin/components/TransferModal.test.tsx:422-437`, `:464-489`; 10-15-SUMMARY coverage D4 and D1

**Issue:** The SUMMARY marks these behaviors as proved, but the tests would pass if the code broke:

- **(a) The busy toast's tone.** "A 409 busy shows the server line as a **danger** toast" checks only that the text is visible (`findByText('Something changed at the same time. Try again.')`). Changing `tone: 'danger'` to `'success'` (`TransferModal.tsx:193`) passes.
- **(b) Retry after a 409.** Keeping the same Idempotency-Key on a retry after a 409 is the one case where reuse matters most (the server stores no answer for a 409), and no window test covers it. `useSubmission` changes that drop 409 from `mayHaveRun` would go unnoticed at this layer.
- **(c) The scrim.** The test is named "...ignores Esc **and the scrim**", but only Esc is pressed. The scrim is never clicked.
- **(d) A fresh balance on open.** "The cap uses the balance from a fresh read when the window opens" (plan Task 1 action) has no test. Every window test serves the same balance before and after open. If `useMyMoneyQuery` lost `refetchOnMount: 'always'`, or the window used the strip's held answer, every window test would still pass.

**Failure scenario:** Someone changes the busy toast tone, or `mayHaveRun` stops counting 409. Or the window stops re-reading the balance on open: the strip read ₱8,450.00 ten minutes ago, the person now holds ₱3,200.00, and the window's cap lets ₱5,000.00 through to a server refusal. In each case the whole suite stays green.

**Fix:**

- **(a)** Assert the toast's danger marker (its role or tone class, as the other danger-toast tests do).
- **(b)** Answer the first POST with `transferBusyProblem()` and the second with 201. Press Record Transfer twice and assert `sent.keys[1] === sent.keys[0]`.
- **(c)** Click the scrim while pending and assert that the dialog stays.
- **(d)** Serve 8,450 on the first `GET /staff-money/me` and 3,200 on the second. Open the window and assert that the description says ₱3,200.00 and that typing 5000 shows "You only have ₱3,200.00 on hand." with no request sent.

## Info

### IN-01: Joining a caller's transaction silently drops the D-105 guarantee

**File:** `src/Csps.Infrastructure/Money/StaffMoneyReader.cs:94-97`

**Issue:** When `CurrentTransaction` is not null, the reader runs inside it, whatever its isolation level. No caller does this today. A later caller that wraps the read in a read-committed transaction (for example an export or a 10-16 handler that also writes an audit row) would bring back the disagreeing-figures bug without any test noticing. This branch has no test.

**Failure scenario:** A future handler opens a default (read-committed) transaction and calls `GetLedgerPageAsync`. A row recorded between the page read and the count gives `total` 26 with 25 rows, and the page 2 `balanceAfter` figures are off by that row.

**Fix:** Refuse a weaker ambient transaction. Check `context.Database.CurrentTransaction.GetDbTransaction().IsolationLevel == IsolationLevel.Serializable` and throw an `InvalidOperationException` otherwise. Or delete the branch until a caller needs it.

### IN-02: The docs promise that pages never skip or repeat a row; offset paging does not keep that promise

**File:** `docs/api/staff-money.md:239-241`

**Issue:** "...so pages never skip or repeat a row." Each page is a separate request with `Skip((page-1)*pageSize)`. A row recorded between two page requests shifts every older row down one place. A back-dated payment also changes the `balanceAfter` of newer rows on later pages. The tie-break makes one read stable. It does not make a sequence of reads stable.

**Failure scenario:** Liza reads page 1 (rows 1 to 10). Carmen then transfers her ₱500.00. Page 2 now starts with the row that was row 10 on page 1, so that row appears twice. The 10-17 screen and the Android client cannot rely on the docs here.

**Fix:** Say "within one read the order is stable. Between page requests, a newly recorded row can shift rows to the next page." Alternatively, plan keyset paging for 10-17.

### IN-03: A malformed `deleted`, `page` or `pageSize` value is silently replaced by its default

**File:** `src/Csps.Server/Controllers/StaffMoneyController.cs:55-62`

**Issue:** With `SuppressModelStateInvalidFilter`, a value that fails binding keeps the C# default. So `?deleted=1` or `?deleted=yes` gives `false`, and `?pageSize=abc` gives 20. Nothing leaks: an Admin probing with `deleted=1` just gets the normal ledger. But SEC-03 and CWE-20 expect a 400 for bad list input, and the 10-17 or Android client gets no signal. The other list controllers share this pattern, so it is not new to this wave.

**Failure scenario:** The Android app sends `deleted=1` for a Manager. It gets `includesDeleted: false` and no deleted rows, with no error.

**Fix:** Bind the three parameters as strings and parse them in the request validator. Or check `ModelState` for these parameters and map a failure to the shared list message. Track this with the other list endpoints rather than fixing only this one.

### IN-04: "0.000" gets a different message in the browser than on the server

**File:** `web/src/modules/admin/moneySchemas.ts:42`

**Issue:** The browser checks decimals before the minimum. The server validator checks `amount > 0` before the scale (`CreateMoneyTransferRequestValidator.cs:24-28`, `CascadeMode.Stop`). OR-3 asks the browser to say the server's words.

**Failure scenario:** Typing `0.000` in the browser shows "Use at most 2 decimal places.". The server, given 0.000, answers "Enter an amount of at least ₱0.01.".

**Fix:** Check `centavos < 1` for zero-valued text before the decimals check, or test the decimals only when the value is above zero. Add the case to `moneySchemas.test.ts`.

### IN-05: The e2e checks the second person for console errors only, not for CSP findings or failed responses

**File:** `web/e2e/money.spec.ts:25-44`, `:97-110`

**Issue:** The plan's e2e says "no console or CSP finding". The second context (Rina) gets its own listeners for console errors and page errors. It does not get the shared guard's CSP violation and failed-response checks. A CSP violation on the receiver's dashboard, or a 4xx or 5xx response there, would not fail the test.

**Failure scenario:** A CSP regression that only shows on a freshly signed-in Admin dashboard passes the `@money` journey.

**Fix:** Reuse the fixture's guard for the second page (export a `watchPage(page)` helper from `fixtures.ts`), or attach the same `securitypolicyviolation` and response listeners.

### IN-06: The deleted-row running-balance unit test cannot tell "skip" from "subtract"

**File:** `tests/Csps.Application.UnitTests/Money/LedgerRunningBalanceTests.cs:22-39`, `:64-65`

**Issue:** `DeletedRow()` has `SignedAmount` 0. So a version of `Apply` that subtracts the deleted row's amount gives the same balances as the version that skips it, and only the `null` is proven. The guarantee that matters ("a deleted row changes nothing") currently depends on the union always giving deleted rows `Signed 0`.

**Failure scenario:** Someone changes the union so a deleted transfer carries its face amount in `Signed` (the D9 question invites this) and removes the `continue`. All six unit tests still pass, and every balance under a deleted row is off by its amount.

**Fix:** Give `DeletedRow()` a nonzero `SignedAmount` (for example 500.00m) in one test and keep the expected balances. That pins down that `Apply` skips a deleted row whatever its amount.

### IN-07: An aria-disabled Transfer while the figure loads or failed gives a keyboard user no reason

**File:** `web/src/modules/admin/components/TransferButton.tsx:117-122`, `:149-162`

**Issue:** While loading or after a failure, the button is aria-disabled with no `aria-describedby`, and Enter does nothing. The plan scoped the visible reason to the at-or-below-zero case. P8 D-14 ("disabled controls show a visible reason") is broader. A screen-reader user hears "Transfer, dimmed" with no explanation. This is a parked-adjacent area (P10-BL-04 covers the failed refresh display), so it is noted only for the 10-21 sweep.

**Failure scenario:** The money read fails on a slow phone. A keyboard user tabs to Transfer, presses Enter, and nothing happens or is announced.

**Fix:** Point `aria-describedby` at the strip's or card's own loading or failure line while `blocked && !nothingOnHand`. Or record an owner ruling that the region status is enough.

### IN-08: The window's business today never moves on while the window stays open

**File:** `web/src/modules/admin/components/TransferModal.tsx:80-83`

**Issue:** `today` is kept once known (on purpose, so the save does not swap in a skeleton). A window left open across Manila midnight keeps yesterday as the Date default and as the future-date limit. The server accepts yesterday, so the transfer is recorded on the wrong day without anyone being told.

**Failure scenario:** Carmen opens Transfer at 23:58 on Nov 7, is interrupted, and presses Record Transfer at 00:05 on Nov 8. The transfer is dated 2026-11-07.

**Fix:** Accept a newer held day while the form is clean (`!isDirty`), so the default follows the server. Or note the behavior in the 10-21 UAT list as accepted.

---

_Reviewed: 2026-11-07T21:30:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

## Outcomes

| Finding | Outcome |
|---|---|
| WR-01 | Fix now: the serializable ledger read retries a deadlock-victim error up to three times inside the reader, following the existing write-path retry. |
| WR-02 | Fix now: when the re-read people list no longer holds the chosen person, the To value is cleared, so the hidden id can never be sent. |
| WR-03 | Fix now: after any failure that may have saved (5xx, 408, timeout, lost connection) the money answers are marked old and re-read. Keeping one key across a closed and reopened window is the same question for orders and expenses; it goes to the phase-end code review. |
| WR-04 | Fix now: assertions for the danger busy toast, the same key on a retry after a 409, the scrim ignored while saving, and a fresh balance read when the window opens; each proved by a mutation. |
| IN-01 | Fix now: the reader refuses to join an outer transaction (it fails loudly), with a test. |
| IN-02 | Fix now: the API doc says what offset paging does promise. |
| IN-03 | Deferred to the phase-end code review: the other list controllers share this pattern, so they change together. |
| IN-04 | Fix now: the browser checks the minimum amount before the decimal places, so "0.000" shows the server's "Enter an amount of at least ₱0.01.". |
| IN-05 | Fix now: the e2e second person's page uses the same guard as the first (CSP findings and failed responses too). |
| IN-06 | Fix now: the deleted-row running-balance test uses a non-zero amount. |
| IN-07 | Deferred to the plan 10-21 review: the reason wording while the figure loads or failed needs new copy (sits next to P10-BL-04). |
| IN-08 | Deferred to the phase-end code review: re-read the business today when the window opens. Past dates are valid, so nothing wrong is saved meanwhile. |
