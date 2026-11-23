---
phase: 13-quote-inquiries
plan: 14
subsystem: quote-form-product-preselect
status: complete
tags: [quote-form, products, gallery, preselect, url-param, cwe-601, tdd]
created: "2026-11-23T11:30:00-06:00"
updated: "2026-11-23T11:30:00-06:00"

requires:
  - phase: 13-quote-inquiries
    provides: "13-09 and 13-12 quote form with the Product type Select (line:{key}, custom, not-sure) fed by useProductLinesQuery"
  - phase: 11
    provides: "lineKey.ts isLineKey allow-list (T-11-44); ProductArticle; GalleryLightbox with its quote hop"
provides:
  - "useQuoteProductPreselect(lines, chosen): reads ?product= once, gives the key back once the shown lines contain it and nothing is chosen, then null for good"
  - "ProductArticle Get a Quote links to /contact?product={line key} (plain /contact for a key that fails isLineKey)"
  - "GalleryLightbox quote link to /contact?product={item line key}; onQuote(to) now carries that address to the page"
  - "e2e @quote Get a Quote on a product line preselects it (also checks the page-view beacon sends the path only)"
affects: [13-16, 13-24]

actuals:
  tokens: 5600
  tasks: 2
  commits: 4
plan_head_before: 8ff68a31280dd639d52646d5889332605ebb6d20
plan_head_after: fb9d9e5442dda5213ada72fc17ebdcc3c60441f2

tech-stack:
  added: []
  patterns:
    - "A URL param that only preselects is read once into state, compared with loaded data, and latched off after its one chance; it never reaches a link or navigation"

key-files:
  created:
    - web/src/modules/public/hooks/useQuoteProductPreselect.ts
    - web/src/modules/public/hooks/useQuoteProductPreselect.test.ts
    - web/src/modules/public/components/ProductArticle.test.tsx
  modified:
    - web/src/modules/public/components/ProductArticle.tsx
    - web/src/modules/public/components/GalleryLightbox.tsx
    - web/src/modules/public/components/GalleryLightbox.test.tsx
    - web/src/modules/public/components/GalleryBody.tsx
    - web/src/modules/public/components/QuoteForm.tsx
    - web/src/modules/public/components/QuoteForm.test.tsx
    - web/src/modules/public/components/products.test.tsx
    - web/src/modules/public/pages/GalleryPage.test.tsx
    - web/e2e/quote-form.spec.ts

key-decisions:
  - "The preselect decides once, when the lines arrive: if the visitor already chose, or the key names no shown line, it is dropped for good, so Send Another or a cleared choice never brings it back"
  - "GalleryLightbox hands the page the exact address its link shows (onQuote(to)), so the href and the in-app hop cannot disagree"

patterns-established:
  - "Preselect from a query param: allow-list, then match against loaded data, then apply once while the field is empty"

requirements-completed: [INQ-01]

coverage:
  - id: D1
    description: "Products page Get a Quote opens Contact with that line chosen"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/ProductArticle.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/public/components/QuoteForm.test.tsx#QuoteForm product preselect (Q4, D-24)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-form.spec.ts#@quote Get a Quote on a product line preselects it"
        status: pass
  - id: D2
    description: "Gallery lightbox quote link preselects the item's line"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/GalleryLightbox.test.tsx"
        status: pass
      - kind: integration
        ref: "web/src/modules/public/pages/GalleryPage.test.tsx#closes the lightbox and goes to /contact"
        status: pass
  - id: D3
    description: "Bad, oversized or hidden-line keys are ignored with no message and no URL rewrite; a visitor's own choice and Send Another are respected"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useQuoteProductPreselect.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/public/components/QuoteForm.test.tsx#QuoteForm product preselect (Q4, D-24)"
        status: pass
---

# Phase 13 Plan 14: Get a Quote links that preselect the product Summary

*Created: 2026-11-23T11:30:00-06:00 · Updated: 2026-11-23T11:30:00-06:00*

The Products page and the Gallery viewer now send the visitor to `/contact?product={line key}`. The quote form picks that line once the product lines load, but only for a key that passes `isLineKey` and names a line that is shown, and only if the visitor has not picked a product yet. Anything else is ignored with no message, and the address is never rewritten.

## What was built

- **`useQuoteProductPreselect(lines, chosen)`**: reads `product` from the address once, on mount. It keeps the value only if it passes `isLineKey`. When the lines arrive it gives the key back once, if a shown line has that key and `chosen` is empty. Otherwise it drops the key for good. The value is only ever compared, never put in a link or a navigation (CWE-601, T-13-42).
- **QuoteForm**: 10 lines. `useWatch` on `product` feeds the hook, and an effect sets `line:{key}` when the hook gives a key.
- **ProductArticle**: Get a Quote goes to `/contact?product={safeKey}`, or plain `/contact` when the key fails the allow-list.
- **GalleryLightbox**: "Get a quote for something like this" goes to `/contact?product={item.lineKey}` (plain `/contact` for an unsafe key). `onQuote(to)` passes that same address to the page. **GalleryBody** now passes `history.leaveTo` straight through, so Back still lands on the Gallery with the viewer closed.
- The header CTA, drawer CTA, Home final CTA, footer link and the Gallery "Want one like these?" link are unchanged and still go to plain `/contact` (their existing tests still pass).

## TDD

### Task 1 (tracer)

