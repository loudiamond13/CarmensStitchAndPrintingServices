---
phase: 02-web-foundation-design-system
plan: 19
subsystem: ui
tags: [badge, status-badge, avatar, segmented-control, tabs, wai-aria, roving-tabindex, parity, tailwind, d-03, d-33, o-1, web-02, a11y-02, a11y-04, tdd]
created: "2026-10-08T17:43:00-05:00"
updated: "2026-10-08T17:43:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-14)
    provides: "the live parity harness, the kit, renderNode and the comparator"
  - phase: 02-web-foundation-design-system (plan 02-17)
    provides: "the unminified reference CSS, the REPAINT settle step and rowTimeout"
  - phase: 02-web-foundation-design-system (plan 02-18)
    provides: "the brand barrel (Icon), the React CSSProperties --* augmentation and the wrapper-pair convention"
provides:
  - "web/src/ui/status: Badge, StatusBadge, Avatar, BadgeTone, STATUS_TONE, PAYMENT_TONE, EXPENSE_TONE, isOrderStatus (+ BadgeProps, StatusBadgeProps, AvatarProps); status.recipe.ts (badgeClasses, badgeToneClasses, badgeDotClasses, avatarClasses)"
  - "web/src/ui/choice: SegmentedControl, SegmentOption, SegmentedControlProps, Tabs, TabItem, TabsProps, TabPanelProps, getTabPanelProps; choice.recipe.ts (segmented/segment, tabList/tab/tabCount classes); roving.ts (rovingItem, RovingPattern)"
  - "status parity group: 31 scenarios (8 tones, dot, icon, 6 order statuses, 4 payment methods, 7 expense categories, avatar-24/32/40/56)"
  - "choice parity group: 6 scenarios (segmented-text, segmented-icons, segmented-icon-labels, tabs-orders, tabs-orders-other, tabs-overflow)"
  - "Dev-only wrapper pair TabsWithPanel (src/dev/previews + visual/reference/fragments)"
  - "Comparator reads scrollbar-width"
affects: [02-20, 02-21, 02-22, 02-23, 02-24, 02-25, 02-26, 02-27, 02-28, 02-29, 02-30, 02-31, parity, order-detail, users, expenses, profile]

actuals:
  tokens: 19800    # chars/4 over the realized diff (79,175 chars, 21 files)
  tasks: 3
  commits: 6
plan_head_before: a28f0e87f74cd84018c1aace809e941c6e795f8d
plan_head_after: 769a75b09c89d5cfa02a8ce7cab7faadb37a9de4

tech-stack:
  added: []
  patterns:
    - "Roving tabIndex for choice controls: only the selected item (or the first, when none is) has tabIndex 0; rovingItem(items, index, key, pattern) gives the next item, and the component selects it and focuses its button through a ref array"
    - "A scenario that needs the selected state's ARIA target (a tabpanel) wraps the component in a same-named dev-only pair that adds the target after it, without adding a wrapper element (a fragment)"
    - "State-driven parity cases target the selected item for focus-visible (Tab reaches it on both sides) and get a separate '-other' case targeting an unselected item for hover"
    - "Typed tone tables (Record<PaymentMethod|ExpenseCategory|OrderStatus, BadgeTone>) plus a typed guard (isOrderStatus via Object.hasOwn) for strings from the API"

key-files:
  created:
    - web/src/ui/status/tones.ts
    - web/src/ui/status/status.recipe.ts
    - web/src/ui/status/Badge.tsx
    - web/src/ui/status/StatusBadge.tsx
    - web/src/ui/status/Avatar.tsx
    - web/src/ui/status/index.ts
    - web/src/ui/status/status.test.tsx
    - web/src/ui/choice/choice.recipe.ts
    - web/src/ui/choice/roving.ts
    - web/src/ui/choice/SegmentedControl.tsx
    - web/src/ui/choice/SegmentedControl.test.tsx
    - web/src/ui/choice/Tabs.tsx
    - web/src/ui/choice/Tabs.test.tsx
    - web/src/ui/choice/index.ts
    - web/src/dev/scenarios/groups/status.ts
    - web/src/dev/scenarios/groups/choice.ts
    - web/src/dev/previews/TabsWithPanel.tsx
    - web/visual/reference/fragments/TabsWithPanel.tsx
  modified:
    - web/visual/compare.ts
    - web/visual/compare.test.ts
    - docs/web/parity.md

