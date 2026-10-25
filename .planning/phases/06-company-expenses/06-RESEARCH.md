# Phase 6: Company Expenses - Research

*Created: 2026-10-25T03:05:00-05:00 · Updated: 2026-10-25T03:05:00-05:00*

**Researched:** 2026-10-25
**Domain:** First business aggregate slice: EF Core 10 code-first aggregate with rowversion, soft delete, filtered list with period total, Manila-month KPIs, Manager-editable lookup table, audit events, React list/modal pages
**Confidence:** HIGH (almost every recommendation reuses a pattern already shipped in Phases 1 to 5, read in this session)

## Summary

Phase 6 needs **no new package**. Every building block already exists in the repo: `Result<T>` to ProblemDetails, one handler per use case with FluentValidation inside the handler, the `RecordStampInterceptor` that stamps SEC-08 attribution, `IUnitOfWork.InTransactionAsync` plus `ConflictRetry`, `EditErrors.Stale` (the 409 text), `IAuditTrail.Record`, `IBusinessCalendar`/`BusinessClock` for Manila days and months, the escaped-LIKE search in `UserDirectory`, the authorization matrix, `ConcurrentRequests.SendTogetherAsync`, the OpenAPI snapshot to generated-types chain, and on the web the list toolkit (`createListParams`, `FilterBar`, `ResponsiveTable`, `Pagination`), `ConfirmDialog`, `ConflictBanner`, `RecordMeta`/`ActorName`, `KpiCard`, `MoneyInput`, `DateInput`, `RadioGroup`.

The new things this phase introduces, and therefore where the risk sits: (1) the **first SQL `rowversion` aggregate edited from a form** (users use a GUID `EditVersion`; `SiteSettings` has a rowversion but no edit endpoint yet), (2) the **first EF global query filter** (soft delete), (3) the **first `HasData` lookup table that tests also write to** (Respawn will wipe it), (4) the **first query-count guard and timing test** (no counting interceptor exists yet), and (5) **audit entries that carry values** (amounts, dates, category, payer), which the viewer's "never show a stored value" rule (05 D-40) does not cover today.

**Primary recommendation:** Build the expense as a Domain aggregate `CompanyExpense : IAttributedRecord` with `byte[] RowVersion`, `DateOnly ExpenseDate`, `decimal(18,2) Amount`, required `PaidByUserId`, and soft-delete columns behind a named EF global query filter; categories as a second small aggregate `ExpenseCategory` (Guid key, `HasData` seed, `NormalizedName` unique index, stored tone). Ship it as thin vertical slices (staff lookup and Add first, because Paid by is required), prove the 409, query-count and p95 guards with tests, and resolve the audit-detail format before the first audited write.

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

#### Deleting an expense (OD-5, owner 2026-10-25)
- **D-01:** Delete is a **soft delete**. The expense is hidden from every list, total, KPI and balance, but the row stays and the audit log records the delete. — **Reversibility:** one-way. It needs a migration for the deleted marker (UTC timestamp and who deleted it), and every query has to filter on it.
- **D-02:** **Only Managers delete.** Admins can't delete their own expenses either. The delete action isn't shown to Admins, and the API refuses it (403) under a Manager policy. The authorization-matrix test covers it.
- **D-03:** Managers can **restore** a soft-deleted expense from a Manager-only **Deleted** view. A restored expense counts again in lists, totals and its payer's balance, and the restore is audited.
- **D-04:** Managers can also **delete permanently**, from **either** the main list or the Deleted view. A permanent delete removes the row.
- **D-05:** **Both** deletes use the plain ConfirmDialog (Yes/Cancel). There is no type-to-confirm. The two dialogs have different wording, and the permanent one says it can't be undone. Final copy is set in `/gsd-ui-phase 6`.
- **D-06:** After a permanent delete, the audit entry keeps the **date, category, amount and payer** (the payer as a user id reference, shown by name). It doesn't keep the description or notes, which could hold personal details (same idea as 05 D-40).
- **D-07:** The Deleted view and its actions are **Manager-only**. Admins can't see it.

