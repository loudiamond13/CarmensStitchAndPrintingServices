# Feature Research

**Domain:** Order management (admin portal) and marketing site for a small Philippine custom-apparel shop (full-sublimation team jerseys) that also does tailoring
**Researched:** 2026-10-06
**Confidence:** MEDIUM overall. Classifications of documented features are HIGH because they come straight from `CSPS-PRD.md` and `CSPS-UI-SPEC.md`. Domain-norm claims are MEDIUM: competitor products and PH regulatory sources were cross-checked through web search. PH shop-practice claims with no authoritative source are marked LOW.

**How to read this file**

- **Cx** is complexity: **S** is about a day or less of TDD work, **M** is a few days, **L** is a week or more, or touches security, files or money invariants.
- **Source** gives the PRD requirement ID and/or the UI-spec section. **GAP** means neither document covers the feature.
- **Proposed IDs** are new IDs for features with no PRD §6 ID: `DASH-`, `INQ-`, `GAL-`, `CONT-`, `LEGAL-`, `AUDIT-`, `MIG-`, and `ORD-10+` / `CEXP-03+` / `USER-07+` / `PUB-05+` / `PROF-04+`. REQUIREMENTS.md should adopt or renumber them.
- This file classifies the features and analyses the conflicts. It does **not** rule on owner decisions (OD-x) or conflicts (C-x).

---

## Domain Landscape in One Paragraph

Print-shop SaaS products (Printavo, YoPrint, ShopVOX) all share a common core. It has six parts:

- quote → order conversion
- line items with pricing
- mockup/proof approval
- deposit plus final-payment tracking
- a status pipeline from quote to pickup with due dates
- a customer record with history

On top of that core they add profitability/KPI dashboards and an **Inquiries inbox fed by the website contact form**. Team-apparel platforms (Wooter, Exclaim, TeamSeams) add one more first-class artifact: the **roster** of player name, number and size. Tailoring tools (Orderry, Odoo verticals) add **measurement profiles** and fitting dates. CSPS already covers the core except quotes, approvals and customer records. It deliberately skips the SaaS extras: online payments, customer portal, inventory and purchase orders. That's the right call for a shop with about 5 staff whose customers live on Facebook Messenger.

The documents have three domain-level holes:

1. There's no admin side for inquiries.
2. There's no structured size breakdown or roster.
3. There's nowhere to keep non-image files, such as rosters and AI/PDF artwork.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Staff or visitors are failed if any of these is missing. They are grouped by area.

#### A. Staff authentication & sessions (PRD §6.1, §8; UI §8.2)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| AUTH-01 | Email + password sign-in, generic error | Baseline. Enumeration-safe error (CWE-204) | S | Identity, rate limiter | UI copy "Email or password is incorrect." already fits the generic rule |
| AUTH-02 | Mandatory 6-digit email second factor | Owner requirement. Shared-device shop, staff Gmail accounts | M | **Email sender (SMTP, OD-12)**, pending-login ticket | UI spec has no screen (C-6). Compose it from `OtpInput` + the Login layout |
| AUTH-03 | Code: 15 min, single use, 5 wrong attempts | Brute-force bound | S | AUTH-02, `IClock` | Pure domain logic, fully unit-testable |
| AUTH-04 | Resend with 60 s cooldown, 5/hour | Email delays are common on shared SMTP | S | AUTH-02, rate limiter | Needs a visible countdown (SPEC-GAP) |
| AUTH-05 | Remember me: 90 days absolute, else browser session ≤ 12 h | Staff use their own phones. The PWA needs long sessions | M | Refresh-token families | **C-19**: the UI checks it by default |
| AUTH-06 | Sign out; sign out of all devices | Lost-phone response | M | Refresh-token store | "All devices" lives on Profile (SPEC-GAP: no UI drawn) |
| AUTH-07 | Lockout after 5 failures / 15 min + email notice | CWE-307 | S | Identity lockout, email | |
| AUTH-08 | Forgot password by email (30 min, single use) | Without it, every forgotten password becomes a Manager ticket | M | Email sender | **C-7**: the UI spec stubs it with a toast |
| AUTH-09 | Reset enforces policy, revokes sessions, sends notice | CWE-640/613 | S | AUTH-08, password policy | **C-5** affects the policy copy |
| AUTH-10 | Deactivated/locked users cannot sign in, refresh or reset | Offboarding | S | USER-03 | **C-8**: the UI shows a distinct "deactivated" banner |

#### B. Profile (PRD §6.2; UI §8.10)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| PROF-01 | Edit first/last name | Names appear on "Recorded by" | S | — | |
| PROF-02 | Email change with confirmation to the new address and a notice to the old one | Account-takeover defence | M | Email sender, token store | **C-9**: the UI toast says "updated" immediately |
| PROF-03 | Password change: current password, policy, revoke other sessions, notify | Baseline | S | Password policy, session revocation | UI hint copy conflicts (**C-5**) |
| PROF-04 *(proposed)* | Theme toggle Blush/Espresso persisted in `localStorage['csps-theme']` | Defined by UI §2.7 | S | Admin layout | **C-11**: PRD wanted `prefers-color-scheme` |

#### C. User management, Manager only (PRD §4, §6.3; UI §8.9)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| USER-01 | List, search, filter by role/status | Baseline admin | S | — | |
| USER-02 | Create user via emailed invitation | SaaS norm | M | Email sender, token store | **C-4**: the UI uses a Manager-set temporary password |
| USER-03 | Edit, role, lock/unlock, deactivate/reactivate, delete | Offboarding | M | Session revocation | Delete must keep "Recorded by" history. The UI copy promises "records stay, under their name", so users need soft-delete or name snapshots |
| USER-04 | Guard rules: no self-demote/delete, never remove the last active Manager | Lock-out prevention | S | — | The UI only hides your own row's buttons. The server must enforce the last-Manager rule |
| USER-05 | Role/status change revokes sessions immediately | CWE-613 | S | Refresh-token store | The 15-min access token remains valid. Document that window or check a session stamp |
| USER-06 | Audit every user-management action | Accountability | S | AUDIT-01 | |
| USER-07 *(GAP)* | **Resend invitation / send password-reset link** from the Users screen | Invitations expire. Staff lose emails | S | USER-02, AUTH-08 | Neither doc has it. Needed whichever way C-4 goes |

