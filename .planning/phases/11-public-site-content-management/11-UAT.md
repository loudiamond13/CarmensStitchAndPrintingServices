---
status: diagnosed
phase: 11-public-site-content-management
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-04-SUMMARY.md, 11-05-SUMMARY.md, 11-06-SUMMARY.md, 11-07-SUMMARY.md, 11-08-SUMMARY.md, 11-09-SUMMARY.md, 11-10-SUMMARY.md, 11-11-SUMMARY.md, 11-12-SUMMARY.md, 11-13-SUMMARY.md, 11-14-SUMMARY.md, 11-15-SUMMARY.md, 11-16-SUMMARY.md, 11-17-SUMMARY.md, 11-18-SUMMARY.md, 11-19-SUMMARY.md, 11-20-SUMMARY.md, 11-21-SUMMARY.md, 11-22-SUMMARY.md, 11-23-SUMMARY.md, 11-24-SUMMARY.md, 11-25-SUMMARY.md, 11-26-SUMMARY.md, 11-27-SUMMARY.md, 11-28-SUMMARY.md, 11-29-SUMMARY.md, 11-30-SUMMARY.md, 11-31-SUMMARY.md, 11-32-SUMMARY.md, 11-33-SUMMARY.md, 11-34-SUMMARY.md, 11-35-SUMMARY.md, 11-36-SUMMARY.md, 11-37-SUMMARY.md, 11-38-SUMMARY.md]
started: 2026-11-14T00:05:00-06:00
created: 2026-11-14T00:05:00-06:00
updated: 2026-11-15T01:02:29.358Z
---

# Phase 11 UAT: Public Site & Content Management
*Created: 2026-11-14T00:05:00-06:00 · Updated: 2026-11-14T19:02:28-06:00*

All 38 plans are built. Tests 1 to 23 are hands-on checks for the owner: user flow first (1 to 13), then look and wording (14 to 16), then gates, rulings and reviews (17 to 20), then live-site steps (21 to 23).
Tests 24 to 263 are passed by automated tests (coverage blocks); they are not asked.
The roadmap marks this phase mvp, but the goal is not a user story; as in Phases 1 to 10 no story was invented and the success criteria are the flow.

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running API and web server. Run the preflight, apply the Phase 11 migrations to CSPS_Dev (AddSiteContactDetails, AddOpeningHours, AddShopClosures, AddProductLines, AddTestimonials, AddOrderPublicSettings, AddSharePicture) with dotnet ef database update or the dev seed, then start the API (5115) and the web app (5180) from scratch. The API starts with no errors or warnings, /health answers, and the public Home page loads with data from the database.
covers: cold start
result: pass
note: Passed by the owner, but the Phase 11 migrations were still pending on CSPS_Dev; test 2 then failed with Invalid object name ProductLines. Setup step, not a code gap.

### 2. Enter Business Info as a Manager
expected: Sign in as a Manager and open Site Content > Business Info. Change the business name, address, directions, one to four phones with exactly one main, and the Messenger link, then Save. The save succeeds and the page shows who changed it and when. A bad link (http:, a non-allowed host, or a [bracket] placeholder) is refused inline before any request. Signed in as an Admin, Site Content is not offered and cannot be opened.
covers: 11-09, 11-12 D11
result: pass

### 3. Opening hours, closures and Open now
expected: In Site Content set the weekly hours and add one closure day. Until hours are saved every day reads closed (no invented hours). After saving, the Contact page says Open now or Closed now and today or tomorrow by Manila time, not your device clock, and the closure picker's today is the business today. The closure shows on Contact.
covers: 11-11 D8, 11-14 D7, 11-16 D11
result: pass

### 4. Edit a product line and its price
expected: In Site Content > Products open a line, change its name, price and photos, then Save. The Products page shows the new name and the price exactly as entered (no rounding in the browser). The line's web address (its key) does not change after a rename, so an old shared link still works. Delete shows only for a line not in use, asks first with Cancel focused, and an in-use refusal shows the server's message.
covers: 11-17 D10, 11-18 D8, 11-20 D8
result: issue
reported: "image is not showing after replacing the default" (screenshot: Products page, line 06/06 Custom Design, the main, Back view and Fabric detail slots still show the empty dotted placeholders)
severity: major

### 5. Add a testimonial
expected: In Site Content > Testimonials add one and put it first. The Home page shows it in its first card with the quote exactly as typed. A fresh database shows no testimonials on the public site (none are invented outside the Testing seed).
covers: 11-21 D10, 11-24 D7, 11-24 D8
result: pass

### 6. Show an order on the website
expected: On an order with the customer's OK, turn on Show on the website with a photo and save. It appears in the public Gallery. Turning it off removes it from the Gallery while its photos stay on the order. Deleting the order turns Show on the website off, and restoring it does not put it back. The Gallery tab offers no hide, edit or delete for order items, only a link to the order.
covers: 11-23 D8 (D-P11-BL-29), 11-27 D8, 11-32 D6
result: issue
reported: "theres no cover photo, is this inteded? the order has photos" (screenshot: public Gallery, a test order (Basketball, 12 pcs), shows the empty dotted placeholder; the order is listed and the pills count it)
severity: major
note: The order does appear in the Gallery. The off, delete and restore steps were not reported on; re-check them after the fix. Likely the same cause as test 4 (photos not drawn on public pages).

### 7. Gallery uploads and the share picture
expected: In Site Content > Gallery add a photo, and set the default link preview (share) picture. Both upload and show. Each new share picture gets a new address (not a reused one).
covers: 11-28 D9, 11-30 D10, 11-34 D9
result: issue
reported: "the picture uploads but doesnt show either" (screenshots: the Link preview picture card says Saved with Replace and Remove offered but the preview is the empty dotted placeholder; the public Gallery lists a test gallery upload and the test order, both with empty placeholders)
severity: major
note: The upload itself works. The picture is missing even in the admin preview, so this is not only the public pages. Likely the same cause as tests 4 and 6.

### 8. Home page on a phone
expected: Open / at phone width. The hero, the cards, Why CSPS, the steps, the testimonials and the orange band show real data from the database. No [bracket] placeholder, '#' link or made-up value appears anywhere, and the turnaround card shows only the line a Manager typed (no invented time promise).
covers: 11-07 D9, 11-25 D9
result: pass

### 9. Products page on a phone
expected: Open /products at phone width. The pill bar jumps to each line, opening /products#a-line lands on that line below the header, cards show the Manager's prices and photos, and the help card is there.
covers: 11-18
result: pass

### 10. Gallery page on a phone
expected: Open /gallery. The pills filter by category and the category goes into the address (All stays out, an unknown value is dropped). Tap a photo: the lightbox opens, swipes and arrow keys move between photos, Escape closes it.
covers: 11-29 D2, 11-31
result: pass

### 11. Contact page on a phone
expected: Open /contact at phone width. Call uses the main number, Messenger opens the stored m.me link, the map shows a card until tapped, and the sticky call bar shows at 767 px and below only.
covers: 11-10 D8
result: pass

### 12. Not found page and admin noindex
expected: Open /nope or /products/old: a real Page Not Found page (status 404). The admin pages are not indexed (noindex).
covers: 11-02
result: pass

### 13. Link previews with JavaScript off
expected: View the page source (or curl) of /, /products, /gallery and /contact. Each has its own title, description, canonical, og:title, og:description, og:image 1200 x 630 with width, height and alt, and one LocalBusiness JSON-LD block with no email. The /gallery og:image is the cover of the top public item. robots.txt names the sitemap and sitemap.xml lists the four pages.
covers: 11-02, 11-26 D8, 11-37
result: pass
note: Checked step by step on the API (5115) with view-source: Home, Products, Gallery, Contact heads, robots.txt and sitemap.xml.

### 14. Public pages look like the approved designs
expected: Compare Home (App. E.1), Products (E.2), Gallery and its lightbox (E.3, App. C) and Contact (E.4) with the approved designs on a phone and a desktop. Headings, spacing, cards, pills, the cut bands and the sticky bar look right. Peso text still looks the same.
covers: 11-08 D6, 11-10 D7, 11-18 D7, 11-25 D10, 11-29 D10, 11-31 D9, 11-36 D4
result: pass

### 15. Site Content screens look right
expected: Look over every Site Content tab (Business Info, phones, hours, closures, Products and the line editor, Photos, Testimonials, Gallery, share picture card) beside the Settings and My Profile cards. Sizes, spacing, previews, the status line and the save bar read well in Blush and Espresso.
covers: 11-12 D10, 11-16 D12, 11-20 D10, 11-22 D9, 11-24 D9, 11-34 D10
result: pass
note: Owner asked whether the Home hero picture and the product cover photos can be replaced. Hero: no, it is the fixed drawing from the approved design (HeroArt); only the Recent order tag changes. Product covers: yes, each line's Main photo in Site Content > Products (the drawn jersey shows when there is none).

### 16. Seeded wording reads right
expected: Read the seeded public page wording (the UI spec text with the long-dash rewrites). It reads right to the shop owner.
covers: 11-15 D5
result: pass

### 17. Full Playwright e2e run is green
expected: Run the full e2e suite (all five projects). It is green, in particular @public-sweep, @link-preview, contact.spec, gallery.spec and the site-content specs.
covers: VERIFICATION human item 1, 11-37
result: pass
note: Owner chose the Phase 11 specs only (2026-11-14), not the full suite. Run 1, all projects: 519 passed, 18 failed, 3 skipped (55.9 min). All 18 passed when re-run alone with 2 workers (1.9 min). Recorded flakes, not hidden: Firefox cancelled font download (2), site content lock wait (3), 30 s timeouts on Contact in WebKit, pixel and iphone (11), WebKit @home tile click (P11-BL-58), Firefox @site-content-products Check your email heading (1). WebKit @contact-hours took 30.0 s on the re-run, right at its limit. The full suite (P11-BL-57) is still to run before ship.

### 18. Page size and speed rulings
expected: Contact stays within its 150 KB budget (OI-1), and you rule on P11-BL-42 (performance score at 0.94 on some runs) and P11-BL-43 (font subsetting follow-up). LCP is 2.1 to 2.6 s against 2.0 s (waived, report-only by D-29).
covers: 11-22 D10, 11-36 D7
result: pass
note: P11-BL-42 was already ruled (D-P11-BL-42, 2026-11-13: keep 0.95, re-run a 0.94 CI run). Owner passed with P11-BL-43 (font subsetting) left open as a follow-up in 999.7; LCP stays waived by D-29.

### 19. Privacy and safety prohibitions hold
expected: Review the judgment-tier prohibitions in 11-VERIFICATION.md (43 rows): no new trigger or raw SQL for the closure overlap rule, content and gallery photos are not stored under the orders folder and their addresses are not logged, only the redrawn (EXIF and location free) image is uploaded. Each is confirmed or a finding is raised.
covers: 11-13 D10, 11-19 D8, 11-22 D8, 11-28 D9, 11-34 D9, VERIFICATION human item 7
result: issue
reported: "F1 A, F2 B" (owner rulings on the independent review of the 43 prohibitions: 39 hold; F1 prepareImage sends the original file, metadata included, when a photo is not shrunk or is an unreadable HEIC, web/src/utils/images.ts:196-207 and :221-232, ruled D-P11-BL-65: always redraw except an unreadable HEIC; F2 bracket check only on Business Info, ruled D-P11-BL-66: keep; F3 useLightboxHistory re-navigates with the raw search, same-origin, no action; F4 live Cloudinary setup unprovable from code, see test 21)
severity: minor

### 20. Go-live checklist reads right
expected: Read docs/operations/go-live-public-site.md. The steps are in the order you want: backup, migration script, deploy, Business Info and hours first, Cloudinary setup, share picture, closures, line review and prices, gallery and testimonials, then the Sharing Debugger, robots.txt, sitemap.xml and App:PublicBaseUrl. What visitors see before the first Business Info save follows D-123.
covers: 11-38 D4, 11-38 D5
result: pass

### 21. Cloudinary named sizes on the live account
expected: After the deploy, run the Cloudinary setup command once on the live account. The 21 new named sizes exist (34 in all, the 13 old ones unchanged), and a product photo, a gallery photo and the csps_share_1200 picture load on the live site.
covers: 11-19 D6, 11-30 D11, VERIFICATION human item 2
result: blocked
blocked_by: release-build
reason: "Not done yet: Phase 11 is not deployed, so the live Cloudinary setup has not been run (owner, 2026-11-14). Go-live checklist step."

