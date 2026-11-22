---
phase: "12"
slug: "consent-analytics-legal"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-11-21T15:50:00-06:00
updated: 2026-11-21T15:50:00-06:00
---

# Phase 12: Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 12.1 later removed much of this phase: the consent bar and cookies, visitor ids, page speed, Clear my data and referrer lists. A threat on a removed part is "closed (12.1)": the part is gone from live code and a guard test keeps it gone. The guards are `no-consent.node.test.ts`, `AnalyticsSurfaceTests`, `RemovedAnalyticsRoutesTests`, `RetiredCookiesTests`, `KeptAnalyticsEntityTests` and `web/e2e/no-cookies.spec.ts`. See `12.1-SECURITY.md` for the 12.1 register.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser to page view route | Anonymous visitors send one page view per page load | The page path only, cut at `?` and `#`; no cookie, no visitor id |
| Browser to public reads | Site facts and the privacy contact read | Public shop details; the email only on its own rate-limited read |
| Public site to Google | The Contact map loads only after a tap or a saved tap | The embed request |
| Staff to Visitor Stats | Managers read and export daily page counts | Counts per page; no personal data |
| Owner to published legal text | Only the owner can make a legal page final | The approval flag |
| Build to production bundle | Admin, dev-only and showcase code kept out of the public first download | Static JS chunks |
| Test build to Testing seed | The analytics seed exists only in Debug test hosts | Test rows in `CSPS_E2E` or `CSPS_Test_<guid>` only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Information disclosure | SUMMARY of a live check | low | mitigate | `12-01-SUMMARY.md` records the outcome only (moved to Phase 13, D-49) | closed |
| T-12-02 | Denial of service | User-Agent and referrer scans | medium | mitigate | No regex; scans capped at 512 (`AnalyticsBots.cs`, `UserAgentFamily.cs`); referrer scan gone (12.1) | closed |
| T-12-03 | Information disclosure | Stored analytics values | medium | mitigate | Only `IncrementAsync(day, pageKey)` writes; fixed page keys | closed |
| T-12-04 | Tampering | Crafted path with query or fragment | medium | mitigate | `AnalyticsPath.Cut` before resolve; `AnalyticsPathTests` | closed |
| T-12-05 | Tampering | Consent cookie parsing | medium | mitigate | No consent codec left; retired cookie only expired by name | closed (12.1) |
| T-12-06 | Spoofing | Hand-written cookie claiming stats on | medium | mitigate | No consent decision left; `OldCookiesWriteNoVisitRows` | closed (12.1) |
| T-12-07 | Spoofing | Cookie tossing from a subdomain | low | mitigate | No consent cookie set; `no-cookies.spec.ts` | closed (12.1) |
| T-12-08 | Repudiation | Retention drifting from the policy | medium | mitigate | Constants in `AnalyticsRetention.cs`; `PrivacyPolicyPage.test.tsx` | closed |
| T-12-09 | Tampering | Misleading figures | low | mitigate | `StatsBucket`, `Shares` tested; speed figures gone (12.1) | closed |
| T-12-10 | Repudiation | DRAFT legal text indexed as final | medium | mitigate | noindex and sitemap by `IsDraft` (`ShellPage.cs`, `SeoEndpoints.cs`); `ShellHeadTests` | closed |
| T-12-11 | Tampering | Page facts drifting between server and web | medium | mitigate | Shared `tests/fixtures/legal-pages.json` asserted on both sides | closed |
| T-12-12 | Tampering | XSS through shell head metadata | low | mitigate | Constants written through `HtmlEncoder` (`PublicHeadWriter.cs`) | closed |
| T-12-13 | Information disclosure | Shop email in boot data or JSON-LD | medium | mitigate | Separate privacy-contact read; `NoPublicPageShellAndNotTheSiteFactsHoldTheStoredEmail` | closed |
| T-12-14 | Denial of service | Scraping the contact read | low | mitigate | `PublicRead` rate limit on `PublicSiteController`; cached settings | closed |
| T-12-15 | Information disclosure | Email harvested from legal pages | low | accept | See accepted risks (D-29) | closed |
| T-12-16 | Tampering | XSS through legal text or settings | medium | mitigate | No `dangerouslySetInnerHTML` or `innerHTML` in `web/src`; `LegalSection.test.tsx:103` renders markup as text | closed |
| T-12-17 | Tampering | Reverse tabnabbing | low | mitigate | All five `target="_blank"` links carry `rel="noopener noreferrer"`; legal page tests assert it | closed |
| T-12-18 | Spoofing | CSRF-induced tracking (CWE-352) | high | mitigate | Consent route gone (404); remaining POST has `[RequireCsrfHeader]`; `ACallWithoutTheAntiCsrfHeaderIs403AndCountsNothing` | closed (12.1) |
| T-12-19 | Elevation of privilege | GPC bypass by a crafted body | medium | mitigate | No consent body; count is anonymous whatever GPC says | closed (12.1) |
| T-12-20 | Denial of service | Consent flooding and table growth | medium | mitigate | Consent route gone; page view route has limit, ceiling, 4096-byte cap | closed (12.1) |
| T-12-21 | Repudiation | Proof of consent | medium | mitigate | No consent written; `KeptAnalyticsEntityTests.NothingCanMakeARowInCode` | closed (12.1) |
| T-12-22 | Spoofing | Client-chosen consent chain id | low | accept | See accepted risks; route now removed | closed |
| T-12-23 | Information disclosure | IP or User-Agent stored with consent | medium | mitigate | No such column; nothing writes the table | closed |
| T-12-24 | Repudiation | Log forging (CWE-117) | low | mitigate | No logger in the analytics path; `NoLogLineHoldsThePath...` | closed |
| T-12-25 | Information disclosure | Non-essential storage before a choice (ANL-01) | high | mitigate | Nothing written on load; map key only on tap; `no-cookies.spec.ts` (all five projects, with and without GPC) | closed |
| T-12-26 | Tampering | Provisional cookie edited by script | low | mitigate | No provisional cookie or visitor id | closed (12.1) |
| T-12-27 | Tampering | Stale bundle sends an old policy version | low | mitigate | Old route answers 404 and records nothing | closed (12.1) |
| T-12-28 | Tampering | Count inflation and beacon flooding | medium | mitigate | Per-address limit, ceiling, CSRF header, body cap, bot filter (`AnalyticsController.cs:29-32`) | closed |
| T-12-29 | Denial of service | Table growth from crafted paths | medium | mitigate | Eight page keys; unknown paths fold to `not-found` | closed |
| T-12-30 | Information disclosure | Staff activity counted (D-21) | low | mitigate | Staff marker and bearer drop the count; four tests | closed |
| T-12-31 | Information disclosure | Identifiers for visitors who said no (ANL-06) | high | mitigate | Only the daily count is written; `TheCounterIsCalledOnceWithTheDayAndThePageKeyAndNothingElse` | closed |
| T-12-32 | Repudiation | Log forging (CWE-117) | low | mitigate | No log call in `Csps.Application/Analytics`; log sink test | closed |
| T-12-33 | Repudiation | Policy misstating retention or processors | medium | mitigate | Lines tested exactly in `PrivacyPolicyPage.test.tsx`; owner approved (D-135, D-136) | closed |
| T-12-34 | Repudiation | Terms promising more than intended | medium | mitigate | Owner kept the Terms (D-47, 12-22); approval flag matches the fixture | closed |
| T-12-35 | Elevation of privilege | Stats on under GPC from the UI | low | mitigate | Cookie settings window gone | closed (12.1) |
| T-12-36 | Repudiation | Change of mind not recorded | low | mitigate | Consent route and client code gone | closed (12.1) |
| T-12-37 | Information disclosure | Re-identification from IP | high | mitigate | No IP read; `HasNoVisitorIdentityType` | closed (12.1) |
| T-12-38 | Information disclosure | Visitor id in a database copy | medium | mitigate | No visitor id issued; `no-cookies.spec.ts` | closed (12.1) |
| T-12-39 | Spoofing | Identified collection without consent | high | mitigate | No identified collection path; `AnalyticsSurfaceTests` | closed (12.1) |
| T-12-40 | Tampering | Crafted speed values | low | mitigate | Vitals route 404; `HasNoSpeedRatingHelper` | closed (12.1) |
| T-12-41 | Denial of service | Sample and visit growth | low | mitigate | Nothing writes those tables; retention job still purges | closed (12.1) |
| T-12-42 | Information disclosure | Search text in beacons | medium | mitigate | Body is `{ path }` only; server cuts too; `usePageViewBeacon.test.tsx` | closed |
| T-12-43 | Information disclosure | Full referrer sent | low | mitigate | No code reads `document.referrer` | closed (12.1) |
| T-12-44 | Denial of service | Retry storms from beacons | low | mitigate | No retry, repeat path skipped, failures swallowed (`usePageViewBeacon.ts:19-21`) | closed |
| T-12-45 | Information disclosure | Measurement script before consent | medium | mitigate | `web-vitals` removed; `no-consent.node.test.ts` | closed (12.1) |
| T-12-46 | Tampering | Third-party script and CSP | low | mitigate | `script-src 'self'`; narrow `frame-src` (`SecurityHeadersMiddleware.cs:20`) | closed |
| T-12-47 | Tampering | IDOR on Clear (CWE-639) | high | mitigate | Clear route 404; handler types absent | closed (12.1) |
| T-12-48 | Spoofing | Cross-site Clear | medium | mitigate | As T-12-47 | closed (12.1) |
| T-12-49 | Denial of service | Clear abuse | low | mitigate | Clear limiter and route gone | closed (12.1) |
| T-12-50 | Tampering | Collateral deletion | high | mitigate | Only the two retired names expired; `RetiredCookiesTests.OtherCookiesAreNeverExpired` | closed (12.1) |
| T-12-51 | Repudiation | Over-retention against the policy | medium | mitigate | Named constants; monthly job (`maintenance.yml`); report-line test | closed |
| T-12-52 | Tampering | Wrong rows purged (data loss) | high | mitigate | Tested cut-date functions with month-end and leap-day cases; rows go by date alone | closed |
| T-12-53 | Information disclosure | IP hashes linkable over time | medium | mitigate | `PurgeSaltsAsync`; no new salts created | closed |
| T-12-54 | Repudiation | Cookie inventory drifting from code | medium | mitigate | `cookie-inventory.node.test.ts` both ways | closed |
| T-12-55 | Information disclosure | Google request before consent | medium | mitigate | Frame only on tap or saved tap (`MapCard.tsx:69`); `contact.test.tsx`, `no-cookies.spec.ts` | closed |
| T-12-56 | Information disclosure | Stats read by Admin or anonymous | medium | mitigate | Manager policy; matrix rows; `AnAdminGets403AndAnAnonymousCallerGets401` | closed |
| T-12-57 | Denial of service | Huge or crafted ranges | low | mitigate | 3-year floor and today ceiling (`VisitorStatsRequestValidator.cs`) | closed |
| T-12-58 | Information disclosure | Re-identification through the stats answer | medium | mitigate | `TheAnswerHoldsOnlyTotalsNeverAHashAnIdOrATime` | closed |
| T-12-59 | Repudiation | Unapproved text shown as final | medium | mitigate | Flag kept equal in three places; owner approvals D-47, D-48, D-135, D-136 | closed |
| T-12-60 | Elevation of privilege | Agent approving for the owner | medium | mitigate | `blocking-human` gate in 12-22; ruling `f2b3b5df` before flip `f1a90aa2` | closed |
| T-12-61 | Tampering | URL params reaching requests | low | mitigate | Allow-list and calendar-date parsers; server re-validates | closed |
| T-12-62 | Information disclosure | Admin opening Visitor Stats | low | mitigate | `requireManager` loader; menu item hidden; API 403 | closed |
| T-12-63 | Information disclosure | Regression of the privacy promises | high | mitigate | `no-cookies.spec.ts` in all five projects; removal guards | closed (12.1) |
| T-12-64 | Tampering | Misleading trend | low | mitigate | Server buckets and zero-fill; `GetVisitorStatsHandlerTests` | closed |
| T-12-65 | Denial of service | Very long ranges drawn per day | low | mitigate | Month buckets above 62 days; 3-year floor | closed |
| T-12-66 | Tampering | XSS or phishing via referrer hosts | medium | mitigate | Referrer list gone; bar list renders plain text | closed (12.1) |
| T-12-67 | Information disclosure | Small-count lists hinting at individuals | low | accept | See accepted risks | closed |
| T-12-68 | Repudiation | Misleading speed or partial figures | low | mitigate | Speed removed; `HasNoSpeedRatingHelper` | closed (12.1) |
| T-12-69 | Tampering | CSV formula injection (CWE-1236) | medium | mitigate | `VisitorStatsCsv.SafePage`; `NoCellOfAGeneratedFileStartsAFormula` | closed |
| T-12-70 | Tampering | Header injection through the file name | low | mitigate | Name built from validated dates only; exact header test | closed |
| T-12-71 | Information disclosure | Export by Admin or anonymous | medium | mitigate | Manager policy; matrix row 401/403/200 | closed |
| T-12-72 | Tampering | Text mode weakening the JSON guard | low | mitigate | Opt-in, `text/csv` only; `httpClient.test.ts` rejection cases | closed |
| T-12-73 | Information disclosure | Real data in demo scenarios | low | mitigate | Only `example.com` and made-up values; gitleaks clean | closed |
| T-12-74 | Elevation of privilege | Testing endpoint reaching production | high | mitigate | `#if CSPS_TESTING` (Debug only), `[TestingOnly]`, database allow list; `ReleaseBuildHasNoTestingTypesOrRoutes` | closed |
| T-12-75 | Information disclosure | Manager page reachable by Admin in E2E | low | mitigate | `visitor-stats.spec.ts` Admin journey | closed |
| T-12-76 | Tampering | Consent cookie decision day | medium | mitigate | Consent helpers absent; retired cookie never read | closed (12.1) |
| T-12-77 | Denial of service | Re-ask when `today` is not the business day | low | accept | See accepted risks; now moot | closed |
| T-12-78 | Elevation of privilege | Admin routes discovered after first navigation | high | mitigate | Same table with `requireSession` and `requireManager`; `routes.test.tsx` runs through discovery; API default-deny | closed |
| T-12-79 | Tampering | Dev-only routes in production (CWE-489) | medium | mitigate | Imported only under literal `__DEV_ROUTES__`; `budget.ts`, `build-output.node.test.ts` | closed |
| T-12-80 | Denial of service | Route chunk missing after a deploy | low | mitigate | Admin error boundary; `router.test.tsx` | closed |
| T-12-81 | Information disclosure | Admin page list in the public download | low | accept | See accepted risks | closed |
| T-12-82 | Denial of service | Start-up after the entry chain becomes one chunk | medium | mitigate | Single `$initial` group pinned by `build-config.node.test.ts`; E2E run in `12-32-SUMMARY.md` | closed |
| T-12-83 | Information disclosure | Admin, dev or showcase code in the public entry | high | mitigate | Budget rules and `build-output.node.test.ts` fail the build | closed |
| T-12-84 | Tampering | Budget under-counting legal page downloads | medium | mitigate | `legalLoaders.ts` counted in the legal rows; missing chunk fails | closed |
| T-12-85 | Denial of service | Parity build merged into one chunk | low | mitigate | Group off in the parity build; `build-config.node.test.ts` | closed |
| T-12-86 | Denial of service | Entry file past Vite's 500 kB warning | low | accept | See accepted risks | closed |
| T-12-SC | Tampering | npm and NuGet installs (all plans) | high | mitigate | Only `97b91e95` (web-vitals 6.2.3, approved D-38, recorded check) and its removal `df48a6b2`; `Directory.Packages.props` untouched | closed |

