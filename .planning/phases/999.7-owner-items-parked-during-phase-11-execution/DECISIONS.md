# Owner items parked during Phase 11 execution

*Created: 2026-11-11T22:44:28-06:00 · Updated: 2026-11-12T01:21:18-06:00*

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

## Flakes seen in the post-merge gates (for the record, no decision needed)

| Wave | Test | Full run | Alone |
|------|------|----------|-------|
| 2 | `LastManagerGuardTests.TwoManagersDeactivatingEachOtherTogetherLeaveExactlyOneActiveEveryTime` | failed once | passed 7 of 7 (the class 6 times) |
| 2 | web `admin/routes.test.tsx` "/dev/public shows the real public layout ..." | failed once | passed |
| 3 (in 11-10) | web `OrderFormPage` "cannot be left through the dialog while a save is pending" | failed once | passed |
| 3 | `LastManagerGuardTests.TwoManagersLockingEachOtherTogetherLeaveExactlyOneActiveEveryTime` | failed once | passed; **fixed** (see below) |

**Root cause of the last-Manager race failures (fixed after wave 3, no owner decision needed):** plan 11-01 made a deadlock on the Manager roster lock answer the busy 409 "Something changed at the same time. Try again." (approved in D-120). Under full-suite load the two Managers' requests can deadlock, so the losing request gets that 409 instead of the 422 last-Manager refusal. The four race tests pinned only the 422. They now accept either answer for the loser and still check that exactly one Manager stays active.