### 22. Real content entered before cutover
expected: On the live site enter Business Info, hours, phones, the Messenger link, the six line prices and the default share picture. Home, Products and Contact show them, Open now is right for Manila time, and Home and Contact carry an og:image.
covers: VERIFICATION human item 3
result: blocked
blocked_by: release-build
reason: "phase 11 isnt live yet" (owner, 2026-11-14). Go-live checklist step.

### 23. Facebook Sharing Debugger on the live site
expected: Paste /, /products, /gallery and /contact into the Facebook Sharing Debugger. Each shows its own title, description and picture, and a new share picture replaces the old one.
covers: 11-30 D10, VERIFICATION human item 4
result: blocked
blocked_by: release-build
reason: "phase 11 isnt live yet" (owner, 2026-11-14). Go-live checklist step.

### 24. 11-01 D1: The npm audit gate keeps passing through 2026-12-14 with the owner-extended glob and minim
expected: The npm audit gate keeps passing through 2026-12-14 with the owner-extended glob and minimatch exceptions, and fails after that date
result: pass
source: automated
coverage_id: 11-01-D1

### 25. 11-01 D2: A deadlock on the order-number lock inside an outer transaction is a lost race with the tr
expected: A deadlock on the order-number lock inside an outer transaction is a lost race with the transaction ended; create and import answer the order busy 409; a plain timeout still gives OrderNumberBusyException
result: pass
source: automated
coverage_id: 11-01-D2

### 26. 11-01 D3: The Manager roster lock and the account-token lock end a lost deadlock as a lost race, and
expected: The Manager roster lock and the account-token lock end a lost deadlock as a lost race, and every caller maps it to the busy 409
result: pass
source: automated
coverage_id: 11-01-D3

### 27. 11-03 D1: Open now and closes-at at 10:00 AM Manila, exact boundaries 8:59 closed, 9:00 open, 5:59 P
expected: Open now and closes-at at 10:00 AM Manila, exact boundaries 8:59 closed, 9:00 open, 5:59 PM open, 6:00 PM closed
result: pass
source: automated
coverage_id: 11-03-D1

### 28. 11-03 D2: Next opening labelled Today, Tomorrow or Weekday with date, weekday and time; skips closed
expected: Next opening labelled Today, Tomorrow or Weekday with date, weekday and time; skips closed weekdays and closure days; null after 14 days
result: pass
source: automated
coverage_id: 11-03-D2

### 29. 11-03 D3: A closure today closes the whole day, sets ClosedToday and carries its note (or null)
expected: A closure today closes the whole day, sets ClosedToday and carries its note (or null)
result: pass
source: automated
coverage_id: 11-03-D3

### 30. 11-03 D4: Zone comes only from the BusinessClock; month end, year end, empty week and no-open-day ed
expected: Zone comes only from the BusinessClock; month end, year end, empty week and no-open-day edges
result: pass
source: automated
coverage_id: 11-03-D4

### 31. 11-03 D5: Domain coverage gate for the new files
expected: Domain coverage gate for the new files
result: pass
source: automated
coverage_id: 11-03-D5

### 32. 11-04 D1: A mobile number such as 0917 123 4567 parses to +639171234567 and displays as typed
expected: A mobile number such as 0917 123 4567 parses to +639171234567 and displays as typed
result: pass
source: automated
coverage_id: 11-04-D1

### 33. 11-04 D2: Landlines (Metro Manila 02 8123 4567, other 088 123 4567) and every +63 form parse and dis
expected: Landlines (Metro Manila 02 8123 4567, other 088 123 4567) and every +63 form parse and display per UI-SPEC
result: pass
source: automated
coverage_id: 11-04-D2

### 34. 11-04 D3: Placeholders, letters, wrong digit counts, foreign numbers and over-long text are refused
expected: Placeholders, letters, wrong digit counts, foreign numbers and over-long text are refused
result: pass
source: automated
coverage_id: 11-04-D3

### 35. 11-04 D4: The E.164 value holds only a plus sign and digits (T-11-08)
expected: The E.164 value holds only a plus sign and digits (T-11-08)
result: pass
source: automated
coverage_id: 11-04-D4

### 36. 11-04 D5: The shared case file exists for the web zod test in plan 11-12
expected: The shared case file exists for the web zod test in plan 11-12
result: pass
source: automated
coverage_id: 11-04-D5

### 37. 11-05 D1: formatTime writes 12-hour times (9:00 AM, 12:00 PM, 12:00 AM) and returns null for a malfo
expected: formatTime writes 12-hour times (9:00 AM, 12:00 PM, 12:00 AM) and returns null for a malformed time
result: pass
source: automated
coverage_id: 11-05-D1

### 38. 11-05 D2: summarizeOpenDays gives one line per run of open days (Mon-Sat · 9:00 AM - 6:00 PM), empty
expected: summarizeOpenDays gives one line per run of open days (Mon-Sat · 9:00 AM - 6:00 PM), empty for a closed week
result: pass
source: automated
coverage_id: 11-05-D2

### 39. 11-05 D3: groupWeek gives Monday-first card rows of days with the same hours, Sunday with null hours
expected: groupWeek gives Monday-first card rows of days with the same hours, Sunday with null hours
result: pass
source: automated
coverage_id: 11-05-D3

### 40. 11-05 D4: callButtonSummary joins open runs with '; ' and a comma after the days, null for a closed 
expected: callButtonSummary joins open runs with '; ' and a comma after the days, null for a closed week
result: pass
source: automated
coverage_id: 11-05-D4

### 41. 11-05 D5: No output holds a long dash (OR-4) and hours.ts reads no clock (D-22)
expected: No output holds a long dash (OR-4) and hours.ts reads no clock (D-22)
result: pass
source: automated
coverage_id: 11-05-D5

### 42. 11-07 D1: GET /api/v1/public/site answers anonymously from the database with the stored facts, the m
expected: GET /api/v1/public/site answers anonymously from the database with the stored facts, the main phone first, and null for what is not set
result: pass
source: automated
coverage_id: 11-07-D1

### 43. 11-07 D2: Strong ETag, no-cache, 304 on a match, 200 on a different tag, never compressed, one read 
expected: Strong ETag, no-cache, 304 on a match, 200 on a different tag, never compressed, one read runs no SQL on the second call
result: pass
source: automated
coverage_id: 11-07-D2

### 44. 11-07 D3: No public body (pages, 404 shell, robots, sitemap, API, JSON-LD, boot data) holds the shop
expected: No public body (pages, 404 shell, robots, sitemap, API, JSON-LD, boot data) holds the shop email
result: pass
source: automated
coverage_id: 11-07-D3

### 45. 11-07 D4: The migration adds the columns and the phone table with a unique number and one main numbe
expected: The migration adds the columns and the phone table with a unique number and one main number, drops and renames nothing, adds no trigger, and blanks the old bracket text only where it remains
result: pass
source: automated
coverage_id: 11-07-D4

### 46. 11-07 D5: A committed content change clears the public cache after the commit; a rollback, a failed 
expected: A committed content change clears the public cache after the commit; a rollback, a failed save and a non-public record clear nothing
result: pass
source: automated
coverage_id: 11-07-D5

### 47. 11-07 D6: The shell head carries the stored name and tagline, LocalBusiness JSON-LD and the csps-boo
expected: The shell head carries the stored name and tagline, LocalBusiness JSON-LD and the csps-boot block; hostile text stays inert
result: pass
source: automated
coverage_id: 11-07-D6

### 48. 11-07 D7: The public-read limit refuses the 601st read in a minute from one address; the shell, robo
expected: The public-read limit refuses the 601st read in a minute from one address; the shell, robots.txt and sitemap.xml are never limited
result: pass
source: automated
coverage_id: 11-07-D7

### 49. 11-07 D8: Settings and phone rows are stamped with the signed-in user through the old stamp columns
expected: Settings and phone rows are stamped with the signed-in user through the old stamp columns
result: pass
source: automated
coverage_id: 11-07-D8

### 50. 11-08 D1: /, /products, /gallery and /contact each render inside PublicLayout (banner, one main, con
expected: /, /products, /gallery and /contact each render inside PublicLayout (banner, one main, contentinfo) as their own lazy chunk, with one h1 and the approved heading
result: pass
source: automated
coverage_id: 11-08-D1

### 51. 11-08 D2: Any other public path renders NotFoundPage (Out of bounds., Go to Home, View Our Work) and
expected: Any other public path renders NotFoundPage (Out of bounds., Go to Home, View Our Work) and the server answers 404; admin paths keep AdminNotFoundPage
result: pass
source: automated
coverage_id: 11-08-D2

### 52. 11-08 D3: The router's public page paths equal tests/fixtures/public-paths.json, and the Gallery alo
expected: The router's public page paths equal tests/fixtures/public-paths.json, and the Gallery alone sits under UrlStateLayout
result: pass
source: automated
coverage_id: 11-08-D3

### 53. 11-08 D4: The document title set on client navigation is the string the server sends
expected: The document title set on client navigation is the string the server sends
result: pass
source: automated
coverage_id: 11-08-D4

### 54. 11-08 D5: The budget measures PublicLayout plus each page separately (all at or under 150 KB gz); nu
expected: The budget measures PublicLayout plus each page separately (all at or under 150 KB gz); nuqs only under Gallery; TanStack Query, react-hook-form and zod nowhere
result: pass
source: automated
coverage_id: 11-08-D5

### 55. 11-10 D1: A small public data store reads the server's boot block on the first visit with no request
expected: A small public data store reads the server's boot block on the first visit with no request, loads the API otherwise, shares one load, refreshes after 5 minutes, clears on invalidate and gives an error with a retry
result: pass
source: automated
coverage_id: 11-10-D1

### 56. 11-10 D2: The footer shows the stored tagline, the FB, IG and TT squares that are set, the address l
expected: The footer shows the stored tagline, the FB, IG and TT squares that are set, the address line, the main phone as a tel: link and the Messenger link; unset values leave their parts out; no email or at sign
result: pass
source: automated
coverage_id: 11-10-D2

### 57. 11-10 D3: Contact shows the Message us card with the Messenger and Call buttons and What to send, Ca
expected: Contact shows the Message us card with the Messenger and Call buttons and What to send, Call or text for two or more numbers, with the error and loading states
result: pass
source: automated
coverage_id: 11-10-D3

### 58. 11-10 D4: The Google map loads only after Show Map, in a titled lazy frame with a strict referrer an
expected: The Google map loads only after Show Map, in a titled lazy frame with a strict referrer and no allow features, and the CSP adds only frame-src for the embed path
result: pass
source: automated
coverage_id: 11-10-D4

### 59. 11-10 D5: The phone-only sticky bar shows Messenger and Call us at 767px and below, is absent above 
expected: The phone-only sticky bar shows Messenger and Call us at 767px and below, is absent above it, does not cover the last focusable element, and Call us fills the bar without a Messenger link
result: pass
source: automated
coverage_id: 11-10-D5

### 60. 11-10 D6: Home and Products show the full footer; Gallery, Contact and the 404 page show the one-row
expected: Home and Products show the full footer; Gallery, Contact and the 404 page show the one-row base footer
result: pass
source: automated
coverage_id: 11-10-D6

### 61. 11-11 D1: GET /api/v1/public/open-status answers isOpen, closesAt, closedToday, todayClosureNote and
expected: GET /api/v1/public/open-status answers isOpen, closesAt, closedToday, todayClosureNote and nextOpening in Manila time from the stored hours, with Cache-Control public, max-age=60 and no ETag
result: pass
source: automated
coverage_id: 11-11-D1

### 62. 11-11 D2: The AddOpeningHours migration creates seven closed rows keyed 1 to 7, two CHECK constraint
expected: The AddOpeningHours migration creates seven closed rows keyed 1 to 7, two CHECK constraints (both times or neither, closing after opening) plus a day range check, no trigger, no foreign key, and Down is refused
result: pass
source: automated
coverage_id: 11-11-D2

### 63. 11-11 D3: GET and PUT /api/v1/opening-hours are Manager only (anonymous 401, Admin 403); the PUT sav
expected: GET and PUT /api/v1/opening-hours are Manager only (anonymous 401, Admin 403); the PUT saves all seven days with the week version
result: pass
source: automated
coverage_id: 11-11-D3

