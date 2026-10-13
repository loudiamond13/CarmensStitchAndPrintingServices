# Release gates: every check the web app must pass, and the order to run them

*Created: 2026-10-09T04:45:00-05:00 · Updated: 2026-10-13T09:40:00-05:00*

This page lists every automated gate for the web app (Phase 2, plan 02-35), the command that runs it and the rule it passes on. Run them in the order of section 3 before `/gsd-verify-work`. A gate that fails is fixed in the code. **No gate is ever passed by loosening a limit, adding a tolerance or skipping a check.** If the only fix would change how an approved screen looks, its words or its accessibility structure, stop and take it to the owner (decision D-08).

> **This machine is shared** with another project (TheBETSLLC). Before any gate that starts a server or a browser (E2E, parity, Lighthouse, and the full `verify` run), run the **preflight** and read its report:
>
> ```powershell
> powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
> ```
>
> If a port is in use by another project, or TheBETSLLC's test processes are listed, **wait** and try again later. Never stop another project's process. The E2E, parity, Lighthouse and owner-review runners also run this preflight themselves, read it, and wait (up to 15 minutes, then exit 1) while a port of this project is in use by another program or TheBETSLLC's dev/test processes are listed (`web/scripts/shared-machine.mjs`, TOOL-WR-08); they also refuse to start when port 5199 is busy.

## 1. The gates

| Gate | Command | Passes when | Guide |
|---|---|---|---|
| Full web check | `npm --prefix web run verify` | Every step below exits 0, with zero warnings: `typecheck` (three TS programs), `lint` (`--max-warnings 0`), `format:check`, `test:coverage` (thresholds: 90% overall, 100% for `src/lib/http`), `build` (production into wwwroot, with the budget gate), `build:budget` (the dev-route topology), `license:check`, `notices:check`. | [budgets.md](budgets.md), [styling.md](styling.md) |
| Type check | `npm --prefix web run typecheck` | `tsc` passes for the app, node and reference programs. | — |
| Lint | `npm --prefix web run lint` | ESLint reports nothing (errors and warnings both fail). | [styling.md](styling.md) |
| Formatting | `npm --prefix web run format:check` | Prettier finds no file to change. | — |
| Unit and component tests | `npm --prefix web run test:coverage` | Every Vitest test passes (component tests include axe) and coverage meets its thresholds. | — |
| Bundle budgets | `npm --prefix web run build` and `npm --prefix web run build:budget` | Public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz; no admin, dev or parity code in production; exactly one CSS file. | [budgets.md](budgets.md) |
| License gate | `npm --prefix web run license:check` | Every package's license is on the allow-list or an owner-approved, version-pinned exception. | `docs/dependencies.md` |
| Third-party notices | `npm --prefix web run notices:check` | `web/THIRD-PARTY-NOTICES.txt` matches the production dependencies (run `npm --prefix web run notices` and commit it when they change). | — |
| Browser tests (E2E) | `npm --prefix web run e2e` | Every Playwright test passes in all five projects (chromium, firefox, webkit, Pixel 7, iPhone 15) with no console, page-error, CSP, failed-response or axe finding. | [e2e.md](e2e.md) |
| Look-equality proof | `npm --prefix web run parity` (no filter: every group, the reduced-motion pass and the touch pass) | Every case is equal to the approved design in Chromium, Firefox and WebKit: computed styles and boxes, pixels (0 differing), zero axe and zero CSP findings on both sides. | [parity.md](parity.md) |
| Lighthouse | `npm --prefix web run lighthouse` | On the production build served by the real host, mobile profile: every category (performance, accessibility, best practices, SEO) ≥ 0.95, LCP < 2000 ms, CLS < 0.05, TBT < 200 ms (the lab stand-in for INP). | section 2 |
| API contract drift | `npm --prefix tools/openapi-gen run check` | The generated `web/src/types/api.generated.ts` matches the committed OpenAPI snapshot. | [api.md](api.md) |
| .NET tests | `dotnet test --solution Csps.slnx` | Every .NET test passes (architecture, authorization matrix, API, migrations). | `docs/development.md` |

### The E2E tags

`npm --prefix web run e2e` runs everything. To run one area, add `-- --grep <tag>` (several: `-- --grep "@a|@b"`):

| Tag | What it proves | Spec |
|---|---|---|
| `@smoke` | The home page loads clean. | `smoke.spec.ts` |
| `@fixture` | Each guard fires (console error, CSP violation, axe finding, undeclared 404). | `fixture-selftest.spec.ts` |
| `@public` | The public frame on every public path: one h1, the current link, the skip link. | `public.spec.ts` |
| `@admin` | The admin shell on every preview path, the theme toggle, the 768/1024 layout switches. | `admin.spec.ts` |
| `@showcase` | `/dev/components` in both themes, page-level axe, toasts, the Delete Order dialog. | `showcase.spec.ts` |
| `@keyboard` | Skip link, Tabs, SegmentedControl, Modal and slide-over trap and return, ConfirmDialog focus, toast Dismiss, the phone drawer and the user menu. | `keyboard.spec.ts`, `admin-keyboard.spec.ts` |
| `@responsive` | Every page at 320, 375, 414, 768, 1024, 1280, 1536 and 1920 px in portrait and landscape: no sideways scroll, one h1, the skip link, labelled landmarks, no axe finding; 16px text-entry fields on phones (D-01); no zoom lock. | `responsive.spec.ts` |
| `@fonts` | One font preload; every font is a same-origin woff2; ₱ draws in Archivo Variable (PERF-05). | `fonts.spec.ts` |
| `@a11y-rulings` | The owner's accessibility rulings on computed styles: D-02, D-03, D-05, D-BL-02, O-3, O-6. | `a11y-rulings.spec.ts` |