#### D. Orders (PRD §5.1, §6.4; UI §8.5–8.7, §9)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| ORD-01 | Preview list: number, customer, dates, status, Total/Paid/Discount/Balance, cover thumbnail | The core daily screen | M | Order aggregate, ORD-04 (thumbnail), server totals | Totals must be projected in SQL. No N+1 (PRD §7.1) |
| ORD-02 | Search (number, customer, phone, **team**), filters (status, date range, has balance, **product type**), sort, server pagination | Finding "the San Roque order" fast | M | Indexes | The UI adds team search and a product-type filter, plus a "Due date (soonest)" default sort and an "Active + recent" default status filter, which the PRD doesn't list. Pin these definitions down |
| ORD-03 | Create order (details + ≥1 item, transactional) | Core | M | Order aggregate | **C-3**: the PRD wants a one-flow create with payments and discount. The UI does details + images + items, then children on the detail page |
| ORD-04 | Order images: upload, reorder, cover, alt text, delete | Mockups are the product. Staff show them on Messenger | L | Cloudinary, signed upload, cleanup job, OD-9 | **C-2** (5 vs 12), **C-16** (drag/hover-only reorder) |
| ORD-05 | Edit details; CRUD items, payments, discount(s), expenses with recomputed totals | Daily: downpayment, then settlement | M | Aggregate invariants | **C-1** (one vs many discounts). See the "invariant re-check" note in Dependency Notes |
| ORD-06 | Delete order with cascade confirmation (counts, type-to-confirm) | Mistakes happen. Make deletion deliberate | M | Cloudinary cleanup, AUDIT-01, OD-5 | UI §9.3 says "permanently deleted". The PRD recommends soft delete |
| ORD-07 | Detail page: all children + computed summary | Core | M | ORD-05 | Labels differ (**C-13**) |
| ORD-08 | 409 on concurrency + reload | Two staff can edit the same order (counter + phone) | S | `rowversion` on the root | Child edits must bump the root's rowversion. See the STACK/ARCHITECTURE research |
| ORD-09 | Peso formatting, 2-decimal money input | Currency correctness | S | Formatters (OD-1) | `formatPeso` uses a U+2212 minus |
| ORD-10 *(proposed)* | Grid ⇄ table view toggle persisted in `csps-orders-view` | UI §8.5 | S | ORD-01 | |
| ORD-11 *(proposed)* | **Overdue / days-left indicators** (cards, table, detail subline, dashboard) | Deadlines (the liga opener) are the shop's main pressure | S | Due date (**C-14**), Asia/Manila "today" (OD-2) | Define overdue: due < today **and** status ∈ active. Completed/cancelled orders are never overdue |
| ORD-12 *(proposed)* | **"Fully Paid" state**: Total > 0 and Balance ≤ 0 | Staff need a glanceable "settled" signal before release | S | Server totals, OD-4 | Fixture ORD-2026-0151 |
| ORD-13 *(proposed)* | Product type per item (6 fixed types) + size/variant text | Drives filters, analytics and future pricing | S | — | UI §9.1. Not in PRD §5.1 |
| ORD-14 *(proposed)* | Order number generation `ORD-{YYYY}-{NNNN}`, per-year sequence | Human reference used on Messenger and in pickup | M | **C-15**, legacy numbering (MIG) | Concurrency-safe per-year counter. Legacy numbers must survive |
| ORD-15 *(proposed)* | Unsaved-changes guard on create/edit ("Discard changes?") | Long forms on phones | S | Router blocker | PRD §9.4 + UI §8.6 (SPEC-GAP) |
| ORD-16 *(GAP)* | **Status change history** (who moved it to Ready, when) | Accountability across 5 staff. Printavo shows a status timeline | M | AUDIT-01 or an `OrderStatusChange` child | Today the audit log covers deletions only (PRD §11.4) |
| ORD-17 *(GAP)* | **Status transition rules** | OD-3 says transitions are undefined | S | OD-3 | Domain norm: allow forward and back between active stages (mockup revisions); Cancelled reachable from any active stage; Completed/Cancelled terminal or Manager-reopen only |
| ORD-18 *(GAP)* | **Refund / cancelled-order payment handling** | A cancelled order with a ₱3,000 downpayment either forfeits or refunds. Neither doc models refunds | M | OD-4, ORD-05 | Without it, "Collected" and income charts overstate cash. Minimum: a "refund" payment type (negative) or a cancelled-with-payments flag. Owner decision |

#### E. Company expenses (PRD §5.2, §6.5; UI §8.8)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| CEXP-01 | List with pagination, date range, category filter, search, period total | Monthly bills tracking | M | — | UI default range is the last 30 days. Search covers "Description or staff name" |
| CEXP-02 | Create/update/delete with confirmation | Core | S | OD-5, OD-8, AUDIT-01 | |
| CEXP-03 *(proposed)* | KPI row: this month, last month (full), top category with % | UI §8.8 | S | Asia/Manila month boundaries | |
| CEXP-04 *(proposed)* | "Recorded by" attribution (avatar + name, read-only) | Who logged the Meralco bill | S | Users, USER-03 delete semantics | Must survive user deletion |