### 64. 11-11 D4: Bad hours are refused with the approved messages (opening time, closing time, closing afte
expected: Bad hours are refused with the approved messages (opening time, closing time, closing after opening); times are half-hour steps from 5:00 AM to 11:30 PM; all seven days once each
result: pass
source: automated
coverage_id: 11-11-D4

### 65. 11-11 D5: The hours have their own version: a Business Info save never makes it stale, a stale hours
expected: The hours have their own version: a Business Info save never makes it stale, a stale hours version answers 409 edit.stale and changes nothing
result: pass
source: automated
coverage_id: 11-11-D5

### 66. 11-11 D6: A changing save writes one opening-hours.changed entry naming each changed day with old an
expected: A changing save writes one opening-hours.changed entry naming each changed day with old and new times; a no-change save writes nothing; stamps come from the server
result: pass
source: automated
coverage_id: 11-11-D6

### 67. 11-11 D7: The public site read carries hours (seven days, Monday first) and upcomingClosures (empty)
expected: The public site read carries hours (seven days, Monday first) and upcomingClosures (empty); the page head JSON-LD lists each open weekday and none when no day is open; an hours save shows on the next read with a new ETag and the open status follows
result: pass
source: automated
coverage_id: 11-11-D7

### 68. 11-11 D9: Domain coverage gate for the new files, and Application above its floor
expected: Domain coverage gate for the new files, and Application above its floor
result: pass
source: automated
coverage_id: 11-11-D9

### 69. 11-12 D1: A Manager sees Site Content (globe) after Settings in the sidebar and the phone drawer, ne
expected: A Manager sees Site Content (globe) after Settings in the sidebar and the phone drawer, never in the tab bar; an Admin never does, and an Admin who opens /admin/site-content is sent to /admin by the route loader
result: pass
source: automated
coverage_id: 11-12-D1

### 70. 11-12 D2: The S0 page shows the h1, the Manager only badge, View Website (new tab, hidden warning) a
expected: The S0 page shows the h1, the Manager only badge, View Website (new tab, hidden warning) and the tab strip; the tab lives in ?tab= and the default stays out of the URL
result: pass
source: automated
coverage_id: 11-12-D2

### 71. 11-12 D3: A Manager changes the tagline, saves with Save Business Info (the version it opened with),
expected: A Manager changes the tagline, saves with Save Business Info (the version it opened with), sees the success toast with focus left on Save, and the public footer shows the new tagline in the same browser
result: pass
source: automated
coverage_id: 11-12-D3

### 72. 11-12 D4: Every Business Info rule runs in the browser first with the server's own message, tested o
expected: Every Business Info rule runs in the browser first with the server's own message, tested on the shared phone and link case files; the first invalid field gets focus; nothing is sent while a rule is broken; server field errors land on their fields and win
result: pass
source: automated
coverage_id: 11-12-D4

### 73. 11-12 D5: The phone repeater holds one to four rows with one Main number, the first row starts as ma
expected: The phone repeater holds one to four rows with one Main number, the first row starts as main, removing the main hands it to the first remaining row with an announcement, Add Number is hidden at four, the only row has no Remove, and the focus rules hold
result: pass
source: automated
coverage_id: 11-12-D5

### 74. 11-12 D6: Pasting the whole Google embed code into Map embed link keeps only its src link on blur; a
expected: Pasting the whole Google embed code into Map embed link keeps only its src link on blur; a src that is not a Google embed link is refused and left as pasted
result: pass
source: automated
coverage_id: 11-12-D6

### 75. 11-12 D7: A stale save shows the ConflictBanner at the top of the panel with the typed values kept; 
expected: A stale save shows the ConflictBanner at the top of the panel with the typed values kept; Load Latest asks Discard changes? and then shows the server values and uses the new version; Undo Changes resets every field and is aria-disabled while nothing changed
result: pass
source: automated
coverage_id: 11-12-D7

### 76. 11-12 D8: Leaving the tab, navigating away or reloading with unsaved changes asks Discard changes? f
expected: Leaving the tab, navigating away or reloading with unsaved changes asks Discard changes? first; a tab with its own loading and error states never blanks the others
result: pass
source: automated
coverage_id: 11-12-D8

### 77. 11-12 D9: At 320px the page never scrolls sideways, the tab strip holds itself, a phone row stacks, 
expected: At 320px the page never scrolls sideways, the tab strip holds itself, a phone row stacks, and axe finds nothing
result: pass
source: automated
coverage_id: 11-12-D9

### 78. 11-13 D1: A Manager lists, adds, edits and deletes closures through /api/v1/shop-closures; an Admin 
expected: A Manager lists, adds, edits and deletes closures through /api/v1/shop-closures; an Admin gets 403 and anonymous 401; the shared client sends an Idempotency-Key on the POST
result: pass
source: automated
coverage_id: 11-13-D1

### 79. 11-13 D2: Closure rules with the UI-SPEC wording: first day required, real and today or later; last 
expected: Closure rules with the UI-SPEC wording: first day required, real and today or later; last day on or after the first and at most 31 days; note at most 80; the browser and the server share one rule set
result: pass
source: automated
coverage_id: 11-13-D2

### 80. 11-13 D3: An overlap is refused with There's already a closure on {Dec 25, 2026}. under firstDay, ch
expected: An overlap is refused with There's already a closure on {Dec 25, 2026}. under firstDay, checked under the site-content lock; two Managers adding overlapping closures at once end with one closure and one 400; an edit ignores the closure itself
result: pass
source: automated
coverage_id: 11-13-D3

### 81. 11-13 D4: The site-content lock copies the staff money lock: a deadlock inside an outer transaction 
expected: The site-content lock copies the staff money lock: a deadlock inside an outer transaction is a lost race with the transaction ended, a timeout is the shared busy line, a missing row fails loudly
result: pass
source: automated
coverage_id: 11-13-D4

### 82. 11-13 D5: The AddShopClosures migration creates ShopClosures with two CHECK constraints and an index
expected: The AddShopClosures migration creates ShopClosures with two CHECK constraints and an index, adds the site-content lock row (68 rows), holds no trigger or foreign key, and refuses to be undone
result: pass
source: automated
coverage_id: 11-13-D5

### 83. 11-13 D6: A closure covering today makes the open status closed with closedToday true and its note, 
expected: A closure covering today makes the open status closed with closedToday true and its note, and the next opening skips every closure day
result: pass
source: automated
coverage_id: 11-13-D6

### 84. 11-13 D7: GET /api/v1/public/site lists the closures that touch the next 30 days by first day, and e
expected: GET /api/v1/public/site lists the closures that touch the next 30 days by first day, and each add, edit or delete moves the ETag on the next read
result: pass
source: automated
coverage_id: 11-13-D7

### 85. 11-13 D8: JSON-LD lists the closures that touch the next 60 days as specialOpeningHoursSpecification
expected: JSON-LD lists the closures that touch the next 60 days as specialOpeningHoursSpecification closed days (opens and closes 00:00, validFrom, validThrough); one in 70 days is left out; the key is absent with no closures; the note is never written
result: pass
source: automated
coverage_id: 11-13-D8

### 86. 11-13 D9: A stale edit is 409 edit.stale, stamps come from the server, add, change and delete write 
expected: A stale edit is 409 edit.stale, stamps come from the server, add, change and delete write shop-closure.* audit entries with the dates and fields=note instead of the note text, and a second delete is 404
result: pass
source: automated
coverage_id: 11-13-D9

### 87. 11-13 D11: Domain coverage gate 100 percent line and branch, Application above its floor
expected: Domain coverage gate 100 percent line and branch, Application above its floor
result: pass
source: automated
coverage_id: 11-13-D11

### 88. 11-14 D1: Contact HoursCard shows Open now (success) or Closed now (muted) and the status line Close
expected: Contact HoursCard shows Open now (success) or Closed now (muted) and the status line Closes 6:00 PM. / Opens today / Opens tomorrow / Opens Monday / Closed today for Christmas. Opens Saturday 9:00 AM. / Closed today. ..., with the Opens part left out when no opening is within 14 days, all from the server's facts
result: pass
source: automated
coverage_id: 11-14-D1

### 89. 11-14 D2: The status refetches every 5 minutes while the page is visible, not while hidden, once whe
expected: The status refetches every 5 minutes while the page is visible, not while hidden, once when the tab returns, retries an error, and stops on unmount; nothing in the browser decides open or closed
result: pass
source: automated
coverage_id: 11-14-D2

### 90. 11-14 D3: The hours list is the grouped rows from groupWeek (Monday to Saturday / 9:00 AM - 6:00 PM,
expected: The hours list is the grouped rows from groupWeek (Monday to Saturday / 9:00 AM - 6:00 PM, Sunday / Closed), and closures in the next 30 days follow under Closed on as 'Dec 25, 2026 · Christmas' or 'Dec 30, 2026 to Jan 1, 2027 · Year-end inventory', the note left out when empty, a long note wrapping
result: pass
source: automated
coverage_id: 11-14-D3

### 91. 11-14 D4: The footer clock row shows one line per run of open days, two lines for mixed hours, and n
expected: The footer clock row shows one line per run of open days, two lines for mixed hours, and no row when no day is open; the Call button second line is the call summary and is left out when no day is open
result: pass
source: automated
coverage_id: 11-14-D4

### 92. 11-14 D5: UI states: a week with no open day (one Closed row, Closed now, no Opens part), a pill ske
expected: UI states: a week with no open day (one Closed row, Closed now, no Opens part), a pill skeleton while the status loads, an error that hides the pill and the line and keeps the rows, a closure today, long notes, zero axe in each state
result: pass
source: automated
coverage_id: 11-14-D5

### 93. 11-14 D6: Public bundle stays under 150 KB gzip on every page after the change (hours parts lazy)
expected: Public bundle stays under 150 KB gzip on every page after the change (hours parts lazy)
result: pass
source: automated
coverage_id: 11-14-D6

### 94. 11-15 D1: An anonymous read of /api/v1/public/product-lines returns the six seeded lines in order wi
expected: An anonymous read of /api/v1/public/product-lines returns the six seeded lines in order with no prices, no photos, a strong ETag and 304
result: pass
source: automated
coverage_id: 11-15-D1

### 95. 11-15 D2: The migrated rows equal the seed list; price and minimum checks, unique key and short name
expected: The migrated rows equal the seed list; price and minimum checks, unique key and short name, unique photo slot and Restrict deletes hold in the database; the idempotent script inserts the six rows once
result: pass
source: automated
coverage_id: 11-15-D2

### 96. 11-15 D3: The lines read is cached (zero commands on the second read), leaves out hidden lines, is e
expected: The lines read is cached (zero commands on the second read), leaves out hidden lines, is empty when all are hidden, and keeps a stable order; a committed title change shows with a new ETag
result: pass
source: automated
coverage_id: 11-15-D3

### 97. 11-15 D4: The /products shell carries productLines equal to the API body; other pages carry none; a 
expected: The /products shell carries productLines equal to the API body; other pages carry none; a failed lines read keeps the site data and is not cached
result: pass
source: automated
coverage_id: 11-15-D4

### 98. 11-16 D1: The Opening hours card shows seven rows Monday to Sunday, a day checkbox ticked for open d
expected: The Opening hours card shows seven rows Monday to Sunday, a day checkbox ticked for open days, Opens and Closes selects every 30 minutes from 5:00 AM to 11:30 PM named '{Monday} opens' and '{Monday} closes', Closed for an unticked day, and a newly ticked day starts at 9:00 AM to 6:00 PM
result: pass
source: automated
coverage_id: 11-16-D1

### 99. 11-16 D2: A labelled preview under the rows reads 'Visitors see: Mon-Sat · 9:00 AM - 6:00 PM' (furth
expected: A labelled preview under the rows reads 'Visitors see: Mon-Sat · 9:00 AM - 6:00 PM' (further runs on their own lines) or 'Visitors see: Closed every day', built with summarizeOpenDays
result: pass
source: automated
coverage_id: 11-16-D2

