# Owner items parked during Phase 10 execution

*Created: 2026-11-07T00:45:00-06:00 · Updated: 2026-11-10T00:45:00-06:00*

The owner went away during the Phase 10 run (2026-11-06). Anything that needs the owner is parked here instead of blocking the run. Nothing here was decided for the owner.

## P10-BL-01 · Imported orders and this month's dashboard figures (wave 2 review WR-02)

**Status:** ruled D-111 (owner, 2026-11-09): option A; carried into the Phase 16 import plan (ROADMAP Phase 16, owner decisions). No Phase 10 code change. Was open · **Blocks:** nothing in Phase 10. Matters for Phases 15 to 17 (legacy import and cut-over).

The legacy import sets an order's "status changed" time to the moment of import when the old data has no status history, and the created time is stamped when the row is saved. After the Phase 17 import, every old Completed order would count as "Completed this month", and "Recent orders" would show the last six imported rows instead of real new orders.

- **A (recommended):** the import carries the legacy dates over: created time from the legacy order date, status-changed time from the best legacy date (completion or last update). Add this to the Phase 15/16 import plans.
- **B:** keep import-time stamps and accept odd dashboard figures for the cut-over month.

## P10-BL-02 · "View all" from the dashboard's recent orders (wave 2 review info)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended); fixed in quick 261109-vj6. Was open · **Blocks:** nothing. The dashboard's "Recent orders" is newest created first. The Orders list's "Newest first" sort may order differently, so a "View all" link could show a different first page. Recommended: make the Orders list "Newest first" sort by created time, matching the dashboard. Plan 10-07 was told not to change it.

## P10-BL-03 · Future-dated expenses in the dashboard chart (plan 10-06, coverage D7)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended), today's behavior and wording stay. No code change. Was open · **Blocks:** nothing; built and tested as below.

The chart counts an expense in the month of its date. So an expense dated later this month counts in this month's bar now, and one dated next month shows in no bar until next month arrives. The planner assumed this; no ruling covers it.

- **A (recommended):** keep it. It matches how the Collected card and the expenses page read dates.
- **B:** count only expenses dated up to today, so this month's bar never includes future-dated items.

## P10-BL-04 · What the dashboard shows when a background refresh fails (wave 3 review WR-01)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended); fixed in quick 261109-vj6. Was open · **Blocks:** nothing; plans 10-09 and later follow the current pattern until ruled.

The plan says that on an error the heading stays "Dashboard" and the date line is dropped. That only holds on the first load. If the page loaded once and a later background refresh fails, it shows the earlier greeting and date next to the error line, so staff may read old figures as current.

- **A (recommended):** on any failed load, keep the last good figures but mark them clearly ("Showing figures from 9:41 AM. Couldn't refresh.") with Try Again.
- **B:** on any failed load, hide the figures and show only the error line, as on a first load.

**Built as (for your review):** these small choices were made inside the ruling, with no new wording beyond "Showing figures from {time}. Couldn't refresh." and the existing "Try Again".
- **Where it sits:** in the header title column, under the date line. The greeting, the date line and every summary figure stay.
- **What it covers:** what the summary feeds: the header, the four KPI cards, Orders by status and Recent orders. The Income vs. expenses card and the money strip read their own queries and keep their own failure lines, which never show old figures beside an error.
- **Look:** like the money strip's failure line: Small (14px) in the danger colour, with a ghost small "Try Again".
- **Timing:** like the strip too. It shows when the latest read failed and no retry is running, leaves while a retry runs, and comes back (announced again) if the retry fails. A first-load failure is unchanged.
- **The time:** the moment this browser got the last good answer, shown in Asia/Manila in en-PH style ("9:41 AM"). It is the device clock read as an instant and shown in the shop's zone, the same source the Sessions page uses.

## P10-BL-05 · WebKit cancelled-request errors in the browser tests (wave 3 review WR-03)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended); fixed in quick 261109-vj6. Was open · **Blocks:** nothing now; may cause WebKit/iPhone test failures once plans 10-09, 10-11 and 10-13 add more dashboard requests.

WebKit reports a request that a page navigation cancels as a page error ("due to access control checks"), and the test guard fails on any page error. Plan 10-07 worked around it only for the summary request, in the sign-in helper.

