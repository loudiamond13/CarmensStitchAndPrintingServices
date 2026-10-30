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
//   9. Plan 05-37: signs a seeded Manager in through the Testing staff fixture and the mail sink (the Testing host the
//      Playwright E2E run uses) and photographs the real Phase 5 screens: Users, My Profile, the Audit Log, the slide-overs,
//      the dialogs and the confirm-email page, with a rulings page that lists only what is still open for the owner.
//  10. Plan 06-19: photographs the real Phase 6 screens the same way, as a Manager and as an Admin: Company Expenses and its
//      states, the Add, Edit and View windows, both delete confirmations, Deleted Expenses, Settings and the Audit Log with an
//      expense entry open, with a rulings page that lists what is still open for the owner and a table of every new sentence.
//  11. Stops the host it started (that child and its own children, nothing else) and writes
//      artifacts/owner-review/index.html, a plain-words page that shows every picture.
// It writes nowhere but artifacts/owner-review/ (assertWritable), never into src/, web/src or the server's wwwroot.
// Guide: docs/web/owner-review.md.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireLock,
  E2E_PORT,
  LOCALDB_E2E_CONNECTION,
  LOCK_PATH,
  lockTimeoutMessage,
  PORT_BUSY_MESSAGE,
  REPO_ROOT,
  WEB_DIRECTORY,
} from './e2e.mjs';
import { manilaDate, RENT as SEEDED_RENT, SUPPLIES as SEEDED_SUPPLIES } from '../e2e/helpers.ts';
import { portIsBusy, startHost, stopRunningHostsSync } from './lighthouse.mjs';
import { waitForSharedMachine } from './shared-machine.mjs';
import { STRUCTURAL_EXCEPTIONS, TOLERANCE_OVERRIDES } from '../visual/intentional-differences.ts';

/**
 * @typedef {'light' | 'dark'} Theme
 * @typedef {{ readonly path: string, readonly slug: string, readonly title: string, readonly h1: string, readonly themes: readonly Theme[], readonly signedIn?: boolean }} ReviewTarget
 * @typedef {{ readonly path: string, readonly title: string, readonly h1: string, readonly theme: Theme, readonly width: number, readonly file: string }} Shot
 * @typedef {{ readonly kind: 'refuse', readonly name: 'output-not-ignored' | 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {{ readonly kind: 'run', readonly name: 'seed' | 'build', readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'host', readonly name: 'host', readonly command: string, readonly args: readonly string[], readonly cwd: string, readonly env: Readonly<Record<string, string>>, readonly healthUrl: string }} HostStep
 * @typedef {{ readonly kind: 'capture', readonly name: 'capture', readonly origin: string, readonly shots: readonly Shot[], readonly specGap: readonly SpecGapShot[], readonly beforeAfter: readonly BeforeAfterShot[], readonly authReview: readonly AuthReviewShot[], readonly phase5Review: readonly Phase5ReviewShot[], readonly phase6Review: readonly Phase6ReviewShot[] }} CaptureStep
 * @typedef {{ readonly kind: 'report', readonly name: 'report', readonly file: string, readonly parityResults: string, readonly differencesGuide: string }} ReportStep
 * @typedef {RefuseStep | RunStep | HostStep | CaptureStep | ReportStep} Step
 * @typedef {{ readonly captured: readonly Shot[], readonly specGap?: readonly SpecGapShot[], readonly beforeAfter?: readonly BeforeAfterShot[], readonly authReview?: readonly AuthReviewShot[], readonly phase5Review?: readonly Phase5ReviewShot[], readonly phase6Review?: readonly Phase6ReviewShot[], readonly problems: readonly string[] }} CaptureResult
 * @typedef {{ readonly id: string, readonly label: string }} SpecGapCase
 * @typedef {{ readonly id: string, readonly label: string, readonly theme: Theme, readonly width: number, readonly file: string }} SpecGapShot
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly themes: readonly Theme[], readonly kind: 'frame' | 'menu' | 'dialog' }} AuthReviewCase
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly kind: 'frame' | 'menu' | 'dialog', readonly theme: Theme, readonly width: number, readonly file: string }} AuthReviewShot
 * @typedef {{ readonly id: string, readonly question: string, readonly default: string }} AuthReviewRuling
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly themes: readonly Theme[] }} Phase5ReviewCase
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly theme: Theme, readonly width: number, readonly file: string }} Phase5ReviewShot
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly themes: readonly Theme[], readonly signedInAs: 'Manager' | 'Admin' }} Phase6ReviewCase
 * @typedef {{ readonly id: string, readonly label: string, readonly group: string, readonly signedInAs: 'Manager' | 'Admin', readonly theme: Theme, readonly width: number, readonly file: string }} Phase6ReviewShot
 * @typedef {{ readonly label: string, readonly text: string, readonly recommended: boolean, readonly built: boolean }} Phase6Option
 * @typedef {{ readonly id: string, readonly status: 'open' | 'ruled', readonly topic: string, readonly options: readonly Phase6Option[], readonly ruling?: string, readonly whereItChanges?: string }} Phase6Ruling
 * @typedef {{ readonly key: string, readonly role: 'Admin' | 'Manager', readonly state: string, readonly firstName: string, readonly lastName: string }} Phase5SeedPerson
 * @typedef {{ readonly id: string, readonly topic: string, readonly ruling: string, readonly ruledIn: string }} Phase5Ruled
 * @typedef {{ readonly id: string, readonly title: string, readonly what: string, readonly how: string }} Phase5OpenItem
 * @typedef {{ readonly requirement: string, readonly assumed: string, readonly evidence: string }} Phase5EdgeAssumption
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
 * Every page the e2e bundle serves (web/e2e/sweep.ts lists the Phase 2 ones): the public shell in Blush only (D-14), the
 * two dev-only admin preview pages (D-20), the Component Showcase, and the real guarded pages (Company Expenses, Users, My
 * Profile, the Audit Log, and, since plan 06-19, Deleted Expenses and Settings, and, since plan 08-24, Orders), photographed signed in as a Manager. The
 * admin pages and the showcase are shown in Blush and Espresso (D-13).
 * @type {readonly ReviewTarget[]}
 */
