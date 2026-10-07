<!-- GSD:project-start source:PROJECT.md -->

## Project

**CSPS — Carmen's Stitch & Printing Services** replaces the production system of a Philippine shop that makes custom full-sublimation jerseys and does tailoring.

- **Public site:** home, products, gallery, contact/quote, legal pages, cookie consent. Visitors are mostly teams, leagues and riding clubs arriving on a phone from Facebook.
- **Admin portal:** staff with the roles `Admin` and `Manager` run orders (items, payments, discounts, order expenses, images), company expenses, users, site content, visitor metrics and their own profiles.
- All production data is migrated in without loss. The API is client-agnostic, so a future Android app can use the same backend.

**Core Value:** staff record every order and always see correct, **server-computed** totals and balances, and migrated data has **zero loss**. If everything else slips, the order math, staff-account security and migrated-data integrity must still hold.

Full detail: `.planning/PROJECT.md` · `CSPS-PRD.md` (behavior, security, a11y, data) · `CSPS-UI-SPEC.md` (visuals, copy, markup).

### Constraints (binding)

- **Stack (PRD §2):**
  - Backend: .NET 10 / C# 14 controller-based APIs (`[ApiController]` + attribute routes) under `/api/v1`, EF Core 10 code-first with Fluent config only, SQL Server 2025, Identity (`IdentityUser<Guid>`), FluentValidation, MailKit, Cloudinary, Serilog.
  - Frontend: React 19 + TS strict + Vite, Tailwind v4, React Router, TanStack Query, RHF + zod.
- **Free only:** no paid licenses, tools or services, except the hosting and domain the owner already pays for. Licenses allowed: MIT, Apache-2.0, BSD and ISC, plus approved exceptions: MPL-2.0 for axe (dev/test only), OFL-1.1 for the @fontsource fonts, and two free Microsoft-licensed runtime parts of the SQL Server driver, pinned to exact versions in `docs/license-exceptions.json` (Microsoft.Data.SqlClient.SNI.runtime 6.0.2, Microsoft.Identity.Client.NativeInterop 0.20.6; any other version needs a new owner approval). Never GPL, AGPL, SSPL or commercial licenses.
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, and Serilog DB sinks.
- **New dependencies** need their purpose, license, maintenance status and a legitimacy check recorded in the phase RESEARCH.md. The **release cool-down is 14 days**: adopt only versions at least 14 days old (security fixes may skip it, with a recorded reason).
- **Architecture (PRD §3):**
  - Onion: Domain ← Application ← Infrastructure ← Server, enforced by **ArchUnitNET** tests.
  - No mediator: one handler per use case and manual mapping. `Result<T>` maps to RFC 9457 ProblemDetails.
  - Controllers (owner, 2026-10-07): one `[ApiController]` per resource with attribute routes under `/api/v1`; thin actions call one handler, no logic in controllers. Default-deny stays: the global fallback policy requires an authenticated user, every controller/action declares `[Authorize(Policy = ...)]` or `[AllowAnonymous]` explicitly, and the authorization-matrix test discovers every action. Automatic 400 model-state responses are off (`SuppressModelStateInvalidFilter`); validation is FluentValidation in handlers → `Result<T>` → ProblemDetails. The existing Minimal API endpoint (`GET /api/v1/site-settings`) converts when a later phase touches it; `/health`, `/openapi` and `/scalar` stay framework-mapped.
  - `rowversion` per aggregate (409 on conflict).
  - UTC storage plus `TimeProvider` / `IBusinessCalendar`. Never `DateTime.Now`.
  - Money is `decimal(18,2)` and computed server-side only.
- **Schema (Prime Directive 11):**
  - Every table and column comes from EF migrations, and the app works against an empty DB with no `.bak`.
  - **No JSON columns.**
  - Drops, renames and lossy type changes are one-way doors: ask the owner first.
  - Production gets reviewed idempotent scripts. Never `Database.Migrate()` at startup.
- **Quality:**
  - TDD (red → green → refactor).
  - Zero warnings everywhere: build, analyzers, lint, types, tests and the browser console.
  - Coverage: Domain 100%, Application ≥ 95%, `lib/http` 100%, web ≥ 90%.
  - Authorization-matrix tests cover every endpoint × {anonymous, Admin, Manager}.
- **Security:**
  - CWE Top 25 drives each phase's security review.
  - Strict CSP with no `unsafe-inline` or `unsafe-eval`.
  - Default-deny authorization.
  - Append-only audit log.
  - No secrets or data in git.
