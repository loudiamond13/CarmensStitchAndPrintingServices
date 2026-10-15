// @ts-check
// `npm run review` (D-23, plan 02-36): the owner's local screenshot report. Local only; the output is git-ignored and
// never committed, uploaded or deployed.
//   1. Refuses to run unless its output folder, artifacts/owner-review, is git-ignored (`git check-ignore`).
//   2. Takes the exclusive run lock web/.locks/e2e.lock, shared with the E2E, parity-host and Lighthouse runs, because
//      it starts the same host on 5199. A second run waits for it, up to 15 minutes.
//   3. Refuses to start when port 5199 is in use. It never stops another process (CLAUDE.md shared machine).
//   4. Waits while the shared machine is busy (shared-machine.mjs reads the shared preflight report, up to 15 minutes,
//      never stopping anything, TOOL-WR-08), then runs the guarded CSPS_E2E seed (the host's /health checks the
//      database).
//   5. Rebuilds the e2e bundle (web/.e2e-dist) whenever any build input is newer than it, not only when it is missing
//      (L-29), so the pictures never show yesterday's build.
//   6. Starts the real ASP.NET Core host on https://localhost:5199 serving that bundle, with its variables set on that
//      one child only, exactly as the Playwright E2E host does (playwright.config.ts).
//   7. Opens every page in Playwright Chromium at 390, 820 and 1440 px (the admin pages and the showcase in Blush and
//      Espresso, the public page in Blush only, D-13/D-14) and saves full-page screenshots.
//   8. Photographs the SPEC-GAP cases on the showcase, and the wording changes the owner has still to confirm as a
//      before (the approved wording, written back into the page) and after (what the app shows now) pair (D-41 R2-06).
//   9. Stops the host it started (that child and its own children, nothing else) and writes
//      artifacts/owner-review/index.html, a plain-words page that shows every picture.
// It writes nowhere but artifacts/owner-review/ (assertWritable), never into src/, web/src or the server's wwwroot.
// Guide: docs/web/owner-review.md.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireLock,
  E2E_PORT,
  LOCK_PATH,
  lockTimeoutMessage,
  PORT_BUSY_MESSAGE,
  REPO_ROOT,
  WEB_DIRECTORY,
} from './e2e.mjs';
import { portIsBusy, startHost, stopRunningHostsSync } from './lighthouse.mjs';
import { waitForSharedMachine } from './shared-machine.mjs';
import { STRUCTURAL_EXCEPTIONS, TOLERANCE_OVERRIDES } from '../visual/intentional-differences.ts';

/**
 * @typedef {'light' | 'dark'} Theme
 * @typedef {{ readonly path: string, readonly slug: string, readonly title: string, readonly h1: string, readonly themes: readonly Theme[] }} ReviewTarget
 * @typedef {{ readonly path: string, readonly title: string, readonly h1: string, readonly theme: Theme, readonly width: number, readonly file: string }} Shot
 * @typedef {{ readonly kind: 'refuse', readonly name: 'output-not-ignored' | 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {{ readonly kind: 'run', readonly name: 'seed' | 'build', readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'host', readonly name: 'host', readonly command: string, readonly args: readonly string[], readonly cwd: string, readonly env: Readonly<Record<string, string>>, readonly healthUrl: string }} HostStep
 * @typedef {{ readonly kind: 'capture', readonly name: 'capture', readonly origin: string, readonly shots: readonly Shot[], readonly specGap: readonly SpecGapShot[], readonly beforeAfter: readonly BeforeAfterShot[], readonly authReview: readonly AuthReviewShot[] }} CaptureStep
 * @typedef {{ readonly kind: 'report', readonly name: 'report', readonly file: string, readonly parityResults: string, readonly differencesGuide: string }} ReportStep
 * @typedef {RefuseStep | RunStep | HostStep | CaptureStep | ReportStep} Step
 * @typedef {{ readonly captured: readonly Shot[], readonly specGap?: readonly SpecGapShot[], readonly beforeAfter?: readonly BeforeAfterShot[], readonly authReview?: readonly AuthReviewShot[], readonly problems: readonly string[] }} CaptureResult
 * @typedef {{ readonly id: string, readonly label: string }} SpecGapCase
 * @typedef {{ readonly id: string, readonly label: string, readonly theme: Theme, readonly width: number, readonly file: string }} SpecGapShot
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly themes: readonly Theme[], readonly kind: 'frame' | 'menu' | 'dialog' }} AuthReviewCase
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly kind: 'frame' | 'menu' | 'dialog', readonly theme: Theme, readonly width: number, readonly file: string }} AuthReviewShot
 * @typedef {{ readonly id: string, readonly question: string, readonly default: string }} AuthReviewRuling
 * @typedef {{ readonly before: string, readonly after: string }} WordingSwap
 * @typedef {{ readonly id: string, readonly label: string, readonly decision: string, readonly swaps: readonly WordingSwap[] }} BeforeAfterCase
 * @typedef {{ readonly id: string, readonly label: string, readonly decision: string, readonly side: 'before' | 'after', readonly theme: Theme, readonly width: number, readonly file: string, readonly swaps: readonly WordingSwap[] }} BeforeAfterShot
 * @typedef {{ readonly engine: string, readonly group: string, readonly passed: number, readonly failed: number, readonly flaky: number, readonly skipped: number }} ParityRow
 * @typedef {{ readonly passed: number, readonly failed: number, readonly flaky: number, readonly skipped: number }} ParityTotals
 * @typedef {{ readonly available: false } | { readonly available: true, readonly startTime: string, readonly durationMinutes: number, readonly filters: string, readonly totals: ParityTotals, readonly rows: readonly ParityRow[], readonly failures: readonly string[] }} ParitySummary
 * @typedef {{ readonly difference: string, readonly decision: string, readonly treatment: string }} DifferenceRow
 * @typedef {{ readonly href: string, readonly label: string }} OtherReport
 * @typedef {{ stop(): Promise<void> }} RunningHost
 * @typedef {{
 *   run(step: RunStep): number,
 *   startHost(step: HostStep): Promise<RunningHost>,
 *   capture(step: CaptureStep): Promise<CaptureResult>,
 *   writeReport(step: ReportStep, result: CaptureResult): void,
 *   log(line: string): void,
 * }} Deps
 */

/** The review widths (D-23): a phone, a tablet and a laptop. */
export const REVIEW_WIDTHS = Object.freeze([390, 820, 1440]);

/** The viewport height per width; the screenshots are full page, so this only sets the first screen. */
const VIEWPORT_HEIGHTS = Object.freeze({ 390: 844, 820: 1180, 1440: 900 });

const BOTH = Object.freeze(/** @type {Theme[]} */ (['light', 'dark']));
const BLUSH_ONLY = Object.freeze(/** @type {Theme[]} */ (['light']));

/**
 * Every page the e2e bundle serves in Phase 2 (web/e2e/sweep.ts lists the same pages): the public shell in Blush only
 * (D-14), the five dev-only admin preview pages (D-20) and the Component Showcase, in Blush and Espresso (D-13).
 * @type {readonly ReviewTarget[]}
 */
export const REVIEW_TARGETS = Object.freeze([
  {
    path: '/',
    slug: 'public-home',
    title: 'Public site (home page placeholder)',
    h1: 'Site update in progress.',
    themes: BLUSH_ONLY,
  },
  { path: '/admin', slug: 'admin-dashboard', title: 'Admin: Dashboard', h1: 'Dashboard', themes: BOTH },
  { path: '/admin/orders', slug: 'admin-orders', title: 'Admin: Orders', h1: 'Orders', themes: BOTH },
  {
    path: '/admin/expenses',
    slug: 'admin-expenses',
    title: 'Admin: Company Expenses',
    h1: 'Company Expenses',
    themes: BOTH,
  },
  { path: '/admin/users', slug: 'admin-users', title: 'Admin: Users', h1: 'Users', themes: BOTH },
  { path: '/admin/profile', slug: 'admin-profile', title: 'Admin: My Profile', h1: 'My Profile', themes: BOTH },
  {
    path: '/dev/components',
    slug: 'showcase',
    title: 'Component Showcase (every building block)',
    h1: 'Component Showcase',
    themes: BOTH,
  },
]);

