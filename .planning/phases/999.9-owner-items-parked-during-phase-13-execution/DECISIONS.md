# Owner items parked during Phase 13 execution

*Created: 2026-11-22T22:57:00-06:00 · Updated: 2026-11-23T06:46:00-06:00*

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

## Manual checks for the owner (cannot be proven by automated tests)

- [ ] Photo picker on a real phone: the camera and gallery buttons, a real photo preview, and the no-preview icon for an HEIC photo in a desktop browser (after plan 13-12 puts the picker on the form).
- [ ] Contact page layout on a real phone (form first, then Messenger, Call, hours, phones, map).
- [ ] The Quote alerts card in Site Content > Business info, in Blush and Espresso, on phone and desktop.