key-decisions:
  - "Tabs take a required idBase prop; tab ids are `${idBase}-tab-${id}` and getTabPanelProps(idBase, id) returns { id: `${idBase}-panel-${id}`, role: 'tabpanel', 'aria-labelledby' } for the caller's panel. Required, because axe fails a selected tab whose aria-controls names a missing element (SPEC-DEVIATION: WEB-02 / A11Y-02)"
  - "SegmentedControl and Tabs use a roving tabIndex with automatic activation: SegmentedControl Right/Down and Left/Up, Tabs Right/Left plus Home/End, all wrapping; when no item matches the value, the first is the Tab stop. Up/Down are left to the browser on the horizontal tab list"
  - "PAYMENT_TONE and EXPENSE_TONE are keyed by the PaymentMethod and ExpenseCategory unions instead of App. D.3's Record<string, BadgeTone>; StatusBadge falls back to the raw text in neutral through the typed isOrderStatus guard (T-02-49)"
  - "Avatar keeps App. D.3's markup and adds role img (D-31 O-1); size and font size go through --avatar-size / --avatar-fs read by size-(--avatar-size) text-(length:--avatar-fs) next to the style"
  - "The App. D.3 csp-status hook class has no rule and is dropped (D-33)"
  - "The comparator now reads scrollbar-width: headless Chromium never paints scrollbars, so without it a lost [scrollbar-width:none] passed every parity row (proven by a mutation run before the fix)"

patterns-established:
  - "Choice components select through rovingItem from web/src/ui/choice/roving.ts; later keyboard-driven lists (tab bar, menus) should reuse it"
  - "Screens with tabs render the selected panel as <div {...getTabPanelProps(idBase, selected)}> right after <Tabs idBase=...>"

requirements-completed: [WEB-02, A11Y-02, A11Y-04]

coverage:
  - id: D1
    description: "Badge in all 8 tones, with a dot and with an icon, StatusBadge for all six order statuses, and the 4 payment and 7 expense badges are computed-style-, box- and pixel-equal to the approved design in Blush and Espresso at 390 and 1440 px in Chromium, Firefox and WebKit"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@status|@choice\" (44 passed: chromium 20, firefox 12, webkit 12)"
        status: pass
      - kind: unit
        ref: "web/src/ui/status/status.test.tsx (44 tests: Badge, StatusBadge, tone tables, scenario set, kit render + axe)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Avatar renders the initials with role img and aria-label = the name (D-31 O-1), sets only --avatar-size and --avatar-fs (max(10, round(size x .38))px) in style, and matches the spec Avatar at 24, 32, 40 and 56 px"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "web/src/ui/status/status.test.tsx#Avatar (App. D.3, D-31 O-1)"
        status: pass
      - kind: automated_ui
        ref: "parity avatar-24/32/40/56 in every @status row (3 engines)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SegmentedControl is a radiogroup of role=radio buttons with aria-checked and a roving tabIndex; arrow keys move and select with wrap; icon-only options keep aria-label and title; it matches the spec at rest, hover and focus-visible (and hover on an unselected option)"
    requirement: "A11Y-02"
    verification:
      - kind: unit
        ref: "web/src/ui/choice/SegmentedControl.test.tsx (18 tests)"
        status: pass
      - kind: automated_ui
        ref: "parity segmented-text, segmented-icons, segmented-icon-labels rows (3 engines; focus-visible in Chromium)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tabs implement the WAI-ARIA tabs pattern on App. D.3's elements: ids, aria-selected, aria-controls = getTabPanelProps id, roving tabIndex, Right/Left wrap and select, Home/End; axe clean with the panel"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/choice/Tabs.test.tsx (22 tests)"
        status: pass
      - kind: automated_ui
        ref: "parity tabs-orders, tabs-orders-other (axe on both sides with the TabsWithPanel panel)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The selected tab differs by weight 700 vs 600 and ink colour, not only the orange underline (D-03), in both themes; the strip scrolls sideways with the scrollbar hidden and no page overflow (tabs-overflow at 320/390/820/1440)"
    requirement: "A11Y-04"
    verification:
      - kind: automated_ui
        ref: "parity @choice rows incl. 320/820 Chromium; mutation runs (weight 600, scrollbar shown) both fail the comparison"
        status: pass
      - kind: unit
        ref: "Tabs.test.tsx#marks the selected tab by weight 700 and ink...; #scrolls the strip sideways...; visual/compare.test.ts#reads scrollbar-width"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full web gate passes with the new components"
    verification:
      - kind: other
        ref: "npm --prefix web run verify (exit 0: 56 files, 1504 tests, coverage 100 / 99.88 / 100 / 100)"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 19: Status and Choice Components (Badges, Avatar, SegmentedControl, Tabs) Summary