export const REVIEW_TARGETS = Object.freeze([
  {
    path: '/',
    slug: 'public-home',
    title: 'Public site (holding page)',
    h1: 'New website on the way.',
    themes: BLUSH_ONLY,
  },
  { path: '/admin', slug: 'admin-dashboard', title: 'Admin: Dashboard', h1: 'Dashboard', themes: BOTH },
  { path: '/admin/orders', slug: 'admin-orders', title: 'Admin: Orders', h1: 'Orders', themes: BOTH, signedIn: true },
  {
    path: '/admin/expenses',
    slug: 'admin-expenses',
    title: 'Admin: Company Expenses',
    h1: 'Company Expenses',
    themes: BOTH,
    signedIn: true,
  },
  { path: '/admin/users', slug: 'admin-users', title: 'Admin: Users', h1: 'Users', themes: BOTH, signedIn: true },
  {
    path: '/admin/profile',
    slug: 'admin-profile',
    title: 'Admin: My Profile',
    h1: 'My Profile',
    themes: BOTH,
    signedIn: true,
  },
  {
    path: '/admin/audit-log',
    slug: 'admin-audit-log',
    title: 'Admin: Audit Log',
    h1: 'Audit Log',
    themes: BOTH,
    signedIn: true,
  },
  {
    path: '/admin/expenses/deleted',
    slug: 'admin-expenses-deleted',
    title: 'Admin: Deleted Expenses',
    h1: 'Deleted Expenses',
    themes: BOTH,
    signedIn: true,
  },
  {
    path: '/admin/settings',
    slug: 'admin-settings',
    title: 'Admin: Settings',
    h1: 'Settings',
    themes: BOTH,
    signedIn: true,
  },
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
/** The per-address auth limit the host runs with: high enough that signing in many times never reaches it (playwright.config.ts). */
const NO_THROTTLE = '100000';
/**
 * The host's variables, set on that one child only, never at User or Machine level. The Testing environment is the one the
 * Playwright E2E host runs in: it serves the Testing-only staff fixture and keeps mail in the in-memory sink, which the
 * signed-in pictures need (plan 05-37). Csps__Testing__LoadUserSecrets reads this developer's user-secrets for the JWT key
 * and the Data Protection certificate; no secret is passed or written here.
 */
const HOST_ENV = Object.freeze({
  ASPNETCORE_ENVIRONMENT: 'Testing',
  Csps__Testing__LoadUserSecrets: 'true',
  App__PublicBaseUrl: ORIGIN,
  Email__Dispatcher__SweepInterval: '00:00:01',
  ConnectionStrings__Csps: LOCALDB_E2E_CONNECTION,
  RateLimits__Auth__SignIn__PermitLimit: NO_THROTTLE,
  RateLimits__Auth__Verify__PermitLimit: NO_THROTTLE,
  RateLimits__Auth__Resend__PermitLimit: NO_THROTTLE,
  RateLimits__Auth__Forgot__PermitLimit: NO_THROTTLE,
  RateLimits__Auth__Reset__PermitLimit: NO_THROTTLE,
  RateLimits__Auth__Refresh__PermitLimit: NO_THROTTLE,
});
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
      // See HOST_ENV: the Testing environment of the E2E host, on this child only.
      env: HOST_ENV,
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
      phase5Review: planPhase5ReviewShots(),
      phase6Review: planPhase6ReviewShots(),
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
  ul.options { list-style: none; margin: 0; padding: 0; }
  ul.options li { margin: 0 0 6px; }
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
 * @param {{ generatedAt: string, shots: readonly Shot[], problems: readonly string[], specGap?: readonly SpecGapShot[], beforeAfter?: readonly BeforeAfterShot[], authReview?: readonly AuthReviewShot[], phase5Review?: readonly Phase5ReviewShot[], phase6Review?: readonly Phase6ReviewShot[], parity?: { summary: ParitySummary, differences: readonly DifferenceRow[] }, otherReports?: readonly OtherReport[] }} input
 * @returns {string}
 */
export function renderIndex({
  generatedAt,
  shots,
  problems,
  specGap = [],
  beforeAfter = [],
  authReview = [],
  phase5Review = [],
  phase6Review = [],
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
${phase5ReviewSection(phase5Review)}
${phase6ReviewSection(phase6Review)}
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

// ───────────── Plan 05-37: the Phase 5 screens (Users, My Profile, the Audit Log), signed in as a Manager ─────────────

/**
 * The staff the pictures need, made once per run through the Testing-only staff fixture (QUAL-05, D-37): a Manager to
 * sign in as (the "You" row), and one person in every state the roster shows. The fixture gives each an address under
 * csps.test, so nothing real is used and nothing is sent. The first names sort before "E2E", the name every other test
 * staff member carries, so they lead the roster. Carlos Tan adds a person and is then deleted, so that person's
 * "Recorded by" reads "Carlos Tan (former staff)" (SEC-08, OQ-8).
 * @type {readonly Phase5SeedPerson[]}
 */
export const PHASE5_SEED_PEOPLE = Object.freeze([
  { key: 'manager', role: 'Manager', state: 'active', firstName: 'Bea', lastName: 'Navarro' },
  { key: 'ana', role: 'Admin', state: 'active', firstName: 'Ana', lastName: 'Reyes' },
  { key: 'carmen', role: 'Admin', state: 'active', firstName: 'Carmen', lastName: 'Villanueva' },
  { key: 'dan', role: 'Admin', state: 'deactivated', firstName: 'Dan', lastName: 'Aquino' },
  { key: 'beth', role: 'Manager', state: 'manager-locked', firstName: 'Beth', lastName: 'Santos' },
  { key: 'alma', role: 'Admin', state: 'invited', firstName: 'Alma', lastName: 'Mercado' },
  { key: 'carlos', role: 'Manager', state: 'active', firstName: 'Carlos', lastName: 'Tan' },
]);

/**
 * The UI-SPEC "Visual Review" set for Phase 5, beyond the three pages in REVIEW_TARGETS (U1 Users, P1 My Profile, A1 Audit
 * Log): the slide-overs, the dialogs and the states a page alone does not show. Each is a viewport picture of the real
 * screen with the real server behind it. The confirm-email page is Blush only (the auth-style pages are always Blush, D-13).
 * @type {readonly Phase5ReviewCase[]}
 */
export const PHASE5_REVIEW_CASES = Object.freeze([
  {
    id: 'add-invitation',
    label: 'U2 Add User: by invitation (the default)',
    group: 'U2 Add User',
    themes: BOTH,
  },
  {
    id: 'add-temporary-password',
    label: 'U2 Add User: with a temporary password (the suggested password)',
    group: 'U2 Add User',
    themes: BOTH,
  },
  {
    id: 'add-shown-once',
    label: 'U2 Add User: the temporary password, shown once',
    group: 'U2 Add User',
    themes: BOTH,
  },
  {
    id: 'edit-record-meta',
    label: 'U3 Edit User: Recorded by a member of staff who has since left ("former staff")',
    group: 'U3 Edit User',
    themes: BOTH,
  },
  {
    id: 'edit-email-change-note',
    label: 'U3 Edit User: a changed email asks how it applies (confirm by link or save at once)',
    group: 'U3 Edit User',
    themes: BOTH,
  },
  {
    id: 'edit-pending-email',
    label: 'U3 Edit User: an email change waiting for confirmation',
    group: 'U3 Edit User',
    themes: BOTH,
  },
  {
    id: 'edit-invited-email-note',
    label: 'U3 Edit User: the email note for a person who has not set a password yet',
    group: 'U3 Edit User',
    themes: BOTH,
  },
  {
    id: 'edit-account-access',
    label: 'U3 Edit User: the Account access section',
    group: 'U3 Edit User',
    themes: BOTH,
  },
  {
    id: 'dialog-deactivate',
    label: 'U4 Dialog: Deactivate a user',
    group: 'U4 Dialogs',
    themes: BOTH,
  },
  {
    id: 'dialog-delete',
    label: 'U4 Dialog: Delete a user',
    group: 'U4 Dialogs',
    themes: BOTH,
  },
  {
    id: 'dialog-lock',
    label: 'U4 Dialog: Lock a user',
    group: 'U4 Dialogs',
    themes: BOTH,
  },
  {
    id: 'dialog-temporary-password',
    label: 'U5 Dialog: Set a temporary password',
    group: 'U4 Dialogs',
    themes: BOTH,
  },
  {
    id: 'profile-change-email-dialog',
    label: 'P2 My Profile: the Change Email dialog',
    group: 'P1 and P2 My Profile',
    themes: BOTH,
  },
  {
    id: 'profile-details-pending-email',
    label: 'P1 My Profile, Details tab, with an email change waiting',
    group: 'P1 and P2 My Profile',
    themes: BOTH,
  },
  {
    id: 'profile-security',
    label: 'P1 My Profile, Security tab',
    group: 'P1 and P2 My Profile',
    themes: BOTH,
  },
  {
    id: 'profile-appearance',
    label: 'P1 My Profile, Appearance tab',
    group: 'P1 and P2 My Profile',
    themes: BOTH,
  },
  {
    id: 'confirm-email-ready',
    label: 'P3 Confirm your email: the link is good, "Confirm New Email"',
    group: 'P3 Confirm your email (Blush)',
    themes: BLUSH_ONLY,
  },
  {
    id: 'confirm-email-done',
    label: 'P3 Confirm your email: "Your email is changed"',
    group: 'P3 Confirm your email (Blush)',
    themes: BLUSH_ONLY,
  },
  {
    id: 'confirm-email-invalid',
    label: 'P3 Confirm your email: the link is missing or has expired',
    group: 'P3 Confirm your email (Blush)',
    themes: BLUSH_ONLY,
  },
  {
    id: 'audit-expanded-row',
    label: 'A1 Audit Log: a row opened to show its detail',
    group: 'A1 Audit Log',
    themes: BOTH,
  },
  {
    id: 'audit-no-matches',
    label: 'A1 Audit Log: filters that match nothing',
    group: 'A1 Audit Log',
    themes: BOTH,
  },
  {
    id: 'audit-empty',
    label: 'A1 Audit Log: the empty state ("No entries in the last 7 days")',
    group: 'A1 Audit Log',
    themes: BOTH,
  },
  {
    id: 'showcase-demo-banner',
    label: 'C1 Component Showcase in production: the "Demo data" banner',
    group: 'C1 Component Showcase',
    themes: BOTH,
  },
  {
    id: 'shell-short-screen',
    label: 'The admin shell on a short screen (1280 x 600): the sidebar stays put and its menu scrolls on its own',
    group: 'The shell',
    themes: BOTH,
  },
]);

/** The short-screen shell is photographed at the one size the UI-SPEC names; every other case at the review widths. */
const SHORT_SCREEN_WIDTH = 1280;
const SHORT_SCREEN_HEIGHT = 600;

/**
 * One picture per case, per theme the case lists, at 390, 820 and 1440 px (the short shell at 1280 x 600).
 * @param {readonly Phase5ReviewCase[]} [cases]
 * @returns {Phase5ReviewShot[]}
 */
export function planPhase5ReviewShots(cases = PHASE5_REVIEW_CASES) {
  return cases.flatMap((entry) =>
    entry.themes.flatMap((theme) =>
      (entry.id === 'shell-short-screen' ? [SHORT_SCREEN_WIDTH] : REVIEW_WIDTHS).map((width) => ({
        id: entry.id,
        label: entry.label,
        group: entry.group,
        theme,
        width,
        file: `phase5-review/${entry.id}-${theme}-${String(width)}.png`,
      })),
    ),
  );
}

/**
 * The UI-SPEC "Owner Rulings Needed" items the owner has already ruled (05-CONTEXT D-42 to D-48, owner, 2026-10-17 and
 * 2026-10-18). They are listed so the page is complete, but they are not questions any more.
 * @type {readonly Phase5Ruled[]}
 */
export const PHASE5_RULED = Object.freeze([
  {
    id: 'OQ-1',
    topic: 'Where the account actions go, and the deactivate icon',
    ruling:
      'Option A. Each row keeps Edit, the Deactivate/Activate toggle (new icons user-x and user-check) and Delete. Resend Invitation, Send Reset Link, Set Temporary Password and Lock/Unlock sit in the Edit panel, under "Account access".',
    ruledIn: 'D-42 (owner, 2026-10-17)',
  },
  {
    id: 'OQ-2',
    topic: 'How Managers reach the Audit Log',
    ruling:
      'Option A. A sidebar item "Audit Log" with the Manager tag, after Users and in the phone drawer too; not in the phone tab bar.',
    ruledIn: 'D-43 (owner, 2026-10-17)',
  },
  {
    id: 'OQ-3',
    topic: 'Deactivate from the row',
    ruling: 'A confirm dialog with "Keep Active" focused first. Activate stays one tap.',
    ruledIn: 'D-44 (owner, 2026-10-17)',
  },
  {
    id: 'OQ-4',
    topic: 'A Manager changes a colleague’s email',
    ruling:
      'Changed from the contract default. The Manager chooses, each time: "Confirm by link" (preselected: a link to the new address, a notice to the old one, the change applies on confirmation) or "Save at once" (the email changes now, the old address is told, the person is signed out everywhere). An invited person who has no password always moves at once, with a fresh 7-day invitation to the new address.',
    ruledIn: 'D-45 (owner, 2026-10-17); built in plans 05-40, 05-25 and 05-30',
  },
  {
    id: 'OQ-5',
    topic: 'My Profile layout',
    ruling: 'A header card, then the tabs Details, Security and Appearance.',
    ruledIn: 'D-23 (earlier ruling, recorded again in the UI-SPEC)',
  },
  {
    id: 'OQ-6',
    topic: 'Wrong current password',
    ruling: 'The words appear under the Current password field and the cursor moves there. No error toast.',
    ruledIn: 'D-46 (owner, 2026-10-17)',
  },
  {
    id: 'OQ-7',
    topic: 'Amended wording of the Users and My Profile screens',
    ruling:
      'Built as written. The owner reviews every new or amended string before release: that review is the open item "Screen wording" above.',
    ruledIn: 'D-48 (owner, 2026-10-17)',
  },
  {
    id: 'OQ-8',
    topic: 'A deleted person shown as an actor',
    ruling: '"{name} (former staff)", with the suffix muted.',
    ruledIn: 'D-47 (owner, 2026-10-17)',
  },
  {
    id: 'OQ-9',
    topic: 'Six new icons',
    ruling: 'Added: copy, lock-open, key-round, user-x, user-check and history (from the installed icon set).',
    ruledIn: 'Contract default; built in plan 05-03',
  },
  {
    id: 'OQ-10',
    topic: 'The access choice in Add User',
    ruling: 'Two radio rows, each with a one-line description.',
    ruledIn: 'D-47 (owner, 2026-10-17)',
  },
  {
    id: 'OQ-11',
    topic: 'Every wording gap in the UI-SPEC and the email additions',
    ruling:
      'Built as written. The emails were approved on 2026-10-18 (plan 05-31); the screen wording is the open item "Screen wording" above.',
    ruledIn: 'D-48 (owner, 2026-10-17); emails approved 2026-10-18',
  },
]);

/**
 * The four edge assumptions the planner flagged and left for the owner and the verifier (PROF-02, PROF-03, USER-05,
 * USER-07): what each plan assumed the requirement's edges were, and where the build tests them.
 * @type {readonly Phase5EdgeAssumption[]}
 */
export const PHASE5_EDGE_ASSUMPTIONS = Object.freeze([
  {
    requirement: 'PROF-02',
    assumed:
      'The email-change edges are: the link works for 24 hours (alive 1 millisecond before, dead at the 24th hour), works once, and is replaced by a newer request; the new address is compared without regard to letter case and must not belong to anyone else; if someone else took the address while the link was waiting, the person sees "This email can’t be used".',
    evidence: 'Plans 05-14 and 05-15; EmailChangeTests, EmailChangePendingTests; the E2E journey @profile-email.',
  },
  {
    requirement: 'PROF-03',
    assumed:
      'The password-change edges are the sign-in password rule’s own cases (8 and 64 characters, text normalised before it is checked, no control characters, at least one number and one symbol), plus: a wrong current password counts toward the same five-try lock as the other profile changes.',
    evidence: 'Plan 05-12; ChangePasswordTests and the Phase 4 password-rule golden cases.',
  },
  {
    requirement: 'USER-05',
    assumed:
      'The sign-out edges are: the person’s very next request after the change is saved is refused with 401 (no grace period of our own), and a person with no sessions simply has nothing to end. Known gap, listed for the security review: the server remembers a session for up to 60 seconds, and the memory is cleared a few milliseconds before the save commits.',
    evidence:
      'Plan 05-21; UserLifecycleTests, LockUserTests, DeleteUserTests; the E2E journeys @users-actions and @users-access.',
  },
  {
    requirement: 'USER-07',
    assumed:
      'The link edges are: an invitation lasts 7 days and a reset link 30 minutes; each person has one live link of each kind (a new one ends the old one); Send Reset Link shares the hourly reset-email limit with "Forgot password"; and both are refused for a locked or deactivated person, and for a person who has (or has not yet set) a password, as appropriate.',
    evidence: 'Plan 05-27; ResendInvitationTests, ManagerResetLinkTests; the E2E journey @users-access.',
  },
]);

/**
 * Everything still open for the owner at the end of Phase 5, in the order the review pack asks it. OQ-1 to OQ-11 are not
 * here: they are ruled (PHASE5_RULED). The inbox and cookie checks cannot be photographed; they need the owner's own
 * phone, mailbox and the first live deploy.
 * @type {readonly Phase5OpenItem[]}
 */
export const PHASE5_OPEN_ITEMS = Object.freeze([
  {
    id: 'screen-wording',
    title: 'Screen wording (D-48)',
    what: 'Every new or amended string on the Phase 5 screens: the UI-SPEC wording as written, and the sentences the build had to choose because the UI-SPEC had none (the Edit User email choice and notes, the refusals, the Audit Log "What changed" lines, "Unknown person"). They are all in the table "Words on the Phase 5 screens" below.',
    how: 'Read the table next to the pictures. Say "approved", or name the string and the words you want. Wording you change becomes a follow-up for /gsd-verify-work 5. The seven emails were approved on 2026-10-18 and are not part of this.',
  },
  {
    id: 'edge-assumptions',
    title: 'Four flagged edge assumptions (PROF-02, PROF-03, USER-05, USER-07)',
    what: 'What the planner assumed the edges of these four requirements are. They are listed in the table "The four flagged edge assumptions" below, with where they are tested.',
    how: 'Confirm each one, or say what is different.',
  },
  {
    id: 'temporary-password-words',
    title: 'The 40 words in a suggested temporary password (plan 05-22)',
    what: 'A suggestion looks like "Tela-Sukat-7381": two of these words, a hyphen and four digits. The words are short sewing words in Tagalog and English. They are listed below.',
    how: 'Say "approved", or name any word to remove or add.',
  },
  {
    id: 'phone-motion',
    title: 'Motion on a real phone',
    what: 'The navigation drawer, the user menu and a dialog slide and fade in and out. With "reduce motion" turned on in the phone’s settings, nothing should move. On a short page the tab bar sits at the bottom of the screen.',
    how: 'Open and close each on your phone, with reduce motion off and then on, and tell me if anything feels wrong. The automatic tests prove the state and the reduced-motion rule, not how it feels.',
  },
  {
    id: 'email-inbox',
    title: 'The email-change mail in a real inbox',
    what: 'Changing a sign-in email sends a confirmation link to the new address and a notice to the old one.',
    how: 'On a development account with SMTP set up, change your own email and confirm that both emails arrive and look right.',
  },
  {
    id: 'cookie-after-deploy',
    title: 'The sign-in cookie after the next deploy (Phase 4 carry-over)',
    what: 'The refresh cookie should carry an Expires date only when "Keep me signed in" is ticked.',
    how: 'After the next deploy, sign in on the live site with and without the box ticked, and look at the cookie __Secure-csps_rt in the browser’s developer tools.',
  },
]);

// The Phase 5 and Phase 6 copy is plain data too, loaded by address (see AUTH_COPY above).

/** @param {unknown} error @returns {boolean} true for Node's "cannot find that module or package". */
function isModuleNotFound(error) {
  return error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND';
}

/**
 * Loads the app's copy modules. A copy module that imports the app through "@/" cannot be read by plain Node (npm run review),
 * which knows no such path; then every module is read through one short-lived Vite server that has the same alias. Under
 * Vitest the plain import already works. The server holds no port and no watcher, and is closed before this returns.
 * @param {readonly string[]} files paths from web/src, like 'modules/admin/usersCopy.ts'.
 * @returns {Promise<readonly unknown[]>} the modules, in the order asked.
 */
async function loadCopyModules(files) {
  const urls = files.map((file) => new URL(`../src/${file}`, import.meta.url));
  try {
    /** @type {unknown[]} */
    const loaded = await Promise.all(urls.map((url) => import(url.href)));
    return loaded;
  } catch (error) {
    if (!isModuleNotFound(error)) {
      throw error;
    }
  }
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    root: WEB_DIRECTORY,
    appType: 'custom',
    logLevel: 'error',
    resolve: { alias: { '@': path.join(WEB_DIRECTORY, 'src') } },
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    return await Promise.all(files.map((file) => server.ssrLoadModule(`/src/${file}`)));
  } finally {
    await server.close();
  }
}

const [
  usersCopyModule,
  profileCopyModule,
  auditCopyModule,
  recordMetaCopyModule,
  statesCopyModule,
  temporaryPasswordModule,
  expensesCopyModule,
  settingsCopyModule,
] = await loadCopyModules([
  'modules/admin/usersCopy.ts',
  'modules/admin/profileCopy.ts',
  'modules/admin/auditCopy.ts',
  'components/data/copy.ts',
  'components/states/copy.ts',
  'utils/temporaryPassword.ts',
  'modules/admin/expensesCopy.ts',
  'modules/admin/settingsCopy.ts',
]);

/**
 * The 40 words a suggested temporary password is built from (plan 05-22).
 * @returns {readonly string[]}
 */
export function temporaryPasswordWords() {
  const words = /** @type {{ TEMPORARY_PASSWORD_WORDS?: readonly string[] }} */ (temporaryPasswordModule)
    .TEMPORARY_PASSWORD_WORDS;
  return words ?? [];
}

/**
 * Every sentence of the Phase 5 screens (USERS_COPY, PROFILE_COPY, AUDIT_COPY, the record-meta and conflict-banner copy),
 * one row per string, then the Audit Log action labels and the "What changed" sentences, for the owner's wording review
 * (D-48). A sentence with an address in it shows `{email}` there; a function shows its placeholders as `{x}` and `{y}`.
 * @returns {{ place: string, text: string }[]}
 */
export function phase5Words() {
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
        const text = words('{x}', '{y}', '{z}');
        if (typeof text === 'string') {
          rows.push({ place, text });
        }
      } catch {
        // A function that needs real data has no fixed words to show.
      }
    } else if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      const sentence = /** @type {{ before?: unknown, middle?: unknown, after?: unknown }} */ (value);
      if (typeof sentence.before === 'string' && typeof sentence.after === 'string') {
        const middle = typeof sentence.middle === 'string' ? `${sentence.middle}{email}` : '';
        rows.push({ place, text: `${sentence.before}{email}${middle}${sentence.after}` });
        return;
      }
      for (const [key, child] of entries) {
        if (key !== 'icon') {
          walk(child, [...trail, key]);
        }
      }
    }
  };
  /** @param {unknown} moduleValue @param {string} name @returns {unknown} */
  const exported = (moduleValue, name) => /** @type {Record<string, unknown>} */ (moduleValue)[name];
  walk(exported(usersCopyModule, 'USERS_COPY'), ['Users']);
  walk(exported(profileCopyModule, 'PROFILE_COPY'), ['My Profile']);
  walk(exported(auditCopyModule, 'AUDIT_COPY'), ['Audit Log']);
  walk(exported(recordMetaCopyModule, 'RECORD_META_COPY'), ['Recorded by / Last changed by']);
  walk(/** @type {{ conflict?: unknown }} */ (exported(statesCopyModule, 'STATES_COPY')).conflict, [
    'Stale save banner',
  ]);
  const actions = /** @type {readonly { code: string, label: string }[]} */ (
    exported(auditCopyModule, 'AUDIT_ACTIONS')
  );
  for (const action of actions) {
    rows.push({ place: `Audit Log > action label > ${action.code}`, text: action.label });
  }
  const sentences = /** @type {readonly { action: string, word: string, sentence: string }[]} */ (
    exported(auditCopyModule, 'AUDIT_DETAIL_SENTENCES')
  );
  for (const entry of sentences) {
    rows.push({ place: `Audit Log > What changed > ${entry.action} > ${entry.word}`, text: entry.sentence });
  }
  return rows;
}

