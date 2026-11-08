# Owner items parked during Phase 10 execution

*Created: 2026-11-07T00:45:00-06:00 · Updated: 2026-11-08T08:54:00-06:00*

The owner went away during the Phase 10 run (2026-11-06). Anything that needs the owner is parked here instead of blocking the run. Nothing here was decided for the owner.

## P10-BL-01 · Imported orders and this month's dashboard figures (wave 2 review WR-02)

**Status:** open · **Blocks:** nothing in Phase 10. Matters for Phases 15 to 17 (legacy import and cut-over).

The legacy import sets an order's "status changed" time to the moment of import when the old data has no status history, and the created time is stamped when the row is saved. After the Phase 17 import, every old Completed order would count as "Completed this month", and "Recent orders" would show the last six imported rows instead of real new orders.

- **A (recommended):** the import carries the legacy dates over: created time from the legacy order date, status-changed time from the best legacy date (completion or last update). Add this to the Phase 15/16 import plans.
- **B:** keep import-time stamps and accept odd dashboard figures for the cut-over month.

## P10-BL-02 · "View all" from the dashboard's recent orders (wave 2 review info)

**Status:** open · **Blocks:** nothing. The dashboard's "Recent orders" is newest created first. The Orders list's "Newest first" sort may order differently, so a "View all" link could show a different first page. Recommended: make the Orders list "Newest first" sort by created time, matching the dashboard. Plan 10-07 was told not to change it.

## P10-BL-03 · Future-dated expenses in the dashboard chart (plan 10-06, coverage D7)

**Status:** open · **Blocks:** nothing; built and tested as below.

The chart counts an expense in the month of its date. So an expense dated later this month counts in this month's bar now, and one dated next month shows in no bar until next month arrives. The planner assumed this; no ruling covers it.

- **A (recommended):** keep it. It matches how the Collected card and the expenses page read dates.
- **B:** count only expenses dated up to today, so this month's bar never includes future-dated items.

## P10-BL-04 · What the dashboard shows when a background refresh fails (wave 3 review WR-01)

**Status:** open · **Blocks:** nothing; plans 10-09 and later follow the current pattern until ruled.

The plan says that on an error the heading stays "Dashboard" and the date line is dropped. That only holds on the first load. If the page loaded once and a later background refresh fails, it shows the earlier greeting and date next to the error line, so staff may read old figures as current.

- **A (recommended):** on any failed load, keep the last good figures but mark them clearly ("Showing figures from 9:41 AM. Couldn't refresh.") with Try Again.
- **B:** on any failed load, hide the figures and show only the error line, as on a first load.

## P10-BL-05 · WebKit cancelled-request errors in the browser tests (wave 3 review WR-03)

**Status:** open · **Blocks:** nothing now; may cause WebKit/iPhone test failures once plans 10-09, 10-11 and 10-13 add more dashboard requests.

WebKit reports a request that a page navigation cancels as a page error ("due to access control checks"), and the test guard fails on any page error. Plan 10-07 worked around it only for the summary request, in the sign-in helper.

- **A (recommended):** teach the test guard to ignore exactly this message for the app's own `/api/` requests on WebKit, documented in docs/web/e2e.md next to the existing WebKit preload rule. All other page errors still fail.
- **B:** keep failing on it, and add a wait to each spec that navigates away from the dashboard.

## P10-BL-06 · Dashboard figures on a 320 px phone (wave 4 review WR-01)

**Status:** open · **Blocks:** the browser test gate. In the full browser run (2026-11-07) the dashboard scrolls sideways at 320 px on Firefox, WebKit and iPhone (page 347 px wide in a 320 px window). Two checks fail until you choose: `admin.spec.ts` "switches from the phone tab bar ..." (its 320 px no-sideways-scroll step) and `dashboard.spec.ts` "does not scroll sideways at 320px with a six-digit Collected figure". They are left failing on purpose, not switched off. A third check ("every KPI figure fits inside its card at 320px") is `test.fixme`.

On phones the four dashboard figures sit in a 2 x 2 grid, as the UI spec says. The UI spec's 24 px phone size is now applied. At 320 px wide, each card has 104 px for its figure, but a six-digit amount needs more: ₱58,517.50 needs 110 px and ₱126,450.00 needs 122 px. The figure runs 6 to 18 px into the card's padding. With the smaller figures of a short test run the page did not scroll sideways, but with the larger figures that build up during a full run it does, which breaks the project rule of no sideways scroll from 320 px. At 390 px and wider the figures fit.

