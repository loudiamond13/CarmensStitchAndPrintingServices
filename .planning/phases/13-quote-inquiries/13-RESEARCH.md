# Phase 13: Quote Inquiries - Research

*Created: 2026-11-21T20:33:00-06:00 · Updated: 2026-11-21T20:41:00-06:00*

**Researched:** 2026-11-21
**Domain:** Anonymous lead capture (form, photos, bot guards), staff inbox, order conversion, retention jobs, on the existing .NET 10 + React 19 CSPS stack
**Confidence:** HIGH for reuse points and constraints (read from code this session); MEDIUM for bot-guard numbers and Cloudinary plan limits; three owner questions are open (see Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied verbatim from `13-CONTEXT.md` (owner, 2026-11-21).

### Locked Decisions

All rulings below: owner, 2026-11-21, in this discussion. Cite them as "13 D-xx". They close C-36, C-12 (for inquiries) and the Phase 13 part of C-17.

#### Attached files (C-36, C-12: closed)
- **D-01:** **Photos only: JPG, PNG, WebP and HEIC.** No PDF and no AI files. Each photo is checked by its magic bytes and stored through Cloudinary with the private delivery type, as order photos are (Phase 9), so the re-save strips anything hidden inside. The drop-zone hint changes from the UI spec's "JPG, PNG, PDF or AI" to say photos only and to send a PDF or AI file on Messenger (no long dash, OR-4). This closes C-12's CWE-434 risk for PDF/AI without new research. **Reversibility:** reversible. Adding PDF later is new work plus research, not a migration.
- **D-02:** **Up to 5 photos per request, 10 MB each** (the existing `ImageUploadLimits.MaxFileBytes`). The form and the API both enforce the count, size and type (OR-3).
- **D-03:** **A request is saved even if its photos fail to upload** (Cloudinary down, or the free plan nearly full). The text is kept and staff are emailed. The visitor sees a message that the request arrived but the photos did not, and to send them on Messenger. The inbox shows which photos are missing. A lead is never lost to a storage failure.
- **D-04:** **Marking a request Spam deletes its photos within a day** (through the maintenance job, like other image removals). The request text stays until the 6-month purge, so a mistaken Spam mark keeps the text. Closed requests keep their photos until the purge. Photos removed for Spam are not restored if the request is moved back out of Spam. **Reversibility:** one-way. Deleted photos cannot be brought back.
- **D-05:** **Photos are sent as-is**, not shrunk in the browser. Staff see the full original for logo detail; Cloudinary makes the small viewing copies.
- **D-06:** **After picking, each photo shows as a small preview** with its name and a remove button. A wrong type, a photo over 10 MB or a sixth photo shows an inline error before anything is sent.

#### Staff email (C-36: closed)
- **D-07:** **A new "Quote alerts" email setting** in Site Content > Business info, Manager only. It can be any inbox, including the shop email. When it is empty, no alert is sent and the inbox badge still shows new requests. This replaces the roadmap prerequisite "the staff address that receives inquiry notifications": the owner sets it on the live site. **Reversibility:** costly. It is a new site setting with its validation, audit and admin field.
- **D-08:** **The alert email carries a summary and a link:** name, team, phone, product, quantity range, the first 300 characters of the message, the photo count and an "Open in admin" link to the request. Never attachments (INQ-04). Accepted trade-off: some personal data sits in the alert inbox.
- **D-09:** **One alert per request, at most 20 an hour.** Past the cap, one "more requests are waiting in the inbox" email is sent for that hour and the rest are inbox only. Every request is still saved.
- **D-10:** **No confirmation email to the visitor.** The on-screen success state and toast are the confirmation. This keeps bots from using the form to email strangers from the shop's domain.
- **D-11:** **A "Send test email" button** next to the Quote alerts address sends a test alert to the saved address. Manager only, rate-limited and audited.
- **D-12:** **A failed alert needs no extra warning.** The existing outbox retries for about 10 minutes (D-33, see `EmailDispatcher.cs`); after that the request still shows in the inbox as New. The failure is logged with no address or content (CWE-532).

#### Inbox and who sees it (C-36, C-17: closed)
- **D-13:** **Admin and Manager both work the inbox:** view, change status, add notes and turn a request into an order. The Quote alerts address and its test button stay Manager only (site settings). **Reversibility:** reversible. It is endpoint policies plus authorization-matrix rows.
- **D-14:** **The badge counts requests at status New, shared by all staff.** A request leaves the badge as soon as anyone changes its status. There is no per-person read tracking.
- **D-15:** **Status moves freely** between New, Contacted, Quoted, Closed and Spam, including back out of Spam or Closed. **Converted** is set only by turning the request into an order (D-20) and cannot be changed by hand. Every status change is recorded with who and when.
- **D-16:** **A Manager can delete a request by hand**, after a confirm: the request and its photos are removed for good (for example on a visitor's data-removal request under RA 10173). The audit log records who and when, with no customer details. A Converted request cannot be deleted this way. **Reversibility:** one-way. A deleted request cannot be brought back.
- **D-17:** **Internal notes are an add-only list.** Each note shows who wrote it and when. Notes cannot be edited or deleted on their own.
- **D-18:** **The inbox opens on open requests** (New, Contacted, Quoted), newest first. Filter chips switch to Converted, Closed, Spam or All, and a search box matches name, team or phone. Filter, search and page live in the URL (WEB-10).
- **D-19:** **"Quote Requests" is its own admin menu item, right after Orders,** with the New count as a badge. The dashboard gets a small "New quote requests" tile that links to the inbox.

#### Turning a request into an order (C-36: closed)
- **D-20:** **"Turn into order" opens the normal New Order form, prefilled:** customer name, team, phone and email filled in, the message copied into Notes, and the first item's product type suggested from the chosen product line (Phase 11 D-09 link; staff can change it). Nothing is saved until staff add the items and prices and press Save. On save, the request becomes Converted and the request and the order link to each other.
- **D-21:** **Photos stay on the request**; they are not copied to order photos. The order page shows "From quote request" with a link to the request and its photos.
- **D-22:** **A converted request is kept as long as its order.** Orders are kept forever (Phase 12 D-01), so the request and its photos stay too. If the order is permanently removed, the request goes with it. Only unconverted requests are purged after 6 months (Phase 12 D-02). **Reversibility:** costly. It sets what the purge job and the Privacy Policy say about converted requests.
- **D-23:** **One request makes one order.** A second order from the same lead is made with the normal New Order form.

#### Public form
- **D-24:** **The product choices are the visible public product lines**, plus "Custom design" and "Not sure yet", not the UI spec's fixed list. The list follows the Products page when a Manager adds or hides a line. A "Get a Quote" link from a product line can preselect that line.
- **D-25:** **A request caught by the honeypot or the minimum-time check gets a normal success response and is not saved.** Caught attempts are only counted in the log.
- **D-26:** **When the per-connection rate limit is hit,** the visitor sees a plain message to wait a few minutes or message the shop on Messenger, and the form keeps what they typed. The starting limit is 5 requests an hour per connection; the plan confirms the numbers as settings with tests.
- **D-27:** **The privacy notice is accurate**, replacing the UI spec's "We never share your details": roughly "We use your details only to reply to this request and prepare your quote. We keep requests that don't become orders for 6 months. See our Privacy Policy." with the link (INQ-08). The planner or UI phase may polish the wording but must not promise more than the site does.
- **D-28:** **The Privacy Policy is updated in code** (Phase 12 D-10) to say photos are stored with Cloudinary, converted requests are kept with their order (D-22) and spam photos are removed early (D-04). Its version and last-updated date are bumped, and it stays DRAFT until the owner approves it (Phase 12 D-14).

#### UI phase rulings (2026-11-21, from 13-UI-SPEC OQ-1 to OQ-3)
- **D-29:** **The "Quote Requests" menu item uses the inbox tray icon** (`inbox` from the installed lucide-react, registered in `icons.ts`; no new package). Also used on the dashboard strip and the inbox empty state. (owner, 2026-11-21)
- **D-30:** **Staff phones get a fifth bottom tab "Quotes"** after Orders, carrying the New count, so new leads are seen at a glance. (owner, 2026-11-21)
- **D-31:** **Visitors see the design's "Inquiry" words:** "Inquiry form", "Send Inquiry", "Inquiry sent". The staff side stays "Quote Requests". (owner, 2026-11-21)
- **D-32:** **The staff alert email leaves the Photos line out when no photos were sent**, the same as every other empty value (D-08). (owner, 2026-11-21)
- **D-33:** **The alert email subject cuts the visitor's name at 60 characters with "…"**; the body keeps the full name. (owner, 2026-11-21)

### Claude's Discretion
- Bot-guard details: the honeypot field, the minimum time to submit, and the rate-limit window and numbers (starting from D-26), all as settings with tests.
- The inbox list and detail layout, built from existing admin patterns and marked `// SPEC-GAP:` (C-17). Design-vs-WCAG clashes go to `/gsd-ui-phase 13` (OD-14).
- How the Contact page swaps the Phase 11 Messenger and call card (`ContactNowCard`, D-18 of Phase 11) for the form, and what stays on the right-hand aside.
- The exact visitor copy for D-03, D-06 and D-26, in the UI spec's plain style.
- How photo removal for Spam (D-04) and the 6-month purge plug into the existing maintenance jobs.

### Deferred Ideas (OUT OF SCOPE)
- **PDF and AI attachments** for quote requests (and ORD-V2-01 for orders): v2, with CWE-434 research if ever pulled in.
- **A confirmation email to the visitor** (D-10): not planned.
- **One request making several orders** (D-23): not planned.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md, verbatim) | Research Support |
|----|-------------|------------------|
| INQ-01 | Visitors can submit the "Get a Quote" inquiry form (name\*, team, PH mobile\*, email, product type, quantity range, message) with the UI-spec validation copy and success state ⚑ C-36 | Pattern 1 (two-step send), Pattern 2 (form ticket), Validation table; phone rule reuse (`PhilippinePhone` + `IsMobile`); order field limits reused so R3 always fits |
| INQ-02 | Visitors can attach reference files to an inquiry, within the owner-approved file types, size and count limits, validated by magic bytes and stored privately ⚑ C-36 (CWE-434) | Pattern 3 (one photo per call through the existing image pipeline: `ImageInspection.Check`, `ImageMetadataStripper.Strip`, `IImageStorage.UploadAsync`, private type); Pitfall 1 (IIS 11 MiB cap) |
| INQ-03 | The inquiry endpoint is protected by a honeypot, minimum time-to-submit and per-IP rate limits (no CAPTCHA) | Pattern 2 (server-signed form ticket with `ITimeLimitedDataProtector`), new named rate-limit policies in `RateLimitingRegistration`; Pitfalls 4, 5, 6 |
| INQ-04 | Staff are emailed a notification for each new inquiry, without attachments. The inquiry is persisted before the email is sent ⚑ C-36 (recipient) | Pattern 4: outbox row queued in the same unit of work (`IEmailOutbox.EnqueueAsync`); cap via `CountRecentAsync` under a new standing lock |
| INQ-05 | Staff can review inquiries in an admin inbox (unread badge, detail with attachments, status New → Contacted → Quoted → Converted / Closed / Spam, internal note). The inbox's filters and page live in the URL (WEB-10) ⚑ C-36 (visibility) | Data model, status machine in Domain, list/count/detail endpoints, `IImageDelivery.ForPhoto` for private photos, nuqs list params |
| INQ-06 | Staff can convert an inquiry into a new order with customer, team, contact and product type prefilled, and the two stay linked | Pattern 5: prefill read + `CreateOrderRequest` gains the request id; link set inside the `CreateOrderHandler` transaction with a row lock and a filtered unique index |
| INQ-07 | Unconverted inquiries and their attachments are purged after the configured retention period ⚑ OD-10 | Pattern 6: new `IMaintenanceJob` that queues photo removals then deletes rows; inventory and stray sweep extended (Pitfall 3); schedule conflict OQ-1 |
| INQ-08 | The inquiry form shows a privacy notice at collection, linking to the Privacy Policy | Re-insert the held `PRIVACY_QUOTE_REQUEST_LINES`, bump version in both `legalPages.ts` and `LegalPages.cs`; wording must match the real cleanup schedule (OQ-1) |
</phase_requirements>

## Summary

Almost everything Phase 13 needs already exists and should be reused, not rebuilt: the Phase 9 image pipeline (magic-byte check, metadata strip, Cloudinary private upload, deletion queue, stray sweep), the transactional email outbox, named per-address rate limits, the default-on idempotency gate (which already serves anonymous POSTs), the site-settings aggregate with row versions and audit, the order creation transaction with its locks, and the maintenance job runner. No new package is needed on either side. [VERIFIED: codebase read this session]

Three facts in the code change the shape of the plan. **First, photos cannot travel in one request.** IIS caps every request body at `maxAllowedContentLength="11534336"` (11 MiB) and the idempotency middleware buffers the whole body in memory to hash it, on a 256 MB app pool. Five 10 MB photos in one multipart post would be refused by IIS before the app sees it, and on mobile data one dropped connection would lose the text too, which breaks D-03. The design must be: save the text first (one small JSON post), then upload each photo in its own post, exactly like order photos. **Second, the maintenance run is monthly** (`cron: "17 19 1 * *"`, pinned by an architecture test, and Phase 12 D-36 "The maintenance run stays monthly ... No weekly cron line is added"). That contradicts D-04 ("deletes its photos within a day") and the UI-SPEC Privacy rows ("Deleted within a day", "Deleted 6 months after we receive them"). The owner must choose. **Third, the Contact page has no bundle room for the form libraries.** Contact is at 145.22 KB of its 150 KB public budget after Phase 12.1, and react-hook-form plus zod plus the resolver measured 35.6 KB gz in a minified test bundle this session (zod/mini alone 6.2 KB). No variant of "zod schema in the browser" fits as initial JS, so the owner must rule how the form loads.

**Primary recommendation:** Build a two-step send (text first with a server-signed form ticket, then one photo per call with a per-request upload key), queue the staff alert in the same transaction as the saved text, link conversion inside `CreateOrderHandler`, add one retention job plus inventory and stray-sweep coverage for a new `{root}/quotes/` folder, and get owner rulings on the cleanup schedule (OQ-1), the form chunk loading (OQ-2) and the "full original" viewing size (OQ-3) before the plans that depend on them.

## Project Constraints (from CLAUDE.md)

Directives the planner must verify (root `CLAUDE.md`, `.claude/CLAUDE.md`, global owner rules):

- **Stack fixed:** .NET 10 controllers (`[ApiController]`, attribute routes under `/api/v1`), EF Core 10 code-first Fluent config, FluentValidation in handlers, MailKit, Cloudinary, Serilog; React 19 + TS strict + Vite, Tailwind v4, React Router (`react-router`), TanStack Query, RHF + zod.
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **New packages:** none may be installed without owner approval; each needs purpose, license (MIT/Apache-2.0/BSD/ISC only), maintenance status, legitimacy check, and a version at least 14 days old. This research recommends **zero** new packages.
- **Architecture:** onion Domain ← Application ← Infrastructure ← Server (ArchUnitNET); one handler per use case, manual mapping, `Result<T>` to RFC 9457 ProblemDetails; thin controller actions; every action declares `[Authorize(Policy = ...)]` or `[AllowAnonymous]`; automatic 400 off; `rowversion` per aggregate (409); UTC + `TimeProvider`/`IBusinessCalendar`, never `DateTime.Now`.
- **Schema:** EF migrations only, no JSON columns, compat level pinned, drops/renames are owner calls, no `Database.Migrate()` at startup, production gets reviewed idempotent scripts.
- **No inline SQL** in application code (an architecture test, `NoInlineSqlTests.cs`, exists); use LINQ, `ExecuteUpdate`/`ExecuteDelete`.
- **OR-7:** no new database trigger; `TR_AuditLog_AppendOnly` is the only one.
- **Quality:** TDD (red, green, refactor); zero warnings; coverage Domain 100%, Application ≥ 95%, `core/api` 100%, web ≥ 90%; authorization-matrix rows for every endpoint × {anonymous, Admin, Manager}.
- **Security:** CWE Top 25 per phase; strict CSP, no `unsafe-inline`/`unsafe-eval`, no `style` attribute; default-deny; append-only audit; no secrets or data in git; logs carry no addresses or content (CWE-532).
- **A11y:** WCAG 2.2 AA, zero axe violations; touch targets ≥ 44 px; 320 to 1920 px with no horizontal scroll.
- **Perf:** public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz; Lighthouse ≥ 95 mobile; LCP < 2.0 s, CLS < 0.05, INP < 200 ms. "Never raise one to make a build pass" (`budget.ts` comment).
- **Web conventions:** OR-3 zod mirrors every API rule with the server's message; OR-4 no em/en dash in `web/src` (code, copy, comments), `EmptyValue` for empty values; OR-5 calls in `modules/{public,admin}/services/`, only `core/api/http` touches `fetch`; OR-6 owner folder tree; public parts import component files by deep path, never an area barrel (PERF-01).
- **Shared machine:** ports 5180, 5115, 7028, 5199 only; LocalDB `(localdb)\MSSQLLocalDB` with `CSPS_` databases; run `preflight.ps1` before dev servers, E2E or full runs; never touch `BetsLLC_*` or TheBETSLLC processes; no env vars at User/Machine level; never read stdin in a command.
- **Git:** stage by path, never `git add -A`; secret scan and manual scan for real names, emails, paths before commit; merges only via `tools/scripts/Merge-PullRequest.ps1` on owner instruction. All Phase 13 work stays on `gsd/phase-13-quote-inquiries`.
- **Docs:** every markdown file gets created/updated ISO 8601 timestamps with offset; plain English; comments minimal (OR-2).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quote form fields, client validation, photo picking, previews | Browser (public SPA) | API (same rules re-checked) | OR-3: the browser checks first with the server's messages; the server is the authority |
| Bot guards (honeypot, minimum time, rate limits) | API / Backend | Browser (sends ticket and hidden field) | Anything the browser decides can be forged; the server signs the ticket and decides |
| Saving the request text, photo slots, upload key | API + Database | none | Save-first rule (D-03, INQ-04) lives in one transaction |
| Photo type, size, pixel checks; metadata strip; storage | API (Application `Images`) | Cloudinary (private type) | Reuse the Phase 9 pipeline; files never touch disk |
| Staff alert email and hourly cap | API (Application handler) + Database outbox | Background `EmailDispatcher` | Outbox row commits with the request; dispatcher sends after commit |
| Inbox list, New count, detail, status, notes, delete | API + Database | Browser (admin SPA renders) | Every count, status and date comes from the server (UI-SPEC rule) |
| Private photo viewing addresses | API (`IImageDelivery`) | Cloudinary CDN | Server builds named-size addresses; browser never builds a Cloudinary URL |
| Conversion to order and the link | API (`CreateOrderHandler` transaction) | Database (filtered unique index) | One request makes one order; constraint is the backstop |
| Retention purge, Spam photo removal | Maintenance job (API, called by GitHub Actions) | Cloudinary removals via queue | No host scheduler; jobs run through the keyed endpoint |
| Quote alerts setting and test send | API (site settings, Manager) | Browser (Business info tab) | Same aggregate, version and audit as the rest of Business info |
| Privacy Policy text and version | Browser bundle (`legalPrivacy.ts`, `legalPages.ts`) | Domain `LegalPages.cs` (noindex, sitemap) | Legal text lives in code (Phase 12 D-10); approval flag mirrored server side |

## Standard Stack

All already installed and pinned. Nothing new.

### Core (backend, reused)
| Library | Version (pinned) | Purpose in Phase 13 | Source |
|---------|---------|---------|--------------|
| EF Core SqlServer | 10.0.x (central pins) | New tables, migrations, `ExecuteUpdate` row locks, `ExecuteDelete` purges | [VERIFIED: Directory.Packages.props] |
| FluentValidation | 12.1.1 | Request validators run in handlers | [VERIFIED: Directory.Packages.props:22] |
| MailKit | 4.18.1 | Alert, overflow and test emails through the existing outbox | [VERIFIED: Directory.Packages.props:23] |
| CloudinaryDotNet | 1.29.3 | Private photo uploads, removals, listing | [VERIFIED: Directory.Packages.props:25] |
| Microsoft.AspNetCore.DataProtection (in the shared framework) | 10.0.x | `ITimeLimitedDataProtector` for the form ticket | [CITED: learn.microsoft.com Data Protection "Limit the lifetime of protected payloads"] |
| System.Threading.RateLimiting / ASP.NET Core rate limiting (shared framework) | 10.0.x | New named policies | [VERIFIED: src/Csps.Server/Security/RateLimitingRegistration.cs] |

### Core (web, reused)
| Library | Version | Purpose | Source |
|---------|---------|---------|--------------|
| react-hook-form | 7.89.0 | Form state (admin already; public per OQ-2) | [VERIFIED: web/package.json] |
| zod | 4.6.7 | OR-3 schemas | [VERIFIED: web/package.json] |
| @hookform/resolvers | 5.9.1 | zod resolver | [VERIFIED: web/package.json] |
| @tanstack/react-query | 5.103.2 | Inbox, detail, count, ticket queries | [VERIFIED: web/package.json] |
| nuqs | 2.10.1 | R1 URL state (WEB-10) | [VERIFIED: web/package.json] |
| lucide-react | 1.53.0 | `inbox` icon (D-29); `node_modules/lucide-react/dist/esm/icons/inbox.mjs` exists | [VERIFIED: local file listing] |

### Test stack (reused)
xunit.v3 (MTP v2), Shouldly, NSubstitute, `FakeTimeProvider`, ArchUnitNET, Respawn; Vitest 5 + RTL + MSW 3 + in-house axe matcher; Playwright + @axe-core/playwright. `TestingImageStorage` already "can be told to fail the next calls, and can hold uploads until they are released" [VERIFIED: src/Csps.Infrastructure/Images/TestingImageStorage.cs:23-24], which is exactly what the D-03 tests need.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two-step send (text, then one photo per call) | One multipart post with all photos | Blocked by the IIS 11 MiB cap and the in-memory idempotency buffer; one drop loses the text (D-03). Rejected. |
| Server-signed form ticket for minimum time | Client-sent "form shown at" timestamp | A bot simply sends an old timestamp. The ticket costs one GET and no package. |
| Client-generated upload secret (hash stored) | Server-issued upload token in the create answer | The idempotency gate stores the answer body for 24 h, so a server token would sit in the database in clear; SEC-06 already keeps token-bearing answers out of storage. |
| CAPTCHA | (forbidden by INQ-03, WCAG 3.3.8) | Not considered. |

**Installation:** none. No `npm install` or `dotnet add package` in this phase.

## Package Legitimacy Audit

No new external package is recommended, so the legitimacy gate has nothing to run against.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none new) | | | | | | |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

