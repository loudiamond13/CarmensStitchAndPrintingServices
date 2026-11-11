---
phase: "11"
slug: "public-site-content-management"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-11T17:10:00-06:00"
updated: "2026-11-11T17:10:00-06:00"
---

# Phase 11: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `11-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 on MTP, Shouldly, NSubstitute, FakeTimeProvider, Mvc.Testing (`CspsApiFactory`), Respawn, ArchUnitNET. Web: Vitest 5 (jsdom, `*.node.test.ts` in node), RTL, MSW 3, axe matcher, Playwright, Lighthouse |
| **Config file** | `global.json`, `web/vitest.config.ts`, `web/playwright.config.ts`, `web/scripts/budget.ts` |
| **Quick run command** | `dotnet test --project <touched test project> --filter-class "*<Class>*"` or `npm --prefix web run test -- --run <touched path>` |
| **Full suite command** | `dotnet test Csps.slnx` and `npm --prefix web run verify` (after preflight); phase gate adds `npm --prefix web run e2e` and `npm --prefix web run lighthouse` |
| **Estimated runtime** | quick ~30 s; full ~10 min |

---

## Sampling Rate

- **After every task commit:** the quick command of the touched area (one test class or one Vitest file/folder)
- **After every plan wave:** full suite command (after preflight)
- **Before `/gsd-verify-work`:** full suite, e2e and Lighthouse (LCP report-only, D-29) green
- **Max feedback latency:** 60 seconds for the quick command

---

## Per-Task Verification Map

