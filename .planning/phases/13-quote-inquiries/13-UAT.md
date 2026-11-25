---
status: diagnosed
phase: 13-quote-inquiries
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md, 13-05-SUMMARY.md, 13-06-SUMMARY.md, 13-07-SUMMARY.md, 13-08-SUMMARY.md, 13-09-SUMMARY.md, 13-10-SUMMARY.md, 13-11-SUMMARY.md, 13-12-SUMMARY.md, 13-13-SUMMARY.md, 13-14-SUMMARY.md, 13-15-SUMMARY.md, 13-16-SUMMARY.md, 13-17-SUMMARY.md, 13-18-SUMMARY.md, 13-19-SUMMARY.md, 13-20-SUMMARY.md, 13-21-SUMMARY.md, 13-22-SUMMARY.md, 13-23-SUMMARY.md, 13-24-SUMMARY.md, 13-25-SUMMARY.md, 13-26-SUMMARY.md]
started: 2026-11-25T00:08:22-06:00
created: 2026-11-25T00:08:22-06:00
updated: 2026-11-25T00:46:38-06:00
---

# Phase 13 UAT: Quote Inquiries
*Created: 2026-11-25T00:08:22-06:00 · Updated: 2026-11-25T00:46:38-06:00*

All 26 plans are built. Tests 1 to 23 are hands-on checks for the owner: user flow first (1 to 11), then look, wording and screen reader (12 to 16), then rulings and reviews (17 to 21), then live-site steps (22 and 23).
Tests 24 to 98 are passed by automated tests (coverage blocks); they are not asked.
The roadmap marks this phase mvp, but the goal is not a user story; as in Phases 1 to 12.1 no story was invented and the success criteria are the flow.
Three SUMMARY coverage blocks are malformed (13-13 D5 has a bad verification kind; 13-14 D1 to D3 and 13-19 D1 to D3 lack the human_judgment flag). Their entries are asked here as hands-on checks, never dropped. Plans 13-03, 13-11 and 13-12 have no coverage block; their user-visible parts are in tests 5, 7 and 3.

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running API and web server. Run the preflight (`C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`), apply the Phase 13 migrations to CSPS_Dev (AddQuoteRequests, AddQuoteRequestPhotos, AddQuoteRequestsLock, AddQuoteAlertsEmail, AddQuoteRequestStatusChanges, AddQuoteRequestNotes, AddQuoteRequestOrderLink), then start the API (5115) and the web app (5180) from scratch. The API starts with no errors or warnings, /health answers, and the Contact page loads with the quote form.
covers: cold start, migrations
result: pass

### 2. Send a quote request from the Contact page
expected: On Contact, fill in name, team, a PH mobile number, email, product, quantity range and a message, then press Send Inquiry. A bad mobile number, a missing name or a message over 2,000 characters is shown inline before anything is sent. The privacy notice under the form links to the Privacy Policy. After sending, "Inquiry sent" shows with Send Another, and the request appears in the staff inbox.
covers: INQ-01, INQ-08 notice, 13-01, 13-08, 13-09
result: pass

### 3. Add reference photos to a quote request
expected: Press Choose Photos and pick photos. A wrong file type, a photo over 10 MB or a sixth photo is refused with a message before sending. Each photo shows a preview (an HEIC photo in a desktop browser shows the no-preview icon). Remove takes a photo out and keeps keyboard focus in the picker. On a real phone the camera and gallery choices both work. Send with photos: "Sending your photos" shows, and the photos appear on the staff request page.
covers: INQ-02, 13-02 D4, 13-05, 13-12
result: pass

### 4. Get a Quote from Products and Gallery
expected: On Products, press Get a Quote on a line: Contact opens with that line chosen. Do the same from a Gallery photo's quote link. A made-up or hidden line in the address is ignored with no message and no change to the address. Your own later choice and Send Another are kept.
covers: 13-14 D1, D2, D3
result: pass

### 5. Bot guards and the send limit
expected: No CAPTCHA or puzzle appears anywhere. Send six requests quickly from one connection: the sixth shows the amber "too many" box with the Messenger button, every typed value and photo stays, and focus stays on Send Inquiry. A dropped connection during sending says it is not sure the inquiry went and offers to try again without losing anything.
covers: INQ-03, 13-06, 13-12 failures
result: pass

### 6. Staff alert email for a new request
expected: As a Manager, in Site Content > Business info, set the Quote alerts address in the Quote alerts card and press Send Test Email: a success toast shows and "Test: quote alerts work" arrives. Then send a quote request from Contact: a staff alert arrives at that address with the visitor's name in the subject, a short excerpt of the message and a link to the request, and no attachment. An Admin can see the address but cannot change it.
covers: INQ-04, 13-07, 13-10, 13-13 D5
result: pass

### 7. Work the Quote Requests inbox
expected: Signed in as staff, the Quote Requests nav item shows the New count (rail dot when collapsed, Quotes tab on a phone, strip on the dashboard). The inbox opens on Open, newest first. The Converted, Closed, Spam and All pills filter the list, and search finds a request by name, team or phone digits. On a phone the list shows as cards. The pill and search stay in the address, so Back and Forward return to the same view.
covers: INQ-05, 13-11, 13-15, 13-17
result: pass

