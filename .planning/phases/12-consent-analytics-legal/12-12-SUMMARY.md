---
phase: 12-consent-analytics-legal
plan: 12
subsystem: public-site
tags: [legal-pages, terms-of-use, philippine-law, react, a11y]
created: "2026-11-17T01:50:00-06:00"
updated: "2026-11-17T01:50:00-06:00"

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-07 LegalText types, LegalPage with sections, LegalFacts, legal-content.node.test.ts; 12-05 LEGAL_PAGES.terms"
provides:
  - "TERMS_TEXT, the ten-section Terms of Use draft (D-08), shown at /terms"
  - "TermsPage.test.tsx, nine tests including zero axe violations and a no-promise guard"
affects: [12-22]

actuals:
  tokens: 3300
  tasks: 2
  commits: 4
plan_head_before: f7b99813f91e7c276154ef3b323fb163c82816f1
plan_head_after: b99bd8749db96932bc4277c89605dd85dc46183c

tech-stack:
  added: []
  patterns:
    - "A legal page is a text module (data) rendered by LegalPage; the Terms page needed no layout change"

key-files:
  created:
    - web/src/modules/public/legalTerms.ts
    - web/src/modules/public/pages/TermsPage.test.tsx
  modified:
    - web/src/modules/public/pages/TermsPage.tsx

key-decisions:
  - "No payment share, turnaround, refund rule or warranty is written; the open business terms say \"we will confirm this with you in your quote\" (UI-SPEC L4)"
  - "The draft stays DRAFT: no approved flag was touched (legalPages.ts is unchanged)"

requirements-completed: [LEGAL-03]

