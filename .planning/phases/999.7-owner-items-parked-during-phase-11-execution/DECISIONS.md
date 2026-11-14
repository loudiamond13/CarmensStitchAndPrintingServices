# Owner items parked during Phase 11 execution

*Created: 2026-11-11T22:44:28-06:00 · Updated: 2026-11-13T18:50:00-06:00*

The owner went away during the Phase 11 run (2026-11-11) and asked for the run to finish with a code review and a security review. Anything that needs the owner is parked here instead of blocking the run. Nothing here was decided for the owner.

## P11-BL-01 · The new site contact migration cannot be rolled back (plan 11-07, deviation 1)

**Status:** open · **Blocks:** nothing. Built as option A.

Plan 11-07 added migration `AddSiteContactDetails` (12 new SiteSettings columns and the SitePhoneNumbers table). Nothing is dropped or renamed. Its "undo" step (`Down`) now stops with a clear error instead of dropping the new columns, because the plan forbids drop lines and earlier migrations follow the same rule (D-39). Production gets reviewed forward scripts, so the undo step is not used there.

- **A (built, recommended):** keep it forward only, like the earlier migrations.
- **B:** let the undo step drop the new columns and table, for local use only.

## P11-BL-02 · Message for text that still holds square-bracket placeholder words (plan 11-09, owner item 1)

**Status:** open · **Blocks:** nothing. Built as option A; plan 11-12 mirrors the same text in the browser.

The Business Info save refuses any text field that still holds placeholder words in square brackets, such as `[Shop address]`, so placeholders never reach the public site. The message it shows is not in the UI spec. The executor wrote: "Replace the text in square brackets with the real words." It lives in `SiteLinks.PlaceholderTextMessage`.

- **A (built, recommended):** keep the rule and this wording.
- **B:** keep the rule with your own wording.
- **C:** drop the rule for plain text fields and keep it only for links and the email.

## P11-BL-03 · Space under the short footer on Gallery and the 404 page (plan 11-10)

**Status:** open · **Blocks:** nothing. Built as option A.

On a phone, Contact shows a sticky Call bar at the bottom, so its footer keeps 96 px of space under it. The short footer used on Gallery, Contact and the 404 page always keeps that 96 px, matching the design file. The UI spec line "on Contact it keeps 96px" can also be read as "only on Contact".

- **A (built, recommended):** keep 96 px on every page that uses the short footer, as the design file shows.
- **B:** keep 96 px only on Contact, and use normal footer spacing on Gallery and the 404 page.

## P11-BL-04 · Wording of the "someone else changed this" banner on Site Content (plan 11-12, owner item 1)

**Status:** open · **Blocks:** nothing. Built as option A. Plan 11-16 reuses the same shared banner on the hours card, so one ruling covers both.

When two Managers edit Business Info at once, the second save is refused and a banner shows. The app's shared banner (used on orders and elsewhere) says "This was changed by someone else." The Phase 11 UI spec table words it differently.

- **A (built, recommended):** keep the shared banner, so the message is the same everywhere in the app.
- **B:** use the UI spec wording on Site Content only.
- **C:** change the shared banner everywhere to the UI spec wording.

The exact text is in 11-12-SUMMARY.md under the owner items.

## P11-BL-05 · Question shown before "Load Latest" throws away edits (plan 11-12, owner item 2)

**Status:** open · **Blocks:** nothing. Built as option A. Plan 11-16 reuses the same question on the hours card (recommended: one wording for every Site Content tab). Plan 11-20 reuses it in the product line editor too.

After a refused save, "Load Latest" would throw away the Manager's unsaved edits, so the page first asks "Discard changes?". The UI spec has no text for this question; the executor wrote it (marked SPEC-GAP in the code). The exact text is in 11-12-SUMMARY.md.

- **A (built, recommended):** keep the executor's wording.
- **B:** give your own wording.

## P11-BL-06 · "Recorded by: Not set" on Business Info (plan 11-12, owner item 3)

**Status:** open · **Blocks:** nothing. Built as option A. Plan 11-20 shows the same "Recorded by: Not set" on a product line, so one ruling covers both.

The shared "who recorded / who last changed" block always shows both rows. Business Info has no creator (the settings row always existed), so the first row reads "Recorded by" with the empty-value icon and "Not set".

- **A (built):** keep both rows, like every other record.
- **B (recommended):** show only "Last changed by" on Business Info. A small change in the shared block.

## P11-BL-07 · Two hours messages only the API can send (plan 11-11, owner item 1)

**Status:** open · **Blocks:** nothing. Built as option A.

The opening hours save checks two rules the form can never break, so staff should never see these. They are not in the UI spec, so the executor wrote them:

