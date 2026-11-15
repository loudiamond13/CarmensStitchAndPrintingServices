---
created: 2026-11-15T11:22:45-06:00
updated: 2026-11-15T11:22:45-06:00
phase: quick-261115-fjr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/ui/app.css
  - web/src/components/navigation/navigation.recipe.ts
  - web/src/components/navigation/SiteHeader.tsx
  - web/src/components/navigation/SiteHeader.test.tsx
  - web/src/hooks/usePresence.ts
  - web/src/hooks/usePresence.test.ts
  - web/visual/reference/rulings.css
  - web/visual/reference/rulings.test.ts
  - .planning/phases/11-public-site-content-management/11-CONTEXT.md
  - .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md
  - .planning/phases/11-public-site-content-management/11-UI-SPEC.md
autonomous: true
requirements: [WEB-05, PUB-01]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Per D-131, tapping the burger on a phone mounts the 'Mobile' nav marked data-state=\"open\"; it slides down 16px and fades in over 0.45s ease-out (csp-site-drawer-in)"
    - "Per D-131, closing (the burger, a drawer link or the drawer 'Get a Quote') keeps the same nav mounted as data-state=\"closed\", inert and taking no pointer input, while it slides back up and fades out over 0.3s (csp-site-drawer-out); it leaves on its own animationend (a child's bubbled animationend is ignored) or after the 400 ms usePresence fallback"
    - "Per D-131, the four drawer links and the drawer 'Get a Quote' rise in one after another, 60, 120, 180, 240 and 300 ms after the panel starts, each over 0.3s (csp-site-link-in)"
    - "Per D-131, the burger icon turns into the X as the menu opens and back into the menu icon as it closes (csp-burger-turn, 0.2s quarter-turn fade); it does not move on page load, and the burger still holds exactly one svg"
    - "Under prefers-reduced-motion nothing animates (motion-reduce:animate-none on the panel, its closed state, the items and the icon), so usePresence sees no animation and the menu opens and closes at once"
    - "Existing behaviour holds: aria-expanded, drawer links close the menu, md-up hides the burger and the drawer, both 'Get a Quote' buttons go to /contact, focus, the OpenedSiteDrawer preview, zero axe violations, no inline style attribute, public JS and CSS budgets"
    - "The parity reference states the same animations (three D-131 groups in rulings.css, pinned by rulings.test.ts), and D-131 is recorded after D-130 in 11-CONTEXT.md, in the P2 intentional differences table and in the P11 Motion row"
  artifacts:
    - path: web/src/ui/app.css
      provides: "D-131 theme tokens --animate-csp-site-drawer-in/-out, --animate-csp-site-link-in, --animate-csp-burger-turn and their @keyframes"
      contains: "--animate-csp-site-drawer-in"
    - path: web/src/components/navigation/navigation.recipe.ts
      provides: "siteDrawerClasses motion tokens, new siteDrawerItemClasses (stagger) and siteBurgerIconClasses"
      contains: "siteDrawerItemClasses"
    - path: web/src/components/navigation/SiteHeader.tsx
      provides: "usePresence-driven drawer with data-state and inert while closing; staggered items; turning burger icon"
      contains: "usePresence"
    - path: web/src/hooks/usePresence.ts
      provides: "400 ms fallback covering the 0.3s exit"
      contains: "FALLBACK_MS = 400"
    - path: web/visual/reference/rulings.css
      provides: "D-131 reference animation groups for the look-equality proof"
      contains: "D-131"
    - path: .planning/phases/11-public-site-content-management/11-CONTEXT.md
      provides: "the D-131 ruling bullet after D-130"
      contains: "D-131"
  key_links:
    - from: web/src/components/navigation/SiteHeader.tsx
      to: web/src/hooks/usePresence.ts
      via: "presence.ref on the 'Mobile' nav, data-state={presence.state}, render while presence.mounted"
      pattern: "usePresence\\(open\\)"
    - from: web/src/components/navigation/navigation.recipe.ts
      to: web/src/ui/app.css
      via: "animate-csp-site-* and animate-csp-burger-turn utilities read the @theme --animate-csp-* tokens (class gate compiles them)"
      pattern: "animate-csp-site-drawer-in"
    - from: web/visual/reference/rulings.css
      to: web/visual/compare.ts
      via: "the parity compare reads animation-name, -duration, -timing-function and -iteration-count on both sides"
      pattern: "csp-site-drawer-in 0.45s ease-out"
