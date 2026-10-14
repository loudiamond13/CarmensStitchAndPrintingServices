---
created: 2026-10-14T05:55:00-05:00
updated: 2026-10-14T05:55:00-05:00
---

# Phase 2 - UI Review

**Audited:** 2026-10-14
**Baseline:** 02-UI-SPEC.md (approved) plus CSPS-UI-SPEC.md. Owner-approved differences (D-01..D-42, UAT rulings) are treated as accepted and not scored as defects.
**Screenshots:** captured from the owner's Vite server on http://localhost:5180 (public home at 1440, 768 and 375 wide; admin dashboard at 1440; full-page Component Showcase at 1440). Files are in `.planning/ui-reviews/02-20261014-054704/` (git-ignored).
**Interaction captures:** off (workflow.ui_interaction_capture is false). Interaction findings are code-derived or taken from the existing automated suites, not captured here.
**Limits:** the preflight script call failed on path quoting, so it did not run. I started nothing and only read from the owner's existing 5180 server. The showcase screenshot is 43,000 px tall and too small to judge by eye, so the showcase is judged from code and from the owner's own D-23 pass (UAT tests 2-4). Dark theme and 320 px were not captured by me.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Plain-English copy matches the contract; one test hint and a few demo strings are developer-flavoured |
| 2. Visuals | 3/4 | Strong hierarchy and brand; admin sidebar stops mid-screen on a tall window |
| 3. Color | 3/4 | Token-only palette; hex lives only in the logo mark; no 60/30/10 measurement exists |
| 4. Typography | 3/4 | Follows the approved spec scale, but 25 distinct pixel sizes are in use |
| 5. Spacing | 3/4 | Token steps mostly; 14 arbitrary pixel values sit outside the declared scale |
| 6. Experience Design | 3/4 | Loading, error, empty and focus states are covered; nothing was verified live by me |

**Overall: 18/24**

No pillar is a 1, so there are no BLOCKERs. Every finding below is a WARNING.

---

## Top Priority Fixes

1. **Admin shell does not fill the window height (WARNING).** In the 1440x900 admin shot the sidebar (tan) ends at about 536 px and the page background shows below it. Staff on a tall monitor see a cut-off rail with Logout floating mid-screen. Make the sidebar `min-h-dvh` or sticky and full height, and check it at 1920x1080. Not covered by the parity suite, because its rows are fixed-height frames.
2. **Arbitrary spacing and type values outside the declared scale (WARNING).** There are 25 distinct `text-[Npx]` values (for example 9, 9.5, 17, 26, 92) and 14 arbitrary spacing values (`gap-[22px]`, `mt-[-6px]`, `p-[3px]`, `mb-[.15em]`). Most come from the approved spec. Add a short "allowed literals" table in docs/web/styling.md, so a later phase cannot copy an odd value by accident, and re-check `gap-[22px]`, `mt-[-6px]` and `9.5px` against App. B/C.
3. **No measured 60/30/10 check and no contrast table for the Espresso theme (WARNING).** Color compliance was proven by token equality only. Add one audit row per theme that lists text-on-surface pairs with their ratios (AA 4.5:1 for text, 3:1 for UI). This matters most for `ink-subtle` on `surface-2`, where D-02 dims inactive rows by colour only.
4. **Page-height behaviour on the public placeholder (WARNING).** At 1440x900 and 375x812 the content ends about a third of the way down and the footer is not visible in the first screen. I could not tell whether the footer sits below the fold or is missing. Confirm the footer sits at the bottom of a short page (flex column with `min-h-dvh`).
5. **Sidebar "Manager" tag on Users (minor).** The tag shows beside Users in the admin shot. This is the approved D-BL-02 behaviour (hidden only when current), so it is accepted. Make sure that the label is not the only cue that the item is restricted.
6. **Demo-only copy such as "Open Delete Payment"** and the "Development only. This screen is built in a later phase." subline are accepted by the owner (R2-14, R2-15), but confirm both are stripped from production builds in Phase 3.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- The public page reads "Custom Sublimation · Philippines", "Site update in progress." and "We're building our new website. To order now, message us on Messenger or call the shop." This matches the D-21 contract, is plain English and tells the visitor what to do. Uppercase headline and eyebrow follow spec §3.3.
- The CTA is Title Case with a verb ("Get a Quote"). It stays a button by owner ruling R2-11 (accepted).
- Admin copy ("Nothing to show here yet", "Open Component Showcase") is clear. The sentence "Until this screen is built, the Component Showcase shows every shared building block" is developer-talk for staff, but it is dev-only (accepted R2-15).
- Search hint "Ctrl K" is a changed shortcut (D-41 R2-04, accepted).
- Warning: I did not read the 27 SPEC-GAP strings (OTP, money hint, ErrorState) line by line. The money-paste hint was implemented under R2-18 (accepted).

### Pillar 2: Visuals (3/4)
- Public home: clear focal point (the 800-italic headline with the orange "IN PROGRESS." accent), sticky header with a single dark primary CTA, current-page underline on Home. Hierarchy is good at 1440, 768 and 375.
- Mobile: the header collapses to a menu icon (hamburger) that sits at the right and has a visible target; logo and tagline fit at 375.
- Admin: the active sidebar item is a dark filled pill with an orange edge marker and bold weight (D-03 second cue), so selection does not depend on colour alone. Icon + label pairs everywhere. Dashed empty-state card with an icon tile is clear.
- WARNING: the sidebar ends at about 536 px on a 900 px window (see Fix 1). Below it the page is flat background.
- WARNING: both the public and admin screens end early, leaving large blank areas. This is expected on placeholder pages and is not scored hard.
- Icon-only controls: 118 `aria-label` uses under `src/ui`, including the sidebar collapse toggle, theme toggle and mobile menu. No icon-only button without a label was found in the screenshots.

