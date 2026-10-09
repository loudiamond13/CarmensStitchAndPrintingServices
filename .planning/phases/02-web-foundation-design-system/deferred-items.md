---
created: "2026-10-08T20:20:00-05:00"
updated: "2026-10-09T03:22:00-05:00"
---

# Phase 02 deferred items

Out-of-scope findings logged by plan executors (not fixed by the plan that found them).

## Deferred Items

- Intermittent pixel difference in the forms parity group, Chromium, light theme, 1440px, focus-visible
  status: open
  **Found by:** plan 02-23, during the Chromium regression of every group (`--grep "@parity|@reference" --project chromium`).
  **What:** `field-multiline` (first run) and then `field-hint` (a rerun of `@forms`) failed their pixel step with 5 differing pixels. Every differing pixel sits at x 1437–1439 (the right edge of the 1440px viewport), on the anti-aliased rounded right corners of the field box with its focus ring. Computed styles and boxes were equal.
  **Why deferred:** plan 02-23 changed nothing in the forms group. Repeated runs of the same rows passed (`--repeat-each 3`: 6 of 6), and a third full `@forms` run passed 16 of 16. It looks like an anti-aliasing race on the corner pixels at the viewport edge under parallel load. No tolerance was added.
  **Next step:** whoever next owns the forms group or the harness should trace a failing run (`-- --trace on`) and check whether the focus ring's transition or the edge rasterization differs between the two pages.
  **Update (plan 02-24):** the data group hit the same race at 390 px (x 388–389, rounded corners of the table frame and the order cards), on either side and from run to run, with equal computed styles, boxes and compositing layers. Plan 02-24 turned off Chromium partial raster in `web/visual/playwright.visual.config.ts` (`--disable-partial-raster`) and scrolls each rest case into view before the repaint. Reproductions under parallel load went from 3 of 20 differing to 25 of 25 equal, and the Chromium regression of every group then passed 109 of 109. Leave this open until later plans' regressions confirm the forms focus-visible rows stay equal.

