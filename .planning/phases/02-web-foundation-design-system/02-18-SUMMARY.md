---
phase: 02-web-foundation-design-system
plan: 18
subsystem: ui
tags: [brand, mark, logo, motifs, media-placeholder, section-cut, stitch-divider, icons, parity, tailwind, d-33, web-02, tdd]
created: "2026-10-08T17:04:00-05:00"
updated: "2026-10-08T17:04:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-14)
    provides: "the live parity harness, the kit and renderNode, the D-32 icon-drawing mask"
  - phase: 02-web-foundation-design-system (plan 02-17)
    provides: "the unminified reference CSS, the REPAINT settle step and rowTimeout"
  - phase: 02-web-foundation-design-system (plan 02-40)
    provides: "Icon, IconName, ICONS (56 names), tw and the brand barrel"
provides:
  - "web/src/ui/brand: Mark (App. D.4 drawing as JSX), Logo (sm/md/lg, full/wordmark/mark, tagline), StitchDivider, SectionCut, MediaPlaceholder (--ratio, label={false}) and their props types, exported from the brand barrel next to Icon"
  - "web/src/ui/brand/brand.recipe.ts: markClasses, the logo maps (gap, letter size, tagline size), meshClasses, stitch divider, section cut (clip, tone, inner), media placeholder, number and chip looks"
  - "brand parity group: 18 scenarios (7 lockups, 2 dividers, 4 cuts, 4 media placeholders, icons-all with 60 icon wrappers)"
  - "Dev-only scenario wrapper pairs: IconSet and MediaPlaceholderNoChip (src/dev/previews + visual/reference/fragments)"
  - "web/src/types/react-css-custom-properties.d.ts: React style accepts --* custom properties"
affects: [02-19, 02-20, 02-21, 02-22, 02-23, 02-24, 02-25, 02-26, 02-27, 02-28, 02-29, 02-30, 02-31, 02-33, parity]

actuals:
  tokens: 15750    # chars/4 over the realized diff (63,000 chars, 16 files)
  tasks: 2
  commits: 4
plan_head_before: 780d3e7e284bdb00083b8e9386f74d9bcc47492a
plan_head_after: 96b6b623cce6efebf4fb54cf00c50766ce08586c

tech-stack:
  added: []
  patterns:
    - "A parity case that needs a wrapper App. D.3 lacks gets a same-named pair: src/dev/previews/<Name>.tsx (implementation kit) and web/visual/reference/fragments/<Name>.tsx (reference kit)"
    - "A component that sets a CSS custom property in style puts the utility that reads it in the same file, next to the style (MediaPlaceholder: --ratio and aspect-(--ratio))"
    - "Inline SVG artwork is generated from the spec string into JSX children (attribute values and whitespace text nodes verbatim) and checked once against the spec markup"

key-files:
  created:
    - web/src/ui/brand/brand.recipe.ts
    - web/src/ui/brand/brand.test.tsx
    - web/src/ui/brand/motifs.test.tsx
    - web/src/ui/brand/Mark.tsx
    - web/src/ui/brand/Logo.tsx
    - web/src/ui/brand/StitchDivider.tsx
    - web/src/ui/brand/SectionCut.tsx
    - web/src/ui/brand/MediaPlaceholder.tsx
    - web/src/dev/scenarios/groups/brand.ts
    - web/src/dev/previews/IconSet.tsx
    - web/src/dev/previews/MediaPlaceholderNoChip.tsx
    - web/visual/reference/fragments/IconSet.tsx
    - web/visual/reference/fragments/MediaPlaceholderNoChip.tsx
    - web/src/types/react-css-custom-properties.d.ts
  modified:
    - web/src/ui/brand/index.ts
    - docs/web/parity.md

key-decisions:
  - "Mark renders App. D.4's MARK_SVG as JSX children, generated from the spec string. A one-off check showed its rendered inner markup equals MARK_SVG byte for byte, including the whitespace text nodes. dangerouslySetInnerHTML is gone (WEB-02, T-02-48)"
  - "MediaPlaceholder label={false} hides the chip (the App. B/C parent rules become a prop, research row 21). App. D.3 has no chip-less form, so its parity case uses a dev-only wrapper pair. The reference side is App. D.3's markup without the chip that those parent rules hide"
  - "The 56 icons are compared in one icons-all case through a plain-div IconSet on both sides, so each wrapper keeps inline-block and vertical-align middle (a flex container would blockify them and hide display). Icon needed no change"
  - "React CSSProperties is augmented with --* keys instead of casting at each call site. Lint still rejects any non-custom style key"
  - "Extra lockup cases beyond the plan's four (no tagline, mark-only, wordmark) cover every App. D.3 Logo variant; motif cases are responsive (320/390/820/1440)"

