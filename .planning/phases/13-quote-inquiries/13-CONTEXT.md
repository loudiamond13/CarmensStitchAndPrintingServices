# Phase 13: Quote Inquiries - Context
*Created: 2026-11-21T20:15:00-06:00 · Updated: 2026-11-21T20:15:00-06:00*

**Gathered:** 2026-11-21
**Status:** Ready for planning
**Branch:** `gsd/phase-13-quote-inquiries` (owner, 2026-11-21: all Phase 13 commits go here; never commit to `gsd/phase-12-consent-analytics-legal`). It was cut from the Phase 12 tip `cfde8f69` because Phase 13 depends on Phase 12 and PR #28 is still open, so it carries the Phase 12 and 12.1 commits that are not on `main` yet. Rebase onto `main` after PR #28 merges.

<domain>
## Phase Boundary

Visitors send a "Get a Quote" request from the Contact page: name, team, PH mobile, email, product, quantity range, message and up to 5 reference photos, with a privacy notice that links to the Privacy Policy. Bots are stopped by a honeypot, a minimum time to submit and per-connection rate limits, with no CAPTCHA. Each request is saved first, then staff get an alert email at the Manager-set "Quote alerts" address. Admin and Manager work requests in a "Quote Requests" inbox (badge, detail with photos, status, add-only notes) and can turn one into a new order through the prefilled New Order form; the two stay linked. The maintenance job purges unconverted requests and their photos after 6 months.