export const OUTPUT_DIR = fileURLToPath(new URL('../../artifacts/owner-review', import.meta.url));
/** The output folder as `git check-ignore` reads it, relative to the repository root. */
export const OUTPUT_GIT_PATH = 'artifacts/owner-review';
export const E2E_DIST = path.join(WEB_DIRECTORY, '.e2e-dist');
export const ORIGIN = `https://localhost:${String(E2E_PORT)}`;
export const OUTPUT_NOT_IGNORED_MESSAGE =
  'The report folder artifacts/owner-review is not git-ignored. The screenshots must never be committed, so this run ' +
  'stops; restore the `artifacts/` rule in .gitignore and run it again.';

const SERVER_PROJECT = path.join(REPO_ROOT, 'src', 'Csps.Server');
// The Development host also loads the build-time static web assets manifest, whose wwwroot files would win over
// --webroot; a manifest path that never exists turns that loader off for this host only (playwright.config.ts).
const NO_STATIC_WEB_ASSETS = path.join(E2E_DIST, 'no-static-web-assets.json');

/** The latest parity run's JSON report (web/visual/playwright.visual.config.ts) and the guide with the differences list. */
export const PARITY_RESULTS = path.join(WEB_DIRECTORY, 'test-results', 'parity-results.json');
export const DIFFERENCES_GUIDE = path.join(REPO_ROOT, 'docs', 'web', 'parity.md');

/** What the e2e build reads: when any of these is newer than the bundle, the bundle is rebuilt (L-29). */
export const BUILD_INPUTS = Object.freeze(
  [
    'src',
    'public',
    'index.html',
    'parity.html',
    'vite.config.ts',
    '.env.e2e',
    'package-lock.json',
    'scripts/budget.ts',
    'scripts/vite-budget-plugin.ts',
    'scripts/vite-preload-font-plugin.ts',
    'scripts/vite-route-preload-plugin.ts',
  ].map((entry) => path.join(WEB_DIRECTORY, entry)),
);

/** The file the e2e build writes last-but-not-least; its time is the bundle's time. */
export const BUNDLE_MARKER = path.join(E2E_DIST, 'index.html');

/**
 * The screenshots, in report order: page, then theme, then width.
 * @param {readonly ReviewTarget[]} [targets]
 * @param {readonly number[]} [widths]
 * @returns {Shot[]}
 */
export function planShots(targets = REVIEW_TARGETS, widths = REVIEW_WIDTHS) {
  return targets.flatMap((target) =>
    target.themes.flatMap((theme) =>
      widths.map((width) => ({
        path: target.path,
        title: target.title,
        h1: target.h1,
        theme,
        width,
        file: `shots/${target.slug}-${theme}-${String(width)}.png`,
      })),
    ),
  );
}

/**
 * The run as data, so the guards, the order and the exact commands are unit-tested without starting anything.
 * @param {{ outputIgnored: boolean, portBusy?: boolean, bundleMtime?: number | null, newestSourceMtime?: number }} options
 * @returns {readonly Step[]}
 */
export function planReview({ outputIgnored, portBusy = false, bundleMtime = null, newestSourceMtime = 0 }) {
  if (!outputIgnored) {
    return [{ kind: 'refuse', name: 'output-not-ignored', message: OUTPUT_NOT_IGNORED_MESSAGE, exitCode: 1 }];
  }
  if (portBusy) {
    return [{ kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 }];
  }
  /** @type {Step[]} */
  const steps = [];
  // DevSeedTargetGuard refuses anything but CSPS_Dev/CSPS_E2E on (localdb)\MSSQLLocalDB before any connection opens (T-02-24).
  steps.push({
    kind: 'run',
    name: 'seed',
    command: 'dotnet',
    args: ['run', '--project', 'tools/Csps.DevSeed', '--', '--database', 'CSPS_E2E'],
    cwd: REPO_ROOT,
  });
  if (bundleMtime === null || newestSourceMtime > bundleMtime) {
    steps.push({
      kind: 'run',
      name: 'build',
      command: process.execPath,
      args: ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e'],
      cwd: WEB_DIRECTORY,
    });
  }
  steps.push(
    {
      kind: 'host',
      name: 'host',
      command: 'dotnet',
      args: [
        'run',
        '--project',
        SERVER_PROJECT,
        '--no-launch-profile',
        '--',
        '--urls',
        ORIGIN,
        '--webroot',
        E2E_DIST,
        '--staticWebAssets',
        NO_STATIC_WEB_ASSETS,
      ],
      cwd: SERVER_PROJECT,
      // Set on this child only, never at User or Machine level. Development reads the JWT key and the Data Protection
      // certificate from this developer's user-secrets; no secret is passed or written here.
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__Csps: 'Server=(localdb)\\MSSQLLocalDB;Database=CSPS_E2E;Integrated Security=true',
      },
      healthUrl: `${ORIGIN}/health`,
    },
    {
      kind: 'capture',
      name: 'capture',
      origin: ORIGIN,
      shots: planShots(),
      specGap: planSpecGapShots(),
      beforeAfter: planBeforeAfterShots(),
      authReview: planAuthReviewShots(),
    },
    {
      kind: 'report',
      name: 'report',
      file: path.join(OUTPUT_DIR, 'index.html'),
      parityResults: PARITY_RESULTS,
      differencesGuide: DIFFERENCES_GUIDE,
    },
  );
  return steps;
}

/**
 * Throws unless the path is strictly inside artifacts/owner-review/, the only place this script may write.
 * @param {string} file
 * @returns {string} the same path.
 */