If the owner picks OQ-2 option C (a hand-rolled form state with `zod/mini`), that is still the installed `zod` 4.6.7 package (its `./mini` export) [VERIFIED: web/node_modules/zod/package.json exports], so no new package.

## Architecture Patterns

### System Architecture Diagram

```
 Visitor phone (Contact page)
   |
   | 1. GET /api/v1/public/quote-requests/ticket  (no-store)  ---> signed ticket {issuedAt}, photo rules
   | 2. GET /api/v1/public/product-lines (existing, cached)    ---> visible lines for the Product select
   |
   | 3. POST /api/v1/public/quote-requests  (JSON, Idempotency-Key, rate limit "quote-create")
   v
 [Rate limiter: per address 5/h + site-wide ceiling] --429--> visitor keeps typed data, Messenger box
   |
 [Idempotency gate: same key = stored answer]
   |
 [CreateQuoteRequestHandler]
   |-- honeypot filled? ticket younger than minimum? --> log counter only, answer fake success (D-25)
   |-- ticket expired or unreadable? --> 400 "ticket" code, client refetches ticket and resends once
   |-- validate fields (FluentValidation, same messages as zod)
   |-- in ONE transaction:
   |     insert QuoteRequest (status New) + photo slot rows (name only) + upload key hash
   |     take "quote-alerts" lock row, count this hour's alerts (CountRecentAsync)
   |       < 20  --> enqueue QuoteAlertEmail
   |       = 20  --> enqueue one QuoteAlertsOverflowEmail if none this hour
   |       address empty --> nothing
   |     commit  --> OutboxSignal --> EmailDispatcher sends after commit (retries ~10 min)
   v
 answer {id, photoSlots}
   |
   | 4. for each photo: POST /api/v1/public/quote-requests/{id}/photos/{slot}
   |      (multipart, one file, Idempotency-Key, X-Upload-Key header, [UploadSlot], rate limit "quote-photos")
   v
 [UploadQuotePhotoHandler]
   |-- key hash matches, not expired, slot empty, request not Spam --> else 404 (same answer for every miss)
   |-- ImageInspection.Check --> ImageMetadataStripper.Strip --> IImageStorage.UploadAsync (private, {root}/quotes/{id}/...)
   |-- fill slot row (publicId, size)        on failure after upload: queue removal (UploadUndone)
   v
 Visitor sees "Inquiry sent" (+ missing-photo note for slots that failed)

 Staff (admin SPA)
   GET /api/v1/quote-requests?status=&q=&page=&size=   (Staff)  list + pill counts
   GET /api/v1/quote-requests/new-count                (Staff)  nav chip, tab, strip (60 s poll)
   GET /api/v1/quote-requests/{id}                     (Staff)  detail, photo URLs via IImageDelivery.ForPhoto
   POST /api/v1/quote-requests/{id}/status             (Staff)  version; to Spam: queue photo removals
   POST /api/v1/quote-requests/{id}/notes              (Staff)  add-only
   DELETE /api/v1/quote-requests/{id}                  (Manager) not Converted; queue removals; audit
   GET /api/v1/quote-requests/{id}/order-prefill       (Staff)  values for the New Order form
   POST /api/v1/orders  (existing, body gains quoteRequestId)  --> link + Converted in the same transaction
   POST /api/v1/site-settings/quote-alerts/test        (Manager) rate-limited, audited

 GitHub Actions maintenance.yml --> POST /api/v1/maintenance/run (keyed)
   QuoteRequestRetentionJob (purge > 6 months, not Converted; queue photo removals)
   StraySweepJob (+ {root}/quotes/ pass)  -->  ImageRemovalJob (drains the queue: Spam, deleted, purged, strays)
```