- **RED** `5355e89b`: the ProductArticle href case, the hook "waits for the lines, then gives the known key" case, the QuoteForm `?product=volleyball` case and the e2e case. A signature-only hook stub that returned null kept the import loading.
  - Machine check: `npx vitest --run --reporter=tap-flat src/modules/public/hooks/useQuoteProductPreselect.test.ts` exited 1. `check tdd-red-evidence` gave `RED_EVIDENCE_OK (target_test_failed)`, with `expected null to be 'volleyball'`.
  - The other two failed on their own assertions in the same run: the href was `/contact`, not `/contact?product=basketball-jerseys`, and the Product type value was empty, not `line:volleyball`. The TAP parser rejects their multi-line jest-dom messages, so they are quoted here rather than machine-classified.
  - Semantic assessment: each target test ran and failed on the planned behavior. There was no load or setup fault.
- **GREEN** `34321257`: the hook, the QuoteForm wiring and the ProductArticle link.
- **Tracer gate**: the `@quote` e2e re-ran end to end after GREEN and passed 9 of 9 on chromium.

### Task 2

- **RED** `39efb6ab`: the Gallery link cases. `npx vitest --run --reporter=junit src/modules/public/components/GalleryLightbox.test.tsx` exited 1, and the classifier gave `RED_EVIDENCE_OK (target_test_failed)` on "hands /contact?product={item line key} to the page". The second lightbox case and the GalleryPage hop case also failed on their assertions (the href was `/contact`; `onQuote` was called with no address).
  - Semantic assessment: valid RED for the planned behavior.
- **Characterization**: the ignore cases (an unsafe key, a 200-character key, a hidden line, an empty key, a choice made before the lines arrive, Send Another) passed at RED. The Task 1 hook already handles them. They stay as regression cover.
- **GREEN** `fb9d9e54`: the lightbox link and the GalleryBody hop.
- **REFACTOR**: none needed.

## TDD Gate Compliance

Both tasks have a `test(13-14)` commit followed by a `feat(13-14)` commit that descends from it. No violations.

## Verification evidence

- Focused unit tests: GalleryLightbox, the hook, QuoteForm, GalleryPage and gallery: **146 passed (5 files)**. Task 1 files plus products.test.tsx: 79 passed.
- `npm run lint` (eslint, max-warnings 0): exit 0. `npm run typecheck`: exit 0. Prettier: the changed files are clean.
- `npm run e2e -- --grep "@quote" --project chromium`: **9 passed (1.3m)**, including `@quote Get a Quote on a product line preselects it`. The page-view bodies were `{"path":"/products"}` and `{"path":"/contact"}`, with no query.
- `npm run build:budget` (gzip -9):

| Measure | Before | After | Limit |
|---|---|---|---|
| Quote form | 44.23 KB | **44.38 KB** | 45.00 KB |
| public JS (products) | n/a | 143.42 KB | 150.00 KB |
| public JS (gallery) | n/a | 144.57 KB | 150.00 KB |
| public JS (contact) | n/a | 148.09 KB | 150.00 KB |
| admin JS | n/a | 223.57 KB | 250.00 KB |
| CSS | n/a | 20.50 KB | 35.00 KB |

No budget limit was changed.

- Whole web suite (`npx vitest --run`, run after rebuilding `src/Csps.Server/wwwroot`): **11,784 passed and 2 failed, of 11,786 (440 files)**. I re-ran each failure alone:
  - `QuoteForm.test.tsx` "shows the pending label Sending while the request runs": **passed 3 of 3 alone**. It is a timing flake under full-suite load.
  - `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions": fails alone with "No packages found in this path". 13-09 and 13-12 recorded the same failure in fresh worktrees. None of its inputs changed here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An existing Products test pinned the old plain link**
- **Found during:** Task 1 GREEN
- **Issue:** `products.test.tsx` "Get a Quote goes to /contact" asserted the behavior that Q4 replaces.
- **Fix:** It now expects `/contact?product=basketball`.
- **Files modified:** `web/src/modules/public/components/products.test.tsx` (outside files_modified)
- **Commit:** 34321257

**2. [Rule 3 - Blocking] The Gallery hop had to carry the address**
- **Found during:** Task 2
- **Issue:** The lightbox stops the link's own navigation and calls `onQuote()`. `GalleryBody` then always went to plain `/contact`, so the href alone could not preselect.
- **Fix:** `onQuote(to)` now carries the address, and `GalleryBody` passes `history.leaveTo`. `GalleryPage.test.tsx` checks that the hop lands on `?product=basketball`.
- **Files modified:** `web/src/modules/public/components/GalleryBody.tsx` and `web/src/modules/public/pages/GalleryPage.test.tsx` (both outside files_modified)
- **Commits:** 39efb6ab, fb9d9e54

**3. [Rule 3 - Blocking] The worktree had no `web/node_modules`**
- **Fix:** Ran `npm ci` from the existing lockfile (583 packages). No package was added or bumped, and the lockfile did not change. `node_modules` is git-ignored.

### Files touched outside files_modified

- `web/src/modules/public/components/products.test.tsx`
- `web/src/modules/public/components/GalleryBody.tsx`
- `web/src/modules/public/pages/GalleryPage.test.tsx`

## Owner items

None. The UI-SPEC Q4 rows, the bad-param row and D-24 settle every behavior choice in this plan.

## Flakes

- `QuoteForm.test.tsx` "shows the pending label Sending while the request runs" failed once in the full suite under load. It passed 3 of 3 alone.
- Pre-existing and not caused here: `scripts/license-policy.test.ts` "exits 1 on a stricter policy" fails in fresh worktrees.

## Known Stubs

None. The Task 1 RED stub (a hook that returned null) was replaced in the GREEN commit.

## Self-Check: PASSED

- Files exist: `useQuoteProductPreselect.ts`, `useQuoteProductPreselect.test.ts`, `ProductArticle.test.tsx`.
- The commits 5355e89b, 34321257, 39efb6ab and fb9d9e54 are ancestors of HEAD.
- Acceptance: `grep -c "?product=" ProductArticle.tsx` gives 1, and `GalleryLightbox.tsx` gives 2 (the target is at least 1).
