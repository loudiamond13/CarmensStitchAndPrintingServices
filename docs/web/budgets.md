# Bundle budgets: what the build measures and what to do when it fails

*Created: 2026-10-09T03:15:00-05:00 · Updated: 2026-10-09T03:15:00-05:00*

Every `vite build` measures how much JavaScript and CSS a visitor's phone has to download before the first page appears, and the build **fails** when a number passes its limit (requirement PERF-01, plan 02-33). Nobody has to remember to check: `npm run build`, `npm run build:budget` and `npm run verify` all run the same check, and Phase 3 CI runs the same commands.

The code: `web/scripts/budget.ts` (the pure rules, tested with made-up chunk graphs in `budget.test.ts`) and `web/scripts/vite-budget-plugin.ts` (reads the real build output, wired in `web/vite.config.ts`).

## The three limits

| Measure | Limit (gzip -9) | Measured in |
|---|---|---|
| Public initial JS | **150 KB** | every build |
| Admin initial JS | **250 KB** | builds with the dev-only routes (`npm run build:budget`, and the e2e and parity builds) |
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

A route module is usually the start of its own lazy chunk. In the dev-route builds the parity page imports some of them directly, so they end up inside a shared chunk; the plugin then measures that shared chunk, because it is what the router downloads.

If a route module cannot be found in the build at all, the build fails. A renamed or moved route must update `PUBLIC_ROUTE` or `ADMIN_ROUTE` in `budget.ts`; the check never silently skips it.

## The two builds

| Command | Output folder | What it measures |
|---|---|---|
| `npm run build` | `src/Csps.Server/wwwroot` (what ships) | public JS and CSS, plus the "no dev code" rules below |
| `npm run build:budget` | `web/.budget-dist` (git-ignored) | public JS, admin JS and CSS with the admin routes and the parity page built in |

`npm run verify` runs `build` and then `build:budget`, so both are checked every time.

The parity page (`parity.html`) is only an extra entry of the dev-route builds. It is **never measured** as a route.

## Rules that fail the build besides the limits

- **Exactly one CSS file.** All app styles come from the one Tailwind entry (`src/styles/app.css`, decision D-33). A second CSS file means a stylesheet was imported somewhere else, so the build stops and names both files.
- **No dev code in production** (decision D-20, CWE-489). The production build fails when any chunk ships code from `src/app/admin/`, `src/dev/` or `web/visual/`, or when it has an entry other than `index.html`. Modules that the build reduced to nothing (for example `src/app/admin/routes.tsx` behind the literal-false `__DEV_ROUTES__`) do not count, because no code of theirs ships.
- **No parity reference output.** No build may emit a file from a `.reference-dist` or `.reference-src` folder, and after writing, the production web root (`wwwroot`) must hold neither folder (plan 02-13).

## The numbers file

Every build writes its numbers to the git-ignored `artifacts/budget/` folder at the repository root:

- `budget.json`: the latest build,
- `budget.<mode>.json`: the latest build of each mode (`budget.production.json`, `budget.budget.json`, ...).

Each file holds `mode`, the `limits`, `publicJs`, `adminJs` (`null` in production), `css`, every measurement with its file list, the `errors` and the `notes`. The build also prints the size table.

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