export function assertWritable(file) {
  const relative = path.relative(OUTPUT_DIR, path.resolve(file));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside artifacts/owner-review/: ${path.resolve(file)}`);
  }
  return file;
}

/**
 * Runs the steps in order. The host is stopped as soon as the capture has finished, whether it worked or not.
 * @param {readonly Step[]} steps
 * @param {Deps} deps
 * @returns {Promise<number>} 0 when the report was written; otherwise the failing step's exit code (1 for a refusal, a
 *   host that never became healthy or a capture that failed).
 */
export async function executeReview(steps, deps) {
  /** @type {RunningHost | null} */
  let host = null;
  /** @type {CaptureResult | null} */
  let result = null;
  const stopHost = async () => {
    if (host !== null) {
      const running = host;
      host = null;
      await running.stop();
    }
  };
  /** @param {unknown} error */
  const describe = (error) => (error instanceof Error ? error.message : String(error));
  try {
    for (const step of steps) {
      switch (step.kind) {
        case 'refuse':
          deps.log(`review: ${step.message}`);
          return step.exitCode;
        case 'run': {
          const status = deps.run(step);
          if (status !== 0) {
            deps.log(`review: ${step.name} failed with exit code ${String(status)}.`);
            return status;
          }
          break;
        }
        case 'host':
          try {
            host = await deps.startHost(step);
          } catch (error) {
            deps.log(`review: ${describe(error)}`);
            return 1;
          }
          break;
        case 'capture':
          try {
            result = await deps.capture(step);
          } catch (error) {
            deps.log(`review: the screenshots failed: ${describe(error)}`);
            return 1;
          } finally {
            await stopHost();
          }
          break;
        case 'report':
          deps.writeReport(step, result ?? { captured: [], problems: [] });
          deps.log(`review: the report is ready: ${step.file}`);
          break;
      }
    }
    return 0;
  } finally {
    await stopHost();
  }
}

/** @param {string} text @returns {string} */
function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** @param {Theme} theme @returns {string} the theme as the owner knows it. */
function themeName(theme) {
  return theme === 'light' ? 'Blush (light)' : 'Espresso (dark)';
}

const REPORT_CSS = `
  body { margin: 0; font: 16px/1.5 Arial, sans-serif; color: #222; background: #f4f1ec; }
  main { max-width: 1600px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 40px 0 8px; border-top: 2px solid #ccc; padding-top: 24px; }
  h3 { font-size: 18px; margin: 20px 0 8px; }
  .note { max-width: 900px; }
  .row { display: flex; gap: 16px; align-items: flex-start; overflow-x: auto; padding-bottom: 8px; }
  figure { margin: 0; flex: none; background: #fff; border: 1px solid #ccc; padding: 8px; }
  figure img { display: block; height: auto; border: 1px solid #ddd; }
  figcaption { font-size: 14px; margin-bottom: 6px; font-weight: bold; }
  .w390 img { width: 195px; } .w820 img { width: 410px; } .w1440 img { width: 720px; }
  .gap img { max-width: 720px; }
  table { border-collapse: collapse; background: #fff; margin: 8px 0 16px; }
  th, td { border: 1px solid #ccc; padding: 4px 10px; text-align: left; vertical-align: top; }
  td.n { text-align: right; }
  tr.bad td { background: #fde2e2; }
  ul.problems li { color: #8a1c1c; }
`;

/** The engine names a non-developer knows. */
const ENGINE_NAMES = Object.freeze(
  /** @type {Record<string, string>} */ ({
    chromium: 'Chrome engine (Chromium)',
    firefox: 'Firefox engine (Firefox)',
    webkit: 'Safari engine (WebKit)',
  }),
);

/**
 * Escaped text with the guide's inline Markdown kept readable: `code` and **bold**.
 * @param {string} text
 * @returns {string}
 */
function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** @param {readonly Shot[]} shots @returns {string} one section per page, one row per theme. */
function pageSections(shots) {
  const pages = [...new Set(shots.map((shot) => shot.path))];
  return pages
    .map((pagePath) => {
      const ofPage = shots.filter((shot) => shot.path === pagePath);
      const title = ofPage[0]?.title ?? pagePath;
      const themes = [...new Set(ofPage.map((shot) => shot.theme))];
      const rows = themes.map((theme) => {
        const figures = ofPage
          .filter((shot) => shot.theme === theme)
          .map(
            (shot) =>
              `<figure class="w${String(shot.width)}"><figcaption>${String(shot.width)} px</figcaption>` +
              `<a href="${escapeHtml(shot.file)}"><img src="${escapeHtml(shot.file)}" alt="${escapeHtml(
                `${shot.title}, ${themeName(theme)}, ${String(shot.width)} px wide`,
              )}"></a></figure>`,
          )
          .join('');
        return `<h3>${escapeHtml(themeName(theme))}</h3><div class="row">${figures}</div>`;
      });
      return (
        `<section><h2>${escapeHtml(title)}</h2><p class="note">Address: <code>${escapeHtml(pagePath)}</code>. ` +
        `Click a picture to see it full size.</p>${rows.join('')}</section>`
      );
    })
    .join('\n');
}

/**
 * The wording changes the owner has still to confirm (D-41 R2-06, D-08): a table of every swap and, per case, the
 * before (approved wording) and after (what the app shows now) pictures side by side.
 * @param {readonly BeforeAfterShot[]} beforeAfter
 * @returns {string}
 */
function beforeAfterSection(beforeAfter) {
  if (beforeAfter.length === 0) {
    return '';
  }
  const ids = [...new Set(beforeAfter.map((shot) => shot.id))];
  const tableRows = ids
    .flatMap((id) => {
      const first = beforeAfter.find((shot) => shot.id === id);
      const label = first?.label ?? id;
      return (first?.swaps ?? []).map(
        (swap) =>
          `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(swap.before)}</td><td>${escapeHtml(swap.after)}</td></tr>`,
      );
    })
    .join('');
  const cases = ids
    .map((id) => {
      const ofCase = beforeAfter.filter((shot) => shot.id === id);
      const label = ofCase[0]?.label ?? id;
      const figures = ofCase
        .map((shot) => {
          const caption = shot.side === 'before' ? 'Before (the approved wording)' : 'After (the PRD wording)';
          return (
            `<figure class="gap"><figcaption>${escapeHtml(caption)}</figcaption>` +
            `<a href="${escapeHtml(shot.file)}"><img src="${escapeHtml(shot.file)}" alt="${escapeHtml(
              `${label}: ${caption}`,
            )}"></a></figure>`
          );
        })
        .join('');
      return `<h3>${escapeHtml(label)}</h3><div class="row">${figures}</div>`;
    })
    .join('\n');
  return `<section><h2>Wording changes for you to confirm (before and after)</h2>
<p class="note">Your ruling D-41 R2-06 says the order money words follow the PRD: <strong>Subtotal</strong> is the
amount before discount, and <strong>Total</strong> is the amount after discount (Subtotal minus the discount). The order
totals now say "Subtotal" where the approved design said "Total", and the profit note now reads
"Profit = Subtotal − Discount − Expenses. Internal only." Nothing else moves: only the words change, and every amount,
colour and size stays the same. An order with a 100% discount and no payment still reads "Fully Paid", as you ruled.
The approved panel has no row for the Total after discount, so the app has no row for the Total after discount either;
say so if you want one. In the demo Orders table, the "Total" column now shows the amount after discount. Please approve
the new wording, or say what to change.</p>
<table><thead><tr><th>Place</th><th>Before</th><th>After</th></tr></thead><tbody>${tableRows}</tbody></table>
${cases}</section>`;
}

/** @param {readonly SpecGapShot[]} specGap @returns {string} */
function specGapSection(specGap) {
  if (specGap.length === 0) {
    return '';
  }
  const ids = [...new Set(specGap.map((shot) => shot.id))];
  const cases = ids
    .map((id) => {
      const ofCase = specGap.filter((shot) => shot.id === id);
      const label = ofCase[0]?.label ?? id;
      const figures = ofCase
        .map(
          (shot) =>
            `<figure class="gap"><figcaption>${escapeHtml(themeName(shot.theme))}, ${String(shot.width)} px</figcaption>` +
            `<a href="${escapeHtml(shot.file)}"><img src="${escapeHtml(shot.file)}" alt="${escapeHtml(
              `${label}, ${themeName(shot.theme)}`,
            )}"></a></figure>`,
        )
        .join('');
      return `<h3>${escapeHtml(label)}</h3><div class="row">${figures}</div>`;
    })
    .join('\n');
  return `<section><h2>Parts the approved design never drew (SPEC-GAP)</h2>
<p class="note">The approved design has no drawing for these parts, so the automatic look check cannot compare them.
They were built to match the rest of the design. Please look at each one in both colour themes and say if anything looks
out of place.</p>
${cases}</section>`;
}

/** @param {{ summary: ParitySummary, differences: readonly DifferenceRow[] } | undefined} parity @returns {string} */
function paritySection(parity) {
  if (parity === undefined) {
    return '';
  }
  const { summary, differences } = parity;
  let results;
  if (!summary.available) {
    results =
      '<p><strong>No look-check results were found.</strong> Run <code>npm --prefix web run parity</code>, then this ' +
      'report again.</p>';
  } else {
    const scope =
      summary.filters === ''
        ? 'the whole check (every part, every engine)'
        : `only part of the check (<code>${escapeHtml(summary.filters)}</code>)`;
    const verdict =
      summary.totals.failed === 0
        ? 'Every compared row matched.'
        : `<strong>${String(summary.totals.failed)} row(s) did not match:</strong>`;
    const failures =
      summary.failures.length === 0
        ? ''
        : `<ul class="problems">${summary.failures.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
    const rows = summary.rows
      .map(
        (row) =>
          `<tr class="${row.failed > 0 ? 'bad' : ''}"><td>${escapeHtml(ENGINE_NAMES[row.engine] ?? row.engine)}</td>` +
          `<td>${escapeHtml(row.group)}</td><td class="n">${String(row.passed)}</td><td class="n">${String(row.failed)}</td>` +
          `<td class="n">${String(row.flaky)}</td><td class="n">${String(row.skipped)}</td></tr>`,
      )
      .join('');
    results =
      `<p>Latest run: ${escapeHtml(summary.startTime)}, about ${String(summary.durationMinutes)} minutes, covering ` +
      `${scope}. Matched: ${String(summary.totals.passed)}, did not match: ${String(summary.totals.failed)}, matched ` +
      `only on a second look (flaky): ${String(summary.totals.flaky)}, not run in that engine: ${String(summary.totals.skipped)}. ` +
      `${verdict}</p>${failures}` +
      `<table><thead><tr><th>Browser engine</th><th>Group of parts</th><th>Matched</th><th>Did not match</th>` +
      `<th>Flaky</th><th>Not run</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const differenceRows = differences
    .map(
      (row) =>
        `<tr><td>${inlineMarkdown(row.difference)}</td><td>${escapeHtml(row.decision)}</td>` +
        `<td>${inlineMarkdown(row.treatment)}</td></tr>`,
    )
    .join('');
  const elementExceptions = STRUCTURAL_EXCEPTIONS.filter((entry) => entry.kind === 'element');
  const elementDecisions = [...new Set(elementExceptions.map((entry) => entry.decision))].join(', ');
  const drawingDecisions = [
    ...new Set(STRUCTURAL_EXCEPTIONS.filter((entry) => entry.kind === 'icon-drawing').map((entry) => entry.decision)),
  ].join(', ');
  const tolerances =
    TOLERANCE_OVERRIDES.length === 0
      ? 'none: every part must match to the pixel'
      : TOLERANCE_OVERRIDES.map(
          (entry) => `${entry.scenario} (${String(entry.maxDiffPixels)} px, ${entry.decision})`,
        ).join('; ');
  return `<section><h2>Automatic look check (parity)</h2>
<p class="note">Every building block is drawn twice in the same browser: once from the approved design and once from the
new code. The two must match to the pixel, in three browser engines (Chrome, Firefox and Safari). The only allowed
differences are the ones you decided, listed below.</p>
${results}
<h3>Every intentional difference from the approved design, with your decision</h3>
<table><thead><tr><th>Difference</th><th>Decision</th><th>How the check treats it</th></tr></thead>
<tbody>${differenceRows}</tbody></table>
<p class="note">In the check's own list: ${String(elementExceptions.length)} places where the page uses a different
element on purpose (${escapeHtml(elementDecisions)}), the redrawn icons (${escapeHtml(drawingDecisions)}), and allowed
pixel tolerances: ${escapeHtml(tolerances)}.</p>
</section>`;
}

/**
 * The report page: plain words, the pictures as relative links, no script and no remote address.
 * @param {{ generatedAt: string, shots: readonly Shot[], problems: readonly string[], specGap?: readonly SpecGapShot[], beforeAfter?: readonly BeforeAfterShot[], authReview?: readonly AuthReviewShot[], parity?: { summary: ParitySummary, differences: readonly DifferenceRow[] }, otherReports?: readonly OtherReport[] }} input
 * @returns {string}
 */
export function renderIndex({
  generatedAt,
  shots,
  problems,
  specGap = [],
  beforeAfter = [],
  authReview = [],
  parity,
  otherReports = [],
}) {
  const problemList =
    problems.length === 0
      ? '<p>The pages reported no errors while the pictures were taken.</p>'
      : `<p>The pages reported these errors while the pictures were taken:</p><ul class="problems">${problems
          .map((problem) => `<li>${escapeHtml(problem)}</li>`)
          .join('')}</ul>`;
  const others =
    otherReports.length === 0
      ? ''
      : `<p>Other local reports: ${otherReports
          .map((report) => `<a href="${escapeHtml(report.href)}">${escapeHtml(report.label)}</a>`)
          .join(' · ')}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CSPS owner review: screenshots</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<main>
<h1>CSPS owner review: how the new site looks</h1>
<p class="note">These pictures were taken on this computer from the real app on ${escapeHtml(generatedAt)}. They stay on
this computer: they are never put in git, uploaded or put on the live site. Each page is shown as a phone (390 px wide),
a tablet (820 px) and a laptop (1440 px). The admin pages are shown in both colour themes, Blush (light) and Espresso
(dark); the public site has Blush only. Please compare them with the approved design and write down anything that looks
wrong, in your own words. Every difference you name becomes a fix.</p>
${others}
${problemList}
${pageSections(shots)}
${beforeAfterSection(beforeAfter)}
${authReviewSection(authReview)}
${specGapSection(specGap)}
${paritySection(parity)}
</main>
</body>
</html>
`;
}

/**
 * The SPEC-GAP primitives (UI-SPEC `// SPEC-GAP`): parts the approved design never drew, so the look check has nothing
 * to compare them with and the owner judges them by eye. Each is a case on /dev/components, named by its `[data-case]`
 * id, with a plain label.
 * @type {readonly SpecGapCase[]}
 */
export const SPEC_GAP_CASES = Object.freeze([
  { id: 'pagination-first', label: 'Page numbers: first page (Previous is off)' },
  { id: 'pagination-middle', label: 'Page numbers: a middle page, with rows per page' },
  { id: 'pagination-last', label: 'Page numbers: last page (Next is off)' },
  { id: 'otp-empty', label: 'Sign-in code boxes: empty' },
  { id: 'otp-error', label: 'Sign-in code boxes: with an error' },
  { id: 'money-input-empty', label: 'Money amount box: empty' },
  { id: 'money-input-filled', label: 'Money amount box: filled in' },
  { id: 'money-input-error', label: 'Money amount box: with an error' },
  { id: 'money-input-right', label: 'Money amount box: right-aligned, as in order item rows' },
  { id: 'checkbox-unchecked', label: 'Tick box: not ticked' },
  { id: 'checkbox-checked', label: 'Tick box: ticked' },
  { id: 'skip-link-focused', label: 'Skip to content link, as a keyboard user sees it' },
  { id: 'rt-loading', label: 'List while it loads' },
  { id: 'rt-error', label: 'List that could not load' },
  { id: 'rt-empty', label: 'Empty list' },
  { id: 'rt-no-matches', label: 'List with no search matches' },
  { id: 'rt-refetching', label: 'List refreshing in the background' },
  { id: 'error-state-orders', label: 'Error message box' },
  { id: 'error-state-trace', label: 'Error message box with a reference number' },
  { id: 'skeleton-text', label: 'Loading placeholder: lines of text' },
  { id: 'skeleton-card', label: 'Loading placeholder: a card' },
  { id: 'skeleton-image', label: 'Loading placeholder: a picture' },
  { id: 'loading-region', label: 'Area that shows it is loading' },
  { id: 'lazy-image-loading', label: 'Picture while it loads' },
  { id: 'lazy-image-error', label: 'Picture that could not load' },
  { id: 'drawer-open', label: 'Phone menu (drawer), open' },
  { id: 'user-menu-open', label: 'Account menu, open' },
]);

/** The phone drawer covers the screen, so it is photographed at phone width; every other case at laptop width. */
const PHONE_ONLY_CASES = new Set(['drawer-open']);

/**
 * One picture per SPEC-GAP case in Blush and in Espresso.
 * @param {readonly SpecGapCase[]} [cases]
 * @returns {SpecGapShot[]}
 */
export function planSpecGapShots(cases = SPEC_GAP_CASES) {
  return cases.flatMap((entry) =>
    BOTH.map((theme) => ({
      id: entry.id,
      label: entry.label,
      theme,
      width: PHONE_ONLY_CASES.has(entry.id) ? 390 : 1440,
      file: `spec-gap/${entry.id}-${theme}.png`,
    })),
  );
}

/**
 * The Phase 4 screens the owner reviews for wording and design (plan 04-32; D-06, D-41; UI-SPEC "Look-Equality Proof"):
 * the sign-in cards S1 to S6 in their states (Blush only: the auth pages are always Blush), S7 Signed-in devices, both
 * sign-out dialogs, the user menu with its four items and the session toasts (Blush and Espresso, since they live in the
 * admin shell). Each is a case of the auth-gaps group on /dev/components, named by its `[data-case]` id.
 *   - `frame`: the case frame is photographed;
 *   - `menu`: opened with its "Show this example" button first;
 *   - `dialog`: a fixed-position case, opened with its demo button (the "fails" ones are then confirmed, so the failure line
 *     shows) and photographed as the screen.
 * @type {readonly AuthReviewCase[]}
 */
export const AUTH_REVIEW_CASES = Object.freeze([
  {
    id: 'note-uses',
    label: 'Notes in their three uses (notice, success, shield)',
    group: 'Notes',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'signin-notice',
    label: 'S1 Sign in with a notice above the form ("Your session ended")',
    group: 'S1 Sign in',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'signin-banner-trace',
    label: 'S1 Sign in with a server error banner and its reference number',
    group: 'S1 Sign in',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'verify-default',
    label: 'S2 Check your email: the code boxes',
    group: 'S2 Check your email',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'verify-code-error',
    label: 'S2 Check your email: a wrong code',
    group: 'S2 Check your email',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'verify-resend-waiting',
    label: 'S2 Check your email: "new code sent" and the Resend countdown',
    group: 'S2 Check your email',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'verify-resend-cap',
    label: 'S2 Check your email: too many codes asked for',
    group: 'S2 Check your email',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'verify-long-email',
    label: 'S2 Check your email: a 64-character address',
    group: 'S2 Check your email',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'new-password-temporary',
    label: 'S3 Set a new password: after a temporary password',
    group: 'S3 Set a new password',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'new-password-breach',
    label: 'S3 Set a new password: after a breached password',
    group: 'S3 Set a new password',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'forgot-form',
    label: 'S4 Reset your password: the form',
    group: 'S4 Reset your password',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'forgot-sent',
    label: 'S4 Reset your password: "Check your email" after sending',
    group: 'S4 Reset your password',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'forgot-long-email',
    label: 'S4 Reset your password: sent, with a 64-character address',
    group: 'S4 Reset your password',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'reset-checking',
    label: 'S5 New password from the email link: checking the link',
    group: 'S5 New password from the email link',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'reset-form',
    label: 'S5 New password from the email link: the form',
    group: 'S5 New password from the email link',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'reset-invalid',
    label: 'S5 New password from the email link: the link has expired',
    group: 'S5 New password from the email link',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'reset-long-email',
    label: 'S5 New password from the email link: a 64-character address',
    group: 'S5 New password from the email link',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'invite-checking',
    label: 'S6 Set your password from an invite: checking the invite',
    group: 'S6 Set your password from an invite',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'invite-form',
    label: 'S6 Set your password from an invite: the form',
    group: 'S6 Set your password from an invite',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'invite-invalid',
    label: 'S6 Set your password from an invite: the invite has expired',
    group: 'S6 Set your password from an invite',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'invite-fail-closed',
    label: 'S6 Set your password from an invite: the password check could not run',
    group: 'S6 Set your password from an invite',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'invite-long-email',
    label: 'S6 Set your password from an invite: a 64-character address',
    group: 'S6 Set your password from an invite',
    themes: BLUSH_ONLY,
    kind: 'frame',
  },
  {
    id: 'devices-loading',
    label: 'S7 Signed-in devices: loading',
    group: 'S7 Signed-in devices',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'devices-error',
    label: 'S7 Signed-in devices: could not load',
    group: 'S7 Signed-in devices',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'devices-only-this-device',
    label: 'S7 Signed-in devices: only this device',
    group: 'S7 Signed-in devices',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'devices-populated',
    label: 'S7 Signed-in devices: several devices, one with a 60-character name, two with the same name',
    group: 'S7 Signed-in devices',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'signout-others-open',
    label: 'Dialog: Sign out of other devices?',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'dialog',
  },
  {
    id: 'signout-others-failed',
    label: 'Dialog: Sign out of other devices?, after the request failed',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'dialog',
  },
  {
    id: 'signout-device-open',
    label: 'Dialog: Sign out one device?',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'dialog',
  },
  {
    id: 'signout-device-failed',
    label: 'Dialog: Sign out one device?, after the request failed',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'dialog',
  },
  {
    id: 'session-menu-open',
    label: 'Account menu with its four items',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'menu',
  },
  {
    id: 'toast-session-ending',
    label: 'Toast: "Your session ends soon" (12-hour limit warning)',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'toast-device-signed-out',
    label: 'Toast: "Device signed out" with a 60-character device name',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'toast-already-signed-out',
    label: 'Toast: "Already signed out"',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'toast-signed-out-others',
    label: 'Toast: "Signed out of other devices"',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'frame',
  },
  {
    id: 'toast-password-saved',
    label: 'Toast: "Password saved"',
    group: 'Dialogs, menu and toasts',
    themes: BOTH,
    kind: 'frame',
  },
]);

/**
 * One picture per case, per theme the case lists, at 390, 820 and 1440 px.
 * @param {readonly AuthReviewCase[]} [cases]
 * @returns {AuthReviewShot[]}
 */
export function planAuthReviewShots(cases = AUTH_REVIEW_CASES) {
  return cases.flatMap((entry) =>
    entry.themes.flatMap((theme) =>
      REVIEW_WIDTHS.map((width) => ({
        id: entry.id,
        label: entry.label,
        group: entry.group,
        kind: entry.kind,
        theme,
        width,
        file: `auth-review/${entry.id}-${theme}-${String(width)}.png`,
      })),
    ),
  );
}

/**
 * The owner rulings still open for Phase 4 (UI-SPEC "Owner Rulings Needed"). The contract default is built until the owner
 * rules; OQ-5 and OQ-6 have no picture to judge, so they are applied unless the owner objects.
 * @type {readonly AuthReviewRuling[]}
 */
export const AUTH_REVIEW_RULINGS = Object.freeze([
  {
    id: 'OQ-1',
    question: 'After "Email or password is incorrect.", where does the keyboard cursor go?',
    default:
      'A: to the Password field (the red message is read out automatically). B: to the message box. C: stays on Sign In.',
  },
  {
    id: 'OQ-2',
    question:
      'The password strength bar can say "Good" for a password the rule still refuses (for example "Abcdefgh1" has no symbol). Keep the design bar?',
    default:
      'A: keep the design bar; the rule is always written under the field. B: the bar shows at most "Weak" until the rule is met.',
  },
  {
    id: 'OQ-3',
    question: 'What is the menu item that signs out every other device called?',
    default: 'A: "Sign Out Other Devices" (also on the Signed-in devices page). B: "Sign Out of All Devices".',
  },
  {
    id: 'OQ-4',
    question: 'Warn before the 12-hour limit for a sign-in without "Keep me signed in"?',
    default: 'A: a warning toast 5 minutes before ("Your session ends soon"). B: no warning.',
  },
  {
    id: 'OQ-5',
    question: 'Invisible 44px tap areas on "Forgot password?", the "Keep me signed in" label and the back links?',
    default: 'Applied (nothing drawn changes): same size, colour and place.',
  },
  {
    id: 'OQ-6',
    question: 'The "Resend code in 0:42" countdown and screen readers: say it only at the start and the end?',
    default: 'Applied: announced when the countdown starts and when it ends, never every second.',
  },
  {
    id: 'OQ-7',
    question:
      'The wording of every new screen, dialog, notice and toast (the table below), and whether the one-word "Logout" stays.',
    default: 'As written; "Logout" kept (the approved design binds it).',
  },
]);

// The Phase 4 copy is plain data, loaded by address so this script's own type check does not follow it into the app's
// components (it imports types from them).
/** @type {unknown} */
const authCopyModule = await import(new URL('../src/modules/admin/authCopy.ts', import.meta.url).href);
const AUTH_COPY = /** @type {{ AUTH_COPY: unknown }} */ (authCopyModule).AUTH_COPY;

/**
 * Every sentence of the Phase 4 copy (AUTH_COPY), one row per string, for the owner's wording check (OQ-7). A sentence with
 * a person's address in it shows `{email}` there; a function shows its placeholders as `{x}` and `{y}`.
 * @param {unknown} [copy]
 * @returns {{ place: string, text: string }[]}
 */
export function authWords(copy = AUTH_COPY) {
  /** @type {{ place: string, text: string }[]} */
  const rows = [];
  /** @param {unknown} value @param {readonly string[]} trail */
  const walk = (value, trail) => {
    const place = trail.join(' > ');
    if (typeof value === 'string') {
      rows.push({ place, text: value });
    } else if (typeof value === 'function') {
      try {
        const words = /** @type {(...args: string[]) => unknown} */ (/** @type {unknown} */ (value));
        /** @type {unknown} */
        const text = words('{x}', '{y}');
        if (typeof text === 'string') {
          rows.push({ place, text });
        }
      } catch {
        // A function that needs real data has no fixed words to show.
      }
    } else if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      const sentence = /** @type {{ before?: unknown, after?: unknown }} */ (value);
      if (entries.length === 2 && typeof sentence.before === 'string' && typeof sentence.after === 'string') {
        rows.push({ place, text: `${sentence.before}{email}${sentence.after}` });
        return;
      }
      for (const [key, child] of entries) {
        if (key !== 'icon') {
          walk(child, [...trail, key]);
        }
      }
    }
  };
  walk(copy, []);
  return rows;
}

/** @param {readonly AuthReviewShot[]} authReview @returns {string} */
function authReviewSection(authReview) {
  if (authReview.length === 0) {
    return '';
  }
  const rulings = AUTH_REVIEW_RULINGS.map(
    (ruling) =>
      `<tr><td>${escapeHtml(ruling.id)}</td><td>${escapeHtml(ruling.question)}</td><td>${escapeHtml(ruling.default)}</td></tr>`,
  ).join('');
  const words = authWords()
    .map((row) => `<tr><td>${escapeHtml(row.place)}</td><td>${escapeHtml(row.text)}</td></tr>`)
    .join('');
  const groups = [...new Set(authReview.map((shot) => shot.group))];
  const sections = groups
    .map((group) => {
      const ids = [...new Set(authReview.filter((shot) => shot.group === group).map((shot) => shot.id))];
      const cases = ids
        .map((id) => {
          const ofCase = authReview.filter((shot) => shot.id === id);
          const label = ofCase[0]?.label ?? id;
          const figures = ofCase
            .map(
              (shot) =>
                `<figure class="gap"><figcaption>${escapeHtml(themeName(shot.theme))}, ${String(shot.width)} px</figcaption>` +
                `<a href="${escapeHtml(shot.file)}"><img src="${escapeHtml(shot.file)}" alt="${escapeHtml(
                  `${label}, ${themeName(shot.theme)}, ${String(shot.width)} px`,
                )}"></a></figure>`,
            )
            .join('');
          return `<h4>${escapeHtml(label)}</h4><div class="row">${figures}</div>`;
        })
        .join('\n');
      return `<h3>${escapeHtml(group)}</h3>\n${cases}`;
    })
    .join('\n');
  return `<section><h2>Sign-in screens and devices (Phase 4)</h2>
<p class="note">None of these screens, dialogs or toasts is in the approved design, so the automatic look check cannot
compare them. Please look at each one on the phone (390 px), the tablet (820 px) and the laptop (1440 px), in Blush and
(for the signed-in devices page, the dialogs, the menu and the toasts) in Espresso. Then rule on each open question
below: say "approved" to take the default, or tell me what to change. The seven emails are checked separately in the
email preview (the D-30 review).</p>
<h3>Rulings for you (OQ-1 to OQ-7)</h3>
<table><thead><tr><th>Question</th><th>What it is</th><th>What is built now (the default)</th></tr></thead><tbody>${rulings}</tbody></table>
<h3>Words on the new screens</h3>
<p class="note">Every sentence the new screens, dialogs, notices and toasts say. <strong>{email}</strong> stands for the
address of the person; <strong>{x}</strong> and <strong>{y}</strong> are values the app fills in.</p>
<table><thead><tr><th>Where</th><th>Words</th></tr></thead><tbody>${words}</tbody></table>
${sections}</section>`;
}

/**
 * The visible wording changes the owner has still to confirm (D-41 R2-06, owner, 2026-10-13; D-08). Each is a case on
 * /dev/components, named by its `[data-case]` id, with the texts the app shows now (`after`) and the approved wording
 * the "before" picture writes back (`before`). U+2212 minus signs in the note, as on the page.
 * @type {readonly BeforeAfterCase[]}
 */
export const BEFORE_AFTER_CASES = Object.freeze([
  {
    id: 'order-totals-0148',
    label: 'Order Detail totals panel (order ORD-2026-0148)',
    decision: 'D-41 (R2-06)',
    swaps: Object.freeze([
      { before: 'Total', after: 'Subtotal' },
      {
        before: 'Profit = Total \u2212 Discount \u2212 Expenses. Internal only.',
        after: 'Profit = Subtotal \u2212 Discount \u2212 Expenses. Internal only.',
      },
    ]),
  },
  {
    id: 'order-totals-card-0148',
    label: 'Totals on an order card (order ORD-2026-0148)',
    decision: 'D-41 (R2-06)',
    swaps: Object.freeze([{ before: 'Total', after: 'Subtotal' }]),
  },
  {
    id: 'data-table-orders',
    label: 'Demo Orders table: the Total column now shows the amount after discount',
    decision: 'D-41 (R2-06)',
    swaps: Object.freeze([
      { before: '₱22,450.00', after: '₱21,327.50' },
      { before: '₱23,000.00', after: '₱22,500.00' },
    ]),
  },
]);

/**
 * A before and an after picture per wording case, in Blush at laptop width.
 * @param {readonly BeforeAfterCase[]} [cases]
 * @returns {BeforeAfterShot[]}
 */
export function planBeforeAfterShots(cases = BEFORE_AFTER_CASES) {
  return cases.flatMap((entry) =>
    /** @type {const} */ (['before', 'after']).map((side) => ({
      id: entry.id,
      label: entry.label,
      decision: entry.decision,
      side,
      theme: /** @type {Theme} */ ('light'),
      width: 1440,
      file: `before-after/${entry.id}-${side}.png`,
      swaps: entry.swaps,
    })),
  );
}

/**
 * The page script for a "before" picture: inside the one `[data-case]` frame of the case, every text node whose value
 * is exactly a swap's `after` gets that swap's `before`. It returns the number of texts changed per swap, or null
 * when the page has no single frame for the case. The id and the swaps go in as JSON, never as raw text. A string,
 * because this file has no DOM types (as SETTLE).
 * @param {string} id
 * @param {readonly WordingSwap[]} swaps
 * @returns {string}
 */
export function beforeAfterScript(id, swaps) {
  return `(() => {
  const frames = document.querySelectorAll(${JSON.stringify(`[data-case="${id.replaceAll('"', '\\"')}"]`)});
  if (frames.length !== 1) return null;
  const swaps = ${JSON.stringify(swaps)};
  const counts = swaps.map(() => 0);
  const texts = [];
  const visit = (node) => {
    if (node.nodeType === 3) {
      texts.push(node);
      return;
    }
    for (const child of node.childNodes) visit(child);
  };
  visit(frames[0]);
  for (const text of texts) {
    const index = swaps.findIndex((swap) => swap.after === text.nodeValue);
    if (index !== -1) {
      text.nodeValue = swaps[index].before;
      counts[index] += 1;
    }
  }
  return counts;
})()`;
}

/**
 * Throws, naming the case, unless the page had the case frame and every swap changed at least one text, so an outdated
 * case can never produce two equal pictures.
 * @param {string} id
 * @param {readonly WordingSwap[]} swaps
 * @param {unknown} counts what beforeAfterScript returned.
 */
export function assertSwapsApplied(id, swaps, counts) {
  if (!Array.isArray(counts) || counts.length !== swaps.length) {
    throw new Error(`/dev/components has no single case "${id}"; update BEFORE_AFTER_CASES.`);
  }
  const missing = swaps.filter((_, index) => counts[index] === 0).map((swap) => JSON.stringify(swap.after));
  if (missing.length > 0) {
    throw new Error(
      `Case "${id}" shows none of these texts, so its before picture would equal its after picture: ` +
        `${missing.join(', ')}. Update BEFORE_AFTER_CASES.`,
    );
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

/** @param {unknown} value @returns {readonly unknown[]} */
function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Every spec of a Playwright JSON report, however deeply its suites nest.
 * @param {unknown} suites
 * @returns {Record<string, unknown>[]}
 */
function specsOf(suites) {
  return arrayOf(suites).flatMap((suite) =>
    isRecord(suite) ? [...arrayOf(suite.specs).filter(isRecord), ...specsOf(suite.suites)] : [],
  );
}

/**
 * The latest parity run in numbers: passed, failed, flaky and skipped rows per engine and per group (the `@<group>`
 * tag after `@parity` in each row title), every failure by name, and the filters the run was started with.
 * @param {unknown} report the parsed web/test-results/parity-results.json, or null when there is none.
 * @returns {ParitySummary}
 */
export function summarizeParity(report) {
  if (!isRecord(report)) {
    return { available: false };
  }
  /** @type {Map<string, { passed: number, failed: number, flaky: number, skipped: number }>} */
  const counts = new Map();
  const totals = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  /** @type {string[]} */
  const failures = [];
  for (const spec of specsOf(report.suites)) {
    const title = typeof spec.title === 'string' ? spec.title : '';
    const group = /^@parity @([\w-]+)/.exec(title)?.[1] ?? 'other';
    for (const test of arrayOf(spec.tests).filter(isRecord)) {
      const engine = typeof test.projectName === 'string' ? test.projectName : 'unknown';
      const key = `${engine}\u0000${group}`;
      const row = counts.get(key) ?? { passed: 0, failed: 0, flaky: 0, skipped: 0 };
      switch (test.status) {
        case 'expected':
          row.passed += 1;
          totals.passed += 1;
          break;
        case 'flaky':
          row.flaky += 1;
          totals.flaky += 1;
          break;
        case 'skipped':
          row.skipped += 1;
          totals.skipped += 1;
          break;
        default:
          row.failed += 1;
          totals.failed += 1;
          failures.push(`${engine}: ${title}`);
      }
      counts.set(key, row);
    }
  }
  const rows = [...counts.entries()]
    .map(([key, row]) => {
      const [engine = '', group = ''] = key.split('\u0000');
      return { engine, group, ...row };
    })
    .sort((a, b) => a.engine.localeCompare(b.engine) || a.group.localeCompare(b.group));
  const stats = isRecord(report.stats) ? report.stats : {};
  const config = isRecord(report.config) ? report.config : {};
  const argv = arrayOf(config.argv).map(String);
  const afterTest = argv.slice(argv.indexOf('test') + 1);
  /** @type {string[]} */
  const filters = [];
  for (let index = 0; index < afterTest.length; index += 1) {
    if (afterTest[index] === '--config') {
      index += 1;
    } else {
      filters.push(afterTest[index] ?? '');
    }
  }
  return {
    available: true,
    startTime: typeof stats.startTime === 'string' ? stats.startTime : '',
    durationMinutes: typeof stats.duration === 'number' ? Math.round(stats.duration / 60_000) : 0,
    filters: filters.join(' '),
    totals,
    rows,
    failures,
  };
}

/**
 * The intentional-differences table of docs/web/parity.md section 6 ("the complete list"), one row per difference with
 * its decision ID, as written (inline Markdown kept).
 * @param {string} markdown
 * @returns {DifferenceRow[]}
 */
export function parseDifferencesTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('## 6. The intentional differences'));
  if (start === -1) {
    throw new Error(
      'docs/web/parity.md has no "## 6. The intentional differences" section; the report needs its list.',
    );
  }
  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => line.startsWith('## '));
  const tableLines = (end === -1 ? after : after.slice(0, end)).filter((line) => line.trim().startsWith('|'));
  return tableLines
    .slice(1)
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line.trim()))
    .map((line) => {
      const cells = line.trim().slice(1, -1).split('|');
      if (cells.length !== 3) {
        throw new Error(`docs/web/parity.md section 6 has a row without three cells: ${line}`);
      }
      const [difference = '', decision = '', treatment = ''] = cells.map((cell) => cell.trim());
      return { difference, decision, treatment };
    });
}