### 100. 11-16 D3: Save Hours sends PUT /api/v1/opening-hours with the version the form opened with and all s
expected: Save Hours sends PUT /api/v1/opening-hours with the version the form opened with and all seven days (a closed day with null times), shows 'Opening hours saved', clears the public data in this browser and uses the answered version for the next save
result: pass
source: automated
coverage_id: 11-16-D3

### 101. 11-16 D4: OR-3: hoursSchema and closureSchema check every rule the server checks with the server's o
expected: OR-3: hoursSchema and closureSchema check every rule the server checks with the server's own messages (opening and closing time required, half hours from 5:00 AM to 11:30 PM, closing after opening, first day required and real and today or later, last day on or after the first and at most 31 days, note at most 80), and the closure mappers send an empty last day or note as null
result: pass
source: automated
coverage_id: 11-16-D4

### 102. 11-16 D5: The Holidays and closures card lists upcoming closures by first day (Date, Public note or 
expected: The Holidays and closures card lists upcoming closures by first day (Date, Public note or the empty-value mark), names Edit and Delete by date, opens ClosureModal from Add Closure, and shows 'No closures coming up' with no extra button when there are none
result: pass
source: automated
coverage_id: 11-16-D5

### 103. 11-16 D6: ClosureModal starts First day on the server's business today, checks every rule before sen
expected: ClosureModal starts First day on the server's business today, checks every rule before sending, puts the server's overlap line under First day, asks Discard changes? before closing a changed window, sends one Idempotency-Key per add and the version on an edit, keeps a running closure's past first day when it is left alone, and shows the conflict banner with Load Latest on a stale edit; a save shows the toast, reads the list again, clears the public data and moves focus to that row's Edit
result: pass
source: automated
coverage_id: 11-16-D6

### 104. 11-16 D7: Delete asks 'Delete this closure?' with the date and the normal-hours line, Cancel focused
expected: Delete asks 'Delete this closure?' with the date and the normal-hours line, Cancel focused first; success removes the row, clears the public data and moves focus to the next row's Edit, else the previous, else Add Closure; a 404 closes the question, shows 'Already deleted' and reads the list again
result: pass
source: automated
coverage_id: 11-16-D7

### 105. 11-16 D8: A stale Save Hours shows the ConflictBanner inside the Opening hours card with the typed c
expected: A stale Save Hours shows the ConflictBanner inside the Opening hours card with the typed choices kept; Load Latest asks Discard changes? then shows the latest week and uses its version; Undo Changes resets and is aria-disabled when clean; leaving the tab, navigating or reloading with unsaved hours asks first; a server 400 lands under the time it names
result: pass
source: automated
coverage_id: 11-16-D8

### 106. 11-16 D9: Each card has its own loading ('Loading the opening hours…', 'Loading closures…') and erro
expected: Each card has its own loading ('Loading the opening hours…', 'Loading closures…') and error state with Try Again; one failing card never blanks the other
result: pass
source: automated
coverage_id: 11-16-D9

### 107. 11-16 D10: At 320px a day row stacks with Opens and Closes side by side, the page has no sideways scr
expected: At 320px a day row stacks with Opens and Closes side by side, the page has no sideways scroll and axe finds nothing on the tab, with the closure window open or not
result: pass
source: automated
coverage_id: 11-16-D10

### 108. 11-17 D1: A Manager lists (shown and hidden, in order), reads, adds and edits product lines through 
expected: A Manager lists (shown and hidden, in order), reads, adds and edits product lines through /api/v1/product-lines; an Admin gets 403 and anonymous 401 on all eight routes
result: pass
source: automated
coverage_id: 11-17-D1

### 109. 11-17 D2: A price and a minimum on Basketball Jerseys reach the public Products data with a new ETag
expected: A price and a minimum on Basketball Jerseys reach the public Products data with a new ETag; a new line starts hidden at the end with the custom drawing and is public only once shown
result: pass
source: automated
coverage_id: 11-17-D2

### 110. 11-17 D3: Every line rule has its approved message; 0.01 and 999999.99 pass, 0.00, 1000000.00 and th
expected: Every line rule has its approved message; 0.01 and 999999.99 pass, 0.00, 1000000.00 and three decimals fail; minimum 1 and 9999 pass, 0, 10000 and 1.5 fail
result: pass
source: automated
coverage_id: 11-17-D3

### 111. 11-17 D4: The key is made once from the short name (unique, a number suffix when taken) and never ch
expected: The key is made once from the short name (unique, a number suffix when taken) and never changes on edit; LineKey.IsValid refuses anything that is not a key
result: pass
source: automated
coverage_id: 11-17-D4

### 112. 11-17 D5: A short name another line uses (ignoring letter case and trailing spaces) is refused under
expected: A short name another line uses (ignoring letter case and trailing spaces) is refused under shortName; a line may change the letter case of its own; a stale version is 409 edit.stale; client stamps are ignored
result: pass
source: automated
coverage_id: 11-17-D5

### 113. 11-17 D6: Ticked order product types are filed under the line, moved from another line, or freed whe
expected: Ticked order product types are filed under the line, moved from another line, or freed when not ticked; each writes product-type.line-linked; a saved link clears the public cache
result: pass
source: automated
coverage_id: 11-17-D6

### 114. 11-17 D7: Moves swap under the site-content lock; a move at the end is a 204 with no audit; the same
expected: Moves swap under the site-content lock; a move at the end is a 204 with no audit; the same move with one Idempotency-Key moves once; two Managers moving at once end with every position used once
result: pass
source: automated
coverage_id: 11-17-D7

### 115. 11-17 D8: Hide takes the line off the public read and show brings it back, each with its audit entry
expected: Hide takes the line off the public read and show brings it back, each with its audit entry; delete answers 422 'This product line is in use. Hide it instead.' for a line with a product type or a photo, deletes an unused line (204) and a second delete is 404
result: pass
source: automated
coverage_id: 11-17-D8

### 116. 11-17 D9: Audit entries: added, changed (old and new title and price; long texts named, never copied
expected: Audit entries: added, changed (old and new title and price; long texts named, never copied), moved, hidden, shown, deleted and line-linked; AuditActions.All is 113
result: pass
source: automated
coverage_id: 11-17-D9

### 117. 11-17 D11: Domain coverage 100 percent line and branch, Application above its floor
expected: Domain coverage 100 percent line and branch, Application above its floor
result: pass
source: automated
coverage_id: 11-17-D11

### 118. 11-18 D1: /products shows one article per shown line in display order from the productLines boot blo
expected: /products shows one article per shown line in display order from the productLines boot block with no request on a first visit, the lead counts the lines in words, and a single line reads 01 / 01
result: pass
source: automated
coverage_id: 11-18-D1

### 119. 11-18 D2: Each article shows the number, title, description, the five fixed customize cards with the
expected: Each article shows the number, title, description, the five fixed customize cards with their icons, the price line from the server value ('Starts at ₱650.00 / pc · min. 10 pcs', 'min. 1 pc', 'Message us for a price') and the buttons
result: pass
source: automated
coverage_id: 11-18-D2

### 120. 11-18 D3: The main photo or the drawn jersey, the back and fabric photos or labelled placeholders, w
expected: The main photo or the drawn jersey, the back and fabric photos or labelled placeholders, with the front, back view and fabric detail alts and the product srcset sizes
result: pass
source: automated
coverage_id: 11-18-D3

### 121. 11-18 D4: The sticky pill bar (44px pills, key allow-list), the Get a Quote, See work and Message us
expected: The sticky pill bar (44px pills, key allow-list), the Get a Quote, See work and Message us links, the hash scroll (once, instant under reduced motion, no focus move, after the fonts) and the larger scroll padding on /products
result: pass
source: automated
coverage_id: 11-18-D4

### 122. 11-18 D5: Loading (six 44px pill skeletons, two article skeletons, 'Loading the product lines…'), fa
expected: Loading (six 44px pill skeletons, two article skeletons, 'Loading the product lines…'), failed read (error with Try Again, help card stays) and empty (no pill bar, 'Our product list is being updated', Message Us or Get a Quote) states
result: pass
source: automated
coverage_id: 11-18-D5

### 123. 11-18 D6: Zero axe, console and CSP findings on /products at 390 and 1440 px, and no sideways scroll
expected: Zero axe, console and CSP findings on /products at 390 and 1440 px, and no sideways scroll from 320 px
result: pass
source: automated
coverage_id: 11-18-D6

### 124. 11-19 D1: A Manager uploads a photo into the main, back or fabric slot of a line; it is stored under
expected: A Manager uploads a photo into the main, back or fabric slot of a line; it is stored under csps/content/lines/{lineId}/ with a random id (never orders), and the public product lines read shows its src, srcSet, width and height with a new ETag; an Admin gets 403
result: pass
source: automated
coverage_id: 11-19-D1

### 125. 11-19 D2: A replace keeps one row and queues the old file once in the same save; a removal answers 2
expected: A replace keeps one row and queues the old file once in the same save; a removal answers 204, queues its file and the public read shows null; an empty slot, an unknown slot word and a missing line are 404; each change writes product-line.photo-changed with key, title, slot and change and never an address
result: pass
source: automated
coverage_id: 11-19-D2

### 126. 11-19 D3: An SVG, a file over 10 MB and an over-limit image are refused with the Phase 9 messages an
expected: An SVG, a file over 10 MB and an over-limit image are refused with the Phase 9 messages and nothing is stored; no session, storage not set up and a failed save after storing give the existing answers and queue the new file as UploadUndone
result: pass
source: automated
coverage_id: 11-19-D3

### 127. 11-19 D4: A line with a photo cannot be deleted (422 product-lines.in-use); an upload racing the del
expected: A line with a photo cannot be deleted (422 product-lines.in-use); an upload racing the delete of the same line ends as 200 and 422 or as 404 and 204, never a 500, because both take the site-content lock
result: pass
source: automated
coverage_id: 11-19-D4

### 128. 11-19 D5: The Products page head carries og:image at the csps_share_1200 address of the first shown 
expected: The Products page head carries og:image at the csps_share_1200 address of the first shown line's main photo, og:image:width 1200, og:image:height 630, og:image:alt the business name and twitter:card summary_large_image; with no such photo the picture tags are left out and twitter:card is summary; an upload and a removal clear the cached head
result: pass
source: automated
coverage_id: 11-19-D5

### 129. 11-19 D7: The stray sweep lists the content folder after the orders folder with the trailing slash r
expected: The stray sweep lists the content folder after the orders folder with the trailing slash rule, keeps files a line photo names and queues old unnamed ones; the inventory names line photos; the orders pass is unchanged
result: pass
source: automated
coverage_id: 11-19-D7

### 130. 11-19 D9: Domain coverage 100 percent line and branch, Application above its floor, full Server and 
expected: Domain coverage 100 percent line and branch, Application above its floor, full Server and Infrastructure runs green
result: pass
source: automated
coverage_id: 11-19-D9

### 131. 11-20 D1: A Manager opens the Products tab and sees every line, shown and hidden, in display order w
expected: A Manager opens the Products tab and sees every line, shown and hidden, in display order with the 44px photo or placeholder, the title as a link over the short name, Starts at with the minimum or the empty marker, the order type and gallery counts and a Shown or Hidden badge; Add Product Line goes to the new line editor
result: pass
source: automated
coverage_id: 11-20-D1

### 132. 11-20 D2: A price set in the editor reaches the public Products page: Visitors see updates as it is 
expected: A price set in the editor reaches the public Products page: Visitors see updates as it is typed, Save Changes sends the version the form opened with, the toast shows and the public data in this browser is cleared
result: pass
source: automated
coverage_id: 11-20-D2

### 133. 11-20 D3: Every ProductLine.Check rule runs in the browser first with the server's own message: titl
expected: Every ProductLine.Check rule runs in the browser first with the server's own message: title, short name, number, card text, description, the five customize texts, price (decimals before range) and minimum
result: pass
source: automated
coverage_id: 11-20-D3

### 134. 11-20 D4: A new line starts unticked, shows the save-first note, creates with one Idempotency-Key an
expected: A new line starts unticked, shows the save-first note, creates with one Idempotency-Key and opens its editor (replace) with the 'hidden until you tick Show on the website' toast; a duplicate short name from the server lands under Short name with focus
result: pass
source: automated
coverage_id: 11-20-D4

