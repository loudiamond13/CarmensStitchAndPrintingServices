// @ts-check
// D-24 side-by-side (plan 02-36): our pages next to the matching screens of the owner's design exports, on this machine
// only.
//
//   node web/scripts/design-side-by-side.mjs        (after `npm --prefix web run review`, whose screenshots it reuses)
//
// The design exports in .planning/design/ are the owner's private, local-only material (CLAUDE.md, 02-CONTEXT D-24,
// T-02-77). This script therefore:
//   - refuses to run in CI (`CI` set), when .planning/design is not git-ignored, when any file under it is tracked, or
//     when its own output folder is not git-ignored (checkGuards);
//   - reads the two exports in place (never copies or moves them) and opens them in Playwright Chromium from their file
//     path with every network request blocked, so nothing they contain can leave the machine;
//   - selects each matching screen (a "board" in the export) by its exact title, checks its width, sets the screen's
//     theme (`data-theme`, the export's light/dark prop) and photographs it;
//   - writes the pictures and index.html only under artifacts/owner-review/side-by-side/ (git-ignored), next to the
//     owner review screenshots of our pages at the same width and theme.
// It uploads, commits and deploys nothing. Guide: docs/web/owner-review.md.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isGitIgnored, REVIEW_TARGETS, REVIEW_WIDTHS } from './owner-review.mjs';

/**
 * @typedef {'light' | 'dark'} Theme
 * @typedef {{ readonly path: string, readonly slug: string, readonly title: string, readonly design: 'public' | 'admin', readonly themes: readonly Theme[], readonly boards: Readonly<Record<number, string | null>> }} Pairing
 * @typedef {{ readonly path: string, readonly slug: string, readonly title: string, readonly theme: Theme, readonly width: number, readonly designFile: string, readonly board: string | null, readonly ours: string, readonly output: string | null, readonly signedIn: boolean }} SideBySideItem
 * @typedef {{ readonly ok: true } | { readonly ok: false, readonly message: string }} GuardResult
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const DESIGN_DIR = path.join(REPO_ROOT, '.planning', 'design');
export const DESIGN_GIT_PATH = '.planning/design';
export const SIDE_BY_SIDE_DIR = path.join(REPO_ROOT, 'artifacts', 'owner-review', 'side-by-side');
export const SIDE_BY_SIDE_GIT_PATH = 'artifacts/owner-review/side-by-side';

/** The owner's two Claude Design exports (02-CONTEXT canonical refs), read in place. */
export const DESIGN_FILES = Object.freeze({
  public: 'CSPS Website Public Face.html',
  admin: 'CSPS Website Admin and Manager.html',
});

const BOTH = Object.freeze(/** @type {Theme[]} */ (['light', 'dark']));
const BLUSH_ONLY = Object.freeze(/** @type {Theme[]} */ (['light']));

/**
 * Our pages and the design screens ("boards", by their exact titles in the export) that show the same page. The public
 * site is Blush only (D-14) and its design has no tablet screen. Our admin pages are still placeholders (D-20), so the
 * comparison there is the frame around the page: the sidebar, the top bar and the phone tab bar.
 * @type {readonly Pairing[]}
 */
export const PAIRINGS = Object.freeze([
  {
    path: '/',
    slug: 'public-home',
    title: 'Public site: home',
    design: 'public',
    themes: BLUSH_ONLY,
    boards: { 390: 'Home — mobile', 820: null, 1440: 'Home — desktop' },
  },
  {
    path: '/admin',
    slug: 'admin-dashboard',
    title: 'Admin: Dashboard',
    design: 'admin',
    themes: BOTH,
    boards: {
      390: 'Dashboard — mobile',
      820: 'Dashboard — tablet (Espresso dark theme)',
      1440: 'Dashboard — desktop',
    },
  },
  {
    path: '/admin/orders',
    slug: 'admin-orders',
    title: 'Admin: Orders',
    design: 'admin',
    themes: BOTH,
    boards: { 390: 'Orders — mobile', 820: 'Orders — tablet', 1440: 'Orders — grid/table toggle, delete works' },
  },
  {
    path: '/admin/expenses',
    slug: 'admin-expenses',
    title: 'Admin: Company Expenses',
    design: 'admin',
    themes: BOTH,
    boards: {
      390: 'Company Expenses — mobile',
      820: 'Company Expenses — tablet',
      1440: 'Company Expenses — desktop',
    },
  },
  {
    path: '/admin/users',
    slug: 'admin-users',
    title: 'Admin: Users',
    design: 'admin',
    themes: BOTH,
    boards: { 390: 'Users — mobile', 820: 'Users — tablet', 1440: 'Users (Manager only)' },
  },
  {
    path: '/admin/profile',
    slug: 'admin-profile',
    title: 'Admin: My Profile',
    design: 'admin',
    themes: BOTH,
    boards: { 390: 'My Profile — mobile', 820: 'My Profile — tablet', 1440: 'My Profile' },
  },
]);

