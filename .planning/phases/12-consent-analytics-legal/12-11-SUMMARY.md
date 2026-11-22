---
phase: 12-consent-analytics-legal
plan: 11
subsystem: public-site
tags: [legal-pages, privacy-policy, ra-10173, retention, react, a11y]
created: "2026-11-17T01:50:00-06:00"
updated: "2026-11-17T01:50:00-06:00"

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-07 legalContent.ts types, LegalPage with sections, LegalFacts, legal-content.node.test.ts; 12-05 LEGAL_PAGES.privacy"
provides:
  - "PRIVACY_TEXT, the ten-section DRAFT Privacy Policy shown at /privacy"
  - "PrivacyPolicyPage renders the text on the legal article layout"
affects: [12-22]

actuals:
  tokens: 9500
  tasks: 2
  commits: 4
plan_head_before: f7b99813f91e7c276154ef3b323fb163c82816f1
plan_head_after: b7ec46078201f0c579d0206150391ba26c8f0953

tech-stack:
  added: []
  patterns:
    - "Policy text is typed data; the retention lines are asserted character for character in the page test"

key-files:
  created:
    - web/src/modules/public/legalPrivacy.ts
    - web/src/modules/public/pages/PrivacyPolicyPage.test.tsx
  modified:
    - web/src/modules/public/pages/PrivacyPolicyPage.tsx

key-decisions:
  - "Rights are a term list (dl) rather than a bullet list: LegalInline has no bold, and a dl gives each right a name and a sentence"
  - "Retention wording is copied from the plan truths (D-36 style for the two monthly-job lines), not from the older UI-SPEC table, which still says 'Kept for 13 months'"

requirements-completed: [LEGAL-01]

coverage:
  - id: D1
    description: "/privacy shows the ten sections in order; 'Who we are' names the business from the site settings and the DPO by role"
    requirement: LEGAL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/PrivacyPolicyPage.test.tsx (13 passed, zero axe violations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The six retention lines equal the owner's rulings character for character"
    requirement: LEGAL-01
    verification:
      - kind: unit
        ref: "PrivacyPolicyPage.test.tsx 'lists the six retention lines exactly as the owner ruled them'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Four handlers only, no data-centre or server names; eight RA 10173 rights; contact lines; NPC link opens in a new tab with the hidden suffix; no lawyer claim and no reply time"
    requirement: LEGAL-01
    verification:
      - kind: unit
        ref: "PrivacyPolicyPage.test.tsx (sections describe, 10 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The wording of the policy is acceptable to the owner"
    requirement: LEGAL-01
    verification: []
    human_judgment: true
    rationale: "Legal and promise wording is the owner's call (D-09); the page stays DRAFT, noindex and out of the sitemap until approved (plan 12-22)"

duration: 25min
completed: 2026-11-17
status: complete
---

# Phase 12 Plan 11: Privacy Policy draft Summary

*Created: 2026-11-17T01:50:00-06:00 · Updated: 2026-11-17T01:50:00-06:00*

**/privacy now shows a full plain-English DRAFT Privacy Policy for the Philippines (Data Privacy Act of 2012): ten sections, the controller from site settings, the owner's six retention lines word for word, four named handlers, eight rights and the National Privacy Commission route.**

## What was built

- `legalPrivacy.ts` exports `PRIVACY_TEXT` (meta from `legalPages.ts`, so version 0.1 and the DRAFT notice stay as they were; `approved` is untouched and false).
- Sections in order: Who we are, What we collect, Why we use it, Photos of your order, Who else handles it, How long we keep it, Your rights, How to ask about your data, Complaints to the National Privacy Commission, Changes to this policy.
- "Who we are" uses the `facts` block (business and DPO line); "How to ask about your data" uses the `contact` facts, so no name, address or email is in the text.
- Basis per purpose in plain words: contract (orders, quotes), the law (tax and bookkeeping), legitimate interest in security (staff accounts), consent (visitor stats and the map).
- `PrivacyPolicyPage.tsx` renders `PRIVACY_TEXT` through `LegalPage`.

## TDD record

- **RED 1** `876c953b`: `PrivacyPolicyPage.test.tsx` `2 failed | 1 passed (3)`. The two failures were the missing "Who we are" and "How long we keep it" headings, not a build fault. The h1 test passes on arrival (the page head already existed).
- **GREEN 1** `6748767a`: PrivacyPolicyPage, LegalPages and legal-content tests `30 passed`. Tracer gate: interactive, `<verify>` automated only; the verify command was re-run after GREEN and passed, then Task 2 began.
- **RED 2** `5a94e560`: `10 failed | 3 passed (13)`. All ten new tests fail on the missing sections, the four handlers, the rights, the contact lines, the NPC link and the axe wait.
- **GREEN 2** `b7ec4607`: `PrivacyPolicyPage.test.tsx (13 tests)` passed, `legal-content.node.test.ts (11)` passed, `no-long-dash.node.test.ts (1)` passed.

## Evidence (quoted)

- `npm --prefix web run lint` (`--max-warnings 0`): no output after the command line, exit 0. `npm run typecheck`: exit 0.
- `prettier --check src/modules/public src/test`: `All matched files use Prettier code style!`
- Acceptance greps: `https://www.privacy.gov.ph` 1, `Cloudinary` 1, `Data Privacy Act of 2012` 2, `Kept for about 13 months; removed at the next monthly cleanup.` 2, `Kept for good. They are our bookkeeping and tax records.` 1.
- `npm run build:budget` gzip first download: privacy 148.62 KB (was 146.56), cookies 146.54, terms 146.54, accessibility 147.28, home 147.77, contact 147.72, admin 223.09, CSS 20.26. All `ok`; limit 150 KB unchanged. The Privacy chunk now has 1.38 KB of room. Later plans that add code to the shared public chunk should know this.
- Wider run `src/modules/public src/test src/layouts`: `Test Files 2 failed | 50 passed (52)`, `Tests 3 failed | 930 passed (933)`. See Flakes.
- gitleaks `no leaks found` before every commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan wording] Rights are a term list, not a bullet list**
- **Issue:** the plan says "names the RA 10173 rights in plain words". `LegalInline` has no bold, so a bullet list could not set each right apart.
- **Fix:** a `dl` with each right as its term. The eight names are asserted in the test.

