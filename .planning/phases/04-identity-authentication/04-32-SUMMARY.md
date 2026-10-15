---
phase: 04-identity-authentication
plan: 32
subsystem: auth
tags: [web, parity, owner-review, a11y, overflow, e2e, docs, validation, auth-01, auth-05, auth-06, auth-13, a11y-03, oq-5, oq-8, oq-9]
status: complete
created: "2026-10-15T12:05:00-05:00"
updated: "2026-10-15T12:05:00-05:00"

requires: ["04-23", "04-24", "04-31"]
provides:
  - "S1 look-equality proof: layouts-auth group (login-default, login-error, login-loading) with the LoginScreen preview and reference fragment, equal in three engines with no tolerance"
  - "Rulings OQ-5 (tap areas), OQ-8 (dot mesh kept) and OQ-9 (brand panel bottom zone, words clear of the slab) in rulings.css, rulings.test.ts and docs/web/parity.md"
  - "web/visual/login-brand.spec.ts (@brand): eyebrow and headline never touch the slab or stripes at 320 to 1920 px, 4.5:1 in Blush and Espresso, through the auth-brand group"
  - "modules/admin/components/AuthCards.tsx (S2 to S6 cards), SessionsView.tsx (S7), SignInForm.tsx, AuthFrame.tsx and authHeadingLevel.ts (h2 where cards share a page)"
  - "auth-gaps scenario group (38 implementation-only cases), previews/AuthScreens.tsx, SessionScreens.tsx, serverError.ts, and the 'Sign-in and devices' showcase section with dialog demos and toast triggers"
  - "e2e/auth-overflow.spec.ts (@auth-overflow): S1 to S7 at eight widths both ways, long-text fixtures, toasts at 320px, all five projects"
  - "npm run review: the Phase 4 section (150 pictures, OQ-1 to OQ-7 table, 138-row wording table)"
  - "docs/api/auth.md, the HOSTING-RECORD 'Phase 3 first-deploy checks added by Phase 4' section, and a green 04-VALIDATION.md"
affects: [phase-04-verification, phase-03-first-deploy]

requirements-completed: [A11Y-03, AUTH-05, AUTH-06]

actuals:
  tokens: 400000
  tasks: 3
  commits: 15
plan_head_before: 8d6f86690904bd398b924b915327a7b5ce84af4f
plan_head_after: 2b24781f3f47651d4c691b42df1cd87d1d47ace8

tech-stack:
  added: []
  patterns:
    - "A page module a parity preview imports pulls its form libraries into the parity bundle and can crash on chunk order, so presentational cards live in components/ with type-only schema imports"
    - "An implementation-only (parity: false) group still runs axe and the CSP guard in every parity row; whole pages that cannot sit in the showcase get their cards drawn with h2 titles through a context"
    - "Fixed-position cases are one case per page load in parity and a demo button in the showcase; a preview that moves focus on load is a bug on a page of previews"

key-files:
  created:
    - web/src/modules/admin/components/AuthCards.tsx
    - web/src/modules/admin/components/SessionsView.tsx
    - web/src/modules/admin/components/SignInForm.tsx
    - web/src/modules/admin/components/AuthFrame.tsx
    - web/src/modules/admin/components/authHeadingLevel.ts
    - web/src/dev/previews/LoginScreen.tsx
    - web/src/dev/previews/AuthScreens.tsx
    - web/src/dev/previews/SessionScreens.tsx
    - web/src/dev/previews/serverError.ts
    - web/src/dev/scenarios/groups/layouts-auth.ts
    - web/src/dev/scenarios/groups/auth-brand.ts
    - web/src/dev/scenarios/groups/auth-gaps.ts
    - web/visual/reference/fragments/LoginScreen.tsx
    - web/visual/login-brand.spec.ts
    - web/e2e/auth-overflow.spec.ts
    - docs/api/auth.md
  modified:
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts
    - web/src/components/layout/layout.recipe.ts
    - web/scripts/owner-review.mjs
    - web/src/dev/ShowcaseDemos.tsx
    - web/src/dev/showcaseSections.ts
    - docs/web/parity.md
    - docs/web/e2e.md
    - docs/web/owner-review.md
    - .planning/HOSTING-RECORD.md
    - .planning/phases/04-identity-authentication/04-VALIDATION.md
    - .planning/phases/04-identity-authentication/04-UI-SPEC.md

key-decisions:
  - "OQ-8 (owner): the dot mesh stays on the brand panel, recorded as a ruling because the approved render lost it to a later CSS rule"
  - "OQ-9 (owner): the brand panel keeps a bottom zone for the slab so the eyebrow and headline never sit on it; phones unchanged (the quote is hidden there)"
  - "S2 to S6 and S7 are cards in the showcase (h2 titles by context), not whole pages; the whole-page checks are the e2e sweep on the real pages"
  - "AUTH-13 is not ticked: real SMTP delivery from the business domain is only provable on the Phase 3 first deploy (HOSTING-RECORD)"

patterns-established:
  - "Owner review pack sections are data (AUTH_REVIEW_CASES, AUTH_REVIEW_RULINGS) tested against the scenario group, so a new case cannot be left out"

duration: 5 hours
completed: 2026-10-15
---

# Phase 4 Plan 32: Phase gate, S1 parity, SPEC-GAP review pack and auth docs Summary