### 8. Open a request and change its status
expected: Press a name in the inbox: the request page shows name, received time, status badge, the Request card with working tel: and mailto: links, the photos with Open Full Size, and the history newest first. Change Status moves it to any status except Converted, shows a toast, and returns focus to the button. Spam on a request with photos asks first. If someone else changed it first, a conflict banner shows with Load Latest.
covers: INQ-05, 13-16, 13-19 D1, D2, D3
result: pass

### 9. Notes and deleting a request
expected: Add a note on a request in any status: it shows at once and cannot be edited or removed. As a Manager, Delete Request (not on a Converted request) asks first with Cancel focused, then returns you to the inbox. An Admin does not see Delete Request. Deleting a request someone else just turned into an order shows the reason, and after Cancel the page shows Converted.
covers: INQ-05, 13-18, 13-21
result: pass

### 10. Turn a request into an order
expected: On a request, press Turn into Order: the New Order form opens prefilled with the customer, team, contact details and product, and the message in Notes. Save it: the request shows Converted with a link to the order, and the order links back to the request. Back after saving skips the filled form. A second Turn into Order on the same request is refused and names the existing order number.
covers: INQ-06, 13-20, 13-22
result: pass

### 11. Removed requests take their photos with them
expected: Mark a request that has photos as Spam (or delete it as a Manager), then run the maintenance job (Run now, or the daily run). The photos are gone from Cloudinary under `quotes/`, and the maintenance report shows no failing removals. Permanently deleting an order made from a request also removes that request and its photos. Note: the whole-phase code review (13-REVIEW.md G2A-CR-01) found the removal job only accepts `orders/`, so this is expected to fail until that fix lands.
covers: INQ-05, INQ-06 D-22, INQ-07, D-04
result: issue
note: Orchestrator check of CSPS_Dev: the photo queued by the Test 9 Manager delete sat in ImageDeletions with 0 attempts and no maintenance run had happened yet. Root cause already confirmed in code review 13-REVIEW.md G2A-CR-01: ImageRemovalJob.cs:91 accepts only {root}/orders/ and fails quotes/ and content/ rows as outside-folder.
severity: major
reported: "image are still in cloudinary after marking request spam"

### 12. The Contact form on a real phone
expected: On a real phone, the Contact page shows the form first, then Messenger, Call, hours, phones and the map. Spacing looks right, the message box grows as you type, and the placeholder swap reads well. Pick a photo and press Send at once: the photo arrives, and Send shows Sending until it does. You accept the form wording.
covers: 13-09 D8, 13-REVIEW-FIX-W5 CR-01
result: pass

### 13. Look in Blush and Espresso
expected: At 320, 768 and 1440 px, in both Blush and Espresso: the Contact form, the Quote Requests inbox (pills, table, phone cards), a request page, the Quote alerts card, the count chip, the rail dot, the Quotes tab and the dashboard strip all look right. The selected pill and the warning text are easy to read, and nothing scrolls sideways.
covers: 13-07 D5, 13-15 D4, 13-17 D5, UI review fix 4
result: pass

### 14. The staff emails in a real mail client
expected: The quote alert and the test email read well and look right in your real mail client, on a phone and on a desktop. You accept their wording.
covers: 13-10 D5, 13-13 D6
result: pass

### 15. Component Showcase: Quote requests
expected: Open the Component Showcase, section Quote requests, in Blush and Espresso. The pills, the status badges, the nav count (0, 1, 99+, collapsed), the strip (0, 3, loading, failed) and the eight quote form states (empty, every field error, photos with one refused, sending, sent, sent with missing photos, rate limited, send failed) each look right, and nothing is sent.
covers: 13-23 D1, D2
result: pass

### 16. Screen reader pass
expected: With a screen reader: on the quote form, a refused photo and a failed send are each read once, not twice. On a request page, Change Status, the Spam confirm, Load Latest after a clash, and the not-found page after a move on a deleted request read clearly. After adding a note, and after a Manager delete, focus lands where you expect and is announced well.
covers: 13-21 D3, 13-19, UI review fix 6
result: pass

### 17. Privacy Policy 1.1 and the form notice
expected: Read the Privacy Policy 1.1 draft and the quote form notice (review package in 13-25-SUMMARY.md). Answer A (approve with one added sentence about the rare stray photo, recommended), B (approve as written), or give exact changes. Only after your answer is the page flipped to approved.
covers: INQ-08, 13-04 D2, 13-25 D1, D-28, P13-BL-27
result: pass
note: Owner chose A (ruling D-45). Code work left: add the stray-photo sentence, flip the page to approved, update the five DRAFT-pinning tests.

### 18. Lighthouse performance ruling
expected: The public pages score 0.92 to 0.94 for performance against the 0.95 target (LCP 2.5 to 3.0 s). All bundle budgets pass. Rule: accept it as report-only under D-29, or ask for a speed task.
covers: 13-24 D4, P13-BL-30
result: pass
note: Owner accepted the score as report-only under D-29 (ruling D-46).

### 19. Owner choices P13-BL-01 to P13-BL-34
expected: Each item in the phase 999.9 DECISIONS.md is confirmed as built or changed, including the two accepted security risks (P13-BL-32), the empty-pill messages (P13-BL-33) and the pill gap (P13-BL-34). Every one was built as the recommended option and none blocks the phase goal.
covers: P13-BL-01 to P13-BL-34, 13-22 D6
result: pass
note: Owner accepted all remaining items as built (ruling D-47).

### 20. Quote photos are kept as sent, with no creator and no audit row
expected: You accept that a visitor's photos are stored as sent (metadata stripped, pixels unchanged), with no creator and no audit entry, as ruled in D-05 and SEC-08.
covers: 13-05 D6
result: pass

