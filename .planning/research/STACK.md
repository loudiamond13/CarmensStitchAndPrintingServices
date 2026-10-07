# Stack Research

*Created: 2026-10-06T23:52:01-05:00 · Updated: 2026-10-07T15:53:21-05:00*

**Domain:** Small-business order management + public marketing site (custom sublimation jerseys / tailoring, Philippines). .NET 10 Minimal API + React 19 SPA served from `wwwroot`, SmarterASP.NET shared Windows/IIS hosting.
**Researched:** 2026-10-06
**Confidence:** HIGH for versions, licenses and peer ranges (read directly from the registries today). MEDIUM for behavior and compatibility claims taken from official docs and READMEs. LOW for hosting-plan details (vendor marketing pages; verify in the control panel).

> **Scope:** The stack is pinned by `CSPS-PRD.md` §2 and `CSPS-UI-SPEC.md` §2.1. This file does not propose a different stack. It verifies versions, compatibility, licenses and maintenance, and prescribes the exact supporting packages. Where the pinned pieces collide, it says so and gives the least-disruptive fix. Owner-level choices are surfaced, not decided.

### How confidence was determined (read this once)

| Evidence code | Meaning | Assessed tier |
|---|---|---|
| **[R]** | Direct read of a primary registry or API on 2026-10-06: npm registry (`npm view`), NuGet v3 API (versions, nuspec, license files inside the `.nupkg`), MCR tag list, `builds.dotnet.microsoft.com` release metadata, GitHub Releases API. Reproducible. | HIGH |
| **[D]** | Official docs or README fetched today (learn.microsoft.com, xunit.net, react.dev, vite-plugin-react README, typescript devblog, eslint.org, vitest.dev, coverlet docs, GitHub release notes). | MEDIUM |
| **[W]** | Web search, cross-checked against a second source where possible. | MEDIUM if cross-checked, otherwise LOW |
| **[K]** | Training knowledge not re-verified today. | LOW (flagged inline) |

**Seam note for the orchestrator.** `gsd_run query classify-confidence` returned `LOW` for `webfetch` (even with `--verified`), `LOW` for `websearch`, and `MEDIUM` for `websearch --verified`. It has no provider id for direct registry reads. Context7 MCP isn't available in this session, so the two docs-kind plan items were answered from official READMEs and docs via WebFetch. The [R] facts are primary-source metadata, not web prose. I assess them HIGH and flag that here instead of silently overriding the seam. Digests for the six research-plan keys were cached with `research-store put` at the seam's tiers.

**Supply-chain cool-down signal.** `gsd_run query package-legitimacy check --ecosystem npm` returned `SUS` for many mainstream packages (react, vite, vitest, eslint, typescript-eslint, zod, msw, prettier, @tanstack/react-query and others). The **only** reason given was `too-new`: the latest version was published within about 30 days. Download counts are 6M–387M per week, and the repos are the official ones. Nothing else was suspicious. This is a release-age gate, not a legitimacy problem. See "Release cool-down" under Stack Patterns.

---

## Executive Verdict (top findings the roadmap must absorb)

1. **TypeScript 7.0.2 (GA 2026-07-08) can't be the `typescript` that typescript-eslint loads.** typescript-eslint 8.71.1 peers `typescript >=4.8.4 <6.1.0`, and TS 7 ships no stable JS API (that's expected in 7.1). Microsoft's documented fix is to alias `typescript` to `npm:@typescript/typescript6@^6.0.2` for tools, and `@typescript/native` to `npm:typescript@^7.0.2` for the fast `tsc` CLI. [R][D] HIGH
2. **eslint-plugin-jsx-a11y 6.10.2 (last release 2024-10-26) doesn't support ESLint 10.** Its peer range stops at `^9`, and ESLint 9 reached **EOL on 2026-08-06**. The ESLint 10 PR (#1081) is still open. Use the maintained e18e fork **`eslint-plugin-jsx-a11y-x` 0.2.0**, which peers `^9 || ^10` and has the same `recommended`/`strict` configs, on ESLint 10.12. [R][D] HIGH
3. **The React Compiler is stable and compatible, but only through the Babel path.** That means `babel-plugin-react-compiler` 1.0.0 + `@rolldown/plugin-babel` 0.2.4 + `@babel/core` 7.29.x, wired as `babel({ presets: [reactCompilerPreset()] })`. plugin-react 6 removed the inline `babel` option. Its native Rust `compiler: true` option is marked **experimental**, and its peer `oxc-transform-react ^0.152.0` is already behind the current 0.153.0. [R][D] MEDIUM-HIGH
4. **License gaps against the PRD allow-list (MIT/Apache-2.0/BSD/ISC):**
   - `axe-core` (and therefore `@axe-core/playwright`, `vitest-axe`, `jest-axe`, and even `eslint-plugin-jsx-a11y`) is **MPL-2.0**.
   - The `@fontsource` fonts are **OFL-1.1**.
   - `Microsoft.Testing.Extensions.CodeCoverage` uses the **Microsoft proprietary .NET Library license**.
   - `FluentAssertions` 8.x is the **Xceed Community License (non-commercial)**, which is forbidden.

   The PRD itself mandates axe, so the owner must record an explicit exception for dev-only MPL-2.0 and for OFL fonts. [R] HIGH
5. **NetArchTest.Rules is unmaintained.** The last release, 1.3.2, was on 2021-05-23, and its nuspec has no license metadata, so license tools report "unknown". The pinned name still works on .NET 10 via Mono.Cecil. **ArchUnitNET 0.13.4** (Apache-2.0, released 2026-08-20, with a `TngTech.ArchUnitNET.xUnitV3` adapter) is the maintained alternative. NetArchTest.eNhancedEdition 1.4.5 (MIT, 2025-06) is a middle option. Owner or plan-phase decision. [R] HIGH
6. **xUnit v3 is now 4.0.1 and runs on Microsoft.Testing.Platform v2 only** (MTP v1 was dropped in 4.0.0, released 2026-08-14). On the .NET 10 SDK, enable it via `global.json` → `"test": { "runner": "Microsoft.Testing.Platform" }`. Coverage must use **`coverlet.MTP` 10.1.0** (MIT), because `coverlet.collector` is VSTest-only. coverlet.MTP's docs say threshold validation is *not yet supported*, so enforce the 100% / 95% gates with **ReportGenerator** (Apache-2.0) or a small script. [R][D] HIGH
7. **The machine's LocalDB *is* SQL Server 2025** (`MSSQLLocalDB` 17.0.4025.3). The native `json` type is **GA** in SQL Server 2025 at every compatibility level, and SEQUENCE and `rowversion` work too. EF Core 10 switches primitive collections and `ComplexProperty(...).ToJson()` to the `json` column type automatically at compat level ≥ 170. The real constraint is **production**: pin `UseCompatibilityLevel(...)` to whatever the SmarterASP database actually reports. [R][D] HIGH
8. **SmarterASP.NET's ASP.NET hosting page lists .NET 10.x and SQL Server 2025** [W/D, LOW until confirmed in the control panel]. Plan limits matter: Basic has 1 database of 1 GB and a **256 MB app-pool memory limit**. Advance has 6 databases, 3 GB and 512 MB. Premium has 20 databases, 10 GB and 3 GB. A staging + production pair needs at least the Advance plan.
9. **A private GitHub repo loses CodeQL, dependency-review-action and secret-scanning push protection** unless the org buys GitHub Code Security (about $30 per committer per month) and Secret Protection (about $19). All three are free on public repos. Dependabot stays free. This is an owner cost decision that affects PRD §18. [W] MEDIUM
10. **No charting library is needed.** The UI spec ships `IncomeExpenseChart` as hand-rolled SVG, and the ANL-08 trend chart can reuse the same pattern. **MSW is now v3** (ESM-only, released 2026-09-28), so the PRD's "MSW v2" wording is outdated. **React Router v8** dropped `react-router-dom`. **TanStack Query v6 doesn't exist**, so stay on v5.104.x. [R] HIGH

---

## Recommended Stack

### Core Technologies