*Status: open · closed · closed (12.1) = part removed by Phase 12.1 and kept out by a guard test*
*Severity: critical > high > medium > low; only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-15 | The shop email is public on the legal pages; it is fetched by script, not written into the HTML (`12-06-PLAN.md:184`) | owner (D-29) | 2026-11-15 |
| AR-12-02 | T-12-22 | A client-chosen chain id was a label only (`12-08-PLAN.md:279`); the route is now removed | plan threat model | 2026-11-15 |
| AR-12-03 | T-12-67 | Only page names and counts for the shop's own site, Manager only (`12-26-PLAN.md:191`) | plan threat model | 2026-11-15 |
| AR-12-04 | T-12-77 | Failed safe with no tracking (`12-31-PLAN.md:325`); consent code now removed | plan threat model | 2026-11-16 |
| AR-12-05 | T-12-81 | Admin chunks are public static files; the API is the guard, not secrecy (`12-31-PLAN.md:329`) | plan threat model | 2026-11-16 |
| AR-12-06 | T-12-86 | Vite's 500 kB raw warning is tracked in `docs/web/budgets.md:202` (`12-32-PLAN.md:299`) | plan threat model | 2026-11-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Auditor Notes (informational, none block)

1. **Body cap.** The page view body cap is 4096 bytes (`AnalyticsController.cs:32`), not the planned 2 KB. A cap exists, so T-12-20 and T-12-28 hold.
2. **Long query.** The validator checks the raw path length (2048) before the cut, so a very long query gets a 400 instead of a count. Nothing is stored either way (T-12-04).
3. **Page keys.** There are eight page keys, not the planned nine, because `/cookies` was removed (D-72). T-12-29 and T-12-84 still hold.
4. **Older wording.** T-12-64 ("null shown as a gap") and T-12-84 ("four legal rows") predate 12.1 (D-70, D-72). The parts that remain are present and tested.
5. **Kept tables.** The unused visit, sample, salt, consent and daily device and source tables stay until the owner approves a drop (D-56, D-61, D-64). `KeptAnalyticsEntityTests` proves no code can create a row, and the retention job still deletes old rows.
6. **Evidence depth.** The auditors read code and tests; they did not run the suites. Pass results are the ones recorded in the phase summaries, `12-VERIFICATION.md` and `12-VALIDATION.md`. T-12-01 rests on reading the summary, as gitleaks was not re-run here.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-21 | 87 | 87 | 0 | 3 parallel gsd-security-auditor runs plus orchestrator check of T-12-16 and T-12-17 (ASVS L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-21
