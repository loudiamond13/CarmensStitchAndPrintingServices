---
created: "2026-10-14T06:18:50-05:00"
updated: "2026-10-14T10:55:00-05:00"
phase: 04-identity-authentication
kind: research
---

# Phase 4: Identity & Authentication - Research

**Researched:** 2026-10-14 (before `/gsd-discuss-phase 4`; no CONTEXT.md exists yet)
**Domain:** ASP.NET Core 10 Identity (`AddIdentityCore`) + custom JWT/refresh-family sessions, emailed 6-digit second factor, outbox + MailKit SMTP, NIST SP 800-63B-4 passwords with HIBP, SEC-06 idempotency, SEC-03 rate limiting, append-only auth audit, and the React sign-in / 2FA / reset screens.
**Confidence:** HIGH for the codebase facts, package versions, publish dates, advisories and the Identity/SignInManager/PasswordHasher source behaviour (read this session). MEDIUM for browser cookie behaviour on localhost and for the HIBP and NIST rules (official pages read this session). LOW for SmarterASP.NET SMTP specifics, which were not found anywhere public.

> **Owner conventions (2026-10-14).** Set after this research was written (quick 261014-ctx). They win where this text disagrees. Full rules: `.claude/CLAUDE.md` → Conventions.
>
> - Frontend paths below follow the owner layout. The old auth feature folder becomes `web/src/modules/admin/` (pages in `pages/`, dialogs and the device summary formatter in `components/`, calls in `services/authService.ts`, `session.ts` in `services/`, `guard.ts` and `authCopy.ts` at the module root), and `AuthLayout` goes to `web/src/layouts/`.
> - Imports from the old UI library folder move to `@/components` (only the `tw` marker and the stylesheets stay in `ui`). The single `api.ts` is gone: calls live in per-module services over the shared client in `web/src/core/api/`. Coverage is keyed to `core/api`.
> - Local SQL is `(localdb)\MSSQLLocalDB` (version from `sqllocaldb info MSSQLLocalDB`: 17.0.4025.3) with `CSPS_*` databases. TheBETSLLC shares the instance, so database names are the guard.
> - Every auth form gets a zod schema that mirrors the API validator (OR-3), and no em or en dash goes into client code, copy or comments (OR-4).

> **How this was researched.** No Context7 or MCP search provider is configured (all `*_search` flags are false in `.planning/config.json`), so official sources were read through WebFetch/WebSearch: source.dot.net (Identity, SignInManager, PasswordHasher), learn.microsoft.com (rate limiting), pages.nist.gov (SP 800-63B-4), haveibeenpwned.com (API v3), WebKit Bugzilla and the httpwg issue tracker (cookies on localhost). Package facts come from the NuGet registration/flat-container/vulnerability APIs, the npm registry and the npm bulk-advisory endpoint, and `dotnet list package --vulnerable` run against this repo. Codebase claims come from files opened this session.

---

<user_constraints>
## User Constraints

**No `04-CONTEXT.md` exists yet.** The owner runs `/gsd-discuss-phase 4` *after* this research. So this section has three parts: rules that are **already decided** (owner rulings recorded in earlier phases, `CLAUDE.md` and `STATE.md`), which the planner must honour; the owner decisions that are **still open** for this phase, with nothing assumed about them (options are in "Owner Decision Briefs" below); and items that are **out of scope**.

### Locked decisions (already ruled; binding on this phase)

- **Phase order (owner, 2026-10-14):** Phase 3 (CI/CD and staging) is deferred until after Phase 4. Phase 4 ships on **local gates only**, and its first staging or production deploy happens in Phase 3. `[VERIFIED: .planning/STATE.md:306, ROADMAP.md:350]`
- **Stack:** `AddIdentityCore<…>().AddRoles<IdentityRole<Guid>>()`, never `AddIdentity` or `MapIdentityApi`. JWT bearer tokens are issued through `JsonWebTokenHandler`. FluentValidation 12 runs inside handlers, MailKit is used, and the HIBP client is hand-rolled (no package). `[VERIFIED: .claude/CLAUDE.md "Technology Stack"]`
- **Controllers (owner, 2026-10-07):** one `[ApiController]` per resource with attribute routes under `/api/v1`, and thin actions that call one handler. Default-deny stays, and every action declares `[Authorize(Policy = …)]` or `[AllowAnonymous]`. Automatic 400s are off (`SuppressModelStateInvalidFilter`): validation is FluentValidation in handlers → `Result<T>` → ProblemDetails. `[VERIFIED: .claude/CLAUDE.md "Architecture"]`
- **Free only (D-00).** The allowed licenses are MIT, Apache-2.0, BSD and ISC. Each new dependency needs its purpose, license, maintenance status and a legitimacy check recorded here, a **14-day release cool-down** (security fixes may skip it, with a recorded reason), and **owner approval of the exact version** (user memory "Package approval").
- **No JSON columns (D-13).** Compat level stays pinned at 160 (D-33). Schema changes come from EF migrations only, and nothing migrates or seeds at startup (D-08).
- **Email sender (D-12, D-33):** the sender is the legacy site's domain `cspstailoring.com`. SPF is `v=spf1 a mx include:_spf.site4now.net -all` and DMARC is `v=DMARC1;p=reject;pct=100;…`, so mail **must** go through SmarterASP.NET's mail servers with **aligned DKIM**. Any other sender would have to be merged into the one SPF record. `[VERIFIED: .planning/HOSTING-RECORD.md:176,178]`
- **Audit:** IPs are truncated to /24 and /48 (D-24). The log is append-only through a trigger, an FK truncate guard and an interceptor (D-25/D-32). Retention is **8 months** (D-32; CLAUDE.md still says 2 years, see review IN-09). **WR-02 (the IpPrefix 6to4/NAT64 bypass) MUST be fixed before any code path writes audit rows.** `[VERIFIED: STATE.md:302]`
- **Data Protection** keys are certificate-encrypted in the DB (D-15). OpenAPI and Scalar exist in Development only (D-14). Logs are JSON files with secret masking (D-21).
- **Client contracts already built in Phase 2:**
  - `useSubmission` / WEB-09 send one `Idempotency-Key` per submission and reuse it on retries (R2-08: a network error, timeout, 5xx, 408 or 409 reuses the key; a 400, 401, 403, 404, 422 or 429 gets a fresh one).
  - `httpClient` has `refresh`, `onUnauthorized` and `skipAuthRefresh` hooks, and its secret-query-param guard rejects `code`.
  - **R2-09 (owner):** a 401 shows "Your session ended. Sign in again." on sign-in.
  - **R2-10:** the page behind a dialog becomes `inert` in Phase 4.
  - **D-20:** admin routes are excluded from production builds *until Phase 4 adds sign-in*.
  `[VERIFIED: 02-CONTEXT.md:84,178; deferred-items.md:72-77]`
- **Ports and machine rules:** Vite 5180, API 5115/7028, E2E 5199, `(localdb)\MSSQLLocalDB` (owner, 2026-10-14), the `CSPS_` DB prefix, no Docker locally, and preflight before servers or full runs (root `CLAUDE.md`).

### Open owner decisions for this phase (NOT decided; briefs in "Owner Decision Briefs")
OD-12, C-4, C-5, C-6, C-7, C-8, C-9, C-17, C-19, C-23, C-33, OD-14. Research also surfaces a few new items, AD-1 to AD-7, that need a ruling, listed in the same section.

### Claude's discretion (proposed for the planner; the owner may override)
- Table, column and route names, the internal port names and the audit action codes (within the AuditEntry rules).
- Numeric tuning that no requirement fixes: grace window, response-time floor, per-IP limits and the cross-ticket cap. Proposed values are under AD-5.

### Deferred / out of scope
- SMS or authenticator-app second factor (AUTH-V2-01; keep the `ISecondFactorDelivery` seam only).
- Profile page and user management (Phase 5). C-4 and C-9 are ruled here but applied in Phase 5.
- CI, staging deploy, ZAP/CodeQL and Dependabot (Phase 3).
- The audit-log viewer (Phase 5, AUDIT-02).
- Purge jobs for idempotency rows, outbox rows and old audit rows (JOB-01, a later phase).
- HSTS `includeSubDomains` (WR-07) and forwarded headers (gated on Phase 3 host facts).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (short) | Research Support |
|----|---------------------|------------------|
| AUTH-01 | Email + password; one generic error; similar timing | Pattern 3 (UserManager + dummy hash + response floor; **not** SignInManager), Pitfall 1, timing tests in Validation |
| AUTH-02 | Mandatory emailed 6-digit code bound to a pending-login ticket cookie + user | Pattern 4 (ticket cookie, HMAC-bound code), Pattern 9 (outbox) |
| AUTH-03 | 15 min, single use, 5 wrong tries, HMAC-SHA256 + fixed-time compare, cross-ticket cap | Pattern 4, Code Example 3, AD-5 |
| AUTH-04 | Resend after 60 s, max 5/hour/account, new code kills old | Pattern 4 (code rows superseded; DB-counted sends) |
| AUTH-05 | 90-day persistent vs browser-session ≤12 h; 15-min in-memory access token; hashed, rotated refresh cookie at `/api/v1/auth` + anti-CSRF header | Patterns 5–6, C-19, C-23, Pitfall 3 (session restore) |
| AUTH-06 | Sign out, sign out everywhere, reuse revokes the family, grace for tabs | Pattern 5 (rotation rules R1–R5, per-request `sid` check), Pattern 14 (Web Locks) |
| AUTH-07 | 5 failed passwords → 15-min lock + email | Pattern 3 (Identity lockout via UserManager, one email per lockout) |
| AUTH-08 | Reset by email; "If an account exists…"; hashed 30-min single-use token | Pattern 8 (AccountTokens table; link in URL fragment), C-7 |
| AUTH-09 | Reset enforces policy, revokes all sessions, sends "password changed" | Patterns 5, 7, 8 |
| AUTH-10 | Deactivated/locked users can't sign in, refresh or reset into a session | Patterns 3, 5 (refresh checks user state), 8 |
| AUTH-11 | NIST policy, HIBP k-anonymity, no email/name, strength meter, accessible errors | Pattern 7, C-5, C-33, AD-6 |
| AUTH-12 | `bootstrap-manager` CLI on an empty DB | Pattern 13 |
| AUTH-13 | Outbox → `IEmailSender` → TLS SMTP from the business domain; no secrets beyond the code or link | Pattern 9, OD-12 |
| QUAL-05 | Testing-only email sink; test proves it's absent from Release | Pattern 9c, AD-3 |
| SEC-03 | Per-IP + per-account rate limits; JSON 1 MB body limit; page/search caps | Pattern 11 |
| SEC-06 | Idempotency-Key on every state-changing POST (400/409/422, 24 h, discovery test, allow-list) | Pattern 10, AD-7 |
| A11Y-03 | Paste allowed, autocomplete set, no cognitive puzzles | Pattern 14d |
| AUDIT-01 | Auth events in the append-only audit log | Pattern 12 (catalog + WR-02/03/05/06 fixes) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives come from the root `CLAUDE.md` and `.claude/CLAUDE.md`. The planner must verify each plan against them.

- **Shared machine:**
  - Never use ports 5173, 5023 or 5099.
  - Avoid 49152–65535.
  - Run preflight before a dev server, Playwright or a full test run, and never kill another project's processes.
  - Set env vars per process only.
  - Never touch `BetsLLC_*` databases or `C:\Work\TheBETSLLC`.
  - Cleanup may drop only `^CSPS_Test_[0-9a-f-]{36}$`.
- **No Docker or Testcontainers locally.** `CSPS_TEST_SQL=localdb` per process.
- **Forbidden packages:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, **`FluentValidation.AspNetCore`**, SpaProxy and Serilog DB sinks.
- **Onion** Domain ← Application ← Infrastructure ← Server, enforced by ArchUnitNET. Application may reference only Domain, `Microsoft.Extensions.*.Abstractions` and FluentValidation (PRD §3.2), and **never MailKit, EF Core, ASP.NET Core or Identity**.
- **No mediator.** One handler per use case, manual mapping, and `Result<T>` → RFC 9457 ProblemDetails.
- **UTC + `TimeProvider`.** `DateTime.Now/UtcNow/Today` and `DateTimeOffset.Now/UtcNow` are banned by `BannedSymbols.txt`, as is `System.Random`.
- **Quality:**
  - TDD (red → green → refactor).
  - **Zero warnings** in build, analyzers, lint, types, tests and the browser console.
  - Coverage: Domain 100% line + branch, Application ≥95% line, `core/api` 100%, web ≥90%.
  - The authorization matrix covers every endpoint × {anonymous, Admin, Manager}.
- **Security:**
  - Strict CSP (no `unsafe-inline`/`unsafe-eval`).
  - Default-deny.
  - Append-only audit.
  - No secrets in git.
  - CWE Top 25 review per phase.
- **A11y** WCAG 2.2 AA with zero axe violations. **Perf** budgets: public JS ≤150 KB gz, admin ≤250 KB gz, CSS ≤35 KB gz.
- **Workflow:** `/gsd-plan-phase 4 --tdd`. `/gsd-ui-phase 4` is needed (UI hint yes; C-17 spec-gap screens). Run `/gsd-secure-phase 4` and `/gsd-ui-review 4` before ship.
- **Every new or edited `.md`** gets `created:`/`updated:` ISO timestamps with a `-05:00` offset (user memory).

## Summary

Phase 4 is the largest security surface in the project. Almost all of it is server work that the codebase does not have yet:

- no Identity tables
- no controllers (only Minimal API endpoints exist)
- no rate limiter, outbox, MailKit, idempotency store or token issuance

Phase 1 left good seams: default-deny policies `Staff`/`Manager`, an authorization-matrix test, `IAuditTrail`, `IRequestContext`, `Result<T>` → ProblemDetails, Data Protection in the DB, and a `TestTokens` minting helper. It also left **four open review findings that become live bugs the moment Phase 4 writes audit rows or logs Identity objects**:

- WR-02: IpPrefix 6to4
- WR-03: AuditTrail flushes the whole DbContext
- WR-05: the log masker misses `PasswordHash`/`SecurityStamp`
- WR-06: the correlation-id fallback throws in `AuditEntry.Create`

IN-04 (`typ: at+jwt`) and IN-06 (links built from the Host header) are also Phase 4 work.

**The single most important new finding is a blocker that predates the phase.** On **2026-10-13**, Microsoft shipped .NET **10.0.13**, a security release with 40+ CVEs. Advisories GHSA-846f-f764-76mx (High) and GHSA-2fmv-rv2c-59x7 now flag `System.Security.Cryptography.Pkcs` 9.0.11 and 10.0.12, and three High advisories flag `System.Security.Cryptography.Xml` 10.0.12. Both packages are already in this repo's restore graph. `dotnet list package --vulnerable` reports them today in `Csps.Infrastructure`, `Csps.Server`, `Csps.DevSeed` and four test projects. With `NuGetAuditLevel=low` and `TreatWarningsAsErrors`, the next forced restore fails the build. MailKit's MimeKit also pulls `System.Security.Cryptography.Pkcs` 10.0.0. **Wave 0 must apply the 10.0.13 security update** as a recorded cool-down exception that the owner approves (AD-1).

The design that falls out of the requirements, the codebase and the sources:

- **Identity:** `AddIdentityCore` on `CspsDbContext`, with the Identity schema pinned to **`IdentitySchemaVersions.Version2`**. Version3 maps passkey data with `ComplexProperty(...).ToJson()`, a JSON column that D-13 forbids.
- **Password checks:** use **`UserManager` directly, never `SignInManager.CheckPasswordSignInAsync`**. SignInManager returns `LockedOut` *before* hashing, which leaks timing (CWE-204). Unknown emails run a dummy PBKDF2 verification, and every sign-in and forgot-password response waits until a fixed floor.
- **Sessions:** a `UserSession` (family, `sid`) plus single-use hashed refresh tokens. Rotation allows a 30 s grace period that issues a sibling token, which covers both concurrent tabs and lost responses. Every bearer request checks `sid` (HybridCache, evicted on revoke) so sign-out is immediate.
- **Email:** every email goes through a DB outbox in the same transaction, with the payload Data-Protection-encrypted and scrubbed after sending. An in-process dispatcher sends it with MailKit `StartTls`.
- **Idempotency:** an `Idempotency-Key` middleware that by default covers every POST not on an attributed allow-list.
- **Rate limiting:** the built-in limiter per IP (prefix-partitioned), plus DB-backed per-account counters.
- **Web:** gets RHF + zod (first real forms), MSW 3, a guarded admin route tree (reversing D-20) and cross-tab refresh serialization through the Web Locks API.

**Primary recommendation:** Plan Wave 0 as follows:

1. The 10.0.13 security bump.
2. Owner approval of the new packages.
3. The inherited WR fixes (02/03/05/06, IN-04).
4. The controllers infrastructure: `AddControllers`, the empty-body pattern, and the matrix test accepting controller route keys.

Only after that, build the auth vertical slice test-first: domain state machines first (100% coverage), then handlers, then endpoints, then UI.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password policy rules (length in code points, contains name/email) | Domain (pure) | Browser (UX preview, meter) | Rules must be 100%-tested and identical server-side; the browser only previews |
| 2FA challenge state machine (expiry, attempts, resend cooldown, supersede) | Domain | Database (rows) | Pure rules with `now` passed in → 100% coverage, no clock statics |
| Refresh-family rotation / grace / reuse rules | Domain | Database | Same; security-critical branching |
| Password hashing, lockout counters, users/roles | Infrastructure (Identity over EF) | — | PRD §3.3: `ApplicationUser : IdentityUser<Guid>` lives in Infrastructure |
| Use cases (sign in, verify, resend, refresh, sign out, forgot, reset, bootstrap) | Application handlers | — | One handler per use case; ports only |
| HIBP range lookup, SMTP send, outbox dispatch | Infrastructure | — | External I/O behind ports (`IPwnedPasswords`, `IEmailTransport`) |
| Access-token issue + validation, cookies, anti-CSRF check, rate limiter, idempotency middleware | API / Backend (Server) | — | HTTP concerns; Server already owns JwtBearer and `HttpRequestContext` (precedent: Server implements `IRequestContext`) |
| Per-request session (`sid`) validity | API (JwtBearer `OnTokenValidated`) | Infrastructure (HybridCache + DB) | Immediate sign-out needs a server check per request |
| Access token storage | Browser (memory only) | — | PRD §8.1: never `localStorage` |
| Refresh token storage | Browser (HttpOnly cookie, not readable by JS) | API sets it | CWE-352/539 |
| Cross-tab refresh serialization | Browser (Web Locks) | API (grace window as backstop) | Tabs share the cookie jar; server grace covers what the client can't |
| Route guard / redirect to sign-in | Browser (React Router loader) | API (401) | UI only hides; server enforces (PRD §4) |

## Wave 0 Blockers (must land before feature work)

1. **October 2026 .NET security release (AD-1).** 10.0.13 shipped on 2026-10-13 and fixes CVE-2026-84008 and others. `[VERIFIED: builds.dotnet.microsoft.com 10.0/releases.json; api.github.com/advisories/GHSA-846f-f764-76mx]`
   - Bump every `Microsoft.*` pin of `10.0.12` to `10.0.13`. That covers EF Core SqlServer and Design, DataProtection.EntityFrameworkCore, Authentication.JwtBearer, OpenApi, Mvc.Testing, and the new Identity.EntityFrameworkCore.
   - Add a transitive pin `System.Security.Cryptography.Pkcs` `10.0.13`, and `System.Security.Cryptography.Xml` `10.0.13` where it is not pruned.
   - Install the 10.0.13 runtime and SDK 10.0.402 locally. `global.json` with `rollForward: latestPatch` accepts 10.0.402 without an edit, because the pinned version is `"10.0.401"`. `[VERIFIED: global.json:3-4]`
   - Re-run `dotnet list package --vulnerable --include-transitive` until it is clean.
   - The host runtime must also be 10.0.13. The Phase 3 first deploy verifies it, and the self-contained fallback applies if the host lags.
   - Record the reason as "security fix skips the 14-day cool-down" in `docs/dependencies.json`. The owner must approve it.
2. **Inherited review fixes, before the first audit write:** WR-02, WR-03, WR-05, WR-06 and IN-04 (details in "Inherited Review Items").
3. **Controllers infrastructure:**
   - `AddControllers()` with `ConfigureApiBehaviorOptions(o => o.SuppressModelStateInvalidFilter = true)`, and `MapControllers()`.
   - A proof that a controller returning the existing `IResult` from `ResultHttpExtensions` writes the CSPS ProblemDetails.
   - The authorization matrix must accept the controller route-pattern keys (Pitfall 9).
   - Refresh the OpenAPI snapshot and the generated TS types (the 02-15 drift chain).
4. **Owner approvals:** the new package list (Standard Stack) and the security-batch decisions. Email delivery is a hard dependency for sign-in (STATE.md:307).

## Standard Stack

### Core (.NET, new in this phase)

| Library | Version to pin | Published | Purpose | Why standard |
|---------|---------------|-----------|---------|--------------|
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | **10.0.13** (security release; 10.0.12 is the newest aged one) | 2026-10-13 | Users, roles, PBKDF2 hashing, lockout, EF stores | PRD §2/§8.3; MIT `[VERIFIED: nuget.org registration + nuspec]` |
| FluentValidation | **12.1.1** (12.2.0 of 2026-10-10 is inside the cool-down) | 2025-12-03 | Command validators in Application | PRD §2; Apache-2.0; `FluentValidation.AspNetCore` stays forbidden `[VERIFIED: nuget.org]` |
| MailKit | **4.18.1** | 2026-09-27 (17 days old, aged) | SMTP client (STARTTLS/SSL) | PRD §2; MIT; replaces the obsolete `SmtpClient`; advisory GHSA-9j88 affects only `<4.16.0` `[VERIFIED: nuget.org + vuln DB]` |
| MimeKit (transitive of MailKit, pin it) | **4.18.1** | 2026-09-19 | MIME message building | MIT; advisories only ≤4.15.0 `[VERIFIED]` |
| BouncyCastle.Cryptography (transitive of MimeKit) | 2.7.0 | 2026-07-30 | Crypto used by MimeKit | MIT; advisories only `<2.3.1` `[VERIFIED: nuspec + vuln DB]` |
| Microsoft.Extensions.Http.Resilience | **10.10.0** (10.11.0 published today) | 2026-09-09 | Timeout/retry for the HIBP `HttpClient` | MIT; STACK.md choice `[VERIFIED]` |

Built in (no package): `AddRateLimiter`/`[EnableRateLimiting]`, `HybridCache` (already pinned 10.10.0), `JsonWebTokenHandler` (transitive `Microsoft.IdentityModel.JsonWebTokens` 8.19.2 through JwtBearer; issue tokens in **Server**, so no new direct reference is needed) `[VERIFIED: src/Csps.Server/packages.lock.json]`, `RandomNumberGenerator`, `HMACSHA256`, `SHA256`, `SHA1` (HIBP only), `CryptographicOperations.FixedTimeEquals`, `IDataProtector`, `BackgroundService`, `System.Threading.Channels`.

### Supporting (tests)

| Library | Version | Published | Purpose |
|---------|---------|-----------|---------|
| Microsoft.Extensions.Diagnostics.Testing | **10.10.0** | 2026-09-09 | `FakeLogger` proves no codes, tokens or passwords appear in logs (CWE-532). MIT `[VERIFIED]` |
| (existing) Microsoft.Extensions.TimeProvider.Testing 10.10.0, NSubstitute, Shouldly, Respawn | — | — | `FakeTimeProvider` for every expiry, cooldown, grace and floor rule |

### Web (first real forms in the app)

| Package | Version (newest aged ≥14 days on 2026-10-14) | Published | License | Purpose |
|---------|------|-----------|---------|---------|
| react-hook-form | **7.89.0** (7.90.0 is inside the cool-down) | 2026-09-26 | MIT | Form state (CLAUDE.md stack) |
| zod | **4.6.5** (4.6.6 and 4.6.7 are inside the cool-down) | 2026-09-13 | MIT | Client UX validation mirroring the validators |
| @hookform/resolvers | **5.9.1** | 2026-08-17 | MIT | zod ↔ RHF bridge (peer `react-hook-form ^7.55.0`, `zod ^3.25.0 \|\| ^4.0.0`) |
| msw | **3.0.1** (exactly 14 days old today; 3.0.2 and 3.0.3 are too new) | 2026-09-30 | MIT | `msw/node` component tests of the module services, `siteSettingsService.ts` now and `authService.ts` next (Phase 2 deferred MSW to "the first phase with real endpoints"). Engines `node >=22.12.0`, peer `typescript >=5.9.x` |

`[VERIFIED: npm registry time/license/peerDependencies; npm bulk advisory endpoint returned {} for these four versions]`. At install time, re-pick the newest version that is at least 14 days old and get the owner's OK (user memory).

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Custom refresh families | Identity `MapIdentityApi` bearer tokens | Forbidden (opaque tokens, no email 2FA, no families) |
| Custom `AccountTokens` table for reset | Identity `DataProtectorTokenProvider` (stateless) | Stateless tokens aren't "stored hashed", can't be listed or revoked per request, and their single-use relies on a security-stamp change. The requirement text asks for a hashed, single-use token, and Phase 5 needs the same machinery for invites (C-4) and email change (C-9) |
| zxcvbn strength meter | In-house length-based meter | zxcvbn is about 400 KB+ (it busts the admin budget) and rewards composition, which conflicts with NIST. The server is the authority |
| `zod` full | `zod/mini` | Smaller bundle; use it only if the admin budget gets tight (STACK.md note) |
| RHF | Plain `useSubmission` + local state | The project stack names RHF + zod; later phases need complex forms |

**Installation (after owner approval):**
```bash
# .NET: add <PackageVersion> pins in Directory.Packages.props, then <PackageReference> in the owning project
# Infrastructure: Microsoft.AspNetCore.Identity.EntityFrameworkCore, MailKit, Microsoft.Extensions.Http.Resilience
# Application:    FluentValidation
# Tests:          Microsoft.Extensions.Diagnostics.Testing
npm --prefix web install --save-exact react-hook-form@7.89.0 zod@4.6.5 @hookform/resolvers@5.9.1
npm --prefix web install --save-exact --save-dev msw@3.0.1
```

## Package Legitimacy Audit

| Package | Registry | Age (pinned version) | Downloads | Source repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.13 | NuGet | 1 day (security release) | 293.7M total, verified owner | github.com/dotnet/dotnet | OK (Microsoft, verified prefix) | Approve with recorded security exception (AD-1) |
| FluentValidation 12.1.1 | NuGet | 10 months | 1.07B total, verified | github.com/JeremySkinner/fluentvalidation | OK | Approved pending owner OK |
| MailKit 4.18.1 (+ MimeKit 4.18.1, BouncyCastle.Cryptography 2.7.0) | NuGet | 17 / 25 days / 2.5 months | 271M total, verified | github.com/jstedfast/MailKit | OK | Approved pending owner OK; pin MimeKit explicitly |
| Microsoft.Extensions.Http.Resilience 10.10.0 | NuGet | 35 days | 158M total, verified | github.com/dotnet/extensions | OK | Approved pending owner OK |
| Microsoft.Extensions.Diagnostics.Testing 10.10.0 | NuGet | 35 days | 17.8M total, verified | github.com/dotnet/extensions | OK | Test-only; approved pending owner OK |
| react-hook-form 7.89.0 | npm | 18 days | 53.7M/wk | github.com/react-hook-form/react-hook-form | SUS (seam: "too-new", "unknown-downloads"; both refer to the *latest* tag and an unreachable downloads API, not this pin) | `react-hook-form` [WARNING: flagged as suspicious — verify before using.] Planner adds `checkpoint:human-verify` (it coincides with the owner package approval) |
| zod 4.6.5 | npm | 31 days | 346.9M/wk | github.com/colinhacks/zod | SUS (same reasons) | `zod` [WARNING: flagged as suspicious — verify before using.] checkpoint |
| @hookform/resolvers 5.9.1 | npm | 58 days | 43.9M/wk | github.com/react-hook-form/resolvers | SUS ("unknown-downloads") | `@hookform/resolvers` [WARNING: flagged as suspicious — verify before using.] checkpoint |
| msw 3.0.1 | npm | 14 days | 23.0M/wk | github.com/mswjs/msw | SUS (same reasons) | `msw` [WARNING: flagged as suspicious — verify before using.] checkpoint; dev-only |