| Technology | Version (2026-10-06) | License | Purpose | Why / notes | Conf. |
|---|---|---|---|---|---|
| .NET SDK | **10.0.401** (feature band 4xx; the 10.0.112 band also exists) | MIT | Build toolchain | Matches the installed SDK and the GitHub `windows-2025` / `ubuntu` images. Pin in `global.json` with `rollForward: latestPatch`. | HIGH [R] |
| .NET runtime / ASP.NET Core | **10.0.12** (released 2026-09-08; LTS, EOL 2028-11-14) | MIT | Runtime + hosting bundle | The next servicing release is expected on Patch Tuesday, 2026-10-13. `dotnet-hosting-10.0.12-win.exe` is the IIS bundle. | HIGH [R] |
| C# | **14.0** | — | Language | Ships with SDK 10.0.4xx. Primary constructors, `field` keyword, extension members. | HIGH [R] |
| EF Core SQL Server provider | **Microsoft.EntityFrameworkCore.SqlServer 10.0.12** | MIT | ORM | LTS, matching the runtime. Pulls `Microsoft.Data.SqlClient ≥ 6.1.6`. Don't force SqlClient 7.x unless needed. EF 11 is at rc.1, so avoid it. | HIGH [R] |
| SQL Server | **2025** (container `mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04`; the `2025-latest` tag also exists). LocalDB on this machine: **17.0.4025.3** | Microsoft EULA (Developer/Express), not a package | Database | Pin a CU tag, not `2025-latest`, for reproducible tests. Testcontainers' built-in default is still 2022-CU14 and its parameterless builder is `[Obsolete]`, so always pass the image explicitly. | HIGH [R] |
| ASP.NET Core Identity | **Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.12** | MIT | Users, roles, PBKDF2 hashing, lockout, tokens | Use `AddIdentityCore<ApplicationUser>().AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<CspsDbContext>().AddDefaultTokenProviders()`. **Not** `AddIdentity` (it adds cookie schemes) and **not** `MapIdentityApi` (it issues opaque bearer tokens and has no custom email-2FA, refresh-family or reuse-detection flow). | HIGH [R], MEDIUM pattern [K] |
| JWT bearer | **Microsoft.AspNetCore.Authentication.JwtBearer 10.0.12** | MIT | 15-minute access tokens | Issue tokens with `Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler` (it comes transitively), not the legacy `System.IdentityModel.Tokens.Jwt`. | HIGH [R], MEDIUM [K] |
| OpenAPI | **Microsoft.AspNetCore.OpenApi 10.0.12** | MIT | Built-in document generation | Generates OpenAPI **3.1** by default in .NET 10, with YAML via `MapOpenApi("/openapi/{documentName}.yaml")`. XML doc comments merge in automatically when `GenerateDocumentationFile=true`. No Swashbuckle. | HIGH [R][D] |
| React / ReactDOM | **19.3.0** (2026-09-09) | MIT | UI | Matches the UI spec ("tested 19.3"). React Router 8 needs ≥ 19.2.7. | HIGH [R] |
| TypeScript | **7.0.2** CLI as `@typescript/native` + **6.0.2** API as `typescript` (alias of `@typescript/typescript6`) | Apache-2.0 | Type checking | See Executive Verdict #1. TS 7 defaults: `strict: true`, `module: esnext`, **`types: []`** (list `vite/client`, `vitest/globals` and others explicitly). Removed: `baseUrl`, `target: es5`, `moduleResolution: node10`. The UI-spec tsconfig already uses `paths` without `baseUrl`, so it's TS7-safe. | HIGH [R][D] |
| Vite | **8.3.3** (2026-10-06) | MIT | Build/dev server (Rolldown + Oxc) | Node `^20.19 \|\| >=22.12`. Built-in `build.license` writes a bundled-dependency license file for THIRD-PARTY-NOTICES. Use `rolldownOptions`, not `rollupOptions`, for chunking in v8 [K]. | HIGH [R], MEDIUM [D] |
| @vitejs/plugin-react | **6.1.2** | MIT | JSX/Fast Refresh via Oxc | Peer `vite ^8`. Optional peers: `@rolldown/plugin-babel`, `babel-plugin-react-compiler`. | HIGH [R] |
| Tailwind CSS + @tailwindcss/vite | **4.3.3** | MIT | Utilities + theme mapped to CSPS tokens | `@tailwindcss/vite` peers `vite ^5.2 \|\| ^6 \|\| ^7 \|\| ^8`. Matches the UI spec ("4.3"). | HIGH [R] |
| React Router | **react-router 8.4.0** (2026-09-15) | MIT | Routing, `lazy` routes | v8 is **ESM-only**, needs **Node ≥ 22.22.0**, React ≥ 19.2.7 and Vite ≥ 7, and **removed `react-router-dom`**. Import from `react-router`; `RouterProvider` comes from `react-router/dom`. Middleware is always on. Use data mode (`createBrowserRouter` + `route.lazy`) for route-level splitting. | HIGH [R][D] |
| TanStack Query | **@tanstack/react-query 5.104.1** | MIT | Server state | There is **no v6**. Peers React 18/19. | HIGH [R] |

### Backend Supporting Libraries (NuGet, central versions in `Directory.Packages.props`)

| Package | Version | License | Layer | Purpose / when | Notes | Conf. |
|---|---|---|---|---|---|---|
| FluentValidation | **12.1.1** (2025-12-03) | Apache-2.0 | Application | Command/query validators (authoritative) | Single maintainer, sponsored, releasing regularly. **Don't** add `FluentValidation.AspNetCore`; it's deprecated. Run validators inside handlers, or in one generic endpoint filter that returns `ValidationProblem`. | HIGH [R] |
| FluentValidation.DependencyInjectionExtensions | **12.1.1** | Apache-2.0 | Application / Server | `AddValidatorsFromAssembly` | Optional. Manual registration is fine too. | HIGH [R] |
| Microsoft.EntityFrameworkCore.Design | **10.0.12** | MIT | Infrastructure (PrivateAssets=all) | Migrations | Plus the `dotnet-ef` tool **10.0.12** as a local tool (`.config/dotnet-tools.json`). Don't use 11.0 rc. | HIGH [R] |
| Microsoft.AspNetCore.DataProtection.EntityFrameworkCore | **10.0.12** | MIT | Infrastructure | `PersistKeysToDbContext<CspsDbContext>()` (the context implements `IDataProtectionKeyContext`) | Also call `SetApplicationName("Csps")`. The default discriminator is the content-root path, so a changed deploy path would orphan keys. Without `ProtectKeysWith*`, keys are stored **unencrypted** and Data Protection logs a *Warning* ("No XML encryptor configured"). Either add `ProtectKeysWithCertificate` (PFX from host config) or document the accepted risk; see PITFALLS. | HIGH [R], MEDIUM [K] |
| Microsoft.Extensions.Caching.Hybrid | **10.10.0** (2026-09-09) | MIT | Infrastructure | Cache site settings and the price list, with tag invalidation on Manager edits | In-process L1 only (no Redis on shared hosting). It empties on app-pool recycle, which is fine. | HIGH [R] |
| Microsoft.Extensions.Http.Resilience | **10.10.0** | MIT | Infrastructure | Timeouts/retry for HIBP and Cloudinary `HttpClient`s | `AddStandardResilienceHandler()`. Keep HIBP's timeout short and decide fail-open vs fail-closed (security decision). | HIGH [R] |
| MailKit (+ MimeKit) | **4.18.1** (2026-09-27) | MIT | Infrastructure | SMTP via SmarterASP mail, STARTTLS/SSL | Behind `IEmailSender`. `System.Net.Mail.SmtpClient` is obsolete for new code. | HIGH [R] |
| CloudinaryDotNet | **1.29.3** (2026-08-16) | MIT | Infrastructure | Signed server-side uploads, signed/authenticated delivery URLs | Brings **Newtonsoft.Json 13.0.3** (MIT) plus legacy `System.Net.Http 4.3.4` / `System.Text.RegularExpressions 4.3.1` for netstandard2.0. These are patched versions, and .NET 10 package pruning should drop them. Keep `NuGetAuditMode=all` on to catch regressions. | HIGH [R] |
| Serilog.AspNetCore | **10.0.0** (2025-11-28) | Apache-2.0 | Server | Request logging, `UseSerilog`, bootstrap logger | Already includes Serilog 4.x, Sinks.File 7.0.0, Sinks.Console 6.1.1, Settings.Configuration 10.0.x and Formatting.Compact. **No extra sink package is needed for shared IIS.** | HIGH [R] |
| Serilog.Sinks.File | **7.0.0** (transitive; pin explicitly) | Apache-2.0 | Server | Rolling compact-JSON files outside `wwwroot` (for example `{contentRoot}/logs/`) | `rollingInterval: Day`, `retainedFileCountLimit`, `fileSizeLimitBytes`, `shared: true` (overlapped recycles), `flushToDiskInterval`. Call `Log.CloseAndFlush()` on shutdown. | HIGH [R], MEDIUM [K] |
| Serilog.Sinks.Async | 2.1.0 | Apache-2.0 | Server | Optional async wrapper | Skip by default. On abrupt app-pool recycles it can lose buffered events. Add it only if profiling shows sync file I/O matters. | MEDIUM [K] |
| Serilog.Sinks.MSSqlServer | 10.0.0 | Apache-2.0 | — | **Don't use for app logs** | The plan database is 1–10 GB, and logs would compete with business data. The append-only `AuditLog` is a domain table, not a Serilog sink. | MEDIUM |
| Microsoft.AspNetCore.Mvc.Testing | **10.0.12** | MIT | Server.IntegrationTests | `WebApplicationFactory<Program>` | — | HIGH [R] |
| Microsoft.Extensions.TimeProvider.Testing | **10.10.0** | MIT | Tests | `FakeTimeProvider` for 2FA expiry, lockout and token lifetimes | Pairs with `TimeProvider` / `IClock` in production code. | HIGH [R] |
| Microsoft.Extensions.Diagnostics.Testing | 10.10.0 | MIT | Tests | `FakeLogger` to assert "no secrets in logs" (CWE-532) | Optional, but cheap proof for the §11 tests. | HIGH [R] |
| *(HIBP client)* | **no package** | — | Infrastructure | k-anonymity range check | `SHA1.HashData` → uppercase hex → `GET https://api.pwnedpasswords.com/range/{first5}` with headers `Add-Padding: true` and a `User-Agent`. Compare suffixes in memory. No API key is needed for the range API. Register it as a typed `HttpClient` with resilience. | MEDIUM [K] |