patterns-established:
  - "Brand recipe maps are keyed by size or tone; Logo's mark sizes (36/56/104) are numbers in the component, never in the recipe"

requirements-completed: [WEB-02]

coverage:
  - id: D1
    description: "Mark renders the App. F / D.4 drawing as JSX children of a 512 viewBox svg with no dangerouslySetInnerHTML; ring and stitch read --csp-mark-ring/--csp-mark-stitch; pixel- and style-equal to the spec Mark in Blush and Espresso"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/brand/brand.test.tsx (Mark describe, 6 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @brand (mark-48, logo-* rows; 16 passed in 3 engines)"
        status: pass
      - kind: other
        ref: "grep -c dangerouslySetInnerHTML= web/src/ui/brand/Mark.tsx = 0; grep -c csp-mark-ring = 3"
        status: pass
    human_judgment: false
  - id: D2
    description: "Logo sm/md/lg, no tagline, mark-only and wordmark are pixel- and style-equal to the spec Logo in both themes at 390 and 1440 in Chromium, Firefox and WebKit; one image named \"CSPS — Carmen's Stitch & Printing Services\""
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/brand/brand.test.tsx (Logo describe, 12 tests, incl. axe)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @brand"
        status: pass
    human_judgment: false
  - id: D3
    description: "StitchDivider (with and without label), SectionCut (both, top accent, bottom, mesh) and MediaPlaceholder (4/3, 1/1 with label and number, 16/9 with number, no chip) match the spec motifs at 320/390/820/1440 including SectionCut's 1024px padding; MediaPlaceholder sets only --ratio in style"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/brand/motifs.test.tsx (21 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @brand (chromium 320/390/820/1440, firefox and webkit 390/1440)"
        status: pass
    human_judgment: false
  - id: D4
    description: "All 56 spec icons plus size 16/24, stroke 1.5 and labelled variants render through Icon with a wrapper equal to the spec wrapper (drawings masked, D-32); labelled icon is role img with a name"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/brand/brand.test.tsx (icons-all describe, 3 tests)"
        status: pass
      - kind: automated_ui
        ref: "parity icons-all case in every @brand row"
        status: pass
    human_judgment: false
  - id: D5
    description: "The brand rows can fail: a mutated gap, padding, number offset or icon vertical-align is reported as a style/box difference and a pixel mismatch"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "two throw-away mutation runs (--grep \"@brand light 390\" and \"@brand light 1440\", chromium), reverted, not committed"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 18: Brand, Motifs and the 56-Icon Wrapper Grid Summary

**Mark now renders the App. D.4 drawing as JSX, with no raw HTML. The [C]SPS Logo in every size and variant, StitchDivider, SectionCut, MediaPlaceholder and all 56 icon wrappers are equal to the approved design in Chromium, Firefox and WebKit, in Blush and Espresso. No look changed, Icon needed no fix, and no tolerance or normalization was added.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-08T21:35:16Z
- **Completed:** 2026-10-08T22:03:28Z
- **Tasks:** 2 of 2
- **Files modified:** 16 (14 created, 2 modified)

## Accomplishments

- **Mark.**
  - The App. D.4 `MARK_SVG` string was turned into JSX children by a script: one `rect` and seven `path`s, attribute values unchanged, and the whitespace text nodes kept.
  - A one-off render compared the result with the spec string and found it equal.
  - The ring and stitch read `var(--csp-mark-ring, #572e2b)` and `var(--csp-mark-stitch, #f6dfd1)`. Espresso gets `#1a100f` and `#ff6a1a` from the dark block in base.css.
- **Logo.**
  - The App. D.3 props, markup and copy are kept.
  - The `.csp-logo*` looks are utilities in `brand.recipe.ts`. The gap, the letter size and the tagline size are separate size maps, because App. B overrides the base gap per size.
  - The `::before` slash and the skewed underline use `[transform:skewX(-18deg)]`.
  - The `csp-logo-v-*` hook classes are dropped. They have no rules (D-33).
- **Motifs.**
  - StitchDivider draws its two dashed rules with `before:`/`after:` gradients.
  - SectionCut has three `[clip-path:polygon(…)]` literals, tone maps, the optional mesh, and the App. B 1024px padding as `lg:`.
  - MediaPlaceholder sets only `--ratio` in `style`. `aspect-(--ratio)` sits next to that style in the component.
  - The outlined number keeps App. B's `transition: transform .4s ease` and `-webkit-text-stroke`.
  - `label={false}` hides the chip, and the image keeps its "No image yet" name.
- **Icons.** The `icons-all` case holds all 56 ICONS names in ICONS order, plus size 16, size 24, stroke 1.5 and a labelled icon. Their wrappers are compared with the drawings masked (D-32). Icon was not changed.
- **Scenarios.** The brand group has 18 cases, all at rest in both themes. The 11 motif cases are responsive.

## Task Commits

1. **Task 1 (tracer): the CSPS Logo with its JSX Mark.**
   - RED `a467faf`: 17 of 21 tests failed against inert stubs (`RED_EVIDENCE_OK`, target `src/ui/brand/brand.test.tsx`).
   - GREEN `9304b1e`: Mark, Logo and the recipe.
   - Results:
     - Chromium `@brand`: 4/4.
     - A throw-away gap mutation was caught as a `column-gap` difference and a pixel mismatch, then reverted.
     - Three engines: 12/12.
   - Tracer gate (interactive, end-of-phase, automated-only verify): after the commit I re-ran both verify commands (89/89, then Chromium 4/4) before expanding.
2. **Task 2: motifs, media placeholder and the 56-icon grid.**
   - RED `6d89a51`: 17 of 21 motif tests and the icons-all kit test failed against stubs and a kit without the wrappers (`RED_EVIDENCE_OK`, target `src/ui/brand/motifs.test.tsx`).
   - GREEN `96b6b62`: the components, the recipes, the wrapper pairs, the CSSProperties augmentation and the parity guide note.
   - Results:
     - Chromium `@brand`: 8/8 at 320/390/820/1440.
     - A throw-away mutation of padding, number offset and icon vertical-align failed 13 cases, then was reverted.
     - Three engines: 16/16.

**Plan metadata:** recorded in the docs(02-18) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/brand/Mark.tsx`: the JSX mark
- `web/src/ui/brand/Logo.tsx`: the lockup
- `web/src/ui/brand/StitchDivider.tsx`, `SectionCut.tsx`, `MediaPlaceholder.tsx`: the motifs
- `web/src/ui/brand/brand.recipe.ts`: every brand and motif look
- `web/src/ui/brand/index.ts`: exports Icon, Logo, Mark, MediaPlaceholder, SectionCut, StitchDivider and their props types
- `web/src/ui/brand/brand.test.tsx` (25 tests) and `motifs.test.tsx` (21 tests)
- `web/src/dev/scenarios/groups/brand.ts`: 18 scenarios
- `web/src/dev/previews/{IconSet,MediaPlaceholderNoChip}.tsx` and `web/visual/reference/fragments/{IconSet,MediaPlaceholderNoChip}.tsx`: the dev-only wrapper pairs
- `web/src/types/react-css-custom-properties.d.ts`: `--*` keys in React `style`
- `docs/web/parity.md`: how to add a wrapper pair (section 5)

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **Custom properties in `style`.** `style={{ '--x': value }}` now type-checks with no cast (Skeleton `--sk-*`, Avatar, DataTable, chart tooltip). Put the utility that reads the property in the same component.
- **Chip-less placeholders.** Thumbnails, tiles and the LazyImage fallback pass `label={false}`. The ImageUploader and CategoryCard plans prove it again in their own context against the reference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React `style` could not type `--ratio`**
- **Found during:** Task 2 (GREEN typecheck)
- **Issue:** React's `CSSProperties` has no custom-property keys, so `style={{ '--ratio': ratio }}` failed with TS2353.
- **Fix:** `web/src/types/react-css-custom-properties.d.ts` adds `` [`--${string}`] `` keys to `CSSProperties`. It needs one `consistent-indexed-object-style` disable, with a reason: an augmentation must merge into the interface. Lint still rejects every non-custom style key.
- **Files modified:** web/src/types/react-css-custom-properties.d.ts
- **Committed in:** `96b6b62`

**2. [Rule 3 - Blocking] Parity wrappers App. D.3 does not have**
- **Found during:** Task 2 (scenario design)
- **Issue:**
  - The 56 icons need one container that exists on both sides.
  - The chip-less placeholder has no App. D.3 form. The reference hides the chip only through parent rules (`.csp-thumb`, `.s-tile`).
- **Fix:** Two same-named pairs, using the kits' existing `src/dev/previews` and `visual/reference/fragments` hooks:
  - `IconSet`: a plain `<div>` on both sides.
  - `MediaPlaceholderNoChip`: the implementation renders `MediaPlaceholder label={false}`. The reference renders App. D.3's markup and name without the hidden chip; a `display: none` subtree paints nothing and is skipped by the comparison.
  - Both are dev or test only and never shipped. They are documented in parity.md section 5.
- **Files modified:** web/src/dev/previews/*, web/visual/reference/fragments/*, docs/web/parity.md
- **Committed in:** `96b6b62`

**3. [Rule 1 - Bug] Test text checks counted the mark's whitespace text nodes**
- **Found during:** Task 1 (GREEN)
- **Issue:** App. D.4 keeps `"\n  "` text nodes between the mark's shapes, so `textContent` of a lockup is not just "SPS".
- **Fix:** The lockup text assertions trim. The markup itself was not changed.
- **Committed in:** `9304b1e`

**4. [Rule 2 - Missing critical] Extra lockup and icon variants**
- **Found during:** Task 1 and Task 2
- **Issue:** The plan named `logo-sm/md/lg` and `mark-48`, but App. D.3 Logo also has `tagline={false}` (the expanded sidebar), `variant="mark"` (the collapsed sidebar) and `variant="wordmark"`. The 56-icon grid at the default size alone would not exercise `size`, `strokeWidth` or `label`.
- **Fix:** Added `logo-sm-no-tagline`, `logo-mark-sm`, `logo-wordmark-md`, and four Icon variants in `icons-all`.
- **Committed in:** `a467faf`, `6d89a51`

---

**Total deviations:** 4 auto-fixed (2 Rule 3, 1 Rule 1, 1 Rule 2)
**Impact on plan:** Every must-have truth is proven by unit tests and by the three-engine parity run. No look, element, text or ARIA structure changed beyond App. D.3, apart from the `label={false}` prop, which is research row 21's context mechanism and is marked SPEC-DEVIATION. No tolerance or normalization was added.

## Issues Encountered

- A heredoc in Git Bash turned an escaped `\n` in a generator script into a real newline. I caught it in the generated output and fixed it before writing Mark.tsx.
- Parity run time for the brand group: about 1.1 min for 16 rows in three engines. The four large media placeholders make each 1440 page tall, and WebKit 1440 rows take about 24 s.

## TDD Gate Compliance

- Task 1: RED `a467faf` comes before GREEN `9304b1e` (`RED_EVIDENCE_OK`).
- Task 2: RED `6d89a51` comes before GREEN `96b6b62` (`RED_EVIDENCE_OK`). The barrel and scenario-shape tests passed at RED, because the stubs and scenarios were already in place. They pin that data.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved.

## Look Gate (D-08 conditional checkpoint)

It did not fire. Every case matched the approved design with no change to look, elements, text or ARIA.

## Threat Flags

None. T-02-48 is mitigated: Mark has no HTML-string prop, the 02-04 lint ban still applies, and `grep -c "dangerouslySetInnerHTML=" Mark.tsx` returns 0. No endpoint, auth path or file access was added.

## Verification

- `npm --prefix web run test -- --run src/ui/brand`: 3 files, 114/114 passed.
- Preflight showed all four ports free and no other project's test processes. Then `npm --prefix web run parity -- --grep @brand` passed 16 rows: Chromium 8, Firefox 4, WebKit 4.
- Regression: `--grep "@reference|@selftest|@actions" --project chromium` passed 19.
- `npm --prefix web run verify` exited 0. It ran typecheck (3 programs), lint, format, 53 files with 1419 tests, coverage at 100 / 99.86 / 100 / 100 (brand files at 100%), the build, notices and the license gate.
- Acceptance greps:
  - `dangerouslySetInnerHTML=` in Mark.tsx: 0.
  - `csp-mark-ring` in Mark.tsx: 3.
  - `aspect-(--ratio)` in MediaPlaceholder.tsx: 1.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Imports.** Import `Logo`, `Mark`, `StitchDivider`, `SectionCut` and `MediaPlaceholder` from `@/ui/brand`.
- **Logo on the sidebar (02-26) and the site header.** These need the `.csp-sidebar .csp-logo { color: nav-ink }` context and the App. C phone overrides. Add them as a Logo prop or a `data-ui` context when those plans convert the regions.
- **LazyImage and ImageUploader.** Use `<MediaPlaceholder label={false} />` for the chip-less fallback and thumbnails.
- **Wrappers.** If a parity case needs a wrapper that App. D.3 lacks, add a same-named pair (docs/web/parity.md section 5).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 14 created and 2 modified files exist on disk.
- Commits `a467faf`, `9304b1e`, `6d89a51` and `96b6b62` are on `gsd/phase-2-web-foundation-design-system`.
