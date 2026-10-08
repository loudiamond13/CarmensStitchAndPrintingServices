# The look-equality proof: the parity reference and how to run it

*Created: 2026-10-08T12:52:08-05:00 · Updated: 2026-10-08T12:52:08-05:00*

This page explains the automated proof that the web app looks the way the owner approved (requirement WEB-02, decision D-33). The app is styled with Tailwind utilities, not with the spec's `.csp-*` / `.s-*` stylesheets, so a test has to show that the two render the same. It does that by rendering every case twice, in the same browser and the same run:

- **The reference**: the approved design itself. These are the CSS appendices of `CSPS-UI-SPEC.md` (App. A–C, compiled exactly as App. A.2 wires them) and the frozen App. D.3 components, plus a small, test-only **rulings layer** with the owner's look decisions. It lives in `web/visual/reference/`.
- **The implementation**: the real converted components, rendered by the dev showcase (plan 02-14).

Both sides render the **same scenario list** (`web/src/dev/scenarios/`) through the **same** `renderNode`, so they always compare one tree.

> **The reference never ships.** It builds into the git-ignored `web/.reference-dist/` from a git-ignored copy of the spec (`web/visual/.reference-src/`). Neither folder is ever committed or copied into `wwwroot`.

## 1. What the proof compares

For each case, in chromium, firefox and webkit:

1. **Computed styles**: about 80 visual properties per element, walked in DOM order (including `::before`/`::after`), and each element's box relative to the case, exact to 0.01 px.
2. **Pixels**: a screenshot of each case, with no pixel allowed to differ.
3. **Zero axe violations and zero Content-Security-Policy violations** on both sides.

The comparator itself (step 1 and 2) comes with plan 02-14. Plan 02-13 built the reference side: the reference app, the rulings layer, the route-served harness and the runner.

The only normalizations allowed are these:

