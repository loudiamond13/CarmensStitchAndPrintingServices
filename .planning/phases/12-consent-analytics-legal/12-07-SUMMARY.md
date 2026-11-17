---
phase: 12-consent-analytics-legal
plan: 07
subsystem: public-site
tags: [legal-pages, accessibility-statement, toc, legal-facts, react, a11y]
created: "2026-11-16T23:55:00-06:00"
updated: "2026-11-16T23:55:00-06:00"

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-05 LegalPage head, LEGAL_PAGES, legalCopy, legal.recipe; 12-06 usePrivacyContact"
provides:
  - "legalContent.ts types (LegalInline, LegalBlock, LegalSectionData, LegalText) that every legal text module uses"
  - "ACCESSIBILITY_TEXT, the five-section Accessibility Statement draft, shown at /accessibility"
  - "LegalSection, LegalToc, LegalFacts and the article layout of LegalPage (LegalPage takes sections)"
  - "legal-content.node.test.ts, a guard that finds every legal*.ts text module by file name"
  - "privacyContactHandler and privacyContactFailureHandler test fixtures, and a default privacy-contact answer in test setup"
affects: [12-11, 12-12, 12-19, 12-13]

actuals:
  tokens: 12300
  tasks: 3
  commits: 6
plan_head_before: 2b79fd3099e15caa5ad44a6254f9445aed204e2f
plan_head_after: 9ce11ff8d951e4af694817fbd254570e6802b6bb

tech-stack:
  added: []
  patterns:
    - "Legal text is data (sections of typed blocks), rendered by one tested template; a node test checks every text module's shape"
    - "The TOC is in the markup twice (sticky column, closed details box) and the stylesheet shows one, so there is no script and no layout jump"

key-files:
  created:
    - web/src/modules/public/legalContent.ts
    - web/src/modules/public/legalAccessibility.ts
    - web/src/modules/public/components/LegalSection.tsx
    - web/src/modules/public/components/LegalToc.tsx
    - web/src/modules/public/components/LegalFacts.tsx
    - web/src/modules/public/components/LegalFacts.test.tsx
    - web/src/modules/public/components/LegalPage.test.tsx
    - web/src/modules/public/pages/AccessibilityPage.test.tsx
    - web/src/test/legal-content.node.test.ts
  modified:
    - web/src/modules/public/components/LegalPage.tsx
    - web/src/modules/public/components/legal.recipe.ts
    - web/src/modules/public/legalCopy.ts
    - web/src/modules/public/pages/AccessibilityPage.tsx
    - web/src/modules/public/hooks/usePrivacyContact.ts
    - web/src/test/publicFixtures.ts
    - web/src/test/setup.ts

key-decisions:
  - "LegalText is { meta, sections } with meta taken from legalPages.ts, so version, date and approval stay in one place (D-10)"
  - "No reply time is promised: the draft says \"We'll reply as soon as we can.\" (LEGAL-04 prohibition)"

requirements-completed: [LEGAL-04, LEGAL-05]

