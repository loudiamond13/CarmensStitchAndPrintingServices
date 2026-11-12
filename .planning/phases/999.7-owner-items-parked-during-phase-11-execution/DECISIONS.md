# Owner items parked during Phase 11 execution

*Created: 2026-11-11T22:44:28-06:00 · Updated: 2026-11-12T04:16:35-06:00*

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

**Status:** open · **Blocks:** nothing. Built as option A.

When two Managers edit Business Info at once, the second save is refused and a banner shows. The app's shared banner (used on orders and elsewhere) says "This was changed by someone else." The Phase 11 UI spec table words it differently.

- **A (built, recommended):** keep the shared banner, so the message is the same everywhere in the app.
- **B:** use the UI spec wording on Site Content only.
- **C:** change the shared banner everywhere to the UI spec wording.

The exact text is in 11-12-SUMMARY.md under the owner items.

## P11-BL-05 · Question shown before "Load Latest" throws away edits (plan 11-12, owner item 2)

**Status:** open · **Blocks:** nothing. Built as option A.

After a refused save, "Load Latest" would throw away the Manager's unsaved edits, so the page first asks "Discard changes?". The UI spec has no text for this question; the executor wrote it (marked SPEC-GAP in the code). The exact text is in 11-12-SUMMARY.md.

- **A (built, recommended):** keep the executor's wording.
- **B:** give your own wording.

## P11-BL-06 · "Recorded by: Not set" on Business Info (plan 11-12, owner item 3)

**Status:** open · **Blocks:** nothing. Built as option A.

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

**Status:** open · **Blocks:** nothing. Built as option A; plan 11-16's form follows the same rule.

A closure such as "Dec 23 to Dec 27" may already be running when a Manager opens it. New closures, and any change to the first day, must still be today or later.

- **A (built, recommended):** an edit may keep its past first day, so the note or the last day of a running closure can still be fixed.
- **B:** refuse any edit whose first day is in the past; the Manager deletes and re-adds instead.

## Flakes seen in the post-merge gates (for the record, no decision needed)

| Wave | Test | Full run | Alone |
|------|------|----------|-------|
| 2 | `LastManagerGuardTests.TwoManagersDeactivatingEachOtherTogetherLeaveExactlyOneActiveEveryTime` | failed once | passed 7 of 7 (the class 6 times) |
| 2 | web `admin/routes.test.tsx` "/dev/public shows the real public layout ..." | failed once | passed |
| 3 (in 11-10) | web `OrderFormPage` "cannot be left through the dialog while a save is pending" | failed once | passed |
| 3 | `LastManagerGuardTests.TwoManagersLockingEachOtherTogetherLeaveExactlyOneActiveEveryTime` | failed once | passed; **fixed** (see below) |
| 4 (in 11-12) | web `admin/routes.test.tsx` "/dev/public" title | failed once | passed twice |
| 5 (in 11-13) | `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` | failed once | passed 20 of 20 (class alone) |

**Root cause of the last-Manager race failures (fixed after wave 3, no owner decision needed):** plan 11-01 made a deadlock on the Manager roster lock answer the busy 409 "Something changed at the same time. Try again." (approved in D-120). Under full-suite load the two Managers' requests can deadlock, so the losing request gets that 409 instead of the 422 last-Manager refusal. The four race tests pinned only the 422. They now accept either answer for the loser and still check that exactly one Manager stays active.