/**
 * The newest modification time of the paths (recursive for folders), skipping missing ones; 0 when none exist.
 * @param {readonly string[]} paths
 * @returns {number}
 */
export function newestMtime(paths) {
  let newest = 0;
  for (const entry of paths) {
    if (!existsSync(entry)) {
      continue;
    }
    const stats = statSync(entry);
    if (stats.isDirectory()) {
      const children = readdirSync(entry).map((name) => path.join(entry, name));
      newest = Math.max(newest, stats.mtimeMs, newestMtime(children));
    } else {
      newest = Math.max(newest, stats.mtimeMs);
    }
  }
  return newest;
}

/**
 * True when `git check-ignore` says the repository-relative path is ignored.
 * @param {string} gitPath
 * @returns {boolean}
 */
export function isGitIgnored(gitPath) {
  return spawnSync('git', ['check-ignore', '-q', gitPath], { cwd: REPO_ROOT }).status === 0;
}

/**
 * A page script that waits two frames and then for every finite animation and transition, never more than 2 s
 * (web/e2e/sweep.ts `settle`). A string, because the strict CSP blocks eval and this file has no DOM types.
 */
const SETTLE = `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const finite = document.getAnimations().filter((animation) => {
    const timing = animation.effect ? animation.effect.getComputedTiming() : null;
    return timing !== null && Number.isFinite(timing.endTime);
  });
  Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))).then(() => resolve(true));
  setTimeout(() => resolve(true), 2000);
})))`;

