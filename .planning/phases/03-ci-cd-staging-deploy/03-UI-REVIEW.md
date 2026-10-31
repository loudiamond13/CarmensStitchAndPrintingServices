# Phase 3 - UI Review

*Created: 2026-10-17T11:37:34-05:00 · Updated: 2026-10-17T11:45:00-05:00*

**Audited:** 2026-10-17
**Baseline:** CSPS-UI-SPEC.md (project-wide) plus abstract 6-pillar standards; no phase UI-SPEC
**Screenshots:** not captured (code-only audit; no preflight or dev server was run)
**Interaction captures:** off (workflow.ui_interaction_capture is false); interaction findings are code-derived

Surface shipped: one new page (HoldingPage), its copy, a Modal middle-click handler, route restructuring, and font fallback CSS. Most pillars have small surface; scores reflect that and are not padded.

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Clear, owner-approved copy; no OR-4 violations; "Something went wrong" error title is generic and gives no contact route |
| 2. Visuals | 3/4 | Strong focal point (h1), but no visual cue for the phone call-to-action and logo is not a link |
| 3. Color | 3/4 | Tokens only; accent limited to eyebrow, h1 accent, links; link contrast unverified without render |
| 4. Typography | 2/4 | Many arbitrary px sizes (80, 52, 18, 16, 14); labels at 14px; mixes with spec scale unverified |
| 5. Spacing | 3/4 | 44px touch targets met on links; arbitrary gap/size values (`gap-[20px]`, `160px` column) |
| 6. Experience Design | 3/4 | Skip link, tel link, error fallback present; holding page error path lands on a generic screen |

**Overall: 17/24**

## Top 3 Priority Fixes

1. **Error boundary on the public holding page gives no way to reach the shop** - a visitor arriving from Facebook with a crashed chunk sees only "Reload Page" - add the phone number and Facebook link to the RootErrorBoundary public body, reusing HOLDING_PAGE values.
2. **Typography uses arbitrary pixel values throughout HoldingPage** (`text-[80px]`, `text-[52px]`, `text-[18px]`, `leading-[28px]`, `text-[14px]`, `gap-[20px]`) - drifts from the token scale and makes spec changes hard - map to the spec's type tokens/classes (or add named tokens) so one change updates every page.
3. **Phone call-to-action has no visual weight** - the main goal ("to order now, call the shop") is an underlined text link identical in style to the Facebook link - make the phone row a primary-styled button/link (min 44px already met) and add an icon, and verify accent-ink contrast on the light dot-pattern background at 18px semibold.

Minor: the 160px label column is a fixed width; at 320px it collapses via `pg-phone`, but tablet widths between phone and desktop are unchecked. Modal middle-click guard is code-only and invisible to users; fine.

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- `modules/public/copy.ts`: headline "New website on the way.", lead gives two clear actions (call, message). Labels "Visit us / Opening hours / Call us / Message us" are action oriented. Not generic.
- OR-4: no em or en dash in copy; hours uses hyphens and a middle dot ("Mon-Sat · 9:00 AM - 6:00 PM"), compliant. The middle dot is a separator symbol, acceptable.
- `ErrorBoundary.tsx`: "Something went wrong" and "This page couldn't load. Reload the page to try again." match the spec's copy contract, but offer no alternate path (see fix 1). CWE-209 respected (no error detail).
- Link text "Facebook page" is descriptive; the phone link text is the number itself, good.

### Pillar 2: Visuals (3/4)
- Clear hierarchy: 80px italic uppercase h1 with accent emphasis, eyebrow with skewed bar, dotted halftone background (color-mix, no inline style, CSP safe).
- Logo is rendered inside a plain div, not a link; on a single-page holding screen this is acceptable.
- No icons on the contact rows; icon-only buttons: none, so no aria-label gaps. The Facebook link opens in the same tab with `noopener noreferrer` but no `target`, fine.
- Two links share identical visual weight (fix 3).

### Pillar 3: Color (3/4)
- Only token classes (`text-ink-muted`, `text-accent-ink`, `bg-accent-line`, `border-line`). No hardcoded hex found in the audited files. Accent used on three element types (eyebrow, h1 accent, links), within 60/30/10 spirit.
- Page forced `data-theme="light"`; consistent with D-14 for root pages.
- Contrast of `text-ink-muted` lead (18px) and `accent-ink` on the dot pattern not measured (no render); flagged as unverified, not failed.

### Pillar 4: Typography (2/4)
- Sizes in HoldingPage: 80, 52 (phone), 18, 16 (phone), 14 distinct arbitrary px, plus leading overrides 28, 24, .88, 1.15. Label text at 14px uppercase with .16em tracking is legible but small.
- Weights: `font-heavy`, `font-bold`, `font-semibold` (three) on one page, above the 2-weight abstract guidance, though the spec's display family may justify it.
- Font fallback metrics (base.css) are a positive: size-adjust/override for Linux (Liberation Sans/Arimo) reduces CLS, aligned with PERF-05.

### Pillar 5: Spacing (3/4)
- Links use `min-h-11` (44px) meeting touch targets. Responsive via `pg-phone:` variants down to 320px; `px-6`/`px-4` consistent with ErrorScreen.
- Arbitrary values: `gap-[20px]`, `grid-cols-[160px_1fr]`, `bg-size-[6px_6px]`, `max-w-[720px]`, `max-w-[560px]`. Mostly on a 4px grid; the 720 and 560 are not tokenized.

### Pillar 6: Experience Design (3/4)
- Positives: skip link and `main#main tabIndex=-1` (A11Y-02), `tel:` link, `HydrateFallback` shell, RootErrorBoundary for chunk failure, reload action, Modal scrim now cancels middle-click paste on Linux (small, correct, listeners cleaned up).
- Gaps: holding page has no loading state of its own beyond the shell fallback (acceptable, static content); error path has no contact fallback (fix 1); route restructure removed `RouteErrorBoundary` from the public branch, so a crash replaces the whole page with the root screen (acceptable since no layout exists). Admin/dev branch now loads QueryRoot lazily; a failed QueryRoot chunk falls to RootErrorBoundary, which is reasonable.
- No registry audit needed (no third-party registries involved).

## Files Audited
- web/src/modules/public/pages/HoldingPage.tsx
- web/src/modules/public/copy.ts
- web/src/components/overlays/Modal.tsx (diff)
- web/src/core/routes/ErrorBoundary.tsx
- web/src/core/routes/router.tsx (diff)
- web/src/ui/base.css (diff)
- QueryRoot.tsx not read in detail (rename of Root.tsx)

## Orchestrator Verification

- Checked against the code: `HoldingPage.tsx` uses `text-[80px]`, `text-[52px]`, `text-[18px]` (x4), `text-[14px]` (x2) and `leading-[28px]` (x4). `RootErrorBoundary` shows only body text and a "Reload Page" button, with no contact route.
- Context for the Typography score: arbitrary pixel sizes are the norm across `web/src` (for example `text-[14px]` 16 times and `text-[16px]` 14 times), and `app.css` defines no type-scale tokens. The finding is a codebase-wide pattern that predates this phase, so fix it in a dedicated type-token task, not in phase 3 alone.