- **A (recommended):** teach the test guard to ignore exactly this message for the app's own `/api/` requests on WebKit, documented in docs/web/e2e.md next to the existing WebKit preload rule. All other page errors still fail.
- **B:** keep failing on it, and add a wait to each spec that navigates away from the dashboard.

**Built as (quick 261109-vj6):** fixed with option A, and the sign-in wait was removed. The message the guard really sees in WebKit is `/localhost:5199/api/v1/dashboard/chart?months=6 due to access control checks.` (Playwright drops the "Fetch API cannot load https:" start), so the rule matches that exact text, for WebKit only, the app's own host and a path under `/api/`. A real run without the sign-in wait showed it: the hand-over journey on the iPhone profile failed on three cancelled `/api/` requests (chart, summary, money on hand) until the rule matched. Fixture self-tests prove other engines, other wording, other paths and other hosts still fail. A plain `fetch` cancelled by a navigation in a probe gave `TypeError: Load failed` (no URL) instead; that wording is not ignored.

## P10-BL-06 · Dashboard figures on a 320 px phone (wave 4 review WR-01)

**Status:** ruled D-107 (owner, 2026-11-09): recommended options; fixed in quick 261109-c4l. Was open · **Blocks:** the browser test gate. In the full browser run (2026-11-07) the dashboard scrolls sideways at 320 px on Firefox, WebKit and iPhone (page 347 px wide in a 320 px window). Two checks fail until you choose: `admin.spec.ts` "switches from the phone tab bar ..." (its 320 px no-sideways-scroll step) and `dashboard.spec.ts` "does not scroll sideways at 320px with a six-digit Collected figure". They are left failing on purpose, not switched off. A third check ("every KPI figure fits inside its card at 320px") is `test.fixme`.

On phones the four dashboard figures sit in a 2 x 2 grid, as the UI spec says. The UI spec's 24 px phone size is now applied. At 320 px wide, each card has 104 px for its figure, but a six-digit amount needs more: ₱58,517.50 needs 110 px and ₱126,450.00 needs 122 px. The figure runs 6 to 18 px into the card's padding. With the smaller figures of a short test run the page did not scroll sideways, but with the larger figures that build up during a full run it does, which breaks the project rule of no sideways scroll from 320 px. At 390 px and wider the figures fit.

- **A (recommended):** one column on small phones (420 px and below), as the Expenses figures already do. Every figure fits at full size. The dashboard gets longer on a phone.
- **B:** keep 2 x 2 and shrink six-digit figures on small phones (about 20 px). The figures stay side by side but are smaller to read.
- **C:** let a long figure wrap onto a second line inside its card (for example after the peso sign). The grid stays 2 x 2 at full size, but some cards get taller. (Simply accepting the overflow is no longer an option: it makes the page scroll sideways.)

## P10-BL-07 · What a staff member sees when the chosen person can't receive a transfer (plan 10-10)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended), today's behavior and wording stay. No code change. Was open · **Blocks:** nothing; the server uses option A for now and the transfer screen comes in a later plan.

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

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended); fixed in quick 261109-vj6. Was open · **Blocks:** nothing now.

Today a transfer records who made it and when on the transfer itself, and the audit log only gets an entry when a transfer is deleted, permanently deleted or handed over. Adding a company expense, by contrast, writes an audit entry. A transfer moves money between people, so you may want the same trail.

- **A (recommended):** add a "money transfer added" audit entry with who sent, who received, the amount, the date and whether there is a note. Same style as the expense entries.
- **B:** keep it as is: the stamps on the transfer are enough for a normal transfer.

## P10-BL-09 · Staff status changes during a money hand-over (wave 6 review IN-05)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended), today's behavior and wording stay. No code change. Was open · **Blocks:** nothing; no money can be overdrawn either way.

A hand-over checks who is staff and who has left at the moment it runs. If, in the very same instant, another Manager deactivates the person receiving the money (or reactivates the person giving it), the hand-over can still go through using the status from a split second before. Example: Manager A hands Jomar's ₱2,000.00 to Liza while Manager B deactivates Liza. Liza is now a former staff member holding ₱2,000.00, and someone has to hand it over again.

