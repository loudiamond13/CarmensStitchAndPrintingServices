---
created: 2026-11-13T17:25:00-06:00
updated: 2026-11-13T17:25:00-06:00
phase: quick-261113-nqv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/test/public-look.node.test.ts
  - web/src/ui/app.css
  - web/src/modules/public/components/contact.recipe.ts
  - web/src/modules/public/components/gallery.recipe.ts
  - web/src/modules/public/components/galleryLightbox.recipe.ts
  - web/src/modules/public/components/home.recipe.ts
  - web/src/modules/public/components/hours.recipe.ts
  - web/src/modules/public/components/products.recipe.ts
  - web/src/modules/public/components/public.recipe.ts
  - web/src/modules/public/components/recent.recipe.ts
  - web/src/modules/public/components/SiteFooter.tsx
  - web/src/modules/public/components/MapCard.tsx
  - web/src/modules/public/components/GalleryMasonry.tsx
  - web/src/modules/public/components/gallery.test.tsx
  - web/src/layouts/PublicLayout.tsx
  - web/src/layouts/PublicLayout.test.tsx
  - .planning/phases/11-public-site-content-management/11-UI-REVIEW.md
  - .planning/phases/11-public-site-content-management/11-UI-SPEC.md
  - .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md
autonomous: true
requirements: [PUB-01, PUB-06, GAL-01, GAL-02, CONT-02, CONT-03]

