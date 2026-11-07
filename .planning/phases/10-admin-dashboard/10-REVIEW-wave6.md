---
phase: 10-admin-dashboard
created: 2026-11-07T15:41:00-05:00
updated: 2026-11-07T16:45:00-05:00
reviewed: 2026-11-07T15:41:00-05:00
scope: "wave 6: plan 10-12 and plan 10-13 (git diff 8f2dd1ff..6ce241cc), .planning/ excluded"
depth: standard
advisory: true
files_reviewed: 57
files_reviewed_list:
  - docs/api/staff-money.md
  - docs/operations/audit-log.md
  - src/Csps.Application/Audit/AuditChangeLines.cs
  - src/Csps.Application/Money/CreateMoneyHandoverRequest.cs
  - src/Csps.Application/Money/CreateMoneyHandoverRequestValidator.cs
  - src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs
  - src/Csps.Application/Money/HandOverMoneyHandler.cs
  - src/Csps.Application/Money/ListTransferRecipientsHandler.cs
  - src/Csps.Application/Money/MoneyAuditDetail.cs
  - src/Csps.Application/Money/MoneyErrors.cs
  - src/Csps.Application/Money/MoneyParties.cs
  - src/Csps.Application/Money/StaffPerson.cs
  - src/Csps.Application/Money/TransferRecipientResponse.cs
  - src/Csps.Application/Ports/IStaffMoneyReader.cs
  - src/Csps.Infrastructure/Money/StaffMoneyReader.cs
  - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
  - src/Csps.Server/Controllers/MoneyTransfersController.cs
  - tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs
  - tests/Csps.Application.UnitTests/Money/HandOverMoneyHandlerTests.cs
  - tests/Csps.Application.UnitTests/Money/ListTransferRecipientsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Money/MoneyAuditDetailTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyTransferConcurrencyTests.cs
  - tests/Csps.Server.IntegrationTests/Money/TransferRecipientsEndpointTests.cs
  - tools/openapi-gen/openapi.v1.json
  - web/src/components/index.test.ts
  - web/src/components/navigation/Sidebar.test.tsx
  - web/src/components/navigation/Sidebar.tsx
  - web/src/components/navigation/index.ts
  - web/src/layouts/AdminLayout.test.tsx
  - web/src/layouts/AdminLayout.tsx
  - web/src/modules/admin/components/MoneyOnHandCard.test.tsx
  - web/src/modules/admin/components/MoneyOnHandCard.tsx
  - web/src/modules/admin/components/MoneyStrip.test.tsx
  - web/src/modules/admin/components/MoneyStrip.tsx
  - web/src/modules/admin/components/money.recipe.node.test.ts
  - web/src/modules/admin/components/money.recipe.ts
  - web/src/modules/admin/hooks/useMyMoneyQuery.ts
  - web/src/modules/admin/moneyCopy.ts
  - web/src/modules/admin/pages/DashboardPage.test.tsx
  - web/src/modules/admin/pages/DashboardPage.tsx
  - web/src/modules/admin/pages/MoneyPage.test.tsx
  - web/src/modules/admin/pages/MoneyPage.tsx
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/sections.test.ts
  - web/src/modules/admin/sections.ts
  - web/src/modules/admin/services/dashboardService.ts
  - web/src/modules/admin/services/moneyService.test.ts
  - web/src/modules/admin/services/moneyService.ts
  - web/src/test/dashboardFixtures.ts
  - web/src/test/moneyFixtures.ts
  - web/src/types/api.generated.ts
  - web/src/utils/toFiniteFigure.test.ts
  - web/src/utils/toFiniteFigure.ts
findings:
  critical: 0
  warning: 1
  info: 7
  total: 8
status: issues_found
---

# Phase 10 wave 6: Code Review Report