- repeated entries in transition lists collapse to one;
- border and outline style and colour are ignored on a side whose width is 0;
- hidden (`display: none`) parts are skipped;
- icon drawings are masked (only the icon's box, colour and stroke are compared, D-32);
- transforms are compared by box and pixels, not by their CSS text;
- attributes are not compared.

## 2. Where everything is

| File | What it does |
|---|---|
| `web/visual/reference/extract-spec.mjs` | Copies the nine spec appendices, byte for byte, into `web/visual/.reference-src/`. It refuses (exit 1, writes nothing) when their SHA-256 differs from the committed pin `spec-appendix.sha256` (plan 02-38). |
| `web/visual/reference/index.html`, `main.tsx` | The reference page. It reads `?theme`, `?group` and `?case` from the address and renders each selected scenario in a `[data-case="<id>"]` frame with the `.s-page` class and `data-theme`. |
| `web/visual/reference/select.ts` | How the page picks its cases (see section 4). |
| `web/visual/reference/kit.ts` | The frozen App. D.3 components, plus any layout fragments in `web/visual/reference/fragments/` (App. E.1/E.6 shell markup, plans 02-29 to 02-31). |
| `web/visual/reference/reference.css` | The verbatim App. A.2 stylesheet chain, then `rulings.css`. |
| `web/visual/reference/rulings.css` | The owner rulings, as unlayered rules on the spec classes (section 6). Pinned by `rulings.test.ts`. |
| `web/visual/vite.reference.config.ts` | Builds the reference into `web/.reference-dist/`, with plain React (no React Compiler) and Tailwind. |
| `web/visual/serve.ts` | Serves a dist folder through Playwright's `page.route` on an `https://` origin, with the production `StrictCsp` read from `src/Csps.Server/Http/SecurityHeadersMiddleware.cs`. No port, no API host, no database. |
| `web/visual/guard.ts` | Imported by every visual spec. It fails a test on console errors or warnings, page errors, CSP violations and failed requests, and `expectCases(page)` fails a page whose filter selected nothing. |
| `web/visual/playwright.visual.config.ts` | The visual suite: chromium, firefox, webkit, no web server. |
| `web/scripts/parity.mjs` | `npm run parity`, described next. |

## 3. Run it

Before a run, do the shared-machine preflight. `npm run parity` also runs it for you:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
```

If TheBETSLLC's test processes are listed, **wait** and try again later. The parity suite opens no port, but it is still a Playwright run. Never stop another project's process.

Then run:

```powershell
npm --prefix web run parity -- --grep <tag>
```

For example, `--grep @reference` runs the reference smoke test, and `--grep @parity` runs the comparison (plan 02-14). Add `--project webkit` to run one engine. `npm run parity` does this, in order:

1. Takes the run lock `web/.locks/parity.lock`. A second run waits for it, up to 15 minutes, then stops and asks you to try again. Never delete a lock another run holds.
2. Runs the preflight report.
3. Runs the spec extraction. If the owner edited an appendix of `CSPS-UI-SPEC.md`, the pin no longer matches, and the run **stops here** before anything is built. Re-pinning (`node web/visual/reference/extract-spec.mjs --repin`) is a manual step, done only after the owner's edit has been reviewed. No script passes `--repin`.
4. Builds the reference into `web/.reference-dist/`.
5. Runs the visual Playwright suite with your arguments.

A `--grep` that matches no test fails the run (Playwright reports "No tests found" and exits 1), so a mistyped tag never passes.

## 4. Pick cases with the address

| Parameter | Meaning |
|---|---|
| `theme` | `light` (the default) or `dark`. Any other value selects nothing. |
| `group` | Only the scenarios of that group (the group file's name, for example `actions`). |
| `case` | Only the scenario with that id, for example `button-primary-md`. |

A scenario renders only in the themes it lists (public scenarios are light only, D-14). A scenario with `frame: 'viewport'` (a fixed-position overlay) renders only when its `case` is asked for, one case per page load.

**An empty selection fails.** When nothing matches, the page shows a `data-parity-empty` marker instead of any case, and `expectCases(page)` throws. A typo in a filter can never make a test pass without comparing anything.

## 5. Add scenarios for a component you convert

1. Add the cases to `web/src/dev/scenarios/groups/<group>.ts`. A new group is a new file whose name is the group, and the file exports `scenarios`. Every case needs a unique `id`, and its `group` must equal the file name.
2. Props are plain data only (strings, numbers, booleans, `null`, arrays, plain objects). A nested element is `{ kind: 'node', component, props }`. Event props such as `onClick` are listed by name in `handlers`, and each one gets a no-op function. The list refuses functions and class instances when it loads, and names the scenario and the prop.
3. Prop states (disabled, selected, current, invalid, collapsed) are separate scenarios. `states` lists only the interaction states the harness drives: `rest`, `hover`, `focus-visible`, `active`.
4. Set `parity: false` for SPEC-GAP primitives that have no reference (Pagination, OtpInput, MoneyInput, Checkbox, SkipLink, the ResponsiveTable loading/error/empty/refetching states, LazyImage, ErrorState, the Skeleton family, MobileNavDrawer, UserMenu). They still run axe and the CSP check, and the owner reviews them in the screenshots (D-23).
5. If the component is a layout that the frozen components don't cover, add its App. E fragment as a component in `web/visual/reference/fragments/<Name>.tsx`. The kit picks it up by its export name.
6. Run `npm --prefix web run parity -- --grep @reference` and check that the case renders: no `Missing component: <name>` alert, and no guard findings.

## 6. The intentional differences (the complete list)

Everything not in this table must be equal. Each ruling sits in `web/visual/reference/rulings.css` under a comment that starts with its decision ID, and `rulings.test.ts` checks the list.

| Difference | Decision | How the proof treats it |
|---|---|---|
| Phone text-entry fields (search box, toolbar, item rows) use 16px text | D-01 | Rulings layer, so equal |
| Inactive rows sit on `--surface-2` with no opacity fade | D-02 | Rulings layer, so equal |
| Five faded spec texts at full opacity: input placeholder, Manager tag, CTA lead, filter-pill count, big-button caption | D-02 (FYI-01) | Rulings layer, so equal |
| Bold (700) current/selected tab, site link, sidebar item and tab-bar item; the checkbox dark border and tick | D-03 | Rulings layer, so equal (Checkbox itself is SPEC-GAP) |
| Thumb grip and actions show on keyboard focus, and always on touch | D-05 | Rulings layer (touch pass), so equal |
| Sidebar Logout is a `<button>` instead of `<a href="#">`, with the same look | D-27 | Rulings layer plus a structural exception in the pairing; computed styles and pixels equal |
| Current public drawer link is italic | D-31 O-3 | Rulings layer, so equal |
| Reduced motion stops the skeleton shimmer and the modal and toast entry animations | O-6 | Rulings layer (reduced-motion pass), so equal |
| "Manager" tag hidden on the current sidebar row | D-31 D-BL-02 | Rulings layer, so equal |
| A pending (`aria-disabled`) button looks like the disabled button | WEB-09 | Rulings layer, so equal |
| Metric-matched fallback faces in the font stacks | PERF-05 | Rulings layer, identical to `web/src/styles/base.css`, so equal once the fonts load |
| 20 redrawn lucide icons | D-32 | Drawing masked, the icon's box compared |
| `lucide lucide-<name>` classes; Avatar and Testimonial `role="img"`; Tabs ARIA; the Modal focus trap | D-28, D-31 O-1/O-2, WEB-02 | Attributes are not compared, and there is no visual change |
| Danger and warning toasts persist; the toast stack is always mounted; timers pause | D-04, D-31 O-5, O-7 | Behaviour tests, no visual difference at rest |

The phone list-card title separator is **not** a difference. The owner kept the approved result (the last card has no separator), so the implementation must match the spec there too.

A per-case tolerance needs a recorded reason that the owner can see. A new look change is a new owner decision (D-08): add it here, in `rulings.css` and in `rulings.test.ts` together.

## 7. Rules that keep the proof honest

- **The reference never ships.** `web/.reference-dist/` and `web/visual/.reference-src/` are git-ignored, nothing in `web/src` imports the reference, and only `reference.css` imports `rulings.css` (a test checks this).
- **No weaker CSP.** Both sides are served with the production `StrictCsp`, read from the server source at run time. Nothing bypasses the CSP.
- **No stored baselines.** Both sides render in the same browser in the same run, so font rendering on Windows and on the ubuntu CI runner never has to match.
- **The frozen code stays frozen.** The spec copy is never edited, linted or type-checked; `kit.ts` loads it at build time. To change the yardstick, the owner edits `CSPS-UI-SPEC.md` and the pin is updated by hand after review.