- **A (recommended):** accept this. It needs two Managers acting on the same people at the same second, nothing is lost or overdrawn, and a second hand-over fixes it.
- **B:** make deactivate, activate and delete wait for the money lock too, so the two can never overlap. Staff admin then waits briefly whenever a money change is in progress.

## P10-BL-10 · How a deleted transfer shows in a Manager's ledger (plan 10-14, coverage D9)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended), today's behavior and wording stay. No code change. Was open · **Blocks:** nothing; plan 10-17 draws the ledger screen, and the server uses option A for now.

Managers can switch the ledger to also show deleted transfers. The plan did not say what figures such a row shows. Deleted rows never count toward the balance either way.

- **A (used now, recommended):** show the amount it had, in the Money in or Money out column, with no running balance on that row. Staff can see what was deleted.
- **B:** show no amount at all on a deleted row, only its date, people and the word Deleted.

## P10-BL-11 · New or reused wording from plans 10-14 and 10-15 (money screens)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended), today's behavior and wording stay. No code change. Was open · **Blocks:** nothing; the lines below are in use now and can be reworded later.

- "Only Managers can see deleted transfers." The plan spelled this out word for word. It shows if an Admin asks the ledger for deleted transfers.
- "You have nothing on hand to transfer." This is the server's existing line and is in the UI spec table. The Transfer window now also shows it when an amount is typed while your money on hand is zero or less.
- "Couldn't load the staff list. Close this form and try again." This is the existing Paid by line, reused when the Transfer window cannot load the list of people.
- When the server is busy (another money change is in progress), the Transfer window shows the server's own line as the toast title, with nothing added.

Keep them, or give new wording.

## P10-BL-12 · Ledger and staff money wording and layout choices (plans 10-16, 10-17, 10-19)

**Status:** ruled D-107 (owner, 2026-11-09): recommended options; fixed in quick 261109-c4l. Was open · **Blocks:** nothing; the choices below are in use now and can be changed later.

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

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended); fixed in quick 261109-vj6. Was open · **Blocks:** nothing; the record follows D-25 as written.

When a Manager removes a deleted transfer for good, the audit log keeps who sent it, who received it, the amount, the date, whether it had a note, and who recorded and deleted it. It does not say whether the transfer was a hand-over of a former staff member's money, so once it is removed nobody can tell.

- **A (recommended):** add "hand-over: yes or no" to the record. Small change, no new screen.
- **B:** keep it as is (D-25 as written).

**Follow-up for you (new, from quick 261109-vj6):** the stored record now holds `handover=yes` or `handover=no`, like `note=yes` or `note=no`. The Audit Log screen does not show either flag today, and no new wording was added.
- **A (recommended):** leave it in the stored record only. Reason: it answers "was this a hand-over?" for anyone who reads the record, and costs no new wording.
- **B:** also show a "Hand-over: Yes" or "Hand-over: No" line in the Audit Log's "What changed". Reason: staff can see it on screen. It is new wording for you to approve.

## P10-BL-14 · Transfers tab, delete and remove choices (plan 10-20)

**Status:** ruled D-107 (owner, 2026-11-09): recommended options; fixed in quick 261109-c4l. Was open · **Blocks:** nothing; the choices below are in use now and can be changed later.

- While the Delete Transfer window checks the new balances, the loading area is read out as "Loading staff balances…" (an existing line).
- "Show deleted" on the Transfers tab and on the Mine ledger is one setting, so switching tabs keeps it on. Recommended: accept. Otherwise each tab gets its own.
- The Transfers count line reads the same with Show deleted on or off.
- When the last transfer on the page is deleted, focus moves to the card heading, because an empty list has no caption.
- A Remove Permanently refused because the server is busy, or because the transfer is no longer deleted, shows the standard error line.
- A hand-over row on the Transfers tab looks like a normal transfer (it is not marked "Hand-over"). A (recommended): add a small "Hand-over" label. B: keep as is.
- Still open, unchanged: the hand-over "Done to" column in the Audit Log is empty (P10-BL-07), and P10-BL-13. Also: the Audit Log does not show when a removed transfer had been deleted.
- **Added from the wave 10 review (IN-03).** Delete Transfer no longer warns for a receiver who is missing from the staff balances, so the old system placeholder name never shows. Side effect: a deactivated person who holds exactly ₱0.00 is not in the staff balances either, so deleting a transfer to them gives no "balance will be below zero" warning. A (recommended): accept it; the delete still works and the ledger shows the result. B: bring the warning back for deactivated people, which needs a small server change so the screen can tell them apart from the placeholder.