#### Expense categories (OD-8 for company expenses, and C-43; owner 2026-10-25)
- **D-08:** Categories are a **Manager-editable list**, stored as a table that expenses reference by foreign key, not as a fixed enum. Managers can add, rename and retire categories. — **Reversibility:** one-way. It needs a table, a foreign key and a migration, and it replaces the typed `ExpenseCategory` union and `EXPENSE_TONE` map in the web code.
- **D-09:** The starting list has 10 categories: Rent, Utilities, Salaries, Supplies, Equipment, Maintenance, **Government contributions** (one category for SSS, PhilHealth and Pag-IBIG), **Taxes and permits** (BIR, mayor's permit, other fees), **Transport and fuel**, and Others. It ships as migration seed data (`HasData`), so an empty production database gets it too. It isn't left to the dev seed.
- **D-10:** A category that has **ever** been used, including by a soft-deleted expense, can only be **retired**, never deleted. A category that was **never used** can be deleted permanently.
- **D-11:** A retired category is **hidden from the Add form's picker** but **stays in the list filter**, marked "retired". An existing expense keeps its retired category when edited.
- **D-12:** A **rename** shows the new name everywhere, past expenses included, because expenses reference the category. The audit log keeps the old and new names.
- **D-13:** Each category has a **badge color** that the Manager picks from a fixed set of design tones already checked for contrast. There is no free color picker. The starting categories keep their current UI-spec tones (§6.2).
- **D-14:** Categories are edited on a new **Manager-only Settings page in the sidebar**. Admins are redirected, as on `/admin/users`. Phase 11 may add more settings to the page later.
- **D-15:** The picker and filter list categories **A to Z, with Others always last**.
- **D-16:** The **order expense** categories (Fabric, Ink & paper, and so on) are **not decided here**. Phase 7 rules whether they work the same way, so OD-8 stays open for order expenses.

#### Who paid, fields and limits (OD-21, owner 2026-10-25)
- **D-17:** **Paid by is always a staff member** (an active Admin or Manager), never "the company". OD-21 is closed as "no" for company expenses, and Phase 7 applies the same ruling to order expenses.
- **D-18:** In the Add form, **Paid by starts as the signed-in user**, who can change it to any active coworker.
- **D-19:** An expense gets one more field: an **optional Notes** box of up to **1,000 characters**. Notes show **only in the form**, not as a list column, and **search doesn't look in them**. There is **no Vendor** field. — **Reversibility:** costly. It's a new column and migration, and it touches the DTOs, validators and zod schemas.
- **D-20:** The **date may be up to 30 days ahead** of today in Asia/Manila. Any past date is allowed, for old and migrated expenses. The client (zod) and the server both enforce the limit.
- **D-21:** The **amount must be more than ₱0.00 and at most ₱1,000,000.00**, with a plain-English field error, checked on both client and server.
- **D-22:** A future-dated expense comes off the payer's money on hand **as soon as it's saved**, not on its date. This is recorded for MONEY-01 in Phase 10.
- **D-23:** The list's default range runs from **30 days before to 30 days after today** in Asia/Manila, so expenses recorded early still show. Future-dated rows get an **"Upcoming"** badge. This replaces CEXP-01's plain "last 30 days" default.
- **D-24:** KPIs count expenses by their **date**. An upcoming expense dated later this month counts in "This month", and one dated next month doesn't.

#### Who can edit what (owner 2026-10-25)
- **D-25:** **Admins see every expense**: the full list, the totals and the KPIs.
- **D-26:** **An Admin can edit only their own expenses**: ones they **recorded** (SEC-08 `CreatedBy`) **or that name them as Paid by**. The server enforces this, and the Edit action is shown only on rows the user may edit. **Managers can edit any expense.** If an Admin changes the payer away from themselves on an expense someone else recorded, they lose edit access to it afterwards. This is expected.

#### Audit (owner 2026-10-25)
- **D-27:** The audit log records **every** expense change: add, edit, soft delete, restore, permanent delete and payer change, plus category add, rename, recolor, retire and delete. An edit lists the changed fields, with **old and new values for amount, date, category and payer**. Description and notes appear only as "changed", with no text (05 D-40). These events join the AUDIT-01 catalog in `docs/operations/audit-log.md`.

#### Speed check and build order (owner 2026-10-25)
- **D-28:** **No staging site, so the p95 < 300 ms check runs locally and in CI** with a timing test on a large fake data set (about 5 years of expenses). After release, the **live site's request logs** confirm real load times. No fake data is ever written to the live database. This replaces "on staging" in success criterion 5.
- **D-29:** **Expenses go before Orders**, as research recommends. This phase sets the slice pattern (filters, totals, 409 handling, query-count guards, ConfirmDialog) for Phase 7.

#### Carried forward from earlier phases
- Soft-deleted users keep their name, and actors show as "{name} (former staff)" (05 D-07, D-08, D-11). "Recorded by", "Last changed by" and "Paid by" are foreign keys to the user row, with no name snapshot.
- A form save that gets 409 keeps the typed values and shows the banner with **Load latest** (05 D-20). Only form saves carry the row version, and single-click actions act on the latest state (05 D-21).
- Design-vs-WCAG clashes (OD-14) are ruled item by item in `/gsd-ui-phase 6`.
- New or amended copy is built as specified, but the owner reviews it before release (05 D-48).
- No new database triggers (05 D-06, OR-7). Guards live in code or constraints.
- No new UI package, and motion is Tailwind first (05 D-37, D-38).

### Claude's Discretion
- Page size and page-size options, URL parameter names (WEB-10), and the exact index set, as long as every filter and sort column is covered.
- Whether delete, restore and permanent delete send a row version. The default follows 05 D-21 and D-41: single-click actions don't, and the edit form does.
- The size and shape of the fake performance data set, and where the timing test lives.
- The staff lookup endpoint's shape (id and display name of active Admins and Managers, open to both roles), built so ORD-22 and ORD-23 can reuse it.
- How the money-on-hand ledger reads expenses later (Phase 10), as long as soft-deleted expenses never count and restored ones do.
- The dev seed contents for expenses and categories.

### Deferred Ideas (OUT OF SCOPE)
- Whether order expense categories are Manager-editable too: decide in Phase 7 (OD-8, order part).
- OD-16, whether paying an expense may take the payer's balance below zero: still Phase 10. The default is to allow it.

</user_constraints>

**UI contract:** `06-UI-SPEC.md` is approved (2026-10-25) and binding for screens E1 to E4, S1, S2 and the A1 audit additions. OQ-1 to OQ-15 there still need owner rulings; until then the executor builds the **contract default** listed in that file. Research below assumes those defaults (third `eraser` icon, `/admin/expenses/deleted` page, Settings nav item, "Use again" for retired categories, no confirm for restore/retire, protected Others, keeping an inactive saved payer is allowed, View action for Admins, no preselected category, Description 200 and category Name 40 characters).

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CEXP-01 | List with paging, date range (default now -30..+30 days per D-23), category filter, search by description or staff name, newest first, period total; state in the URL; default counted from the business today | Pattern 3 (list reader: one aggregate query plus one page query), Pattern 7 (server resolves the default window from `BusinessClock.Today`), `createListParams` hook pattern, escaped LIKE reused from `UserDirectory` |
| CEXP-02 | Create, update, delete with confirmation; date, category, description, amount > 0; stale update 409; OD-5/OD-8/C-43 rulings | Pattern 1 (aggregate), Pattern 2 (rowversion compare-then-save to `EditErrors.Stale`), Pattern 5 (soft delete via named query filter, restore, permanent delete), Pattern 6 (categories), `ConcurrentRequests` two-writer test |
| CEXP-03 | KPIs: this month, last full month, top category with share; Manila month boundaries | Pattern 7 (`BusinessClock.Today` and `MonthOf`), FakeTimeProvider test at 2026-10-31T23:00:00Z (= 07:00 Manila Nov 1) |
| CEXP-04 | Read-only Recorded by (creator, also in Edit) and Last changed by; survive user deletion | `RecordStampInterceptor` stamps `IAttributedRecord`; actor names read from user rows with `FormerStaff` (the `UserDirectory.GetUserAsync` actor pattern); `RecordMeta`/`ActorName` on the web |
| CEXP-05 | Required Paid by (active Admin or Manager), field error otherwise, staff lookup for both roles, list column, search match, payer change audited | Pattern 4 (staff lookup reusing the D-18 active rule from `UserAccounts.CountActiveManagersAsync`), separate `payer-changed` audit entry (05 "never merged" precedent) |
| PERF-04 | List p95 < 300 ms, `AsNoTracking` projections, indexes on every filter/sort column, compiled queries on hot paths, query-count tests against N+1 | Pattern 8 (indexes), Pattern 9 (counting `DbCommandInterceptor`, Wave 0), Pattern 10 (timing test on ~5 years of fake data, D-28) |

Cross-cutting requirements this phase must also satisfy for the new aggregate (they say "every aggregate"): SEC-06 (idempotent POSTs), SEC-07 (rowversion and two-writer test), SEC-08 (forged attribution ignored on create and update), AUDIT-01 (catalog), WEB-09, WEB-10, OR-3 (zod mirrors validators), OR-4, OR-5, OR-7.

</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives from `./CLAUDE.md`, `./.claude/CLAUDE.md` and the owner's global rules passed in the research prompt. The planner must verify each plan against them.

- **Stack:** .NET 10 / C# 14 controllers (`[ApiController]`, attribute routes under `/api/v1`), EF Core 10 code-first with Fluent config only, SQL Server, Identity `IdentityUser<Guid>`, FluentValidation in handlers. React 19 + TS strict + Vite, Tailwind v4, React Router (import from `react-router`), TanStack Query, RHF + zod.
- **Forbidden packages:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **New packages:** prefer none. Any package needs purpose, license (MIT/Apache-2.0/BSD/ISC only), maintenance, legitimacy and a 14-day cool-down recorded, plus the owner's yes. Never installed silently.
- **Architecture:** Onion (Domain ← Application ← Infrastructure ← Server) enforced by ArchUnitNET. No mediator; one handler per use case; manual mapping. One `[ApiController]` per resource; thin actions call one handler. Default-deny: every action declares `[Authorize(Policy = ...)]` or `[AllowAnonymous]`; the authorization-matrix test must list every endpoint. `SuppressModelStateInvalidFilter` is on, so validation is FluentValidation in handlers to `Result<T>` to ProblemDetails.
- **Concurrency/time/money:** `rowversion` per aggregate (409 on conflict). UTC storage plus `TimeProvider`/`IBusinessCalendar`; never `DateTime.Now` (BannedSymbols). Money `decimal(18,2)`, computed server-side only.
- **Schema:** every table and column from EF migrations; the app works on an empty DB. No JSON columns. Drops, renames and lossy changes need the owner first. Production gets reviewed idempotent scripts; never `Database.Migrate()` at startup.
- **No SQL triggers (OR-7):** only `TR_AuditLog_AppendOnly`; `TriggerInventoryTests` fails on any other. Guards go in code or constraints.
- **No inline SQL (owner global rule):** no `FromSql`, `SqlQuery`, `ExecuteSql*`, or ADO SQL strings in application code. Use LINQ, `ExecuteUpdate`/`ExecuteDelete`, rowversion concurrency. Migrations are the only exception. (Three pre-rule call sites exist: `IdempotencyGate.cs:219`, `AccountTokenStore.cs:33`, `ManagerRosterLock.cs:19`; Phase 6 adds none.)
- **Quality:** TDD (failing test first). Zero warnings in build, analyzers, lint, types, tests and the browser console. Coverage: Domain 100% line and branch, Application ≥ 95% line, `core/api` 100%, web ≥ 90%.
- **Security:** CWE Top 25 review, strict CSP (no `unsafe-inline`/`unsafe-eval`; zod runs `z.config({ jitless: true })`), append-only audit, no secrets or real data in git.
- **A11y/perf/responsive:** WCAG 2.2 AA, zero axe violations; admin initial JS ≤ 250 KB gz (new pages are lazy chunks); 320 to 1920 px with no sideways scroll; 44 px targets.
- **Web conventions:** OR-3 zod mirrors every server rule; OR-4 no em/en dash in `web/src` and `EmptyValue` for empty values; OR-5 calls in `modules/admin/services/`, only `core/api/http` touches `fetch`; OR-6 owner tree layout (enforced by `source-layout.node.test.ts`).
- **Shared machine:** ports 5180/5115/7028/5199 only; never 5173/5023/5099; LocalDB `(localdb)\MSSQLLocalDB` with `CSPS_*` databases only; never touch `BetsLLC_*`; run `C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before dev servers, Playwright or full test runs; env vars only per process; never a command that reads stdin; leave no background shell.
- **Git:** stage by path, never `git add -A`; gitleaks plus a manual scan for names, paths and ids before each commit; merges only via `tools/scripts/Merge-PullRequest.ps1` on the owner's word.
- **Writing:** plain English, short sentences; minimal comments; every markdown file has created/updated timestamps.
- **Workflow:** `/gsd-plan-phase 6 --tdd`; `/gsd-secure-phase 6` and `/gsd-ui-review 6` before `/gsd-ship 6`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Expense invariants (amount range, text lengths, soft-delete state, restore) | Domain (`CompanyExpense`) | — | PRD §3.3 rich aggregates; Domain 100% coverage gate |
| Date-ahead limit (today + 30 in Manila) | Application validator (today via `ValidationContext.RootContextData`) | Browser zod (mirror, OR-3) | Needs the business clock; the browser copy is a convenience, the server decides |
| Payer active check, category active check, D-26 "own expense" rule | Application handler | Database FK (existence backstop) | Needs reads and the caller's role; must be one rule for list `canEdit` and for save |
| Attribution stamping (Created/Updated By/At) | Infrastructure (`RecordStampInterceptor`) | — | SEC-08: one place, from the token and the clock, never the request |
| Soft-delete exclusion | Infrastructure (named EF global query filter) | Application (deleted view uses the explicit bypass) | D-01 "every query has to filter on it": a default filter removes the chance of forgetting |
| Period total, KPI sums, top category, share percent | Database via LINQ aggregates (Infrastructure reader) | Application (rounding, labels) | Core Value: server-computed totals; never summed in the browser |
| Default date window, month boundaries, "Upcoming" | Application/Infrastructure using `BusinessClock` | Browser displays the server's `from`/`to`/`today` | Business today must not depend on the device clock |
| Optimistic concurrency | Database `rowversion` + EF concurrency token | Application maps to `EditErrors.Stale` | SEC-07 |
| Category uniqueness ignoring case | Database unique index on `NormalizedName` | Application pre-check for the field error | Race-safe without locks or triggers |
| Audit events | Application (`IAuditTrail.Record` in the same transaction) | Infrastructure reader resolves ids to names for the viewer | AUDIT-01, D-27; append-only table |
| URL list state, filters UI, modals, dialogs | Browser (React, nuqs, TanStack Query) | — | WEB-10, UI-SPEC |
| Role gating of routes and actions | API (policies + handler) | Browser hides actions, route loaders redirect | Default-deny on the server; UI only hides |

## Standard Stack

### Core (all already installed and pinned; versions read this session)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.13 | Tables, migrations, rowversion, filtered/descending/include indexes, named query filters | Already the project ORM [VERIFIED: Directory.Packages.props:12 `Version="10.0.13"`] |
| FluentValidation | 12.1.1 | Request validators; `PrecisionScale(precision, scale, ignoreTrailingZeros)` for 2-decimal amounts | Already used in every handler [VERIFIED: Directory.Packages.props:22; PrecisionScale present in local package XML docs `FluentValidation/12.1.1/lib/net8.0/FluentValidation.xml:1036`] |
| xunit.v3 | 4.0.1 | .NET tests on MTP | [VERIFIED: Directory.Packages.props:32] |
| Respawn | 7.0.0 | DB reset between tests | [VERIFIED: Directory.Packages.props:39] |
| Microsoft.Extensions.TimeProvider.Testing | 10.10.0 | `FakeTimeProvider` for the Manila month-boundary tests | [VERIFIED: Directory.Packages.props:44] |
| nuqs | 2.10.1 | URL list state via `createListParams` | Owner-approved WEB-10 [CITED: REQUIREMENTS.md WEB-10] |
| lucide-react | 1.53.0 | The five new icon names (`settings`, `rotate-ccw`, `archive`, `archive-restore`, `eraser`) as named imports | Already approved and installed [CITED: 06-UI-SPEC.md Design System] |
| zod / react-hook-form / @hookform/resolvers / @tanstack/react-query | as pinned in `web/package.json` | Forms, OR-3 mirrors, queries | Existing stack |

### Supporting (built in, no package)

| Feature | Where | When to Use |
|---------|-------|-------------|
| `DbCommandInterceptor` (EF Core) | `Csps.Testing` | Count SQL commands for the PERF-04 query-count guard |
| `ConfigureDbContext<TContext>` (EF Core) | Server integration tests | Add the counting interceptor to the app's `AddDbContextFactory` registration; EF docs say it takes effect with `AddDbContextFactory` [VERIFIED: microsoft.entityframeworkcore/10.0.13 XML docs, member `EntityFrameworkServiceCollectionExtensions.ConfigureDbContext``1`, remarks list `AddDbContextFactory`] |
| Named query filters `HasQueryFilter(string, expr)` and `IgnoreQueryFilters(names)` | EF Core 10 | Soft delete [VERIFIED: same XML docs, `EntityTypeBuilder`1.HasQueryFilter(System.String,...)` and `IgnoreQueryFilters``1(IQueryable, IReadOnlyCollection<string>)`] |
| `IncludeProperties`, `IsDescending`, `HasFilter` | EF Core SqlServer | Covering filtered index for the list [VERIFIED: microsoft.entityframeworkcore.sqlserver/10.0.13 XML docs `SqlServerIndexBuilderExtensions.IncludeProperties`] |
| `Guid.CreateVersion7(now)` | .NET 10 BCL | Domain-set keys, as `UserSession`, `AccountToken` do [VERIFIED: src/Csps.Domain/Identity/UserSession.cs:90] |
| Serilog request logging | already wired (`Program.cs:117 app.UseSerilogRequestLogging`) | Post-release p95 from live logs (D-28) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL `rowversion` (`byte[]`) | GUID `EditVersion` like `ApplicationUser` | GUID was needed only because Identity's `UserStore.Update` marks every column modified. A plain aggregate gets a real `rowversion` for free; PRD §3.3 and SEC-07 name rowversion. Use rowversion. |
| Named global query filter | Hand-written `Where(e => e.DeletedAtUtc == null)` in every query | One forgotten `Where` silently counts deleted money (Core Value). The filter is the default; the Deleted view opts out by name. |
| Category name snapshot on each expense | FK to `ExpenseCategories` | D-08/D-12 lock the FK. |
| Full-text index for description search | `LIKE '%q%'` with escaping | LocalDB has no Full-Text Search, and CI/production parity would break. At the expected volume LIKE meets p95 (proved by the timing test). |
| Compiled query for the list | Plain LINQ | The list has optional filters, so a compiled query would need one per filter combination. EF already caches the translated plan per shape. Use `EF.CompileAsyncQuery` only on fixed-shape hot paths (detail by id). |