- "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM." (`OpeningHours.TimeStepMessage`)
- "Send the hours for all seven days, once each." (`UpdateOpeningHoursRequestValidator.DaysMessage`)

- **A (built, recommended):** keep them.
- **B:** give your own wording (two constants and their tests change).

The new `OpeningHours` migration is also forward only, the same as P11-BL-01; the ruling there covers it.

## P11-BL-08 · Editing a closure that has already started (plan 11-13, owner item OI-1)

**Status:** open · **Blocks:** nothing. Built as option A; plan 11-16's form follows the same rule. Choosing B means removing the browser rule (zod `savedFirstDay`) and the server edit marker together.

A closure such as "Dec 23 to Dec 27" may already be running when a Manager opens it. New closures, and any change to the first day, must still be today or later.

- **A (built, recommended):** an edit may keep its past first day, so the note or the last day of a running closure can still be fixed.
- **B:** refuse any edit whose first day is in the past; the Manager deletes and re-adds instead.

## P11-BL-09 · Delete wording for a closure of several days (plan 11-16, owner item 1)

**Status:** open · **Blocks:** nothing. Built as option A.

The approved delete lines say "{Dec 25, 2026}. The shop shows its normal hours that day." For a closure such as "Dec 30, 2026 to Jan 1, 2027" they still say "that day".

- **A (built, recommended):** keep the approved words for every closure. They are the spec's words.
- **B:** say "those days" when the closure covers several days.

## P11-BL-10 · "Visitors see" label when the week has several groups of days (plan 11-16, owner item 4)

**Status:** open · **Blocks:** nothing. Built as option A.

The hours card preview puts "Visitors see:" on the first line only. Each further group of days is its own line without the label.

- **A (built, recommended):** keep it on the first line only.
- **B:** put the label on its own line above all the groups.

## P11-BL-11 · Message when a closure was deleted while it was open for editing (plan 11-16, owner item 5)

**Status:** open · **Blocks:** nothing. Built as option A. The spec has no words for this (SPEC-GAP).

The closure window shows "This closure wasn't found. It may have been deleted."

- **A (built, recommended):** keep that line.
- **B:** reuse the "Already deleted" words from the delete question.

## P11-BL-12 · Moving a product line up or down when hidden lines sit between (plan 11-17, owner item 1)

**Status:** open · **Blocks:** nothing. Built as option A.

The plan said a move swaps a line with its "visible neighbour". The Manager's list shows hidden lines too, so the build swaps with the next line in that list.

- **A (built, recommended):** swap with the next line in the Manager's list, hidden or not. What the Manager sees moves one step.
- **B:** skip hidden lines, so the public order always changes by one step.

## P11-BL-13 · Two rare product line messages reuse existing words (plan 11-17, owner item 2)

**Status:** open · **Blocks:** nothing. Built as option A.

Only a stale or hand-made request can trigger these: "Reload the form and try again." for a product type that no longer exists, and "Check the highlighted fields." for a bad move direction.

- **A (built, recommended):** keep the existing words. No new wording.
- **B:** write a specific line for each.

## P11-BL-14 · The number on the jersey drawing (plan 11-17, owner item 3)

**Status:** open · **Blocks:** nothing. Built as option A.

Each product line card shows a number on its drawing. It accepts up to 2 plain letters or digits (A to Z, 0 to 9).

- **A (built, recommended):** keep letters and digits only, up to 2.
- **B:** allow other characters, such as accented letters.

## P11-BL-15 · Where a product jumps to on the Products page (plan 11-18, owner item 1)

**Status:** open · **Blocks:** nothing. Built as option A.

The UI-SPEC sets two scroll gaps (one on the page, one on each product). Browsers add them together, so a tapped product would stop about 300 px down the screen.

- **A (built, recommended):** keep the page gap and set each product's own gap to 16 px, so the product title lands just under the bar.
- **B:** follow the spec numbers exactly.

## P11-BL-16 · Side padding of the product pill bar (plan 11-18, owner item 2)

**Status:** open · **Blocks:** nothing. Built as option A.

The UI-SPEC sets no side padding on the row of product pills.

- **A (built, recommended):** use the page's side padding, so the first pill lines up with the text.
- **B:** no side padding, as the spec says.

## P11-BL-17 · Duplicated loading and error parts on the Products page (plan 11-18, owner item 3)

**Status:** open · **Blocks:** nothing. Built as option A.

Using the shared loading, error and button parts on the Products page pushed the Contact page over its 150 KB size limit, because of how the build groups shared code. So about 100 lines are copied into the Products page.

