# Owner items parked during Phase 13 execution

*Created: 2026-11-22T22:57:00-06:00 · Updated: 2026-11-25T01:58:00-06:00*

The owner went away during the Phase 13 run (2026-11-22) and asked for the run to continue, then for `/gsd-secure-phase 13` and `/gsd-validate-phase 13`. Anything that needs the owner is parked here instead of blocking the run. Nothing here was decided for the owner: where code had to pick something, the pick is labelled "built" and can be changed.

Rulings the owner gave before leaving are D-38 to D-43 in `.planning/phases/13-quote-inquiries/13-CONTEXT.md`.

## P13-BL-01 · Cloudinary usage alarm can be lost for a month (review 13-REVIEW-W1 WR-02)

**Status:** open · **Blocks:** nothing. Not changed.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

The daily maintenance run checks Cloudinary usage once a month (D-34). It saves "done for this month" before it sends the over-80% and photo-limit alarm lines. If that one run's answer is lost, the alarm does not repeat until next month.

- **A (recommended):** do not mark the month done when an alarm line was produced, so a bad month repeats the alarm every day.
- **B:** keep it as built.

## P13-BL-02 · Public photo upload pool size (fix for 13-REVIEW-W2 WR-01, ruling D-39)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

Public quote photos now have their own upload pool, apart from the 2 staff slots. The size is a setting.

- **A (built, recommended):** 2 at once, 4 waiting. One visitor sending 5 photos fits; a sixth caller at that moment gets "too many requests" and retries. Small because the host app pool has 256 MB.
- **B:** a different size (settings `UploadSlots:Public:AtOnce` 1 to 8, `UploadSlots:Public:Waiting` 0 to 20).

## P13-BL-03 · Choices made in the quote photo upload (plan 13-05)

**Status:** open · **Blocks:** nothing. Built as described.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

- New messages: "Keep each photo file name to 255 characters or fewer." and "Photos could not be attached. Try sending them again."
- A file name that is empty after cleaning is stored as "Photo 1", "Photo 2" and so on.
- An upload key works up to its end time (2 hours by default), not at it.
- The upload key is not wiped after the last photo or after it expires. It is only a hash and stops working at its end time.

- **A (built, recommended):** keep all four.
- **B:** change any of them (say which).

## P13-BL-04 · Choices made in the quote form bot guards (plan 13-06)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

- The expired-form message is "The form timed out. Please send it again." (with D-38 the visitor rarely sees it: the form resends on its own).
- A hidden bot field that holds only spaces counts as empty (not a bot).
- The per-sender daily limit reuses the per-address message.
- A repeat of the exact same request is not saved twice, but still uses one of the hourly per-address and site-wide allowances (the limiter runs before the repeat check; fixing it means reordering the server pipeline).

- **A (built, recommended):** keep all four.
- **B:** change any of them (say which).

## P13-BL-05 · Admin can see the Quote alerts address (plan 13-07)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

Admin and Manager both already read site settings (which include the shop email), so an Admin can see the Quote alerts address. Only a Manager can save it.

- **A (built, recommended):** keep it; Admins can see it, only Managers change it.
- **B:** hide it from Admin.

## P13-BL-06 · Choices made in the quote request create (plan 13-01)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

- A "product line" choice with no key, or a key over 40 characters, is reported on the product line field; an unknown choice word is reported on the product choice field. All use "Choose a product from the list."
- A product line key sent with "custom" or "not sure" is ignored, not refused.

- **A (built, recommended):** keep both.
- **B:** change either.

## P13-BL-07 · Privacy Policy draft says the staff alert carries visitor details (plan 13-04)

**Status:** open · **Blocks:** nothing. Built as A. Settled together with plan 13-25 (owner approval of the policy).
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

The executor added one line the plan did not list: the email-sender entry now says it delivers "the alert our staff get about a quote request", because that alert carries the visitor's name, phone and the start of the message. All the wording is draft and `approved` stays false.

- **A (built, recommended):** keep the line.
- **B:** remove or reword it.