**Reviewed:** 2026-11-07T15:41:00-05:00
**Depth:** standard. I followed the call chains into `MoneyTransfer.RecordHandover`, `MoneyParties`, `StaffDirectory.GetStaffStateAsync`, `AuditTrail`, `ConflictRetry`, `IdempotencyGate.StoreAndCommitAsync`, `LoadingRegion`, `ErrorState`, `Money`, `formatPeso`/`isNegativeMoney`/`round2`, the button size recipe and the query client defaults.
**Files Reviewed:** 57
**Status:** issues_found. This was an advisory review. Nothing was edited, committed or run.

## Summary

Plan 10-12 (hand-over and recipients) holds up on every point in the focus list. I found no blocker.

- **Lock and reads.** `moneyLock.LockAsync` is the first statement of `AttemptAsync` (`HandOverMoneyHandler.cs:79`). Everything that decides the outcome is read after it, in one transaction: the caller, the leaver, the recipient, and both sums (lines 81-94). The domain then decides, the row and the audit entry are added, and the leaver's sums are read again after the save (line 115). The unit test pins this order with `Received.InOrder`. The race test fails under both mutations recorded in the SUMMARY.
- **Manager re-read (wave 5 WR-01 pattern).** The caller is read under the lock. Anyone who is not an active, unlocked, undeleted Manager gets 401 and nothing is saved (line 83). Unit tests cover six states and the endpoint test covers three.
- **Former-staff and recipient rules.** These match D-17, D-18 and D-56:
  - An active, unknown, legacy or role-less sender gets "Only money held by former staff can be handed over."
  - A recipient who is the leaver gets "Choose someone other than {name}."
  - A deactivated or deleted recipient is refused even when owed money.
  - A Manager-locked or not-yet-set-up recipient is accepted.
  - Unknown, legacy and role-less recipients get the nameless line.
- **Amount.** A leaver at or below 0.00 gets the "nothing on hand" message. Any amount above the balance read under the lock is refused, so nothing can overdraw the leaver.
- **Audit.** `AuditTrail.Record` adds the entry to the same scoped context, so it is saved in the handler's `SaveChangesAsync` inside the gate's transaction, with `request.UserId` (the Manager) as actor. The detail holds ids, a `0.00` amount, a `yyyy-MM-dd` date and `note=yes|no`. The note text is never a parameter.
- **Authorization.** The class has `[Authorize(Policy = Policies.Staff)]` and the hand-over action adds `[Authorize(Policy = Policies.Manager)]`, so both apply. Matrix rows: POST handovers 401/403/400, GET recipients 401/200/200. The response is `no-store`.
- **Recipients.** One statement lists Admins and Managers. The legacy holder is excluded by id and role-less accounts by the role subquery. Active people are listed with locked and not-set-up included. Former staff appear only when their balance is below zero. No entry carries a number; the integration test checks the property names and that no value is a number. The caller is marked `isYou`, as the plan asks.

Plan 10-13 (strip, card, page, nav) meets its must-haves:

- The only money call is `GET /staff-money/me`, with no id.
- `toFiniteFigure` refuses non-finite values.
- The negative tone uses U+2212 and zero is dimmed.
- `withMoney` is off by default, so the P2 scenarios are unchanged.
- The prefix rule in `sections.ts` is correct.
- I found no em or en dash and no `style` attribute in the changed `web/src` files.

The one warning repeats wave 5 WR-02 in the two new money components: after Try Again they say nothing.

## Critical

None.

## Warning

### WR-01: After Try Again, the money strip and the balance card never say they are loading or that the figure arrived

**File:** `web/src/modules/admin/components/MoneyStrip.tsx:80-88`, `web/src/modules/admin/components/MoneyOnHandCard.tsx:130-164`, `web/src/modules/admin/hooks/useMyMoneyQuery.ts:57-62`

