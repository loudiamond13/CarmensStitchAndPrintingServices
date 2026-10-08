---
phase: 02-web-foundation-design-system
plan: 13
subsystem: ui
tags: [react, spec-gap, responsive-table, pagination, filter-bar, search, skeleton, lazy-image, nuqs, a11y, axe, tdd]
created: "2026-10-08T03:52:00-05:00"
updated: "2026-10-08T03:52:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "Plan 08: createListParams (setPage push, other setters replace + page reset, setSearch debounce/immediate), parsers (PAGE_SIZES, SEARCH_MAX_LENGTH), URL_STATE_DEFAULTS/orderSearchParams; plan 10: describeHttpError, isHttpError via @/lib/api; plan 12: gaps/copy.ts, the spec-gaps.css block convention and the overrides.test.ts SPEC-GAP helpers; plan 09: reconciled @/ui (EmptyState, Skeleton, Button, Select, MediaPlaceholder, Badge, Icon)"
provides:
  - "web/src/ui/gaps/ResponsiveTable.tsx: ResponsiveTable (App. E list markup + loading/error/empty/no-match/refetching states), CustomerCell, ResponsiveColumn, ListStatus"
  - "web/src/ui/gaps/Pagination.tsx: Pagination (nav, Page p of n, focus target, Rows per page)"
  - "web/src/ui/gaps/SearchBox.tsx: SearchBox (App. E.7, type search, maxLength 100, Enter submits)"
  - "web/src/ui/gaps/FilterBar.tsx: FilterBar, ResultBar, FilterChip"
  - "web/src/ui/gaps/ErrorState.tsx: ErrorState (list-load copy or caller title/message, traceId reference)"
  - "web/src/ui/gaps/LoadingRegion.tsx: LoadingRegion (aria-busy + one polite status node)"
  - "web/src/ui/gaps/Skeletons.tsx: SkeletonText, SkeletonCard, SkeletonTable, SkeletonImage"
  - "web/src/ui/gaps/LazyImage.tsx: LazyImage"
  - "web/src/ui/gaps/useDelayedFlag.ts: useDelayedFlag(flag, delayMs)"
  - "gaps/copy.ts: LIST_COPY, ERROR_STATE_COPY, PAGINATION_COPY, FILTER_BAR_COPY, capitalize, nounFor"
  - "spec-gaps.css SPEC-GAP blocks: ResponsiveTable, ResponsiveTable refetching, Pagination, FilterBar chips, LazyImage"
affects: [02-14, 02-15, 02-17, 02-18, phase 5 users, phase 6 expenses, phase 7/8 orders, public gallery]

actuals:
  tokens: 27861       # chars/4 over git diff a6f64f2..81463df (111444 chars)
  tasks: 3
  commits: 6
plan_head_before: a6f64f27a82eb632ca21295ff23f9ef2ecaa4879
plan_head_after: 81463dfa03a742de1b22bf2272bd472dce31cb37

tech-stack:
  added: []
  patterns:
    - "A list screen renders ResponsiveTable with status from its query (loading/error/empty/ready), isPlaceholderData from useListQuery, and wires Pagination/SearchBox/FilterChip straight to its createListParams setters"
    - "Props-to-state edges (LoadingRegion busy, useDelayedFlag reset, LazyImage src, SearchBox outside value) are tracked during render with a previous-value state, never with setState in an effect"
    - "Under vitest fake timers user-event waits never resolve; debounce tests fire input events with fireEvent, other tests use real timers, and axe always runs on real timers"
    - "New SPEC-GAP type comes from existing classes (.body-sm for the Body role, .csp-money for 600 tabular numbers); spec-gaps.css sets colour and layout only"