### Recommended Project Structure

Backend (names are proposals; the planner fixes them):

```
src/Csps.Domain/QuoteRequests/
  QuoteRequest.cs              aggregate: fields, status rules (D-15), Converted lock, photo slots, IAttributedRecord
  QuoteRequestStatus.cs        enum : byte  New=1, Contacted=2, Quoted=3, Converted=4, Closed=5, Spam=6
  QuoteRequestPhoto.cs         slot row: slot 0..4, cleaned file name, public id (null = missing), size facts
  QuoteRequestNote.cs          add-only note: author id, time, text (1,000)
  QuoteRequestStatusChange.cs  history row: from, to, by, at, order id for "Converted to order"
  QuoteRequestRules.cs         limits and messages (reuse OrderRules limits), quantity ranges, product choice
  QuoteRequestRetention.cs     named constant: 6 months (Phase 12 D-02, D-07) + cut-off helper
src/Csps.Application/QuoteRequests/
  CreateQuoteRequestHandler.cs, CreateQuoteRequestRequest(+Validator).cs, QuoteFormTicket port
  UploadQuotePhotoHandler.cs, ChangeQuoteRequestStatusHandler.cs, AddQuoteRequestNoteHandler.cs
  DeleteQuoteRequestHandler.cs, ListQuoteRequestsHandler.cs, GetQuoteRequestHandler.cs
  GetNewQuoteCountHandler.cs, GetOrderPrefillHandler.cs, QuoteRequestErrors.cs, QuoteRequestAuditDetail.cs
src/Csps.Application/Email/AuthEmail.cs   + QuoteAlertEmail, QuoteAlertsOverflowEmail, QuoteAlertTestEmail (kinds 12, 13, 14)
src/Csps.Application/Content/             + SendQuoteAlertTestHandler.cs; UpdateSiteSettingsRequest gains QuoteAlertsEmail
src/Csps.Application/Orders/CreateOrderHandler.cs   + link step; PermanentlyDeleteOrderHandler.cs + remove linked request
src/Csps.Application/Ports/IImageDeletionQueue.cs   + reasons 6 QuoteSpam, 7 QuoteDeleted, 8 QuotePurged
src/Csps.Application/Images/PublicIds.cs            + QuoteFolder / NewQuote ({root}/quotes/{requestId}/{random})
src/Csps.Application/Maintenance/StraySweepJob.cs   + third pass over {root}/quotes/ with its own cursor
src/Csps.Infrastructure/QuoteRequests/              store, reader (list, counts, detail), ticket protector
src/Csps.Infrastructure/Maintenance/QuoteRequestRetentionJob.cs   Order between 10 and 30 (before removals)
src/Csps.Infrastructure/Images/ImageInventory.cs    + QuoteRequestPhotos in the known-ids union
src/Csps.Infrastructure/Email/EmailRenderer.cs      + three templates; EmailContent gains an optional footer reason
src/Csps.Infrastructure/Email/AppLinksOptions.cs    + QuoteRequestLink(id), QuoteRequestsPage()
src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs + "quote-alerts" standing row (migration seeds it)
src/Csps.Infrastructure/Persistence/Configurations/  four new configurations; SiteSettings gains QuoteAlertsEmail
src/Csps.Server/Controllers/PublicQuoteRequestsController.cs  (anonymous: ticket, create, photo)
src/Csps.Server/Controllers/QuoteRequestsController.cs        (Staff/Manager)
src/Csps.Server/Controllers/SiteSettingsController.cs         + quote-alerts/test action
src/Csps.Server/Security/RateLimitSettings.cs, RateLimitingRegistration.cs  + policies
src/Csps.Server/Endpoints/PublicPageHeads.cs                  /contact meta description (UI-SPEC)
src/Csps.Domain/Content/LegalPages.cs                         Privacy 1.1, Approved: false (mirrors legalPages.ts)
```