## P13-BL-08 · Should the sign-in and profile email check use the stricter D-42 rule too? (fix 13-REVIEW-FIX-W4, WR-04)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

D-42 named only the shop email and the Quote alerts address, so the fix added a new stricter browser rule (`isContactEmail`) for those two and left the shared `isEmailShaped` rule unchanged. `isEmailShaped` also checks the sign-in and staff profile emails.

- **A (built, recommended):** keep the sign-in and profile check as it is; staff emails are already checked by the server's own rules.
- **B:** use the stricter rule for the sign-in and profile emails too.

## P13-BL-09 · Staff inbox list: wording and the phone search floor (plan 13-11)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

- A bad list query (status, search, page) answers "Check the status, search and page settings." A bad page size answers "Use a page size of 10, 20, 50 or 100."
- A search with fewer than 3 digits does not search phone numbers (the plan said "at least 3 digits remain"; the same floor applies to the search itself). Names and team names are still searched.

- **A (built, recommended):** keep both.
- **B:** change either.

## P13-BL-10 · Choices made in the staff alert email (plan 13-10)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

- **Email wording the UI spec did not give:** the alert heading is "New quote request" with the hidden preview "{name} sent a quote request." The overflow email heading is "More quote requests are waiting" with the preview "Open Quote Requests to see them all."
- **Quiet skip:** with no Quote alerts address, or an address the mail queue refuses, nothing is logged and no email is sent. The request is still saved.
- **The hourly cap of 20 counts per address:** changing the Quote alerts address mid-hour starts a fresh count.
- **"Photos: n"** is how many photos the visitor said they would attach. The inbox shows which actually arrived.
- **Control characters in form text:** not rejected (review W1 IN-04, optional part). The alert cleans them itself, so it is safe either way.

- **A (built, recommended):** keep all of the above.
- **B:** change any of them (say which): new wording, a log line or staff notice for a refused address, or a stricter form rule for control characters (server rule plus its browser mirror).

## P13-BL-11 · Choices made in the quote form photo upload and failure states (plan 13-12)

**Status:** open · **Blocks:** nothing. Built as A in each item.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Retrying a failed photo.** A: one retry, only when a second try could help (no answer, or a 408, 409, 429 or 5xx reply). A 422 or 404 is final. B: retry every failure once.
2. **Wording for one missing photo.** A: "Please send it to us on Messenger." B: "send them", as the UI spec writes it.
3. **A dropped connection while the phone is online.** A: "We're not sure your inquiry went through..." (offline shows "Couldn't send..."). B: always "Couldn't send...".
4. **When the failure message piece cannot load** (the form stays within its 45 KB budget by loading it only when Send is pressed). A: a plain alert line with the same words. B: keep the full red box and raise the form budget by about 0.2 KB.
5. **Photo size check in the browser.** A: check the pixel limit for JPG, PNG and WebP, and leave HEIC to the server. B: no browser check.
6. **Dropdowns while sending.** A: they stay disabled (as in 13-09). B: keep them enabled and ignore changes.
7. **The Email placeholder "you@gmail.com"** (from the UI spec) was flagged by the build test that looks for email addresses in the public showcase files. A: add it to that test's list of allowed made-up addresses, which already has "name@gmail.com". B: change the placeholder to "you@example.com".

The form file had only 0.02 KB of its 45 KB budget left. After the wave 5 fixes it is 44.23 KB (see P13-BL-12).

## P13-BL-12 · Choices made in the wave 5 review fixes (13-REVIEW-FIX-W5)

**Status:** open · **Blocks:** nothing. Built as A in items 1 to 3. Item 4 is unchanged.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **A photo dropped while the inquiry is sending.** A: refuse it with "Photos can't be added while your inquiry is sending." B: other wording.
2. **Phone search floor.** A: the search drops a leading 0 or 63 first, then needs 3 digits, so "0917" and "+63 917" find each other and "091" or "639" alone find nothing. B: the old rule, where "639" matches every number.
3. **While Send waits for photos still being prepared.** A: the "Sending" label and spinner stand in. B: add a "Getting your photos ready" line (new copy, about 0.05 KB of the form budget).
4. **The "maybe sent" message (review W5 IN-01).** It says "You won't send it twice", which is only true if the visitor changes nothing before pressing Send again. A: keep it. B: new wording, for example "If you send it again unchanged, we won't get it twice."