### 135. 11-20 D5: The Order product types card lists active types A to Z, names a type filed under another l
expected: The Order product types card lists active types A to Z, names a type filed under another line, files a ticked type here on save, keeps retired types filed, and with no types links to Settings
result: pass
source: automated
coverage_id: 11-20-D5

### 136. 11-20 D6: A stale save shows the ConflictBanner above the first card with the typed values kept; Loa
expected: A stale save shows the ConflictBanner above the first card with the typed values kept; Load Latest asks Discard changes? and replaces the values and the version; leaving with changes asks Discard changes?; an id that is not a GUID or a line the server does not know shows 'This product line wasn't found.'
result: pass
source: automated
coverage_id: 11-20-D6

### 137. 11-20 D7: Move up and Move down save at once with the focus and announcement rules; the first row's 
expected: Move up and Move down save at once with the focus and announcement rules; the first row's Move up and the last row's Move down are aria-disabled but focusable; Hide and Show save at once with their toasts and keep focus on the toggle
result: pass
source: automated
coverage_id: 11-20-D7

### 138. 11-20 D9: Admin tables scroll inside their frame on tablets and turn into row cards on phones, with 
expected: Admin tables scroll inside their frame on tablets and turn into row cards on phones, with no sideways page scroll at 320px and no axe violation
result: pass
source: automated
coverage_id: 11-20-D9

### 139. 11-21 D1: A Manager lists (display order, hidden included), adds, edits, moves, hides, shows and del
expected: A Manager lists (display order, hidden included), adds, edits, moves, hides, shows and deletes testimonials through /api/v1/testimonials; an Admin gets 403 and anonymous 401 on all seven routes
result: pass
source: automated
coverage_id: 11-21-D1

### 140. 11-21 D2: Every UI-SPEC message is the server's wording: 'Enter the quote.', 'Keep the quote to 300 
expected: Every UI-SPEC message is the server's wording: 'Enter the quote.', 'Keep the quote to 300 characters or fewer.', 'Enter the name.', 'Keep the name to 60 characters or fewer.', 'Keep this to 80 characters or fewer.', 'Choose 1 to 5 stars.'; the limits hold at 300 and 301, 60 and 61, 80 and 81, and 0, 6 and 2.5 stars are refused
result: pass
source: automated
coverage_id: 11-21-D2

### 141. 11-21 D3: The AddTestimonials migration creates only the Testimonials table with CK_Testimonials_Sta
expected: The AddTestimonials migration creates only the Testimonials table with CK_Testimonials_Stars (stars 1 to 5), rowversion, stamps and one index; no trigger, no JSON column, no seeded row, no change to an existing table, and Down is refused
result: pass
source: automated
coverage_id: 11-21-D3

### 142. 11-21 D4: GET /api/v1/public/home answers anonymously with the shown line cards, the line count, the
expected: GET /api/v1/public/home answers anonymously with the shown line cards, the line count, the first three shown testimonials in order, recentWork [] and heroTag null, with a strong ETag, no-cache and 304; a hidden testimonial or line is left out
result: pass
source: automated
coverage_id: 11-21-D4

### 143. 11-21 D5: The / shell carries the home JSON in the csps-boot block, equal to the API body; no other 
expected: The / shell carries the home JSON in the csps-boot block, equal to the API body; no other page has the key; a failing Home read keeps the site data and is not cached
result: pass
source: automated
coverage_id: 11-21-D5

### 144. 11-21 D6: Moves swap under the site-content lock; a move at the end is a no-op; the same move posted
expected: Moves swap under the site-content lock; a move at the end is a no-op; the same move posted twice with one Idempotency-Key moves once; two Managers moving at the same moment end with every place used once
result: pass
source: automated
coverage_id: 11-21-D6

### 145. 11-21 D7: Every testimonial add, edit, move, hide and delete, and a hidden line, each give a new Hom
expected: Every testimonial add, edit, move, hide and delete, and a hidden line, each give a new Home ETag on the next read
result: pass
source: automated
coverage_id: 11-21-D7

### 146. 11-21 D8: Stale edits answer 409 edit.stale; stamps come from the server; the six audit entries name
expected: Stale edits answer 409 edit.stale; stamps come from the server; the six audit entries name the person and never copy the quote or the team line
result: pass
source: automated
coverage_id: 11-21-D8

### 147. 11-21 D9: The Testing seed leaves three shown demo testimonials in order and one hidden, deletes E2E
expected: The Testing seed leaves three shown demo testimonials in order and one hidden, deletes E2E- testimonials and leaves the same four on a second run
result: pass
source: automated
coverage_id: 11-21-D9

### 148. 11-21 D11: Domain coverage 100 percent line and branch, Application above its floor, full Server and 
expected: Domain coverage 100 percent line and branch, Application above its floor, full Server and Infrastructure runs green
result: pass
source: automated
coverage_id: 11-21-D11

### 149. 11-22 D1: A Manager picks a main photo for Polo in the editor, it goes through prepareImage, uploads
expected: A Manager picks a main photo for Polo in the editor, it goes through prepareImage, uploads under one Idempotency-Key, shows Uploading then Saved with the toast 'Photo saved' / 'It shows on the website now.', and the public Products page shows it in the Polo article
result: pass
source: automated
coverage_id: 11-22-D1

### 150. 11-22 D2: Three slots in a row (one column at 767px and below): Main photo 4:5 with the line's drawi
expected: Three slots in a row (one column at 767px and below): Main photo 4:5 with the line's drawing while empty, Back view and Fabric detail 1:1 with labelled boxes; Choose Photo on hover devices, Take Photo as well on touch devices
result: pass
source: automated
coverage_id: 11-22-D2

### 151. 11-22 D3: A refused pick (type, size, pixels, unreadable, rules not readable) shows the Phase 9 pick
expected: A refused pick (type, size, pixels, unreadable, rules not readable) shows the Phase 9 pick-error box with the Phase 9 words and sends nothing; a refused or failed upload shows the server's line or the network words in the same box
result: pass
source: automated
coverage_id: 11-22-D3

### 152. 11-22 D4: Replace Photo puts a new file in the same slot; Remove Photo asks first in the slot's word
expected: Replace Photo puts a new file in the same slot; Remove Photo asks first in the slot's words with Cancel focused, then shows 'Photo removed' / 'The drawing shows instead.', brings the drawing back and puts focus on Choose Photo; a failed removal stays in the question
result: pass
source: automated
coverage_id: 11-22-D4

### 153. 11-22 D5: One action at a time: the pressed control is pending (aria-busy), the slot's other actions
expected: One action at a time: the pressed control is pending (aria-busy), the slot's other actions and the other slots are aria-disabled and keep focus, and the Photos card holds the other two slots until the save ends
result: pass
source: automated
coverage_id: 11-22-D5

### 154. 11-22 D6: A new line shows 'Save the product line first, then add photos.' and no slots; a photo sav
expected: A new line shows 'Save the product line first, then add photos.' and no slots; a photo save leaves the form clean (leaving asks nothing) and does not change the version a later Save Changes sends
result: pass
source: automated
coverage_id: 11-22-D6

### 155. 11-22 D7: PUB-03: each photo change clears the public data held in this browser and reads the line l
expected: PUB-03: each photo change clears the public data held in this browser and reads the line list again, and the Products page shows the new photo on the next load
result: pass
source: automated
coverage_id: 11-22-D7

### 156. 11-23 D1: Admin and Manager record the customer's OK and show a Completed order; the detail answers 
expected: Admin and Manager record the customer's OK and show a Completed order; the detail answers publicWebsite and the gallery entry sits at the top
result: pass
source: automated
coverage_id: 11-23-D1

### 157. 11-23 D2: Show needs the recorded OK; a Cancelled order is refused; the name and line rules; consent
expected: Show needs the recorded OK; a Cancelled order is refused; the name and line rules; consent who and when are never taken from the client
result: pass
source: automated
coverage_id: 11-23-D2

### 158. 11-23 D3: Five audit codes name the order and never the customer
expected: Five audit codes name the order and never the customer
result: pass
source: automated
coverage_id: 11-23-D3

### 159. 11-23 D4: AddOrderPublicSettings migration: five nullable columns, GalleryEntries with CHECKs and a 
expected: AddOrderPublicSettings migration: five nullable columns, GalleryEntries with CHECKs and a filtered unique index, no trigger, forward only
result: pass
source: automated
coverage_id: 11-23-D4

### 160. 11-23 D5: Cancelling a shown order takes it off the website, removes its gallery entry, keeps the OK
expected: Cancelling a shown order takes it off the website, removes its gallery entry, keeps the OK and writes order.taken-off-website; a reopen does not put it back
result: pass
source: automated
coverage_id: 11-23-D5

### 161. 11-23 D6: Every write to a shown order (settings, items, team name, photos, cover, cancel, delete, r
expected: Every write to a shown order (settings, items, team name, photos, cover, cancel, delete, restore, permanent delete) clears the public cache; the same writes on a never-shown order do not
result: pass
source: automated
coverage_id: 11-23-D6

### 162. 11-23 D7: GET /api/v1/product-lines/options lists the active lines in display order for Admin and Ma
expected: GET /api/v1/product-lines/options lists the active lines in display order for Admin and Manager; anonymous 401
result: pass
source: automated
coverage_id: 11-23-D7

### 163. 11-24 D1: The Testimonials tab lists every testimonial in display order (quote clamped to 2 lines, n
expected: The Testimonials tab lists every testimonial in display order (quote clamped to 2 lines, name over team, '5 stars' or '1 star' with one decorative star, Shown or Hidden badge, 'On the Home page' under the first 3 shown rows) with Move up, Move down, Edit, Hide or Show and Delete, each named for the person
result: pass
source: automated
coverage_id: 11-24-D1

### 164. 11-24 D2: Add Testimonial opens TestimonialModal with Quote (4 rows, at most 300), Name (at most 60)
expected: Add Testimonial opens TestimonialModal with Quote (4 rows, at most 300), Name (at most 60), Team or role (at most 80), Stars (default 5), Show on the website (ticked on add); one Idempotency-Key per add; 'Testimonial added' / 'The Home page shows the change.'; edit sends the version; 409 shows the ConflictBanner with the typed values kept; the dirty guard asks before closing
result: pass
source: automated
coverage_id: 11-24-D2

### 165. 11-24 D3: OR-3: testimonialSchema mirrors plan 11-21's validator with its messages (300, 60, 80, who
expected: OR-3: testimonialSchema mirrors plan 11-21's validator with its messages (300, 60, 80, whole stars 1 to 5, counted after the trim)
result: pass
source: automated
coverage_id: 11-24-D3

### 166. 11-24 D4: Move, hide and show save at once with the Products tab's focus, announcement and busy rule
expected: Move, hide and show save at once with the Products tab's focus, announcement and busy rules; Delete asks 'Delete this testimonial?' with the person and the start of the quote and focuses Cancel first, then moves focus to the next row's Edit, else the previous, else Add Testimonial
result: pass
source: automated
coverage_id: 11-24-D4

### 167. 11-24 D5: The empty, loading and error states show 'No testimonials yet' with its message, 'Loading 
expected: The empty, loading and error states show 'No testimonials yet' with its message, 'Loading testimonials…' and \"Couldn't load testimonials.\" with Try Again; a 300-character quote is clamped to 2 lines in the table and shown whole in the edit window; zero axe in each
result: pass
source: automated
coverage_id: 11-24-D5

### 168. 11-24 D6: PUB-03: every testimonial change clears the public data held in this browser and shows its
expected: PUB-03: every testimonial change clears the public data held in this browser and shows its toast, and the public Home data (GET /api/v1/public/home) then starts with the new first testimonial and drops a hidden or deleted one
result: pass
source: automated
coverage_id: 11-24-D6

### 169. 11-24 D10: Zero warnings: lint, types, tests; the public bundle stays inside its budgets
expected: Zero warnings: lint, types, tests; the public bundle stays inside its budgets
result: pass
source: automated
coverage_id: 11-24-D10

### 170. 11-25 D1: Home shows one category card per active line in display order with the title, card text, n
expected: Home shows one category card per active line in display order with the title, card text, number, the Main photo when set and a link to /products#key; the lead counts the lines in words (one line reads 'One way to suit up, ...')
result: pass
source: automated
coverage_id: 11-25-D1

### 171. 11-25 D2: The first visit reads the home boot block with no request; a page without it reads GET /ap
expected: The first visit reads the home boot block with no request; a page without it reads GET /api/v1/public/home
result: pass
source: automated
coverage_id: 11-25-D2