## P10-BL-15 · Showcase and phone layout choices for your screenshot review (plan 10-21)

**Status:** ruled D-107 (owner, 2026-11-09): recommended options; fixed in quick 261109-c4l. Was open · **Blocks:** nothing. These are in use now; review them on the showcase page (/dev/components, section "Dashboard and staff money").

- **Hand Over cards at 320 px (layout fix made).** On a small phone the eye link and Hand Over sit pinned at the top right of an All Staff card and covered a short name. The name now leaves room for both and wraps instead. A (recommended): keep this. B: put the two buttons on their own row under the name.
- **Transfer reason line.** It takes its own row under the strip at every width, and on My Money it sits under the header button. The UI-SPEC says beside. A (recommended): keep its own row, which reads better on phones. B: put it beside, as the spec says.
- **Strip failure line.** Small text (14 px) in the danger colour, with Try Again beside it. Keep it, or choose another size.
- **Headings (wave 6 review IN-02).** The money strip and the My Money card are named regions, not headings, so a screen reader user's "next heading" key skips them. A (recommended): keep as is. B: give them headings.
- **Showcase button wording (developer page only).** New trigger labels such as "Show the Dashboard cases" and "Open Transfer (refused)". No new app wording.
- **Transfer window messages** show as the user types or leaves a box; server refusals are shown by the two "(refused)" demo buttons.
- **Added from the phase-end review (wave 11 IN-03).** To make room for the eye link and Hand Over, the name keeps a fixed 72 px space on its right at 320 px. A larger text size or a longer button label could overlap it. This goes with the Hand Over choice above: option B (buttons on their own row) removes the fixed space.


## P10-BL-16 · Window buttons stick out past the screen edge at 320 px (found while fixing the wave 11 review)

**Status:** ruled D-107 (owner, 2026-11-09): recommended options; fixed in quick 261109-c4l. Was open · **Blocks:** nothing; the buttons can still be pressed (at least 44 px stays on screen).

On a 320 px phone, the Cancel button in the Remove Permanently window starts 30 px past the left edge of the screen, and in the Hand Over window 2 px. The cause is the shared window footer: its buttons sit side by side at the right and never wrap, so long labels push Cancel off the left side. Every window that uses this footer can do the same with long button labels.

- **A (recommended):** let the footer buttons wrap onto a second row when they do not fit. Small change in one shared place.
- **B:** on small phones, stack the footer buttons full width, one per row.
- **C:** keep as is.

## P10-BL-17 · Chart axis labels round half-thousands the wrong way (phase-end review WR-04)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended); fixed in quick 261109-vj6. Was open · **Blocks:** nothing; the chart works, only one axis label can read wrong.

The Income and Expenses chart labels its lines in whole thousands. When the top line is 3,000, 5,000, 7,000 or 9,000, the middle line sits at a half (1,500, 2,500 and so on) but reads "₱2k", "₱3k" and so on. A new shop's first months sit exactly in this range. Example: October income is ₱2,600, the axis reads ₱0, ₱2k, ₱3k, and the "₱2k" line is really at ₱1,500.

- **A (recommended):** show one decimal place for half lines, so 1,500 reads "₱1.5k". Whole thousands stay as they are.
- **B:** keep the labels as approved in the UI spec (App. D.3).

## P10-BL-18 · The Delete Transfer warning works out a balance in the browser (phase-end review IN-06)

**Status:** ruled D-111 (owner, 2026-11-09): option A (recommended), today's behavior and wording stay. No code change. Was open · **Blocks:** nothing; the figure is correct to the centavo and the server's figures replace it after the delete.