The form budget gained 0.86 KB because the form no longer loads the legal page styles. The form file is now 44.23 KB of its 45 KB budget. No limit changed.

## P13-BL-13 · Choices made in the Quote alerts test email (plan 13-13)

**Status:** open · **Blocks:** nothing. Built as A in each item.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Test email wording.** A: heading "Quote alerts work", preview "Quote alerts reach this address.", no link. B: add an "Open Quote Requests" button.
2. **A saved address that can never get mail.** A: the server answers "This address can't get email. Save a different address, then send a test." B: treat it like "no address saved".
3. **Failure message for "no address" and "can't get email".** A: the UI spec's one failure message ("Couldn't send the test email." / "Check your internet connection and try again."). B: show the server's own sentence for these two.
4. **The limit of 3 tests in 10 minutes.** A: counted per connection, like every other limit. B: counted per Quote alerts address.
5. **Audit entry detail.** A: none (never the address). B: a fixed word such as `sent=1`.
6. **Unsaved-change check.** A: spaces at either end are ignored when comparing the field to the saved address. B: exact text.

## P13-BL-14 · Choices made in the staff Quote Requests list (plan 13-15)

**Status:** open · **Blocks:** nothing. Built as A in each item.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Phone card order.** A: the shared phone card: the name as the title, the other columns below in table order. B: a custom card in the UI spec's order.
2. **"Couldn't refresh" line.** A: the wording used elsewhere in admin, "Showing figures from {time}. Couldn't refresh." B: "Showing requests from {time}..."
3. **Screen reader count on a filter with one request.** A: the spec text as written ("Spam 1 requests"). B: "1 request" for exactly one.
4. **Refresh when staff come back to the tab.** A: every time. B: only when the list is over 30 seconds old.
5. **Name link color.** A: dark text, underlined on hover. B: the orange link color used for order numbers.
6. **Empty-list icon.** A: the inbox icon on every filter. B: on Open only.

## P13-BL-15 · Choices made in the wave 6 review fixes (13-REVIEW-FIX-W6)

**Status:** open · **Blocks:** nothing. Built as A in each item.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Quote Requests list after a failed refresh.** A: it stops refreshing on its own (every 60 s and when staff return to the tab) until Try Again works. B: keep refreshing when staff return to the tab; a failed first load would then flash the loading rows each time.
2. **The hidden "new quote request" line.** A: it clears after 5 seconds, and arrivals within that time add up ("2 new quote requests."). B: a longer time such as 10 seconds, or each arrival with only its own count.
3. **Who decides a request is "new".** A: the browser, with two rare misses (a visit that opens on page 2 or later; a request closed before this visit saw it, then moved back to New). B: the list answer from the server says what is new (an API change).
4. **Which address the "Test email on its way" message names.** A: the address saved when Send Test Email was pressed, with no API change. If another Manager saves a different address in that moment, the message can name the wrong one. B: the server's answer names the address it mailed.

## P13-BL-16 · Choices made in the quote request detail and status moves (plan 13-16)

**Status:** open · **Blocks:** nothing. Built as A in each item.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Spam and photos that never arrived.** A: Spam clears every photo place, including the names of photos that never arrived. B: keep those names.
2. **The "received" line in the history.** A: built from the received time when the request is read, not stored. B: store a first history row when the visitor sends the form, as orders do.
3. **History order.** A: newest first, as the UI spec shows. B: oldest first, like the order history.
4. **Moving to the status it already has.** A: refused with "This request is already {status}." B: accepted with no change, as orders do.
5. **Wording:** "A request that became an order can't change status.", "Choose a status." and the shared "This was changed by someone else. Reload and try again." A: keep. B: new wording.
6. **Audit page detail.** A: the label "Quote request status changed" only. B: also "Status: New to Contacted".
7. **A photo upload at the moment of a Spam move.** A: that photo is removed by the 2-day stray photo sweep instead of the next daily run. B: a lock so it is always queued at once.