- **A (recommended):** one column on small phones (420 px and below), as the Expenses figures already do. Every figure fits at full size. The dashboard gets longer on a phone.
- **B:** keep 2 x 2 and shrink six-digit figures on small phones (about 20 px). The figures stay side by side but are smaller to read.
- **C:** let a long figure wrap onto a second line inside its card (for example after the peso sign). The grid stays 2 x 2 at full size, but some cards get taller. (Simply accepting the overflow is no longer an option: it makes the page scroll sideways.)

## P10-BL-07 · What a staff member sees when the chosen person can't receive a transfer (plan 10-10)

**Status:** open · **Blocks:** nothing; the server uses option A for now and the transfer screen comes in a later plan.

When a staff member picks the old system's placeholder account ("Legacy / unassigned") or an account with no role, the server refuses the transfer. Plan 10-10 used the general D-58 line, which does not name the person: "This person can't receive transfers now. Choose someone else." The named version would show "Legacy / unassigned" to the user.

- **A (used now, recommended):** keep the general line for these accounts. Staff never see the internal placeholder name.
- **B:** name the person anyway, so the message reads "Legacy / unassigned can't receive transfers now."
- **C:** give these accounts their own line, for example "This account can't receive transfers. Choose a coworker."

Also still open from plan 10-08: the wording of two money errors no screen shows yet, "This person was not found." and "You can't do this." Later money plans should set them; if none does, this item will ask you.
Added from the wave 5 review fix (WR-01): when a staff member who was just deactivated, deleted, locked or lost their role tries to send a transfer before their session ends, the server refuses it (as D-17 requires) with the existing line "Your session ended. Sign in again." No new wording was written. You may prefer a different sentence.

Added from plan 10-12 (hand-overs), no new wording written:
- When a Manager hands over money and the person whose money it is turns out to be unknown, not staff, or the old system placeholder, the server answers with the approved line "Only money held by former staff can be handed over."
- When the chosen receiver of a hand-over is unknown, not staff, or the placeholder, it answers with the same general line as above: "This person can't receive transfers now. Choose someone else."
- In the Audit Log, the "Done to" column is empty for a hand-over. Plan 10-20 sets the audit labels and can show the coworker who received the money there, if you want that.

## P10-BL-08 · Should a normal staff transfer write an audit entry? (wave 5 review IN-05)

**Status:** open · **Blocks:** nothing now.

Today a transfer records who made it and when on the transfer itself, and the audit log only gets an entry when a transfer is deleted, permanently deleted or handed over. Adding a company expense, by contrast, writes an audit entry. A transfer moves money between people, so you may want the same trail.

- **A (recommended):** add a "money transfer added" audit entry with who sent, who received, the amount, the date and whether there is a note. Same style as the expense entries.
- **B:** keep it as is: the stamps on the transfer are enough for a normal transfer.

## P10-BL-09 · Staff status changes during a money hand-over (wave 6 review IN-05)

**Status:** open · **Blocks:** nothing; no money can be overdrawn either way.

A hand-over checks who is staff and who has left at the moment it runs. If, in the very same instant, another Manager deactivates the person receiving the money (or reactivates the person giving it), the hand-over can still go through using the status from a split second before. Example: Manager A hands Jomar's ₱2,000.00 to Liza while Manager B deactivates Liza. Liza is now a former staff member holding ₱2,000.00, and someone has to hand it over again.

- **A (recommended):** accept this. It needs two Managers acting on the same people at the same second, nothing is lost or overdrawn, and a second hand-over fixes it.
- **B:** make deactivate, activate and delete wait for the money lock too, so the two can never overlap. Staff admin then waits briefly whenever a money change is in progress.

## P10-BL-10 · How a deleted transfer shows in a Manager's ledger (plan 10-14, coverage D9)

**Status:** open · **Blocks:** nothing; plan 10-17 draws the ledger screen, and the server uses option A for now.

Managers can switch the ledger to also show deleted transfers. The plan did not say what figures such a row shows. Deleted rows never count toward the balance either way.

- **A (used now, recommended):** show the amount it had, in the Money in or Money out column, with no running balance on that row. Staff can see what was deleted.
- **B:** show no amount at all on a deleted row, only its date, people and the word Deleted.

## P10-BL-11 · New or reused wording from plans 10-14 and 10-15 (money screens)

**Status:** open · **Blocks:** nothing; the lines below are in use now and can be reworded later.

- "Only Managers can see deleted transfers." The plan spelled this out word for word. It shows if an Admin asks the ledger for deleted transfers.
- "You have nothing on hand to transfer." This is the server's existing line and is in the UI spec table. The Transfer window now also shows it when an amount is typed while your money on hand is zero or less.
- "Couldn't load the staff list. Close this form and try again." This is the existing Paid by line, reused when the Transfer window cannot load the list of people.
- When the server is busy (another money change is in progress), the Transfer window shows the server's own line as the toast title, with nothing added.

