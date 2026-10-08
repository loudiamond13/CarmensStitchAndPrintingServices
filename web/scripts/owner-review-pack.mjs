// @ts-check
/// <reference lib="dom" />
// Owner review pack for plan 02-09 (D-08, D-12, D-27, UI-SPEC "Owner Confirmations"): local only, never in CI.
//
//   node web/scripts/owner-review-pack.mjs
//
// 1. Builds the e2e bundle (vite build --mode e2e) when web/.e2e-dist is missing or older than src/styles, to get the
//    compiled CSS and fonts.
// 2. Starts Vite in middleware mode (no port, no websocket) and loads the frozen App. D.3/D.5 reference and the
//    reconciled design system through ssrLoadModule, so `@/` and TSX resolve as in the app.
// 3. Renders the review pages with react-dom/server and createElement (no JSX here): the 56 icons in their 0.460 and
//    1.52.0 drawings, O-3 (public drawer current link), D-27 (Sidebar Logout before/after, measured), D-BL-02 (the
//    "Manager" tag on the selected Users row) and the O-8 small controls with measured sizes.
// 4. Opens each page in Playwright Chromium with the compiled CSS and writes PNGs plus index.html into
//    artifacts/owner-review/phase2-rulings/ (git-ignored). It refuses to write anywhere else.
// It reads nothing from .planning/design/ and uploads nothing.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createElement as h, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { build, createServer } from 'vite';
import { referenceResolvePlugin } from './reference-resolve-plugin.mjs';

/**
 * @typedef {import('react').ComponentType<Record<string, unknown>>} Component
 * @typedef {{
 *   Icon: Component, Sidebar: Component, Logo: Component, UiLink: Component, Button: Component,
 *   LinkProvider: Component, SegmentedControl: Component, SITE_LINKS: { label: string, to: string }[]
 * }} UiModule
 * @typedef {{ ICONS: Record<string, unknown> }} IconModule
 * @typedef {{ RouterLink: Component }} RouterLinkModule
 * @typedef {{ name: string, status: 'same' | 'changed', renamedTo: string | null, ref24: string, ref48: string,
 *   rec24: string, rec48: string }} IconRow
 */

if (process.env.CI !== undefined && process.env.CI !== '') {
  console.error('owner-review-pack is local only (it renders review material for the owner) and never runs in CI.');
  process.exit(1);
}

const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = path.resolve(webDirectory, '..');
const outputRoot = path.join(repoRoot, 'artifacts', 'owner-review');
const outputDirectory = path.join(outputRoot, 'phase2-rulings');
const e2eDist = path.join(webDirectory, '.e2e-dist');
const ORIGIN = 'https://review.local';

/**
 * Throws unless the path is strictly inside artifacts/owner-review/ (the only place this script may write).
 * @param {string} target
 * @returns {string}
 */