key-files:
  created:
    - web/src/ui/gaps/ResponsiveTable.tsx
    - web/src/ui/gaps/ResponsiveTable.test.tsx
    - web/src/ui/gaps/useDelayedFlag.ts
    - web/src/ui/gaps/useDelayedFlag.test.tsx
    - web/src/ui/gaps/ErrorState.tsx
    - web/src/ui/gaps/ErrorState.test.tsx
    - web/src/ui/gaps/LoadingRegion.tsx
    - web/src/ui/gaps/LoadingRegion.test.tsx
    - web/src/ui/gaps/Skeletons.tsx
    - web/src/ui/gaps/Skeletons.test.tsx
    - web/src/ui/gaps/LazyImage.tsx
    - web/src/ui/gaps/LazyImage.test.tsx
    - web/src/ui/gaps/Pagination.tsx
    - web/src/ui/gaps/Pagination.test.tsx
    - web/src/ui/gaps/SearchBox.tsx
    - web/src/ui/gaps/FilterBar.tsx
    - web/src/ui/gaps/FilterBar.test.tsx
    - web/src/ui/gaps/listState.integration.test.tsx
  modified:
    - web/src/ui/gaps/copy.ts
    - web/src/styles/spec-gaps.css
    - web/src/styles/overrides.test.ts

key-decisions:
  - "ResponsiveTable derives its body from status and rows: a first load with no rows shows SkeletonTable (4 rows); error shows ErrorState above any rows it still has; empty, or ready with no rows, shows EmptyState ('No {things} yet' or, with filters or search text, 'No matches' + secondary 'Clear Filters'); render results of null, undefined, false or '' print '—'; the action column gets data-label 'Actions' so every td has one"
  - ".is-refetching appears only when isPlaceholderData has been true for 200 ms (useDelayedFlag) and rows exist; while it shows, the LoadingRegion is busy and says 'Loading {things}…'. Skeletons never replace kept rows"
  - "LoadingRegion puts its one role=status node beside the aria-busy region, not inside it (assistive tech may hold back updates inside a busy subtree), and says nothing after a failed load because the ErrorState alert announces it"
  - "SearchBox keeps the text as typed and takes an outside value only when it differs once trimmed, because the list hook stores the trimmed search and would otherwise eat the space in 'red jersey'; the URL stays the single source"
  - "Pagination: nav.csp-pagination > .csp-pagination-pager (Previous, 'Page p of n', Next spread apart) plus, when onPageSizeChange is given, the 'Rows per page' Select in .s-toolbar-end at the row end. The whole thing is not rendered for pageCount <= 1. Focus moves to focusTargetId after a page change (ResponsiveTable's captionId makes the caption a tabIndex -1 target)"
  - "ResultBar at zero hides the 'Showing' line but keeps any chips, so filters can still be cleared one by one; with no chips it renders nothing. Chips sit in a .csp-filter-chips group and each label in .csp-filter-chip-label (one text node), so it can truncate"
  - "ErrorState props are a union: `things` for the list-load copy, or `title`/`message` for mapper copy (describeHttpError) in a modal banner; an empty message drops the second line unless a traceId reference exists, and a reference already in the message is not repeated"
  - "LazyImage covers the img with an absolutely positioned radius-0 Skeleton until load (no opacity), swaps in MediaPlaceholder on error with the label chip hidden by CSS, and marks a failed decorative image aria-hidden"

patterns-established:
  - "Every SPEC-GAP data primitive test runs expectNoAxeViolations in each state and has an equal-props re-render test for the React Compiler cache path"

requirements-completed: [WEB-06, WEB-08, WEB-10, A11Y-01, PERF-03]

