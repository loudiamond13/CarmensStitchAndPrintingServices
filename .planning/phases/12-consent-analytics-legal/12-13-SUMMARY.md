---
phase: 12-consent-analytics-legal
plan: 13
subsystem: public-web-consent
tags: [consent, cookie-settings, footer, gpc, lazy-chunk, bundle-budget, tdd]
created: "2026-11-17T07:10:00-06:00"
updated: "2026-11-17T07:10:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-09 consent store (openSettings, closeSettings, ConsentSlot), 12-08 consent endpoint, 12-31 D-43 rule, 12-32 entry room"
provides:
  - "CookieSettingsDialog (CS1): the lazy Cookie Settings window, opened from any public page"
  - "Footer Legal row (FT) in both footer variants: four legal links, then the Cookie Settings button"
  - "Store: settingsLoading, settingsReady, current; a repeat saved line is read again"
  - "consentFocus.ts: focusMain and focusMainWhenChosen, shared by the bar and the window"
affects: [12-14, 12-15, 12-17, 12-19, 12-20, 12-24]

actuals:
  tokens: 13700
  tasks: 3
  commits: 8
plan_head_before: e9a110c3b00517baabc84f29400c89089d2c581f
plan_head_after: e725b4f2ea52f2bb07399ed24d2d758c695410c2
commits: 8

tech-stack:
  added: []
  patterns:
    - "The window closes first and then saves, so the saved line is announced on a live page (the page behind an open dialog is inert)"
    - "Visitor edits are kept apart from the saved choice, so the boxes follow the store until the visitor touches one"

key-files:
  created:
    - web/src/modules/public/components/CookieSettingsDialog.tsx
    - web/src/modules/public/components/CookieSettingsDialog.test.tsx
    - web/src/modules/public/consentFocus.ts
    - web/src/modules/public/consentFocus.test.ts
  modified:
    - web/src/modules/public/components/SiteFooter.tsx
    - web/src/modules/public/components/SiteFooter.test.tsx
    - web/src/modules/public/components/ConsentSlot.tsx
    - web/src/modules/public/components/ConsentBar.tsx
    - web/src/modules/public/components/consent.recipe.ts
    - web/src/modules/public/consentCopy.ts
    - web/src/modules/public/consentRules.ts
    - web/src/modules/public/copy.ts
    - web/src/modules/public/hooks/useConsent.ts
    - web/src/modules/public/hooks/useConsent.test.tsx
    - web/src/layouts/PublicLayout.test.tsx

key-decisions:
  - "The window closes before the choice is saved, so the polite line is read on a live page; with the bar open, focus goes to main once the bar has closed"
  - "While the bar still asks, the window opens with both boxes unticked even if an old choice exists (plan truth, D-34)"
  - "A repeat of the same saved line gets a trailing no-break space, so a second save is read again"

requirements-completed: [ANL-03, ANL-01, LEGAL-05]

metrics:
  duration: about 3h
  completed: 2026-11-17
---

# Phase 12 Plan 13: Visitors can reopen Cookie Settings from any page and change or withdraw their choice Summary

*Created: 2026-11-17T07:10:00-06:00 · Updated: 2026-11-17T07:10:00-06:00*

**Every public footer now has a Legal row (Privacy Policy, Cookie Policy, Terms of Use, Accessibility Statement, Cookie Settings). The button opens a lazy Cookie Settings window with Visitor stats and Google map, the saved choice and its date, the GPC lock, and Reject All, Accept All and Save Choices. The first download grew by about 1.0 KB; the window is its own chunk.**

## What was built

- **Footer** `SiteFooter.tsx`: a `nav` named "Legal" (name from `copy.ts`). Full footer: after the dashed rule, above the copyright line. Base footer: under the one-row base. Items are 44px tall, 14px, 16px by 8px wrapping gaps, `aria-current="page"` on the current link. The button is pending (`aria-busy`, `aria-disabled`, focus kept) until the window mounts on the first open. The row never waits for the shop facts.
- **Window** `CookieSettingsDialog.tsx` (own chunk, mounted by `ConsentSlot` while `settingsOpen`): description, "Read the Cookie Policy" link (closes the window), saved-choice line with the en-PH date, GPC note, "Your choices" fieldset (Necessary with "Always on" badge, Visitor stats, Google map), footer buttons. D-36 hint: "Records are kept for about 13 months."
- **GPC (D-20):** Visitor stats is `aria-disabled` and unticked with its own hint, the Google map box works, and only Save Choices shows.
- **Save (ANL-07):** each of the three buttons closes the window, saves with source `settings`, and announces. With the bar open, focus goes to `main` after the bar closes; otherwise back to the opener.
- **Store:** `settingsLoading` and `settingsReady`, `current` (the saved cookie still counts, from `isCurrentChoice` and the Manila day, D-43), and the repeat-announcement fix.