The project rule says money is computed on the server only. The Delete Transfer window shows "the balance will be −₱2,500.00" by taking the receiver's balance from the server and subtracting the transfer amount in the browser. It is labelled as a preview. Today this rests on a note in the plan, not on your ruling, so each review flags it again.

- **A (recommended):** allow it by ruling: "a labelled preview built only from server figures may be shown". No code change, and the file cites the ruling.
- **B:** have the server send the figure (a small new read before the delete). Strictest, a little more work and one more request.

## P10-BL-19 · Two dashboard and Transfer wording choices (phase-end review, wave 5 IN-08 and wave 7 IN-07)

**Status:** ruled D-107 (owner, 2026-11-09): recommended options; fixed in quick 261109-c4l. Was open · **Blocks:** nothing; today's behavior stays until you choose.

- **Range switch on the chart.** After you pick 12M, the line under the title says "Last 12 months" at once, while the old six bars stay on screen until the new months arrive. If those six months were all zero, the empty message for 12 months shows early and is not dimmed. A (recommended): keep the line on the shown range until the new data arrives, and dim the empty message while loading. B: keep as is.
- **Transfer button while the figure loads or failed.** The button is dimmed, but a screen reader user hears only "Transfer, dimmed" with no reason, and pressing Enter does nothing. A (recommended): link the button to the strip's own loading or failure line, so the reason is read out. No new wording is needed. B: keep as is (the region already says it is busy). This sits next to P10-BL-04.

## P10-BL-20 · Phase 10 sign-off: what needs you before the phase is marked done

**Status:** open · **Blocks:** marking Phase 10 complete, the phase PR and the merge to main. All 21 plans are built, reviewed and tested.

The verifier (10-VERIFICATION.md, commit 37f4deda) found no gaps: 6 of 6 success criteria and 14 of 14 requirements are met, checked in the code. Status is "human needed" because these steps are yours. P10-BL-01 to 19 are all ruled now (D-107 and D-111), and P10-BL-01 is carried into the Phase 16 plan. What is left:

1. **The pixel (parity) snapshots on CI.** They differ locally by glyph edges and are confirmed only by the CI run on the phase PR. The PR must not merge until that job is green.
2. **One clean full CI run on the phase PR.** Locally every browser test passed once the machine was quiet. The expense list speed test missed its 300 ms limit by 3.7 ms, the known machine issue (D-76, D-88, D-103).
3. **Your sign-off.**

When you are back: approve or reject the sign-off, and I run the phase close (phase complete, roadmap update, transition) and then `/gsd-ship 10`.

## P10-BL-21 · Things found while fixing the UI review (quick 261109-c4l)

**Status:** ruled D-109 (owner, 2026-11-09): option A for all three. All three parts fixed in quick 261109-fmv (part 2 after the owner ruled D-110, option A, when All Staff could not fit with the existing wrapping). Was open · **Blocks:** nothing; today's behavior stays until you choose.

- **Transfer on the My Money header while the figure loads or failed.** D-107 made the dashboard strip's Transfer button read its reason from the strip's own loading or failure line. The My Money header Transfer has the same gap (a screen reader hears only "Transfer, dimmed"), but the balance card it could point at is shown on the Mine tab only, so the All Staff and Transfers tabs have no such line. **A (recommended):** on the Mine tab, describe the button by the balance card's loading or failure line, no new wording; the other tabs stay as they are. **B:** keep as is.
  - **Outcome (quick 261109-fmv):** fixed. On My Money's Mine content (a Manager's Mine tab, and an Admin's page, which shows only the Mine content) the header Transfer is now `aria-disabled` and described by the balance card's own line: "Loading money on hand…" while the figure loads or Try Again runs, "Couldn't load the money on hand." (the bold first line only, so Try Again and the reference are not read) after a failed read, and nothing once the figure shows. At ₱0.00 or below it still says "Nothing on hand to transfer." On All Staff and Transfers the button has no such description. No new wording. Component tests check each description (Manager, Admin, retry, both other tabs, axe in loading and failed).
