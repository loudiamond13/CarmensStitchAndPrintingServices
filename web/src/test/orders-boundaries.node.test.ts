// @vitest-environment node
// Boundary guards for the order screens (plan 08-24; ORD-19, T-08-45, T-08-46, D-59): the staff-only figures never cross into the
// public site, no order screen renders text as HTML, and no order screen reads the device clock for the business day. Each guard is a
// pure check over source text, proved against a planted violation first, then run over the real tree.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../', import.meta.url));
const adminDir = join(srcDir, 'modules', 'admin');
const publicDir = join(srcDir, 'modules', 'public');
const publicLayout = join(srcDir, 'layouts', 'PublicLayout.tsx');

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

const name = (path: string): string => basename(path);
const isTest = (path: string): boolean => /\.test\.[a-z]+$/.test(path);
const where = (path: string): string => relative(srcDir, path).replaceAll('\\', '/');

/** The source without block and line comments, so a comment that names a rule does not trip the rule. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** ORD-19: the words of the staff-only figures. */
const INTERNAL_FIGURES = /Estimated Profit|Order Expenses/;
/** T-08-46: raw HTML from a string. */
const RAW_HTML = /dangerouslySetInnerHTML/;
/** D-59: the device clock. `new Date(value)` is fine; the empty form and `Date.now()` read the clock. */
const DEVICE_CLOCK = /new Date\(\s*\)|Date\.now\(\)/;

function mentions(pattern: RegExp, source: string): boolean {
  return pattern.test(code(source));
}

const publicFiles = [...filesUnder(publicDir), publicLayout];

/** Order module files: the pages, components, hooks and services of the order screens. */
const orderFiles = filesUnder(adminDir).filter((path) => /^(Order|Orders|Deleted)/.test(name(path)) && !isTest(path));

/** The files that must not read the device clock: the due flag, the order pages and every order window. */
const clockFiles = filesUnder(adminDir).filter((path) =>
  /^(DueFlag|OrdersPage|OrderPage|OrderFormPage|DeletedOrdersPage|DeletedOrderPage|OrderWindow|Order\w+Modal)\.tsx$/.test(
    name(path),
  ),
);

describe('ORD-19 the public site never shows Estimated Profit or Order Expenses', () => {
  it('the guard flags a planted internal figure and leaves a comment about the rule alone', () => {
    expect(mentions(INTERNAL_FIGURES, '<dt>Estimated Profit</dt>')).toBe(true);
    expect(mentions(INTERNAL_FIGURES, "const label = 'Order Expenses';")).toBe(true);
    expect(mentions(INTERNAL_FIGURES, '// Order Expenses stay staff only\nconst x = 1;')).toBe(false);
  });

  it('finds neither word in any file of the public module or the public layout', () => {
    expect(publicFiles.length).toBeGreaterThan(5);
    expect(publicFiles).toContain(publicLayout);
    const hits = publicFiles.filter((path) => INTERNAL_FIGURES.test(readFileSync(path, 'utf8'))).map(where);
    expect(hits).toEqual([]);
  });
});

describe('T-08-46 no order screen renders text as HTML (dangerouslySetInnerHTML)', () => {
  it('the guard flags a planted dangerouslySetInnerHTML', () => {
    expect(mentions(RAW_HTML, '<p dangerouslySetInnerHTML={{ __html: order.notes }} />')).toBe(true);
    expect(mentions(RAW_HTML, '<p>{order.notes}</p>')).toBe(false);
  });

  it('finds none in any Order, Orders or Deleted file of the admin module', () => {
    expect(orderFiles.length).toBeGreaterThan(20);
    const hits = orderFiles.filter((path) => mentions(RAW_HTML, readFileSync(path, 'utf8'))).map(where);
    expect(hits).toEqual([]);
  });
});

describe('D-59 no order screen reads the device clock (new Date()) for the business today', () => {
  it('the guard flags a planted new Date() and Date.now(), and allows a date built from a value', () => {
    expect(mentions(DEVICE_CLOCK, 'const today = new Date();')).toBe(true);
    expect(mentions(DEVICE_CLOCK, 'const today = new Date( );')).toBe(true);
    expect(mentions(DEVICE_CLOCK, 'const now = Date.now();')).toBe(true);
    expect(mentions(DEVICE_CLOCK, 'const day = new Date(`${order.orderDate}T00:00:00Z`);')).toBe(false);
  });

  it('covers the due flag, the order pages and the order windows, and finds none in them', () => {
    const names = clockFiles.map(name);
    for (const expected of ['DueFlag.tsx', 'OrdersPage.tsx', 'OrderPage.tsx', 'OrderFormPage.tsx', 'OrderWindow.tsx']) {
      expect(names, expected).toContain(expected);
      expect(existsSync(clockFiles[names.indexOf(expected)] ?? ''), expected).toBe(true);
    }
    expect(names.some((file) => file.endsWith('Modal.tsx'))).toBe(true);
    const hits = clockFiles.filter((path) => mentions(DEVICE_CLOCK, readFileSync(path, 'utf8'))).map(where);
    expect(hits).toEqual([]);
  });
});