**Installation:** none. No `npm install`, no `dotnet add package`.

**Version verification:** not applicable (no new or bumped package). The pins above were read from `Directory.Packages.props` this session.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | No package is added or bumped in Phase 6 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

The five icons are named imports from the already-installed `lucide-react` 1.53.0; no owner approval item arises. If a plan ever proposes a package, it must stop for the owner (global rule) with the 14-day cool-down, advisory, license and deprecation check recorded here.

## Architecture Patterns

### System Architecture Diagram

```
Browser (/admin/expenses, /admin/expenses/deleted, /admin/settings)
  │  nuqs URL state (q, category, from, to, page, size)
  │  TanStack Query keys ['company-expenses','list',params], [...,'kpis'], ['expense-categories'], ['staff']
  ▼
modules/admin/services/*Service.ts ──► core/api apiClient (Idempotency-Key on POST, bearer token)
  ▼
ASP.NET Core pipeline: JWT bearer → OnTokenValidated (session active?) → Idempotency gate (POST only, opens txn)
  → authorization policy (Staff | Manager) → Controller action (thin)
  ▼
Application handler
  ├─ validate request (FluentValidation; business today in RootContextData)
  ├─ DB checks: payer active? category active? caller may edit? (D-26)
  ├─ load aggregate (tracked) ── compare client version vs stored RowVersion ──► 409 edit.stale
  ├─ domain method (Create / Update / SoftDelete / Restore) returns changes
  ├─ IAuditTrail.Record(...) one or two entries (changed, payer-changed)
  └─ IUnitOfWork.InTransactionAsync → SaveChanges
        └─ RecordStampInterceptor sets Created*/Updated* from ICurrentActor + TimeProvider
        └─ EF UPDATE ... WHERE Id=@id AND RowVersion=@loaded → 0 rows → ConcurrencyConflictException → 409
  ▼
SQL Server: CompanyExpenses (filtered covering index on non-deleted rows), ExpenseCategories, AspNetUsers, AuditLog

Read path (list/KPI): handler → reader port (AsNoTracking LINQ)
  ├─ query 1: COUNT + SUM over the filtered set (period total, all pages)
  └─ query 2: page rows with category name/tone and payer/recorder names via correlated subqueries
```

### Recommended Project Structure

```
src/Csps.Domain/Expenses/
  CompanyExpense.cs            aggregate: Create, Update (returns ExpenseChanges), SoftDelete, Restore
  ExpenseCategory.cs           aggregate: Create, Rename, Recolor, Retire, Reactivate; OthersId constant
  ExpenseRules.cs              limits: DescriptionMax 200, NotesMax 1000, AmountMax 1_000_000.00m, DaysAhead 30, NameMax 40
  CategoryTones.cs             the six tone strings
  ExpenseCategorySeed.cs       the ten seed rows (ids, names, tones) shared by HasData and the test reseed
src/Csps.Application/Expenses/       one handler per use case + request/response records + validators
src/Csps.Application/ExpenseCategories/
src/Csps.Application/Staff/ListStaffHandler.cs
src/Csps.Application/Ports/ICompanyExpenses.cs, ICompanyExpenseReader.cs, IExpenseCategories.cs (+ staff methods)
src/Csps.Infrastructure/Expenses/CompanyExpenseStore.cs, CompanyExpenseReader.cs, ExpenseCategoryStore.cs
src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs, ExpenseCategoryConfiguration.cs
src/Csps.Infrastructure/Persistence/Migrations/<ts>_AddCompanyExpenses.cs
src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs   (dev seed, Order 300)
src/Csps.Server/Controllers/CompanyExpensesController.cs, ExpenseCategoriesController.cs, StaffController.cs
tests/Csps.Testing/CommandCounter.cs                          (Wave 0)
web/src/modules/admin/{pages,components,hooks,services}/...   per 06-UI-SPEC Component Inventory
```

### Pattern 1: The aggregate (Domain, rowversion, attribution)

**What:** A sealed class with private setters, a private constructor for EF, static `Create` returning `Result<CompanyExpense>`, mutators returning `Result`/change records. Domain-set key with `Guid.CreateVersion7(now)` and `ValueGeneratedNever()` in config, exactly like `UserSession`.
**When:** Every write.

```csharp
// Source: pattern of src/Csps.Domain/Identity/UserSession.cs:90 and UserSessionConfiguration (read this session)
public sealed class CompanyExpense : IAttributedRecord
{
    public Guid Id { get; private set; }
    public DateOnly ExpenseDate { get; private set; }
    public Guid CategoryId { get; private set; }
    public string Description { get; private set; }
    public decimal Amount { get; private set; }
    public Guid PaidByUserId { get; private set; }
    public string? Notes { get; private set; }
    public Guid? CreatedById { get; private set; }          // set only by RecordStampInterceptor
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public Guid? UpdatedById { get; private set; }
    public DateTimeOffset? UpdatedAtUtc { get; private set; }
    public DateTimeOffset? DeletedAtUtc { get; private set; }
    public Guid? DeletedById { get; private set; }
    public byte[] RowVersion { get; private set; }
    // Create(date, categoryId, description, amount, paidBy, notes, today, now) -> Result<CompanyExpense>
    // Update(...) -> Result<ExpenseChanges>   (ExpenseChanges lists changed fields with old/new values)
    // SoftDelete(by, now) / Restore()
}
```

EF config essentials: `ToTable("CompanyExpenses")`; `Amount` `.HasPrecision(18, 2)`; `Description` `.IsRequired().HasMaxLength(200)`; `Notes` `.HasMaxLength(1000)`; `RowVersion` `.IsRowVersion()`; FKs to `ExpenseCategory` and `ApplicationUser` (`PaidByUserId`, `CreatedById`, `UpdatedById`, `DeletedById`) all `OnDelete(DeleteBehavior.NoAction)` like `ApplicationUserConfiguration` does for attribution ("NO ACTION so removing a user never rewrites history"); a check constraint `[Amount] > 0` (a guard in constraints, allowed by OR-7; keep the ₱1,000,000.00 cap in validators only, see Open Question 6). `DateOnly` maps to SQL `date` natively in EF Core 10 [ASSUMED: EF Core 8+ behavior, not re-checked this session].

### Pattern 2: Edit with rowversion (SEC-07)

**What:** The PUT body carries `version` (base64 of the 8-byte rowversion, as the detail GET returned it). The handler loads the tracked row, compares the stored `RowVersion` with the client's bytes, and returns `EditErrors.Stale` at once on a mismatch (same order as 05-09: "stored EditVersion is compared before the same-names shortcut"). On a match it applies the change and saves; EF's `WHERE RowVersion = @loaded` then guards the window between load and save, and `CspsUnitOfWork` turns `DbUpdateConcurrencyException` into `ConcurrencyConflictException`, which the handler maps to `EditErrors.Stale`. **No retry for form edits** (the client must Load Latest); `ConflictRetry` is only for single-click actions that act on the latest state (delete, restore, retire).