Requirements: INQ-01 to INQ-08. C-36 (the feature's shape), C-12 (CWE-434 for PDF/AI) and the inbox part of C-17 close here. OD-10 was already closed by Phase 12 (D-02). ORD-V2-01 (non-image order files) stays v2, because PDF/AI are not accepted (D-01).

Also in scope (carry-over, Phase 12 D-49 / Phase 11 D-133): after the deploy, the owner adds the first public Gallery photo on the live site and checks it loads on a phone from res.cloudinary.com with no CSP error in the console. Owner only, no code.

</domain>

<decisions>
## Implementation Decisions

All rulings below: owner, 2026-11-21, in this discussion. Cite them as "13 D-xx". They close C-36, C-12 (for inquiries) and the Phase 13 part of C-17.

### Attached files (C-36, C-12: closed)
- **D-01:** **Photos only: JPG, PNG, WebP and HEIC.** No PDF and no AI files. Each photo is checked by its magic bytes and stored through Cloudinary with the private delivery type, as order photos are (Phase 9), so the re-save strips anything hidden inside. The drop-zone hint changes from the UI spec's "JPG, PNG, PDF or AI" to say photos only and to send a PDF or AI file on Messenger (no long dash, OR-4). This closes C-12's CWE-434 risk for PDF/AI without new research. **Reversibility:** reversible. Adding PDF later is new work plus research, not a migration.
- **D-02:** **Up to 5 photos per request, 10 MB each** (the existing `ImageUploadLimits.MaxFileBytes`). The form and the API both enforce the count, size and type (OR-3).
- **D-03:** **A request is saved even if its photos fail to upload** (Cloudinary down, or the free plan nearly full). The text is kept and staff are emailed. The visitor sees a message that the request arrived but the photos did not, and to send them on Messenger. The inbox shows which photos are missing. A lead is never lost to a storage failure.
- **D-04:** **Marking a request Spam deletes its photos within a day** (through the maintenance job, like other image removals). The request text stays until the 6-month purge, so a mistaken Spam mark keeps the text. Closed requests keep their photos until the purge. Photos removed for Spam are not restored if the request is moved back out of Spam. **Reversibility:** one-way. Deleted photos cannot be brought back.
- **D-05:** **Photos are sent as-is**, not shrunk in the browser. Staff see the full original for logo detail; Cloudinary makes the small viewing copies.
- **D-06:** **After picking, each photo shows as a small preview** with its name and a remove button. A wrong type, a photo over 10 MB or a sixth photo shows an inline error before anything is sent.

### Staff email (C-36: closed)
- **D-07:** **A new "Quote alerts" email setting** in Site Content > Business info, Manager only. It can be any inbox, including the shop email. When it is empty, no alert is sent and the inbox badge still shows new requests. This replaces the roadmap prerequisite "the staff address that receives inquiry notifications": the owner sets it on the live site. **Reversibility:** costly. It is a new site setting with its validation, audit and admin field.
- **D-08:** **The alert email carries a summary and a link:** name, team, phone, product, quantity range, the first 300 characters of the message, the photo count and an "Open in admin" link to the request. Never attachments (INQ-04). Accepted trade-off: some personal data sits in the alert inbox.
- **D-09:** **One alert per request, at most 20 an hour.** Past the cap, one "more requests are waiting in the inbox" email is sent for that hour and the rest are inbox only. Every request is still saved.
- **D-10:** **No confirmation email to the visitor.** The on-screen success state and toast are the confirmation. This keeps bots from using the form to email strangers from the shop's domain.
- **D-11:** **A "Send test email" button** next to the Quote alerts address sends a test alert to the saved address. Manager only, rate-limited and audited.
- **D-12:** **A failed alert needs no extra warning.** The existing outbox retries for about 10 minutes (D-33, see `EmailDispatcher.cs`); after that the request still shows in the inbox as New. The failure is logged with no address or content (CWE-532).

### Inbox and who sees it (C-36, C-17: closed)
- **D-13:** **Admin and Manager both work the inbox:** view, change status, add notes and turn a request into an order. The Quote alerts address and its test button stay Manager only (site settings). **Reversibility:** reversible. It is endpoint policies plus authorization-matrix rows.
- **D-14:** **The badge counts requests at status New, shared by all staff.** A request leaves the badge as soon as anyone changes its status. There is no per-person read tracking.
- **D-15:** **Status moves freely** between New, Contacted, Quoted, Closed and Spam, including back out of Spam or Closed. **Converted** is set only by turning the request into an order (D-20) and cannot be changed by hand. Every status change is recorded with who and when.
- **D-16:** **A Manager can delete a request by hand**, after a confirm: the request and its photos are removed for good (for example on a visitor's data-removal request under RA 10173). The audit log records who and when, with no customer details. A Converted request cannot be deleted this way. **Reversibility:** one-way. A deleted request cannot be brought back.
- **D-17:** **Internal notes are an add-only list.** Each note shows who wrote it and when. Notes cannot be edited or deleted on their own.
- **D-18:** **The inbox opens on open requests** (New, Contacted, Quoted), newest first. Filter chips switch to Converted, Closed, Spam or All, and a search box matches name, team or phone. Filter, search and page live in the URL (WEB-10).
- **D-19:** **"Quote Requests" is its own admin menu item, right after Orders,** with the New count as a badge. The dashboard gets a small "New quote requests" tile that links to the inbox.

### Turning a request into an order (C-36: closed)
- **D-20:** **"Turn into order" opens the normal New Order form, prefilled:** customer name, team, phone and email filled in, the message copied into Notes, and the first item's product type suggested from the chosen product line (Phase 11 D-09 link; staff can change it). Nothing is saved until staff add the items and prices and press Save. On save, the request becomes Converted and the request and the order link to each other.
- **D-21:** **Photos stay on the request**; they are not copied to order photos. The order page shows "From quote request" with a link to the request and its photos.
- **D-22:** **A converted request is kept as long as its order.** Orders are kept forever (Phase 12 D-01), so the request and its photos stay too. If the order is permanently removed, the request goes with it. Only unconverted requests are purged after 6 months (Phase 12 D-02). **Reversibility:** costly. It sets what the purge job and the Privacy Policy say about converted requests.
- **D-23:** **One request makes one order.** A second order from the same lead is made with the normal New Order form.

### Public form
- **D-24:** **The product choices are the visible public product lines**, plus "Custom design" and "Not sure yet", not the UI spec's fixed list. The list follows the Products page when a Manager adds or hides a line. A "Get a Quote" link from a product line can preselect that line.
- **D-25:** **A request caught by the honeypot or the minimum-time check gets a normal success response and is not saved.** Caught attempts are only counted in the log.
- **D-26:** **When the per-connection rate limit is hit,** the visitor sees a plain message to wait a few minutes or message the shop on Messenger, and the form keeps what they typed. The starting limit is 5 requests an hour per connection; the plan confirms the numbers as settings with tests.
- **D-27:** **The privacy notice is accurate**, replacing the UI spec's "We never share your details": roughly "We use your details only to reply to this request and prepare your quote. We keep requests that don't become orders for 6 months. See our Privacy Policy." with the link (INQ-08). The planner or UI phase may polish the wording but must not promise more than the site does.
- **D-28:** **The Privacy Policy is updated in code** (Phase 12 D-10) to say photos are stored with Cloudinary, converted requests are kept with their order (D-22) and spam photos are removed early (D-04). Its version and last-updated date are bumped, and it stays DRAFT until the owner approves it (Phase 12 D-14).

### Claude's Discretion
- Bot-guard details: the honeypot field, the minimum time to submit, and the rate-limit window and numbers (starting from D-26), all as settings with tests.
- The inbox list and detail layout, built from existing admin patterns and marked `// SPEC-GAP:` (C-17). Design-vs-WCAG clashes go to `/gsd-ui-phase 13` (OD-14).
- How the Contact page swaps the Phase 11 Messenger and call card (`ContactNowCard`, D-18 of Phase 11) for the form, and what stays on the right-hand aside.
- The exact visitor copy for D-03, D-06 and D-26, in the UI spec's plain style.
- How photo removal for Spam (D-04) and the 6-month purge plug into the existing maintenance jobs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` "Phase 13: Quote Inquiries": goal, success criteria, owner decisions list.
- `.planning/REQUIREMENTS.md` INQ-01 to INQ-08; SEC-08 (record attribution, "anonymous visitor submissions have no creator"); ORD-V2-01 (stays v2).
- `.planning/PROJECT.md` conflict rows C-12, C-17, C-36 and OD-10, OD-14.

### Screens and copy
- `docs/CSPS-UI-SPEC.md` §7.4 Contact / Get a Quote: form fields, validation copy, success state (overridden by D-01 hint text, D-24 product list and D-27 notice).
- `docs/CSPS-UI-SPEC.md` data model line "Inquiry id, name*, team?, contact_number*, ...".

### Earlier rulings this phase builds on
- `.planning/phases/12-consent-analytics-legal/12-CONTEXT.md`: D-01, D-02 (6-month purge), D-07 (purges as maintenance jobs), D-10 (legal text in code), D-13, D-14, D-15 (Privacy Policy covers quote inquiries).
- `.planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-CONTEXT.md`: the cookie banner is gone; the current shape of the Privacy Policy.
- `.planning/phases/11-public-site-content-management/11-CONTEXT.md`: D-09 (order product types link to product lines), D-17 to D-19 (Contact layout and Get a Quote links), D-25 (shop email never public), D-27 (Site Content tabs).
- `.planning/phases/09-order-images-maintenance-jobs/09-CONTEXT.md`: private Cloudinary storage and the maintenance endpoint the jobs join.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs`: private delivery type, allowed formats jpg/png/webp/heic; reuse for request photos.
- `src/Csps.Application/Images/ImageInspection.cs`, `ImageUploadSettings.cs` (`MaxFileBytes` 10 MB), `ImageErrors.cs`: magic-byte and size checks with plain-English errors.
- `src/Csps.Infrastructure/Email/EmailDispatcher.cs`: outbox with retries (about 10 minutes), leased rows, no PII in logs; the alert email goes through it after the request is committed (INQ-04).
- `src/Csps.Server/Security/RateLimitingRegistration.cs`: named rate-limit policies with settings; add one for quote requests.
- `src/Csps.Application/Maintenance/` (`IMaintenanceJob`, `ImageRemovalJob`, `StraySweepJob`) and `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs`: the pattern for the 6-month purge and the Spam photo removal.
- `src/Csps.Domain/Content/BusinessInfo.cs`, `SiteLinks.cs` (`IsContactEmail`): where the Quote alerts setting and its validation sit.
- `web/src/modules/public/components/ContactNowCard.tsx`: the Phase 11 placeholder the form replaces (`// SPEC-GAP: contact before quote form`).

### Established Patterns
- Orders need at least one item with a product type and price (`src/Csps.Domain/Orders/OrderInputs.cs`, `NewOrder`), which is why conversion prefills the form instead of creating an order (D-20).
- Policies `Staff` (Admin + Manager) and `Manager` in `SecurityRegistration.cs`; every new endpoint goes into the authorization matrix.
- Controllers per resource under `/api/v1`, one handler per use case, FluentValidation in handlers, zod mirrors on the client (OR-3).
- Retention periods are named constants with tests (Phase 12 D-07); no SQL triggers (OR-7).

### Integration Points
- Public: Contact page form, product-line "Get a Quote" links (preselect, D-24), the public product-line list.
- Admin: new "Quote Requests" menu item and dashboard tile (D-19), the New Order form (prefill and link, D-20), the order page ("From quote request", D-21), Business info tab (Quote alerts, D-07, D-11).
- Maintenance endpoint: inquiry purge and Spam photo removal jobs.
- Legal: Privacy Policy text and version in the web app (D-28).

</code_context>

<specifics>
## Specific Ideas

- Visitors are mostly teams on a phone from Facebook: keep the form light, keep what they typed on any error, and always offer Messenger as the fallback (D-03, D-26).
- "Never lose a lead" drives D-03, D-09, D-12 and D-14: the saved request and the New badge are the safety net, not the email.

</specifics>

<deferred>
## Deferred Ideas

- **PDF and AI attachments** for quote requests (and ORD-V2-01 for orders): v2, with CWE-434 research if ever pulled in.
- **A confirmation email to the visitor** (D-10): not planned.
- **One request making several orders** (D-23): not planned.

</deferred>

---

*Phase: 13-quote-inquiries*
*Context gathered: 2026-11-21*