/**
 * True when the environment says this is a CI run (any non-empty `CI`, as GitHub Actions and most CI services set).
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {boolean}
 */
export function isCi(env) {
  return env.CI !== undefined && env.CI !== '';
}

/**
 * The guards, in order: CI first (a CI run never even looks at the design folder), then the design folder's ignore
 * rule, then tracked design files, then this script's own output folder.
 * @param {{ ci: boolean, designIgnored: boolean, trackedDesignFiles: readonly string[], outputIgnored: boolean }} state
 * @returns {GuardResult}
 */
export function checkGuards({ ci, designIgnored, trackedDesignFiles, outputIgnored }) {
  if (ci) {
    return {
      ok: false,
      message:
        'This side-by-side is local only and never runs in CI: the design files are not in git and must never go to a ' +
        'CI machine (D-24).',
    };
  }
  if (!designIgnored) {
    return {
      ok: false,
      message:
        '.planning/design is not git-ignored. The design files must never be committed, so this run stops; restore the ' +
        '`.planning/design/` rule in .gitignore first.',
    };
  }
  if (trackedDesignFiles.length > 0) {
    return {
      ok: false,
      message:
        `These design files are tracked by git and must be removed from the index (never committed): ` +
        `${trackedDesignFiles.join(', ')}.`,
    };
  }
  if (!outputIgnored) {
    return {
      ok: false,
      message:
        'The output folder artifacts/owner-review/side-by-side is not git-ignored. Renders of the design must never ' +
        'be committed, so this run stops; restore the `artifacts/` rule in .gitignore first.',
    };
  }
  return { ok: true };
}

/**
 * One item per page, theme and width: the design screen to photograph (or null when the design has none at that width),
 * where its picture goes, and our screenshot from the owner review (relative to the side-by-side folder).
 * @param {readonly Pairing[]} [pairings]
 * @param {readonly number[]} [widths]
 * @returns {SideBySideItem[]}
 */
export function planSideBySide(pairings = PAIRINGS, widths = REVIEW_WIDTHS) {
  return pairings.flatMap((pairing) => {
    const target = REVIEW_TARGETS.find((entry) => entry.path === pairing.path);
    if (target === undefined) {
      throw new Error(`The owner review has no screenshots of ${pairing.path}.`);
    }
    return pairing.themes.flatMap((theme) =>
      widths.map((width) => {
        const board = pairing.boards[width] ?? null;
        const name = `${pairing.slug}-${theme}-${String(width)}`;
        return {
          path: pairing.path,
          slug: pairing.slug,
          title: pairing.title,
          theme,
          width,
          designFile: path.join(DESIGN_DIR, DESIGN_FILES[pairing.design]),
          board,
          ours: `../shots/${target.slug}-${theme}-${String(width)}.png`,
          output: board === null ? null : path.join(SIDE_BY_SIDE_DIR, `${name}-design.png`),
          // Our side of a real, guarded page is photographed signed in as a Manager (owner-review.mjs, plans 05-37 and 06-19).
          signedIn: target.signedIn === true,
        };
      }),
    );
  });
}

/**
 * Throws unless the path is strictly inside artifacts/owner-review/side-by-side/, the only place this script writes.
 * @param {string} file
 * @returns {string} the same path.
 */
