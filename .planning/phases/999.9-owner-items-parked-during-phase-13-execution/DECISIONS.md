# Owner items parked during Phase 13 execution

*Created: 2026-11-22T22:57:00-06:00 · Updated: 2026-11-23T16:11:00-06:00*

The owner went away during the Phase 13 run (2026-11-22) and asked for the run to continue, then for `/gsd-secure-phase 13` and `/gsd-validate-phase 13`. Anything that needs the owner is parked here instead of blocking the run. Nothing here was decided for the owner: where code had to pick something, the pick is labelled "built" and can be changed.

Rulings the owner gave before leaving are D-38 to D-43 in `.planning/phases/13-quote-inquiries/13-CONTEXT.md`.

## P13-BL-01 · Cloudinary usage alarm can be lost for a month (review 13-REVIEW-W1 WR-02)

**Status:** open · **Blocks:** nothing. Not changed.

The daily maintenance run checks Cloudinary usage once a month (D-34). It saves "done for this month" before it sends the over-80% and photo-limit alarm lines. If that one run's answer is lost, the alarm does not repeat until next month.

- **A (recommended):** do not mark the month done when an alarm line was produced, so a bad month repeats the alarm every day.
- **B:** keep it as built.

## P13-BL-02 · Public photo upload pool size (fix for 13-REVIEW-W2 WR-01, ruling D-39)

**Status:** open · **Blocks:** nothing. Built as A.

Public quote photos now have their own upload pool, apart from the 2 staff slots. The size is a setting.

- **A (built, recommended):** 2 at once, 4 waiting. One visitor sending 5 photos fits; a sixth caller at that moment gets "too many requests" and retries. Small because the host app pool has 256 MB.
- **B:** a different size (settings `UploadSlots:Public:AtOnce` 1 to 8, `UploadSlots:Public:Waiting` 0 to 20).

## P13-BL-03 · Choices made in the quote photo upload (plan 13-05)

**Status:** open · **Blocks:** nothing. Built as described.

- New messages: "Keep each photo file name to 255 characters or fewer." and "Photos could not be attached. Try sending them again."
- A file name that is empty after cleaning is stored as "Photo 1", "Photo 2" and so on.
- An upload key works up to its end time (2 hours by default), not at it.
- The upload key is not wiped after the last photo or after it expires. It is only a hash and stops working at its end time.

- **A (built, recommended):** keep all four.
- **B:** change any of them (say which).

## P13-BL-04 · Choices made in the quote form bot guards (plan 13-06)

**Status:** open · **Blocks:** nothing. Built as A.

- The expired-form message is "The form timed out. Please send it again." (with D-38 the visitor rarely sees it: the form resends on its own).
- A hidden bot field that holds only spaces counts as empty (not a bot).
- The per-sender daily limit reuses the per-address message.
- A repeat of the exact same request is not saved twice, but still uses one of the hourly per-address and site-wide allowances (the limiter runs before the repeat check; fixing it means reordering the server pipeline).

- **A (built, recommended):** keep all four.
- **B:** change any of them (say which).

## P13-BL-05 · Admin can see the Quote alerts address (plan 13-07)

**Status:** open · **Blocks:** nothing. Built as A.

Admin and Manager both already read site settings (which include the shop email), so an Admin can see the Quote alerts address. Only a Manager can save it.

- **A (built, recommended):** keep it; Admins can see it, only Managers change it.
- **B:** hide it from Admin.

## P13-BL-06 · Choices made in the quote request create (plan 13-01)

**Status:** open · **Blocks:** nothing. Built as A.

- A "product line" choice with no key, or a key over 40 characters, is reported on the product line field; an unknown choice word is reported on the product choice field. All use "Choose a product from the list."
- A product line key sent with "custom" or "not sure" is ignored, not refused.

- **A (built, recommended):** keep both.
- **B:** change either.

## P13-BL-07 · Privacy Policy draft says the staff alert carries visitor details (plan 13-04)

**Status:** open · **Blocks:** nothing. Built as A. Settled together with plan 13-25 (owner approval of the policy).

The executor added one line the plan did not list: the email-sender entry now says it delivers "the alert our staff get about a quote request", because that alert carries the visitor's name, phone and the start of the message. All the wording is draft and `approved` stays false.

- **A (built, recommended):** keep the line.
- **B:** remove or reword it.

## P13-BL-08 · Should the sign-in and profile email check use the stricter D-42 rule too? (fix 13-REVIEW-FIX-W4, WR-04)

**Status:** open · **Blocks:** nothing. Built as A.

D-42 named only the shop email and the Quote alerts address, so the fix added a new stricter browser rule (`isContactEmail`) for those two and left the shared `isEmailShaped` rule unchanged. `isEmailShaped` also checks the sign-in and staff profile emails.

- **A (built, recommended):** keep the sign-in and profile check as it is; staff emails are already checked by the server's own rules.
- **B:** use the stricter rule for the sign-in and profile emails too.

## P13-BL-09 · Staff inbox list: wording and the phone search floor (plan 13-11)