coverage:
  - id: D1
    description: "ResponsiveTable populated markup: .s-rt-wrap > table.s-rt, .csp-sr caption, data-label on every td, is-lead, r.is-acts under a .csp-sr 'Actions' th, .r.m money cells, is-inactive (D-02), '—' for missing values, 'Walk-in customer' (CustomerCell), optional tfoot"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/ResponsiveTable.test.tsx#ResponsiveTable: populated (App. E.7 / E.12 markup)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ResponsiveTable states: first-load SkeletonTable in an aria-busy LoadingRegion ('Loading users…' then 'Users loaded.'), empty and no-matches copy with Clear Filters, ErrorState with 'Reference: abc123' and Try Again, silent status after a failed load"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/ResponsiveTable.test.tsx#first load / empty / error describes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Keep-previous refetch: no mark at 150 ms, .is-refetching at 250 ms with rows still rendered and focusable, swap in place; useDelayedFlag flips after the delay and resets at once; spec-gaps.css colours td and phone cards --surface-2 with no opacity"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/ResponsiveTable.test.tsx#ResponsiveTable: refetching keeps the old rows"
        status: pass
      - kind: unit
        ref: "web/src/ui/gaps/useDelayedFlag.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#ResponsiveTable refetching: every td and each phone card turn --surface-2, by colour only (D-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pagination: hidden for 0/1 pages, nav 'Pagination', 'Page 2 of 5' with strong numbers, disabled ends, names 'Previous page'/'Next page', focus target, Rows per page 10/20/50/100, phone icon-only CSS"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/Pagination.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#Pagination (two cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "SearchBox, FilterBar, ResultBar, FilterChip: App. E.7 markup, type search + maxLength 100, Enter submits, 'Showing 1 order' / 'Showing 12 orders · sorted by due date', chip 'Status: Active + recent' with 'Clear status filter', four chips pass axe; chips wrap 8px apart with ellipsis labels"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/FilterBar.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#FilterBar chips: the result bar and the chip group wrap 8px apart, and a long chip label ends in an ellipsis"
        status: pass
    human_judgment: false
  - id: D6
    description: "WEB-10 end to end through createListParams: Next = one push page=2 with focus moved; Rows per page 50 from page 3 = one replace ?size=50; chip clear = one replace dropping status and page; typing 'jersey' = one replace after 300 ms; Enter writes at once"
    requirement: WEB-10
    verification:
      - kind: integration
        ref: "web/src/ui/gaps/listState.integration.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "Skeleton family, LoadingRegion, ErrorState, LazyImage complete with axe in every state (SkeletonText/Card/Image sizes, LoadingRegion edges, ErrorState reference rules, LazyImage loading/loaded/error/priority/ratio)"
    requirement: A11Y-01
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/Skeletons.test.tsx, LoadingRegion.test.tsx, ErrorState.test.tsx, LazyImage.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#LazyImage: the reserved box clips a cover image, the skeleton fills it, and the fallback shows no label chip"
        status: pass
    human_judgment: false
  - id: D8
    description: "No horizontal scroll at 320px with four chips, the phone card view and the tablet in-wrapper scroll, Pagination icon-only on phones, and how the new layouts look in Blush and Espresso (PERF-03)"
    requirement: PERF-03
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout. The showcase (plans 14/15) renders these primitives for the Playwright overflow test (4-chip fixture) and the D-23 owner screenshots."

duration: 30min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 13: SPEC-GAP Data and Feedback Primitives Summary

*Created: 2026-10-08T03:52:00-05:00 · Updated: 2026-10-08T03:52:00-05:00*

**Every list screen now has its building blocks under `web/src/ui/gaps/`:**

- **ResponsiveTable** emits the App. E list-table markup and owns the list states: first-load skeletons, the error banner, first-use and no-match empty states, and kept rows marked `.is-refetching` after 200 ms.
- **Pagination, SearchBox and FilterBar** (with ResultBar and FilterChip) follow the WEB-10 push/replace rules through the plan 08 list hook. An integration test proves it.
- **The feedback primitives** are ErrorState, LoadingRegion (aria-busy plus one polite status node), the Skeleton family and LazyImage.