### 21. Code review outcomes
expected: Each finding in 13-REVIEW.md (1 critical, 19 warnings, 41 info) gets a recorded outcome: fixed, deferred with a reason, or accepted by you. The critical G2A-CR-01 (photo removals) is fixed before the phase ships. You give the wording for G6-WR-02 (the test email error text for a 422 or 409).
covers: 13-REVIEW.md
result: blocked
reason: "ok" (owner accepted the G6-WR-02 wording, ruling D-48, and blocking this test until /gsd-code-review 13 --fix records an outcome for every finding and fixes G2A-CR-01)
blocked_by: prior-phase

### 22. Live site: Quote alerts test email
expected: After the Phase 13 deploy, sign in as a Manager on the live site, set the Quote alerts address, press Send Test Email, and check "Test: quote alerts work" arrives (look in spam too) within a few minutes. Full steps are in 13-26-SUMMARY.md.
covers: INQ-04, 13-26 D1
result: blocked
reason: "blocked" (Phase 13 is not merged or deployed to the live site yet)
blocked_by: release-build

### 23. Live site: first Gallery photo on a phone
expected: After the deploy, add one public Gallery photo. On a phone the photo shows, loads from res.cloudinary.com, and the browser shows no CSP error.
covers: 13-26 D2, Phase 12 D-49, Phase 11 D-133
result: blocked
reason: "blocked" (waits on the Phase 13 deploy, together with test 22)
blocked_by: release-build

### 24. 13-01 D1: An anonymous POST with a name and a mobile number saves one QuoteRequest at status New and answers 200 with its id
expected: An anonymous POST with a name and a mobile number saves one QuoteRequest at status New and answers 200 with its id
result: pass
source: automated
coverage_id: 13-01 D1

### 25. 13-01 D2: The saved request has no creator, takes its time from the clock, and ignores forged stamp, status and order members (SEC-08, CWE-915)
expected: The saved request has no creator, takes its time from the clock, and ignores forged stamp, status and order members (SEC-08, CWE-915)
result: pass
source: automated
coverage_id: 13-01 D2

### 26. 13-01 D3: A replay with the same Idempotency-Key returns the stored answer with one row; two creates at once are two requests
expected: A replay with the same Idempotency-Key returns the stored answer with one row; two creates at once are two requests
result: pass
source: automated
coverage_id: 13-01 D3

### 27. 13-01 D4: Every field rule answers its UI-SPEC message word for word, with limits counted in UTF-16 units after trimming, and the number stored as E.164
expected: Every field rule answers its UI-SPEC message word for word, with limits counted in UTF-16 units after trimming, and the number stored as E.164
result: pass
source: automated
coverage_id: 13-01 D4

### 28. 13-01 D5: A shown product line is saved with its id and title snapshot; an unknown or hidden line is a 400 on productLineKey; custom and not-sure save no line
expected: A shown product line is saved with its id and title snapshot; an unknown or hidden line is a 400 on productLineKey; custom and not-sure save no line
result: pass
source: automated
coverage_id: 13-01 D5

### 29. 13-01 D6: The QuoteRequests table, its migration, the matrix row, the OpenAPI snapshot and the web types are in place and agree
expected: The QuoteRequests table, its migration, the matrix row, the OpenAPI snapshot and the web types are in place and agree
result: pass
source: automated
coverage_id: 13-01 D6

### 30. 13-02 D1: A visitor picks photos and sees a 64px data: preview row per photo with the cleaned name, size, Remove button and the count line; the File handed on is the one picked
expected: A visitor picks photos and sees a 64px data: preview row per photo with the cleaned name, size, Remove button and the count line; the File handed on is the one picked
result: pass
source: automated
coverage_id: 13-02 D1

### 31. 13-02 D2: Wrong type (read from first bytes), over 10 MB, over 5 photos and unreadable files are refused in the browser with the server's words; accepted files of the same pick are kept; the box clears on the next pick and on submit
expected: Wrong type (read from first bytes), over 10 MB, over 5 photos and unreadable files are refused in the browser with the server's words; accepted files of the same pick are kept; the box clears on the next pick and on submit
result: pass
source: automated
coverage_id: 13-02 D2

### 32. 13-02 D3: Keyboard order, focus after Remove, limit Note and zero axe violations in jsdom
expected: Keyboard order, focus after Remove, limit Note and zero axe violations in jsdom
result: pass
source: automated
coverage_id: 13-02 D3

### 33. 13-04 D1: Privacy facts are version 1.1, 2026-11-22, approved false in the fixture, Domain LegalPages and web legalPages.ts, and the Privacy page shows the DRAFT notice
expected: Privacy facts are version 1.1, 2026-11-22, approved false in the fixture, Domain LegalPages and web legalPages.ts, and the Privacy page shows the DRAFT notice
result: pass
source: automated
coverage_id: 13-04 D1

### 34. 13-05 D1: A declared photo is posted to its slot with the upload key, checked by its bytes, stripped of metadata and stored privately under {root}/quotes/{id}/; the slot row keeps its public id, size and format
expected: A declared photo is posted to its slot with the upload key, checked by its bytes, stripped of metadata and stored privately under {root}/quotes/{id}/; the slot row keeps its public id, size and format
result: pass
source: automated
coverage_id: 13-05 D1

