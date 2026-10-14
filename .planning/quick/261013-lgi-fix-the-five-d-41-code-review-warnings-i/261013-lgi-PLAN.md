---
created: 2026-10-13T15:33:42-05:00
updated: 2026-10-13T15:33:42-05:00
phase: quick-261013-lgi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/ui/navigation/Topbar.tsx
  - web/src/ui/navigation/Topbar.test.tsx
  - web/src/ui/entry/MoneyInput.tsx
  - web/src/ui/entry/MoneyInput.test.tsx
  - web/src/ui/overlays/fixedLayerGuard.ts
  - web/src/ui/overlays/fixedLayerGuard.test.tsx
  - web/src/ui/overlays/Modal.tsx
  - web/src/ui/lists/ResponsiveTable.tsx
  - .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-d41.md
  - .planning/phases/02-web-foundation-design-system/deferred-items.md
autonomous: true
requirements:
  - A11Y-01
  - A11Y-02
  - ORD-09
  - WEB-06

estimate:
  tokens: 140000
  raw_tokens: 140000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "WR-01 (D-41 R2-04 kept): on a non-Apple user agent, Ctrl+K pressed inside text entry (a text-type input, a textarea, editable content, or a textbox/searchbox/combobox/spinbutton role) focuses the Topbar search and calls preventDefault, so the browser never gets it. On an Apple agent Cmd+K does the same, and Ctrl+K inside text entry is left to the field (Cocoa kill-line). Outside text entry, including on a select, checkbox or other non-text input, both Ctrl+K and Cmd+K still work on every platform. The modal, IME, already-handled, Alt and Shift guards are unchanged, and so are the hint text and aria-keyshortcuts"
    - "WR-01: pressing the platform's primary combo while the Topbar search box itself has focus keeps focus there, selects its text and takes the key"
    - "WR-02 (D-41 R2-18 kept): the refused-paste hint is tied to the value it refused. An accepted keystroke, an accepted paste, or any value set by the caller (a reset, a 'Pay full balance' fill) clears aria-invalid, the hint and the status text. A later return to the old refused value does not bring the hint back. The blur padding of the refused value ('7' -> '7.00') keeps the hint, as the existing test pins"
    - "WR-03: error=\"\" counts as no error, as it does in Field. A refused paste then still shows the hint with aria-invalid and announces it. When a caller's non-empty error is on screen, the role=status node announces nothing, so it never says something that is not shown"
    - "WR-04: a readOnly or disabled MoneyInput ignores a paste: the default is not prevented, onChange is not called and nothing becomes aria-invalid"
    - "WR-05 (D-41 R2-02 contain: paint kept): rendering an open Modal or ConfirmDialog (directly or in an Overlay) inside a ResponsiveTable frame throws a plain-English error that names WR-05 and the fix. A dialog whose open state lives on the page and is opened by a row button renders outside the frame (its scrim is not a descendant of the frame), traps focus and has no axe violations. Overlays still render in place inside the page root with no portal (CSPS-UI-SPEC.md §2.7, D-33), so no parity scenario changes"
    - "`npm --prefix web run verify` exits 0 with zero warnings. Coverage thresholds and bundle budgets hold without raising any limit"
    - "02-REVIEW-FIX-d41.md records WR-01 to WR-05 as fixed, with commits and verification numbers. deferred-items.md has the WR-05 owner FYI"
  artifacts:
    - path: "web/src/ui/overlays/fixedLayerGuard.ts"
      provides: "PaintContainmentContext (default false) and useFixedLayerGuard(component), which throws the WR-05 error when it is rendered inside a paint-contained frame"
      contains: "WR-05"
    - path: "web/src/ui/overlays/fixedLayerGuard.test.tsx"
      provides: "The guard proofs: in-cell Modal, ConfirmDialog and Overlay+Modal throw, and the page-level dialog opened from a row renders outside the frame, traps focus and is axe clean"
    - path: ".planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-d41.md"
      provides: "Fix report for WR-01..WR-05, in the format of the 02-REVIEW-FIX-*.md files"
      contains: "status: all_fixed"
  key_links:
    - from: "web/src/ui/lists/ResponsiveTable.tsx (the tableWrapClasses frame)"
      to: "web/src/ui/overlays/Modal.tsx OpenModal"
      via: "the frame provides PaintContainmentContext=true, and OpenModal calls useFixedLayerGuard('Modal') first, so ConfirmDialog and an Overlay's inline Modal are covered too"
      pattern: "useFixedLayerGuard"
    - from: "web/src/ui/entry/MoneyInput.tsx refusedAt"
      to: "Field error / aria-invalid and the role=status node"
      via: "refused = refusedAt matches value (or its blur padding); a caller error counts only when non-empty"
      pattern: "refusedAt"
    - from: "web/src/ui/navigation/Topbar.tsx isSearchShortcut"
      to: "APPLE_AGENT and navigator.userAgent"
      via: "inside text entry only the primary combo for the platform is taken"
      pattern: "APPLE_AGENT"
