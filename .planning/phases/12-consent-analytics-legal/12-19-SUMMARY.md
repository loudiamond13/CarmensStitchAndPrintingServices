---
phase: 12-consent-analytics-legal
plan: 19
subsystem: public-web-legal
tags: [cookie-policy, legal, inventory-test, cookie-settings-button, bundle-budget, tdd]
created: "2026-11-17T10:25:00-06:00"
updated: "2026-11-17T10:25:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-07 legal text modules and LegalSection, 12-13 openSettings and the Cookie Settings window, 12-10 AnalyticsCookies, 12-08 consent endpoint"
provides:
  - "COOKIES_TEXT: the DRAFT Cookie Policy (seven sections) shown at /cookies"
  - "cookie-inventory.node.test.ts: the policy's cookie names equal the cookie name constants in the C# code"
  - "The cookie-settings block kind: a secondary 'Change Cookie Settings' button inside a legal text"
  - "A dl item can carry further dd lines (more)"
affects: [12-20, 12-22, 12-24]

requirements-completed: [LEGAL-02]

actuals:
  tokens: 9300
  tasks: 2
  commits: 4
plan_head_before: 52b60601acb82dd22565b4a1dea440424ec4a51b
plan_head_after: 784bbaa40ecfe7a7fa5db60662e12f509ebbead6
commits: 4

tech-stack:
  added: []
  patterns:
    - "A node test reads constants out of C# source and compares them with shipped text, so a new cookie cannot ship unlisted"
    - "Legal text stays data: one new block kind and one optional dl field, no raw HTML"

key-files:
  created:
    - web/src/modules/public/legalCookies.ts
    - web/src/modules/public/pages/CookiePolicyPage.test.tsx
    - web/src/test/cookie-inventory.node.test.ts
  modified:
    - web/src/modules/public/pages/CookiePolicyPage.tsx
    - web/src/modules/public/legalContent.ts
    - web/src/modules/public/components/LegalSection.tsx
    - web/src/test/legal-content.node.test.ts

key-decisions:
  - "Each cookie has two dd lines, 'What it does: ...' and 'How long it lasts: ...', through a new optional more field on dl items (not a new block kind)"
  - "The /.well-known/gpc.json link is an external-style link (new tab, plain browser navigation), because the router would treat the path as a page"
  - "The Change Cookie Settings button shows the pending state while the window's chunk loads, like the footer button"

metrics:
  duration: about 1h 10m
  completed: 2026-11-17
---

# Phase 12 Plan 19: Visitors can read a DRAFT Cookie Policy that lists exactly the cookies the site sets Summary

*Created: 2026-11-17T10:25:00-06:00 · Updated: 2026-11-17T10:25:00-06:00*

**/cookies now shows a seven-section DRAFT Cookie Policy. Every cookie the server sets is listed with its exact name, what it does and how long it lasts, and a node test fails if the list and the C# cookie constants ever differ. "Your choices" ends with a secondary "Change Cookie Settings" button that opens the Cookie Settings window.**

## What was built