### 35. 13-05 D2: A wrong key, no key, a bad key, a wrong id, an expired key (exact end time), a filled slot, an undeclared slot, slot 5, slot -1 and a Spam request all answer the same 404 and store nothing; the create answer never holds the key
expected: A wrong key, no key, a bad key, a wrong id, an expired key (exact end time), a filled slot, an undeclared slot, slot 5, slot -1 and a Spam request all answer the same 404 and store nothing; the create answer never holds the key
result: pass
source: automated
coverage_id: 13-05 D2

### 36. 13-05 D3: Limits hold at their edges: 5 names are taken and a sixth is a 400; 10,485,760 bytes are stored and one more is a 413; 30 MP and non-photo files are 422 with the UI-SPEC words
expected: Limits hold at their edges: 5 names are taken and a sixth is a 400; 10,485,760 bytes are stored and one more is a 413; 30 MP and non-photo files are 422 with the UI-SPEC words
result: pass
source: automated
coverage_id: 13-05 D3

### 37. 13-05 D4: Two photos for different slots at once are both stored; two for one slot give one 200 and one 404 and the loser's file is queued as UploadUndone
expected: Two photos for different slots at once are both stored; two for one slot give one 200 and one 404 and the loser's file is queued as UploadUndone
result: pass
source: automated
coverage_id: 13-05 D4

### 38. 13-05 D5: With storage failing, the request stays saved, the slot stays empty and the next photo works; a timeout queues the file for removal; unset storage answers 503 after the text was saved (D-03)
expected: With storage failing, the request stays saved, the slot stays empty and the next photo works; a timeout queues the file for removal; unset storage answers 503 after the text was saved (D-03)
result: pass
source: automated
coverage_id: 13-05 D5

### 39. 13-05 D7: The table, migration, matrix row, rate limit list, upload slot coverage, OpenAPI snapshot, web types and the API note agree
expected: The table, migration, matrix row, rate limit list, upload slot coverage, OpenAPI snapshot, web types and the API note agree
result: pass
source: automated
coverage_id: 13-05 D7

### 40. 13-06 D1: A visitor with a fresh ticket is saved; the ticket answer carries the photo rules and is never cached
expected: A visitor with a fresh ticket is saved; the ticket answer carries the photo rules and is never cached
result: pass
source: automated
coverage_id: 13-06 D1

### 41. 13-06 D2: A filled honeypot or a ticket one tick under the minimum time gets a normal success shape, saves nothing and logs one reason code only; exactly 3 seconds is saved
expected: A filled honeypot or a ticket one tick under the minimum time gets a normal success shape, saves nothing and logs one reason code only; exactly 3 seconds is saved
result: pass
source: automated
coverage_id: 13-06 D2

### 42. 13-06 D3: An expired, changed, nonsense or missing ticket is a 400 quote-requests.ticket-expired and saves nothing (never a silent success)
expected: An expired, changed, nonsense or missing ticket is a 400 quote-requests.ticket-expired and saves nothing (never a silent success)
result: pass
source: automated
coverage_id: 13-06 D3

### 43. 13-06 D4: The sixth create from one address in an hour is a 429 with a whole-second Retry-After; the site-wide ceiling stops many addresses and says the site is busy; a per-address refusal does not use the ceiling
expected: The sixth create from one address in an hour is a 429 with a whole-second Retry-After; the site-wide ceiling stops many addresses and says the site is busy; a per-address refusal does not use the ceiling
result: pass
source: automated
coverage_id: 13-06 D4

### 44. 13-06 D5: Every number is a setting checked at start, naming the setting and never the value; the ticket, photo and page view routes keep their own limits
expected: Every number is a setting checked at start, naming the setting and never the value; the ticket, photo and page view routes keep their own limits
result: pass
source: automated
coverage_id: 13-06 D5

### 45. 13-06 D6: The fourth request in 24 hours from one phone (any written form) or one email (any case) is a 429 and is not saved; the window slides at exactly 24 hours; requests of one sender are separate rows until the limit
expected: The fourth request in 24 hours from one phone (any written form) or one email (any case) is a 429 and is not saved; the window slides at exactly 24 hours; requests of one sender are separate rows until the limit
result: pass
source: automated
coverage_id: 13-06 D6

### 46. 13-06 D7: Two sends at once from one sender never make a fourth row (count and insert under the quote-requests lock); caught bots and replays are not counted
expected: Two sends at once from one sender never make a fourth row (count and insert under the quote-requests lock); caught bots and replays are not counted
result: pass
source: automated
coverage_id: 13-06 D7

### 47. 13-07 D1: A Manager types the Quote alerts email, presses Save Business Info and sees it after reload (same settings version)
expected: A Manager types the Quote alerts email, presses Save Business Info and sees it after reload (same settings version)
result: pass
source: automated
coverage_id: 13-07 D1

### 48. 13-07 D2: The address is checked on both sides with the same messages, optional, 254 characters at most, the shop email allowed
expected: The address is checked on both sides with the same messages, optional, 254 characters at most, the shop email allowed
result: pass
source: automated
coverage_id: 13-07 D2

### 49. 13-07 D3: An empty or missing address clears the saved one; the web form always sends the field
expected: An empty or missing address clears the saved one; the web form always sends the field
result: pass
source: automated
coverage_id: 13-07 D3

### 50. 13-07 D4: The address is never in a public answer or page, and its change is audited by name only
expected: The address is never in a public answer or page, and its change is audited by name only
result: pass
source: automated
coverage_id: 13-07 D4

