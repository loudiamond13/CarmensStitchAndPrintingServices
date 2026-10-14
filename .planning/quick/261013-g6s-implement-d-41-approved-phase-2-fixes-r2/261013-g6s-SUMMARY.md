---
created: 2026-10-13T13:07:00-05:00
updated: 2026-10-13T13:07:00-05:00
phase: quick-261013-g6s
plan: 01
status: complete
subsystem: web (navigation, lists, entry, public layout, parity proof)
tags: [D-41, a11y, overflow, parity, tdd]
requires:
  - D-41 owner rulings (02-CONTEXT.md, 999.1 DECISIONS.md "Owner answers, 2026-10-13")
provides:
  - "R2-01 Topbar search box shrinks (min-w-0); admin pages never scroll sideways 320-1920 in any engine"
  - "R2-02 list table frame paint containment from 768px; no page scroll at 768px"
  - "R2-03 list SearchBox own 1px --focus border on focus-within (contrast proven >= 3:1)"
  - "R2-04 Ctrl+K / Cmd+K search shortcut, bare '/' inert, 'Ctrl K' / '⌘K' hint, aria-keyshortcuts; UI-WR-07 closed"
  - "R2-12 Sidebar collapse toggle aria-expanded"
  - "R2-17 public footer column titles h2"
  - "R2-18 refused money paste shows and announces the amount hint; UI-WR-09 closed"
affects:
  - web/visual parity proof (rulings layer, SPEC_OVERRIDES, structural exceptions)
  - web/e2e responsive sweep (plain no-sideways-scroll rule)
tech-stack:
  added: []
  patterns:
    - "Reference-only override of a frozen component through SPEC_OVERRIDES (Topbar -> D-41), writing owner-ruled text after mount"
    - "Always-mounted sr-only role=status sibling for a field's status message (WCAG 4.1.3)"
key-files:
  created:
    - web/visual/reference/fragments/Topbar.tsx
    - web/src/ui/lists/search-focus-contrast.node.test.ts
  modified:
    - web/src/ui/navigation/navigation.recipe.ts
    - web/src/ui/navigation/Topbar.tsx
    - web/src/ui/navigation/Sidebar.tsx
    - web/src/ui/lists/lists.recipe.ts
    - web/src/ui/entry/MoneyInput.tsx
    - web/src/app/public/SiteFooter.tsx
    - web/src/dev/scenarios/groups/lists.ts
    - web/visual/reference/rulings.css
    - web/visual/reference/merge-kit.ts
    - web/visual/reference/fragments/AdminShell.tsx
    - web/visual/intentional-differences.ts
    - web/e2e/responsive.spec.ts
    - web/e2e/admin.spec.ts
    - web/e2e/showcase.spec.ts
    - web/visual/lists-overflow.spec.ts
    - docs/web/parity.md
decisions:
  - "D-41 R2-04: both Ctrl+K and Meta+K trigger on every platform; Alt or Shift held means no trigger; the physical K key counts only on non-ASCII-letter layouts (Dvorak 't' does not)"
  - "D-41 R2-18: a paste that cleans down to nothing ('PHP' alone) counts as refused; only a blank clipboard is silent; the blur padding does not clear the hint"
  - "D-41 R2-04 reference side: a SPEC_OVERRIDES Topbar fragment renders the frozen Topbar unchanged and rewrites its kbd text after mount (zero bytes in the app bundles)"
metrics:
  duration: 58 min
  completed: 2026-10-13
  tasks: 3
  files: 33
estimate:
  tokens: 170000
  tasks: 3
actuals:
  tokens: 28850
  tasks: 3
  commits: 8
plan_head_before: b3204f91d3eb7520a22e650a38c5301b3d977145
plan_head_after: 6568eed8ef74a76adffbe164c6faf369794b42b8
---

# Quick 261013-g6s: Implement the D-41 approved Phase 2 fixes (R2-01, R2-02, R2-03, R2-04, R2-12, R2-17, R2-18) Summary

The admin Topbar search box can now shrink, so admin pages fit at 320px with no sideways scroll in Chromium, Firefox and WebKit. The list table frame contains its paint from 768px up, so a tablet list page no longer scrolls sideways. The list search box has its own 1px `--focus` border (contrast at least 3:1, proven in both themes). The Topbar search shortcut is now Ctrl+K / Cmd+K with a "Ctrl K" / "⌘K" hint and `aria-keyshortcuts`. The Sidebar toggle exposes `aria-expanded`. The footer column titles are h2. A refused money paste now shows and politely announces the amount hint. Every look difference is recorded under D-41, and the parity proof stays equal in all three engines with no tolerance.

