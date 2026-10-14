---
phase: 02-web-foundation-design-system
scope: gap-closure plan 02-41 (G-2-199, owner ruling D-42), 6272a79..db285ea
created: 2026-10-13T17:53:11-05:00
updated: 2026-10-13T17:53:11-05:00
reviewed: 2026-10-13T22:53:11Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - web/src/ui/overlays/overlays.recipe.ts
  - web/src/ui/overlays/overlays.recipe.node.test.ts
  - web/src/ui/overlays/Modal.tsx
  - web/src/ui/overlays/Modal.test.tsx
  - web/src/ui/overlays/Overlay.tsx
  - web/e2e/dialog-fit.spec.ts
  - web/visual/reference/rulings.css
  - web/visual/reference/rulings.test.ts
  - docs/web/parity.md
  - docs/web/e2e.md
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 2: Code Review Report (gap G-2-199, plan 02-41, D-42)

**Reviewed:** 2026-10-13T17:53:11-05:00
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Plan 02-41 changes the Overlay region (`overlayRegionClasses`) to a flex column with a shrinkable `::before` spacer and `overflow-y: auto`. It adds the same rules to the parity reference's rulings layer and pins them, adds a `@dialog-fit` E2E spec, and adds a `pressedOnScrollbar` guard to the Modal scrim's mousedown listener.

The layout itself is correct, and I traced the arithmetic:
- Desktop: 16px padding plus a 124px spacer gives 140px. At 1274x585 the top is 585 − 16 − 492.6 = 76.4.
- Phone pages: no padding plus a 96px spacer gives 96px, and the top is clamp(H − h, 0, 96).
- `*:` does not match `::before`, so the spacer is the only part that shrinks.
- `justify-start` keeps any overflow at the bottom, where it can be scrolled to.
- The rulings layer is unlayered, so it beats the layered App. C row rule. That matches reference.css.

There are no CSP or inline-style problems. All classes are complete literals inside `tw("…")`.

The defects are at the edges of the new scrolling backdrop:
- The scrollbar guard only recognises a primary-button press on a classic, layout-consuming scrollbar.
- No real browser ever runs the guard, because Playwright's headless Chromium hides scrollbars.
- The modal's 0.2s rise animation now briefly overflows the new scroll container when a phone sheet sits flush with the bottom.
- The unconditional column and spacer rule conflicts with the frozen spec's App. E slide-over-in-region mockup, and nothing records this.

None of these are blockers. WR-01 reopens part of the threat T-02-84 that the plan says it mitigated.

## Warnings

### WR-01: The scrollbar guard misses overlay scrollbars and non-primary presses, so the dialog can still close and lose the typed confirm text (T-02-84 only partly mitigated)

**File:** `web/src/ui/overlays/Modal.tsx:59-68`, `web/src/ui/overlays/Modal.tsx:113-117`
**Issue:** `pressedOnScrollbar` returns true only when the press lies outside the scrim's client area (`x >= clientWidth || y >= clientHeight`). That geometry only holds for classic scrollbars, which take up layout space.

- **Overlay scrollbars.** These are the default on macOS with a trackpad, on ChromeOS, and in Chromium builds with overlay scrollbars on. They take no layout space, so `clientWidth` equals the box width and a press on them lands inside the client area. `onMouseDown` then calls `requestClose()`. Dragging the backdrop's scrollbar on those systems still closes the Delete Order dialog and throws away the typed `ORD-2026-0148`, which is exactly the failure the plan's threat T-02-84 names.
- **Middle-click.** The listener does not check `event.button`. Middle-click autoscroll (on by default in Firefox and Chrome on Windows) is now a natural way to scroll the D-42 backdrop, and the press closes the dialog. A right-click on the scrim also closes it. Before D-42 the backdrop never scrolled, so neither path mattered. Now it does.

**Fix:** Ignore any press that is not the primary button. Also close only when the press does not scroll the scrim, which covers overlay scrollbars without geometry:
```ts
const onMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) {
    return; // middle-click autoscroll and right-click never close (D-42)
  }
  const scrim = scrims.find((candidate) => candidate === event.target);
  if (scrim === undefined || pressedOnScrollbar(scrim, event)) {
    return;
  }
  // An overlay scrollbar takes no layout space: close on release only when the press did not scroll the scrim.
  const startTop = scrim.scrollTop;
  const startLeft = scrim.scrollLeft;
  scrim.addEventListener(
    'mouseup',
    () => {
      if (scrim.scrollTop === startTop && scrim.scrollLeft === startLeft) {
        requestClose();
      }
    },
    { once: true },
  );
};
```
At minimum, add the `event.button !== 0` early return, plus a jsdom test that sends `fireEvent.mouseDown(region, { button: 1 })` and checks the dialog stays open. Any change to the close timing must keep the existing "loading ignores presses" and "another parent is not a scrim" tests green.