coverage:
  - id: D1
    description: "/accessibility shows the five L5 sections in order, the draft text with no promised reply time, and the shop contact lines (mailto, Messenger, tel)"
    requirement: LEGAL-04
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/AccessibilityPage.test.tsx (5 passed, zero axe violations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The table of contents lists the h2s in order, every link targets an existing section, the phone box is closed by default, and the layout is 240px TOC, 640px article, 64px apart"
    requirement: LEGAL-05
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/LegalPage.test.tsx (11 passed, zero axe violations)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A text module with no sections, a duplicate or non-kebab-case id, an empty heading, an unsafe link or a long dash fails CI"
    requirement: LEGAL-05
    verification:
      - kind: unit
        ref: "web/src/test/legal-content.node.test.ts (10 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "LegalFacts shows a skeleton while loading, the error banner with Try Again (retries both reads), leaves out any missing line, and wraps long text"
    requirement: LEGAL-04
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/LegalFacts.test.tsx (19 passed, zero axe violations in every state)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The draft wording of the Accessibility Statement is acceptable to the owner"
    requirement: LEGAL-04
    verification: []
    human_judgment: true
    rationale: "Legal and promise wording is the owner's call (D-09); the page stays a DRAFT with noindex until the owner approves it"

duration: 60min
completed: 2026-11-16
status: complete
---

# Phase 12 Plan 07: Accessibility Statement and the legal article layout Summary

*Created: 2026-11-16T23:55:00-06:00 · Updated: 2026-11-16T23:55:00-06:00*

**/accessibility now shows a full draft Accessibility Statement (five sections, shop contact lines from site settings) on the new legal article layout, with an "On this page" table of contents and a node test that guards the shape of every legal text module.**

## What was built

- **Content types** (`legalContent.ts`): `LegalInline`, `LegalBlock` (`p`, `ul`, `dl`, `h3`, `facts`), `LegalSectionData`, `LegalText = { meta, sections }`.
- **Accessibility text** (`legalAccessibility.ts`): "Our goal" (WCAG 2.2 level AA), "What we do", "Known limits" (the Google map comes from Google; photo descriptions are short), "Tell us about a problem" (contact lines, "Tell us the page and what went wrong.", "We'll reply as soon as we can."), "How we check". No reply time, fix date or full-accessibility claim.
- **LegalSection**: `section` with `aria-labelledby` its h2 and every block kind. React text only; external links open in a new tab with `rel="noopener noreferrer"` and the hidden " (opens in a new tab)".
- **LegalToc**: the wide sticky column (hidden at 1023px and below) and the closed `details` box "On this page" (hidden at 1024px and above), 44px links and summary, chevron that turns only while open and not under reduced motion.
- **LegalFacts**: business name and address, the DPO line, and Email (mailto, from `usePrivacyContact`), Messenger and main phone (tel) lines from `useSiteQuery`. Missing values leave their line out; three skeleton lines while loading; the error banner with Try Again (retries each failed read); everything wraps.
- **LegalPage** now takes `sections` and lays the TOC and a 640px article 64px apart at 1024px and above.
- **legal-content.node.test.ts**: finds every `legal*.ts` text module by file name (not `legalPages`, `legalCopy`, `legalContent`, `legalLoaders`), so plans 12-11, 12-12 and 12-19 never edit it.

## TDD record

- **RED 1** `dc03ca5d`: `vitest run AccessibilityPage.test.tsx` gave `Test Files 1 failed (1)`, `Tests 5 failed (5)`. Semantic check: the tests ran and failed on the planned assertions (no h2s, no contact lines), not on a build fault.
- **GREEN 1** `86fd5f7d`: 5 passed (zero axe violations); the existing `LegalPages.test.tsx` (16) still passes.
- **RED 2** `7ffd5fbe`: `LegalPage.test.tsx` `6 failed | 5 passed` (no TOC). `legal-content.node.test.ts` passes on arrival: it is a guard over text modules that already existed, and it carries its own bad-sample tests (no sections, duplicate id, empty heading, unsafe link, long dash).
- **GREEN 2** `1ab60775`: `LegalPage.test.tsx` 11 passed, `legal-content.node.test.ts` 10 passed, `no-long-dash.node.test.ts` passed.
- **RED 3** `12197b9b`: `LegalFacts.test.tsx` `2 failed | 17 passed` (long text did not wrap). The other 17 passed on arrival because Task 1 had already built LegalFacts.
- **GREEN 3** `9ce11ff8`: `LegalFacts.test.tsx` 19 passed.

Tracer gate (Task 1): interactive, `<verify>` is automated only; the verify command was re-run after GREEN and passed, then Task 2 began. The plan's `<verify>` runs for Task 3: `AccessibilityPage.test.tsx` + `LegalFacts.test.tsx` 24 passed; `npm run lint` (`--max-warnings 0`) clean after fixing two lint errors in my own new test; `npm run typecheck` clean.

## Evidence (quoted)

- Web run over `src/test src/modules/public src/layouts src/core`: `Test Files 59 passed (59)`, `Tests 1102 passed (1102)`.
- `prettier --check src/modules/public src/test`: `All matched files use Prettier code style!`
- `npm run build:budget` (the CI build), gzip first download: accessibility 147.29 KB, privacy 146.56, cookies 146.56, terms 146.55, home 147.78, contact 147.73, products 144.46, gallery 145.77, not found 140.43, admin 223.12, CSS 20.26. All `ok`; limit 150 KB unchanged.
- gitleaks `no leaks found` before every commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] LegalFacts uses `SkeletonLines` and `ProductsError`, not `SkeletonText` and `ErrorState`**
- **Issue:** `SkeletonText` sits in a file that imports the admin money barrel, and `ErrorState` imports the `@/components/actions` and `@/components/brand` barrels. The repo already keeps public pages off them (PERF-01; `SkeletonLines.tsx` and `ProductStates.tsx` say why), and Contact sits within 0.3 KB of the limit.
- **Fix:** `SkeletonLines lines={3}` (same look, three lines) and `ProductsError` (same banner, `role="alert"`, "Try Again", title and body from the shared copy). The words are the UI-SPEC lines. The legal chunk stays at 147.29 KB.
- **Plan acceptance note:** `grep -c "SkeletonText" LegalFacts.tsx` is 1 (it is named in the file comment); the code imports `SkeletonLines`.