### 172. 11-25 D3: Hero with the decorative drawing (aria-hidden, no style attribute), Why CSPS with the type
expected: Hero with the decorative drawing (aria-hidden, no style attribute), Why CSPS with the typed turnaround line or the no-promise text, the four steps, the first three testimonials with stars and the final call to action with the Messenger button only when a link is set
result: pass
source: automated
coverage_id: 11-25-D3

### 173. 11-25 D4: At phone width the testimonial row is a focusable region named Testimonials with a visible
expected: At phone width the testimonial row is a focusable region named Testimonials with a visible focus ring and scrolls inside itself; no sideways scroll from 320 to 1920 px; the Why CSPS and testimonial grids have the spec's column counts
result: pass
source: automated
coverage_id: 11-25-D4

### 174. 11-25 D5: Loading shows six 4:5 card frames and three testimonial frames with four lines in one regi
expected: Loading shows six 4:5 card frames and three testimonial frames with four lines in one region named Loading the page; no active line or no shown testimonial leaves only that section out; a failed read shows the product lines error with Try Again and no testimonials; zero axe in each
result: pass
source: automated
coverage_id: 11-25-D5

### 175. 11-25 D6: Zero axe, console and CSP findings on / at 390 and 1440 px (the e2e guard fixture fails an
expected: Zero axe, console and CSP findings on / at 390 and 1440 px (the e2e guard fixture fails any finding)
result: pass
source: automated
coverage_id: 11-25-D6

### 176. 11-25 D7: The Home route stays inside the 150 KB public budget
expected: The Home route stays inside the 150 KB public budget
result: pass
source: automated
coverage_id: 11-25-D7

### 177. 11-25 D8: CategoryCard with no photo renders exactly as before
expected: CategoryCard with no photo renders exactly as before
result: pass
source: automated
coverage_id: 11-25-D8

### 178. 11-26 D1: A shown order is one public gallery item with its line, pieces and all photos (cover first
expected: A shown order is one public gallery item with its line, pieces and all photos (cover first), with pills and a total, a strong ETag and 304
result: pass
source: automated
coverage_id: 11-26-D1

### 179. 11-26 D2: Only consented, shown, not cancelled, not deleted, filed-under-a-shown-line, photographed 
expected: Only consented, shown, not cancelled, not deleted, filed-under-a-shown-line, photographed orders (and shown uploads on shown lines) are public
result: pass
source: automated
coverage_id: 11-26-D2

### 180. 11-26 D3: No customer name, phone, email, address, price, note, item description or photo descriptio
expected: No customer name, phone, email, address, price, note, item description or photo description appears in any public route or page shell
result: pass
source: automated
coverage_id: 11-26-D3

### 181. 11-26 D4: A 300 item gallery snapshot stays cached: the second read runs no database command, with t
expected: A 300 item gallery snapshot stays cached: the second read runs no database command, with the cache cap unchanged
result: pass
source: automated
coverage_id: 11-26-D4

### 182. 11-26 D5: Showing, a photo add on a shown order, taking off, a cover change and a line hide each giv
expected: Showing, a photo add on a shown order, taking off, a cover change and a line hide each give a new gallery and Home ETag
result: pass
source: automated
coverage_id: 11-26-D5

### 183. 11-26 D6: Home recentWork is the six newest shown orders by shown date (uploads never) and heroTag t
expected: Home recentWork is the six newest shown orders by shown date (uploads never) and heroTag the newest, with strip photo addresses; none gives [] and null
result: pass
source: automated
coverage_id: 11-26-D6

### 184. 11-26 D7: hasGalleryItems, the Manager's shownGalleryCount and the delete guard follow the gallery e
expected: hasGalleryItems, the Manager's shownGalleryCount and the delete guard follow the gallery entries
result: pass
source: automated
coverage_id: 11-26-D7

### 185. 11-26 D10: A public gallery read that loses a deadlock to a staff write is read again (up to three tr
expected: A public gallery read that loses a deadlock to a staff write is read again (up to three tries), so a visitor never meets a 500 for it
result: pass
source: automated
coverage_id: 11-26-D10

### 186. 11-26 D9: POST /api/testing/site-content leaves four demo shown orders and one that has the OK but i
expected: POST /api/testing/site-content leaves four demo shown orders and one that has the OK but is not shown
result: pass
source: automated
coverage_id: 11-26-D9

### 187. 11-27 D1: The Public website card sits after Customer and before Status history for Admin and Manage
expected: The Public website card sits after Customer and before Status history for Admin and Manager, with the four rows, the Shown badge since its date, and the empty value for a missing line or name
result: pass
source: automated
coverage_id: 11-27-D1

### 188. 11-27 D2: Show on the website cannot be ticked or sent while the customer's OK is unticked (D-11): a
expected: Show on the website cannot be ticked or sent while the customer's OK is unticked (D-11): aria-disabled with its hint, unticking the OK unticks Show, the schema refuses it, and the server refuses it too
result: pass
source: automated
coverage_id: 11-27-D2

### 189. 11-27 D3: Every rule in the server's words: line needed to show, name at most 80, name needed when n
expected: Every rule in the server's words: line needed to show, name at most 80, name needed when no team; server field errors land on their fields; the Visitors see preview uses the server's pieces
result: pass
source: automated
coverage_id: 11-27-D3

### 190. 11-27 D4: Save sends PUT /orders/{id}/public with the order version, sets the order from the answer,
expected: Save sends PUT /orders/{id}/public with the order version, sets the order from the answer, closes the window, returns focus to Edit and shows the right toast (shown, taken off, or saved)
result: pass
source: automated
coverage_id: 11-27-D4

### 191. 11-27 D5: A 409 shows the conflict banner with the choices kept; a changed window asks Discard chang
expected: A 409 shows the conflict banner with the choices kept; a changed window asks Discard changes? before it closes
result: pass
source: automated
coverage_id: 11-27-D5

### 192. 11-27 D6: A Cancelled order reads Not shown with its note and no Edit; a Completed order can still b
expected: A Cancelled order reads Not shown with its note and no Edit; a Completed order can still be edited; a shown order with no photo says so; a deleted order has no card
result: pass
source: automated
coverage_id: 11-27-D6

### 193. 11-27 D7: The card and window fit every width and pass axe in every state: a bottom sheet at 320px w
expected: The card and window fit every width and pass axe in every state: a bottom sheet at 320px with a footer that fits and no sideways scroll, the card across the side grid at 820px
result: pass
source: automated
coverage_id: 11-27-D7

### 194. 11-28 D1: A Manager adds a photo for older work (photo, team, line, pieces, note, shown) through POS
expected: A Manager adds a photo for older work (photo, team, line, pieces, note, shown) through POST /api/v1/gallery-items; it is stored under content/gallery/{entryId}, joins the top of the admin list and the public gallery with pieces and note, and an Admin gets 403
result: pass
source: automated
coverage_id: 11-28-D1

### 195. 11-28 D2: The upload form gives the exact UI-SPEC messages (photo, team, 80 characters, line, pieces
expected: The upload form gives the exact UI-SPEC messages (photo, team, 80 characters, line, pieces 1 to 9,999, note 120 characters) on add and edit; client stamps are ignored
result: pass
source: automated
coverage_id: 11-28-D2

### 196. 11-28 D3: Edit with a version (409 when stale, no change keeps the version), replace the photo (old 
expected: Edit with a version (409 when stale, no change keeps the version), replace the photo (old file queued), hide, show and delete an upload, each with its audit entry and no note text or address; an order item answers 404 on all of them
result: pass
source: automated
coverage_id: 11-28-D3

### 197. 11-28 D4: A hidden line's uploads leave the public site and are flagged 'line hidden' in the list; a
expected: A hidden line's uploads leave the public site and are flagged 'line hidden' in the list; a line with an upload cannot be deleted; an upload or an edit racing the delete of its line never answers 500
result: pass
source: automated
coverage_id: 11-28-D4

### 198. 11-28 D5: Refused photos (SVG named as JPEG, over 10 MB, over 25 megapixels) leave nothing in storag
expected: Refused photos (SVG named as JPEG, over 10 MB, over 25 megapixels) leave nothing in storage on add and replace; the inventory keeps gallery photo ids
result: pass
source: automated
coverage_id: 11-28-D5

### 199. 11-28 D6: One gallery order across orders and uploads: a move swaps with the visible neighbour or th
expected: One gallery order across orders and uploads: a move swaps with the visible neighbour or the next item of the filtered line, the ends are no-ops, a deleted shown order is not a neighbour, moves at the same moment keep every place used once, one Idempotency-Key moves once, and Home's Recent work is unchanged
result: pass
source: automated
coverage_id: 11-28-D6

### 200. 11-28 D7: Every gallery write (add, edit, photo replace, move, hide, show, delete) gives a new publi
expected: Every gallery write (add, edit, photo replace, move, hide, show, delete) gives a new public gallery ETag on the next read
result: pass
source: automated
coverage_id: 11-28-D7

### 201. 11-28 D8: The Testing seed leaves two shown demo uploads (one with pieces and a note, one with neith
expected: The Testing seed leaves two shown demo uploads (one with pieces and a note, one with neither) and removes uploads whose team starts with E2E-
result: pass
source: automated
coverage_id: 11-28-D8

### 202. 11-29 D1: The Gallery filter bar lists All and one pill per line with items, with the server's count
expected: The Gallery filter bar lists All and one pill per line with items, with the server's counts; the selected pill is maroon with aria-pressed; counts equal the tiles shown
result: pass
source: automated
coverage_id: 11-29-D1

### 203. 11-29 D3: One button tile per item at the clamped photo ratio, JerseyArt without a photo address, ca
expected: One button tile per item at the clamped photo ratio, JerseyArt without a photo address, caption on a solid blush band, long names wrap
result: pass
source: automated
coverage_id: 11-29-D3

### 204. 11-29 D4: Toolbar keys: one tab stop, arrows with wrap, Home, End, Enter and Space select and keep f
expected: Toolbar keys: one tab stop, arrows with wrap, Home, End, Enter and Space select and keep focus on the pill, polite Showing N items
result: pass
source: automated
coverage_id: 11-29-D4

### 205. 11-29 D5: First 24 tiles, Show More Photos adds 24 with no request and focuses the first new tile, t
expected: First 24 tiles, Show More Photos adds 24 with no request and focuses the first new tile, the button leaves when all are shown, a new category starts at 24, Get a Quote links to /contact
result: pass
source: automated
coverage_id: 11-29-D5

### 206. 11-29 D6: Loading (7 pill and 8 tile skeletons at 4/5, 1/1, 3/4, 4/3 in Loading the gallery), failed
expected: Loading (7 pill and 8 tile skeletons at 4/5, 1/1, 3/4, 4/3 in Loading the gallery), failed read (Try Again, no pills), empty state (No photos yet with Get a Quote), zero axe in each
result: pass
source: automated
coverage_id: 11-29-D6

### 207. 11-29 D7: Page-level behaviour in real browsers: pill bar scrolls inside itself at 320px with no sid
expected: Page-level behaviour in real browsers: pill bar scrolls inside itself at 320px with no sideways scroll, focused tiles stay clear of the header and the sticky bar, zero axe, console and CSP findings at 390 and 1440px
result: pass
source: automated
coverage_id: 11-29-D7

### 208. 11-29 D8: Home Recent work: the six newest shown orders as 4:5 tiles to /gallery?category={key}, cap
expected: Home Recent work: the six newest shown orders as 4:5 tiles to /gallery?category={key}, captions, JerseyArt without a photo, four frames while loading, left out with none or after a failed read; the Recent order tag with the name and piece count, not a link
result: pass
source: automated
coverage_id: 11-29-D8

### 209. 11-29 D9: Gallery 147.21 KB and Home 149.29 KB gz, both at or under 150 KB
expected: Gallery 147.21 KB and Home 149.29 KB gz, both at or under 150 KB
result: pass
source: automated
coverage_id: 11-29-D9

### 210. 11-30 D1: A Manager uploads a JPEG to POST /api/v1/site-settings/share-picture; it is stored under a
expected: A Manager uploads a JPEG to POST /api/v1/site-settings/share-picture; it is stored under a new random id in csps/content/share/ (never the orders folder), the answer holds the 320 and 640 preview addresses and the stored size; an Admin gets 403
result: pass
source: automated
coverage_id: 11-30-D1