/**
 * Opens a page in a fresh browser context at the shot's width and theme and waits until it is ready to photograph.
 * The admin theme comes from `localStorage['csps-theme']` (D-13), stored before the first script runs.
 * @param {import('@playwright/test').Browser} browser
 * @param {string} origin
 * @param {{ path: string, h1: string, theme: Theme, width: number }} target
 * @param {string[]} problems collects the page's console errors and warnings, in plain words.
 * @returns {Promise<{ page: import('@playwright/test').Page, close(): Promise<void> }>}
 */
export async function openReviewPage(browser, origin, target, problems) {
  const height = /** @type {Record<number, number>} */ (VIEWPORT_HEIGHTS)[target.width] ?? 900;
  const context = await browser.newContext({
    viewport: { width: target.width, height },
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 1,
  });
  if (target.theme === 'dark') {
    await context.addInitScript({ content: `try { localStorage.setItem('csps-theme', 'dark'); } catch {}` });
  }
  const page = await context.newPage();
  const where = `${target.path} (${themeName(target.theme)}, ${String(target.width)} px)`;
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${where}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`${where}: ${error.message}`);
  });
  const response = await page.goto(`${origin}${target.path}`, { waitUntil: 'load' });
  if (response?.status() !== 200) {
    throw new Error(`${where} answered ${String(response?.status())}, not 200.`);
  }
  await page.locator('h1', { hasText: target.h1 }).first().waitFor({ timeout: 30_000 });
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.evaluate(SETTLE);
  return {
    page,
    close: () => context.close(),
  };
}

