---
created: 2026-11-24T04:25:00-0600
updated: 2026-11-24T04:25:00-0600
---

# Phase 13 UI Review

**Audited:** 2026-11-24
**Baseline:** `13-UI-SPEC.md` (plus `docs/CSPS-UI-SPEC.md`)
**Screenshots:** not captured. This was a code-only audit. No dev server was started, and the static capture only shows the home page anyway.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Every interaction finding comes from reading the code.

Owner choices already parked (P13-BL-09, 11, 14, 16, 18, 19, 20, 22, 25, 28, 29, 31) are not raised again.

## Pillar Scores

| Pillar | Score | Key finding |
|---|---|---|
| 1. Copywriting | 3/4 | Plain, specific, no long dashes. Some filter empty messages repeat. |
| 2. Visuals | 3/4 | Clear structure and focal points, with roles and labels. Not checked on screen. |
| 3. Color | 3/4 | Only tokens, no hex in Phase 13 files. Accent use matches the contract. |
| 4. Typography | 2/4 | New code uses sizes and a weight the spec says it must not. |
| 5. Spacing | 3/4 | Scale and 44 px targets hold. A few raw pixel values. |
| 6. Experience Design | 3/4 | States, confirms and live regions are present. Never driven in a browser. |

**Overall: 17/24**

## Top Fixes

1. **WARNING: type contract broken by new code** (`quoteRequests.recipe.ts:44`). The selected pill uses `font-bold` (700). The spec allows only 400 and 600 for new Phase 13 elements. Use `font-semibold` and keep the maroon fill as the cue, or record a SPEC-DEVIATION.
2. **WARNING: raw size values instead of the declared tokens.** Recipes mix `text-[14px] leading-5` (`quoteRequests.recipe.ts:10,22,77,92,95,107`) with the `text-14` token (`quoteForm.recipe.ts`). Use one token form so the 16/14/13 set can be checked by a grep gate.
3. **WARNING: fixed form placeholder heights** (`quoteForm.recipe.ts:65`, `min-h-[696px]` and `pg-phone:min-h-[1000px]`). They were measured once. A copy or font change makes the form shift when it loads (D-35). Add a test that measures the placeholder against the real form.
4. **WARNING: no visual proof.** No screenshots exist for Blush or Espresso at 320, 768 and 1440 px. Run a Playwright pass on the Contact form, the inbox, the request page and the showcase section before shipping.
5. **WARNING: repeated empty-state text.** The Converted, Closed and Spam empty messages are the same sentence ("Requests show here when their status changes."). Say what each one means.
6. **WARNING: the pick-error and photo-count live regions are split across several `role="alert"` and `role="status"` nodes** (`QuoteForm.tsx:255,493`; `QuotePhotoSlot.tsx:106`; `QuoteSendAnswers.tsx:25,104`). Confirm in a screen reader pass that two alerts do not fire at once.

No BLOCKER found. No pillar scored 1.

## Detailed Findings

### 1. Copywriting (3/4)
- `quoteRequestsCopy.ts` is one module with sentences like "Check the spelling, or search by phone number." Short and plain.
- Button labels are specific ("Send Inquiry", "Turn into Order", "Delete Request", "Add Note"). No "Submit" or "OK" in the new files.
- No em or en dash found in Phase 13 files under `web/src` (grep clean). OR-4 holds.
- Gap: `empty.messages` for converted, closed and spam are identical (`quoteRequestsCopy.ts` empty block). Low cost to improve.
- Gap: `pieces` renders "21-50 pcs", an abbreviation. Fine for staff, but "pieces" is the column name, so "pcs" is redundant.

### 2. Visuals (3/4)
- Structure matches the spec: R2 two columns at 1024 px and up (`quoteDetailClasses`), one column below. Main action "Turn into Order" is the one primary on R2.
- Pill filter is a `role="toolbar"` with a hidden "requests" noun; status badges carry a word, so orange is never the only cue.
- Photo remove buttons carry `aria-label` (`QuotePhotoPicker.tsx:349`).
- Not verified on screen: wrapping of long names (`wrap-anywhere` is set), the aside on 768 px, Espresso contrast.

### 3. Color (3/4)
- Zero hex or `rgb(` values in the Phase 13 component, page and recipe files. Colors are tokens (`text-ink-muted`, `bg-primary`, `text-warning`).
- Accent is limited to the NavCount chip, New badge, drag state and links, as declared. Selected pill is maroon, as declared.
- One mixed value: `color-mix(...)` in `admin.recipe.ts:40` is inherited, not new.
- Contrast was not measured here. The spec says the tones pass AA in both themes; a browser pass should confirm the Espresso pill and warning text.

### 4. Typography (2/4)
- Declared set is 16/14/13 and weights 400/600.
- `quotePillOnClasses` uses `font-bold` (700). Not in the declared set.
- The nav and admin chips use `text-[12px]` (`admin.recipe.ts:65`); the spec lists 12 as inherited for the NavCount chip, so this one is allowed.
- `text-[14px] leading-5` is repeated in six Phase 13 recipe lines, while `text-14` exists. Mixed forms hide drift.
- The R2 h1 uses `text-[34px]` and `text-[30px]`, which the spec lists as the inherited `.s-ph-title` look. Allowed.
- Other `font-bold` hits (17) are in inherited order form recipes, not Phase 13.

### 5. Spacing (3/4)
- Gaps are all on the 4 px scale (`gap-2`, `gap-3`, `gap-4`, `gap-6`). The 20 px form row gap is a declared exception.
- Touch targets: pills, contact links and name links use `min-h-11` or `hitAreaClasses`. Good.
- Raw values: `gap-[6px]` in `quotePillClasses` (6 px is off the 4 px scale and not on the declared list), and the `696px` and `1000px` heights.
- `max-w-[340px]` on the notice is a declared value.

### 6. Experience Design (3/4)
- First load shows a SkeletonTable; a failed first load and a failed refresh are handled differently ("Showing figures from {time}. Couldn't refresh." with Try Again).
- Empty states exist for every filter and for search, with Clear Search.
- Delete Request is a Manager-only ConfirmDialog that names the visitor; Spam on a request with photos asks first. 409 shows a ConflictBanner.
- Status menu is a real `role="menu"` with arrow-key handling (`QuoteStatusMenu.tsx:256,282`).
- Polite live regions announce new requests (`QuoteRequestsPage.tsx:219`) and note changes (`QuoteNotesCard.tsx:153`).
- Risk: the status menu is a hand-built menu. It has focus code but no browser proof for Escape, Tab and focus return. The code was not run.
- Registry audit: not applicable (no third-party registry blocks used).

## Files Audited
- `web/src/modules/admin/components/quoteRequests.recipe.ts`, `QuoteStatusFilter.tsx`, `QuoteStatusMenu.tsx`, `QuoteNotesCard.tsx`, `QuoteRequestPhotosCard.tsx`, `QuoteRequestsStrip.tsx`
- `web/src/modules/admin/pages/QuoteRequestsPage.tsx`, `QuoteRequestPage.tsx`
- `web/src/modules/admin/quoteRequestsCopy.ts`
- `web/src/modules/public/components/quoteForm.recipe.ts`, `QuoteForm.tsx`, `QuotePhotoPicker.tsx`, `QuotePhotoSlot.tsx`, `QuoteSendAnswers.tsx`
- `13-UI-SPEC.md`, `999.9-owner-items-parked-during-phase-13-execution/DECISIONS.md`