### 51. 13-08 D1: QuoteRequestRetention.PurgeBefore gives the start of the Manila business day 6 calendar months back, with month ends clamped
expected: QuoteRequestRetention.PurgeBefore gives the start of the Manila business day 6 calendar months back, with month ends clamped
result: pass
source: automated
coverage_id: 13-08 D1

### 52. 13-08 D2: The daily run removes unconverted requests received before the cut, queueing each stored photo as QuotePurged; converted requests and requests at the cut stay
expected: The daily run removes unconverted requests received before the cut, queueing each stored photo as QuotePurged; converted requests and requests at the cut stay
result: pass
source: automated
coverage_id: 13-08 D2

### 53. 13-08 D3: The stray sweep covers {root}/quotes/ with its own cursor and the inventory knows stored quote photos
expected: The stray sweep covers {root}/quotes/ with its own cursor and the inventory knows stored quote photos
result: pass
source: automated
coverage_id: 13-08 D3

### 54. 13-09 D1: INQ-01: on /contact a visitor fills Your name and Contact number, presses Send Inquiry and sees Inquiry sent (focus on the title, toast, Send Another); the request goes to the real API
expected: INQ-01: on /contact a visitor fills Your name and Contact number, presses Send Inquiry and sees Inquiry sent (focus on the title, toast, Send Another); the request goes to the real API
result: pass
source: automated
coverage_id: 13-09 D1

### 55. 13-09 D2: OR-3: quoteSchemas mirrors every server rule with the same words, at the same edges (100, 30 typed and mobile only, 254, 2,000 UTF-16 units), zod in jitless mode
expected: OR-3: quoteSchemas mirrors every server rule with the same words, at the same edges (100, 30 typed and mobile only, 254, 2,000 UTF-16 units), zod in jitless mode
result: pass
source: automated
coverage_id: 13-09 D2

### 56. 13-09 D3: D-24: Product type offers the visible lines in Products page order after two fixed choices that show at once; Quantity offers the five ranges; a failed read keeps the two fixed choices with no message
expected: D-24: Product type offers the visible lines in Products page order after two fixed choices that show at once; Quantity offers the five ranges; a failed read keeps the two fixed choices with no message
result: pass
source: automated
coverage_id: 13-09 D3

### 57. 13-09 D4: INQ-08, D-27, INQ-03: the accurate privacy notice comes before Send Inquiry with Privacy Policy linking to /privacy in the same tab; the honeypot is out of the Tab order in an aria-hidden hidden wrapper, and a filled honeypot still shows success; zero axe violations
expected: INQ-08, D-27, INQ-03: the accurate privacy notice comes before Send Inquiry with Privacy Policy linking to /privacy in the same tab; the honeypot is out of the Tab order in an aria-hidden hidden wrapper, and a filled honeypot still shows success; zero axe violations
result: pass
source: automated
coverage_id: 13-09 D4

### 58. 13-09 D5: Contact layout: form first and left, aside with the Messenger and Call buttons, hours, phones and map, no What to send card; only the aside shows a settings failure and the form still sends; the header Get a Quote on /contact scrolls to the form and focuses Your name; 320px has one column and no sideways scroll
expected: Contact layout: form first and left, aside with the Messenger and Call buttons, hours, phones and map, no What to send card; only the aside shows a settings failure and the form still sends; the header Get a Quote on /contact scrolls to the form and focuses Your name; 320px has one column and no sideways scroll
result: pass
source: automated
coverage_id: 13-09 D5

### 59. 13-09 D6: The /contact meta description reads Ask for a quote, message us on Messenger or call the shop. See our hours, address and map. in the server head and the client copy
expected: The /contact meta description reads Ask for a quote, message us on Messenger or call the shop. See our hours, address and map. in the server head and the client copy
result: pass
source: automated
coverage_id: 13-09 D6

### 60. 13-09 D7: D-35: the form is its own lazy piece with its own 45 KB row; the Contact route stays at or under 150 KB and no limit was raised
expected: D-35: the form is its own lazy piece with its own 45 KB row; the Contact route stays at or under 150 KB and no limit was raised
result: pass
source: automated
coverage_id: 13-09 D7

### 61. 13-10 D1: A saved request queues one QuoteAlert to the Quote alerts address in the same transaction; the sink gets one email with the name and the admin link; nothing is queued without an address, for a caught bot, a refused sender or a rolled-back request; the visitor is never mailed
expected: A saved request queues one QuoteAlert to the Quote alerts address in the same transaction; the sink gets one email with the name and the admin link; nothing is queued without an address, for a caught bot, a refused sender or a rolled-back request; the visitor is never mailed
result: pass
source: automated
coverage_id: 13-10 D1

### 62. 13-10 D2: The alert has the summary lines in order, leaves empty lines out, encodes visitor text, keeps message line breaks, carries no attachment and only the site's own admin link, and has the Quote alerts footer
expected: The alert has the summary lines in order, leaves empty lines out, encodes visitor text, keeps message line breaks, carries no attachment and only the site's own admin link, and has the Quote alerts footer
result: pass
source: automated
coverage_id: 13-10 D2

### 63. 13-10 D3: The subject cuts the name at 60 characters with an ellipsis and no visitor text can add a header or a line (review W1 IN-04); the message is cut at 300
expected: The subject cuts the name at 60 characters with an ellipsis and no visitor text can add a header or a line (review W1 IN-04); the message is cut at 300
result: pass
source: automated
coverage_id: 13-10 D3