**Issue:** This is the same gap wave 5 WR-02 found in the chart card, which was fixed there. Here it comes back in both new components.
- **Strip.** The strip passes `loading={money === undefined && !query.isError}`. In TanStack Query 5, `isError` stays true while `refetch()` runs. So after a failure, `loading` stays false through the retry and through the success. `LoadingRegion` only changes its message on a `loading` edge. Its phase stays `failed` (silent), so it never says "Loading your money on hand…" and never says "Your money on hand loaded.". The alert just disappears.
- **Card.** The card is worse. In the error state it unmounts the `LoadingRegion` and puts up `ErrorState` instead. On success a new region mounts with `loading={false}`, which starts in phase `idle` and says nothing.
- **Root cause.** `MyMoneyCardQuery` has no `isFetching`, so neither component can show that a retry is running. While the HTTP client retries on its own, the banner and its Try Again button stay up with no busy state.
- **Tests.** No test checks any announcement after Try Again. `MoneyStrip.test.tsx` "recovers" only looks for `₱120.00`. `MoneyPage.test.tsx` "Try Again, which reads the figure again" checks only the figure.

**Failure scenario:**
1. A screen reader user opens the dashboard on a weak connection. `GET /staff-money/me` answers 500, and they hear "Couldn't load your money on hand."
2. They press Try Again. The HTTP client retries for a few seconds, and nothing is announced.
3. The second answer is 200 with 8,450.00. The alert goes away silently, and `₱8,450.00` appears with no "loaded" message.
4. The user cannot tell whether the press did anything. Pressing again cancels and restarts the request (`refetch` defaults to `cancelRefetch: true`).

The same thing happens on My Money with "Couldn't load the money on hand.".

**Fix:**
- Add `isFetching` to `MyMoneyCardQuery`.
- Keep one `LoadingRegion` mounted in every state, and drive it with the fetch state, as was done for the chart:
```tsx
<LoadingRegion
  loading={money === undefined && query.isFetching}
  failed={query.isError && !query.isFetching}
  things={COPY.things}
  className={moneyStripBodyClasses}
>
  <span className={moneyStripLabelClasses}>{COPY.label}</span>
  {figure}
</LoadingRegion>
```
- In `MoneyOnHandCard`, put the `ErrorState` inside the same region rather than replacing it. Disable Try Again, or set `aria-busy` on it, while `query.isFetching`.
- Write the failing tests first, for both components: fail once, press Try Again, then expect the status to read "Loading your money on hand…" / "Loading money on hand…" and then "Your money on hand loaded." / "Money on hand loaded.".

## Info

### IN-01: `toFiniteFigure` accepts hex, binary, octal and exponent text as money

**File:** `web/src/utils/toFiniteFigure.ts:5-8`

**Issue:** Text goes through bare `Number(value)`. That accepts `"0x1F"` (31), `"0b101"` (5), `"0o17"` (15), `"1e3"` (1000) and `" 12 "` (12). The helper is now the one shared narrowing for money figures (`moneyService.parseMyMoney`, `dashboardService.finiteFigure`), so its rule decides what the browser will show as money. The 17 test cases do not pin any of these inputs.

**Failure scenario:** A later contract change, or a proxy that rewrites JSON, sends `"balance": "1e3"`. The strip shows `₱1,000.00` instead of the failure alert. Today the server sends JSON numbers, so nothing is wrong yet.

**Fix:** For strings, accept only a plain decimal shape before converting, and add test cases for the inputs above:
```ts
const DECIMAL = /^-?\d+(\.\d+)?$/;
typeof value === 'string' && DECIMAL.test(value.trim()) ? Number(value) : Number.NaN
```

### IN-02: The strip and the balance card have no heading or accessible name

**File:** `web/src/modules/admin/components/MoneyStrip.tsx:76-86`, `web/src/modules/admin/components/MoneyOnHandCard.tsx:168-171`

**Issue:**
- The other dashboard cards are `<section>` elements with an `h2` (`IncomeExpenseCard.tsx:96`, `OrdersByStatusCard.tsx:117`). The strip's label "Your money on hand" is a `span`, and its `<section>` has no accessible name, so it is not a region either.
- On My Money, the page has an `h1` and nothing below it. "Money on hand" is an overline `span`.
- Axe passes, because it does not require headings.

**Failure scenario:** A screen reader user moves through the dashboard by heading (H key): "Good morning, Carmen", "Income vs. expenses", "Orders by status", "Recent orders". The money strip, which is the one personal figure on the page, is skipped.