---

<objective>
Fix the five warnings WR-01 to WR-05 from `.planning/phases/02-web-foundation-design-system/02-REVIEW-d41.md`, the code review of quick tasks 261013-g6s and 261013-ihp. Keep every D-41 ruled behavior intact: Ctrl/Cmd+K replaces "/" (R2-04), `contain: paint` stays on the list-table frame (R2-02), and a refused money paste shows the amount hint (R2-18). Record the fixes in `02-REVIEW-FIX-d41.md`. The Info items IN-01 to IN-06 are out of scope and stay untouched.

Purpose: these warnings break the user-facing behavior the D-41 rulings promised:
- the advertised shortcut throws focus to the browser from inside a field;
- a correct amount can stay marked invalid;
- a screen reader can hear a hint that is not on screen;
- a read-only amount can be changed by a paste;
- a dialog opened from a table row would be trapped inside the contained frame.

Output: three TDD tasks: (1) WR-01 Topbar, (2) WR-02, WR-03 and WR-04 in MoneyInput, (3) the WR-05 guard plus the fix report and the full verification.

Tracer-first is waived on purpose, as in quick-261013-g6s. This is a quick task over a proven architecture, and each task is one self-contained vertical change (component, test, proof), so a thin slice would add no information.

WR-05 decision, made at planning time with the evidence: the brief's preferred fix, a react-dom portal to `document.body`, is NOT taken. It would break the D-08 approved look, which is the brief's own fallback trigger:
- CSPS-UI-SPEC.md §2.7 (binding, frozen) says anything in a portal must sit inside `[data-theme]` and `.s-page`. Espresso comes from `.s-page[data-theme]`, and the overlay region's phone-sheet layout uses the `pg` container (`pg-phone:` variants in `overlayRegionClasses`, web/src/ui/overlays/overlays.recipe.ts).
- 02-RESEARCH.md lists the body portal as an anti-pattern, and 02-UI-SPEC.md says "never a portal to <body>".
- Plan 02-22 pinned zero portals in Modal.tsx.
- A body portal would therefore render admin dark-mode dialogs in Blush and drop the phone sheet, which breaks the overlays parity group.

So Task 3 implements the review's second option, a guard. It is a runtime invariant with tests, not a static scan, so any future in-cell dialog fails its first component test. This plan does not use `position: relative` (it needs an owner ruling) or `<dialog>.showModal()` (it changes the frozen App. D.3 markup).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@.planning/phases/02-web-foundation-design-system/02-REVIEW-d41.md
@.planning/phases/02-web-foundation-design-system/02-CONTEXT.md