Values: `public const string StaleCode = "edit.stale";` and `public const string StaleMessage = "This was changed by someone else. Reload and try again.";` [VERIFIED: src/Csps.Application/Common/EditErrors.cs:9-15].

Use the field name `version` (as `UpdateUserRequest.Version`) so the web keeps one convention; the value is an opaque base64 string. Validate it as base64 decoding to exactly 8 bytes, else a 400 field error on `version`.

### Pattern 3: List reader with a fixed query count (CEXP-01, PERF-04)

**What:** Two SQL commands per list request, whatever the page size:
1. `filtered.GroupBy(_ => 1).Select(g => new { Count = g.Count(), Total = g.Sum(e => e.Amount) })` (or `CountAsync` + `SumAsync` combined into one projection) for the result-bar count and the period total over every page.
2. The page: `filtered.OrderByDescending(e => e.ExpenseDate).ThenByDescending(e => e.CreatedAtUtc).ThenByDescending(e => e.Id).Skip().Take().Select(...)` with category name/tone and the payer's and recorder's names as correlated subqueries in the projection (`context.Users.Where(u => u.Id == e.PaidByUserId).Select(u => new { ... }).First()`), the same technique `UserDirectory.ListUsersAsync` uses for the role name (`UserDirectory.cs:62-66`). EF emits one statement with OUTER APPLY or LEFT JOIN, so there is no N+1.

`AsNoTracking()` on every read (as `UserDirectory`). Reuse `ListQueryLimits` (`MaxPageSize = 100`, `MaxSearchLength = 100`) [VERIFIED: src/Csps.Application/Common/ListQueryRules.cs:10,13] and the page cap `MaxPage = 100_000` precedent [VERIFIED: src/Csps.Application/Users/ListUsersRequestValidator.cs:16]. Default page size 20 like `ListUsersRequest.DefaultPageSize` [VERIFIED: src/Csps.Application/Users/ListUsersRequest.cs:12].

**Search** (description, payer name, recorder name; never notes, D-19): move `UserDirectory`'s private `EscapeLike` and `LikeEscape = "\\"` into one shared Infrastructure helper and reuse it, then
`EF.Functions.Like(e.Description, p, esc) || context.Users.Any(u => (u.Id == e.PaidByUserId || u.Id == e.CreatedById) && (EF.Functions.Like(u.FirstName, p, esc) || EF.Functions.Like(u.LastName, p, esc) || EF.Functions.Like(u.FirstName + " " + u.LastName, p, esc)))`.

**Response shape (recommended):** `{ items, total, page, pageSize, periodTotal, from, to, today }`. `from`/`to` are the resolved window (the server applies the D-23 default when the query has neither), `today` is the business date, so the browser never computes the window or "Upcoming" from the device clock. Each item: `id, date, category {id, name, tone}, description, amount, paidBy {id, name, formerStaff}, recordedBy {id, name, formerStaff} | null, canEdit`. `canEdit` is computed by the same Application function that guards the PUT (D-26), so the list and the save can never disagree.

### Pattern 4: Staff lookup and payer validation (CEXP-05, reused by ORD-22/ORD-23)

**Active rule:** reuse the exact D-18 rule already in `UserAccounts.CountActiveManagersAsync`: `user.IsActive && user.ManagerLockedAtUtc == null && user.DeletedAtUtc == null` [VERIFIED: src/Csps.Infrastructure/Identity/UserAccounts.cs:245], plus "has role Admin or Manager" (`Roles.Admin = "Admin"`, `Roles.Manager = "Manager"` [VERIFIED: src/Csps.Application/Security/Roles.cs:7,10]). An invited person who has not set a password yet counts as active under this rule (see Open Question 4).

- `GET /api/v1/staff` under `Policies.Staff` returns `[{ id, name }]` ordered by first name, last name, id. Names only, no email (the Manager-only roster stays Manager-only).
- Port method (on `IUserDirectory` or a new `IStaffDirectory`): `ListActiveStaffAsync` and `GetStaffStatesAsync(ids)` returning exists/active/formerStaff per id, so the handler can (a) refuse a new or changed payer that is not active with a field error on `paidByUserId`, and (b) allow an unchanged inactive saved payer (OQ-7 default A).
- Plain-English field error copy (UI-SPEC § Validation): "This person can't be chosen because their account isn't active. Choose someone else."
- Race note: a payer deactivated between the check and the insert is accepted; the money still lands on a real person and the payer stays visible. Accept and record it; no lock is needed (Phase 10 may revisit).

### Pattern 5: Soft delete, restore, permanent delete (D-01..D-07)

- Columns `DeletedAtUtc datetimeoffset NULL`, `DeletedById uniqueidentifier NULL` (FK NO ACTION). Same marker shape as users (`ApplicationUser.DeletedAtUtc`) [VERIFIED: src/Csps.Infrastructure/Identity/ApplicationUser.cs:50].
- Named global query filter on `CompanyExpense`: `HasQueryFilter("SoftDelete", e => e.DeletedAtUtc == null)`. The Deleted view, restore and permanent delete call `IgnoreQueryFilters(["SoftDelete"])`. A test proves the list, total, KPIs and the (future) ledger exclude deleted rows, and that restore brings them back.
- Routes (recommended): `DELETE /api/v1/company-expenses/{id}` (soft, Manager, 204; a second delete is 404 and writes nothing, as `DeleteUserHandler`), `DELETE /api/v1/company-expenses/{id}/permanent` (Manager, 204; works for deleted and non-deleted rows, D-04), `POST /api/v1/company-expenses/{id}/restore` (Manager, 204, Idempotency-Key; restoring an active expense is a 204 no-op with no audit, as Activate), `GET /api/v1/company-expenses/deleted` (Manager; newest delete first; search and category only).
- No row version on these (05 D-21/D-41); wrap each in `ConflictRetry.RunAsync` + `InTransactionAsync` so a race re-reads and decides again.
- Permanent delete: load with the filter bypassed, record the audit entry with date, category, amount and payer (never description or notes, D-06), `Remove`, save in one transaction. Prefer load + `Remove` over `ExecuteDeleteAsync` because the audit detail needs the row's values and the same transaction.

### Pattern 6: Categories (D-08..D-15)