### 64. 13-10 D4: At most 20 alerts and one overflow email per business hour, a new hour starts again, parallel sends never pass the limit, every request is saved, and the limit is a validated setting
expected: At most 20 alerts and one overflow email per business hour, a new hour starts again, parallel sends never pass the limit, every request is saved, and the limit is a validated setting
result: pass
source: automated
coverage_id: 13-10 D4

### 65. 13-13 D1: A Manager's test is queued to the saved address as one QuoteAlertTest row, the sink gets 'Test: quote alerts work', and one quote-alerts.test-sent entry is written with no address in the audit detail or the log
expected: A Manager's test is queued to the saved address as one QuoteAlertTest row, the sink gets 'Test: quote alerts work', and one quote-alerts.test-sent entry is written with no address in the audit detail or the log
result: pass
source: automated
coverage_id: 13-13 D1

### 66. 13-13 D2: Anonymous 401, Admin 403, Manager 409 in the matrix; 409 with no saved address and 422 for an undeliverable one queue nothing
expected: Anonymous 401, Admin 403, Manager 409 in the matrix; 409 with no saved address and 422 for an undeliverable one queue nothing
result: pass
source: automated
coverage_id: 13-13 D2

### 67. 13-13 D3: The fourth test from one address within 10 minutes is 429 with a whole-second Retry-After; the limit is a validated setting with 3 in 10 minutes by default
expected: The fourth test from one address within 10 minutes is 429 with a whole-second Retry-After; the limit is a validated setting with 3 in 10 minutes by default
result: pass
source: automated
coverage_id: 13-13 D3

### 68. 13-13 D4: The renderer gives the UI-SPEC E1 Test subject and body with the Quote alerts footer and no link
expected: The renderer gives the UI-SPEC E1 Test subject and body with the Quote alerts footer and no link
result: pass
source: automated
coverage_id: 13-13 D4

### 69. 13-15 D1: Staff of both roles open /admin/quote-requests and see the open requests newest first with the seven columns
expected: Staff of both roles open /admin/quote-requests and see the open requests newest first with the seven columns
result: pass
source: automated
coverage_id: 13-15 D1

### 70. 13-15 D2: Status pills and search filter the inbox; status, q and page live in the URL; Back restores them
expected: Status pills and search filter the inbox; status, q and page live in the URL; Back restores them
result: pass
source: automated
coverage_id: 13-15 D2

### 71. 13-15 D3: Empty, loading, error, stale, Photos and refresh states; 320px cards with no sideways scroll and zero axe violations
expected: Empty, loading, error, stale, Photos and refresh states; 320px cards with no sideways scroll and zero axe violations
result: pass
source: automated
coverage_id: 13-15 D3

### 72. 13-16 D1: GET one request answers every field, private photo addresses (thumb, viewer, 2000 px full size), missing names, photosRemovedAtUtc, history with the arrival, last changer and version; unknown id 404; anonymous 401
expected: GET one request answers every field, private photo addresses (thumb, viewer, 2000 px full size), missing names, photosRemovedAtUtc, history with the arrival, last changer and version; unknown id 404; anonymous 401
result: pass
source: automated
coverage_id: 13-16 D1

### 73. 13-16 D2: Free moves among the five hand-set statuses with history and audit; Converted refused as a target and locked as a source; same status refused; stale version 409; forged stamps ignored; New count drops
expected: Free moves among the five hand-set statuses with history and audit; Converted refused as a target and locked as a source; same status refused; stale version 409; forged stamps ignored; New count drops
result: pass
source: automated
coverage_id: 13-16 D2

### 74. 13-16 D3: Spam queues each stored photo as QuoteSpam, removes the places and sets the removal time in the same save; leaving Spam restores nothing; a forced failure before the save changes nothing; inbox shows the removed mark
expected: Spam queues each stored photo as QuoteSpam, removes the places and sets the removal time in the same save; leaving Spam restores nothing; a forced failure before the save changes nothing; inbox shows the removed mark
result: pass
source: automated
coverage_id: 13-16 D3

### 75. 13-16 D4: A purged request's history rows go with it
expected: A purged request's history rows go with it
result: pass
source: automated
coverage_id: 13-16 D4

### 76. 13-17 D1: Quote Requests sits right after Orders in the sidebar and the phone drawer for both roles, with the inbox icon; the inbox and every request page mark it current
expected: Quote Requests sits right after Orders in the sidebar and the phone drawer for both roles, with the inbox icon; the inbox and every request page mark it current
result: pass
source: automated
coverage_id: 13-17 D1

### 77. 13-17 D2: Above 0 the chip shows the server's New count ('99+' above 99) and the name reads 'Quote Requests, 3 new'; at 0 or before the read or after a failed read there is no chip, no dot and no hidden text; the collapsed sidebar and the tablet rail show a 10px dot
expected: Above 0 the chip shows the server's New count ('99+' above 99) and the name reads 'Quote Requests, 3 new'; at 0 or before the read or after a failed read there is no chip, no dot and no hidden text; the collapsed sidebar and the tablet rail show a 10px dot
result: pass
source: automated
coverage_id: 13-17 D2

### 78. 13-17 D3: Phones get a fifth Quotes tab after Orders with the same chip and name; at 320px the five tabs are equal, at least 44px, no label is cut and nothing scrolls sideways
expected: Phones get a fifth Quotes tab after Orders with the same chip and name; at 320px the five tabs are equal, at least 44px, no label is cut and nothing scrolls sideways
result: pass
source: automated
coverage_id: 13-17 D3