## TDD gate sequence

| Step | Commit | Evidence |
|------|--------|----------|
| Task 1 RED | 4bc147b6 | `Tests 6 failed \| 51 passed (57)`: no Legal nav, no `settingsLoading` |
| Task 1 GREEN | ccf72f36 | `Tests 57 passed (57)` (window, footer, store) |
| Task 2 RED | ae407696 | `Tests 14 failed \| 30 passed (44)` |
| Task 2 GREEN | 12d60298 | footer 44 passed; public, layouts, core `Tests 955 passed (955)` |
| Task 3 RED | 9e8c4f34 | `Tests 9 failed \| 52 passed (61)` |
| Task 3 GREEN | 954bf4ed | `Test Files 4 passed (4)`, `Tests 71 passed (71)` |
| Coverage fill | 087e3393 | two branch tests, pass on arrival |
| Fix | e725b4f2 | class gate and public-look rule (see Deviations) |

Passed on arrival (recorded): in Task 3 the bar paths and the GPC save already passed, because Task 1 built the save flow; the Task 1 footer axe case passed with only the button present. The machine classifier `tdd-red-evidence` was not run; each RED failed on the planned assertion.

## Verification (real output)

- Typecheck (`tsc` on the three projects): clean. `eslint . --max-warnings 0`: clean before the last small commit; the last edits were linted on their files (clean). Prettier check on `src/modules/public` and `src/layouts`: clean.
- Window, footer, store, bar and focus tests with coverage: `Test Files 5 passed (5)`, `Tests 117 passed (117)`. The new files `CookieSettingsDialog.tsx` and `consentFocus.ts` show 100% (not listed as below 100% in the report); `useConsent.ts` 96.29% branches (the open line is the old `typeof document` guard).
- After the last commit: `scripts/tailwind-classes.test.ts`, `src/test/public-look.node.test.ts`, `SiteFooter`, `CookieSettingsDialog` and `PublicLayout` tests: `Tests 193 passed (193)`.
- Full web run (`test:coverage`) on a machine busy with other sessions: `Test Files 31 failed | 380 passed (411)`, `Tests 90 failed | 10958 passed`. 63 of the failures were "Test timed out in 5000ms" in admin files. Of the rest, two were mine and are fixed (class gate opacity, public-look aria-label). `AdminLayout`, `OrderFormPage`, `ExpensesPage` and `admin/routes` passed when re-run alone (321 passed). `scripts/license-policy.test.ts` and the third-party notices test fail inside a worktree (known). A clean full run is still owed in the main checkout; the global coverage figure was not produced.
- Build (`npm run build`, last tree): Home 146.57, Products 143.27, Gallery 144.61, **Contact 146.63**, **Privacy 148.11**, Cookies 146.04, Terms 147.22, Accessibility 146.78, Not found 139.33, Admin JS 218.81, CSS 20.42 KB. `build:budget`: Home 146.60, Contact 146.67, Privacy 148.14. Limit 150 KB, unchanged. No Vite chunk-size warning; entry 366.74 KB raw. The window is its own chunk (checked: its strings are not in the entry).
- Growth from the 12-32 base (budget build): about +1.0 KB on every public row (Privacy 147.11 to 148.14).
- **Merged with plan 12-15** (about +0.59 KB per row, from the coordinator): Privacy about 148.73, Terms 147.84, Contact 147.26, Home 147.19. All under 150 KB, about 1.3 KB left on the tightest row. Privacy is about 0.2 KB over the soft 148.50 KB target; the limit holds. Gzip is not exactly additive: re-measure after the merge.

## Deviations from Plan

**1. [Rule 1 - Bug] A second save said nothing to a screen reader.** The saved line is the same text every time, so the live region did not change. The store now adds a trailing no-break space on a repeat. Test in `useConsent.test.tsx`.

**2. [Rule 2 - Missing critical] The saved line could be lost behind the open dialog.** The page behind a dialog is inert, so a line set while the window is open is not read. The window now closes first and saves second; with the bar open, `focusMainWhenChosen` focuses main after the bar has closed. New `consentFocus.ts` (the plan did not list it), shared with the bar.

