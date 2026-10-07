# Pitfalls Research

**Domain:** Staff order-management + public marketing site for a small Philippine print/tailoring shop (CSPS). Stack: .NET 10 / EF Core 10 / SQL Server / ASP.NET Core Identity (custom JWT + rotating refresh + email 2FA) / React 19 + Vite + Tailwind v4. Strict TDD, zero warnings, WCAG 2.2 AA, MITRE CWE, CI performance budgets. Deployed to SmarterASP.NET shared IIS, with a one-time legacy `.bak` import and cutover.
**Researched:** 2026-10-06
**Confidence:** MEDIUM overall. Findings marked **[measured]** were computed on this machine from the UI-spec appendices: rounding drift, CSS/JS sizes, contrast ratios, LocalDB/Docker versions. Hosting-specific claims about SmarterASP.NET are **LOW** until someone checks them in the control panel.

> **How to read this file.** Each critical pitfall has a phase tag that uses the PRD §20 names: Foundation, Identity & authentication, Profile & user management, Orders core, Order images, Company expenses, Public site & content management, Consent/analytics/legal, Hardening, Legacy discovery & mapping, Legacy data import, Production cutover. "C-n" and "OD-n" refer to the conflict and owner-decision tables in `.planning/PROJECT.md`.

---

## Top 10 (if you read nothing else)

1. **Client preview and server disagree by ₱0.01 on percent discounts.** The spec's `Math.round(n*100)/100` and the PRD's `MidpointRounding.AwayFromZero` give different results for 2.5% and 7.5% discounts on about 3–4% of whole-peso totals **[measured]**. The ORD-2026-0148 fixture can't catch this (Foundation, Orders core).
2. **The order `rowversion` doesn't change when only child rows change.** Two staff editing payments and discounts at the same time both succeed, and stored totals go stale (Orders core).
3. **"Today" is computed in UTC.** Between 00:00 and 07:59 Manila time, the server rejects a payment dated today as "in the future", and month KPIs shift (Foundation, Orders core).
4. **Refresh-token reuse detection signs users out.** StrictMode double effects, multiple tabs, a flaky PH mobile network and parallel Playwright workers all trigger it (Identity & authentication).
5. **`__Host-` with `Path=/api/v1/auth` is invalid.** The browser silently drops the cookie, so refresh never works in production (Identity & authentication).
6. **Mandatory email 2FA makes SMTP deliverability a login dependency.** With no sender domain or SPF/DKIM yet (OD-12), codes land in Gmail spam and nobody can sign in (Identity & authentication).
7. **Verbatim UI-spec code breaks PRD gates.** `Mark` uses `dangerouslySetInnerHTML`, `main.tsx` uses a non-null `!`, the Modal has no focus trap, and the spec's tsconfig is looser than the PRD's. Image previews need `img-src blob:` and Vite may inline fonts as `data:` (Foundation).
8. **The SQL engine or compatibility level on the host may not match dev.** Dev is LocalDB 2025 / container 2025. EF Core 10 at compat 170 emits the native `json` type, and the migration script fails on the host (Foundation).
9. **Restoring the legacy `.bak` "as `CSPS_Dev`"** (as CLAUDE.md suggests) would overwrite the dev DB and blur the "app owns its schema" line. Use `CSPS_Legacy_Restore` (Legacy discovery & mapping).
10. **Cutover rollback has a point of no return.** Once staff enter new orders in CSPS, going back to the legacy site loses them unless that is planned (Production cutover).

---

## Critical Pitfalls

### Pitfall 1: Rounding drift between the UI-spec `round2()` and the server's `AwayFromZero`

**What goes wrong:**
UI-SPEC Appendix D.1 rounds with `round2 = n => Math.round(n*100)/100`. PRD §5.1 requires `Math.Round(x, 2, MidpointRounding.AwayFromZero)` on `decimal`. JavaScript multiplies in binary floating point, so midpoints like `x.xx5` often land just below the midpoint and round **down**. Measured on this machine **[measured]**:

| Case | JS `round2` | C# decimal AwayFromZero |
|---|---|---|
| 7.5% of ₱17.00 = 1.275 | 1.27 | 1.28 |
| 2.5% of ₱23.00 = 0.575 | 0.57 | 0.58 |
| 12.5% of ₱1.16 = 0.145 | 0.14 | 0.15 |
| `round2(1.005)` | 1.00 | 1.01 |
| `round2(10.075)` | 10.07 | 10.08 |

Across whole-peso totals from ₱1 to ₱200,000, **2.5% disagrees 8,203 times and 7.5% disagrees 6,117 times**. 5%, 10%, 12.5% and 15% never disagree on whole-peso totals, but they do on centavo totals: 15,086 of 3,000,000 sampled. The seeded acceptance fixture ORD-2026-0148 uses 5% of ₱22,450 = ₱1,122.50 exactly, so **it passes on both sides and gives false confidence**.

The user-visible symptom: the Discount modal's live "Computed amount: ₱1.27" becomes ₱1.28 after save. The toast "Balance now ₱…" is computed client-side and is off by a centavo, and staff stop trusting the numbers. That hits the Core Value directly.

**Why it happens:**
The UI spec says to copy `csps.ts` verbatim and "never re-implement the formulas". The PRD separately mandates AwayFromZero. Each document is internally consistent, and nobody tests them against each other.

There's a second, subtler mismatch in order of operations. The spec rounds the Total, then rounds each discount, then rounds the sum. If the server rounds differently (for example, sums unrounded discounts), multi-discount orders (C-1) drift too.

**How to avoid:**
- Create one **golden-vector file** (for example `tests/fixtures/order-math-vectors.json`) with at least 200 cases. Include ORD-2026-0148, ORD-2026-0151, the midpoint cases above, 100% discounts, zero items, multiple discounts (if C-1 allows them) and overpayment (if OD-4 allows it). Both the xUnit Domain tests and the Vitest `csps.test.ts` load it. CI fails if either side disagrees.
- Make the client round on integer centavos with half-away-from-zero, for example `sign(n) * Math.round(Number((Math.abs(n) * 100).toPrecision(15))) / 100`. Changing `round2` deviates from the "verbatim" rule, so record it as a `// SPEC-GAP:` deviation and get the owner's ruling. The PRD's Prime Directive (server authoritative, documented rounding) is the stronger claim.
- Have the server return computed figures after every mutation. Toasts and the totals panel display **server** values once the response arrives (UI-SPEC §10 already says totals must reflect server values).
- Pin the operation order in one documented place, both sides: round the items total, round each discount, sum and round, then subtract.
- If list sorting or filtering ever computes money in SQL, note that T-SQL `ROUND` on `decimal` is also half-away-from-zero. Add the SQL path to the golden-vector test too.

**Warning signs:** Someone says "the preview said ₱x but it saved ₱y". Domain tests only use whole-percent fixtures. `csps.test.ts` has only the 7 spec tests.

**Phase to address:** Foundation (copying `csps.ts`, plus the golden-vector harness), enforced in Orders core.

---

### Pitfall 2: Domain rules baked in before C-1 / C-13 / OD-4 are decided

**What goes wrong:**
- **Discount cardinality (C-1):** the PRD allows 0..1 discount and the UI spec allows many (tab with a count, Σ). Whichever is chosen goes into the schema, the DTOs, the cascade sentence and the legacy mapping. If legacy orders turn out to have several discounts and the domain allows one, the import can't represent them.
- **"Total" naming (C-13):** the PRD has `Subtotal → Total = Subtotal − Discount`. The UI spec has "Total" = Σ items (pre-discount). If the API exposes a field named `total`, the UI shows the wrong number under the wrong label, and the reconciliation report compares the wrong columns.
- **Overpayment (OD-4):** the PRD default is "no", but the UI spec has `Fully Paid = Balance ≤ 0` and Receivables = `Σ max(Balance, 0)`, so it expects negative balances. Even under "no overpayment", balances go negative through **other** edits: lowering a quantity, adding a discount or deleting an item after the downpayment. A naive `payment ≤ balance` check only guards the payment endpoint.

**Why it happens:** Engineers start the aggregate before the discuss step settles owner decisions, or settle them per endpoint rather than as aggregate invariants.

**How to avoid:**
- Resolve C-1, C-3, C-13, C-14, C-15, OD-3, OD-4, OD-5 and OD-7 in the **Orders core discuss step, before any test is written**.
- Model discounts as a collection internally even if the rule is max 1 (`MaxDiscountsPerOrder = 1` as a named invariant). Tightening or relaxing it is then a one-line domain change, not a schema change.
- Use unambiguous API names: `itemsTotal`, `discountTotal`, `paidTotal`, `balance`, `expensesTotal`, `estimatedProfit`. Map them to the UI-spec labels ("Total", "Total Discount"…) only in the view layer, and document the mapping once.
- Define the overpayment invariant at the aggregate level: "after any mutation, Balance ≥ 0 unless overpayment is allowed". Test every mutation type (item edit, item delete, discount add/edit, payment add/edit) against it. Decide what the UI does when an item edit would make the balance negative: block it, or allow it and flag it.
- Add an `Σ discounts ≤ itemsTotal` invariant for multi-discount orders. Two 60% discounts must fail.

**Warning signs:** The API has a field just called `total`. Overpayment is validated only in `AddPaymentHandler`. There's no test for "reduce quantity after full payment".

**Phase to address:** Orders core (discuss step). Revisit in Legacy discovery & mapping when legacy anomalies surface.

---

### Pitfall 3: Totals computed three different ways (domain, LINQ projection, client)

**What goes wrong:**
ORD-01/02 need server-side pagination **sorted by balance or total** and filtered by "has balance". You can't sort a paged SQL query by a value computed in C#. So the list query reimplements the formula in a LINQ projection (`o.Items.Sum(i => i.Quantity * i.UnitPrice) - …`), with percentage discounts and rounding in SQL. That gives a third implementation, which drifts from the domain and the client. It also tends to produce correlated subqueries per row and fails the PRD's N+1 / query-count test.

**Why it happens:** "All totals computed server-side" gets read as "computed on read".