All strings live in `gaps/copy.ts`, the styles in five token-only `spec-gaps.css` blocks. 104 new tests pass, all with zero axe violations.

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-08T08:20:17Z
- **Completed:** 2026-10-08T08:50:00Z
- **Tasks:** 3 of 3
- **Files modified:** 21 (18 created, 3 modified)

## Accomplishments

- **ResponsiveTable (WEB-06, Task 1, tracer).**
  - **Markup:** `.s-rt-wrap > table.s-rt` with a `.csp-sr` caption. Every `td` has a `data-label`: the column header, or `label` when it differs. `lead` gives `td.is-lead`, `money` gives `th.r` and `td.r.m`, and `actions` gives a `.csp-sr` header and `td.r.is-acts`.
  - **Rows and cells:** `isRowInactive` adds `tr.is-inactive` (D-02). An empty render prints "—". `CustomerCell` shows the team over the customer, or the customer over "Walk-in customer".
  - **States:** a first load with no rows shows `SkeletonTable` (4 rows). An error shows `ErrorState` above any rows it still has. No rows shows "No {things} yet" with the caller's one primary action. With filters or search text it shows "No matches", "No users match “Jomar” with role Manager. Try another search or clear the filters." and a secondary "Clear Filters".
  - **Refetch:** `isPlaceholderData` held for 200 ms (`useDelayedFlag`) adds `.is-refetching`. The rows stay, stay focusable and swap in place.
- **LoadingRegion.** It sets `aria-busy="true"` while it loads. One visually hidden `role="status" aria-live="polite"` node says "Loading users…" and then "Users loaded.". After a failed load it says nothing.
- **Pagination (WEB-06, WEB-10).**
  - **Markup:** `nav[aria-label="Pagination"]` with secondary md "Previous" (chevron-left), "Page **2** of **5**" and "Next" (chevron-right). The accessible names are "Previous page" and "Next page". Previous is disabled on page 1 and Next on the last page.
  - **Behaviour:** after a change, focus moves to `focusTargetId`. With `onPageSizeChange` there is a "Rows per page" Select (10/20/50/100). Nothing renders for 0 or 1 pages. On phones the buttons are 44px icon-only.
- **SearchBox, FilterBar, ResultBar, FilterChip (App. E.7).**
  - **SearchBox:** the exact E.7 markup with `type="search"` and `maxLength={100}` (T-02-36). Enter submits. The text is kept as typed.
  - **FilterBar:** `.s-toolbar[role=search]` with an optional `.s-toolbar-end`.
  - **ResultBar:** "Showing **1** order" / "Showing **12** orders · sorted by due date".
  - **FilterChip:** a "Status: Active + recent" chip with a 22px clear button named "Clear status filter". Chips wrap 8px apart and long labels end in an ellipsis.
- **WEB-10 end to end.** Under `withNuqsTestingAdapter` with the app's options:
  - Next is one push to `?page=2`.
  - Rows per page 50 from `?page=3` is one replace to `?size=50`.
  - Clearing the status chip is one replace that drops status and page.
  - Typing "jersey" writes one replace only after 300 ms.
  - Enter writes at once.
- **ErrorState (T-02-37).**
  - **Look:** the App. E.8 banner: `.s-banner.is-danger[role=alert]`, centred, a 20px triangle-alert, a bold and a muted line, and a secondary sm "Try Again".
  - **Copy:** the list-load copy for `things`, or a caller's `title`/`message` from the shared mapper. It shows the traceId reference once and drops an empty second line. Server title and detail never show.
- **Skeleton family.** SkeletonText (3 lines at 100/90/60%, 14px, gap 8), SkeletonCard (App. E.8 verbatim), SkeletonImage (reserved ratio, radius 0) and SkeletonTable are all `aria-hidden`.
- **LazyImage.**
  - **Image:** `loading="lazy" decoding="async"` with width, height and alt, in a box with a reserved `aspect-ratio` (4 / 3 by default) and a cover-fit image. `priority` switches to `loading="eager" fetchpriority="high"`.
  - **Loading:** a full-box radius-0 Skeleton until `load`.
  - **Error:** MediaPlaceholder with the label chip hidden, and the box gets `role="img"` named by the alt text. A decorative image (empty alt) gets no role and is hidden.