## P13-BL-17 · Choices made in the new quote request count (plan 13-17)

**Status:** open · **Blocks:** nothing. Built as A in each item.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Screen reader count above 99.** A: "Quote Requests, 99+ new", like the chip. B: the exact count.
2. **The count after a failed read.** A: it keeps trying every 60 seconds and when staff return to the tab, with no chip meanwhile, so it comes back by itself. B: pause like the inbox list until Try Again or a reload.
3. **Phone tab width at 320 px.** A: about 61 px each (the bar keeps its side padding; the spec says 64; every tab is still at least 44 px and no label is cut). B: drop the padding for exactly 64 px.
4. **Dashboard strip while it re-reads after a failure.** A: the failure line stays and Try Again shows busy. B: swap to the loading look, which reads the failure out again each time.
5. **Strip figure for large counts.** A: the exact count ("1,250"). B: "99+" like the chip.

## P13-BL-18 · What a status change answers (review W7 IN-01, built in 13-REVIEW-FIX-W7)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

The answer to a status change used to carry the whole request (name, phone, email, message, photo addresses). The repeat-press guard keeps each answer as plain text for 24 hours, where the Manager delete and the 6-month purge cannot remove it.

- **A (built, recommended):** the answer carries only the id, the new status, the time of the change and the new version. The request page reads the request again after a move.
- **B:** answer the whole request, accept the 24-hour copy, and say so in the Privacy Policy.

Order calls keep their full answers the same way. They were left alone because no "delete for good" is promised for orders.

## P13-BL-19 · Choices made in staff notes and the Manager delete (plan 13-18)

**Status:** open · **Blocks:** nothing. Each item was built as A unless it says otherwise.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **What adding a note answers.** A (as the plan says): the whole request, so the 24-hour repeat-press copy holds the visitor's details and the note text, like the old status answer (P13-BL-18). B (recommended): only `{ id, noteId, createdAtUtc, version }`. The request page reads the request again after a note either way. The wave 8 review fix may move this to B to match P13-BL-18; that fix report will say.
2. **Saved answers after a delete.** A: repeat-press copies of earlier answers for that request stay for up to 24 hours. B: the delete removes them too.
3. **Notes on a request that became an order.** A: allowed in every status. B: blocked once converted.
4. **Note count.** A: no limit per request. B: a cap, for example 200.
5. **What the delete audit entry records.** A: the status and the photo count. B: also the note and history counts, or nothing at all.
6. **Delete check order.** A: a converted request is refused before the version check, as the plan orders. B: the version check first.
7. **Wording to confirm:** "Write a note first.", "Keep the note to 1,000 characters or fewer.", "A request that became an order can't be deleted.", and the audit labels "Quote request note added" and "Quote request deleted".

## P13-BL-20 · Choices made in the staff quote request page (plan 13-19)

**Status:** open · **Blocks:** nothing. Each item was built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Cover mark on quote photos.** A: no "Cover" on photo 1. B: show it as on order photos.
2. **Missing-photo sentence with one photo.** A: the UI-SPEC words exactly ("...send them on Messenger"). B: "send it" when only one photo is missing.
3. **Where the status badge sits.** A: under the heading beside the received line, as the spec says. B: beside the name, as on the order page.
4. **Change Status while a move runs.** A: the button reads "Saving", as on the order page. B: it keeps "Change Status" with only the spinner.
5. **Try Again while a read runs again.** A: the button stays and keeps focus but shows no spinner. B: give the shared error state a busy look.

## P13-BL-21 · Choices made in the wave 8 review fixes (13-REVIEW-FIX-W8)