Web: follow the UI-SPEC inventory exactly (it already names every file under `modules/public/` and `modules/admin/`, the `counts` prop on Sidebar/MobileNavDrawer, the fifth TabBar tab, `cleanFileName`/`sizeText` moved to `@/utils/images`, the `inbox` icon in `icons.ts`, and the regenerated `web/src/types/api.generated.ts` through `tools/openapi-gen`).

### Pattern 1: Save the text first, then one photo per call
**What:** The create post carries only text, the bot-guard values, the declared photo list (file names, up to 5) and a client-generated upload secret. It answers `{ id, photoSlots }`. Each photo then goes in its own multipart post to its slot.
**Why:** IIS refuses bodies over 11 MiB [VERIFIED: src/Csps.Server/web.config:13 `<requestLimits maxAllowedContentLength="11534336" />`]; the idempotency middleware "buffered in memory only, up to the matched endpoint's own size limit" [VERIFIED: src/Csps.Server/Security/IdempotencyMiddleware.cs class summary]; the upload cap is `UploadsAtOnce = 2`, `UploadsWaiting = 4` [VERIFIED: src/Csps.Server/Security/UploadSlotsMiddleware.cs:14-15]; and D-03 requires the text to be saved even when photos fail.
**How the photo action is declared (copy from the order photo action):**
```csharp
// Source: src/Csps.Server/Controllers/OrderImagesController.cs (Upload action attributes, read this session)
[EnableRateLimiting(RateLimitPolicies.ImageUpload)]   // Phase 13: a new "quote-photos" policy instead
[UploadSlot]
[RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
[RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
```
`ImageUploadLimits.BodyBytes` is `MaxFileBytes + 65_536` and `MaxFileBytes = 10_485_760` [VERIFIED: src/Csps.Application/Images/ImageUploadSettings.cs:7-10], so one photo per call fits under the IIS cap with no web.config change.

**Upload key:** the browser makes 32 random bytes (`crypto.getRandomValues`), sends them base64url in the create body, and sends the same value in a header on each photo post. The server stores only SHA-256 of it plus an expiry (proposal: 2 hours) and compares with `CryptographicOperations.FixedTimeEquals`. A wrong key, a wrong id, an expired key, a filled slot or a Spam request all answer the same 404, so nothing leaks about which ids exist (CWE-639, CWE-203). The create answer holds no secret, so the idempotency gate can store it safely (SEC-06 keeps token-bearing answers out of storage).

**Photo outcome for the visitor:** the browser knows each photo call's result, so it shows D-03 copy for the slots whose call failed (network, 4xx, 5xx) after one retry with the same Idempotency-Key. A photo the server refuses on content (pixel limit) is also a missing photo (UI-SPEC: "a refused upload is a D-03 missing photo, never a lost request").

### Pattern 2: Server-signed form ticket (minimum time, honeypot)
**What:** `GET /api/v1/public/quote-requests/ticket` (anonymous, `public-read` policy, `no-store`) answers a ticket made with `IDataProtectionProvider.CreateProtector("Csps.QuoteTicket.v1").ToTimeLimitedDataProtector()` holding the issue time. The create post must carry it. The handler unprotects it: too young (proposal: under 3 seconds) or a filled honeypot field means a caught bot (D-25: normal-looking success, nothing saved, one log line with a reason code only). Expired or unreadable means a 400 with a dedicated code; the client fetches a new ticket and resends once without the visitor noticing, so a form left open overnight never silently loses a lead.
**Why:** a client-sent start time is trivially forged; a ticket also proves the caller read a same-origin GET, which a cross-site form cannot do.
**Settings:** minimum seconds, ticket lifetime, and every rate-limit number go in a `QuoteRequests` settings class validated at start like `ImageUploadSettings.Validate()` and `RateLimitRule.Problems(...)`, with tests (D-26).

### Pattern 3: Reuse the photo pipeline unchanged
Follow `UploadOrderImageHandler` step for step: `storage.IsConfigured` (503), slot checks, `ImageInspection.Check(request.Bytes, request.FileName, settings)`, `ImageMetadataStripper.Strip(facts.Kind, request.Bytes.Span, request.FileName)`, `storage.UploadAsync(new ImageUpload(publicId, folder, clean, facts.Kind), cancellationToken)`, and on a `ImageFailureCodes.Transient` outcome or a failed row save `imageDeletions.EnqueueNowAsync(publicId, ImageDeletionReason.UploadUndone, CancellationToken.None)` [VERIFIED: src/Csps.Application/Orders/UploadOrderImageHandler.cs]. Storage already uses `PrivateType = "private"` and `AllowedFormats = ["jpg", "png", "webp", "heic"]` [VERIFIED: src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs:25-27], which is D-01 exactly. Map `ImageErrors` codes to the quote form's own messages (the order messages differ from the UI-SPEC § Validation wording).

### Pattern 4: Alert email in the same transaction, capped under a lock
**What:** `IEmailOutbox.EnqueueAsync` "adds it to the caller's unit of work. Nothing is saved or sent until the caller commits" [VERIFIED: src/Csps.Application/Ports/IEmailOutbox.cs]. So the request row and the alert row commit together, and the dispatcher sends only after commit: INQ-04 holds by construction.
**Cap (D-09):** inside the create transaction, take a new standing lock row `"quote-alerts"` (the `DatabaseLocks` pattern: "A lock is an `ExecuteUpdate` on its row inside the caller's transaction. A new lock name is a new standing row added by a migration." [VERIFIED: src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:7-9]), then `CountRecentAsync(kind, toAddress, since, ct)` from the start of the current hour. Below 20: queue the alert. At 20: queue one overflow email if none this hour. Without the lock two simultaneous creates can both read 19.
**New email kinds:** `AuthEmailKind` ends at `ManagerResetLink = 11` and is stored as a byte (`HasConversion<byte>()`) [VERIFIED: src/Csps.Application/Email/AuthEmail.cs:39; EmailOutboxMessageConfiguration.cs:17]. Add 12, 13, 14; never renumber. `EmailRenderer` throws `NotSupportedException` for a kind with no template, so each new record needs its case. The shared footer says "You're getting this because you have a staff account at CSPS." [VERIFIED: src/Csps.Infrastructure/Email/EmailHtmlLayout.cs:47], which is wrong for an alerts inbox; add an optional footer reason to `EmailContent` for the UI-SPEC text.
**Business time:** Manila is a whole-hour offset, so the UTC hour start equals the business hour start; still use `IBusinessCalendar` for the clock.

