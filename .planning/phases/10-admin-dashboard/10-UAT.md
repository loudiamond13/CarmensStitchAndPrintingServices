---
status: partial
phase: 10-admin-dashboard
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md, 10-06-SUMMARY.md, 10-07-SUMMARY.md, 10-08-SUMMARY.md, 10-09-SUMMARY.md, 10-10-SUMMARY.md, 10-11-SUMMARY.md, 10-12-SUMMARY.md, 10-13-SUMMARY.md, 10-14-SUMMARY.md, 10-15-SUMMARY.md, 10-16-SUMMARY.md, 10-17-SUMMARY.md, 10-18-SUMMARY.md, 10-19-SUMMARY.md, 10-20-SUMMARY.md, 10-21-SUMMARY.md]
started: 2026-11-09T19:50:00-06:00
created: 2026-11-09T19:50:00-06:00
updated: 2026-11-10T03:25:43.999Z
---

# Phase 10 UAT: Admin Dashboard
*Created: 2026-11-09T19:50:00-06:00 · Updated: 2026-11-09T21:25:25-06:00*

All 21 plans are built. Tests 1 to 19 are hands-on checks for the owner, user flow first (tests 1 to 13), then layout and look (14 to 17), then the CI ship gates (18 and 19).
Tests 20 to 149 are passed by automated tests (coverage blocks); they are not asked.
Wording-only coverage checkpoints (10-08 D6, 10-10 D8, 10-12 D9, 10-16 D9) are owner rulings parked as P10-BL-07 and P10-BL-11 in 999.6 DECISIONS.md, not UAT steps.

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running API and web server. Run the preflight, apply the Phase 10 migration (AddMoneyTransfers) to CSPS_Dev with `dotnet ef database update` or the seed, then start the API (5115) and the web app (5180) from scratch. The API starts with no errors or warnings, /health answers, and signing in loads the admin area with real data.
result: pass
note: The API started cleanly, but AddMaintenanceCursors and AddMoneyTransfers were still pending on CSPS_Dev; the money strip then failed with Invalid object name 'MoneyTransfers'. Both were applied with dotnet ef database update during test 2 (setup step, not a code gap). Also, the owner's Visual Studio API could not reach LocalDB while TheBETSLLC held it from inside the Claude app, so the API ran in-app for this UAT.

### 2. Land on the dashboard after sign-in
expected: Sign in as a Manager. You land on /admin (not Orders). The heading reads "Good morning", "Good afternoon" or "Good evening" plus your first name, today's date in Manila time shows under it, and View Orders and New Order buttons are there and work.
result: pass
covers: 10-07 D8 (long first name, see test 14)