## Task Commits

1. **Task 1: Tracer, ResponsiveTable with every state**
   - `10d74a1` test: failing ResponsiveTable and useDelayedFlag tests, the refetching/region CSS tests, list copy, RED placeholders (RED)
   - `76463d6` feat: ResponsiveTable, CustomerCell, useDelayedFlag, LoadingRegion, minimal ErrorState, SkeletonTable, two spec-gaps.css blocks (GREEN)
2. **Task 2: Pagination, SearchBox and FilterBar on the WEB-10 rules**
   - `93baee2` test: failing Pagination, FilterBar/SearchBox and integration tests, the Pagination/FilterBar chips CSS tests, copy, RED placeholders (RED)
   - `b28d5ea` feat: Pagination, SearchBox, FilterBar/ResultBar/FilterChip, two spec-gaps.css blocks (GREEN)
3. **Task 3: Skeleton family, LoadingRegion, ErrorState and LazyImage complete**
   - `9aec5b5` test: failing Skeletons, LoadingRegion, ErrorState and LazyImage tests, the LazyImage CSS test, RED placeholders (RED)
   - `81463df` feat: SkeletonText/Card/Image, LoadingRegion `failed`, ErrorState title/message, LazyImage, the LazyImage block, plus copy-variant and equal-props re-render tests (GREEN)

**Tracer gate (Task 1):** the run is interactive, the mode is `end-of-phase`, and the `<verify>` is automated-only. So `npm --prefix web run test -- --run src/ui/gaps/ResponsiveTable.test.tsx src/ui/gaps/useDelayedFlag.test.tsx` was re-run against the committed code: 24 passed, exit 0. Expansion then continued with no checkpoint.

## TDD Gate Compliance (RED evidence)

| Cycle | RED run | Failing target (assertion) | Checker |
|---|---|---|---|
| T1 ResponsiveTable | `npm --prefix web run test -- --run src/ui/gaps/ResponsiveTable.test.tsx src/ui/gaps/useDelayedFlag.test.tsx src/styles/overrides.test.ts`, exit 1, 24 of 56 failed | The placeholder rendered a bare table: no wrapper, caption, classes, data-label or states. useDelayedFlag always returned false, and the CSS blocks were missing | RED_EVIDENCE_OK (`p13/t1-red.json`) |
| T2 list navigation | `npm --prefix web run test -- --run src/ui/gaps/Pagination.test.tsx src/ui/gaps/FilterBar.test.tsx src/ui/gaps/listState.integration.test.tsx src/styles/overrides.test.ts`, exit 1, 29 of 64 failed | The placeholders had no buttons, no searchbox and no handlers, so no URL update was ever recorded. The CSS blocks were missing | RED_EVIDENCE_OK (`p13/t2-red.json`) |
| T3 feedback | `npm --prefix web run test -- --run src/ui/gaps src/styles/overrides.test.ts`, exit 1, 17 of 214 failed | The LazyImage placeholder was a bare img. The skeletons were single blocks, LoadingRegion said "loaded" after a failure, ErrorState ignored title/message, and the LazyImage block was missing | RED_EVIDENCE_OK (`p13/t3-red.json`) |

Each `test(02-13)` commit comes before its `feat(02-13)` commit. Some T3 ErrorState and LoadingRegion cases passed in RED, and that is expected: Task 1 had already built that behaviour (for example "no Reference without a traceId"). The plan's Task 3 gives those modules their own test files. The equal-props re-render and copy-variant tests added in the T3 GREEN commit are coverage tests for the React Compiler cache paths.

## Files Created/Modified