### Pattern 5: Conversion inside the existing order transaction
**What:** `CreateOrderRequest` gains `Guid? QuoteRequestId`. Inside `unitOfWork.InTransactionAsync` in `CreateOrderHandler`, before the number is taken, lock the request with a conditional `ExecuteUpdate` that matches `Id == id && Status != Converted` (the `OrderStore.LockAsync` pattern). Zero rows: answer 409 with a code such as `quote-requests.already-converted` and the existing order number so R3 can show "Open Order {CSPS-0042}". Otherwise set Converted, store the order id, add the history row and the audit entry, then continue the normal save. A filtered unique index on `QuoteRequests.OrderId` (non-null) is the backstop (OR-7: constraints, not triggers).
**Prefill read:** `GET /api/v1/quote-requests/{id}/order-prefill` answers name, team, phone (in the order-safe display form, Pitfall 7), email, message, the received date and the suggested product type id: the first non-retired `ProductType` whose `ProductLineId` equals the chosen line (`public Guid? ProductLineId { get; private set; }` [VERIFIED: src/Csps.Domain/OrderLists/ProductType.cs:22]). A line with several types: pick by the list's sort order; none: leave empty.
**Permanent order delete (D-22):** `PermanentlyDeleteOrderHandler` must also delete the linked request and queue its photos in the same transaction. A database cascade alone would orphan the Cloudinary files.

### Pattern 6: Retention and Spam photo removal as maintenance work
**What:** a new `IMaintenanceJob` in Infrastructure (like `AnalyticsRetentionJob`, which uses `Order => 15`). The documented order is "purge 10, stray sweep 20, removals 30, usage 40" [VERIFIED: src/Csps.Application/Maintenance/IMaintenanceJob.cs]. Give the new job an order below 30 so the removals it queues leave Cloudinary in the same pass. Per batch: read up to N unconverted requests received before the cut, queue every stored photo id (new reason `QuotePurged`), delete the rows (children by cascade), commit; report a fixed label such as "Old quote requests removed" with a count only.
**Spam (D-04):** the status-change handler, when moving to Spam with photos left, queues each photo (new reason `QuoteSpam`), deletes the photo rows (or clears their public ids) and sets a "photos removed" time, all in the status-change transaction. The actual Cloudinary delete is the existing `ImageRemovalJob`. How soon that runs is OQ-1.
**Deletion reasons:** existing values `PhotoDeleted = 1` to `PhotoReplaced = 5` with "The number is stored, so never reorder or reuse one" [VERIFIED: src/Csps.Application/Ports/IImageDeletionQueue.cs:6-21]. Add 6, 7, 8.

### Anti-Patterns to Avoid
- **One big multipart post with all photos:** fails at IIS (11 MiB), blows memory, loses the text on a drop.
- **Trusting a client timestamp for the minimum-time check:** forged in one line by any bot.
- **Silently dropping an expired-ticket post:** a real visitor who left the tab open loses the lead. Only "too fast" and "honeypot filled" are silent.
- **Calling Cloudinary delete from a request:** Phase 9 rule; always queue.
- **`ExecuteDelete` straight on requests in the purge:** it skips queuing the photo files, leaving private customer photos in Cloudinary forever (the stray sweep would catch them only if the quotes folder is swept).
- **Putting quote photos under `{root}/content/`:** content is the public-page area; quote photos are private customer data and need their own folder and sweep pass.
- **Exposing `QuoteAlertsEmail` in any public DTO** (`PublicSiteDto`, snapshots, privacy-contact): it is staff-only like `ContactEmail` (Phase 11 D-25).
- **Customer name in the document title or anywhere but `q` in URLs** (UI-SPEC privacy row).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Photo type detection | Extension or MIME checks | `ImageSniffer` / `ImageInspection.Check` (server), `sniffImageType` (browser) | Magic bytes, upright dimensions, HEIC brands already handled and tested |
| Metadata removal | A new stripper or a re-encode | `ImageMetadataStripper.Strip` (incl. `.Heic.cs`) | GPS and camera data removal already proven in Phase 9 |
| Private storage and delivery | Raw Cloudinary calls or browser-built URLs | `IImageStorage`, `IImageDelivery.ForPhoto` | Named sizes, private type, testing doubles |
| Deferred file deletion | Inline deletes, timers | `IImageDeletionQueue` + `ImageRemovalJob` | Leases, retries, stray sweep backstop |
| Email sending and retries | Direct SMTP from the handler | `IEmailOutbox` + `EmailDispatcher` | Commit-coupled, encrypted at rest, retries about 10 minutes, no PII in logs |
| Signed, expiring ticket | Custom HMAC and timestamp parsing | `ITimeLimitedDataProtector` (shared framework) | Key rotation and expiry already handled by Data Protection keys the app persists |
| Duplicate-submit protection | Own dedupe table | Existing `Idempotency-Key` gate (anonymous user id is null) | Stores the answer with the change in one transaction |
| Per-address throttling | Counters in the database | `RateLimitingRegistration.AddPolicy` with `RateLimitRule` settings | Sliding windows, `Retry-After`, standard 429 body |
| Serializing a check-then-write | `SERIALIZABLE` hints or raw SQL | `DatabaseLocks` standing row + `ExecuteUpdate` | Allowed by the no-inline-SQL rule, already used for order numbers |
| URL list state | Manual `URLSearchParams` | `createListParams` + parsers in `@/lib/url-state` | WEB-10 rules, replace vs push |
| Phone parsing | A regex | `PhilippinePhone.TryParse` + `IsMobile` | Already accepts spaces, dashes, dots, brackets and +63 |

**Key insight:** this phase is mostly composition. Every risky primitive (files, email, locks, throttles, idempotency) has a tested in-house version; new code should be glue and rules.

## Common Pitfalls

### Pitfall 1: IIS refuses a multi-photo body before the app sees it
**What goes wrong:** a 20 MB+ post returns an IIS 404.13 page, not the app's 413 ProblemDetails; the visitor loses the text.
**Why:** `maxAllowedContentLength="11534336"` applies to every route [VERIFIED: src/Csps.Server/web.config:13].
**How to avoid:** Pattern 1. Keep the photo route's own limit at `ImageUploadLimits.BodyBytes`.
**Warning signs:** any plan that posts `FormData` with more than one file.

### Pitfall 2: The cleanup schedule does not match the promises
**What goes wrong:** D-04 promises Spam photos go "within a day" and the UI-SPEC Privacy rows say "Deleted within a day" and "Deleted 6 months after we receive them", but the maintenance workflow runs once a month: `- cron: "17 19 1 * *"` [VERIFIED: .github/workflows/maintenance.yml:9], and an architecture test pins that exact line [VERIFIED: tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs:34]. Phase 12 ruled "The maintenance run stays monthly ... No weekly cron line is added." [VERIFIED: .planning/phases/12-consent-analytics-legal/12-CONTEXT.md:70] and Phase 12 D-46 already worded the held quote line "Kept for about 6 months after we receive them; removed at the next monthly cleanup." [VERIFIED: web/src/modules/public/legalPrivacy.ts:337].
**How to avoid:** do not write the Privacy text or the Spam dialog copy until OQ-1 is ruled. Also: GitHub runs schedules only from the default branch, so any schedule change takes effect only after merge to main (the workflow comment says so).
**Warning signs:** copy that says "within a day" while the cron line is unchanged.

### Pitfall 3: The stray sweep deletes live quote photos, or never cleans quote strays
**What goes wrong:** the sweep lists only `$"{storage.RootFolder}/orders/"` and `$"{storage.RootFolder}/content/"` [VERIFIED: src/Csps.Application/Maintenance/StraySweepJob.cs:69-72], and `ImageInventory` knows ids only from order images, product line photos, gallery entries and the share picture. Put quote photos under either folder and they are queued as strays after 2 days; put them in a new folder without a sweep pass and failed uploads leak forever.
**How to avoid:** new `{root}/quotes/` folder, a third sweep pass with its own cursor name, and `QuoteRequestPhotos` added to the inventory union. Test both directions.

### Pitfall 4: Bot guards that eat real leads
**What goes wrong:** browser autofill or a password manager fills the honeypot, or a slow ticket check drops a real visitor, and D-25 makes it look like success: the lead is gone with no trace.
**How to avoid:** a honeypot name and label that no autofill heuristic matches (avoid name, email, phone, address, company, organization, website, url); `autocomplete="off"`, `tabIndex={-1}`, inside an `aria-hidden` visually hidden wrapper (UI-SPEC). Expired tickets refetch and resend instead of silent success. Log each catch with a reason code so the owner can see if catches spike.

### Pitfall 5: Carrier-grade NAT makes "per connection" mean "per carrier tower"
**What goes wrong:** many Philippine mobile users share one public IPv4 address behind carrier NAT, so 5 requests an hour per IPv4 could block unrelated visitors [ASSUMED]. The partition key already groups IPv6 by /64 (`PartitionKey` in `RateLimitingRegistration.cs`), which helps on IPv6-enabled networks.
**How to avoid:** keep the number a setting (D-26), make the 429 copy offer Messenger (UI-SPEC does), and log 429 counts for the quote policy so the owner can tune it after launch. Note also that the limiter reads `Connection.RemoteIpAddress` only, by design until the proxy topology is proven [VERIFIED: RateLimitingRegistration.cs doc comment].