### 3. KPI cards show today's business
expected: Four cards in this order: Active orders (with how many are due this week), Total receivables, Collected · month (with the change against the same day last month) and Company expenses · month (with the count and the top category). There is no profit card. The figures make sense for the dev data (for example receivables include ORD-2026-0148's 9,327.50 balance).
result: pass
covers: 10-09 D5 (screen reader reads "Completed this month, 11")

### 4. Income vs. expenses chart
expected: The chart card reads "Last 6 months" by default with income and expense bars per month, oldest on the left, and a profit line. Switching to 12M shows 12 months (every other month labelled, the current month labelled). Hovering or tapping a month shows its income, expenses and profit. Months with nothing show zero, not a gap.
result: pass
covers: 10-04 D6; 10-11 D6; 10-06 D7 (year-end window; owner rule is P10-BL-03)

### 5. Orders by status and Recent orders
expected: Orders by status lists each status with its count and bar, including "Completed this month". Recent orders lists the newest orders with balance and due date (overdue ones marked). Clicking a recent order opens that order, and the view-all link opens the Orders list.
result: pass

### 6. Your money on hand strip
expected: Under the greeting and above the KPI cards, "Your money on hand" shows your own balance (money received minus what you paid out), with a Transfer button and a View Ledger link. View Ledger opens My Money (/admin/money).
result: pass

### 7. Transfer money to a coworker
expected: From the strip, Transfer opens "Transfer Money" with the cursor on To and the line "From {you} (you). You have {balance} on hand." Pick a coworker, enter an amount (try 500), Record Transfer. The window closes, the toast says "You now have {new balance} on hand.", your strip drops by exactly 500, and the coworker's balance rises by 500 (check via All Staff or by signing in as them).
result: pass
covers: 10-15 D7
note: The signed-in Manager (the only staff member) was at a negative balance from the seed's demo expenses, so Transfer was correctly disabled with 'Nothing on hand to transfer.' The owner added a second staff member (Admin), recorded a 2,000.00 payment received by them, and sent 500 to the Manager from their side.

### 8. Transfer form checks before sending
expected: In the Transfer window, try Record Transfer with no person, with no amount, with 0, and with more than two decimals. Each shows a plain-English error inline under its field before anything is sent, and nothing is recorded.
result: pass

### 9. My Money ledger (Mine tab)
expected: On My Money the balance card shows your balance and the Ledger card below it lists your entries newest first ("The balance after each entry is shown on the right."): Date, Details, Money in, Money out, Balance. The transfer from test 7 is at the top with the right sign, and the running balance on the top row equals the balance card. Paging works when there are many rows.
result: pass

### 10. An Admin sees only their own money
expected: Sign in as an Admin. The dashboard strip and My Money show only your own balance and ledger. My Money has no tab strip (no All Staff, no Transfers), and typing ?tab=staff in the URL just shows your own page.
result: pass

### 11. Manager All Staff tab
expected: As a Manager, My Money has tabs Mine, All Staff and Transfers (the tab stays in the URL). All Staff lists every active Admin and Manager with their money on hand and a total, then former staff who still hold money. The eye link opens that person's page with their balance and ledger.
result: pass

### 12. Hand over a leaver's money
expected: Deactivate a staff member who holds money (Users screen). On All Staff they show as a leaver with Hand Over. Hand Over to an active coworker: the leaver's balance goes to zero, the coworker's rises by the same amount, and the transfer shows as a hand-over recorded by you.
result: pass

### 13. Transfers tab and deleting a wrong transfer
expected: The Transfers tab lists every transfer newest first (Date, From, To, Amount, Note, Recorded by, Actions) with paging. Delete the transfer from test 7: the window warns what will change, then both people's balances move back at once, and the row stays listed marked Deleted (not counted). The ledger shows it struck through as "Not counted".
result: pass
covers: 10-14 D9 (deleted row amount; owner rule is P10-BL-10)

### 14. Dashboard on a phone (320 and 390 px)
expected: At 320 px and 390 px wide, the dashboard has no sideways scroll, even with a large Collected figure: the KPI cards go to one column on small phones (D-107), figures stay inside their cards, a long first name wraps instead of being cut off, and the strip buttons wrap under the figure.
result: pass
covers: 10-07 D8; 10-09 D8; 10-13 D6; 10-15 D7

### 15. Money screens on a phone and tablet
expected: At 320, 390 and 820 px: My Money ledger, All Staff and Transfers show as row cards on phones and fit their cards on tablets (Hand Over may drop under the eye link at 768 px, D-110); the three-tab strip fits or scrolls inside itself; the Transfer and Delete windows keep their buttons inside the screen.
result: pass
covers: 10-17 D8; 10-19 D8; 10-20 D9

### 16. Espresso (dark) theme
expected: Switch to Espresso. The dashboard (cards, chart bars, profit line, status bars) and the money screens (strip, ledger, deleted rows, dialogs) are readable with good contrast and look right next to Blush.
result: pass
covers: 10-09 D8; 10-11 D6; 10-04 D6

### 17. Showcase: Dashboard and staff money
expected: Open /dev/components, section "Dashboard and staff money". Every state is there and looks right: demo values, a new shop at zero, a negative money strip, every card loading and failed, the chart at 6M and 12M with a negative month, the money screens in their states. You accept the look (the UI-SPEC screenshot review, P10-BL-15).
result: pass
covers: 10-21 D7

### 18. CI parity snapshots on the phase PR
expected: On the Phase 10 PR, the parity pixel snapshot job is green before merge (ship gate D-1; snapshots differ locally by glyph edges, so only CI can confirm).
result: blocked
blocked_by: release-build
reason: "No Phase 10 PR exists yet and the branch is not pushed, so the CI parity job has not run. Owner ruled (2026-11-09): mark blocked until the phase PR's CI runs (/gsd-ship 10). Ship gate D-1, P10-BL-20 step 1."
covers: 10-04 D5; 10-13 D7

### 19. One clean full test run
expected: One full e2e run and one Server test run on CI (or a quiet machine) pass in a single pass, with ExpenseListTimingTests under 300 ms.
result: blocked
blocked_by: release-build
reason: "Needs the phase PR's CI run. Owner ruled (2026-11-09): mark blocked until then. P10-BL-20 step 5."

### 20. 10-01 D1: One LINQ Concat of narrow projections over payments, refunds, company expenses and order...
expected: One LINQ Concat of narrow projections over payments, refunds, company expenses and order expenses pages one person's rows newest first in one UNION ALL statement, with the signs from the UI-SPEC and no row of another person
result: pass
source: automated
coverage_id: 10-01 D1

### 21. 10-01 D2: Payments, refunds and order expenses on a deleted order and a deleted company expense...
expected: Payments, refunds and order expenses on a deleted order and a deleted company expense never reach a ledger, and no query filter is lifted
result: pass
source: automated
coverage_id: 10-01 D2

### 22. 10-01 D3: Pages follow the order with no gap or repeat, the same-day tie order is stable, a page...
expected: Pages follow the order with no gap or repeat, the same-day tie order is stable, a page costs the same number of commands at sizes 10 and 100, and the newer-rows sum comes back from the database in one statement
result: pass
source: automated
coverage_id: 10-01 D3

### 23. 10-02 D1: WeekOf gives the Monday to Sunday week that holds a day, including across a year end
expected: WeekOf gives the Monday to Sunday week that holds a day, including across a year end
result: pass
source: automated
coverage_id: 10-02 D1

### 24. 10-02 D2: SameDayLastMonth is the same day number last month, clamped to its last day (leap year,...
expected: SameDayLastMonth is the same day number last month, clamped to its last day (leap year, month ends, year end)
result: pass
source: automated
coverage_id: 10-02 D2

### 25. 10-02 D3: DayPart is Morning before 12:00, Afternoon to before 18:00, Evening from 18:00, read from...
expected: DayPart is Morning before 12:00, Afternoon to before 18:00, Evening from 18:00, read from the business zone and exact to the second
result: pass
source: automated
coverage_id: 10-02 D3

### 26. 10-02 D4: CanBeOverdue and OverdueStatuses cover Pending, Mockup, InProduction and Ready only;...
expected: CanBeOverdue and OverdueStatuses cover Pending, Mockup, InProduction and Ready only; Delivered is active but never overdue
result: pass
source: automated
coverage_id: 10-02 D4

### 27. 10-03 D1: Money on hand is received + transfers in - transfers out - expenses - refunds, exact...
expected: Money on hand is received + transfers in - transfers out - expenses - refunds, exact decimals, may be below zero
result: pass
source: automated
coverage_id: 10-03 D1

### 28. 10-03 D2: A coworker transfer is recorded, and every broken rule is refused with the UI-SPEC...
expected: A coworker transfer is recorded, and every broken rule is refused with the UI-SPEC message under the right field (including the D-49 Manager and Admin wording)
result: pass
source: automated
coverage_id: 10-03 D2

### 29. 10-03 D3: Hand-over from former staff only, with the leaver's balance rules and the transfer's soft...
expected: Hand-over from former staff only, with the leaver's balance rules and the transfer's soft delete and remove check
result: pass
source: automated
coverage_id: 10-03 D3

### 30. 10-03 D4: No edit path exists on a recorded transfer (private setters, reflection test over public...
expected: No edit path exists on a recorded transfer (private setters, reflection test over public members)
result: pass
source: automated
coverage_id: 10-03 D4

### 31. 10-03 D5: The three money audit codes are in the catalog (100 codes)
expected: The three money audit codes are in the catalog (100 codes)
result: pass
source: automated
coverage_id: 10-03 D5

### 32. 10-04 D1: With showProfit the chart draws the server's profit per month (halo, line, points), a...
expected: With showProfit the chart draws the server's profit per month (halo, line, points), a Profit legend key with a line swatch, a Profit tooltip row replacing Net, and names ending with the server profit; the browser never computes profit
result: pass
source: automated
coverage_id: 10-04 D1

### 33. 10-04 D2: The labels prop sets the legend and tooltip words; without it the words are today's
expected: The labels prop sets the legend and tooltip words; without it the words are today's
result: pass
source: automated
coverage_id: 10-04 D2

### 34. 10-04 D3: Months below zero: the axis runs from the lowest figure down to the top step, zero line...
expected: Months below zero: the axis runs from the lowest figure down to the top step, zero line in the axis look, negative income bars grow down, ticks use U+2212, the profit line is solid green above zero and dashed red below, split at zero by two useId clipPaths
result: pass
source: automated
coverage_id: 10-04 D3

### 35. 10-04 D4: With showProfit the chart draws at the measured frame width (640 until measured) and...
expected: With showProfit the chart draws at the measured frame width (640 until measured) and draws every other month label, counting back from the last, when a group is under 28px; the observer disconnects on unmount
result: pass
source: automated
coverage_id: 10-04 D4

### 36. 10-05 D1: A signed-in Admin or Manager gets the business today, the greeting part and their own...
expected: A signed-in Admin or Manager gets the business today, the greeting part and their own first name; anonymous gets 401
result: pass
source: automated
coverage_id: 10-05 D1

### 37. 10-05 D2: Active, due this week, overdue and receivables follow the owner rules at week boundaries,...
expected: Active, due this week, overdue and receivables follow the owner rules at week boundaries, with Delivered active but never overdue
result: pass
source: automated
coverage_id: 10-05 D2

### 38. 10-05 D3: Collected this month and the same-day comparison, with the whole-number change, a null...
expected: Collected this month and the same-day comparison, with the whole-number change, a null percent for a zero comparison, and the March 31 clamp
result: pass
source: automated
coverage_id: 10-05 D3

### 39. 10-05 D4: The expenses card carries the month total, count and top category name from the expense...
expected: The expenses card carries the month total, count and top category name from the expense KPI read
result: pass
source: automated
coverage_id: 10-05 D4

### 40. 10-05 D5: Six statuses in fixed order with Completed counted for this business month by UTC range,...
expected: Six statuses in fixed order with Completed counted for this business month by UTC range, and no Cancelled entry
result: pass
source: automated
coverage_id: 10-05 D5

### 41. 10-05 D6: The six newest created orders of any status, newest first, ties by id descending, no...
expected: The six newest created orders of any status, newest first, ties by id descending, no deleted order, in one SQL command
result: pass
source: automated
coverage_id: 10-05 D6

### 42. 10-05 D7: Both roles get the same figures, statuses and recent orders at the same instant, and the...
expected: Both roles get the same figures, statuses and recent orders at the same instant, and the answer is never cached
result: pass
source: automated
coverage_id: 10-05 D7

### 43. 10-05 D8: The OpenAPI snapshot and generated web types carry the summary and stay in step with the...
expected: The OpenAPI snapshot and generated web types carry the summary and stay in step with the live document
result: pass
source: automated
coverage_id: 10-05 D8

### 44. 10-06 D1: GET dashboard/chart?months=6 gives six months oldest first with income, expenses and...
expected: GET dashboard/chart?months=6 gives six months oldest first with income, expenses and profit; Jun to Sep are zero; both roles get the same body; anonymous gets 401
result: pass
source: automated
coverage_id: 10-06 D1

### 45. 10-06 D2: months=12 gives twelve months and no parameter gives six
expected: months=12 gives twelve months and no parameter gives six
result: pass
source: automated
coverage_id: 10-06 D2

### 46. 10-06 D3: Months other than 6 or 12 (7, 0, -6, 1000, text) answer 400 on months with 'Choose 6 or...
expected: Months other than 6 or 12 (7, 0, -6, 1000, text) answer 400 on months with 'Choose 6 or 12 months.' and run no figure query
result: pass
source: automated
coverage_id: 10-06 D3

### 47. 10-06 D4: Income is payments minus refunds and can be below zero; expenses are company plus order...
expected: Income is payments minus refunds and can be below zero; expenses are company plus order expenses; profit is income minus expenses; empty months are zero
result: pass
source: automated
coverage_id: 10-06 D4

### 48. 10-06 D5: Cancelled order money counts; money on deleted orders and deleted company expenses does...
expected: Cancelled order money counts; money on deleted orders and deleted company expenses does not; an expense later this month counts and next month's counts nowhere
result: pass
source: automated
coverage_id: 10-06 D5

### 49. 10-06 D6: The current month's income equals collected.thisMonth from the summary at the same pinned...
expected: The current month's income equals collected.thisMonth from the summary at the same pinned instant (D-04)
result: pass
source: automated
coverage_id: 10-06 D6

### 50. 10-06 D8: The OpenAPI snapshot and generated web types carry the chart and stay in step with the...
expected: The OpenAPI snapshot and generated web types carry the chart and stay in step with the live document
result: pass
source: automated
coverage_id: 10-06 D8

### 51. 10-07 D1: After sign-in staff land on /admin, which renders the dashboard with no redirect to...
expected: After sign-in staff land on /admin, which renders the dashboard with no redirect to Orders; the h1 reads Good morning, afternoon or evening plus the first name from the summary
result: pass
source: automated
coverage_id: 10-07 D1

### 52. 10-07 D2: The subline reads weekday, date and the fixed sentence from the summary's today, never...
expected: The subline reads weekday, date and the fixed sentence from the summary's today, never the device clock, also on machines in other time zones
result: pass
source: automated
coverage_id: 10-07 D2

### 53. 10-07 D3: View Orders (secondary) links to /admin/orders and New Order (primary, plus icon) to...
expected: View Orders (secondary) links to /admin/orders and New Order (primary, plus icon) to /admin/orders/new
result: pass
source: automated
coverage_id: 10-07 D3

### 54. 10-07 D4: Loading shows the title Dashboard with one skeleton line; a failed summary keeps the...
expected: Loading shows the title Dashboard with one skeleton line; a failed summary keeps the title, drops the date and shows Couldn't load the shop figures. with Try Again that reads the summary again
result: pass
source: automated
coverage_id: 10-07 D4

### 55. 10-07 D5: The summary query uses staleTime 0 and refetchOnMount always under the root key dashboard
expected: The summary query uses staleTime 0 and refetchOnMount always under the root key dashboard
result: pass
source: automated
coverage_id: 10-07 D5

### 56. 10-07 D6: The dev /admin preview is gone: no build shows a placeholder user at /admin, and every...
expected: The dev /admin preview is gone: no build shows a placeholder user at /admin, and every e2e spec that opened /admin signs in or uses /dev/components
result: pass
source: automated
coverage_id: 10-07 D6

### 57. 10-07 D7: Document title Dashboard · CSPS Admin; zero axe violations on the page in Blush and...
expected: Document title Dashboard · CSPS Admin; zero axe violations on the page in Blush and Espresso, and in the error state
result: pass
source: automated
coverage_id: 10-07 D7

### 58. 10-08 D1: GET staff-money/me gives the caller's own exact balance (payment received minus company...
expected: GET staff-money/me gives the caller's own exact balance (payment received minus company expense paid) for Admin and Manager, with only userId, name, balance and today; anonymous gets 401
result: pass
source: automated
coverage_id: 10-08 D1

### 59. 10-08 D2: The balance is exact across all six sources, a payer change, an empty person, one centavo...
expected: The balance is exact across all six sources, a payer change, an empty person, one centavo and a hand-over; deleted orders, transfers and company expenses never count, and a balance below zero is reported as negative
result: pass
source: automated
coverage_id: 10-08 D2

### 60. 10-08 D3: The MoneyTransfers table has the designed columns, both CHECKs refuse bad rows, every...
expected: The MoneyTransfers table has the designed columns, both CHECKs refuse bad rows, every people key is NO ACTION, the six indexes exist, and there is no trigger and no query filter
result: pass
source: automated
coverage_id: 10-08 D3

### 61. 10-08 D4: The staff-money lock row is seeded and the standing rows count 67
expected: The staff-money lock row is seeded and the standing rows count 67
result: pass
source: automated
coverage_id: 10-08 D4

### 62. 10-08 D5: The OpenAPI snapshot and generated web types carry GetMyMoney and stay in step with the...
expected: The OpenAPI snapshot and generated web types carry GetMyMoney and stay in step with the live document; docs/api/staff-money.md describes the route
result: pass
source: automated
coverage_id: 10-08 D5

### 63. 10-09 D1: The KPI row shows exactly four cards in order (Active orders, Total receivables,...
expected: The KPI row shows exactly four cards in order (Active orders, Total receivables, Collected · month, Company expenses · month) with the server's figures and no profit card
result: pass
source: automated
coverage_id: 10-09 D1

### 64. 10-09 D2: The feet follow the owner wording: due and overdue (singular and zero cases), the...
expected: The feet follow the owner wording: due and overdue (singular and zero cases), the receivables line, the Collected percent with 'vs {month}, same day' or 'Nothing collected by this day in {month}', and the expenses entries line
result: pass
source: automated
coverage_id: 10-09 D2

### 65. 10-09 D3: Month names and counts come from the summary (Mar 31 compares with Feb, a Monday and a...
expected: Month names and counts come from the summary (Mar 31 compares with Feb, a Monday and a Sunday show the server's counts), never from the device clock; a negative collected figure uses U+2212
result: pass
source: automated
coverage_id: 10-09 D3

### 66. 10-09 D4: Orders by status lists Pending, Mockup, In Production, Ready, Delivered and Completed...
expected: Orders by status lists Pending, Mockup, In Production, Ready, Delivered and Completed with a proportional bar and the count; Cancelled and unknown statuses never show; the footer reads 'Active (Pending to Delivered)' and the server's '{n} orders'
result: pass
source: automated
coverage_id: 10-09 D4

### 67. 10-09 D6: Recent orders lists the six newest orders with the order link, team over customer,...
expected: Recent orders lists the six newest orders with the order link, team over customer, status, stacked due flag from the summary date, total, the shared balance states and an eye link named 'View {number}'; All orders links to /admin/orders
result: pass
source: automated
coverage_id: 10-09 D6

### 68. 10-09 D7: Every card has its own loading region, empty state (orders cards) and alert with Try...
expected: Every card has its own loading region, empty state (orders cards) and alert with Try Again; zeros, not empty states, on a new shop's KPI row
result: pass
source: automated
coverage_id: 10-09 D7

### 69. 10-10 D1: POST /api/v1/money-transfers records a transfer from the signed-in user (Admin or...
expected: POST /api/v1/money-transfers records a transfer from the signed-in user (Admin or Manager), answers 201 with the transfer and senderBalance, moves both balances exactly, and carries no recipient balance
result: pass
source: automated
coverage_id: 10-10 D1

### 70. 10-10 D2: The sender comes from the token only; a forged fromUserId, createdById, createdAtUtc,...
expected: The sender comes from the token only; a forged fromUserId, createdById, createdAtUtc, updatedById and updatedAtUtc in the body are ignored and the stamps come from the token and the clock
result: pass
source: automated
coverage_id: 10-10 D2

### 71. 10-10 D3: Every field and balance refusal answers 400 with the UI-SPEC message under its field,...
expected: Every field and balance refusal answers 400 with the UI-SPEC message under its field, including the Manager and Admin leaver caps, and an empty body lists the three required fields together
result: pass
source: automated
coverage_id: 10-10 D3

### 72. 10-10 D4: Recipient rules: Manager-locked and not-yet-set-up active staff can receive (D-56);...
expected: Recipient rules: Manager-locked and not-yet-set-up active staff can receive (D-56); deactivated or deleted staff at or above 0.00, the legacy holder, role-less accounts and unknown ids are refused under toUserId
result: pass
source: automated
coverage_id: 10-10 D4

### 73. 10-10 D5: The same Idempotency-Key and body twice record one transfer and replay the stored 201;...
expected: The same Idempotency-Key and body twice record one transfer and replay the stored 201; the same key with another body answers 422; IdempotencyCoverageTests discovers the new POST
result: pass
source: automated
coverage_id: 10-10 D5

### 74. 10-10 D6: Two concurrent transfers, a transfer racing an expense and two transfers into a leaver...
expected: Two concurrent transfers, a transfer racing an expense and two transfers into a leaver never overdraw; the concurrency class is green five runs in a row
result: pass
source: automated
coverage_id: 10-10 D6

### 75. 10-10 D7: Matrix row POST /api/v1/money-transfers is 401/400/400, and the OpenAPI snapshot and...
expected: Matrix row POST /api/v1/money-transfers is 401/400/400, and the OpenAPI snapshot and generated web types carry CreateMoneyTransfer in step with the live document
result: pass
source: automated
coverage_id: 10-10 D7

### 76. 10-11 D1: The Income vs. expenses card shows the title and the sub 'Last 6 months' or 'Last 12...
expected: The Income vs. expenses card shows the title and the sub 'Last 6 months' or 'Last 12 months', the server's months oldest first with short month names and 'Oct 2026' labels taken from the month keys, and the profit the server sent
result: pass
source: automated
coverage_id: 10-11 D1

### 77. 10-11 D2: The legend reads 'Income (payments minus refunds)', 'Expenses (company + orders)' and...
expected: The legend reads 'Income (payments minus refunds)', 'Expenses (company + orders)' and 'Profit (income minus expenses)', and the tooltip reads Income, Expenses and Profit (D-50, D-104)
result: pass
source: automated
coverage_id: 10-11 D2

### 78. 10-11 D3: The 6M and 12M switch (group Range) lives in the URL as range=12m: 6m stays out, a change...
expected: The 6M and 12M switch (group Range) lives in the URL as range=12m: 6m stays out, a change replaces, an unknown value falls back with one replace, focus stays on the segment
result: pass
source: automated
coverage_id: 10-11 D3

### 79. 10-11 D4: Chart first load shows a 220 px skeleton in 'Loading the chart…'; a range switch keeps...
expected: Chart first load shows a 220 px skeleton in 'Loading the chart…'; a range switch keeps the last months, dimmed after 200 ms; all-zero months show 'No money in or out yet' with the range switch; a failure shows 'Couldn't load the chart.' with Try Again while the other cards keep their own states
result: pass
source: automated
coverage_id: 10-11 D4

### 80. 10-11 D5: After an order, item, payment, refund, discount, order expense or company expense write...
expected: After an order, item, payment, refund, discount, order expense or company expense write the dashboard summary and every chart range are read again (D-13)
result: pass
source: automated
coverage_id: 10-11 D5

### 81. 10-12 D1: A Manager records a hand-over from a deactivated or deleted staff member to an active...
expected: A Manager records a hand-over from a deactivated or deleted staff member to an active coworker: 201 with isHandover true, from the leaver, to the coworker, recordedBy the Manager and senderBalance the leaver's new balance; only the leaver's and the coworker's balances move
result: pass
source: automated
coverage_id: 10-12 D1

### 82. 10-12 D2: Only a Manager can hand over: an Admin gets 403, anonymous gets 401, and a Manager who...
expected: Only a Manager can hand over: an Admin gets 403, anonymous gets 401, and a Manager who left or lost the role after signing in gets 401 with nothing saved; the matrix row is 401/403/400
result: pass
source: automated
coverage_id: 10-12 D2

### 83. 10-12 D3: Every hand-over refusal answers 400 under the right field with the approved wording,...
expected: Every hand-over refusal answers 400 under the right field with the approved wording, including above-balance, nothing on hand, active sender, recipient equal to the leaver, a recipient who cannot receive, and an empty body listing four fields
result: pass
source: automated
coverage_id: 10-12 D3

### 84. 10-12 D4: Two hand-overs of 1,500.00 from a leaver holding 2,000.00 released together give one 201...
expected: Two hand-overs of 1,500.00 from a leaver holding 2,000.00 released together give one 201 and one 400 'Jomar Santos only has ₱500.00 on hand.' and the leaver ends at 500.00; the class is green five runs in a row and fails with the lock removed or moved after the reads
result: pass
source: automated
coverage_id: 10-12 D4

### 85. 10-12 D5: Every hand-over writes one money-transfer.handed-over audit entry in the same save with...
expected: Every hand-over writes one money-transfer.handed-over audit entry in the same save with the Manager as actor and detail from, to, amount, date, note=yes|no (never the note text); a replay with the same key writes one; the audit screen names the from and to people and marks a deleted leaver as former staff
result: pass
source: automated
coverage_id: 10-12 D5

### 86. 10-12 D6: GET /api/v1/money-transfers/recipients answers both roles with every active Admin and...
expected: GET /api/v1/money-transfers/recipients answers both roles with every active Admin and Manager (locked and not-set-up included, the caller isYou) then every deactivated or deleted one owed money; Ana at 0.00, Ben holding 300.00, role-less accounts and the legacy holder never appear; sorted by first name, last name; matrix row 401/200/200
result: pass
source: automated
coverage_id: 10-12 D6

### 87. 10-12 D7: The recipients list carries no figure for any caller: every entry has only id, name,...
expected: The recipients list carries no figure for any caller: every entry has only id, name, status and isYou, no value is a number, and the body holds no balance, amount or owed word
result: pass
source: automated
coverage_id: 10-12 D7

### 88. 10-12 D8: The OpenAPI snapshot, the generated web types and the idempotency and authorization...
expected: The OpenAPI snapshot, the generated web types and the idempotency and authorization coverage tests carry both new routes in step with the live document
result: pass
source: automated
coverage_id: 10-12 D8

### 89. 10-13 D1: Under the dashboard greeting and above the KPI row, 'Your money on hand' shows the server...
expected: Under the dashboard greeting and above the KPI row, 'Your money on hand' shows the server balance for the caller (same for both roles, from GET staff-money/me only, no team total), with a ghost 'View Ledger' link to /admin/money
result: pass
source: automated
coverage_id: 10-13 D1

### 90. 10-13 D2: A negative figure shows in the danger tone with the true minus sign and ₱0.00 in the zero...
expected: A negative figure shows in the danger tone with the true minus sign and ₱0.00 in the zero dim, on the strip and on the My Money card (D-21, D-39)
result: pass
source: automated
coverage_id: 10-13 D2

### 91. 10-13 D3: Strip loading (160 x 28 skeleton, 'Loading your money on hand…'), failure ('Couldn't load...
expected: Strip loading (160 x 28 skeleton, 'Loading your money on hand…'), failure ('Couldn't load your money on hand.' with Try Again, which recovers) and a figure the browser cannot read, with View Ledger working in every state
result: pass
source: automated
coverage_id: 10-13 D3

### 92. 10-13 D4: /admin/money is a lazy page titled My Money (subline, 'Money on hand' card with the...
expected: /admin/money is a lazy page titled My Money (subline, 'Money on hand' card with the explanation line, document title 'My Money · CSPS Admin'), the balance card has its own loading (220 x 40 skeleton) and failure states, for both roles; the money query is read on every visit
result: pass
source: automated
coverage_id: 10-13 D4

### 93. 10-13 D5: The sidebar and the phone drawer show My Money with the wallet icon right after Company...
expected: The sidebar and the phone drawer show My Money with the wallet icon right after Company Expenses for both roles; the tab bar keeps its four items; /admin/money and /admin/money/staff/{id} mark My Money current; without the withMoney prop the sidebar is as before
result: pass
source: automated
coverage_id: 10-13 D5

### 94. 10-14 D1: GET /api/v1/staff-money/me/ledger answers both roles with their own ledger newest first...
expected: GET /api/v1/staff-money/me/ledger answers both roles with their own ledger newest first with items, total, page, pageSize, balance and includesDeleted; anonymous gets 401; the matrix row is 401/200/200
result: pass
source: automated
coverage_id: 10-14 D1

### 95. 10-14 D2: Every balanceAfter comes from the server: the newest row of page 1 equals the money on...
expected: Every balanceAfter comes from the server: the newest row of page 1 equals the money on hand, page 2 starts where page 1 ended, and the oldest row ends on its own signed amount, across three pages of 25 rows
result: pass
source: automated
coverage_id: 10-14 D2

### 96. 10-14 D3: Every kind carries the details its row names: order, team or customer and method for a...
expected: Every kind carries the details its row names: order, team or customer and method for a payment; order and customer for a refund; order, category and description for an order expense; category and description for a company expense; counterpart, note, recorded by, transfer id, version and the hand-over mark for a transfer
result: pass
source: automated
coverage_id: 10-14 D3

### 97. 10-14 D4: The four ledger reads (page, newer-rows sum, count, balance) agree even when a row is...
expected: The four ledger reads (page, newer-rows sum, count, balance) agree even when a row is recorded between them, because they run in one serializable read transaction (D-105); the test fails when the isolation is lowered
result: pass
source: automated
coverage_id: 10-14 D4

### 98. 10-14 D5: A page costs the same number of commands at page sizes 10 and 100 (8 on page 1: the page,...
expected: A page costs the same number of commands at page sizes 10 and 100 (8 on page 1: the page, the count, the balance and five detail reads)
result: pass
source: automated
coverage_id: 10-14 D5

### 99. 10-14 D6: Empty ledger, ordering and the SEC-03 limits: a person with no rows gets items [], total...
expected: Empty ledger, ordering and the SEC-03 limits: a person with no rows gets items [], total 0 and balance 0.00; page below 1 or above 100000 and pageSize below 1 or above 100 answer 400 with the shared list messages; the limits themselves are accepted
result: pass
source: automated
coverage_id: 10-14 D6

### 100. 10-14 D7: A Manager can show deleted transfers in their own ledger (isDeleted, deletedBy,...
expected: A Manager can show deleted transfers in their own ledger (isDeleted, deletedBy, deletedAtUtc, no balanceAfter, every other balance unchanged); an Admin who asks gets 403 before any read; an Admin's ledger never holds a deleted transfer's id or an isDeleted true mark
result: pass
source: automated
coverage_id: 10-14 D7

### 101. 10-14 D8: The OpenAPI snapshot and the generated web types carry the new route in step with the...
expected: The OpenAPI snapshot and the generated web types carry the new route in step with the live document; docs/api/staff-money.md documents it
result: pass
source: automated
coverage_id: 10-14 D8

### 102. 10-15 D1: From the dashboard strip a staff member opens Transfer Money (cursor on To, description...
expected: From the dashboard strip a staff member opens Transfer Money (cursor on To, description 'From {name} (you). You have {balance} on hand.'), chooses a coworker, enters an amount and Record Transfer posts toUserId, amount, transferDate and note only with one Idempotency-Key; the window closes, focus returns to Transfer and the toast says 'You now have {balance} on hand.' from the server's senderBalance
result: pass
source: automated
coverage_id: 10-15 D1

### 103. 10-15 D2: To lists the server's coworkers without the caller, then owed leavers as '(inactive)' or...
expected: To lists the server's coworkers without the caller, then owed leavers as '(inactive)' or '(former staff)', never a figure; 'Loading staff…' while the list loads; the list failure line
result: pass
source: automated
coverage_id: 10-15 D2

### 104. 10-15 D3: Every server rule is checked in the browser first with the server's own words (to,...
expected: Every server rule is checked in the browser first with the server's own words (to, amount, 2 decimals, balance cap, nothing on hand, date real and not in the future, note 200); the window sends no request until they pass
result: pass
source: automated
coverage_id: 10-15 D3

### 105. 10-15 D4: Server refusals land where the person can fix them: the balance refusal under Amount...
expected: Server refusals land where the person can fix them: the balance refusal under Amount (balance read again, typed values kept, corrected body gets a new Idempotency-Key), a recipient refusal under To (people read again), a 409 busy as a danger toast; a retry of the same body after a 5xx keeps its key; Saving with aria-busy and Esc ignored while pending
result: pass
source: automated
coverage_id: 10-15 D4

### 106. 10-15 D5: At or below ₱0.00, and while the figure loads or failed, Transfer is aria-disabled and...
expected: At or below ₱0.00, and while the figure loads or failed, Transfer is aria-disabled and focusable and never hidden; at or below zero the visible reason 'Nothing on hand to transfer.' is tied by aria-describedby (strip and My Money header)
result: pass
source: automated
coverage_id: 10-15 D5

### 107. 10-15 D6: A transfer, an order write (payment, refund, order expense) and a company expense each...
expected: A transfer, an order write (payment, refund, order expense) and a company expense each invalidate the dashboard, staff-money and money-transfers roots; useBusinessToday reads the dashboard and staff-money answers
result: pass
source: automated
coverage_id: 10-15 D6

### 108. 10-16 D1: A Manager lists every active Admin and Manager by name, then leavers with a non-zero...
expected: A Manager lists every active Admin and Manager by name, then leavers with a non-zero balance by name, with isYou and the total; the legacy holder, a zero-balance leaver and role-less accounts stay out; an Admin gets 403 and anonymous 401
result: pass
source: automated
coverage_id: 10-16 D1

### 109. 10-16 D2: The total is the sum of the listed balances and may be below zero
expected: The total is the sum of the listed balances and may be below zero
result: pass
source: automated
coverage_id: 10-16 D2

### 110. 10-16 D3: An Admin gets 403 on /staff-money/{userId} and /{userId}/ledger for a random id and for a...
expected: An Admin gets 403 on /staff-money/{userId} and /{userId}/ledger for a random id and for a coworker id, decided before any lookup (the directory and reader are never asked); the Admin's own id answers like /me
result: pass
source: automated
coverage_id: 10-16 D3

### 111. 10-16 D4: A Manager reads a deactivated or deleted person's figure and ledger with name, role,...
expected: A Manager reads a deactivated or deleted person's figure and ledger with name, role, status and balance; a random id, the legacy holder and a role-less account answer 404 'This person wasn't found.'
result: pass
source: automated
coverage_id: 10-16 D4

### 112. 10-16 D5: D-31 on the one-person ledger: a Manager may pass deleted=true for another person; an...
expected: D-31 on the one-person ledger: a Manager may pass deleted=true for another person; an Admin's deleted=true is 403, for their own id and for another's
result: pass
source: automated
coverage_id: 10-16 D5

### 113. 10-16 D6: GET /money-transfers lists newest first by date, recorded time, then id with from, to,...
expected: GET /money-transfers lists newest first by date, recorded time, then id with from, to, amount, date, note, recordedBy, isHandover and version; a Manager sees all, an Admin only their own; deleted ones only for a Manager who asks, with isDeleted, deletedBy and deletedAtUtc; paging limits answer 400 with the shared words
result: pass
source: automated
coverage_id: 10-16 D6

### 114. 10-16 D7: RESEARCH Pitfall 6, OD-19: across GET staff-money/me, me/ledger, money-transfers,...
expected: RESEARCH Pitfall 6, OD-19: across GET staff-money/me, me/ledger, money-transfers, money-transfers/recipients, every Admin refusal and a refused D-49 transfer, no body holds the 7777.77 or 333.33 figures, the deleted transfer's id or an isDeleted true mark
result: pass
source: automated
coverage_id: 10-16 D7

### 115. 10-16 D8: Matrix rows: GET staff-money 401/403/200; GET staff-money/{userId:guid} and /ledger...
expected: Matrix rows: GET staff-money 401/403/200; GET staff-money/{userId:guid} and /ledger 401/403/404 with fresh random ids; GET money-transfers 401/200/200; the OpenAPI snapshot and generated web types match; docs/api/staff-money.md documents the four routes
result: pass
source: automated
coverage_id: 10-16 D8

### 116. 10-17 D1: My Money shows a 'Ledger' card under the balance card ('Newest first. The balance after...
expected: My Money shows a 'Ledger' card under the balance card ('Newest first. The balance after each entry is shown on the right.') with a table captioned 'Ledger': Date, Details, Money in, Money out, Balance, every figure and every running balance as the server sent it, and no Actions column
result: pass
source: automated
coverage_id: 10-17 D1

### 117. 10-17 D2: Titles and sub lines for the six kinds, with order numbers as links to the order, 'Handed...
expected: Titles and sub lines for the six kinds, with order numbers as links to the order, 'Handed over by {name}' on a hand-over, ' (former staff)' on deleted people, missing parts left out, the empty side as EmptyValue and a negative balance in the danger tone with the true minus sign
result: pass
source: automated
coverage_id: 10-17 D2

### 118. 10-17 D3: Page, rows per page (10, 20, 50, 100) and Show deleted live in the URL: a page change...
expected: Page, rows per page (10, 20, 50, 100) and Show deleted live in the URL: a page change pushes, a size or deleted change replaces and resets the page, a page past the last is replaced by the last, defaults stay out of the URL, bad values fall back with one replace
result: pass
source: automated
coverage_id: 10-17 D3

### 119. 10-17 D4: A Manager sees 'Show deleted'; ticking it requests deleted=true and words the result bar...
expected: A Manager sees 'Show deleted'; ticking it requests deleted=true and words the result bar 'Showing {n} entries, deleted transfers included · newest first'; a deleted transfer shows the Deleted badge, a muted struck amount, 'Deleted by {name} · {Oct 8, 2026, 3:42 PM}' and 'Not counted'. An Admin sees no checkbox, no request ever carries deleted, and a deleted or tab param in an Admin's URL is dropped with one replace
result: pass
source: automated
coverage_id: 10-17 D4

### 120. 10-17 D5: Empty state 'No money in or out yet' with no button (also with Show deleted on), skeleton...
expected: Empty state 'No money in or out yet' with no button (also with Show deleted on), skeleton in 'Loading the ledger…', 'Couldn't load the ledger.' with Try Again (also for a bad figure or kind), rows kept and dimmed after 200 ms on a page change, 'Showing 1 entry' in the singular
result: pass
source: automated
coverage_id: 10-17 D5

### 121. 10-17 D6: Phone card labels (data-label on every cell), the date as the lead, and 200-character...
expected: Phone card labels (data-label on every cell), the date as the lead, and 200-character notes, descriptions and names wrapping anywhere
result: pass
source: automated
coverage_id: 10-17 D6

### 122. 10-17 D7: On My Money page 2 with Show deleted on, opening a row's order and pressing Back restores...
expected: On My Money page 2 with Show deleted on, opening a row's order and pressing Back restores page 2, 10 rows per page and Show deleted, against the real API in all five browsers
result: pass
source: automated
coverage_id: 10-17 D7

### 123. 10-18 D1: A Manager deletes a wrong transfer with its version: 204, both balances move back at...
expected: A Manager deletes a wrong transfer with its version: 204, both balances move back at once, the row stays with DeletedById and DeletedAtUtc, one money-transfer.deleted audit entry with the Manager as actor
result: pass
source: automated
coverage_id: 10-18 D1

### 124. 10-18 D2: Stale, missing, malformed, repeated and racing deletes are refused cleanly; a...
expected: Stale, missing, malformed, repeated and racing deletes are refused cleanly; a plus-and-slash version parses; the race gives one winner and one audit entry; no email is queued
result: pass
source: automated
coverage_id: 10-18 D2

### 125. 10-18 D3: A Manager removes a deleted transfer for good: 422 for a live one, 204 after a delete, no...
expected: A Manager removes a deleted transfer for good: 422 for a live one, 204 after a delete, no balance change, one money-transfer.permanently-deleted entry with the full record, 404 the second time
result: pass
source: automated
coverage_id: 10-18 D3

### 126. 10-18 D4: No edit, restore, bulk or collection-delete route exists under /api/v1/money-transfers
expected: No edit, restore, bulk or collection-delete route exists under /api/v1/money-transfers
result: pass
source: automated
coverage_id: 10-18 D4

### 127. 10-18 D5: Both new actions have matrix rows (anonymous 401, Admin 403, Manager 404) and an explicit...
expected: Both new actions have matrix rows (anonymous 401, Admin 403, Manager 404) and an explicit Manager policy; an Admin learns nothing from a delete or remove answer
result: pass
source: automated
coverage_id: 10-18 D5

### 128. 10-18 D6: The audit screen can name recordedBy and deletedBy for both events
expected: The audit screen can name recordedBy and deletedBy for both events
result: pass
source: automated
coverage_id: 10-18 D6

### 129. 10-19 D1: A Manager's My Money has tabs 'Mine' and 'All Staff' kept in ?tab= with a replace; the...
expected: A Manager's My Money has tabs 'Mine' and 'All Staff' kept in ?tab= with a replace; the header with Transfer shows on both; an Admin sees no tab strip, no staff request and no other person's figure, and a tab value in an Admin's URL is dropped with one replace
result: pass
source: automated
coverage_id: 10-19 D1

### 130. 10-19 D2: All Staff card 'All staff' with a table captioned 'Staff money on hand': Person link (own...
expected: All Staff card 'All staff' with a table captioned 'Staff money on hand': Person link (own row to My Money with ' (you)'), Role, Status (Active, Deactivated, Deleted), Money on hand (danger below zero with U+2212, zero dimmed), eye link 'View ledger of {name}', and the footer 'Total held by staff' with the server total (danger below zero); loading, error with Try Again, one row plus the total
result: pass
source: automated
coverage_id: 10-19 D2

### 131. 10-19 D3: One person's page at /admin/money/staff/:userId: back link 'All staff' to...
expected: One person's page at /admin/money/staff/:userId: back link 'All staff' to /admin/money?tab=staff, the name as h1 with RoleBadge and a Deactivated or Deleted badge outside it, subline, balance card and ledger for that person with Show deleted, no header action, title '{name} · Money · CSPS Admin'; an invalid id or a 404 shows 'This person wasn't found.' with 'Back to All Staff' and the ledger is never asked for
result: pass
source: automated
coverage_id: 10-19 D3

### 132. 10-19 D4: The route loader sends an Admin to /admin/money with redirect() and the Manager's own id...
expected: The route loader sends an Admin to /admin/money with redirect() and the Manager's own id (any case) with replace(), both before any request; another id renders the page; a visitor without a session goes to sign-in with the return path
result: pass
source: automated
coverage_id: 10-19 D4

### 133. 10-19 D5: Hand Over opens 'Hand Over Money' for the leaver ('From {name} (deactivated). They hold...
expected: Hand Over opens 'Hand Over Money' for the leaver ('From {name} (deactivated). They hold {₱2,000.00}.', '(deleted)' for a deleted person), To lists active staff with 'Carmen Reyes (you)' first and nothing chosen, Amount hint '{name} holds {₱2,000.00}.', the recorded-by note, CTA 'Record Handover'; it sends fromUserId with one Idempotency-Key and the toast reads 'Handover recorded' / '{name} now holds {₱0.00}.' from the server balance; the leaver's balance is read again when the window opens; a window asks nothing of the Manager's own money
result: pass
source: automated
coverage_id: 10-19 D5

### 134. 10-19 D6: The handover schema caps the amount at what the leaver holds ('{name} only has...
expected: The handover schema caps the amount at what the leaver holds ('{name} only has {₱2,000.00} on hand.', '{name} has nothing on hand to hand over.'); in transfer mode a Manager who picks a leaver who is owed money is checked against the staff balances read when the window opened ('{name} is owed only {₱300.00}. Enter that or less.'); an Admin is never sent any figure, makes no staff request and the owed figure never reaches the Admin's DOM
result: pass
source: automated
coverage_id: 10-19 D6

### 135. 10-19 D7: Deactivating, activating or deleting a user marks the staff-money and money-transfers...
expected: Deactivating, activating or deleting a user marks the staff-money and money-transfers answers old, so the All Staff badges and the To lists are current; after a hand-over the row follows the new figure and focus returns to the row button or the table caption
result: pass
source: automated
coverage_id: 10-19 D7

### 136. 10-20 D1: A Manager's My Money has a third tab 'Transfers' kept in ?tab=; a link with...
expected: A Manager's My Money has a third tab 'Transfers' kept in ?tab=; a link with ?tab=transfers opens it (P10-BL-12). The card has the head 'Transfers' with 'Every transfer between staff, newest first.', a table captioned 'Transfers' (Date, From, To, Amount, Note, Recorded by, Actions), 'Showing {n} transfers · newest first', paging with Rows per page, 'Loading transfers…', 'Couldn't load transfers.' with Try Again and 'No transfers yet' with no button
result: pass
source: automated
coverage_id: 10-20 D1

### 137. 10-20 D2: Delete Transfer confirm: 'Delete this transfer?' with the amount, both people and the...
expected: Delete Transfer confirm: 'Delete this transfer?' with the amount, both people and the date, Cancel focused first, no reason box, the row's version sent URL-encoded, 'Deleting' while it runs, toast 'Transfer deleted' / 'It no longer counts toward any balance.', and the transfers, ledger, my money, staff balances and dashboard answers read again; focus moves to the next row's action, else the previous, else the caption or heading
result: pass
source: automated
coverage_id: 10-20 D2

### 138. 10-20 D3: The resulting-balance warning: the receiver's balance (staff balances read fresh when the...
expected: The resulting-balance warning: the receiver's balance (staff balances read fresh when the dialog opens) minus the amount, '{name}'s balance will be {−₱500.00}.' only when below zero; a skeleton and a disabled confirm while the read runs; 'Couldn't check the new balances. The delete still works.' with the confirm enabled when the read fails
result: pass
source: automated
coverage_id: 10-20 D3

### 139. 10-20 D4: A 409 keeps the delete dialog open with a role=alert line and reads the lists again; a...
expected: A 409 keeps the delete dialog open with a role=alert line and reads the lists again; a 404 on a delete closes it with the info toast 'Already deleted' and reads the lists again
result: pass
source: automated
coverage_id: 10-20 D4

### 140. 10-20 D5: Delete on each counted ledger transfer row and Remove on each deleted one, named by the...
expected: Delete on each counted ledger transfer row and Remove on each deleted one, named by the row ('Delete transfer of ₱2,000.00 from Carmen Reyes to Liza Mercado, Nov 2, 2026'), with a matching title, on My Money and on one person's page; payment, refund and expense rows have no action; an Admin's ledger has no Actions column
result: pass
source: automated
coverage_id: 10-20 D5

### 141. 10-20 D6: Show deleted on the Transfers tab (deleted=true, replace, page reset); deleted rows show...
expected: Show deleted on the Transfers tab (deleted=true, replace, page reset); deleted rows show the Deleted badge after the date, a struck muted amount, 'Deleted by {name} · {date and time}' under the note and a Remove action; Remove Permanently opens 'Permanently remove this transfer?' with 'This can't be undone.', the danger details box, Cancel first, 'Removing' while it runs, toast 'Transfer removed for good' / 'Balances didn't change.', 404 closes with 'Already removed'; no restore, edit or bulk action exists anywhere
result: pass
source: automated
coverage_id: 10-20 D6

### 142. 10-20 D7: The audit log screen labels money-transfer.deleted 'Money transfer deleted',...
expected: The audit log screen labels money-transfer.deleted 'Money transfer deleted', money-transfer.permanently-deleted 'Money transfer removed permanently' and money-transfer.handed-over 'Money handed over' in the new group 'Staff money'; the code list mirrors the API's 100 codes
result: pass
source: automated
coverage_id: 10-20 D7

### 143. 10-20 D8: An Admin never sees the Transfers tab, deleted transfers, Show deleted or any delete or...
expected: An Admin never sees the Transfers tab, deleted transfers, Show deleted or any delete or remove action, and the browser never asks for them: the tab is absent, the card draws nothing and sends no request, and the ledger has no Actions column
result: pass
source: automated
coverage_id: 10-20 D8

### 144. 10-21 D1: Showcase section 'Dashboard and staff money': D1 with the demo values, a new shop at...
expected: Showcase section 'Dashboard and staff money': D1 with the demo values, a new shop at zero, a negative money strip, every dashboard card loading and failed, the chart at 6M and 12M with a negative-profit and a negative-income month, Orders by status with one large and several zero counts, Recent orders with due, overdue, Fully Paid, credit and Not collected rows, My Money in five states, the ledger with every kind, a hand-over, a negative running balance and a deleted row, All Staff with a negative active person, a deactivated person holding money and a deleted person owed money, the Transfers table, the Transfer and Hand Over windows with a validation message and a server refusal, the delete dialog with and without the warning, and the remove dialog
result: pass
source: automated
coverage_id: 10-21 D1

### 145. 10-21 D2: The demos make no network request and touch no real data
expected: The demos make no network request and touch no real data
result: pass
source: automated
coverage_id: 10-21 D2

### 146. 10-21 D3: A signed-in sweep of /admin and /admin?range=12m (Manager), and /admin (Admin) at 320,...
expected: A signed-in sweep of /admin and /admin?range=12m (Manager), and /admin (Admin) at 320, 390, 820 and 1440 px in Blush and Espresso finds zero axe violations (target-size included), no sideways scroll, no console finding and no CSP violation; the 12M chart draws every other month label at 320 px and every label at 1440 px
result: pass
source: automated
coverage_id: 10-21 D3

### 147. 10-21 D4: A signed-in sweep of /admin/money for an Admin, and for a Manager /admin/money,...
expected: A signed-in sweep of /admin/money for an Admin, and for a Manager /admin/money, ?tab=staff, ?tab=transfers, ?tab=transfers&deleted=true and /admin/money/staff/{leaver} at the same widths and themes, with the Transfer, Hand Over, Delete Transfer and Remove Permanently windows open clean; an Admin who opens ?tab=staff ends with no tab in the URL and no tab strip
result: pass
source: automated
coverage_id: 10-21 D4

### 148. 10-21 D5: The admin initial JS stays under 250 KB gzip with the new lazy section
expected: The admin initial JS stays under 250 KB gzip with the new lazy section
result: pass
source: automated
coverage_id: 10-21 D5

### 149. 10-21 D6: The name on an All Staff card with Hand Over stays clear of the pinned eye link and Hand...
expected: The name on an All Staff card with Hand Over stays clear of the pinned eye link and Hand Over on phones
result: pass
source: automated
coverage_id: 10-21 D6

## Summary

total: 149
passed: 147
issues: 0
pending: 0
skipped: 0
blocked: 2

## Gaps

[none yet]