- Table `ExpenseCategories`: `Id uniqueidentifier` (Guid; seed ids are literal constants), `Name nvarchar(40)`, `NormalizedName nvarchar(40)` with a **unique index** (upper-invariant of the trimmed name; mirrors Identity's `NormalizedEmail` "EmailIndex" pattern in `ApplicationUserConfiguration.cs:33-36`), `Tone nvarchar(16)` with a check constraint over the six tones, `RetiredAtUtc datetimeoffset NULL`, attribution columns (`IAttributedRecord`), `RowVersion`.
- Seed with `HasData` using literal values only (no clock, no `Guid.NewGuid()`), following `SiteSettingsConfiguration`'s comment "Literal values only: no clock read and no new Guid, or every "migrations add" would see model changes." [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs:34]. Seeded rows have `CreatedById = null` (reads "System").
- Seed tones (UI-SPEC): Rent `accent`, Utilities `info`, Salaries `mockup`, Supplies `warning`, Equipment `success`, Maintenance `neutral`, Others `neutral`, Government contributions `info`, Taxes and permits `mockup`, Transport and fuel `warning` [CITED: 06-UI-SPEC.md Component Inventory, CATEGORY_TONES row].
- Others: a well-known constant `ExpenseCategory.OthersId`; Domain refuses rename, retire and delete of it (OQ-6 default A).
- Order (D-15): `ORDER BY (Id == OthersId), Name` in SQL; a test pins it.
- "Ever used" (D-10): the delete handler checks `!expenses.IgnoreQueryFilters().Any(e => e.CategoryId == id)`; the FK (NO ACTION) is the race backstop, and a `DbUpdateException` from it maps to the refusal line "{name} is now used by an expense, so it can't be deleted." See Open Question 1 on permanent deletes.
- Routes (recommended): `GET /api/v1/expense-categories` (Staff; all categories with `status`, `tone`, `expenseCount` including deleted expenses), `POST` (Manager), `PUT /{id}` (Manager, `version`), `POST /{id}/retire`, `POST /{id}/reactivate` (Manager), `DELETE /{id}` (Manager).
- Duplicate name: pre-check gives the field error "Another category already has this name."; the unique index catches the race, mapped the same way `EmailInUseException` is in 05-19 (catch the unique-violation `DbUpdateException` in Infrastructure, raise a typed exception Application understands).

### Pattern 7: Business time (CEXP-03, D-20, D-23, D-24)

`IBusinessCalendar.GetClockAsync` returns `BusinessClock(Zone, Source, UtcNow)` with `Today` and `static MonthOf(DateOnly)` [VERIFIED: src/Csps.Domain/Time/BusinessClock.cs:27-42]. Because `ExpenseDate` is a `DateOnly` business date, month membership is plain date arithmetic on `DateOnly`; the only Manila-sensitive input is **which day "today" is**. So:

- This month = `MonthOf(clock.Today)`; last full month = `MonthOf(first.AddDays(-1))`.
- Default window = `[clock.Today.AddDays(-30), clock.Today.AddDays(30)]`.
- Date limit = `date <= clock.Today.AddDays(30)` (validator via `ValidationContext.RootContextData`, the precedent from 05-39: "the same-address rule reaches the shared validator through ValidationContext.RootContextData").
- **Success criterion 3 test:** `FakeTimeProvider` at `2026-10-31T23:00:00Z` (07:00 Manila on Nov 1). Assert "This month" is November 2026, an expense dated 2026-11-01 counts in This month, and one dated 2026-10-31 counts in Last month. Repeat at `2026-10-31T15:59:59Z` (23:59:59 Manila Oct 31) to prove it is still October.
- KPIs: one query for both month sums and counts (conditional sums over `ExpenseDate` between the two month ranges), one query for the top category (`GroupBy(CategoryId)` in this month, order by sum desc then name A to Z). Share = `round(top / total * 100)` to a whole percent with `MidpointRounding.AwayFromZero` (the project's one rounding rule, PRD §5.1). Return the month first-days so the browser labels "Oct"/"Sep" without computing months.

### Pattern 8: Indexes (PERF-04 "index on every filter and sort column")

| Index | Columns | Serves |
|-------|---------|--------|
| `IX_CompanyExpenses_List` filtered `WHERE [DeletedAtUtc] IS NULL` | `ExpenseDate DESC, CreatedAtUtc DESC, Id DESC` INCLUDE `Amount, CategoryId, PaidByUserId, CreatedById` | Date-range filter, default sort, period total and KPI sums as an index-only scan |
| `IX_CompanyExpenses_CategoryId_ExpenseDate` | `CategoryId, ExpenseDate` | Category filter; FK lookups; "ever used" check |
| `IX_CompanyExpenses_PaidByUserId` | `PaidByUserId` (INCLUDE `Amount`) | FK, staff-name search, Phase 10 ledger sums per payer |
| `IX_CompanyExpenses_CreatedById`, `_UpdatedById`, `_DeletedById` | single column | FKs to users (EF adds FK indexes by convention) |
| `IX_CompanyExpenses_Deleted` filtered `WHERE [DeletedAtUtc] IS NOT NULL` | `DeletedAtUtc DESC` | Deleted view sort |
| `IX_ExpenseCategories_NormalizedName` unique | `NormalizedName` | Case-insensitive uniqueness |

Description search is `LIKE '%q%'`, which no B-tree index can seek. Record this as the one filter that relies on a scan of the (already narrowed) date window; the timing test is the proof. A migration test (or model test) asserts the index set so a later change cannot drop one.

### Pattern 9: Query-count guard (Wave 0)

No query-count test exists yet (searched `tests/` for `DbCommandInterceptor`, `QueryCount`, `CommandCount`: no hits). Add to `Csps.Testing`:

```csharp
// Counts every SQL command the context runs. Thread-safe; reset between measurements.
public sealed class CommandCounter : DbCommandInterceptor
{
    private int _count;
    public int Count => Volatile.Read(ref _count);
    public void Reset() => Interlocked.Exchange(ref _count, 0);
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Interlocked.Increment(ref _count);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }
    // Also override ScalarExecutingAsync and NonQueryExecutingAsync the same way.
}
```

Two levels of test:
1. **Infrastructure (exact):** `CspsDatabase` gains `CreateContext(params IInterceptor[] extra)` (today it builds options through `CspsDbContextOptions.Configure` only, `CspsDatabase.cs:149-157`). Seed 150 rows, call the reader with page size 10 and 100, assert `Count == 2` both times.
2. **Server (equality):** register the counter with `services.ConfigureDbContext<CspsDbContext>(o => o.AddInterceptors(counter))` in `WithWebHostBuilder`, warm up once (the site-settings cache and the session cache each cost a query on first use), then assert the same count for page size 10 and 100.

### Pattern 10: p95 timing test (D-28)

- Lives in `tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseListTimingTests.cs` with its **own** `CspsDatabase` class fixture, so the big data set never slows the shared Respawn resets.
- Data: about 5 years of expenses, 20 per business day (about 36,500 rows), spread over the ten categories and 6 staff users, 2% soft-deleted, inserted with EF `AddRange` in batches of 1,000 (no SQL strings).
- Scenarios: default window; category filter; staff-name search; a 5-year custom range on the last page at size 100; KPIs. 20 warm-up requests, then 200 measured requests each through the in-memory `HttpClient`. p95 = the value at index `ceil(0.95 * n) - 1` of the sorted timings. Assert `< 300 ms`.
- Timer: `TimeProvider.System.GetTimestamp()` / `GetElapsedTime` (Stopwatch is allowed; only the `DateTime.Now` family is banned [VERIFIED: BannedSymbols.txt]).
- After release, read p95 from the live site's Serilog request log lines (`UseSerilogRequestLogging`, which logs elapsed milliseconds per request [CITED: Serilog.AspNetCore README]). Write that check into the phase's ship notes; never write fake data to production (D-28).

### Pattern 11: Audit events (D-27, AUDIT-01)

- `IAuditTrail.Record(action, targetType, targetId, detail)` in the same unit of work as the change; detail is at most 400 characters: `public const int DetailMaxLength = 400;` [VERIFIED: src/Csps.Domain/Auditing/AuditEntry.cs:37]; actions at most 64: `public const int ActionMaxLength = 64;` [VERIFIED: AuditEntry.cs:19].
- Target: `TargetType = "CompanyExpense"` / `"ExpenseCategory"`, `TargetId = AuditKey.Of(id)`.
- Detail convention: extend the existing `key=old>new` form (`role=admin>manager`, docs/operations/audit-log.md line 111) to several pairs joined by `;`, with ids for people and categories, e.g. `amount=1200.00>1250.00;date=2026-10-05>2026-10-06;category=<guid>><guid>;fields=description,notes`. Worst case is well under 400 characters because people and categories are 36-character ids.
- Payer change is its **own** entry (`payer=<old-guid>><new-guid>`), never merged with the field edit, following 05: "`user.details-changed` for names and email, `user.role-changed` for the role, never merged" (UpdateUserHandler summary).
- Category rename keeps both names (D-12): `name=<old>><new>` with the four reserved characters `%`, `;`, `=`, `>` percent-encoded (`%25`, `%3B`, `%3D`, `%3E`) by one shared encoder; with Name ≤ 40, the worst case is 2 × 120 plus the key, under 400.
- Add and permanent delete: `date=...;category=<guid>;amount=...;payer=<guid>`.
- `AuditActions.All` must list the new codes (the audit filter validator accepts only those: `ListAuditLogRequestValidator.cs:49`), and `AuditActionsTests` pins the count (`AuditActions.All.Count.ShouldBe(37)`, `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs:14`), which grows by the number of new codes.
- Viewer: today `describeAuditDetail` "never shows a stored value as it is" (`auditCopy.ts:153-157`). Expense and category events must show amounts, dates, category names and payer names. Recommended: the server parses the stored detail for these action codes into typed change lines (field, from, to), resolving payer ids with the same one-lookup people query `AuditLogReader` already runs (`AuditLogReader.cs:71-83`) and category ids with one more lookup; the web formats them (`formatPeso`, en-PH dates). "Done to" for an expense event = the payer (UI-SPEC A1). See Open Question 2.

### Pattern 12: Web slice

- `useExpensesListParams = createListParams({ page: pageParser, size: pageSizeParser, q: searchParser, category: <guid parser>, from: parseAsBusinessDate, to: parseAsBusinessDate })`, as `useUsersListParams.ts`. The from/to pair rule from UI-SPEC: read only as a pair, dropped with one `replace` otherwise.
- Edit modal reads fresh on every open and trusts data only when `isFetchedAfterMount` (05-25), keeps the version it opened with until its own save or Load Latest (05-13).
- Row focus after delete/restore: reuse `modules/admin/hooks/useRowFocus.ts` (05-28 rule: next row, else previous, else the `h1`).
- Single-click actions with a POST reuse one Idempotency-Key per attempt and a new one per new action (05-28 `useUserAction` identity generation).
- Remove the `{ path: 'expenses', lazy: previewPage }` entry from `devRoutes` (`web/src/modules/admin/routes.tsx:174`): STATE 05-13/05-20 record that a dev preview at the same path shadows the real page in the e2e bundle.
- Replace `{ path: 'expenses', lazy: notFoundPage }` (`routes.tsx:127`) with the real page; add `expenses/deleted` and `settings` with `loader: requireManager` like `users` (`routes.tsx:128`).
- zod schemas start with `z.config({ jitless: true })` (strict CSP), as `auditRange.ts:11`.

### Anti-Patterns to Avoid

- **Summing in the browser.** The footer total and KPIs come from the server only (Core Value). The browser never adds rows.
- **Forgetting the soft-delete filter** in a hand-written query. Use the named global filter; bypass it only by name.
- **Reading "today" from the device** for the default window or Upcoming. Use the server's `today`, `from`, `to`.
- **Accepting attribution or `paidBy` defaults from the client wrongly.** Request DTOs have no Created*/Updated*/Deleted* fields (SEC-08, CWE-915). `paidByUserId` is a real input but always validated.
- **Retrying a form edit on conflict.** A stale PUT must answer 409; only single-click actions retry.
- **Adding a payer or category snapshot column.** D-08 and the carried-forward rule say FK only.
- **Inline SQL** for locks, counts or deletes (owner rule). LINQ and `ExecuteUpdate`/`ExecuteDelete` only.
- **A trigger** for "category in use" or "Others protected" (OR-7). Use the FK, the unique index, check constraints and Domain rules.
- **Storing description or notes text in audit detail** (D-06, D-27, 05 D-40).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 409 detection | Manual "SELECT version then UPDATE" | EF `IsRowVersion()` + `CspsUnitOfWork` → `ConcurrencyConflictException` → `EditErrors.Stale` | Already race-safe and tested (`CspsUnitOfWorkTests`) |
| Attribution | Setting CreatedBy in handlers | `RecordStampInterceptor` via `IAttributedRecord` | One place; forged values ignored |
| Business today / months | `DateTime` math with offsets | `IBusinessCalendar` / `BusinessClock` | DST-safe, settings-driven, FakeTimeProvider-testable |
| LIKE escaping | New escaping code | The `EscapeLike` in `UserDirectory.cs:199-203`, moved to a shared helper | Handles `%`, `_`, `[`, `\` already |
| Two-writer test | Custom thread juggling | `ConcurrentRequests.SendTogetherAsync` (`tests/Csps.Testing/ConcurrentRequests.cs:16`) | Gate releases both at once |
| Idempotent POSTs | Per-endpoint dedupe | `IdempotencyMiddleware` (default-on for every POST) | Stores the answer with the change in one transaction |
| URL list state | `useSearchParams` code | `createListParams` + `parsers.ts` | Allow-list parsers, replace/push rules, debounce |
| Money display / parsing | `toFixed`, float math | `formatPeso`, `MoneyInput` (integer centavos) | No binary-float rounding errors |
| Delete confirm, 409 banner, actor names | New dialogs/banners | `ConfirmDialog` (with `pendingLabel`, `describeFailure`), `ConflictBanner`, `RecordMeta`, `ActorName` | Approved looks and a11y |
| Query counting | Log scraping | EF `DbCommandInterceptor` | Exact and deterministic |
| Category uniqueness | Lock + check | Unique index on `NormalizedName` | Race-free without triggers |

**Key insight:** this phase is a pattern-setter. Every hand-rolled variation becomes the template Phase 7 copies, so reuse the existing seams even where a shortcut looks smaller.

## Common Pitfalls

### Pitfall 1: Respawn wipes the seeded categories
**What goes wrong:** `CspsDatabase.ResetAsync` deletes every table not on its ignore list: `private static readonly string[] IgnoredTables = ["__EFMigrationsHistory", "SiteSettings", "AspNetRoles", "AuditLog", "AuditLogTruncateGuard"];` [VERIFIED: tests/Csps.Testing/CspsDatabase.cs:24]. After the first reset the ten `HasData` categories are gone and every expense test fails on the FK.
**Why not just ignore the table:** tests that add a category stamp `CreatedById` with a test user; Respawn then cannot delete that user (FK NO ACTION from the ignored table), and resets start failing.
**How to avoid:** do not ignore `ExpenseCategories`; after each reset re-insert the ten rows from `ExpenseCategorySeed` (the same constants `HasData` uses) with EF, in `CspsDatabase.ResetAsync` or a shared fixture helper. Guid keys make this a plain insert (no IDENTITY_INSERT).
**Warning signs:** FK violations on `CategoryId` in the second test of a class.

### Pitfall 2: Soft delete and restore stamp "Last changed by"
**What goes wrong:** `RecordStampInterceptor` treats any `Modified` non-`IEditVersioned` entity as a staff edit (`IsStaffEdit` returns true when the entity is not `IEditVersioned`, `RecordStampInterceptor.cs:66-75`), so a soft delete or restore overwrites `UpdatedById/UpdatedAtUtc` with the Manager.
**How to avoid:** decide it explicitly (Open Question 3). Recommended: accept it, because SEC-08 counts actions such as deactivate as staff edits; test it either way so the behavior is pinned.

### Pitfall 3: Query-count test counts unrelated queries
**What goes wrong:** the first request also reads site settings (business zone) and the session cache, so the count differs between the first and later requests.
**How to avoid:** warm up once, then compare page size 10 vs 100; keep the exact count assertion at the Infrastructure level.

### Pitfall 4: Timing test flakes on shared CI runners
**What goes wrong:** GitHub's ubuntu runner and the SQL container share CPU; a noisy neighbor can push p95 over 300 ms.
**How to avoid:** warm up, measure 200 requests, keep the data in its own database, and do not run it in parallel with other heavy classes (xUnit collection with parallelization off for that class). If it fails, re-run it alone before calling it flaky, and record any flake (owner quality bar).

### Pitfall 5: Paging past the end and a page-size change
**What goes wrong:** after a delete the last page can become empty.
**How to avoid:** server returns no rows and the true total (as `ListUsers`); the client clamps with `clampPage` (`parsers.ts:112`) and replaces the URL once.

### Pitfall 6: Amount precision on the wire
**What goes wrong:** a client sends `1250.123` or a float artifact; `decimal(18,2)` would round silently.
**How to avoid:** server validator `PrecisionScale(18, 2, ignoreTrailingZeros: true)` plus `> 0` and `<= 1_000_000.00m` with the UI-SPEC messages; the browser sends the `MoneyInput` decimal string converted with `Number()` only after the 2-decimal check (≤ 10 significant digits round-trips exactly through JSON). A domain test covers `1_000_000.00m` (allowed) and `1_000_000.01m` (refused).

### Pitfall 7: Dev preview route shadows the real page
**What goes wrong:** `devRoutes` still maps `admin/expenses` to `previewPage` (`routes.tsx:174`); STATE 05-13 and 05-20 record the same bug for profile and users.
**How to avoid:** delete that entry in the first web slice; an e2e test signs in and reaches the real `/admin/expenses`.

### Pitfall 8: Parity scenarios and the removed `EXPENSE_TONE`
**What goes wrong:** `EXPENSE_TONE` and the `ExpenseCategory` union are used by `components/status/tones.ts`, `components/status/index.ts`, `components/index.ts` (barrel pinned by `components/index.test.ts`), `status.test.tsx` and `dev/scenarios/groups/status.ts` (parity). Removing them breaks the frozen look-equality scenarios.
**How to avoid:** introduce `CATEGORY_TONES`/`isCategoryTone`, move the dev scenario to the seed-tone values (same rendered badges), update the barrel test, and never touch `web/visual/.reference-src/` (the frozen reference).

### Pitfall 9: Audit action allow-list and count pins
**What goes wrong:** a new code not in `AuditActions.All` cannot be filtered in the viewer (validator refuses it), and `AuditActionsTests` fails on the count.
**How to avoid:** add codes to `All` and the web labels in one task; update the pinned count and the `docs/operations/audit-log.md` catalog together.

### Pitfall 10: OpenAPI drift
**What goes wrong:** new endpoints change `/openapi/v1.json`; CI fails `OpenApiSnapshotTests` and `npm --prefix tools/openapi-gen run check`.
**How to avoid:** after each API change run the documented refresh (docs/web/api.md): run the snapshot test, refresh with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` set for that one command only, run it again, then `npm --prefix tools/openapi-gen run generate` and commit `web/src/types/api.generated.ts`.

### Pitfall 11: The idempotency gate owns the transaction for POSTs
**What goes wrong:** for a covered POST the gate opens the transaction and keeps only 2xx, 400, 404 and 422 answers; a 409 or 403 rolls back (IdempotencyMiddleware summary). Handler code that expects its own commit to survive a 409 is wrong.
**How to avoid:** use `InTransactionAsync` (it joins the outer transaction with a savepoint) and never rely on a write surviving a non-stored status. A POST that must commit despite a non-stored status uses `IdempotencyOutcome.KeepChanges` (the 05-12 profile precedent); nothing in this phase should need it.

### Pitfall 12: Category name collation
**What goes wrong:** uniqueness "ignoring letter case" depends on the column collation if enforced on `Name`.
**How to avoid:** enforce it on `NormalizedName` (upper-invariant), independent of the server collation.

## Code Examples

### Edit handler skeleton (rowversion + D-26 + payer audit)

```csharp
// Source: shape of src/Csps.Application/Users/UpdateUserHandler.cs (read this session); names are recommendations.
public async Task<Result<ExpenseDetailResponse>> HandleAsync(Guid id, UpdateExpenseRequest request, CancellationToken ct)
{
    if (requestContext.UserId is not { } callerId) return Result.Failure<ExpenseDetailResponse>(AuthErrors.SessionEnded);
    var clock = await calendar.GetClockAsync(ct);
    var validation = await validator.ValidateAsync(WithToday(request, clock.Today), ct);   // RootContextData["today"]
    if (!validation.IsValid) return Result.Failure<ExpenseDetailResponse>(ValidationResults.ToError(validation, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));

    try
    {
        var outcome = await unitOfWork.InTransactionAsync(async token =>
        {
            var expense = await expenses.FindAsync(id, token);                       // tracked, soft-delete filter on
            if (expense is null) return Result.Failure<bool>(ExpenseErrors.NotFound);
            if (!ExpenseAccess.CanEdit(expense, callerId, caller.IsManager)) return Result.Failure<bool>(ExpenseErrors.NotYours); // 403
            if (!expense.RowVersion.AsSpan().SequenceEqual(version)) return Result.Failure<bool>(EditErrors.Stale);              // 409
            // payer/category active checks here (field errors), allowing an unchanged inactive payer (OQ-7 A)
            var changes = expense.Update(/* trimmed values */, clock.Today);
            if (changes.IsFailure) return Result.Failure<bool>(changes.Error);
            AuditExpenseChanges(expense.Id, changes.Value);   // "changed" and, separately, "payer-changed"
            await unitOfWork.SaveChangesAsync(token);
            return Result.Success(true);
        }, ct);
        if (outcome.IsFailure) return Result.Failure<ExpenseDetailResponse>(outcome.Error);
    }
    catch (ConcurrencyConflictException)
    {
        return Result.Failure<ExpenseDetailResponse>(EditErrors.Stale);
    }
    return await ReadDetailAsync(id, callerId, ct);
}
```

### Named soft-delete filter and covering index

```csharp
// Source: EF Core 10 API names verified in local package XML docs this session.
builder.HasQueryFilter("SoftDelete", expense => expense.DeletedAtUtc == null);
builder.HasIndex(e => new { e.ExpenseDate, e.CreatedAtUtc, e.Id })
    .IsDescending(true, true, true)
    .HasFilter("[DeletedAtUtc] IS NULL")
    .IncludeProperties(e => new { e.Amount, e.CategoryId, e.PaidByUserId, e.CreatedById })
    .HasDatabaseName("IX_CompanyExpenses_List");
// Deleted view: context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).Where(e => e.DeletedAtUtc != null)
```

### Authorization matrix rows (shape)

```csharp
// Source: tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:121-143 (read this session). Statuses are the
// expected values for the recommended routes; a POST with no body or key meets 400 for a caller who passes the policy.
new("GET", "/api/v1/company-expenses", "/api/v1/company-expenses", Anonymous: 401, Admin: 200, Manager: 200),
new("POST", "/api/v1/company-expenses", "/api/v1/company-expenses", Anonymous: 401, Admin: 400, Manager: 400),
new("DELETE", "/api/v1/company-expenses/{id:guid}", "/api/v1/company-expenses/<fake guid>", Anonymous: 401, Admin: 403, Manager: 404),
new("GET", "/api/v1/company-expenses/deleted", "/api/v1/company-expenses/deleted", Anonymous: 401, Admin: 403, Manager: 200),
new("GET", "/api/v1/staff", "/api/v1/staff", Anonymous: 401, Admin: 200, Manager: 200),
```

Policy names: `public const string Staff = "Staff";` and `public const string Manager = "Manager";` [VERIFIED: src/Csps.Application/Security/Policies.cs:10,13]. The Manager-only actions get `[Authorize(Policy = Policies.Manager)]` on the action (the controller default is `Policies.Staff`).

### FakeTimeProvider month-boundary test (shape)

```csharp
// 07:00 Manila on Nov 1 is 23:00 UTC on Oct 31 (Asia/Manila is UTC+8, no DST).
var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 31, 23, 0, 0, TimeSpan.Zero));
// seed: 2026-11-01 ₱500 (Supplies), 2026-10-31 ₱300 (Rent)
// assert: thisMonth.month == 2026-11-01, thisMonth.total == 500.00; lastMonth.month == 2026-10-01, lastMonth.total == 300.00
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One unnamed `HasQueryFilter` per entity | Named filters, bypassed one at a time | EF Core 10 [VERIFIED: XML docs list `HasQueryFilter(System.String, ...)`] | The soft-delete filter can be bypassed without dropping future filters |
| GUID edit versions for staff rows | SQL `rowversion` for business aggregates | This phase | First rowversion edit form; Phase 7 copies it |
| Fixed `EXPENSE_TONE` table | Tone stored per category from six `CATEGORY_TONES` | This phase (D-08, D-13) | Barrel and status tests change |

**Deprecated/outdated in this repo after Phase 6:**
- `EXPENSE_TONE`, `ExpenseCategory`, `EXPENSE_CATEGORIES` in `web/src/utils/csps.ts` and `components/status/tones.ts` (D-08). `utils/csps.ts`'s `CompanyExpense` interface is the App. D.1 transcription; API code must use the generated types, never it.
- CEXP-01's "last 30 days" default (replaced by D-23).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EF Core 10 maps `DateOnly` to SQL `date` with no converter | Pattern 1 | Low: a converter is one line; the migration shows the column type |
| A2 | `AddInterceptors` in `ConfigureDbContext` appends to the interceptors `AddCspsPersistence` registers, rather than replacing them | Pattern 9 | Medium: if it replaces, the stamp interceptor would vanish in that test; the Infrastructure-level exact test does not depend on it, and a quick assertion in the Server test (a create still stamps CreatedBy) catches it |
| A3 | About 20 expenses per business day is a realistic upper bound for 5 years | Pattern 10 | Low: the owner can confirm; the test constant is one number |
| A4 | Serilog request logging records elapsed milliseconds per request, enough to compute live p95 | Pattern 10 | Low: confirm on the first post-release log read |
| A5 | Expected volume keeps `LIKE '%q%'` description search under p95 300 ms | Alternatives, Pattern 8 | Medium: the timing test proves or disproves it before release |
| A6 | The CI SQL container's timing is stable enough for a 300 ms p95 gate | Pitfall 4 | Medium: may need a CI-only margin; any change needs the owner |

## Open Questions

Items that change behavior, wording, security or scope are the owner's call. Each has options with the recommendation first. Items marked *(planner)* are technical and may be settled in planning.

1. **"Ever used" after a permanent delete (D-10 wording).** If a category's only expenses are deleted permanently, its count drops to 0.
   - **A (recommended):** it becomes deletable again ("used" means "an expense row exists now, deleted ones included"). Simple, enforced by the FK, and audit entries keep reading because category events store names and expense events fall back to "a deleted category". One-line reason: no extra column and no rowversion churn on the category.
   - B: once used, never deletable ("sticky" flag). Needs a column set on first use, which bumps the category's row version and can cause a spurious 409 for a Manager editing that category at the same moment.
2. **How the Audit Log shows expense values *(planner, with owner FYI)*.** D-27 wants old and new amounts, dates, category and payer; today the viewer never shows stored values (05 D-40).
   - **A (recommended):** the server turns these events' detail into typed change lines and resolves payer and category ids to current names; the web only formats. Keeps names out of storage and the "no raw value" rule for every other event.
   - B: the web parses the detail itself and calls the people endpoint for names. More client logic, two sources of truth.
   - Also: should the "Done to" **filter** match expense events by payer? Recommended yes, by a LIKE on the stored `payer=<id>` restricted to expense codes (LINQ, no schema change). Alternative: an additive `SubjectUserId` column on `AuditLog`, which touches the append-only table and its tests.
3. **Does a soft delete or restore update "Last changed by"?** (Pitfall 2.)
   - **A (recommended):** yes, the Manager becomes "Last changed by", like deactivate and lock in Phase 5 (SEC-08 counts such actions as staff edits).
   - B: no; only form edits change it (needs a small exception in the stamp interceptor).
4. **Can an invited person who has not finished set-up be chosen as Paid by?** The existing active rule (D-18) counts them as active.
   - **A (recommended):** yes, keep one "active staff" rule everywhere.
   - B: no, only people who have signed in at least once (adds a "has password" condition to the lookup and the validator).
5. **Seeded 5-year timing data volume *(planner)*:** 20 per day (about 36,500 rows) unless the owner knows the shop's real rate. Recommended: 20 per day.
6. **Database check constraint for the ₱1,000,000.00 cap.**
   - **A (recommended):** the database checks only `Amount > 0`; the cap lives in validators. Legacy import (MIG phases) may hold larger amounts, and the cap may change.
   - B: also `Amount <= 1000000`; a later change needs a migration.
7. **Pin the "no inline SQL" rule with a test *(planner)*:** recommended: an architecture test that fails on any `ExecuteSql*`, `FromSql*` or `SqlQuery*` call outside the three existing call sites and migrations. Cheap, and it protects Phase 7.
8. **Dev seed users *(planner)*:** `DevSeedSteps.All` holds only the SiteSettings step today (`DevSeedSteps.cs:10`); expenses need real staff as payers. Recommended: the expense seed step uses existing active staff and prints a skip when there are none, rather than creating accounts.
9. **UI-SPEC OQ-1 to OQ-15** still need owner rulings (away-mode: backlog, never auto-approved). The contract defaults are buildable now.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build, tests, migrations | ✓ | 10.0.402 (global.json pins 10.0.401 with `rollForward: latestPatch`) | — |
| Node | web build, Vitest, Playwright, openapi-gen | ✓ | v24.21.0 (engines `>=24.15 <25`) | — |
| npm | web scripts | ✓ | 11.19.0 | — |
| SQL Server LocalDB | integration tests, migrations, timing test | ✓ | instance `MSSQLLocalDB` listed by `sqllocaldb info` | CI uses the SQL 2025 container (`CSPS_TEST_SQL=container`) |
| `dotnet-ef` local tool | `migrations add` | ✓ (local tool manifest, used since Phase 1) | per tool manifest | — |
| Preflight script | before full runs, dev servers, Playwright | path given in CLAUDE.md | — | wait if another project is busy |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.
Note: `sqllocaldb info` also lists a retired `CSPS` instance; do not use or delete it (OR-1).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | .NET: xunit.v3 4.0.1 on MTP, Shouldly, NSubstitute, FakeTimeProvider, Respawn 7, ArchUnitNET, coverlet.MTP. Web: Vitest + RTL + jsdom + in-house axe matcher, MSW, Playwright + @axe-core/playwright |
| Config files | `global.json`, `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts` |
| Quick run command | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| Full suite command | preflight (`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`), then `dotnet test --solution Csps.slnx` with `CSPS_TEST_SQL=localdb` set in that process only, `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |

### Phase Requirements → Test Map

| Req ID / SC | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CEXP-01 / SC1 | Default window = today -30..+30 (server-resolved), newest first with CreatedAt tie-break, category filter, search on description/payer/recorder (`%`, `_` literal), never notes, paging, period total covers all pages, deleted excluded | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListCompanyExpensesEndpointTests"` | ❌ Wave 0 |
| CEXP-01 | List params hook: pair rule for from/to, allow-listed category id, size set, replace vs push | hook | `npm --prefix web run test -- --run src/modules/admin/hooks/useExpensesListParams.test.tsx` | ❌ |
| CEXP-01 | Page shows result bar, chips, footer total from server, Upcoming badge from server `today`; list → Back restores state | component + E2E | `npm --prefix web run test -- --run src/modules/admin/pages/ExpensesPage.test.tsx`; `npm --prefix web run e2e -- --grep @expenses` | ❌ |
| CEXP-02 / SC2 | Domain invariants: amount > 0 and ≤ 1,000,000.00, 2 decimals, description 1..200 trimmed, notes ≤ 1000, date ≤ today+30, soft delete/restore state | unit (Domain 100%) | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*CompanyExpenseTests"` | ❌ |
| CEXP-02 | Create/Update/Delete/Restore/Permanent handlers, validators (field messages verbatim from UI-SPEC) | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CompanyExpense*"` | ❌ |
| CEXP-02 / SEC-07 | Two concurrent PUTs with one version: one 200, one 409 `edit.stale` with the exact text; totals exact | integration (concurrency) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseConcurrencyTests"` | ❌ |
| CEXP-02 / D-01..D-07 | Soft delete hides from list/total/KPIs; second delete 404; restore counts again; permanent delete removes row; Admin 403 on delete, restore, permanent, deleted list | integration + matrix | `--filter-class "*CompanyExpenseDeletionTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | ❌ / ✅ (add rows) |
| CEXP-02 / SEC-06 | Duplicate POST with the same Idempotency-Key creates exactly one expense | integration | `--filter-class "*CreateCompanyExpenseEndpointTests"` | ❌ |
| CEXP-02 / D-26 | Admin edits own (recorded or paid) → 200; others → 403; Manager any → 200; list `canEdit` matches the PUT rule | unit + integration | `--filter-class "*ExpenseAccessTests"`; `--filter-class "*UpdateCompanyExpenseEndpointTests"` | ❌ |
| CEXP-02 / D-08..D-15 | Seed has 10 categories with tones; A to Z with Others last; rename shows everywhere; retire hides from picker, keeps in filter; used category can't be deleted; unused can; duplicate name (any case) refused; Others protected; category 409 | unit + integration | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ExpenseCategoryTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ExpenseCategoriesEndpointTests"` | ❌ |
| CEXP-02 | Expense modal: zod mirrors server rules, 409 keeps typed values with Load Latest, 403/404 banners, D-26 note | component | `npm --prefix web run test -- --run src/modules/admin/components/ExpenseModal.test.tsx src/modules/admin/expensesSchemas.test.ts` | ❌ |
| CEXP-03 / SC3 | This month, last month, top category + share; 2026-10-31T23:00Z counts as November; 15:59:59Z still October; ties A to Z; empty month → no top category; upcoming this month counts, next month doesn't | unit + integration | `--filter-class "*CompanyExpenseKpisTests"` (Application, FakeTimeProvider) and `--filter-class "*CompanyExpenseKpisEndpointTests"` | ❌ |
| CEXP-04 / SC4 / SEC-08 | Forged createdBy/updatedBy/createdAt/updatedAt on POST and PUT ignored; Recorded by = creator after another user edits; Last changed by set; both keep the name with formerStaff after the user is deleted | integration | `--filter-class "*CompanyExpenseAttributionTests"` | ❌ |
| CEXP-05 / SC6 | Paid by required; inactive, locked, deleted or non-staff id → 400 on `paidByUserId` with the plain-English message; unchanged inactive payer allowed on edit; staff lookup 200 for both roles, names only, active only; payer change writes its own audit entry | integration | `--filter-class "*CompanyExpensePayerTests"`; `--filter-class "*StaffLookupEndpointTests"` | ❌ |
| AUDIT-01 / D-27 | Each action writes exactly its code, target type and id; detail has old>new for amount, date, category, payer; description/notes only as field names; permanent delete keeps date, category, amount, payer | unit + integration | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AuditActionsTests"`; `--filter-class "*CompanyExpenseAuditTests"` | ✅ (extend count) / ❌ |
| PERF-04 / SC5 | Reader runs exactly 2 commands at page size 10 and 100 | integration (Infrastructure) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CompanyExpenseReaderQueryCountTests"` | ❌ Wave 0 (CommandCounter) |
| PERF-04 / SC5 | Endpoint command count equal for page size 10 and 100 after warm-up | integration (Server) | `--filter-class "*CompanyExpenseListQueryCountTests"` | ❌ |
| PERF-04 / D-28 | p95 < 300 ms on ~5 years of fake data for default, category, search, 5-year last page, KPIs | timing | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ExpenseListTimingTests"` | ❌ |
| PERF-04 | Index set exists (names and columns) and migration applies to empty and previous DB; idempotent script compiles | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MigrationTests"` and `"*MigrationScriptTests"` (extend) | ✅ (extend) |
| OR-7 | Still only `TR_AuditLog_AppendOnly` | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*TriggerInventoryTests"` | ✅ |
| Contract | OpenAPI snapshot and generated types in sync | integration + node | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"`; `npm --prefix tools/openapi-gen run check` | ✅ |
| UI / a11y | E1, E4, S1 axe-clean, no sideways scroll 320 to 1920, CSP clean, Manager vs Admin actions, Settings redirect for Admin | E2E | `npm --prefix web run e2e -- --grep @expenses`; `npm --prefix web run e2e -- --grep @settings` | ❌ |
| Layout/OR-4 | No long dash, owner tree layout, barrel exports | node tests | `npm --prefix web run test -- --run src/components/index.test.ts` plus `npm --prefix web run verify` | ✅ (update) |

### Sampling Rate
- **Per task commit:** the touched class via `--filter-class`, or `npm --prefix web run test -- --run <path>`.
- **Per wave merge:** preflight, `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` in that process), `npm --prefix web run verify`.
- **Phase gate:** full suite, coverage gate, e2e on all engines and phone viewports, zero warnings, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/Csps.Testing/CommandCounter.cs` and a `CspsDatabase.CreateContext(params IInterceptor[])` overload (query-count guard).
- [ ] Category reseed after `CspsDatabase.ResetAsync` from `ExpenseCategorySeed` (Pitfall 1).
- [ ] Expense fixtures helper (`tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs`) modelled on `Users/UserFixtures.cs` (create staff, create expense via API, read page).
- [ ] Timing-test class fixture with its own database and bulk data builder.
- [ ] Web: MSW handlers for the new services; showcase fixtures with 200-character descriptions and 40-character names.
- No framework install needed.

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing JWT bearer + active-session check |
| V3 Session Management | no (unchanged) | Existing |
| V4 Access Control | **yes** | Policies `Staff`/`Manager`; handler-level D-26 object check (Admin edits only recorded-or-paid rows); matrix test for every endpoint × caller |
| V5 Input Validation | **yes** | FluentValidation in handlers (lengths, ranges, `PrecisionScale`, enum of tones, base64 version, date pair); zod mirrors (OR-3); page/size/search caps |
| V6 Cryptography | no | — |
| V7 Error handling and logging | **yes** | ProblemDetails with plain English; audit entries without description/notes text; no PII in logs |
| V8 Data protection | **yes** | Notes may hold personal details: shown only in the form, never in audit, never searched (D-19, D-27) |
| V13 API | **yes** | No mass assignment (DTOs exclude attribution and deleted fields); Idempotency-Key on POSTs; `[ResponseCache(NoStore = true)]` as `UsersController` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: Admin edits another person's expense by id (CWE-639/862) | Elevation | Server-side `ExpenseAccess.CanEdit` on every PUT; integration test with a foreign id |
| Admin calls Manager-only delete/restore/permanent/deleted list/category writes (CWE-862) | Elevation | `[Authorize(Policy = Policies.Manager)]` per action; matrix rows assert 403 |
| Forged Created/Updated/Deleted By/At or a forged payer default (CWE-915) | Spoofing | DTOs lack the fields; interceptor stamps; payer validated as active staff |
| Lost update between two editors (CWE-362) | Tampering | rowversion 409; two-writer test |
| Duplicate expense from double submit or replay | Tampering | Idempotency gate (SEC-06) |
| LIKE wildcard injection in search (CWE-943) | Tampering / DoS | Escaped pattern with explicit escape char; length cap 100 |
| Large result or page request (CWE-400) | DoS | Page size ≤ 100, page ≤ 100,000, search ≤ 100 |
| Stored XSS through description, notes or category name (CWE-79) | Tampering | React text rendering only, no `dangerouslySetInnerHTML` (lint-banned) |
| Audit tampering | Repudiation | Append-only table (trigger, truncate guard, interceptor), entries written in the same transaction |
| Personal data leaking into audit or logs | Information disclosure | Detail holds ids, amounts, dates, category ids/names only |

## Sources

### Primary (HIGH confidence)
- Codebase files read this session: `src/Csps.Domain/Common/*` (Result, Error, ErrorKind, IAttributedRecord, IEditVersioned), `src/Csps.Domain/Time/BusinessClock.cs`, `src/Csps.Application/Ports/IBusinessCalendar.cs`, `IUnitOfWork.cs`, `IAuditTrail.cs`, `IUserDirectory.cs`, `IRequestContext.cs`, `ICurrentActor.cs`; `src/Csps.Application/Common/*` (EditErrors, ConflictRetry, ConcurrencyConflictException, ListQueryRules, ValidationResults, AuditKey); `src/Csps.Application/Users/*` (ListUsersHandler, ListUsersRequest, ListUsersRequestValidator, UpdateUserHandler, UpdateUserRequest, UserDetailResponse, UserStatuses); `src/Csps.Infrastructure/Persistence/*` (RecordStampInterceptor, CspsUnitOfWork, CspsDbContextOptions, CspsDbContext, SqlCompatibility), configurations for ApplicationUser, SiteSettings, UserSession; `Identity/UserDirectory.cs`, `UserAccounts.cs`; `Auditing/AuditLogReader.cs`; `Seeding/*`; `DependencyInjection.cs`; `src/Csps.Server/Controllers/UsersController.cs`, `Composition/SecurityRegistration.cs`, `Http/HttpRequestContext.cs`, `Http/ResultHttpExtensions.cs`, `Security/IdempotencyMiddleware.cs`; tests `Csps.Testing/*`, `AuthorizationMatrix.cs`; web `tones.ts`, `routes.tsx`, `Sidebar.tsx`, `useUsersListParams.ts`, `usersService.ts`, `auditCopy.ts`, `auditRange.ts`, `parsers.ts`, `KpiCard.tsx`, `RecordMeta.tsx`, `ActorName.tsx`; `Directory.Packages.props`, `BannedSymbols.txt`, `docs/web/api.md`, `docs/operations/audit-log.md`.
- Local NuGet package XML docs (this session): Microsoft.EntityFrameworkCore 10.0.13 (`ConfigureDbContext`, named `HasQueryFilter`, `IgnoreQueryFilters` by name, `IsDescending`), Microsoft.EntityFrameworkCore.SqlServer 10.0.13 (`IncludeProperties`), FluentValidation 12.1.1 (`PrecisionScale`).
- Planning docs: `06-CONTEXT.md`, `06-UI-SPEC.md`, `REQUIREMENTS.md` (CEXP-01..05, PERF-04, SEC-06..08, MONEY-01, AUDIT-01/02, ORD-22/23, WEB-10), `ROADMAP.md` Phase 6, `STATE.md` Phase 5 decisions, `05-VALIDATION.md` command patterns, `CSPS-PRD.md` §3, §5.2, §5.6, §6.5, §15.

### Secondary (MEDIUM confidence)
- Serilog.AspNetCore request logging records elapsed time (README; not re-fetched this session).

### Tertiary (LOW confidence)
- Assumptions A1 to A6 above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new packages; pins and APIs read locally.
- Architecture: HIGH, every pattern has a shipped analog read this session; the audit-detail viewer design (Open Question 2) is MEDIUM until ruled.
- Pitfalls: HIGH for Respawn, stamp interceptor, dev preview, tone removal, audit pins (all observed in code); MEDIUM for CI timing stability.

**Research date:** 2026-10-25
**Valid until:** 2026-11-24 (stable stack; re-check if EF Core or the test fixture changes)