Filled in by the planner and executor per task. Requirement-level map:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | Known public paths 200, unknown 404 with shell, `/api/*` stays ProblemDetails, POST on page path meets default-deny, case and slash variants | integration | `dotnet test tests/Csps.Server.IntegrationTests` (`SpaHostTests`, new `ShellPageTests`) | partial (SpaHostTests) ❌ new |
| PUB-01 | Each page renders per UI-SPEC states (loading, empty, error, populated), one h1, zero axe | component | `vitest run src/modules/public/pages` | ❌ Wave 0 |
| PUB-01 | 320 to 1920 px no horizontal scroll, focus not obscured | e2e | `npm --prefix web run e2e -- public-*.spec.ts` | ❌ |
| PUB-02 | Values come from DB; placeholders never appear; email never public | integration + backstop | `PublicContentTests` (grep responses for `[` and `@`) | ❌ |
| PUB-03 | Each write invalidates: new value and new ETag on next read (matrix rows) | integration | `PublicCacheInvalidationTests` | ❌ |
| PUB-04 | No-JS fetch of each URL has title, description, canonical, OG image with size, JSON-LD without email; admin has X-Robots-Tag and meta robots; robots.txt names sitemap; sitemap lists 4 URLs with absolute origin from `App:PublicBaseUrl` (forged Host ignored) | integration + e2e | `ShellHeadTests`, `SeoEndpointTests`; Playwright `link-preview.spec.ts` with `javaScriptEnabled: false` | ❌ |
| PUB-04 | Markers survive the real build | node test | `vitest run src/test/build-output.node.test.ts` | ✅ extend |
| PUB-05 | Open status at 8:59, 9:00, 17:59, 18:00 Manila, closure day, Sunday, 14-day horizon, year end | unit (Domain) | `dotnet test tests/Csps.Domain.UnitTests` (`OpenStatusTests`) | ❌ |
| PUB-05 | Client renders server words only (MSW fixtures) | component | `vitest run src/modules/public/components/HoursCard` | ❌ |
| PUB-06 | `tel:` in E.164 from the main number; m.me link; sticky bar only at ≤ 767 px | unit + component + e2e | `PhilippinePhoneTests`; `ContactBar.test.tsx`; `contact.spec.ts` | ❌ |
| GAL-01 | Pill counts equal tiles; hidden lines excluded; category URL drops unknown with replace | integration + component | `GalleryReadTests`; `useGalleryCategory.test.tsx` (nuqs testing adapter) | ❌ |
| GAL-02 | Lightbox ←, →, Esc, wrap, tap zones named, thumbnails `aria-current`, focus return, Back closes | component + e2e | `GalleryLightbox.test.tsx`; `gallery.spec.ts` | ❌ |
| GAL-03 | Upload, edit, hide, show, delete, move across kinds; Manager only | integration | `GalleryAdminTests`; authorization matrix rows | ❌ |
| CONT-01 | Settings validators mirror UI-SPEC messages (server and zod); 409 on stale version; SEC-08 stamps from token | unit + integration + component | `UpdateSiteSettingsValidatorTests`; `SiteSettingsWriteTests`; `siteContentSchemas.test.ts` | ❌ |
| CONT-02 | Line CRUD, unique short name, fixed key, delete refused when used, move under lock | integration | `ProductLineTests` | ❌ |
| CONT-03 | Testimonials CRUD and order; Home shows first 3 shown; Recent work = 6 newest shown orders | integration | `TestimonialTests`, `HomeReadTests` | ❌ |
| CONT-04 | Closure validation, overlap refused (server only), feeds open status and JSON-LD | integration | `ClosureTests`, `ShellHeadTests` | ❌ |
| CONT-05 | 304 on matching If-None-Match; Cache-Control values; second read no DB commands (query-count) | integration | `PublicCachingTests` | ❌ |
| D-11/D-13/D-16 | Order public settings: consent required, Cancelled refused, Completed allowed, Admin and Manager allowed, privacy projection | unit + integration | `OrderPublicSettingsTests` (Domain and Server) | ❌ |
| D-28/D-29 | `.br` served when accepted, gzip to a crawler; LCP printed report-only | integration + script test | `PrecompressedFilesTests`; `lighthouse-assert.test.ts` keeps LCP in `REPORT_ONLY_METRICS` | partial |
| PERF-01 | Every public route ≤ 150 KB gz; forbidden modules out (nuqs allowed on Gallery only); lightbox lazy | build test | `vitest run scripts/budget.test.ts` + `npm --prefix web run build:budget` | ✅ extend |
| P10-BL-22 | Deadlock on the order-number lock inside an outer transaction answers 409 busy, not 500 | integration | `OrderNumberAllocatorTests` (copy of the StaffMoneyLock test) | ✅ extend |
| Arch | New code respects onion layers | architecture | `dotnet test tests/Csps.ArchitectureTests` | ✅ |
| OR-7 | No new trigger | schema test | existing `sys.triggers` test | ✅ |


*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Budget plugin: per-route public measurement (PublicLayout + each page), nuqs allowance on Gallery only, stub pages so the numbers exist before real pages.
- [ ] Fixture web root: markers in `tests/Csps.Testing/Fixtures/webroot/index.html`, remove its `robots.txt`.
- [ ] `ShellPageTests` and `SeoEndpointTests` skeletons; public route table unit test shared with a client list.
- [ ] Domain `OpenStatusTests` and `PhilippinePhoneTests` (pure, `FakeTimeProvider`).
- [ ] MSW handlers and fixtures for public reads (`web/src/test/publicFixtures.ts`).
- [ ] Playwright: Google embed stub route, `link-preview.spec.ts` with JS disabled.
- [ ] Authorization matrix rows for every new endpoint (anonymous reads, Manager writes, Staff order public settings).


---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Facebook Sharing Debugger shows the right title, description and image for each public URL | PUB-04 | Needs the live site and Meta's tool | After deploy, paste each public URL into the Sharing Debugger and compare with the page |
| New Cloudinary named sizes exist in the live account | GAL-03, D-44 | Owner runs the setup command with production keys | Owner runs the Cloudinary setup command after deploy; a public photo loads at each new size |
| Real business content entered before cutover | CONT-01 to CONT-05 | Owner data | Manager enters prices, hours, address, phones, Messenger link, gallery photos |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