**Badge (8 tones, dot, icon), StatusBadge (6 statuses), the payment and expense badges, Avatar (role img, custom-property sizing), the radiogroup SegmentedControl and WAI-ARIA Tabs are equal to the approved design in Chromium, Firefox and WebKit, in Blush and Espresso. Both choice controls use a roving tabIndex with arrow-key selection. The selected tab is bold as its second cue (D-03), and its strip scrolls with a hidden scrollbar. No look changed, and no tolerance or normalization was added. The comparator now also reads `scrollbar-width`.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-10-08T22:06:20Z
- **Completed:** 2026-10-08T22:42:11Z
- **Tasks:** 3 of 3
- **Files modified:** 21 (18 created, 3 modified)

## Accomplishments

- **Status.**
  - `tones.ts` holds `BadgeTone` and the three §6.2 tables with the App. D.3 values. PAYMENT_TONE and EXPENSE_TONE are keyed by the typed unions. `isOrderStatus` uses `Object.hasOwn`, so `toString` is not a status.
  - In `status.recipe.ts`, the badge base, one complete tone literal per tone (`satisfies Record<BadgeTone, string>`), the dot and the avatar are each one list of utilities.
  - `Badge` keeps the App. D.3 markup: a hidden dot, a hidden 14px icon, then the text.
  - `StatusBadge` is a dotted Badge with the ORDER_STATUSES label. An unknown status shows its raw text in neutral.
  - `Avatar`: initials from the first two words, `role="img"`, and `aria-label` set to the name. Its style sets only `--avatar-size` and `--avatar-fs`.
- **Choice.**
  - `SegmentedControl`: App. D.3 props and markup, and the checked look keyed off `aria-checked`. The segments stay 32px (O-8).
  - `Tabs`: App. D.3 elements, plus ids, `aria-controls`, a roving tabIndex, Right/Left with wrap, and Home/End. `getTabPanelProps` gives the caller's panel its id, role and `aria-labelledby`. In the look, `aria-selected:font-bold` and `aria-selected:text-ink` draw the underline through `aria-selected:after:`. The count chip follows the selected tab through `group-aria-selected/tab:`. The strip is `overflow-x-auto [scrollbar-width:none]`.
  - `roving.ts`: `rovingItem` is the one arrow-key rule for both patterns.
- **Scenarios.**
  - status: 31 cases, all at rest in both themes.
  - choice: 6 cases. Focus-visible targets the selected item. Two cases (`segmented-icon-labels` and `tabs-orders-other`) target an unselected item for hover. `tabs-overflow` is responsive.
- **Harness.** `TabsWithPanel` is a new wrapper pair: the Tabs, then the selected panel, as a fragment, so no wrapper element is added. The comparator now reads `scrollbar-width`.

## Task Commits

1. **Task 1 (tracer): order status badges.**
   - RED `19aa718`: 24 of 31 tests failed against inert stubs (`RED_EVIDENCE_OK`, target `src/ui/status/status.test.tsx`).
   - GREEN `1447f22`: Chromium `@status` passed 4/4. A throw-away mutation (warning ink → `text-ink`) failed `badge-warning`, `status-badge-production` and `expense-badge-supplies` on colour and pixels. It was reverted.
   - Tracer gate (interactive, end-of-phase, automated-only verify): after the commit I re-ran both verify commands (31/31, then Chromium 4/4) before expanding.
2. **Task 2: Avatar and SegmentedControl.**
   - RED `4a9b18f`: 25 of 60 tests failed (`RED_EVIDENCE_OK` for `status.test.tsx` and `SegmentedControl.test.tsx`).
   - GREEN `05c4889`:
     - Chromium `@status|@choice`: 16/16.
     - A mutation (the inset ring removed from the checked segment, and the avatar factor set to .4) was caught on box-shadow and font-size, then reverted.
     - Three engines: 40/40.
3. **Task 3: Tabs.**
   - RED `82ea618`: 16 of 22 tests failed (`RED_EVIDENCE_OK`, target `src/ui/choice/Tabs.test.tsx`).
   - GREEN `769a75b`:
     - Chromium `@choice`: 16/16.
     - The weight mutation (600) failed every tabs case.
     - The scrollbar mutation passed until the comparator read `scrollbar-width`. After that it failed (deviation 2).
     - Three engines `@status|@choice`: 44/44.
     - Regressions all passed: Chromium `@reference|@selftest|@actions|@brand` 27/27, and Firefox plus WebKit `@selftest|@actions|@brand` 26/26.
     - `verify` exited 0.

