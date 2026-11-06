---
phase: 09-order-images-maintenance-jobs
plan: 04
subsystem: web
tags: [photo-viewer, lazy-image, responsive-images, a11y, icons, csp]
requires: []
provides:
  - LazyImage with srcSet, sizes and fit ('cover' | 'contain')
  - PhotoViewer, PhotoViewerPhoto and PhotoViewerProps from @/components
  - MEDIA_COPY (viewer strings) from @/components
  - the camera icon
affects: [09-16, 09-18, 09-23, 09-30]

created: "2026-11-03T08:20:00-06:00"
updated: "2026-11-03T08:20:00-06:00"

actuals:
  tokens: 10800
  tasks: 3
  commits: 7

plan_head_before: 95fde8cf5321c54325a35bd886acd463d991106b
plan_head_after: ada4b0d5abc29aaaa79584711693bba75350ded1
commits: 7

tech-stack:
  added: []
  patterns:
    - "Viewer chrome comes from a data-theme=dark scope on the viewer root, so the App. C brand-fixed dark is the existing Espresso tokens and no colour literal or new custom property is needed"
    - "Controlled viewer index with a render-time anchor (id, position, last index prop) so a changed photo list keeps the same photo by id without fighting the caller's index"
    - "Phone layout by CSS grid placement; the caption row becomes display: contents so its two children join the stage grid"

key-files:
  created:
    - web/src/components/media/PhotoViewer.tsx
    - web/src/components/media/PhotoViewer.test.tsx
    - web/src/components/media/photoViewer.recipe.ts
    - web/src/components/media/copy.ts
  modified:
    - web/src/components/media/index.ts
    - web/src/components/states/LazyImage.tsx
    - web/src/components/states/LazyImage.test.tsx
    - web/src/components/states/states.recipe.ts
    - web/src/components/brand/icons.ts
    - web/src/components/brand/Icon.test.tsx
    - web/src/components/index.test.ts
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx

key-decisions:
  - "No change to web/src/ui/base.css: rendering the viewer root with data-theme=dark gives exactly the four App. C chrome values (--bg #1a100f, --ink #f6dfd1, --line-strong #8f6c62, --surface #241614), so the plan's fallback (four brand-fixed custom properties) was not needed"
  - "PhotoViewerPhoto.viewer.width and height are optional, because UIC-30 needs a photo with no stored size; the box then falls back to 4 / 3"
  - "The ' (opens in a new tab)' notice is written as a space outside the hidden span plus '(opens in a new tab)' inside it, so the link's accessible name reads 'Open Full Size (opens in a new tab)' in every engine"
  - "Alt, Ctrl, Meta and Shift with an arrow key are left to the browser (Alt + Arrow is Back and Forward)"
  - "The viewer does not preload the next photo (UI-SPEC marks it optional, performance only)"

patterns-established:
  - "PhotoViewer({ photos, index, onIndexChange, onClose(lastShownId), label, sizes }): the caller owns the index and the open state"

requirements-completed: []
requirements-advanced: [ORD-04, IMG-04]

coverage:
  - id: D1
    description: "LazyImage passes srcSet and sizes to the img and fits with contain (whole photo, uncropped) when asked; cover stays the default and the skeleton and error placeholder are unchanged"
    requirement: "IMG-04"
    verification:
      - kind: unit
        ref: "web/src/components/states/LazyImage.test.tsx#LazyImage responsive delivery (IMG-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The viewer is a modal dialog named by its label with focus on Close viewer, the counter 'Photo {i} of {n}', Previous and Next (wrapping, hidden with one photo), Esc, ArrowLeft and ArrowRight, and onClose gets the id of the photo shown last"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/PhotoViewer.test.tsx#PhotoViewer open, step and close"
        status: pass
      - kind: unit
        ref: "web/src/components/media/PhotoViewer.test.tsx#PhotoViewer keys and wrap"
        status: pass
    human_judgment: false
  - id: D3
    description: "A polite region announces 'Photo {i} of {n}: {description}' on each change; the caption shows the description aria-hidden"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/PhotoViewer.test.tsx#PhotoViewer open, step and close > steps to the next photo and says so in a polite region"
        status: pass
    human_judgment: false
  - id: D4
    description: "Open Full Size is a new-tab link with rel noopener noreferrer and a hidden notice, and is not rendered without a full-size address"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/PhotoViewer.test.tsx#PhotoViewer Open Full Size"
        status: pass
    human_judgment: false
  - id: D5
    description: "A failed viewer photo shows the placeholder named by its alt inside the box and the controls still work; a changed photo list keeps the same photo by id, else the nearest position, and closes when empty"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/PhotoViewer.test.tsx#PhotoViewer failed image"
        status: pass
      - kind: unit
        ref: "web/src/components/media/PhotoViewer.test.tsx#PhotoViewer live changes"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phone layout, height cap, long caption, no-size fallback and tall or wide contain fit are set by classes (Previous and Next 56 px above 639 px and 44 px under the photo at 639 px and below; image box at most min(680px, 100dvh - 200px); caption wraps anywhere; 4 / 3 fallback; object-contain)"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/PhotoViewer.test.tsx#PhotoViewer look and layout"
        status: pass
    human_judgment: true
  - id: D7
    description: "The camera icon is registered from the installed lucide-react"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/brand/Icon.test.tsx#ICONS (App. D.5 names, D-32 aliases) > draws camera with lucide's Camera (Phase 9, D-26)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 04: The photo viewer and responsive images Summary