**Status:** open · **Blocks:** nothing. Built as A.

- A bad list query (status, search, page) answers "Check the status, search and page settings." A bad page size answers "Use a page size of 10, 20, 50 or 100."
- A search with fewer than 3 digits does not search phone numbers (the plan said "at least 3 digits remain"; the same floor applies to the search itself). Names and team names are still searched.

- **A (built, recommended):** keep both.
- **B:** change either.

## P13-BL-10 · Choices made in the staff alert email (plan 13-10)

**Status:** open · **Blocks:** nothing. Built as A.

- **Email wording the UI spec did not give:** the alert heading is "New quote request" with the hidden preview "{name} sent a quote request." The overflow email heading is "More quote requests are waiting" with the preview "Open Quote Requests to see them all."
- **Quiet skip:** with no Quote alerts address, or an address the mail queue refuses, nothing is logged and no email is sent. The request is still saved.
- **The hourly cap of 20 counts per address:** changing the Quote alerts address mid-hour starts a fresh count.
- **"Photos: n"** is how many photos the visitor said they would attach. The inbox shows which actually arrived.
- **Control characters in form text:** not rejected (review W1 IN-04, optional part). The alert cleans them itself, so it is safe either way.

- **A (built, recommended):** keep all of the above.
- **B:** change any of them (say which): new wording, a log line or staff notice for a refused address, or a stricter form rule for control characters (server rule plus its browser mirror).

## P13-BL-11 · Choices made in the quote form photo upload and failure states (plan 13-12)

**Status:** open · **Blocks:** nothing. Built as A in each item.

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

1. **A photo dropped while the inquiry is sending.** A: refuse it with "Photos can't be added while your inquiry is sending." B: other wording.
2. **Phone search floor.** A: the search drops a leading 0 or 63 first, then needs 3 digits, so "0917" and "+63 917" find each other and "091" or "639" alone find nothing. B: the old rule, where "639" matches every number.
3. **While Send waits for photos still being prepared.** A: the "Sending" label and spinner stand in. B: add a "Getting your photos ready" line (new copy, about 0.05 KB of the form budget).
4. **The "maybe sent" message (review W5 IN-01).** It says "You won't send it twice", which is only true if the visitor changes nothing before pressing Send again. A: keep it. B: new wording, for example "If you send it again unchanged, we won't get it twice."

The form budget gained 0.86 KB because the form no longer loads the legal page styles. The form file is now 44.23 KB of its 45 KB budget. No limit changed.

## P13-BL-13 · Choices made in the Quote alerts test email (plan 13-13)

**Status:** open · **Blocks:** nothing. Built as A in each item.

1. **Test email wording.** A: heading "Quote alerts work", preview "Quote alerts reach this address.", no link. B: add an "Open Quote Requests" button.
2. **A saved address that can never get mail.** A: the server answers "This address can't get email. Save a different address, then send a test." B: treat it like "no address saved".
3. **Failure message for "no address" and "can't get email".** A: the UI spec's one failure message ("Couldn't send the test email." / "Check your internet connection and try again."). B: show the server's own sentence for these two.
4. **The limit of 3 tests in 10 minutes.** A: counted per connection, like every other limit. B: counted per Quote alerts address.
5. **Audit entry detail.** A: none (never the address). B: a fixed word such as `sent=1`.
6. **Unsaved-change check.** A: spaces at either end are ignored when comparing the field to the saved address. B: exact text.

## P13-BL-14 · Choices made in the staff Quote Requests list (plan 13-15)

**Status:** open · **Blocks:** nothing. Built as A in each item.

1. **Phone card order.** A: the shared phone card: the name as the title, the other columns below in table order. B: a custom card in the UI spec's order.
2. **"Couldn't refresh" line.** A: the wording used elsewhere in admin, "Showing figures from {time}. Couldn't refresh." B: "Showing requests from {time}..."
3. **Screen reader count on a filter with one request.** A: the spec text as written ("Spam 1 requests"). B: "1 request" for exactly one.
4. **Refresh when staff come back to the tab.** A: every time. B: only when the list is over 30 seconds old.
5. **Name link color.** A: dark text, underlined on hover. B: the orange link color used for order numbers.
6. **Empty-list icon.** A: the inbox icon on every filter. B: on Open only.

## P13-BL-15 · Choices made in the wave 6 review fixes (13-REVIEW-FIX-W6)

**Status:** open · **Blocks:** nothing. Built as A in each item.

1. **Quote Requests list after a failed refresh.** A: it stops refreshing on its own (every 60 s and when staff return to the tab) until Try Again works. B: keep refreshing when staff return to the tab; a failed first load would then flash the loading rows each time.
2. **The hidden "new quote request" line.** A: it clears after 5 seconds, and arrivals within that time add up ("2 new quote requests."). B: a longer time such as 10 seconds, or each arrival with only its own count.
3. **Who decides a request is "new".** A: the browser, with two rare misses (a visit that opens on page 2 or later; a request closed before this visit saw it, then moved back to New). B: the list answer from the server says what is new (an API change).
4. **Which address the "Test email on its way" message names.** A: the address saved when Send Test Email was pressed, with no API change. If another Manager saves a different address in that moment, the message can name the wrong one. B: the server's answer names the address it mailed.

