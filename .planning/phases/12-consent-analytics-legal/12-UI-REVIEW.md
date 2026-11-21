---
created: 2026-11-21T10:00:00-06:00
updated: 2026-11-21T07:50:00-06:00
---

# Phase 12 UI Review

**Audited:** 2026-11-21
**Baseline:** 12-UI-SPEC.md, adjusted for Phase 12.1 (D-53 to D-73) and D-82
**Screenshots:** not captured (code-only audit; no preflight or dev server run)
**Interaction captures:** off (interaction_capture is false)

Scope: the legal pages (Privacy, Terms, Accessibility), the legal page template, the footer Legal row, the Contact map card and the admin Visitor Stats page, as they are in code today.

## Superseded by 12.1 (not scored as gaps)

- Cookie bar, Cookie Settings window, footer "Cookie settings" button: removed (D-54, D-59).
- Cookie Policy page: folded into the Privacy Policy and /cookies removed (D-72). No code reference to it remains outside tests.
- Unique visitors, sources, devices and page speed on Visitor Stats: removed (D-53, D-57). The page now has page views, a trend chart and top pages.
- Map choice: saved in local storage after one tap (D-65, amends D-55). MapCard follows this.
- Quote request lines: held out of the Privacy Policy (D-82). They sit in `legalPrivacy.ts` near line 324 for Phase 13, and are not rendered.

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Plain wording and D-82 honoured; Privacy and Cookie wording is still an unapproved draft |
| 2. Visuals | 3/4 | Clear template (head, contents, article); chart text alternative not verified |
| 3. Color | 3/4 | Token classes only, no hex in audited files; warning colour limited to the draft notice |
| 4. Typography | 3/4 | Tokenised sizes (text-14/16/22); a few raw `text-[14px]` and `text-[24px]` in the stats recipe |
| 5. Spacing | 3/4 | Follows the 4px scale and 44px targets; some arbitrary values |
| 6. Experience Design | 3/4 | Loading, error, empty, stale and busy states all covered; draft notice stays until approval |

**Overall: 18/24**

No pillar is below 3, so there are no blockers. I scored 3 and not 4 because of the unproven items below. I could not look at a rendered page, so none of the visual claims are confirmed by sight.

## Top 3 Priority Fixes

1. **Privacy Policy is still `approved: false`** (`web/src/modules/public/legalPages.ts:30`). Every visitor sees a DRAFT warning box on the page that explains their data rights. The owner must approve the 12.1 wording (D-73), then flip the flag in code, the fixture and the Domain together.
2. **No rendered check was done.** Run the preflight, then capture /privacy, /terms, /accessibility, /contact and /admin/visitor-stats at 375, 768 and 1440 px. In particular confirm the phone contents box, the map card at 320 px and the stats KPI row.
3. **Stats chart and bar list need a proven text alternative.** `StatBarList` hides its bar with `aria-hidden` (good), but `VisitorTrendCard` has no label or table of its own. Confirm `VisitorTrendChart` gives screen readers the figures, or add a visually hidden table.

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Privacy text uses plain English ("This website sets no optional cookies, so it shows no cookie banner", `legalPrivacy.ts:142`). It matches D-72 and D-65.
- D-82 is met: the five quote lines are in a separate held block (`legalPrivacy.ts:324-335`), not in the sections array.
- WARNING: Privacy is a draft (`legalPages.ts:30`), so the owner-approved copy is not final. Terms and Accessibility are approved.
- No dash characters (U+2013, U+2014) found anywhere under `web/src`. OR-4 holds.
- No "Cookie settings" or Cookie Policy strings remain in non-test code. The only "cookie" links go to Google's own policy, which is correct.

### Pillar 2: Visuals (3/4)
- Page template (`LegalPage.tsx`): head, version line, lead, then a 240 px sticky contents column plus 640 px article. Clear focal point and a good reading width.
- Phone: the contents become a closed `details` box (44 px summary). No script needed.
- MapCard keeps the drawn map until a tap, then loads the frame in the same 16:10 box, so no layout shift. The frame has a title, a strict referrer policy and lazy loading.
- WARNING: chart accessibility not proven (see fix 3).