coverage:
  - id: D1
    description: "/terms shows the ten L4 sections in order: About these terms, Using this website, Prices and quotes, Your designs, logos and names, Photos of our work, Links to other sites, Our responsibility, Philippine law, Changes to these terms, Contact us"
    requirement: LEGAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/TermsPage.test.tsx#shows one h1 and the ten sections in order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Philippine law names the Consumer Act (RA 7394) and the Internet Transactions Act of 2023 (RA 11967) and says nothing in the terms takes away consumer rights; Our responsibility limits none of those rights"
    requirement: LEGAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/TermsPage.test.tsx (Philippine law and consumer rights tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Prices are a guide and the quote confirms price, quantity, payment and timing; no refund, deposit, warranty, guarantee, turnaround time or percentage appears anywhere on the page"
    requirement: LEGAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/TermsPage.test.tsx#promises no payment share, turnaround time, refund rule or warranty"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contact us shows the business lines and the email (mailto), Messenger and phone (tel) lines from site settings; zero axe violations"
    requirement: LEGAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/TermsPage.test.tsx (contact lines and axe tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The wording of the Terms of Use is acceptable to the owner, and the owner confirms the draft promises nothing the shop will not keep"
    requirement: LEGAL-03
    verification: []
    human_judgment: true
    rationale: "Legal and promise wording is the owner's call (D-09). The page stays DRAFT, noindex and out of the sitemap until the owner approves it in plan 12-22"

duration: 25min
completed: 2026-11-17
status: complete
---

# Phase 12 Plan 12: Terms of Use (DRAFT, Philippine law) Summary

*Created: 2026-11-17T01:50:00-06:00 · Updated: 2026-11-17T01:50:00-06:00*

**/terms now shows a plain-English DRAFT Terms of Use in ten sections on the shared legal layout. It names RA 7394 and RA 11967, keeps consumer rights, and promises no payment split, turnaround, refund or warranty.**

## What was built

- **`legalTerms.ts`**: `TERMS_TEXT`, a `LegalText` whose `meta` is `LEGAL_PAGES.terms` (version 0.1, DRAFT, from plan 12-05). Sections, in order:
  - "About these terms": what the terms cover; using the site means agreeing to them.
  - "Using this website": true details, safe files, no attempts to break or overload it.
  - "Prices and quotes": prices are a guide; a quote request is not an order; "we will confirm this with you in your quote" for price, quantity, payment and timing.
  - "Your designs, logos and names": the customer confirms they may use what they send; the shop uses it only to make the order.
  - "Photos of our work": shown only when the customer has said it is OK (Phase 11 D-11).
  - "Links to other sites", "Our responsibility" (offered as it is; limits no right under Philippine consumer law).
  - "Philippine law": RA 7394 and RA 11967 by name and number; nothing takes away rights under them; a link to the Privacy Policy.
  - "Changes to these terms", "Contact us" (`facts` block).
- **`TermsPage.tsx`** renders `TERMS_TEXT` on `LegalPage` with sections, the same shape as `AccessibilityPage`.
- **`TermsPage.test.tsx`**: nine tests over the real route tree.

## TDD record

- **RED 1** `9d57593b`: `TermsPage.test.tsx` gave `3 failed (3)`; the page had no sections (failed on the planned assertions).
- **GREEN 1** `65d509ad`: 3 passed; `LegalPages.test.tsx` (16) and `legal-content.node.test.ts` still passed.
- **RED 2** `4fd08c95`: `Tests 8 failed | 1 passed (9)`; the last seven sections did not exist. The one pass was the quote-rule test, already true after GREEN 1.
- **GREEN 2** `b99bd874`: `TermsPage.test.tsx (9 tests)`, `legal-content.node.test.ts (11 tests)`, `no-long-dash.node.test.ts (1 test)` all passed.

Tracer gate (Task 1): interactive mode with an automated-only `<verify>`; the test was re-run after GREEN 1 and passed before Task 2 began.

## Evidence (quoted)

- Plan verify: `Test Files 3 passed (3)`, `Tests 21 passed (21)` (TermsPage, legal-content, no-long-dash).
- `npm run lint` (`eslint . --max-warnings 0`): no output, exit 0. `npm run typecheck`: no output, exit 0. `prettier --check src/modules/public src/test`: `All matched files use Prettier code style!`
- `build-output.node.test.ts`: `Tests 29 passed (29)`. Gzip first download for /terms: 147.70 KB (limit 150.00 KB, unchanged; `ok`). Other pages: home 147.74, contact 147.69, accessibility 147.26, privacy 146.52, cookies 146.52. The Terms text sits in its own lazy chunk (`TermsPage-*.js`, 1.43 KB gz).
- gitleaks `no leaks found` before every commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Design choice] "Contact us" also shows the business name and address**
- The plan says a `facts` block with contact. The block is `show: ['business', 'contact']`, so a visitor also sees who the shop is (name and address from site settings, D-11). No hard-coded value. The tests for the contact links pass; drop `'business'` if the owner prefers contact lines only.

**2. [Environment] Plan-head ledger file not written**
- The agent sandbox refused writes into the worktree git dir, so the `gsd-plan-head-before-12-12` ledger file was not created. `plan_head_before` is the worktree base `f7b99813...` named in the dispatch, and `commits: 4` is `git rev-list --count f7b99813..HEAD` measured before the summary commit.

## Known Stubs

None.

## Not run

- Playwright e2e and the full .NET suite were not run: this plan changes only web files. The full vitest suite was not run; the public legal tests and the build-output test were.

## Owner items (parked, nothing blocks)

- The draft wording is for the owner's review in plan 12-22 (D-09). No `approved` flag was changed. Lines the owner may want to look at:
  - "By using the website, you agree to them" (About these terms) and "Changes to these terms" say changes are shown by the version and date at the top. No notice period is promised.
  - "Our responsibility" says the site is "offered as it is" and that this does not limit consumer rights.
  - If the owner gives a payment, timing, refund or warranty rule, one section changes (`prices-and-quotes`); none was invented.
- This is general information, not legal advice (D-09).

## Threat Flags

None. No new endpoint, auth path or schema. T-12-34: no business promise was written, and the page stays DRAFT and noindex until plan 12-22. T-12-SC: no package added or bumped (`npm ci` only, from the existing lockfile).

## Self-Check: PASSED

`legalTerms.ts`, `TermsPage.tsx` and `TermsPage.test.tsx` exist. Commits `9d57593b`, `65d509ad`, `4fd08c95` and `b99bd874` are ancestors of HEAD. STATE.md and ROADMAP.md were not touched.