## P13-BL-16 · Choices made in the quote request detail and status moves (plan 13-16)

**Status:** open · **Blocks:** nothing. Built as A in each item.

1. **Spam and photos that never arrived.** A: Spam clears every photo place, including the names of photos that never arrived. B: keep those names.
2. **The "received" line in the history.** A: built from the received time when the request is read, not stored. B: store a first history row when the visitor sends the form, as orders do.
3. **History order.** A: newest first, as the UI spec shows. B: oldest first, like the order history.
4. **Moving to the status it already has.** A: refused with "This request is already {status}." B: accepted with no change, as orders do.
5. **Wording:** "A request that became an order can't change status.", "Choose a status." and the shared "This was changed by someone else. Reload and try again." A: keep. B: new wording.
6. **Audit page detail.** A: the label "Quote request status changed" only. B: also "Status: New to Contacted".
7. **A photo upload at the moment of a Spam move.** A: that photo is removed by the 2-day stray photo sweep instead of the next daily run. B: a lock so it is always queued at once.

## P13-BL-17 · Choices made in the new quote request count (plan 13-17)

**Status:** open · **Blocks:** nothing. Built as A in each item.

1. **Screen reader count above 99.** A: "Quote Requests, 99+ new", like the chip. B: the exact count.
2. **The count after a failed read.** A: it keeps trying every 60 seconds and when staff return to the tab, with no chip meanwhile, so it comes back by itself. B: pause like the inbox list until Try Again or a reload.
3. **Phone tab width at 320 px.** A: about 61 px each (the bar keeps its side padding; the spec says 64; every tab is still at least 44 px and no label is cut). B: drop the padding for exactly 64 px.
4. **Dashboard strip while it re-reads after a failure.** A: the failure line stays and Try Again shows busy. B: swap to the loading look, which reads the failure out again each time.
5. **Strip figure for large counts.** A: the exact count ("1,250"). B: "99+" like the chip.

## P13-BL-18 · What a status change answers (review W7 IN-01, built in 13-REVIEW-FIX-W7)

**Status:** open · **Blocks:** nothing. Built as A.

The answer to a status change used to carry the whole request (name, phone, email, message, photo addresses). The repeat-press guard keeps each answer as plain text for 24 hours, where the Manager delete and the 6-month purge cannot remove it.

- **A (built, recommended):** the answer carries only the id, the new status, the time of the change and the new version. The request page reads the request again after a move.
- **B:** answer the whole request, accept the 24-hour copy, and say so in the Privacy Policy.

Order calls keep their full answers the same way. They were left alone because no "delete for good" is promised for orders.

## P13-BL-19 · Choices made in staff notes and the Manager delete (plan 13-18)

**Status:** open · **Blocks:** nothing. Each item was built as A unless it says otherwise.

1. **What adding a note answers.** A (as the plan says): the whole request, so the 24-hour repeat-press copy holds the visitor's details and the note text, like the old status answer (P13-BL-18). B (recommended): only `{ id, noteId, createdAtUtc, version }`. The request page reads the request again after a note either way. The wave 8 review fix may move this to B to match P13-BL-18; that fix report will say.
2. **Saved answers after a delete.** A: repeat-press copies of earlier answers for that request stay for up to 24 hours. B: the delete removes them too.
3. **Notes on a request that became an order.** A: allowed in every status. B: blocked once converted.
4. **Note count.** A: no limit per request. B: a cap, for example 200.
5. **What the delete audit entry records.** A: the status and the photo count. B: also the note and history counts, or nothing at all.
6. **Delete check order.** A: a converted request is refused before the version check, as the plan orders. B: the version check first.
7. **Wording to confirm:** "Write a note first.", "Keep the note to 1,000 characters or fewer.", "A request that became an order can't be deleted.", and the audit labels "Quote request note added" and "Quote request deleted".

## Manual checks for the owner (cannot be proven by automated tests)

- [ ] Photo picker on a real phone: the camera and gallery buttons, a real photo preview, and the no-preview icon for an HEIC photo in a desktop browser (after plan 13-12 puts the picker on the form).
- [ ] Contact page layout on a real phone (form first, then Messenger, Call, hours, phones, map).
- [ ] The Quote alerts card in Site Content > Business info, in Blush and Espresso, on phone and desktop.
- [ ] Quote form on a real phone: pick a photo and press Send at once. The photo must arrive, and Send shows Sending until it does (13-REVIEW-FIX-W5 CR-01).
- [ ] Quote Requests list on a real phone: the cards, the filter pills and the search (plan 13-15).
- [ ] Send a real test email from Site Content > Business info > Quote alerts and check it arrives (plan 13-13).
- [ ] The Quote Requests count chip, the rail dot, the Quotes phone tab and the dashboard strip in Blush and Espresso, on phone and desktop (plan 13-17).