### 211. 11-30 D2: Home, Contact and the 404 carry the default picture as og:image at 1200 x 630 with width, 
expected: Home, Contact and the 404 carry the default picture as og:image at 1200 x 630 with width, height, alt (the business name) and twitter:card summary_large_image; Products and Gallery keep their own photo and fall back to the default; with no picture the og:image tags are left out and twitter:card is summary
result: pass
source: automated
coverage_id: 11-30-D2

### 212. 11-30 D3: The LocalBusiness JSON-LD image is the default picture's 1200 x 630 address on every publi
expected: The LocalBusiness JSON-LD image is the default picture's 1200 x 630 address on every public page and is absent with no picture
result: pass
source: automated
coverage_id: 11-30-D3

### 213. 11-30 D4: A replace stores a new id different from the old one and queues the old file in the same s
expected: A replace stores a new id different from the old one and queues the old file in the same save; a removal answers 204, queues its file and a second removal is 404; each change writes site-settings.share-picture-changed (change=added, replaced or removed) with no address; a failed save after the file reached storage queues the new file as UploadUndone
result: pass
source: automated
coverage_id: 11-30-D4

### 214. 11-30 D5: An SVG named as a JPEG, a file one byte over 10 MB and a photo over 25 megapixels are refu
expected: An SVG named as a JPEG, a file one byte over 10 MB and a photo over 25 megapixels are refused with the Phase 9 messages and nothing is stored
result: pass
source: automated
coverage_id: 11-30-D5

### 215. 11-30 D6: GET /api/v1/site-settings returns sharePicture with the 320 and 640 preview addresses and 
expected: GET /api/v1/site-settings returns sharePicture with the 320 and 640 preview addresses and the stored size after an upload (Admin may read it), and null after a removal
result: pass
source: automated
coverage_id: 11-30-D6

### 216. 11-30 D7: The image inventory names the share picture id, so the stray sweep and the removal job kee
expected: The image inventory names the share picture id, so the stray sweep and the removal job keep the file
result: pass
source: automated
coverage_id: 11-30-D7

### 217. 11-30 D8: The AddSharePicture migration adds only five nullable columns, the seed row holds nulls, n
expected: The AddSharePicture migration adds only five nullable columns, the seed row holds nulls, nothing is dropped or deleted, the idempotent script runs twice, and undoing the migration is refused
result: pass
source: automated
coverage_id: 11-30-D8

### 218. 11-30 D9: POST /api/testing/site-content leaves a demo 1200 x 630 share picture in place, and the Ho
expected: POST /api/testing/site-content leaves a demo 1200 x 630 share picture in place, and the Home head carries it
result: pass
source: automated
coverage_id: 11-30-D9

### 219. 11-30 D12: Domain coverage 100 percent line and branch, Application above its floor, format clean, we
expected: Domain coverage 100 percent line and branch, Application above its floor, format clean, web typecheck, lint and format clean, full Server, Infrastructure and Architecture runs
result: pass
source: automated
coverage_id: 11-30-D12

### 220. 11-31 D1: Pressing a tile opens the lightbox on that item: modal dialog 'Gallery image viewer' insid
expected: Pressing a tile opens the lightbox on that item: modal dialog 'Gallery image viewer' inside the page root with focus on Close viewer, '3 / 16' hidden from assistive technology with a hidden 'Item 3 of 16', the photo with alt '{team}, {Basketball} work', loaded eagerly and never cropped
result: pass
source: automated
coverage_id: 11-31-D1

### 221. 11-31 D2: Previous and Next wrap within the active filter, the arrow keys do the same from anywhere 
expected: Previous and Next wrap within the active filter, the arrow keys do the same from anywhere in the dialog, Esc and Close close, with one item there is no Previous, Next, tap zone or swipe
result: pass
source: automated
coverage_id: 11-31-D2

### 222. 11-31 D3: C-35: above 767px the 56px buttons show and the tap zones are hidden; at 767px and below t
expected: C-35: above 767px the 56px buttons show and the tap zones are hidden; at 767px and below two invisible full-height buttons over the left and right thirds ('Previous photo', 'Next photo') with a 2px chrome-ink focus ring replace them; a swipe of 48px or more that is more horizontal than vertical moves, and the click after a swipe is swallowed
result: pass
source: automated
coverage_id: 11-31-D3

### 223. 11-31 D4: An item with 2 or more photos shows a centered row of 56px thumbnails (44px at 420px and b
expected: An item with 2 or more photos shows a centered row of 56px thumbnails (44px at 420px and below) named 'Show photo {i} of {n}', the shown one with aria-current and a 2px ring; the cover shows first and again after leaving and coming back; the alt adds ', photo {i} of {n}'
result: pass
source: automated
coverage_id: 11-31-D4

### 224. 11-31 D5: Caption: team in display caps (long names wrap), '{Basketball} · {17} pcs · {note}' with m
expected: Caption: team in display caps (long names wrap), '{Basketball} · {17} pcs · {note}' with missing parts left out, and 'Get a quote for something like this' to /contact; D-13: only the public name, line, pieces and note are shown; JerseyArt named by the alt for no photo; MediaPlaceholder named by the alt for a failed photo
result: pass
source: automated
coverage_id: 11-31-D5

### 225. 11-31 D6: Polite announcements 'Item {3} of {16}: {team}, {Basketball}' on an item change and 'Photo
expected: Polite announcements 'Item {3} of {16}: {team}, {Basketball}' on an item change and 'Photo {2} of {4}' on a thumbnail change; tab order Close, Previous, Next, thumbnails, Get a quote (phones: Close, the tap zones, thumbnails, Get a quote); zero axe with four photos, no photo, one item and a failed photo
result: pass
source: automated
coverage_id: 11-31-D6

### 226. 11-31 D7: History and focus: opening adds one entry with the same URL, Back closes it and stays on t
expected: History and focus: opening adds one entry with the same URL, Back closes it and stays on the same category, Esc and Close leave no extra entry, the quote link replaces the entry, a category change closes it; on close focus goes to the tile of the item last shown (48 tiles drawn when it was beyond the first 24)
result: pass
source: automated
coverage_id: 11-31-D7

### 227. 11-31 D8: PERF-01: the lightbox is its own lazy chunk (GalleryLightbox 7.79 kB, 3.40 kB gz), asked f
expected: PERF-01: the lightbox is its own lazy chunk (GalleryLightbox 7.79 kB, 3.40 kB gz), asked for on the first press only; the Gallery route stays at 147.37 KB gz (limit 150)
result: pass
source: automated
coverage_id: 11-31-D8

### 228. 11-32 D1: A Manager adds a photo of older work from the Gallery tab (photo prepared in the browser, 
expected: A Manager adds a photo of older work from the Gallery tab (photo prepared in the browser, team, line, pieces, note, Show on the website ticked by default); it is the first row of the tab and the first tile on the public Gallery
result: pass
source: automated
coverage_id: 11-32-D1

### 229. 11-32 D2: The upload form checks every rule the server checks with its own words before a request is
expected: The upload form checks every rule the server checks with its own words before a request is sent (photo, team 80, line, pieces 1 to 9,999, note 120), and puts a server message under its field
result: pass
source: automated
coverage_id: 11-32-D2

### 230. 11-32 D3: The list shows every shown order and upload in gallery order with Source, Status and 'Line
expected: The list shows every shown order and upload in gallery order with Source, Status and 'Line hidden', paged by the server with a Product line filter, and all of it (line, page, size) lives in the URL with allow-list parsers
result: pass
source: automated
coverage_id: 11-32-D3

### 231. 11-32 D4: Moves across both kinds and across page edges, edit, replace photo, hide, show and delete 
expected: Moves across both kinds and across page edges, edit, replace photo, hide, show and delete for uploads, each with its toast, busy state and focus; a stale save keeps the typed values behind the ConflictBanner
result: pass
source: automated
coverage_id: 11-32-D4

### 232. 11-32 D5: Each change clears the public data held in this browser and reads the gallery pages and pr
expected: Each change clears the public data held in this browser and reads the gallery pages and product lines again
result: pass
source: automated
coverage_id: 11-32-D5

### 233. 11-33 D1: An Admin creates an order with the customer's OK and Show on the website: consent by the c
expected: An Admin creates an order with the customer's OK and Show on the website: consent by the caller, shown, auto line, gallery entry; after a photo is added the public gallery lists it
result: pass
source: automated
coverage_id: 11-33-D1

### 234. 11-33 D2: A create without the block, or with an empty block, has no consent, is not shown and write
expected: A create without the block, or with an empty block, has no consent, is not shown and writes no public audit entry
result: pass
source: automated
coverage_id: 11-33-D2

### 235. 11-33 D3: The rules and messages are the order window's: show needs the OK, a name over 80, no team 
expected: The rules and messages are the order window's: show needs the OK, a name over 80, no team and no name, an unknown line. A refusal saves no order and takes no number
result: pass
source: automated
coverage_id: 11-33-D3

### 236. 11-33 D4: D-11: consent who and when come only from the token and the clock, on a create and on a de
expected: D-11: consent who and when come only from the token and the clock, on a create and on a details update; client stamps inside the block are ignored
result: pass
source: automated
coverage_id: 11-33-D4

### 237. 11-33 D5: A details PUT with the block saves the details and the public settings together; without t
expected: A details PUT with the block saves the details and the public settings together; without the block nothing public changes; Completed keeps its lock answer; Cancelled with a block answers the Cancelled website message and saves nothing
result: pass
source: automated
coverage_id: 11-33-D5

### 238. 11-33 D6: AUDIT-01: the public audit codes are written when the block changes something, after order
expected: AUDIT-01: the public audit codes are written when the block changes something, after order.created or order.changed, with no customer data
result: pass
source: automated
coverage_id: 11-33-D6

### 239. 11-33 D7: Legacy import never sets consent or showing (D-11, T-11-84)
expected: Legacy import never sets consent or showing (D-11, T-11-84)
result: pass
source: automated
coverage_id: 11-33-D7

### 240. 11-34 D1: The Link preview picture card is card 6 of Business Info (after Email, before Time zone an
expected: The Link preview picture card is card 6 of Business Info (after Email, before Time zone and money), outside the form element: hint 'Shown when someone shares a page on Facebook or Messenger.', the 1.91:1 frame with 'No picture yet', Choose Picture (Take Picture on touch), the type and size hint and the note about Products and Gallery
result: pass
source: automated
coverage_id: 11-34-D1

### 241. 11-34 D2: Choosing a picture prepares it (prepareImage), sends POST under one Idempotency-Key, shows
expected: Choosing a picture prepares it (prepareImage), sends POST under one Idempotency-Key, shows Uploading then Saved and the toast 'Picture saved' / 'Shared links use it now.', shows the preview from the 320 and 640 addresses, reads the settings again and clears the public data in this browser; only the redrawn file is sent
result: pass
source: automated
coverage_id: 11-34-D2

### 242. 11-34 D3: PUB-04: after a save the next server HTML of / carries the new og:image (1200 x 630 share 
expected: PUB-04: after a save the next server HTML of / carries the new og:image (1200 x 630 share address of the new picture), fetched with no script
result: pass
source: automated
coverage_id: 11-34-D3

### 243. 11-34 D4: Saving the picture never resets or submits the typed Business Info fields: a typed tagline
expected: Saving the picture never resets or submits the typed Business Info fields: a typed tagline stays typed, the form stays dirty, Undo Changes stays enabled and no save is sent
result: pass
source: automated
coverage_id: 11-34-D4

### 244. 11-34 D5: 11-30 OI-1: after a picture change the next Save Business Info sends the new settings vers
expected: 11-30 OI-1: after a picture change the next Save Business Info sends the new settings version and is not refused as stale; a change made by someone else first still ends in the stale banner with the typed words kept
result: pass
source: automated
coverage_id: 11-34-D5

### 245. 11-34 D6: Replace Picture and Remove Picture: Remove asks 'Remove the link preview picture?' / 'Shar
expected: Replace Picture and Remove Picture: Remove asks 'Remove the link preview picture?' / 'Shared links show no picture until you add one.' with Cancel focused, sends DELETE, shows 'Picture removed' / 'Shared links show no picture.', brings the empty frame back and puts focus on Choose Picture; a failed removal stays in the question; a 404 counts as removed
result: pass
source: automated
coverage_id: 11-34-D6