### 79. 13-17 D4: The dashboard strip under the MoneyStrip: inbox tile, 'New quote requests' over the count (dimmed at 0), 'Open Quote Requests'; 24px skeleton while loading; 'Couldn't load the new requests.' with Try Again on a failure
expected: The dashboard strip under the MoneyStrip: inbox tile, 'New quote requests' over the count (dimmed at 0), 'Open Quote Requests'; 24px skeleton while loading; 'Couldn't load the new requests.' with Try Again on a failure
result: pass
source: automated
coverage_id: 13-17 D4

### 80. 13-18 D1: Staff add a note of 1 to 1,000 characters with who and when from the token and clock; the detail lists notes newest first with the author kept after the account is deleted; audit without text; no route edits or removes a note
expected: Staff add a note of 1 to 1,000 characters with who and when from the token and clock; the detail lists notes newest first with the author kept after the account is deleted; audit without text; no route edits or removes a note
result: pass
source: automated
coverage_id: 13-18 D1

### 81. 13-18 D2: A Manager deletes a request with its photo places, notes and history in one save, queues each stored photo as QuoteDeleted, and records quote-request.deleted with no customer details; Admin 403, Converted 400, stale 409, unknown 404, missing version 400, a failure before the save changes nothing
expected: A Manager deletes a request with its photo places, notes and history in one save, queues each stored photo as QuoteDeleted, and records quote-request.deleted with no customer details; Admin 403, Converted 400, stale 409, unknown 404, missing version 400, a failure before the save changes nothing
result: pass
source: automated
coverage_id: 13-18 D2

### 82. 13-18 D3: A purged request's notes go with it
expected: A purged request's notes go with it
result: pass
source: automated
coverage_id: 13-18 D3

### 83. 13-20 D1: Staff of either role read the New Order prefill: display phone that passes the order number rule, message as notes, business day received, first active product type of the chosen line or null for Custom design and Not sure yet; unknown is 404, anonymous 401
expected: Staff of either role read the New Order prefill: display phone that passes the order number rule, message as notes, business day received, first active product type of the chosen line or null for Custom design and Not sure yet; unknown is 404, anonymous 401
result: pass
source: automated
coverage_id: 13-20 D1

### 84. 13-20 D2: Saving an order with quoteRequestId converts the request, stores the order id, adds a Converted history row with the order, records quote-request.converted and drops the New count, all in the order transaction; an unknown request is 404 and saves no order
expected: Saving an order with quoteRequestId converts the request, stores the order id, adds a Converted history row with the order, records quote-request.converted and drops the New count, all in the order transaction; an unknown request is 404 and saves no order
result: pass
source: automated
coverage_id: 13-20 D2

### 85. 13-20 D3: One request makes one order: two saves at once give one 201 and one 409 quote-requests.already-converted naming the first order, no second number is taken, a later save is the same 409, and the unique index refuses a second request row with the same order
expected: One request makes one order: two saves at once give one 201 and one 409 quote-requests.already-converted naming the first order, no second number is taken, a later save is the same 409, and the unique index refuses a second request row with the same order
result: pass
source: automated
coverage_id: 13-20 D3

### 86. 13-20 D4: The order detail and the deleted-order detail carry quoteRequestId; the request detail carries orderId and orderNumber, also after the order is soft-deleted
expected: The order detail and the deleted-order detail carry quoteRequestId; the request detail carries orderId and orderNumber, also after the order is soft-deleted
result: pass
source: automated
coverage_id: 13-20 D4

### 87. 13-20 D5: A permanent order delete removes the converted request with its photo places, notes and history, queues its stored photos as OrderDeleted and records quote-request.deleted; a soft delete and restore keep the link; an order with no request is deleted as before
expected: A permanent order delete removes the converted request with its photo places, notes and history, queues its stored photos as OrderDeleted and records quote-request.deleted; a soft delete and restore keep the link; an order with no request is deleted as before
result: pass
source: automated
coverage_id: 13-20 D5

### 88. 13-21 D1: Staff add a note (zod mirrors the server: trimmed, 'Write a note first.', 'Keep the note to 1,000 characters or fewer.'); Adding while it sends; the box clears and keeps focus; polite 'Note added.'; the request is read again and the note shows first with the author and time; 'No notes yet.'; one or many newest first; 409 keeps the text; the inbox lists and New count are marked stale
expected: Staff add a note (zod mirrors the server: trimmed, 'Write a note first.', 'Keep the note to 1,000 characters or fewer.'); Adding while it sends; the box clears and keeps focus; polite 'Note added.'; the request is read again and the note shows first with the author and time; 'No notes yet.'; one or many newest first; 409 keeps the text; the inbox lists and New count are marked stale
result: pass
source: automated
coverage_id: 13-21 D1

### 89. 13-21 D2: Only a Manager sees Delete Request; the confirm names the visitor with Cancel focused; Deleting; the DELETE sends the version; the inbox opens with the toast and focus on its h1; the New count and lists refresh; 404 after its own delete is the same path; 409 shows the ConflictBanner; Converted is aria-disabled with the reason; zero axe violations with the dialog open
expected: Only a Manager sees Delete Request; the confirm names the visitor with Cancel focused; Deleting; the DELETE sends the version; the inbox opens with the toast and focus on its h1; the New count and lists refresh; 404 after its own delete is the same path; 409 shows the ConflictBanner; Converted is aria-disabled with the reason; zero axe violations with the dialog open
result: pass
source: automated
coverage_id: 13-21 D2