/**
 * Takes the SPEC-GAP pictures on /dev/components. A case is photographed as its `[data-case]` frame; the account menu
 * is opened with its "Show this example" button first. Two cases are photographed as the screen instead: the phone
 * drawer (opened with its demo button), because it covers the page, and the skip link, which shows only with keyboard
 * focus and then sits fixed at the top left of the screen, so it is reached with the keyboard (a script's focus() alone
 * does not count as keyboard focus) and the top of the screen is photographed.
 * @param {import('@playwright/test').Browser} browser
 * @param {string} origin
 * @param {readonly SpecGapShot[]} shots
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function captureSpecGap(browser, origin, shots, problems) {
  const showcase = REVIEW_TARGETS.find((target) => target.path === '/dev/components');
  if (showcase === undefined) {
    throw new Error('The review targets have no /dev/components page.');
  }
  for (const shot of shots) {
    const opened = await openReviewPage(
      browser,
      origin,
      { ...showcase, theme: shot.theme, width: shot.width },
      problems,
    );
    try {
      const { page } = opened;
      const frame = page.locator(`[data-case="${shot.id}"]`);
      if ((await frame.count()) !== 1) {
        throw new Error(`/dev/components has no single case "${shot.id}"; update SPEC_GAP_CASES.`);
      }
      await frame.scrollIntoViewIfNeeded();
      const target = assertWritable(path.join(OUTPUT_DIR, shot.file));
      if (shot.id === 'drawer-open') {
        await frame.getByRole('button').first().click();
        await page.getByRole('dialog').first().waitFor();
        await page.evaluate(SETTLE);
        await page.screenshot({ path: target });
      } else if (shot.id === 'skip-link-focused') {
        await frame.getByRole('link').first().focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        /** @type {unknown} */
        const keyboardFocused = await page.evaluate(
          `(() => { const active = document.activeElement; return active !== null && ` +
            `active.closest('[data-case="skip-link-focused"]') !== null && active.matches(':focus-visible'); })()`,
        );
        if (keyboardFocused !== true) {
          throw new Error('The skip link of case "skip-link-focused" did not get keyboard focus.');
        }
        await page.evaluate(SETTLE);
        await page.screenshot({ path: target, clip: { x: 0, y: 0, width: shot.width, height: 160 } });
      } else {
        if (shot.id === 'user-menu-open') {
          await frame.getByRole('button', { name: 'Show this example' }).click();
          await frame.getByRole('menu').first().waitFor();
        }
        await page.evaluate(SETTLE);
        await frame.screenshot({ path: target });
      }
      process.stdout.write(`review: ${shot.file}\n`);
    } finally {
      await opened.close();
    }
  }
}

