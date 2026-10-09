// @ts-check
// `npm run review` (D-23, plan 02-36): the owner's local screenshot report. Local only; the output is git-ignored and
// never committed, uploaded or deployed.
//   1. Refuses to run unless its output folder, artifacts/owner-review, is git-ignored (`git check-ignore`).
//   2. Takes the exclusive run lock web/.locks/e2e.lock, shared with the E2E, parity-host and Lighthouse runs, because
//      it starts the same host on 5199. A second run waits for it, up to 15 minutes.
//   3. Refuses to start when port 5199 is in use. It never stops another process (CLAUDE.md shared machine).
//   4. Runs the shared-machine preflight report (read-only) and the guarded CSPS_E2E seed (the host's /health checks the
//      database).
//   5. Rebuilds the e2e bundle (web/.e2e-dist) whenever any build input is newer than it, not only when it is missing
//      (L-29), so the pictures never show yesterday's build.
//   6. Starts the real ASP.NET Core host on https://localhost:5199 serving that bundle, with its variables set on that
//      one child only, exactly as the Playwright E2E host does (playwright.config.ts).
//   7. Opens every page in Playwright Chromium at 390, 820 and 1440 px (the admin pages and the showcase in Blush and
//      Espresso, the public page in Blush only, D-13/D-14) and saves full-page screenshots.
//   8. Stops the host it started (that child and its own children, nothing else) and writes
//      artifacts/owner-review/index.html, a plain-words page that shows every picture.
// It writes nowhere but artifacts/owner-review/ (assertWritable), never into src/, web/src or the server's wwwroot.
// Guide: docs/web/owner-review.md.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireLock,
  E2E_PORT,
  LOCK_PATH,
  lockTimeoutMessage,
  PORT_BUSY_MESSAGE,
  PREFLIGHT_SCRIPT,
  REPO_ROOT,
  WEB_DIRECTORY,
} from './e2e.mjs';
import { portIsBusy, startHost } from './lighthouse.mjs';

/**
 * @typedef {'light' | 'dark'} Theme
 * @typedef {{ readonly path: string, readonly slug: string, readonly title: string, readonly h1: string, readonly themes: readonly Theme[] }} ReviewTarget
 * @typedef {{ readonly path: string, readonly title: string, readonly h1: string, readonly theme: Theme, readonly width: number, readonly file: string }} Shot
 * @typedef {{ readonly kind: 'refuse', readonly name: 'output-not-ignored' | 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {{ readonly kind: 'run', readonly name: 'preflight' | 'seed' | 'build', readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'host', readonly name: 'host', readonly command: string, readonly args: readonly string[], readonly cwd: string, readonly env: Readonly<Record<string, string>>, readonly healthUrl: string }} HostStep
 * @typedef {{ readonly kind: 'capture', readonly name: 'capture', readonly origin: string, readonly shots: readonly Shot[] }} CaptureStep
 * @typedef {{ readonly kind: 'report', readonly name: 'report', readonly file: string }} ReportStep
 * @typedef {RefuseStep | RunStep | HostStep | CaptureStep | ReportStep} Step
 * @typedef {{ readonly captured: readonly Shot[], readonly problems: readonly string[] }} CaptureResult
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
 * @param {{ outputIgnored: boolean, portBusy?: boolean, preflightAvailable?: boolean, bundleMtime?: number | null, newestSourceMtime?: number }} options
 * @returns {readonly Step[]}
 */