- Dev-route builds: public JS has 0.66 KB of headroom under the 150 KB budget (plan 02-33, build risk, not failing today)
  status: open
  **Found by:** plan 02-33, the first measured budget build (`npm --prefix web run build:budget`).
  **What:** the production build is well inside the budget (public JS 129.94 KB, CSS 12.90 KB). The dev-route builds (budget, e2e and the app side of parity, all with the admin routes and the parity page) measure public JS at **149.34 KB** against the 150 KB limit, and admin JS at 154.48 KB. The parity page imports most components directly, so they land in shared chunks that the public route also loads. The same build without the parity page measured 137.96 KB public and 142.86 KB admin. Either way the 135 KB Phase 4 barrel-split trigger (research Flag 4) has already fired, and every dev-route build prints that note.
  **Why deferred:** nothing is over a limit, and the plan applies the 150 KB limit to every build and forbids raising it. The fix is a structure change: split the `src/ui/*/index.ts` barrels (the planned Phase 4 work), or stop measuring the parity page's topology in the budget build (a change to what is measured, so it needs a decision).
  **Next step:** if a later plan (for example 02-34's showcase) makes `build:budget`, `npm run e2e` or `npm run parity` fail on public JS, do not raise the limit. Bring the numbers from `artifacts/budget/budget.json` to the planner or owner and choose between splitting the barrels now and building the budget mode without the parity entry. See docs/web/budgets.md.

## Owner decisions pending

- ErrorState "Try Again" label colour (plan 02-28, look question, not blocking)
  status: open
  **What:** App. C has the rule `.s-banner.is-danger span { color: var(--ink-muted) }`. The secondary Button puts its label in a `<span>`, so in the approved App. E.8 rendering the "Try Again" label inside the error banner is the muted brown/grey (`--ink-muted`) instead of the secondary button's usual `--ink`. Plan 02-28 kept the approved computed look (the banner recipe carries the rule as written, `[&_span]:text-ink-muted`). Contrast still passes AA in both themes (axe clean in three engines).
  **Before / after if the owner chooses to change it:** today "Try Again" in the red error banner looks a little lighter than other secondary buttons; the change would make it the same dark text as every other secondary button.
  **Question for the owner:** keep the muted "Try Again" label exactly as the approved design renders it, or make it the normal button text colour? Either answer is a one-line recipe change in `web/src/ui/states/states.recipe.ts` (`bannerClasses`).

- Users table: the name and the avatar initials in the user cell are small and muted (plan 02-30, look question, not blocking)
  status: open
  **What:** App. B has `.csp-cell-user span { color: var(--ink-muted); font-size: 12px }`. In App. E.12 the user cell is `<span class="csp-cell-user"><Avatar/><span><strong>Name</strong><span>You</span></span></span>`, so that rule also reaches the avatar (a span) and the span wrapping the name. In the approved rendering the person's name is therefore 12px `--ink-muted` (the same size and colour as the "You"/role line under it, only bolder), and the avatar initials are `--ink-muted` instead of `--ink`. It looks like the rule was meant only for the sub line. Plan 02-30 kept the approved computed look (UI-SPEC rule 8): `UserCell` in `web/src/ui/lists/cells.tsx` and the new Avatar `cellUser` context reproduce it, and the parity suite proves it equal in three engines.
  **Before / after if the owner chooses to change it:** today the name in each Users row reads as small grey-brown text; the change would show it at the table's 14px in the normal dark ink, with the "You"/role line staying small and muted, and the initials in the normal dark ink.
  **Question for the owner:** keep the names small and muted exactly as approved, or make the name 14px dark text (a ruling in `web/visual/reference/rulings.css` plus a two-class change in `lists.recipe.ts` and the Avatar context)?

- Search box: no visible keyboard focus ring (plan 02-30, accessibility question, not blocking the build)
  status: open
  **What:** App. C gives the list search input `.s-search-box input { outline: none }` and, unlike the topbar search (`.csp-search:focus-within`), no focus style on the box. In the approved design a keyboard user who tabs into the list search therefore sees no focus indicator (WCAG 2.4.7 Focus Visible, level AA, which the project requires). axe cannot detect this. Plan 02-30 kept the approved look (the SearchBox matches App. E.7 exactly in three engines).
  **Before / after if the owner chooses to change it:** today the search box looks the same whether or not it has keyboard focus; the change would give it the same focus look as the other fields (the border and a 1px ring in the focus colour) while it has focus. Nothing changes at rest.
  **Question for the owner:** add the field focus look to the list search box (recommended for WCAG 2.4.7), or keep it exactly as approved?

- Tablet list tables: the page can scroll sideways by 22px (plan 02-30, look/behaviour question)
  status: open
  **What:** the visually hidden "Actions" column header text is absolutely positioned (App. B `.csp-sr`), and the table frame (`.s-rt-wrap`) is not positioned, so the text is placed against the page instead of the frame. When a table is wider than its frame on a tablet and scrolls inside it (UI-SPEC "overflow | ResponsiveTable at tablet"), that invisible text sits past the frame's right edge and lets the whole page scroll sideways a little (22px at 768px wide in the Users table). Nothing visible moves; the page just gains a small sideways scroll. The UI-SPEC says the page never scrolls sideways. Plan 02-30 tried containing the text in the frame (`contain: paint`); it changes no pixel, but the parity proof reports the hidden text's computed position as different from the approved CSS, so it needs the owner. `web/visual/lists-overflow.spec.ts` records today's result (only the hidden text reaches past the viewport).
  **Before / after if the owner chooses to change it:** today, on a tablet, a list page whose table scrolls sideways can also be nudged sideways by about 22px; after the change only the table scrolls and the page stays put. No visible change otherwise.
  **Question for the owner:** contain the hidden header text in the table frame (recorded as a new intentional difference in the rulings layer), or keep the approved behaviour?

- Admin top bar: the page scrolls sideways on phones narrower than 398px (plan 02-31, look/behaviour question)
  status: open
  **What:** in the admin shell the approved Topbar holds the menu button, the search box, the theme toggle and the user button in one row. App. B lets the search box shrink only to its contents (about 234px, set by the search field's own width), so below a 398px-wide page the row is wider than the screen and the whole admin page scrolls sideways: by 8px at 390px (the approved phone frame) and by 78px at 320px. The approved CSS does the same (the 02-26 Topbar and the 02-31 shell parity cases are equal at 390 in three engines and at 320 in Chromium), so plan 02-31 kept it. The UI-SPEC says 320 to 1920px with no horizontal scroll (WCAG 1.4.10 Reflow). `web/e2e/admin.spec.ts` checks the boundary widths 767/768/1023/1024, not 320, for this reason.
  **Before / after if the owner chooses to change it:** today, on a phone under 398px wide, the admin page can be nudged sideways and the user button sits partly off screen; after the change the search box gets narrower on small phones (its placeholder is cut shorter) and everything fits. Nothing changes at 398px and wider.
  **Question for the owner:** let the admin search box shrink on small phones (recommended; a one-class change, `min-w-0`, on the search box in `web/src/ui/navigation/navigation.recipe.ts`, plus a matching rulings rule), or keep the approved behaviour?

- Admin preview pages: the empty-state words (plan 02-31, copy question, not blocking)
  status: open
  **What:** the UI-SPEC gives each dev-only admin preview page its h1 (the section name), the subline "Development only. This screen is built in a later phase.", an empty state with the section's icon and the "Open Component Showcase" button, but no words for the empty state's own heading and line, which the EmptyState needs. Plan 02-31 used plain wording, kept in one place (`web/src/app/admin/copy.ts`): heading "Nothing to show here yet", line "Until this screen is built, the Component Showcase shows every shared building block." These pages exist only in development builds (D-20) and Phase 4 onwards replaces them.
  **Question for the owner:** keep this wording, or give your own?

- FYI (no decision needed unless the owner objects): admin sidebar names on the tablet rail (plan 02-31, accessibility fix with no visible change)
  status: open
  **What:** on tablets (768 to 1023px) the approved design shrinks the sidebar to an icon rail and hides the item labels, which also removes the links' spoken names: a screen reader announced the rail items as just "link" (axe `link-name`, WCAG 4.1.2). The converted Sidebar now names each item from its own label (`aria-labelledby`), so the names are the same as on desktop and survive on the rail. Nothing visible changes, and the parity proof still compares the look in full (the reference side gets the same attribute). The same pattern as the earlier DefinedTotalsNote and KeyboardScrollTable accessibility fixes.
  **Question for the owner (optional):** none needed; say so if you would rather the rail show tooltips (`title`) as the collapsed sidebar does.