### WR-02: The scrollbar guard and the layout with a scrollbar present are never run in a real engine: headless Playwright hides scrollbars

**File:** `web/e2e/dialog-fit.spec.ts:186-297` (spec as a whole), `web/src/ui/overlays/Modal.test.tsx:462-537`
**Issue:** Playwright starts headless Chromium with `--hide-scrollbars` (`web/node_modules/playwright-core/lib/coreBundle.js:43341`). In every `@dialog-fit` run, the scrolling backdrop's scrollbar therefore takes up 0px. The SUMMARY shows this: chromium, firefox and webkit report identical region metrics (1280x420: `525/420`), and `clientWidth` is the full window.

As a result:
1. Nothing proves in a browser that a press on a real scrollbar fires `mousedown` on the region, or that `pressedOnScrollbar` then returns true. The four jsdom tests stub `clientWidth`, `getBoundingClientRect` and the rest, so they prove only the subtraction.
2. The case the owner actually uses (Chrome on Windows with classic ~15–17px scrollbars) is not covered: neither the 1280x420 centring nor the button reachability is checked with the gutter present.

The plan's acceptance for T-02-84 ("A mouse user can drag the backdrop's scrollbar without losing the dialog") is therefore asserted only by unit tests on stubbed geometry.

**Fix:** Add a `@dialog-fit` case that runs with real scrollbars. Re-enable them for that test, e.g. `test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })` in a chromium-only describe block (or a dedicated project). Then:
- at 1280x420, assert `clientWidth < viewport.width`;
- type `ORD-2026-0148`, run `page.mouse.down()` at `(viewport.width - 4, 200)`, move the mouse, run `page.mouse.up()`;
- assert the dialog is still visible, the field still holds the order number, and the region's `scrollTop` changed.

Also assert that a press at `(viewport.width / 2, 8)` (scrim above the dialog) still closes it.

### WR-03: The modal's rise animation briefly overflows the new scroll container when a phone sheet sits flush with the bottom, flashing a scrollbar and resizing the sheet

**File:** `web/src/ui/overlays/overlays.recipe.ts:39` (with `modalBase` at `:72` and `csp-rise` in `web/src/styles/app.css:61-66`)
**Issue:** The inline Modal inside the region is not a direct child of the region (the `.csp-overlay.is-inline` wrapper sits between them). So `[[data-ui=s-overlay]>&]:animate-none` does not apply, and `animate-csp-rise` (`translateY(8px) scale(0.98)`, origin centre) runs. The SUMMARY confirms this ("the modal's 0.2s rise moves its box"). At the start of the animation, the sheet's bottom edge sits `8 − 0.01·h` px below its resting place (about +2px for h ≈ 600).

Before D-42 the region's overflow was visible, so this did not matter. Now the region is an `overflow-y: auto` scroll container, and transformed boxes count toward its scrollable overflow. On phone pages the region has no bottom padding. When H − 96 < h ≤ H, the spacer has shrunk and the sheet's bottom is flush with the window's bottom. Any H − 96 < h ≤ H sheet therefore overflows by about 2px for 200ms.

Example: the iPhone 15 case, 393x659, h = 601.2, measured top 57.8, so the sheet is bottom-flush.

In a browser with classic scrollbars at a phone-page width (a half-screen desktop window, or high zoom), a vertical scrollbar flashes on open. The region's client width drops by about 15px and then grows back, so the sheet's buttons (`flex-1`) and text reflow twice. This is a visible jump that counts toward CLS (budget < 0.05). `@dialog-fit` cannot see it, because the scrollbars are hidden (WR-02) and `SETTLE` waits for the animations to finish before measuring.
**Fix:** Pick one of the following. Two of them change only motion, and D-08 needs the owner's approval for any look change:
- Stop the rise inside the region on phone pages: add a `pg-phone:in-data-[ui=s-overlay]:animate-none` token to `modalBase`. This matches App. C's stated intent (`.s-overlay > .csp-modal { animation: none }`) and needs a matching D-42 rule in rulings.css (`@container pg (max-width: 767px) { .s-overlay .csp-modal { animation: none; } }`). Clipping does not help: overflow from a transformed box still counts toward scrolling.
- Or reserve the scrollbar gutter on phone pages only (`pg-phone:[scrollbar-gutter:stable]`), so the flashing scrollbar cannot change the width. Add the matching ruling.

### WR-04: The unconditional column flow and `::before` spacer conflict with the frozen spec's slide-over-in-region mockup, and nothing records this

