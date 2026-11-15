---
phase: "11"
slug: "public-site-content-management"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-11T17:10:00-06:00"
updated: "2026-11-15T06:40:00-06:00"
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

Requirement-level map. Test names are the files that exist after execution (some differ from the names seeded at planning).

| Req ID | Behavior | Test Type | Tests | Status |
|--------|----------|-----------|-------|--------|
| PUB-01 | Known public paths 200, unknown 404 with shell, `/api/*` stays ProblemDetails, POST on page path meets default-deny, case and slash variants | integration | `Http/SpaHostTests`, `Http/ShellPageTests`, `Http/PublicRouteTableTests` | ✅ |
| PUB-01 | Each page renders per UI-SPEC states, one h1, zero axe | component | `web/src/modules/public/pages/*.test.tsx`, `components/*.test.tsx` | ✅ |
| PUB-01 | 320 to 1920 px no horizontal scroll, focus not obscured | e2e | `public-sweep.spec.ts`, `public.spec.ts`, `responsive.spec.ts`, `focus-not-obscured.spec.ts` | ✅ |
| PUB-02 | Values come from DB; placeholders never appear; email never public | integration | `Content/PublicSiteEndpointTests`, `Content/PublicPrivacyTests`, `PublicContentReaderTests` | ✅ |
| PUB-03 | Each write invalidates: new value and new ETag on next read | integration | `Content/PublicCacheInvalidationTests`, `Infrastructure/Content/PublicContentInvalidationTests` | ✅ |
| PUB-04 | No-JS head per URL, admin noindex, robots.txt, sitemap with fixed origin (forged Host ignored) | integration + e2e | `Http/ShellHeadTests`, `Http/ShellPageTests`, `Http/SeoEndpointTests`, `link-preview.spec.ts` | ✅ |
| PUB-04 | Markers survive the real build | node test | `src/test/build-output.node.test.ts` | ✅ |
| PUB-05 | Open status in Manila at the hour edges, closures, Sunday, horizon, year end | unit + integration | `Domain/Content/OpenStatusTests`, `Content/OpenStatusEndpointTests` | ✅ |
| PUB-05 | Client renders server words only | component | `public/components/hours.test.tsx`, `hooks/useOpenStatusQuery.test.tsx` | ✅ |
| PUB-06 | `tel:` in E.164; m.me link; sticky bar only at ≤ 767 px | unit + component + e2e | `PhilippinePhoneTests`, `SiteLinksTests`; `contact.test.tsx`; `contact.spec.ts` | ✅ |
| GAL-01 | Pill counts equal tiles; hidden lines excluded; unknown category dropped with replace | integration + component | `Content/PublicGalleryEndpointTests`, `PublicGalleryLineFlagsTests`, `PublicGalleryProjectionTests`; `useGalleryCategory.test.tsx` | ✅ |
| GAL-02 | Lightbox keys, wrap, tap zones, focus return, Back closes, swipe | component + e2e | `GalleryLightbox.test.tsx`, `useLightboxHistory.test.tsx`, `useSwipe.test.tsx`; `gallery.spec.ts` | ✅ |
| GAL-03 | Upload, edit, hide, show, delete, move; Manager only; photos redrawn before upload | integration + unit | `Content/GalleryAdminTests`, `GalleryMoveTests`, authorization matrix; `src/utils/images.test.ts` | ✅ |
| CONT-01 | Settings validators (server and zod); 409 on stale version; stamps from token | unit + integration + component | `UpdateSiteSettingsRequestValidatorTests`, `UpdateSiteSettingsHandlerTests`; `SiteSettingsWriteTests`; `siteContentSchemas.test.ts` | ✅ |
| CONT-02 | Line CRUD, unique short name, fixed key, delete refused when used, move under lock | unit + integration | `ProductLineTests`, `ProductLineHandlerTests`, `ProductLineEndpointTests`, `ProductLineMoveTests`, `SiteContentLockTests` | ✅ |
| CONT-03 | Testimonials CRUD and order; Home shows first 3; Recent work = 6 newest shown orders | unit + integration | `TestimonialTests`, `TestimonialHandlerTests`, `TestimonialEndpointTests`, `PublicHomeEndpointTests` | ✅ |
| CONT-04 | Closure validation, overlap refused, feeds open status and JSON-LD | unit + integration | `ShopClosureTests`, `ShopClosureRequestValidatorTests`, `ShopClosureHandlerTests`, `ShopClosureEndpointTests`, `ShellHeadTests` | ✅ |
| CONT-05 | 304 on matching If-None-Match; Cache-Control values; second read no DB commands | integration | `Public*EndpointTests` (ETag, 304, Cache-Control); `PublicContentReaderTests` (query count) | ✅ |
| D-11/D-13/D-16 | Order public settings: consent, Cancelled refused, Completed allowed, Staff allowed, privacy projection | unit + integration | `OrderPublicSettingsTests`, `SetOrderPublicSettingsHandlerTests`, `OrderPublicSettingsEndpointTests` | ✅ |
| D-28/D-29 | `.br` served when accepted, gzip to a crawler; LCP report-only | integration + script test | `Http/PrecompressedFilesTests`; `scripts/lighthouse-assert.test.ts` | ✅ |
| PERF-01 | Every public route ≤ 150 KB gz; forbidden modules out (nuqs on Gallery only); lightbox lazy | build test | `scripts/budget.test.ts` + `npm --prefix web run build:budget` | ✅ |
| P10-BL-22 | Deadlock on the order-number lock inside an outer transaction answers 409 busy, not 500 | integration | `OrderNumberAllocatorTests` | ✅ |
| Arch | New code respects onion layers | architecture | `tests/Csps.ArchitectureTests` | ✅ |
| OR-7 | No new trigger | schema test | existing `sys.triggers` test | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Budget plugin: per-route public measurement, nuqs allowance on Gallery only, stub pages.
- [x] Fixture web root markers, its `robots.txt` removed.
- [x] `ShellPageTests` and `SeoEndpointTests`; public route table test shared with a client list (`tests/fixtures/public-paths.json`).
- [x] Domain `OpenStatusTests` and `PhilippinePhoneTests`.
- [x] MSW handlers and fixtures for public reads (`web/src/test/publicFixtures.ts`).
- [x] Playwright: Google embed stub route, `link-preview.spec.ts` with JS disabled.
- [x] Authorization matrix rows for every new endpoint.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Facebook Sharing Debugger shows the right title, description and image for each public URL | PUB-04 | Needs the live site and Meta's tool | After deploy, paste each public URL into the Sharing Debugger and compare with the page |
| New Cloudinary named sizes exist in the live account | GAL-03, D-44 | Owner runs the setup command with production keys | Owner runs the Cloudinary setup command after deploy; a public photo loads at each new size |
| Real business content entered before cutover | CONT-01 to CONT-05 | Owner data | Manager enters prices, hours, address, phones, Messenger link, gallery photos |

Not tested by choice: no automated test checks that GPS or location data is removed from uploaded photos (D-126, owner, 2026-11-15: nobody will upload such a photo).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-15. Run here: .NET Domain 1,900 and Application 3,037 passed; web 5,932 passed (public, admin, images, budget, Lighthouse rules, build output), 0 failed. Database integration and Playwright results are cited from `11-VERIFICATION.md` and `11-E2E-PHASE-END.md`, not re-run.

## Validation Audit 2026-11-15

| Metric | Count |
|---|---|
| Gaps found | 1 |
| Resolved | 0 |
| Escalated | 0 |
| Accepted by owner | 1 |