### Pillar 3: Color (3/4)
- Utilities read the 37 named tokens. A grep for hex or `rgb(` in app and UI code found hex only in `ui/brand/Mark.tsx` (the logo, which App. F defines literally, with token fallbacks for the dark ring and stitch). That is acceptable and matches the contract.
- Screenshot check: the brown primary (CTA, active nav item, Open Component Showcase) is the one strong colour and orange is limited to accents (logo, nav underline, edge marker, eyebrow). This reads as a controlled accent.
- WARNING: the eyebrow "CUSTOM SUBLIMATION" and the accent word use the deep orange-brown on blush. It looks readable but I did not measure it. The small, muted "Manager" label on the sidebar (about 12 px, subtle ink on tan) is the likeliest AA risk.
- WARNING: Espresso (dark) was not captured by me. The owner approved it in UAT test 2 (accepted), so this only flags a missing recorded contrast table.

### Pillar 4: Typography (3/4)
- Two families (Barlow Condensed for display, Archivo for UI) as the spec requires. The peso sign was verified in a browser (UAT test 15).
- Weights in use: 400, 500 (2 uses), 600 (34), 650 (4, buttons), 700 (41), 800 (6). That is six weights, but each one is in the approved spec §3.3 (button 650 and display 800 are approved).
- Sizes (arbitrary `text-[Npx]` counts): 14 px 45, 12 px 31, 16 px 26, 11 px 8, 15 px 7, and 20 more sizes with 1 to 4 uses each (8, 9, 9.5, 10, 13, 17, 18, 22, 24, 26, 28, 30, 32, 34, 40, 50, 52, 56, 80, 92).
- WARNING: 25 distinct sizes is a lot against the "4 role sizes" the UI-SPEC lists for new work. The spec says new SPEC-GAP elements add 0 new sizes, and I did not find a way to confirm that from grep alone. Spot-check whether the 9, 9.5, 17 and 26 px sizes come from a SPEC-GAP element rather than App. B/C.
- Small text: 11 px and below (8 + 2 + 2 + 1 uses) is small for phone readers. Confirm these are only caps labels such as the "MANAGER" tag.
- The phone input size 16 px (D-01) is in place (accepted).

### Pillar 5: Spacing (3/4)
- Layout rhythm in the screenshots is regular (24 px gutters, 16 px card padding, 64 px page-head top). The 44 px target size and 36 px compact controls follow the declared control heights, and the 36 px ones are owner-accepted (O-8).
- Arbitrary values found: `gap-[22px]` x3, `py-[calc(var(--space-24)+var(--cut-angle))]` x2, `py-[calc(var(--space-16)+var(--cut-angle))]` x2, `px-[2px]` x2 (the declared compat restore), `mt-[3px]` x2, `mb-[3px]`, `p-[3px]`, `py-[6px]`, `gap-[6px]`, `gap-[10px]`, `gap-[20px]`, `gap-[.06em]`, `mb-[.15em]` and one negative margin `mt-[-6px]`.
- WARNING: the spec allows inherited 2, 6 and 10 px. The values 3, 22 and 20 px, and the negative margin, are not on that list. They may come from App. B/C (the parity proof says they are equal to the reference), but nothing in the UI-SPEC names them. List them in the exceptions table.
- Inline `style` is used only for custom properties (8 uses: `--ratio`, `--col-w`, `--tip-x`, skeleton and avatar sizes, `--frame-w` in a dev preview). This matches the strict-CSP rule.

### Pillar 6: Experience Design (3/4)
- State coverage present in code: `ErrorBoundary`, `LoadingRegion` with a polite live region, Skeleton family, `ResponsiveTable` loading/error/empty/refetching, ErrorState with "Try Again", pending buttons (WEB-09), toast stack, focus trap in Modal.
- Keyboard: skip link, visible focus ring (`--focus`), Ctrl/Cmd+K search shortcut (WCAG 2.1.4 satisfied by D-41 R2-04), `aria-expanded` on the sidebar toggle, tabs with the full ARIA pattern.
- Responsive: no sideways scroll from 320 to 1920 (D-41 R2-01/02, proven by the 5-browser sweep). My three screenshots show no overflow at 1440, 768 or 375.
- Theme toggle (moon icon) is present in the admin top bar, and the public side is Blush only (D-14).
- WARNING: there is no destructive action in this phase except the demo "Delete Payment" confirm, so confirmation patterns are shown only in the showcase.
- WARNING: I did not drive any interaction myself (interaction capture is off). Everything above for hover, focus and dialogs comes from code and the existing automated and owner results (UAT 202 passed, 0 issues).

---

## Registry Safety

Skipped. `components.json` does not exist and no shadcn is in use (UI-SPEC: shadcn_initialized false).

## Files Audited

- `web/src/ui/**` (brand, status, feedback, data, lists, states, navigation recipes)
- `web/src/app/**` (router, ErrorBoundary, admin routes)
- `web/src/dev/previews/AdminShell.tsx`
- `web/src/styles/**` (by grep only)
- Screenshots: desktop, tablet, mobile, admin, showcase under `.planning/ui-reviews/02-20261014-054704/`
- `.planning/phases/02-web-foundation-design-system/02-UI-SPEC.md`, `02-UAT.md`