**How to avoid (recommended):**
- **Persist denormalized totals on the `Order` row**: `ItemsTotal`, `DiscountTotal`, `PaidTotal`, `Balance`, `ExpensesTotal`. The aggregate recomputes them on every mutation using the single domain implementation.
- The list endpoint projects stored columns, so indexes on `Balance` and `ItemsTotal` support sort and filter. One query, no N+1.
- Add an integration test that loads random seeded orders, recomputes them in the domain, and asserts they equal the stored values. Hardening runs the same check as a SQL reconciliation query. Legacy data import runs it on every imported order.
- This also fixes Pitfall 4: persisted totals change the root row, so the `rowversion` bumps.

**Warning signs:** `Sum(` inside list projections. Sorting by balance works only on the current page. The query-count test was written after the endpoint.

**Phase to address:** Orders core.

---

### Pitfall 4: `rowversion` on the Order root doesn't detect concurrent child edits

**What goes wrong:**
Items, payments, discounts and expenses live in their own tables. EF Core checks a concurrency token only on the entity row it updates. When staff A adds a payment and staff B deletes the discount at the same time, only child rows change, the `Order` row's `rowversion` never changes, and both saves succeed. Each response shows a balance that ignores the other edit, and any persisted totals are now wrong. ORD-08 ("concurrency conflicts return 409") looks done but isn't.

**Why it happens:** People assume an aggregate-root `rowversion` covers the whole aggregate. It doesn't.

**How to avoid:**
- Every child mutation goes through the root and **must modify the root row**: recomputed totals (Pitfall 3), plus `UpdatedAt`/`UpdatedBy` even when totals don't change (for example, editing a payment note).
- Nested child endpoints (`POST /orders/{id}/payments`, and so on) **require the order's `rowVersion`** (body or `If-Match`) and return the new one. The UI-spec flow is a modal per child on the detail page (C-3), so the client must refresh the order's `rowVersion` after each child save, or the second modal in a row 409s on itself.
- Write the integration test first: two `DbContext`s load the same order, each changes a different child, the second `SaveChanges` must throw `DbUpdateConcurrencyException`, and the endpoint maps it to 409 ProblemDetails.

**Warning signs:** The concurrency test only covers editing order header fields. Child endpoints don't accept a `rowVersion`.

**Phase to address:** Orders core (Order images and Company expenses reuse the pattern).

---

### Pitfall 5: `ORD-YYYY-NNNN` per-year numbering: races, the Manila year boundary, legacy collisions, and test resets

**What goes wrong:**
- A SQL `SEQUENCE` (PRD) isn't per-year (UI spec, C-15). A yearly `ALTER SEQUENCE … RESTART` job is racy and fragile on shared hosting, where scheduled jobs aren't guaranteed.
- `SELECT MAX(...)+1` races under concurrent creates and produces duplicates or unique-index failures.
- Year boundary: if the year comes from UTC, orders created on Jan 1 between 00:00 and 07:59 Manila time get last year's prefix.
- **Legacy collision:** cutover is likely mid-year (late 2026). Legacy orders already use 2026 numbers (the seed even shows ORD-2026-0148). If the new 2026 series starts at 0001, it collides with migrated numbers, or worse, a near-duplicate confuses staff and customers.
- Respawn deletes rows but **doesn't reset `SEQUENCE` objects**. A test asserting "first order is ORD-2026-0001" passes alone and fails in the suite. (Respawn's documented options are `TablesToIgnore`, `SchemasToInclude/Exclude` and `DbAdapter`. Sequences aren't covered.) **[MEDIUM]**

**How to avoid:**
- Use a counter table `OrderNumberSeries(Year PK, LastValue)`, incremented atomically in the order-creation transaction: `UPDATE … SET LastValue = LastValue + 1 OUTPUT inserted.LastValue WHERE Year = @y`, inserting the year row if missing (under `UPDLOCK, HOLDLOCK`). That's race-free, gapless except on rollback, and serializes creates, which is fine at this shop's volume. This departs from the PRD's literal "SQL SEQUENCE", so get the C-15 ruling.
- Take the year from `IClock` in Asia/Manila (Pitfall 6), not `DateTime.UtcNow.Year`, and not the user-editable `OrderDate`. Decide which one the owner means.
- Add a unique index on `OrderNumber`. Legacy numbers are preserved as-is (allow a longer length or a separate `LegacyOrderNumber`). **Legacy data import seeds `OrderNumberSeries` from the max legacy number per year**, with a test for it.
- Concurrency test: 20 parallel creates give 20 unique, contiguous numbers.
- Because the counter is a table, Respawn resets it naturally. If a `SEQUENCE` is still used anywhere, the reset helper must `ALTER SEQUENCE … RESTART`.

**Warning signs:** `MAX(` in number generation. Tests that pass alone and fail in the suite. No test at a Dec 31 → Jan 1 Manila instant.

**Phase to address:** Orders core. The seeding step belongs to Legacy data import.

---

### Pitfall 6: Business-time-zone bugs ("today", month boundaries, `Asia/Manila` on Windows)

**What goes wrong:**
- "Payment date not in the future" checked against the **UTC** date: at 07:00 Manila on Oct 7 it's still Oct 6 UTC, so a payment dated Oct 7 is rejected for ~8 hours every morning, exactly when the shop opens.
- Dashboard "Collected · Oct", "due this week", overdue flags, the greeting (`d.getHours()` in the spec example), "Open now" and the expense default range (last 30 days) all need Manila boundaries.
- The spec's `formatDate()` uses the **browser** time zone for full ISO timestamps. CI and Playwright run in UTC, so tests flake around midnight and month ends.
- `TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila")` on Windows depends on ICU, which Windows 10 1903+ / Server 2019+ has. On an older host it throws `TimeZoneNotFoundException` **only in production**. The Windows id is `Singapore Standard Time`. **[MEDIUM]**
- Legacy timestamps are probably stored as Manila local time without an offset. Importing them as UTC moves late-evening orders to the previous day and changes month totals (see Pitfall 18).

