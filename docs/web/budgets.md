# Bundle budgets: what the build measures and what to do when it fails

*Created: 2026-10-09T03:15:00-05:00 · Updated: 2026-10-13T08:28:00-05:00*

Every `vite build` measures how much JavaScript and CSS a visitor's phone has to download before the first page appears, and the build **fails** when a number passes its limit (requirement PERF-01, plan 02-33). Nobody has to remember to check: `npm run build`, `npm run build:budget` and `npm run verify` all run the same check, and Phase 3 CI runs the same commands.

The code: `web/scripts/budget.ts` (the pure rules, tested with made-up chunk graphs in `budget.test.ts`) and `web/scripts/vite-budget-plugin.ts` (reads the real build output, wired in `web/vite.config.ts`).

## The three limits

| Measure | Limit (gzip -9) | Measured in |
|---|---|---|
| Public initial JS | **150 KB** | every build |
| Admin initial JS | **250 KB** | builds with the dev-only routes (`npm run build:budget`, the e2e build and the parity build) |
| CSS, all files together | **35 KB** | every build |

- Sizes are **gzip level 9**, the way the server compresses files, and **1 KB = 1000 bytes**.
- A value exactly at its limit passes: 150,000 bytes of public JS passes and 150,001 bytes fails.

## How "initial JS" is worked out

A route's initial JS is everything the browser must download before that route can show anything:

1. the entry chunk built from `index.html`,
2. the chunk of every route module the route renders on first load,
3. every chunk those chunks import statically, followed all the way down.

Each chunk is counted once, even when several of them import it. Chunks loaded later through a dynamic `import()` are not counted.

| Route | Route modules |
|---|---|
| Public (`/`) | `src/app/public/PublicLayout.tsx`, `src/app/public/PublicPlaceholderPage.tsx` |
| Admin (`/admin`) | `src/app/admin/AdminLayout.tsx`, `src/lib/url-state/UrlStateLayout.tsx`, `src/app/admin/AdminPreviewPage.tsx` |

A route module is usually the start of its own lazy chunk. In the parity build the parity page imports some of them directly, so they end up inside a shared chunk; the plugin then measures that shared chunk, because it is what the router downloads.

If a route module cannot be found in the build at all, the build fails. A renamed or moved route must update `PUBLIC_ROUTE` or `ADMIN_ROUTE` in `budget.ts`; the check never silently skips it.

## The builds

What a build is comes from its **Vite mode only** (`MODES` in `web/vite.config.ts`). No environment variable or `.env` file can turn the dev-only routes on in the build that ships: a production build with `VITE_DEV_ROUTES` set anywhere (the shell, CI, an untracked `.env.local`) stops with an error, and an unknown mode stops too (decision D-20, code-review finding TOOL-CR-01).

| Command | Mode | Output folder | What it measures |
|---|---|---|---|
| `npm run build` | `production` | `src/Csps.Server/wwwroot` (what ships) | public JS and CSS, plus the "no dev code" rules below |
| `npm run build:budget` | `budget` | `web/.budget-dist` (git-ignored) | public JS, admin JS and CSS with the admin routes built in |
| `npm run build:e2e` (run by `npm run e2e`) | `e2e` | `web/.e2e-dist` (git-ignored) | the same as the budget build |
| `npm run parity` (its app build) | `parity` | `web/.parity-dist` (git-ignored) | the same, with the parity page added |

`npm run verify` runs `build` and then `build:budget`, so both are checked every time.

**The parity page is in the parity build only** (orchestrator-approved measurement fix, 2026-10-13). `parity.html` is a test-only page that imports nearly every component. Built into the budget and e2e builds, it reshaped the shared chunks the public route loads and added about 0.3 KB that no visitor ever downloads. So the budget and e2e builds have `index.html` as their only entry and measure the **shipped topology** with the admin routes added, and they fail if a second entry appears. The parity build keeps the page as a second entry, still meets every limit, and never measures the page as a route. The limits themselves did not change.

## Rules that fail the build besides the limits