**File:** `web/src/ui/overlays/overlays.recipe.ts:38-40`, `web/visual/reference/rulings.css:242-270`, `docs/web/parity.md:174-180`
**Issue:** The frozen spec renders a slide-over inside the region for the Users screen. `CSPS-UI-SPEC.md:6014` has `<div class="s-overlay" style="justify-content: flex-end; align-items: stretch; padding: 0">` with a `.csp-modal-slideover` child (`height: auto; min-height: 100%`). That layout assumes App. C's row direction: `flex-end` puts the 480px panel at the right edge.

The D-42 rulings set `flex-direction: column` and a `::before { flex: 0 1 124px }` spacer on every `.s-overlay`. The mockup's inline style overrides justify, align and padding, but not `flex-direction` or the spacer. In a column, `justify-content: flex-end` is vertical and `align-items: stretch` combined with `max-width: 480px` pins the panel to the left. If that mockup is ever rendered on the reference side, it puts the panel on the wrong side.

On the implementation side, `Overlay` takes no props and inline style is banned (strict CSP), so the later phase that builds the Users slide-over will have to undo `flex-col`, `before:*` and `*:shrink-0`. None of the D-42 records (recipe doc comment, Overlay.tsx header, parity.md row, rulings.css comment) mention this limit. The phase that builds Users will find out from a parity diff, not from the record.
**Fix:**
- State the limit in the D-42 records: the recipe doc comment and parity.md section 6 should say "the region is for centred/sheet dialogs; a slide-over in the region needs its own region variant".
- Scope the reference ruling so it leaves the slide-over mockup alone, e.g. `.s-overlay:not([style])`, `.s-overlay:not([style])::before`, `.s-overlay:not([style]) > *`. The selectors still name a spec class, so `rulings.test.ts` keeps passing once its expected preludes are updated.
- Add a deferred item for the Users phase.

## Info

### IN-01: `pressedOnScrollbar` assumes a left-to-right layout and integer-aligned boxes

**File:** `web/src/ui/overlays/Modal.tsx:64-67`
**Issue:**
- **Right-to-left layout.** With `direction: rtl`, the vertical scrollbar is on the left. `x` is then negative there, and in Chromium `clientLeft` includes the scrollbar width, so a press on the scrollbar is not detected.
- **Rounding.** `clientWidth` and `clientHeight` are rounded integers, while `clientX` and `clientY` and the rect are fractional at 125% and 150% zoom, the owner's setting. The last fractional column or row of an overflowing region can be misclassified by under 1px.

Both are minor: the app is `en-PH` and left-to-right only.
**Fix:** Add a comment that the guard is left-to-right only. If RTL is ever supported, also treat `x < 0` as a scrollbar press.

### IN-02: With a classic scrollbar, the dialog centres on the client area, not on the whole window

**File:** `web/src/ui/overlays/overlays.recipe.ts:39`, `web/e2e/dialog-fit.spec.ts:154-157`
**Issue:** D-42 point 1 says "centred on the whole window". When the backdrop scrolls (1280x420 on Windows), `items-center` centres within `clientWidth`, so the dialog sits about 8px left of the window's centre. `expectCentred` compares against `clientWidth / 2`, so it accepts this by design, and it is not called in the scrolling tests anyway. This is probably acceptable, but the owner never saw it (WR-02).
**Fix:** Record it in the D-42 notes, or reserve the gutter on both edges only while the region scrolls. Pure CSS cannot do that conditionally, so recording it is the realistic option.

### IN-03: The landscape phone window from the plan's own phone check has no `@dialog-fit` case

**File:** `web/e2e/dialog-fit.spec.ts:244-279`
**Issue:** The plan measured four defective phone windows before the fix (393x659, 320x568, 659x393 landscape, plus 412x839, which fits). The spec covers every one except 659x393. That is the only landscape case, and the one most likely to be both a phone page and backdrop-scrolling on a wide engine.
**Fix:** Add `@dialog-fit 659x393 phone landscape`, asserting the top is `clamp(393 − h, 0, 96)`, `expectFullWidthSheet`, `expectScrolling`, and that a wheel turn brings both buttons into view.

### IN-04: No overscroll containment on the new scroll container

**File:** `web/src/ui/overlays/overlays.recipe.ts:39`
**Issue:** The region now scrolls, but it does not set `overscroll-behavior: contain`. Background scrolling is stopped only by `useBodyScrollLock` (`overflow-hidden` on `<body>`). iOS Safari before 16 ignores `overflow: hidden` on body for touch scrolling, so once the backdrop reaches its end the page behind a destructive dialog scrolls. This does not happen in current engines.
**Fix:** If older iOS is in the support matrix, add `overscroll-contain` to the region, with a matching `overscroll-behavior: contain` in the D-42 ruling group. Otherwise, record that the lock relies on iOS 16+.

---

_Reviewed: 2026-10-13T22:53:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