export function assertSideBySidePath(file) {
  const relative = path.relative(SIDE_BY_SIDE_DIR, path.resolve(file));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside artifacts/owner-review/side-by-side/: ${path.resolve(file)}`);
  }
  return file;
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

/** @param {Theme} theme @returns {string} */
function themeName(theme) {
  return theme === 'light' ? 'Blush (light)' : 'Espresso (dark)';
}

const CSS = `
  body { margin: 0; font: 16px/1.5 Arial, sans-serif; color: #222; background: #f4f1ec; }
  main { max-width: 1600px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 40px 0 8px; border-top: 2px solid #ccc; padding-top: 24px; }
  h3 { font-size: 18px; margin: 20px 0 8px; }
  .note { max-width: 900px; }
  .pair { display: flex; gap: 16px; align-items: flex-start; overflow-x: auto; padding-bottom: 8px; }
  figure { margin: 0; flex: none; background: #fff; border: 1px solid #ccc; padding: 8px; }
  figure img { display: block; height: auto; border: 1px solid #ddd; }
  figcaption { font-size: 14px; margin-bottom: 6px; font-weight: bold; }
  .w390 img { width: 300px; } .w820 img { width: 480px; } .w1440 img { width: 720px; }
  .none { width: 300px; color: #555; font-style: italic; }
`;

/**
 * The side-by-side page: for each page, theme and width, the approved design on the left and our page on the right.
 * Plain words, relative pictures, no script and no remote address.
 * @param {{ generatedAt: string, items: readonly SideBySideItem[] }} input
 * @returns {string}
 */
export function renderSideBySide({ generatedAt, items }) {
  const pages = [...new Set(items.map((item) => item.path))];
  const sections = pages
    .map((pagePath) => {
      const ofPage = items.filter((item) => item.path === pagePath);
      const title = ofPage[0]?.title ?? pagePath;
      const pairs = ofPage
        .map((item) => {
          const label = `${themeName(item.theme)}, ${String(item.width)} px`;
          const design =
            item.output === null
              ? `<figure class="none"><figcaption>Approved design</figcaption><p>The design has no screen at this width.</p></figure>`
              : `<figure class="w${String(item.width)}"><figcaption>Approved design: ${escapeHtml(item.board ?? '')}</figcaption>` +
                `<a href="${escapeHtml(path.basename(item.output))}"><img src="${escapeHtml(path.basename(item.output))}" alt="${escapeHtml(
                  `Approved design, ${title}, ${label}`,
                )}"></a></figure>`;
          const ours =
            `<figure class="w${String(item.width)}"><figcaption>Our page${item.signedIn ? ', signed in as a Manager' : ''}</figcaption>` +
            `<a href="${escapeHtml(item.ours)}"><img src="${escapeHtml(item.ours)}" alt="${escapeHtml(
              `Our page, ${title}, ${label}`,
            )}"></a></figure>`;
          return `<h3>${escapeHtml(label)}</h3><div class="pair">${design}${ours}</div>`;
        })
        .join('\n');
      return `<section><h2>${escapeHtml(title)}</h2>${pairs}</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CSPS owner review: side by side with the design</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>CSPS owner review: the new pages next to the original design</h1>
<p class="note">Made on this computer on ${escapeHtml(generatedAt)}. On the left is the screen from your original design
files; on the right is the same page in the new app, at the same width and in the same colour theme. These pictures and
the design files are never put in git, uploaded or put on the live site.</p>
<p class="note">The Dashboard and Orders pages of the new app are still placeholders: their real content comes in later phases.
For those, please compare the frame around the page: the side menu, the top bar, the phone tab bar, the colours, the fonts
and the spacing. Company Expenses, Users and My Profile are the real pages, photographed signed in as a Manager. The public
home page is also a placeholder; compare its header and footer. Write down anything that looks wrong, in your own words.</p>
${sections}
</main>
</body>
</html>
`;
}

/**
 * Photographs every planned design screen. Every network request is blocked: the exports unpack themselves from their
 * own file and need nothing else.
 * @param {readonly SideBySideItem[]} items
 * @returns {Promise<void>}
 */
async function captureDesign(items) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.startsWith('file:') || url.startsWith('data:') || url.startsWith('blob:')) {
        await route.continue();
      } else {
        await route.abort();
      }
    });
    for (const designFile of [...new Set(items.map((item) => item.designFile))]) {
      const page = await context.newPage();
      await page.goto(pathToFileURL(designFile).href);
      await page.locator('section.board iframe').first().waitFor({ timeout: 120_000 });
      for (const item of items.filter((entry) => entry.designFile === designFile)) {
        if (item.board === null || item.output === null) {
          continue;
        }
        const board = page.locator('section.board', {
          has: page.getByRole('heading', { name: item.board, exact: true }),
        });
        if ((await board.count()) !== 1) {
          throw new Error(`${path.basename(designFile)} has no single screen titled "${item.board}".`);
        }
        const iframe = board.locator('iframe');
        const width = await iframe.getAttribute('width');
        if (width !== String(item.width)) {
          throw new Error(
            `The design screen "${item.board}" is ${String(width)} px wide, not ${String(item.width)} px.`,
          );
        }
        const frame = await (await iframe.elementHandle()).contentFrame();
        if (frame === null) {
          throw new Error(`The design screen "${item.board}" did not open.`);
        }
        await frame.locator('[data-theme]').first().waitFor({ timeout: 60_000 });
        await frame.evaluate(
          `document.querySelectorAll('[data-theme]').forEach((element) => element.setAttribute('data-theme', ${JSON.stringify(item.theme)}))`,
        );
        // The screen can be shorter than its frame, and the export's wrappers around it keep the light page colour; they
        // take the themed screen's own background, so a dark screen is not followed by a light strip that is not part
        // of the design.
        await frame.evaluate(
          `(() => { const themed = document.querySelector('[data-theme]'); if (themed === null) return; ` +
            `const background = getComputedStyle(themed).backgroundColor; ` +
            `if (background === 'rgba(0, 0, 0, 0)') return; ` +
            `for (let element = themed.parentElement; element !== null; element = element.parentElement) ` +
            `element.style.background = background; })()`,
        );
        await frame.evaluate('document.fonts.ready.then(() => true)');
        // Chromium does not paint the parts of a frame outside the viewport, and a screen can be 8000 px tall, so the
        // viewport grows to hold the whole screen before the picture is taken.
        const height = Number(await iframe.getAttribute('height'));
        await page.setViewportSize({ width: 1500, height: Math.max(1000, height + 40) });
        await iframe.scrollIntoViewIfNeeded();
        await frame.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        await iframe.screenshot({ path: assertSideBySidePath(item.output) });
        process.stdout.write(`side-by-side: ${path.basename(item.output)}\n`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

/**
 * The tracked files under .planning/design, as `git ls-files` lists them.
 * @returns {string[]}
 */
function trackedDesignFiles() {
  const result = spawnSync('git', ['ls-files', '--', DESIGN_GIT_PATH], { cwd: REPO_ROOT, encoding: 'utf8' });
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** @returns {Promise<number>} */
async function main() {
  const guard = checkGuards({
    ci: isCi(process.env),
    designIgnored: isGitIgnored(DESIGN_GIT_PATH),
    trackedDesignFiles: trackedDesignFiles(),
    outputIgnored: isGitIgnored(SIDE_BY_SIDE_GIT_PATH),
  });
  if (!guard.ok) {
    process.stderr.write(`side-by-side: ${guard.message}\n`);
    return 1;
  }
  const items = planSideBySide();
  const missingDesign = [...new Set(items.map((item) => item.designFile))].filter((file) => !existsSync(file));
  if (missingDesign.length > 0) {
    process.stderr.write(`side-by-side: the design files are not on this computer: ${missingDesign.join(', ')}\n`);
    return 1;
  }
  const missingOurs = items.filter((item) => !existsSync(path.join(SIDE_BY_SIDE_DIR, item.ours)));
  if (missingOurs.length > 0) {
    process.stderr.write(
      `side-by-side: ${String(missingOurs.length)} screenshot(s) of our pages are missing; run ` +
        '`npm --prefix web run review` first.\n',
    );
    return 1;
  }
  mkdirSync(SIDE_BY_SIDE_DIR, { recursive: true });
  for (const name of readdirSync(SIDE_BY_SIDE_DIR)) {
    rmSync(assertSideBySidePath(path.join(SIDE_BY_SIDE_DIR, name)), { recursive: true, force: true });
  }
  await captureDesign(items);
  const index = path.join(SIDE_BY_SIDE_DIR, 'index.html');
  writeFileSync(assertSideBySidePath(index), renderSideBySide({ generatedAt: new Date().toString(), items }));
  process.stdout.write(`side-by-side: the report is ready: ${index}\n`);
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