## Commits

| Task | Type | Commit | Message |
|---|---|---|---|
| 1 | RED | 33839cf | test: failing tests for R2-01 and R2-02 overflow fixes |
| 1 | GREEN | 02ed9f8 | fix: Topbar search shrinks, list table frame contains its paint |
| 2 | RED | f68413f | test: failing tests for R2-03, R2-04 and R2-12 |
| 2 | GREEN | f5ea699 | fix: list search focus border, Ctrl+K shortcut, sidebar aria-expanded |
| 3 | RED | 840e754 | test: failing tests for R2-17 and R2-18 |
| 3 | RED | d5c9b3b | test: pin the D-41 footer heading exceptions in the parity registry |
| 3 | GREEN | 3fa9cae | fix: footer titles h2, refused money paste shows the hint |
| 3 | docs | 6568eed | docs: record the D-41 differences, close the implemented run-2 items |

## What was built

- **R2-01:** `searchClasses` gains `min-w-0`. The rulings group `D-41 R2-01` is `.csp-search { min-width: 0 }`. `responsive.spec.ts` no longer has the per-engine `TOPBAR_MIN_PAGE_WIDTH` table or the narrowed Topbar branch, and it checks the plain `scrollWidth <= innerWidth` rule everywhere. `admin.spec.ts` now also checks 320 and 390. `showcase.spec.ts` checks the page against the viewport at 320.
- **R2-02:** `tableWrapClasses` gains `contain-paint pg-phone:contain-none`. The class gate accepted the named utilities, so no arbitrary-property fallback was needed. The rulings layer has two `D-41 R2-02` groups: `.s-rt-wrap { contain: paint }`, and `contain: none` inside `@container pg (max-width: 767px)`. `lists-overflow.spec.ts` asserts that at 768px the page does not scroll while the frame does, and that the frame's computed `contain` is `paint`.
- **R2-03:** `searchBoxClasses` gains `focus-within:border-focus` only, with no box-shadow, ring or outline token. The rulings group `D-41 R2-03` is `.s-search-box:focus-within { border-color: var(--focus) }`. The `toolbar-orders` scenario now compares `['rest', 'focus-visible']` on `input[type="search"]`, which matches both sides.
- **R2-04:** `isSearchShortcut` changes:
  - It triggers on `k`/`K`, or on `code === 'KeyK'` with a non-ASCII-letter key.
  - Exactly one of Ctrl or Meta must be held, with no Alt and no Shift.
  - Every UI-WR-07 guard stays.

  `searchShortcutHint(userAgent)` is exported: it returns '⌘K' when the agent matches `/Mac|iPhone|iPad|iPod/`, else 'Ctrl K'. The input carries `aria-keyshortcuts="Control+K Meta+K"`. On the reference side, `fragments/Topbar.tsx` is listed in `SPEC_OVERRIDES` as `Topbar → D-41`. It renders the frozen Topbar with no wrapper and rewrites `.csp-search kbd` from "/" to the hint, with the hint text typed from the ruling. `AdminShell.tsx` uses this override.
- **R2-12:** the Sidebar collapse toggle sets `aria-expanded={!collapsed}`, using the displayed state whether the prop is controlled or not.
- **R2-17:** the SiteFooter Shop, Visit and Contact titles are h2 with identical classes. There are three `kind: 'element'` D-41 exceptions for `public-shell`.
- **R2-18:** MoneyInput tracks a `refused` flag:
  - A paste is refused when the clipboard is not blank and the result is not money text, including a result that normalises to nothing.
  - The next accepted keystroke or paste clears the flag.
  - While the flag is set, Field gets `ENTRY_COPY.money.invalid` as its `error`, but a caller's error wins.
  - An always-mounted, sr-only `role="status"` (`aria-live="polite"`) sibling carries the same text.
  - The pasted text is never echoed.

## Values the plan asked for

- **Footer exception parity paths (public-shell):** `0/2/0/0/1/0`, `0/2/0/0/2/0` and `0/2/0/0/3/0`, read from the `@layouts-public` parity report. In all 14 failing rows of the run without exceptions, the only difference was "structure tag: reference h4 | implementation h2".
- **Measured contrast of `--focus` (WCAG 2.x):**

  | Theme | vs `--surface-2` (inside) | vs `--surface` (toolbar) | vs `--bg` |
  |---|---|---|---|
  | Blush | 9.01:1 | 9.88:1 | 8.95:1 |
  | Espresso | 6.80:1 | 7.49:1 | 7.99:1 |