**Status:** open · **Blocks:** nothing. Each item was built as A unless it says otherwise.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **What adding a note answers (settles P13-BL-19 item 1).** A, built: only the request id, the note id, the time and the version, so the 24-hour repeat-press copy holds no visitor details or note text. B: answer the whole request and say so in the Privacy Policy.
2. **Should the Manager delete also clear saved answers (P13-BL-19 item 2)?** A, built: no, because with item 1 the saved staff answers hold only ids, statuses, times and versions. B: clear them, which needs a new indexed column (a schema change).
3. **A photo that finishes uploading during a delete (review IN-01). Not built.** A (recommended, as for Spam in P13-BL-16): accept that it can stay in storage for about 3 days until the stray sweep removes it, and add one sentence to the API doc and the Privacy Policy text. B: lock the request in both the upload and the delete.
4. **How a "not found" after a move is announced.** A: the "not found" heading takes focus. B: a status line reads it out with no focus move.
5. **Which characters the email reply link encodes.** A: `%`, `?`, `#` and `&`. B: every reserved character.

The delete docs no longer say a delete takes an Idempotency-Key, so that choice is closed. A retried delete after a lost answer gets "not found", which plan 13-21 treats as already deleted.

## P13-BL-22 · Choices made in the Notes card and Delete Request (plan 13-21)

**Status:** open · **Blocks:** nothing. Each item was built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **A "not found" answer to the page's own delete.** A: any 404 to the page's own delete counts as deleted, because the web client retries a lost delete by itself and the page cannot tell that retry from someone else's delete. B: only a 404 on a second press counts as deleted.
2. **Where a delete goes back to.** A: the inbox view the person came from (its filter and search), replacing the deleted request in history. B: always the plain Quote Requests list, as a new history entry.
3. **When a new note shows.** A: when the request is read again a moment later. B: at once, from the typed text and the signed-in name.
4. **Text typed while a note is sending.** A: the box keeps it. B: always clear the box.
5. **"Note added."** A: a hidden polite status only. B: also a success toast.
6. **The Notes card hint.** A: under the card title only. B: also linked to the box so a screen reader reads it with the box.
7. **A version clash on a note.** A: the page's shared clash banner, with the typed note kept. B: a line just for notes asking to press Add Note again.
8. **Wording to confirm:** the new texts are listed in `13-21-SUMMARY.md` ("Internal notes", "Adding", "Note added.", "Deleting", "Quote request deleted" and the confirm text).

## P13-BL-23 · Choices made in the Turn into Order server side (plan 13-20)

**Status:** open · **Blocks:** nothing. Each item was built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **The saved copy of a new order's answer.** A: creating an order answers the full order, and the repeat-press guard keeps that copy for 24 hours, like every order save. So an order deleted for good less than a day after it was made still has that copy. B: a short answer when the order came from a quote request, which would change what plan 13-22 relies on.
2. **The quote link in the order data.** A: optional. B: required.
3. **Audit entries when an order is deleted for good.** A: both the order entry and a "quote request deleted" entry. B: only the order entry.
4. **Which requests can become an order.** A: any status except one that is already an order, Spam included. B: refuse Spam.
5. **The suggested product type.** A: the first active type of the chosen line, by name. B: add a sort order to types, which is a schema change.
6. **When the request is locked during the order save.** A: last, just before the order number is taken. B: first.
7. **Wording to confirm:** "This quote request was already turned into an order." and the audit label "Quote request turned into an order".
8. **The link on a deleted order.** A: inside the order data. B: also as a separate field.
9. **The prefilled "received on" date.** A: the shop's business day (Manila time). B: the UTC time.

## P13-BL-24 · Choices from the wave 9 review fixes (13-REVIEW-FIX-W9)

**Status:** open · **Blocks:** nothing.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Which product type Turn into Order suggests (review IN-03).** A (built): the first active type of the line by name, so "Others" can come first. B (recommended by the review): put "Others" last, as the product type list does. No code was changed.
2. **The upload race now also applies when an order is deleted for good (review IN-05).** This joins P13-BL-21 item 3: one photo can stay in storage for about 2 to 3 days after either delete. A (recommended): accept it and add one sentence to the API doc and the Privacy Policy. B: lock the request in the upload and in both deletes.
3. **How long a second order save waits on the same quote request (IN-06 fix).** A (built): at most 10 seconds, then "busy", the same wait as other order locks. B: the database default of 30 seconds.

