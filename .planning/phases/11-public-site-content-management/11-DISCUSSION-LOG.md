# Phase 11: Public Site & Content Management - Discussion Log
*Created: 2026-11-11T08:30:00-06:00 · Updated: 2026-11-11T08:30:00-06:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log keeps the alternatives considered.

**Date:** 2026-11-11
**Phase:** 11-public-site-content-management
**Areas discussed:** Products and prices (C-21), Gallery and privacy (C-12), Contact page and quotes (C-36), Page speed and fonts, Who may show orders, Facebook share picture, Admin content screens, Linking order product types

(R) marks the recommended option. ✓ marks the owner's pick.

---

## Products and prices (C-21)

| Question | Options | Owner's pick |
|---|---|---|
| How products and prices are stored | Product lines in database (R) · Lines + price list · Plain price list only | ✓ Product lines in database |
| Pictures in each product section | Manager uploads photos (R) · Keep drawn jerseys · Pick from the gallery | ✓ Manager uploads photos |
| Gallery filters vs product lines | Same six types (R) · Separate gallery list | ✓ Same six types |
| No price entered | Ask for a quote (R) · Price is required | ✓ Ask for a quote |
| Testimonials | Manager types them in (R) · No star rating | ✓ Manager types them in |
| Go-live text | Design text, then edit (R) · Start empty | ✓ Design text, then edit |
| Customize cards | Text only, fixed 5 (R) · Add or remove cards | ✓ Text only, fixed 5 |
| Deleting a line in use | Hide it instead (R) · Delete and move photos | ✓ Hide it instead |

**Notes:** The owner first declined the pictures question and asked which product line was meant, then what Phase 11 is for. After a plain explanation (the six sections of the public Products page; the phase builds the customer-facing site and its admin screens), the question was asked again and answered.

## Gallery and privacy (C-12)

| Question | Options | Owner's pick |
|---|---|---|
| Where Gallery photos come from | Both (R) · Orders only · Uploads only | Free text (below) |
| When order photos may go public | After customer OK box (R) · Shown by default · Default, jerseys only | ✓ After customer OK box |
| Full Gallery page source | Orders, plus uploads (R) · Orders only · Separate uploads | ✓ Orders, plus uploads |
| Which photos of a public order | Manager ticks each photo (R) · Cover photo only · All its photos | ✓ All its photos |
| Public text | Team, type, pieces (R) · Type and pieces only | ✓ Team, type, pieces |
| Recent work selection | Newest shown orders (R) · Manager picks and orders | ✓ Newest shown orders |
| Take-down request | Untick removes at once (R) · Also delete the photos | ✓ Untick removes at once |

**Notes:** Owner, free text: "For recent work, I would like to get those orders from the order list and I want managers to be manage which order can be shown to the public face." The difference between the Home Recent work strip and the Gallery page was then explained. The OK box replaces the Phase 9 idea of "public by default", after the Data Privacy Act point was raised (flagged as not legal advice).

## Contact page and quotes (C-36)

| Question | Options | Owner's pick |
|---|---|---|
| Quote form this release | Yes, in Phase 13 (R) · No, later release | ✓ Yes, in Phase 13 |
| Left column until Phase 13 | Big Messenger and call card (R) · Form shown, not working · One column only | ✓ Big Messenger and call card |
| Location | Map link button (R) · Embedded Google map | ✓ Embedded Google map |
| Hours detail | One time range per day (R) · Allow a lunch break | ✓ One time range per day |
| Closed status | Closed, opens next (R) · Just Open / Closed | ✓ Closed, opens next |
| Map loading | Tap to load map (R) · Always load the map | ✓ Tap to load map |
| Main phone number | Manager marks a main one (R) · First in the list | ✓ Manager marks a main one |
| "Get a Quote" buttons | Keep label, go to Contact (R) · Open Messenger directly | ✓ Keep label, go to Contact |
| Social links | Facebook, Instagram, TikTok (R) · Facebook only · Any link, any name | ✓ Facebook, Instagram, TikTok |
| Public email | Show as a mail link (R) · Hide the email | ✓ Hide the email |

## Page speed and fonts

| Question | Options | Owner's pick |
|---|---|---|
| Getting under 2.0 s | Fixes that keep the look first (R) · Switch body text font now · Keep fonts, accept it | ✓ Fixes that keep the look first |
| Fail the build again after | Yes, fail the build (R) · Keep it report-only | ✓ Keep it report-only |

**Notes:** Keeping LCP report-only supersedes the Phase 3 plan to make it a hard gate again in Phase 11.

## Extra topics

| Question | Options | Owner's pick |
|---|---|---|
| Who may tick "Customer said OK" and show an order | Managers only (R) · Admin and Manager · Admin ticks OK, Manager shows | ✓ Admin and Manager |
| Facebook share picture | Site picture + own where possible (R) · One picture for all | ✓ Site picture + own where possible |
| Admin content screens | One Site Content area (R) · Separate menu items | ✓ One Site Content area |
| Order product types vs product lines | Link each line to types (R) · One shared list · Pick when publishing | ✓ Link each line to types |

## Claude's Discretion

Schema, endpoints, cache keys, the server-shaped `index.html` approach, the order tile photo, audit entries and the "pieces" computation (see CONTEXT.md).

## Deferred Ideas

Per-photo public choice, lunch-break hours, and a Manager-curated Home strip.