#### F. Admin dashboard (C-18: not in PRD §6, added by UI §8.3)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| DASH-01 | Greeting header + date in Asia/Manila; View Orders / New Order actions | UI §8.3 | S | OD-2 | |
| DASH-02 | KPI row: Active orders (+ "due this week"), Receivables, Collected · month (+ delta vs the same day last month), Company expenses · month (+ count, top category) | Owners expect a cash snapshot. Print-shop SaaS ships KPI dashboards | M | Orders, payments, expenses, OD-2 | Definition gaps: "this week" = Mon–Sun? "Same day last month" when today is Mar 31? Does Receivables include **overdue** orders? (yes, they're active) |
| DASH-03 | Income vs expenses chart, 6M/12M | Trend of the business | M | Payments, company + order expenses | Income = payments by **payment date** (cash basis). Code-split the chart (PRD §7.1) |
| DASH-04 | Orders by status ("Open orders + completed this month") | Workload view | S | Statuses (OD-3) | Seed shows Cancelled 1, but the subtitle doesn't mention cancelled. Define the window |
| DASH-05 | Recent orders (latest 6) | Quick jump | S | ORD-01 projection | |
| DASH-06 | Loading/empty/error states for all cards | UI §13 checklist | S | Skeleton primitives | |

#### G. Public site (PRD §6.6; UI §7)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| PUB-01 | Home, Products, Gallery, Contact + legal pages | Baseline marketing site | L | Design system, CONT-* | **C-12**: the UI adds Gallery and an inquiry form |
| PUB-02 | Business info and prices from the DB | Owner edits without a deploy | M | CONT-01/02, HybridCache | **C-21**: the UI product copy is static, with "[YOUR PRICE]" placeholders |
| PUB-03 | Manager content & price-list admin screens | Owner self-service | L | CONT-*, AUDIT-01 | SPEC-GAP: no admin screens drawn |
| PUB-04 | SEO: titles/meta, OG, robots, sitemap, LocalBusiness JSON-LD, admin `noindex` | Discovery on Google. **Link previews on Facebook** | M–L | Site settings, **server-side head injection** | Most traffic arrives from Facebook, and Facebook's link scraper does not execute JavaScript. Per-route title/OG/JSON-LD must sit in the initial HTML, so the SPA needs server-side `<head>` templating or build-time prerender. Confidence MEDIUM |
| PUB-05 *(proposed)* | **"Open now / Closed now"** from hours in Asia/Manila | UI §7.4 | S | CONT-01 hours, CONT-04 holidays | Compute it on the client from the hours data. A cached server-rendered value goes stale |
| PUB-06 *(proposed)* | Messenger + phone CTAs (`m.me` link, `tel:`), sticky phone bar on Contact | Messenger is the shop's main sales channel | S | CONT-01 (Messenger URL, phone) | Use an `m.me` link, not the Meta chat plugin (retired May 2024) |
| PUB-07 *(GAP)* | 404 / not-found page and public error page | Broken FB-shared links happen | S | Public layout | Not in the UI spec. Compose from EmptyState |

#### H. Gallery (UI §7.3; no PRD ID)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| GAL-01 | Masonry gallery with category filter pills and counts | Social proof is the #1 conversion driver for team kits | M | Gallery data source | UI spec uses static SVG data. Real photos are needed at launch or the page is all placeholders |
| GAL-02 | Lightbox: position, prev/next wrap within filter, Esc/←/→, swipe on phones | UI §7.3 | M | GAL-01 | Focus trap + return (UI §10). Swipe needs a button alternative (WCAG 2.5.7). Buttons are hidden on phones in the spec, which is an a11y flag (OD-14) |
| GAL-03 *(GAP)* | **Gallery content management** (upload photo, category, team, pcs, note, order, publish/unpublish) | PRD PUB-03 says "edit **all** public content". A static gallery means a deploy per photo | M | Cloudinary (public delivery, separate from OD-9 order images), CONT-* | Neither doc draws this screen |

#### I. Inquiries / Get a Quote (UI §7.4 public side only; admin side is a SPEC-GAP, C-12)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| INQ-01 | Public inquiry form: name*, team, PH mobile*, email, product type, quantity range, message; validation copy per spec; success state | UI §7.4 | M | Rate limiter, anti-spam | PH mobile validation: `09xx xxx xxxx` / `+63`. Normalize to E.164 on the server |
| INQ-02 | Reference attachments: JPG/PNG/PDF/AI, 10 MB each, multiple | Customers send logos and sketches | L | Private storage, magic-byte validation, size/count caps | **CWE-434**. AI files are PDF- or PostScript-based. Never render, thumbnail or execute them server-side. Store them privately and serve them only to staff as `Content-Disposition: attachment` + `nosniff`. Needs a total-size cap and a multipart limit separate from the 1 MB JSON limit |
| INQ-03 | Abuse protection: honeypot field, minimum time-to-submit, per-IP rate limit, attachment caps | Public unauthenticated write endpoint (T1499, CWE-400) | S | Rate limiter | No reCAPTCHA (see Anti-features) |
| INQ-04 | **Staff email notification** on new inquiry (summary + admin link, no attachments in the email) | Domain norm. A lead nobody sees is a lost order | S | Email sender (OD-12) | Inquiry must be persisted **before** the email. Email failure must not lose the lead |
| INQ-05 | **Admin Inquiries inbox**: list, unread badge in the sidebar, detail with attachments, status New → Contacted → Quoted → Converted / Closed / Spam, internal note | Printavo routes web forms into an "Inquiries" inbox. Same pattern | M | INQ-01, roles matrix | New nav item, so a SPEC-GAP screen. Owner decision: visible to Admin and Manager, or Manager only? |
| INQ-06 | **Convert inquiry → order** (prefill customer, team, contact, product type; carry image attachments into order images; link back) | Removes re-typing. Measures conversion | M | ORD-03, ORD-04, ORD-19 (non-image files) | PDF/AI attachments have no home on an order today (images only). See ORD-19 |
| INQ-07 | Retention and purge of unconverted inquiries (e.g., 6–12 months) | DPA data-minimization | S | Scheduled job (shared hosting), OD-10 | New retention item for OD-10 |
| INQ-08 | Privacy notice at collection: caption + link to Privacy Policy | NPC Circular 2023-04: informed, layered notice | S | LEGAL-01 | Caption exists in the UI. Add the link |

#### J. Site content & price list (PRD §5.3, PUB-02/03; no UI screens, C-17)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| CONT-01 | Site settings: name, tagline, address, map link, phones, email, Messenger URL, social links, business hours, about, time zone, currency/locale | Every placeholder in the UI spec (`[0917 000 0000]`, `[hello@yourdomain.ph]`) needs a home | M | AUDIT-01, cache invalidation | Hours must be structured (day ranges + open/close), not free text, because PUB-05 and JSON-LD consume them |
| CONT-02 | Product lines / price list: "starts at" price, min qty, active, order | Products page "Starts at [YOUR PRICE] / pc · min. [X] pcs" | M | **C-21** model choice | The PRD's `PriceCategory → PriceItem` lacks min-qty and the 5 option texts. The UI's 6 product lines lack DB backing |
| CONT-03 *(proposed)* | Testimonials and "Recent work" strip management | Static in UI §7.1. Stale testimonials hurt credibility | S | CONT-*, GAL-03 | Consent from named customers for testimonials (DPA) |
| CONT-04 *(GAP)* | **Holiday / special closure dates** | UI hours say "Sunday & holidays · Closed". PH holidays are proclaimed yearly, and special non-working days get announced at short notice | S | CONT-01 | Feeds PUB-05 and JSON-LD `specialOpeningHoursSpecification` |
| CONT-05 | Cache invalidation on edit (HybridCache/output cache) | Manager edits must show at once (E2E journey "manager edits prices and sees them publicly") | S | PRD §7.1 | |

#### K. Consent, analytics, metrics (PRD §6.7)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| ANL-01 | Banner: Accept all / Reject all (equal prominence) / Customize; nothing non-essential before a choice | NPC Circular 2023-04: clear assent, no pre-ticked boxes | M | LEGAL-02 (policy version) | SPEC-GAP banner UI. Must not hurt LCP/CLS (render it as an overlay, not pushed content) |
| ANL-02 | Honor GPC as reject-analytics | Beyond PH law. Fine | S | ANL-01 | Read `Sec-GPC` header + `navigator.globalPrivacyControl` |
| ANL-03 | Footer "Cookie settings" link | Withdrawal must be as easy as consent | S | ANL-01 | |
| ANL-04 | "Clear my cookies & data" | Visitor right to erase | M | ANL-05 store | Server must delete visitor-id-linked rows |
| ANL-05 | Consented analytics: random visitor id (≤12 mo), sessions, page views, referrer host, device/browser/OS family; IP truncated + HMAC | Plausible-like metrics | M | Ingestion endpoint, rate limit | |
| ANL-06 | No-consent aggregate counts (path + day) | Keep baseline traffic numbers | S | ANL-05 | NPC guidance says analytics may rest on legitimate interest. The PRD's consent-first model is stricter, which is allowed |
| ANL-07 | Re-consent on policy version change / 12 months; consent log | Proof of consent | S | LEGAL-05 versioning | |
| ANL-08 | Manager metrics dashboard: uniques, sessions, views, top pages, referrers, device split, trend, date range, CSV | Owner wants to know if Facebook posts drive visits | M | ANL-05/06, chart component | Add an **inquiries-submitted** goal count, the one conversion that matters (differentiator D-6) |
| ANL-09 | Retention: raw 13 months, then aggregate + purge | Minimization | S | Scheduled job, OD-10 | |

#### L. Legal, privacy, audit (PRD §11.4, §12, §13; no §6 IDs)

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| LEGAL-01 | Privacy Policy (RA 10173): controller identity, purposes (orders, inquiries, analytics), retention, rights, DPO contact | Mandatory notice. A DPO designation is required even when NPC registration isn't | S | OD-11 | NPC registration likely isn't mandatory for a small shop (thresholds are 250 employees / 1,000 sensitive-PI records / risky processing). Owner's lawyer confirms |
| LEGAL-02 | Cookie Policy (versioned) | Linked from the banner | S | ANL-* | |
| LEGAL-03 | Terms of Use | Baseline | S | OD-11 | Could carry the shop's downpayment/cancellation terms (owner) |
| LEGAL-04 | Accessibility Statement with contact | PRD §12 | S | — | |
| LEGAL-05 | Versioning, "last updated", DRAFT marker until owner approval | PRD §13 | S | CONT-* or static content | |
| LEGAL-06 *(GAP, procedure → tool)* | **Data subject request support**: find every order/inquiry for a phone/email; export; anonymize | PRD §13 says "documented manager procedure". Without a search-by-contact tool the procedure becomes manual SQL | M | Orders, inquiries, AUDIT-01, OD-7 | Anonymize must not break financial totals (keep amounts, scrub PII) |
| LEGAL-07 *(GAP, procedure)* | Breach-response runbook: NPC + data subjects within 72 h | RA 10173 / NPC rules | S | AUDIT-01, logs | Documentation deliverable, not code |
| AUDIT-01 | Append-only audit log writes (security + financial events) | PRD §11.4 | M | Every mutating handler | |
| AUDIT-02 *(GAP: in PRD §4 capability table, no §6 ID, no UI)* | **Manager audit-log viewer** (filter by actor/action/date) | PRD §4 grants "View audit log" to Managers | M | AUDIT-01 | Compose from the `.s-rt` table + toolbar pattern |

#### M. Legacy data import (PRD §16; one-time "feature")

| ID | Feature | Why expected | Cx | Depends on | Notes |
|---|---|---|---|---|---|
| MIG-01 | Read-only discovery → `LEGACY-SCHEMA.md` | Prime Directive 11 | M | Local restore (C-20) | |
| MIG-02 | Mapping proposal + **owner approval checkpoint** | One-way door | S | MIG-01, every domain decision (OD-3, OD-5, OD-7, C-1, C-2, C-14, C-15) | |
| MIG-03 | Idempotent, re-runnable ETL with `--dry-run`, batched, keeps `LegacyId` + legacy order numbers | Zero loss | L | Final schema, MIG-02 | |
| MIG-04 | **Reconciliation report**: row counts; Σ items, payments, discounts, order expenses, company expenses; per-order Total/Paid/Balance legacy vs new; every transformed/rejected row with reason; must be 100% | Core Value | L | MIG-03, server order math | The report is the acceptance artifact for cutover. Generate it as Markdown/CSV with no customer PII in planning docs |
| MIG-05 | Legacy images → Cloudinary with mapping | If the legacy system has images | M | ORD-04, **C-2** | If legacy orders have > 5 images, a 5-image limit forces loss. See C-2 |
| MIG-06 | Legacy users → profiles + "set your password" email at go-live | Hashes are rarely compatible | S | USER-02 invitation, email | |
| MIG-07 | Dress rehearsal on staging (timed) + cutover runbook | PRD §16.2, §19.4 | M | MIG-04 | |

#### N. Cross-cutting UX that staff will notice if missing

| ID | Feature | Source | Cx | Notes |
|---|---|---|---|---|
| UX-01 | Skeletons everywhere, error state with retry, empty states | PRD §7, UI §8.5/§13 | M | Shared primitives first |
| UX-02 | Toast feedback with consequence ("Balance now ₱…") | UI §10 | S | |
| UX-03 | Mobile admin: bottom tab bar + drawer | UI §6.6, §2.10 | M | Staff record payments on phones at the counter |
| UX-04 | **Global topbar search** "Search orders, customers, teams…" with `/` shortcut | UI §6.6 | M | **GAP in behavior**: results UI and scope (orders only? inquiries?) are undefined. Simplest: route to `/admin/orders?q=` |
| UX-05 | PWA install + "new version" prompt | PRD §7.1 | M | Service worker caches the shell only |
| UX-06 | Camera capture + client downscale for order images | PRD §7.1 | M | Staff photograph garments and fabric |

### Differentiators (Competitive Advantage)

These line up with the Core Value: correct money, a trustworthy shop and fast quoting. None is required for v1 unless noted.

| ID | Feature | Value proposition | Cx | Notes |
|---|---|---|---|---|
| D-1 / ORD-23 | **Estimated profit per order** (internal) | Owners rarely know per-order margin. Printavo sells "profitability reporting" | S | Already in the UI spec (C-18). Must never appear on any customer-facing view (ORD-20). Excludes overhead: label it "Estimated" |
| D-2 / ORD-19 *(GAP)* | **Order files** (non-image attachments: roster spreadsheet, AI/PDF artwork, signed mockup approval) | Inquiry attachments (PDF/AI) and the "full roster from a spreadsheet" promise both need a home | M | Same CWE-434 controls as INQ-02. Private storage. Doesn't count against the image limit |
| D-3 / ORD-20 *(GAP)* | **Printable / shareable order summary or quotation** (customer-safe: items, total, discount, paid, balance; no expenses or profit) | PH shops send quotation/summary screenshots on Messenger. Schools, offices and LGUs often need a quotation document for procurement (LOW confidence) | M | Must be labelled **"Order summary — not an official receipt/invoice"** (see Anti-features: BIR). Print CSS only, no PDF library needed |
| D-4 / ORD-21 *(GAP)* | **Size breakdown / roster per line** (S×3, M×5…; or player name + number + size rows) | Team-apparel platforms treat the roster as first class. Spreadsheet/chat rosters are the main source of misprints | L | v1 fallback: notes + roster file (ORD-19). Full roster is v1.x. It changes the item model, so decide before the Orders phase if wanted in v1 |
| D-5 / ORD-22 | **Duplicate / reorder** an order (copy customer + items, new dates) | Leagues reorder every season. "The whole MC is ordering again" (UI testimonial) | S | Easier with a reusable Customer (OD-7) |
| D-6 / ANL-10 | **Inquiry conversion metric** on the metrics dashboard (submissions/day, by product type, by referrer) | Ties Facebook posts to quote requests | S | Uses INQ-01 events. No extra tracking needed |
| D-7 / GAL-04 | **Publish an order image to the public gallery** (with a customer-permission checkbox) | Keeps the gallery fresh with zero extra work | M | Copy to the public folder, because order images may use authenticated delivery (OD-9). Record the permission |
| D-8 / PUB-08 | "Get a quote for something like this" from the lightbox/products, **prefilling** the Contact form (product type, reference) | Shorter path from inspiration to inquiry | S | Query param → select default. UI already has the button copy |
| D-9 / CUST-01 | **Reusable customer record** with order/payment history and a suki view | Print-shop and tailoring tools all have CRM-lite | M | This is **OD-7**. Classified as a differentiator because the UI spec works without it |
| D-10 / CUST-02 | **Tailoring measurement profile** per customer | Tailoring tools store measurements for repeat customers | M | Depends on CUST-01. Defer to v2 unless the owner says tailoring volume is high |
| D-11 / CEXP-05 | **CSV export** of orders/payments/expenses for the bookkeeper | Bookkeeping lives in Excel. PRD only exports metrics CSV | S | Not "financial reporting" (out of scope). It's data portability. Confirm with the owner |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Generating "Official Receipts" / "Sales Invoices"** | Customers ask for a receipt for the downpayment | BIR requires a registered **CAS** for any system that generates invoices or books of accounts. RR 7-2024 (EOPT) makes the Invoice the primary tax document. An unregistered app issuing invoice-like documents is a compliance risk | Keep BIR booklets/registered POS for invoices. CSPS prints an "Order summary — not an official receipt" (D-3) and can record the OR/invoice number as a payment reference |
| Online payment gateway (GCash/Maya API, cards) | "Pay now" links like Printavo | Out of scope (PRD §23). PCI/merchant onboarding. PH customers already pay by GCash QR / bank transfer and send a screenshot | Manual payment recording with method + reference number (already in spec) |
| Customer accounts / order-tracking portal | "Let customers check status" | Out of scope. Account security for anonymous buyers. Public lookup by order number is enumerable (CWE-639) | Staff update customers on Messenger. If ever added (v2+), use unguessable signed per-order links, not accounts |
| Embedded Facebook Messenger chat plugin / Meta Pixel | "Chat on the site", "retarget FB visitors" | Meta retired the chat plugin in May 2024. Pixel sets third-party tracking (needs consent), breaks strict CSP, costs JS budget (150 KB) and Lighthouse ≥ 95 | `m.me` link buttons (PUB-06). First-party consented analytics (ANL-05) |
| Google reCAPTCHA on the inquiry form | Spam control | Third-party cookies before consent, CSP `script-src` exceptions, accessibility friction (PRD §12 forbids cognitive puzzles in auth; same spirit) | Honeypot + time-trap + rate limit (INQ-03). Revisit only if spam appears |
| Embedded Google Maps iframe | "Show the map" (UI §7.4 says it *may* be swapped in) | Sets Google cookies before consent, needs a CSP `frame-src`, heavy for LCP | Keep the stylized SVG map + "Directions ↗" link (as designed) |
| Public instant price calculator | "Show exact prices" | Jersey prices depend on fabric, cut, quantity and design. Wrong instant quotes create disputes | "Starts at ₱X / pc · min. N pcs" + Get a Quote (as designed) |
| Inventory / purchase orders | YoPrint and ShopVOX ship them | Out of scope (PRD §23). Not part of the shop's workflow | Order expenses capture material cost per job |
| Production calendar / Kanban board with drag | Printavo's signature feature | A 5-person shop with about 20 active orders doesn't need capacity planning. Drag-only also violates WCAG 2.5.7 | Status filter + "Due date (soonest)" sort + overdue flags (already designed) |
| Automatic status emails/SMS to customers | Printavo does it | Customer email is optional and customers live on Messenger. SMS is out of scope. Marketing-email consent rules apply | Staff message customers. Revisit with the Android app |
| Manager-set temporary passwords shown in the UI (C-4 as drawn) | Faster onboarding | The Manager knows the credential, it gets shared over chat, there's no proof of mailbox ownership | Invitation link (PRD USER-02). Email is already mandatory for 2FA, so invitations add no new dependency. **Owner rules (C-4)** |
| Silent hard delete of financial records | "Clean up mistakes" | Destroys the audit trail for money. Breaks reconciliation after cutover | Owner rules OD-5. Either way, audit the deletion with the totals snapshotted |
| Real-time multi-user updates (websockets/SignalR) | "See colleagues' edits live" | Shared hosting app-pool recycling. Complexity. `rowversion` + 409 already protects data | Optimistic concurrency + "reload" (ORD-08) |
| Multi-language (Filipino/Taglish) UI | Local audience | Out of scope (PRD §23). The UI copy already mixes in Taglish where natural ("Sulit na sulit") | English copy per spec |

---

## Inquiry Handling: What Comparable Shop Tools Do (SPEC-GAP analysis for C-12)

**Domain standard (MEDIUM):** Printavo's website contact form feeds an in-app **Inquiries** list, and staff turn inquiries into customers and quotes. Smaller shops without software rely on email or Messenger only, and leads get lost. The pattern CSPS needs, in order of necessity:

1. **Persist first.** Write the `Inquiry` (UI §9.1 already defines the entity) in one transaction with attachment metadata. Email is a notification, never the store of record.
2. **Notify.** A transactional email goes to a configured shop address (site settings). It carries a summary and a link to the admin detail, with no attachments and no full message body if the owner prefers minimization.
3. **Triage inbox.** Show an unread count on the sidebar, and give each inquiry a status (New / Contacted / Quoted / Converted / Closed / Spam) and an internal note. This needs a new nav item, so the sidebar and bottom-tab-bar layouts must absorb a 6th item. On phones the tab bar has 4 slots, so Inquiries probably lives in the drawer. That's a SPEC-GAP for the owner.
4. **Convert.** "Create order from inquiry" opens the New Order form prefilled with customer, team, contact, email, product type → first item type, and message → notes. It also links `Order.InquiryId` back.
5. **Retain and purge.** Unconverted inquiries are purged after an owner-set period. Converted ones live with the order.

**Owner decisions this surfaces** (add to the OD list):

- Who sees inquiries (Admin + Manager, or Manager only)?
- Which notification address?
- How long are unconverted inquiries retained?
- Where are attachments stored? Options: Cloudinary `raw`/authenticated, or DB `varbinary` with size caps on shared hosting. Should AI files be accepted at all, or only PDF/JPG/PNG?

**Complexity:** L overall (INQ-01..08). Without attachments it drops to M. Attachments alone are the riskiest part (CWE-434, storage quotas, malware-bearing PDFs).

---

## PRD ↔ UI-Spec Conflicts: Domain-Standard Behavior (no rulings)

| # | Topic | Domain-standard behavior / evidence | Feature impact and dependencies | Notes for the owner's ruling |
|---|---|---|---|---|
| C-1 | One vs many discounts | Print-shop tools usually allow one order-level discount plus per-line discounts. PH small shops commonly stack a reason discount ("Barangay league 5%") with a rounding "less ₱500" (LOW) | Many = a child collection with Σ. One = a nullable owned value. **Legacy:** if the legacy DB has multiple discounts per order, a 0..1 model can't hold them losslessly (Core Value: zero loss). The ORD-2026-0148/0151 fixtures pass under both | Rule after considering MIG-01 findings, or pick "many" as the superset. Either way: Σ discounts ≤ Total, and percentages apply to the items Total (UI §9.2), not compounding |
| C-2 | Image limit 5 vs 12 | Printavo/YoPrint don't cap artwork per job. Jersey orders typically need front, back, shorts, reference and revisions, so 5 is tight once mockup revisions accumulate | Domain constant + DB check. Cloudinary quota. **Legacy** orders with > 5 images would force loss | A non-image "files" feature (ORD-19) relieves pressure on the image cap |
| C-3 | Create flow (one transaction vs details+items first) | Real workflow: an order is often created when the downpayment arrives (UI copy: "production starts as soon as the downpayment is in"). Two-step entry risks forgetting the downpayment. The UI mitigates with a note | The API can accept the PRD's full aggregate (items + optional payments/discount/expenses) in one transactional `POST`, while the UI sends only details + items. That meets both documents at the API level. The images-in-create step still needs an order id (upload after create, or pre-upload tokens) | Decide UI shape. The API shape can be a superset either way |
| C-4 | Invitation vs temporary password | The SaaS norm is invitation links. AUTH-02 already requires a working mailbox per user, so invitations add no new dependency | USER-02, USER-07, MIG-06 all reuse the same "set password" token flow | Security: owner decides |
| C-5 | Password policy copy | NIST SP 800-63B (length ≥ 12/15, breach check, no composition rules) is the current norm | Only the copy and the strength meter (`passwordStrength()`) change. The scoring function must not reward composition | Security: owner decides |
| C-6 | 2FA screen missing | Standard pattern: a second step on the same login layout with 6 boxes, paste support, resend countdown, and "use a different account" | Compose from `OtpInput` + the Login brand panel | Spec gap only |
| C-7 | Forgot password stub | Self-service email reset is universal. Manager-triggered reset is a useful *addition* (USER-07) | AUTH-08/09 screens: request, "check your email", set new password, success | Spec gap |
| C-8 | "Account deactivated" banner | The norm is a generic error. A common compromise reveals account state only *after* correct password + second factor (the caller has proved ownership), which keeps the UI copy without enumeration | Affects AUTH-01/10 response design and tests | Security: owner decides |
| C-9 | Immediate email change | The norm is confirm-new + notify-old (blocks silent takeover) | Toast copy becomes "Check your new inbox to confirm". A pending-email state shows on Profile | Security: owner decides |
| C-10 | Icons | Not a feature question | — | PROJECT.md already recommends the UI spec |
| C-11 | Dark mode | Admin-only manual toggle is fine for staff tools | PROF-04 | PROJECT.md recommends the UI spec |
| C-12 | Public pages + inquiry form | See the inquiry section above. A gallery is table stakes for jersey shops (social proof) | Adds GAL-01..03, INQ-01..08, and probably a new admin nav item | Scope + CWE-434 |
| C-13 | "Total" naming | Same math. Print tools typically show Subtotal → Discount → Total → Paid → Balance. The UI's "Total" (pre-discount) can confuse when Estimated Profit says "Total − Discount" | The API should expose explicit fields (`itemsTotal`, `discountTotal`, `netTotal`, `paidTotal`, `balance`, `orderExpensesTotal`, `estimatedProfit`) so both label sets map without ambiguity. MIG-04 reconciliation must compare like with like | Labels only |
| C-14 | Due date required | Jersey orders nearly always have a deadline. Tailoring alterations have a pickup date. Required is the domain norm for new orders | **Legacy:** rows without a due date need a migration rule (e.g., an explicit "unknown" flag). Don't invent dates. ORD-11 overdue logic depends on it | Decide together with MIG-02 |
| C-15 | Order number source and format | Human-friendly per-year numbers are standard. Gaps are acceptable because these aren't BIR invoices | ORD-14 needs a concurrency-safe per-year counter. Legacy numbers must keep their own format and stay unique (prefix collision check) | Decide before the Orders phase. Legacy format is unknown until MIG-01 |
| C-16 | Drag/hover-only image actions | WCAG 2.5.7 requires a single-pointer alternative | Add always-visible "Move earlier/later" and "Make cover" buttons (or a menu) in ImageUploader. The UI keeps drag as an enhancement | A11y: owner decides (OD-14) |
| C-17 | Unshown screens | — | All are table stakes listed above (AUTH, PROF-02, USER-07, CONT, ANL banner, LEGAL, AUDIT-02) + INQ-05 + GAL-03 | Compose with `// SPEC-GAP:` |
| C-18 | Dashboard + estimated profit | Print-shop SaaS ships KPI dashboards and profitability. Table stakes for the owner | DASH-01..06. ORD-23 estimated profit must be excluded from any customer-facing output (ORD-20) | Accept as scope addition |
| C-19 | "Keep me signed in" pre-checked | Norm: unchecked by default for staff/admin apps. NPC "no pre-ticked boxes" applies to consent, not session UX, so this is a security-default call | AUTH-05 | Security default: owner decides |
| C-20 | Local DB environment | Not a feature question | — | Phase 1 |
| C-21 | Products content model | Domain: a small shop needs **product lines** with editable starts-at price, min quantity and option copy, more than a generic price list | Hybrid option: `ProductLine` (6 rows seeded from UI §7.2, with price, min qty, active, sort, option texts) satisfies the UI layout and PUB-02/03. `PriceCategory → PriceItem` could stay for an optional detailed price table | Content model: decide in the Public site phase |

---

## Feature Dependencies

```
Email sender (SMTP, OD-12)
    └──required by──> AUTH-02/04/07/08/09, PROF-02/03, USER-02/07, INQ-04, MIG-06

Identity + refresh-token families
    └──required by──> AUTH-05/06/10, USER-05, PROF-03
AUDIT-01 (append-only log)
    └──required by──> USER-06, ORD-06, CEXP-02, CONT-*, ORD-16 (status history), AUDIT-02, LEGAL-06

Site settings (CONT-01) + time zone (OD-2)
    ├──required by──> PUB-02, PUB-04 (JSON-LD), PUB-05 (open now), PUB-06 (CTAs), footer
    ├──required by──> DASH-01..04 + ORD-11 (month/day boundaries in Asia/Manila)
    └──enhanced by──> CONT-04 (holidays)

Order aggregate (ORD-03/05) + server totals
    ├──required by──> ORD-01/02/07/12, DASH-02..05, ORD-20 (summary), ORD-22 (reorder)
    ├──required by──> ORD-04 images ──> ORD-01 thumbnail, GAL-04, INQ-06
    └──required by──> MIG-03/04 (ETL writes into it; reconciliation uses its math)

Company expenses (CEXP-01/02) ──required by──> DASH-02 (expenses KPI), DASH-03 (chart)

Cloudinary signed upload (ORD-04)
    ├──enhances──> GAL-03 (public folder), GAL-04
    └──pattern reused by──> INQ-02 / ORD-19 (private non-image files)

INQ-01 (persist) ──> INQ-04 (notify) ──> INQ-05 (inbox) ──> INQ-06 (convert) ──requires──> ORD-03, ORD-04, ORD-19

LEGAL-02 (cookie policy version) ──required by──> ANL-01, ANL-07
ANL-01 (consent) ──> ANL-05 (consented analytics) ──> ANL-08 (dashboard), RUM web-vitals, ANL-04 (clear data)

OD-7 reusable Customer ──enables──> CUST-01, CUST-02 (measurements), ORD-22 (reorder), LEGAL-06 (DSR lookup)

C-1 / C-2 / C-14 / C-15 domain rules ──constrain──> MIG-02 mapping (zero-loss)
ORD-19 (order files) ──conflicts-with──> "images only" uploader scope unless kept as a separate list
```

### Dependency Notes

- **The email sender is the earliest hard dependency.** Six features across Auth, Profile, Users and Inquiries can't be tested end-to-end without it. That includes the Testing-only email sink (PRD §14). OD-12 (sender domain, SPF/DKIM/DMARC) should be asked in the Auth phase, as PROJECT.md says.
- **Audit log before any destructive feature.** ORD-06, CEXP-02, USER-03 and CONT-* all write audit entries. Build AUDIT-01 in the auth phase so later phases only call it.
- **Invariant re-checks happen across child mutations, not only at payment time.** OD-4 (no overpayment) is usually framed as "a payment can't exceed the balance". But balance can also go negative when staff *remove an item*, *add a discount* or *raise a percentage* after payments exist. ORD-05 says "each change revalidates invariants". The rule must state which mutations are blocked when they would make Balance < 0, or whether negative balance is shown as credit/refund-due (ties to ORD-18).
- **Domain rules stricter than legacy data force either loss or exceptions.** C-1 (discount count), C-2 (image count), C-14 (required due date) and C-15 (number format) all decide whether legacy rows fit. The `.bak` can't be opened before Phase 10 (Prime Directive 11). So either choose the permissive superset now, or accept that MIG-02 may reopen these rules. Flag this when the Orders phase discusses them.
- **Facebook traffic makes PUB-04 an architecture dependency, not polish.** Per-route OG/title/JSON-LD in the initial HTML needs server-side head injection from site settings. Decide it in the Foundation phase (hosting the SPA from `wwwroot`) so the Public phase doesn't retrofit it.
- **The gallery needs a content source at launch.** GAL-01 with static SVG placeholders is visually complete but commercially empty. Either GAL-03 (management) ships in the Public phase, or real photos are seeded as static assets. Order images can't feed it directly if OD-9 picks authenticated delivery.
- **Inquiry → order conversion exposes the missing order-files feature.** Customers attach PDF/AI artwork, but orders accept images only. Without ORD-19, conversion silently drops files, or staff download and re-upload them by hand.

---

## MVP Definition

### Launch With (v1: replaces the production system at cutover)

- [ ] AUTH-01..10, PROF-01..03, USER-01..06 + **USER-07** (resend invite/reset). Staff security is Core Value
- [ ] ORD-01..09 + ORD-10..15, **ORD-16** (status history), **ORD-17** (transition rules), **ORD-18** (cancel/refund rule, at least a decided policy). Order math is Core Value
- [ ] ORD-04 images with an accessible reorder (C-16)
- [ ] CEXP-01..04
- [ ] DASH-01..06 (the UI spec's landing screen; staff land here)
- [ ] PUB-01..07, GAL-01..03, CONT-01..05 (incl. holidays). Every UI placeholder needs a managed value before go-live
- [ ] **INQ-01..08**. The public form exists in the approved design. Shipping it without an admin side loses leads
- [ ] ANL-01..09, LEGAL-01..05, AUDIT-01..02
- [ ] MIG-01..07. Zero-loss import is Core Value

### Add After Validation (v1.x)

- [ ] ORD-19 order files (non-image). Trigger: first converted inquiry with a PDF/AI attachment, or roster files piling up in Messenger. *Consider pulling into v1 if INQ-02 accepts PDF/AI.*
- [ ] ORD-20 printable order summary. Trigger: staff screenshotting the detail page for customers (which would leak estimated profit)
- [ ] ORD-22 duplicate/reorder. Trigger: second-season reorders
- [ ] ANL-10 inquiry conversion metric, PUB-08 quote prefill, GAL-04 publish-to-gallery
- [ ] CEXP-05 CSV export. Trigger: bookkeeper request
- [ ] LEGAL-06 DSR lookup/anonymize tool. Trigger: first data-subject request (keep the documented procedure in v1)

### Future Consideration (v2+)

- [ ] ORD-21 full roster / size breakdown. Changes the item model, so it needs owner validation of real order shapes after migration
- [ ] CUST-01/02 reusable customers + measurement profiles, if OD-7 doesn't already choose the Customer entity
- [ ] Customer-facing signed status links; SMS/authenticator 2FA; Android app (API already client-agnostic)

---

## Feature Prioritization Matrix

| Feature | User value | Implementation cost | Priority |
|---|---|---|---|
| Order aggregate + server math (ORD-01..09, 12, 23) | HIGH | HIGH | P1 |
| Auth with email 2FA (AUTH-01..10) | HIGH | HIGH | P1 |
| Legacy import + reconciliation (MIG-01..07) | HIGH | HIGH | P1 |
| Order images (ORD-04) | HIGH | HIGH | P1 |
| Inquiry inbox + notification (INQ-01, 03..05, 08) | HIGH | MEDIUM | P1 |
| Inquiry attachments (INQ-02) | MEDIUM | HIGH | P1 (owner may narrow file types) |
| Dashboard (DASH-01..06) | HIGH | MEDIUM | P1 |
| Company expenses (CEXP-01..04) | HIGH | LOW | P1 |
| Site content + price list + holidays (CONT-01..05) | HIGH | MEDIUM | P1 |
| Gallery + management (GAL-01..03) | HIGH | MEDIUM | P1 |
| Consent + analytics + metrics (ANL-01..09) | MEDIUM | MEDIUM | P1 (PRD mandate) |
| Status history (ORD-16) | MEDIUM | LOW | P1 |
| Audit viewer (AUDIT-02) | MEDIUM | LOW | P1 (PRD §4) |
| Convert inquiry → order (INQ-06) | HIGH | MEDIUM | P1/P2 |
| Order files (ORD-19) | MEDIUM | MEDIUM | P2 |
| Printable order summary (ORD-20) | MEDIUM | LOW | P2 |
| Reorder (ORD-22), CSV export (CEXP-05) | MEDIUM | LOW | P2 |
| Roster/size breakdown (ORD-21) | HIGH (domain) | HIGH | P3 (v1 fallback: notes + files) |
| Measurements (CUST-02) | LOW–MEDIUM | MEDIUM | P3 |

---

## Competitor Feature Analysis

| Feature | Printavo | YoPrint | Team-apparel platforms (Wooter/Exclaim) | CSPS approach |
|---|---|---|---|---|
| Quotes → orders | One-click convert | Pricing matrix auto-quote | Online configurator | Inquiry → order conversion (INQ-06). Quotes are informal on Messenger |
| Mockup approval | Branded approval link | Customer portal | In-app proofs | Images on the order. Approval stays on Messenger. Optional "approved mockup" file (ORD-19) |
| Deposits / payments | Online deposits + final payment | Online payments | Checkout | Manual records (Cash/GCash/Maya/Bank) with reference numbers |
| Production tracking | Calendar + tasks + statuses | Statuses | — | Six statuses + overdue + status history |
| Customer record | CRM with history | CRM + portal | Team accounts | OD-7 (fields on order vs Customer entity) |
| Roster | — | Size matrix | First-class roster | Size/variant text now. Roster later (ORD-21) |
| Web inquiries | Inquiries inbox from site form | Portal messaging | — | INQ-01..08 (SPEC-GAP to fill) |
| Profit / KPIs | Profitability reports, KPI dashboards | Reports | — | Estimated profit per order + dashboard |
| Invoices | Invoices + QuickBooks | Invoices | Receipts | **Not built** (BIR CAS). Order summary only |

---

## PRD §6 Requirement Traceability Check

Every PRD §6 ID appears above:

| Area | IDs | Section of this file |
|---|---|---|
| AUTH | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10 | A |
| PROF | 01, 02, 03 | B |
| USER | 01, 02, 03, 04, 05, 06 | C |
| ORD | 01, 02, 03, 04, 05, 06, 07, 08, 09 | D |
| CEXP | 01, 02 | E |
| PUB | 01, 02, 03, 04 | G |
| ANL | 01, 02, 03, 04, 05, 06, 07, 08, 09 | K |

PRD capabilities with **no §6 ID** that REQUIREMENTS.md should number: audit-log viewer (§4), audit writes (§11.4), legal pages (§13), DSR procedure (§13), breach procedure (§13), legacy migration (§16), PWA (§7.1), camera capture (§7.1).

## Gaps: Features Neither Document Covers (explicit list)

1. **Inquiry admin side**: inbox, staff notification, status, convert-to-order, retention (INQ-04..07). *Table stakes.*
2. **Resend invitation / send reset link** from Users (USER-07). *Table stakes.*
3. **Status transition rules** (ORD-17; OD-3 lists statuses without transitions). *Table stakes.*
4. **Order status history** (ORD-16). *Table stakes for a multi-staff shop.*
5. **Refund / cancelled-order downpayment handling** (ORD-18). *Table stakes as a policy. Implementation can be minimal.*
6. **Holiday / special-closure dates** for "Open now" and JSON-LD (CONT-04). *Table stakes given "Sunday & holidays · Closed".*
7. **Gallery content management** (GAL-03) and testimonials/recent-work management (CONT-03). *Table stakes for a managed public site.*
8. **404 / public error page** (PUB-07). *Minor table stakes.*
9. **Global topbar search behavior** (UX-04). Designed, but scope and results are undefined.
10. **Server-side `<head>` injection for Facebook link previews** (PUB-04 detail). *Table stakes given FB-first traffic.*
11. **Non-image order files** (ORD-19): rosters, AI/PDF artwork. *Differentiator. Becomes table stakes once INQ-02 accepts PDF/AI.*
12. **Size breakdown / roster** (ORD-21). *Domain differentiator, v2.*
13. **Printable customer-safe order summary** (ORD-20). *Differentiator. Prevents profit leaking via screenshots.*
14. **DSR lookup/anonymize tool** (LEGAL-06). PRD has the procedure only.
15. **Dashboard metric definitions**: "due this week", "same day last month" on month-end days, cancelled orders in "Orders by status" (DASH-02/04).
16. **Expense category fit for PH**: there are no categories for government contributions/taxes (SSS, PhilHealth, Pag-IBIG, BIR). Raise this under OD-8. *LOW confidence on owner need.*
17. **Payment methods**: the fixed list has no **cheque**, which schools, offices and LGU-funded leagues may pay with. Raise with the owner. *LOW confidence.*

---

## Sources

- `CSPS-PRD.md` §1, §4–§6, §7.1, §9.4, §10, §11.4, §13, §16, §21, §23 (HIGH: primary)
- `CSPS-UI-SPEC.md` §1, §6–§12 (lines 1–1578) (HIGH: primary)
- `.planning/PROJECT.md` OD-1..14, C-1..21 (HIGH: primary)
- Printavo features: https://printavo.com/features. Inquiries from contact forms: https://support.printavo.com/hc/en-us/articles/46719389180827-How-can-we-setup-a-contact-form-that-feeds-into-Printavo (MEDIUM)
- YoPrint features (pricing matrix, POs, customer portal): https://www.yoprint.com/direct-to-film-management-software (MEDIUM)
- Team rosters: https://exclaim.gg/features/ordering/team-rosters, https://teamseams.com/blog/team-rosters, https://wooter.com/articles/?p=16719 (MEDIUM)
- Tailoring software features: https://orderry.com/tailor-shop-software/, https://www.dasolo.ai/blog/odoo-by-industry-8/odoo-tailoring-alterations-businesses-715 (MEDIUM)
- BIR CAS registration: https://www.cleartax.com/ph/bir-cas-registration. RR 7-2024 invoicing: https://www.pwc.com/ph/en/tax/tax-publications/taxwise-or-otherwise/2024/eopt-invoicing-clarified.html, https://kpmg.com/ph/en/home/insights/2024/07/compliance-an-update-to-registration-procedures-and-invoicing-requirements.html (MEDIUM; owner's accountant should confirm)
- PH Data Privacy Act thresholds and 72 h breach rule: https://law.asia/philippines-data-privacy-law-regulations-overview/, https://www.tripleiconsulting.com/navigating-npc-registration-strategies-for-philippine-business-compliance/ (MEDIUM)
- NPC Circular 2023-04 and cookies: https://www.legal500.com/developments/thought-leadership/philippines-cookies-similar-technologies/ (MEDIUM; published Jul 22, 2025)
- Messenger chat plugin retirement and m.me links: https://chative.io/blog/meta-remove-facebook-messenger-chat-plugin/, https://www.boei.help/blog/facebook-messenger-website (MEDIUM)
- Google LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business (MEDIUM via search summary)
- Plausible metrics / cookieless model (reference for ANL-08 scope): https://plausible.io/docs/metrics-definitions, https://plausible.io/cookieless-web-analytics (MEDIUM)
- Facebook link-scraper behavior (no JS execution) is from training knowledge and was not re-verified this session (LOW–MEDIUM; verify in the Public site phase research)

---
*Feature research for: small PH custom-apparel/tailoring shop, order management + public site*
*Researched: 2026-10-06*