**3. [Rule 3 - Blocking] Existing rules rejected two details of the plan.**
- The plan's acceptance grep wants `aria-label="Legal"` in `SiteFooter.tsx`. `public-look.node.test.ts` forbids a string-literal `aria-label` in public TSX, so the name is `FOOTER.legal.label` from `copy.ts`. That grep returns 0; the intent (a nav named "Legal") is tested.
- The class gate forbids opacity classes, so the pending button dims with `aria-busy:text-ink-muted` and a wait cursor.
- Both were found by the full web run, fixed in `e725b4f2`.

**4. [Rule 3 - Blocking] Files outside the plan's list.** `consentRules.ts` (adds `current`), `ConsentBar.tsx` (uses the shared `focusMain`), `PublicLayout.test.tsx` (the page now has a second `nav`, "Legal"), `consentFocus.ts` and its test.

**5. Test setup:** the window is a lazy chunk and its first transform took longer than a test waits, so the window test loads the chunk in `beforeAll`.

**6. Commit trailer** is `Co-Authored-By: Claude Sonnet 5.5`, as in plans 12-08, 12-09, 12-31 (the plan text says Opus 5.5; the session attribution rule names this model). The per-plan HEAD ledger could not be written under the shared git dir; the base above is from the spawn-time check, and `commits: 8` was measured with `git rev-list --count e9a110c3..HEAD` before the summary commit.

## Open items for the owner or the orchestrator (nothing here blocks the plan)

1. **Look-equality (parity) fails for the public footer scenarios.** `npm run parity -- --grep @layouts-public --project chromium` gives 6 failed rows: the approved reference has no Legal row, so structure and pixels differ (`public-shell` and `public-shell-base`). The UI-SPEC says these scenarios are "updated for the legal row (listed in the P2 intentional-differences table)", but `web/visual/intentional-differences.ts` has no entry kind for an inserted element, and tolerance entries need an owner decision (D-08). Options: (A) add a new "inserted element" exception kind with a decision ID; (B) have the dev preview hide the row so parity stays pixel-equal; (C) a pixel tolerance. Recommendation: A, because it keeps the real shell under test. Not done, parked here.
   - The same run showed one axe `target-size` finding on the Staff Login link in the grouped parity page at 390px. It did not reproduce in a single-page probe (full page or group page, axe default and the e2e options), so it looks like a scroll-position effect under the sticky header in that harness. It needs a look when item 1 is settled.
2. **UI-SPEC says two things.** CB1 says the bar's Cookie Settings opens the window "with nothing ticked"; the "re-ask" row of the UI considerations says the window "opens on the old choice". I followed the plan truth and D-34: nothing ticked while the bar asks. The UI-SPEC row should be corrected.
3. **UI-SPEC copy:** its Visitor stats hint still says "kept for 13 months"; the code says "about 13 months" per D-36 (flagged in the plan for the owner's UI review).
4. **E2E:** no Playwright spec was added (not in the plan). Existing specs, run after the preflight on Chromium only (`npm --prefix web run e2e -- --grep "@public|@contact" --project chromium`): `30 passed (2.6m)`, including the real-page axe checks and the public sweep. Firefox and WebKit were not run. Port 5199 was busy with another session on the first try; no server was left running.
5. The coordinator's budget note is addressed above: merged with 12-15 the tightest row stays under 150 KB.

## Known Stubs

None.

## Threat Flags

None new. T-12-35 is mitigated: under GPC the box is `aria-disabled`, unticked, ignores clicks (tested), and the save path forces stats off. T-12-36 is mitigated: every save from the window posts a decision with source `settings` (tested for Save Choices, Reject All; Accept All through the same path). T-12-SC: no package added or bumped.

## Self-Check: PASSED

- Files found: `CookieSettingsDialog.tsx`, `CookieSettingsDialog.test.tsx`, `consentFocus.ts`, `consentFocus.test.ts`, and the modified files above.
- Commits found on the branch: 4bc147b6, ccf72f36, ae407696, 12d60298, 9e8c4f34, 954bf4ed, 087e3393, e725b4f2.
- Acceptance: `lazy(` in `ConsentSlot.tsx` 2; "Save Choices" in `consentCopy.ts` 1; the GPC sentence and "Records are kept for about 13 months." each 1; `ariaDisabled` in the window 1; `aria-label="Legal"` 0 (Deviation 3); "Accessibility Statement" in `copy.ts` 1; `aria-current` in `SiteFooter.tsx` 1.
- STATE.md and ROADMAP.md untouched.