*Created: 2026-11-03T08:20:00-06:00 · Updated: 2026-11-03T08:20:00-06:00*

**`@/components` now has `LazyImage` with `srcSet`, `sizes` and a `contain` fit, a `PhotoViewer` dialog (counter, wrapping Previous and Next on every screen size, arrow keys, Esc, announcements, Open Full Size in a new tab), and the `camera` icon, with no new package.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 3 (7 commits: 3 RED, 3 GREEN, 1 follow-up test fix)
- **Files:** 4 created, 8 modified (12 files, 829 lines added)

## Accomplishments

- `LazyImage` takes optional `srcSet`, `sizes` and `fit`. Cover stays the default, so every existing caller is unchanged.
- `PhotoViewer` is a generic, controlled dialog. It traps focus, makes the page behind it inert and locks body scroll, like `Modal`, and renders in place. Focus starts on "Close viewer". `onClose` receives the id of the photo shown last.
- The phone layout keeps Previous and Next (D-16): one column, the photo first, then Previous and Next on the left and Open Full Size on the right, then the description.
- The viewer chrome is the App. C brand-fixed dark in both themes, by putting `data-theme="dark"` on the viewer root. No colour literal, and `base.css` was not touched.
- `MEDIA_COPY.viewer` holds every viewer string. No string is written in JSX.

## Task Commits

1. **Task 1: open a photo in the viewer, step to the next one and close it (tracer)** - `85e8b16d` (test, RED) then `bd02e467` (feat, GREEN)
2. **Task 2: keys, wrap, phones, failures, live changes and Open Full Size** - `5029db08` (test, RED) then `cd3f82ff` (feat, GREEN)
3. **Task 3: the camera icon** - `9d236577` (test, RED) then `65780fdf` (feat, GREEN)
4. **Follow-up: the icon showcase test now expects 69 icons** - `ada4b0d5` (test)

## TDD Gate Compliance

Each task has a `test(09-04)` commit before its `feat(09-04)` commit. RED evidence is the Vitest output I saw at each RED commit. I did not run `gsd_run check tdd-red-evidence`, because later runs overwrite the JUnit report.

- **Task 1 RED:** 8 tests failed: the 2 `LazyImage` tests (`srcset` attribute `null`, no `object-contain` class) and the viewer tests (no `PhotoViewer` export). The `@/components` export test for `PhotoViewer` failed too.
- **Task 2 RED:** 2 of 31 tests failed on planned assertions: the link's accessible name (`Open Full Size(opens in a new tab)`, no space) and "keeps the same photo by id when others come and go" (the viewer showed photo 2 of 2, not photo 1 of 2). The second was a real bug in my Task 1 code (see Deviations).
- **Task 3 RED:** 3 tests failed (`ICONS.camera` undefined, the registry key order, the render test).
- **Characterization tests (green at RED):** 29 of the 31 Task 2 tests passed at RED, because the Task 1 viewer already carried the wrap, key, one-photo, failed-image, phone-class and page-behind behaviours. They are regression tests for those behaviours, not drivers. Only the 2 failing ones drove new code.

## Check results