- **A (built, recommended):** keep the copies for now and plan a later fix to how the build groups shared code.
- **B:** use the shared parts and raise or rework the size limit.

## P11-BL-18 · Message when a product line has no photo in a slot (plan 11-19, owner item 1)

**Status:** open · **Blocks:** nothing. Built as option A. Staff screens only.

A Manager who removes a photo that is already gone sees "This product line has no photo there."

- **A (built, recommended):** keep that line.
- **B:** give your own words.

## P11-BL-19 · Link-preview card tag on every public page (plan 11-19, owner item 2)

**Status:** open · **Blocks:** nothing. Built as option A.

Every public page now tells X (Twitter) and similar apps which preview card to show: a large picture where the page has one, a small card otherwise.

- **A (built, recommended):** keep it on every page, as the UI-SPEC row says.
- **B:** only on pages that have a picture.

## P11-BL-20 · Sharpness of the small photo in the Manager's product line list (plan 11-19, owner item 3)

**Status:** open · **Blocks:** nothing. Built as option A.

The list shows each line's main photo as one 44 px picture. On sharp phone screens it may look a little soft.

- **A (built, recommended):** keep one 44 px picture.
- **B:** also send a double-size picture for sharp screens (small extra work in plan 11-20).

## P11-BL-21 · Manual step after the Phase 11 deploy: create the new Cloudinary picture sizes (plan 11-19, owner item 4)

**Status:** open · **Blocks:** product photos look right on the live site only after this step. **Action for the owner, not a choice.**

Phase 11 adds 21 picture sizes. After the Phase 11 deploy, run the setup command once on the live Cloudinary account, as `docs/operations/cloudinary-setup.md` "Phase 11 sizes" says. It creates only the missing sizes and leaves the 13 existing ones alone. No agent ran it (D-44).

## P11-BL-22 · The whole product line list waits while one action saves (plan 11-20, owner item 2)

**Status:** open · **Blocks:** nothing. Built as option A.

When a Manager presses Move, Hide or Show on one line, every row's buttons wait until that save ends. Only one change can be sent at a time, so a press on another row would otherwise be dropped without a word.

- **A (built, recommended):** hold every row while one saves.
- **B:** hold only the pressed row, and queue presses on the others (more work).

## P11-BL-23 · Failure messages for Move, Hide and Show (plan 11-20, owner item 3)

**Status:** open · **Blocks:** nothing. Built as option A. The spec has no words for these.

A failed save shows a short message such as "Couldn't move {title}", "Couldn't hide {title}" or "Couldn't show {title}".

- **A (built, recommended):** keep these.
- **B:** give your own words.

## P11-BL-24 · The Contact page is at its size limit (plan 11-20, owner item 4)

**Status:** open · **Blocks:** nothing yet. Every later plan is told to keep public additions lazy, and the post-merge gate now builds the size check.

The Contact page's first download is 149.97 KB of its 150 KB limit (compressed). Any shared code a later plan adds can push it over, which fails the build.

- **A (recommended):** after Phase 11, plan a small task to regroup the shared public code so Contact gets room back (see also P11-BL-17).
- **B:** raise the Contact limit a little (for example to 155 KB). This trades a small amount of phone load time.

## P11-BL-25 · Words on the product line photo boxes (plan 11-22, owner item 2)

**Status:** open · **Blocks:** nothing. Built as option A. Staff screens only.

The photo boxes use words the spec does not fully give: "Remove the back view?" and "Remove the fabric detail?" with "The empty box shows instead.", "Removing" while it works, "Drawn jersey (no photo yet)" for an empty main photo, and picture names such as "Main photo of Polo Shirts".

- **A (built, recommended):** keep these.
- **B:** give your own words for any of them.

## P11-BL-26 · All three photo boxes wait while one photo saves (plan 11-22, owner item 3)

**Status:** open · **Blocks:** nothing. Built as option A.

While one photo uploads or is removed, the other two boxes on the same line also wait. All three share one server lock, so a second save would only be refused.

- **A (built, recommended):** keep it.
- **B:** let the other boxes start and show the server's busy message if they clash.

## P11-BL-27 · The test-data reset keeps a photo on the demo Polo line (plan 11-22, owner item 4)

**Status:** open · **Blocks:** nothing. Test data only, never live data.

The plan said the test-data reset removes a photo added in the tests. The reset only clears lines whose name starts with "E2E-", so a photo added to the demo Polo line would stay. The end-to-end tests remove their own photos instead, so nothing is left behind today.

- **A (recommended):** keep it as built.
- **B:** make the reset also clear photos on the six demo lines (a small server change to the test seeder).

## P11-BL-28 · Removing a photo that is already gone (plan 11-22, owner item 5)

