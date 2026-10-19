---
created: 2026-10-18T20:11:00-05:00
updated: 2026-10-18T20:11:00-05:00
---

# Phase 5 - UI Review

**Audited:** 2026-10-18
**Baseline:** 05-UI-SPEC.md (approved), CSPS-UI-SPEC.md, owner rules OR-1..OR-7 (OR-4 and OR-6 checked directly)
**Screenshots:** not captured. Owner instruction: code-only audit, because the owner's dev servers occupy ports 5180, 5115 and 7028 and must not be touched. Visual pillars are scored from source and recipes, not pixels.
**Interaction captures:** off (workflow.ui_interaction_capture is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Copy lives in `usersCopy.ts`, `profileCopy.ts` and `auditCopy.ts`; no generic labels; no long dash anywhere in `web/src`. Not checked line by line against the Copywriting Contract (spec lines 438+ not re-read in full). |
| 2. Visuals | 3/4 | Every contracted screen and primitive exists (U1-U5, P1-P3, A1, C1, ConflictBanner, RecordMeta, ActorName); nothing rendered to confirm hierarchy or the sticky shell. |
| 3. Color | 3/4 | No hardcoded hex or rgb in Phase 5 code; the two hits are `guard.ts` (comment) and `brand/Mark.tsx` (logo); accent distribution cannot be verified without a render. |
| 4. Typography | 2/4 | Phase 5 declares 16/14/13 and 400/600, but the shipped code still carries off-set sizes (11px tab bar, 9px/9.5px brand, 11px overline) and 41 `font-bold` uses. Most are inherited recipes. |
| 5. Spacing | 3/4 | Only 12 arbitrary spacing values across `modules/admin`, `layouts` and `components`; the Phase 5 admin ones are the tab bar's `pt-[6px]`, `py-[6px]` and `mt-[-6px]`, off the 4px scale. |
| 6. Experience Design | 3/4 | Strong state coverage (409 ConflictBanner, aria-disabled Account access, focus return, dirty guard, clipboard failure path); held at 3 because motion, sticky shell and phone behaviour are unverified. |

**Overall: 17/24**

Scores are deliberately conservative. Without screenshots no visual pillar can reach 4, and every pillar was approached assuming it diverges from the contract until code showed otherwise.

---

## Top 3 Priority Fixes

1. **Off-contract type sizes and weights remain in shipped recipes** (`modules/admin/components/admin.recipe.ts:37` tab bar `text-[11px]` with `font-semibold` / `font-bold` on current; `components/brand/brand.recipe.ts:51,52,95,96` 9px / 9.5px / 11px; `components/money/money.recipe.ts:17` 11px overline; `components/overlays/overlays.recipe.ts:167`; `components/media/media.recipe.ts:69`) - 9px and 11px text is hard to read on the phones the admin is used on, and Phase 5 declared "3 sizes, 2 weights" - raise the phone tab-bar label to the 13px Note size, and either record the remaining sizes as inherited approved exceptions in a UI-SPEC typography table or move them to the declared set. Also review the 41 `font-bold` uses against the "600 only, current tab 700" rule.
2. **Off-scale tab-bar spacing** (`admin.recipe.ts:29` `pt-[6px]`; `admin.recipe.ts:37` `py-[6px]`, `before:mt-[-6px]`, `before:mb-[3px]`) - breaks the 4/8/16/24 scale, and Phase 5 states "no new SPEC-GAP element introduces a value outside 4, 8, 16, 24, 32, 48" - use `py-1.5` with a scale-aligned offset, or add 6px and 3px to the declared inherited exceptions with a reason. This is the same finding Phase 4 raised and it is still open.
3. **Nothing visual was verified** - the full-bleed sticky shell (D-01..D-05), the expandable audit row stacking inside phone cards (D-27), the slide-over to full-screen switch, Espresso theme on every new screen, and the 320 px no-sideways-scroll rule have only code and test evidence - when the ports are free, capture U1, U2, U3, P1 (3 tabs), P3, A1 and C1 at 1440, 768 and 375 in Blush and Espresso (the existing `web/visual` Playwright specs `lists-overflow` and `navigation-overflow` cover only part of this).

Further items (all WARNING, none BLOCKER):
4. `modules/admin/components/AuthFrame.tsx:34` sets a `style` prop (`--login-h`). It is `undefined` in production and goes through CSSOM, so strict CSP is not broken, but the contract says no `style` attribute. Same item as Phase 4; confine it to the preview wrapper. (`components/*` also set CSS custom properties through `style={{ '--x': ... }}`; that is the declared P2 custom-property mechanism, not a defect.)
5. `components/forms/field.recipe.ts:120` uses `font-medium` (500) for field errors, outside the 400/600 set. Use `font-semibold` or normal weight.
6. Working tree has 10 uncommitted modified files (Sidebar, UserMenu, navigation.recipe, Modal, overlays.recipe, Note, states.recipe, auditCopy, admin routes, `visual/reference/rulings.css`). They were not reviewed as distinct changes (`git diff` returned nothing in this session's shell), so this audit reflects the files as they sit on disk. Confirm they are intended before the review is relied on.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- OR-4 scan: no U+2013 or U+2014 in any `.ts`, `.tsx` or `.css` file under `web/src` (byte-pattern grep returned zero hits). `AuditDetail.tsx:46` renders `EmptyValue` for an absent IP address, as the contract requires.
- Copy is centralised in `usersCopy.ts`, `profileCopy.ts`, `auditCopy.ts` and `authCopy.ts`, with none expected in JSX, matching the contract. A grep for `'Submit'`, `'OK'`, `'Click Here'`, `'Yes'`, `'No'` in `modules/admin` found none. Confirm-email strings ("Confirm New Email", "This link has expired") match the contract (`profileCopy.ts:127,138`).
- Owner-approved wording (screen copy, four edge assumptions, 40 temporary-password words, email wording) was not re-raised, per instruction.
- Gap: the full Copywriting Contract (spec lines 438-741) was not compared string by string. Treat a 3 here as "no defects found in a sample", not as a full pass.

### Pillar 2: Visuals (3/4)
- All contracted components exist: `RadioGroup`, `DateInput`, `ConflictBanner` (`components/states/ConflictBanner.tsx`), `ActorName`, `RecordMeta`, `CopyField`, `AuditDetail`, plus the five pages (`UsersPage` 501 lines, `ProfilePage` 750, `AuditLogPage` 371, `ConfirmEmailPage` 272, `ComponentShowcasePage` 191).
- `ProfilePage.tsx` at 750 lines and `EditUserPanel.tsx` (over 800 lines by its line references) are large single components. That raises the risk of focal-point and hierarchy drift between tabs; split if touched again. Informational.
- Icon-only row actions are specified to carry per-row names ("Edit {First Last}", "Show details for {action}, {when}"); not re-verified in markup here.
- No pixels: focal anchors (roster table under "Add User", profile header card, newest audit row), the sticky sidebar and the phone drawer are unconfirmed.

### Pillar 3: Color (3/4)
- No hardcoded hex or rgb in `modules/admin`, `layouts` or `components` except `guard.ts` (a comment) and `brand/Mark.tsx` (logo artwork). Colour flows through tokens.
- `admin.recipe.ts:29` uses `color-mix(in srgb, var(--surface) 94%, transparent)` for the tab bar. It stays token-based, so it is acceptable, but it is a one-off blend and not in the declared palette.
- Accent reservation list (sidebar marker, profile tab underline, stripe, ring, Manager badges, RadioGroup dot, chips) cannot be counted for 60/30/10 without a render; scored down one point for that.

### Pillar 4: Typography (2/4)
- Size distribution across `modules/admin`, `layouts`, `components` (arbitrary-px utilities): 14px x53, 12px x31, 16px x25, 11px x8, 15px x7, 13px x7, 40px x5, 22px x5, 30px x4, 160px x4, 34px x3, 32px x3, 9px x2, 92px x2, 9.5px x2.
- The Phase 5 declared set is 16/14/13 plus the inherited approved scale (34/30 titles, 22 card heads, 15 buttons, 12 badges and captions). The 11px, 9px, 9.5px, 32px, 40px, 92px and 160px values are not in either list in the UI-SPEC. They sit in shared recipes (brand, money, charts, media, tab bar) and are likely approved by the master spec, but Phase 5 does not record them as exceptions.
- Weights: `font-bold` x41, `font-semibold` x41, `font-medium` x2. The declared set is 400 and 600, with 700 for titles and the current tab. Count of 700 uses is high enough to warrant a review.
- Sub-12px text (9px, 9.5px, 11px) is a legibility risk for a phone-first audience and sits close to the WCAG 2.2 AA resize and spacing concerns the project binds itself to.

### Pillar 5: Spacing (3/4)
- 12 arbitrary spacing utilities in total; in the admin module they are all in `admin.recipe.ts` (tab bar: `pt-[6px]`, `py-[6px]`, `before:mt-[-6px]`, `before:mb-[3px]`).
- Declared exceptions (12px, 20px, 2px, 6px, 10px) are inherited from App. B/C/E and are allowed. The 6px and 3px tab-bar values are not on that list.
- Phase 5 pages use no raw pixel spacing in their own files (the grep over `modules/admin` found hits only in the recipe file).
- Touch targets: row actions are the recorded 36px exception (P2 O-8), below the project-wide 44px rule. That is an owner-approved exception but remains a standing deviation on the Users and Audit Log pages.

### Pillar 6: Experience Design (3/4)
- Loading, error and empty states: `LoadingRegion` / `Skeleton` / `ErrorState` / `EmptyState` references in UsersPage (3), ProfilePage (18), AuditLogPage (6), ConfirmEmailPage (5).
- D-20 stale-save pattern is implemented as a shared component (`ConflictBanner`) and used in `EditUserPanel` and `ProfilePage`.
- D-21 / Account access: `EditUserPanel.tsx` applies `aria-disabled` (lines 595 to 731) to the immediate actions while the form is dirty, as contracted.
- Focus management is explicit in `UsersPage.tsx` (row Edit button, flipped toggle, heading fallback after delete, lines 196-259).
- CopyField has tested success and clipboard-refused paths (`CopyField.test.tsx`).
- Motion: 14 `prefers-reduced-motion` / `motion-reduce` references in components and modules; chevron turn and Copied swap are specified to honour it, not rendered here.
- Gap, needs human review (parked owner checks, not done): real-phone motion behaviour, the phone tab bar, the sticky shell on a real phone address bar, and the other two parked real-world checks recorded in 05-37. These are listed as outstanding, not as passed.
- Registry safety audit: skipped. `shadcn_initialized: false`, no `components.json`.

---

## Needs Human Review

- Real-phone motion and tab-bar check (parked owner check).
- The remaining parked real-world checks from 05-37.
- A live visual pass of the sticky shell at 320 px, 768 px and 1920 px in both themes once ports 5180 and 5115 are free.

## Files Audited

- `.planning/phases/05-profile-user-management/05-UI-SPEC.md` (lines 1-438)
- `.planning/phases/04-identity-authentication/04-UI-REVIEW.md` (format reference)
- `web/src/modules/admin/pages/{UsersPage,ProfilePage,AuditLogPage,ConfirmEmailPage,ComponentShowcasePage}.tsx` (state, focus and structure greps)
- `web/src/modules/admin/components/{admin.recipe.ts,EditUserPanel.tsx,AuditDetail.tsx,AuthFrame.tsx,CopyField.test.tsx}`
- `web/src/modules/admin/{usersCopy,profileCopy,auditCopy,authCopy}.ts`
- `web/src/components/{brand,money,media,overlays,forms,states}/*.recipe.ts` (type and spacing greps)
- Repo-wide greps over `web/src` for dashes, hex colours, font sizes and weights, arbitrary spacing and `style` attributes