- Task 1 command, after GREEN: `Test Files 3 passed (3)`, `Tests 92 passed (92)` (PhotoViewer, LazyImage, components index).
- `PhotoViewer.test.tsx` alone, after the last GREEN: `Tests 33 passed (33)`.
- `npm --prefix web run test -- --run src/components`, after Task 1: `Test Files 54 passed (54)`, `Tests 1460 passed (1460)`.
- `Icon.test.tsx`, then `src/components/brand`: `Tests 95 passed (95)`, then `Tests 141 passed (141)`.
- Full web suite (`npm run test -- --run`, after the preflight showed all ports free and no busy processes): first run `Test Files 1 failed | 271 passed (272)`, `Tests 1 failed | 7675 passed (7676)`. The one failure was `ComponentShowcasePage.test.tsx` expecting 68 icons (now 69). After the fix, that file alone: `Tests 33 passed (33)`. Full suite re-run after the fix: `Test Files 272 passed (272)`, `Tests 7676 passed (7676)`.
- `npm --prefix web run typecheck`: exit 0, no output after the script lines.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npx prettier --check src/components`: `All matched files use Prettier code style!`
- Class gate: `node scripts/class-gate.mjs` exit 0 with no findings, and `scripts/tailwind-classes.test.ts` passed (`every class token in src compiles, with no colour literal and no stray opacity`).
- Coverage (v8, the two files, from the Task 2 run): `PhotoViewer.tsx` 88.8% statements, 83.3% branches, 100% functions, 96.9% lines, before I added the two controlled-index tests; `LazyImage.tsx` was covered by its own suite. I did not re-measure after the extra tests.
- Acceptance greps: `PhotoViewer` in `media/index.ts` count 3 (>= 1); `srcSet` in `LazyImage.tsx` count 5 (>= 1); `noopener noreferrer` in `PhotoViewer.tsx` count 1 (>= 1); `camera: Camera` in `icons.ts` count 1; test names contain "wrap", "one photo" and "Open Full Size"; `git diff --stat -- web/package.json web/package-lock.json` prints nothing.
- `gitleaks protect --staged --no-banner` before each of the 7 commits: `no leaks found`.
- Em dash and en dash in the new and changed `web/src` files: none (the `no-long-dash` rule test is part of the full-suite run).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed photo list showed the wrong photo**
- **Found during:** Task 2 (RED test "keeps the same photo by id when others come and go")
- **Issue:** My Task 1 reconciliation re-read the caller's old `index` on the very next render, so a removed earlier photo made the viewer jump to the next photo instead of keeping the same one by id.
- **Fix:** The anchor now remembers the last `index` prop it saw. A changed list keeps the photo by id (else the old position, clamped) and tells the caller through `onIndexChange`. A caller moving the index is followed. Two extra tests cover a caller moving the index and an out-of-range index.
- **Files modified:** `web/src/components/media/PhotoViewer.tsx`, `web/src/components/media/PhotoViewer.test.tsx`
- **Commit:** `cd3f82ff`

**2. [Rule 1 - Bug] Link name lost the space before the new-tab notice**
- **Found during:** Task 2 (RED test "is a link to the full-size address...")
- **Issue:** With the space inside the hidden span, the accessible name read `Open Full Size(opens in a new tab)`.
- **Fix:** The space is a text node outside the span; the copy string is `(opens in a new tab)`.
- **Files modified:** `web/src/components/media/PhotoViewer.tsx`, `web/src/components/media/copy.ts`
- **Commit:** `cd3f82ff`

**3. [Rule 3 - Blocking] The icon showcase test counted 68 icons**
- **Found during:** the full web suite after Task 3
- **Issue:** `ComponentShowcasePage.test.tsx` pinned the icon count at 68, which the new `camera` icon broke. The file is not in the plan's file list.
- **Fix:** The test name and the count now say 69.
- **Files modified:** `web/src/modules/admin/pages/ComponentShowcasePage.test.tsx`
- **Commit:** `ada4b0d5`

**4. [Plan difference] `web/src/ui/base.css` was not changed**
- The plan listed it for the fallback case only. The Espresso scope already holds the four App. C values, so no custom property was added.

**5. [Plan difference] Task 1 carried more of the viewer than its behaviour block**
- The Task 1 GREEN already included wrap, keys, one-photo, failed-image, live-change and phone-class behaviour, so most Task 2 tests passed at RED (see TDD Gate Compliance).

## Known Stubs

None.

## Threat Flags

None. T-09-11 is covered by `rel="noopener noreferrer"` with a test. T-09-12 is unchanged: the CSP `img-src` list was not touched and React escapes `src`, `srcset` and `href`. T-09-SC: no package added or bumped (`lucide-react` 1.53.0 was already installed).

## Notes for later plans

- Plans 09-16, 09-18 and 09-23 map the server's photo to `PhotoViewerPhoto`: `alt` is the description (custom or default), `viewer` is the viewer-slot delivery with its `srcSet`, `width` and `height`, `fullSize` is the full-size address. Pass `sizes` from the delivery contract (`(max-width: 639px) calc(100vw - 32px), min(956px, calc(100vw - 176px))`).
- After `onClose(lastShownId)` the caller closes the viewer and puts focus on that photo's thumb. The viewer's own focus trap returns focus to whatever had it when the viewer opened, so the caller's focus call must run after the viewer unmounts. With no photos left, `onClose` is called with the last shown id and focus should go to the card heading.
- The phone layout, the 680 px height cap and the 1:4 and 4:1 look are pinned by class assertions only. Plan 09-30's screenshot check at 320 px is where the owner sees them, and where a wrap of "Open Full Size" next to Previous and Next at 320 px is confirmed.
- Hover on Previous and Next uses the dark scope's `--accent` (#ff6a1a), not Blush's #ff6600, in the light theme. The two oranges are close; the App. C literal was `var(--accent)`, which in Blush is #ff6600.

## Deferred Issues

None from this plan. The two known machine timing flakes in `deferred-items.md` are server tests and were not touched.

## Self-Check: PASSED

- FOUND: `web/src/components/media/PhotoViewer.tsx`, `PhotoViewer.test.tsx`, `photoViewer.recipe.ts`, `copy.ts`
- FOUND commits: `85e8b16d`, `bd02e467`, `5029db08`, `cd3f82ff`, `9d236577`, `65780fdf`, `ada4b0d5` (all ancestors of HEAD)