- **Bundle budgets** (no limit changed). The final `verify` run measured:

  | Build | public JS | admin JS | CSS |
  |---|---|---|---|
  | Production | 126.18 KB of 150 | — | 13.01 KB of 35 |
  | Dev-route budget build | 131.57 KB of 150 | 156.71 KB of 250 | 13.01 KB |

  Across this task's builds, the parity-mode build went from 131.12 / 155.88 KB (public / admin) after Task 1 to 131.12 / 156.18 KB after Task 2, and admin grew by under 1 KB in total. The reference-side Topbar override adds nothing to the app bundles.

## Verification (real output)

- Unit (targeted, per task): Task 1: 220/220. Task 2: 288/288. Task 3: 334/334 (`visual`, `src/app/public`, `src/ui/entry`, `scripts/owner-review`). The RED runs failed as expected first: 6 failures for Task 1, 25 + 1 for Task 2 (the +1 is the FilterBar scenario pin), and 14 + 1 for Task 3.
- Parity, run 1 (`@navigation|@layouts-admin|@lists`, after Task 1): **133 passed**, three engines, including `@lists @overflow` at 768px.
- Parity, run 2 (`@reference|@navigation|@layouts-admin|@lists|@layouts-public`, after Task 2): 143 passed and 14 failed. Every failure was `@layouts-public`, from the expected h4→h2 tag difference before the exceptions existed.
- Parity, run 3 (`@layouts-public|@entry`, after Task 3): **30 passed**.
- E2E (`@responsive`, after Task 1): **65 passed**, including Firefox at 320–414 and the iPhone 15 and Pixel projects.
- E2E (`admin.spec showcase.spec responsive.spec`, final code): **130 passed**.
- `npm --prefix web run verify`: **exit 0**. It ran typecheck (three programs), lint `--max-warnings 0`, format check, test:coverage, build, build:budget, license:check and notices:check.
  - Vitest: 107 files, 2999 tests passed.
  - Coverage: all files 98.21% statements, 96.45% branches, 99.81% functions, 99.82% lines, and the thresholds held. By area: ui/entry 98.73 / 97.46, ui/navigation 95.85 / 92.63, ui/lists 98.13 / 95.44 (statements / branches).
  - `test:coverage` ran inside `verify` and was not run a second time.
- Preflight (`preflight.ps1 -Ports 5180,5115,7028,5199`) ran before every Playwright run. Every port was free and no other project's processes were listed. Nothing was killed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two pinning tests the plan did not list had to change**
- **Found during:** Tasks 2 and 3
- **Issue:** `web/src/ui/lists/FilterBar.test.tsx` pins the `toolbar-orders` scenario shape, and `web/visual/compare.test.ts` pins the full STRUCTURAL_EXCEPTIONS list.
- **Fix:** both pins were extended in RED commits: FilterBar.test in f68413f, and compare.test in its own commit, d5c9b3b.
- **Files modified:** web/src/ui/lists/FilterBar.test.tsx, web/visual/compare.test.ts

**2. [Note] The focus-visible parity rows run in Chromium only**
- The plan's done text says the new `toolbar-orders` focus-visible rows are equal "in all three engines". The parity matrix runs every focus-visible row as `@chromium-only` (an existing harness convention, STATE 02-14). The rows passed in Chromium, and the rest and hover rows passed in all three engines. The matrix was not changed.

**3. [Note] Commit order versus the plan's verify order**
- Task 1's GREEN commit (02ed9f8) was made once its unit tests and parity run were green, while the `@responsive` sweep was still running, so the shared working tree could be staged per task. The sweep then passed (65/65). The final 130-test e2e run and `verify` cover the final tree.

**4. [Note] Doc touches beyond the plan's wording**
- The rulings.css header gained a D-41 R2-04 bullet saying the shortcut-hint ruling has no CSS rule, in the same way it documents D-40.
- `intentional-differences.ts` now lists D-41 among the look rulings in its header.

No owner decision outside D-41 was needed.

## Known Stubs

None.

## Threat Flags

None. The plan's threat register covers every surface touched:
- T-261013-01: the hint is fixed copy and is never echoed, as tested.
- T-261013-02: each keyboard guard has a test.
- T-261013-03: SPEC_OVERRIDES is pinned to exactly `Topbar → D-41`, and TOLERANCE_OVERRIDES is still empty.
- T-261013-04: the contrast node test.

## Self-Check: PASSED

- FOUND: web/visual/reference/fragments/Topbar.tsx
- FOUND: web/src/ui/lists/search-focus-contrast.node.test.ts
- FOUND commits: 33839cf, 02ed9f8, f68413f, f5ea699, 840e754, d5c9b3b, 3fa9cae, 6568eed