estimate:
  tokens: 120000
  raw_tokens: 120000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Every font size in web/src/modules/public is a named theme token text-N whose value is the same N px as before, and both 650 weights use the existing font-button token; the public pages look exactly as before because a text-N token sets only font-size (no line-height)"
    - "A gate test fails on any hand-typed font size or weight in web/src/modules/public and on any --text-N token that is not in the pinned 11-UI-SPEC list (12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 30, 32, 36, 40, 48, 52, 56, 64, 76, 80, 96, 160, 260)"
    - "The drawn Contact map has no hex colour: its five road strokes use the Blush tokens of the same value (surface-3 twice, surface, neutral-soft, nav-bg), and a gate fails on any hex colour in web/src/modules/public TSX except HeroArt.tsx and JerseyArt.tsx"
    - "Nothing in web/src/modules/public sets a style attribute: the drawn-jersey gallery tile keeps its height through a hidden SVG sizer's viewBox (4 / 5 when the size is unknown, the photo size clamped to 3 / 4 and 4 / 3 otherwise), photo tiles keep LazyImage, and a gate fails on any style prop in the module"
    - "The phone sticky contact bar pads its bottom by 16px plus env(safe-area-inset-bottom), and the Contact page's phone scroll padding adds the same inset, so focus never hides under the bar"
    - "Findings 4 and 5 are closed with evidence and no code change, every finding in 11-UI-REVIEW.md has one recorded outcome, and the owner questions are parked in DECISIONS.md, not decided"
    - "typecheck, lint and format:check exit 0 and the full Vitest run passes with no warnings"
  artifacts:
    - path: web/src/test/public-look.node.test.ts
      provides: "The public look gates: type scale, hex colours, style attribute, sticky bar safe area"
    - path: web/src/ui/app.css
      provides: "The --text-N font-size tokens in @theme"
    - path: web/src/modules/public/components/GalleryMasonry.tsx
      provides: "The drawn tile sized by an attribute-only SVG sizer"
    - path: .planning/phases/11-public-site-content-management/11-UI-REVIEW.md
      provides: "An Outcomes section with one row per finding"
  key_links:
    - from: web/src/ui/app.css
      to: web/src/modules/public/components/*.recipe.ts
      via: "text-N utilities resolve the --text-N tokens (class gate in scripts/tailwind-classes.test.ts)"
    - from: web/src/modules/public/components/GalleryMasonry.tsx
      to: web/src/modules/public/components/gallery.recipe.ts
      via: "tileArtClasses loses aspect-(--ratio); the new tileSizerClasses gives the box its height"
    - from: web/src/layouts/PublicLayout.tsx
      to: web/src/modules/public/components/contact.recipe.ts
      via: "the Contact scroll padding and the bar's bottom padding both add env(safe-area-inset-bottom)"
---

<objective>
Fix the Phase 11 UI review findings (`.planning/phases/11-public-site-content-management/11-UI-REVIEW.md`) test first, without changing how any page looks, and record an outcome for every finding in the review.

The owner's rules for this quick task (owner, 2026-11-13, relayed with the task) are binding. When mapping hand-typed font sizes, use existing theme tokens of equal value, or add a named token with the current value. Do not change the look. If a fix would visibly change design, wording or behavior beyond the findings, park it as an owner question.

The planner checked every file:line claim before planning. The corrections are below and in the context section; use them and do not re-derive:
- **Fix 1 (typography):** confirmed, and wider than reported. There are 64 hand-typed sizes (23 distinct values) in 9 files, not about 14 in 4. There is also a second `font-[650]` at `public.recipe.ts:77`.
- **Fix 2 (MapCard):** confirmed, and wider than reported. Five hex strokes (lines 116, 119, 120, 121, 125), not one.
- **Fix 3 (GalleryMasonry:88):** confirmed. The CSP risk is overstated, though. React writes custom properties through the CSSOM, which CSP does not block, and the D-33 lint rule allows custom-property-only style. The real gap is 11-UI-SPEC lines 48 and 51 ("rows added for Phase 11: none"). It is fixed anyway, as asked.
- **Fix 4 (lightbox):** already met. The 56px buttons hide at 767px and below by the approved C-35 design, and two tap-zone buttons replace them. At 320px each zone is 96 by 216 px, in the tab order, with a focus ring, arrow keys and swipe. Existing tests cover this. No code change. A visible arrow on phones is an owner question.
- **Fix 5 (EmptyState):** the claim is wrong. Both tabs pass `emptyIcon`, `emptyTitle` and `emptyMessage` to ResponsiveTable, which renders the shared EmptyState. The copy is already in `siteContentCopy.ts` and tests cover it. No code change.
- **Fix 6 (sticky bar):** confirmed. Note that `web/index.html` has no `viewport-fit=cover`, so the inset is 0 today. The padding changes nothing visible now. Turning edge to edge on is an owner question.

Shape: independent, localized fixes on a proven architecture, so a tracer slice adds no information (the same call as quick 261109-c4l). Task 1 is fixes 1 and 2 (tokens instead of hand-typed values), Task 2 is fixes 3 and 6 (no inline style, and the safe area), and Task 3 is the full gates and the docs. Each code task goes red, then green, then one commit.

Purpose: PUB-01, PUB-06, GAL-01, GAL-02, CONT-02, CONT-03. Stop drift on the public pages (sizes and colours sit in the theme, not in recipes), keep the strict CSP contract literal, and get the Contact bar ready for notched phones.
Output: two fix commits, one docs commit, and the SUMMARY.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./.claude/CLAUDE.md
@.planning/phases/11-public-site-content-management/11-UI-REVIEW.md
@.planning/phases/11-public-site-content-management/11-UI-SPEC.md

## What the planner found in the code (use it, do not re-derive)

- **Theme:** `web/src/ui/app.css` line 31 clears every Tailwind default (`--*: initial`). There is no font-size token at all. Weights are tokens, and `--font-weight-button: 650` (line 41) is already used as `font-button` across the app. The weights sit at lines 38 to 43, inside `@theme`. `web/src/ui/stylesheet-contract.node.test.ts` allows custom properties inside `@theme`.
- **Tailwind 4.3.3 font-size tokens:** for a `--text-N` token with no `--text-N--line-height` companion, the `text-N` utility emits only `font-size: var(--text-N)` (checked in `web/node_modules/tailwindcss/dist/lib.js`). The look therefore equals the hand-typed `text-[Npx]`. Do not add any `--line-height` companions.
- **Hand-typed sizes in web/src/modules/public:** 64 (12 x7, 13 x5, 14 x15, 15 x1, 16 x10, 18 x2, 20 x6, 22, 24, 28, 30, 32, 36 x2, 40, 48 x2, 52, 56, 64, 76, 80, 96, 160, 260). They sit in exactly nine files: `contact.recipe.ts`, `gallery.recipe.ts`, `galleryLightbox.recipe.ts`, `home.recipe.ts`, `hours.recipe.ts`, `products.recipe.ts`, `public.recipe.ts`, `recent.recipe.ts`, and `SiteFooter.tsx` (lines 39, 40 and 159), all under `web/src/modules/public/components/`. `font-[650]` appears at `contact.recipe.ts:139` and `public.recipe.ts:77`. Every value comes from App. C or E: 15 is `.s-social` (`docs/CSPS-UI-SPEC.md` line 2378), and 160 and 260 are `.s-hero-num` (line 2333). The rest are in the 11-UI-SPEC Typography tables (lines 161 to 201).
- **Pinned class string:** `web/src/layouts/PublicLayout.test.tsx:285` pins the footer column title with `text-[16px]`. No other test pins a public size.
- **Outside this finding:** admin and shared components still hand-type 221 sizes in 33 files. Leave them alone; Task 3 parks this as an owner question.
- **MapCard roads** (`web/src/modules/public/components/MapCard.tsx` lines 113 to 128) copy App. E.4 verbatim (`docs/CSPS-UI-SPEC.md` lines 4670 to 4674). Each stroke equals a Blush token in `web/src/ui/base.css`: `#fff6f0` is `--surface-3` (line 10; roads at MapCard lines 116 and 119), `#fbebe2` is `--surface` (line 8; line 120), `#ead1c4` is `--neutral-soft` (line 40; line 121), and `#d4bbab` is `--nav-bg` (line 11; line 125, the dashed line). Public pages are Blush only, so `stroke-surface-3`, `stroke-surface`, `stroke-neutral-soft` and `stroke-nav-bg` render the same colours. The allowed hex holders in the module are `HeroArt.tsx` and `JerseyArt.tsx`. `public.recipe.ts:64` mentions `#000` in a comment, so the hex gate scans `.tsx` files only.
- **Gallery tile:** `GalleryMasonry.tsx` line 88 is the only style prop in `web/src/modules/public` (photo tiles go through LazyImage, whose `--ratio` is a P2-listed row). The drawn branch shows when the cover is missing or its `src` is empty, with `ratio = tileRatio(cover)`. `tileRatio` (lines 35 to 49) returns `'4 / 5'` for an unknown size, `'4 / 3'` or `'3 / 4'` at the clamps, and otherwise `` `${w} / ${h}` ``. Nothing outside the file uses it. `tileArtClasses` (`gallery.recipe.ts` lines 37 to 39) holds `relative aspect-(--ratio)` plus the dot mesh. `tileKitClasses` is `absolute inset-0 grid place-items-center`. LazyImage cannot host the drawn jersey, because an empty `src` shows MediaPlaceholder. `gallery.test.tsx` reads ratios through `ratioOf` (lines 10 to 16). It checks every demoGallery ratio (lines 39 to 48; all demoGallery tiles are photo tiles), draws the jersey for `photos: []` and an empty `src` (line 82), and pins custom-property-only style (line 107).
- **Sticky bar:** `barClasses` (`contact.recipe.ts` lines 142 to 145) has `pt-3 pb-4` and no inset. App. C `.s-mbar` is at `docs/CSPS-UI-SPEC.md` line 2656. The admin tab bar already pads `pb-[calc(12px+env(safe-area-inset-bottom))]` (`web/src/modules/admin/components/admin.recipe.ts` line 40), and its scroll padding adds the inset (line 15). The Contact phone scroll padding is `contactScrollPaddingClasses` (`web/src/layouts/PublicLayout.tsx` line 33, `scroll-pb-[calc(77px+var(--space-6))]`). It is pinned only loosely, by the regex at `PublicLayout.test.tsx:185`. `web/index.html` line 8 has no `viewport-fit=cover`.
- **Compiled-CSS tests:** `web/scripts/class-gate.mjs` exports `buildCss(tokens)`, `collectClassTokens(file, source)` and `checkClassTokens`. `web/src/modules/admin/components/orderForm.recipe.node.test.ts` shows the pattern (a `ruleOf` helper and a `// @vitest-environment node` header). Tailwind writes `calc(16px+env(...))` out as `calc(16px + env(...))`. `web/scripts/tailwind-classes.test.ts` line 404 runs `runClassGate()` over the whole app, so every new token must compile. `web/src/test/no-long-dash.node.test.ts` is the file-sweep pattern.
- **Finding 4 evidence (no change):** see `galleryLightbox.recipe.ts` lines 7 to 36 and the zone buttons in `GalleryLightbox.tsx` (about lines 223 to 242: "Previous photo" and "Next photo", `tabIndex` 0). Arrow keys step at line 126. The viewer pads 16px below 640px (`web/src/components/media/photoViewer.recipe.ts` line 20), so at 320px the photo box is 288 by 216 and each zone is 96 by 216. Tests are in `GalleryLightbox.test.tsx` lines 167 to 243. GAL-02 asks for "swipe plus a button alternative on phones (C-35)".
- **Finding 5 evidence (no change):** `ProductLinesTab.tsx` lines 466 to 469 and `TestimonialsTab.tsx` lines 467 to 470 pass the empty props to ResponsiveTable, which renders EmptyState (`web/src/components/lists/ResponsiveTable.tsx` lines 21, 227 and 244). The copy is in `web/src/modules/admin/siteContentCopy.ts` lines 241 to 244 and 442 to 445. Tests: `ProductLinesTab.test.tsx:236` and `TestimonialsTab.test.tsx:246`.
- **Other review notes, for the Outcomes table:**
  - SharePictureCard: PhotoSlot owns the status line, the pick-error box and the ConfirmDialog, and the settings come from BusinessInfoTab.
  - PublicWebsiteCard: it gets `order` from OrderPage, which owns loading and error, and edits go through PublicWebsiteModal.
  - Spacing values: they are 11-UI-SPEC Spacing declared exceptions (lines 145 to 153) or recipe box sizes.
  - Visual-only checks: the focal point, 60/30/10, 320px overflow, contrast and Espresso wait for the owner screenshot pass (11-UI-SPEC Visual Review; P11-BL-54).
  - AuthFrame and OrdersByStatusCard: their style uses predate Phase 11 and follow the P2 inline style rule.
- **Commands:** `npm --prefix web run test -- --run <paths>` runs Vitest in `web/`, so the paths are relative to `web/`. Always pass `--run`. Use `npm --prefix web run typecheck`, `npm --prefix web run lint` and `npm --prefix web run format:check`. `npm --prefix web run format` rewrites formatting; run it, then `git status --short` to confirm only planned files changed. Commit subjects follow `type(scope): summary` (`web/scripts/commit-lint.mjs`), for example `fix(11-ui): ...`.

## Owner rules for this executor (subagents do not see CLAUDE.md or memory otherwise)

- **Test-driven:** each code task writes the failing tests first, runs them and quotes the failure (failing for the right reason, not on setup). Then it makes the fix and quotes the tests green. Component tests keep the in-house axe matcher (`expectNoAxeViolations` from `@/test/axe`). Zero warnings in build, lint, types and tests; an act or key warning in test output counts as a failure.
- **Evidence before done:** quote each command's result tail and exit code. If a test fails, re-run it alone before calling it flaky, and record any flake in the SUMMARY. Never claim a pass you did not see.
- **No look change (11 D-28):** every change here must render the same as before. If a step would change the rendered look, wording or behavior, stop and park it in DECISIONS.md (Task 3) instead.
- **Shared machine:** do not start a dev server, Playwright, e2e or parity run. Vitest, lint and typecheck only. Before the full Vitest run, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` and quote it. Wait if a port is in use by another project, or if TheBETSLLC's test processes are listed. Never touch TheBETSLLC, its ports 5173, 5023 and 5099, any `BetsLLC_*` database, or any process you did not start. Never set env vars at User or Machine level.
- **No stdin reads:** never run a bare `cat > file`, `read` or an interactive prompt, and never run Vitest in watch mode. Use the Write or Edit tool for new files. Leave no background shell running.
- **No packages, no server:** do not add, bump or reinstall any package, and do not run `npm install` or `npm ci`. No .NET, database or migration change.
- **Client code (web/src):**
  - OR-2: comments are minimal and say what the code does, with no history narration.
  - OR-3, OR-5 and OR-6 stay unchanged. The only new web/src file is `web/src/test/public-look.node.test.ts`.
  - OR-4: no em dash or en dash in web/src.
  - No style attribute in the public module (strict CSP).
  - Each changed site that departs from App. C or E markup carries `// SPEC-DEVIATION: 11-UI-REVIEW fix N` with a short reason.
  - WCAG 2.2 AA with zero axe violations.
- **Do not edit** `docs/CSPS-UI-SPEC.md` (App. A to C are hashed in `web/visual/reference/spec-appendix.sha256`).
- **Commits:** stage by path, never `git add -A` or `git add .`. Before each commit, run `gitleaks git --staged --redact --no-banner --config .gitleaks.toml`. Also scan the staged diff for server or database names, connection strings, real emails, machine names and local `C:/Users/<name>` paths. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push or merge. Do not commit the PLAN, SUMMARY or STATE (the orchestrator does).
- **Markdown:** every markdown file you create or edit carries created and updated timestamps (ISO 8601, offset -06:00). In YAML frontmatter, change only `updated:`. Where a `*Created: ... · Updated: ...*` line sits under the title, change only its Updated value. The SUMMARY gets `created:` and `updated:` in its frontmatter.
- **Owner decisions:** never self-approve. Anything outside this plan that changes behavior, wording or look goes to DECISIONS.md, with 2 to 3 options, the recommendation first and a one-line reason.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Named type tokens and token map colours on the public site (fixes 1 and 2)</name>
  <files>web/src/test/public-look.node.test.ts, web/src/ui/app.css, web/src/modules/public/components/contact.recipe.ts, web/src/modules/public/components/gallery.recipe.ts, web/src/modules/public/components/galleryLightbox.recipe.ts, web/src/modules/public/components/home.recipe.ts, web/src/modules/public/components/hours.recipe.ts, web/src/modules/public/components/products.recipe.ts, web/src/modules/public/components/public.recipe.ts, web/src/modules/public/components/recent.recipe.ts, web/src/modules/public/components/SiteFooter.tsx, web/src/modules/public/components/MapCard.tsx, web/src/layouts/PublicLayout.test.tsx</files>
  <precondition>web/node_modules is present in this checkout (Vitest, Prettier and Tailwind resolve from it); if it is missing, stop and report, do not install.</precondition>
  <read_first>web/src/ui/app.css (lines 29 to 62), web/src/ui/base.css (lines 1 to 45), web/src/test/no-long-dash.node.test.ts, web/src/modules/admin/components/orderForm.recipe.node.test.ts (lines 1 to 30), web/src/modules/public/components/MapCard.tsx (lines 92 to 143), web/src/modules/public/components/contact.recipe.ts (lines 100 to 145), web/src/layouts/PublicLayout.test.tsx (lines 270 to 290), .planning/phases/11-public-site-content-management/11-UI-SPEC.md (lines 157 to 201)</read_first>
  <behavior>
    - Type scale: app.css declares exactly the --text-N tokens for N in 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 30, 32, 36, 40, 48, 52, 56, 64, 76, 80, 96, 160, 260, each equal to N px, and no --text-*--line-height token.
    - Type scale: no non-test .ts or .tsx file under web/src/modules/public holds a hand-typed font size (text-[ with a px, rem or em value) or a hand-typed weight (font-[ with a number); the failure lists each hit as path:line.
    - Type scale: every text-N utility used in web/src/modules/public names a size in the pinned list.
    - Type scale: buildCss(['text-14']) gives a .text-14 rule with font-size: var(--text-14) and no line-height (the look is unchanged).
    - Colour: no non-test .tsx file under web/src/modules/public except HeroArt.tsx and JerseyArt.tsx holds a hex colour (3, 4, 6 or 8 hex digits after #); the failure lists path:line.
    - Colour: the Blush block of base.css still holds --surface-3 #fff6f0, --surface #fbebe2, --neutral-soft #ead1c4 and --nav-bg #d4bbab, the values the drawn map used (look-equality proof for the road tokens).
  </behavior>
  <action>RED. Create `web/src/test/public-look.node.test.ts` with the `// @vitest-environment node` header and a two-line comment naming the 11-UI-REVIEW gates. Walk the files with node fs, as no-long-dash.node.test.ts does, scoped to `web/src/modules/public` and skipping any file whose name contains `.test.`. Import `buildCss` from `../../scripts/class-gate.mjs`, as orderForm.recipe.node.test.ts does from its depth. Write a describe block "public type scale (11-UI-REVIEW fix 1)" with the four type behaviors and a describe block "public colours (11-UI-REVIEW fix 2)" with the two colour behaviors. Pin the approved sizes as one constant array. Above it, put a one-line comment saying they are the 11-UI-SPEC Typography sizes plus App. C `.s-social` 15 and `.s-hero-num` 160 and 260. Run `npm --prefix web run test -- --run src/test/public-look.node.test.ts` and quote the failures: the missing tokens, the 66 hand-typed hits and the 5 MapCard hex lines.

GREEN, fix 1. In the `@theme` block of `web/src/ui/app.css`, after `--font-weight-heavy: 800;`, add one comment line and the 23 tokens `--text-12: 12px;` to `--text-260: 260px;` in ascending order. The comment says these are the public font sizes in px, pinned by `src/test/public-look.node.test.ts`. Add no line-height companions. Per the owner rule, add named tokens with the current values and change no look. In the nine files listed in the context, replace every `text-[Npx]` with `text-N`, keeping any variant prefix. A single `sed -i -E` over exactly those nine paths is fine. Then replace both `font-[650]` with `font-button`, the existing weight token of equal value (`contact.recipe.ts:139` and `public.recipe.ts:77`). Leave every `leading-[...]`, `tracking-[...]` and spacing value as it is.

GREEN, fix 2. In `contact.recipe.ts`, next to `mapRoadsClasses`, add four exported recipes: `stroke-surface-3`, `stroke-surface`, `stroke-neutral-soft` and `stroke-nav-bg`. Name them for the road they draw and give each a short doc comment. In `MapCard.tsx`, drop the five `stroke` hex attributes and give each path its recipe as `className`. Keep `fill="none"`, the widths and the dash array. Add one `// SPEC-DEVIATION: 11-UI-REVIEW fix 2` comment above the svg: App. E.4 draws the roads in hex, and here they are the Blush tokens of the same values (public pages are Blush only).

Run `npm --prefix web run format`. Confirm with `git status --short` that only this task's files changed. Then update the pinned string at `PublicLayout.test.tsx:285` to the class list SiteFooter now renders, with the same classes as before except `text-16`, in Prettier's order. Run the verify command and quote it green. Stage this task's 13 files by path, run gitleaks and the staged-diff scan, and commit as `fix(11-ui): name the public font sizes and map colours as theme tokens`.</action>
  <verify>
    <automated>npm --prefix web run test -- --run src/test/public-look.node.test.ts src/layouts/PublicLayout.test.tsx src/modules/public src/ui/stylesheet-contract.node.test.ts scripts/tailwind-classes.test.ts && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check</automated>
  </verify>
  <done>The RED run was quoted failing on the missing tokens, the hand-typed sizes and weights, and the MapCard hex lines. After the fix, the public-look gate, every web/src/modules/public test, PublicLayout, the stylesheet contract and the whole-app class gate pass. typecheck, lint and format:check exit 0 with no warnings. One commit holds the 13 files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: No inline style on the gallery tile, and the safe area under the Contact bar (fixes 3 and 6)</name>
  <files>web/src/test/public-look.node.test.ts, web/src/modules/public/components/GalleryMasonry.tsx, web/src/modules/public/components/gallery.recipe.ts, web/src/modules/public/components/gallery.test.tsx, web/src/modules/public/components/contact.recipe.ts, web/src/layouts/PublicLayout.tsx, web/src/layouts/PublicLayout.test.tsx</files>
  <read_first>web/src/modules/public/components/GalleryMasonry.tsx, web/src/modules/public/components/gallery.recipe.ts (lines 29 to 46), web/src/modules/public/components/gallery.test.tsx (lines 1 to 120), web/src/test/publicFixtures.ts (lines 462 to 470), web/src/layouts/PublicLayout.tsx (lines 28 to 40), web/src/layouts/PublicLayout.test.tsx (lines 182 to 191), web/src/modules/admin/components/admin.recipe.ts (lines 12 to 41), the Task 1 commit</read_first>
  <behavior>
    - Gate: no non-test .tsx file under web/src/modules/public has a JSX style prop; the failure lists path:line.
    - Gallery: a drawn tile (photos: []) holds no element with a style attribute and has an aria-hidden sizer (data-tile-sizer) whose viewBox is "0 0 4 5".
    - Gallery: a drawn tile from a cover with an empty src gets the cover's ratio on its sizer: 1200 by 900 gives viewBox "0 0 1200 900", 2000 by 1000 gives "0 0 4 3" and 300 by 1000 gives "0 0 3 4".
    - Gallery: every existing ratio expectation (lines 39 to 48), the jersey test (line 82), the custom-property-only test (line 107) and the axe test still pass, with ratioOf reading a photo tile's --ratio or a drawn tile's sizer viewBox as "W / H".
    - Bar: the compiled CSS of barClasses has padding-bottom: calc(16px + env(safe-area-inset-bottom)).
    - Scroll padding: on /contact the main element carries vp-lt-md:[:root:has(&)]:scroll-pb-[calc(77px+var(--space-6)+env(safe-area-inset-bottom))]; on /products it has no scroll-pb class.
  </behavior>
  <action>RED. In `web/src/test/public-look.node.test.ts`, add a describe block "public strict CSP (11-UI-REVIEW fix 3)" with the gate behavior. Add a describe block "public sticky bar (11-UI-REVIEW fix 6)" that compiles the tokens of `contact.recipe.ts` with `collectClassTokens` and `buildCss`, finds the bar's padding rule as orderForm.recipe.node.test.ts does, and asserts the bar behavior. In `gallery.test.tsx`, extend `ratioOf`: return the `--ratio` of a styled element if one exists, else turn the `data-tile-sizer` viewBox into "W / H". Then add one test for the two drawn-tile behaviors. Build the empty-address covers as `{ ...galleryPhoto(name, w, h), src: '', srcSet: '' }`, the line 82 pattern. In `PublicLayout.test.tsx`, tighten the line 185 check to the exact scroll-padding class above, and keep the /products check. Run `npm --prefix web run test -- --run src/test/public-look.node.test.ts src/modules/public/components/gallery.test.tsx src/layouts/PublicLayout.test.tsx` and quote the failures for the right reasons.

GREEN, fix 3. In `GalleryMasonry.tsx`, add a helper `tileRatioParts(photo)` that returns the width and height pair `tileRatio` uses today. That is 4 and 5 when unknown, 4 and 3 or 3 and 4 at the clamps, else the photo's own width and height. Rebuild `tileRatio` from it, so its strings stay the same. In the drawn branch, drop the style prop. As the first child of the art box, render an empty svg with `data-tile-sizer=""`, `aria-hidden="true"`, `viewBox` "0 0 W H", the `width` and `height` attributes W and H, and the new recipe class. Keep the kit div after it. Attributes are not styles, so this works under any CSP. In `gallery.recipe.ts`, remove `aspect-(--ratio)` from `tileArtClasses` and add an exported `tileSizerClasses` of `block h-auto w-full` with a doc comment: the hidden svg whose viewBox gives the drawn tile its height. Put one `// SPEC-DEVIATION: 11-UI-REVIEW fix 3` comment at the sizer: the drawn tile's ratio comes from the sizer's viewBox instead of `--ratio`, so the module sets no style (11-UI-SPEC "rows added for Phase 11: none"). Rewrite the header comment's last sentence to match: photo tiles keep LazyImage's `--ratio`, and the drawn tile sets no style. Photo tiles and LazyImage stay unchanged.

GREEN, fix 6. In `contact.recipe.ts` `barClasses`, change `pb-4` to `pb-[calc(16px+env(safe-area-inset-bottom))]`, the admin tab bar's pattern. Update the doc comment to say 77px tall plus the device's safe area, and add one `// SPEC-DEVIATION: 11-UI-REVIEW fix 6` comment: App. C pads 16px, and the safe area is added as on the admin tab bar. In `PublicLayout.tsx` line 33, add `+env(safe-area-inset-bottom)` inside the calc and update the comment above it. Do not touch `web/index.html`; edge to edge is an owner question.

Run `npm --prefix web run format` and check `git status --short`. Run the verify command and quote it green. Stage the 7 files by path, run gitleaks and the staged-diff scan, and commit as `fix(11-ui): size the drawn gallery tile without a style attribute and pad the Contact bar for the safe area`.</action>
  <verify>
    <automated>npm --prefix web run test -- --run src/test/public-look.node.test.ts src/modules/public/components/gallery.test.tsx src/modules/public/components/GalleryLightbox.test.tsx src/modules/public/pages/GalleryPage.test.tsx src/modules/public/components/contact.test.tsx src/modules/public/pages/ContactPage.test.tsx src/layouts/PublicLayout.test.tsx scripts/tailwind-classes.test.ts && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check</automated>
  </verify>
  <done>The RED run was quoted failing on the GalleryMasonry style prop, the missing sizer, the bar padding and the scroll padding. After the fix, all listed tests pass with zero axe violations, and nothing in web/src/modules/public sets a style attribute. typecheck, lint and format:check exit 0 with no warnings. One commit holds the 7 files.</done>
</task>

<task type="auto">
  <name>Task 3: Full gates, one outcome per review finding, and the parked owner questions</name>
  <files>.planning/phases/11-public-site-content-management/11-UI-REVIEW.md, .planning/phases/11-public-site-content-management/11-UI-SPEC.md, .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md</files>
  <read_first>.planning/phases/11-public-site-content-management/11-UI-REVIEW.md, .planning/phases/11-public-site-content-management/11-UI-SPEC.md (lines 1 to 20, 37 to 52, 157 to 201, 780 to 810), .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md (the last two items and the Flakes section), the Task 1 and Task 2 commits</read_first>
  <action>1. Full gates. Run the preflight and quote it, waiting if the machine is busy. Then run `npm --prefix web run test -- --run` (the whole suite, no-long-dash and source-layout included), `npm --prefix web run typecheck`, `npm --prefix web run lint` and `npm --prefix web run format:check`. Quote each tail and exit code. A failure in a file this run did not touch gets re-run alone before it is called a flake, and is recorded in the SUMMARY.

2. `11-UI-REVIEW.md`. Add a `## Outcomes` section after `## Detailed Findings` and before `## Further Notes`. Start it with one sentence: every finding has one outcome, under the owner's instruction for quick 261113-nqv (owner, 2026-11-13), the commits are the Task 1 and Task 2 short hashes, and the pillar scores are the review's own and are not rescored. Then add a table with columns ID | Finding | Outcome | Evidence, and exactly eleven rows, each starting `| R-NN |`:
- R-01, typography drift (fix 1, Pillar 4). Fixed: 23 `--text-N` tokens of the same values, 64 sizes in 9 files, both 650 weights to `font-button`, plus the type-scale gate. Note the review undercounted the files.
- R-02, MapCard hex (fix 2, Pillar 3). Fixed: all five strokes, not only line 116, plus the hex gate.
- R-03, gallery tile inline `--ratio` (fix 3). Fixed: the attribute-only sizer and the style gate. Note the review's CSP risk was weaker than stated (React sets custom properties through the CSSOM), and the gap was 11-UI-SPEC lines 48 and 51.
- R-04, lightbox prev and next on narrow screens (Pillar 2). Closed, already met: the C-35 tap zones (96 by 216 px at 320, in the tab order, focus ring, arrow keys, swipe; `GalleryLightbox.test.tsx` lines 167 to 243; GAL-02 "button alternative"). The visible-arrow question is parked as the item number from step 4.
- R-05, ProductLinesTab and TestimonialsTab empty state (Pillar 6). Closed, not a defect: ResponsiveTable renders EmptyState from their props, with the copy and test lines from this plan's context.
- R-06, sticky bar safe area (Pillar 5). Fixed: the bar padding and the scroll padding, plus tests. Note the inset is 0 until `viewport-fit=cover`, which is parked.
- R-07, SharePictureCard and PublicWebsiteCard states (Pillar 6). Closed, verified, with the reasons from the context.
- R-08, arbitrary spacing values (Pillar 5). Closed as allowed: 11-UI-SPEC Spacing declared exceptions (lines 145 to 153) and recipe box sizes.
- R-09, checks needing screenshots (Pillars 2 and 3, Further Notes: focal point, 60/30/10, 320px overflow, contrast, Espresso). Deferred: no dev servers on the shared machine, so this goes to the owner screenshot pass (11-UI-SPEC Visual Review, P11-BL-54).
- R-10, older style uses in AuthFrame and OrdersByStatusCard (Further Notes). Closed as allowed: P2 inline style rule, custom properties only, from before Phase 11.
- R-11, copy not compared string by string with the spec (Pillar 1). Deferred: this is a limit of the audit, not a defect, and new copy is reviewed by the owner before release (11-UI-SPEC line 33).

Bump `updated:` in the frontmatter.

3. `11-UI-SPEC.md`. Under Typography, after the inherited table (line 201), add one dated paragraph. It says the sizes in both tables are named theme tokens `text-N` with the same values, pinned by `web/src/test/public-look.node.test.ts`, and no look changed (owner, 2026-11-13, quick 261113-nqv; 11-UI-REVIEW R-01). In the SPEC-DEVIATION Register, add three rows with ID `11-UI-REVIEW fix 2`, `fix 3` and `fix 6`, and Ruling "Owner, 2026-11-13 (quick 261113-nqv)":
- App. E.4 map roads in hex. Phase 11 now uses the Blush tokens of the same values.
- Line 48: masonry ratios through `--ratio`. The drawn tile now uses an SVG sizer's viewBox, and photo tiles keep LazyImage.
- App. C `.s-mbar` 16px bottom padding. Phase 11 now uses 16px plus the safe area, as the admin tab bar does.

Bump `updated:` and the Updated value in the line under the title. Do not edit `docs/CSPS-UI-SPEC.md`.

4. `DECISIONS.md`. Find the highest P11-BL number (59 when this plan was written). Add three open items after it, before `## Flakes seen in the post-merge gates`, in the file's format (title line, `**Status:** open · **Blocks:** nothing.`, one plain paragraph, options with the recommendation first and a one-line reason, and a closing line pointing to 11-UI-REVIEW.md Outcomes and quick 261113-nqv):
- (a) "Lightbox arrows on phones (UI review R-04)". A (recommended): keep the approved C-35 tap zones, since they are large buttons with names, focus rings, arrow keys and swipe. B: also show 44px arrow buttons on phones, which changes the approved phone look.
- (b) "Edge to edge on notched phones (UI review R-06)". A (recommended): keep today's viewport, where the phone browser keeps the page out of the notch and home-bar area, and both bars now add the safe area if this is ever turned on. B: add `viewport-fit=cover` to every page and check notched phones in the screenshot pass; landscape would then also need side padding.
- (c) "Named font sizes for the admin and shared parts (UI review R-01)". A (recommended): one later quick task maps the 221 hand-typed sizes in 33 admin and shared files to the same `text-N` tokens (adding the missing sizes) and widens the gate to all of web/src. B: keep tokens on the public site only. Mention that the names follow the size (`text-14`) so each one reads as its value, and say how to choose role names instead if the owner wants them.

Bump the Updated value under the title.

5. Stage the three files by path, run gitleaks and the staged-diff scan, and commit as `docs(11-ui): record an outcome for every UI review finding and park three owner questions`.</action>
  <verify>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:/Work/dev-tools/preflight.ps1 -Ports 5180,5115,7028,5199 && npm --prefix web run test -- --run && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check && grep -c "^| R-" .planning/phases/11-public-site-content-management/11-UI-REVIEW.md && grep -c "11-UI-REVIEW fix" .planning/phases/11-public-site-content-management/11-UI-SPEC.md && grep -c "quick 261113-nqv" .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md</automated>
  </verify>
  <done>The full Vitest run passes with no warnings, and typecheck, lint and format:check exit 0. In 11-UI-REVIEW.md the R-row grep counts 11, with one outcome each (fixed, closed as already met, closed as not a defect, closed as allowed, or deferred with a reason), and `updated:` is bumped. 11-UI-SPEC.md has the Typography note and three register rows (the grep counts at least 3), with both timestamps bumped. DECISIONS.md has three new open owner items citing quick 261113-nqv (the grep counts at least 3) and a bumped Updated value. One docs commit holds the three files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| server to browser (CSP) | The strict CSP (no unsafe-inline) guards the SPA; markup must not depend on style attributes. |
| theme to every public page | app.css tokens and the public recipes style every public page; a wrong value spreads everywhere. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-nqv-01 | Tampering | GalleryMasonry drawn tile, web/src/modules/public | low | mitigate | The style prop goes; the sizer uses attributes only, and the public-look gate fails on any style prop in the module, so the CSP never needs style-src-attr relaxed for public markup. |
| T-nqv-02 | Denial of service (usability) | app.css --text-N tokens, nine public files | medium | mitigate | Tokens equal the old px values and carry no line-height (compile test). The whole-app class gate, the module tests and PublicLayout run before the commit. Any visible change is parked, not shipped (D-28). |
| T-nqv-03 | Information disclosure | docs and test files | low | mitigate | Test data reuses the fake fixtures (`publicFixtures.ts`). gitleaks and the staged-diff scan run before each commit, and no real name, email or local path enters a tracked file. |
| T-nqv-SC | Tampering | npm installs | high | mitigate | No install task exists. The executor runs no `npm install` or `npm ci` and stops to report if a package seems needed. |
</threat_model>

<verification>
- `npm --prefix web run typecheck`, `npm --prefix web run lint` and `npm --prefix web run format:check` exit 0 with no warnings.
- After the preflight, the full Vitest run `npm --prefix web run test -- --run` passes with no warnings. That run includes the new `src/test/public-look.node.test.ts`, the whole-app class gate, `no-long-dash.node.test.ts` and `source-layout.node.test.ts`.
- `git log --oneline -3` shows the three commits, and `git status --short` shows no stray tracked change from this run.
- No dev server, Playwright, e2e or parity run was started.

## Source coverage audit

| Source | Item | Covered by |
|---|---|---|
| GOAL | Fix the six listed findings, test first, and record an outcome for every review finding | Tasks 1 to 3 |
| CONTEXT | Owner rule: tokens of equal value, else a named token with the current value, no look change | Task 1 (23 `--text-N` tokens, `font-button`, map stroke tokens) |
| CONTEXT | Owner rule: TDD, zero warnings, no packages, OR-3 to OR-6, strict CSP, 44px targets | Tasks 1 and 2 (RED then GREEN), Task 3 full gates |
| CONTEXT | Owner rule: shared machine (Vitest, lint, typecheck only; preflight first) | Task 3 verify, Owner rules block |
| CONTEXT | Owner rule: final task records every outcome in 11-UI-REVIEW.md and bumps `updated:` | Task 3 step 2 |
| CONTEXT | Owner rule: flag look, wording or behavior changes as owner questions | Task 3 step 4 (three parked items) |
| CONTEXT | C-35 (phone tap zones) and 11 D-28 (no look change) kept | Task 3 R-04; Tasks 1 and 2 look-equal fixes |
| REQ | PUB-01 (public pages to UI-SPEC) | Task 1 |
| REQ | PUB-06 (phone sticky bar on Contact) | Task 2 |
| REQ | GAL-01 (masonry) | Task 2 |
| REQ | GAL-02 (button alternative on phones) | Task 3 R-04 (verified, no change) |
| REQ | CONT-02, CONT-03 (product lines and testimonials tabs) | Task 3 R-05 (verified, no change) |
| RESEARCH | none (quick task, no research phase) | not applicable |
</verification>

<success_criteria>
- No hand-typed font size or weight remains in web/src/modules/public. Every size is a pinned `text-N` token of the same value, and a test fails on drift.
- The Contact map draws with theme tokens, and no hex colour remains in public TSX outside the jersey and hero art.
- No element in web/src/modules/public sets a style attribute, and the drawn gallery tile keeps its exact ratio.
- The Contact sticky bar and its scroll padding include the device's safe area.
- Every finding in 11-UI-REVIEW.md has one recorded outcome, and the three owner questions are parked, not decided.
- No new package, no wording change, no visible look change, and no em or en dash in web/src.
</success_criteria>

<output>
Create `.planning/quick/261113-nqv-fix-phase-11-ui-review-findings/261113-nqv-SUMMARY.md` when done. Give it `created:` and `updated:` (offset -06:00), the three commit hashes, each quoted RED and GREEN result, the full-run tail, any flake, and the "Open for the owner" items with their P11-BL numbers.
</output>