### 90. 13-22 D1: Turn into Order on any request but a Converted one opens the New Order form filled once from the request (name, team, contact, email, notes, the first item's product type), with the prefill note and View Request; leaving it untouched does not ask
expected: Turn into Order on any request but a Converted one opens the New Order form filled once from the request (name, team, contact, email, notes, the first item's product type), with the prefill note and View Request; leaving it untouched does not ask
result: pass
source: automated
coverage_id: 13-22 D1

### 91. 13-22 D2: Saving sends quoteRequestId, the saved toast gains The quote request is now Converted., and the inbox, the New count and the request page read again
expected: Saving sends quoteRequestId, the saved toast gains The quote request is now Converted., and the inbox, the New count and the request page read again
result: pass
source: automated
coverage_id: 13-22 D2

### 92. 13-22 D3: A 409 already-converted keeps every value and shows the box above Save naming the order with Open Order and Save as a New Order Instead, which saves the same order with no link and a new Idempotency-Key; a request not found opens a blank form with the note; a fromRequest that is not a GUID is dropped with one replace
expected: A 409 already-converted keeps every value and shows the box above Save naming the order with Open Order and Save as a New Order Instead, which saves the same order with no link and a new Idempotency-Key; a request not found opens a blank form with the note; a fromRequest that is not a GUID is dropped with one replace
result: pass
source: automated
coverage_id: 13-22 D3

### 93. 13-22 D4: The order page shows From quote request with View Request after Email (text in the deleted view); a Converted request shows Open Order {number}, no status menu, Delete aria-disabled, and the history row Converted to order {number} with the number as a link
expected: The order page shows From quote request with View Request after Email (text in the deleted view); a Converted request shows Open Order {number}, no status menu, Delete aria-disabled, and the history row Converted to order {number} with the number as a link
result: pass
source: automated
coverage_id: 13-22 D4

### 94. 13-22 D5: A 2,000-character message prefills Notes and passes the order schema unchanged
expected: A 2,000-character message prefills Notes and passes the order schema unchanged
result: pass
source: automated
coverage_id: 13-22 D5

### 95. 13-23 D3: QuoteForm uses a given service for the ticket, the create and the photo uploads; the real service stays the default
expected: QuoteForm uses a given service for the ticket, the create and the photo uploads; the real service stays the default
result: pass
source: automated
coverage_id: 13-23 D3

### 96. 13-24 D1: Every Phase 13 migration applied to CSPS_Dev, none pending; MigrationScriptTests and TriggerInventoryTests pass
expected: Every Phase 13 migration applied to CSPS_Dev, none pending; MigrationScriptTests and TriggerInventoryTests pass
result: pass
source: automated
coverage_id: 13-24 D1

### 97. 13-24 D2: Contact at rest, with every field error, with a refused photo and after a send: zero axe findings, one h1, no sideways scroll at 320 to 1920 px, no console or CSP finding, CLS under 0.05, beacon path only
expected: Contact at rest, with every field error, with a refused photo and after a send: zero axe findings, one h1, no sideways scroll at 320 to 1920 px, no console or CSP finding, CLS under 0.05, beacon path only
result: pass
source: automated
coverage_id: 13-24 D2

### 98. 13-24 D3: Inbox (Open, All, empty Closed pill, no-match search), request pages (New with photos and notes, missing photos, Spam, Converted) and the Spam and Delete dialogs in Blush and Espresso pass the same checks; the title has no customer name and the inbox URL holds the name only in q
expected: Inbox (Open, All, empty Closed pill, no-match search), request pages (New with photos and notes, missing photos, Spam, Converted) and the Spam and Delete dialogs in Blush and Espresso pass the same checks; the title has no customer name and the inbox URL holds the name only in q
result: pass
source: automated
coverage_id: 13-24 D3

## Summary

total: 98
passed: 94
issues: 1
pending: 0
skipped: 0
blocked: 3

## Gaps

- gap_id: G-13-11
  truth: "Marking a request Spam or deleting it queues its photos, and the maintenance run removes them from Cloudinary under quotes/ with no failing removals"
  status: failed
  reason: "User reported: image are still in cloudinary after marking request spam"
  severity: major
  test: 11
  root_cause: "ImageRemovalJob builds its allowed folder as {root}/orders/ only (src/Csps.Application/Maintenance/ImageRemovalJob.cs:91) and fails every other row as outside-folder (:197-202), so quote and content photo removals never happen (13-REVIEW.md G2A-CR-01)"
  artifacts:
    - path: "src/Csps.Application/Maintenance/ImageRemovalJob.cs"
      issue: "folder check accepts only orders/"
    - path: "tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs"
      issue: "only orders/ ids are tested"
    - path: "docs/operations/maintenance.md"
      issue: "line 76 contradicts lines 64-67"
  missing:
    - "Accept the three own folders {root}/orders/, {root}/content/ and {root}/quotes/ (each with the trailing slash) in the removal job"
    - "Tests for quotes/ and content/ rows, and that a lookalike root is still refused"
    - "Correct the maintenance runbook line"
  debug_session: "13-REVIEW.md G2A-CR-01 (code read, confirmed by the orchestrator); CSPS_Dev ImageDeletions row for the Test 9 delete showed 0 attempts"