**2. [Rule 3 - Blocking] Test setup gets a default privacy-contact answer**
- Every route test that opens a legal page now makes the privacy-contact read, and the test setup fails any request without a handler. `privacyContactHandler` is added to `publicFixtures.ts` and answers by default in `setup.ts` (files outside the plan list). Commit `dc03ca5d`.

**3. [Rule 3 - Blocking] `usePrivacyContact.ts` reformatted**
- Prettier changed one over-long line from plan 12-06 so `format:check` passes. No behavior change. Commit `86fd5f7d`.

**4. [Plan wording] No separate `scroll-margin-top` on sections**
- `PublicLayout` already sets the page's top scroll padding to the header plus 24px (UI-SPEC Interaction Contract: "Legal h2 anchors use the header scroll padding"). A scroll margin on top would double the gap, so sections carry none.

**5. [Plan wording] The TOC `aria-label` comes from copy**
- The plan's grep wants `aria-label="On this page"` in `LegalToc.tsx`. The `public-look` gate forbids a string-literal `aria-label` in public TSX, so the label is `LEGAL_COPY.toc.label` (`aria-label={TOC_LABEL}`). The navigation is named "On this page", as the tests check.

**6. [Plan wording] `legalLoaders.ts` is also excluded from the text-module finder**
- The plan lists three shared files; `legalLoaders.ts` (plan 12-05) also matches `legal*.ts`, so it is excluded too.

**7. [Design choice] The TOC is in the markup twice**
- One `nav` in the sticky column and one inside the `details` box, each named "On this page". The stylesheet shows one at each width, so there is no script. In jsdom (no stylesheet) both are present, so the tests count two.

## Known Stubs

None in this plan's files. `/privacy`, `/cookies` and `/terms` still show only the page head: their text arrives in plans 12-11, 12-19 and 12-12 (unchanged from 12-05; `LegalPage` shows no article area without `sections`).

## Not run

- Playwright e2e and the full .NET suite were not run: this plan changes only web files and the plan's verify commands are web tests. The WebKit and mobile checks of the TOC layout (sticky position, details box at 1023px) are not covered in jsdom (no layout); they belong to the phase e2e pass.

## Flakes recorded

- `ProductsPage.test.tsx` "has no axe violations" failed once in a parallel run of `src/test src/modules/public` and passed alone (27 passed) and in the later run. `AdminLayout.test.tsx` "refreshes the open Signed-in Devices list" timed out once at 5051 ms under load and passed alone (65 passed). Both files are outside this plan.

## Threat Flags

None. No new endpoint, auth path or schema. T-12-16 (text rendered as React text, no raw HTML, constant hrefs checked by the node test) and T-12-17 (`rel="noopener noreferrer"` on every `target="_blank"`) are covered by tests.

## Owner items

- The Accessibility Statement wording is a draft for the owner's review (D-09). It stays DRAFT, noindex and out of the sitemap until `approved` is set to true in `legalPages.ts`, `tests/fixtures/legal-pages.json` and Domain `LegalPages`.
- If the owner gives a reply time, one sentence in `legalAccessibility.ts` changes ("We'll reply as soon as we can." becomes the promise).

## Self-Check: PASSED

All 9 created files exist and the commits `dc03ca5d`, `86fd5f7d`, `7ffd5fbe`, `1ab60775`, `12197b9b` and `9ce11ff8` are ancestors of HEAD. STATE.md and ROADMAP.md were not touched.