- **Exactly one CSS file.** All app styles come from the one Tailwind entry (`src/styles/app.css`, decision D-33). A second CSS file means a stylesheet was imported somewhere else, so the build stops and names both files.
- **No dev code in production** (decision D-20, CWE-489). The production build fails when any chunk ships code from `src/app/admin/`, `src/dev/` or `web/visual/`, or when it has an entry other than `index.html`. These rules follow the mode, never a flag.
- **Only the parity build has a second entry.** The budget and e2e builds fail on any entry other than `index.html`; the parity build allows `parity.html` and nothing else. Modules that the build reduced to nothing (for example `src/app/admin/routes.tsx` behind the literal-false `__DEV_ROUTES__`) do not count, because no code of theirs ships.
- **No parity reference output.** No build may emit a file from a `.reference-dist` or `.reference-src` folder, and after writing, the production web root (`wwwroot`) must hold neither folder (plan 02-13).

## The numbers file

Every build writes its numbers to the git-ignored `artifacts/budget/` folder at the repository root:

- `budget.json`: the latest build,
- `budget.<mode>.json`: the latest build of each mode (`budget.production.json`, `budget.budget.json`, `budget.e2e.json`, `budget.parity.json`).

Each file holds `mode`, `build` (`production`, `dev-routes` or `parity`), the `limits`, `publicJs`, `adminJs` (`null` in production), `css`, every measurement with its file list, the `errors` and the `notes`. The build also prints the size table.

## The 135 KB note (Phase 4 barrel split)

In the dev-route builds the public number is the **admin-included topology**: what the public site would load if the admin routes were built in, as they will be in Phase 4. When that number passes **135 KB**, the build prints a note (not a warning, and not a failure):

> Note: public JS in the admin-included topology is … KB, past the 135.00 KB trigger for the Phase 4 barrel split (research Flag 4).

It tells Phase 4 to split the component barrels (`src/ui/*/index.ts`), so that public pages stop pulling admin-only components into the shared chunks. The 150 KB limit still applies to this number.

Measured at plan 02-33 (2026-10-09):

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production | 129.94 KB | — | 12.90 KB |
| Budget (admin + parity page) | 149.34 KB | 154.48 KB | 12.90 KB |

The budget build's public number is high mostly because the parity page shares many components with the public layout, so they land in shared chunks the public route has to load. The same build without the parity page measured 137.96 KB public and 142.86 KB admin.

Measured after the parity page left the budget and e2e builds (2026-10-13, code-review fix):

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production | 130.40 KB | — | 12.92 KB |
| Budget and e2e (admin, no parity page) | 149.70 KB | 154.86 KB | 12.92 KB |
| Parity (admin + parity page) | 149.99 KB | 155.13 KB | 12.92 KB |

Since plan 02-34 the dev-only showcase (`/dev/components`) also imports nearly every component, so without the parity page the budget build saved only 0.29 KB. The real cause was the barrels, fixed next.

## Public route imports

The public layout (`src/app/public/PublicLayout.tsx`) imports `SiteHeader`, `SkipLink` and `ToastProvider` from their own modules, never from the `@/ui/navigation`, `@/ui/entry` or `@/ui/feedback` barrels. A barrel re-exports admin-only components (Sidebar, Topbar, UserMenu, MobileNavDrawer, MoneyInput, ...). In a build that uses them (the admin routes, the showcase, the parity page) the bundler cannot drop them, so a public module that imports the barrel pulled them, and the forms, overlays and HTTP-client modules they need, into the chunks the public route loads. In production it also kept about 4 KB of their module-level code. Keep new public-route imports on the component modules; the Phase 4 barrel split (research Flag 4) makes this the rule for every barrel.

Measured after that change (2026-10-13, code-review fix):

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production | 126.18 KB | — | 12.92 KB |
| Budget and e2e | 131.57 KB | 156.43 KB | 12.92 KB |
| Parity | 131.13 KB | 155.88 KB | 12.92 KB |

The dev-route public number is now under the 135 KB barrel-split trigger, so those builds no longer print the note.

## When the build fails

1. **Read the table and the error lines.** They name the measure, its size, its limit, and for the rule failures the chunk and module or the CSS files.
2. **Open `artifacts/budget/budget.json`** to see which files each route loads.
3. **Find the cause** before changing anything. Typical causes:
   - a component or library imported into the entry or a public route that only an admin screen needs,
   - a static import that should be a lazy route or a dynamic `import()`,
   - a stray `import './something.css'` (the one-CSS rule),
   - a dev-only module reached from production code.
4. **Fix the cause.** If the only fix would change how the app behaves or looks, stop and take it to the owner with the table.

**Never raise a limit** to make a build pass, and never add an exception for a file. The limits are the owner's performance promise for visitors on phones (PERF-01).