- **A11y:** WCAG 2.2 AA, with zero axe violations at both component and page level.
- **Perf budgets:**
  - Bundles: public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz.
  - Lighthouse ≥ 95 on mobile.
  - LCP < 2.0 s, CLS < 0.05, INP < 200 ms.
- **Responsive:** 320–1920 px, touch targets ≥ 44 px, no horizontal scroll.
- **Workflow:** `/gsd-plan-phase N --tdd`. Run `/gsd-ui-phase N` for UI phases. Run `/gsd-secure-phase N` and `/gsd-ui-review N` before `/gsd-ship N`.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack (summary; full versions, licenses and compatibility in `.planning/research/STACK.md`)

**Backend** (central versions in `Directory.Packages.props`, no floating versions):
- SDK 10.0.4xx (`global.json`, `rollForward: latestPatch`, MTP test runner). Runtime and ASP.NET Core 10.0.x.
- EF Core SqlServer + Design 10.0.x (`dotnet-ef` local tool).
- Pin the compat level explicitly: `UseCompatibilityLevel(160)` provisionally, re-pinned to the host's verified level.
- Identity via `AddIdentityCore<…>().AddRoles<IdentityRole<Guid>>()`, never `AddIdentity` or `MapIdentityApi`.
- JWT bearer, with tokens issued through `JsonWebTokenHandler`.
- OpenAPI: built-in `Microsoft.AspNetCore.OpenApi` with the **Scalar** viewer, both **Development only**.
- Data Protection: `PersistKeysToDbContext`, `SetApplicationName("Csps")`, `ProtectKeysWithCertificate` (PFX from a host secret; dev PFX in user-secrets).
- Serilog.AspNetCore: compact-JSON file sink in `{contentRoot}/logs` with 30-day retention and secret masking.
- FluentValidation 12 (validators run in handlers or one endpoint filter).
- MailKit, CloudinaryDotNet, HybridCache (in-process only), Http.Resilience.
- HIBP: hand-rolled k-anonymity client (no package).

**Frontend** (`web/`, Node 24, exact versions):
- react/react-dom 19.3, react-router 8 (import from `react-router`; `RouterProvider` from `react-router/dom`), @tanstack/react-query 5, react-hook-form 7 + zod 4 + @hookform/resolvers, clsx, @fontsource fonts, web-vitals (only after consent).
- Vite 8 + @vitejs/plugin-react 6 + React Compiler via `@rolldown/plugin-babel` (@babel/core 7.29.x).
- Tailwind 4.3 via `@tailwindcss/vite`. vite-plugin-pwa with `injectRegister: null`.
- TypeScript alias pair: `typescript` → `@typescript/typescript6` (API for tooling), `@typescript/native` → `typescript@7` (fast `tsc --noEmit`).
- ESLint 10 flat config: typescript-eslint `strictTypeChecked`, react-hooks 7, `eslint-plugin-jsx-a11y-x`, Prettier.
- HTTP: in-house `lib/http/httpClient.ts` over `fetch`. Charts: hand-rolled SVG. Icons: decide C-10 (in-house `icons.ts` vs `lucide-react`).

**Tests:**
- .NET: xunit.v3 4.x (MTP v2), NSubstitute, Shouldly 4.3, Testcontainers.MsSql (explicit image `mssql/server:2025-CU9-ubuntu-24.04`, **CI only**), Respawn (ignore `__EFMigrationsHistory`), ArchUnitNET + xUnitV3 adapter, `FakeTimeProvider`, `FakeLogger`, coverlet.MTP + ReportGenerator (thresholds).
- Web: Vitest 5 + @vitest/coverage-v8, jsdom, RTL + user-event + jest-dom, in-house axe matcher over axe-core 4.13.x, MSW 3 (`msw/node`), Playwright 1.6x + @axe-core/playwright, @lhci/cli.

**CI and hosting:**
- GitHub Actions on ubuntu for build and test, and Windows for the Web Deploy job.
- Actions pinned by commit SHA. Dependabot `cooldown` 14 days.
- Free security tooling only: NuGetAudit as error, `npm audit`, nuget-license / license-checker gates, gitleaks. **No paid GitHub Code Security.**
- **SmarterASP.NET Basic plan:** 1 DB, 256 MB app pool, no host scheduler, **no staging**. Production deploys need manual approval. Cron jobs run from GitHub Actions calling a secret-protected endpoint.
- In-process IIS, framework-dependent publish (self-contained `win-x64` if the host runtime lags).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
