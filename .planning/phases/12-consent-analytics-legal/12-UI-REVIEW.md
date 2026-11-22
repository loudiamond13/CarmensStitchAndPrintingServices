---
created: 2026-11-21T10:00:00-06:00
updated: 2026-11-21T13:00:00-06:00
---

# Phase 12 UI Review (re-audit)

**Audited:** 2026-11-21
**Baseline:** 12-UI-SPEC.md, as amended by Phase 12.1 (D-53 to D-78) and D-82
**Screenshots:** not captured (code-only audit by owner rule; no dev server or Playwright)
**Interaction captures:** off (interaction_capture is false)

Scope: legal pages (Privacy, Terms, Accessibility), the legal template, the footer Legal row, the Contact map card and the admin Visitor Stats page. Features removed by 12.1 are superseded, not gaps.

## What changed since the last review

- Privacy Policy is approved: `web/src/modules/public/legalPages.ts:30` is now `approved: true` (commit f1a90aa2). `LegalPage.tsx:23` shows the DRAFT notice only when `approved` is false, so visitors see none. The old top fix is closed.
- Raw `text-[14px]` and `text-[24px]` in `visitorStats.recipe.ts`: gone (none found).
- `max-w-[640px]` in the legal recipe: now `max-w-reading` (`legal.recipe.ts:6`, `:57`).
- Chart text alternative: fixed in dcef091b (hidden table in `VisitorTrendChart`, named "Page views by day" or "by month").
- No U+2013 or U+2014 in `web/src` (OR-4 holds).

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Plain wording, D-82 honoured, all three legal pages approved |
| 2. Visuals | 3/4 | Clear template; still no rendered check in this re-audit |
| 3. Color | 3/4 | Tokens only; legal and stats files clean, but color distribution not seen rendered |
| 4. Typography | 4/4 | Named size tokens only in the audited files |
| 5. Spacing | 3/4 | Scale and 44px targets followed; a few arbitrary values remain elsewhere in the phase area |
| 6. Experience Design | 3/4 | Loading, error, empty, stale and busy states covered; one gap noted below |

**Overall: 20/24**

No pillar is below 3, so there are no blockers. I scored 3 where I could not confirm by sight. A rendered check on 2026-11-21 (quick 261121-9qz) found no sideways scroll or console errors, but this pass is code-only.

## Top 3 Priority Fixes

1. **Keep the approval flag in sync.** `web/src/modules/public/legalPages.ts:30` is `true`. Confirm the fixture `tests/fixtures/legal-pages.json` and the Domain `LegalPages` match, and that `/privacy` is in the sitemap. The file header (line 2) says tests fail on drift, so run that test at the next test run. Not run here.
   **Outcome (orchestrator check, 2026-11-21):** the three copies match. `legalPages.ts`, `tests/fixtures/legal-pages.json` and `src/Csps.Domain/Content/LegalPages.cs` all set the three pages to approved at version 1.0. The drift test itself was not run in this pass.
2. **Re-capture rendered pages after the approval change.** Run the preflight, then capture /privacy, /terms, /accessibility, /contact and /admin/visitor-stats at 320, 375, 768 and 1440 px. Confirm the head with no DRAFT box looks balanced (`LegalPage.tsx:23`, `legal.recipe.ts:6`).
3. **Tidy leftover arbitrary values in the public recipes.** `home.recipe.ts:146` still uses `max-w-[640px]`, which duplicates the new `max-w-reading` token. Switch it to `max-w-reading`. Lower value: `public.recipe.ts:48` and `home.recipe.ts:153` use `max-w-[560px]` and `leading-[28px]`. These sit outside Phase 12 pages, so treat as minor.

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Privacy wording is plain and matches D-72 and D-65 ("This website sets no optional cookies, so it shows no cookie banner", `legalPrivacy.ts:142`).
- D-82 holds: quote lines sit in a held block (`legalPrivacy.ts:324-335`), not in the rendered sections.
- All three legal pages are `approved: true` (`legalPages.ts:30`, `:42`, `:54`). The earlier warning is closed.
- No dash characters and no leftover "Cookie settings" or Cookie Policy strings in non-test code.

### Pillar 2: Visuals (3/4)
- `LegalPage.tsx` template: head, version line, lead, sticky contents column and a reading-width article (`legal.recipe.ts:57`). Clear focal point.
- Phone: contents become a closed `details` box with a 44 px summary.
- MapCard keeps one 16:10 box before and after the tap, so no layout shift.
- Chart now has a text alternative (hidden table). Earlier warning closed.
- Open: I did not see a rendered page in this pass, so the layout without the DRAFT box is unconfirmed (fix 2).

### Pillar 3: Color (3/4)
- Legal and stats recipes use tokens only (`border-warning`, `bg-warning-soft`, `text-ink`, `text-ink-muted`, `border-line`). No hex found.
- The warning colour now has no live use on approved pages. `LegalNotice` stays as a dormant component for future drafts, which is fine.
- Contrast on the notice was measured earlier (6.55:1 and 11.79:1), so that item stays closed.
- Held at 3: I did not check the 60/30/10 split by sight.

### Pillar 4: Typography (4/4)
- Legal pages use `text-14`, `text-16`, `text-22` with semibold and bold only.
- `visitorStats.recipe.ts` no longer has raw pixel sizes. Earlier warning closed.

### Pillar 5: Spacing (3/4)
- Legal spacing follows the scale (`gap-4`, `pt-8`, `pb-12`, `pg-phone:px-4` at `legal.recipe.ts:22`). Links are 44 px.
- `max-w-reading` replaced the arbitrary width in the legal recipe.
- WARNING: `home.recipe.ts:146` still hard-codes `max-w-[640px]`. Fix: use `max-w-reading`.

### Pillar 6: Experience Design (3/4)
- Visitor Stats: first-load skeleton, dimmed `aria-busy` on range change, error with retry, stale-data alert with retry, empty state, Manager-only guard.
- MapCard: skeleton address, directions-only fallback, hides when nothing to show, focus moves only after the visitor's own tap.
- WARNING: with the DRAFT box gone, nothing in the UI shows an unapproved page if a future page is added as draft, other than the notice itself. This is by design (D-14) and not a defect now.
- Registry audit: skipped (no third-party registries in this phase).

## Earlier findings: status

| Earlier finding | Status |
|-----------------|--------|
| Privacy Policy `approved: false` | Fixed (f1a90aa2) |
| No rendered check | Done earlier (261121-9qz); not repeated here |
| Chart text alternative | Fixed (dcef091b) |
| Raw `text-[14px]` and `text-[24px]` | Fixed |
| `max-w-[640px]` in legal recipe | Fixed (`max-w-reading`) |
| Notice contrast | Not needed (measured) |
| `top-[calc(...)]` contents column | Not needed (theme tokens only) |

## Files Audited
- `web/src/modules/public/legalPages.ts`, `legalPrivacy.ts`
- `web/src/modules/public/components/LegalPage.tsx`, `legal.recipe.ts`, `home.recipe.ts`, `public.recipe.ts`
- `web/src/modules/admin/components/visitorStats.recipe.ts`
- `web/src/components/data/VisitorTrendChart.test.tsx` (via commit dcef091b)
- 12-UI-SPEC.md, 12-CONTEXT.md, 12.1-CONTEXT.md, previous 12-UI-REVIEW.md