`gsd-tools query package-legitimacy check` supports npm, PyPI and crates only. The NuGet rows were checked by hand through the registration, flat-container nuspec, search and vulnerability APIs. `npm view <pkg> scripts.postinstall` printed nothing for all four npm packages, so they have no postinstall script.
**Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** react-hook-form, zod, @hookform/resolvers, msw (registry facts are clean; the flags come from the seam's latest-tag age and download heuristics). The owner-approval checkpoint covers them.

## Architecture Patterns

### System Architecture Diagram

```
 Browser (React, /admin/*)                         ASP.NET Core 10 (Csps.Server, IIS in-process)
 ─────────────────────────                         ──────────────────────────────────────────────
 SignInPage ──POST /auth/sign-in {email,pw,keep}──▶ RateLimiter(per-IP prefix) ─▶ AuthController.SignIn
                                                       │ (sign-in is idempotency-EXEMPT)
                                                       ▼
                                          SignInHandler ──▶ IUserAccounts (UserManager): find by email
                                            │  unknown ─▶ dummy PBKDF2 verify ┐
                                            │  locked/deactivated ─▶ real verify, no lockout++ ├─▶ audit auth.sign-in-failed
                                            │  wrong pw ─▶ AccessFailed (lockout at 5 ─▶ outbox "locked" mail)┘
                                            │  ok ─▶ TwoFactorChallenge(ticket, code HMAC) + outbox "code" mail
                                            ▼          (one SaveChanges: challenge + outbox + audit)
                                   await response floor (TimeProvider) ─▶ 401 generic | 200 + Set-Cookie __Secure-csps_2fa
 OtpPage ──POST /auth/two-factor/verify {code} + ticket cookie──▶ VerifyHandler ─▶ challenge rules (Domain)
                                            │ ok ─▶ UserSession(sid, persistent?) + RefreshToken(hash) ─▶ JWT(at+jwt, sub, role, sid, jti)
                                            ▼
 memory: accessToken ◀── 200 {accessToken, user} + Set-Cookie __Secure-csps_rt (Path=/api/v1/auth)
 any API call ──Authorization: Bearer──▶ JwtBearer validate ─▶ OnTokenValidated: sid active? (HybridCache ▸ DB) ─▶ policy
 401 ─▶ httpClient.refresh() ─▶ navigator.locks('csps-refresh') ─▶ POST /auth/refresh (cookie + X-CSPS-CSRF)
                                            ▼  RefreshHandler: rotate (R1) | grace sibling (R2) | reuse ⇒ revoke family (R3)
 Forgot/Reset pages ──POST (Idempotency-Key)──▶ IdempotencyMiddleware(txn + applock) ─▶ handler ─▶ AccountTokens + outbox
                                                                                       ▼
 Outbox rows (DP-encrypted body) ──Channel signal + 30 s sweep──▶ EmailDispatcher (BackgroundService)
        ─▶ IEmailTransport: MailKit SMTP StartTls (Production/Development) | InMemorySink (Testing, Debug builds only)
 AuditLog (append-only) ◀── every auth event (no secrets, user id only, /24 /48 IP, UA family)
```

### Recommended Project Structure (additions)

```
src/Csps.Domain/Identity/          PasswordPolicy, TwoFactorChallenge(+Code), UserSession, RefreshToken, AccountToken (pure rules)
src/Csps.Application/Auth/         SignInHandler, VerifyCodeHandler, ResendCodeHandler, RefreshHandler, SignOutHandler,
                                   SignOutEverywhereHandler, ForgotPasswordHandler, ResetPasswordHandler, BootstrapManagerHandler, validators, DTOs
src/Csps.Application/Ports/        IUserAccounts, ISessionStore, ITwoFactorStore, IAccountTokenStore, IEmailSender (enqueue),
                                   IPwnedPasswords, ISecretHasher (HMAC), ISecureRandom, IAccessTokenIssuer, IAuditTrail (Record)
src/Csps.Infrastructure/Identity/  ApplicationUser, IdentityRegistration, UserAccounts (UserManager), stores (EF)
src/Csps.Infrastructure/Email/     OutboxEmailSender, EmailDispatcher (BackgroundService), MailKitTransport, InMemoryEmailSink(#if)
src/Csps.Infrastructure/Passwords/ HibpPwnedPasswords (typed HttpClient + resilience), CommonPasswordFloor (embedded list, AD/C-33)
src/Csps.Infrastructure/Idempotency/ IdempotencyRecord config + store
src/Csps.Server/Controllers/       AuthController (one per resource), TestingEmailsController (#if, Testing env only)
src/Csps.Server/Security/          AccessTokenIssuer (JsonWebTokenHandler), SessionValidation (OnTokenValidated), AuthCookies,
                                   CsrfHeaderFilter, RateLimitingRegistration, IdempotencyMiddleware + attributes
tools/Csps.BootstrapManager/       CLI (Pattern 13)
web/src/modules/admin/pages/       SignInPage, VerifyCodePage, ForgotPasswordPage, ResetPasswordPage, SessionsPage
web/src/modules/admin/components/  SignOutOthersDialog, SignOutDeviceDialog, the device summary formatter
web/src/modules/admin/services/    authService.ts (the auth calls), session.ts (registers refresh/onUnauthorized on the shared client)
web/src/modules/admin/             guard.ts, authCopy.ts (AUTH_COPY)
web/src/layouts/AuthLayout.tsx
```

### Pattern 1: Controllers with suppressed automatic 400 and a null-tolerant body

**What:** `[ApiController]` infers `[FromBody]`. With `SuppressModelStateInvalidFilter = true`, an empty or malformed JSON body leaves the parameter `null`, and the action still runs. **Rule:** the action passes `dto ?? XxxRequest.Empty` to the handler, and the FluentValidation validator reports the missing fields as a 400. No logic goes in the controller. Use `[FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)]` so an empty body isn't a binding error. `[ASSUMED]`
**When:** every POST/PUT action.
**Also:** MVC uses `Microsoft.AspNetCore.Mvc.JsonOptions`, not the Minimal API `Http.Json.JsonOptions`. Keep both at the defaults (camelCase) or configure both. `[ASSUMED]`
**Returning results:** controllers can return `IResult`/`TypedResults` since .NET 7, so the existing `ResultHttpExtensions.ToHttpResult` can be reused. Prove it in Wave 0 with one test asserting `application/problem+json` and the `traceId`. `[CITED: secondary sources startdebugging.net; not found on learn.microsoft.com this session]`

### Pattern 2: Identity on `AddIdentityCore` with schema Version2

```csharp
// Infrastructure/Identity/IdentityRegistration.cs  [ASSUMED API shape; CITED behaviour below]
services.AddIdentityCore<ApplicationUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.SignIn.RequireConfirmedEmail = true;          // PRD §8.3 (bootstrap user is created confirmed)
        o.Lockout.MaxFailedAccessAttempts = 5;          // AUTH-07
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        o.Lockout.AllowedForNewUsers = true;
        o.Password.RequiredLength = 12;                 // policy itself is enforced by the custom validator (Pattern 7)
        o.Password.RequireDigit = o.Password.RequireLowercase = o.Password.RequireUppercase
            = o.Password.RequireNonAlphanumeric = false; // NIST: no composition rules
        o.Password.RequiredUniqueChars = 1;
        o.Stores.SchemaVersion = IdentitySchemaVersions.Version2; // NEVER Version3 (ToJson passkeys)
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<CspsDbContext>();
// no AddDefaultTokenProviders (custom AccountTokens), no AddSignInManager (timing leak, Pattern 3)
```

- **Schema version:** with no store options the schema defaults to `IdentitySchemaVersions.Version1`. Version3 maps `b.ComplexProperty(p => p.Data).ToJson();` on `AspNetUserPasskeys`, which is a JSON column. Version2 differs from Version1 only by a "maxKeyLength defaults to 128" and "PhoneNumber has a 256 max length". Both ignore passkeys. `[CITED: source.dot.net IdentityUserContext.cs]`
- **Email uniqueness:** `EmailIndex` on `NormalizedEmail` is **not unique** (`b.HasIndex(u => u.NormalizedEmail).HasDatabaseName("EmailIndex");`), while `UserNameIndex` is unique. Keep `UserName == Email` *and* add a unique filtered index on `NormalizedEmail`, so two concurrent creates can't race past `RequireUniqueEmail`. `[CITED: source.dot.net IdentityUserContext.cs]`
- **DbContext:** `CspsDbContext` changes from `DbContext` to `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>`. It keeps `IDataProtectionKeyContext`, and `OnModelCreating` must call `base.OnModelCreating(modelBuilder)` before `ApplyConfigurationsFromAssembly`. Today it is `public sealed class CspsDbContext(DbContextOptions<CspsDbContext> options) : DbContext(options), IDataProtectionKeyContext`. `[VERIFIED: src/Csps.Infrastructure/Persistence/CspsDbContext.cs:14]`
- **ApplicationUser (Infrastructure):** `FirstName`/`LastName` (nvarchar(100)) and `IsActive` (bit, default 1). Phase 5 adds the SEC-08 columns. Seed the roles `Admin`/`Manager` in the migration with `HasData`, using fixed Ids and fixed `ConcurrencyStamp`s (they are schema-level reference data, not dev seed). The role names are verbatim from `Roles.cs`: `public const string Admin = "Admin";` and `public const string Manager = "Manager";`. `[VERIFIED: src/Csps.Application/Security/Roles.cs:7,10]`
- **Password hashing:** stays at the Identity default. `IterationCount` "Default is 100,000", the V3 format is "PBKDF2 with HMAC-SHA512, 128-bit salt, 256-bit subkey, 100000 iterations", and a lower embedded count returns `SuccessRehashNeeded`. Handle that result by re-hashing. `[CITED: source.dot.net PasswordHasherOptions.cs, PasswordHasher.cs]`

### Pattern 3: Sign-in with timing parity (AUTH-01/07/10, CWE-204/307)

- **Never use `SignInManager.CheckPasswordSignInAsync`.** Its `PreSignInCheck` runs `if (await IsLockedOut(user))` → `return await LockedOut(user);` **before** `UserManager.CheckPasswordAsync`, so a locked account answers without hashing. That is a timing oracle. `[CITED: source.dot.net SignInManager.cs]` (This overrides `.planning/research/ARCHITECTURE.md:180`, which suggested SignInManager.)
- **The handler does the same expensive work on every branch:**
  - Unknown email → `PasswordHasher.VerifyHashedPassword(dummyUser, DummyHash, password)`. `DummyHash` is computed once at startup from random bytes.
  - Locked, deactivated or unconfirmed → verify the real hash, and **don't** increment `AccessFailedCount` (a locked account is not "more locked"). Return generic failure.
  - Wrong password → `AccessFailedAsync`. When that call flips the user into lockout, enqueue **one** "account locked" email and audit `auth.lockout`.
  - Correct password → `ResetAccessFailedCountAsync`, create the challenge, enqueue the code email.
- **Response floor:** after the work, `await Task.Delay(floor - elapsed, timeProvider)`. That makes every branch, success included, take at least `floor` (proposed 500 ms, AD-5). With `FakeTimeProvider`, a unit test proves every branch completes at the same fake instant. `[ASSUMED]`
- **Error shape:** a single 401 ProblemDetails, "Email or password is incorrect." (AUTH-01 text) or the C-8 ruling. `ErrorKind` has no 401 today. The members are `Validation`, `NotFound`, `Conflict`, `BusinessRule` and `Forbidden`. `[VERIFIED: src/Csps.Domain/Common/ErrorKind.cs:7-19]` Add `Unauthenticated` (401) and `TooManyRequests` (429, with an optional retry-after) to `ErrorKind` and the one mapping switch. Domain coverage must stay at 100%.
- **Identity auto-saves:** `UserManager` methods `AccessFailedAsync`, `UpdateAsync` and similar call `SaveChanges` on the shared scoped context (UserStore `AutoSaveChanges`). Anything tracked at that moment commits with it. Order the handler so tracked entities are complete before any `UserManager` mutation. `[ASSUMED]`

### Pattern 4: Emailed 6-digit code (AUTH-02/03/04)

- **Ticket:** 32 bytes from `RandomNumberGenerator`, base64url, sent in the cookie `__Secure-csps_2fa` (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=900`). The DB stores only the SHA-256 of the ticket. The `TwoFactorChallenge` row holds UserId, TicketHash, `RememberMe` (captured at sign-in), CreatedAt, an absolute ExpiresAt (proposed 30 min), Consumed/Invalidated.
- **Code:** `RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", CultureInfo.InvariantCulture)` (PRD §8.2). Each issuance is its own `TwoFactorCode` row: ChallengeId, `CodeMac = HMACSHA256(key, ticketId ‖ userId ‖ code)`, IssuedAt, ExpiresAt = IssuedAt + 15 min, FailedAttempts (≤5), SupersededAt, ConsumedAt. Compare with `CryptographicOperations.FixedTimeEquals`. The HMAC key is a new secret, `Auth:CodeMacKey` (≥32 bytes, user-secrets in Development, host settings in Production). Initialize-DevSecrets must write it **through stdin** (IN-02 lesson).
- **Resend:** refuse if the last issue was less than 60 s ago, or if the account already has 5 or more code rows issued in the last rolling hour (counted across challenges in the DB, so the count survives a recycle). Otherwise supersede the active code and issue a new one. The refusal returns 429 with Retry-After seconds. The UI shows a countdown, and the outcome is the same whatever the account state.
- **Cross-ticket cap:** if the account has 10 or more failed code attempts in the rolling hour across all challenges (proposed, AD-5), invalidate every open challenge, put the account in Identity lockout (15 min) and send the lockout email once. This closes the "sign in again to get 5 fresh guesses" loop. Without it, an attacker who knows the password gets 5 guesses per ticket, unbounded. `[CITED: .planning/research/PITFALLS.md:259]`
- **State machine in Domain** (pure; `now` passed in): `Verify(code, now)` → Ok | Wrong(remaining) | Exhausted | Expired | Superseded. 100% branch coverage.
- **Audit:** `auth.2fa-issued`, `auth.2fa-resent`, `auth.2fa-verified`, `auth.2fa-failed`, `auth.2fa-exhausted`. The code never appears in the audit, logs or URLs.

### Pattern 5: Sessions, access tokens, refresh families (AUTH-05/06/09/10)

- **Access token:** HS256 through `JsonWebTokenHandler`, issued in Server next to the existing validation so key, iss and aud stay in one place.
  - Claims: `sub`, `role`, `sid`, `jti`, `iat`, `nbf`, `exp` (15 min), `iss`, `aud`.
  - Header `typ: at+jwt`, with `ValidTypes = ["at+jwt"]` added to `TokenValidationParameters` (IN-04).
  - The existing validator already uses the claim names `"sub"`/`"role"` and `ClockSkew = TimeSpan.FromSeconds(30)`. `[VERIFIED: src/Csps.Server/Composition/SecurityRegistration.cs:16,19,22]`
  - `TestTokens` must add `sid` and `typ`. `[ASSUMED: SecurityTokenDescriptor.TokenType sets typ]`
- **`UserSession`** (= the refresh family, `sid`): Id, UserId, Persistent, CreatedAt, AbsoluteExpiresAt (90 d persistent, or 12 h), RevokedAt and RevokedReason, UA family, IP prefix. **Rotation never extends AbsoluteExpiresAt.**
- **`RefreshToken`:** Id, SessionId, ParentId, TokenHash (SHA-256 of 32 random bytes; unique index), IssuedAt, ConsumedAt, RevokedAt.
- **Rotation rules** (Domain, pure):
  - **R1:** a live, unconsumed token on an active session → consume it, issue a child and set the cookie. Revoke any *other* unconsumed leaves of the session that were issued more than G ago (stale siblings).
  - **R2:** a consumed token, with `now − ConsumedAt ≤ G` (grace, proposed 30 s) → issue a **sibling** child and set the cookie. This covers two tabs refreshing at once **and** a lost response on a flaky phone network. A design that only returns an access token in the grace window breaks the lost-response case: the jar keeps the consumed token and the next refresh trips reuse. Cap the siblings per parent (proposed 5).
  - **R3:** a consumed token outside G, or a revoked token → **reuse** → revoke the whole session, audit `auth.refresh-reuse-detected`, return 401 and clear the cookie.
  - **R4:** session expired or revoked, or the user deactivated or locked → 401, clear the cookie, revoke (AUTH-10).
  - **R5:** a persistent session sets the cookie `Expires = AbsoluteExpiresAt`. A non-persistent one sets **no** Expires/Max-Age (a session cookie), and the 12 h server cap still applies.
  `[CITED: .planning/research/PITFALLS.md:204-220 (grace window idea); sibling/stale-leaf rules ASSUMED]`
- **Immediate sign-out:** register `JwtBearerEvents.OnTokenValidated` → `ISessionValidator.IsActiveAsync(sid)` → HybridCache (key `csps:session:{sid}`, local TTL ≤60 s, tag `user:{id}`) over `IDbContextFactory` (**not** the scoped context; that is WR-01's bug). Revocation calls `RemoveAsync` / `RemoveByTagAsync`, so in a single process the next request is refused at once. This also serves Phase 5's "role change signs the user out at once". `[ASSUMED]`
- **Sign out:** revoke the session from the cookie and clear the cookie. **Sign out everywhere** (Staff policy): revoke every session of `sub` and clear the cookie. **Password reset:** revoke all sessions (AUTH-09). Audit `auth.signed-out` and `auth.sessions-revoked`.

### Pattern 6: Cookies and anti-CSRF

- **Refresh cookie:** `__Secure-csps_rt; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict` (subject to C-23). A `__Host-` prefix requires `Path=/` and no Domain, so with `Path=/api/v1/auth` the browser drops it silently. `[CITED: .planning/research/PITFALLS.md:229 (MDN)]`
- **Cookies ignore ports.** TheBETSLLC's app on `localhost:5173` shares the cookie jar of `localhost`, so every CSPS cookie name carries the `csps_` stem. `[ASSUMED: RFC 6265 cookies are host-scoped, not port-scoped]`
- **Anti-CSRF on refresh and sign-out:** require the custom header `X-CSPS-CSRF: 1`. A cross-origin page can't send it without a CORS preflight, and CORS stays disabled. Also reject `Sec-Fetch-Site` values other than `same-origin` when the header is present (Safari ≥16.4, Chrome ≥76, Firefox ≥90 send it). Treat a missing header as an older or non-browser client. `[CITED: caniuse / MDN Sec-Fetch-Site]`
- **Headers:** every `/api/v1/auth/*` response sends `Cache-Control: no-store`.

### Pattern 7: Password policy (AUTH-11, NIST SP 800-63B-4)

- **NIST SP 800-63B-4 §3.1.1.2 (normative):**
  - "minimum of 15 characters" when single-factor, and "minimum of eight characters" when only used in MFA. The project's 12 is above the MFA minimum.
  - "SHOULD permit a maximum password length of at least 64".
  - Accept printing ASCII, space and Unicode.
  - "SHOULD apply … (NFC)".
  - "Each Unicode code point SHALL be counted as a single character".
  - Blocklist: "The entire password SHALL be subject to comparison, not substrings".
  - "SHALL NOT impose other composition rules".
  - No periodic change.
  - No truncation.
  - Allow password managers, autofill and paste.
  - No hints or KBA.
  `[CITED: pages.nist.gov/800-63-4/sp800-63b/authenticators/]`
- **Implementation:**
  - A Domain `PasswordPolicy` counts **code points**: `password.EnumerateRunes().Count()`, not `.Length` (an emoji counts as 1, not 2). It enforces 12–128 after **NFC normalization**, and runs a contains-email/name check (see AD-6).
  - An Identity `IPasswordValidator<ApplicationUser>` adapter calls the policy and then `IPwnedPasswords`.
  - Normalize with NFC in **both** the set path and the verify path. Note for MIG (Phases 15–16): legacy hashes made without NFC.
- **HIBP client** (Infrastructure, typed `HttpClient` with `AddStandardResilienceHandler`, timeout ~2–3 s):
  - `SHA1.HashData(UTF8(password))`, uppercase hex.
  - `GET https://api.pwnedpasswords.com/range/{first5}` with `Add-Padding: true` and a `User-Agent`. "A missing user agent will result in an HTTP 403".
  - **Discard lines with count 0**: "Padded entries always have a password count of 0 and can be discarded".
  - No API key, and "There is no rate limit on the Pwned Passwords API".
  - **No licence or attribution requirement** for Pwned Passwords: "there is no licencing or attribution requirements".
  - Fail mode = C-33.
  `[CITED: haveibeenpwned.com/API/v3]`
- **SSRF:** the base address is a fixed constant (CWE-918 allow-list). Tests use a fake `IPwnedPasswords` plus a parser test fed a recorded padded response. One opt-in live smoke test stays outside the default lane.
- **Strength meter:** the UI-spec `passwordStrength()` scores composition (`/[A-Z]/`, `/\d/`, `/[^A-Za-z0-9]/`), and its own test expects `'Csp!Volt26'` (10 chars) to be "Strong". `[VERIFIED: CSPS-UI-SPEC.md:2976-2984, 3051]` That conflicts with NIST and with the 12 minimum. Replace it (C-5) with a length- and blocklist-driven meter that never says Strong below 12. It is a SPEC-DEVIATION that needs owner approval.

### Pattern 8: Password reset tokens (AUTH-08/09, CWE-640)

- **One table, `AccountTokens`:** Id, UserId, Purpose (`PasswordReset` now; `Invitation` and `EmailChange` in Phase 5), TokenHash (SHA-256, unique), CreatedAt, ExpiresAt (30 min), UsedAt, RevokedAt.
- **Forgot:**
  - Always answer the same way ("If an account exists, we sent a link").
  - Same response floor as sign-in.
  - For an active, confirmed user: revoke older unused reset tokens, create one, enqueue the email.
  - Per-account throttle: proposed 3 emails/hour, extras dropped silently.
  - Covered by SEC-06, so a repeated post queues one email (success criterion 6).
- **Link:** `{App:PublicBaseUrl}/admin/reset-password#token=<base64url>`.
  - The token sits in the **URL fragment**, so it never reaches the server, the logs or a `Referer`.
  - The SPA reads `location.hash`, then removes it with `history.replaceState`.
  - Build links from configuration, **never from `Request.Host`** (IN-06, CWE-644).
  - Set `AllowedHosts` for production in Phase 3. `[ASSUMED]`
- **Reset:**
  - Validate the token (unexpired, unused, user active).
  - Run the policy and HIBP.
  - `UserManager.ResetPasswordAsync` can't be used without token providers. Use `RemovePasswordAsync`+`AddPasswordAsync`, or `UpdatePasswordHash` + `UpdateSecurityStampAsync`, inside the same transaction. `[ASSUMED]`
  - Mark the token used.
  - Revoke all sessions.
  - Enqueue "password changed".
  - Audit `auth.password-reset-completed`.
  - **No session is issued.** The user signs in again with 2FA (AUTH-10).
  - A locked user may reset, but the lockout still holds until it ends.

### Pattern 9: Outbox, MailKit and the Testing sink (AUTH-13, QUAL-05)

**9a Outbox:** `IEmailSender.Enqueue(message)` (Application port) adds an `EmailOutbox` row to the scoped context, so it commits atomically with the business change.
- **Columns:** Id, Kind, ToAddress, Subject, `ProtectedBody` (nvarchar(max), `IDataProtector` purpose `Csps.EmailOutbox.v1`), CreatedAt, NotAfter (code emails: the code expiry; reset: the link expiry), Attempts, NextAttemptAt, SentAt, LastErrorCode (no secrets), and a rowversion.
- **After sending:** set `ProtectedBody = null`. This scrubs codes and links at rest.
- **Rows past `NotAfter`** are marked expired, never sent.

**9b Dispatcher:** an in-process `BackgroundService`, signaled through a `Channel` after commit, plus a 30 s sweep, so a restart drains leftovers. There's no host scheduler on Basic, and none is needed for this. Rows are claimed with a rowversion check. Backoff is exponential and capped (around 1 h).
- **`MailKitTransport` (Production, and Development with real credentials):**
  - `ConnectAsync(host, 587, SecureSocketOptions.StartTls)`. That option **requires** TLS. Never use `StartTlsWhenAvailable` or `None`, and never override certificate validation.
  - Authenticate with the mailbox credentials (host secrets), then `SendAsync`.
  - Connect to the hostname **on the server's certificate** (shared hosts often present `mailNNN.site4now.net`, not `mail.cspstailoring.com`).
  `[ASSUMED: SmarterASP specifics not found publicly; owner prerequisite]`
- **Message content:** plain-text plus a minimal HTML part built with MimeKit `BodyBuilder`. HTML-encode names (CWE-79 in mail). From is the OD-12 address. Code mails hold the code, its expiry in Manila time and a "this wasn't me" line (PRD §8.2).

**9c Testing-only sink (QUAL-05, AD-3):**
- `InMemoryEmailSink : IEmailTransport` and a `GET` endpoint (for example `/api/testing/emails`, anonymous, allow-listed) sit inside `#if CSPS_TESTING` in **both** Infrastructure and Server.
- `CSPS_TESTING` is defined only for `Configuration=Debug` in the two `.csproj` files.
- They are registered **only** when `IsEnvironment("Testing")`, and startup throws if the symbol is present in `Production`.
- **Release proof:** an ArchitectureTests test runs `dotnet build -c Release -o <temp>` and walks `Csps.Server.dll`/`Csps.Infrastructure.dll` with `System.Reflection.Metadata` (BCL, no package). It asserts that no type named `*EmailSink*`/`*TestingEmails*` and no route string exist. It's slow (about a minute), so keep it out of the quick lane but in the full suite. A second, static test asserts that the symbol appears only under the Debug condition in the csproj. Matrix rows for the sink endpoint must sit inside `#if CSPS_TESTING` too, or a Release test run fails with "matrix row matches no endpoint".
- **E2E environment problem:** the E2E host today runs `ASPNETCORE_ENVIRONMENT: 'Development'`. `[VERIFIED: web/playwright.config.ts:72-74]` A Testing-only sink needs it to run `Testing`. `WebApplication.CreateBuilder` loads user-secrets only in Development, so the JWT key and DP certificate would be missing. See AD-3. Note that `CspsApiFactory` also runs `Testing` and injects test settings, so blindly adding user-secrets for `Testing` lets a developer's secrets override `TestJwt` (Pitfall 10).

**9d Dev transport (AD-4):** with no SMTP credentials, a dev sign-in can't receive its code. The options are real SMTP credentials in user-secrets, or a Development-only (`#if CSPS_TESTING`) file-drop transport into a git-ignored folder.

### Pattern 10: Idempotency-Key (SEC-06)

- **Coverage by default:** the middleware runs after `UseAuthentication`/`UseAuthorization` and `UseRateLimiter`, and **covers every POST endpoint unless its metadata carries `[IdempotencyExempt(Reason = "...")]`**. Default-on mirrors default-deny.
- **Discovery test:** enumerates `EndpointDataSource`. Every POST is either covered, or exempt **and** listed in a written allow-list with reasons. The proposed allow-list: sign-in, 2FA verify, refresh, sign-out (their responses carry tokens or set cookies) and sign-out-everywhere (it sets cookies; naturally idempotent). Analytics beacons join later. `two-factor/resend`, `password/forgot` and `password/reset` are **covered**.
- **Table `IdempotencyRecords`:** Id, `Key` (uniqueidentifier), `UserId` (null when anonymous), `Route` (method + `RoutePattern.RawText`, nvarchar(200)), `RequestHash` (binary(32)), `StatusCode`, `ResponseBody` (nvarchar(max), **not** a JSON column), `ResponseContentType`, `Location`, CreatedAt, ExpiresAt (= +24 h). A unique index on (Key, Route, UserId). SQL Server unique indexes treat NULLs as equal, so anonymous keys are unique per route. `[ASSUMED]`
- **Recommended design, atomic (AD-7):** the middleware opens a transaction on the scoped `CspsDbContext`. It takes `sp_getapplock(@Resource = 'idem:'+key+route+user, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0)`. If the lock can't be taken → **409**. Then it reads the record:
  - Exists and not expired, same hash → replay the stored status, body, content-type and Location (and the header `Idempotent-Replayed: true`).
  - Exists, different hash → **422**.
  - Expired → replace it.
  - Missing → run the handler with the response buffered (cap 1 MB). Persist when the status is 2xx or a deterministic 4xx (400, 404, 422), then commit and only then flush the response.
  - Otherwise (401, 403, 409, 429, 5xx) → roll back, so the client's same-key retry runs again. This matches the R2-08 client rule.
- **Why this design:** the business rows and the idempotency record commit in **one** transaction, so a crash can never leave "done but not recorded". **Rule:** a covered handler writes through the scoped context. Separate contexts are only for failure audits (WR-03b).
- **Header validation:** missing or not a UUID → **400** ProblemDetails "This form needs a fresh request key. Reload and try again." (owner copy via UI-phase).
- **Body hash:** SHA-256 of the raw body for JSON. For multipart, hash the parsed parts in order (deferred-items LIB-CR-02, needed in the upload phase).
- **Raw SQL:** `sp_getapplock` goes through `Database.ExecuteSqlInterpolatedAsync`/`SqlQuery` with parameters. That is a reviewed raw-SQL exception (CWE-89 rule) and must be noted in the SECURITY review. `[ASSUMED: sp_getapplock semantics]`
- **Body hashing and passwords:** the reset body contains a 256-bit random token, so its unsalted SHA-256 hash can't be inverted to the new password.

### Pattern 11: Rate limiting and body limits (SEC-03)

- **Built-in middleware:** "`UseRateLimiter` must be called after `UseRouting` when rate limiting endpoint specific APIs are used" (`[EnableRateLimiting]`). `[CITED: learn.microsoft.com/aspnet/core/performance/rate-limit (2026-10-09)]`
- **Per-IP policy `auth`:** partition by `IpPrefix`-style buckets. IPv4 is partitioned by the full address. IPv6 is partitioned by /64, because a single host owns a /64. A *bounded* key avoids the docs' warning that "partitioning on unbounded user-controlled input can exhaust memory". `[CITED: same page]` Use a sliding window. Proposed limits are under AD-5. `OnRejected` writes a CSPS ProblemDetails 429 with `Retry-After` from `MetadataName.RetryAfter`.
- **Per-account:** handled in handlers through DB counters (lockout, code attempts, resend counts, forgot throttle). They are durable across app-pool recycles. The in-memory limiter "resets on recycle" (STACK.md note).
- **Proxy caveat:** IP comes from `Connection.RemoteIpAddress` only (forwarded headers are off until the Phase 3 host facts). If SmarterASP puts a proxy in front, every visitor shares one IP, so keep per-IP limits generous and configuration-driven, and verify on the first deploy. `[CITED: PITFALLS.md:379]`
- **Test hosts:** `TestServer`'s `RemoteIpAddress` can be null, so the matrix and parallel tests would share a bucket and 429 each other. The test factory sets high limits, and dedicated rate-limit tests set real ones (Pitfall 8).
- **Body limits:** a global 1 MB request-body limit for JSON (Kestrel `MaxRequestBodySize`; the IIS `requestLimits maxAllowedContentLength` in `web.config` is added in Phase 3 / OPS-05, so note it). Page-size ≤100 and search ≤100 chars: build the shared validator rules in Application now. No list endpoint exists yet, so later phases apply them.

### Pattern 12: Audit catalog (AUDIT-01) and the audit write path

- **Action codes:** the rule is two or more dotted lowercase segments, at most 64 chars. The constants come from `AuditEntry`: `ActionMaxLength = 64`, `TargetIdMaxLength = 64`, `DetailMaxLength = 400`, `CorrelationIdLength = 32`. `[VERIFIED: src/Csps.Domain/Auditing/AuditEntry.cs:19,25,34,37]` The codes:
  - `auth.sign-in-failed` (detail = reason code `unknown-account|bad-password|locked|deactivated|unconfirmed`; target = user id when known)
  - `auth.lockout`
  - `auth.2fa-issued`, `auth.2fa-resent`, `auth.2fa-verified`, `auth.2fa-failed`, `auth.2fa-exhausted`
  - `auth.signed-in`
  - `auth.refreshed` (optional; volume)
  - `auth.refresh-reuse-detected`
  - `auth.signed-out`, `auth.sessions-revoked`
  - `auth.password-reset-requested`, `auth.password-reset-completed`, `auth.password-reset-failed`
  - `user.bootstrap-manager-created`
  Never record emails, codes or tokens. Users appear by id only.
- **Write path (WR-03 fix):** today `AppendAsync` calls `context.AuditLog.Add(entry);` and then `await context.SaveChangesAsync(cancellationToken)` on the shared scoped context. `[VERIFIED: src/Csps.Infrastructure/Auditing/AuditTrail.cs:31-32]`
  - Rename it to `Record` (add only) so the handler's own commit includes the entry.
  - For failure audits that must persist when the business change is rolled back (for example in the idempotency transaction), add `RecordIndependentlyAsync` through `IDbContextFactory`.
  - Document which path each action uses.
- **Correlation id (WR-06):** `CorrelationId.For` falls back to `context.TraceIdentifier`, which `AuditEntry.Create` rejects ("exactly 32 lowercase hex"). Every audit write on that path would 500. `[VERIFIED: src/Csps.Server/Http/CorrelationId.cs:20-22]`
- **IP prefix (WR-02):** IpPrefix keeps 3 bytes for IPv4 and 6 bytes for IPv6 (`Ipv4PrefixBytes = 3; Ipv6PrefixBytes = 6`). It maps only `IsIPv4MappedToIPv6` back to IPv4, so a 6to4 `2002:WWXX:YYZZ::/48` keeps a full IPv4. `[VERIFIED: src/Csps.Domain/Auditing/IpPrefix.cs:13-14,29-31]` The fix from 01-REVIEW must land first.

### Pattern 13: `bootstrap-manager` CLI (AUTH-12)

- **Project:** `tools/Csps.BootstrapManager`, referencing Infrastructure as DevSeed does. The command logic lives in a testable `BootstrapManagerHandler`, so an integration test runs it in-process against a freshly migrated `CSPS_Test_<guid>` and then signs in through the API with the sink. That is the "empty, production-like database" proof, run locally.
- **Inputs:**
  - The connection string comes from a per-process env var or a hidden prompt, **never** a CLI argument (CWE-214, IN-02).
  - `--email`, `--first-name`, `--last-name`.
  - The password comes from a hidden prompt with confirmation. It runs the full policy and HIBP, honouring the C-33 fail mode.
- **Guards:**
  - Refuse when **any** user exists.
  - Refuse any `BetsLLC_*` catalog and `CSPS_Legacy_Restore`. The instance is no longer a refusal reason: `(localdb)\MSSQLLocalDB` is the normal local instance and database names are the guard.
  - Require `--confirm-database <name>` to equal the connection's Initial Catalog.
  - Never migrate (production gets reviewed scripts).
- **The user:** created `EmailConfirmed = true` in role Manager, with audit `user.bootstrap-manager-created` (actor null = "System").
- **Break-glass runbook (docs):** if SMTP breaks, nobody can sign in because 2FA is mandatory. The runbook fixes the SMTP settings in the host, and the outbox retries. It never adds a bypass flag.

### Pattern 14: Web client

- **14a Session module** (`web/src/modules/admin/services/session.ts`, admin chunk only, **never imported by public pages**, PERF-01 budget):
  - The access token lives in a module variable.
  - Plug `refresh()` (`POST /api/v1/auth/refresh`, `skipAuthRefresh: true`, header `X-CSPS-CSRF`) and `onUnauthorized` (clear, then redirect to `/admin/login`, with R2-09 "Your session ended. Sign in again.") on the shared client in `web/src/core/api/`.
  - Wrap refresh in `navigator.locks.request('csps-refresh', …)`. Inside the lock, re-check whether another tab already refreshed: a `BroadcastChannel('csps-auth')` message carries the new expiry, but never the token. `[ASSUMED: Web Locks baseline, Safari ≥15.4]`
  - Use the same channel to broadcast sign-out to other tabs.
  - A module-level boot promise de-duplicates React StrictMode's double effect (PITFALLS 9).
- **14b Route guard:** the admin layout route `loader` calls `ensureSession()` and on failure `throw redirect('/admin/login?returnUrl=…')`.
  - `returnUrl` must be a validated local path (CWE-601).
  - Use a loader redirect, never `<Navigate>` (nuqs #1245 rule).
  - **D-20 reversal:** real admin routes ship in production *behind the guard*. Dev-only showcase and preview routes stay dev-route-only and **outside** the guard, so the Phase 2 visual, parity and showcase E2E suites keep working (Pitfall 11).
  - The production build-output test changes from "no admin code" to "no dev or showcase code".
  - The barrel split (research Flag 4) is planned Phase 4 work.
- **14c Forms:**
  - RHF + zod resolver; submission goes through the existing `useSubmission`.
  - Read live values with `useWatch`, **never** `watch()`. The React Compiler lint flags `watch` as `incompatible-library`, which breaks the zero-warnings rule. `[CITED: react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library]`
  - Errors use `role="alert"` banners and field errors, and focus moves to the first invalid field (`focusFirstInvalid`).
- **14d A11Y-03 / WCAG 2.2:**
  - Email `type="email" autocomplete="username"`. Password `autocomplete="current-password"`. New password `autocomplete="new-password"`, plus a read-only `autocomplete="username"` field on the reset page so password managers save the pair.
  - OTP: the first box gets `autocomplete="one-time-code"` and `inputmode="numeric"`. This exists already: `FIRST_BOX_AUTOCOMPLETE = 'one-time-code'`, and paste is always allowed. `[VERIFIED: web/src/components/entry/OtpInput.tsx:46]`
  - No CAPTCHA or puzzle (3.3.8).
  - **No auto-submit on the 6th digit.** That would be a change of context on input (3.2.2) unless announced. Use an explicit Verify button.
  - The resend countdown is announced politely only at its start and end, not every second.
  - The 15-min code limit is "extendable" through resend (2.2.1).
  - Dialogs make the page behind them `inert` (R2-10).

### Anti-Patterns to Avoid

- **`SignInManager.CheckPasswordSignInAsync` for sign-in:** it skips the hash on a locked account (timing oracle).
- **`IdentitySchemaVersions.Version3`:** a JSON column (D-13 violation) and passkey tables nobody uses.
- **`AddDefaultTokenProviders` + `GeneratePasswordResetTokenAsync`** as the reset token: not stored or hashed, so it can't be audited or revoked one at a time.
- **Sending SMTP inline in the request:** timing oracle, slow sign-in, lost mail on failure. Always use the outbox.
- **Reading the email from the body inside a rate-limiter partitioner:** partitioners are synchronous and run before binding. Count per-account limits in handlers.
- **`watch()` from RHF:** use `useWatch`.
- **Tokens or codes in query strings:** the reset token goes in the fragment. The OTP and ticket never appear in a URL (`httpClient` already rejects a `code` query param).
- **Building email links from `Request.Host`:** use configuration (IN-06).
- **Auto-retrying refresh on 401 inside the refresh call:** `skipAuthRefresh` exists for exactly this (LIB-WR-04).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Own PBKDF2/Argon2 | Identity `PasswordHasher` (V3, 100k, HMAC-SHA512) | Versioned format, rehash-on-verify, vetted |
| Lockout counters | Own failed-count table | Identity `AccessFailedAsync`/`IsLockedOutAsync` | DB-durable, already in schema |
| JWT encode/sign/validate | String-built tokens | `JsonWebTokenHandler` + JwtBearer | alg confusion, typ, lifetime, skew |
| Random codes/tokens | `Guid`, `Random`, time seeds | `RandomNumberGenerator` | CWE-330/338; `System.Random` is banned (BannedSymbols.txt) |
| Constant-time compare | `==` / `SequenceEqual` | `CryptographicOperations.FixedTimeEquals` | Timing |
| Rate limiting | Own counters in memory | `AddRateLimiter` (per-IP) + Identity/DB counters (per-account) | Concurrency, eviction, Retry-After metadata |
| SMTP | `System.Net.Mail.SmtpClient` / raw sockets | MailKit | STARTTLS correctness; `SmtpClient` is obsolete for new code |
| At-rest payload encryption | Own AES | `IDataProtector` (already certificate-protected keys) | Key rotation, authenticated encryption |
| Cross-tab mutual exclusion | localStorage flags | Web Locks API | Atomic, released on tab death |
| HIBP | A NuGet "HIBP client" | 30 lines over `HttpClient` (STACK.md decision) | Fewer dependencies; one fixed host |

**Key insight:** in auth, the subtle bugs are in *ordering and equivalence*: which branch hashes, which save commits what, which token stays valid. Keep every rule in Domain as a pure function of `now`, and let the framework primitives do the crypto.

## Inherited Review Items (triage for Phase 4)

| Item | Must land in Phase 4? | Why |
|------|----------------------|-----|
| WR-02 IpPrefix 6to4/NAT64 | **Yes, before the first audit write** | Owner deferral condition (STATE.md:302) |
| WR-03 AuditTrail commits the whole context | **Yes** | Phase 4 is the first caller; pick (a) Record + (b) independent per action |
| WR-05 masker misses `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `Key`, `Hash`, `Stamp`, `ResetCode` … | **Yes** | `IdentityUser` objects now exist. Exact names today: `"Password"`, `"Code"`, `"Otp"`, `"ApiKey"`, `"Authorization"`, `"Cookie"`, `"ConnectionString"`, `"CertificatePassword"`, `"CertificateBase64"`, `"SigningKey"`, `"Secret"`, `"Token"`; suffixes `["Password", "Token", "Secret"]` `[VERIFIED: src/Csps.Server/Logging/SensitiveDataMasking.cs:17-31]`. Add `Ticket`, `CodeMac`, `TokenHash`, `RequestHash`, `ProtectedBody`, `Mac`, `Hash` (suffix) and test with `{@User}` |
| WR-06 correlation fallback | **Yes** | AuditEntry would throw on the fallback path |
| IN-04 `typ: at+jwt` | **Yes** | Token issuance is new here |
| IN-06 AllowedHosts / Host-header links | Links: **Yes** (config base URL). AllowedHosts value: Phase 3 deploy | Reset links |
| IN-02 secrets on the command line | **Yes** for the new secrets (`Auth:CodeMacKey`, SMTP password) | Use stdin |
| WR-01 HybridCache factory on a scoped DbContext | **Yes, if** the session cache follows the same shape | Use `IDbContextFactory` in factories |
| IN-09 CLAUDE.md says 2-year retention | Recommended (doc edit) | Before audit rows exist (D-32 is one-way) |
| WR-07, WR-08, WR-09, IN-01, IN-03, IN-05, IN-07, IN-08 | No (Phase 3 / hardening) unless a plan touches them | Not auth-critical |

## Common Pitfalls

### Pitfall 1: Timing oracle through framework shortcuts
**What goes wrong:** unknown email or locked account answers faster, which enumerates accounts (CWE-204).
**Why:** `FindByEmail` returns null before hashing, and SignInManager returns LockedOut before hashing.
**Avoid:** Pattern 3 (dummy hash on every branch plus a response floor).
**Warning signs:** p50 latency differs by more than about 20% between branches in the timing test.

### Pitfall 2: Secure cookies don't stick in Safari/WebKit over `http://localhost`
**What goes wrong:** sign-in "works" in Chrome dev but silently fails in Safari.
**Why:** "Safari rejects cookies with the Secure attribute, and `__Host-` and `__Secure-` prefixed cookies, on localhost, while Chrome and Firefox accept Secure cookies there" (httpwg #2605; WebKit 232088, 231035 → 218980; reopened as 281149 in Oct 2024, still unresolved as far as this research could see). `[CITED: github.com/httpwg/http-extensions/issues/2605; bugs.webkit.org/show_bug.cgi?id=232088]`
**In this repo:**
- The Vite dev server runs plain `http` on 5180 and proxies `/api` to `http://localhost:5115`. `[VERIFIED: web/vite.config.ts:88-91]` So dev sign-in works in Chromium and Firefox but **not** in WebKit.
- The Playwright host is `https://localhost:5199`. `[VERIFIED: web/playwright.config.ts:20]` So E2E covers WebKit over HTTPS (with `ignoreHTTPSErrors`).
- **Spike (research flag):** in Wave 0, run one Playwright test that signs in (or just sets `__Secure-` cookies) in chromium, firefox and webkit against 5199, asserting that the cookie exists with `httpOnly`, `secure`, `sameSite: 'Strict'` and `path: '/api/v1/auth'`. Do not switch Vite to HTTPS: Node doesn't trust the ASP.NET dev cert, which was the Phase 2 reason. Document "use Chrome/Edge/Firefox for `npm run dev`; WebKit is covered by E2E".
- If the spike shows WebKit refusing the cookie even over HTTPS with `ignoreHTTPSErrors`, fall back to trusting the dev cert in the WebKit project, or assert the same behaviour through Chromium only and record a gap. `[ASSUMED: not yet run]`

### Pitfall 3: "Session ends when the browser closes" isn't guaranteed
**What goes wrong:** Chromium restores session cookies when "Continue where you left off" is on, or after an update restart. `[CITED: textslashplain.com/2019/06/24/surprise-undead-session-cookies/ (2019, community)]`
**Avoid:** the 12 h absolute server cap is the real control. State this in the UAT and in the owner-facing copy for C-19. Don't promise more.

### Pitfall 4: Refresh reuse false positives sign everyone out
**What goes wrong:** StrictMode double boot, two tabs, a lost response, or parallel E2E workers on one user.
**Avoid:** Pattern 5 R2 (sibling within the grace window), Web Locks, the boot de-dupe, and per-worker E2E users.
**Tests:** two concurrent refreshes with the same token both succeed; replay after G revokes; rotation never extends `AbsoluteExpiresAt`.

### Pitfall 5: The October 13 security release breaks restore
**What goes wrong:** `NU1903` (High) on `System.Security.Cryptography.Pkcs`/`Xml` becomes an error at the next restore. `[VERIFIED: dotnet list package --vulnerable, this session]`
**Avoid:** Wave 0 (AD-1). Re-check the advisories at every package install (user memory).

### Pitfall 6: JSON column sneaks in through Identity Version3, or a convenience `ToJson()`
**Avoid:** pin `Version2`. Add a model test that iterates over `IEntityType`s and asserts there are no JSON-mapped complex/owned types and no `AspNetUserPasskeys` table, plus a migration SQL grep for `nvarchar(max)` columns typed as JSON (D-13).

### Pitfall 7: Respawn wipes the migration-seeded roles
**What goes wrong:** `CspsDatabase.ResetAsync` ignores only `__EFMigrationsHistory`, `SiteSettings` and the audit tables, so `HasData` roles vanish between tests. `[CITED: STATE.md:142,163]`
**Avoid:** add `AspNetRoles` to the Respawn ignore list (and keep the roles immutable), or re-seed them in the fixture.

### Pitfall 8: Rate limits and caps make the suites flaky
- Integration: the matrix's 4× parallel loop over all rows (AuthorizationMatrixTests) would hit the per-IP `auth` policy.
- E2E: workers share seeded users, so the resend cooldown (60 s), send caps (5/h) and lockouts hit each other. `[CITED: PITFALLS.md:456]`

**Avoid:** make all limits configuration-driven, with high values in the test factory and the E2E host, and real values in dedicated tests. Seed per-worker E2E users, and give the lockout/cap specs dedicated users. Polling the sink must wait for the dispatcher. The sink endpoint returns messages after a cursor id, and a Playwright `expect.poll` handles the wait.

### Pitfall 9: The authorization matrix and controller route keys
**What goes wrong:** controller endpoints report `RoutePattern.RawText` as the combined attribute template, which may lack the leading `/` (for example `api/v1/auth/sign-in`). The existing keys use a leading slash (`"GET /api/v1/site-settings"`). `[VERIFIED: tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:57]`
**Avoid:** in Wave 0, print the discovered keys from the first controller, then fix the convention (route templates or the key normaliser) once. Every anonymous auth endpoint also needs an `AnonymousAllowList` entry. Today the list holds only `"* /health"`, `"* /api/{**path}"`, `"GET {*path:nonfile}"`, `"HEAD {*path:nonfile}"`, `"* {*path:file}"`, `"* /openapi/{**path}"` and `"* /scalar/{**path}"`. `[VERIFIED: AuthorizationMatrix.cs:74-80]` `[ASSUMED: exact RawText form]`
- Also, bearer requests now need a live `sid`. The matrix fixture must seed an Admin and a Manager user with sessions, and `TestTokens` must mint with those `sid`s. Otherwise every Admin/Manager row returns 401.

### Pitfall 10: Testing-environment configuration collisions
**What goes wrong:** if Program loads user-secrets for `Testing` (to give the E2E host its secrets), they can override `CspsApiFactory`'s `UseSetting` test JWT and DP certificate on a developer machine, depending on source order. Integration tests then fail only on machines with secrets.
**Avoid:** see AD-3. Gate it on an explicit non-secret switch that only the E2E `webServer.env` sets, and add a test proving the factory's settings win.

### Pitfall 11: Guarding admin routes breaks the Phase 2 suites
**What goes wrong:** the showcase at `/dev/components` is mounted under AdminLayout (02-34), and the parity, visual and keyboard E2E specs visit admin preview routes without signing in.
**Avoid:** the guard wraps the real admin routes only. The dev-route showcase and preview stay unguarded in dev-route builds, and production has neither.

### Pitfall 12: Host egress and SMTP topology are unverified until Phase 3
**What goes wrong:** the local proof (dev machine → SmarterASP SMTP) passes, but the app on shared hosting can't reach port 587 or `api.pwnedpasswords.com`.
**Avoid:** add "SMTP 587 reachable from the site" and "outbound HTTPS to api.pwnedpasswords.com" to the Phase 3 first-deploy checklist. C-33 decides what HIBP failure does. `[CITED: HOSTING-RECORD.md probe facts are Unverified]`

### Pitfall 13: Identity UserManager saves your half-built entities
**What goes wrong:** `UserManager` mutations call `SaveChanges` (auto-save), flushing whatever else is tracked, such as an audit entry or a challenge.
**Avoid:** order the operations deliberately, or wrap them in one explicit transaction. `[ASSUMED]`

## Code Examples

### 1. Code generation and HMAC binding (PRD §8.2)
```csharp
// Source: PRD §8.2 + BCL APIs. [ASSUMED shape]
string code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
byte[] Mac(byte[] key, Guid ticketId, Guid userId, string code)
{
    Span<byte> input = stackalloc byte[16 + 16 + 6];
    ticketId.TryWriteBytes(input[..16]); userId.TryWriteBytes(input[16..32]);
    Encoding.ASCII.GetBytes(code, input[32..]);
    return HMACSHA256.HashData(key, input);
}
bool Matches(byte[] stored, byte[] candidate) => CryptographicOperations.FixedTimeEquals(stored, candidate);
```

### 2. Dummy-hash parity (AUTH-01)
```csharp
// [ASSUMED shape] UserManager/PasswordHasher are Identity APIs (CITED source.dot.net).
var user = await users.FindByEmailAsync(email);
bool ok;
if (user is null) { hasher.VerifyHashedPassword(DummyUser, DummyHash, password); ok = false; }
else
{
    ok = hasher.VerifyHashedPassword(user, user.PasswordHash!, password) != PasswordVerificationResult.Failed;
    if (!ok && user.IsActive && !await users.IsLockedOutAsync(user)) await users.AccessFailedAsync(user);
}
await ResponseFloor.WaitAsync(started, time, ct);  // Task.Delay(remaining, timeProvider)
```

### 3. Refresh cookie
```csharp
// [ASSUMED] Cookie names subject to C-23.
http.Response.Cookies.Append("__Secure-csps_rt", token, new CookieOptions
{
    HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict, Path = "/api/v1/auth",
    Expires = session.Persistent ? session.AbsoluteExpiresAt : null,   // null = browser-session cookie
    IsEssential = true,
});
```

### 4. HIBP range check
```csharp
// Source: haveibeenpwned.com/API/v3 (range, Add-Padding, User-Agent). [CITED]
var hex = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(password)));   // uppercase
using var req = new HttpRequestMessage(HttpMethod.Get, $"range/{hex[..5]}");
req.Headers.Add("Add-Padding", "true");
using var res = await http.SendAsync(req, ct);            // BaseAddress https://api.pwnedpasswords.com/, User-Agent set at registration
foreach (var line in (await res.Content.ReadAsStringAsync(ct)).Split('\n'))
{
    var colon = line.IndexOf(':');
    if (colon == 35 && line.AsSpan(0, 35).SequenceEqual(hex.AsSpan(5))
        && int.TryParse(line.AsSpan(colon + 1).Trim(), out var count) && count > 0) return Breached;
}
return NotBreached;
```

### 5. MailKit send (required TLS)
```csharp
// [ASSUMED host/port: owner prerequisite]
using var smtp = new SmtpClient();                                 // MailKit.Net.Smtp
await smtp.ConnectAsync(options.Host, 587, SecureSocketOptions.StartTls, ct);   // never StartTlsWhenAvailable / None
await smtp.AuthenticateAsync(options.User, options.Password, ct);
await smtp.SendAsync(message, ct);
await smtp.DisconnectAsync(true, ct);
```

### 6. Access token with `typ`
```csharp
// [ASSUMED: SecurityTokenDescriptor.TokenType]; claim names VERIFIED in SecurityRegistration.cs:16,19
var jwt = handler.CreateToken(new SecurityTokenDescriptor
{
    Issuer = opts.Issuer, Audience = opts.Audience, TokenType = "at+jwt",
    Claims = new Dictionary<string, object> { ["sub"] = userId.ToString(), ["role"] = role, ["sid"] = sessionId.ToString(), ["jti"] = Guid.NewGuid().ToString("N") },
    IssuedAt = now.UtcDateTime, NotBefore = now.UtcDateTime, Expires = now.AddMinutes(15).UtcDateTime,
    SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256),
});
```

### 7. Cross-tab refresh (web)
```ts
// [ASSUMED] Web Locks API; the auth service in `modules/admin/services` owns the call (PRD §9.3).
export async function refreshSession(): Promise<void> {
  await navigator.locks.request('csps-refresh', async () => {
    if (accessTokenStillFresh()) return;                 // another tab refreshed while we waited (BroadcastChannel)
    const res = await http.post<RefreshResponse>('/auth/refresh', undefined, {
      skipAuthRefresh: true, headers: { 'X-CSPS-CSRF': '1' },
    });
    setAccessToken(res.data.accessToken, res.data.expiresAt);
  });
}
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| NIST 800-63B rev 3 (8-char min, "SHOULD" blocklist) | **800-63B-4**: 15 min single-factor / 8 min with MFA, NFC, code-point counting, blocklist whole-password, SHALL allow password managers | Rev 4 final (2025) | Project's 12 with mandatory 2FA is compliant; the "contains name" rule is stricter than rev 4's whole-password wording (AD-6) |
| Identity schema v1/v2 | **v3 adds passkeys with `ToJson()`** | .NET 10 | Must stay on v2 (D-13) |
| `System.IdentityModel.Tokens.Jwt` | `JsonWebTokenHandler` | IdentityModel 7+ | Already the project choice |
| `SmtpClient` | MailKit | `SmtpClient` obsolete for new code | Already the project choice |
| `FluentValidation.AspNetCore` auto-validation | Explicit validators in handlers | FV 11+ deprecation | Already forbidden |
| Client-only CSRF tokens | `SameSite=Strict` + custom header + Fetch Metadata (`Sec-Fetch-Site`) | Fetch Metadata baseline March 2023 | Cheap second layer |

**Deprecated/outdated:** the UI-spec `passwordStrength()` composition scoring (conflicts with NIST, C-5). `ARCHITECTURE.md`'s SignInManager suggestion (timing leak).

## Owner Decision Briefs (for `/gsd-discuss-phase 4`; nothing below is decided)

Each brief is plain English with neutral options and one recommendation.

**OD-12: Which email address sends the system emails, and the DNS records.**
- Facts: the domain is `cspstailoring.com`, SPF ends `-all` and DMARC is `p=reject`, so only SmarterASP's mail servers may send, and DKIM must be switched on and published. The Gmail pass check (D2) is still due. `[VERIFIED: HOSTING-RECORD.md:176-179]`
- (a) A new dedicated mailbox, for example `accounts@cspstailoring.com` or `no-reply@…`, with Reply-To set to the shop's real contact address. This keeps system mail separate and costs nothing extra if the plan includes mailboxes.
- (b) Reuse an existing shop mailbox. That's simpler, but the shop's inbox fills with bounces and auth noise, and its password becomes an app secret.
- (c) A subdomain sender (`mail.cspstailoring.com`) with its own SPF and DKIM. This isolates reputation but needs more DNS work, and DMARC's `p=reject` still applies.
- **Recommendation: (a)**, with DKIM enabled in the SmarterASP mail panel and the TXT record **added** to DNS (merge, never replace). The owner sends a test message to Gmail and pastes the SPF/DKIM/DMARC result lines (D2) before E2E relies on real mail.

**C-4: How new staff get their first password (ruled now, built in Phase 5).**
- (a) An emailed invitation link. The person sets their own password and the Manager never sees it. It reuses the reset-link machinery (`AccountTokens`, Purpose=Invitation), and email already works because 2FA needs it.
- (b) The Manager types a temporary password (the UI-spec prefill `Csp-tahi-4821`) and shares it, and the user must change it at first sign-in. That's faster, but the Manager knows the password and it travels over chat.
- **Recommendation: (a).**

**C-5: The password rule wording and checks.**
- (a) NIST: 12–128 characters, any characters including spaces, no "must include a number or symbol", reject breached passwords, a length-based strength meter.
- (b) The UI spec: "8+ characters with a number and a symbol". Easier to remember, but weaker, and NIST says not to force symbols.
- **Recommendation: (a)**, with the meter rewritten (SPEC-DEVIATION) and the copy changed to something like "Use 12 or more characters. A short phrase works well." **AD-6 rides with this:** NIST rev 4 says blocklist checks compare the *whole* password. AUTH-11's "doesn't contain your email or name" is stricter. Options: keep "contains" (stricter, may annoy people named, for example, "Ana") or switch to "isn't your email or name".

**C-6: What the 2FA screen looks like (spec gap).**
- (a) A second step inside the same sign-in page and layout. The card becomes "Check your email", with a 6-box code entry, a Verify button, "Resend code in 0:42" and "Use a different account".
- (b) A separate page `/admin/login/verify` with the same look.
- **Recommendation:** (a)'s look at route (b), so Back and refresh behave predictably. No automatic submit when the 6th digit is typed, which is an accessibility rule. The exact words go through `/gsd-ui-phase 4`.

**C-7: Forgotten password.**
- (a) A full self-service email reset (request → "check your email" → set a new password → done). The link works for 30 minutes and only once.
- (b) Keep the UI spec's toast "Ask a Manager to reset your password." No email reset; a Manager handles it. Simpler, but every forgotten password becomes a Manager job, and the requirement (AUTH-08) would be dropped.
- **Recommendation: (a).** A Manager-sent reset link (USER-07) can be added in Phase 5.

**C-8: What a deactivated person sees at sign-in.**
- (a) The same generic error as a wrong password. Nobody can learn which accounts exist or are deactivated.
- (b) The UI spec's banner "This account is deactivated." as soon as the email is typed. This tells strangers the account exists.
- (c) The middle way: show "deactivated" only after the correct password **and** the emailed code, because by then the person has proven it's their account.
- **Recommendation: (a)**, with (c) acceptable if the owner wants the friendlier message.

**C-9: Changing your email (ruled now, built in Phase 5).**
- (a) Confirm by a link sent to the new address, with a notice to the old one. The change applies only after confirmation.
- (b) Change immediately, as the UI spec's toast implies. If someone takes over a session, they can silently move the account to their own email.
- **Recommendation: (a).**

**C-17: Screens the UI spec doesn't draw.** The 2FA, forgot-password, reset-password and "session ended" message screens, plus invite-acceptance for Phase 5, and maybe a place for "Sign out of all devices" until Phase 5's profile page exists.
- Options: (a) compose them from existing parts (login layout, Field, PasswordField, OtpInput, Button, banners), mark them `// SPEC-GAP`, and have the owner review the copy in `/gsd-ui-phase 4`. (b) The owner draws them first.
- **Recommendation: (a).** For "sign out of all devices", put it in the user menu now, or wait for Phase 5's profile page. Ask the owner which.

**C-19: Is "Keep me signed in" ticked by default?**
- (a) Unticked. Safer on the shop's shared PC, because nobody is left signed in for 90 days by accident.
- (b) Ticked, as drawn. More convenient on staff's own phones.
- **Recommendation: (a)**, with the note that closing the browser doesn't always sign you out (some browsers restore sessions), so the 12-hour cap is the real limit.

**C-23: The name and scope of the sign-in "remember" cookie.**
- (a) `__Secure-csps_rt`, sent only to `/api/v1/auth`, the auth endpoints. It goes out in fewer requests.
- (b) `__Host-csps_rt` with `Path=/`, sent with every request to the site. The `__Host-` rule also stops a sibling subdomain (for example an old part of the legacy site) from planting a cookie.
- **Recommendation: (a)**, the PRD's own fallback, unless the owner expects other web apps on `*.cspstailoring.com`. In that case (b).

**C-33: What happens if the "breached password" service (HIBP) is down when someone sets a password.**
- (a) **Fail closed.** Refuse the new password ("We couldn't check this password right now. Try again in a few minutes."). Safest, but a HIBP outage blocks password resets.
- (b) **Fail open.** Accept it, write an audit entry, and re-check it at the next sign-in or password change. Never blocks staff.
- (c) **Fail open with a local floor.** Same as (b), but first check a built-in list of the most common passwords shipped with the app (for example the MIT-licensed SecLists top-10k list, about 100 KB). That list's license and legitimacy check must be recorded.
- **Recommendation: (c).** The bootstrap CLI should use (a), since the owner can just retry.

**OD-14: UI-spec items that conflict with WCAG on these screens.** Candidates to check in `/gsd-ui-phase 4`:
- the small "Forgot password?" link's touch target
- the 20×20 checkbox (already accepted under O-8)
- the countdown announcements
- the error banner focus
- no auto-submit
- **Recommendation:** rule item by item once the UI-phase audit lists them.

**New items research surfaced (need a ruling):**
- **AD-1: Apply the October 13 .NET security update now** (10.0.13 runtime and SDK 10.0.402, `Microsoft.*` 10.0.13 pins, a `System.Security.Cryptography.Pkcs`/`Xml` 10.0.13 pin). It is a security exception to the 14-day wait. **Recommended: yes.** Without it, the build fails the advisory gate at the next restore.
- **AD-2: Approve the new packages** at the exact versions in "Standard Stack".
- **AD-3: How E2E reads codes while staying "Testing-only".**
  - (a) The E2E host runs `ASPNETCORE_ENVIRONMENT=Testing`, and Program loads user-secrets for Testing only when an explicit switch is set in the Playwright `webServer.env`.
  - (b) The E2E host stays Development, and the sink is allowed in Development+Debug too. This contradicts QUAL-05's wording.
  - **Recommended: (a).**
- **AD-4: Getting sign-in codes during local development.**
  - (a) Real SMTP credentials in user-secrets. Real mail, and it doubles as the D2 deliverability test.
  - (b) A Debug-only file drop: codes are written as `.eml` files to a git-ignored folder.
  - **Recommended:** both, with (b) as the default.
- **AD-5: Limits that the requirements leave open.** The proposed numbers:
  - refresh grace window 30 s
  - response floor 500 ms for sign-in and forgot-password
  - cross-ticket cap 10 wrong codes per hour → 15-min lockout + email
  - forgot-password at most 3 emails per hour per account
  - per-IP: sign-in 10/min, 2FA verify 10/min, resend 5/min, forgot 5 per 15 min, reset 10 per 15 min, refresh 60/min
  All are configurable. The owner confirms or adjusts.
- **AD-6:** see C-5.
- **AD-7: Which repeated-post answers are stored.** Recommended: successes and the "your input is wrong" answers (400, 404, 422). Everything else (401, 403, 409, 429 and server errors) may run again with the same key, which matches the client's Phase 2 retry rule R2-08.

## Phase 3 Deferral: What Changes for Phase 4

| Item that assumed CI/staging | Local substitute in Phase 4 | Deferred to Phase 3 |
|------------------------------|-----------------------------|---------------------|
| QUAL-05 "sink absent from Release" | ArchitectureTests builds Release locally and inspects the metadata (Pattern 9c) | Wire the same test into CI |
| AUTH-12 "bootstrap on production-like DB" | Integration test: a freshly migrated empty `CSPS_Test_<guid>` → bootstrap → full sign-in through the sink | Real bootstrap on the hosted DB at first deploy |
| AUTH-13 "from the business sender over TLS" | Dev machine → SmarterASP SMTP with real credentials (AD-4a) and the owner's Gmail D2 paste | Verify the host can reach SMTP 587 and HIBP 443 (Pitfall 12) |
| Cookies on real HTTPS (`__Secure-`) | E2E on `https://localhost:5199` in three engines (Pitfall 2 spike) | Check `Set-Cookie` on the production HTTPS host |
| Per-IP limits vs proxy topology | Configurable limits; RemoteIpAddress only | Verify client-IP topology; maybe enable forwarded headers |
| Release build gates (zero warnings, coverage, `npm audit`, license gate) | Run locally: `dotnet build`, `dotnet test --solution`, `Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` | CI enforcement |
| Advisory monitoring (Dependabot) | Manual `dotnet list package --vulnerable` + `npm audit` at the start of each phase (today's finding shows why) | Dependabot cooldown 14 |
| ZAP baseline / CodeQL | Not available; `/gsd-secure-phase 4` manual review | Phase 3 / hardening |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `[FromBody(EmptyBodyBehavior = Allow)]` + null DTO pattern works with `SuppressModelStateInvalidFilter` and lets validators report 400 | Pattern 1 | Wave 0 test fails; adjust binding pattern |
| A2 | Controllers can return `IResult` and get the CSPS ProblemDetails | Pattern 1 | Need an `IActionResult` adapter |
| A3 | `SecurityTokenDescriptor.TokenType` sets the JWT `typ` header | Pattern 5, Ex. 6 | Use `AdditionalHeaderClaims` instead |
| A4 | HybridCache `RemoveByTagAsync` evicts local entries immediately in-process | Pattern 5 | Revocation lags by the TTL; shorten the TTL |
| A5 | `sp_getapplock` with `@LockTimeout=0` inside an EF transaction gives an immediate "busy" for duplicates | Pattern 10 | Use a unique-insert-first design with an in-progress row |
| A6 | SmarterASP SMTP: host, port 587 STARTTLS, auth required, certificate hostname | Pattern 9 | Owner prerequisite; adjust options |
| A7 | Controller `RoutePattern.RawText` lacks a leading slash | Pitfall 9 | Only key-format fixes |
| A8 | WebKit accepts `__Secure-` cookies over `https://localhost` with `ignoreHTTPSErrors` | Pitfall 2 | WebKit E2E auth gap; trust the cert or record the gap |
| A9 | Proposed numeric limits (AD-5) | Patterns 3–5, 11 | Owner tunes; config-driven |
| A10 | Web Locks and BroadcastChannel available in all target browsers (Safari ≥15.4) | Pattern 14 | Fall back to server grace only |
| A11 | Identity `UserManager` auto-saves via `UserStore.AutoSaveChanges` | Pitfall 13 | Ordering bugs; wrap in a transaction |
| A12 | Password reset without token providers via Remove/AddPassword or UpdatePasswordHash + security stamp | Pattern 8 | Pick another UserManager path |
| A13 | Cookies are shared across ports on localhost (RFC 6265) | Pattern 6 | Name collisions with TheBETSLLC if not prefixed |
| A14 | IIS `maxAllowedContentLength` needs a `web.config` change for the 1 MB rule | Pattern 11 | Kestrel limit alone may not apply in-process; verify |

## Open Questions

1. **Where does "Sign out of all devices" live before Phase 5's profile page?**
   - Known: the endpoint is Phase 4 (AUTH-06), and the profile page is Phase 5.
   - Unclear: whether the owner wants a user-menu item now.
   - Recommendation: ask in C-17.
2. **Does SmarterASP.NET's Basic plan include a mailbox, DKIM signing and SMTP submission from the site?**
   - Known: SPF includes `_spf.site4now.net`.
   - Unclear: everything else. No public documentation was found.
   - Recommendation: an owner prerequisite before E2E-with-real-mail. The sink makes the automated suites independent of it.
3. **Does the WebKit project accept `__Secure-` cookies on `https://localhost:5199`?**
   - Recommendation: the Wave 0 spike (Pitfall 2).
4. **Can a controller's 401 ProblemDetails for bad credentials skip the `WWW-Authenticate` header?**
   - It's harmless for the SPA. Planner's choice: 401 (current proposal) or 400.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build/test | ✓ | 10.0.401 | Install 10.0.402 (AD-1) |
| ASP.NET Core runtime | run/test | ✓ | 10.0.12 (8.0.31 also present) | Install 10.0.13 (AD-1) |
| LocalDB `(localdb)\MSSQLLocalDB` (version 17.0.4025.3, shared with TheBETSLLC) | integration tests, E2E DB | ✓ (Phase 1 verified 17.0) | — | none (Docker forbidden locally) |
| Node / npm | web | ✓ (engines `>=24.15 <25`, npm `>=11.19`) | per `web/package.json` | — |
| Playwright browsers (chromium/firefox/webkit) | E2E | ✓ (Phase 2 ran all three) | @playwright/test 1.63.0 | — |
| SmarterASP SMTP mailbox credentials | real email (AD-4a, D2) | ✗ (owner prerequisite) | — | Testing sink (automated) + dev file drop |
| DNS access for DKIM | deliverability | ✗ until owner acts | — | none for real mail; automated suites unaffected |
| Internet to api.pwnedpasswords.com | live HIBP | ✓ from dev (assumed) | — | Fake in tests; C-33 fail mode |
| preflight script | before servers/E2E/full runs | ✓ `C:\Work\dev-tools\preflight.ps1` | — | — |

**Missing with no fallback:** none for building or testing. Real email delivery needs the owner's SMTP credentials and DKIM.
**Missing with fallback:** SMTP (sink and file drop), runtime and SDK patch (install).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| .NET | xunit.v3 4.0.1 on Microsoft.Testing.Platform, Shouldly 4.3.0, NSubstitute 6.2.0, FakeTimeProvider, Respawn 7.0.0, ArchUnitNET 0.13.4, coverlet.MTP 10.0.1 `[VERIFIED: Directory.Packages.props:22-34]` |
| Web | Vitest 5.0.1 + RTL + jsdom + in-house axe matcher; Playwright 1.63.0 + @axe-core/playwright; MSW 3.0.1 (new) |
| Config | `global.json` (MTP runner), `web/vitest.config.ts`, `web/playwright.config.ts` |
| Quick run | `dotnet test --project tests/Csps.Domain.UnitTests` · `dotnet test --project tests/Csps.Application.UnitTests` · `npm --prefix web run test -- --run src/modules/admin` |
| Full suite | Preflight, then `dotnet test --solution Csps.slnx` (with `CSPS_TEST_SQL=localdb` per process), `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Automated command (examples) | File exists? |
|-----|----------|------|------------------------------|--------------|
| AUTH-01 | Generic 401 for unknown/wrong/locked/deactivated; hasher called once per branch; same fake completion time | unit (Application, FakeTimeProvider) + integration timing (median, interleaved, generous bound, full lane only) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*SignInHandlerTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SignInTimingTests"` | ❌ Wave 0 |
| AUTH-02/03/04 | Challenge state machine; HMAC/fixed-time; resend cooldown/cap; cross-ticket cap | unit (Domain 100%) + integration (cookie binding, other user's ticket rejected) | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*TwoFactorChallengeTests"` | ❌ |
| AUTH-05/06 | Rotation R1–R5, grace siblings, reuse revokes, absolute expiry never extends, persistent vs session cookie attrs, immediate revocation via `sid` | unit (Domain) + integration (two concurrent refreshes; replay after G; cookie attributes; sign-out-all then old access token → 401) + E2E (two tabs) | `--filter-class "*RefreshRotationTests"`, `"*SessionRevocationTests"` | ❌ |
| AUTH-07 | 5 failures lock 15 min; one lockout email | integration + sink assertion | `"*LockoutTests"` | ❌ |
| AUTH-08/09 | Same response for unknown/known; token hashed, 30 min, single use; reset revokes sessions; "changed" email | integration | `"*PasswordResetTests"` | ❌ |
| AUTH-10 | Deactivated/locked can't sign in/refresh/reset into session | integration | `"*InactiveAccountTests"` | ❌ |
| AUTH-11 | Code-point length, NFC, contains-name/email (per AD-6), HIBP parse ignores count 0, fail mode | unit (Domain + Infrastructure parser) | `"*PasswordPolicyTests"`, `"*HibpResponseParserTests"` | ❌ |
| AUTH-12 | Bootstrap on empty migrated DB then full sign-in; refuses when users exist / wrong DB | integration (LocalDB) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*BootstrapManagerTests"` | ❌ |
| AUTH-13 | Outbox row in same txn; DP-protected body; scrubbed after send; StartTls required; expired mail not sent; no secrets in logs (FakeLogger) | unit + integration | `"*EmailOutboxTests"`, `"*MailKitTransportOptionsTests"` | ❌ |
| QUAL-05 | Sink only in Testing+Debug; Release assembly has no sink types/routes | architecture (slow) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*ReleaseHasNoEmailSinkTests"` | ❌ |
| SEC-03 | 429 + Retry-After ProblemDetails per IP prefix; JSON >1 MB → 413; account counters | integration | `"*RateLimitTests"`, `"*RequestBodyLimitTests"` | ❌ |
| SEC-06 | 400 missing/malformed, 409 in-flight, 422 different body, replay returns stored response and creates one row/one email, 24 h expiry, discovery test + allow-list | integration + discovery | `"*IdempotencyTests"`, `"*IdempotencyCoverageTests"` | ❌ |
| A11Y-03 | autocomplete attrs, paste into password/OTP, no auto-submit, axe clean | component (Vitest+axe) + E2E (axe page-level, 3 engines + phones) | `npm --prefix web run test -- --run src/modules/admin`; `npm --prefix web run e2e -- --grep @auth` | ❌ |
| AUDIT-01 | Each auth event writes exactly its action code, no PII/secrets; WR-02/03/06 fixed | unit (IpPrefix 6to4/NAT64) + integration | `--filter-class "*AuthAuditTests"`, `"*IpPrefixTests"` | partial (IpPrefixTests exists) |
| SEC-02 (ongoing) | Every new endpoint in matrix × 3 callers with seeded sessions | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the quick command of the touched project, plus the targeted `--filter-class`.
- **Per wave merge:** `dotnet test --solution Csps.slnx` + `npm --prefix web run verify` (run preflight first).
- **Phase gate:** full suite + coverage gate + `npm --prefix web run e2e` (three engines + phones), all green, zero warnings, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] AD-1 security bump; `dotnet list package --vulnerable --include-transitive` clean
- [ ] Controllers bootstrap test (IResult → ProblemDetails; empty-body → 400 via validator; matrix key format)
- [ ] Matrix fixture: seeded Admin/Manager users + sessions; `TestTokens` with `sid`/`typ`
- [ ] Identity model test: Version2, no JSON columns, no `AspNetUserPasskeys`, unique `NormalizedEmail`
- [ ] Respawn ignore list includes `AspNetRoles`
- [ ] `tests/Csps.Server.IntegrationTests/Auth/*` (sign-in, 2FA, refresh, reset, lockout, timing), `Idempotency/*`, `RateLimiting/*`
- [ ] `tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs`
- [ ] Web: MSW 3 setup in `src/test/setup.ts` (onUnhandledRequest: 'error'), auth feature tests, E2E `auth.spec.ts` with per-worker users and sink polling
- [ ] Cookie spike spec (chromium/firefox/webkit on 5199)

## Security Domain

`security_enforcement` is on; the ASVS level is 1 (`.planning/config.json`). Categories use ASVS 4.0.3 numbering.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Identity PBKDF2 (V3, 100k), NIST 800-63B-4 policy + HIBP, mandatory email OTP (HMAC, 5 tries, 15 min), lockout 5/15 min, generic errors + timing parity, notifications on lockout/password change |
| V3 Session Management | yes | 15-min JWT (`typ at+jwt`, `sid`), hashed rotating refresh with reuse detection, absolute lifetimes 90 d / 12 h, `HttpOnly; Secure; SameSite=Strict` cookies, revocation on reset/sign-out-all, per-request `sid` check |
| V4 Access Control | yes | Default-deny fallback + `Staff`/`Manager` policies; matrix test; `sub` from token only |
| V5 Validation, Sanitization, Encoding | yes | FluentValidation in handlers; body limit 1 MB; HTML-encode email content; `returnUrl` local-path check |
| V6 Stored Cryptography | yes | `RandomNumberGenerator`, HMAC-SHA256 (codes), SHA-256 (tokens/tickets), `IDataProtector` (outbox payload), FixedTimeEquals; secrets from user-secrets/host settings |
| V7 Error Handling & Logging | yes | ProblemDetails without internals; masking extended (WR-05); audit catalog without secrets; FakeLogger tests |
| V8 Data Protection | yes | Outbox body encrypted and scrubbed after send; tokens never in URLs (fragment for reset); `Cache-Control: no-store` on auth |
| V9 Communications | yes | MailKit `StartTls` required, no certificate override; HTTPS only (HSTS existing) |
| V11 Business Logic | yes | Resend cooldown/caps, cross-ticket cap, idempotency |
| V13 API | yes | Idempotency-Key (SEC-06), rate limiting (SEC-03), anti-CSRF header + Fetch Metadata on cookie endpoints |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Credential stuffing / spraying (T1110.003/.004, CWE-307) | Spoofing | Per-IP limiter (prefix partitions) + Identity lockout + mandatory 2FA |
| Account enumeration by message or timing (CWE-204/203) | Information disclosure | One generic error; dummy hash; response floor; same forgot-password answer |
| 2FA brute force across tickets | Spoofing | 5 tries/code, per-account cross-ticket cap → lockout |
| Refresh token theft / replay (T1539, CWE-613) | Spoofing | HttpOnly SameSite=Strict cookie, rotation + reuse → revoke family, short access TTL, `sid` check |
| CSRF on refresh/sign-out (CWE-352) | Tampering | SameSite=Strict + custom header + `Sec-Fetch-Site`; no CORS |
| Reset-link poisoning via Host header (CWE-644/640) | Tampering | Base URL from config; AllowedHosts in production |
| Token/code leakage in logs, URLs, Referer (CWE-532/598) | Information disclosure | Masking, fragment tokens, no query secrets, outbox scrub |
| Lockout as DoS / inbox bombing | Denial of service | One lockout email per window; per-IP limits; break-glass runbook |
| Duplicate state-changing posts | Tampering | SEC-06 atomic idempotency |
| Weak randomness (CWE-330/338) | Spoofing | `RandomNumberGenerator`; `System.Random` banned |
| Email HTML injection (CWE-79 in mail) | Tampering | HTML-encode names; plain-text part |
| SSRF via HIBP client (CWE-918) | Tampering | Fixed base address; no user-controlled URLs |
| Vulnerable components (CWE-1104/1395) | — | AD-1 bump; advisory check at each install; NuGetAudit as error |

## Sources

### Primary (HIGH)
- Codebase files opened this session: `src/Csps.Server/Composition/SecurityRegistration.cs`, `Program.cs`, `Http/CorrelationId.cs`, `Logging/SensitiveDataMasking.cs`, `src/Csps.Domain/Common/ErrorKind.cs`, `Auditing/AuditEntry.cs`, `Auditing/IpPrefix.cs`, `src/Csps.Application/Security/Policies.cs`, `Roles.cs`, `Ports/IAuditTrail.cs`, `src/Csps.Infrastructure/Auditing/AuditTrail.cs`, `Persistence/CspsDbContext.cs`, `tests/.../AuthorizationMatrix.cs`, `Directory.Packages.props`, `global.json`, `web/vite.config.ts`, `web/playwright.config.ts`, `web/src/components/entry/OtpInput.tsx`, `CSPS-UI-SPEC.md` §8.2/E.5/D.1, PRD §8/§11/§14, ROADMAP Phase 4, REQUIREMENTS, STATE, HOSTING-RECORD, 01-REVIEW(+DISPOSITION), 02 deferred-items/CONTEXT, 999.1 DECISIONS
- NuGet registration, flat-container nuspec, search and vulnerability APIs (versions, dates, licenses, advisories); `dotnet list package --vulnerable --include-transitive` on this repo
- builds.dotnet.microsoft.com `10.0/releases.json` (10.0.13 = security, 2026-10-13); api.github.com advisory GHSA-846f-f764-76mx
- npm registry (`npm view … time/license/peerDependencies/scripts.postinstall`), npm bulk advisory endpoint, api.npmjs.org downloads

### Secondary (MEDIUM, official docs)
- source.dot.net: IdentityUserContext.cs (schema versions, passkeys `ToJson`, indexes), SignInManager.cs (`PreSignInCheck`), PasswordHasher.cs / PasswordHasherOptions.cs
- learn.microsoft.com: Rate limiting middleware (ms.date 2026-10-09)
- pages.nist.gov/800-63-4/sp800-63b/authenticators/ (§3.1.1.2)
- haveibeenpwned.com/API/v3 (Pwned Passwords range, padding, UA, no licence requirement)
- react.dev: eslint-plugin-react-hooks `incompatible-library`
- caniuse/MDN: `Sec-Fetch-Site`

### Tertiary (LOW, community / unverified)
- WebKit Bugzilla 232088 / 231035 / 281149 and httpwg/http-extensions #2605 (Safari Secure cookies on localhost)
- textslashplain.com (Chromium session-cookie restore, 2019)
- startdebugging.net (IResult in controllers)
- SmarterMail/SmarterASP SMTP and DKIM: no official SmarterASP documentation found

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions, dates, licenses and advisories were read from the registries today, and the security finding was reproduced on this repo.
- Architecture: MEDIUM-HIGH. The framework behaviour that matters (SignInManager short-circuit, schema versions, rate limiter ordering, hasher defaults) was read from source and docs. The composition is a design proposal for the planner.
- Pitfalls: MEDIUM-HIGH. The repo-specific ones are verified. WebKit localhost cookies come from community and bug-tracker sources and need the Wave 0 spike.
- Owner decisions: neutral briefs; nothing assumed decided.

**Research date:** 2026-10-14
**Valid until:** 2026-10-28 for package versions (re-pick at install with the 14-day rule and an advisory check). About 30 days for the design.