- **`legalCookies.ts` (`COOKIES_TEXT`)**, sections in order: What cookies are, Cookies we use, Your choices, Global Privacy Control, Clear your cookies and data, Changes to this policy, Contact us. The version, date and DRAFT flag come from `legalPages.ts`; the version is the consent policy version (0.1).
- **Cookies we use** has three `h3` groups. Necessary: `__Host-csps_consent`, `__Secure-csps_rt`, `__Secure-csps_2fa`, `__Secure-csps_staff`, and "Admin settings in this browser" (theme and orders view, staff only; it is browser storage, not a cookie, and the text says so). Visitor stats: `__Secure-csps_vid`. Google map: Google sets its own cookies when the map loads, with a link to Google's cookie policy (new tab, hidden suffix).
- **Lifetimes come from the code:** the consent and visitor cookies 12 months from the choice (`ConsentCookie.LifetimeMonths`); the staff sign-in and staff marker until the browser closes, or 90 days with "Keep me signed in" (`PersistentSessionLifetime`), and a sign-in that is not kept also ends after 12 hours; the sign-in code step 30 minutes (`ChallengeLifetime`).
- **`cookie-inventory.node.test.ts`:** reads every `"__Host-csps_..."` and `"__Secure-csps_..."` constant from `AuthCookies.cs` and `AnalyticsCookies.cs` and fails if a name is missing from the policy, if the policy names a cookie the code does not set (a name without its prefix counts), or if a cookie is only mentioned in running text and is not its own `dt`. The guard has its own bad-sample tests.
- **`cookie-settings` block** in `legalContent.ts`, rendered by `LegalSection.tsx` as a secondary `Button` "Change Cookie Settings" that calls `openSettings(button)`. Focus returns to the button when the window closes (tested with Escape).
- **GPC section:** the browser's GPC signal is read as a no to visitor stats, no bar, the map can still be allowed; links `/.well-known/gpc.json` (D-20, D-39).
- **Clear section:** D-19, D-31, D-41 lines (deletes this site's cookies and saved settings and the linked visit records, turns visitor stats and the map off, resets a staff member's admin theme and orders view, leaves the daily totals, cannot clear Google's cookies) and the D-36 retention wording for visit records and the cookie choice.

## TDD gate sequence

| Step | Commit | Evidence |
|------|--------|----------|
| Task 1 RED | d693dc85 | `Test Files 2 failed (2)`, `Tests 13 failed \| 9 passed (22)`: the inventory test listed the 5 code names as missing (`expected [ '__Secure-csps_rt', …(4) ] to deeply equal []`); the page had no sections |
| Task 1 GREEN | 9785d4d1 | `Test Files 2 passed (2)`, `Tests 22 passed (22)`; after: `Test Files 5 passed (5)`, `Tests 58 passed (58)` for the legal tests |
| Task 2 RED | 698193b0 | `Test Files 2 failed (2)`, `Tests 14 failed \| 25 passed (39)`: no Your choices, GPC, Clear, Changes or Contact sections; the cookie-settings block was not known |
| Task 2 GREEN | 784bbaa4 | `Test Files 4 passed (4)`, `Tests 52 passed (52)` |

Semantic check of each RED: the target tests ran and failed on the planned assertions (no sections, no names), not on an import, syntax or fixture fault. The Task 1 RED needed a one-section starting `legalCookies.ts` so the files load. Passed on arrival (recorded): "names no cookie the code does not set" and the legal-content guard cases that needed no new code; the guard tests inside `cookie-inventory.node.test.ts` cover the drift cases directly. The machine classifier `tdd-red-evidence` was not run (same as plans 12-07 and 12-13).

## Verification (real output)

- Plan verify commands: `npm --prefix web run test -- --run src/test/cookie-inventory.node.test.ts src/modules/public/pages/CookiePolicyPage.test.tsx` passed (22 tests, Task 1 GREEN). `... CookiePolicyPage.test.tsx legal-content.node.test.ts no-long-dash.node.test.ts cookie-inventory.node.test.ts`: `Test Files 4 passed (4)`, `Tests 52 passed (52)`, including `has zero axe violations` on the whole /cookies page.
- `npm --prefix web run typecheck`: clean. `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. Prettier written on every changed file.
- Acceptance greps: `__Secure-csps_vid` in `legalCookies.ts` 1, `AnalyticsCookies.cs` in the inventory test 1, `cookie-settings` in `legalContent.ts` 1, `/.well-known/gpc.json` in `legalCookies.ts` 1. All pass.
- Wider run, `src/modules/public src/layouts src/test`: first pass `Test Files 2 failed | 63 passed (65)`, `Tests 5 failed | 1188 passed`. The 5 were in `AdminLayout.test.tsx` and `GalleryPage.test.tsx` (timeouts and a missing lazy render while other sessions loaded the machine). Re-run alone: `Test Files 2 passed (2)`, `Tests 93 passed (93)`. Recorded as load flakes, not caused by this plan (neither file imports the changed code).
- **Public JS budget (D-42), `npm --prefix web run build:budget`: built with no budget error.** Rows (gzip, limit 150000): home 147,292; products 143,995; gallery 145,334; contact 147,355; **privacy 149,048**; **cookies 148,948**; terms 148,159; accessibility 147,714; notFound 140,059. Admin JS 220,719 of 250,000; CSS 20,419 of 35,000. The limit was not touched. The Cookie Policy stays its own lazy chunk, under the limit.
- **Budget watch:** Privacy is now at 149.05 KB, 0.95 KB under 150 KB. About 0.27 KB of the growth is from `LegalSection.tsx` (the shared button, `useConsent` and the extra `dd` loop), which every legal page loads. Sibling plans that touch the first download or the legal chunk need to re-measure after the merge.
- Not run: Playwright and Lighthouse (the plan's verify is web tests only; the page layout and the new-tab link behavior in a real browser are for the phase E2E pass).

## Deviations from Plan

**1. [Rule 3 - Blocking] `legal-content.node.test.ts` edited (not in the plan's file list).** Its `blockProblems` switch must cover the new `cookie-settings` kind (a `tsc` error otherwise) and must check the new `more` lines for long dashes and unsafe links. Added the case, the `more` check and two guard tests. The plan's Task 2 verify names this file.

**2. [Rule 3 - Blocking] A new optional `more` field on `dl` items in `legalContent.ts`.** The plan wants each cookie to have two `dd` lines, but the existing `dl` block holds one. Added an optional field instead of a second new block kind (the plan allows one new kind, `cookie-settings`). Plain text only; the node test checks it.

**3. [Rule 3 - Blocking] `/.well-known/gpc.json` is written as an external-style link.** A bare `/...` path goes to the router, which has no page for it. `external: true` makes it open in a new tab as a normal browser request to the server file. It gets the hidden "(opens in a new tab)" suffix.

**4. The button label is a constant in `LegalSection.tsx`,** not in `legalCopy.ts` (that file is outside the plan's list).

**5. Commit trailer** is `Co-Authored-By: Claude Sonnet 5.5`, as in plans 12-08, 12-09, 12-13, 12-31 (the plan text says Opus 5.5; the session attribution rule names this model).

**6. Setup:** the worktree had no `web/node_modules`; ran `npm ci --ignore-scripts` (locked versions only, no package added or bumped). It is git-ignored; remove the folder with the worktree (check it is not a link into the main checkout).

**7. `REQUIREMENTS.md` was not touched.** LEGAL-02 is `requirements-completed` in the frontmatter above; the orchestrator can mark it after the merge (other plans may declare it too).

**Total deviations:** 3 Rule 3 changes, 4 notes. **Impact:** none on scope; two small shared-file edits.

## Drafted text for the owner's review (plan 12-22)

Everything in `legalCookies.ts` is draft wording by this executor, not legal advice and not lawyer-reviewed. Lines worth a careful read:

1. **Lifetimes of the staff cookies:** "until the browser closes, or 90 days if the staff member chose Keep me signed in; a sign-in that is not kept also ends after 12 hours" (taken from the session settings).
2. **"Visitors never get this cookie"** (sign-in cookie), and the **"Admin settings in this browser"** entry placed under Necessary although it is browser storage, not a cookie.
3. **Visitor id:** "holds no name or contact details, and only our visitor stats service can read it."
4. **Google map:** "loads only if you allow it, or when you tap Show Map for that one visit" (D-18), and the link to `https://policies.google.com/technologies/cookies` (a third-party page).
5. **Your choices:** "If you block the necessary cookies, we cannot remember your choice, and staff cannot sign in."
6. **GPC:** "we read it as a no to visitor stats. We show no cookie bar. You can still allow the Google map" and "We say that we honor GPC in our GPC statement" (links the JSON file).
7. **Clear:** the five D-19, D-31, D-41 lines, and "If you never press it, we keep these" with the D-36 wording (owner's exact line) for visit records and the cookie choice. The second retention row ("Your cookie choice") is new wording in this policy; it repeats the Privacy Policy line.
8. **Changes:** "we publish a new version with a reviewed release. Every visitor is then asked for their choice again."

## Open questions for the owner (nothing blocks the plan)

1. **Does Clear really delete "this site's cookies"?** The text copies the UI-SPEC and plan wording ("deletes this site's cookies and saved settings in this browser"). Plan 12-17 (running now) keeps the necessary cookies: the staff sign-in cookies are not touched and the consent cookie is set again with the new choice. So the sentence says a little more than the code does. Options: (A) keep the UI-SPEC wording as is; (B) say "deletes this site's optional cookies and saved settings", and list that the necessary cookies stay; (C) make Clear also sign staff out. Recommendation: B, because it matches what happens and keeps the owner-approved structure. Needs a ruling and the same change in the Clear dialog copy.
2. **Should the "Admin settings in this browser" line sit under Necessary?** The plan says yes. Option: (A) keep as drafted; (B) a fourth group "Staff only" so visitors do not read about staff items under Necessary. Recommendation: A for now (plan and RESEARCH inventory), revisit in 12-22.

## Known Stubs

None. The Cookie Policy is complete DRAFT text. `approved` stays false in `legalPages.ts`, so the DRAFT notice shows until the owner approves.

## Threat Flags

None new. T-12-54 (inventory drift) is mitigated by `cookie-inventory.node.test.ts`: it fails for a missing name, an extra name, an unprefixed name and a name that is not its own term. T-12-SC: no package added or bumped. Policy text renders as React text only; the one new link is a constant `https://` URL with `rel="noopener noreferrer"`.

## Self-Check: PASSED

- Files found: `legalCookies.ts`, `CookiePolicyPage.tsx`, `CookiePolicyPage.test.tsx`, `cookie-inventory.node.test.ts`, `LegalSection.tsx`, `legalContent.ts`, `legal-content.node.test.ts`.
- Commits found on HEAD: d693dc85, 9785d4d1, 698193b0, 784bbaa4 (`git log 52b60601..HEAD` lists all four).