**2. [Plan wording] Retention text from the plan truths, not UI-SPEC**
- The UI-SPEC retention table (lines 466 and 468) still says "Kept for 13 months". The plan truths and D-36 say "Kept for about 13 months; removed at the next monthly cleanup", so the page and the test use those.

None of Rules 1 to 4 applied.

## Known Stubs

None.

## Not run

- Playwright e2e and the .NET suite: this plan changes only web files. The visual layout of the longer article (TOC length, 640px column) is not covered in jsdom.
- `npm ci` was run in the worktree `web/` from the lockfile because `node_modules` was missing; no package was added or changed (`git status` shows only plan files).

## Flakes recorded

- `GalleryPage.test.tsx` failed 3 tests across two wide runs (a different test each time) and `AdminLayout.test.tsx` "refreshes the open Signed-in Devices list after Sign Out Other Devices from the menu" timed out at 5008 ms. Re-run alone, `GalleryPage.test.tsx` gave `28 passed`. The AdminLayout test passed in the second run (`Test Files 1 failed | 1 passed`, only a Gallery test failing). Other sibling vitest runs were active on the machine. These files are outside this plan.

## Threat Flags

None. No new endpoint, auth path or schema. T-12-33 is covered: the retention lines are tested character for character and the handlers list is tested to four items; the page stays DRAFT.

## Owner items (for plan 12-22 review)

1. **Quote-request and activity-log lines vs D-36.** The plan's verbatim text says "Deleted 6 months after we receive them." and "Kept for 8 months." D-36 says the same "about ... removed at the next monthly cleanup" style applies to every line a monthly job enforces. If the Phase 13 quote purge and the audit-log purge also run monthly, those two lines may need the "about" wording too. I kept them verbatim and did not decide this. Recommendation: apply the D-36 wording to both once the owner confirms the jobs are monthly.
2. **Wording I drafted that the owner has not ruled on:** the "What we collect" list, the basis sentences in "Why we use it", the one-line explanation of each right, "Some rights have limits. For example, we must keep our tax and bookkeeping records.", and "The owner, as our Data Protection Officer, answers these requests." No reply time is promised and no lawyer review is claimed.
3. **Handlers list (D-40):** the host line says only "The web host that runs this website." No location or data-centre is named, as D-40 and RESEARCH A9 require.
4. The page remains DRAFT, noindex and out of the sitemap until `approved` is set in `legalPages.ts`, `tests/fixtures/legal-pages.json` and Domain `LegalPages` (plan 12-22). No approved flag was changed.

## Self-Check: PASSED

`legalPrivacy.ts`, `PrivacyPolicyPage.test.tsx` and `PrivacyPolicyPage.tsx` exist; commits `876c953b`, `6748767a`, `5a94e560` and `b7ec4607` are ancestors of HEAD. STATE.md and ROADMAP.md were not touched.