---

<objective>
Owner ruling D-131 (owner, 2026-11-15, option "Slow slide"): on phones the public header menu animates. Opening: the panel under the header slides down and fades in over about 0.45 s (ease-out), the links follow one after another, and the burger icon turns into the X. Closing: the panel slides back up and fades out over about 0.3 s and stays mounted until that ends, then unmounts. Under reduced motion nothing moves.

The build copies the admin drawer pattern (05 D-34: `usePresence`, `data-state`, theme keyframes, `motion-reduce:animate-none`). It uses classes only (strict CSP) and moves only transform and opacity.

Purpose: the phone menu feels smooth, the way the owner asked.
Output: four theme animations, the SiteHeader drawer on `usePresence`, the staggered items and the turning icon, a 400 ms presence fallback, the parity reference mirror, and the D-131 records.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@web/src/components/navigation/SiteHeader.tsx
@web/src/components/navigation/MobileNavDrawer.tsx
@web/src/hooks/usePresence.ts

## Facts the executor needs (checked against the tree at HEAD de5fb781)

- `SiteHeader.tsx` renders the drawer as `{open && (<nav className={siteDrawerClasses} aria-label="Mobile">...)}` (lines 98 to 120), and the burger icon as `<Icon name={open ? 'x' : 'menu'} size={22} />` (line 95). `Icon` renders a different lucide component per name, so a name change mounts a new `<svg>` (a CSS animation on it plays again).
- `MobileNavDrawer.tsx` is the pattern to copy: `const presence = usePresence(open)`, it renders while `presence.mounted`, puts `presence.ref` on the node that plays the exit, and sets `data-state={state}` and `inert={open ? undefined : true}` (line 127).
- `usePresence.ts`: `FALLBACK_MS = 300` (line 8). Its header comment says "A 300 ms timer" and the constant's doc says "D-38 caps the motion at 250 ms". `usePresence.test.ts` lines 84 to 97 pin the 300 ms fallback (advance 299, then 1).
- jsdom runs no animation: `getComputedStyle(node).animationName` is empty, so `usePresence` unmounts in the same commit. That is why the existing SiteHeader and `web/src/layouts/PublicLayout.test.tsx` tests that expect the nav gone right after a close keep passing unchanged. To test the exit, mock `getComputedStyle` only for elements with `data-state="closed"`, exactly like `animateClosedElements()` in `web/src/components/navigation/MobileNavDrawer.test.tsx` lines 401 to 408, and restore mocks in `afterEach`.
- Theme motion lives in the `@theme` block of `web/src/ui/app.css`: the `--animate-csp-*` tokens are at lines 77 to 89, and the `@keyframes csp-*` blocks follow until `csp-shimmer`. `web/src/ui/base.css` zeroes only transition durations under reduced motion, not keyframe animations. Hence `motion-reduce:animate-none`.
- Class gate: from `web/`, `node scripts/class-gate.mjs` compiles every class token against app.css and fails on an unknown token. It also fails on an `opacity-*` utility outside the D-02 allow-list, so opacity may only appear inside the keyframes. Tailwind is v4: `nth-1:` means `:nth-child(1)` and `nth-[n+5]:` means `:nth-child(n+5)`.
- TypeScript has `exactOptionalPropertyTypes: true`. `IconProps.className` is `string` (optional), so do not pass `undefined` to it explicitly.
- The look-equality proof (Playwright, `web/visual/parity.spec.ts`) compares `animation-name`, `animation-duration`, `animation-timing-function`, `animation-iteration-count` and the transition properties. It does not compare `animation-delay` or `animation-fill-mode`, and it finishes every finite animation before reading.
  - The scenario `site-header-drawer-open` opens the drawer through the `OpenedSiteDrawer` wrapper pair.
  - The frozen reference header (`web/visual/.reference-src/ui/index.tsx` lines 640 to 660) uses `.csp-site-header.is-open`, `.csp-site-burger` (one `<svg>`), `.csp-site-drawer`, `.csp-site-dlink`, and a plain `.csp-btn` as the drawer CTA.
  - So `web/visual/reference/rulings.css` must state the same open-state animations, or parity fails.
  - Playwright is NOT run in this task.