**Built into the ASP.NET Core 10 shared framework (no package reference):** rate limiting (`AddRateLimiter`, fixed/sliding/token-bucket, per-IP and per-account partitions), output caching (`AddOutputCache`, tag eviction), response compression (Brotli/Gzip), ProblemDetails (`AddProblemDetails`, `IProblemDetailsService`), health checks (`/health`), `TimeProvider`, and the Minimal API validation (`builder.Services.AddValidation()`).

- **Validation:** Minimal API validation is **DataAnnotations/`IValidatableObject` only** and source-generated. It discovers types only in the assembly that calls `AddValidation()`, and some of its public types carry the experimental `ASP0029` diagnostic. The PRD keeps validation in Application with FluentValidation and keeps attributes out of Domain. So use built-in validation **only** for transport-level constraints on Server-local request records (for example `pageSize` 1–100), or don't call `AddValidation()` at all. Never validate the same rule in both places. [D] MEDIUM
- **Rate limiting:** The limiter state is in-memory, so it resets on recycle and isn't shared across web-garden workers. Identity lockout, which lives in the DB, is the durable brute-force control. If the site ever sits behind Cloudflare or another proxy, `ForwardedHeaders` with `KnownProxies` must be configured, or every request will look like it comes from one IP. [K] MEDIUM
- **Output caching:** It doesn't cache authenticated or `Set-Cookie` responses by default, so it's suitable only for anonymous public GETs. HybridCache (application-level) is the primary mechanism, because it also serves the future Android client. Output caching is optional on top. [K] MEDIUM

### Frontend Runtime Dependencies (npm, all ship in the bundle)

