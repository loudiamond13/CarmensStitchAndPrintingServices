---
phase: "11"
slug: "public-site-content-management"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-11-13T12:12:00-06:00"
updated: "2026-11-13T12:15:00-06:00"
---

# Phase 11: Security

Per-phase security contract: threat register, accepted risks and audit trail. Built from the `<threat_model>` block of all 38 plans (register written at plan time), then each mitigation was checked against the code at HEAD by three auditors (plans 01 to 13, 14 to 26, 27 to 38).

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Visitor browser to public pages and `/api/v1/public/*` | anonymous reads, rate limited and cached | shop facts, product lines, testimonials, consented gallery items; never customer details or the shop email |
| Server to HTML head (shell, JSON-LD, boot data, og tags) | server writes stored text into HTML | Manager-entered text, encoded |
| Manager browser to Site Content admin routes | authenticated writes, Manager policy | settings, hours, closures, lines, testimonials, gallery, share picture, image uploads |
| Staff browser to order public-website settings | authenticated writes, Staff policy (D-16) | customer consent and show flag; stamps set by the server |
| Public pages to Google Maps embed | third-party frame, loaded only after Show Map | none sent beyond the referrer origin |
| Build and install tooling | npm and NuGet | no package added or bumped in this phase |

## Threat Register

| Threat ID | Plan | Category | Component | Severity | Disposition | Status | Evidence |
|-----------|------|----------|-----------|----------|-------------|--------|----------|
| T-11-01 | 01 | Denial of service | OrderNumberAllocator under idempotency gate | medium | mitigate | CLOSED | deadlock victim mapped to busy 409; OrderNumberAllocatorTests.cs:83 |
| T-11-02 | 01 | Tampering | dev-tool deps (minimatch, glob) | low | accept | CLOSED (accepted, D-45) | audit-exceptions.json reviewBy 2026-12-14; audit-policy gate fails after it |
| T-11-03 | 02 | Spoofing | canonical, og:url, robots, sitemap (CWE-644) | high | mitigate | CLOSED | origin from PublicBaseUrl only; forged Host tests |
| T-11-04 | 02 | Elevation of privilege | page paths with POST/PUT/DELETE | high | mitigate | CLOSED | fallback GET/HEAD only; default-deny; ShellPageTests.cs:223 |
| T-11-05 | 02 | Information disclosure | admin pages in search results | medium | mitigate | CLOSED | X-Robots-Tag noindex; robots Disallow /admin, /api |
| T-11-06 | 02 | Tampering | head text in HTML (CWE-79) | high | mitigate | CLOSED | HtmlEncoder on every head value; path never echoed |
| T-11-07 | 03 | Tampering | open status shown to visitors | low | mitigate | CLOSED | BusinessClock only; OpenStatusTests |
| T-11-08 | 04 | Tampering | tel: values (CWE-79, CWE-601) | medium | mitigate | CLOSED | E.164 from parsed digits only; PhilippinePhoneTests |
| T-11-09 | 05 | Tampering | hours text on public pages | low | accept | CLOSED (accepted) | plan + SUMMARY; no innerHTML in web/src |
| T-11-10 | 06 | Repudiation | owner rulings | low | mitigate | CLOSED | D-120 to D-122 quoted and dated in 11-CONTEXT.md |
| T-11-11 | 07 | Tampering | JSON-LD, boot data, meta (CWE-79) | high | mitigate | CLOSED | default JSON encoder; ShellHeadTests.cs:733, :757 |
| T-11-12 | 07 | Information disclosure | public site read, head, JSON-LD (D-25) | medium | mitigate | CLOSED | no email column or member; PublicSiteEndpointTests.cs:107 |
| T-11-13 | 07 | Denial of service | /api/v1/public/* (CWE-770) | medium | mitigate | CLOSED | PublicRead limiter 600/min; HybridCache; RateLimitTests |
| T-11-14 | 07 | Tampering | cache freshness | medium | mitigate | CLOSED | invalidate after commit only, forget on rollback; PublicContentInvalidationTests |
| T-11-15 | 07 | Tampering | migration on production data | medium | mitigate | CLOSED | blanks exact placeholder only; forward-only; migration tests |
| T-11-16 | 08 | Information disclosure | public chunks pulling admin code | medium | mitigate | CLOSED | budget.ts forbidden prefixes; budget.test.ts (99/99 run) |
| T-11-17 | 08 | Tampering | unknown paths | low | mitigate | CLOSED | catch-all NotFoundPage; server 404 + noindex; path never echoed |
| T-11-18 | 09 | Elevation of privilege | PUT site-settings | high | mitigate | CLOSED | Policies.Manager; matrix row; Admin 403 test |
| T-11-19 | 09 | Tampering | links shown publicly (CWE-601) | high | mitigate | CLOSED | SiteLinks allow-lists applied by validator before UpdateBusinessInfo; shared fixture; domain re-check is WR-A-01 |
| T-11-20 | 09 | Tampering | stamps and version (CWE-915) | medium | mitigate | CLOSED | no stamp members; interceptor stamps; 409 test |
| T-11-21 | 09 | Repudiation | settings changes | low | mitigate | CLOSED | audit names fields only; SiteSettingsWriteTests |
| T-11-22 | 10 | Tampering | footer and Contact links (CWE-601) | medium | mitigate | CLOSED | server fields only; tel from E.164 |
| T-11-23 | 10 | Information disclosure | third-party map loading | medium | mitigate | CLOSED | iframe only after Show Map, embed prefix, strict referrer; CSP frame-src |
| T-11-24 | 10 | Information disclosure | email on public pages (D-25) | low | mitigate | CLOSED | no email in DTO; footer and Contact tests |
| T-11-25 | 11 | Elevation of privilege | opening-hours routes | high | mitigate | CLOSED | Policies.Manager; matrix rows; Admin 403 test |
| T-11-26 | 11 | Denial of service | open-status (CWE-770) | low | mitigate | CLOSED | limiter; max-age=60; cached snapshot |
| T-11-27 | 11 | Tampering | hours data integrity | medium | mitigate | CLOSED | CHECK constraints; week version 409; residual window is IN-A-05 (deferred) |
| T-11-28 | 12 | Elevation of privilege | Site Content route for an Admin | medium | mitigate | CLOSED | requireManager loader; server 403; routes.test.tsx |
| T-11-29 | 12 | Tampering | pasted embed code (CWE-79) | medium | mitigate | CLOSED | reduceEmbedCode keeps prefix src only; server refuses others |
| T-11-30 | 13 | Elevation of privilege | shop-closures routes | high | mitigate | CLOSED | Policies.Manager; 4 matrix rows; Admin 403 test |
| T-11-31 | 13 | Tampering | overlapping closures (race) | medium | mitigate | CLOSED | site lock then overlap check in transaction; race test |
| T-11-32 | 13 | Denial of service | lock deadlock or wait | low | mitigate | CLOSED | deadlock 409, timeout busy; SiteContentLockTests (5) |
| T-11-33 | 14 | Tampering | Open status words on Contact | low | mitigate | CLOSED | words from server facts only; hours.test.tsx:96 |
| T-11-34 | 14 | Denial of service | Open status polling | low | mitigate | CLOSED | visible-only 5-min poll; max-age=60; PublicRead limiter; OpenStatusEndpointTests, RateLimitTests |
| T-11-35 | 15 | Tampering | Seeded rows on later deploys | medium | mitigate | CLOSED | one InsertData in AddProductLines; ProductLinesMigrationTests |
| T-11-36 | 15 | Tampering | Price and quantity integrity | medium | mitigate | CLOSED | CHECK constraints + decimal(18,2) + domain rules; migration, domain and endpoint tests |
| T-11-37 | 15 | Denial of service | Public product-lines read | low | mitigate | CLOSED | HybridCache 1 h; PublicContentReaderTests:196; limiter |
| T-11-38 | 16 | Tampering | Duplicate closure submissions | low | mitigate | CLOSED | useSubmission + Idempotency-Key; overlap refused under site lock; ShopClosureEndpointTests |
| T-11-39 | 16 | Tampering | Business today in closure picker | low | mitigate | CLOSED | useBusinessToday from server; no device clock; ClosureModal.test.tsx |
| T-11-40 | 17 | Elevation of privilege | product-lines routes | high | mitigate | CLOSED | ProductLinesController.cs:20 Manager; 8 matrix rows; Admin 403 test |
| T-11-41 | 17 | Tampering | Prices (money integrity) | high | mitigate | CLOSED | DB CHECK + decimal(18,2) + ProductLine.Check from handlers; tests at DB, domain and HTTP |
| T-11-42 | 17 | Tampering | Line keys in public links (CWE-601) | medium | mitigate | CLOSED | LineKey.IsValid/From; Key private set; request ignores key; LineKeyTests |
| T-11-43 | 17 | Tampering | Concurrent moves | medium | mitigate | CLOSED | site lock before read and swap; ProductLineMoveTests race + idempotency |
| T-11-44 | 18 | Tampering | Anchor and gallery links (CWE-601) | medium | mitigate | CLOSED | lineKey.ts allow-list at every link site; lineKey/products/home tests |
| T-11-45 | 18 | Information disclosure | Admin code in public chunk | low | mitigate | CLOSED | budget.ts fails build on admin code in public JS; budget.test.ts:842 |
| T-11-46 | 19 | Tampering | File upload (CWE-434) | high | mitigate | CLOSED | ImageInspection + strip before storage; size/form limits; ProductLinePhotoEndpointTests |
| T-11-47 | 19 | Denial of service | Upload volume (CWE-770) | medium | mitigate | CLOSED | ImageUpload limiter + [UploadSlot] (WR-B-01); UploadSlotsCoverageTests |
| T-11-48 | 19 | Information disclosure | Photo addresses | low | mitigate | CLOSED | 128-bit random ids; audit holds no id; endpoint tests |
| T-11-49 | 19 | Tampering | Stray sweep deleting live photos | medium | mitigate | CLOSED | ImageInventory unions content photos; folder prefixes with slash; StraySweepJobTests |
| T-11-50 | 20 | Tampering | :lineId route param (CWE-20) | low | mitigate | CLOSED | guidParser; query disabled on null; ProductLinePage.test.tsx:303 |
| T-11-51 | 20 | Tampering | Double submissions (SEC-06) | low | mitigate | CLOSED | useSubmission everywhere; WR-C-01 fix; ProductLinesTab tests |
| T-11-52 | 21 | Elevation of privilege | Testimonial routes | high | mitigate | CLOSED | TestimonialsController.cs:19 Manager; 7 matrix rows; Admin 403 test |
| T-11-53 | 21 | Tampering | Quote text on Home (CWE-79) | medium | mitigate | CLOSED | no innerHTML; default JSON encoder; ShellHeadTests.cs:757 hostile text (WR-E-02) |
| T-11-54 | 21 | Information disclosure | Quotes in the audit log | low | mitigate | CLOSED | TestimonialAuditDetail names fields, never the quote; endpoint tests |
| T-11-55 | 22 | Information disclosure | EXIF and location in photos | medium | mitigate | CLOSED | client prepareImage redraw; server strip; PhotoSlot tests |
| T-11-56 | 22 | Tampering | Repeated uploads | low | mitigate | CLOSED | useSubmission<File> identity; PhotoSlot ignores pick while working |
| T-11-57 | 23 | Information disclosure | Showing an order without consent (CWE-200) | high | mitigate | CLOSED | Order.CheckPublicSettings; only show path; OrderPublicSettingsEndpointTests |
| T-11-58 | 23 | Tampering | Consent who and when (CWE-915) | high | mitigate | CLOSED | request has no stamp members; forged stamps test at :205-230 |
| T-11-59 | 23 | Elevation of privilege | Public settings route | medium | mitigate | CLOSED | Policies.Staff (D-16); matrix row; anonymous 401 test |
| T-11-60 | 23 | Information disclosure | Stale public data after cancel or delete | medium | mitigate | CLOSED | invalidation interceptor + explicit invalidate on delete; PublicCacheInvalidationTests |
| T-11-61 | 24 | Tampering | Double submissions (SEC-06) | low | mitigate | CLOSED | useSubmission + idempotencyKey; WR-C-01 fix |
| T-11-62 | 24 | Tampering | Quote text rendering (CWE-79) | low | mitigate | CLOSED | React text node; "markup stays text" test |
| T-11-63 | 25 | Tampering | Card and testimonial text (CWE-79) | low | mitigate | CLOSED | React props; isLineKey before any address; home.test.tsx |
| T-11-64 | 25 | Information disclosure | Admin code in Home chunk | low | mitigate | CLOSED | budget.ts gate; no public import of admin |
| T-11-65 | 26 | Information disclosure | Public gallery and home reads (CWE-200, DPA) | high | mitigate | CLOSED | one projection with listed columns, no customer fields; PublicPrivacyTests walks all public routes |
| T-11-66 | 26 | Information disclosure | Unconsented or cancelled orders | high | mitigate | CLOSED | projection filters consent, shown, not cancelled, not deleted; a test per filter |
| T-11-67 | 26 | Denial of service | Large gallery snapshot | medium | mitigate | CLOSED | snapshot cached; 300-item test; cap unchanged |
| T-11-68 | 27 | Information disclosure | publishing without consent | high | mitigate | CLOSED | Client aria-disabled Show + zod checkPublicWebsite; server OrderPublicWebsiteFieldsValidator.cs:20; domain Order.cs:1495; OrderPublicSettingsEndpointTests |
| T-11-69 | 27 | Tampering | stale or repeated saves | low | mitigate | CLOSED | SetOrderPublicSettingsHandler.cs:89 row version 409; useSubmission; PublicWebsiteModal.test.tsx:446 |
| T-11-70 | 28 | Tampering | gallery uploads (CWE-434) | high | mitigate | CLOSED | ImageInspection.Check + metadata strip in Create/ReplaceGallery handlers; size limits, rate limit, [UploadSlot]; GalleryAdminTests, UploadSlotsCoverageTests |
| T-11-71 | 28 | Elevation of privilege | gallery routes | high | mitigate | CLOSED | GalleryItemsController.cs:29 Policies.Manager; AuthorizationMatrix.cs:134-141 |
| T-11-72 | 28 | Tampering | concurrent moves | medium | mitigate | CLOSED | MoveGalleryItemHandler.cs:64 site-content lock; idempotency; GalleryMoveTests |
| T-11-73 | 28 | Information disclosure | photo without customer OK | medium | accept | CLOSED (accepted, D-10) | Plan register + 11-28 SUMMARY; consent note GalleryPhotoModal.tsx:557 |
| T-11-74 | 29 | Tampering | ?category (CWE-20, CWE-601) | medium | mitigate | CLOSED | useGalleryCategory parseAsStringLiteral; isLineKey; useGalleryCategory.test.tsx (9/9 run) |
| T-11-75 | 29 | Tampering | captions (CWE-79) | low | mitigate | CLOSED | React text only; no innerHTML in web/src; ESLint syntax ban |
| T-11-76 | 30 | Tampering | share picture upload (CWE-434) | high | mitigate | CLOSED | UploadSharePictureHandler.cs:73,80; SharePictureController.cs:41-44; SharePictureEndpointTests |
| T-11-77 | 30 | Elevation of privilege | share picture routes | high | mitigate | CLOSED | SharePictureController.cs:22 Manager; AuthorizationMatrix.cs:95,97 |
| T-11-78 | 30 | Tampering | og:image addresses (CWE-79) | medium | mitigate | CLOSED | delivery.ForShare only; configured origin; PublicHeadWriter encoder; ShellHeadTests.cs:410-434 |
| T-11-79 | 31 | Information disclosure | staff photo descriptions | medium | mitigate | CLOSED | PublicGalleryDto has no description; projection selects PublicId/Width/Height |
| T-11-80 | 31 | Tampering | history state | low | accept | CLOSED (accepted) | Plan register + 11-31 SUMMARY; useLightboxHistory same URL |
| T-11-81 | 32 | Tampering | line, page, size (CWE-20) | low | mitigate | CLOSED | allow-list parsers; server PageSize 1-100; GalleryAdminTests.cs:560 |
| T-11-82 | 32 | Information disclosure | upload published without consent | medium | mitigate | CLOSED | consent note; ApplyGalleryAsync needs ShownChange; public read filters consent |
| T-11-83 | 33 | Information disclosure | consent through the order form | high | mitigate | CLOSED | One shared validator in create/update/set; stamps server-side; OrderFormPublicWebsiteTests |
| T-11-84 | 33 | Tampering | legacy import | medium | mitigate | CLOSED | ImportOrderHandler never sets public settings; OrderFormPublicWebsiteTests:461 |
| T-11-85 | 34 | Information disclosure | photo metadata in share picture | medium | mitigate | CLOSED | PhotoSlot prepareImage; server strip UploadSharePictureHandler.cs:80; SharePictureCard.test.tsx:137 |
| T-11-86 | 35 | Information disclosure | consent preset by mistake | medium | mitigate | CLOSED | blankPublicWebsite defaults false; untouched card sends no block; PublicWebsiteFormCard tests |
| T-11-87 | 36 | Tampering | path rewrite to .br (CWE-22) | medium | mitigate | CLOSED | PrecompressedStaticFiles HasTwin; HiddenSegmentFileProvider first; PrecompressedFilesTests |
| T-11-88 | 36 | Information disclosure | compression of private JSON (BREACH) | medium | mitigate | CLOSED | brotli plugin js/css/svg only; no JSON in CompressibleTypes; PrecompressedFilesTests |
| T-11-89 | 37 | Information disclosure | customer data in public DOM | high | mitigate | CLOSED | public-sweep.spec.ts:119-126 asserts no email/private seed values |
| T-11-90 | 37 | Tampering | CSP regressions | medium | mitigate | CLOSED | fixtures.ts securitypolicyviolation guard auto for every test; link-preview.spec.ts:169-185 |
| T-11-91 | 38 | Tampering | dev seed target | high | mitigate | CLOSED | DevSeedTargetGuard unchanged; checked before any connection (Program.cs:28-32) |
| T-11-92 | 38 | Information disclosure | go-live doc in public repo | medium | mitigate | CLOSED | no host/account/email/path; gitleaks clean |
| T-11-SC | 01-38 | Tampering | npm and NuGet installs (supply chain) | high | mitigate | CLOSED | Directory.Packages.props, web/package.json and the lockfile are unchanged since febeb63d; the only .csproj change adds two test fixture links |

*Status: open, closed, or open below the block_on threshold (non-blocking). Severity: critical > high > medium > low; only open threats at or above `high` count toward threats_open.*

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-02 | Dev-tool advisories (minimatch, glob) are build-time only; listed in `docs/audit-exceptions.json` with a review date of 2026-12-14, and the audit gate fails after that date. | owner (D-45) | 2026-11-11 |
| AR-11-02 | T-11-09 | Hours text is plain text rendered by React, so it is escaped; no HTML path exists. | plan 11-05 register | 2026-11-11 |
| AR-11-03 | T-11-73 | A gallery upload has no per-photo consent record; the modal shows the consent note and the Manager is responsible. | owner (D-10) | 2026-11-11 |
| AR-11-04 | T-11-80 | Lightbox history state holds only a flag on the same URL; the only exit target is the literal `/contact`. | plan 11-31 register | 2026-11-12 |

## Related Items (not counted as threats)

- **WR-A-01** (code review): the domain does not re-check the link, email and postal rules. T-11-19 holds because the only production caller validates first. Fixed in 2d503631: the domain now holds the same rules, so this is closed.
- **IN-A-05** (code review, deferred): two opening-hours saves in the same instant can both read before either commits. T-11-27's version check is present; taking the site-content lock in the hours handler would close the window.
- **P11-BL-51**: consent has no database CHECK constraint (owner item). T-11-57 and T-11-83 hold in the validator and the domain.
- **P11-BL-53**: the Testing site-content reset route has no database-name guard (owner item). It is compiled only in Debug builds (`CSPS_TESTING`).
- **P11-BL-29**: restoring a deleted shown order makes it public again (owner item, before ship).
- Three new anonymous or Staff read routes have no register row of their own (`GET /api/v1/public/home`, `GET /api/v1/public/gallery`, `GET /api/v1/product-lines/options`). Each is rate limited or Staff-only, has a matrix row, and is covered by `PublicPrivacyTests`.

## Evidence Notes

- Auditor for plans 01 to 13 ran: server integration (ShellPage, Seo, SiteSettingsWrite, OpeningHours, ShopClosure, PublicSite) 92 of 92; domain (PhilippinePhone, SiteLinks, OpenStatus) 204 of 204; vitest (budget, audit-policy, siteContentSchemas) 426 of 426.
- Auditor for plans 14 to 26 ran no tests (another test run was using the same build output); its test evidence is that each named test exists and asserts the claim.
- Auditor for plans 27 to 38 ran vitest (useGalleryCategory, publicWebsiteSchemas, useGalleryTabParams) 38 of 38; e2e evidence is static.
- Full-suite results for the phase are in `11-REVIEW-FIX.md` and `11-E2E-PHASE-END.md`.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-13 | 93 | 93 | 0 | gsd-security-auditor x3 (sonnet), merged by orchestrator |

## Sign-Off

- [x] All threats have a disposition (mitigate, accept or transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified by audit 2026-11-13; owner review pending.