## P13-BL-25 · Choices made in the Turn into Order web side (plan 13-22)

**Status:** open · **Blocks:** nothing. Each item was built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **"From quote request" on a deleted order's page.** A: the word "Yes" as plain text. B: keep the "View Request" link, since the request still exists.
2. **Saving finds the request was deleted.** A: a banner "Couldn't find that quote request." and "Press Save Order to save the order without it."; the link is dropped and every typed value stays. B: other wording, or ask before saving without the link.
3. **The request can't be read (not a "not found").** A: reuse the form's "Couldn't load the order form." with Try Again. B: a separate line, "Couldn't load the quote request."
4. **Icon for the "From quote request" row.** A: the inbox icon. B: another icon from the set.
5. **Wording to confirm:** "Turn into Order", "Filled in from the quote request from {name}, received {date}. Add the items and prices, then save.", "The quote request is now Converted.", "Save as a New Order Instead", "Couldn't find that quote request. The form is blank." and "Converted to order {number}".

## P13-BL-26 · Choices from the wave 10 review fixes (13-REVIEW-FIX-W10)

**Status:** open · **Blocks:** nothing.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Stopping a second order from the same request through Back (review WR-01).** A (built): saving a form filled from a request replaces it in the browser history, and a tab that already knows the request is Converted shows the "already an order" box as soon as the form opens. B: the server also sends the request's status and order with the prefill, so every tab knows up front.
2. **A Converted request whose order was deleted (review WR-02). Not built.** A: keep it as it is; "Open Order" leads to "not found". B: the server adds a "deleted" flag, so a Manager gets a link to the deleted-order view and an Admin sees the order number as text with a reason.

## P13-BL-27 · Privacy Policy 1.1 and the form notice: your approval (plan 13-25, D-28)

**Status:** answered A (owner, 2026-11-25, ruling D-45 in 13-CONTEXT.md). Still to do: add the stray-photo sentence, flip the page to approved and update the five DRAFT-pinning tests.

Read the review package in `.planning/phases/13-quote-inquiries/13-25-SUMMARY.md` (every added or reworded sentence next to the 1.0 wording, and the form notice). Then answer:

- **A (recommended):** approve the draft plus one sentence about the rare stray photo (wording in the SUMMARY). This also settles P13-BL-21 item 3 and P13-BL-24 item 2.
- **B:** approve it exactly as written.
- Or give the exact changes.

It also settles P13-BL-07 (the staff alert line). Until then the page stays DRAFT, out of the sitemap and not indexed.

## P13-BL-28 · Choices made in the Component Showcase additions (plan 13-23)

**Status:** open · **Blocks:** nothing. Each item was built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Request page parts in the showcase.** A: the showcase holds only the UI-SPEC list (the quote form states, status pills and badges, the count chip, the dashboard strip). B: also add read-only cases for the Notes card, Delete Request, Turn into Order, the "already an order" box and the status menu, with their actions turned off.
2. **Where the quote form states show.** A: in the showcase and on the dev parity page. B: also on `/dev/public`.
3. **Bundle cost.** A: showing the real form in the showcase adds about 0.10 KB to the Contact page (148.32 of 150 KB). B: show the form states on the parity page only, which removes that cost.

## P13-BL-29 · Choices from the showcase review fixes (13-REVIEW-FIX-W11)

**Status:** open · **Blocks:** nothing. Built as A unless it says otherwise.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **Where the showcase demos get their shop data (review CR-01).** The demo used to put fake product lines and shop facts into the real public pages' memory. A (built): the demos use fixed made-up data in their own separate space, so the real pages never see it, and no link inside a demo navigates. B: the showcase reads the real shop data instead, which removes the separate space and its small cost on the public pages.
2. **Public page size.** The fix above adds about 0.1 KB to every public page (privacy is now 149.19 of 150 KB). This joins P13-BL-28 item 3; choosing B there and B here would win the bytes back.
3. **Alert-style demo states.** A: the photos-refused, rate-limited and send-failed states show only after "Show this example", so a screen reader doesn't hear three alerts when the showcase opens. B: show them on load.
4. **The count-chip sidebar demos.** A: made inert, so the page has one real Admin menu. B: leave them live.