### Pillar 3: Color (3/4)
- Legal recipe uses only tokens (`border-warning`, `bg-warning-soft`, `text-ink`, `text-ink-muted`, `border-line`). No hex found in the audited legal, map or stats files.
- Warning colour appears only on the DRAFT notice, so accent use is tight.
- WARNING: `text-ink-muted` is used for the Small line in the notice on a warning-soft ground. Contrast on that ground was not measured.

### Pillar 4: Typography (3/4)
- Legal pages use `text-14`, `text-16`, `text-22`, with weights semibold and bold. Within the spec.
- WARNING: `visitorStats.recipe.ts` uses raw `text-[14px]` (lines 43, 46, 52) and `text-[24px]` (line 25) instead of the named tokens used elsewhere. Align them with `text-14` and the token for 24.

### Pillar 5: Spacing (3/4)
- Legal spacing follows the scale: gap-4, mt-12 between sections, pt-8 and pb-12 for the article area. Links are `min-h-11` (44 px).
- WARNING: arbitrary values `max-w-[640px]` (used 2 times in `legal.recipe.ts`) and `top-[calc(var(--header-height)+var(--space-6))]`. These are deliberate and documented, but a token for the 640 px reading width would be tidier.

### Pillar 6: Experience Design (3/4)
- Visitor Stats covers: skeleton on first load, dimmed `aria-busy` while a new range loads, an error state with retry, a stale-data alert with retry, an empty state for zero views, and a Manager-only route guard.
- MapCard handles loading facts (skeleton address), no embed (directions only), and hides itself when there is nothing to show. Focus moves into the frame only after the visitor's own tap.
- WARNING: the DRAFT box is a static box, not a live region (by design). Fine, but it is the only signal that the page is unapproved.
- Registry audit: skipped (no third-party registries in this phase).

## Files Audited
- `web/src/modules/public/pages/{PrivacyPolicyPage,TermsPage,AccessibilityPage,ContactPage}.tsx`
- `web/src/modules/public/components/{LegalPage,LegalToc,LegalNotice,legal.recipe,MapCard,SiteFooter}.tsx/.ts`
- `web/src/modules/public/{legalPages,legalPrivacy,legalCopy}.ts`
- `web/src/modules/admin/pages/VisitorStatsPage.tsx`
- `web/src/modules/admin/components/{VisitorTrendCard,StatBarList,visitorStats.recipe}`
- 12-CONTEXT.md, 12.1-CONTEXT.md, 12-UI-SPEC.md (spec and decisions)

## Outcomes (quick 261121-9qz, 2026-11-21)

Every finding above has an outcome. The owner chose "Fix all first" (2026-11-21).

| Finding | Outcome | Where or why |
|---------|---------|--------------|
| Fix 1: Privacy Policy is `approved: false` | Open | Waits for the owner's approval (D-73, 12.1-UAT test 2). Unchanged on purpose: `approved`, version and date were not touched. |
| Fix 2: no rendered check | Open | The orchestrator runs the rendered check after this quick task. No dev server or Playwright was run here. |
| Fix 3: chart text alternative | Fixed | A visually hidden table with one row per day or month (dcef091b). |
| Pillar 1: Privacy draft | Open | Same as fix 1. |
| Pillar 2: chart accessibility | Fixed | Same as fix 3 (dcef091b). |
| Pillar 3: notice contrast on the warning ground | Not needed | Measured: `--ink-muted` on `--warning-soft` is 6.55:1, `--ink` is 11.79:1, the warning icon is 5.05:1 (needs 3:1). A test pins the text ratios at 4.5:1 or more (6ed7d8d6). |
| Pillar 4: raw `text-[14px]` and `text-[24px]` | Fixed | `text-14` and `text-24` (86017edf). |
| Pillar 5: `max-w-[640px]` | Fixed | `--spacing-reading` and `max-w-reading` (6ed7d8d6). |
| Pillar 5: `top-[calc(...)]` on the contents column | Not needed | Built from theme tokens only (`--header-height`, `--space-6`). |
| Pillar 6: static DRAFT box | Not needed | Static by design (D-14), and shown until D-73. |