**Status:** open · **Blocks:** nothing. Built as option A.

If someone else already removed the photo, the screen treats Remove as done and shows the empty box.

- **A (built, recommended):** treat it as removed.
- **B:** show the "no photo there" message from P11-BL-18.

## P11-BL-29 · What restoring a deleted order does to the website (plan 11-23, Task 3) · IMPORTANT

**Status:** open · **Blocks:** nothing now, but it must be answered before Phase 11 ships. Nothing was decided for you.

Deleting an order takes it off the website at once (D-15). Nothing says what happens when a Manager restores it. Today's code restores the order exactly as it was, so an order that was shown on the website would come back on the website by itself. The run leaves restore as it is and finishes everything else.

- **A (recommended):** deleting also turns "Show on the website" off (the customer's OK stays). A restore never puts the order back on the website by itself, the same as cancelling (D-41). Nothing goes public without a deliberate step. This is a small, separate change.
- **B:** a restore brings the order back on the website exactly as it was (today's behaviour, no change).

## P11-BL-30 · When "name shown" is required on an order (plan 11-23, owner item O-2)

**Status:** open · **Blocks:** nothing. Built as option A.

- **A (built, recommended):** "name shown" is required only when the order is being shown on the website, so staff can record the customer's OK first on an order with no team name.
- **B:** require it whenever the OK is recorded.

## P11-BL-31 · Removing the customer's OK on a cancelled order (plan 11-23, owner item O-3)

**Status:** open · **Blocks:** nothing. Built as option B for now.

Today every website setting is refused on a cancelled order, including taking the customer's OK away.

- **A (recommended):** allow removing the OK on a cancelled order (it only makes the order more private). Small change.
- **B (built):** refuse every website setting on a cancelled order.

## P11-BL-32 · Testimonials tab wording (plan 11-24, owner items OI-1 to OI-3)

**Status:** open · **Blocks:** nothing. Built as option A. The spec has no words for these.

The move announcement and the failure messages, the "not found" line, the delete question showing the first 50 characters of the quote, and Edit waiting while a move, hide or show saves.

- **A (built, recommended):** keep them as built.
- **B:** give your own words or rules.

## P11-BL-33 · Order page website card: the empty "Show under" option (plan 11-27)

**Status:** open · **Blocks:** nothing. Built as option A. The spec has no words for it.

When staff have not picked a line yet, the "Show under" list shows "Choose a line".

- **A (built, recommended):** keep "Choose a line".
- **B:** give your own words.

## P11-BL-34 · "Shown under" on an order that was never shown (plan 11-27)

**Status:** open · **Blocks:** nothing. Built as option A.

For an order that has never been on the website, the card already prints the line the server would use, worked out from the order items.

- **A (built, recommended):** keep it. Staff see where the order would appear before they show it.
- **B:** leave "Shown under" empty until the order is shown (a one-line change).

## P11-BL-35 · Uploads to different orders at the same time can answer 500 (found while fixing the photo race) · IMPORTANT

**Status:** open · **Blocks:** nothing in Phase 11. Not changed.

A stress test with several hosts on one database showed database deadlocks (SQL error 1205) when staff upload photos to different orders at the same moment. The read before storage and the photo list read after the save can be picked as the deadlock victim. One case then fails its rollback (error 3903). The user sees "Something went wrong". Order creation showed the same under that load (likely the parked P10-BL-22). The app allows two uploads at once, so two staff could hit this in production. It is rare at the shop size.

- **A (recommended first, code only):** treat a deadlock in these reads and in the savepoint rollback as the existing "busy, try again" answer (409), so the user can simply retry.
- **B:** turn on READ_COMMITTED_SNAPSHOT for the database (a database setting; check the host allows it).
- **C:** study the query plans and add an index (a schema change).

## P11-BL-36 · Which photo the Gallery link preview uses (plan 11-26, owner item O-1)

**Status:** open · **Blocks:** nothing. Built as option A.

When someone shares the Gallery page link on Facebook, the preview shows one photo. The plan said "the newest public photo".

- **A (built, recommended):** the cover photo of the first team shown on the Gallery page, so the preview matches what visitors see first.
- **B:** the photo with the newest date.

## P11-BL-37 · The number on the drawn jersey when a gallery item has no photo (plan 11-29, SPEC-GAP)

**Status:** open · **Blocks:** nothing. Built as option A.

A Gallery tile or Recent work item with no photo shows a drawn jersey instead. Orders carry no jersey number, so it prints 23, the same as the Home hero.

- **A (built, recommended for now):** keep 23 everywhere. Review it in the UI review.
- **B:** show no number on the drawn jersey.
- **C:** give your own rule.

## P11-BL-38 · Gallery uploads: page sizes and the shown default (plan 11-28, owner items O-1 and O-2)

**Status:** open · **Blocks:** nothing. Built as option A.

The staff gallery list accepts any page size from 1 to 100 (the shared list rule), not only 10, 20, 50 and 100. A new upload sent without the "shown" setting is hidden, as with testimonials; the admin form (plan 11-32) sends it ticked by default.

- **A (built, recommended):** keep both as built.
- **B:** allow only 10, 20, 50 and 100, or make a new upload shown when the setting is left out.

## P11-BL-39 · Gallery tab in Site Content: three behaviour and wording points (plan 11-32, owner items O-1 to O-3)

**Status:** open · **Blocks:** nothing. Built as option A for each.

1. **Moving an item past the end of a page.** The UI spec says the list stays and focus goes to "the row that took its place"; the plan says it shows the next page. Built: the tab follows the moved item to its new page and focuses it. Option B: stay on the page and focus the row that took its place.
2. **New wording the spec does not give.** All in `web/src/modules/admin/siteContentCopy.ts` (Gallery tab section). Option B: give your own words.
3. **Replace photo while editing.** The new photo is saved with the one Save button, not at once. Option B: save the new photo as soon as it is picked.

- **A (built, recommended):** keep all three as built.
- **B:** change any of them as above.

## P11-BL-40 · The default link preview picture (plan 11-30, owner items OI-1 to OI-4)

**Status:** open · **Blocks:** nothing. Built as option A for each.

1. **Shared version stamp.** Changing the picture moves the business settings version. The Business Info card (plan 11-34) reloads the settings after an upload or removal, so a later save does not get "someone else changed this". Option B: keep the picture in its own table (a schema change that needs your approval).
2. **New admin text:** "There's no link preview picture to remove." Option B: your own words.
3. **The 404 page with no picture** still has no large card tag, as before. Option B: add one.
4. **Live steps (go-live list):** the Cloudinary setup step (P11-BL-21), then check one shared link in the Facebook Sharing Debugger (plan 11-38).

- **A (built, recommended):** keep 1 to 3 as built; do 4 at go-live.
- **B:** change any of 1 to 3 as above.

## P11-BL-41 · The link preview picture card in Business Info (plan 11-34, owner items OI-1 to OI-4)

**Status:** open · **Blocks:** nothing. Built as option A for each.

1. Removing a picture that is already gone counts as removed, as for product line photos (P11-BL-28).
2. New screen reader names: "The link preview picture", and the empty box reads "No picture yet".
3. Save Business Info is not held while a picture saves. In the rare race the "someone else changed this" banner shows and Load Latest recovers.
4. The small preview box may load the 640 px image where 320 px would do (a little extra data on the admin page only).

- **A (built, recommended):** keep all four.
- **B:** change any of them.

## P11-BL-42 · The page speed check now fails some runs (plan 11-36) · IMPORTANT

**Status:** open · **Blocks:** a green CI run may need a re-run until decided. Built as option A.

The speed check (Lighthouse) now scores four public pages, not one. Its performance score must be at least 0.95. That score includes page load time (LCP), which is about 2.1 to 2.6 s on every page on this machine against the 2.0 s target. /contact and /products scored 0.94 in some runs, so the check failed. No limit was loosened.

- **A (built, recommended):** keep the check as it is and do the font follow-up (P11-BL-43) first; re-run CI if it fails until then.
- **B:** apply the hard limits to Home only for now and just print the other three pages.
- **C:** treat the performance score as report-only on all four pages (like LCP, D-29) until the font follow-up lands.

## P11-BL-43 · Font subsetting follow-up (plan 11-36, applies D-124)

**Status:** open · **Blocks:** nothing. Needs your yes on a tool.

Every public page still loads in more than 2.0 s (LCP): Home about 2.35 s, Products 2.1 to 2.5 s, Gallery 2.3 s, Contact 2.1 to 2.6 s. Per D-124 the next step is a /gsd-quick that tries cutting the font files down to the characters the site uses. The look stays the same. It needs a font tool (for example fontTools, MIT license) with the usual package check and your yes before it is added.

- **A (recommended):** run the follow-up quick task with the package check.
- **B:** leave it; LCP stays report-only.

## P11-BL-44 · Layout shift is close to its limit on two pages (plan 11-36)

**Status:** open · **Blocks:** nothing.

Layout shift (CLS) is 0.041 on /products and 0.043 on /contact against the 0.05 limit, the same in every run.

- **A (recommended):** a small quick task to find and stop the shift.
- **B:** leave it while it stays under the limit.

## P11-BL-45 · The Public website card on the New Order and Edit Order forms (plan 11-35, owner items O-1 and O-2)

**Status:** open · **Blocks:** nothing. Built as option A for each.

1. **Line not required in the browser on a new order.** When Show on the website is ticked, the form lets staff save without picking a line, because the server works the line out from the order items. If it cannot, the server's message shows under "Show under" with the cursor there. Option B: require a line in the browser (a one-line change).
2. **Edits send the whole card.** Changing any one value on Edit Order sends all four values, including the line the server picked. This matches the Public website window on the order page. Option B: send only the changed value.

- **A (built, recommended):** keep both as built.
- **B:** change either as above.

## P11-BL-46 · Firefox can leave a focused control partly under a sticky bar (plan 11-37)

**Status:** open · **Blocks:** nothing. Built as option A.

When you move through a page with the Tab key, Firefox scrolls only far enough that some of the control shows. A control can stay partly under the sticky header or bottom bar: the Gallery tiles, the footer "Staff Login" link, and the Contact Call button on a 390 px phone. Chrome, Safari (WebKit) and both phone test setups show the whole control.

- The accessibility standard (WCAG 2.2 AA, "not entirely hidden") is met in all five browsers.
- The project's stricter rule (the whole control must show, D-70 to D-72) is met in four. The tests record Firefox's partly covered controls as notes instead of failing.

- **A (built, recommended):** accept. The standard is met, and the stricter rule is met where the browser allows it.
- **B:** add a small script to the public pages that scrolls a focused control fully clear. Contact has only 0.63 KB of its size budget left, so the script would have to load late.
- **C:** make the stricter rule fail Firefox too, and then do B.

## P11-BL-47 · A later database update could overwrite the saved tagline (review WR-B-02)

**Status:** open · **Blocks:** nothing. Not changed.

Tagline (and the business name) sit in the seeded settings row. A later migration that edits that seed would overwrite what staff saved.

- **A (recommended):** add a schema test that fails if a later migration updates the seeded settings row. No schema change.
- **B:** move the columns out of the seed with a hand-written migration (changes migrations).
- **C:** accept and write it down.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-48 · Gallery viewer phone tap zones say "photo" but move between items (review WR-D-02)

**Status:** open · **Blocks:** nothing. Not changed.

The UI spec names them "Previous photo" and "Next photo". They go to the previous or next gallery item, while the desktop buttons for the same action say "image".

- **A (recommended):** rename them "Previous image" and "Next image", to match the buttons.
- **B:** keep the names and add a hidden description ("Goes to the next gallery item").
- **C:** keep as ruled.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-49 · How a reopening date far away is worded (review WR-A-03, copy part)

**Status:** open · **Blocks:** nothing. Not changed.

The look-ahead now covers the longest closure (38 days, was 14), so a reopening date shows. But the page prints only the day name ("Opens Friday 9:00 AM"), which reads like the coming Friday. Please also confirm the UI spec's "14 days" becomes 38.

- **A (recommended):** print the date when it is more than 6 days away ("Opens Dec 24, 9:00 AM").
- **B:** print both ("Opens Thursday, Dec 24, 9:00 AM").
- **C:** day name only, and show nothing past 6 days.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-50 · The busy message on public pages says "Too many attempts" (review IN-B-03)

**Status:** open · **Blocks:** nothing. Not changed.

When a public page is read too often, the message reads like a sign-in lockout.

- **A (recommended):** add "This page is busy right now. Wait a moment, then try again."
- **B:** keep the current text.
- **C:** other wording from you.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-51 · Customer consent for showing an order is checked only in code (review IN-B-05)

**Status:** open · **Blocks:** nothing. Not changed.

The rule "an order shown on the site must have the customer's OK" lives only in the business logic, not in the database.

- **A (recommended):** add a database check rule in a forward-only migration, after checking no migrated order breaks it.
- **B:** keep it in code and add a test that scans for a shown order with no OK.
- **C:** accept as is.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-52 · "CSPS Shop" map label is fixed text (review IN-D-03)

**Status:** open · **Blocks:** nothing. Not changed.

After a business rename, the Contact map label would still say "CSPS Shop", so the page shows two names.

- **A (recommended):** the map label uses the saved business name; social link names stay fixed.
- **B:** record that all this brand text stays fixed.
- **C:** use the business name everywhere.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-53 · Test-only content reset has no database-name guard (review IN-E-04)

**Status:** open · **Blocks:** nothing. Not changed.

Not reachable in a live build. In a local test host it would rewrite site content on whatever database it points at.

- **A (recommended):** refuse any database except the e2e and per-test ones, like the dev seed rule.
- **B:** leave it.
- **C:** also require a secret header.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-54 · The owner screenshot tool covers only Home (review IN-F-06)

**Status:** open · **Blocks:** nothing. Not changed.

The tool you use to review screens (D-23) has no Products, Gallery, Contact or Site Content admin pages.

- **A (recommended):** add those pages.
- **B:** keep it, and note that the e2e screenshots cover the rest.
- **C:** leave as is.

Full options are in `11-REVIEW-FIX.md` under "Owner items".

## P11-BL-55 · Firefox cancelled font downloads fail browser tests (e2e pass)

**Status:** open · **Blocks:** nothing.

On a busy machine Firefox cancels a font download and logs it as a console error. It caused 15 failures in the full run; all passed alone.

- **A (recommended):** ignore exactly that message, for Firefox only, with the same limits as the WebKit rule D-111.
- **B:** re-run the failures each time.
- **C:** preload the fonts (changes the pages).

Detail is in `11-E2E-PHASE-END.md` under "Owner items".

## P11-BL-56 · WebKit test page wait is too short on a busy machine (e2e pass)

**Status:** open · **Blocks:** nothing.

About 60 of the 115 full-run failures were WebKit and iPhone waiting 5 s for the test component page heading. They pass with 1 or 2 workers.

- **A (recommended):** raise that wait to 15 s in the shared helper. No app change.
- **B:** run WebKit with fewer workers.
- **C:** split the component showcase page.

Detail is in `11-E2E-PHASE-END.md` under "Owner items".

## P11-BL-57 · The full browser suite takes 3.8 hours (e2e pass)

**Status:** open · **Blocks:** nothing.

About 25 test files share one site content lock, so they run one at a time.

- **A (recommended):** leave it for now and run the full suite on a quiet machine.
- **B:** hold the lock for less time in the sweep tests.
- **C:** lock only the tests that change site content.

Detail is in `11-E2E-PHASE-END.md` under "Owner items".

## P11-BL-58 · Firefox Home tile click sometimes does not open the Gallery (e2e pass)

**Status:** open · **Blocks:** nothing.

Failed in 2 of 3 mixed runs and 1 of 6 alone, but passed in the full run. Cause not found.

- **A (recommended):** look at a recorded trace in the next pass.
- **B:** accept it as a known flake.

Detail is in `11-E2E-PHASE-END.md` under "Owner items".

## P11-BL-59 · Long unbroken words now wrap in every form hint and error (e2e pass, built)

**Status:** open · **Blocks:** nothing.

A real bug: a team name with no spaces widened the Edit Order page on 320 to 414 px phones. The fix changed the shared form field, so any hint or error with a very long word now wraps instead of widening the page.

- **A (built, recommended):** keep the shared fix. It only shows when a word is wider than the box.
- **B:** narrow it to the "Name shown" hint only.

Detail is in `11-E2E-PHASE-END.md` under "Owner items".

## P11-BL-60 · Lightbox arrows on phones (UI review R-04)

**Status:** decided: A, keep the approved tap zones (owner, 2026-11-13) · **Blocks:** nothing.

**Ruling D-P11-BL-60 (owner, 2026-11-13):** keep the C-35 tap zones on phones. No arrow buttons are added below 768 px. Do not raise this again.

On phones (768 px and narrower) the gallery viewer hides the round previous and next buttons and uses two large tap zones instead, as approved in C-35. Each zone is a real button with a name, a focus ring, arrow keys and swipe. A reviewer asked whether a visible arrow should also show on phones. Nothing was changed.

- **A (recommended):** keep the approved tap zones, because they are large named buttons with a focus ring, arrow keys and swipe, and they keep the approved phone look.
- **B:** also show 44 px arrow buttons on phones. This changes the approved phone look.

Detail is in `11-UI-REVIEW.md` under "Outcomes" (R-04) and quick 261113-nqv.

## P11-BL-61 · Edge to edge on notched phones (UI review R-06)

**Status:** decided: A, keep today's viewport setting (owner, 2026-11-13) · **Blocks:** nothing.

**Ruling D-P11-BL-61 (owner, 2026-11-13):** do not add `viewport-fit=cover`. The phone browser keeps pages clear of the notch and home bar; the safe-area padding on the Contact bar stays in place. Do not raise this again.

The pages do not ask the phone to draw under the notch and the home bar (`viewport-fit=cover` is not set in `web/index.html`), so the safe area is 0 today. The Contact bottom bar and its scroll padding now add the safe area, so they are ready if this is ever turned on. Nothing visible changed.

- **A (recommended):** keep today's setting, where the phone browser keeps the page out of the notch and home-bar area. Both bars already add the safe area if this changes later.
- **B:** add `viewport-fit=cover` to every page and check notched phones in the screenshot pass. Landscape would then also need side padding.

Detail is in `11-UI-REVIEW.md` under "Outcomes" (R-06) and quick 261113-nqv.

## P11-BL-62 · Named font sizes for the admin and shared parts (UI review R-01)

**Status:** decided: A, a later quick task (owner, 2026-11-13) · **Blocks:** nothing.

**Ruling D-P11-BL-62 (owner, 2026-11-13):** a later quick task maps the admin and shared hand-typed font sizes to the same size-named `text-N` tokens (adding missing sizes with their current values, no look change) and widens the type-scale test to all of `web/src`. Size names stay; no role names were asked for. Do not raise this again.

The public site now uses 23 named font sizes (`text-14` is 14 px, and so on) and a test fails on any hand-typed size there. The admin and shared parts still hand-type 221 sizes in 33 files. Nothing was changed there.

- **A (recommended):** one later quick task maps those 221 sizes to the same `text-N` tokens (adding the sizes that are missing) and widens the test to all of `web/src`. One naming scheme for the whole app, with no look change.
- **B:** keep the tokens on the public site only. The admin side stays hand-typed.

The names follow the size (`text-14`) so each one reads as its value. If you prefer role names such as `text-body` or `text-caption`, say so, and the task will map each size to a role you choose instead.

Detail is in `11-UI-REVIEW.md` under "Outcomes" (R-01) and quick 261113-nqv.

## Flakes seen in the post-merge gates (for the record, no decision needed)

| Wave | Test | Full run | Alone |
|------|------|----------|-------|
| 2 | `LastManagerGuardTests.TwoManagersDeactivatingEachOtherTogetherLeaveExactlyOneActiveEveryTime` | failed once | passed 7 of 7 (the class 6 times) |
| 2 | web `admin/routes.test.tsx` "/dev/public shows the real public layout ..." | failed once | passed |
| 3 (in 11-10) | web `OrderFormPage` "cannot be left through the dialog while a save is pending" | failed once | passed |
| 3 | `LastManagerGuardTests.TwoManagersLockingEachOtherTogetherLeaveExactlyOneActiveEveryTime` | failed once | passed; **fixed** (see below) |
| 4 (in 11-12) | web `admin/routes.test.tsx` "/dev/public" title | failed once | passed twice |
| 5 (in 11-13) | `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` | failed once | passed 20 of 20 (class alone) |
| 6 | web `scripts/third-party-notices.test.ts` "--check exits 1 ... and --write fixes it" | failed once (245 s under load) | passed in 9.5 s |
| 9 | `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` (second time, see wave 5) | failed once | passed 5 of 5; the gate now keeps the full output so the cause can be read next time |
| 10 | `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` (third time) | failed: the losing upload answered **500** instead of 409 or 422 | **not a flake: a real race.** Fixed in ec98f325: the check before storage now reads the order again when another upload changes it, so the loser gets the photo limit (422). Confirmed: the wave 11 gate passed with 0 failures. |

**Root cause of the last-Manager race failures (fixed after wave 3, no owner decision needed):** plan 11-01 made a deadlock on the Manager roster lock answer the busy 409 "Something changed at the same time. Try again." (approved in D-120). Under full-suite load the two Managers' requests can deadlock, so the losing request gets that 409 instead of the 422 last-Manager refusal. The four race tests pinned only the 422. They now accept either answer for the loser and still check that exactly one Manager stays active.
- Review fixes (2026-11-13): `OrderListTimingTests` customer-name search p95 412.8 ms against 300 ms under a saturated machine, still failing on a quieter rerun. No fix touched that code. Re-check alone on a quiet machine in the post-merge gate.
- Phase-end e2e (2026-11-13): full suite 2264 passed, 115 failed, 59 skipped in 3.8 h with other sessions loading the CPU. Nearly all passed on re-run alone (see `11-E2E-PHASE-END.md`). `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` answered a 500 on the Testing site-content reset once in a full .NET run; passed alone twice.
- Quiet-machine re-check (2026-11-13, HEAD 6cbf3e9a, after all review fixes, the e2e pass and WR-A-01): full gate passed with GATE_EXIT=0. .NET 9507 total, 9505 passed, 0 failed, 2 skipped. Web 390 of 390 files, 10671 of 10671 tests. Lint, typecheck, openapi-gen (9 of 9) and the bundle budget passed. `OrderListTimingTests` alone: 1 of 1 passed. So the earlier timing and parallel-caller failures were machine load. The whole-solution Release build failure predates Phase 11 (test projects use the Debug-only Testing image type since Phases 9 and 10).
