# Owner decisions deferred during Phase 2

*Created: 2026-10-07T23:22:00-05:00 · Updated: 2026-10-08T00:16:00-05:00*

The owner was away while Phase 2 ran (`/gsd-execute-phase 2`, then `/gsd-verify-work 2` and `/gsd-secure-phase 2`). Anything that needed the owner was parked here instead of blocking the run. Nothing listed here was decided for the owner: each item stays open until the owner picks an option.

## D-BL-01 · Three more free licenses for the dev/build tool tree (plan 02-03)

**Status:** open · **Raised:** 2026-10-07 · **Blocks:** plan 02-03's check "`node web/scripts/license-gate.mjs` exits 0", and plan 02-16, which wires the license gate into `verify`.

**What happened.** The new npm license gate passes for everything that ships to the browser (16 packages: MIT, ISC and the OFL fonts). The dev/build tree has 522 packages, and five of them use a license that is not in the owner's D-26 list. None of them ships to the browser, and none costs anything.

| License (plain words) | Packages | Pulled in by | Use |
|---|---|---|---|
| **MIT-0**: the MIT license without even the "keep the copyright notice" condition. Free, with fewer conditions than MIT. | @csstools/color-helpers 6.1.1, @csstools/css-syntax-patches-for-csstree 1.1.14 | jsdom 30.1.1 (the test DOM) | tests |
| **CC-BY-3.0**: free data license, credit the authors. An older version of CC-BY-4.0, which is already approved. | spdx-exceptions 2.5.0, spdx-ranges 2.1.1 (MIT AND CC-BY-3.0) | license-checker-rseidelsohn 5.0.1 (the license gate tool itself) | tool |
| **Python-2.0**: the Python Software Foundation license. Free and permissive like BSD; keep the notice. | argparse 2.0.1 | openapi-typescript 7.13.0 → @redocly/openapi-core → js-yaml (tools/openapi-gen) | tool |

**Options**

- **A (recommended): approve all three as dev/build-only exceptions**, on the same terms as D-26 (license-level, never allowed in the production tree). No package changes are needed. With these three added, the gate passes: 16 production packages, 522 dev packages and no stale exceptions.
- **B: reject some or all.** Each rejection means replacing a package, and each replacement needs its own approval. Rejecting CC-BY-3.0 replaces the license-gate tool with hand-rolled code. Rejecting MIT-0 replaces jsdom (for example with happy-dom). Rejecting Python-2.0 replaces openapi-typescript (D-16).
- **C: keep deferring.** The gate stays red until a decision is made.

**Current state:** option C applied by default because the owner is away. Plan 02-03 is otherwise complete, and its SUMMARY records this check as open.

**To apply option A later:** add three `npmLicenseExceptions` entries to `docs/license-exceptions.json` (dev-only, with this decision's ID), add a D-26 addendum line to `02-CONTEXT.md` and a line in `docs/dependencies.md`. Then re-run `node web/scripts/license-gate.mjs` and `npm --prefix web run verify`.

## D-BL-02 · The "Manager" tag disappears on the selected Users menu row (plan 02-05)

**Status:** open · **Raised:** 2026-10-08 · **Blocks:** nothing yet (no admin screen uses it until plan 02-15). Best settled together with the O-1..O-8 owner confirmations and the D-23 screenshot review.

**What happened.** In the approved design CSS (UI spec Appendix B), the small "Manager" tag in the admin sidebar uses the same color as the highlight of the selected row. When **Users** is the current page, the tag text matches its background, so it can't be read: 1.00:1 contrast in Blush and 1.43:1 in Espresso, against the 4.5:1 minimum (WCAG 1.4.3). The executor did not change it, because any fix changes the approved look (rule D-08: visual changes go to the owner with a before/after).

**Options**

- **A (recommended): show the tag in the "text on primary" color when its row is selected**, one rule in `overrides.css` with this decision's ID: `.csp-nav.is-on .csp-nav-tag { color: var(--on-primary); }`. The tag then reads like the row's own label.
- **B: hide the tag on the selected row.** The page title already says where you are.
- **C: keep the approved look** and accept the WCAG failure. Not recommended, because the project target is WCAG 2.2 AA with zero axe violations.

Full finding: `.planning/phases/02-web-foundation-design-system/deferred-items.md`.

## FYI-01 · Five faded texts made slightly darker for readability (plan 02-05, no action needed)

Under your existing ruling **D-02** (no text below 4.5:1 contrast), plan 02-05 set five spec texts back to full opacity: the input placeholder, the "Manager" tag, the call-to-action lead text, the filter-pill count and the big-button caption. Four of them failed when faded; the worst was the pill count, at 3.32:1 in Blush. The visible effect is that these five texts look a little darker than in the design file. Entry animations and two decorative elements keep their fade. You'll see this in the D-23 screenshot review (plan 02-18). Say so if you'd rather handle any of them differently.