**Fix:** This is the UI owner's call at the plan 10-21 review. The smallest change that keeps the look is to give the label an id and point the section at it: `<section aria-labelledby={labelId}>`. The other option is to render the label as an `h2` with the same classes. Do the same on the card's overline.

### IN-03: The recipients list is the transfer list, not the hand-over list, and `status` is an untyped string

**File:** `src/Csps.Application/Money/ListTransferRecipientsHandler.cs:83-93`, `web/src/types/api.generated.ts` (`TransferRecipientResponse.status: string`)

**Issue:**
- The list includes the caller (`isYou`) and owed leavers (`deactivated`/`deleted`). That is right for the transfer window. But the hand-over endpoint refuses every former-staff recipient, and it allows the Manager as recipient.
- UI-SPEC row 116 plans a single `useTransferRecipientsQuery` for both windows. If the hand-over window offers this list unfiltered, a Manager can pick an owed leaver and get a 400 the UI could have prevented. That breaks OR-3 (the client checks every rule before sending).
- `status` is generated as a plain `string`, so a client typo such as `'inactive'` type-checks.

**Failure scenario:** In plan 10-16, the hand-over window lists "Jomar Santos (inactive)" because he is owed 500.00. The Manager picks him and gets "Jomar Santos can't receive transfers now. Choose someone else."

**Fix:**
- State in `docs/api/staff-money.md` that the hand-over window must keep only `status === 'active'`.
- Narrow `status` on the web side with a parser to `'active' | 'deactivated' | 'deleted'`, as `parseMyMoney` does for figures. Or declare it as an enum in the OpenAPI document.

### IN-04: `StaffPerson.Role` and `IsManagerLocked` are read but never used, and `FromPerson` trusts the reader alone

**File:** `src/Csps.Application/Money/StaffPerson.cs:10`, `src/Csps.Application/Money/MoneyParties.cs:41-45`, `src/Csps.Infrastructure/Money/StaffMoneyReader.cs:57-84`

**Issue:**
- `ListTransferRecipientsHandler` never reads `Role` or `IsManagerLocked`. Locked people are deliberately treated as active.
- `MoneyParties.FromPerson` does not check `LegacyHolder.Id` or the role, unlike `From` (line 26). Keeping the holder and role-less accounts out depends only on the SQL in `ListStaffPeopleAsync`.
- The endpoint test covers the reader today, but the handler unit tests feed hand-made `StaffPerson` rows, so they would not notice if the reader changed.

**Failure scenario:** A later edit to `ListStaffPeopleAsync` drops the `user.Id != LegacyHolder.Id` filter, for example while adding a Manager roster of leavers (the SUMMARY suggests that reuse). The holder has the Admin role in the seed, so "Legacy / unassigned" shows up in every To list. No unit test fails.

**Fix:** Make `FromPerson` apply the same guard as `From`: legacy id, or a role other than Admin or Manager, gives `NotStaff`. Then the handler excludes `NotStaff`. Drop `IsManagerLocked` from `StaffPerson` if nothing will read it.

### IN-05: Status changes of the leaver or the recipient do not take the staff-money lock

**File:** `src/Csps.Application/Money/HandOverMoneyHandler.cs:90-99` (with `DeactivateUserHandler`, `ActivateUserHandler`, `DeleteUserHandler`)

**Issue:** Balances are read under the lock, but account status is not protected by it. Deactivate, activate and delete commit without the lock. Under READ COMMITTED, the hand-over sees whatever status was committed when it read. No money is overdrawn, but the money can end up somewhere D-17 did not intend.

**Failure scenario:** Manager A hands over Jomar's 2,000.00 to Liza. At the same moment, Manager B deactivates Liza. The hand-over reads Liza as active and commits. Liza is now a leaver holding 2,000.00 that needs a second hand-over. The mirror case: Jomar is reactivated in the same instant, and his money moves although he is staff again.

**Fix:** Owner's call. Either record a ruling that this is accepted (no overdraw, and it can be fixed with another hand-over), or take the `staff-money` lock as the first statement in the deactivate, activate and delete handlers. That adds a lock wait to user admin.