- `web/src/ui/gaps/ResponsiveTable.tsx` (+ test): `ResponsiveTable`, `CustomerCell`, `ResponsiveColumn`, `ListStatus`.
- `web/src/ui/gaps/useDelayedFlag.ts` (+ test): the 200 ms refetch delay.
- `web/src/ui/gaps/LoadingRegion.tsx` (+ test): aria-busy and the polite status node.
- `web/src/ui/gaps/ErrorState.tsx` (+ test): the App. E.8 banner.
- `web/src/ui/gaps/Skeletons.tsx` (+ test): `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonImage`.
- `web/src/ui/gaps/LazyImage.tsx` (+ test).
- `web/src/ui/gaps/Pagination.tsx` (+ test).
- `web/src/ui/gaps/SearchBox.tsx`, `web/src/ui/gaps/FilterBar.tsx` (+ `FilterBar.test.tsx`, which covers both).
- `web/src/ui/gaps/listState.integration.test.tsx`: the WEB-10 proof.
- `web/src/ui/gaps/copy.ts`: list, error, pagination and filter copy, plus `capitalize` and `nounFor`.
- `web/src/styles/spec-gaps.css`: the SPEC-GAP ResponsiveTable, ResponsiveTable refetching, Pagination, FilterBar chips and LazyImage blocks.
- `web/src/styles/overrides.test.ts`: the "SPEC-GAP data primitives (plan 13)" describe block.

## Decisions Made

See `key-decisions` in the frontmatter. These are SPEC-GAP behaviour and layout details inside the UI-SPEC contract. None of them edits verbatim spec CSS or markup or adds an overrides.css rule. None uses a deferred owner ruling (D-31/D-32, O-1..O-8, the icon swaps, D-BL-03):

- The skeleton shimmer is unchanged, so O-6 was not applied.
- The chip clear button keeps its 22px size, as O-8 is still open.
- The table fixtures avoid `Avatar`, so O-1 was not needed.

The `.s-resultbar` 8px gap and chip wrapping come from the owner's UI-consideration probe ruling (2026-10-07), recorded in 02-UI-SPEC. The Pagination row arrangement, ResultBar at zero and the LazyImage fallback go to the owner in the D-23 showcase screenshots (plans 14/15).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The CSS assertions are in `src/styles/overrides.test.ts`**
- **Found during:** Task 1 (RED)
- **Issue:** Vitest stubs CSS imports, so component tests cannot read spec-gaps.css (as in plan 12).
- **Fix:** Six new cases in the node-typed stylesheet test assert each rule inside its own `/* SPEC-GAP: <name> */` block. That file is not in the plan's `files_modified` list.
- **Committed in:** 10d74a1, 93baee2, 9aec5b5

**2. [Rule 2 - Missing critical] LoadingRegion's status node is outside the busy region, and it stays silent after a failure**
- **Found during:** Task 1 / Task 3
- **Issue:** Assistive tech may hold back live updates inside an `aria-busy="true"` subtree, so "Loading users…" might never be heard. After a failed load, "Users loaded." would also be false.
- **Fix:** The status node is a sibling of the busy region. A `failed` prop, which ResponsiveTable sets for `status: 'error'`, leaves it empty, and the alert announces the failure.
- **Committed in:** 76463d6, 81463df

**3. [Rule 1 - Bug] SearchBox keeps the typed text**
- **Found during:** Task 2
- **Issue:** The list hook stores the trimmed search, so a box bound straight to it would remove the space after "red" as it was typed.
- **Fix:** A local draft that takes an outside value (chip clear, Back) only when it differs once trimmed. Tests cover typing "red jersey" and an external reset.
- **Committed in:** b28d5ea

**4. [Rule 3 - Blocking] The integration test does not use user-event on fake timers**
- **Found during:** Task 2 (GREEN)
- **Issue:** user-event 14 never resolves its internal waits under vitest fake timers, even with `delay: null`, so every case timed out. axe also hangs on fake timers (Task 1).
- **Fix:** The debounce and Enter cases use fake timers and fire one input event per character. The push and replace cases use real timers with user-event and wait for the update. axe always runs on real timers.
- **Committed in:** b28d5ea, 76463d6

