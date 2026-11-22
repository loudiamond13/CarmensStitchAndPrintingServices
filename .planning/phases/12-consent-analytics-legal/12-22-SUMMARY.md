---
phase: 12-consent-analytics-legal
plan: 22
subsystem: legal
tags: [legal, consent, owner-review]
requires: [12-07, 12-11, 12-12, 12-19]
provides: [approved legal pages at version 1.0, consent policy version 1.0]
key-files:
  modified:
    - tests/fixtures/legal-pages.json
    - src/Csps.Domain/Content/LegalPages.cs
    - web/src/modules/public/legalPages.ts
    - web/src/modules/public/consentPolicy.ts
    - web/src/modules/public/consentCopy.ts
    - web/src/modules/public/legalCookies.ts
    - web/src/modules/public/legalPrivacy.ts
decisions: [D-44, D-45, D-46, D-47, D-48]
created: "2026-11-18T14:40:00-06:00"
updated: "2026-11-18T14:40:00-06:00"
---

# Plan 12-22 Summary: the owner reviewed and approved the four legal pages

*Created: 2026-11-18T14:40:00-06:00 · Updated: 2026-11-18T14:40:00-06:00*

The owner read the four DRAFT legal pages on the local site and approved them all. Each page is now version 1.0, dated 2026-11-18, with no DRAFT notice. Each is indexable and listed in the sitemap. The Cookie Policy version is the consent policy version, so it moved to 1.0 and every visitor is asked once more (D-22).

## The owner's answers (2026-11-18, in chat)

1. Wording questions: "B, keep, keep, keep, keep". Recorded as D-44 (Clear says it removes the optional cookies), D-45 ("Admin settings" stays under Necessary), D-47 (Terms kept) and D-48 (Accessibility kept).
2. Privacy retention: the owner first answered "keep". The cleanup runs monthly, and D-36 asks for "about ..." wording on lines a monthly job enforces, so the owner was asked again. The owner chose "Follow D-36 (Recommended)". Recorded as D-46. The daily visitor totals line got the same style ("about 3 years"), because the monthly job deletes those too. This was flagged to the owner.
3. Page approvals: "Approved all". The owner gave this after reading the four pages at /privacy, /cookies, /terms and /accessibility on the local site. The notice about the consent version and visitors being asked again was given beforehand. The pages were noted as general information, not legal advice; a lawyer review stays optional (D-09).

## Commits

- c62467f9 test(12-22): failing tests for the owner's Clear and retention wording (records D-44 to D-48)
- 5fee17c7 feat(12-22): say Clear removes the optional cookies, and use monthly cleanup retention wording
- 6503dc1e test(12-22): the owner approved all four legal pages (version 1.0, 2026-11-18)
- 64089c1f feat(12-22): the four legal pages are approved at version 1.0 (merged as 8e767e0e)

## Evidence

- Wording change: web `verify` 11511 passed, branches 90.32%. `@consent` in Chromium and WebKit: 29 of 30 passed. The WebKit 320px Clear dialog focus test failed once and passed alone 3 of 3.
- Approval change, from the executor's run on 64089c1f:
  - Build: 0 warnings.
  - .NET tests: Domain 2276, Application 3302, Infrastructure 1322 of 1323 (1 skipped), Server 3093, all 0 failed.
  - `dotnet format` clean.
  - Web `verify` 11512 passed, branches 90.32%.
  - E2E `@consent|@gpc|@public-sweep|@link-preview` in Chromium: 37 passed.
- Orchestrator spot check after the merge: legal and consent web tests 254 passed; Domain `LegalPagesTests` 12 of 12 passed.
- `build:budget`: Privacy 149.61 KB, Cookies 149.53 KB, Contact 149.43 KB (limit 150), admin 223.35 KB, CSS 20.50 KB. No limit was raised.

## Test changes

- The DRAFT behaviour is still covered: tests build an explicit draft meta on the web side and use `ApprovedLegalPages` draft facts on the server side.
- Tests of the real pages now expect "Version 1.0 · Last updated Nov 18, 2026" and no DRAFT notice. The sitemap lists 8 pages; the heads have no robots meta.
- Request bodies use `COOKIE_POLICY_VERSION` instead of a hard-coded "0.1". Values that mean an old version keep "0.1".
- No production code changed beyond the facts and copy files.

## Deviations

- The facts edit first made in the main checkout was reverted and redone by an executor in a worktree, because dispatch isolation requires it.
- The first web `verify` after the wording change failed on prettier format only. The new strings dropped their apostrophe, so the formatter wanted single quotes. This was fixed before commit.

## Flakes (each passed alone)

- WebKit 320px Clear dialog focus test.
- Two `PublicLayout` tests: an Accept All request landed in the next test's probe.
- `OrderFormPage` "cannot be left through the dialog while a save is pending".
- `GalleryPage` lightbox chunk test.

## Self-Check: PASSED