### Pitfall 6: The public bundle budget
**What goes wrong:** Contact measured 145.22 KB of 150 KB after Phase 12.1 [VERIFIED: .planning/phases/12.1-.../12.1-13-SUMMARY.md:156]. A minified test bundle of `useForm` + `zodResolver` + a zod classic schema like the quote form measured 35,593 B gz; zod classic alone 23,198 B; zod/mini alone 6,160 B; RHF alone 11,852 B [VERIFIED: rolldown 1.2.11 bundle of the installed packages, gzip level 9, this session]. The gate counts only static imports ("Dynamic imports are not followed; they load later." [VERIFIED: web/scripts/budget.ts:5-7]), but Phase 12 started counting the legal loader chunk because it is part of the first view (D-42, `LEGAL_LOADERS` [VERIFIED: web/scripts/budget.ts:114]). So a lazily loaded form is technically outside the gate yet against the spirit of D-42.
**How to avoid:** OQ-2 ruling before the Contact plan. Whatever is chosen, measure with `npm --prefix web run build:budget` in the first Contact task and record the figures.

### Pitfall 7: The quote phone rule is looser than the order phone rule
**What goes wrong:** `PhilippinePhone` drops spaces, dashes, dots and brackets (`c is '-' or '.' or '(' or ')'` [VERIFIED: src/Csps.Domain/Content/PhilippinePhone.cs:90]) but `OrderRules.IsValidContactNumber` allows only digits, space, `+`, `-`, `(`, `)` (no dot). A visitor's "0917.123.4567" passes the form and then fails the prefilled New Order form.
**How to avoid:** store the parsed E.164 value plus a display form, and prefill the order with the display form. Bound the raw input at the order's `ContactNumberMaxLength = 30`. Also reuse `OrderRules` limits for name 100, team 100, email 254 and notes 2000 (UI-SPEC caps the message at 2,000 for this reason) [VERIFIED: src/Csps.Domain/Orders/OrderRules.cs:15-30], and use `OrderRules.IsValidEmail` so a quote email is always an order-valid email.

### Pitfall 8: Pixel limits on photos sent as-is
**What goes wrong:** order photos are shrunk in the browser to 2000 px before the server checks `MaxPixels = 25_000_000` and `MaxSide = 10_000` [VERIFIED: ImageUploadSettings.cs:23-26; web/src/utils/images.ts comment "the server's pixel and side limits are checked on the shrunk photo"]. D-05 sends originals, so a 50 MP phone photo is refused. Cloudinary's free plan also limits images to 10 MB and reportedly 25 MP [CITED: cloudinary.com/documentation/pricing (10 MB); ASSUMED for 25 MP, forum posts only].
**How to avoid:** keep the 25 MP rule for quote photos (it matches the reported plan limit), add the same check in the browser when the browser can decode the file, and treat a server refusal as a D-03 missing photo with a reason. HEIC usually cannot be decoded outside Safari; then the server decides (document this as the one OR-3 gap, or read the HEIC `ispe` box in the browser).

### Pitfall 9: "Full original" is really 2000 px
**What goes wrong:** D-05 says staff see the full original for logo detail, but the private viewer's "Open Full Size" is the named size `csps_full_2000` with `"c_limit,w_2000,h_2000/q_auto/f_jpg"` [VERIFIED: src/Csps.Infrastructure/Images/ImageNamedSizes.cs:47]. Private delivery here uses named transformations only.
**How to avoid:** OQ-3. A new named size means running the Cloudinary setup command again on the live account (owner step).

### Pitfall 10: Two copies of legal facts and page heads
**What goes wrong:** the Privacy version and approval live in `web/src/modules/public/legalPages.ts` (`version: '1.0'`, `approved: true` [VERIFIED: legalPages.ts:28-30]) and in `src/Csps.Domain/Content/LegalPages.cs` (`new("privacy", "/privacy", "1.0", new DateOnly(2026, 11, 21), Approved: true)` [VERIFIED: LegalPages.cs:18]), which drives noindex and the sitemap. The /contact meta description lives server side in `PublicPageHeads.cs` ("Message us on Messenger or call the shop. See our hours, address and map." [VERIFIED: PublicPageHeads.cs:25-26]) and in the client title code.
**How to avoid:** change both sides in the same task; keep or add a test that compares them.

### Pitfall 11: New audit actions need web labels and counts
**What goes wrong:** `AuditActionsTests` asserts `AuditActions.All.Count.ShouldBe(132)` [VERIFIED: tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs:14] and the audit viewer maps every code to a label (`auditCopy.ts`, e.g. `{ code: 'order-image.added', label: 'Order photo added', group: ORDERS }`) with a completeness test.
**How to avoid:** each new action (created by staff edits only: status changed, note added, deleted, converted, alerts address changed is covered by `site-settings.changed`, test email sent) updates `AuditActions.All`, the count test and `auditCopy.ts`. The visitor's own submission has no creator (SEC-08) and needs no audit row; the purge job reports counts only.

### Pitfall 12: The alert address field can be cleared by an old form
**What goes wrong:** Business info save treats an empty optional value as "clear" (BusinessInfo doc: "An empty optional value clears it"). Adding `QuoteAlertsEmail` to `UpdateSiteSettingsRequest` means any client that omits it clears the address.
**How to avoid:** the web form always sends the field; add a test that a save without the field is a 400 or keeps the value, whichever the planner chooses, and say which in the plan.

## Code Examples

Skeletons only. Names marked "new" are proposals; every existing name below was read this session.

### Create handler order of work
```csharp
// New: CreateQuoteRequestHandler.HandleAsync (sketch)
// 1. Ticket and honeypot: caught -> return a fake success (random id, no slots saved); log reason code only.
// 2. Validate (FluentValidation; messages = UI-SPEC § Validation).
// 3. One transaction:
await unitOfWork.InTransactionAsync(async token =>
{
    requests.Add(request);                 // status New, slots with cleaned file names, SHA-256 of the upload key
    await alertLock.TakeAsync(token);      // new "quote-alerts" standing lock row (DatabaseLocks pattern)
    var sent = await outbox.CountRecentAsync(AuthEmailKind.QuoteAlert /* new = 12 */, address, hourStart, token);
    if (sent < settings.AlertsPerHour) await outbox.EnqueueAsync(new QuoteAlertEmail(/* new */), token);
    else if (!await OverflowSentAsync(hourStart, token)) await outbox.EnqueueAsync(new QuoteAlertsOverflowEmail(/* new */), token);
    await unitOfWork.SaveChangesAsync(token);
    return Result.Success(request.Id);
}, cancellationToken);
```

### Photo upload reuse
```csharp
// Source pattern: src/Csps.Application/Orders/UploadOrderImageHandler.cs (read this session)
var inspected = ImageInspection.Check(request.Bytes, request.FileName, settings);
var cleaned = ImageMetadataStripper.Strip(facts.Kind, request.Bytes.Span, request.FileName);
var publicId = PublicIds.NewQuote(storage.RootFolder, requestId);          // new helper: {root}/quotes/{id}/{random}
var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.QuoteFolder(storage.RootFolder, requestId), clean, facts.Kind), cancellationToken);
if (!stored.Succeeded && stored.FailureCode == ImageFailureCodes.Transient)
{
    await imageDeletions.EnqueueNowAsync(publicId, ImageDeletionReason.UploadUndone, CancellationToken.None);
}
```

### Time-limited ticket
```csharp
// Source: Microsoft.AspNetCore.DataProtection (ToTimeLimitedDataProtector extension) [CITED: learn.microsoft.com Data Protection docs]
var protector = provider.CreateProtector("Csps.QuoteTicket.v1").ToTimeLimitedDataProtector();
string ticket = protector.Protect(issuedAtText, lifetime: settings.TicketLifetime);
// On submit: Unprotect throws CryptographicException when expired or tampered -> 400 ticket code (client refetches);
// a valid ticket younger than settings.MinimumSeconds -> caught bot (D-25).
```

