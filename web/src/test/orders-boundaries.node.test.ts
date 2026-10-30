// @vitest-environment node
// Boundary guards for the order screens (plan 08-24; ORD-19, T-08-45, T-08-46, D-59): the staff-only figures never cross into the
// public site, no order screen renders text as HTML, and no order screen reads the device clock for the business day. Each guard is a
// pure check over source text, proved against a planted violation first, then run over the real tree.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
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

const scan = (source: string): { text: string; open: boolean } => ({ text: code(source), open: false });

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

/** Every non-test source file of the admin module. */
const adminSources = filesUnder(adminDir).filter((path) => /\.tsx?$/.test(path) && !isTest(path));
const hooksDir = join(adminDir, 'hooks');

/** Order module files: any admin source named for an order or a deleted order (in any case), and every admin hook. */
const orderFiles = adminSources.filter(
  (path) => /order|deleted/i.test(name(path)) || path.startsWith(`${hooksDir}${sep}`),
);

/** The files that must not read the device clock: the order files and the due flag. */
const clockFiles = [...new Set([...orderFiles, ...adminSources.filter((path) => name(path) === 'DueFlag.tsx')])];

/** A known, legitimate clock user may be listed here, each with its reason. */
const CLOCK_ALLOWED: Readonly<Record<string, string>> = {
  'modules/admin/hooks/useSessionCapWarning.ts':
    'Counts down to the session expiry, a moment in time and not the business day.',
};

describe('the shared comment stripper', () => {
  it('drops line and block comments but keeps the code around them', () => {
    expect(code('const a = 1; // note\nconst b = 2;')).toBe('const a = 1; \nconst b = 2;');
    expect(code('const a = /* note */ 1;')).toBe('const a =  1;');
  });

  it('keeps a // inside a string, so the rest of the line is still read', () => {
    expect(mentions(DEVICE_CLOCK, "const url = 'a // b'; const now = Date.now();")).toBe(true);
    expect(mentions(DEVICE_CLOCK, 'const url = "http://x"; const now = new Date();')).toBe(true);
  });

  it('reads the expressions inside a template literal and the code after it', () => {
    expect(mentions(DEVICE_CLOCK, 'const x = `day ${new Date()}`;')).toBe(true);
    expect(mentions(DEVICE_CLOCK, 'const x = `${a ? `${b}` : { c: 1 }.c}`; const now = Date.now();')).toBe(true);
    expect(mentions(DEVICE_CLOCK, 'const x = `a // b`; // Date.now()')).toBe(false);
  });

  it('leaves every real admin file outside a string or template at its end', () => {
    const open = adminSources.filter((path) => scan(readFileSync(path, 'utf8')).open);
    expect(open.map(where)).toEqual([]);
  });
});

describe('ORD-19 the public site never shows Estimated Profit or Order Expenses', () => {
  it('the guard flags a planted internal figure and leaves a comment about the rule alone', () => {
    expect(mentions(INTERNAL_FIGURES, '<dt>Estimated Profit</dt>')).toBe(true);
    expect(mentions(INTERNAL_FIGURES, "const label = 'Order Expenses';")).toBe(true);
    expect(mentions(INTERNAL_FIGURES, '// Order Expenses stay staff only\nconst x = 1;')).toBe(false);
  });

  it('finds neither word in any file of the public module or the public layout', () => {
    expect(publicFiles.length).toBeGreaterThan(5);
    expect(publicFiles).toContain(publicLayout);
    const hits = publicFiles.filter((path) => mentions(INTERNAL_FIGURES, readFileSync(path, 'utf8'))).map(where);
    expect(hits).toEqual([]);
  });
});

describe('T-08-46 no order screen renders text as HTML (dangerouslySetInnerHTML)', () => {
  it('the guard flags a planted dangerouslySetInnerHTML', () => {
    expect(mentions(RAW_HTML, '<p dangerouslySetInnerHTML={{ __html: order.notes }} />')).toBe(true);
    expect(mentions(RAW_HTML, '<p>{order.notes}</p>')).toBe(false);
  });

  it('covers the lowercase-named hooks and schemas, and finds none in any order or deleted file or hook', () => {
    expect(orderFiles.length).toBeGreaterThan(20);
    const names = orderFiles.map(name);
    for (const expected of ['useBusinessToday.ts', 'useOrderChildSave.ts', 'orderRules.ts', 'orderPaymentSchemas.ts']) {
      expect(names, expected).toContain(expected);
    }
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

  it('covers the due flag, the order pages, the windows and the hooks, and finds none in them', () => {
    const names = clockFiles.map(name);
    for (const expected of [
      'DueFlag.tsx',
      'OrdersPage.tsx',
      'OrderPage.tsx',
      'OrderFormPage.tsx',
      'OrderWindow.tsx',
      'useBusinessToday.ts',
      'orderRules.ts',
    ]) {
      expect(names, expected).toContain(expected);
      expect(existsSync(clockFiles[names.indexOf(expected)] ?? ''), expected).toBe(true);
    }
    expect(names.some((file) => file.endsWith('Modal.tsx'))).toBe(true);
    const hits = clockFiles
      .filter((path) => !(where(path) in CLOCK_ALLOWED) && mentions(DEVICE_CLOCK, readFileSync(path, 'utf8')))
      .map(where);
    expect(hits).toEqual([]);
  });
});