- **All Staff and Transfers tables at 768 px.** Measured in Chromium at 768 x 1024 (frame 646 px wide): the All Staff and Transfers tables are 680 px wide, so the frame scrolls 34 px sideways and the last column (Actions, right edge 777 px against a frame edge of 743 px) is cut at the card edge with no cue. The ledger now fits (646 px, Actions ends at 743 px). **A (recommended):** give both tables the same `fitTablet` option the ledger now uses, if a measurement shows they fit; the longest notes already wrap. **B:** keep the tablet frame scroll as the spec declares.
  - **Outcome (quick 261109-fmv):** stopped, nothing committed for this part. I measured in Chromium at 768 x 1024 with `fitTablet` on both tables (frame 646 px wide, card edge 744 px). **Transfers fits**: table 646 px, frame does not scroll, Actions ends inside the card, even with a 200 character note. **All Staff does not fit**: with a leaver who holds money (the widest Actions cell) the table is 658 px, so the frame still scrolls 12 px and the Actions header ends at 755 px against the card edge at 744 px. It is already at the narrowest the existing wrapping allows: Person 88, Role 98, Status 130, Money on hand 145 and Actions 197 px (the eye link and the Hand Over button sit side by side and never wrap, `rowActionsClasses` is `inline-flex` with no wrap). Before the change both tables were 680 px (frame 646 px). The Transfers half and the extended 768 px browser check are ready as a patch (applied later under D-110), held back because the plan says to commit nothing for this part when a table cannot fit.
  - **Ruled D-110 (owner, 2026-11-09): option A.** Was: **Your call, All Staff at 768 px.** **A (recommended):** let the Actions cell wrap on tablets so Hand Over drops under the eye link when there is no room (a leaver row gets taller, wording unchanged; this saves about 120 px, so it fits with room to spare), then ship `fitTablet` for both tables. **B:** ship `fitTablet` for Transfers only and leave All Staff scrolling inside its frame at 768 px as today (the Actions column stays cut at the card edge for leavers). **C:** drop the Role column on tablets (saves about 98 px, but hides who is an Admin or a Manager).
  - **Outcome after D-110 (quick 261109-fmv):** fixed. Both tables use `fitTablet`, and on tablets (768 to 1023 px) the All Staff Actions cell may wrap (`pg-tablet:flex-wrap`, All Staff only, through a new optional `className` on `RowActions`), so Hand Over drops under the eye link; both keep the 44 px tap area, no wording or column changed, phones, desktop and the other tables are unchanged. The extended 768 px browser check (ledger, All Staff with a leaver that holds money, Transfers with a 200 character note, Manager; ledger for an Admin) passes in all five projects, and `@money` and `@money-sweep` pass.
- **A browser test that fails on its own, before this work.** `@money a Manager deletes a wrong transfer ... (D-29, D-35, D-48)` fails its focus check ("focus is on the next row action, else the previous one") on 2 or 3 of the 5 browser projects, whichever run. It failed the same way with the code at the commit before this work, so these fixes did not cause it. **A (recommended):** I look into it as its own small fix. **B:** leave it to the CI run on the phase PR.
  - **Outcome (quick 261109-fmv):** fixed, and the test was the main cause. The five browser projects run in parallel against one shared database, and the Transfers list is shop-wide, so up to five copies of this test add and delete transfers in the same list at the same moment. The test remembered the position of its row among all row actions and expected focus at that position after the delete. Logged on failure (focus target and the row actions before and after): other copies' rows had left or arrived, so the position moved, for example before `[Wrong918d, Wrong09ac, Wrong2bec(own)]`, after `[Wrong918d]`, focus correctly on `Wrong918d` while the test expected position 1; and with only its own row before, a row from another copy arrived, so the table caption was correctly focused while the test expected the heading. Each project passed alone (5 of 5), and failed only when run together (2 failures in the first run, 3 in each of the next two). The test now names the target: the first row after the deleted one that is still listed, else the nearest one before it that is still listed, else the table caption (rows still shown) or the heading (empty list); no assertion was loosened and no retry or sleep was added. One small app gap was also real and is fixed with a failing component test first: the focus rule kept only one neighbor, so when that neighbor left the list too (another person's delete) focus fell to the caption although other rows were still shown; it now falls back to the nearest row that is still shown. After the fix the focus test passed in all five projects in three runs in a row (15 of 15), and the whole `@money` browser run passed.