### Rate-limit rule shape (existing)
```csharp
// Source: src/Csps.Server/Security/RateLimitSettings.cs:78 (read this session)
public static RateLimitRule Default() => new() { PermitLimit = 30, Window = TimeSpan.FromMinutes(10) };
// Phase 13 adds, the same way: QuoteCreateRateLimit (PermitLimit = 5, Window = 1 hour, D-26),
// a quote photo policy, a site-wide ceiling for creates (discretion), and a test-email policy.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CAPTCHA puzzles on lead forms | Honeypot + timing + rate limits | WCAG 2.2 (3.3.8 Accessible Authentication) | INQ-03 already rules it; no puzzle |
| Phase 11 `ContactNowCard` placeholder | The quote form (App. E.4 restored) | Phase 13 | The card and its "What to send" list are removed (UI-SPEC) |
| Privacy Policy without quote lines (Phase 12 D-82) | `PRIVACY_QUOTE_REQUEST_LINES` re-inserted, version 1.1, DRAFT | Phase 13 | Update "files" to "photos", add converted and Spam rows per the OQ-1 ruling |

**Deprecated/outdated in this repo:** none touched by this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Many Philippine mobile visitors share one public IPv4 address (carrier NAT), so 5/hour per address may block real people | Pitfall 5 | Leads bounced to Messenger more often than expected; tune the setting |
| A2 | Cloudinary's free plan refuses images over 25 megapixels | Pitfall 8 | If the limit is higher, the 25 MP rule refuses some photos needlessly; if lower, uploads fail as missing photos |
| A3 | A 3 second minimum time and a 24 hour ticket life are reasonable starting values | Pattern 2 | Too high drops fast typists into "caught"; too low lets simple bots through. Both are settings |
| A4 | The alert email's "Photos" line shows the number of photos the visitor attached (declared), because the alert is queued with the text before the photos arrive | Pattern 4 | If the owner wants only arrived photos counted, the alert must wait for the uploads, which risks losing the alert when the visitor closes the tab |
| A5 | iOS Safari may hand the page a HEIC file or convert it to JPEG depending on the `accept` list | Pitfall 8 | Only affects whether a preview shows; the server accepts both |
| A6 | A site-wide hourly ceiling on quote creates (proposal: 60 an hour) is acceptable under "rate-limit window and numbers" discretion | Pattern 2 | Under a large real campaign, visitors past the ceiling would see the 429 Messenger box |
| A7 | The upload key lifetime of 2 hours is long enough for slow mobile uploads | Pattern 1 | Too short turns slow uploads into missing photos |

## Open Questions

**Resolved (owner, 2026-11-21):** OQ-1 → D-34 (daily cleanup), OQ-2 → D-35 (form loads as its own piece), OQ-3 → D-36 (keep 2000 px). Bot-guard follow-up → D-37 (3 a day per phone or email). See `13-CONTEXT.md`.

These need the owner (plain words, recommendation first). Record each answer as a dated ruling in `13-CONTEXT.md` (D-34 onward).

1. **OQ-1: How soon does cleanup really run? (blocks D-04 copy, the Privacy rows and the purge promise)**
   - What we know: the cleanup runs once a month (1st of the month). Phase 12 ruled "stays monthly, no extra schedule line" (D-36). Phase 13 D-04 says Spam photos go "within a day".
   - Options: **A (recommended):** run the same cleanup every day (one schedule line, free on a public repo; the monthly-only jobs keep their own pace inside). Reason: it makes "within a day" and "6 months" true, and the jobs are already safe to repeat. This reverses Phase 12 D-36, so it needs your yes. **B:** keep monthly and change the words: Spam photos "removed at the next monthly cleanup", quote requests "about 6 months". Reason: no schedule change, but a Spam photo can stay up to a month. **C:** delete Spam photos from Cloudinary right away in the background on the server. Reason: fastest, but it breaks the Phase 9 rule that a request never deletes from storage directly.
2. **OQ-2: The quote form does not fit the Contact page size limit (blocks the Contact plan)**
   - What we know: Contact has about 4.8 KB left of 150 KB. The form tools measure about 35.6 KB (about 6.2 KB for the smallest zod version alone).
   - Options: **A (recommended):** load the form as its own piece right after the page appears, with a placeholder of the same size so nothing jumps, and add a separate size limit for that piece (for example 45 KB) so it cannot grow unnoticed. Reason: the page itself stays inside the limit and the form keeps the same tools as the admin forms. **B:** build a much smaller form without the admin form tool and with the small zod version. Reason: closest to one fast page, but still about 2 to 4 KB over, so something else on the public pages must also shrink, and it is a second way of building forms to maintain. **C:** raise the public limit. Not recommended: the project rule says never raise a limit to make a build pass.
3. **OQ-3: "Full original" photos (affects D-05 viewing)**
   - What we know: staff today can open photos up to 2000 pixels on the long side, as JPEG.
   - Options: **A (recommended):** keep 2000 pixels for now. Reason: no Cloudinary setup step, and 2000 pixels shows most logo detail. **B:** add a larger "original" size for quote photos. Reason: true full detail, but you must run the Cloudinary setup command again on the live account, and each view uses more of the free plan.
4. **Wording follow-ups once OQ-1 is ruled** (planner drafts, owner approves with the Privacy Policy, Phase 12 D-14): the UI-SPEC rows "Deleted 6 months after we receive them" and "Deleted within a day", the Spam dialog sentence, and the privacy notice sentence "We keep requests that don't become orders for 6 months."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build, tests, migrations | ✓ | 10.0.402 (global.json 10.0.401, latestPatch) | none |
| Node.js | web build, Vitest, Playwright | ✓ | v24.21.0 | none |
| LocalDB `(localdb)\MSSQLLocalDB` | integration tests (`CSPS_TEST_SQL=localdb`) | not probed (no DB commands run this session, by owner rule) | none | CI SQL 2025 container |
| Cloudinary account | real uploads | dev uses `TestingImageStorage` | none | Testing doubles in Debug; live check is an owner step |
| SMTP | alert emails | dev uses the in-memory sink | none | `InMemoryEmailSink` in tests |
| GitHub Actions maintenance workflow | purge, Spam photo removal | ✓ (monthly) | none | "Run now" manual dispatch |

**Missing dependencies with no fallback:** none for planning. **Owner-only steps:** set the Quote alerts address on the live site, send a test email, and (carry-over) add the first live Gallery photo and check it on a phone with no CSP error.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | .NET: xunit.v3 (MTP v2), Shouldly, NSubstitute, FakeTimeProvider, ArchUnitNET. Web: Vitest 5 + RTL + user-event + MSW 3 + in-house axe matcher. E2E: Playwright 1.63 + @axe-core/playwright |
| Config file | `global.json` (test runner MTP), `tests/Directory.Build.props`, `web/vitest.config.ts`, `web/playwright.config.ts` |
| Quick run command | `CSPS_TEST_SQL=localdb dotnet test --project tests/<Project> --filter-class "*<Class>*"` or `npm --prefix web run test -- --run <path>` |
| Full suite command | after `preflight.ps1 -Ports 5180,5115,7028,5199`: `dotnet test Csps.slnx` and `npm --prefix web run verify` |
| Estimated runtime | quick about 30 s; full about 15 to 25 min |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INQ-01 | Field rules and messages (name, team, PH mobile only, email, product choice, range, message ≤ 2,000) | unit (Domain/Application) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CreateQuoteRequestRequestValidatorTests"` | ❌ Wave 0 |
| INQ-01 | zod schema mirrors every server message | unit (web) | `npm --prefix web run test -- --run src/modules/public/quoteSchemas.test.ts` | ❌ Wave 0 |
| INQ-01 | Create saves text and answers id and slots; replay with same key returns the same answer | integration | `... tests/Csps.Server.IntegrationTests --filter-class "*CreateQuoteRequestTests"` | ❌ Wave 0 |
| INQ-01 | Form states: errors, sending, success, rate limited, failed, maybe-sent; keeps typed values | component | `npm --prefix web run test -- --run src/modules/public/components/QuoteForm.test.tsx` | ❌ Wave 0 |
| INQ-02 | Photo by magic bytes, ≤ 10 MB, ≤ 25 MP, slot 0..4, wrong key or id gives the same 404, private folder `{root}/quotes/` | integration | `... --filter-class "*UploadQuotePhotoTests"` | ❌ Wave 0 |
| INQ-02 | Picker refuses wrong type, over 10 MB, a sixth photo, before sending; previews; focus after Remove | component | `npm --prefix web run test -- --run src/modules/public/components/QuotePhotoPicker.test.tsx` | ❌ Wave 0 |
| INQ-02 / D-03 | With storage failing, the request is saved, the alert is queued and the slot shows missing | integration | `... --filter-class "*QuotePhotoFailureTests"` (uses `TestingImageStorage` failure hooks) | ❌ Wave 0 |
| INQ-03 | Honeypot filled or ticket too young: success-shaped answer, nothing saved, log counter | integration | `... --filter-class "*QuoteBotGuardTests"` | ❌ Wave 0 |
| INQ-03 | Expired ticket: 400 ticket code; client refetches and resends once | integration + component | `... --filter-class "*QuoteBotGuardTests"`; `QuoteForm.test.tsx` | ❌ Wave 0 |
| INQ-03 | Sixth create from one address in the window: 429 with Retry-After; settings validated at start | integration | `... --filter-class "*QuoteRateLimitTests"` | ❌ Wave 0 |
| INQ-04 | Alert row commits with the request; rollback queues nothing; no attachment; subject cut at 60 with "…"; empty lines left out; message cut at 300; HTML-escaped | unit + integration | `... tests/Csps.Infrastructure.IntegrationTests --filter-class "*QuoteAlertEmailTests"`; `... --filter-class "*EmailRendererTests"` | ❌ Wave 0 |
| INQ-04 / D-09 | 21st alert in an hour becomes one overflow email; two parallel creates never exceed 20 | integration | `... --filter-class "*QuoteAlertCapTests"` | ❌ Wave 0 |
| INQ-05 | Status machine: free moves, Converted only by conversion, history rows | unit (Domain, 100%) | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*QuoteRequestTests"` | ❌ Wave 0 |
| INQ-05 | List filters, pill counts, search on name, team, phone digits; q over 100 chars is a 400; New count | integration | `... --filter-class "*ListQuoteRequestsTests"` | ❌ Wave 0 |
| INQ-05 | Stale version 409; Spam queues photo removals; Manager delete (not Converted) queues removals and audits | integration | `... --filter-class "*QuoteRequestStatusTests" --filter-class "*DeleteQuoteRequestTests"` | ❌ Wave 0 |
| INQ-05 | Every new endpoint × {anonymous, Admin, Manager} | integration | `... --filter-class "*AuthorizationMatrixTests"` | ✅ (add rows) |
| INQ-05 | Inbox URL state, pills roving focus, NavCount names, fifth tab | component | `npm --prefix web run test -- --run src/modules/admin/pages/QuoteRequestsPage.test.tsx src/components/navigation/Sidebar.test.tsx` | ❌ / ✅ |
| INQ-06 | Prefill values; order save links and sets Converted; second save 409 with order number; filtered unique index | integration | `... --filter-class "*QuoteConversionTests"` | ❌ Wave 0 |
| INQ-06 | 2,000-char message prefills Notes and passes the order schema | unit (web) | `npm --prefix web run test -- --run src/modules/admin/orderFormSchemas.test.ts` | ✅ (add case) |
| INQ-06 / D-22 | Permanent order delete removes the linked request and queues its photos | integration | `... --filter-class "*PermanentlyDeleteOrderTests"` | ✅ (add case) |
| INQ-07 | Unconverted older than 6 months purged with photos queued; converted kept; constant tested | integration | `... tests/Csps.Infrastructure.IntegrationTests --filter-class "*QuoteRequestRetentionJobTests"` | ❌ Wave 0 |
| INQ-07 | Stray sweep covers `{root}/quotes/`; inventory knows quote photo ids | unit | `... tests/Csps.Application.UnitTests --filter-class "*StraySweepJobTests"` | ✅ (add cases) |
| INQ-08 | Notice text and link; Privacy 1.1 DRAFT in both `legalPages.ts` and `LegalPages.cs` | component + node | `npm --prefix web run test -- --run src/test/legal-pages.node.test.ts src/modules/public/components/QuoteForm.test.tsx` | ✅ / ❌ |
| PERF-01 | Contact within budget (per OQ-2 ruling) | build gate | `npm --prefix web run build:budget` | ✅ |
| A11y, CSP | Contact, inbox, request page: zero axe, no CSP errors, 320 to 1920 px | e2e | `npm --prefix web run e2e -- --grep "@quote"` (after preflight) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick command for the touched test files.
- **Per wave merge:** preflight, then `dotnet test Csps.slnx`, `dotnet format Csps.slnx --verify-no-changes --no-restore`, `npm --prefix web run verify`, `npm --prefix tools/openapi-gen run check`.
- **Phase gate:** full suites green, `npm --prefix web run e2e` for the quote tags in all five projects, `npm --prefix web run lighthouse`, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Domain tests: `tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs`, `QuoteRequestRetentionTests.cs`
- [ ] Application tests: validators, handlers (create, photo, status, note, delete, prefill, alert test send)
- [ ] Server integration tests: create, photo, bot guards, rate limits, cap, conversion, list, status, delete, authorization rows
- [ ] Infrastructure integration tests: retention job, inventory, email rendering, migration script check
- [ ] Web tests: `quoteSchemas.test.ts`, `QuoteForm.test.tsx`, `QuotePhotoPicker.test.tsx`, `quoteService.test.ts`, admin pages and services, `quoteRequestsSchemas.test.ts`
- [ ] E2E spec with a `@quote` tag and MSW/Testing fixtures for the public form and inbox
- No framework install needed.