| Package | Version | License | Purpose | Notes | Conf. |
|---|---|---|---|---|---|
| react, react-dom | 19.3.0 | MIT | UI | — | HIGH [R] |
| react-router | 8.4.0 | MIT | Routing | See Core. | HIGH [R] |
| @tanstack/react-query | 5.104.1 | MIT | Server state | `@tanstack/react-query-devtools` 5.104.1 is dev-only and lazy-loaded, never in the prod bundle. | HIGH [R] |
| nuqs | 2.10.1 (2026-08-25; **owner-approved 2026-10-07, planned for Phase 2**) | MIT | List-page state in the URL query string (WEB-10) | Adapter `nuqs/adapters/react-router/v8` (since 2.9.0; imports only from `react-router`), rendered inside the router around `<Outlet/>`, never around `RouterProvider`. About 5.6 KB gz in a real Vite 8.3.3 build. One dependency, `@standard-schema/spec` 1.1.0 (MIT). CSP-safe (no `eval` or `new Function`). Known bugs avoided by WEB-10's rules: #1567 (no nuqs `startTransition` option), #1563 (keep `shallow: true`), #1245 (no `<Navigate>` that sets query params). **At install, recheck:** if a stable 2.10.2 or later is at least 14 days old, ask the owner before switching; never take `2.10.2-beta.1`. Research: `.planning/quick/261007-kz6-url-query-string-ui-state-with-nuqs/261007-kz6-RESEARCH.md`. | HIGH [R] |
| react-hook-form | 7.89.0 | MIT | Forms | Peers React 16.8–19. | HIGH [R] |
| zod | 4.6.5 | MIT | Client-side UX validation (mirrors FluentValidation) | Import from `zod` (v4). `zod/mini` is an option if the admin budget gets tight [K]. | HIGH [R] |
| @hookform/resolvers | 5.9.1 | MIT | zod ↔ RHF bridge | Peers `zod ^3.25 \|\| ^4`, `react-hook-form ^7.55`. | HIGH [R] |
| clsx | 2.1.1 (2024-04, stable, finished) | MIT | Class joining | Used verbatim by UI-spec Appendix D. | HIGH [R] |
| @fontsource/barlow-condensed | 5.3.0 | **OFL-1.1** | Display font (600/700/800/800-italic) | Font license, not code. PRD §13 requires fonts "licensed for web use", which OFL satisfies. Record it as an explicit allow-list exception. Import per-subset CSS (for example `latin-600.css`, `latin-ext-600.css`) instead of `600.css` to keep CSS small. The UI spec's import line uses all subsets. | HIGH [R] |
| @fontsource-variable/archivo | 5.3.0 | **OFL-1.1** | UI font (variable); `₱` U+20B1 is in **latin-ext** | Same as above. The `latin-ext` subset must ship. | HIGH [R] |
| web-vitals | 6.2.3 | Apache-2.0 | RUM (`onLCP`, `onCLS`, `onINP`), only after analytics consent | Load dynamically after consent so it never runs pre-consent. | HIGH [R] |
| @tanstack/react-virtual | 3.14.13 | MIT | Virtualize lists > 100 rows (PRD §7.1) | Headless, so no visual conflict with the UI spec. Add it only in the phase that needs it. | HIGH [R] |
| workbox-window | 7.4.1 | MIT | SW update prompt (via vite-plugin-pwa's `virtual:pwa-register/react`) | Comes through vite-plugin-pwa. | HIGH [R] |
| *(icons)* | in-house `src/ui/icons.ts` (Lucide v0.460.0 node data) **or** `lucide-react` 1.52.0 | ISC (Lucide; some icons derive from Feather, MIT) | Icons | **Conflict C-10, not decided here.** See "Icons" under Stack Patterns. | HIGH [R] |
| *(charts)* | **none** | — | Dashboard and metrics charts | The UI spec's `IncomeExpenseChart` is pure SVG (Appendix D). Build the ANL-08 trend and device-split charts the same way (`// SPEC-GAP:`). | HIGH (read spec) |
| *(HTTP)* | **none**: in-house `lib/http/httpClient.ts` over `fetch` (+ XHR only for upload progress) | — | HTTP | axios is forbidden (Prime Directive 8). | HIGH |

### Build-Time / Dev Dependencies (web)

| Package | Version | License | Purpose | Notes | Conf. |
|---|---|---|---|---|---|
| `typescript` → `npm:@typescript/typescript6@^6.0.2` | 6.0.2 | Apache-2.0 | TS **API** for typescript-eslint, MSW types, other tools | `require('typescript')` resolves to the 6.0 API. Also provides the `tsc6` binary. | HIGH [R][D] |
| `@typescript/native` → `npm:typescript@^7.0.2` | 7.0.2 | Apache-2.0 | Fast `tsc --noEmit` (Go native) | Run as `node node_modules/@typescript/native/bin/tsc -p tsconfig.json --noEmit`, or via a package script. **Don't** use `@typescript/native-preview`: it's a stale dev build from 2026-07-07. | HIGH [R][D] |
| @types/react, @types/react-dom | 19.3.0 | MIT | Types | — | HIGH [R] |
| @types/node | 26.6.4 | MIT | Types for `vite.config.ts` and scripts | Node 24 is the runtime. Either version-match it (`@types/node@24`) or accept 26. Prefer `^24` to match the CI Node. | MEDIUM |
| @rolldown/plugin-babel | 0.2.4 | MIT | Babel pass for the React Compiler | Pre-1.0 but the official Vite/Rolldown path. Peers `vite ^8`, `@babel/core ^7.29 \|\| ^8`. | HIGH [R][D] |
| babel-plugin-react-compiler | **1.0.0** (stable since 2025-10-07) | MIT | Automatic memoization (PRD §7.1) | Wire with `reactCompilerPreset()`. Narrow its `rolldown.filter` to `src/**/*.tsx` to keep builds fast. | HIGH [R][D] |
| @babel/core | **7.29.7** (pin 7.x) | MIT | Babel engine | Babel **8.0.6** exists, and `@rolldown/plugin-babel` accepts it, but `babel-plugin-react-compiler` 1.0.0 was built against Babel 7 (`@babel/types ^7.26`). Stay on 7.29.x until React documents Babel 8 support. | MEDIUM [R] |
| @types/babel__core | 7.20.5 | MIT | Types (plugin-react README asks for it with TS + Babel 7) | — | MEDIUM [D] |
| vite-plugin-pwa | **1.3.0** now, or **2.0.0** after cool-down | MIT | Manifest + static-asset SW + "new version available" prompt | 2.0.0 (2026-10-03) only widens the `@vite-pwa/assets-generator` peer to ^2. Both peer `vite ^8`. Use `registerType: 'prompt'` and `injectRegister: null` with manual registration (avoids an inline script that the strict CSP would block). Set `navigateFallbackDenylist: [/^\/api\//]` and add **no** `runtimeCaching` for `/api`. | HIGH [R], MEDIUM [K] |
| eslint | **10.12.0** | MIT | Lint (flat config only) | ESLint 9 is EOL as of 2026-08-06. | HIGH [R][D] |
| @eslint/js | 10.0.1 | MIT | `js.configs.recommended` | — | HIGH [R] |
| typescript-eslint | **8.71.1** | MIT | `strictTypeChecked` + `stylisticTypeChecked` with `parserOptions.projectService: true` | Needs the TS 6 alias (above). Peers `eslint ^8.57 \|\| ^9 \|\| ^10`. | HIGH [R] |
| eslint-plugin-react-hooks | **7.1.1** | MIT | Hooks rules + React Compiler diagnostics (`recommended` / `recommended-latest`) | Peers ESLint up to 10. Expect the compiler rules to flag some verbatim Appendix D code. | HIGH [R][D] |
| **eslint-plugin-jsx-a11y-x** | **0.2.0** (es-tooling/e18e fork, 2026-05-10) | MIT | WCAG lint (`configs.strict`) | Fork of jsx-a11y with an ESLint 10 peer. The rule namespace becomes `jsx-a11y-x/`. Depends on axe-core (MPL-2.0). | HIGH [R][D] |
| eslint-plugin-react-refresh | 0.5.7 | MIT | Fast-refresh export hygiene | Optional. It's already in the scaffold. | HIGH [R] |
| @tanstack/eslint-plugin-query | 5.104.1 | MIT | Query-key and `queryFn` rules | Optional, recommended. | HIGH [R] |
| globals | 17.13.0 | MIT | Browser/node globals for flat config | — | HIGH [R] |
| prettier | 3.9.9 | MIT | Formatting (`prettier --check` in CI) | — | HIGH [R] |
| eslint-config-prettier | 10.1.8 | MIT | Turn off stylistic rules that conflict with Prettier | Peers `eslint >=7`. | HIGH [R] |
| prettier-plugin-tailwindcss | 0.8.1 | MIT | Optional class sorting | Optional. Skip it if it fights the verbatim UI-spec markup. | MEDIUM [R] |
| rollup-plugin-visualizer | 7.1.1 | MIT | Bundle analysis artifact in CI (PRD §7.1) | Peers `rolldown 1.x`, so it works with Vite 8. | HIGH [R] |
| *(budget gate)* | **in-house script** over the Vite `build.manifest` + `zlib.gzipSync` | — | Fail CI when public initial JS > 150 KB gz, admin > 250 KB gz, or CSS > 35 KB gz | "Route initial JS" means walking the manifest's static `imports` per entry or route, which `size-limit` doesn't model natively. Zero dependencies. | MEDIUM |
| openapi-typescript | 7.13.0 | MIT | Generate `web/src/types` DTOs from the OpenAPI doc + CI drift check (PRD §15 SHOULD) | **Peers `typescript ^5.x`**, which clashes with both the TS 6 alias and TS 7. Install it in an isolated `tools/openapi-gen/` package with its own TS 5.9, or hand-write DTOs and check drift another way. | HIGH [R] (conflict), MEDIUM (fix) |

### .NET Test Stack

| Package | Version | License | Purpose | Notes | Conf. |
|---|---|---|---|---|---|
| xunit.v3 | **4.0.1** (2026-09-12) | Apache-2.0 | Test framework | 4.0 dropped MTP v1. `xunit.v3` → `xunit.v3.mtp-v2`. Test projects are `OutputType Exe`. Supports assembly fixtures (good for one shared SQL container). | HIGH [R][D] |
| Microsoft.Testing.Platform | 2.5.0 (transitive) | MIT | Runner | Enable via `global.json` `"test": {"runner": "Microsoft.Testing.Platform"}` on the .NET 10 SDK. | HIGH [R][D] |
| xunit.runner.visualstudio | 4.0.0 | Apache-2.0 | VS/VSTest discovery compatibility | xUnit recommends keeping it (and `Microsoft.NET.Test.Sdk` 18.10.1, MIT) until all IDEs use MTP. Visual Studio 18.x supports MTP. | MEDIUM [D] |
| NSubstitute | **6.2.0** (2026-08-11) | BSD-3-Clause | Mocks | v6 targets net8 + netstandard2.0 and removed obsolete API. 6.1 reverted 6.0's nullable annotations. Active. | HIGH [R][D] |
| NSubstitute.Analyzers.CSharp | 1.0.17 (2024-02) | MIT (license file) | Analyzer for misuse | Old but still functional [K]. Optional. | MEDIUM |
| Shouldly | **4.3.0** (2025-01-23) | BSD-3-Clause | Assertions | 5.0.0-preview.2 (2026-07) is in progress. Stay on 4.3.0 stable. It pulls DiffEngine/EmptyFiles (MIT). | HIGH [R] |
| Testcontainers + Testcontainers.MsSql | **4.15.0** (2026-09-06) | MIT | SQL Server 2025 in Docker for integration tests | Use `new MsSqlBuilder("mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04")`. The parameterless constructor is obsolete and defaults to 2022. Docker Engine v29 issues were fixed upstream. **Linux containers only**, so this runs on `ubuntu-latest` CI, not `windows-latest`. | HIGH [R] |
| Respawn | **7.0.0** (2025-11-30) | Apache-2.0 | Fast DB reset between tests | Set `TablesToIgnore = ["__EFMigrationsHistory"]`. It does **not** reset SEQUENCEs, so tests must not assume specific order numbers. | HIGH [R], MEDIUM [K] |
| NetArchTest.Rules **(PRD-pinned)** | 1.3.2 (**2021-05-23**, unmaintained) | MIT on GitHub; **no license metadata in nuspec** | Architecture tests | Works (it reads IL via Mono.Cecil ≥ 0.11.3). It's a CWE-1104 "unmaintained component" concern, and nuget-license needs a manual override mapping. | HIGH [R] |
| TngTech.ArchUnitNET + .xUnitV3 *(alternative)* | 0.13.4 (2026-08-20) | Apache-2.0 | Architecture tests (maintained) | Richer rules (layers, cycles, attributes). The adapter depends on `xunit.v3.assert ≥ 1.1.0`. Pulls Newtonsoft.Json (MIT) and JetBrains.Annotations (MIT). | HIGH [R] |
| coverlet.MTP | **10.1.0** (2026-09-27) | MIT | Coverage under MTP (`--coverlet --coverlet-output-format cobertura`) | `coverlet.collector` 10.1.0 is VSTest-only, so don't use it with MTP. The docs list threshold enforcement as not yet supported. | HIGH [R][D] |
| ReportGenerator (dotnet tool `dotnet-reportgenerator-globaltool`) | 5.5.11 | Apache-2.0 | Merge Cobertura + enforce per-assembly thresholds (Domain 100%, Application ≥ 95%) + HTML artifact | `-minimumCoverageThresholds` / risk-hotspot settings, or parse Cobertura in a script. | MEDIUM [R][K] |
| Bogus | 35.6.5 | MIT | Fake-data builders for the dev seed and tests (optional) | Optional. Plain builders are fine too. | HIGH [R] |
| Microsoft.Testing.Extensions.CodeCoverage | 18.12.0 | **Microsoft proprietary ("MICROSOFT .NET LIBRARY" terms)** | — | **Forbidden** by the license allow-list. Use coverlet.MTP. | HIGH [R] |

### Web Test Stack

| Package | Version | License | Purpose | Notes | Conf. |
|---|---|---|---|---|---|
| vitest | **5.0.3** (5.0.0 on 2026-09-03) | MIT | Unit/component tests | Node ≥ 22.12, peer `vite ^6.4 \|\| ^7 \|\| ^8`. **Breaking:** custom matcher typing is now `Matchers<R, T>`, `clearMocks` defaults to `true`, and unawaited `.resolves`/`.rejects` fail tests. | HIGH [R][D] |
| @vitest/coverage-v8 | 5.0.3 | MIT | Coverage + thresholds (`lib/http/**` 100%, global ≥ 90%) | v8 provider now uses AST-based remapping. Glob-specific thresholds are supported. | HIGH [R][D] |
| jsdom | 30.1.2 | MIT | DOM environment | Node `^22.22.2 \|\| ^24.15.0 \|\| >=26`. Prefer it over happy-dom for axe accuracy [K]. | HIGH [R] |
| @testing-library/react | 16.3.3 | MIT | Component rendering | Peers `@testing-library/dom ^10`. | HIGH [R] |
| @testing-library/dom | 10.4.2 | MIT | Peer of RTL | — | HIGH [R] |
| @testing-library/user-event | 14.6.7 | MIT | Realistic interactions | — | HIGH [R] |
| @testing-library/jest-dom | 7.0.1 | MIT | DOM matchers (`import '@testing-library/jest-dom/vitest'`) | Peers `vitest >=0.32`. | HIGH [R] |
| **vitest-axe (PRD-pinned)** | 0.1.0 (**2022-10-21**); 1.0.0-pre.5 (2025-01) | MIT (depends on axe-core MPL-2.0) | `toHaveNoViolations` | Effectively unmaintained. It installs (peer `vitest >=0.16`), but its type augmentation predates Vitest 5's `Matchers<R, T>`, so add a local `.d.ts`. **Recommended alternative with the same intent:** a ~20-line in-house matcher in `src/test/axe.ts` calling `axe-core`'s `run()` directly. It's fully typed, with no stale wrapper. | HIGH [R], MEDIUM (fix) |
| axe-core | **4.13.x** (pin to match @axe-core/playwright; 4.14.0 is latest) | **MPL-2.0** | a11y engine for component tests | Pin one version via `overrides` so component and page tests run the same ruleset. In jsdom, `color-contrast` can't evaluate layout, so contrast is proven at the Playwright level. | HIGH [R], MEDIUM [K] |
| msw | **3.0.2** (3.0.0 on 2026-09-28) | MIT | Network mocking (component tests only) | **v3, not v2**: ESM-only, Node ≥ 22, TS ≥ 5.9 (supports 6/7), `worker.stop()` is now async, `onUnhandledRequest` → `onUnhandledFrame`. Use `setupServer` from `msw/node`. | HIGH [R][D] |
| @playwright/test | **1.63.0** | Apache-2.0 | E2E: Chromium, Firefox, WebKit, plus Pixel/iPhone emulation | `webServer.port: 5199`, `reuseExistingServer: false` (CLAUDE.md). Fail on console warnings/errors via a fixture. | HIGH [R] |
| @axe-core/playwright | **4.13.0** | **MPL-2.0** | Page-level axe (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) | Pins `axe-core ~4.13.0`. | HIGH [R] |
| @lhci/cli | 0.15.1 (2025-06-25) | Apache-2.0 | Lighthouse CI assertions (≥ 95 on every category, mobile) | Slow-moving: it bundles **lighthouse 12.6.1** while upstream is 13.5.0, and the repo was last pushed 2026-03-27. It's still the standard tool. `treosh/lighthouse-ci-action` 12.6.2 wraps it. Re-check before the hardening phase. | HIGH [R], MEDIUM (maint.) |

### CI / Security / Compliance Tooling

| Tool | Version | License | Purpose | Notes | Conf. |
|---|---|---|---|---|---|
| actions/checkout | v7.0.1 | MIT | — | **Pin by full commit SHA** with a `# v7.0.1` comment. Dependabot `github-actions` updates SHA pins. Resolve the *commit* SHA, not the annotated-tag object SHA. | HIGH [R] |
| actions/setup-dotnet | v6.0.0 | MIT | Uses `global.json` | — | HIGH [R] |
| actions/setup-node | v7.0.0 | MIT | Node 24 (≥ 24.15 for jsdom 30; local is 24.21) | — | HIGH [R] |
| actions/cache · actions/upload-artifact | v6.1.0 · v7.0.1 | MIT | NuGet/npm/Playwright caches, reports | — | HIGH [R] |
| github/codeql-action | v4.38.2 (bundle 2.27.1) | MIT (action); CodeQL CLI terms restrict private-repo use without a license | C# + JS/TS scanning | **Free only on public repos.** Private repos need GitHub Code Security. | HIGH [R], MEDIUM [W] |
| actions/dependency-review-action | v5.0.0 | MIT | Block vulnerable or disallowed-license deps on PRs (`allow-licenses`) | Same licensing gate as CodeQL. | HIGH [R], MEDIUM [W] |
| Dependabot (`.github/dependabot.yml`) | — | — | nuget, npm, github-actions, docker | Free on private repos. Use a `cooldown` (default-days 7–14) to absorb the "too-new" signal [K]. | MEDIUM |
| zaproxy/action-baseline | v0.15.0 (2025-10-24) | Apache-2.0 | ZAP baseline vs staging | Runs on ubuntu. Commit `.zap/rules.tsv` for accepted findings. | HIGH [R] |
| step-security/harden-runner | v2.22.0 | Apache-2.0 | Egress audit/block on runners (T1195 supply chain) | Optional, recommended. | HIGH [R] |
| nuget-license (dotnet tool) | 4.0.18 (2026-09-21) | Apache-2.0 | NuGet license report + allow-list gate → THIRD-PARTY-NOTICES (server) | Needs an override entry for NetArchTest.Rules (no license metadata). | HIGH [R] |
| license-checker-rseidelsohn | 5.0.1 | BSD-3-Clause | npm license report + `--onlyAllow` gate (needs Node ≥ 24) | Covers dev deps too, which is where MPL-2.0 shows up. | HIGH [R] |
| Vite `build.license` | built into Vite 8 | — | Emits licenses of **bundled** (shipped) deps (`.vite/license.md` or `.json`) | The authoritative source for the client half of THIRD-PARTY-NOTICES. Add Lucide's ISC + Feather MIT notice manually if `icons.ts` is used, since copied node data isn't a dependency. | HIGH [D] |
| CycloneDX (dotnet tool) | 6.2.0 | Apache-2.0 | Optional SBOM | Optional. | HIGH [R] |
| gitleaks *(only if no GHAS)* | — | MIT [K] | Secret scanning in CI for a private repo without Secret Protection | Can't replace push protection, only detection. | LOW [K] |

### Hosting & Deployment

| Item | Recommendation | Conf. |
|---|---|---|
| SmarterASP.NET runtime | The site lists ".NET 10.x" and "SQL Server 2025". **Verify in the control panel** that the installed ASP.NET Core Module + runtime patch is ≥ 10.0.12, that the app pool is **64-bit** and set to "No Managed Code", and that the database reports compat level 170. | LOW [W/D] |
| Publish mode | **Framework-dependent** (`net10.0`, `win-x64` not required) if the host's 10.0.x patch is current. Framework-dependent apps roll forward to the latest installed 10.0.x patch. If the host lags on security patches, publish **self-contained `win-x64`** (`-r win-x64 --self-contained true`). That adds about 70–100 MB to the upload but gives you control of the patch level. A self-contained x64 app **fails in a 32-bit app pool**. | MEDIUM [K] |
| IIS hosting model | `hostingModel="inprocess"` (`AspNetCoreModuleV2`). `web.config` should remove `Server` and `X-Powered-By`, set `stdoutLogEnabled="false"` in production, apply the static caching rules from PRD §19.1, and enable `app_offline.htm` during deploy. | HIGH [K] |
| Deploy | **Web Deploy (MSDeploy) from a `windows-latest` job.** The runner image has the VS WebDeploy component and .NET SDK 10.0.401. Use `msdeploy.exe -verb:sync -source:contentPath=<publishDir> -dest:contentPath=<site>,computerName="https://<host>:8172/msdeploy.axd?site=<site>",userName=…,password=…,authType=Basic -enableRule:AppOffline -skip:Directory=\\logs`. Credentials go in GitHub **environment** secrets (`staging`, `production` with required reviewers). Build and test on ubuntu, then hand the publish artifact to the Windows deploy job. | MEDIUM [R][K] |
| Plan sizing | Basic: 1 DB / 1 GB / 256 MB app pool / no scheduled tasks. **Advance** ($4.95: 6 DBs, 3 GB, 512 MB) is the realistic floor for staging + production. **Premium** has 3 GB memory and scheduled tasks. Without a host scheduler, use a GitHub Actions cron that calls the secret-protected maintenance endpoint (PRD §19.3). | LOW [W] |
| Migrations in production | `dotnet ef migrations script --idempotent` → review → back up → apply via SSMS (SmarterASP gives SSMS access). Never `Database.Migrate()` at startup. | HIGH (PRD) |

---

## Installation

### `global.json`
```json
{
  "sdk": { "version": "10.0.401", "rollForward": "latestPatch" },
  "test": { "runner": "Microsoft.Testing.Platform" }
}
```

### `Directory.Packages.props` (central versions; no floating versions)
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
    <CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>
  </PropertyGroup>
  <ItemGroup>
    <!-- Runtime -->
    <PackageVersion Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.12" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.12" />
    <PackageVersion Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="10.0.12" />
    <PackageVersion Include="Microsoft.AspNetCore.DataProtection.EntityFrameworkCore" Version="10.0.12" />
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.12" />
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.12" />
    <PackageVersion Include="Microsoft.Extensions.Caching.Hybrid" Version="10.10.0" />
    <PackageVersion Include="Microsoft.Extensions.Http.Resilience" Version="10.10.0" />
    <PackageVersion Include="FluentValidation" Version="12.1.1" />
    <PackageVersion Include="FluentValidation.DependencyInjectionExtensions" Version="12.1.1" />
    <PackageVersion Include="MailKit" Version="4.18.1" />
    <PackageVersion Include="CloudinaryDotNet" Version="1.29.3" />
    <PackageVersion Include="Serilog.AspNetCore" Version="10.0.0" />
    <PackageVersion Include="Serilog.Sinks.File" Version="7.0.0" />
    <!-- Tests -->
    <PackageVersion Include="xunit.v3" Version="4.0.1" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="4.0.0" />
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="18.10.1" />
    <PackageVersion Include="NSubstitute" Version="6.2.0" />
    <PackageVersion Include="NSubstitute.Analyzers.CSharp" Version="1.0.17" />
    <PackageVersion Include="Shouldly" Version="4.3.0" />
    <PackageVersion Include="Testcontainers.MsSql" Version="4.15.0" />
    <PackageVersion Include="Respawn" Version="7.0.0" />
    <PackageVersion Include="NetArchTest.Rules" Version="1.3.2" /> <!-- or TngTech.ArchUnitNET(.xUnitV3) 0.13.4 -->
    <PackageVersion Include="coverlet.MTP" Version="10.1.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.12" />
    <PackageVersion Include="Microsoft.Extensions.TimeProvider.Testing" Version="10.10.0" />
    <PackageVersion Include="Microsoft.Extensions.Diagnostics.Testing" Version="10.10.0" />
  </ItemGroup>
</Project>
```
Local tools (`dotnet new tool-manifest`): `dotnet-ef` 10.0.12, `dotnet-reportgenerator-globaltool` 5.5.11, `nuget-license` 4.0.18 (and `CycloneDX` 6.2.0, optional).

### `web/` (npm 11, Node 24; exact versions via `save-exact=true` in `.npmrc`)
```bash
# Runtime
npm i react@19.3.0 react-dom@19.3.0 react-router@8.4.0 @tanstack/react-query@5.104.1 \
  react-hook-form@7.89.0 zod@4.6.5 @hookform/resolvers@5.9.1 clsx@2.1.1 nuqs@2.10.1 \
  @fontsource/barlow-condensed@5.3.0 @fontsource-variable/archivo@5.3.0 web-vitals@6.2.3

# TypeScript (side-by-side, per Microsoft's TS 7 guidance)
npm i -D "typescript@npm:@typescript/typescript6@6.0.2" "@typescript/native@npm:typescript@7.0.2" \
  @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@24

# Build
npm i -D vite@8.3.3 @vitejs/plugin-react@6.1.2 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 \
  @rolldown/plugin-babel@0.2.4 @babel/core@7.29.7 @types/babel__core@7.20.5 babel-plugin-react-compiler@1.0.0 \
  vite-plugin-pwa@1.3.0 rollup-plugin-visualizer@7.1.1

# Lint / format
npm i -D eslint@10.12.0 @eslint/js@10.0.1 typescript-eslint@8.71.1 eslint-plugin-react-hooks@7.1.1 \
  eslint-plugin-jsx-a11y-x@0.2.0 eslint-plugin-react-refresh@0.5.7 @tanstack/eslint-plugin-query@5.104.1 \
  globals@17.13.0 prettier@3.9.9 eslint-config-prettier@10.1.8

# Tests
npm i -D vitest@5.0.3 @vitest/coverage-v8@5.0.3 jsdom@30.1.2 @testing-library/react@16.3.3 \
  @testing-library/dom@10.4.2 @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 \
  axe-core@4.13 msw@3.0.2 @playwright/test@1.63.0 @axe-core/playwright@4.13.0 @lhci/cli@0.15.1 \
  license-checker-rseidelsohn@5.0.1
# (+ vitest-axe@0.1.0 only if the owner insists on the literal package; see Web Test Stack)
```

### `vite.config.ts` delta vs UI-spec Appendix D.7 (React Compiler, the only plugin addition)
```ts
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
// plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()]
// server: { port: 5180, strictPort: true, proxy: { '/api': 'https://localhost:7028' } }
// build:  { outDir: '../src/Csps.Server/wwwroot', emptyOutDir: true, manifest: true, license: true }
```

---

## Alternatives Considered

| Recommended | Alternative | When to use the alternative |
|---|---|---|
| eslint-plugin-jsx-a11y-x 0.2.0 on ESLint 10 | Official eslint-plugin-jsx-a11y 6.10.2 on **ESLint 9.39.5 (EOL)** | Only if the owner requires the exact PRD package name and accepts EOL lint tooling until PR #1081 ships. Revisit when jsx-a11y ≥ 6.11 or 7 adds an ESLint 10 peer. |
| TS 6 alias + TS 7 CLI | Plain `typescript@6.0.3` only | If the dual-alias setup confuses editors or tools. You lose TS 7 speed and diverge from the UI spec's "tested with TS 7.0". |
| React Compiler via Babel | plugin-react `compiler: true` (Rust/Oxc) | When it leaves "experimental" and its `oxc-transform-react` peer tracks current releases. That would remove Babel from the build. |
| NetArchTest.Rules 1.3.2 (PRD pin) | **TngTech.ArchUnitNET 0.13.4 + .xUnitV3** (maintained) · NetArchTest.eNhancedEdition 1.4.5 | ArchUnitNET if the owner accepts a PRD substitution for maintenance reasons (CWE-1104). eNhancedEdition if a near-identical API is wanted. |
| In-house axe matcher over axe-core | vitest-axe 0.1.0 (PRD pin) · jest-axe 11.0.0 (MIT, active) | vitest-axe if the literal package name matters (add a local `.d.ts`). jest-axe also works under Vitest's `expect.extend` but brings jest-matcher-utils. |
| coverlet.MTP + ReportGenerator | Microsoft.Testing.Extensions.CodeCoverage | Never. Its license is proprietary. |
| HybridCache (application-level) | Output caching only | Output caching is enough if the Android client is out of scope forever. It's still fine for anonymous public GETs. |
| Serilog File sink | Serilog.Sinks.MSSqlServer | Never for app logs on a 1–10 GB shared database. |
| Framework-dependent publish | Self-contained win-x64 | If the host runtime patch lags 10.0.12+ or the hosting bundle is missing. |
| LocalDB for local dev/tests | Testcontainers + Docker SQL 2025 | See Stack Patterns. CI must use the container either way. |
| No chart library | uPlot 1.6.32 (MIT, last release 2025-03) | Only if a chart needs zoom/pan or thousands of points. Recharts and Chart.js would blow the 250 KB admin budget. |
| openapi-typescript in an isolated tool folder | Hand-written DTO types + contract tests | If the isolated folder is too much ceremony. |

---

## What NOT to Use

| Avoid | Why | Use instead |
|---|---|---|
| **axios** (and wrappers) | PRD Prime Directive 8 | In-house `lib/http/httpClient.ts` |
| **MediatR** | PRD §2 forbidden. MediatR is also commercially licensed from v13 [K]. | One handler class per use case |
| **AutoMapper** | PRD §2 forbidden. Commercially licensed from v15 [K]. | Manual mapping extension methods |
| **FluentAssertions 8.x** | Verified: Xceed **Community License (Non-Commercial)** inside the 8.11.0 package | Shouldly 4.3.0 (PRD pin). AwesomeAssertions 9.6.0 (Apache-2.0) is the FA-compatible fork if ever needed. |
| jQuery, MUI/shadcn/Bootstrap/any UI kit | PRD §2 + UI spec §0 hard rule 1 | UI-spec Appendix D components |
| `react-router-dom` | Removed in React Router v8 (frozen at 7.18.4) | `react-router` (+ `react-router/dom`) |
| `@tanstack/react-query@6` | Doesn't exist | 5.104.x |
| MSW v2 APIs / docs | v3.0 is current: ESM-only, renamed options, async `worker.stop()` | MSW 3.0.2 |
| `@typescript/native-preview` | Superseded by the TS 7.0 GA package. Last dev build was 2026-07-07. | `@typescript/native` alias of `typescript@7.0.2` |
| `typescript@7` as the bare `typescript` dependency | typescript-eslint peer `<6.1.0`, so npm ERESOLVE. TS 7 has no stable API until 7.1. | The alias pair (Installation) |
| ESLint 9.x | EOL since 2026-08-06 | ESLint 10.12 |
| eslintrc / `.eslintrc.*` | ESLint 10 is flat-config only | `eslint.config.ts`/`.js` |
| `coverlet.collector` with xUnit v3 4.x | VSTest-only; xUnit v3 4.x is MTP-v2-only | coverlet.MTP |
| `Microsoft.Testing.Extensions.CodeCoverage` | Proprietary Microsoft license | coverlet.MTP |
| `FluentValidation.AspNetCore` | Deprecated auto-validation pipeline | Explicit validation in handlers or a single endpoint filter |
| Swashbuckle / NSwag for doc generation | .NET 10 has built-in OpenAPI 3.1 | `Microsoft.AspNetCore.OpenApi`. A UI viewer (Scalar) is dev-only; it loads CDN assets, which break the strict CSP. |
| `MapIdentityApi` / `AddIdentity` cookie defaults | Opaque tokens, no email-2FA or refresh-family design, cookie redirects | `AddIdentityCore` + custom JWT/refresh per PRD §8 |
| `System.IdentityModel.Tokens.Jwt` for issuing | Legacy handler | `JsonWebTokenHandler` |
| `System.Random`, GUID slicing for codes | CWE-330/338 | `RandomNumberGenerator.GetInt32` |
| `DateTime.Now` / `DateTime.UtcNow` in code | Untestable; PRD §3.3 | `TimeProvider` (+ `FakeTimeProvider` in tests) |
| `Database.Migrate()` at startup | PRD §19.2 | Reviewed idempotent scripts |
| Serilog MSSqlServer sink / Seq on shared hosting | Database quota; no long-running agents | File sink outside `wwwroot` |
| `mcr.microsoft.com/mssql/server:2025-latest` in code | Non-reproducible | `2025-CU9-ubuntu-24.04` (bump deliberately) |
| `Microsoft.AspNetCore.SpaProxy` (scaffold) | Doesn't fit the build-into-`wwwroot` model. The scaffold references it with a **floating** `10.*-*` version, which violates PRD §17.1. | Vite dev server with `/api` proxy → Kestrel 7028 |
| Recharts / Chart.js / ECharts | Budget (admin ≤ 250 KB gz), and the UI spec already draws charts in SVG | Hand-rolled SVG per UI spec |
| `vite-plugin-pwa` `injectRegister: 'inline'` | Inline script violates `script-src 'self'` | `injectRegister: null` + `virtual:pwa-register/react` |
| `nuqs/adapters/react-router` (generic, deprecated), `/v6`, `/v7`, `nuqs/adapters/react`; `nuqs@2.10.2-beta.1`; the nuqs `startTransition` option; `shallow: false`; `parseAsIsoDate` | Deprecated or wrong router adapters; a beta inside the cool-down; nuqs bugs #1567 and #1563; UTC dates shift the day in Manila | `nuqs/adapters/react-router/v8`, a stable version at least 14 days old, the default `shallow: true` and the shared `parseAsBusinessDate` (`YYYY-MM-DD` strings) (WEB-10) |

---

## Stack Patterns by Variant

**Icons (conflict C-10: PRD `lucide-react` vs UI-spec in-house `icons.ts`). Implications only, not decided:**

| | In-house `icons.ts` (Lucide **v0.460.0** node data, typed `IconName`) | `lucide-react` **1.52.0** (ISC) |
|---|---|---|
| Visual fidelity | Exactly the approved drawings | v1 changed defaults (`aria-hidden` on by default, brand icons removed) and 1.x drawings may differ from 0.460. Risk of drift from approved screenshots. |
| Bundle | One module map holding all **57** icons. A single object isn't tree-shaken by key, so every chunk that imports `Icon` carries all 57, **including the public route** (a few KB gz; measure in Phase 1). | Per-icon named imports tree-shake. The public route only pays for what it uses, plus a small shared `createLucideIcon` base. |
| Maintenance / supply chain | Frozen static data, zero dependency, no Dependabot churn. You must add the Lucide ISC + Feather MIT notice to THIRD-PARTY-NOTICES manually. | Active (releases weekly). Dependabot noise. The notice comes via Vite `build.license`. |
| Type safety | Typed union in `icons.ts` (`"trahs-2"` is a compile error) | Import names are type-checked too |
| PRD/UI-spec text | UI spec §2.6: "Don't add lucide-react" | PRD §2 and §7.1 name it |

**Local database (conflict C-20: Docker + Testcontainers vs CLAUDE.md LocalDB). Trade-offs only:**
- **LocalDB facts:** On this machine it's `MSSQLLocalDB` **17.0.4025.3 (SQL Server 2025)**, Express-based (50 GB per database in 2025). It supports the native **`json` type** (GA in 2025, every compat level), **SEQUENCE**, **`rowversion`**, `datetimeoffset`/`date`, `JSON_VALUE ... RETURNING`, and the `modify` method. It's Windows-only and connects over named pipes, so it **uses no TCP ports**. No full-text search or remote connections, which the app doesn't need. [R][D] HIGH (json-in-LocalDB is inferred from engine version 17 = SQL 2025; MEDIUM until a migration test proves it)
- **Docker/Testcontainers on this shared machine:** Testcontainers binds container port 1433 to a **random host port**. Docker Desktop (WSL2) allocates these from the Linux ephemeral range, which overlaps CLAUDE.md's "avoid 49152–65535" rule. If containers are used locally, use **one shared container per test run** (xUnit v3 assembly fixture) with a fixed binding in a safe range (for example `WithPortBinding(5190, 1433)`, checked by the preflight script), plus per-class databases named `CSPS_Test_<guid>` + Respawn. [K] MEDIUM
- **CI is Linux** (GitHub `ubuntu-latest`), so it can't run LocalDB. CI must use the SQL 2025 container either way. A test fixture that picks the connection by environment (`CSPS_TEST_SQL=localdb|container`) lets both coexist. The cost is two code paths in the fixture, and LocalDB-only quirks escaping to CI (or the reverse).
- **Legacy `.bak` restore:** CLAUDE.md says restore into LocalDB as `CSPS_Dev`. PRD §16.1 says a disposable instance named for the purpose (`CSPS_Legacy_Restore`). LocalDB can `RESTORE` a 2025-or-older `.bak`. Naming and isolation are the owner's call (conflict already logged as C-20).
- **EF compat level:** Configure `UseSqlServer(cs, o => o.UseCompatibilityLevel(170))` **only** after confirming production reports 170. At < 170, EF stores JSON as `nvarchar(max)`. Moving from 160 to 170 later makes EF *alter existing nvarchar JSON columns to `json`* in the next migration, which is a one-way door. Decide once in Phase 1.

**Repository visibility (PRD §18 assumes "private" + CodeQL + secret scanning + dependency review):**
- **Public repo:** all three are free.
- **Private repo without GitHub Code Security / Secret Protection:** CodeQL, dependency-review-action and push protection are unavailable. Substitute NuGetAudit-as-error + `npm audit --audit-level=high` + `license-checker` / `nuget-license` allow-lists + gitleaks (detection only). That's weaker than the PRD's stated control set, so the owner must decide.

**Release cool-down (supply chain, ATT&CK T1195):**
- At Phase 1 install time, prefer versions at least 7–14 days old. Use `npm install --before=<ISO date>` [K] or pick the previous patch, and set Dependabot `cooldown`. Most "latest" versions in this file were flagged `too-new` by the GSD legitimacy seam only because of age. For each one, record either "aged" or "accepted with reason" in the Phase 1 RESEARCH.md.

**If the SmarterASP plan is Basic (256 MB):**
- Disable the React Compiler debug features (irrelevant server-side). Keep HybridCache small (size limits). Avoid self-contained publish where possible. Expect app-pool recycles under memory pressure, which makes the Data Protection DB persistence mandatory, not optional.

---

## Version Compatibility

| Package A | Compatible with | Notes |
|---|---|---|
| typescript-eslint 8.71.1 | typescript **≥ 4.8.4 < 6.1.0**; eslint ^8.57 / ^9 / ^10 | ❌ with bare `typescript@7.0.2`. ✅ with the `@typescript/typescript6@6.0.2` alias. |
| eslint-plugin-jsx-a11y 6.10.2 | eslint **≤ ^9** | ❌ ESLint 10.12. ✅ `eslint-plugin-jsx-a11y-x` 0.2.0 (`^9 \|\| ^10`). |
| eslint-plugin-react-hooks 7.1.1 | eslint up to ^10 | ✅ |
| @vitejs/plugin-react 6.1.2 | vite ^8; optional `@rolldown/plugin-babel ^0.1.7 \|\| ^0.2`, `babel-plugin-react-compiler ^1`, `oxc-transform-react ^0.152` | `oxc-transform-react` latest is 0.153.0, **outside** `^0.152`. Another reason to use the Babel compiler path. |
| @rolldown/plugin-babel 0.2.4 | vite ^8, @babel/core ^7.29 \|\| ^8 | Pin @babel/core 7.29.7 for the compiler. |
| @tailwindcss/vite 4.3.3 | vite ^5.2–^8 | ✅ |
| vitest 5.0.3 | vite ^6.4 / ^7 / ^8; Node ≥ 22.12 | ✅ Vite 8.3. Custom matchers need the `Matchers<R, T>` typing. |
| vitest-axe 0.1.0 | vitest ≥ 0.16 (peer) | Installs, but its types predate Vitest 5. |
| @testing-library/jest-dom 7.0.1 | vitest ≥ 0.32, @testing-library/dom 10.x | ✅ |
| msw 3.0.2 | typescript ≥ 5.9 (6/7 OK), Node ≥ 22, vite ≥ 6 (optional peer) | ✅ |
| openapi-typescript 7.13.0 | typescript **^5.x** | ❌ with the TS 6 alias / TS 7. Isolate it. |
| react-router 8.4.0 | react/react-dom ≥ 19.2.7, Node ≥ 22.22.0, Vite ≥ 7 | ✅ React 19.3, Node 24.21 (local). CI must use Node ≥ 22.22. |
| @tanstack/react-query 5.104.1 | react ^18 / ^19 | ✅ |
| nuqs 2.10.1 | react ≥ 18.2 / ^19; react-router ^5–^8 (optional peer) | ✅ React 19.3 + react-router 8.4.0 through `nuqs/adapters/react-router/v8` (jsdom probe 2026-10-07: read, push, `clearOnDefault` and Back work). With `@vitejs/plugin-react` 6.1.2, Vite emits no `"use client"` directive warnings. Phase 2 confirms zero React Compiler diagnostics. |
| @hookform/resolvers 5.9.1 | zod ^3.25 / ^4, react-hook-form ^7.55 | ✅ zod 4.6.5, RHF 7.89 |
| vite-plugin-pwa 1.3.0 / 2.0.0 | vite ^3–^8, workbox 7.4.1 | ✅ |
| rollup-plugin-visualizer 7.1.1 | rolldown 1.x | ✅ Vite 8 |
| jsdom 30.1.2 | Node ^22.22.2 / ^24.15.0 / ≥ 26 | ✅ Node 24.21. Pin the CI Node to ≥ 24.15. |
| @axe-core/playwright 4.13.0 | axe-core ~4.13.0 | Pin top-level axe-core 4.13.x so component and page rulesets match. |
| @lhci/cli 0.15.1 | bundles lighthouse 12.6.1 | Upstream lighthouse is 13.5.0, so scores may differ slightly from PageSpeed Insights. |
| xunit.v3 4.0.1 | MTP v2 only; .NET 10 SDK `global.json` test runner | ✅ coverlet.MTP 10.1.0 (needs MTP ≥ 2.0). ❌ coverlet.collector. |
| TngTech.ArchUnitNET.xUnitV3 0.13.4 | xunit.v3.assert ≥ 1.1.0 | ✅ xunit.v3 4.0.1 |
| Testcontainers.MsSql 4.15.0 | net8/9/10; explicit image required | ✅ SQL 2025 CU tags; Docker 29.x |
| EF Core 10.0.12 | .NET 10 runtime only; SQL 2025 `json` at compat ≥ 170 | Requires Microsoft.Data.SqlClient ≥ 6.1.6 |
| Microsoft.Extensions.* 10.10.0 (Hybrid, Resilience, TimeProvider.Testing) | net8+/netstandard2.0; depend on the 10.0.12 shared framework | ✅ |
| UI-spec `tsconfig.json` (Appendix D.7b) | TS 7 | ✅ No `baseUrl`. But it **sets `noUncheckedIndexedAccess: false`** and omits `exactOptionalPropertyTypes`/`verbatimModuleSyntax`, which conflicts with PRD §17.2. Turning those on may make verbatim Appendix D code fail to compile. Needs an owner/plan ruling; see the note below. |
| Node | 24.21 local; CI `setup-node` 24 | Satisfies every engine range above (strictest: jsdom 30 ≥ 24.15; license-checker-rseidelsohn ≥ 24). |

**New conflict surfaced by this research (not yet in PROJECT.md):** **C-22, tsconfig strictness.** UI-spec Appendix D.7b has `"noUncheckedIndexedAccess": false` and lacks `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` and `verbatimModuleSyntax`. PRD §17.2 requires all of them. Appendix D code was verified only under the UI-spec settings. Likewise, `typescript-eslint` `strict-type-checked`, `jsx-a11y` strict and react-hooks 7's compiler rules have never been run against Appendix D. Phase 1 should compile and lint Appendix D verbatim *first* and report the delta before anyone edits the "verbatim" code.

---

## License Audit Summary

| Package(s) | License | Ships to production? | Status vs PRD allow-list |
|---|---|---|---|
| All recommended NuGet runtime packages | MIT / Apache-2.0 | Yes | ✅ |
| Newtonsoft.Json (via CloudinaryDotNet) | MIT | Yes | ✅ |
| NSubstitute, Shouldly | BSD-3-Clause | No (tests) | ✅ |
| NetArchTest.Rules 1.3.2 | MIT (GitHub), **no nuspec license** | No | ✅ but needs a tool override |
| Microsoft.Testing.Extensions.CodeCoverage | Microsoft proprietary | No | ❌ don't use |
| FluentAssertions 8.x | Xceed Community (non-commercial) | No | ❌ forbidden |
| All recommended npm runtime packages | MIT / Apache-2.0 (web-vitals) / ISC (lucide) | Yes | ✅ |
| @fontsource/barlow-condensed, @fontsource-variable/archivo | **OFL-1.1** | Yes (font files) | ⚠ needs an explicit font exception (PRD §13 permits web-licensed fonts) |
| axe-core, @axe-core/playwright (also inside vitest-axe, jest-axe, jsx-a11y(-x)) | **MPL-2.0** | No (dev/test only) | ⚠ needs an explicit dev-only exception; the PRD mandates these tools |
| Transitive dev-only licenses commonly seen in JS toolchains (for example CC-BY-4.0 data packages, BlueOak-1.0.0, 0BSD, Python-2.0) | various | No | ⚠ expect a few; configure the license gate as **production-strict, dev-allow-list-with-review** [K] |
| SQL Server 2025 Developer/Express images, LocalDB | Microsoft EULA | Infrastructure, not a dependency | n/a, but note it in the RESEARCH.md |

---

## Sources

**Registries (2026-10-06, [R])**
- npm registry via `npm view <pkg> version license peerDependencies dependencies time dist-tags`: every npm package in this file
- npm download counts: `api.npmjs.org/downloads/point/last-week/<pkg>`
- NuGet v3 flat container + registration API (versions, publish dates, dependency groups); license files read from inside the `.nupkg` for Microsoft.Testing.Extensions.CodeCoverage, FluentAssertions, NSubstitute.Analyzers and Bogus
- `https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json`: runtime 10.0.12, SDK 10.0.401, C# 14.0, EOL 2028-11-14
- `https://mcr.microsoft.com/v2/mssql/server/tags/list`: SQL Server 2025 CU tags (latest CU9)
- GitHub Releases/Repos API: actions/checkout, setup-dotnet, setup-node, cache, upload-artifact, codeql-action (v4.38.2), dependency-review-action, zaproxy/action-baseline, treosh/lighthouse-ci-action, GoogleChrome/lighthouse-ci, step-security/harden-runner, NetArchTest (last release 2021-05-23), vitest-axe (2022-10-21), jsx-a11y, NSubstitute release notes, vite-plugin-pwa release notes
- `actions/runner-images` Windows2025-Readme: WebDeploy component, .NET SDK 10.0.401, Docker 29.7
- Local read-only: `SqlLocalDB info MSSQLLocalDB` → 17.0.4025.3; `dotnet --list-sdks/--list-runtimes`; scaffold `package.json` / `.csproj`

**Official docs / READMEs ([D])**
- [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/?p=5246): `@typescript/typescript6` alias recipe, removed options, new defaults, API in 7.1
- [vite-plugin-react README](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) and [React Compiler installation](https://react.dev/learn/react-compiler/installation): Babel preset path; Rust compiler experimental
- [ESLint version support](https://eslint.org/version-support/): v9 EOL 2026-08-06
- [jsx-a11y issues](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues?q=eslint+10): #1075 / #1081 open; [eslint-plugin-jsx-a11y-x README](https://github.com/es-tooling/eslint-plugin-jsx-a11y-x)
- [xUnit v3 4.0.0 release notes](https://xunit.net/releases/v3/4.0.0) and [xUnit MTP guide](https://xunit.net/docs/getting-started/v3/microsoft-testing-platform)
- [coverlet.MTP integration doc](https://github.com/coverlet-coverage/coverlet/blob/master/Documentation/Coverlet.MTP.Integration.md): threshold limitation
- [What's new in EF Core 10](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew): json type at compat 170, complex types, named filters, parameterized collections
- [ASP.NET Core 10 release notes](https://learn.microsoft.com/en-us/aspnet/core/release-notes/aspnetcore-10.0): AddValidation, OpenAPI 3.1, cookie API 401/403
- [SQL Server json data type](https://learn.microsoft.com/en-us/sql/t-sql/data-types/json-data-type): GA in SQL Server 2025, all compat levels
- [MSW v3.0.0 release](https://github.com/mswjs/msw/releases/tag/v3.0.0) · [Vitest 5 blog](https://vitest.dev/blog/vitest-5) · [React Router CHANGELOG v8.0.0](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md)
- [Vite build options: build.license](https://vite.dev/config/build-options)
- Testcontainers `MsSqlBuilder.cs` (develop branch): default image 2022-CU14, parameterless builder obsolete
- Lucide LICENSE (ISC + Feather-derived MIT portion)

**Web ([W], lower confidence)**
- [SmarterASP.NET ASP.NET hosting](https://www.smarterasp.net/asp.net_hosting) and [hosting plans](https://www.smarterasp.net/hosting_plans): .NET 10.x, SQL 2025, plan limits (verify in the control panel)
- [GitHub code security reference](https://docs.github.com/en/code-security/reference) and [secret protection pricing](https://docs.github.com/en/code-security/how-tos/secure-at-scale/configure-organization-security/configure-specific-tools/estimating-the-price-of-secret-protection): private-repo licensing
- [Why your TypeScript 7 upgrade broke ESLint](https://dev.to/dev_encyclopedia/why-your-typescript-7-upgrade-broke-eslint-ts-jest-and-ts-morph-385k) and [TS 7 migration readiness](https://ecorpit.com/typescript-7-migration-readiness-eslint-astro-blockers-2026/): corroborate the TS 7 API gap
- [Lucide 1.0 changes](https://dev.to/davekurian/lucide-10-removes-brand-icons-and-optimizes-bundle-size-for-millions-of-projects-3n96)
- [Minimal API validation in .NET 10](https://timdeschryver.dev/blog/aspnet-10-validating-incoming-models-in-minimal-apis.md) and [Microsoft validation overview](https://learn.microsoft.com/aspnet/core/validation/overview): ASP0029 experimental note

---
*Stack research for: CSPS (Carmen's Stitch & Printing Services), order management + public site on .NET 10 / React 19 / SmarterASP.NET*
*Researched: 2026-10-06*
