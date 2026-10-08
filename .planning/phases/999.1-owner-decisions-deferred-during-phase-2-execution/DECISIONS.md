# Owner decisions deferred during Phase 2

*Created: 2026-10-07T23:22:00-05:00 · Updated: 2026-10-07T23:22:00-05:00*

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