## 2. Lighthouse (`npm --prefix web run lighthouse`)

`web/scripts/lighthouse.mjs` does the following, in order (plan 02-35):

1. Takes the shared run lock `web/.locks/e2e.lock`. E2E and Lighthouse both start the host on port 5199, so they never run at the same time.
2. Runs the shared-machine wait (`web/scripts/shared-machine.mjs`): it runs the preflight report and **waits**, up to 15 minutes, while one of this project's ports is in use by another program or TheBETSLLC's dev/test processes are listed, then exits 1. It never stops anything. Without the preflight script (CI) it says so and goes on.
3. Refuses to start when anything answers on port 5199. It never stops or reuses another process.
4. Builds production into `src/Csps.Server/wwwroot` (`vite build`, with the budget gate).
5. Starts the real ASP.NET Core host: `dotnet run --project src/Csps.Server --no-launch-profile -- --urls https://localhost:5199 --webroot <wwwroot>`. `ASPNETCORE_ENVIRONMENT=Development` is set on that one process only. It waits up to two minutes for `/health`.
6. Runs lighthouse 13.5.0 on `https://localhost:5199/` with the default mobile profile (`--form-factor=mobile`, simulated throttling), `--no-enable-error-reporting` and `--chrome-flags="--headless=new --ignore-certificate-errors"`. It drives the Chromium build of the pinned Playwright version when it is installed (set as `CHROME_PATH` on that child only), so a Chrome update on the machine does not move the score.
7. Stops the host it started (that process and the app it launched, by its own process id; nothing else), then checks the report.

The JSON report is written to `artifacts/lighthouse/report.json`. The whole `artifacts/` folder is git-ignored, and the report is never uploaded anywhere.

The check (`web/scripts/lighthouse-assert.mjs`) reads the raw numbers and never rounds them: a score of 0.95 passes and 0.949 fails; LCP 1999 ms passes and 2000 ms fails. A category or metric that is missing or has no value fails. It prints one line per category and metric, then every failure, categories first and then metrics, so one run shows everything that needs fixing.

## 3. The order to run them before `/gsd-verify-work`

Run them one after another, not in parallel: they share CPU, and the E2E and Lighthouse runs share port 5199 and its lock.

1. The **preflight** (above). Stop and wait if it shows another project's servers or tests.
2. `npm --prefix web run verify`. This is the fastest way to catch most problems.
3. `npm --prefix tools/openapi-gen run check` and `dotnet test --solution Csps.slnx`.
4. `npm --prefix web run e2e`, all tags in all five projects.
5. `npm --prefix web run parity`, the full matrix in three engines (452 rows). This is the slowest gate, at about 30 minutes on this machine.
6. `npm --prefix web run lighthouse` on an otherwise idle machine. The performance score is measured on this computer, so a busy CPU lowers it.

If any gate fails, fix the cause, then re-run that gate and every gate after it.

## 4. Known items the gates assert as they are today

These are open questions or follow-ups, logged in `.planning/phases/02-web-foundation-design-system/deferred-items.md`. The gates assert exactly today's behaviour, so a ruling or a fix, whichever way it goes, changes a test on purpose rather than by accident:

- **Admin top bar on small phones (owner item).** The approved Topbar needs a page at least 398px wide in Chromium, 406px in WebKit (so the iPhone 15 profile, 393px wide, is affected) and 418px in Firefox. Below that, admin pages scroll sideways by up to 98px. `@responsive` narrows its check there: the page is no wider than that engine's Topbar minimum, everything that sticks out is inside the Topbar, and `main` neither overflows nor reaches past the screen. Once the owner rules, remove `TOPBAR_MIN_PAGE_WIDTH` from `web/e2e/responsive.spec.ts`.
- **Tablet list tables, 22px at 768px (owner item).** The visually hidden "Actions" header of a list table that scrolls inside its frame lets the page scroll sideways. No Phase 2 page shows such a list outside a showcase frame, and `@responsive` finds no sideways scroll on any page at 768px; `web/visual/lists-overflow.spec.ts` records the list's own result.
- **Footer headings h1 → h4 (owner item).** Lighthouse's best-practice audit "heading order" flags the approved footer column titles; the accessibility score is 0.98, above the 0.95 gate.
- **Dialogs on phones.** `@keyboard` runs axe over the open dialog only: the page behind a phone bottom sheet is not `inert`, so axe measures the half-covered buttons behind it (`target-size`). Follow-up for Phase 4.
- **Lighthouse LCP margin.** LCP measures 1958–1965 ms against the 2000 ms limit. About 8 KB more on the public route's first load would fail it; the follow-up options are in deferred-items.md. Never raise the limit.