## Security Domain

`security_enforcement: true`, ASVS level 1 (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (public form is anonymous by design) | Staff side uses existing JWT |
| V3 Session Management | no new sessions | Existing |
| V4 Access Control | yes | `Policies.Staff` / `Policies.Manager` (verified constants "Staff", "Manager"), authorization matrix, per-request upload key (same 404 for every miss) |
| V5 Input Validation | yes | FluentValidation in handlers + zod mirror; magic bytes; length caps; search ≤ 100 |
| V6 Cryptography | yes (light) | Data Protection time-limited ticket; SHA-256 + `CryptographicOperations.FixedTimeEquals` for the upload key; `RandomNumberGenerator` ids (`PublicIds`) |
| V7 Errors and Logging | yes | No address, phone, message or IP in logs; catch reason codes only (CWE-532) |
| V8 Data Protection | yes | Outbox bodies already Data-Protection-encrypted; retention job; Manager delete; alerts address never public |
| V12 Files | yes | Private type, metadata strip, size and pixel caps, no disk, upload slots |
| V13 API | yes | Idempotency-Key on every POST, rate limits, ProblemDetails |

### Known Threat Patterns for this stack

| Pattern | CWE / STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file upload | CWE-434 / Tampering | Photos only by magic bytes, metadata strip, private storage, no PDF/AI (D-01) |
| Resource exhaustion (body, memory, Cloudinary credits) | CWE-400, CWE-770 / DoS | One photo per call, IIS and app body caps, upload slots 2+4, per-address and site-wide limits, 5 photos per request |
| Spam and email abuse | CWE-799 / DoS | Honeypot, server ticket, rate limits, no visitor email (D-10), alert cap 20/hour (D-09) |
| Stored XSS via message or name | CWE-79 / Tampering | Text-only rendering in React; HTML-encode in email (renderer already encodes every value) |
| IDOR on photo upload or detail | CWE-639 / Elevation | Upload key hash per request; staff endpoints behind policies; same 404 for every miss |
| Mass assignment of status, creator, order id | CWE-915 / Tampering | Request DTOs carry no such fields; server sets stamps (SEC-08) |
| Open redirect via `?product=` | CWE-601 / Spoofing | `isLineKey` allow-list and visible-lines check; never used in a link target (UI-SPEC) |
| PII in logs or URLs | CWE-532, CWE-598 / Information disclosure | Log codes only; name never in titles; personal data only inside `q` |
| Race on conversion or alert cap | CWE-362 / Tampering | `ExecuteUpdate` row lock, filtered unique index, standing lock row |
| Cross-site form posting | CWE-352 / Spoofing | Every POST needs a custom `Idempotency-Key` header (forces a preflight) and the ticket from a same-origin GET |

## Sources

### Primary (HIGH confidence, read this session)
- Codebase files cited inline: `OrderImagesController.cs`, `UploadOrderImageHandler.cs`, `ImageUploadSettings.cs`, `PublicIds.cs`, `IImageStorage.cs`, `IImageDeletionQueue.cs`, `CloudinaryImageStorage.cs`, `ImageNamedSizes.cs`, `ImageInventory.cs`, `StraySweepJob.cs`, `IMaintenanceJob.cs`, `RunMaintenanceHandler.cs`, `PurgeExpiredRecordsJob.cs`, `AnalyticsRetentionJob.cs`, `IEmailOutbox.cs`, `AuthEmail.cs`, `OutboxEmailSender.cs`, `EmailDispatcher.cs`, `EmailRenderer.cs`, `EmailHtmlLayout.cs`, `EmailOutboxMessageConfiguration.cs`, `RateLimitSettings.cs`, `RateLimitingRegistration.cs`, `UploadSlotsMiddleware.cs`, `IdempotencyMiddleware.cs`, `IdempotencyGate.cs`, `DatabaseLocks.cs`, `OrderStore.cs`, `CreateOrderRequest.cs`, `CreateOrderHandler.cs`, `OrderRules.cs`, `PhilippinePhone.cs`, `BusinessInfo.cs`, `SiteLinks.cs`, `UpdateSiteSettingsRequest(+Validator).cs`, `RecordStampInterceptor.cs`, `IAttributedRecord.cs`, `LegalPages.cs`, `PublicPageHeads.cs`, `web.config`, `.github/workflows/maintenance.yml`, `MaintenanceWorkflowTests.cs`, `AuditActionsTests.cs`, `AuthorizationMatrix.cs`, `web/scripts/budget.ts`, `web/src/utils/images.ts`, `web/src/modules/public/legalPrivacy.ts`, `legalPages.ts`, `web/package.json`
- Phase docs: `13-CONTEXT.md`, `13-UI-SPEC.md`, `12-CONTEXT.md` (D-02, D-07, D-36, D-46, D-82), `12.1-13-SUMMARY.md` (budget figures), `REQUIREMENTS.md`
- Local measurement: rolldown 1.2.11 minified ESM bundles of the installed react-hook-form 7.89.0, @hookform/resolvers 5.9.1 and zod 4.6.7, gzip level 9 (scratch files only)

### Secondary (MEDIUM confidence)
- [Cloudinary pricing documentation](https://cloudinary.com/documentation/pricing.md): Free plan max image file size 10 MB
- Microsoft Learn, ASP.NET Core Data Protection, "Limit the lifetime of protected payloads" (`ITimeLimitedDataProtector`) [CITED, from prior knowledge of the official docs page; API ships in the shared framework already used by the app]

### Tertiary (LOW confidence)
- [Cloudinary support: limits on all plans](https://support.cloudinary.com/hc/en-us/community/posts/115000698971-Limitation-of-upload-transformed-image-in-all-plans) and [community thread on the 25 MB limit](https://community.cloudinary.com/discussion/comment/2009): 25 MP free-plan figure (forum posts, not the official table)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Everything is installed and pinned; no new packages.
- Architecture: HIGH for reuse points and the two-step send (forced by verified IIS and memory limits); MEDIUM for exact endpoint names and numbers (planner's call).
- Pitfalls: HIGH for 1 to 3, 6, 7, 9 to 12 (read from code); MEDIUM for 4, 5 and 8 (behavioral assumptions noted in the log).

**Research date:** 2026-11-21
**Valid until:** 2026-12-21 (stable codebase; re-check the budget figure after any public-page change)