## P13-BL-30 · Lighthouse performance below 0.95 on the public pages (plan 13-24)

**Status:** answered: accepted as report-only (owner, 2026-11-25, ruling D-46 in 13-CONTEXT.md).

Performance scored / 0.93, /products 0.94, /gallery 0.92 to 0.94 and /contact 0.93 to 0.94, twice. Every other category scored 1, and layout shift and blocking time are within limits. The cause is page load time (LCP) of 2.5 to 3.0 s. Plans 11-36 and 12-24 saw the same miss.

- **A (built):** keep the gate as it is and record the miss as a known gap.
- **B:** a quick task to bring public page load time down, aiming to get /contact back to its pre-Phase 13 score.

## P13-BL-31 · Showcase test choices (13-SHOWCASE-E2E-FIX)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

1. **The New count read on the showcase page.** The admin menu reads the New quote count on every admin page, including the showcase, so the showcase now makes that one real read besides the sign-in refresh. A (built): keep the real menu and let the test allow that read; any call from a demo still fails the test. B: skip the count on the showcase page only, so its menu shows no count.
2. **The showcase section title.** A: "Quote requests". B: "Quote Requests", to match the menu item.

The footer Legal row parity gap from Phase 12 (12-13, in STATE.md) is still open and unchanged.

## P13-BL-32 · Two accepted security risks with no owner ruling yet (13-SECURITY.md)

**Status:** open · **Blocks:** nothing (both low severity; the audit found 0 open threats).
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

The security audit closed all 73 threats. Two were accepted in the plans without a named owner ruling. Please confirm or reject each:

1. **AR-13-02 (T-13-08):** the daily maintenance call from GitHub uses a secret key; guessing it is accepted as low risk because it runs only from main and is rate limited. A: accept. B: ask for an extra guard.
2. **AR-13-05 (T-13-35):** the staff inbox search text sits in the address bar (so Back and links keep the search), which can hold a visitor's name; the server's request logs drop it. A: accept. B: keep the search out of the address.

## P13-BL-33 · Empty messages for the Converted, Closed and Spam pills (UI review fix 5)

**Status:** open · **Blocks:** nothing. Wording, so your call; nothing was changed.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

All three empty pills say "Requests show here when their status changes." The UI review suggests each says what its status means. A: keep the one sentence. B: one sentence each, for example "Requests you turn into orders show here.", "Requests you close show here." and "Requests you mark as spam show here."

## P13-BL-34 · The 6 px gap inside the status pills (UI review, 13-UI-REVIEW-FIX)

**Status:** open · **Blocks:** nothing. Built as A.
**Answer:** accepted as built (owner, 2026-11-25, ruling D-47 in 13-CONTEXT.md, UAT test 19).

The pills reuse the Gallery pill look, which the base UI spec sets at a 6 px gap between the label and its count. The Phase 13 spec's "Declared exceptions" list says "No other exception" and does not name it. A: add this 6 px gap to the Phase 13 declared exceptions (a spec note only). B: move the pills to an 8 px gap, which would also differ from the Gallery pills.

## P13-BL-35 · The stuck photo backlog leaves Cloudinary all at once on the first live run (13-REVIEW-W12 IN-06, plan 13-27)

**Status:** open · **Blocks:** nothing. Built as B (the plan as written).

Since Phase 11 (content) and Phase 13 (quotes), queued photo removals failed as `outside-folder` and stayed queued. After the 13-27 fix, the first live run after the deploy removes all of them, 25 per batch, with no cap and no preview. Each one is still checked against the photo rows first, so a photo still in use is kept. Cloudinary removals cannot be undone.

- **A (recommended):** add one step to the deploy checklist: before the first run, count the live queue rows with `outside-folder` by folder (a read-only look) so you know how many will go.
- **B:** accept it as is and record that here.

## P13-BL-36 · Small follow-ups from the 13-27 review and security check