### 246. 11-34 D7: A refused file shows the P9 pick-error box with the P9 words and sends nothing (not a usab
expected: A refused file shows the P9 pick-error box with the P9 words and sends nothing (not a usable picture, over 10 MB); a server refusal shows the server's line in the same box; while the picture saves its other actions are aria-disabled and keep focus
result: pass
source: automated
coverage_id: 11-34-D7

### 247. 11-34 D8: The preview is 320px wide from 640px and fills the card below it; no sideways scroll at 39
expected: The preview is 320px wide from 640px and fills the card below it; no sideways scroll at 390px; zero axe findings in every unit state (empty, with picture, uploading, refused, the question open)
result: pass
source: automated
coverage_id: 11-34-D8

### 248. 11-35 D1: The New Order form has a Public website card after Order details and before Images, with t
expected: The New Order form has a Public website card after Order details and before Images, with the hint and no preview; both boxes start unticked and Show is blocked until the OK is ticked (D-11)
result: pass
source: automated
coverage_id: 11-35-D1

### 249. 11-35 D2: Ticking the OK and Show on the New Order form saves them with the order: POST /orders carr
expected: Ticking the OK and Show on the New Order form saves them with the order: POST /orders carries publicWebsite {customerConsent true, showOnWebsite true, productLineId null, publicName null}; the order page reads Yes, recorded and Shown. A card nobody touched, or ticked and unticked again, sends no block
result: pass
source: automated
coverage_id: 11-35-D2

### 250. 11-35 D3: The Edit Order form has the card as its last card, filled from the order; unticking the OK
expected: The Edit Order form has the card as its last card, filled from the order; unticking the OK unticks Show; an untouched card sends no block with a details save; a changed card sends the whole block; an all-off block takes the OK back
result: pass
source: automated
coverage_id: 11-35-D3

### 251. 11-35 D4: OR-3: every public website rule is checked in the browser in the window's words (Show need
expected: OR-3: every public website rule is checked in the browser in the window's words (Show needs the OK, name at most 80 after trimming, a name when the form has no team, a line on an edit); the form's own team is the one typed
result: pass
source: automated
coverage_id: 11-35-D4

### 252. 11-35 D5: Server field errors under publicWebsite.* land on Show under and Name shown with focus the
expected: Server field errors under publicWebsite.* land on Show under and Name shown with focus there; an order cancelled while the edit form was open (422 orders.public-cancelled) shows the locked banner; Load Latest refills the card
result: pass
source: automated
coverage_id: 11-35-D5

### 253. 11-35 D6: ORD-15: a change in the card counts for the form's Discard changes? guard on both forms
expected: ORD-15: a change in the card counts for the form's Discard changes? guard on both forms
result: pass
source: automated
coverage_id: 11-35-D6

### 254. 11-35 D7: The card passes axe in each state on both forms, and at 320px it stacks with every part in
expected: The card passes axe in each state on both forms, and at 320px it stacks with every part inside the screen and no sideways scroll
result: pass
source: automated
coverage_id: 11-35-D7

### 255. 11-35 D8: After the Name shown edit on the Edit Order form, the public gallery lists the order under
expected: After the Name shown edit on the Edit Order form, the public gallery lists the order under the new name
result: pass
source: automated
coverage_id: 11-35-D8

### 256. 11-36 D1: The production and e2e builds write a quality 11 .br next to every .js, .css and .svg over
expected: The production and e2e builds write a quality 11 .br next to every .js, .css and .svg over 1 KB (node:zlib, no package); nothing for 1 KB or less, HTML, fonts or JSON; budget and parity builds skip it
result: pass
source: automated
coverage_id: 11-36-D1

### 257. 11-36 D2: The server sends the .br twin with Content-Encoding br, the original content type, Vary Ac
expected: The server sends the .br twin with Content-Encoding br, the original content type, Vary Accept-Encoding, the immutable cache header and its own entity tag only when br is accepted; HEAD, 304 and q=0 behave; a .br is never served by its own address; the shell and JSON are never served from a .br
result: pass
source: automated
coverage_id: 11-36-D2

### 258. 11-36 D3: A crawler that accepts only gzip and deflate never gets a .br body (gzip, deflate, identit
expected: A crawler that accepts only gzip and deflate never gets a .br body (gzip, deflate, identity, br;q=0, no header, wildcard)
result: pass
source: automated
coverage_id: 11-36-D3

### 259. 11-36 D5: npm run lighthouse scores /, /products, /gallery and /contact on one host, one report per 
expected: npm run lighthouse scores /, /products, /gallery and /contact on one host, one report per page, LCP printed per page and in one line; a pause and two retries per page; a failing exit with a finished report counts
result: pass
source: automated
coverage_id: 11-36-D5

### 260. 11-36 D6: LCP stays report-only after this phase: REPORT_ONLY_METRICS keeps largest-contentful-paint
expected: LCP stays report-only after this phase: REPORT_ONLY_METRICS keeps largest-contentful-paint, the 2000 ms target is unchanged, every other category and metric is still a hard failure
result: pass
source: automated
coverage_id: 11-36-D6

### 261. 11-38 D1: FND-04: the dev seed gains a SiteContent step that fills demo Business Info with two phone
expected: FND-04: the dev seed gains a SiteContent step that fills demo Business Info with two phones, a week of hours, one closure, prices on two lines, three shown testimonials and three shown demo orders with the customer's OK and gallery entries
result: pass
source: automated
coverage_id: 11-38-D1

### 262. 11-38 D2: A second run changes nothing; a Manager's own phone, testimonial, closure, hours and price
expected: A second run changes nothing; a Manager's own phone, testimonial, closure, hours and price are kept
result: pass
source: automated
coverage_id: 11-38-D2

### 263. 11-38 D3: The step has its own order, after the Orders step; the guard still refuses every database 
expected: The step has its own order, after the Orders step; the guard still refuses every database except CSPS_Dev and CSPS_E2E
result: pass
source: automated
coverage_id: 11-38-D3

## Summary

total: 263
passed: 256
issues: 4
pending: 0
skipped: 0
blocked: 3

## Gaps

- gap_id: G-11-4
  truth: "After a Manager replaces a product line photo in Site Content > Products and saves, the public Products page shows the new photo"
  status: failed
  reason: "User reported: image is not showing after replacing the default (Custom Design line: the main, Back view and Fabric detail slots still show the empty dotted placeholders)"
  severity: major
  test: 4
  root_cause: "Account setup, not code: the Cloudinary account behind the Development host has only the 13 Phase 9 named sizes. The 21 sizes Phase 11 added (csps_cat_*, csps_strip_*, csps_w_*, csps_sq_200/400/720, csps_share_*) were never created, because the one-time setup command (D-44) has not been run. Cloudinary answers 400 Unknown transformation for every address that uses one, and LazyImage shows the empty placeholder. Stored files load at the old sizes (200)."
  artifacts:
    - path: "src/Csps.Infrastructure/Images/ImageNamedSizes.cs"
      issue: "All lists 34 sizes; the account has only the first 13"
    - path: "tools/Csps.CloudinarySetup"
      issue: "not yet run for the 21 Phase 11 sizes (docs/operations/cloudinary-setup.md says after deploy, but dev UAT needs it first)"
    - path: "web/src/components/states/LazyImage.tsx"
      issue: "a load error silently becomes the placeholder, so a missing size looks like saved but not shown"
  missing:
    - "Owner runs dotnet run --project tools/Csps.CloudinarySetup -- --check, then without --check, on the account the dev host uses (expect 13 exist, 21 missing, then 34 exist)"
    - "Re-run UAT tests 4, 6 (with its off, delete and restore steps) and 7"
  debug_session: .planning/debug/phase11-photos-saved-but-not-shown.md
- gap_id: G-11-6
  truth: "An order shown on the website appears in the public Gallery with its cover photo"
  status: failed
  reason: "User reported: theres no cover photo, is this inteded? the order has photos (the test order shows the empty dotted placeholder)"
  severity: major
  test: 6
  root_cause: "Account setup, not code: the Cloudinary account behind the Development host has only the 13 Phase 9 named sizes. The 21 sizes Phase 11 added (csps_cat_*, csps_strip_*, csps_w_*, csps_sq_200/400/720, csps_share_*) were never created, because the one-time setup command (D-44) has not been run. Cloudinary answers 400 Unknown transformation for every address that uses one, and LazyImage shows the empty placeholder. Stored files load at the old sizes (200)."
  artifacts:
    - path: "src/Csps.Infrastructure/Images/ImageNamedSizes.cs"
      issue: "All lists 34 sizes; the account has only the first 13"
    - path: "tools/Csps.CloudinarySetup"
      issue: "not yet run for the 21 Phase 11 sizes (docs/operations/cloudinary-setup.md says after deploy, but dev UAT needs it first)"
    - path: "web/src/components/states/LazyImage.tsx"
      issue: "a load error silently becomes the placeholder, so a missing size looks like saved but not shown"
  missing:
    - "Owner runs dotnet run --project tools/Csps.CloudinarySetup -- --check, then without --check, on the account the dev host uses (expect 13 exist, 21 missing, then 34 exist)"
    - "Re-run UAT tests 4, 6 (with its off, delete and restore steps) and 7"
  debug_session: .planning/debug/phase11-photos-saved-but-not-shown.md
- gap_id: G-11-7
  truth: "A gallery photo and the link preview picture upload and show, in Site Content and on the public pages"
  status: failed
  reason: "User reported: the picture uploads but doesnt show either (Link preview picture card says Saved but shows the empty placeholder; gallery item TEST THIS shows the empty placeholder on /gallery)"
  severity: major
  test: 7
  root_cause: "Account setup, not code: the Cloudinary account behind the Development host has only the 13 Phase 9 named sizes. The 21 sizes Phase 11 added (csps_cat_*, csps_strip_*, csps_w_*, csps_sq_200/400/720, csps_share_*) were never created, because the one-time setup command (D-44) has not been run. Cloudinary answers 400 Unknown transformation for every address that uses one, and LazyImage shows the empty placeholder. Stored files load at the old sizes (200)."
  artifacts:
    - path: "src/Csps.Infrastructure/Images/ImageNamedSizes.cs"
      issue: "All lists 34 sizes; the account has only the first 13"
    - path: "tools/Csps.CloudinarySetup"
      issue: "not yet run for the 21 Phase 11 sizes (docs/operations/cloudinary-setup.md says after deploy, but dev UAT needs it first)"
    - path: "web/src/components/states/LazyImage.tsx"
      issue: "a load error silently becomes the placeholder, so a missing size looks like saved but not shown"
  missing:
    - "Owner runs dotnet run --project tools/Csps.CloudinarySetup -- --check, then without --check, on the account the dev host uses (expect 13 exist, 21 missing, then 34 exist)"
    - "Re-run UAT tests 4, 6 (with its off, delete and restore steps) and 7"
  debug_session: .planning/debug/phase11-photos-saved-but-not-shown.md
- gap_id: G-11-19
  truth: "Every upload is redrawn in the browser before it is sent, so a photo's location and other metadata never leave the phone; only a HEIC the browser cannot open goes as it is (D-P11-BL-65)"
  status: failed
  reason: "User reported: F1 A, F2 B (review F1: prepareImage sends the original file when no shrink is needed or a HEIC cannot be decoded; the server strip keeps stored photos clean)"
  severity: minor
  test: 19
  root_cause: "prepareImage redraws a photo only when it must be shrunk; a photo already 2000 px or smaller, or a HEIC the browser cannot decode, is sent as the original file with its metadata. The server strip keeps stored photos clean."
  artifacts:
    - path: "web/src/utils/images.ts"
      issue: "lines 196-207 (undecodable HEIC, allowed by D-P11-BL-65) and 221-232 (no shrink needed: original file returned, to change)"
  missing:
    - "Redraw every decodable photo before upload, even when no shrink is needed (D-P11-BL-65); keep the undecodable-HEIC pass-through and the server strip"
    - "Test first: a decodable photo within size comes back as a new redrawn file, not the picked File"
  debug_session: "independent review of the 43 prohibitions, UAT test 19 (finding F1, checked against the code)"