export function planReview({
  outputIgnored,
  portBusy = false,
  preflightAvailable = true,
  bundleMtime = null,
  newestSourceMtime = 0,
}) {
  if (!outputIgnored) {
    return [{ kind: 'refuse', name: 'output-not-ignored', message: OUTPUT_NOT_IGNORED_MESSAGE, exitCode: 1 }];
  }
  if (portBusy) {
    return [{ kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 }];
  }
  /** @type {Step[]} */
  const steps = [];
  if (preflightAvailable) {
    // A read-only report of this project's ports, other projects' test processes and LocalDB (CLAUDE.md).
    steps.push({
      kind: 'run',
      name: 'preflight',
      command: 'powershell',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PREFLIGHT_SCRIPT, '-Ports', '5180,5115,7028,5199'],
      cwd: REPO_ROOT,
    });
  }
  // DevSeedTargetGuard refuses anything but CSPS_Dev/CSPS_E2E on (localdb)\CSPS before any connection opens (T-02-24).
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
        ConnectionStrings__Csps: 'Server=(localdb)\\CSPS;Database=CSPS_E2E;Integrated Security=true',
      },
      healthUrl: `${ORIGIN}/health`,
    },
    { kind: 'capture', name: 'capture', origin: ORIGIN, shots: planShots() },
    { kind: 'report', name: 'report', file: path.join(OUTPUT_DIR, 'index.html') },
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
  ul.problems li { color: #8a1c1c; }
`;

/**
 * The report page: plain words, the pictures as relative links, no script and no remote address.
 * @param {{ generatedAt: string, shots: readonly Shot[], problems: readonly string[], specGap?: readonly SpecGapShot[], parity?: { summary: ParitySummary, differences: readonly DifferenceRow[] } }} input
 * @returns {string}
 */
export function renderIndex({ generatedAt, shots, problems }) {
  /** @type {string[]} */
  const sections = [];
  const pages = [...new Set(shots.map((shot) => shot.path))];
  for (const pagePath of pages) {
    const ofPage = shots.filter((shot) => shot.path === pagePath);
    const first = ofPage[0];
    if (first === undefined) {
      continue;
    }
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
    sections.push(
      `<section><h2>${escapeHtml(first.title)}</h2><p class="note">Address: <code>${escapeHtml(pagePath)}</code>. ` +
        `Click a picture to see it full size.</p>${rows.join('')}</section>`,
    );
  }
  const problemList =
    problems.length === 0
      ? '<p>The pages reported no errors while the pictures were taken.</p>'
      : `<p>The pages reported these errors while the pictures were taken:</p><ul class="problems">${problems
          .map((problem) => `<li>${escapeHtml(problem)}</li>`)
          .join('')}</ul>`;
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
${problemList}
${sections.join('\n')}
</main>
</body>
</html>
`;
}

/**
 * @typedef {{ readonly id: string, readonly label: string }} SpecGapCase
 * @typedef {{ readonly id: string, readonly label: string, readonly theme: Theme, readonly width: number, readonly file: string }} SpecGapShot
 * @typedef {{ readonly engine: string, readonly group: string, readonly passed: number, readonly failed: number, readonly flaky: number, readonly skipped: number }} ParityRow
 * @typedef {{ readonly available: false } | { readonly available: true, readonly startTime: string, readonly durationMinutes: number, readonly filters: string, readonly totals: { readonly passed: number, readonly failed: number, readonly flaky: number, readonly skipped: number }, readonly rows: readonly ParityRow[], readonly failures: readonly string[] }} ParitySummary
 * @typedef {{ readonly difference: string, readonly decision: string, readonly treatment: string }} DifferenceRow
 */

/** RED stub. */
export const SPEC_GAP_CASES = Object.freeze(/** @type {SpecGapCase[]} */ ([]));

/** @returns {SpecGapShot[]} RED stub. */
export function planSpecGapShots() {
  return [];
}

/**
 * RED stub.
 * @param {unknown} report
 * @returns {ParitySummary}
 */
export function summarizeParity(report) {
  return report === undefined ? { available: false } : { available: false };
}

/**
 * RED stub.
 * @param {string} markdown
 * @returns {DifferenceRow[]}
 */
export function parseDifferencesTable(markdown) {
  return markdown === '' ? [] : [];
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
 * Takes every planned screenshot from the running host.
 * @param {CaptureStep} step
 * @returns {Promise<CaptureResult>}
 */
async function captureShots(step) {
  const { chromium } = await import('@playwright/test');
  rmSync(assertWritable(path.join(OUTPUT_DIR, 'shots')), { recursive: true, force: true });
  mkdirSync(assertWritable(path.join(OUTPUT_DIR, 'shots')), { recursive: true });
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
  } finally {
    await browser.close();
  }
  return { captured: step.shots, problems };
}

/**
 * @param {RunStep} step
 * @returns {number}
 */
function runStep(step) {
  return spawnSync(step.command, [...step.args], { cwd: step.cwd, stdio: 'inherit' }).status ?? 1;
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
    release();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  process.once('exit', release);
  try {
    const steps = planReview({
      outputIgnored,
      portBusy: outputIgnored ? await portIsBusy() : false,
      preflightAvailable: existsSync(PREFLIGHT_SCRIPT),
      bundleMtime: existsSync(BUNDLE_MARKER) ? statSync(BUNDLE_MARKER).mtimeMs : null,
      newestSourceMtime: newestMtime(BUILD_INPUTS),
    });
    return await executeReview(steps, {
      run: runStep,
      startHost,
      capture: captureShots,
      writeReport: (step, result) => {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        writeFileSync(
          assertWritable(step.file),
          renderIndex({ generatedAt: new Date().toString(), shots: result.captured, problems: result.problems }),
        );
      },
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