Binding rules for every task (from CLAUDE.md, .claude/CLAUDE.md and the user's memory):
- **TDD.**
  - Write the failing test first, run it and see it fail, then commit RED (`test(quick-261013-lgi): …`).
  - Implement, see it pass, then commit GREEN (`fix(quick-261013-lgi): …`). Refactor only on green.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Zero warnings everywhere:** lint (`--max-warnings 0`), typecheck, tests, axe and the console. The Vitest console guard (web/src/test/consoleGuard.ts) fails any test that writes console.error or console.warn. Tests that provoke a React render error must drain it with `collectConsole()`, as web/src/app/ErrorBoundary.test.tsx does (`expectOnlyReportsOf`).
- **Do not undo any D-41 ruling** (02-CONTEXT.md D-41):
  - R2-04: Ctrl/Cmd+K, a bare "/" does nothing, the "Ctrl K" or "⌘K" hint, and `aria-keyshortcuts="Control+K Meta+K"`.
  - R2-02: `contain-paint pg-phone:contain-none` on `tableWrapClasses` in web/src/ui/lists/lists.recipe.ts.
  - R2-18: the refused-paste hint, which is fixed copy and never echoes the pasted text.
- **Frozen sources:** never edit `CSPS-UI-SPEC.md` or anything under `web/visual/.reference-src/`. Never commit `.planning/design/` or `_local/`.
- **Preflight:** before the full `verify` run or any Playwright run, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:/Work/dev-tools/preflight.ps1 -Ports 5180,5115,7028,5199`. If a port is in use by another project, or TheBETSLLC test processes are listed, WAIT and retry. Never kill another project's process. Never set machine-level or user-level environment variables.
- **No new packages and no npx downloads.** Use only the project's npm scripts.
- **No DOM or CSS change in any parity scenario.** These fixes change behavior and attributes in states the parity suite does not render: shortcut presses, refused pastes, and dialogs in table cells. Parity is therefore not re-run. If a change does alter the markup at rest, stop and report it.
- **Markdown timestamps:** every .md you create or edit keeps its own timestamp format (YAML `created:`/`updated:`). Bump `updated` to the real edit time with the America/Chicago offset. Take it from PowerShell `Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"`, because Git Bash `date` reports UTC here.
- **Deviation records:** code-level deviations are inline `SPEC-DEVIATION:` comments, as the existing code does.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: WR-01, Topbar Ctrl/Cmd+K inside text entry takes the platform's primary combo and selects the search text</name>
  <files>web/src/ui/navigation/Topbar.tsx, web/src/ui/navigation/Topbar.test.tsx</files>
  <read_first>
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-d41.md, section "WR-01"
    - web/src/ui/navigation/Topbar.tsx: the header comment (lines 4-13), FIELD_TAGS, TEXT_ENTRY, APPLE_AGENT, isKeyK, isSearchShortcut (lines 35-72) and the keydown effect (lines 109-120)
    - web/src/ui/navigation/Topbar.test.tsx:
      - the Windows and Macintosh user-agent strings and the `vi.spyOn(navigator, 'userAgent', 'get')` pattern (lines 92-111);
      - the "Topbar search keys" describe block with its `press` helper (lines 200-321)
  </read_first>
  <behavior>
    Every test sets the agent explicitly with `vi.spyOn(navigator, 'userAgent', 'get')`, using the existing Windows and Macintosh strings hoisted to shared constants, and restores the spy.
    - Windows agent, Ctrl+K pressed inside a text input, a textarea, editable content, and an element inside each of the textbox/searchbox/combobox/spinbutton roles: activeElement becomes the search box and `defaultPrevented` is true. This is RED today.
    - Mac agent, Cmd+K inside the same targets: the search box gets focus and the key is taken. RED today.
    - Mac agent, Ctrl+K inside the same text-entry targets: left alone, focus stays on the field and `defaultPrevented` is false. This is the Cocoa kill-line case.
    - Windows agent, Meta+K inside a text input: left alone. Inside text entry only the primary combo is taken.
    - Mac agent, Ctrl+K on a select and on a checkbox input: the search box gets focus and the key is taken. These are not text entry, so they have no kill-line to protect. RED today.
    - Search box itself:
      - Windows Ctrl+K, after typing "jersey" into it: focus stays on the search box, selectionStart is 0, selectionEnd is 6 and `defaultPrevented` is true;
      - Mac Cmd+K: the same;
      - Mac Ctrl+K: left alone.
      - RED today.
    - These tests stay as they are and stay green:
      - the outside-a-field tests (both modifiers on every platform, D-41 R2-04);
      - "leaves %s alone" (bare "/", Alt, Shift, Ctrl+Cmd, IME, Dvorak, Ctrl+J);
      - the already-handled, modal-open, unmount and Enter→onSearch tests.
  </behavior>
  <action>
    **RED first.** In web/src/ui/navigation/Topbar.test.tsx, replace the three field-guard tests with the cases in `<behavior>`:
    - "leaves Ctrl+K alone inside a %s" (input/textarea/select);
    - "leaves Ctrl+K alone inside editable content";
    - "leaves Ctrl+K alone inside a role=\"%s\" widget".

    Hoist the existing Windows and Macintosh user-agent strings into named constants and reuse them in the hint tests. Restore every spy, with `mockRestore` as the file already does. Rewrite the describe comment (lines 201-202) and the file header (lines 25-29) to say that inside text entry only the platform's primary combo is taken. Run the file, see the RED cases fail, and commit RED.

    **GREEN in web/src/ui/navigation/Topbar.tsx (per WR-01, keeping D-41 R2-04):**
    - **Narrow the field test to text entry.** Replace FIELD_TAGS with a text-entry check that covers:
      - TEXTAREA;
      - an INPUT whose `type` is text, search, email, url, tel, password or number;
      - `isContentEditable`;
      - `closest(TEXT_ENTRY)`.

      A SELECT, a checkbox and any other non-text input now count as outside text entry.
    - **isSearchShortcut.** Keep every existing guard in order: the K key, exactly one of Ctrl/Meta, no Alt or Shift, not composing, not already handled, no `[aria-modal="true"]` open. Then:
      - outside text entry, return true for both combos, as before;
      - inside text entry, return true only for the platform's primary combo: `metaKey` when `APPLE_AGENT.test(navigator.userAgent)`, otherwise `ctrlKey`. The first guard already ensures that exactly one of them is held.

      Name the reason in a comment: a modifier shortcut types nothing, so the old "inside a field" guard (written for the bare "/") only handed the key to the browser's own Ctrl/Cmd+K (address-bar search). Mac Ctrl+K is the text field's Cocoa "kill to end of line".
    - **Handler.** Keep `event.preventDefault()`, then focus the search input. When `event.target` is the search input itself, also call `select()` on it, so a repeat press keeps focus and selects the text to retype.
    - **Header comment (lines 4-13).** Update the D-41 R2-04 SPEC-DEVIATION paragraph to describe the text-entry rule, and cite "code review WR-01 (02-REVIEW-d41.md)". The hint, `aria-keyshortcuts` and the markup stay unchanged: no visible change, D-08.

    Run the file (GREEN), then lint and typecheck. Commit GREEN.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/ui/navigation/Topbar.test.tsx</automated>
    <automated>npm --prefix web run lint</automated>
    <automated>npm --prefix web run typecheck</automated>
  </verify>
  <done>
    - The RED commit shows the new in-field, select/checkbox and search-box cases failing.
    - The GREEN commit passes every Topbar test, including the unchanged R2-04 outside-field, guard, modal and Enter tests.
    - Lint and typecheck are clean.
    - The hint and `aria-keyshortcuts` are unchanged.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: WR-02, WR-03 and WR-04, MoneyInput refusal tied to the refused value, empty error counts as none, read-only paste ignored</name>
  <files>web/src/ui/entry/MoneyInput.tsx, web/src/ui/entry/MoneyInput.test.tsx</files>
  <read_first>
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-d41.md, sections "WR-02", "WR-03" and "WR-04"
    - web/src/ui/entry/MoneyInput.tsx, the whole file (140 lines): the header comment (lines 7-11), `refused` state, change, paste, blur, `pasteHint`/`shownError` and the always-mounted role=status span
    - web/src/ui/forms/Field.tsx, lines 39-81: `invalid = Boolean(error)`, so an empty string is no error
    - web/src/lib/format.ts `padMoneyOnBlur` (line 105)
    - web/src/ui/entry/MoneyInput.test.tsx: the Harness (lines 16-39) and the "MoneyInput refused paste (D-41 R2-18)" block (lines 215-327), including its `status()` and `message()` helpers
  </read_first>
  <behavior>
    **WR-02.** Use a test-local harness that owns the value and renders three plain buttons next to the MoneyInput: "Pay full balance" (sets "4327.50"), "Reset" (sets "") and "Restore 7" (sets "7").
    - Paste "abc" into "7", then click "Pay full balance": the value is "4327.50", there is no aria-invalid, the message is the caller's hint (or nothing when there is no hint), and the status node is empty. RED today.
    - Paste "abc" into "7", then click "Reset", then "Restore 7": no aria-invalid and an empty status node after each click. RED today.
    - The existing test "clears the hint on the next accepted keystroke, and keeps it through a refused one and the blur" stays unchanged and green. The `7` → `7.00` blur padding keeps the hint.

    **WR-03.**
    - `error=""` with a refused paste: aria-invalid="true", the message is ENTRY_COPY.money.invalid, and the status node has the same text. RED today.
    - `error=""` with no refusal: no aria-invalid, and the caller's `hint` shows.
    - Extend the existing test "shows the caller's error instead of the paste hint": the status node is also empty. RED today, because it announces the hidden hint.

    **WR-04.**
    - A `readOnly` Harness with initial "7": a user paste of "₱4,327.50" and then of "abc" leaves the value "7". onValue is never called, there is no aria-invalid, and the status node is empty. RED today, because the accepted paste changes the value.
    - `readOnly` and `disabled` boxes, each with `fireEvent.paste(box, { clipboardData: { getData: () => '₱4,327.50' } })`: it returns true (the default is not prevented) and the value is unchanged. RED today.

    All the existing paste, keystroke, blur, error, axe and scenario tests stay green. That includes the pasted text never appearing in the document (T-261013-01).
  </behavior>
  <action>
    **RED first.** Add the `<behavior>` tests to web/src/ui/entry/MoneyInput.test.tsx, inside the "refused paste" block or in a new "MoneyInput paste on a read-only box (WR-04)" block. Update the block comment (lines 215-217) to say that the hint is tied to the refused value and that an empty `error` counts as none. Run the file, see the RED cases fail, and commit RED.

    **GREEN in web/src/ui/entry/MoneyInput.tsx:**
    - **WR-02.**
      - Replace the boolean `refused` state with `refusedAt: string | null`, the box value at the moment a paste was refused. The refusal stands while `value` equals `refusedAt` or equals `padMoneyOnBlur(refusedAt)`.
      - Keep the hint through blur padding, on purpose. The padding is the component's own rewrite of the same amount, not a new value. The R2-18 behavior implemented in quick-261013-g6s clears the hint only on the next accepted keystroke or paste, and the existing test pins this.
      - When `refusedAt` is set and `value` matches neither, clear it during render with React's "adjust state when a prop changes" pattern: a conditional `setRefusedAt(null)` in the component body. react-hooks 7's set-state-in-render rule only rejects unconditional calls. This way a later return to the old value cannot bring the hint back. Do not use an effect, which set-state-in-effect rejects, and do not read a ref during render.
      - A refused paste calls `setRefusedAt(value)`. An accepted keystroke or paste calls `setRefusedAt(null)`.
    - **WR-04.** The paste handler's first statement returns early when `event.currentTarget.readOnly` or `event.currentTarget.disabled` is true, before `preventDefault()`. The browser's own default does nothing there, the caller's value is never changed, and nothing is marked invalid.
    - **WR-03.**
      - Derive the caller error as `error` only when it is a non-empty string, matching Field's `Boolean(error)`. The shown error is that caller error, else the paste hint.
      - The role=status span announces the paste hint only when no caller error is shown, so the live region always matches what is on screen. Keep the span always mounted (WCAG 4.1.3).
    - **Comments.**
      - Update the header comment (lines 7-11, the D-41 R2-18 SPEC-DEVIATION): the hint is tied to the refused value, so any later value (typed, pasted, or set by the caller through a reset or auto-fill) clears it; the blur padding of that same value keeps it; an empty `error` counts as no error, as in Field; a read-only or disabled box ignores pastes. Cite code review WR-02, WR-03 and WR-04 (02-REVIEW-d41.md).
      - Update the state comment at line 82.
      - The hint stays the fixed ENTRY_COPY.money.invalid copy and never echoes pasted text.

    Run the file (GREEN), then lint and typecheck. Commit GREEN.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/ui/entry/MoneyInput.test.tsx</automated>
    <automated>npm --prefix web run lint</automated>
    <automated>npm --prefix web run typecheck</automated>
  </verify>
  <done>
    - The RED commit shows the new WR-02, WR-03 and WR-04 cases failing.
    - The GREEN commit passes every MoneyInput test, including the unchanged R2-18 blur test, the axe tests and the entry scenarios.
    - No effect and no ref read was added for the refusal.
    - Lint (react-hooks rules included) and typecheck are clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: WR-05, overlays refuse to render inside the paint-contained ResponsiveTable frame; fix report and full verification</name>
  <files>web/src/ui/overlays/fixedLayerGuard.ts, web/src/ui/overlays/fixedLayerGuard.test.tsx, web/src/ui/overlays/Modal.tsx, web/src/ui/lists/ResponsiveTable.tsx, .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-d41.md, .planning/phases/02-web-foundation-design-system/deferred-items.md</files>
  <read_first>
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-d41.md, section "WR-05"
    - web/src/ui/lists/lists.recipe.ts, lines 18-31: `tableWrapClasses` and its D-41 R2-02 note. Only this frame has paint containment. DataTable uses the separate `tableWrapClasses` in web/src/ui/data/data.recipe.ts, which has no containment, and SkeletonTable renders no caller content, so neither needs the guard.
    - web/src/ui/lists/ResponsiveTable.tsx: the props (line 47) and the frame div with its `<table>` (lines 194-215)
    - web/src/ui/lists/ResponsiveTable.test.tsx, for a minimal columns/rows/rowKey/caption fixture to copy
    - web/src/ui/overlays/Modal.tsx (OpenModal) and web/src/ui/overlays/ConfirmDialog.tsx. ConfirmDialog renders Modal, and an inline Modal sits in an Overlay.
    - web/src/ui/feedback/ToastProvider.tsx, lines 19-41: the house pattern of `createContext` plus `use(Context)`
    - web/src/app/ErrorBoundary.test.tsx, lines 52-58: `expectOnlyReportsOf` with `collectConsole()`
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-webui.md, the format to follow for the fix report
    - .planning/phases/02-web-foundation-design-system/deferred-items.md, the "## Owner decisions pending" entry format (title line, `status: open`, **What**, **Before / after…**, **Question for the owner**)
  </read_first>
  <behavior>
    In web/src/ui/overlays/fixedLayerGuard.test.tsx:
    - A ResponsiveTable whose column `cell` renders an open `<ConfirmDialog …/>` makes the render throw an Error. Its message names the ResponsiveTable frame, says that its paint containment (D-41 R2-02) traps position: fixed, gives the fix (keep the dialog's open state on the page and render the dialog outside the table) and cites WR-05. React's console reports are only about that error (drain them with `collectConsole()`). RED today.
    - The same happens for a cell that renders `<Modal title=… />`, and for one that renders an Overlay holding an inline Modal. RED today.
    - A cell that holds only a trigger button and a closed `<Modal open={false} …/>` renders without error, because a closed Modal mounts nothing.
    - The supported pattern: a test page keeps `open` state, and a row cell's "Delete ORD-2026-0148" button sets it. The ConfirmDialog renders after the ResponsiveTable. After the click, the dialog exists, and neither the dialog nor its scrim (`dialog.parentElement`) is contained by the frame (`screen.getByRole('region', { name: caption })`). Focus is on Cancel. Axe has no violations on the container.

    If React 19 under RTL reports the render error instead of rethrowing it from `render`, assert through a minimal test error boundary that catches the error, and check the caught message instead. In both cases drain and check the console reports.

    The existing Modal, ConfirmDialog, useFocusTrap, ResponsiveTable and list-scenario tests stay green, because nothing renders an overlay inside a table frame today.
  </behavior>
  <action>
    **RED first.** Write web/src/ui/overlays/fixedLayerGuard.test.tsx as in `<behavior>`, importing `PaintContainmentContext` and `useFixedLayerGuard` from `./fixedLayerGuard`. Create the module with stub exports only, so the file compiles and the throw cases fail. Run the file, see RED, and commit RED.

    **GREEN (per WR-05; keeps D-41 R2-02 `contain: paint` and the D-33 / spec §2.7 in-page-root overlays):**
    - **web/src/ui/overlays/fixedLayerGuard.ts (new).**
      - Exports `PaintContainmentContext`, a `createContext<boolean>(false)`.
      - Exports `useFixedLayerGuard(component: string): void`. It reads the context with `use(...)`, following ToastProvider's convention, and throws `new Error(...)` when the value is true.
      - The message is plain English, for example: "{component} cannot render inside a ResponsiveTable frame: the frame's paint containment (D-41 R2-02) traps position: fixed, so the scrim would cover only the table and the dialog would scroll with the rows. Keep the dialog's open state on the page and render the dialog outside the table (code review WR-05)."
      - The file header explains why this is a runtime invariant and not a portal:
        - spec §2.7 needs `[data-theme]` and the `.s-page` `pg` container;
        - a body portal would drop the Espresso theme and the `pg-phone:` sheet layout and break the D-08 look;
        - `position: relative` needs an owner ruling.
      - Do NOT export it from web/src/ui/overlays/index.ts or `@/ui`. web/src/ui/index.test.ts pins those export lists, and this is an internal contract between lists and overlays.
    - **web/src/ui/overlays/Modal.tsx.** Make `useFixedLayerGuard('Modal')` the first statement of OpenModal, before useFocusTrap and useBodyScrollLock, so it throws before any focus or scroll side effect. This covers ConfirmDialog and an Overlay's inline Modal. Extend the line-15 comment: the Modal renders in place inside the page root, never in a portal, and never inside a ResponsiveTable frame (WR-05, see fixedLayerGuard.ts).
    - **web/src/ui/lists/ResponsiveTable.tsx.** Inside the `tableWrapClasses` frame div, wrap the `<table>` in `<PaintContainmentContext value>`, importing from `@/ui/overlays/fixedLayerGuard`. This adds no DOM. Add a comment: the frame's D-41 R2-02 paint containment makes it the containing block of position: fixed descendants, so a dialog in a cell would be trapped and clipped; the context makes Modal and ConfirmDialog refuse to render here (WR-05).
    - Do not change any class list, recipe, scenario, rulings.css or reference file. The overlays keep rendering in place, and the react-dom portal API stays unused.

    Run the targeted tests (GREEN) and commit GREEN.

    **Docs**, as a `docs(quick-261013-lgi): …` commit after the verification below:
    - **Create .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-d41.md** in the format of 02-REVIEW-FIX-webui.md.
      - Front matter: phase 02-web-foundation-design-system, lane d41, created/updated/fixed_at (real Chicago time), review_path pointing to 02-REVIEW-d41.md, iteration 1, findings_in_scope 5, fixed 5, skipped 0, status all_fixed.
      - Then: the title, the Fixed at / Source review / Iteration / Scope lines (WR-01..WR-05 only; IN-01..IN-06 not touched), a Summary, and "How the fixes were made" (test-first RED → GREEN, one commit pair per task).
      - "Verification": the real numbers from the runs below (test files and test count, the coverage percentages, the budget figures, the e2e results).
      - "Fixed Issues": one section per WR with Files modified, Commit, Status and Applied fix. WR-01 and WR-02 also carry "requires human verification (keyboard/screen reader in a real browser)", as the webui report does for focus logic. In WR-02, record the blur-padding decision. In WR-05, record why the portal was not taken, with the evidence from this plan's objective.
      - "Owner items added to deferred-items.md": the WR-05 FYI.
      - The `_Fixed:` / `_Fixer:` footer.
    - **Add an entry to deferred-items.md** under "## Owner decisions pending", following the existing format. Title: "A confirm or edit dialog cannot be opened from inside a list-table cell (code review WR-05, FYI, not blocking)", with `status: open`.
      - **What:** the paint containment ruled in D-41 R2-02 traps fixed overlays, so a guard now makes a dialog in a ResponsiveTable cell fail loudly. Row actions keep the dialog's state on the page instead, which works today.
      - **Question for the owner:** keep this rule, or allow in-cell dialogs through either (a) a portal into the layout's `.s-page` (spec §2.7 allows it, and it keeps the theme and the phone layout), or (b) `position: relative` on the table frame instead of paint containment (a D-08 ruling; the frozen reference would get the same rule)?
      - Bump the file's `updated:`.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/ui/overlays src/ui/lists src/ui/index.test.ts</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:/Work/dev-tools/preflight.ps1 -Ports 5180,5115,7028,5199</automated>
    <automated>npm --prefix web run verify</automated>
    <automated>npm --prefix web run e2e -- keyboard.spec admin-keyboard.spec showcase.spec</automated>
  </verify>
  <done>
    - The RED commit shows the guard throw cases failing. The GREEN commit passes them, along with the page-level dialog case, the existing overlays tests and the existing lists tests.
    - Preflight showed the ports free before `verify` and before the e2e run.
    - `npm --prefix web run verify` exits 0: typecheck, lint, format, test:coverage with thresholds held, build, build:budget with no limit raised, license and notices.
    - The keyboard, admin-keyboard and showcase e2e specs pass in every project. A known WebKit timing flake that passes when re-run alone is reported, not tolerated.
    - 02-REVIEW-FIX-d41.md and the deferred-items.md entry are committed with real Chicago timestamps.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| clipboard → MoneyInput | Pasted text is untrusted input that can reach a money value |
| keyboard → Topbar window listener | Global key events decide where focus goes |
| caller code → ResponsiveTable cells | Any cell content, including dialogs, renders inside the paint-contained frame |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261013-lgi-01 | Tampering | MoneyInput paste on a readOnly or disabled box (WR-04) | medium | mitigate | The paste handler returns before `preventDefault()` and `onChange` when `readOnly` or `disabled`, so a locked or paid amount cannot be changed by a paste. Pinned by the readOnly user-event test and the readOnly/disabled `fireEvent.paste` tests (Task 2) |
| T-261013-lgi-02 | Tampering (UI state integrity) | MoneyInput refusal flag (WR-02, WR-03) | low | mitigate | The refusal is tied to the refused value, so a correct or reset amount is never left `aria-invalid`, and a submit handler that focuses the first invalid field cannot land on it. The live region announces only what is shown. Tests in Task 2 |
| T-261013-lgi-03 | Information disclosure | MoneyInput hint and live region | low | mitigate | The hint stays the fixed ENTRY_COPY.money.invalid copy and never echoes the pasted text (the existing test asserts that `document.body.textContent` does not contain the pasted text) |
| T-261013-lgi-04 | Spoofing (UI redress) | Dialog trapped in the contained table frame (WR-05) | medium | mitigate | A destructive ConfirmDialog clipped inside the frame, with the rest of the page clickable, invites the wrong action. useFixedLayerGuard throws whenever an open Modal or ConfirmDialog renders inside the ResponsiveTable frame. Tests in Task 3 |
| T-261013-lgi-05 | Elevation of privilege (focus escape) | Topbar Ctrl/Cmd+K inside fields (WR-01) | low | mitigate | The primary combo is always taken with `preventDefault`, so focus never leaves the page for the browser UI. The modal-open guard is unchanged, so focus never leaves an open dialog. Tests in Task 1 |
| T-261013-lgi-SC | Tampering | npm/pip/cargo installs | high | accept | No package is installed or upgraded (no install tasks, so the legitimacy gate is not triggered). If an install turns out to be necessary, stop and report it |
</threat_model>

<verification>
- `npm --prefix web run test -- --run src/ui/navigation/Topbar.test.tsx src/ui/entry/MoneyInput.test.tsx src/ui/overlays src/ui/lists` passes.
- After preflight, `npm --prefix web run verify` exits 0 with zero warnings, coverage thresholds held and budgets within limits.
- After preflight, `npm --prefix web run e2e -- keyboard.spec admin-keyboard.spec showcase.spec` passes.
- `git diff` on web/src/ui/lists/lists.recipe.ts, web/src/ui/overlays/overlays.recipe.ts, web/visual and web/src/dev is empty. No look, rulings or scenario changed, so parity does not need a re-run.
- `grep -c "createPortal(" web/src/ui/overlays/Modal.tsx web/src/ui/overlays/Overlay.tsx web/src/ui/overlays/ConfirmDialog.tsx` reports 0 for each file. The spec §2.7 and D-33 in-page-root rule holds.
</verification>

<success_criteria>
- WR-01 to WR-05 are each fixed test-first, with RED and GREEN commits.
- The D-41 rulings R2-02, R2-04 and R2-18 behave as ruled, and the existing tests that pin them are green.
- The full web verify passes with zero warnings, and no budget limit or tolerance changed.
- 02-REVIEW-FIX-d41.md records all five as fixed, and the WR-05 owner FYI is in deferred-items.md.
</success_criteria>

<output>
Create `.planning/quick/261013-lgi-fix-the-five-d-41-code-review-warnings-i/261013-lgi-SUMMARY.md` when done, with `created:`/`updated:` timestamps (America/Chicago offset). Include the RED/GREEN commit hashes per task, the test and coverage numbers, the budget figures, and the WR-05 portal-versus-guard decision with its evidence.
</output>