Keep them, or give new wording.

## P10-BL-12 · Ledger and staff money wording and layout choices (plans 10-16, 10-17, 10-19)

**Status:** open · **Blocks:** nothing; the choices below are in use now and can be changed later.

- **One-row count line.** The UI spec gives only the plural ("Showing 12 entries, deleted transfers included · newest first"). With one row the screen now says "Showing 1 entry, deleted transfers included · newest first". Keep it, or give other wording.
- **A ledger answer the screen can't read** (a bad figure or an unknown row type) shows the shared line "Couldn't load the ledger." The usual second line, "Check your internet connection...", is left off because it is not a connection problem. A (recommended): keep it as is. B: show the usual second line anyway.
- **Screen reader landmarks.** The Ledger card is a named region "Ledger", and the table inside it is also a region named "Ledger", so a screen reader user hears "Ledger" twice. axe passes either way. A (recommended): keep only the outer one. B: keep both as now.
- **From plan 10-16 (server), new lines the plan spelled out:** "You can only see your own money." (an Admin asking for a coworker's money or ledger) and "This person wasn't found." (a Manager asking for someone who is not staff). These replace the two unshown lines parked under P10-BL-07 ("You can't do this." and "This person was not found."). Keep them, or give new wording.
- **Order of checks on another person's ledger.** If an Admin asks for a coworker's ledger with a bad page number, the server answers "bad page" before "only your own money". Nothing leaks either way. Recommended: accept it. Otherwise the role check moves first (a one-line change).
- **From plan 10-19 (Manager money screens):**
  - Another person's empty ledger shows only "No money in or out yet", without the line that speaks to "you".
  - While a person's money page loads, fails or finds no one, the browser tab reads "Money · CSPS Admin" and the page has no main heading, as the Deleted Order page does.
  - A link with `?tab=transfers` opened the Mine tab until plan 10-20. It now opens the Transfers tab (closed).
  Keep these, or give new wording.
- **The To box while the staff list loads (wave 9 review IN-01).** To fix the Amount message that showed as soon as the Transfer or Hand Over window opened, the To box is no longer greyed out while the staff list loads. It looks ready and shows "Loading staff…" as its only choice, and can't be used until the list arrives. A (recommended): keep it. B: grey it again, which means changing how every order window chooses its first focus.
- **Admin links with Manager-only settings.** If an Admin opens a My Money link that has the Manager-only "Show deleted" setting, the setting is removed and the list goes back to page 1. Recommended: accept this.

## P10-BL-13 · Should a permanently removed transfer's audit record say it was a hand-over? (wave 9 review IN-06)

**Status:** open · **Blocks:** nothing; the record follows D-25 as written.

When a Manager removes a deleted transfer for good, the audit log keeps who sent it, who received it, the amount, the date, whether it had a note, and who recorded and deleted it. It does not say whether the transfer was a hand-over of a former staff member's money, so once it is removed nobody can tell.

- **A (recommended):** add "hand-over: yes or no" to the record. Small change, no new screen.
- **B:** keep it as is (D-25 as written).

## P10-BL-14 · Transfers tab, delete and remove choices (plan 10-20)

**Status:** open · **Blocks:** nothing; the choices below are in use now and can be changed later.

- While the Delete Transfer window checks the new balances, the loading area is read out as "Loading staff balances…" (an existing line).
- "Show deleted" on the Transfers tab and on the Mine ledger is one setting, so switching tabs keeps it on. Recommended: accept. Otherwise each tab gets its own.
- The Transfers count line reads the same with Show deleted on or off.
- When the last transfer on the page is deleted, focus moves to the card heading, because an empty list has no caption.
- A Remove Permanently refused because the server is busy, or because the transfer is no longer deleted, shows the standard error line.
- A hand-over row on the Transfers tab looks like a normal transfer (it is not marked "Hand-over"). A (recommended): add a small "Hand-over" label. B: keep as is.
- Still open, unchanged: the hand-over "Done to" column in the Audit Log is empty (P10-BL-07), and P10-BL-13. Also: the Audit Log does not show when a removed transfer had been deleted.
- **Added from the wave 10 review (IN-03).** Delete Transfer no longer warns for a receiver who is missing from the staff balances, so the old system placeholder name never shows. Side effect: a deactivated person who holds exactly ₱0.00 is not in the staff balances either, so deleting a transfer to them gives no "balance will be below zero" warning. A (recommended): accept it; the delete still works and the ledger shows the result. B: bring the warning back for deactivated people, which needs a small server change so the screen can tell them apart from the placeholder.