**Status:** open · **Blocks:** nothing. Deferred to `/gsd-code-review 13 --fix` with the other phase 13 findings; nothing was changed.

- **WR-01:** the runbook row "Photo removals still failing" (`docs/operations/maintenance.md:93`) says to press Run now for every code. That never clears an `outside-folder` row. The right step (check the row, then remove it by hand) is only on the "needing attention" row. This is runbook wording, so your call.
- **IN-01:** the pin test compares the sweep with `OwnFolders`, not with what the job accepts.
- **IN-02:** `IsInOwnFolder` accepts a bare folder id and ids with empty or `..` parts. No live path reaches this.
- **IN-03 / security note 1:** `CloudinarySettings.OrdersPrefix` is an unused second orders prefix.
- **IN-04:** stale wording: "both folders" in `StraySweepJob.cs:183` and `docs/operations/cloudinary-setup.md:190-191`, and the `PublicIds` class summary names order photos only.
- **IN-05:** no test pins the check order for an outside-folder row that a photo row names. Both orders are safe.
- **Security note 2:** `CloudinaryImageStorage.RemoveAsync` has no folder check of its own (the job is its only caller). A second check would be extra safety only.
- **Security note 4 (optional):** add "(removal end to end: 13-27)" to threat rows T-13-23, T-13-24 and T-13-61 in 13-SECURITY.md.

## Manual checks for the owner (cannot be proven by automated tests)

- [ ] Photo picker on a real phone: the camera and gallery buttons, a real photo preview, and the no-preview icon for an HEIC photo in a desktop browser (after plan 13-12 puts the picker on the form).
- [ ] Contact page layout on a real phone (form first, then Messenger, Call, hours, phones, map).
- [ ] The Quote alerts card in Site Content > Business info, in Blush and Espresso, on phone and desktop.
- [ ] Quote form on a real phone: pick a photo and press Send at once. The photo must arrive, and Send shows Sending until it does (13-REVIEW-FIX-W5 CR-01).
- [ ] Quote Requests list on a real phone: the cards, the filter pills and the search (plan 13-15).
- [ ] Send a real test email from Site Content > Business info > Quote alerts and check it arrives (plan 13-13).
- [ ] After the Phase 13 deploy, on the live site: set the Quote alerts address and send the test email, then add the first public Gallery photo and check it on a phone. Full steps in `.planning/phases/13-quote-inquiries/13-26-SUMMARY.md` (plan 13-26, INQ-04).
- [ ] The Quote Requests count chip, the rail dot, the Quotes phone tab and the dashboard strip in Blush and Espresso, on phone and desktop (plan 13-17).
- [ ] On a quote request page with a keyboard and a screen reader: Change Status and the Spam confirm, Load Latest after a version clash, and the "not found" page after a move on a deleted request (plan 13-19, wave 8 fixes).
- [ ] On a phone and with a screen reader: add a note, then delete a request as a Manager and land back on the inbox (plan 13-21).
- [ ] Delete Request on a request someone else just turned into an order: the page shows the reason and then Converted after Cancel (wave 9 fix WR-02).
- [ ] On a phone: turn a request into an order, check the prefilled form, save it, and follow the links between the order and the request both ways (plan 13-22).
- [ ] After saving an order made from a request, press Back: it skips the filled form (wave 10 fix WR-01).
- [ ] Look at the Contact form, the Quote Requests inbox, a request page and the showcase in Blush and Espresso at 320, 768 and 1440 px, including the selected pill and warning text contrast (UI review fix 4).
- [ ] With a screen reader, send the quote form (with a photo refused and with a failed send) and check each message is read once, not twice (UI review fix 6).
- [ ] Open the Component Showcase, "Quote requests" section, in Blush and Espresso and check each state looks right (plan 13-23).
- [ ] Re-run UAT test 11 on CSPS_Dev: mark a request with photos as Spam, press Run now, and check the photos are gone from the dev quotes folder in Cloudinary with no "Photo removals still failing" line. The row stuck since UAT test 9 should clear on the same run (plan 13-27, G-13-11).