**Plan metadata:** recorded in the docs(02-19) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/status/{tones.ts, status.recipe.ts, Badge.tsx, StatusBadge.tsx, Avatar.tsx, index.ts}`: the status components and tables
- `web/src/ui/status/status.test.tsx` (44 tests)
- `web/src/ui/choice/{choice.recipe.ts, roving.ts, SegmentedControl.tsx, Tabs.tsx, index.ts}`: the choice components
- `web/src/ui/choice/SegmentedControl.test.tsx` (18 tests) and `Tabs.test.tsx` (22 tests, incl. rovingItem)
- `web/src/dev/scenarios/groups/status.ts` (31) and `choice.ts` (6): the parity scenarios
- `web/src/dev/previews/TabsWithPanel.tsx` and `web/visual/reference/fragments/TabsWithPanel.tsx`: the wrapper pair
- `web/visual/compare.ts` and `compare.test.ts`: `scrollbar-width` is read and pinned
- `docs/web/parity.md`: the TabsWithPanel pair (section 5) and `scrollbar-width` (section 1)

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **Screens with tabs** (order detail, profile): render `<Tabs idBase="order" items value onChange />`, then `<div {...getTabPanelProps('order', value)}>…</div>`. `idBase` must be unique on the page. The active tab id goes into the URL through nuqs (replace, WEB-10). That wiring belongs to the screen, not to Tabs.
- **Unknown data values.** Use `isOrderStatus` before indexing STATUS_TONE with an API string. PAYMENT_TONE and EXPENSE_TONE accept only the typed unions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Tabs need a real panel in their parity cases**
- **Found during:** Task 3 (design)
- **Issue:** axe's `aria-valid-attr-value` check skips `aria-controls` only when `aria-selected="false"`. A selected tab whose `aria-controls` names a missing panel is a violation, and parity runs axe on every page.
- **Fix:**
  - `idBase` is a required prop. It is marked SPEC-DEVIATION, and the frozen D.3 Tabs simply ignore it.
  - The tabs cases render through a new dev-only wrapper pair, `TabsWithPanel`. It renders the Tabs, then the selected panel, as a fragment, so the tab list stays the case's first element. The implementation's panel spreads `getTabPanelProps`. The reference's panel is the same plain block.
- **Files modified:** web/src/dev/previews/TabsWithPanel.tsx, web/visual/reference/fragments/TabsWithPanel.tsx, web/src/dev/scenarios/groups/choice.ts, docs/web/parity.md
- **Committed in:** `82ea618`, `769a75b`

**2. [Rule 2 - Missing critical] The comparator could not see a lost hidden scrollbar**
- **Found during:** Task 3 (mutation run)
- **Issue:** I removed `[scrollbar-width:none]` from the tab strip and every parity row still passed. Headless Chromium never paints scrollbars, and `scrollbar-width` was not among the compared properties, so a must-have truth went unverified.
- **Fix:** `scrollbar-width` was added to `VISUAL_PROPERTIES`, pinned by a new `compare.test.ts` case. This makes the comparison stricter and adds no normalization or tolerance. The same mutation then failed the three tabs cases on `scrollbar-width: none | auto`. Every other group passed again in all three engines.
- **Files modified:** web/visual/compare.ts, web/visual/compare.test.ts, docs/web/parity.md
- **Committed in:** `769a75b`

**3. [Rule 3 - Blocking] One shared arrow-key rule (`roving.ts`)**
- **Found during:** Task 2
- **Issue:** SegmentedControl and Tabs need the same wrap logic, with different keys. An inline index lookup also left an untestable `undefined` branch under `noUncheckedIndexedAccess`.
- **Fix:** `rovingItem(items, index, key, pattern)` in a new `web/src/ui/choice/roving.ts`, which is not in the plan's file list. The Tabs tests cover every branch, including an empty list.
- **Committed in:** `05c4889`, `769a75b`

**4. [Rule 2 - Missing critical] A Tab stop when no item matches the value**
- **Found during:** Task 2
- **Issue:** With a roving tabIndex, a controlled value that matches no option would leave the group with no Tab stop.
- **Fix:** In that case the first item gets tabIndex 0, following the WAI-ARIA radio group. This applies to both SegmentedControl and Tabs, and is tested in each.
- **Committed in:** `05c4889`, `769a75b`

**5. [Rule 2 - Missing critical] Extra scenarios beyond the plan's list**
- **Found during:** Tasks 1 to 3
- **Issue:**
  - With a roving tabIndex, a focus-visible case can only target the selected item, so hover on an unselected item, where its ink changes, would never be compared.
  - The plan's badge list had no dot or icon case, even though the truth says "with and without icon".
- **Fix:** Added `segmented-icon-labels` (showLabel, second option selected, hover on the unselected one), `tabs-orders-other`, `badge-success-dot` and `badge-accent-icon`.
- **Committed in:** `19aa718`, `4a9b18f`, `82ea618`

---

**Total deviations:** 5 auto-fixed (4 Rule 2, 1 Rule 3)
**Impact on plan:** Every must-have truth is proven by unit tests and by the three-engine parity run. The look, the elements and the text are unchanged. The ARIA additions (role img, ids, aria-controls, tabIndex) are on the UI-SPEC intentional-differences list ("Avatar role img, Tabs ARIA: attributes are not compared"). No tolerance or normalization was added; the comparator only got stricter.

## Issues Encountered

- Python `open(..., 'w')` on Windows wrote CRLF into one test file. Prettier normalized it to LF before the commit, and I checked that no tracked file under the touched folders contains a CR.
- `TZ=America/Chicago date` in Git Bash returned UTC. I corrected the docs timestamp by hand.

## TDD Gate Compliance

- Task 1: RED `19aa718` comes before GREEN `1447f22` (`RED_EVIDENCE_OK`).
- Task 2: RED `4a9b18f` comes before GREEN `05c4889` (`RED_EVIDENCE_OK` for both test files).
- Task 3: RED `82ea618` comes before GREEN `769a75b` (`RED_EVIDENCE_OK`).
- The tone-table and scenario-shape tests passed at RED, because the data and scenarios were committed with the stubs. They pin that data.
- The `compare.test.ts` scrollbar-width case was written during GREEN, before its fix, and failed first (1 of 39). It has no separate RED commit, because it came out of the Task 3 mutation run.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved.

## Look Gate (D-08 conditional checkpoint)

It did not fire. Every case matched the approved design on its first GREEN run. No look, element, text or ARIA change was made beyond the intentional-differences list.

## Threat Flags

None. T-02-49 is mitigated: the tone maps are typed by the unions, an unknown status string falls back to neutral through `isOrderStatus`, and this is tested. No endpoint, auth path or file access was added.

## Verification

- `npm --prefix web run test -- --run src/ui/status src/ui/choice`: 3 files, 84/84 (44 + 18 + 22).
- Preflight showed all four ports free and no other project's test processes. Then `npm --prefix web run parity -- --grep "@status|@choice"` passed 44 rows: Chromium 20, Firefox 12, WebKit 12.
- Regression after the comparator change: Chromium `@reference|@selftest|@actions|@brand` 27 passed, and Firefox plus WebKit `@selftest|@actions|@brand` 26 passed.
- `npm --prefix web run verify` exited 0. It ran typecheck (3 programs), lint, format, 56 files with 1504 tests, coverage at 100 / 99.88 / 100 / 100, the build, the license gate and notices.
- Acceptance greps:
  - `satisfies Record<BadgeTone` in status.recipe.ts: 1.
  - `role="img"` in Avatar.tsx: 1.
  - `radiogroup` in SegmentedControl.tsx: 1.
  - `aria-selected:font-bold` in choice.recipe.ts: 1.
  - `scrollbar-width:none` in choice.recipe.ts: 1.
- `node web/scripts/class-gate.mjs`: exit 0.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Imports.** `Badge`, `StatusBadge`, `Avatar` and the tone tables come from `@/ui/status`. `SegmentedControl`, `Tabs` and `getTabPanelProps` come from `@/ui/choice`.
- **Context looks for later plans.** These belong to the plans that convert their regions, as a prop or a `data-ui` context:
  - `.csp-sidebar .csp-avatar` (surface-3) and `.s-profile-head .csp-avatar` (accent ring): 02-26 and the layout plans.
  - `.csp-order-status .csp-badge` (1px line ring): the OrderCard plan.
  - `.s-tabcard .csp-tabs` (12px padding): the order-detail card.
- **Keyboard.** `rovingItem` (`web/src/ui/choice/roving.ts`) is ready for the tab bar or any other roving list.
- **Parity runtime.** Three engines for `@status|@choice` took 2.5 min.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 18 created and 3 modified files exist on disk.
- Commits `19aa718`, `1447f22`, `4a9b18f`, `05c4889`, `82ea618` and `769a75b` are on `gsd/phase-2-web-foundation-design-system`.