/**
 * The Phase 5 section: the rulings page first (what is still open, then what is already ruled), then the words, then every
 * picture grouped by screen.
 * @param {readonly Phase5ReviewShot[]} phase5Review
 * @returns {string}
 */
function phase5ReviewSection(phase5Review) {
  if (phase5Review.length === 0) {
    return '';
  }
  const open = PHASE5_OPEN_ITEMS.map(
    (item, index) =>
      `<tr><td class="n">${String(index + 1)}</td><td><strong>${escapeHtml(item.title)}</strong></td><td>${escapeHtml(item.what)}</td><td>${escapeHtml(item.how)}</td></tr>`,
  ).join('');
  const assumptions = PHASE5_EDGE_ASSUMPTIONS.map(
    (entry) =>
      `<tr><td>${escapeHtml(entry.requirement)}</td><td>${escapeHtml(entry.assumed)}</td><td>${escapeHtml(entry.evidence)}</td></tr>`,
  ).join('');
  const ruled = PHASE5_RULED.map(
    (entry) =>
      `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.topic)}</td><td>${escapeHtml(entry.ruling)}</td><td>${escapeHtml(entry.ruledIn)}</td></tr>`,
  ).join('');
  const words = phase5Words()
    .map((row) => `<tr><td>${escapeHtml(row.place)}</td><td>${escapeHtml(row.text)}</td></tr>`)
    .join('');
  const wordList = temporaryPasswordWords().map(escapeHtml).join(', ');
  const groups = [...new Set(phase5Review.map((shot) => shot.group))];
  const sections = groups
    .map((group) => {
      const ids = [...new Set(phase5Review.filter((shot) => shot.group === group).map((shot) => shot.id))];
      const cases = ids
        .map((id) => {
          const ofCase = phase5Review.filter((shot) => shot.id === id);
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
  return `<section><h2>Profile, users and audit log (Phase 5)</h2>
<p class="note">These pictures show the real screens, signed in as a Manager, with people in every state. Users, My Profile and
the Audit Log are in the page list near the top of this report (Admin: Users, Admin: My Profile, Admin: Audit Log); the
slide-overs, dialogs and special states are below. Nothing here is approved until you say so.</p>
<h3>Still open for you</h3>
<p class="note">These are the only things left to decide or check. Say "approved" with any changes, or describe what to change.</p>
<table><thead><tr><th>#</th><th>What</th><th>What it is</th><th>What you do</th></tr></thead><tbody>${open}</tbody></table>
<h3>The four flagged edge assumptions</h3>
<table><thead><tr><th>Requirement</th><th>What was assumed</th><th>Where it is tested</th></tr></thead><tbody>${assumptions}</tbody></table>
<h3>The 40 temporary-password words</h3>
<p class="note">${wordList}</p>
<h3>Already ruled (nothing to do)</h3>
<p class="note">The UI-SPEC rulings OQ-1 to OQ-11 are decided. They are listed so you can see what was built.</p>
<table><thead><tr><th>#</th><th>What</th><th>The ruling</th><th>Ruled in</th></tr></thead><tbody>${ruled}</tbody></table>
<h3>Words on the Phase 5 screens</h3>
<p class="note">Every sentence the Phase 5 screens say. <strong>{email}</strong> stands for an address; <strong>{x}</strong>,
<strong>{y}</strong> and <strong>{z}</strong> are values the app fills in (a name, a role, a time).</p>
<table><thead><tr><th>Where</th><th>Words</th></tr></thead><tbody>${words}</tbody></table>
${sections}</section>`;
}

// ───────────── Plan 06-19: the Phase 6 screens (Company Expenses, Deleted Expenses, Settings, the Audit Log) ─────────────

/**
 * The one person the Phase 6 pictures add, made through the Testing-only staff fixture: an Admin who pays and records an
 * expense and is then deleted, so the lists read "Dario Lim (former staff)" (OQ-7, OQ-8). The fixture gives the address.
 * @type {readonly Phase5SeedPerson[]}
 */
export const PHASE6_SEED_PEOPLE = Object.freeze([
  { key: 'dario', role: 'Admin', state: 'active', firstName: 'Dario', lastName: 'Lim' },
]);

/**
 * @param {string} id
 * @param {string} label
 * @param {string} group
 * @param {'Manager' | 'Admin'} [signedInAs]
 * @returns {Phase6ReviewCase}
 */
function phase6Case(id, label, group, signedInAs = 'Manager') {
  return { id, label, group, themes: BOTH, signedInAs };
}

/**
 * The UI-SPEC "Visual Review" set for Phase 6, beyond the plain pages in REVIEW_TARGETS: the states a page alone does not
 * show. Each is a picture of the real screen with the real server behind it, in Blush and Espresso at 390, 820 and 1440 px.
 * The three Admin cases are signed in as an Admin; every other one as a Manager.
 * @type {readonly Phase6ReviewCase[]}
 */
export const PHASE6_REVIEW_CASES = Object.freeze([
  phase6Case(
    'e1-manager-list',
    'E1 as a Manager: an Upcoming row, a row by a former staff member, a retired category, and the total for both pages (10 a page)',
    'E1 Company Expenses',
  ),
  phase6Case(
    'e1-manager-empty-top-category',
    'E1 as a Manager in a month with no expenses: the month cards with the empty Top category',
    'E1 Company Expenses',
  ),
  phase6Case('e1-empty', 'E1 when nothing is recorded yet (first use)', 'E1 Company Expenses'),
  phase6Case('e1-no-matches', 'E1 when the search matches nothing', 'E1 Company Expenses'),
  phase6Case(
    'e1-admin-list',
    'E1 as an Admin: Edit on the expense they paid, View on the others, no Deleted Expenses link',
    'E1 Company Expenses',
    'Admin',
  ),
  phase6Case('e2-add', 'E2 Add Expense: Paid by starts as the signed-in person, marked "(you)"', 'E2 Expense window'),
  phase6Case(
    'e2-edit-record-meta',
    'E2 Edit Expense: Recorded by and Last changed by at the bottom',
    'E2 Expense window',
  ),
  phase6Case(
    'e2-edit-access-note',
    'E2 Edit Expense as an Admin: the note shown after Paid by is moved to someone else (D-26)',
    'E2 Expense window',
    'Admin',
  ),
  phase6Case(
    'e2-edit-conflict',
    'E2 Edit Expense: the banner when someone else saved first (409)',
    'E2 Expense window',
  ),
  phase6Case(
    'e2-view',
    'E2 Expense details (View): an Admin reading a coworker’s expense',
    'E2 Expense window',
    'Admin',
  ),
  phase6Case('e3-delete', 'E3 Delete Expense: the confirmation', 'E3 Delete confirmations'),
  phase6Case('e3-purge', 'E3 Delete Permanently: the confirmation with the warning', 'E3 Delete confirmations'),
  phase6Case(
    'e4-rows',
    'E4 Deleted Expenses with deleted rows (Restore and Delete Permanently)',
    'E4 Deleted Expenses',
  ),
  phase6Case('e4-empty', 'E4 Deleted Expenses with nothing deleted', 'E4 Deleted Expenses'),
  phase6Case(
    's1-categories',
    'S1 Expense Categories: an active, a retired, a never-used and the Others row',
    'S1 and S2 Settings',
  ),
  phase6Case('s2-add-category', 'S2 Add Category: the colour choices and the live badge preview', 'S1 and S2 Settings'),
  phase6Case(
    'audit-expense-expanded',
    'A1 Audit Log: an "Expense changed" entry opened, with its change lines',
    'A1 Audit Log',
  ),
]);

/**
 * One picture per case, per theme, at 390, 820 and 1440 px.
 * @param {readonly Phase6ReviewCase[]} [cases]
 * @returns {Phase6ReviewShot[]}
 */
export function planPhase6ReviewShots(cases = PHASE6_REVIEW_CASES) {
  return cases.flatMap((entry) =>
    entry.themes.flatMap((theme) =>
      REVIEW_WIDTHS.map((width) => ({
        id: entry.id,
        label: entry.label,
        group: entry.group,
        signedInAs: entry.signedInAs,
        theme,
        width,
        file: `phase6-review/${entry.id}-${theme}-${String(width)}.png`,
      })),
    ),
  );
}

/**
 * @param {string} label
 * @param {string} text
 * @param {{ recommended?: boolean, built?: boolean }} [flags]
 * @returns {Phase6Option}
 */
function option(label, text, { recommended = false, built = false } = {}) {
  return { label, text, recommended, built };
}

/**
 * Everything the Phase 6 build leaves for the owner, in the order the review pack asks it (UI-SPEC "Owner Rulings Needed"
 * OQ-1 to OQ-15, the assumptions A-06-01 and A-06-02, the inline SQL item and the research questions 2 and 5). Each entry
 * names its options, recommended first, and marks the one that is built. Nothing here is approved: an `open` entry waits for
 * the owner's ruling and the built default stands; a `ruled` entry carries the owner's ruling, which the build has still to
 * follow. The wording of the screens is not here: it is the table "Words on the Phase 6 screens".
 * @type {readonly Phase6Ruling[]}
 */
export const PHASE6_RULINGS = Object.freeze([
  {
    id: 'OQ-1',
    status: 'open',
    topic: 'Where "Delete permanently" sits on the main list',
    options: [
      option(
        'A',
        'A third row icon (an eraser), named "Delete {description}, {date} permanently", for Managers only. It is one tap away, and the Users list already has three icons.',
        { recommended: true, built: true },
      ),
      option('B', 'No third icon: a "Delete Permanently" button in the Edit window footer for Managers.'),
    ],
  },
  {
    id: 'OQ-2',
    status: 'open',
    topic: 'How Managers reach deleted expenses',
    options: [
      option('A', 'A separate page, Deleted Expenses, reached by a secondary button in the Company Expenses header.', {
        recommended: true,
        built: true,
      }),
      option('B', '"All" and "Deleted" tabs on the Company Expenses page.'),
    ],
  },
  {
    id: 'OQ-3',
    status: 'open',
    topic: 'The Settings item in the side menu',
    options: [
      option(
        'A',
        '"Settings" with a gear icon after Audit Log, tagged Manager, in the phone drawer but not in the tab bar.',
        { recommended: true, built: true },
      ),
      option('B', 'Under My Profile at the bottom.'),
    ],
  },
  {
    id: 'OQ-4',
    status: 'open',
    topic: 'Can a retired category be used again?',
    options: [
      option('A', 'Yes: "Use {name} again" brings it back to the Add form.', { recommended: true, built: true }),
      option('B', 'No: retiring is final.'),
    ],
  },
  {
    id: 'OQ-5',
    status: 'open',
    topic: 'Confirm before Restore, Retire and Use again?',
    options: [
      option('A', 'No confirmation. Each can be undone, and the toast says what happened.', {
        recommended: true,
        built: true,
      }),
      option('B', 'A confirmation dialog for each.'),
    ],
  },
  {
    id: 'OQ-6',
    status: 'open',
    topic: 'Protect the Others category',
    options: [
      option(
        'A',
        'Others can change colour but cannot be renamed, retired or deleted, so it always sorts last and every expense has a fallback.',
        { recommended: true, built: true },
      ),
      option('B', 'Others behaves like any other category.'),
    ],
  },
  {
    id: 'OQ-7',
    status: 'open',
    topic: 'Editing an expense whose payer is no longer active',
    options: [
      option(
        'A',
        'Keeping the saved payer is allowed; only a new or changed payer must be active. The old payer shows as "(inactive)" or "(former staff)".',
        { recommended: true, built: true },
      ),
      option('B', 'Every save needs an active payer.'),
    ],
  },
  {
    id: 'OQ-8',
    status: 'open',
    topic: 'Expenses an Admin cannot edit',
    options: [
      option(
        'A',
        'An eye "View" action opens the same window read-only (Notes, Paid by, Recorded by, Last changed by).',
        { recommended: true, built: true },
      ),
      option('B', 'No action on those rows.'),
    ],
  },
  {
    id: 'OQ-9',
    status: 'open',
    topic: 'Category in the Add form',
    options: [
      option('A', 'Nothing is preselected: the placeholder "Choose a category", and the field is required.', {
        recommended: true,
        built: true,
      }),
      option('B', 'Preselect the first category, A to Z.'),
    ],
  },
  {
    id: 'OQ-10',
    status: 'open',
    topic: 'Length limits the PRD does not set',
    options: [
      option('A', 'Description 200 characters, category name 40 characters.', { recommended: true, built: true }),
      option('B', 'Other limits you name.'),
    ],
  },
  {
    id: 'OQ-11',
    status: 'open',
    topic: 'Names of the row buttons',
    options: [
      option(
        'Default',
        'Each button is named by its row, like "Edit {description}, {date}", as the Users list does, so a screen reader can tell them apart.',
        { recommended: true, built: true },
      ),
    ],
  },
  {
    id: 'OQ-12',
    status: 'open',
    topic: 'Five new icons',
    options: [
      option(
        'Default',
        'Add settings, rotate-ccw (Restore), archive (Retire), archive-restore (Use again) and eraser (Delete permanently) from the installed icon set.',
        { recommended: true, built: true },
      ),
    ],
  },
  {
    id: 'OQ-13',
    status: 'open',
    topic: 'Amended wording of the design spec',
    options: [
      option(
        'Default',
        'Dashes become plain punctuation and "to"; the Delete message says the expense can be restored; the toast says where to restore it; "Total shown" becomes "Total" because it covers every page; the empty message names the dates; the Audit Log subline adds expenses. Built as written.',
        { recommended: true, built: true },
      ),
    ],
  },
  {
    id: 'OQ-14',
    status: 'open',
    topic: 'Two primary buttons in the first-use empty state',
    options: [
      option(
        'A',
        'Keep the drawing in the design: Add Expense in the header and in the empty state, both primary, both doing the same thing.',
        { recommended: true, built: true },
      ),
      option('B', 'Make the empty-state button secondary.'),
    ],
  },
  {
    id: 'OQ-15',
    status: 'open',
    topic: 'Every wording gap in the contract, including the audit labels',
    options: [
      option(
        'Default',
        'Built as written and reviewed before release. Every sentence is in the table "Words on the Phase 6 screens" below.',
        { recommended: true, built: true },
      ),
    ],
  },
  {
    id: 'A-06-01',
    status: 'ruled',
    topic: 'Paid by and a temporary password (assumption A-06-01, D-32)',
    options: [
      option(
        '1',
        'They can be chosen only after their first sign-in. The app already marks an account at the first sign-in code, so no database change is needed, and staff whose password a Manager reset stay choosable.',
        { recommended: true, built: true },
      ),
      option(
        '2',
        'Keep the rule as written ("has a password"), so a person a Manager created with a temporary password can be chosen before their first sign-in.',
      ),
      option(
        '3',
        'Hide anyone who still has to change a temporary password. This also hides long-time staff after a Manager resets their password, until they sign in again.',
      ),
    ],
    ruling:
      'Option 1 (D-49, owner, 2026-10-25). Plan 06-20 built it: a person a Manager adds with a temporary password can be chosen as Paid by only after their first sign-in code, and staff whose password a Manager reset stay choosable.',
    whereItChanges:
      'The set-up check in src/Csps.Infrastructure/Identity/StaffDirectory.cs (two clauses), src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs and src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs. The test StaffLookupEndpointTests.ATemporaryPasswordPersonWhoHasNotSignedInIsNotListed pins option 1.',
  },
  {
    id: 'A-06-02',
    status: 'open',
    topic: 'Month cards at the edges (assumption A-06-02, CEXP-03)',
    options: [
      option(
        '1',
        'Confirm: the cards follow the business time zone in Site settings, which is Asia/Manila today. They are tested at the change of month in Manila time, for an empty month, for ties, for upcoming dates and for deleted expenses.',
        { recommended: true, built: true },
      ),
      option('2', 'Name another case you want tested before release.'),
    ],
  },
  {
    id: 'SQL-06-11',
    status: 'ruled',
    topic: 'Hand-written SQL in three existing files (the 06-11 item, your rule on inline SQL)',
    options: [
      option(
        '1',
        'Approve IdempotencyGate.cs, AccountTokenStore.cs and ManagerRosterLock.cs by name. Each runs one short SQL line that takes a database lock, so two requests at the same moment cannot collide. Nothing changes.',
        { recommended: true },
      ),
      option(
        '2',
        'Rework the three without hand-written SQL: each lock is rebuilt with EF’s own tools (for example a lock row updated inside the same transaction). More code, and possibly a small new table.',
        { built: true },
      ),
    ],
    ruling:
      'Option 2 (D-50, owner, 2026-10-25): no inline SQL, not even these three. Plan 06-21 built it: each lock is now a row in the new DatabaseLocks table, taken with EF’s own tools, and the guard test allows no file.',
    whereItChanges:
      'src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs, src/Csps.Infrastructure/Identity/AccountTokenStore.cs and src/Csps.Infrastructure/Identity/ManagerRosterLock.cs, over the new DatabaseLocks table (migration AddDatabaseLocks). The guard test is tests/Csps.ArchitectureTests/NoInlineSqlTests.cs.',
  },
  {
    id: 'RQ-2',
    status: 'open',
    topic: 'How the Audit Log shows expense values (research question 2)',
    options: [
      option(
        'A',
        'The server turns an expense event’s stored detail into change lines and names the payer and the category. The "Done to" filter also matches an expense by its payer, current, old or new. No schema change.',
        { recommended: true, built: true },
      ),
      option('B', 'The web parses the stored detail itself and asks the people list for names.'),
    ],
  },
  {
    id: 'RQ-5',
    status: 'open',
    topic: 'How much data the speed test uses (research question 5)',
    options: [
      option(
        'Default',
        'About 20 expenses a day for 5 years, about 36,500 rows. Tell us if the shop’s real rate is higher.',
        { recommended: true, built: true },
      ),
    ],
  },
  {
    id: 'SNAP-06-15',
    status: 'open',
    topic: 'The snapshot line on deleted, restored and permanently deleted entries',
    options: [
      option(
        'Default',
        'Each of these Audit Log entries shows one line with the facts of the expense: date, category, amount and who paid, like "Oct 5, 2026 · Utilities · ₱8,642.35 · Paid by Ana Reyes". The description and the notes are never stored. A payer who has left reads "(former staff)".',
        { recommended: true, built: true },
      ),
    ],
  },
]);

/**
 * What the screenshots and tests could not show, left for the owner's own eyes (plans 06-18 and 06-19, STATE.md Owner backlog).
 * @type {readonly { readonly id: string, readonly title: string, readonly what: string, readonly how: string }[]}
 */
export const PHASE6_LOOK_AT = Object.freeze([
  {
    id: 'total-999',
    title: 'A very large period total on the real list',
    what: 'The footer total ₱999,999,999.99 fits its card at 320 px on the Component Showcase. On the real list it would need about a thousand rows, so it is proved there only. Money figures of 15 characters or more are drawn smaller than the other cards on purpose.',
    how: 'Open the Component Showcase section "Expenses and settings" and look at the month cards and the footer total.',
  },
  {
    id: 'former-staff-real',
    title: 'A former staff member on the real pages',
    what: 'The pictures above show "(former staff)" on the real list (Dario Lim). A 100-character name with that mark is proved on the Component Showcase only.',
    how: 'Look at the Paid by and Recorded by cells.',
  },
  {
    id: 'zoom',
    title: '200% zoom',
    what: 'The tests emulate 200% zoom with a 640 x 360 window. They do not use the browser’s own zoom.',
    how: 'Zoom your browser to 200% on Company Expenses and Settings and tell us if anything is cut off.',
  },
  {
    id: 'ci-speed',
    title: 'The speed check on the CI runner (A-06-03)',
    what: 'The five-year list test passes here with room (worst case 197.8 ms against 300 ms). It cannot be confirmed here that it also passes in CI with the SQL container.',
    how: 'After the first CI run of this branch, read the printed numbers. If the margin is thin, pick: keep 300 ms and run alone first, or allow a CI-only margin.',
  },
]);

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {unknown} the module's export.
 */
function exportOf(value, name) {
  return /** @type {Record<string, unknown>} */ (value)[name];
}

/** The placeholders a copy function is shown with: a name, a role, a time, a count. */
const COPY_PLACEHOLDERS = Object.freeze(['{x}', '{y}', '{z}', '{u}', '{v}']);

/**
 * Walks plain copy (strings, functions and nested objects) into rows. A function is called with one placeholder per declared
 * parameter and gives a row when it returns text.
 * @param {unknown} value
 * @param {readonly string[]} trail
 * @param {{ place: string, text: string }[]} rows
 */
function collectCopyRows(value, trail, rows) {
  const place = trail.join(' > ');
  if (typeof value === 'string') {
    rows.push({ place, text: value });
  } else if (typeof value === 'function') {
    const words = /** @type {(...args: string[]) => unknown} */ (/** @type {unknown} */ (value));
    try {
      /** @type {unknown} */
      const text = words(...COPY_PLACEHOLDERS.slice(0, words.length));
      if (typeof text === 'string') {
        rows.push({ place, text });
      }
    } catch {
      // A function that needs real data has no fixed words to show.
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'icon') {
        collectCopyRows(child, [...trail, key], rows);
      }
    }
  }
}

/** @type {readonly { readonly place: string, readonly line: Record<string, unknown> }[]} */
const AUDIT_CHANGE_SAMPLES = Object.freeze([
  { place: 'amount', line: { field: 'amount', from: '8642.35', to: '9100.00', fromPerson: null, toPerson: null } },
  { place: 'date', line: { field: 'date', from: '2026-10-05', to: '2026-10-06', fromPerson: null, toPerson: null } },
  { place: 'category', line: { field: 'category', from: '{x}', to: '{y}', fromPerson: null, toPerson: null } },
  {
    place: 'category that is gone',
    line: { field: 'category', from: '{x}', to: null, fromPerson: null, toPerson: null },
  },
  {
    place: 'payer',
    line: {
      field: 'payer',
      from: null,
      to: null,
      fromPerson: { id: 'x', name: '{x}', formerStaff: false },
      toPerson: { id: 'y', name: '{y}', formerStaff: false },
    },
  },
  {
    place: 'payer who has left',
    line: {
      field: 'payer',
      from: null,
      to: null,
      fromPerson: { id: 'x', name: '{x}', formerStaff: true },
      toPerson: { id: 'y', name: '{y}', formerStaff: false },
    },
  },
  { place: 'description', line: { field: 'description', from: null, to: null, fromPerson: null, toPerson: null } },
  { place: 'notes', line: { field: 'notes', from: null, to: null, fromPerson: null, toPerson: null } },
  { place: 'category added', line: { field: 'name', from: null, to: '{x}', fromPerson: null, toPerson: null } },
  { place: 'category renamed', line: { field: 'name', from: '{x}', to: '{y}', fromPerson: null, toPerson: null } },
  { place: 'category added, color', line: { field: 'tone', from: null, to: 'info', fromPerson: null, toPerson: null } },
  {
    place: 'category recolored',
    line: { field: 'tone', from: 'info', to: 'success', fromPerson: null, toPerson: null },
  },
]);

/**
 * Every sentence of the Phase 6 screens: the Company Expenses and Settings copy (one row per string), then the Phase 6
 * additions of the Audit Log copy: the two action groups, the twelve expense and category labels, the change lines and the
 * snapshot line, for the owner's wording review (05 D-48). A function shows its placeholders as `{x}`, `{y}`, `{z}`.
 * @returns {{ place: string, text: string }[]}
 */
export function phase6Words() {
  /** @type {{ place: string, text: string }[]} */
  const rows = [];
  const expenses = exportOf(expensesCopyModule, 'EXPENSES_COPY');
  collectCopyRows(expenses, ['Company Expenses'], rows);
  const kpis = /** @type {{ entries: (count: number) => string, thisMonth: (month: string | null) => string }} */ (
    /** @type {{ kpis: unknown }} */ (expenses).kpis
  );
  rows.push(
    { place: 'Company Expenses > kpis > entries (none)', text: kpis.entries(0) },
    { place: 'Company Expenses > kpis > entries (one)', text: kpis.entries(1) },
    { place: 'Company Expenses > kpis > thisMonth (month not known yet)', text: kpis.thisMonth(null) },
  );
  collectCopyRows(exportOf(settingsCopyModule, 'SETTINGS_COPY'), ['Settings'], rows);

  const groups = /** @type {readonly string[]} */ (exportOf(auditCopyModule, 'AUDIT_GROUPS'));
  for (const group of groups.filter((name) => name === 'Company expenses' || name === 'Expense categories')) {
    rows.push({ place: 'Audit Log > action group', text: group });
  }
  const actions = /** @type {readonly { code: string, label: string }[]} */ (
    exportOf(auditCopyModule, 'AUDIT_ACTIONS')
  );
  for (const action of actions.filter(
    (entry) => entry.code.startsWith('company-expense.') || entry.code.startsWith('expense-category.'),
  )) {
    rows.push({ place: `Audit Log > action label > ${action.code}`, text: action.label });
  }
  const describeChange = /** @type {(line: Record<string, unknown>) => string | null} */ (
    exportOf(auditCopyModule, 'describeAuditChange')
  );
  for (const sample of AUDIT_CHANGE_SAMPLES) {
    const text = describeChange(sample.line);
    if (text !== null) {
      rows.push({ place: `Audit Log > What changed > ${sample.place}`, text });
    }
  }
  const describeSnapshot = /** @type {(snapshot: Record<string, unknown>) => string} */ (
    exportOf(auditCopyModule, 'describeAuditSnapshot')
  );
  rows.push(
    {
      place: 'Audit Log > snapshot on deleted, restored and permanently deleted entries',
      text: describeSnapshot({
        date: '2026-10-05',
        category: '{x}',
        amount: '8642.35',
        payer: { id: 'x', name: '{y}', formerStaff: false },
      }),
    },
    {
      place: 'Audit Log > snapshot, category gone and payer who has left',
      text: describeSnapshot({
        date: '2026-10-05',
        category: null,
        amount: '8642.35',
        payer: { id: 'x', name: '{y}', formerStaff: true },
      }),
    },
  );
  return rows;
}

/** @param {Phase6Option} entry @returns {string} */
function phase6OptionItem(entry) {
  const marks = [entry.recommended ? ' <em>(recommended)</em>' : '', entry.built ? ' <em>(built now)</em>' : ''].join(
    '',
  );
  return `<li><strong>${escapeHtml(entry.label)}.</strong> ${escapeHtml(entry.text)}${marks}</li>`;
}

/**
 * The Phase 6 section: the rulings page first (what is still open, then what the owner has ruled since), the things to look at
 * by eye, then the words, then every picture grouped by screen.
 * @param {readonly Phase6ReviewShot[]} phase6Review
 * @returns {string}
 */
function phase6ReviewSection(phase6Review) {
  if (phase6Review.length === 0) {
    return '';
  }
  const optionList = (/** @type {Phase6Ruling} */ entry) =>
    `<ul class="options">${entry.options.map(phase6OptionItem).join('')}</ul>`;
  const open = PHASE6_RULINGS.filter((entry) => entry.status === 'open')
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.topic)}</td><td>${optionList(entry)}</td></tr>`,
    )
    .join('');
  const ruled = PHASE6_RULINGS.filter((entry) => entry.status === 'ruled')
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.topic)}</td><td>${optionList(entry)}</td><td>${escapeHtml(entry.ruling ?? '')}</td><td>${escapeHtml(entry.whereItChanges ?? '')}</td></tr>`,
    )
    .join('');
  const lookAt = PHASE6_LOOK_AT.map(
    (item) =>
      `<tr><td><strong>${escapeHtml(item.title)}</strong></td><td>${escapeHtml(item.what)}</td><td>${escapeHtml(item.how)}</td></tr>`,
  ).join('');
  const words = phase6Words()
    .map((row) => `<tr><td>${escapeHtml(row.place)}</td><td>${escapeHtml(row.text)}</td></tr>`)
    .join('');
  const groups = [...new Set(phase6Review.map((shot) => shot.group))];
  const sections = groups
    .map((group) => {
      const ids = [...new Set(phase6Review.filter((shot) => shot.group === group).map((shot) => shot.id))];
      const cases = ids
        .map((id) => {
          const ofCase = phase6Review.filter((shot) => shot.id === id);
          const label = ofCase[0]?.label ?? id;
          const role = ofCase[0]?.signedInAs ?? 'Manager';
          const figures = ofCase
            .map(
              (shot) =>
                `<figure class="gap"><figcaption>${escapeHtml(themeName(shot.theme))}, ${String(shot.width)} px</figcaption>` +
                `<a href="${escapeHtml(shot.file)}"><img src="${escapeHtml(shot.file)}" alt="${escapeHtml(
                  `${label}, ${themeName(shot.theme)}, ${String(shot.width)} px`,
                )}"></a></figure>`,
            )
            .join('');
          return `<h4>${escapeHtml(label)}</h4><p class="note">Signed in as ${escapeHtml(role === 'Admin' ? 'an Admin' : 'a Manager')}.</p><div class="row">${figures}</div>`;
        })
        .join('\n');
      return `<h3>${escapeHtml(group)}</h3>\n${cases}`;
    })
    .join('\n');
  return `<section><h2>Company expenses and settings (Phase 6)</h2>
<p class="note">These pictures show the real screens, signed in as a Manager and as an Admin, with expenses made for the run (a row
that is still ahead, a row by a member of staff who has left, a retired category, deleted expenses). Company Expenses, Deleted
Expenses and Settings are also in the page list near the top of this report (Admin: Company Expenses, Admin: Deleted Expenses,
Admin: Settings); the windows, dialogs and special states are below. The month cards at the top of Company Expenses count every
expense in the test database CSPS_E2E, earlier test runs included, so their figures are not the shop’s. Nothing here is approved
until you say so.</p>
<h3>Phase 6: still open for you</h3>
<p class="note">The build uses the option marked "built now" for each of these. Say "approved" with any changes, or name the
option you want instead. The recommended option is listed first when it is not the one built.</p>
<table><thead><tr><th>#</th><th>What</th><th>The options</th></tr></thead><tbody>${open}</tbody></table>
<h3>Phase 6: ruled by you since the plan was written</h3>
<p class="note">You have ruled these. The build still has to follow the ruling; until then the option marked "built now" is what the
app does.</p>
<table><thead><tr><th>#</th><th>What</th><th>The options</th><th>Your ruling</th><th>Where it changes</th></tr></thead><tbody>${ruled}</tbody></table>
<h3>Also look at</h3>
<table><thead><tr><th>What</th><th>What it is</th><th>What you do</th></tr></thead><tbody>${lookAt}</tbody></table>
<h3>Words on the Phase 6 screens</h3>
<p class="note">Every sentence the Company Expenses, Deleted Expenses and Settings screens say, and the new Audit Log lines.
<strong>{x}</strong>, <strong>{y}</strong> and <strong>{z}</strong> are values the app fills in (a name, an amount, a date).</p>
<table><thead><tr><th>Where</th><th>Words</th></tr></thead><tbody>${words}</tbody></table>
${sections}</section>`;
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
 * @param {{ request: import('@playwright/test').APIRequestContext, staff: MadeStaff } | undefined} [signedIn] signs this
 *   person in through the real sign-in screens first (plan 05-37), for the pages only a Manager can open.
 * @returns {Promise<{ page: import('@playwright/test').Page, close(): Promise<void> }>}
 */
export async function openReviewPage(browser, origin, target, problems, signedIn) {
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
  if (signedIn !== undefined) {
    // The sign-in page's own first refresh is a 401 by design, so the console is read only once the person is in.
    await signIn(page, signedIn.request, origin, signedIn.staff);
  }
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
  if (signedIn !== undefined) {
    // A signed-in page loads its list after the first paint; the picture is taken once those answers are in.
    await page.waitForLoadState('networkidle');
  }
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

/** Hides every sticky or fixed element outside the case with this id (a page script, run as an expression). */
const hideStickyOutside = (/** @type {string} */ caseId) => `((id) => {
  const frame = document.querySelector('[data-case="' + id + '"]');
  for (const element of document.querySelectorAll('*')) {
    const position = getComputedStyle(element).position;
    if ((position === 'sticky' || position === 'fixed') && !frame.contains(element) && !element.contains(frame)) {
      element.setAttribute('data-review-hidden', element.style.visibility);
      element.style.visibility = 'hidden';
    }
  }
})(${JSON.stringify(caseId)})`;

/** Puts back what hideStickyOutside hid. */
const SHOW_STICKY = `(() => {
  for (const element of document.querySelectorAll('[data-review-hidden]')) {
    element.style.visibility = element.getAttribute('data-review-hidden');
    element.removeAttribute('data-review-hidden');
  }
})()`;

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
          // A case taller than the window is photographed in pieces; the shell's sticky top bar and tab bar would show up
          // in the middle of the picture, so they are hidden while the frame is taken.
          await page.evaluate(hideStickyOutside(shot.id));
          await frame.screenshot({ path: target });
          await page.evaluate(SHOW_STICKY);
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

// ───────────── Plan 05-37: capturing the Phase 5 screens signed in as a Manager ─────────────

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {import('@playwright/test').APIRequestContext} ApiRequest */
/** @typedef {{ readonly key: string, readonly userId: string, readonly email: string, readonly password: string, readonly name: string }} MadeStaff */
/** @typedef {{ readonly tag: string, readonly people: Readonly<Record<string, MadeStaff>>, readonly coraEmail: string }} Phase5Seed */

/** The height of the review window at each width; the short shell is 600 px tall. */
function windowHeight(/** @type {number} */ width) {
  if (width === SHORT_SCREEN_WIDTH) {
    return SHORT_SCREEN_HEIGHT;
  }
  const heights = /** @type {Record<number, number>} */ (VIEWPORT_HEIGHTS);
  return heights[width] ?? 900;
}

/**
 * Waits up to 30 seconds for a mail to an address (with a part of the subject, after a cursor id) in the Testing sink and
 * returns the newest match. Nothing is ever sent: the Testing host keeps mail in memory (D-27).
 * @param {ApiRequest} request
 * @param {string} to
 * @param {string} subjectPart
 * @param {number} after
 * @returns {Promise<{ id: number, subject: string, text: string }>}
 */
async function waitForMail(request, to, subjectPart, after) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await request.get('/api/testing/emails', { params: { to, after } });
    /** @type {unknown} */
    const body = await response.json();
    const mails = /** @type {{ id: number, subject: string, text: string }[]} */ (Array.isArray(body) ? body : []);
    const found = mails.filter((mail) => mail.subject.includes(subjectPart)).at(-1);
    if (found !== undefined) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No "${subjectPart}" mail to ${to} arrived in the Testing sink.`);
}

/**
 * The id of the newest mail to an address, or 0: a mail with a bigger id is a new one.
 * @param {ApiRequest} request
 * @param {string} to
 * @returns {Promise<number>}
 */
async function newestMailId(request, to) {
  const response = await request.get('/api/testing/emails', { params: { to, after: 0 } });
  /** @type {unknown} */
  const body = await response.json();
  const mails = /** @type {{ id: number }[]} */ (Array.isArray(body) ? body : []);
  return mails.at(-1)?.id ?? 0;
}

/**
 * Makes one staff member through the Testing-only staff fixture; the address is `review-<tag>-<key>@csps.test`.
 * @param {ApiRequest} request
 * @param {Phase5SeedPerson} person
 * @param {string} tag
 * @returns {Promise<MadeStaff>}
 */
async function makeStaff(request, person, tag) {
  const response = await request.post('/api/testing/staff', {
    data: {
      role: person.role,
      state: person.state,
      firstName: person.firstName,
      lastName: person.lastName,
      email: `review-${tag}-${person.key}@csps.test`,
    },
  });
  if (response.status() !== 201) {
    throw new Error(`The staff fixture answered ${String(response.status())} for ${person.key}, not 201.`);
  }
  /** @type {unknown} */
  const body = await response.json();
  const made = /** @type {{ userId?: string, email?: string, password?: string }} */ (body);
  if (typeof made.userId !== 'string' || typeof made.email !== 'string') {
    throw new Error(`The staff fixture returned an unexpected body for ${person.key}.`);
  }
  return {
    key: person.key,
    userId: made.userId,
    email: made.email,
    password: made.password ?? '',
    name: `${person.firstName} ${person.lastName}`,
  };
}

/**
 * Signs a staff member in through the real screens, as web/e2e/auth.ts does: the email and password, the code from the
 * Testing sink, Verify Code. Resolves with the access token of the new session.
 * @param {Page} page
 * @param {ApiRequest} request
 * @param {string} origin
 * @param {MadeStaff} staff
 * @returns {Promise<string>}
 */
async function signIn(page, request, origin, staff) {
  const after = await newestMailId(request, staff.email);
  await page.goto(`${origin}/admin/login`);
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Password', { exact: true }).fill(staff.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('heading', { level: 1, name: 'Check your email' }).waitFor({ timeout: 30_000 });
  const mail = await waitForMail(request, staff.email, 'is your CSPS sign-in code', after);
  const code = /^(\d{6}) is your CSPS sign-in code$/.exec(mail.subject)?.[1];
  if (code === undefined) {
    throw new Error(`The sign-in mail to ${staff.email} has no six-digit code.`);
  }
  const verified = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/two-factor/verify'));
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Verify Code' }).click();
  /** @type {unknown} */
  const body = await (await verified).json();
  const token = /** @type {{ session?: { accessToken?: string } }} */ (body).session?.accessToken;
  if (typeof token !== 'string') {
    throw new Error(`The sign-in of ${staff.email} returned no access token.`);
  }
  await page.waitForURL(/\/admin(\/sessions)?$/, { timeout: 30_000 });
  return token;
}

/**
 * Signs a staff member in on a throwaway page and returns the access token, for the calls that set the pictures up.
 * @param {import('@playwright/test').Browser} browser
 * @param {ApiRequest} request
 * @param {string} origin
 * @param {MadeStaff} staff
 * @returns {Promise<string>}
 */
async function tokenFor(browser, request, origin, staff) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    return await signIn(await context.newPage(), request, origin, staff);
  } finally {
    await context.close();
  }
}

/**
 * One call to the API as a signed-in person; a POST carries a fresh Idempotency-Key as the web app sends. Returns the JSON
 * body, or null for an empty answer.
 * @param {ApiRequest} request
 * @param {string} token
 * @param {'GET' | 'POST' | 'PUT' | 'DELETE'} method
 * @param {string} url
 * @param {unknown} [data]
 * @returns {Promise<unknown>}
 */
async function callApi(request, token, method, url, data) {
  /** @type {Record<string, string>} */
  const headers = { Authorization: `Bearer ${token}` };
  if (method === 'POST') {
    headers['Idempotency-Key'] = randomUUID();
  }
  const response = await request.fetch(url, { method, headers, data });
  if (!response.ok()) {
    throw new Error(`${method} ${url} answered ${String(response.status())}.`);
  }
  if (response.status() === 204) {
    return null;
  }
  /** @type {unknown} */
  const body = await response.json();
  return body;
}

/**
 * Makes the people of PHASE5_SEED_PEOPLE and gives them a history: Carlos adds Cora and is then deleted by Bea, Bea locks and
 * unlocks Ana (audit entries), and Carmen asks to change her email (a change waiting for confirmation).
 * @param {import('@playwright/test').Browser} browser
 * @param {ApiRequest} request
 * @param {string} origin
 * @returns {Promise<Phase5Seed>}
 */
async function seedPhase5(browser, request, origin) {
  const tag = randomUUID().slice(0, 8);
  /** @type {Record<string, MadeStaff>} */
  const people = {};
  for (const person of PHASE5_SEED_PEOPLE) {
    people[person.key] = await makeStaff(request, person, tag);
  }
  const must = (/** @type {string} */ key) => {
    const found = people[key];
    if (found === undefined) {
      throw new Error(`The seed has no person "${key}".`);
    }
    return found;
  };
  const coraEmail = `review-${tag}-cora@csps.test`;
  const carlosToken = await tokenFor(browser, request, origin, must('carlos'));
  await callApi(request, carlosToken, 'POST', '/api/v1/users', {
    firstName: 'Cora',
    lastName: 'Aquino',
    email: coraEmail,
    role: 'Admin',
    access: 'invitation',
  });
  const carmenToken = await tokenFor(browser, request, origin, must('carmen'));
  await callApi(request, carmenToken, 'POST', '/api/v1/profile/email-change', {
    newEmail: `review-${tag}-carmen-new@csps.test`,
    currentPassword: must('carmen').password,
  });
  const managerToken = await tokenFor(browser, request, origin, must('manager'));
  await callApi(request, managerToken, 'POST', `/api/v1/users/${must('ana').userId}/lock`);
  await callApi(request, managerToken, 'POST', `/api/v1/users/${must('ana').userId}/unlock`);
  await callApi(request, managerToken, 'DELETE', `/api/v1/users/${must('carlos').userId}`);
  return { tag, people, coraEmail };
}

/**
 * A fresh browser context at a width and theme, signed in as the seeded Manager. Console errors and warnings are collected
 * from the moment the sign-in is done (the sign-in page's own first refresh is a 401 by design).
 * @param {import('@playwright/test').Browser} browser
 * @param {ApiRequest} request
 * @param {string} origin
 * @param {Phase5Seed} seed
 * @param {{ theme: Theme, width: number }} view
 * @param {string[]} problems
 * @param {string} [who] the key of the seeded person to sign in as; the Manager unless an Admin's screen is photographed.
 * @returns {Promise<{ page: Page, close(): Promise<void> }>}
 */
async function openSignedIn(browser, request, origin, seed, view, problems, who = 'manager') {
  const context = await browser.newContext({
    viewport: { width: view.width, height: windowHeight(view.width) },
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 1,
  });
  if (view.theme === 'dark') {
    await context.addInitScript({ content: `try { localStorage.setItem('csps-theme', 'dark'); } catch {}` });
  }
  const page = await context.newPage();
  const person = seed.people[who];
  if (person === undefined) {
    throw new Error(`The seed has no person "${who}".`);
  }
  await signIn(page, request, origin, person);
  const where = `(${themeName(view.theme)}, ${String(view.width)} px)`;
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const text = message.text();
      if (!(EXPECTED_CONSOLE.get(page) ?? []).some((expected) => expected.test(text))) {
        problems.push(`${where}: ${text}`);
      }
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`${where}: ${error.message}`);
  });
  return { page, close: () => context.close() };
}

/** Waits for the page's h1, its fonts and its motion (SETTLE). */
async function pageReady(/** @type {Page} */ page, /** @type {string} */ h1) {
  await page.locator('h1', { hasText: h1 }).first().waitFor({ timeout: 30_000 });
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.evaluate(SETTLE);
}

/**
 * Everything one case needs.
 * @typedef {{ page: Page, request: ApiRequest, origin: string, seed: Phase5Seed, target: string, browser: import('@playwright/test').Browser }} CaseContext
 */

/** @param {CaseContext} c @param {string} [query] */
async function openUsers(c, query = `?q=review-${c.seed.tag}`) {
  await c.page.goto(`${c.origin}/admin/users${query}`);
  await pageReady(c.page, 'Users');
  await c.page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
}

/** @param {CaseContext} c @param {string} email */
async function openEdit(c, email) {
  await openUsers(c, `?q=${encodeURIComponent(email)}`);
  const row = c.page.locator('tbody tr').first();
  await row.getByRole('button', { name: /^Edit / }).click();
  const panel = c.page.getByRole('dialog', { name: 'Edit User' });
  await panel.getByRole('textbox', { name: /^First name/ }).waitFor({ timeout: 30_000 });
  await c.page.evaluate(SETTLE);
  return { panel, row };
}

/** @param {CaseContext} c */
async function shoot(c) {
  await c.page.evaluate(SETTLE);
  await c.page.screenshot({ path: c.target });
}

/** @param {CaseContext} c */
async function shootFullPage(c) {
  await c.page.evaluate(SETTLE);
  await c.page.screenshot({ path: c.target, fullPage: true });
}

/** @param {CaseContext} c */
async function openAddUser(c) {
  await openUsers(c);
  await c.page.getByRole('button', { name: 'Add User' }).click();
  const panel = c.page.getByRole('dialog', { name: 'Add User' });
  await panel.getByRole('textbox', { name: /^First name/ }).waitFor();
  await c.page.evaluate(SETTLE);
  return panel;
}

/** @param {import('@playwright/test').Locator} panel @param {string} email */
async function fillNewPerson(panel, email) {
  await panel.getByRole('textbox', { name: /^First name/ }).fill('Rosa');
  await panel.getByRole('textbox', { name: /^Last name/ }).fill('Dela Cruz');
  await panel.getByRole('textbox', { name: /^Email/ }).fill(email);
}

/**
 * A person with a change of email waiting, made for the confirm-email pictures: the new address and the link from the mail.
 * @param {CaseContext} c
 * @returns {Promise<string>} the link, with its token in the fragment.
 */
async function pendingEmailLink(c) {
  const made = await makeStaff(
    c.request,
    { key: `elena-${randomUUID().slice(0, 6)}`, role: 'Admin', state: 'active', firstName: 'Elena', lastName: 'Cruz' },
    c.seed.tag,
  );
  const token = await tokenFor(c.browser, c.request, c.origin, made);
  const newEmail = `review-${c.seed.tag}-${randomUUID().slice(0, 6)}@csps.test`;
  await callApi(c.request, token, 'POST', '/api/v1/profile/email-change', {
    newEmail,
    currentPassword: made.password,
  });
  const mail = await waitForMail(c.request, newEmail, 'Confirm your new CSPS email', 0);
  const link = /https?:\/\/[^\s"'<>]+#token=[^\s"'<>]+/.exec(mail.text)?.[0];
  if (link === undefined) {
    throw new Error('The email-change mail has no link with a token.');
  }
  return link;
}

/** @param {CaseContext} c */
async function openChangeEmail(c) {
  await c.page.goto(`${c.origin}/admin/profile`);
  await pageReady(c.page, 'Bea Navarro');
  const card = c.page.getByRole('region', { name: 'Sign-in Email' });
  await card.getByRole('button', { name: 'Change Email' }).click();
  const dialog = c.page.getByRole('dialog', { name: 'Change your email' });
  await dialog.getByRole('textbox', { name: 'New email' }).fill(`review-${c.seed.tag}-bea-new@csps.test`);
  await dialog.getByLabel('Current password').fill(c.seed.people.manager?.password ?? '');
  await c.page.evaluate(SETTLE);
  return { card, dialog };
}

/**
 * How each case is photographed. Every function leaves the page where the next case can start from a page load: dialogs
 * and panels are closed again, and the one case that changes data (the temporary-password user and the email change)
 * cleans up after itself.
 * @type {Readonly<Record<string, (c: CaseContext) => Promise<void>>>}
 */
const PHASE5_CAPTURES = Object.freeze({
  'add-invitation': async (c) => {
    const panel = await openAddUser(c);
    await fillNewPerson(panel, `review-${c.seed.tag}-rosa@csps.test`);
    await shoot(c);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'add-temporary-password': async (c) => {
    const panel = await openAddUser(c);
    await fillNewPerson(panel, `review-${c.seed.tag}-rosa@csps.test`);
    await panel.getByRole('radio', { name: 'Set a temporary password' }).check();
    await panel.getByLabel('Temporary password', { exact: true }).waitFor();
    await shoot(c);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'add-shown-once': async (c) => {
    const panel = await openAddUser(c);
    await fillNewPerson(panel, `review-${c.seed.tag}-new-${randomUUID().slice(0, 6)}@csps.test`);
    await panel.getByRole('radio', { name: 'Set a temporary password' }).check();
    await panel.getByRole('button', { name: 'Create User' }).click();
    const shown = c.page.getByRole('dialog', { name: 'User created' });
    await shown.waitFor({ timeout: 30_000 });
    await shoot(c);
    await shown.getByRole('button', { name: 'Done' }).click();
  },
  'edit-record-meta': async (c) => {
    const { panel } = await openEdit(c, c.seed.coraEmail);
    await panel.getByText('Recorded by', { exact: true }).scrollIntoViewIfNeeded();
    await shoot(c);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'edit-email-change-note': async (c) => {
    const { panel } = await openEdit(c, c.seed.people.ana?.email ?? '');
    await panel.getByRole('textbox', { name: /^Email/ }).fill(`review-${c.seed.tag}-ana-new@csps.test`);
    await panel.getByRole('group', { name: 'How this email change applies' }).scrollIntoViewIfNeeded();
    await shoot(c);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'edit-pending-email': async (c) => {
    const { panel } = await openEdit(c, c.seed.people.carmen?.email ?? '');
    await panel.getByText('Waiting for confirmation at', { exact: false }).first().scrollIntoViewIfNeeded();
    await shoot(c);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'edit-invited-email-note': async (c) => {
    const { panel } = await openEdit(c, c.seed.people.alma?.email ?? '');
    await panel.getByRole('textbox', { name: /^Email/ }).fill(`review-${c.seed.tag}-alma-new@csps.test`);
    await panel.getByText('invitation to the new address', { exact: false }).first().scrollIntoViewIfNeeded();
    await shoot(c);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'edit-account-access': async (c) => {
    const { panel } = await openEdit(c, c.seed.people.ana?.email ?? '');
    await panel.getByRole('heading', { level: 3, name: 'Account access' }).scrollIntoViewIfNeeded();
    await shoot(c);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'dialog-deactivate': async (c) => {
    await openUsers(c, `?q=${encodeURIComponent(c.seed.people.ana?.email ?? '')}`);
    const row = c.page.locator('tbody tr').first();
    await row.getByRole('button', { name: /^Deactivate / }).click();
    const dialog = c.page.getByRole('dialog', { name: 'Deactivate Ana Reyes?' });
    await dialog.waitFor();
    await shoot(c);
    await dialog.getByRole('button', { name: 'Keep Active' }).click();
  },
  'dialog-delete': async (c) => {
    await openUsers(c, `?q=${encodeURIComponent(c.seed.people.ana?.email ?? '')}`);
    const row = c.page.locator('tbody tr').first();
    await row.getByRole('button', { name: /^Delete / }).click();
    const dialog = c.page.getByRole('dialog', { name: 'Delete Ana Reyes?' });
    await dialog.waitFor();
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  },
  'dialog-lock': async (c) => {
    const { panel } = await openEdit(c, c.seed.people.ana?.email ?? '');
    await panel.getByRole('button', { name: 'Lock', exact: true }).click();
    const dialog = c.page.getByRole('dialog', { name: 'Lock Ana Reyes?' });
    await dialog.waitFor();
    await shoot(c);
    await dialog.getByRole('button', { name: 'Keep Unlocked' }).click();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'dialog-temporary-password': async (c) => {
    const { panel } = await openEdit(c, c.seed.people.ana?.email ?? '');
    await panel.getByRole('button', { name: 'Set Temporary Password' }).click();
    const dialog = c.page.getByRole('dialog', { name: 'Set a temporary password' });
    await dialog.waitFor();
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'profile-change-email-dialog': async (c) => {
    const { dialog } = await openChangeEmail(c);
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  },
  'profile-details-pending-email': async (c) => {
    const { card, dialog } = await openChangeEmail(c);
    await dialog.getByRole('button', { name: 'Send Confirmation Link' }).click();
    await card.getByRole('button', { name: 'Cancel Change' }).waitFor({ timeout: 30_000 });
    await shootFullPage(c);
    await card.getByRole('button', { name: 'Cancel Change' }).click();
    await card.getByRole('button', { name: 'Change Email' }).waitFor({ timeout: 30_000 });
  },
  'profile-security': async (c) => {
    await c.page.goto(`${c.origin}/admin/profile?tab=security`);
    await pageReady(c.page, 'Bea Navarro');
    await c.page.getByRole('heading', { level: 2, name: 'Signed-in Devices' }).waitFor();
    await shootFullPage(c);
  },
  'profile-appearance': async (c) => {
    await c.page.goto(`${c.origin}/admin/profile?tab=appearance`);
    await pageReady(c.page, 'Bea Navarro');
    await c.page.getByRole('heading', { level: 2, name: 'Theme' }).waitFor();
    await shootFullPage(c);
  },
  'confirm-email-ready': async (c) => {
    await c.page.goto(await pendingEmailLink(c));
    await c.page.getByRole('button', { name: 'Confirm New Email' }).waitFor({ timeout: 30_000 });
    await shoot(c);
  },
  'confirm-email-done': async (c) => {
    await c.page.goto(await pendingEmailLink(c));
    await c.page.getByRole('button', { name: 'Confirm New Email' }).click();
    await c.page.getByRole('heading', { level: 1, name: 'Your email is changed' }).waitFor({ timeout: 30_000 });
    await shoot(c);
  },
  'confirm-email-invalid': async (c) => {
    await c.page.goto(`${c.origin}/admin/confirm-email`);
    await c.page.getByRole('heading', { level: 1, name: 'This link has expired' }).waitFor({ timeout: 30_000 });
    await shoot(c);
  },
  'audit-expanded-row': async (c) => {
    await c.page.goto(`${c.origin}/admin/audit-log`);
    await pageReady(c.page, 'Audit Log');
    await c.page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
    await c.page
      .getByRole('button', { name: /^Show details for / })
      .first()
      .click();
    await shootFullPage(c);
  },
  'audit-no-matches': async (c) => {
    await c.page.goto(`${c.origin}/admin/audit-log?range=all&target=${c.seed.people.alma?.userId.toLowerCase() ?? ''}`);
    await pageReady(c.page, 'Audit Log');
    await c.page.getByRole('heading', { name: 'No matches' }).waitFor({ timeout: 30_000 });
    await shootFullPage(c);
  },
  'audit-empty': async (c) => {
    // The log is never empty on a used database, so the one list call is answered with "nothing" for this picture.
    await c.page.route(/\/api\/v1\/audit-log(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }),
      }),
    );
    await c.page.goto(`${c.origin}/admin/audit-log`);
    await pageReady(c.page, 'Audit Log');
    await c.page.getByRole('heading', { name: 'No entries in the last 7 days' }).waitFor({ timeout: 30_000 });
    await shootFullPage(c);
    await c.page.unroute(/\/api\/v1\/audit-log(\?|$)/);
  },
  'showcase-demo-banner': async (c) => {
    await c.page.goto(`${c.origin}/admin/components`);
    await pageReady(c.page, 'Component Showcase');
    await shoot(c);
  },
  'shell-short-screen': async (c) => {
    await openUsers(c);
    await shoot(c);
  },
});

/**
 * Takes the Phase 5 pictures: one signed-in browser context per theme and width, and the cases in order inside it.
 * @param {import('@playwright/test').Browser} browser
 * @param {ApiRequest} request
 * @param {string} origin
 * @param {Phase5Seed} seed
 * @param {readonly Phase5ReviewShot[]} shots
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function capturePhase5Review(browser, request, origin, seed, shots, problems) {
  const views = [...new Set(shots.map((shot) => `${shot.theme}|${String(shot.width)}`))];
  for (const key of views) {
    const [theme, width] = key.split('|');
    const group = shots.filter((shot) => shot.theme === theme && String(shot.width) === width);
    const first = group[0];
    if (first === undefined) {
      continue;
    }
    const opened = await openSignedIn(
      browser,
      request,
      origin,
      seed,
      { theme: first.theme, width: first.width },
      problems,
    );
    try {
      for (const shot of group) {
        const capture = PHASE5_CAPTURES[shot.id];
        if (capture === undefined) {
          throw new Error(`No capture is written for the Phase 5 case "${shot.id}"; update PHASE5_CAPTURES.`);
        }
        try {
          await capture({
            page: opened.page,
            request,
            origin,
            seed,
            browser,
            target: assertWritable(path.join(OUTPUT_DIR, shot.file)),
          });
          process.stdout.write(`review: ${shot.file}\n`);
        } catch (error) {
          // One picture that cannot be taken is reported in the page's list of problems; the rest are still taken.
          const reason = error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
          problems.push(`${shot.file} could not be taken: ${reason}`);
          process.stdout.write(`review: ${shot.file} FAILED: ${reason}\n`);
        }
      }
    } finally {
      await opened.close();
    }
  }
}

// ───────────── Plan 06-19: capturing the Phase 6 screens signed in as a Manager and as an Admin ─────────────

/**
 * @typedef {{
 *   readonly dario: MadeStaff,
 *   readonly rows: Readonly<Record<'upcoming' | 'former' | 'retired' | 'adminPaid' | 'notes' | 'edited', string>>,
 *   readonly editedId: string,
 * }} Phase6Seed
 */
/** @typedef {CaseContext & { six: Phase6Seed }} Phase6Context */

/**
 * The id in an API answer.
 * @param {unknown} body
 * @returns {string}
 */
function idOf(body) {
  if (!isRecord(body) || typeof body.id !== 'string') {
    throw new Error('The API answer has no id.');
  }
  return body.id;
}

/**
 * Seeds one company expense through the Testing-only expense fixture (a chosen payer, recorder, date and delete state).
 * @param {ApiRequest} request
 * @param {Record<string, unknown>} input
 * @returns {Promise<void>}
 */
async function seedExpense(request, input) {
  const response = await request.post('/api/testing/expenses', { data: input });
  if (response.status() !== 201) {
    throw new Error(`The expense fixture answered ${String(response.status())}, not 201.`);
  }
}

/**
 * Makes what the Phase 6 pictures show, in the Testing database CSPS_E2E, all marked with this run's tag so a search finds only
 * them: three categories (one used and active, one used and then retired, one never used), thirteen live expenses (one still
 * ahead, one by a payer who is then deleted, one in the retired category, one the Admin pays but a Manager recorded, one with
 * notes, and filler so the list has two pages at 10 a page), one expense a Manager adds and edits through the API (so the audit
 * log has "added" and "changed" entries and Last changed by is filled) and three deleted expenses.
 * @param {import('@playwright/test').Browser} browser
 * @param {ApiRequest} request
 * @param {string} origin
 * @param {Phase5Seed} seed
 * @returns {Promise<Phase6Seed>}
 */
async function seedPhase6(browser, request, origin, seed) {
  const { tag } = seed;
  const manager = seed.people.manager;
  const admin = seed.people.ana;
  const person = PHASE6_SEED_PEOPLE[0];
  if (manager === undefined || admin === undefined || person === undefined) {
    throw new Error('The seed has no Manager, Admin or Phase 6 payer.');
  }
  const managerToken = await tokenFor(browser, request, origin, manager);
  const dario = await makeStaff(request, person, tag);
  /** @param {string} name @param {string} tone @returns {Promise<string>} */
  const makeCategory = async (name, tone) =>
    idOf(await callApi(request, managerToken, 'POST', '/api/v1/expense-categories', { name: `${name} ${tag}`, tone }));
  const apparel = await makeCategory('Apparel', 'success');
  const abaca = await makeCategory('Abaca', 'info');
  await makeCategory('Applique', 'warning');
  const rows = {
    upcoming: `Shop rent for next week ${tag}`,
    former: `Thread and zippers ${tag}`,
    retired: `Banner cloth ${tag}`,
    adminPaid: `Courier fee ${tag}`,
    notes: `Printer toner ${tag}`,
    edited: `Sticker paper ${tag}`,
  };
  const by = (/** @type {MadeStaff} */ payer, /** @type {MadeStaff} */ recorder) => ({
    paidByUserId: payer.userId,
    recordedByUserId: recorder.userId,
  });
  await seedExpense(request, {
    ...by(manager, manager),
    date: manilaDate(6),
    categoryId: SEEDED_RENT,
    description: rows.upcoming,
    amount: 18000,
  });
  await seedExpense(request, {
    ...by(dario, dario),
    date: manilaDate(-3),
    categoryId: SEEDED_SUPPLIES,
    description: rows.former,
    amount: 2450.5,
  });
  await seedExpense(request, {
    ...by(manager, manager),
    date: manilaDate(-5),
    categoryId: abaca,
    description: rows.retired,
    amount: 1320,
  });
  await seedExpense(request, {
    ...by(admin, manager),
    date: manilaDate(-2),
    categoryId: SEEDED_SUPPLIES,
    description: rows.adminPaid,
    amount: 380.75,
  });
  await seedExpense(request, {
    ...by(manager, manager),
    date: manilaDate(-4),
    categoryId: SEEDED_SUPPLIES,
    description: rows.notes,
    amount: 4200,
    notes: 'Bought in bulk for the October team orders.',
  });
  for (let index = 1; index <= 7; index += 1) {
    await seedExpense(request, {
      ...by(manager, manager),
      date: manilaDate(-5 - index),
      categoryId: index % 2 === 0 ? SEEDED_SUPPLIES : apparel,
      description: `Office supplies ${String(index)} ${tag}`,
      amount: 100 * index + 25.5,
    });
  }
  for (const [index, name] of ['Old tarpaulin', 'Spare needles', 'Damaged rolls'].entries()) {
    await seedExpense(request, {
      ...by(manager, manager),
      date: manilaDate(-7 - index),
      categoryId: SEEDED_SUPPLIES,
      description: `${name} ${tag}`,
      amount: 250 + index * 100,
      deleted: true,
    });
  }
  // An expense a Manager adds and then edits, so the Audit Log holds both entries and Last changed by names a person.
  const edited = await callApi(request, managerToken, 'POST', '/api/v1/company-expenses', {
    date: manilaDate(-1),
    categoryId: apparel,
    description: rows.edited,
    amount: 640,
    paidByUserId: manager.userId,
    notes: null,
  });
  const editedId = idOf(edited);
  const version = isRecord(edited) && typeof edited.version === 'string' ? edited.version : '';
  await callApi(request, managerToken, 'PUT', `/api/v1/company-expenses/${editedId}`, {
    date: manilaDate(-1),
    categoryId: apparel,
    description: rows.edited,
    amount: 700,
    paidByUserId: manager.userId,
    notes: 'Reprinted after a smudge.',
    version,
  });
  await callApi(request, managerToken, 'POST', `/api/v1/expense-categories/${abaca}/retire`);
  // Last, so the payer's expenses were saved while they were active; the lists then read "Dario Lim (former staff)".
  await callApi(request, managerToken, 'DELETE', `/api/v1/users/${dario.userId}`);
  return { dario, rows, editedId };
}

/** The console messages a case expects (the 409 of the stale-save picture), by page. */
const EXPECTED_CONSOLE = /** @type {WeakMap<Page, RegExp[]>} */ (new WeakMap());

/**
 * Tells the console collector of a page that a message is expected and is not a problem. Call the returned function when the
 * step that expects it is over, so a later message that happens to match is reported again.
 * @param {Page} page
 * @param {RegExp} pattern
 * @returns {() => void}
 */
function allowConsole(page, pattern) {
  EXPECTED_CONSOLE.set(page, [...(EXPECTED_CONSOLE.get(page) ?? []), pattern]);
  return () => {
    EXPECTED_CONSOLE.set(
      page,
      (EXPECTED_CONSOLE.get(page) ?? []).filter((expected) => expected !== pattern),
    );
  };
}

/**
 * Answers one API path with the real answer, changed. The answer is fetched from the server first, so its shape stays the
 * server's own; only the part the picture needs is replaced. Call the returned function to restore the page.
 * @param {Page} page
 * @param {string} pathname
 * @param {(body: Record<string, unknown>) => void} change
 * @returns {Promise<() => Promise<void>>}
 */
async function answerChanged(page, pathname, change) {
  /** @param {URL} url */
  const matches = (url) => url.pathname === pathname;
  /** @param {import('@playwright/test').Route} route */
  const handler = async (route) => {
    const response = await route.fetch();
    /** @type {unknown} */
    const body = await response.json();
    if (isRecord(body)) {
      change(body);
    }
    await route.fulfill({ response, json: body });
  };
  await page.route(matches, handler);
  return () => page.unroute(matches, handler);
}

/**
 * Opens a Phase 6 page and waits until its data and fonts have arrived and its motion is done.
 * @param {Phase6Context} c
 * @param {string} address path and query
 * @param {string} h1
 * @param {{ rows?: boolean }} [options] false for a page that shows no table row.
 */
async function openPhase6(c, address, h1, { rows = true } = {}) {
  await c.page.goto(`${c.origin}${address}`);
  await pageReady(c.page, h1);
  if (rows) {
    await c.page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
  }
  await c.page.waitForLoadState('networkidle');
  await c.page.evaluate(SETTLE);
}

/** @param {Phase6Context} c @returns {string} this run's expenses, 10 a page. */
function listAddress(c) {
  return `/admin/expenses?q=${c.seed.tag}&size=10`;
}

/**
 * A row's action button by its name's first words and the row's description.
 * @param {Phase6Context} c
 * @param {string} verb Edit, View or Delete
 * @param {string} description
 */
function rowAction(c, verb, description) {
  return c.page.getByRole('button', { name: new RegExp(`^${verb} ${description}, [A-Z][a-z]{2} \\d{1,2}, \\d{4}$`) });
}

/**
 * Opens the Edit window of a row once the expense has loaded (Recorded by shows only then).
 * @param {Phase6Context} c
 * @param {string} description
 */
async function openEditWindow(c, description) {
  await openPhase6(c, listAddress(c), 'Company Expenses');
  await rowAction(c, 'Edit', description).click();
  const dialog = c.page.getByRole('dialog', { name: 'Edit Expense' });
  await dialog.getByText('Recorded by', { exact: true }).waitFor({ timeout: 30_000 });
  await c.page.evaluate(SETTLE);
  return dialog;
}

/**
 * How each Phase 6 case is photographed. Every function leaves the page where the next case can start from a page load:
 * windows and dialogs are closed again, and a page whose answer was changed is restored.
 * @type {Readonly<Record<string, (c: Phase6Context) => Promise<void>>>}
 */
const PHASE6_CAPTURES = Object.freeze({
  'e1-manager-list': async (c) => {
    await openPhase6(c, listAddress(c), 'Company Expenses');
    await shootFullPage(c);
  },
  'e1-manager-empty-top-category': async (c) => {
    const restore = await answerChanged(c.page, '/api/v1/company-expenses/kpis', (body) => {
      const month = body.thisMonth;
      body.thisMonth = isRecord(month) ? { ...month, count: 0, total: 0 } : month;
      body.topCategory = null;
    });
    try {
      await openPhase6(c, listAddress(c), 'Company Expenses');
      await c.page.getByText('No expenses this month').first().waitFor({ timeout: 30_000 });
      await shootFullPage(c);
    } finally {
      await restore();
    }
  },
  'e1-empty': async (c) => {
    const restore = await answerChanged(c.page, '/api/v1/company-expenses', (body) => {
      body.items = [];
      body.total = 0;
      body.periodTotal = 0;
    });
    try {
      await openPhase6(c, '/admin/expenses', 'Company Expenses', { rows: false });
      await c.page.getByText('No expenses recorded').first().waitFor({ timeout: 30_000 });
      await shootFullPage(c);
    } finally {
      await restore();
    }
  },
  'e1-no-matches': async (c) => {
    await openPhase6(c, `/admin/expenses?q=nothing-${c.seed.tag}`, 'Company Expenses', { rows: false });
    await c.page.getByRole('heading', { name: 'No matches' }).waitFor({ timeout: 30_000 });
    await shootFullPage(c);
  },
  'e1-admin-list': async (c) => {
    await openPhase6(c, listAddress(c), 'Company Expenses');
    await shootFullPage(c);
  },
  'e2-add': async (c) => {
    await openPhase6(c, listAddress(c), 'Company Expenses');
    await c.page.getByRole('button', { name: 'Add Expense' }).first().click();
    const dialog = c.page.getByRole('dialog', { name: 'Add Expense' });
    await dialog.getByRole('combobox', { name: /^Paid by/ }).waitFor({ timeout: 30_000 });
    await c.page.evaluate(SETTLE);
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'e2-edit-record-meta': async (c) => {
    const dialog = await openEditWindow(c, c.six.rows.edited);
    await dialog.getByText('Recorded by', { exact: true }).scrollIntoViewIfNeeded();
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'e2-edit-access-note': async (c) => {
    const dialog = await openEditWindow(c, c.six.rows.adminPaid);
    await dialog.getByRole('combobox', { name: /^Paid by/ }).selectOption({ index: 1 });
    const note = dialog.getByText('After you save', { exact: false }).first();
    await note.waitFor({ timeout: 30_000 });
    await note.scrollIntoViewIfNeeded();
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'e2-edit-conflict': async (c) => {
    // Only this step expects the 409 in the console.
    const stopAllowing = allowConsole(c.page, /409/);
    try {
      const dialog = await openEditWindow(c, c.six.rows.edited);
      // Someone else saves first, from a second sign-in, so the window above holds an old version.
      const manager = c.seed.people.manager;
      if (manager === undefined) {
        throw new Error('The seed has no Manager.');
      }
      const token = await tokenFor(c.browser, c.request, c.origin, manager);
      const address = `/api/v1/company-expenses/${c.six.editedId}`;
      const current = await callApi(c.request, token, 'GET', address);
      if (!isRecord(current) || !isRecord(current.category) || !isRecord(current.paidBy)) {
        throw new Error('The expense answer has an unexpected shape.');
      }
      const original = {
        date: current.date,
        categoryId: current.category.id,
        description: current.description,
        amount: Number(current.amount),
        paidByUserId: current.paidBy.id,
        notes: current.notes,
      };
      // A fixed rival amount, so every view makes the same change; the seeded values are put back after the picture.
      const rival = await callApi(c.request, token, 'PUT', address, {
        ...original,
        amount: original.amount === 705 ? 710 : 705,
        version: current.version,
      });
      try {
        await dialog.getByRole('textbox', { name: /^Amount/ }).fill('999');
        await dialog.getByRole('button', { name: 'Save Changes' }).click();
        await dialog.getByText('This was changed by someone else.').waitFor({ timeout: 30_000 });
        await c.page.evaluate(SETTLE);
        await shoot(c);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      } finally {
        // The list, the month cards and the next view then show the same figures as before this step.
        const version = isRecord(rival) && typeof rival.version === 'string' ? rival.version : '';
        await callApi(c.request, token, 'PUT', address, { ...original, version });
      }
    } finally {
      stopAllowing();
    }
  },
  'e2-view': async (c) => {
    await openPhase6(c, listAddress(c), 'Company Expenses');
    await rowAction(c, 'View', c.six.rows.notes).click();
    const dialog = c.page.getByRole('dialog', { name: 'Expense details' });
    await dialog.getByText('Recorded by', { exact: true }).waitFor({ timeout: 30_000 });
    await c.page.evaluate(SETTLE);
    await shoot(c);
    await dialog.getByRole('button', { name: 'Close' }).last().click();
  },
  'e3-delete': async (c) => {
    await openPhase6(c, listAddress(c), 'Company Expenses');
    await rowAction(c, 'Delete', c.six.rows.notes).click();
    const dialog = c.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Delete Expense' }).waitFor({ timeout: 30_000 });
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  },
  'e3-purge': async (c) => {
    await openPhase6(c, `/admin/expenses/deleted?q=${c.seed.tag}`, 'Deleted Expenses');
    await c.page
      .getByRole('button', { name: /^Delete .*permanently$/ })
      .first()
      .click();
    const dialog = c.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Delete Permanently' }).waitFor({ timeout: 30_000 });
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  },
  'e4-rows': async (c) => {
    await openPhase6(c, `/admin/expenses/deleted?q=${c.seed.tag}`, 'Deleted Expenses');
    await shootFullPage(c);
  },
  'e4-empty': async (c) => {
    const restore = await answerChanged(c.page, '/api/v1/company-expenses/deleted', (body) => {
      body.items = [];
      body.total = 0;
    });
    try {
      await openPhase6(c, '/admin/expenses/deleted', 'Deleted Expenses', { rows: false });
      await c.page.getByText('No deleted expenses').first().waitFor({ timeout: 30_000 });
      await shootFullPage(c);
    } finally {
      await restore();
    }
  },
  's1-categories': async (c) => {
    await openPhase6(c, '/admin/settings', 'Settings');
    await shootFullPage(c);
  },
  's2-add-category': async (c) => {
    await openPhase6(c, '/admin/settings', 'Settings');
    await c.page.getByRole('button', { name: 'Add Category' }).first().click();
    const dialog = c.page.getByRole('dialog', { name: 'Add Category' });
    await dialog.getByRole('textbox', { name: /^Name/ }).fill('Embroidery thread');
    await dialog.getByRole('radio', { name: 'Blue' }).check();
    await c.page.evaluate(SETTLE);
    await shoot(c);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  },
  'audit-expense-expanded': async (c) => {
    const manager = c.seed.people.manager;
    if (manager === undefined) {
      throw new Error('The seed has no Manager.');
    }
    await openPhase6(
      c,
      `/admin/audit-log?range=all&action=company-expense.changed&target=${manager.userId.toLowerCase()}`,
      'Audit Log',
    );
    await c.page
      .getByRole('button', { name: /^Show details for Expense changed, / })
      .first()
      .click();
    await c.page.evaluate(SETTLE);
    await shootFullPage(c);
  },
});

/**
 * Takes the Phase 6 pictures: one signed-in browser context per theme, width and role, and the cases in order inside it.
 * @param {import('@playwright/test').Browser} browser
 * @param {ApiRequest} request
 * @param {string} origin
 * @param {Phase5Seed} seed
 * @param {Phase6Seed} six
 * @param {readonly Phase6ReviewShot[]} shots
 * @param {string[]} problems
 * @returns {Promise<void>}
 */
async function capturePhase6Review(browser, request, origin, seed, six, shots, problems) {
  const views = [...new Set(shots.map((shot) => `${shot.theme}|${String(shot.width)}|${shot.signedInAs}`))];
  for (const key of views) {
    const [theme, width, role] = key.split('|');
    const group = shots.filter(
      (shot) => shot.theme === theme && String(shot.width) === width && shot.signedInAs === role,
    );
    const first = group[0];
    if (first === undefined) {
      continue;
    }
    const opened = await openSignedIn(
      browser,
      request,
      origin,
      seed,
      { theme: first.theme, width: first.width },
      problems,
      first.signedInAs === 'Admin' ? 'ana' : 'manager',
    );
    try {
      for (const shot of group) {
        const capture = PHASE6_CAPTURES[shot.id];
        if (capture === undefined) {
          throw new Error(`No capture is written for the Phase 6 case "${shot.id}"; update PHASE6_CAPTURES.`);
        }
        try {
          await capture({
            page: opened.page,
            request,
            origin,
            seed,
            six,
            browser,
            target: assertWritable(path.join(OUTPUT_DIR, shot.file)),
          });
          process.stdout.write(`review: ${shot.file}\n`);
        } catch (error) {
          // One picture that cannot be taken is reported in the page's list of problems; the rest are still taken.
          const reason = error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
          problems.push(`${shot.file} could not be taken: ${reason}`);
          process.stdout.write(`review: ${shot.file} FAILED: ${reason}\n`);
        }
      }
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
  const { chromium, request: playwrightRequest } = await import('@playwright/test');
  for (const folder of ['shots', 'spec-gap', 'before-after', 'auth-review', 'phase5-review', 'phase6-review']) {
    rmSync(assertWritable(path.join(OUTPUT_DIR, folder)), { recursive: true, force: true });
    mkdirSync(assertWritable(path.join(OUTPUT_DIR, folder)), { recursive: true });
  }
  /** @type {string[]} */
  const problems = [];
  const browser = await chromium.launch();
  // The Testing-only routes (the staff fixture and the mail sink) are called from here, not from a page.
  const request = await playwrightRequest.newContext({ baseURL: step.origin, ignoreHTTPSErrors: true });
  try {
    const needsSignIn =
      step.phase5Review.length > 0 ||
      step.phase6Review.length > 0 ||
      REVIEW_TARGETS.some((target) => target.signedIn === true);
    const seed = needsSignIn ? await seedPhase5(browser, request, step.origin) : null;
    const six = seed === null ? null : await seedPhase6(browser, request, step.origin, seed);
    for (const shot of step.shots) {
      const target = REVIEW_TARGETS.find((entry) => entry.path === shot.path);
      const manager = seed?.people.manager;
      const signedIn = target?.signedIn === true && manager !== undefined ? { request, staff: manager } : undefined;
      // The lists are narrowed to this run's people and expenses, so they lead whatever earlier test runs left behind.
      const tag = seed?.tag ?? '';
      /** @type {Readonly<Record<string, string>>} */
      const narrowed = {
        '/admin/users': `?q=review-${tag}`,
        '/admin/expenses': `?q=${tag}`,
        '/admin/expenses/deleted': `?q=${tag}`,
      };
      const pagePath = signedIn !== undefined ? `${shot.path}${narrowed[shot.path] ?? ''}` : shot.path;
      // My Profile's h1 is the person's name, not the words "My Profile".
      const h1 = signedIn !== undefined && shot.path === '/admin/profile' ? signedIn.staff.name : shot.h1;
      const opened = await openReviewPage(browser, step.origin, { ...shot, path: pagePath, h1 }, problems, signedIn);
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
    if (seed !== null) {
      await capturePhase5Review(browser, request, step.origin, seed, step.phase5Review, problems);
    }
    if (seed !== null && six !== null) {
      await capturePhase6Review(browser, request, step.origin, seed, six, step.phase6Review, problems);
    }
  } finally {
    await request.dispose();
    await browser.close();
  }
  return {
    captured: step.shots,
    specGap: step.specGap,
    beforeAfter: step.beforeAfter,
    authReview: step.authReview,
    phase5Review: step.phase5Review,
    phase6Review: step.phase6Review,
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
      phase5Review: result.phase5Review ?? [],
      phase6Review: result.phase6Review ?? [],
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