function insideOutput(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(outputRoot, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside artifacts/owner-review/: ${resolved}`);
  }
  return resolved;
}

/**
 * @param {string} file
 * @param {string} text
 */
function writeOutput(file, text) {
  writeFileSync(insideOutput(path.join(outputDirectory, file)), text);
}

/** @param {string} directory @returns {number} newest modification time below the directory */
function newestMtime(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce((newest, entry) => {
    const full = path.join(directory, entry.name);
    const time = entry.isDirectory() ? newestMtime(full) : statSync(full).mtimeMs;
    return Math.max(newest, time);
  }, 0);
}

/** @returns {Promise<string>} the compiled CSS of the e2e bundle */
async function compiledCss() {
  const assets = path.join(e2eDist, 'assets');
  const stale = !existsSync(assets) || newestMtime(path.join(webDirectory, 'src', 'styles')) > newestMtime(assets);
  if (stale) {
    console.log('Building the e2e bundle for the compiled CSS (vite build --mode e2e) ...');
    await build({
      root: webDirectory,
      configFile: path.join(webDirectory, 'vite.config.ts'),
      mode: 'e2e',
      logLevel: 'warn',
    });
  }
  const cssFiles = readdirSync(assets).filter((name) => name.endsWith('.css'));
  if (cssFiles.length !== 1 || cssFiles[0] === undefined) {
    throw new Error(`Expected exactly one CSS file in ${assets}, found ${String(cssFiles.length)}`);
  }
  return readFileSync(path.join(assets, cssFiles[0]), 'utf8');
}

/**
 * The lucide-react file a name resolves to, when the name is an alias of another icon (for example trash-2 -> trash).
 * @param {string} name
 * @returns {string | null}
 */
function lucideAliasTarget(name) {
  const file = path.join(webDirectory, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons', `${name}.mjs`);
  if (!existsSync(file)) {
    return '(missing)';
  }
  const match = /export \{ default \} from '\.\/([\w-]+)\.mjs'/.exec(readFileSync(file, 'utf8'));
  return match?.[1] ?? null;
}

/**
 * The inner drawing of an svg as a canonical list of elements with sorted attributes (D-12 comparison).
 * @param {string} svg
 * @returns {string}
 */
function drawingOf(svg) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return [...inner.matchAll(/<(\w+)([^>]*?)\/?>/g)]
    .map(([, tag, attributes]) => {
      const pairs = [...(attributes ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => `${k ?? ''}=${v ?? ''}`);
      return `${tag ?? ''}(${pairs.sort().join(',')})`;
    })
    .join(' ');
}

/** @param {string} text @returns {string} */
function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/**
 * A full review page: the compiled app CSS plus a little layout CSS for the review grid.
 * @param {string} css
 * @param {string} body
 * @param {string} [extraCss]
 * @returns {string}
 */
function page(css, body, extraCss = '') {
  const layout = `
    body { margin: 0; background: #fff; }
    .rp { padding: 16px; font: 14px/1.4 Arial, sans-serif; color: #222; }
    .rp h2 { font: 700 16px/1.3 Arial, sans-serif; margin: 0 0 8px; }
    .rp .row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .rp .panel { display: flex; flex: none; flex-direction: column; gap: 6px; }
    .rp .cap { font: 700 12px/1.3 Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; color: #555; }
    .rp table { border-collapse: collapse; }
    .rp td, .rp th { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: middle; }
    .rp .changed { background: #fff2cc; }
    .rp .icon { display: inline-grid; place-items: center; color: #222; }
    .rp .side { height: 560px; display: flex; width: var(--sidebar-width); }
    ${extraCss}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style><style>${layout}</style></head><body>${body}</body></html>`;
}

/**
 * @param {import('react').ReactElement} element
 * @returns {string}
 */
function markup(element) {
  return renderToStaticMarkup(h(MemoryRouter, null, element));
}

/**
 * The D.3 SiteHeader in its open state (the drawer renders only after the burger is pressed, which a static render
 * cannot do), built from the design-system components exactly as App. D.3 writes it. `after` applies O-3.
 * @param {UiModule} ui
 * @param {string} active
 * @param {boolean} after
 * @returns {import('react').ReactElement}
 */
function openSiteHeader(ui, active, after) {
  return h(
    'header',
    { className: 'csp-site-header is-open' },
    h(
      'div',
      { className: 'csp-site-header-in' },
      h(ui.UiLink, { to: '/', className: 'csp-site-logo' }, h(ui.Logo, { size: 'sm' })),
      h(
        'button',
        { type: 'button', className: 'csp-iconbtn csp-site-burger', 'aria-expanded': true, 'aria-label': 'Menu' },
        h(ui.Icon, { name: 'x', size: 22 }),
      ),
    ),
    h(
      'nav',
      { className: 'csp-site-drawer', 'aria-label': 'Mobile' },
      ...ui.SITE_LINKS.map((link) =>
        h(
          ui.UiLink,
          {
            key: link.label,
            to: link.to,
            className: link.label === active ? 'csp-site-dlink is-on' : 'csp-site-dlink',
            'aria-current': after && link.label === active ? 'page' : undefined,
          },
          link.label,
          h(ui.Icon, { name: 'arrow-right', size: 20 }),
        ),
      ),
      h(ui.Button, { variant: 'primary', block: true, iconRight: 'arrow-right' }, 'Get a Quote'),
    ),
  );
}

const STYLE_PROPERTIES = [
  'display',
  'box-sizing',
  'width',
  'height',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-left',
  'border-top-width',
  'border-top-style',
  'border-radius',
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration-line',
  'cursor',
  'gap',
  'justify-content',
  'align-items',
  'white-space',
  'appearance',
  'opacity',
];

/**
 * A browser-side expression that returns the computed style and box of the Logout element in each `.d27` panel.
 * @param {string} selector
 * @returns {string}
 */
function measureExpression(selector) {
  return `(() => [...document.querySelectorAll(${JSON.stringify(selector)})].map((el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const label = el.querySelector('.csp-nav-label');
    const icon = el.querySelector('svg');
    const out = { tag: el.tagName.toLowerCase(), boxWidth: Math.round(box.width * 100) / 100, boxHeight: Math.round(box.height * 100) / 100,
      iconLeft: icon && icon.getClientRects().length > 0 ? Math.round((icon.getBoundingClientRect().left - box.left) * 100) / 100 : null,
      labelLeft: label && label.getClientRects().length > 0 ? Math.round((label.getBoundingClientRect().left - box.left) * 100) / 100 : 'hidden' };
    for (const p of ${JSON.stringify(STYLE_PROPERTIES)}) out[p] = style.getPropertyValue(p);
    return out;
  }))()`;
}

/**
 * @param {Record<string, unknown>[]} measured two entries: reference, reconciled
 * @returns {{ rows: string, differences: string[] }}
 */
function compareLogout(measured) {
  const [reference, reconciled] = measured;
  if (reference === undefined || reconciled === undefined) {
    throw new Error('D-27: expected a reference and a reconciled Logout');
  }
  /** @type {string[]} */
  const differences = [];
  const keys = Object.keys(reference).filter((key) => key !== 'tag');
  const rows = keys
    .map((key) => {
      const a = String(reference[key]);
      const b = String(reconciled[key]);
      if (a !== b) {
        differences.push(key);
      }
      return `<tr class="${a === b ? '' : 'changed'}"><td>${escapeHtml(key)}</td><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td><td>${a === b ? 'same' : 'DIFFERENT'}</td></tr>`;
    })
    .join('');
  return { rows, differences };
}

async function main() {
  const css = await compiledCss();
  rmSync(insideOutput(outputDirectory), { recursive: true, force: true });
  mkdirSync(insideOutput(outputDirectory), { recursive: true });

  const server = await createServer({
    root: webDirectory,
    configFile: path.join(webDirectory, 'vite.config.ts'),
    mode: 'development',
    appType: 'custom',
    logLevel: 'warn',
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [referenceResolvePlugin()],
  });
  const browser = await chromium.launch();
  try {
    const reference = /** @type {UiModule} */ (await server.ssrLoadModule('/src/ui/__reference__/index.tsx'));
    const referenceIcons = /** @type {IconModule} */ (await server.ssrLoadModule('/src/ui/__reference__/icons.ts'));
    const reconciled = /** @type {UiModule} */ (await server.ssrLoadModule('/src/ui/index.tsx'));
    const { RouterLink } = /** @type {RouterLinkModule} */ (await server.ssrLoadModule('/src/app/RouterLink.tsx'));

    /** @param {import('react').ReactElement} element */
    const referenceMarkup = (element) => markup(h(reference.LinkProvider, { component: RouterLink }, element));

    const context = await browser.newContext({ deviceScaleFactor: 2 });
    await context.route(`${ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      const file = path.join(e2eDist, decodeURIComponent(url.pathname));
      if (url.pathname.startsWith('/assets/') && existsSync(file)) {
        await route.fulfill({ path: file });
      } else {
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>review</title>' });
      }
    });
    const browserPage = await context.newPage();

    /**
     * @param {string} html
     * @param {number} width
     */
    const open = async (html, width) => {
      await browserPage.setViewportSize({ width, height: 900 });
      await browserPage.goto(`${ORIGIN}/`);
      await browserPage.setContent(html, { waitUntil: 'load' });
      await browserPage.evaluate('document.fonts.ready.then(() => true)');
    };
    /** @param {string} file */
    const shoot = async (file) => {
      await browserPage.screenshot({ path: insideOutput(path.join(outputDirectory, file)), fullPage: true });
    };

    /* ── icons (D-12) ── */
    const names = Object.keys(referenceIcons.ICONS);
    /** @type {IconRow[]} */
    const icons = names.map((name) => {
      const ref24 = renderToStaticMarkup(h(reference.Icon, { name, size: 24 }));
      const rec24 = renderToStaticMarkup(h(reconciled.Icon, { name, size: 24 }));
      return {
        name,
        status: drawingOf(ref24) === drawingOf(rec24) ? 'same' : 'changed',
        renamedTo: lucideAliasTarget(name),
        ref24,
        rec24,
        ref48: renderToStaticMarkup(h(reference.Icon, { name, size: 48 })),
        rec48: renderToStaticMarkup(h(reconciled.Icon, { name, size: 48 })),
      };
    });
    const changed = icons.filter((icon) => icon.status === 'changed');
    const renamed = icons.filter((icon) => icon.renamedTo !== null);
    /** @param {IconRow[]} rows */
    const iconTable = (rows) =>
      `<table><tr><th>Icon</th><th>Status</th><th>Approved drawing (Lucide 0.460)</th><th>New drawing (lucide-react 1.52.0)</th></tr>${rows
        .map(
          (icon) =>
            `<tr class="${icon.status}"><td><strong>${icon.name}</strong>${icon.renamedTo === null ? '' : `<br>renamed: now ${icon.renamedTo}`}</td><td>${icon.status}</td>` +
            `<td><span class="icon">${icon.ref24}</span> <span class="icon">${icon.ref48}</span></td>` +
            `<td><span class="icon">${icon.rec24}</span> <span class="icon">${icon.rec48}</span></td></tr>`,
        )
        .join('')}</table>`;
    await open(
      page(
        css,
        `<div class="rp"><h2>Icons whose drawing changed (${String(changed.length)} of ${String(icons.length)})</h2>${iconTable(changed)}</div>`,
      ),
      760,
    );
    await shoot('icons-changed.png');
    await open(page(css, `<div class="rp"><h2>All ${String(icons.length)} icons</h2>${iconTable(icons)}</div>`), 760);
    await shoot('icons-all.png');

    /* ── O-3: the public drawer's current link ── */
    const drawerToday = referenceMarkup(openSiteHeader(reference, 'Gallery', false));
    const drawerAfter = markup(openSiteHeader(reconciled, 'Gallery', true));
    await open(
      page(
        css,
        `<div class="rp"><h2>O-3 Today: the current page (Gallery) is orange only</h2></div><div class="s-page" data-theme="light">${drawerToday}</div>` +
          `<div class="rp"><h2>O-3 Proposed: also italic, and announced as the current page</h2></div><div class="s-page o3-after" data-theme="light">${drawerAfter}</div>`,
        '.o3-after .csp-site-dlink[aria-current="page"] { font-style: italic; }',
      ),
      390,
    );
    await shoot('o3-drawer-current-link.png');

    /* ── D-27: Sidebar Logout before/after ── */
    const sidebarProps = { role: 'manager', active: 'orders', user: { name: 'Carmen Reyes' } };
    /** @type {{ theme: string, collapsed: boolean, rows: string, differences: string[], hoverRows: string, hoverDifferences: string[] }[]} */
    const d27 = [];
    for (const theme of ['light', 'dark']) {
      for (const collapsed of [false, true]) {
        const props = { ...sidebarProps, collapsed };
        const body =
          `<div class="rp"><div class="row">` +
          `<div class="panel"><span class="cap">Approved (link)</span><div class="s-page d27 side" data-theme="${theme}">${referenceMarkup(h(reference.Sidebar, props))}</div></div>` +
          `<div class="panel"><span class="cap">Now (button, D-27)</span><div class="s-page d27 side" data-theme="${theme}">${markup(h(reconciled.Sidebar, props))}</div></div>` +
          `</div></div>`;
        await open(page(css, body), 1000);
        const suffix = `${theme === 'light' ? 'blush' : 'espresso'}${collapsed ? '-collapsed' : ''}`;
        await shoot(`d27-logout-${suffix}.png`);
        const selector = '.d27 .csp-sidebar-foot > .csp-nav';
        const resting = compareLogout(
          /** @type {Record<string, unknown>[]} */ (await browserPage.evaluate(measureExpression(selector))),
        );
        /** @type {Record<string, unknown>[]} */
        const hovered = [];
        for (const index of [0, 1]) {
          await browserPage.locator(selector).nth(index).hover();
          const all = /** @type {Record<string, unknown>[]} */ (
            await browserPage.evaluate(measureExpression(selector))
          );
          const entry = all[index];
          if (entry !== undefined) {
            hovered.push(entry);
          }
          await browserPage
            .locator(selector)
            .nth(index)
            .screenshot({
              path: insideOutput(
                path.join(outputDirectory, `d27-logout-${suffix}-hover-${index === 0 ? 'link' : 'button'}.png`),
              ),
            });
        }
        await browserPage.mouse.move(0, 0);
        const hover = compareLogout(hovered);
        d27.push({
          theme,
          collapsed,
          rows: resting.rows,
          differences: resting.differences,
          hoverRows: hover.rows,
          hoverDifferences: hover.differences,
        });
      }
    }

    /* ── D-BL-02: the Manager tag on the selected Users row ── */
    const usersSidebar = markup(
      h(reconciled.Sidebar, { role: 'manager', active: 'users', user: { name: 'Carmen Reyes' } }),
    );
    let dbl02 = '<div class="rp"><div class="row">';
    for (const theme of ['light', 'dark']) {
      dbl02 +=
        `<div class="panel"><span class="cap">${theme === 'light' ? 'Blush' : 'Espresso'}: today</span><div class="s-page side" data-theme="${theme}">${usersSidebar}</div></div>` +
        `<div class="panel"><span class="cap">${theme === 'light' ? 'Blush' : 'Espresso'}: option A</span><div class="s-page side dbl02-after" data-theme="${theme}">${usersSidebar}</div></div>`;
    }
    dbl02 += '</div></div>';
    await open(page(css, dbl02, '.dbl02-after .csp-nav.is-on .csp-nav-tag { color: var(--on-primary); }'), 1100);
    await shoot('dbl02-manager-tag.png');

    /* ── O-8: controls smaller than 44 px ── */
    const o8Body = markup(
      h(
        Fragment,
        null,
        h(
          'div',
          { className: 'o8', 'data-name': 'Small button (sm)' },
          h(reconciled.Button, { size: 'sm', icon: 'plus' }, 'New order'),
        ),
        h(
          'div',
          { className: 'o8', 'data-name': 'Icon button (.csp-iconbtn)' },
          h(
            'button',
            { type: 'button', className: 'csp-iconbtn', 'aria-label': 'Close' },
            h(reconciled.Icon, { name: 'x', size: 20 }),
          ),
        ),
        h(
          'div',
          { className: 'o8', 'data-name': 'Icon button (.s-iconbtn)' },
          h(
            'button',
            { type: 'button', className: 's-iconbtn', 'aria-label': 'More' },
            h(reconciled.Icon, { name: 'ellipsis', size: 20 }),
          ),
        ),
        h(
          'div',
          { className: 'o8', 'data-name': 'Segmented control option (.csp-seg-btn)' },
          h(reconciled.SegmentedControl, {
            label: 'View',
            options: [
              { value: 'grid', label: 'Grid', icon: 'layout-grid' },
              { value: 'list', label: 'List', icon: 'list' },
            ],
          }),
        ),
        h(
          'div',
          { className: 'o8', 'data-name': 'Filter chip clear button (App. E.7)' },
          h(
            'span',
            { className: 's-filter-chip' },
            'Status: Active ',
            h(
              'button',
              { type: 'button', className: 's-iconbtn o8-chip', 'aria-label': 'Clear status filter' },
              h(reconciled.Icon, { name: 'x', size: 14 }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'o8', 'data-name': 'Login checkbox (App. E.5)' },
          h(
            'label',
            { className: 's-check' },
            h('input', { type: 'checkbox', defaultChecked: true }),
            ' Keep me signed in',
          ),
        ),
      ),
    );
    await open(
      page(
        css,
        `<div class="rp"><h2>O-8 controls smaller than 44 px</h2></div><div class="s-page o8-page" data-theme="light">${o8Body}</div>`,
        '.o8-page { padding: 16px; display: grid; gap: 16px; } .o8-chip { width: 22px; height: 22px; color: inherit; }',
      ),
      480,
    );
    await shoot('o8-small-targets.png');
    const o8Sizes = /** @type {{ name: string, width: number, height: number }[]} */ (
      await browserPage.evaluate(`[...document.querySelectorAll('.o8')].map((row) => {
        const target = row.querySelector('.csp-btn, .csp-iconbtn, .s-iconbtn, .csp-seg-btn, input');
        const box = target.getBoundingClientRect();
        return { name: row.dataset.name, width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 };
      })`)
    );

    /* ── index.html ── */
    const d27Html = d27
      .map(({ theme, collapsed, rows, differences, hoverRows, hoverDifferences }) => {
        const suffix = `${theme === 'light' ? 'blush' : 'espresso'}${collapsed ? '-collapsed' : ''}`;
        const label = `${theme === 'light' ? 'Blush (light)' : 'Espresso (dark)'}${collapsed ? ', collapsed sidebar' : ''}`;
        return `<h3>${label}</h3><p><img src="d27-logout-${suffix}.png" alt="Sidebar before and after, ${label}" width="1000"></p>
<p>Hovered: <img src="d27-logout-${suffix}-hover-link.png" alt="old link hovered"> <img src="d27-logout-${suffix}-hover-button.png" alt="new button hovered"></p>
<p><strong>Measured at rest:</strong> ${differences.length === 0 ? 'identical (every measured style and size is the same).' : `different in ${differences.join(', ')}.`}
<strong>Measured on hover:</strong> ${hoverDifferences.length === 0 ? 'identical.' : `different in ${hoverDifferences.join(', ')}.`}</p>
<details><summary>Measured values</summary><table><tr><th>Property</th><th>Old link</th><th>New button</th><th></th></tr>${rows}</table>
<table><tr><th>Property (hover)</th><th>Old link</th><th>New button</th><th></th></tr>${hoverRows}</table></details>`;
      })
      .join('\n');
    const d27Identical = d27.every((entry) => entry.differences.length === 0 && entry.hoverDifferences.length === 0);

    const created = new Date().toISOString();
    const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>CSPS Phase 2: rulings needed from the owner</title>
<style>
body { font: 16px/1.5 Arial, sans-serif; color: #222; max-width: 980px; margin: 24px auto; padding: 0 16px; }
h1 { font-size: 26px; } h2 { margin-top: 40px; border-top: 2px solid #ddd; padding-top: 16px; }
table { border-collapse: collapse; margin: 8px 0; } td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
.changed { background: #fff2cc; } .yes { color: #0a6b2d; font-weight: 700; } .no { color: #555; }
img { max-width: 100%; border: 1px solid #ddd; } code { background: #f4f4f4; padding: 1px 4px; }
.answer { background: #eef6ff; border: 1px solid #b6d4fe; padding: 12px 16px; }
</style></head><body>
<h1>CSPS Phase 2: rulings needed from the owner</h1>
<p><em>Made ${escapeHtml(created)} by web/scripts/owner-review-pack.mjs (plan 02-09). Local file only; nothing here is uploaded or deployed.</em></p>
<p>The approved design code is now in the app, and a test proves it draws the same page structure as the approved
version. A few things still need your decision, because each one would change what people see or hear (your rule
D-08), or is a new icon drawing (your rule D-12). Nothing on this page has been applied yet.</p>
<div class="answer"><strong>How to answer.</strong> Reply <code>option-a</code> to accept every recommendation below, or list
your answer for each item, for example: <code>O-1 yes, O-2 yes, O-3 no, ..., menu: approve, filter: use list-filter</code>.</div>

<h2>1. Icons with a new drawing (${String(changed.length)} of ${String(icons.length)})</h2>
<p>The icons now come from the free lucide-react package (your decision D-10). It is a newer version than the one the
design used, so ${String(changed.length)} of the ${String(icons.length)} icons are drawn a little differently. Many
look the same and only changed how they are built (for example straight lines rebuilt as paths). One you will notice:
the menu icon's three bars moved slightly (from heights 6/12/18 to 5/12/19). ${String(renamed.length)} icons were
renamed by lucide (${renamed.map((icon) => `${icon.name} is now ${icon.renamedTo ?? ''}`).join(', ')}), which you will not see.</p>
<p>For each changed icon: approve the new drawing, or name a different lucide icon to use instead.</p>
<p><img src="icons-changed.png" alt="Changed icons, old and new drawings at 24 and 48 pixels" width="760"></p>
<details><summary>All ${String(icons.length)} icons (changed ones highlighted)</summary><p><img src="icons-all.png" alt="All icons" width="760"></p>
<table><tr><th>Icon</th><th>Status</th></tr>${icons.map((icon) => `<tr class="${icon.status}"><td>${icon.name}${icon.renamedTo === null ? '' : ` (renamed: now ${icon.renamedTo})`}</td><td>${icon.status}</td></tr>`).join('')}</table></details>
<p>Recommended: approve all ${String(changed.length)}.</p>

<h2>2. The eight accessibility confirmations (UI spec "Owner Confirmations", O-1 to O-8)</h2>
<table>
<tr><th>#</th><th>What would change</th><th>Can you see it?</th><th>Recommended</th></tr>
<tr><td>O-1</td><td>The round initials badge (Avatar) is announced as a picture of the person's name. Needed for zero accessibility-checker errors.</td><td class="no">No visible change (spoken label only)</td><td class="yes">Yes</td></tr>
<tr><td>O-2</td><td>The testimonial stars are announced as "5 out of 5" as one picture. Same checker rule.</td><td class="no">No visible change (spoken label only)</td><td class="yes">Yes</td></tr>
<tr><td>O-3</td><td>On phones, the menu's current page link is also announced as the current page, and turns <em>italic</em> as a second cue next to the orange colour.</td><td><strong>Yes</strong>: the current menu link is italic (picture below)</td><td class="yes">Yes</td></tr>
<tr><td>O-4</td><td>Fix a typo in the footer's spoken labels: "CSPS onFacebook" becomes "CSPS on Facebook" (also Instagram, TikTok).</td><td class="no">No visible change (spoken label only)</td><td class="yes">Yes</td></tr>
<tr><td>O-5</td><td>The area where pop-up messages appear is always present (empty when there are none), so screen readers reliably read new messages.</td><td class="no">No visible change (behaviour only)</td><td class="yes">Yes</td></tr>
<tr><td>O-6</td><td>For people who ask their phone or computer for reduced motion: stop the loading shimmer and the pop-up and dialog entry animations.</td><td class="no">Only people who turned on reduced motion see it</td><td class="yes">Yes</td></tr>
<tr><td>O-7</td><td>Warning messages stay until closed (like error messages); success and info messages pause their 4.5 second timer while the mouse is over them or keyboard focus is inside them.</td><td class="no">No visible change (behaviour only)</td><td class="yes">Yes</td></tr>
<tr><td>O-8</td><td>Keep the small controls at their designed sizes (listed below). They meet the WCAG 2.2 AA minimum (24 px, or enough space around them); the project's own target is 44 px, so this is recorded as an exception.</td><td class="no">No change if kept</td><td class="yes">Keep as designed</td></tr>
</table>
<h3>O-3 picture (phone width)</h3>
<p><img src="o3-drawer-current-link.png" alt="Phone menu today and with the italic current link" width="390"></p>
<h3>O-8 measured sizes</h3>
<table><tr><th>Control</th><th>Width × height (px)</th></tr>${o8Sizes.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${String(row.width)} × ${String(row.height)}</td></tr>`).join('')}</table>
<p><img src="o8-small-targets.png" alt="The small controls" width="480"></p>

<h2>3. Sidebar "Logout" is now a button (D-27, already ruled: please confirm it looks the same)</h2>
<p>You decided the Logout entry becomes a button instead of a link, as long as it looks identical. Left: the approved
link. Right: the new button. ${d27Identical ? '<strong>Measured result: identical</strong> in every state and theme shown (size, spacing, colours, font, cursor).' : '<strong>Measured result: some values differ</strong> (see below).'}</p>
${d27Html}

<h2>4. Earlier open question: the "Manager" tag on the selected Users menu row (backlog D-BL-02)</h2>
<p>In the approved colours the small "Manager" tag disappears when the Users page is open, because the tag and the
highlight are the same colour. Option A (recommended) shows the tag in the selected row's text colour. Option B hides
the tag on the selected row. Option C keeps the approved look (fails the contrast rule).</p>
<p><img src="dbl02-manager-tag.png" alt="Users menu row today and with option A, Blush and Espresso" width="1100"></p>

<h2>5. New questions found while bringing in the design code</h2>
<p>None. Every strict type and lint rule was satisfied without changing what the page shows, except the Logout button
you already ruled on (section 3). The full list of code changes is in <code>web/SPEC-DEVIATIONS.md</code>.</p>
</body></html>
`;
    writeOutput('index.html', index);
    console.log(`Owner review pack: ${outputDirectory}`);
    console.log(
      `  icons: ${String(icons.length)} (${String(changed.length)} changed, ${String(renamed.length)} renamed): ${changed.map((icon) => icon.name).join(', ')}`,
    );
    console.log(`  D-27 Logout: ${d27Identical ? 'identical in every measured state' : 'DIFFERENT, see index.html'}`);
    console.log(
      `  O-8 sizes: ${o8Sizes.map((row) => `${row.name} ${String(row.width)}x${String(row.height)}`).join('; ')}`,
    );
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