- `web/visual/reference/rulings.test.ts`:
  - `RULING_IDS` (lines 20 to 47) ends with `'D-107'`. Every rule group needs its own preceding comment that starts with its ID, and every selector must name a `.csp-` or `.s-` class.
  - Only O-6 may hold a `@media (prefers-reduced-motion` block, and an at-rule group such as `@keyframes` would fail the spec-class rule. So the D-131 groups state plain `animation` declarations only.
  - The D-51 test (around line 441) is the pin pattern to copy: an `expect` on the preludes, then one on the normalized bodies.
- Baselines at HEAD, so the gates below are real:
  - `csp-site-drawer-in`, `csp-site-drawer-out`, `csp-site-link-in` and `csp-burger-turn` each count 0 in app.css, navigation.recipe.ts and rulings.css.
  - `D-131` counts 0 in 11-CONTEXT.md, 02-UI-SPEC.md, 11-UI-SPEC.md and rulings.test.ts.
  - SiteHeader.tsx counts 0 for `usePresence|data-state|inert` and 0 for an inline style attribute.
- `docs/CSPS-UI-SPEC.md` is hash-pinned (`web/visual/reference/spec-appendix.sha256`). Do NOT edit it. Record UI additions in the phase UI contracts named in Task 3.

## Owner rules for this executor (subagents do not see CLAUDE.md or memory otherwise)