**5. [Plan wording] Prop and API adjustments**
- **ResponsiveTable:** it takes no `thing` prop, because the empty copy only needs the plural. It adds `captionId` (the Pagination focus target), `filterSummary`, `emptyIcon` and `emptyMessage`, and exports `CustomerCell` for the "Walk-in customer" rule.
- **ErrorState:** its props are a union: `things`, or `title`/`message`. This covers the plan 10 note that a 400 with field errors has an empty body.
- **ResultBar:** at zero it keeps any chips.
- **Committed in:** 76463d6, b28d5ea, 81463df

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 missing critical, 1 bug), plus 1 plan-wording adjustment.
**Impact on plan:** No new package, no verbatim CSS or spec file edited, no overrides.css change, and no owner ruling assumed.

## Issues Encountered

- The React Compiler memo branches pulled ui/gaps branch coverage down to 90.04% at first. Equal-props re-render tests and the copy-variant cases raised it to 96.73%.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Showcase (plans 14/15):** it can render every primitive with the spec section 12 seed: ResponsiveTable with an inactive row, a long-name row, loading, error, empty and no-matches; Pagination; FilterBar with four chips for the Playwright overflow test; the Skeleton family; ErrorState; LazyImage loaded, loading and error.
- **Feature lists:** the recipe is `createListParams` → `useListQuery` → `<ResponsiveTable status isPlaceholderData …>`, `<Pagination onPageChange={set.setPage} focusTargetId={captionId} …>`, `<SearchBox onChange={set.setSearch} onSubmit={(v) => set.setSearch(v, { immediate: true })}>` and `<FilterChip onClear={() => set.setFilter(key, null)}>`.
- **Still blocked:** 02-11 and its dependents wait on D-BL-03 (the owner rulings). This plan used none of them.
- **License gate:** it still exits 1 on exactly the 5 D-BL-01 dev-tree packages. There are no new failures, and no exceptions were added.

## Verification

- `npm --prefix web run test -- --run src/ui/gaps`: 13 files, 192 passed, exit 0 (plan verification; with `src/styles/overrides.test.ts`: 14 files, 214 passed).
- Per-task verifies: Task 1 24 passed, Task 2 64 passed (with the CSS file), Task 3 as above.
- `npm --prefix web run verify`: exit 0.
  - Typecheck, lint (0 warnings), Prettier and the build (no warnings) are clean.
  - Tests: 47 files, 1242 tests.
  - Coverage: 97.77% statements, 95.42% branches, 100% functions and 99.81% lines. ui/gaps is at 96.73% branches. lib/http, lib/url-state, lib/query and lib/forms are still at 100%.
- Acceptance checks:
  - `td:not([data-label])` is asserted at 0.
  - `grep -c "flex-wrap: wrap" web/src/styles/spec-gaps.css` = 2.
  - The overrides opacity scan passes.
- `npm --prefix web run e2e -- --grep "@smoke|@fixture"` (after preflight): 25 passed.
- `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`: 839/839 passed, 0 warnings.
- `node web/scripts/license-gate.mjs`: exit 1 on exactly the 5 known D-BL-01 packages (expected).
- No dev server or background process is left running. The final preflight shows the ports free and no processes.

## Self-Check: PASSED

- All 18 created files and 3 modified files exist on disk.
- Commits 10d74a1, 76463d6, 93baee2, b28d5ea, 9aec5b5 and 81463df exist, and `git rev-list --count a6f64f2..81463df` = 6.
- No stubs remain: `grep -rn "RED placeholder\|TODO\|FIXME" web/src/ui/gaps web/src/styles/spec-gaps.css` finds nothing.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*