/**
 * Takes the Phase 4 pictures on /dev/components, one page load per theme and width. A `frame` case is photographed as its
 * `[data-case]` frame; the account menu is opened with its "Show this example" button first; a `dialog` case is opened with
 * its demo button, confirmed when it is a "fails" demo (so the failure line shows), and photographed as the screen, then
 * closed again with its first footer button.
 * @param {import('@playwright/test').Browser} browser
 * @param {string} origin
 * @param {readonly AuthReviewShot[]} shots
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function captureAuthReview(browser, origin, shots, problems) {
  const showcase = REVIEW_TARGETS.find((target) => target.path === '/dev/components');
  if (showcase === undefined) {
    throw new Error('The review targets have no /dev/components page.');
  }
  const pages = [...new Set(shots.map((shot) => `${shot.theme}|${String(shot.width)}`))];
  for (const key of pages) {
    const [theme, width] = key.split('|');
    const group = shots.filter((shot) => shot.theme === theme && String(shot.width) === width);
    const first = group[0];
    if (first === undefined) {
      continue;
    }
    const opened = await openReviewPage(
      browser,
      origin,
      { ...showcase, theme: first.theme, width: first.width },
      problems,
    );
    try {
      const { page } = opened;
      for (const shot of group) {
        const frame = page.locator(`[data-case="${shot.id}"]`);
        if ((await frame.count()) !== 1) {
          throw new Error(`/dev/components has no single case "${shot.id}"; update AUTH_REVIEW_CASES.`);
        }
        await frame.scrollIntoViewIfNeeded();
        const target = assertWritable(path.join(OUTPUT_DIR, shot.file));
        if (shot.kind === 'dialog') {
          await frame.getByRole('button').first().click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          if (shot.id.endsWith('-failed')) {
            await dialog.locator('footer button').last().click();
            await dialog.getByRole('alert').waitFor();
          }
          await page.evaluate(SETTLE);
          await page.screenshot({ path: target });
          await dialog.locator('footer button').first().click();
          await dialog.waitFor({ state: 'detached' });
        } else {
          if (shot.kind === 'menu') {
            await frame.getByRole('button', { name: 'Show this example' }).click();
            await frame.getByRole('menu').first().waitFor();
          }
          await page.evaluate(SETTLE);
          await frame.screenshot({ path: target });
        }
        process.stdout.write(`review: ${shot.file}\n`);
      }
    } finally {
      await opened.close();
    }
  }
}

/**
 * Takes the before/after pictures of the wording changes on /dev/components (D-41 R2-06). Per case it photographs the
 * `[data-case]` frame as the app shows it (after), then writes the approved wording back with beforeAfterScript and
 * photographs it again (before). A swap that matches no text stops the run with the case's name.
 * @param {import('@playwright/test').Browser} browser
 * @param {string} origin
 * @param {readonly BeforeAfterShot[]} shots
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function captureBeforeAfter(browser, origin, shots, problems) {
  const showcase = REVIEW_TARGETS.find((target) => target.path === '/dev/components');
  if (showcase === undefined) {
    throw new Error('The review targets have no /dev/components page.');
  }
  const ids = [...new Set(shots.map((shot) => shot.id))];
  for (const id of ids) {
    const ofCase = shots.filter((shot) => shot.id === id);
    const before = ofCase.find((shot) => shot.side === 'before');
    const after = ofCase.find((shot) => shot.side === 'after');
    if (before === undefined || after === undefined) {
      throw new Error(`The before/after case "${id}" needs one before and one after picture.`);
    }
    const opened = await openReviewPage(
      browser,
      origin,
      { ...showcase, theme: after.theme, width: after.width },
      problems,
    );
    try {
      const { page } = opened;
      const frame = page.locator(`[data-case="${id}"]`);
      if ((await frame.count()) !== 1) {
        throw new Error(`/dev/components has no single case "${id}"; update BEFORE_AFTER_CASES.`);
      }
      await frame.scrollIntoViewIfNeeded();
      await page.evaluate(SETTLE);
      await frame.screenshot({ path: assertWritable(path.join(OUTPUT_DIR, after.file)) });
      process.stdout.write(`review: ${after.file}\n`);
      /** @type {unknown} */
      const counts = await page.evaluate(beforeAfterScript(id, before.swaps));
      assertSwapsApplied(id, before.swaps, counts);
      await page.evaluate(SETTLE);
      await frame.screenshot({ path: assertWritable(path.join(OUTPUT_DIR, before.file)) });
      process.stdout.write(`review: ${before.file}\n`);
    } finally {
      await opened.close();
    }
  }
}