**S1 is proven equal to the approved screen in three engines (with the owner's recorded rulings), every new sign-in and session surface is in the showcase and the owner's approved review pack, the overflow and accessibility sweep is green, and the full local gate passes.**

## What was built

- **S1 look-equality (Task 1).** Three scenarios mirror App. E.5 (default, error, loading). The reference fragment is a JSX transcription with the frozen components; the recorded differences are D-03, D-16, OQ-5, the 960px frame, the banner text block and checkbox cell structure, the OR-4 quote and the `main` form column. The proof found one unrecorded difference, the dot mesh, which the owner kept (OQ-8). The owner then asked for the brand panel's words to be readable: a bottom zone for the slab (OQ-9), proven by `login-brand.spec.ts` (no overlap, 4.5:1, Blush and Espresso).
- **SPEC-GAP surfaces (Task 2).** `AuthCards`, `SessionsView`, `SignInForm` and `AuthFrame` were split out of the pages (no behaviour change) so previews can draw them. The `auth-gaps` group holds S1 to S7 states, both sign-out dialogs (open and failed), the four-item menu, five toasts and the Note uses; it rides in the parity rows for axe and the CSP guard. The showcase has a "Sign-in and devices" section with real dialog demos. `@auth-overflow` sweeps S1 to S7 at eight widths in both orientations, with a 64-character email, a 5xx banner with its reference, a 60-character device label and two rows with one label, and the toasts at 320px. `npm run review` has a Phase 4 section: 150 pictures, the OQ-1 to OQ-7 table and a 138-row wording table.
- **Docs and gate (Task 3).** `docs/api/auth.md` documents every route, both cookies, the headers, the D-39 limits, the D-40 allow-list, error and audit codes. HOSTING-RECORD gains nine Unverified Phase 3 checks. 04-VALIDATION is green with `nyquist_compliant` and `wave_0_complete` set.

## Verification

| Check | Result |
|---|---|
| `dotnet test --solution Csps.slnx` | 2111 passed, 1 skipped (live HIBP, by design), 0 failed |
| Coverage gate | Domain 100% line and branch; Application 99.4% line |
| `npm --prefix web run verify` | all steps pass; Vitest 142 files, 3727 tests |
| `npm --prefix web run e2e` (full, all projects) | 660 passed, 15 failed on the first run; the 15 were fixed and re-run with `@auth-overflow` (95/95 passed); 31 skipped by project config |
| Parity `@auth-gaps`, `@layouts-auth`, `@brand` | 64 passed in chromium, firefox and webkit |
| `HostingRecordTests`, `dotnet list package --vulnerable` | pass, none |

## Owner review

Approved on 2026-10-15 ("Approve"): S2 to S7, both dialogs, the menu and the toasts; OQ-1 to OQ-4 default A, OQ-5 and OQ-6 applied, OQ-7 wording as written with "Logout" kept; the wording table; OQ-8 and OQ-9. Recorded in 04-UI-SPEC.md (Owner Rulings and the SPEC-DEVIATION register) and parity.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Parity page crashed on chunk order**
- **Found during:** Task 1. Importing `SignInPage` from a preview pulled zod into the parity bundle (`undefined is not an object (evaluating 'S_.config')`).
- **Fix:** split `SignInForm` and `AuthFrame` out; later the same for `AuthCards` and `SessionsView`. A preview test file placed in `previews/` was also picked up by the kit glob, so it moved to `src/dev/`.
- **Commits:** 11542e4, dd7515e

**2. [Rule 1 - Bug] Invalid-state cards moved focus on load in the showcase**
- **Found during:** the full e2e (`@responsive`, `@showcase`): axe `target-size` at 320px.
- **Fix:** `focusHeading` prop (default true), previews pass false; unit tests added; showcase spec lists the tenth section.
- **Commit:** ac86ab0

**3. [Rule 1 - Bug] Showcase demo buttons wider than 320px**
- **Fix:** shorter labels, `size="sm"`. **Commit:** 58ea652

**4. [Rule 1 - Bug] Flaky heading-focus assertions (S5, S6)**
- **Fix:** `waitFor` on focus. **Commit:** 1d9ad7b

**5. [Rule 1 - Bug] parity.md decision cells without an ID the doc test accepts; AuthFrame in `layouts` broke the OR-6 layout test**
- **Fix:** cells now D-33 and PERF-03; AuthFrame moved to `modules/admin/components`. **Commits:** 58ea652, 8ec77e6

**6. [Rule 1 - Bug] Review pictures showed the sticky shell bars mid-picture**
- **Fix:** hide sticky and fixed elements outside the case while it is photographed. **Commit:** b3f0915

**Total deviations:** 6 auto-fixed. No scope creep. The one Firefox font-preload warning in `@sessions` under load passed on re-run; that code was not changed.

## Decisions for the owner

- AUTH-13 stays Pending: sending from the business domain over TLS SMTP is only provable on the Phase 3 first deploy (HOSTING-RECORD rows, D-30 email review).
- The `@auth-overflow` sweep serves the answers that need a real invite, reset link or code through `page.route`, so it sends no mail and meets no per-address limits; the S7 sign-in is real.

## Known Stubs

None. The previews use fixed demo data by design (dev only, never shipped).

## Threat Flags

None. No new endpoint, auth path or schema change; the preview and review code is dev-only.

## Self-Check: PASSED

All created files exist; commits 0db4580 to 2b24781 are on the branch (15 since plan_head_before).