- **Test-driven:** each code task writes the failing tests first, runs them and quotes the failure (RED), then makes the change and quotes them green. Zero warnings in build, lint, types, tests and the browser console.
- **Evidence before done:** quote each command's result tail and exit code. If a test fails, re-run it alone before calling it flaky, and record any flake in the SUMMARY. Never claim a pass you did not see.
- **Scope:** no new or bumped package, no SQL, no migration, no backend change. No inline style attribute anywhere (strict CSP): the stagger and every motion value come from classes and theme tokens. Anything beyond D-131 goes to the SUMMARY as an owner question with 2 to 3 options, the recommendation first with a one-line reason. Never self-approve.
- **Shared machine:** TheBETSLLC (`C:\Work\TheBETSLLC`) runs on this machine. Before `npm --prefix web run verify` (a full test run), run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`, quote it, and wait if a port is in use by another project or TheBETSLLC's test processes are listed.
  - Never touch another project's ports (5173, 5023, 5099), databases or processes, and never kill a process you did not start.
  - Set environment variables per process only.
  - No dev server, no Playwright, no e2e or parity run.
- **No stdin reads:** never run a bare `cat > file`, `read` or an interactive prompt. Use the Write or Edit tool (or a heredoc). Leave no background shell running.
- **Comments (OR-2):** minimal and concise. Say what the code does, with no history narration. No em dash or en dash anywhere in `web/src` (OR-4: code, copy, comments). Avoid them in `web/visual` comments and the docs too: use a colon, a period or "to".
- **Commits:** stage by path, never `git add -A` or `git add .`. Before each commit:
  - run `gitleaks git --staged --redact --no-banner --config .gitleaks.toml`;
  - scan the staged diff for server or database names, connection strings, real emails, machine names and local `C:/Users/<name>` paths.
  - Use Conventional Commits with scope `261115-fjr`, in plain English, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Stay on branch `docs/phase-11-merge-rulings`. Do not push, open a PR, merge or deploy.
  - Do not commit the PLAN, SUMMARY or STATE (the orchestrator does).
- **Markdown:** every markdown file you create or edit carries created and updated timestamps (ISO 8601, offset -06:00). Get the time with `powershell -NoProfile -Command "Get-Date -Format yyyy-MM-ddTHH:mm:sszzz"`. On an edit, change only the updated values: the YAML `updated:` key and/or the `*Created: ... · Updated: ...*` line's Updated value, whichever the file has. The SUMMARY gets `created:` and `updated:` in its frontmatter.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: The phone menu slides open and slides closed, end to end (D-131)</name>
  <files>web/src/ui/app.css, web/src/components/navigation/navigation.recipe.ts, web/src/components/navigation/SiteHeader.tsx, web/src/components/navigation/SiteHeader.test.tsx</files>
  <read_first>web/src/components/navigation/MobileNavDrawer.tsx (lines 59 to 62 and 127), web/src/components/navigation/MobileNavDrawer.test.tsx (lines 393 to 500), web/src/components/navigation/navigation.recipe.ts (lines 83 to 133 and 207 to 222), web/src/ui/app.css (lines 77 to 160)</read_first>
  <behavior>
    - D-131 open: after one burger click, the 'Mobile' nav has data-state="open" and no inert attribute. `siteDrawerClasses` still holds its layout tokens and `pg-md-up:hidden`, and now also `animate-csp-site-drawer-in`, `data-[state=closed]:animate-csp-site-drawer-out`, `data-[state=closed]:pointer-events-none`, `motion-reduce:animate-none` and `motion-reduce:data-[state=closed]:animate-none`.
    - D-131 close with an exit animation (getComputedStyle mocked to report `csp-site-drawer-out` for data-state="closed" elements): after the second burger click, the burger says aria-expanded="false" at once. The same nav node is still connected, with data-state="closed" and the inert attribute.
    - An animationend that bubbles up from a drawer link leaves it in place. The nav's own animationend removes it (queryByRole navigation "Mobile" is null).
    - Following a drawer link (Contact) with the exit mocked: the path is /contact, and the nav is closed and inert, then gone after its own animationend.
    - Reopening during the close: the same node is data-state="open" again, with no inert.
    - With no animation (jsdom default, the reduced-motion case) every existing SiteHeader test passes unchanged: a close removes the nav at once.
  </behavior>
  <action>
    Implements D-131 opening and closing for the panel only. Task 2 adds the item stagger and the icon turn.

    1. RED. In SiteHeader.test.tsx, add a describe block "SiteHeader phone drawer motion (D-131)" with the behaviors above.
       - Copy the `animateClosedElements` helper shape from MobileNavDrawer.test.tsx, with the animation name `csp-site-drawer-out`.
       - Restore mocks in `afterEach`, and use `act` around the dispatched animationend events.
       - Leave the existing tests untouched.
       - Run the file and quote the failures.
    2. app.css, inside the existing `@theme` block, written once for the whole ruling (Task 2 uses the last two):
       - After `--animate-csp-pop-out`, add a one-line comment "D-131: the public phone menu, 0.45 s in and 0.3 s out, transform and opacity only." and four tokens:
         - `--animate-csp-site-drawer-in: csp-site-drawer-in 0.45s ease-out;`
         - `--animate-csp-site-drawer-out: csp-site-drawer-out 0.3s ease-in forwards;`
         - `--animate-csp-site-link-in: csp-site-link-in 0.3s ease-out both;`
         - `--animate-csp-burger-turn: csp-burger-turn 0.2s ease-out;`
       - After the `csp-shimmer` keyframes, add a one-line comment "D-131: the public phone menu." and four keyframes:
         - `csp-site-drawer-in` from opacity 0 and translateY(-16px);
         - `csp-site-drawer-out` to opacity 0 and translateY(-16px);
         - `csp-site-link-in` from opacity 0 and translateY(-8px);
         - `csp-burger-turn` from opacity 0 and rotate(-90deg).
       - Do not touch the existing tokens or keyframes.
    3. navigation.recipe.ts:
       - Append to `siteDrawerClasses` exactly these tokens: `animate-csp-site-drawer-in`, `data-[state=closed]:pointer-events-none`, `data-[state=closed]:animate-csp-site-drawer-out`, `motion-reduce:animate-none`, `motion-reduce:data-[state=closed]:animate-none`. These mirror the `drawerPanelClasses` pattern.
       - Extend its doc comment by one short sentence: "D-131: it slides down and fades in, and back up on close (theme keyframes, `data-state` from SiteHeader; none under reduced motion)."
       - Use no `opacity-*` utility.
    4. SiteHeader.tsx:
       - Import `usePresence` from `@/hooks/usePresence` and call `const presence = usePresence(open)`.
       - Render the 'Mobile' nav while `presence.mounted` (instead of `open`), with `ref={presence.ref}`, `data-state={presence.state}` and `inert={open ? undefined : true}`, all as MobileNavDrawer does.
       - Keep aria-label "Mobile", the links' `setOpen(false)` and `quote()` unchanged.
       - Add one line to the header comment's "Owner rulings applied" list: "D-131 on phones the drawer slides down and fades in, and on close stays mounted (inert) until its exit ends (usePresence); nothing moves under reduced motion."
       - Add no inline style attribute.
    5. GREEN: run the verify commands and quote them. Then commit SiteHeader.tsx, SiteHeader.test.tsx, navigation.recipe.ts and app.css by path, with gitleaks first, as `feat(261115-fjr): slide the public phone menu open and closed (D-131)`.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/components/navigation/SiteHeader.test.tsx src/layouts/PublicLayout.test.tsx</automated>
    <automated>cd web && node scripts/class-gate.mjs</automated>
    <automated>npm --prefix web run typecheck && npm --prefix web run lint</automated>
    <automated>for f in web/src/components/navigation/navigation.recipe.ts web/src/ui/app.css; do grep -q "animate-csp-site-drawer-in" "$f" || { echo "missing in $f"; exit 1; }; done</automated>
    <automated>! grep -q "style=" web/src/components/navigation/SiteHeader.tsx</automated>
  </verify>
  <done>The new D-131 tests failed first (quoted) and now pass, together with every existing SiteHeader and PublicLayout test. The class gate, typecheck and lint are clean. The drawer opens with data-state="open" and, when closing, stays mounted, closed and inert until its own animationend. Commit 1 is made.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The links follow one after another, the burger icon turns, and the close is never cut short (D-131)</name>
  <files>web/src/components/navigation/navigation.recipe.ts, web/src/components/navigation/SiteHeader.tsx, web/src/components/navigation/SiteHeader.test.tsx, web/src/hooks/usePresence.ts, web/src/hooks/usePresence.test.ts</files>
  <read_first>web/src/hooks/usePresence.test.ts (lines 1 to 20 and 84 to 112), web/src/components/brand/Icon.tsx</read_first>
  <behavior>
    - D-131 stagger: every drawer link carries `siteDrawerLinkClasses` plus `siteDrawerItemClasses`, and the drawer "Get a Quote" carries `siteDrawerCtaClasses` plus `siteDrawerItemClasses`.
    - The `siteDrawerItemClasses` tokens are exactly `animate-csp-site-link-in`, `nth-1:[animation-delay:60ms]`, `nth-2:[animation-delay:120ms]`, `nth-3:[animation-delay:180ms]`, `nth-4:[animation-delay:240ms]`, `nth-[n+5]:[animation-delay:300ms]` and `motion-reduce:animate-none`.
    - D-131 icon turn: before any open, the burger svg has no `animate-csp-burger-turn`. After opening, the X svg carries every `siteBurgerIconClasses` token (`animate-csp-burger-turn`, `motion-reduce:animate-none`).
    - With the exit mocked, while the menu is closing, the menu svg carries them too. After the nav's own animationend, the menu svg carries none of them.
    - The burger keeps exactly one svg, aria-label "Menu" and its aria-expanded.
    - usePresence: the fallback is 400 ms. With an animation name mocked and no animationend, the node is still mounted at 399 ms and gone at 400 ms. The other usePresence tests are unchanged.
  </behavior>
  <action>
    Implements the D-131 link stagger and burger turn. It also widens the presence fallback for the 0.3 s exit (it exceeds the 05 D-38 150 to 250 ms range by owner ruling).

    1. RED:
       - In SiteHeader.test.tsx, add tests for the stagger and the icon turn to the D-131 describe block. Import the two new recipe names from './navigation.recipe'.
       - In usePresence.test.ts, rename the fallback test to "unmounts after the 400 ms fallback when no animationend arrives" and advance 399, then 1.
       - Run both files and quote the failures.
    2. navigation.recipe.ts: export two class lists with `tw(...)`.
       - `siteDrawerItemClasses` gets the seven tokens above. Doc comment: "D-131: each drawer item rises in one after another: child n starts n x 60 ms after the panel, child 5 and later at 300 ms; none under reduced motion."
       - `siteBurgerIconClasses` gets `animate-csp-burger-turn motion-reduce:animate-none`. Doc comment: "D-131: the burger icon turns in while the menu is open or closing; none under reduced motion."
       - If the class gate reports an `nth-*` token as unknown, switch only that token to the arbitrary form `[&:nth-child(N)]:[animation-delay:...]`, and update the test tokens to match.
       - Use no `opacity-*` utility.
    3. SiteHeader.tsx:
       - Import `clsx` (already a project dependency, used by Icon).
       - Set each drawer link's className to `clsx(siteDrawerLinkClasses, siteDrawerItemClasses)`, and the drawer CTA's to `clsx(siteDrawerCtaClasses, siteDrawerItemClasses)`.
       - Give the burger Icon `className={clsx(presence.mounted && siteBurgerIconClasses)}`. Under `exactOptionalPropertyTypes` it must never pass undefined, and IconProps must not be widened.
       - Keep the single Icon with the name swap. The parity reference burger has one svg, so do not stack two icons.
       - The class sits on the icon only while the drawer is mounted, so the icon does not turn on page load. It drops after the 0.3 s exit, when the 0.2 s turn has long ended.
    4. usePresence.ts:
       - Set `FALLBACK_MS = 400`.
       - Change the header comment's "A 300 ms timer" to "A 400 ms timer".
       - Change the constant's doc to "The longest exit animation plus a margin (D-131: the public phone menu exits over 300 ms)."
       - Change nothing else in the hook.
    5. GREEN: run the verify commands and quote them. Then commit the five files by path, with gitleaks first, as `feat(261115-fjr): stagger the phone menu links and turn the burger icon (D-131)`.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/components/navigation src/hooks src/layouts/PublicLayout.test.tsx</automated>
    <automated>cd web && node scripts/class-gate.mjs</automated>
    <automated>npm --prefix web run typecheck && npm --prefix web run lint</automated>
    <automated>grep -q "FALLBACK_MS = 400" web/src/hooks/usePresence.ts</automated>
  </verify>
  <done>The stagger, icon and 400 ms fallback tests failed first (quoted) and now pass, with every navigation, hooks and PublicLayout test green (including MobileNavDrawer, UserMenu and the scenario axe tests). The class gate, typecheck and lint are clean. Commit 2 is made.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Mirror the motion in the parity reference, record D-131, and run the full gate</name>
  <files>web/visual/reference/rulings.css, web/visual/reference/rulings.test.ts, .planning/phases/11-public-site-content-management/11-CONTEXT.md, .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md, .planning/phases/11-public-site-content-management/11-UI-SPEC.md</files>
  <read_first>web/visual/reference/rulings.css (lines 1 to 30 and the "P5 D-35" chevron group near line 193), web/visual/reference/rulings.test.ts (lines 20 to 125 and 441 to 455)</read_first>
  <behavior>
    - rulings.test.ts lists 'D-131' in RULING_IDS. A new test "D-131: the public phone menu slides in, its items rise in and the burger icon turns, nothing else" pins the D-131 groups.
    - Preludes, in order: `.csp-site-drawer`, `.csp-site-drawer > *`, `.csp-site-header.is-open .csp-site-burger svg`.
    - Normalized bodies, in order: `animation: csp-site-drawer-in 0.45s ease-out;`, `animation: csp-site-link-in 0.3s ease-out both;`, `animation: csp-burger-turn 0.2s ease-out;`.
    - The existing structure tests (one commented group per ruling, spec class in every selector) stay green.
  </behavior>
  <action>
    1. RED: add 'D-131' to `RULING_IDS` after 'D-107', and add the pin test in the D-51 style. Run `rulings.test.ts` and quote the failure.
    2. rulings.css, right after the "P5 D-35" user-menu chevron group: add three rule groups, each with its own comment that starts with "D-131".
       - First comment: "D-131 (owner, 2026-11-15) the public phone menu slides down and fades in over 0.45s ease-out. The reference never closes it and the proof runs without reduced motion, so the exit and the reduced-motion none are not stated."
       - Second comment: "D-131 each menu link and the drawer button rise in over 0.3s ease-out. The stagger delays are not compared, so they are not stated."
       - Third comment: "D-131 the burger icon turns in over 0.2s ease-out while the menu is open."
       - Selectors and declarations exactly as in the behavior list.
       - No `@keyframes` and no `@media` here: the spec-class rule allows a reduced-motion block for O-6 only.
       - The values must equal the app.css tokens character for character in name, duration and timing.
    3. GREEN: run the verify commands below for the rulings and compare tests and quote them. Commit rulings.css and rulings.test.ts by path, with gitleaks first, as `test(261115-fjr): state the phone menu motion in the parity reference (D-131)`.
    4. Records. Get the time first, and follow the markdown timestamp rule for each file.
       - 11-CONTEXT.md: insert this bullet as a new line directly after the D-130 bullet, and bump only the Updated value on the line under the title:
         "- **D-131 (public phone menu: slow slide):** option "Slow slide". On phones the public header menu (the burger) animates. Opening: the panel under the header slides down and fades in over 0.45 s (ease-out), the links and the "Get a Quote" button follow one after another (60 ms apart, each rising in over 0.3 s), and the burger icon turns into the X (a 0.2 s quarter-turn fade). Closing: the panel slides back up and fades out over 0.3 s and stays in the page until that ends (it takes no taps or focus meanwhile), then leaves; the menu icon turns back the same way. Under reduced motion nothing moves, and it opens and closes at once. It copies the admin drawer pattern (05 D-34: `usePresence`, `data-state`, theme keyframes in `app.css`), moves only transform and opacity, and uses classes only (strict CSP, no inline style). It is an exception to the 150 to 250 ms motion range (05 D-38) for this menu only, so the `usePresence` fallback timer grows from 300 ms to 400 ms. The look-equality reference states the same animations in its rulings layer (`web/visual/reference/rulings.css`), listed in the P2 intentional differences. Built in quick 261115-fjr. (owner, 2026-11-15)"
       - 02-UI-SPEC.md: under "### Intentional differences (the complete list; anything else must be equal)", add this row as the new last row, after the row that starts "| Dialogs in the Overlay region move up":
         "| Public phone menu motion: the drawer slides down and fades in (0.45s ease-out), its links and button rise in one after another (0.3s ease-out), and the burger icon turns in (0.2s ease-out) while it is open; none under reduced motion | D-131 (owner, 2026-11-15) | Rulings layer (motion) → equal |"
         Bump its frontmatter `updated:` and the Updated value on the line under the title.
       - 11-UI-SPEC.md: in the "| Motion |" row, append this sentence to the middle cell: " D-131 (owner, 2026-11-15): the phone header menu slides down and fades in over 0.45 s, its links follow one after another, the burger icon turns into the X, and on close it slides back up over 0.3 s before it leaves; none of it under reduced motion."
         Change the source cell from "spec §10" to "spec §10; D-131". Bump its frontmatter `updated:` and the Updated value on the line under the title.
    5. Full gate. Run the preflight command and quote it (wait if another project is busy). Then run `npm --prefix web run verify`, and quote the step tails: typecheck, lint, format:check, test:coverage with the no-long-dash and source-layout tests, build, and build:budget with the public initial JS and CSS figures.
       - If Prettier flags a changed file, format only that file with the repo's Prettier and re-run.
    6. Commit the three docs by path, with gitleaks first, as `docs(261115-fjr): record D-131 and the phone menu motion in the UI contracts`.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run visual/reference/rulings.test.ts visual/compare.test.ts</automated>
    <automated>for f in .planning/phases/11-public-site-content-management/11-CONTEXT.md .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md .planning/phases/11-public-site-content-management/11-UI-SPEC.md web/visual/reference/rulings.css; do grep -q "D-131" "$f" || { echo "missing in $f"; exit 1; }; done</automated>
    <automated>npm --prefix web run verify</automated>
  </verify>
  <done>The rulings pin failed first (quoted) and now passes. `npm --prefix web run verify` exits 0, with the budget lines quoted. D-131 is recorded after D-130, in the P2 table and in the P11 Motion row, with only the updated timestamps changed. Commits 3 and 4 are made.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server to browser (CSP) | The page runs under a strict CSP with no `unsafe-inline`, so all motion must come from the compiled stylesheet |
| Visitor input to the phone menu | Taps and keys open and close the menu; a closing menu must not take input |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fjr-01 | Tampering | SiteHeader stagger and motion | medium | mitigate | Every delay and animation is a class (nth-child utilities, theme tokens). No inline style attribute (grep gate in Task 1), so the strict CSP needs no `unsafe-inline`. |
| T-fjr-02 | Denial of service | Closing nav that never unmounts | low | mitigate | `usePresence` removes the nav on its own animationend or after the 400 ms fallback. That also covers md-up, where the hidden nav runs no animation. The fallback is pinned in usePresence.test.ts. |
| T-fjr-03 | Spoofing | Taps on a fading menu | low | mitigate | While closing, the nav is `inert` and `data-[state=closed]:pointer-events-none`, so a tap during the exit cannot follow a link (tests assert inert). |
| T-fjr-04 | Denial of service | Visitors with vestibular disorders | low | mitigate | `motion-reduce:animate-none` on the panel, its closed state, the items and the icon. With no animation, usePresence unmounts at once (recipe tokens pinned in SiteHeader.test.tsx). |
| T-fjr-05 | Information disclosure | Commits | low | mitigate | No data is involved. gitleaks and the staged-diff scan run before every commit, and files are staged by path. |
| T-fjr-SC | Tampering | npm installs | high | mitigate | No install task exists. The executor adds or bumps no package and stops to report if one seems needed. |
</threat_model>

<verification>
- The verify commands of Tasks 1, 2 and 3 pass. `npm --prefix web run verify` exits 0 with zero warnings, and its budget lines are quoted.
- `git log --oneline -5` shows the four new commits on top of de5fb781 on `docs/phase-11-merge-rulings`, and `git status --short` shows no stray tracked change from this run.
- No push, PR, deploy, dev server, Playwright, parity or e2e run, package, SQL or migration was made.
- The SUMMARY lists the follow-ups, records them without deciding them, and puts each owner choice with 2 to 3 options, the recommendation first:
  1. Run `npm --prefix web run parity -- --grep @navigation` before the next PR, to prove the rulings mirror (not run here: Playwright is off).
  2. The owner looks at the menu on a phone (or at 390 px) to confirm the 0.45 s and 0.3 s feel.
  3. No Playwright @motion test covers the public menu yet. Park it as a follow-up.

## Source coverage audit

| Source | Item | Covered by |
|---|---|---|
| GOAL | D-131: the public phone menu animates open and closed (Slow slide) | Tasks 1 and 2 |
| CONTEXT | Opening: the panel slides down and fades in over about 0.45 s, ease-out | Task 1 (csp-site-drawer-in 0.45s ease-out) |
| CONTEXT | The links follow one after another (short stagger) | Task 2 (siteDrawerItemClasses, 60 ms steps) |
| CONTEXT | The burger icon turns into the X (rotate/fade, not an instant swap) | Task 2 (csp-burger-turn on the mounted icon) |
| CONTEXT | Closing: slides up and fades out over about 0.3 s, stays mounted until the exit ends, then unmounts | Task 1 (usePresence, data-state, inert), Task 2 (400 ms fallback) |
| CONTEXT | Reduced motion: no animation, opens and closes at once (`motion-reduce:animate-none`) | Tasks 1 and 2 (tokens pinned), T-fjr-04 |
| CONTEXT | Copy the admin D-34 pattern (usePresence, data-state, recipe tokens, theme keyframes) | Task 1 |
| CONTEXT | No inline style (strict CSP); the stagger comes from classes | Tasks 1 and 2, T-fjr-01 grep gate |
| CONTEXT | Keep aria-expanded, links close the menu, the md breakpoint, "Get a Quote", focus, the OpenedSiteDrawer preview | Tasks 1 and 2 (existing tests unchanged and green) |
| CONTEXT | Closing nav staying mounted must not break tests that expect it gone | Task 1 (jsdom has no animation; exit tests mock it like MobileNavDrawer.test.tsx) |
| CONTEXT | Public JS 150 KB gz, CSS 35 KB gz, zero axe violations | Task 3 (verify build:budget), the scenario axe tests in Tasks 1 and 2 |
| CONTEXT | Record the spec addition where UI-spec additions live | Task 3 (P2 intentional differences row, P11 Motion row, rulings layer) |
| CONTEXT | Record D-131 after D-130 in 11-CONTEXT.md, bump only Updated | Task 3 step 4 |
| CONTEXT | Stay on the branch; no push, PR or deploy | Owner rules block, verification |
| CONTEXT | Owner rules: TDD, zero warnings, comments, no dash, timestamps, no packages or SQL, shared machine, stdin, staging by path, gitleaks, commit format, gates, no Playwright | Owner rules block, every task's verify |
| REQ | WEB-05 (public layout and its phone navigation) | Tasks 1 and 2 |
| REQ | PUB-01 (visitors browse the public pages) | Tasks 1 and 2 (the menu still links every page) |
| RESEARCH | none (quick task, no research phase) | not applicable |
</verification>

<success_criteria>
- On a phone, the menu slides down and fades in over 0.45 s, its links and button follow one after another, and the burger turns into the X.
- Closing slides it up over 0.3 s, and it stays mounted and inert until its exit ends. Under reduced motion it opens and closes at once.
- All existing SiteHeader, PublicLayout, MobileNavDrawer, UserMenu and usePresence behaviour still passes. The parity reference states the same open-state animations.
- D-131 is recorded in 11-CONTEXT.md, 02-UI-SPEC.md and 11-UI-SPEC.md.
- Four atomic commits, `npm --prefix web run verify` green with zero warnings, and nothing beyond D-131.
</success_criteria>

<output>
Create `.planning/quick/261115-fjr-public-phone-menu-slow-slide-d-131/261115-fjr-SUMMARY.md` when done, with `created:` and `updated:` in its frontmatter.
</output>