### IN-06: The "audit entry joins the save" claim is not pinned against a reorder

**File:** `tests/Csps.Application.UnitTests/Money/HandOverMoneyHandlerTests.cs:57-76`

**Issue:** `Received.InOrder` lists `Audit.Record` between `Transfers.Add` and the second `GetSumsAsync`, but not relative to `SaveChangesAsync`. `FakeUnitOfWork` only counts saves.
- At the endpoint level, `IdempotencyGate.StoreAndCommitAsync` calls `SaveChangesAsync` again on the same scoped context (`IdempotencyGate.cs:100-101`). So an entry added after the handler's save is still written, and every integration test still passes.
- The company expense tests use a `SaveAwareAudit` double for exactly this (`CreateCompanyExpenseHandlerTests.cs:315`).

**Failure scenario:** A refactor moves `audit.Record(...)` below `SaveChangesAsync`. All 24 unit tests and all endpoint tests stay green. On any path where the gate is not involved, the entry would be lost.

**Fix:** Reuse the `SaveAwareAudit` pattern: the audit double records `unit.Saves` when `Record` is called, and the test asserts it was `0`, meaning the entry was added before the one save.

### IN-07: The plan's parity gate and the dashboard e2e were not shown green after the strip went in

**File:** `.planning/phases/10-admin-dashboard/10-13-SUMMARY.md` (coverage D7, "Not run")

**Issue:**
- Plan 10-13's `<verification>` requires the parity run to pass. It ended with `448 passed, 52 failed`, and no baseline was run at `8f2dd1ff`, so "unrelated" is an inference.
- The `@dashboard` Playwright specs were not run. The strip adds a block above the KPI row, which affects the 320 px "does not scroll sideways" check, and adds a second `role="status"` node to the dashboard.
- MONEY-02 is still listed in `requirements-completed`.

**Failure scenario:** The strip pushes a 320 px Firefox frame into sideways scroll, or a parity snapshot of the admin frame changes. Nobody sees it until `/gsd-ship`.

**Fix:** Before ship, run parity once at `8f2dd1ff` and once at `6ce241cc` on a quiet machine, and compare the failing lists. Run `@dashboard` on all projects after the preflight. Record both results in the 10-21 sweep.

---

_Reviewed: 2026-11-07T15:41:00-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Outcomes

| Finding | Outcome |
|---|---|
| WR-01 | Fixed (`028912f2`, `eda67d32`): one loading region stays mounted in the strip and the card, so Try Again says loading and then loaded, both after a first failed read and after a later failure over a good figure. Tests failed first (3 of 48); a mutation of the loading rule failed the later-failure tests. No new wording. |
| IN-01 | Fixed (`c3c14dc1`, `709fee1f`): `toFiniteFigure` reads text only as plain decimal; hex, binary, octal, exponent, `+12`, `12.` and `.5` are refused. Tests failed first (7 of 26). |
| IN-02 | Fixed (`aad7e031`, `a036fcc1`): each section is named by its visible label through `aria-labelledby`; no visual or copy change. Tests failed first (2 of 50). Heading choice stays with the plan 10-21 UI review. |
| IN-03 | Deferred to plan 10-15 (the transfer and hand-over windows): filter the list to the right people per window; type `status` as a union in the contract if 10-15 regenerates it. |
| IN-04 | Fixed (`35ed62f3`, `1122524e`): `StaffPerson` drops `Role` and `IsManagerLocked`; `FromPerson` refuses the legacy holder itself. Tests failed first (2 of 8). |
| IN-05 | Parked for the owner: P10-BL-09 (whether deactivate, activate and delete take the staff-money lock). |
| IN-06 | Fixed (`663516a3`): a guard test checks that the audit entry is added before the save; moving the audit call after the save failed only this test, then the code was restored. |
| IN-07 | Covered by the orchestrator's full browser run after these fixes. The parity snapshot baseline stays deferred to a CI or quiet-machine run (10-13 coverage item D7). |
