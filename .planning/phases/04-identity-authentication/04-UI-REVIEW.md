---
created: 2026-10-15T17:00:00-05:00
updated: 2026-10-15T17:00:00-05:00
---

# Phase 4 - UI Review

**Audited:** 2026-10-15
**Baseline:** 04-UI-SPEC.md (approved), CSPS-UI-SPEC.md, project rules OR-1..OR-6
**Screenshots:** not captured (no dev server answered on localhost:5180; code-only audit, visual pillars are scored from source and recipes, not pixels)
**Interaction captures:** off (workflow.ui_interaction_capture is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | AUTH_COPY matches the contract nearly string for string; two small wording and consistency gaps |
| 2. Visuals | 3/4 | Structure, landmarks, one h1, skip link, focal anchors all per contract; nothing rendered to confirm |
| 3. Color | 3/4 | No hardcoded hex/rgb in modules/admin or layouts; accent distribution unverifiable without render |
| 4. Typography | 3/4 | Only 2 weight utilities in phase code, but the mobile tab bar uses off-contract 11px/700 |
| 5. Spacing | 3/4 | Arbitrary values confined to inherited recipes; `py-[6px]` is off the 4px scale |
| 6. Experience Design | 4/4 | S1-S7 states, focus moves, pending, dialogs, failure paths and notices all implemented |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Mobile tab bar label is 11px with 700 on the current item** (`modules/admin/components/admin.recipe.ts:36`) - sits outside the declared 16/14/13 sizes and 400/600 weights, and is hard to read on the phones the admin is used on - move to the 13px Note size and 600 weight, or record it as an inherited spec exception in the UI-SPEC typography table.
2. **No rendered verification exists for any visual pillar** - OQ-8/OQ-9 (brand-panel bottom zone, dot mesh) and the S7 phone cards at 320/375 are only covered by code and parity tests, so a visual regression would pass this audit - run the Vite server on 5180 and capture S1-S7 at 1440/768/375 in Blush and Espresso before shipping.
3. **Off-scale spacing `py-[6px]` and `before:mt-[-6px]` on the tab bar** (`admin.recipe.ts:36`) - breaks the 4/8/16 scale and the "no other non-standard value" rule - use `py-1.5` with a scale-aligned offset, or add the value to the declared exceptions with a justification.

Further minor items: see Detailed Findings (curly apostrophe, `style` prop in AuthFrame, "We could not" wording).

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- WARNING: `AUTH_COPY` (`web/src/modules/admin/authCopy.ts`) reproduces the contract for S1 to S7, notices, dialogs, toasts and the sessions page verbatim, including "Email or password is incorrect." and the D-10 resend-cap lines. No generic "Submit/OK/Cancel" labels in auth screens; every CTA is specific ("Verify Code", "Save Password", "Sign Out Device").
- WARNING: `authCopy.ts` S5/S6 `checkFailed` reads "We could not check your reset link yet." while every other string uses contractions ("couldn't", "can't", "didn't"). This is unspecified SPEC-GAP copy and is inconsistent in voice. Fix: "We couldn't check your reset link yet."
- WARNING: `modules/admin/copy.ts:12` uses a typographic apostrophe in "We couldn’t sign you out." This is owner-specified (D-45) and not a long dash, so it does not violate OR-4, but it is the only curly quote in the client and will not match plain-apostrophe string searches in tests. Informational.
- OR-4 scan: no U+2013/U+2014 found in modules/admin or layouts source.

### Pillar 2: Visuals (3/4)
- `layouts/AuthLayout.tsx` and `AuthFrame.tsx` implement the contract structure: page root `data-theme="light"`, SkipLink first, brand panel with `aria-hidden` slab, bands and numeral, one `main#main tabIndex={-1}`, `Logo size="lg"`. Each card form has an `aria-label` and `noValidate` (`AuthCards.tsx`, `SignInForm.tsx:78`).
- S7 (`SessionsView.tsx`) uses the page-head recipes, a real ResponsiveTable with caption, "This device" badge as text, empty actions cell on the current row, and the only-this-device Note. Icon-only row action carries a descriptive label (`rowSignOutName`) plus a title hint.
- WARNING: `AuthFrame.tsx:34` sets a `style` prop (`--login-h`). It is `undefined` in production (value only used by the parity preview), and React sets styles through CSSOM so the strict CSP is not broken, but the contract says no `style` attribute on any auth screen. Fix: confine the prop to the preview wrapper rather than the shipped component.
- No screenshots, so focal hierarchy, brand-panel overlap (OQ-9) and phone card layout are unconfirmed.

### Pillar 3: Color (3/4)
- No hardcoded hex or rgb in `modules/admin` or `layouts` (the only `#` hit is a GitHub issue reference in a comment, `guard.ts:2`). All color flows through tokens.
- Contract limits primary to one button per auth screen and keeps S7 free of accent and primary; S7 uses `variant="secondary"` and `Badge` tones only (`SessionsView.tsx`). Consistent with contract.
- Cannot verify the 60/30/10 split or Espresso rendering for S7 without a render; scored down one point for that.

### Pillar 4: Typography (3/4)
- Phase code writes almost no size utilities: the only weight utilities in `modules/admin` and `layouts` are one `font-semibold` and one `font-bold`, both in the tab bar recipe.
- WARNING: `admin.recipe.ts:36` TabBar uses `text-[11px] leading-[14px]` with `font-semibold` and `aria-[current=page]:font-bold`. 11px and 700 are not in the declared set (16/14/13, 400/600) and not in the inherited table. Also below the 13px floor the phase otherwise holds.
- Other arbitrary sizes (`text-[12px]`, `text-[14px]`, `text-[15px]`) live in `components/*` recipes inherited from Phase 2 and are listed in the contract.

### Pillar 5: Spacing (3/4)
- Arbitrary spacing in phase modules is limited to `admin.recipe.ts:36` (`py-[6px]`, `before:mt-[-6px]`, `before:mb-[3px]`, `before:h-[3px]`) plus `max-w-[1440px]` and a `calc(100dvh-var(--header-height))` min-height. The `6px` and `3px` values are not on the 4/8/16/24/32/48 scale and are not in the declared exceptions (12px, 20px).
- 44px hit areas: `hitAreaClasses` is applied to the checkbox label, "Forgot password?" and the back link (`SignInForm.tsx`), and in AuthCards, AcceptInvitePage and ResetPasswordPage, as OQ-5 requires. Row actions on S7 are the 36px P2 pattern, below the project 44px target, but the contract explicitly accepts this and adds a confirm dialog to mitigate mistaps.

### Pillar 6: Experience Design (4/4)
- States covered in code: S7 pending/failed/refetching/only-this-device (`SessionsView.tsx`); S5/S6 checking, invalid and check-failed with retry; S2 resend cooldown, cap and lock; S4 sent state for every outcome; Logout failure toast (D-45).
- `SessionsPage.tsx` implements the contract focus rule after removal (next row, else previous non-current row, else the h1) and treats a 404 or `alreadySignedOut` as success with the info toast. Failure keeps the dialog open (`revoke` returns `ok: false`).
- UserMenu receives `devicesPath` and `onSignOutOthers` from `AdminLayout.tsx`, so the menu items are wired and "Sign Out Other Devices" is always enabled (D-44).
- Per-phase tests exist for every page and dialog (`*.test.tsx`), which supports the interaction claims, but no interaction capture was run so behavior was not observed live.

---

## Registry Safety

Registry audit: shadcn not initialized (`shadcn_initialized: false`), skipped.

---

## Files Audited
- `.planning/phases/04-identity-authentication/04-UI-SPEC.md`
- `web/src/modules/admin/authCopy.ts`, `copy.ts`
- `web/src/modules/admin/pages/SessionsPage.tsx`
- `web/src/modules/admin/components/SessionsView.tsx`, `SignInForm.tsx`, `AuthFrame.tsx`, `AuthCards.tsx` (grep), `admin.recipe.ts`
- `web/src/layouts/AuthLayout.tsx`, `AdminLayout.tsx` (grep)
- Grep sweeps across `web/src/modules/admin` and `web/src/layouts` for long dashes, hex colors, arbitrary values, font utilities and `style=`