**How to avoid:**
- `IClock` exposes `UtcNow` and `TodayInBusinessZone()` / `BusinessNow()`, built on `TimeProvider`. Resolve the zone from site settings with fallback ids (`Asia/Manila` → `Singapore Standard Time` → fixed +08:00; PH has no DST). `/health` fails if zone resolution fails.
- Calendar facts (`OrderDate`, `DueDate`, `PaidOn`, expense date) are `DateOnly` ↔ `date`. Instants (`CreatedAt`, audit) are `datetimeoffset` in UTC.
- Client: compute "today" with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })`. Set Vitest `TZ` and Playwright `timezoneId: 'Asia/Manila'` (and run one suite with a non-Manila zone). Use a fake clock in tests at 2026-10-06T23:30Z and 2026-12-31T16:30Z.

**Warning signs:** `DateTime.Today` or `DateOnly.FromDateTime(DateTime.UtcNow)` anywhere. Tests that fail only when run after 4 PM PH time.

**Phase to address:** Foundation (`IClock`, formatters, OD-2). Enforced in Orders core and Company expenses, and in Legacy data import for legacy timestamps.

---

### Pitfall 7: Dev/test engine ≠ host engine (SQL Server version, compatibility level, collation)

**What goes wrong:**
- This machine has **LocalDB 17.0.4025.3 (SQL Server 2025)** and a Linux Docker engine **[measured]**, so local and CI can both be 2025. The SmarterASP.NET database server version and the **database compatibility level** are unverified. Aggregator sites claim SQL 2025 support, but that's **[LOW]**.
- **EF Core 10** switches JSON columns and primitive collections to the native `json` type when you call `UseCompatibilityLevel(170)` or `UseAzureSql()`. A migration generated that way fails on an older engine or a lower compat level. **[MEDIUM, EF Core 10 breaking-changes doc]**
- The host's default collation (case/accent sensitivity) changes unique-email behavior and search semantics compared with dev.

**How to avoid:**
- **Foundation spike (do this first):** provision the staging DB on the host and record `SELECT @@VERSION, SERVERPROPERTY('Collation'), compatibility_level` in RESEARCH.md. Then:
  - set `UseCompatibilityLevel(<host level>)` **explicitly** in EF configuration;
  - pin the column collation for `Email` and `NormalizedEmail` if needed;
  - add a CI job that applies the **idempotent script** to a container DB with the compat level set to the host's.
- Avoid JSON columns unless a requirement needs them. Strings are `nvarchar` (the ₱ sign isn't in code page 1252).

**Warning signs:** No one has run `@@VERSION` on the host by the end of Foundation. A migration contains `json` or `vector` types.

**Phase to address:** Foundation. Hardening re-checks before the release script.

---

### Pitfall 8: Migrations vs zero-warnings, dynamic seeds and idempotent scripts

**What goes wrong:**
- **Analyzer noise on generated code:** CA1861 (constant arrays) fires on EF migrations. `dotnet format --verify-no-changes` reformats them. `GenerateDocumentationFile` + warnings-as-errors flags any undocumented public members. The OpenAPI and XML-doc generators add their own warnings. Phase 1 stalls on "fixing" generated files. **[LOW–MEDIUM]**
- **EF Core 9+ throws `PendingModelChangesWarning`** on `Migrate()` / `database update` when the model differs from the snapshot. The usual hidden cause is **dynamic values in `HasData`** (`Guid.NewGuid()`, `DateTime.UtcNow`) in the dev seed. **[MEDIUM]**
- **Idempotent scripts:** SQL Server compiles every `IF NOT EXISTS(...) BEGIN … END` batch even when it won't run. Custom `migrationBuilder.Sql(...)` that references a column added or renamed in another migration fails with "Invalid column name" on re-run (efcore #12911, #29530). **[MEDIUM]**
- **Migrations that only work on an empty DB:** once legacy data is in production, a new `NOT NULL` column without a default, a narrowed type, or a new unique index on dirty data fails during the production run.

**How to avoid:**
- `.editorconfig`: `[src/Csps.Infrastructure/Persistence/Migrations/**.cs]` → `generated_code = true`, and exclude the folder from `dotnet format`. Document the justification once, as PRD §17.1 requires. Do this in the **first** Foundation plan, before the initial migration.
- Use `HasData` only for static lookup rows with literal values. Put the realistic dev seed in `UseSeeding` / `UseAsyncSeeding` or a seeder service.
- Wrap all custom `Sql()` in `EXEC(N'…')`.
- CI applies the idempotent script **twice** to an empty DB, then once to a DB at the previous release's migration with seeded data. After Legacy data import, also run it against a sanitized copy of a populated DB.

**Warning signs:** `#pragma warning disable` showing up in migration files. `dotnet ef migrations add` producing a non-empty migration with no model change.

**Phase to address:** Foundation. Ongoing every phase. Legacy data import adds the populated-DB check.

---

### Pitfall 9: Refresh-token rotation races and reuse-detection false positives

**What goes wrong:**
- **React 19 StrictMode** double-invokes effects in dev. An app-boot `refresh()` fires twice at once. The second request carries the token the first just rotated, reuse detection revokes the family, and you get a sign-out loop in dev and in any E2E run against a dev build.
- **Multiple tabs:** access tokens live in memory per tab (PRD), so every tab refreshes on reload or wake. Two tabs sending the same cookie at once trips reuse detection. Single-flight inside one tab (PRD §9.3) doesn't cover tabs.
- **Lost responses:** on PH mobile networks the server rotates, then the response is lost. The client retries with the old token, the family gets revoked, and the user is signed out.
- **Parallel Playwright workers** sharing one `storageState` refresh cookie revoke each other's family, and the suite flakes en masse.
- Rotation that extends the **absolute** 90-day / 12-hour lifetime (sliding by accident) breaks AUTH-05 and CWE-613.
- Restored "session cookies": Chrome and Edge "continue where you left off" restore cookies without `Expires`, so "ends when the browser closes" isn't guaranteed. The server-side 12-hour absolute cap is the real control.

**How to avoid:**
- Client: wrap refresh in `navigator.locks.request('csps-refresh', …)` (Web Locks, supported in all evergreen browsers). A second tab waits, and its refresh then sends the **already rotated** cookie from the shared jar. Keep the in-tab single-flight promise too.
- Server: a short **grace window** (for example 30 s). Reusing the immediately previous token, from the same `sid`, inside the window issues a fresh child in the same family instead of revoking. Outside the window, or with a different `sid`, revoke the family and audit it. Store `FamilyId`, `ParentHash`, `ReplacedAt` and `AbsoluteExpiresAt` (inherited, never extended).
- E2E: each worker signs in its own user and family. Never share a refresh cookie between workers.
- Write the tests: two concurrent refreshes with the same token → both succeed inside the grace window; replay after the window → family revoked; rotation never extends `AbsoluteExpiresAt`.

**Warning signs:** "Randomly logged out" reports. The audit log shows token-reuse events with the same `sid` milliseconds apart.

**Phase to address:** Identity & authentication.

---

### Pitfall 10: Cookie and auth-scheme wiring mistakes

**What goes wrong:**
- **`__Host-` requires `Path=/`, `Secure` and no `Domain`.** PRD §8.1 wants `Path=/api/v1/auth`. A `__Host-` cookie with that path is **rejected silently**: no error, refresh never authenticates, and only production (HTTPS) shows it. **[MEDIUM, MDN]**
- Deleting a cookie needs the same `Path`, or sign-out "succeeds" and the cookie survives.
- **`AddIdentity<>()`** registers cookie schemes and makes cookies the default challenge. Unauthenticated API calls then get **302 → `/Account/Login`** HTML instead of a 401 ProblemDetails, and `httpClient` fails to parse it.
- **Role claim mapping:** with default inbound claim mapping, `role` becomes `http://schemas…/role`. Role policies then fail (or pass, depending on configuration), and the authorization matrix catches it late.
- **Deactivation and role change "immediately" (USER-05):** a 15-minute JWT stays valid after deactivation unless each request checks the `sid`.
- `SameSite=Strict` is **fine** here. A first navigation from Facebook or Gmail doesn't carry the cookie, but the SPA's later same-origin `fetch` does. Don't design server-rendered redirects that depend on the refresh cookie.

**How to avoid:**
- Name the cookie `__Secure-csps_rt; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict`. Use the same pattern for the pending-login ticket cookie.
- Use `AddIdentityCore<ApplicationUser>().AddRoles<…>().AddSignInManager().AddEntityFrameworkStores()` with JwtBearer as the only default scheme.
- Set `MapInboundClaims = false`, `RoleClaimType = "role"` and `NameClaimType = "sub"`.
- Validate the `sid` on every authenticated request against a session store (DB with a short `IMemoryCache` TTL, invalidated on revoke).
- Refresh requires a custom header (for example `X-CSRF: 1`). Cross-origin pages can't send one without a CORS preflight, and CORS stays disabled.
- Add an integration test that parses `Set-Cookie` and asserts prefix, path, flags and expiry for both the remember-me and the session variant.

**Warning signs:** A 302 in any API response. Refresh works on `http://localhost` but not on staging.

**Phase to address:** Identity & authentication. Profile & user management covers immediate revocation.

---

### Pitfall 11: 2FA brute force across tickets, timing enumeration and lockout-as-DoS

**What goes wrong:**
- **Fresh tickets reset the counter:** there are 5 wrong attempts per *code*, but an attacker who has the password signs in again to get a new ticket and 5 more guesses. The 5-per-hour cap in AUTH-04 covers *resend*, not new sign-ins.
- **Timing enumeration (CWE-204/203):** for an unknown email, Identity returns before running PBKDF2, so it answers faster. Forgot-password that sends SMTP synchronously only for existing accounts adds 300 ms–2 s. Both reveal which accounts exist.
- **Lockout as DoS:** staff emails are guessable Gmail addresses (see the seed). Five bad passwords every 15 minutes keep a Manager locked out, and each lockout sends an email (AUTH-07), so the attacker can also bomb the Manager's inbox.
- **C-8:** the UI spec's "This account is deactivated." banner reveals account state, which contradicts AUTH-01 and CWE-204.

**How to avoid:**
- Cap failed 2FA verifications **per account across all tickets** (for example 10 per hour). Past the cap, count it as a lockout event and notify.
- Run a dummy PBKDF2 verification for unknown users. Send all auth email through a **DB outbox**: insert, fire-and-forget the dispatch, and retry with a scheduled job. Responses then take the same time whether or not the account exists.
- Rate-limit per IP (and per /64 for IPv6) **before** per-account lockout. Send at most one lockout email per lockout window. Write a break-glass runbook for "all Managers locked out".
- Resolve C-8 in favor of the PRD's generic message unless the owner rules otherwise.
- Write timing tests: compare p50 latency for existing vs non-existing emails within a tolerance (keep these out of the fast test lane).

**Phase to address:** Identity & authentication.

---

### Pitfall 12: Email deliverability is a sign-in dependency

**What goes wrong:**
Every sign-in needs an emailed code (AUTH-02), and invites, resets and email-change confirmations all go by email. Staff use @gmail.com and @yahoo.com addresses (UI-SPEC §12.1). Gmail requires at least SPF or DKIM, valid forward and reverse DNS, and TLS even from low-volume senders. Bulk senders also need DMARC. **[MEDIUM, Google sender guidelines]**

The sender domain is still a placeholder (`[hello@yourdomain.ph]`, OD-12). If mail comes from an unauthenticated or shared host domain, codes land in spam or never arrive. Then no one can sign in, which effectively takes the site down.

Related trap: the shared mail server's TLS certificate name doesn't match the configured SMTP host, so a developer "fixes" it with `ServerCertificateValidationCallback = (_,_,_,_) => true` (CWE-295).

**How to avoid:**
- Ask OD-12 **before** the Identity & authentication phase starts, not at its discuss step. Owning a domain with DNS access is on the critical path.
- In the Foundation staging spike, send a test mail to Gmail and check "Show original" for `spf=pass dkim=pass dmarc=pass`. Use the SMTP hostname that matches the provider's certificate. Never disable validation; add a test that `IEmailSender` has no custom validation callback.
- Keep emails transactional, with a plain-text part, consistent From and Reply-To (T1566 lookalike defense), and the code in the body, never the subject (subjects show up in lock-screen notifications).
- Runbook: what to do when mail is down (a Manager-run break-glass procedure, documented and audited).

**Phase to address:** Foundation (spike). Identity & authentication (implementation). Production cutover (the DNS records exist on the production domain).

---

### Pitfall 13: Verbatim UI-spec code vs PRD lint, type, CSP and a11y gates

**What goes wrong:**
The UI spec says to copy Appendix D unchanged and that it was verified with *its own* tsconfig and no ESLint. The PRD's gates are stricter. Measured from the appendices **[measured]**:

| Copied code | PRD gate it breaks |
|---|---|
| `Mark` renders `MARK_SVG` with `dangerouslySetInnerHTML` (index.tsx:70) | PRD bans `dangerouslySetInnerHTML` by ESLint (CWE-79) |
| `main.tsx`: `document.getElementById('root')!` | `no-non-null-assertion` |
| Spec tsconfig: `noUncheckedIndexedAccess: false`, no `exactOptionalPropertyTypes` | PRD §17.2 requires both. Optional props passed `cond ? x : undefined`, plus indexed lookups (`MONTHS[…]`, `ICONS[name]`) need changes |
| `Modal`: Esc and scrim close only. No initial focus, focus trap or focus return (index.tsx:547–568) | UI-SPEC §10 and PRD §12 require trap and return. Because "Appendix › prose", an agent may treat the appendix as done |
| `Tabs`: `role="tab"` with no `aria-controls`, tabpanel ids or arrow-key roving `tabindex` | ARIA tabs pattern and the keyboard pass |
| Overlay `onMouseDown` on a `div` | `jsx-a11y` strict (`no-static-element-interactions`) |
| `ImageUploader`: `URL.createObjectURL` previews, never revoked | CSP `img-src` needs `blob:`, otherwise blank thumbnails in production only. Memory leak too |
| Vite default `assetsInlineLimit` 4 KB | Small font subset files and SVGs get inlined as `data:` URIs. `font-src 'self'` blocks fonts loaded from `data:` |
| Spec `vite.config.ts` has no `server.port`, `strictPort` or `outDir` | CLAUDE.md requires 5180 / `strictPort`. PRD builds into `src/Csps.Server/wwwroot` |

**How to avoid:**
- Plan an explicit **"design-system import + reconciliation"** task in Foundation. Copy verbatim, then make the minimum edits to pass PRD gates **without changing the rendered DOM**, each marked `// SPEC-DEVIATION: <reason>`. Snapshot-test the DOM against the verbatim version to prove the markup is unchanged.
- Replace the `Mark` markup string with JSX elements (identical output). Add a `useFocusTrap` hook and tab ARIA wiring as props or behavior only. Revoke object URLs on remove and unmount.
- CSP: `img-src 'self' data: blob: https://res.cloudinary.com`. Set `build.assetsInlineLimit` to a function that never inlines fonts.

**Warning signs:** Foundation's lint run shows hundreds of errors in `src/ui/index.tsx`. Someone proposes an `eslint-disable` at the top of the file.

**Phase to address:** Foundation. Order images covers the uploader specifics.

---

### Pitfall 14: CSP `style-src 'self'` and `script-src 'self'` vs what actually runs

**What goes wrong:**
- **React `style={{…}}` is fine:** React's client renderer sets styles through the CSSOM (`el.style.x = …`), which `style-src` doesn't govern. Six components use `style={{}}` and Appendix E has 120 inline `style="…"` attributes that become style objects **[measured]**. Verify it with a test instead of assuming. **[MEDIUM]**
- **What does break:** anything that inserts `<style>` elements or `style=""` attributes through HTML parsing:
  - Vite's **dev server** injects CSS as `<style>` tags, so running the production CSP in dev breaks the page;
  - libraries that inject `<style>` (some chart and toast libraries, TanStack Query Devtools);
  - an **inline theme bootstrap `<script>`** in `index.html` (commonly added to avoid an Espresso flash) is blocked by `script-src 'self'`;
  - any `innerHTML` SVG strings with `style` attributes.
- The CSP set in middleware and the CSP in `web.config` may differ or double up. Two CSP headers both apply, which tightens rules unexpectedly.

**How to avoid:**
- Apply the CSP only to the production build: middleware sets it, dev uses Vite with no CSP or a separate relaxed dev policy. E2E always runs against the **built** app served by the API on port 5199.
- In Playwright, listen for `securitypolicyviolation` (`page.on('console')` plus an injected listener) and fail the test on any violation.
- Ship `Content-Security-Policy-Report-Only` to staging first, with a report endpoint (rate-limited), then enforce.
- Read the theme from `localStorage` inside the React layout (admin only, public is always light), or put the bootstrap in an external file `/theme-init.js`. No inline script.
- Set the CSP in exactly one place.

**Phase to address:** Foundation (headers, E2E harness). Re-verified in Hardening (ZAP).

---

### Pitfall 15: The PWA service worker caches API/auth responses or serves stale builds

**What goes wrong:**
With vite-plugin-pwa/Workbox defaults, the SPA navigation fallback answers **every** navigation, including `/api/...` URLs opened from emails, `/health` and `/openapi/...`, with the cached `index.html`. Runtime-caching rules copied from examples cache `/api` GETs, which puts customer data on shared shop PCs (violates PRD §7.1). `sw.js` or `index.html` cached by IIS means the "new version available" prompt never fires. In Playwright, a lingering service worker serves the old bundle.

**How to avoid:**
- `navigateFallbackDenylist: [/^\/api\//, /^\/health/, /^\/openapi/]`. No `runtimeCaching` for `/api`. `registerType: 'prompt'`.
- Send `Cache-Control: no-store` on every API response.
- `web.config`: `no-cache` for `index.html`, `sw.js` and the manifest; `immutable` for hashed assets.
- Playwright: `serviceWorkers: 'block'` by default, plus one dedicated SW spec.
- Recommendation: add the PWA in Hardening, not Foundation. It's a late enhancement, and it adds a dependency and its legitimacy check.

**Phase to address:** Hardening (or whichever phase adds the PWA). The `no-store` header belongs in Foundation.

---

### Pitfall 16: SmarterASP.NET shared-hosting realities

**What goes wrong (each item needs checking in the Foundation spike):**
- **Runtime patch level:** a framework-dependent publish built with SDK 10.0.4xx may need a newer ASP.NET Core runtime patch than the host has, which gives HTTP 500.31 / 500.30. Self-contained avoids that but is ~100 MB per deploy, against disk quota and slow Web Deploy. Hosts claim .NET 10 support. **[LOW]**
- **File locks:** in-process hosting locks DLLs, so Web Deploy fails with `ERROR_FILE_IN_USE` unless `app_offline.htm` is used. If the deploy fails midway, `app_offline.htm` can be **left behind**, and the site stays down.
- **Cold starts:** idle app pools recycle (often after 20 minutes). The first request pays .NET start-up plus EF model build, so Lighthouse CI and the API p95 budget measured against staging fail at random.
- **SPA fallback swallows API 404s:** `MapFallbackToFile("index.html")` without excluding `/api` returns `200 text/html` for unknown API routes. Server-level IIS `httpErrors` settings can also replace ProblemDetails bodies on 4xx/5xx. **[LOW]**
- **Upload limits:** IIS `maxAllowedContentLength` (30 MB by default) and request filtering apply to in-process uploads. The public inquiry form's "multiple × 10 MB" (C-12) can exceed it.
- **Scheduled jobs:** the host lists "Scheduled Tasks" (URL calls). **[LOW]** The fallback is a GitHub Actions cron hitting a secret-protected maintenance endpoint. Actions cron is best-effort and can run minutes late, so jobs must be idempotent and tolerate skipped runs.
- **Database size:** plan quotas vary (10 GB has been reported on mid plans **[LOW]**). Analytics `PageView` (13-month raw) and the audit log are the growth tables. Cloudinary holds the images.
- **Data Protection:** `PersistKeysToDbContext` works. With no certificate available, keys are stored unencrypted, and the framework logs a **warning** ("No XML encryptor configured") on every start. Decide whether startup log warnings count against the zero-warning rule, and document the risk acceptance.

**How to avoid:**
- Make **"Hosting verification spike"** the first Foundation deliverable: a hello-world .NET 10 app on staging that records runtime version, `@@VERSION` and compat level, the time-zone resolution, the client IP as `RemoteIpAddress` sees it plus the forwarding headers, an SMTP test, a scheduled-task test and the disk/DB quotas.
- Deploy with MSDeploy `-enableRule:AppOffline` and a post-step that always deletes `app_offline.htm`. Smoke-test after every deploy.
- Publish with ReadyToRun and use an EF compiled model. Run a keep-warm ping from the scheduler. Lighthouse CI runs one warm-up request before measuring.
- Integration test: `GET /api/v1/nope` returns `404 application/problem+json`. A staging smoke test asserts the same through IIS.

**Phase to address:** Foundation (spike + deploy pipeline). Hardening (backup/restore test, runbooks).

---

### Pitfall 17: Rate limiting keyed on the wrong client IP

**What goes wrong:**
ASP.NET Core rate limiting partitions on `HttpContext.Connection.RemoteIpAddress`. If SmarterASP.NET (or a CDN the owner later adds, such as Cloudflare) sits in front of IIS, every visitor shares the proxy's IP. One attacker then rate-limits **everyone** off the login page. If you trust `X-Forwarded-For` blindly instead, attackers spoof it and bypass the limits. The limiter is in-memory, so counters reset on every app-pool recycle. DB-backed Identity lockout is the durable backstop. The analytics IP truncation and HMAC (ANL-05) and the audit-log IP have the same dependency.

**How to avoid:** Measure the topology in the hosting spike. Enable `ForwardedHeaders` only with explicit `KnownProxies`/`KnownNetworks` if a proxy is confirmed. Partition by IP (IPv6 /64) **and** by account. Write a test proving that a spoofed `X-Forwarded-For` from an untrusted peer is ignored.

**Phase to address:** Foundation (measurement). Identity & authentication (limiters).

---

### Pitfall 18: Legacy `.bak` restore and data-quality traps

**What goes wrong:**
- **Restore target conflict (C-20):** CLAUDE.md says "restore it into LocalDB as `CSPS_Dev`". Doing that overwrites the dev database the app migrations created and mixes legacy schema into the app's DB. That's exactly what Prime Directive 11 forbids.
- **Version direction:** restoring an older backup into LocalDB 2025 works and upgrades the restored copy (harmless, it's read-only). A backup taken on a *newer* engine than the target can't be restored. Compressed backups, multi-file sets or TDE-encrypted backups fail differently.
- **Collation and encoding:** legacy `varchar` columns under code page 1252 can't hold ₱, so some text may already show `?`. Emails differing only by case or trailing spaces collide under the new unique index.
- **Money types:** legacy `money` (4 decimal places) or `float` columns give sums that don't reconcile to the centavo with the new `decimal(18,2)` computation.
- **Invariant violations in real data:** orders with no items, negative amounts, payments above the total (overpayment), more than 5 images (C-2), due date before order date (C-14), multiple discounts (C-1), unknown statuses (OD-3), orphaned children. The new domain invariants reject them, so the import stalls.
- **Local-time timestamps** read as UTC (Pitfall 6).
- **Images** may not be in the `.bak` at all: they may be file paths on the live site's disk, or `varbinary` blobs. Getting files from the live site touches production (Prime Directive 1), so it needs an owner decision.
- **Passwords:** legacy hashes (Membership SHA1, MD5, or plaintext) can't move to Identity. Every migrated staff user needs the "set your password" email at go-live, which depends on Pitfall 12.

**How to avoid:**
- Restore as **`CSPS_Legacy_Restore`**. It keeps the `CSPS_` prefix, so it complies with CLAUDE.md. Ask the owner to amend the CLAUDE.md line in Foundation so no session follows it literally.
- Discovery first runs **only** `RESTORE HEADERONLY` / `FILELISTONLY`, then `RESTORE … WITH MOVE` into user-writable paths. A guard in the tooling refuses any DB name not matching `CSPS_%`.
- `LEGACY-SCHEMA.md` gets a data-quality section with counts per anomaly class. `LEGACY-MAPPING.md` gives each anomaly an owner-approved rule: transform, reject with reason, or extend the model through a migration.
- The ETL goes through the **same domain factories** as the app. An anomaly can't bypass invariants silently; it is either transformed (and listed in the report) or rejected (and listed).

**Phase to address:** Legacy discovery & mapping. Foundation handles the CLAUDE.md wording ruling for C-20.

---

### Pitfall 19: Reconciliation that "passes" but means nothing, and an ETL that can't be re-run

**What goes wrong:**
- Reconciliation compares new stored totals with new recomputed totals (a tautology) instead of **legacy source figures vs new figures**.
- "100%" gets quietly redefined as "within ₱1".
- Rows rejected by the ETL vanish from the count totals because both sides count only imported rows.
- Re-running the ETL duplicates rows, or re-uploads images to Cloudinary (hitting rate limits and quota).
- A per-batch transaction succeeds for orders but fails for their images, leaving half-migrated aggregates.

**How to avoid:**
- Reconcile **source-side** aggregates (legacy row counts, Σ legacy amounts by type, per-order legacy stored totals where they exist) against target aggregates. Report three buckets: matched, transformed (with rule id) and rejected (with reason). Unexplained deltas must be **zero centavos**, and any rounding transformation is itemized.
- Make imports idempotent with unique `LegacyId` indexes and upserts. For images, keep a resumable mapping table (`LegacyImageId → PublicId, Status`) so a re-run skips finished uploads. Keep PRD-style random public ids and use the mapping table, not deterministic ids, for idempotency.
- The aggregate is the transaction unit: an order and all its children commit together, and image upload happens in a separate resumable stage.
- Add a `--dry-run` that produces the full report with no writes. That report is what the owner signs.

**Phase to address:** Legacy data import.

---

### Pitfall 20: Cutover with no rehearsed timing and no real rollback boundary

**What goes wrong:**
- The dress rehearsal ran on an old `.bak`. On the day, the fresh backup is bigger, the ETL plus image upload overruns the maintenance window, and there's pressure to skip reconciliation.
- The legacy app has no "read-only mode" (§19.4 step 1 assumes one), so staff keep entering orders during the backup and those orders are lost.
- The new site's TLS certificate isn't issued until the domain switches, which means minutes to hours of certificate errors with HSTS already on.
- **Rollback is only real until staff record the first order in CSPS.** After that, re-pointing to legacy loses new data, because there is no reverse ETL.
- Running the ETL from this machine against the production DB over the internet is slow and fragile.

**How to avoid:**
- Time the rehearsal on a backup of comparable size and set the window from the measured time × 2.
- Put the legacy site behind `app_offline.htm` as the read-only mechanism. That modifies the live site, so it happens only at cutover with the owner present.
- Pre-provision the certificate and bindings on a staging hostname. Enable HSTS only after verification, and don't preload in this milestone.
- The runbook defines a **point of no return** (for example "rollback allowed until T+2 h, and only if no new orders have been entered") and a manual re-entry plan after that.
- Prefer ETL locally into a fresh, fully migrated CSPS DB → reconcile → back up → restore on the host (if the control panel supports `.bak` restore **[LOW]**), over a long remote ETL run.

**Phase to address:** Production cutover, with timing evidence from Legacy data import's dress rehearsal.

---

### Pitfall 21: Test infrastructure on a shared machine (LocalDB vs Testcontainers, ports, the email sink)

**What goes wrong:**
- **C-20:** the PRD mandates Testcontainers SQL 2025, and CLAUDE.md mandates LocalDB `CSPS_Test_<guid>`. Teams end up with two half-working fixtures. Both are viable here: LocalDB is 2025 (17.0.4025.3) and Docker runs a Linux engine **[measured]**.
- The default `(localdb)\MSSQLLocalDB` instance is **shared with TheBETSLLC**. Heavy parallel test DB creation slows the other project. An over-broad cleanup script that drops "test databases" could hit `BetsLLC_*`.
- Docker maps container ports to **random host ports in the 49152–65535 dynamic range**, which CLAUDE.md says to avoid. Hyper-V/WSL reserved blocks there cause intermittent "port not available" failures.
- **Respawn:** without `TablesToIgnore` for `__EFMigrationsHistory` and static lookup/role tables, resets break later tests. Sequences aren't reset (Pitfall 5).
- **The test email sink:** if it's only *registered* when `ASPNETCORE_ENVIRONMENT=Testing`, a host misconfiguration exposes every 2FA code, which is a full auth bypass. If it's compiled out, Playwright needs a separate build.
- **E2E 2FA flakiness:** the resend cooldown (60 s), send caps (5/hour) and lockouts hit shared test users. Polling the sink races the outbox dispatcher.
- Playwright `reuseExistingServer: false` on 5199 fails fast if anything holds the port. That's the desired behavior, but only if the preflight script runs first.

**How to avoid:**
- One `ITestDatabase` abstraction:
  - **local default:** LocalDB per CLAUDE.md, ideally a **dedicated named instance** (`sqllocaldb create CSPS`, propose this to the owner) holding `CSPS_Test_<guid>` databases;
  - **CI:** a Testcontainers `mssql/server:2025-latest` image on Linux runners, with a `CSPS_TEST_DB=container` switch for local parity runs.
  - Create and migrate one DB per test collection, and Respawn between tests.
  - The cleanup helper only matches `^CSPS_Test_[0-9a-f-]{36}$`, and a unit test proves it refuses `BetsLLC_*`.
- If random container ports fail, pin a host port outside the dynamic range for the single CI or local container. Record this as a CLAUDE.md-compatible exception.
- **Compile the email sink out** of Release: a separate `Csps.Testing.EmailSink` assembly referenced only in a `Testing` build configuration, plus `#if`. Tests: (a) a reflection test over the Release publish output asserts the type and route are absent; (b) a staging smoke test asserts `404` on the sink route.
- Each E2E test gets its own seeded user. Rate-limit settings are configurable only in Testing builds. A test pins the Production values (5 attempts, 60 s, 5/hour) so nobody loosens them.
- Set `ASPNETCORE_ENVIRONMENT=Testing` only in Playwright `webServer.env`, never at machine level. Wire the preflight call into the npm `e2e` script.

**Phase to address:** Foundation (fixtures, ports, preflight wiring). Identity & authentication (email sink, 2FA E2E).

---

### Pitfall 22: Frontend budgets and toolchain friction

**What goes wrong:**
- **CSS budget is safe; don't over-engineer it.** The Appendix CSS gzips to **15.4 KB** (tokens 1.6, compat 0.2, components 7.1, screens 7.9) **[measured]**. Tailwind preflight, glue utilities and fontsource `@font-face` CSS add roughly 4–8 KB, for an estimated ~20–25 KB against 35 KB. The real risk is Tailwind v4's automatic source detection picking up stray files, such as `.md` spec copies under `web/`, and emitting junk utilities. Set an explicit `@source`.
- **The public JS budget (150 KB gz) is tight.** Rough estimates **[LOW–MEDIUM]**:

  | Part | Approx. gz |
  |---|---|
  | react + react-dom 19 | ~60 KB |
  | react-router | ~20–30 KB |
  | TanStack Query | ~12–13 KB |
  | design-system source (`index.tsx` 12.6 + `icons.ts` 3.0 + `mark.ts` 2.9 + `csps.ts` 2.8) **[measured]** | ~21 KB |
  | react-hook-form | ~10 KB |
  | full zod | ~15–20 KB |

  That's ~115–125 KB before page code, and **the Contact page with the form stack can breach 150 KB.**
- **TypeScript 7:** the UI spec says it was tested on TS 7.0, but **typescript-eslint can't run on TS 7.0** (no stable programmatic API until 7.1, and the peer range excludes it). PRD's `strict-type-checked` lint then fails to install. **[LOW–MEDIUM]**
- **React Compiler:** 1.0 has been stable since Oct 2025. `@vitejs/plugin-react` v6 (the spec lists 6.1) dropped built-in Babel, so the compiler needs an extra plugin (`@rolldown/plugin-babel` or an oxc integration), which means another dependency to vet. The compiler's lint rules can flag copied spec patterns. **[MEDIUM]**
- **iOS input zoom:** four spec selectors set control text to **14px**: `.s-toolbar .csp-input`, `.s-search-box input`, `.csp-search input` (topbar) and `.s-item .csp-input` (order item rows) **[measured]**. iOS Safari zooms on focus, which breaks PRD §7.1 (≥16px). `components.css` and `screens.css` must be byte-for-byte, so this needs an owner ruling and an override file. Never "fix" it with `maximum-scale=1` (axe `meta-viewport`).
- **Fonts:**
  - ₱ (U+20B1) sits in fontsource's latin-ext range, so verbatim imports fetch latin-ext. PRD's "subset to used characters" conflicts with verbatim `@fontsource` imports.
  - KPI money values use Barlow Condensed. If Barlow lacks ₱, each glyph falls back to Archivo, which looks off. Verify it.
  - Preloading a Vite-hashed font file needs an explicit `?url` import.
  - No metric-matched fallback ships with fontsource. A 96px italic hero headline swapping fonts is a real CLS > 0.05 risk.
- **Container queries:** responsive rules query `.s-page` (`@container pg`). Anything portaled outside `.s-page` (toasts, modals, lightbox, the mobile nav drawer) loses both theme and responsive rules. The spec warns about this, but generic portal code ignores it.

**How to avoid:**
- Add bundle budgets (for example `size-limit` or a Rollup stats check) in the **first** web plan:
  - separate public and admin entries;
  - lazy-load the form stack;
  - use `zod/mini` or validate the public form by hand;
  - keep charts, the uploader and the admin dashboard out of the public graph.
- Pin TypeScript 6.x for tooling (typescript-eslint, Vite types), optionally with `tsgo` as a fast non-gating checker. Re-evaluate at TS 7.1.
- Adopt the React Compiler only if lint stays at zero warnings after the design-system import. PRD §7.1 says "if stable and compatible".
- Add `overrides.css` (imported after `screens.css`, owner-approved) that bumps the four controls to 16px on coarse pointers or at the phone container size.
- Test `document.fonts.check('16px "Archivo Variable"', '₱')` and the same for "Barlow Condensed" in E2E. Add a manual `size-adjust` fallback `@font-face`.
- A lint or test rule: every `createPortal` target is the layout's `.s-page` ref.

**Phase to address:** Foundation (budgets, tooling, overrides). Public site & content management (Contact bundle, LCP/CLS).

---

### Pitfall 23: Accessibility failures hidden inside the approved design

**What goes wrong (contrast measured from Appendix A tokens):**
- Most text pairs pass, but several sit close to the threshold: `--accent-ink` on `--accent-soft` 4.85:1, `--danger` on `--danger-soft` 4.84:1, `--ink-subtle` on `--bg` 5.24:1 **[measured]**.
- **Inactive user rows at 72% opacity** drop `--ink-muted` on `--surface` to **3.69:1**, which fails 4.5:1. axe will flag it. Dimmed `.is-zero` cascade tiles are similar.
- **Orange `--accent` (#ff6600) on Blush `--bg` is 2.29:1** **[measured]**. It's fine as decoration, but it fails WCAG 1.4.11 where it's the **only** state indicator: the active-tab underline, the active nav marker, and the checked "Keep me signed in" checkbox (`accent-color: var(--accent)`). axe doesn't test non-text contrast, so only the manual audit catches it. (In Espresso the same pair is 6.51:1.)
- **Image reorder (C-16):** HTML5 drag-and-drop is unreliable from touch on mobile browsers, and drag-only reorder fails 2.5.7. Hover-revealed actions use `opacity: 0`. They stay focusable, so keyboard focus lands on invisible buttons (2.4.7 / 2.4.11).
- **Lightbox:** prev/next buttons are hidden on phones in favor of swipe, so a path gesture has no single-pointer alternative (2.5.1 / 2.5.7).
- **OTP:** there's no `OtpInput` in Appendix D (spec gap). Six separate inputs break iOS `one-time-code` autofill, which fills only the first box, and break paste of "123 456".
- **Skeletons:** they're `aria-hidden`, and the PRD wants `aria-busy` plus a polite live region. Naive implementations announce on every TanStack background refetch.
- **Toasts:** they auto-dismiss after 4.5 s, including danger toasts like "Couldn't save order". The toast live region must exist **before** content is injected, or screen readers miss it.

**How to avoid:**
- Raise OD-14 with this exact list at the first UI phase (Foundation): the 72% opacity, the orange-only state indicators and the 14px controls.
- Reorder: add "Move earlier / Move later" buttons and keyboard support, and reveal actions on `:focus-within` and `(hover:none)`. Lightbox: keep visible prev/next on phones.
- OTP: one `<input inputmode="numeric" autocomplete="one-time-code" maxlength="6">`, styled as six boxes, that strips spaces and dashes on paste.
- `LoadingRegion` wrapper: `aria-busy` plus a single announcement on the first load only.
- Danger toasts don't auto-dismiss, and every toast pauses on hover and focus.

**Phase to address:** Foundation (primitives). Identity & authentication (OTP). Order images (reorder, C-16). Public site & content management (lightbox). Hardening (manual NVDA/VoiceOver pass).

---

### Pitfall 24: Process traps: a Foundation that never ends, late conflicts, owner-decision stalls, scope creep

**What goes wrong:**
- PRD Phase 1 bundles a lot: solution, strict build, architecture tests, CI, migrations, seed, headers, ProblemDetails, logging, `/health`, React shell, routing, layouts, `httpClient` at 100% coverage, primitives, skeletons and a staging deploy. It also depends on two external owner actions, the **GitHub remote** and **SmarterASP.NET credentials**. Under TDD and zero warnings it crawls, and agents start suppressing warnings to make progress.
- `NuGetAuditMode=all` as errors: a new advisory against a transitive package (the SqlClient → Azure.Identity chain is a frequent one) turns `main` red overnight without a code change.
- `AnalysisLevel=latest-recommended` plus SDK roll-forward can add new analyzer warnings when an SDK feature band ships.
- The 21 PRD/UI-spec conflicts surface mid-phase, and work stops while waiting on the owner.
- **Scope creep from the public site (C-12):** the inquiry form with PDF/AI uploads (CWE-434: AI files are PDF/PostScript containers), storage, routing, spam protection without a third-party captcha (CSP!) and notification emails is effectively a small feature of its own. The gallery's DB-managed content and the C-21 product copy model add more.
- The dashboard (C-18) has no PRD phase. It needs both orders and company expenses.

**How to avoid:**
- Split Foundation into sub-phases (Fine granularity):
  - **1a** hosting and SQL verification spike, plus backend skeleton and CI;
  - **1b** web foundation (design-system import and reconciliation, budgets, tooling);
  - **1c** staging deploy pipeline.
- Ask for the GitHub repo and hosting credentials **before** 1a.
- `global.json` `rollForward: latestPatch`. Dependabot plus a documented "advisory response" path (pin or override within 24 h).
- Front-load owner asks: put a decision calendar in ROADMAP.md that lists which OD and C items each phase's discuss step must close, and send the security ones (C-4, C-5, C-8, C-9, C-19, OD-12) **before** Identity & authentication starts.
- Treat the inquiry form as its own requirement with an explicit owner decision on storage and attachments. Recommendation: no PDF/AI uploads in this milestone; images only, re-encoded through Cloudinary, plus a "send files on Messenger" message.
- Put the Dashboard after Company expenses, as its own plan.

**Phase to address:** Roadmap creation, and Foundation.

---

## Moderate Pitfalls

| # | Pitfall | Prevention | Phase |
|---|---|---|---|
| M1 | **Cascade delete plus Cloudinary in "one transaction"** (UI-SPEC §9.3, ORD-06). Remote deletes can't take part in a SQL transaction. Deleting remotely first loses images if the DB delete fails; deleting remotely after commit leaks images if the process recycles. | In the same DB transaction: delete the aggregate **and** insert `PendingImageDeletion(PublicId)` rows (outbox). A short idempotent job deletes from Cloudinary with retries (PRD §10). Test: kill the job mid-run, re-run, no leaks. | Order images |
| M2 | **Hard vs soft delete (OD-5)** decided late. Soft delete changes every query (global filters), unique indexes (`OrderNumber` reuse) and the reconciliation. The UI copy says "permanently deleted". | Decide in the Orders core discuss step. With soft delete, use filtered unique indexes and a Manager purge, and make sure the copy matches the behavior. | Orders core |
| M3 | **N+1 / over-fetch in list projections**, such as the cover-image thumbnail per order or the "Recorded by" name per expense. | Project the cover with a correlated `Take(1)` in the same query, or a stored `CoverPublicId` on the order. Add the PRD's query-count test for every list endpoint from day one. | Orders core, Company expenses |
| M4 | **`DateOnly` and the API:** `<input type=date>` gives `yyyy-MM-dd`, and JS `new Date('2026-10-06')` parses as UTC midnight, so it's off by a day west of UTC. | Keep calendar dates as strings end to end on the client. Use only `formatDate` (which appends `T00:00:00`). Never pass `DateOnly` values through `Date`. | Foundation |
| M5 | **`decimal` without precision**, which logs an EF warning and truncates silently. **Percent values** need their own precision. | A convention in `ConfigureConventions`: `decimal` → `(18,2)`, and `PercentValue` → `(5,2)`. A test asserts the model has no unconfigured decimals. | Orders core |
| M6 | **IDOR on nested routes:** `/orders/{A}/payments/{idOfPaymentInB}` updates B's payment if the lookup is by payment id alone (CWE-639). | Load children only through the aggregate (`order.Payments.Single(p => p.Id == id)`). The authorization matrix includes cross-order ids. | Orders core |
| M7 | **Sensitive data in logs:** `EnableSensitiveDataLogging`, request-body logging, Serilog destructuring of commands (codes, passwords, phone numbers). | Enable it only in Development, behind an env guard test. Use a destructuring policy that masks codes, tokens, passwords and phone numbers. Add a log-capture test that runs the sign-in flow and asserts the code isn't in the output. | Foundation, Identity & authentication |
| M8 | **HIBP outage:** k-anonymity calls time out, and either sign-up hangs (fail-slow) or weak passwords get through (fail-open). | 2 s timeout plus `Add-Padding: true`. On failure: fail **open**, write an audit entry, and re-check at next password change. An embedded top-N common-password list is the offline floor. Record the owner's ruling. | Identity & authentication |
| M9 | **C-4 temporary passwords / C-5 policy copy / C-19 default-checked "Keep me signed in"** shipped as drawn. The spec's own strength meter rates `Csp!Volt26` (10 chars) "Strong", but the PRD's minimum is 12. | Get owner rulings. Align the meter so it never says "Strong" below the PRD minimum, and use one shared policy constant. | Identity & authentication, Profile & user management |
| M10 | **Email change applied immediately (C-9)** per the UI toast copy. | Follow PROF-02 (confirm the new address, notify the old one), and change the toast to "Check your new inbox to confirm" (`// SPEC-GAP`). | Profile & user management |
| M11 | **Last-active-Manager guard races:** two Managers demote each other at the same time and both succeed. | Enforce the check inside a serializable transaction or with a DB-level guard. Concurrency test. | Profile & user management |
| M12 | **Cloudinary authenticated delivery (OD-9)** needs per-URL signatures. Every `srcset` width is a separately signed URL, and caching or CDN behavior differs. | Decide OD-9 before the uploader work starts. If authenticated, generate signed URLs server-side in DTOs with stable expiry buckets (cacheable). Test that `img-src` covers the delivery host. | Order images |
| M13 | **Magic-byte validation that trusts HEIC/WebP parsing in-process**, or downscaling on the client and skipping server re-validation. | Validate magic bytes plus a size cap on the server and let Cloudinary re-encode (`f_auto`). Reject SVG and polyglots. Client downscaling is only a UX optimization. | Order images |
| M14 | **Consent banner and GPC:** analytics script or beacon fires before a choice is made. "Reject" is styled weaker than "Accept". "Clear my data" misses HttpOnly cookies. | E2E asserts no `/analytics` request and no non-essential cookie before consent, with GPC `navigator.globalPrivacyControl = true`. Equal button variants. A server endpoint expires HttpOnly cookies. | Consent/analytics/legal |
| M15 | **Analytics write amplification on shared SQL:** one insert per page view, plus 13-month raw retention. | Batch ingestion. Aggregate daily with an idempotent job. Index by day. Watch the DB quota. | Consent/analytics/legal |
| M16 | **Output caching / HybridCache for site settings** not invalidated after a Manager edit, or invalidated only in one process. | Invalidate on write inside the same handler, and E2E "edit price → public page shows it". There's a single instance on shared hosting, but document the assumption. | Public site & content management |
| M17 | **OpenAPI → TS DTO generation vs `exactOptionalPropertyTypes`:** generated optional fields `prop?: T` vs `T \| undefined` mismatch, and nullable handling produces type churn. | Pick the generator early (MIT and verified). Configure nullable vs optional explicitly. CI drift check. | Foundation |
| M18 | **View Transitions** steal or lose focus after navigation and fight sticky headers. Not wrapped in a reduced-motion check. | Progressive enhancement only. Move focus to `h1` after the transition. Disable under `prefers-reduced-motion`. | Public site & content management |
| M19 | **Zero browser-console warnings vs third-party noise:** React Router future-flag warnings, a favicon 404, CSP report noise, `[vite]` messages. | Playwright fails on `console.warning` and `console.error`, with a short documented allow-list (none in production builds). Fix at the source. | Foundation |
| M20 | **Audit log "append-only"** can't be enforced if the host only gives a `db_owner` login. | Ask the host for a separate least-privilege login. If impossible, record the residual risk and add a hash chain (each row hashes the previous one) to make tampering detectable. | Hardening |

---

## Minor Pitfalls

| # | Pitfall | Prevention | Phase |
|---|---|---|---|
| m1 | `Math.round(-0.5)` → `-0` in JS vs −1 AwayFromZero, which matters for negative balances (overpayment). `formatPeso(-0)` prints `₱0.00` correctly. | Include negative vectors in the golden file. | Foundation |
| m2 | `document.body.style.overflow = 'hidden'` doesn't fully lock scroll on iOS Safari. | Also set `overscroll-behavior: contain` on the overlay. A manual iOS check. | Foundation |
| m3 | `localStorage['csps-theme']` and `['csps-orders-view']` are non-essential storage under the consent rules? | Classify as strictly necessary (UI preference) in the Cookie Policy. "Clear my data" handles them. | Consent/analytics/legal |
| m4 | Order-number regexes in search (`ORD-2026-0148`) vs legacy formats. | Search by prefix on both `OrderNumber` and `LegacyOrderNumber`. | Legacy data import |
| m5 | The `/` shortcut focusing search steals input from screen-reader users. | Ignore it when a modifier key is held or focus is in any editable field (the spec already checks this). Document it in the Accessibility Statement. | Foundation |
| m6 | `'up-' + Date.now()` uploader ids collide on fast double drops. | Use `crypto.randomUUID()`. | Order images |
| m7 | A PH mobile regex rejects `+63` with spaces or dashes. | Normalize first (strip spaces and dashes), then validate `^(09\|\+639)\d{9}$`. Share test vectors between zod and FluentValidation. | Orders core, Public site & content management |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy `csps.ts` `round2` verbatim | Matches the spec checklist | Centavo drift vs server (Pitfall 1) | Never. Fix with the owner ruling and golden vectors |
| Compute totals on read in LINQ | No denormalized columns | Third formula implementation, slow sort/filter, rowversion gap | Never for list endpoints |
| `[SuppressMessage]` / `#pragma` to get Phase 1 green | Speed | Hides real issues; violates PRD §17.1 | Only with justification and an issue link, and only for generated code via `.editorconfig` |
| Register the test email sink by environment instead of compiling it out | Single build | One misconfigured env var exposes every 2FA code | Never |
| Auto-migrate on startup "just for staging" | Easy deploys | Staging stops testing the production script path | Never (staging must rehearse production) |
| Restore the `.bak` as `CSPS_Dev` (CLAUDE.md wording) | Follows the literal rule | Breaks Prime Directive 11; conflates schemas | Never. Use `CSPS_Legacy_Restore` |
| Skip the grace window in refresh rotation | Simpler "pure" reuse detection | Users signed out on flaky networks and multiple tabs | Never for the web client |
| Fail-open HIBP without audit | No sign-up blocking | Weak passwords unnoticed | Fail-open **with** audit and a re-check is acceptable |
| Treat the inquiry form as part of "Contact page" | Matches the mockup | Unbounded upload/storage/spam scope (C-12) | Only images-only, after an owner ruling |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SmarterASP.NET Web Deploy | Deploying over locked DLLs; leaving `app_offline.htm` after a failed deploy | `-enableRule:AppOffline`, an always-run cleanup step, a post-deploy smoke test |
| SmarterASP.NET SQL | Assuming the dev engine/compat level; auto-migrating | Record `@@VERSION`/compat in the spike; explicit `UseCompatibilityLevel`; reviewed idempotent script after a backup |
| SmarterASP.NET mail (MailKit) | Disabling certificate validation; sending from an unauthenticated domain | The SMTP host that matches the cert; SPF + DKIM (+ DMARC) on the owner's domain; outbox with retry |
| Cloudinary | Deleting inside the DB transaction; client-side signed upload; deterministic public ids | Server-side signed upload, random ids, an outbox-driven deletion job, a resumable legacy mapping table |
| HIBP range API | Sending the full hash; no timeout; no padding | First 5 SHA-1 hex characters only, `Add-Padding: true`, 2 s timeout, documented fail mode |
| GitHub Actions | Unpinned actions; cron as a reliable scheduler; secrets in PR workflows from forks | Pin by SHA, idempotent jobs tolerant of late or skipped runs, environment-protected deploy secrets |
| Testcontainers on Windows | Expecting fixed ports; slow 2025 image start per test class | One container per run, Respawn between tests, a pinned port outside 49152–65535 only if needed |
| LocalDB (shared with TheBETSLLC) | Cleanup scripts matching `%Test%`; using the shared default instance for heavy parallel runs | Strict `CSPS_Test_<guid>` regex guard; a dedicated `CSPS` LocalDB instance (owner OK) |
| Fontsource + Vite | Small font files inlined as `data:` (blocked by CSP); preloading the wrong subset | `assetsInlineLimit` excluding fonts; preload only the latin Archivo file via `?url` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| App-pool cold start + EF model build | First request takes 3–10 s; Lighthouse and API p95 fail at random on staging | ReadyToRun, EF compiled model, keep-warm ping, a warm-up request before measuring | Every idle recycle (~20 min idle) |
| Totals computed per row in list queries | p95 > 300 ms at a few thousand orders; N+1 test fails | Persisted totals on `Order`; indexed sort columns | ~2–5k orders with children |
| `LIKE '%term%'` search on customer/team | Full scans | Acceptable at shop scale. Add prefix search on order number and a normalized phone column | >50k orders (unlikely) |
| Public bundle pulling in admin or form code | Public JS > 150 KB gz | Separate entries, lazy form stack, budgets in CI from Foundation | As soon as the Contact form lands |
| Display-font swap on the hero | CLS > 0.05 | Metric-matched fallback `@font-face`, preload the latin subset, reserve space | Every first visit on slow 4G |
| Per-page-view analytics inserts | Shared SQL contention; DB quota growth | Batching, daily aggregation job, 13-month purge | Viral Facebook post traffic spikes |
| Signed Cloudinary URLs per `srcset` width | Large DTOs; slow list serialization | Sign a few breakpoints only; cache per expiry bucket | Lists of 100 with 5 widths |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Test email sink present in a production build | Full auth bypass (read anyone's 2FA code) | Compile-out, a reflection test on the Release publish, a staging 404 smoke test |
| `AddIdentity` default cookie scheme alongside JWT | 302s to HTML, mixed auth paths, CSRF surface | `AddIdentityCore` + JwtBearer only |
| JWT still valid after deactivation or role change | 15 minutes of unauthorized access (violates USER-05) | Per-request `sid` validation with a short cache |
| 2FA attempts counted per ticket only | Brute force by repeated sign-in | A per-account cross-ticket failure cap leading to lockout |
| Trusting `X-Forwarded-For` without known proxies | Rate-limit bypass; poisoned audit IPs | Configure `ForwardedHeaders` only for verified proxies |
| Deactivated-account banner (C-8) | Account-state enumeration (CWE-204) | Generic error unless the owner overrides it |
| Inquiry uploads accepting PDF/AI (C-12) | Malware delivery to staff; CWE-434 | Images only through Cloudinary re-encode, or quarantine with no inline rendering |
| `EnableSensitiveDataLogging` or body logging in production | Phone numbers, codes and tokens in logs (CWE-532) | Env-guarded config with a test |
| Service worker caching `/api` | Customer data on shared shop PCs | `navigateFallbackDenylist`, no API runtime caching, `no-store` |
| Data Protection keys unencrypted in the DB | Anyone with DB read access can forge reset/invite tokens | Accept and document, restrict DB logins, or add `ProtectKeysWith*` if a certificate becomes available |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Live preview ≠ saved figure | Staff distrust the balance | Golden-vector parity, then display the server value after save |
| 409 conflict wipes the user's modal input | Lost work, double entry | Keep the form values, show the server's current figures, offer "Reload and re-apply" |
| Second child modal 409s because of a stale `rowVersion` | "Couldn't save" right after a successful save | Refresh the order's `rowVersion` from every child response |
| Payment "date in the future" each morning | Staff can't record the opening-hour downpayment | Validate against Manila today |
| 2FA mail in spam | Nobody can work | Authenticated domain, deliverability test, break-glass runbook |
| Auto-dismissing danger toasts | Errors vanish before they're read | Persistent danger toasts that pause on hover/focus |
| "Keep me signed in" checked by default on shared shop PCs | Sessions persist 90 days on shared devices | Owner ruling (C-19). Recommend unchecked |
| iOS zoom on order item inputs | Order entry on a phone is painful | 16px override, approved by the owner |

## "Looks Done But Isn't" Checklist

- [ ] **Order math:** ORD-2026-0148 passes, but check that the **golden vectors** (2.5%/7.5% midpoints, multi-discount, negative balance) pass in **both** xUnit and Vitest.
- [ ] **Concurrency (ORD-08):** header-edit 409 works, but check that **concurrent child edits** 409 and child endpoints require and return the order `rowVersion`.
- [ ] **Order numbers:** unique in the happy path, but check 20 parallel creates, the Manila New Year instant, and seeding from the legacy max per year.
- [ ] **Refresh rotation:** a single-tab test passes, but check two-tab, StrictMode double boot, lost-response replay inside the grace window, and that rotation never extends the absolute expiry.
- [ ] **Cookies:** sign-in works on localhost, but check `Set-Cookie` attributes on **staging HTTPS** (`__Secure-`, path, `SameSite`), and that sign-out actually removes the cookie.
- [ ] **Deactivation:** refresh is blocked, but check that the **current access token** stops working within seconds.
- [ ] **2FA:** 5 wrong attempts invalidate a code, but check the per-account cap across fresh tickets and that the code never appears in logs.
- [ ] **Email:** the sink works in tests, but check `spf=pass dkim=pass` on a real Gmail inbox from staging, and that the sink route 404s on staging.
- [ ] **CSP:** the header is present, but check zero `securitypolicyviolation` events across the whole E2E suite, uploader previews (`blob:`), fonts (no `data:`), and no inline scripts.
- [ ] **Migrations:** apply to an empty DB, but check the idempotent script applied twice, applied over the previous release with data, and at the host's compat level.
- [ ] **Delete order:** the cascade happens in the DB, but check the Cloudinary outbox rows are created in the same transaction and the cleanup job is idempotent.
- [ ] **Modals:** they open and close, but check focus moves in, is trapped, and returns to the trigger (Appendix D doesn't do this).
- [ ] **Image reorder:** drag works on desktop, but check keyboard and touch button alternatives, and that hover actions become visible on focus.
- [ ] **axe zero violations:** in default states, but also with **inactive user rows**, the dimmed cascade tiles, the Espresso theme, and the open modal and lightbox.
- [ ] **Budgets:** measured on the Home page, but check the **Contact** page (form stack) and a cold-started staging run.
- [ ] **Time zone:** tests pass, but check that they also pass with `TZ=UTC` at 23:30Z and with Playwright `timezoneId: 'Asia/Manila'`.
- [ ] **Legacy reconciliation:** shows 100%, but check it compares **legacy source figures**, lists transformed and rejected rows, and shows zero unexplained centavos.
- [ ] **Cutover runbook:** written, but check it has a **point of no return**, timing from the rehearsal, and a pre-issued TLS certificate.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Rounding drift found after go-live | MEDIUM | Fix the client rounding. Run the recompute-vs-stored query on all orders. Server values were authoritative, so data is intact if the server used AwayFromZero. Communicate any stored-total corrections |
| Stale persisted totals from concurrent child edits | MEDIUM | Ship the root-touch fix. Run a one-off recompute job through the domain (audited). Reconcile against payments |
| Duplicate or colliding order numbers | HIGH | Freeze creates, renumber the newer duplicates with an audit trail, notify affected customers, add the unique index and counter seeding |
| Refresh-family mass sign-outs | LOW | Add a grace window and Web Locks. No data impact |
| 2FA mail undeliverable at go-live | HIGH (site effectively down) | Break-glass runbook. Fix DNS (SPF/DKIM). Temporary owner-approved alternate sender. Never disable 2FA silently |
| A migration fails on production | HIGH | Restore the pre-deploy backup (required by §19.2). Fix the script. Re-rehearse on a production-sized copy |
| Test sink shipped to production | HIGH | Remove the build immediately, rotate the JWT/Data Protection keys, revoke all refresh families, audit the logs, notify the owner (breach procedure) |
| Legacy data rejected en masse by invariants | MEDIUM | Back to the mapping step: an owner-approved transform rule per anomaly class, then re-run the idempotent ETL |
| Cutover past the point of no return with blockers | HIGH | Stay on CSPS. Hot-fix forward. Manual re-entry of anything in legacy-only state, per the runbook |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Rounding drift | Foundation → Orders core | Shared golden-vector file passes in xUnit and Vitest |
| 2 Domain decisions (C-1/C-13/OD-4) | Orders core (discuss) | Rulings recorded in CONTEXT.md before the first test; unambiguous DTO names |
| 3 Totals three ways | Orders core | List projection uses stored columns; recompute-vs-stored test |
| 4 Rowversion vs children | Orders core | Two-context child-edit concurrency test → 409 |
| 5 Order numbering | Orders core; Legacy data import | Parallel-create test; New Year test; legacy-max seeding test |
| 6 Time zone | Foundation | Fake-clock tests at Manila boundaries; `TZ=UTC` CI run; `/health` zone check |
| 7 Engine/compat drift | Foundation | Spike record of `@@VERSION`/compat; CI applies the script at the host compat level |
| 8 Migrations & warnings | Foundation (ongoing) | `.editorconfig` for generated code; double-apply idempotent script test |
| 9 Refresh races | Identity & authentication | Concurrent refresh, multi-tab and replay tests |
| 10 Cookie/scheme wiring | Identity & authentication | `Set-Cookie` attribute test; 401 (not 302) test; role-claim matrix |
| 11 2FA brute force / enumeration / DoS | Identity & authentication | Cross-ticket cap test; timing-parity test; per-IP-before-account test |
| 12 Email deliverability | Foundation spike → Identity & authentication → Production cutover | `spf/dkim/dmarc=pass` evidence from staging and production |
| 13 Verbatim spec code vs gates | Foundation | Lint/type clean; DOM snapshot equals verbatim; focus-trap tests |
| 14 CSP reality | Foundation; Hardening | Zero CSP violation events in E2E; Report-Only period on staging |
| 15 PWA caching | Hardening | Navigating to `/api/...` with the SW active returns API output; no `/api` in SW caches |
| 16 Shared hosting | Foundation; Hardening | Hosting spike record; deploy with AppOffline cleanup; 404 ProblemDetails through IIS |
| 17 Client IP / rate limits | Foundation; Identity & authentication | Spoofed-XFF test; staging topology record |
| 18 Legacy restore & quality | Legacy discovery & mapping | `CSPS_Legacy_Restore` only; anomaly counts and owner-approved rules |
| 19 Reconciliation & ETL idempotency | Legacy data import | Source-vs-target report, zero unexplained; re-run produces no duplicates |
| 20 Cutover | Production cutover | Timed rehearsal; point of no return in the runbook; certificate pre-issued |
| 21 Test infra on the shared machine | Foundation; Identity & authentication | `BetsLLC_*` guard test; Release reflection test for the sink; preflight wired into scripts |
| 22 Budgets & toolchain | Foundation; Public site & content management | Bundle and CSS budgets in CI; Contact page under 150 KB; TS 6 tooling pinned |
| 23 A11y in the design | Foundation → Order images → Hardening | axe on dimmed/inactive states; manual 1.4.11 check; keyboard reorder test |
| 24 Process | Roadmap creation; Foundation | Foundation split into 1a/1b/1c; owner-decision calendar; inquiry scope ruling |

## Sources

- **Local measurements (HIGH):** `CSPS-UI-SPEC.md` Appendices A–D extracted to the session scratchpad. gzip -9 sizes, `round2` vs exact half-up comparison over ₱1–₱200,000 and centavo totals, WCAG contrast computed from Appendix A tokens, grep of Appendix D for `dangerouslySetInnerHTML`, `style={{}}`, drag handlers, `createObjectURL`, and the Modal/Tabs behavior. `sqllocaldb versions` → SQL Server 2025 (17.0.4025.3). `docker version` → linux/amd64 engine 29.8.1.
- [EF Core 10 breaking changes: JSON type at compat level 170](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/breaking-changes) (MEDIUM)
- [EF Core 9 breaking changes: PendingModelChangesWarning](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-9.0/breaking-changes); [Fixing PendingModelChangesWarning](https://milanjovanovic.tech/blog/ef-core-pending-model-changes-error) (MEDIUM)
- [efcore #12911](https://github.com/dotnet/efcore/issues/12911), [efcore #29530](https://github.com/dotnet/efcore/issues/29530): idempotent script compile errors (MEDIUM)
- [CA1861 rule docs](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca1861) (MEDIUM)
- [Respawn README](https://github.com/jbogard/Respawn): options; sequences not documented (MEDIUM)
- [MDN Set-Cookie: `__Host-` requirements](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie) (MEDIUM, cross-checked across MDN locales)
- [Google email sender guidelines](https://support.google.com/mail/answer/81126) (MEDIUM)
- [Persist Data Protection keys on IIS](https://aspnix.com/posts/persist-data-protection-keys-for-aspnet-core-on-iis); [Configure ASP.NET Core Data Protection](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview) (MEDIUM)
- [React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1); [React Compiler + Vite 8 / plugin-react v6](https://recca0120.github.io/en/2026/04/14/react-compiler-vite-v6/) (MEDIUM)
- [TypeScript 7 migration readiness / typescript-eslint blocker](https://ecorpit.com/typescript-7-migration-readiness-eslint-astro-blockers-2026/); [TS 7 RC (Visual Studio Magazine)](https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx) (LOW–MEDIUM; verify at Foundation)
- [Vite CSP nonce discussion](https://github.com/vitejs/vite/issues/11862); [React CSP and inline styles (historical)](https://github.com/facebook/react/issues/5878) (MEDIUM; the CSSOM claim needs a Playwright test)
- [vite-plugin-pwa navigateFallbackDenylist](https://github.com/antfu/vite-plugin-pwa/issues/218) (MEDIUM)
- [SQL Server Express LocalDB docs](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb) (HIGH, consistent with the local measurement)
- [Top budget ASP.NET hosts (SmarterASP.NET .NET 10 / SQL 2025 claim)](https://affmaven.com/asp-net-hosting-providers/); [whtop SmarterASP.NET plan data](https://www.whtop.com/plans/smarterasp.net/78446) (LOW; verify in the control panel)
- [Testcontainers / mssql-tools18 path change](https://learn.microsoft.com/en-us/answers/questions/1853144/error-failed-to-initialize-container-mcr-microsoft) (MEDIUM)

---
*Pitfalls research for: CSPS (staff order management + public site, .NET 10 / React 19, SmarterASP.NET shared IIS, legacy SQL Server migration)*
*Researched: 2026-10-06*