/**
 * Takes every planned screenshot from the running host: the pages, then the SPEC-GAP cases, then the wording
 * before/after pairs.
 * @param {CaptureStep} step
 * @returns {Promise<CaptureResult>}
 */
async function captureShots(step) {
  const { chromium } = await import('@playwright/test');
  for (const folder of ['shots', 'spec-gap', 'before-after', 'auth-review']) {
    rmSync(assertWritable(path.join(OUTPUT_DIR, folder)), { recursive: true, force: true });
    mkdirSync(assertWritable(path.join(OUTPUT_DIR, folder)), { recursive: true });
  }
  /** @type {string[]} */
  const problems = [];
  const browser = await chromium.launch();
  try {
    for (const shot of step.shots) {
      const opened = await openReviewPage(browser, step.origin, shot, problems);
      try {
        await opened.page.screenshot({ path: assertWritable(path.join(OUTPUT_DIR, shot.file)), fullPage: true });
        process.stdout.write(`review: ${shot.file}\n`);
      } finally {
        await opened.close();
      }
    }
    await captureSpecGap(browser, step.origin, step.specGap, problems);
    await captureBeforeAfter(browser, step.origin, step.beforeAfter, problems);
    await captureAuthReview(browser, step.origin, step.authReview, problems);
  } finally {
    await browser.close();
  }
  return {
    captured: step.shots,
    specGap: step.specGap,
    beforeAfter: step.beforeAfter,
    authReview: step.authReview,
    problems,
  };
}

/**
 * @param {RunStep} step
 * @returns {number}
 */
function runStep(step) {
  return spawnSync(step.command, [...step.args], { cwd: step.cwd, stdio: 'inherit' }).status ?? 1;
}

/**
 * Writes index.html: the pictures, the wording before/after section, the SPEC-GAP section and the latest parity
 * summary with the differences list.
 * @param {ReportStep} step
 * @param {CaptureResult} result
 */
function writeReport(step, result) {
  /** @type {unknown} */
  let report = null;
  if (existsSync(step.parityResults)) {
    try {
      report = JSON.parse(readFileSync(step.parityResults, 'utf8'));
    } catch {
      report = null;
    }
  }
  /** @type {OtherReport[]} */
  const otherReports = [
    { href: 'side-by-side/index.html', label: 'Side by side with the original design files' },
    { href: 'phase2-rulings/index.html', label: 'Earlier rulings pack (icons, Logout, drawer link)' },
  ].filter((entry) => existsSync(path.join(OUTPUT_DIR, entry.href)));
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    assertWritable(step.file),
    renderIndex({
      generatedAt: new Date().toString(),
      shots: result.captured,
      specGap: result.specGap ?? [],
      beforeAfter: result.beforeAfter ?? [],
      authReview: result.authReview ?? [],
      problems: result.problems,
      parity: {
        summary: summarizeParity(report),
        differences: parseDifferencesTable(readFileSync(step.differencesGuide, 'utf8')),
      },
      otherReports,
    }),
  );
}

/** @returns {Promise<number>} */
async function main() {
  const outputIgnored = isGitIgnored(OUTPUT_GIT_PATH);
  const release = outputIgnored ? await acquireLock(LOCK_PATH) : () => undefined;
  if (release === null) {
    process.stderr.write(`review: ${lockTimeoutMessage(LOCK_PATH)}\n`);
    return 1;
  }
  const onSignal = () => {
    // TOOL-WR-10: process.exit skips every finally, so the host this run started is stopped here first.
    stopRunningHostsSync();
    release();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  process.once('SIGHUP', onSignal);
  process.once('exit', release);
  try {
    if (outputIgnored) {
      // TOOL-WR-08: wait while another project uses this machine (shared-machine.mjs); never stop anything.
      const busy = await waitForSharedMachine({ label: 'review' });
      if (busy !== null) {
        process.stderr.write(`${busy}\n`);
        return 1;
      }
    }
    const steps = planReview({
      outputIgnored,
      portBusy: outputIgnored ? await portIsBusy() : false,
      bundleMtime: existsSync(BUNDLE_MARKER) ? statSync(BUNDLE_MARKER).mtimeMs : null,
      newestSourceMtime: newestMtime(BUILD_INPUTS),
    });
    return await executeReview(steps, {
      run: runStep,
      startHost,
      capture: captureShots,
      writeReport,
      log: (line) => {
        process.stdout.write(`${line}\n`);
      },
    });
  } finally {
    release();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
