---
created: "2026-10-08T20:20:00-05:00"
updated: "2026-10-09T01:35:00-05:00"
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

