// @vitest-environment node
// A spec that takes the site content lock can wait up to 6 minutes for it (site-content-lock.ts), so its test timeout must be 8
// minutes or more. A shorter timeout fires first with a generic message and leaves the lock request polling in the background.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIN_TIMEOUT_MS = 480_000;
const e2eDirectory = path.join(fileURLToPath(new URL('..', import.meta.url)), 'e2e');

const number = (text: string): number => Number(text.replaceAll('_', ''));

/** True when a hook adds 8 minutes to the test timeout only while the demo seed is still to run. */
function extendsTimeoutBeforeSeed(source: string): boolean {
  const extension =
    /if\s*\(\s*!isDemoSeeded\(\)\s*\)\s*\{?\s*testInfo\.setTimeout\(\s*testInfo\.timeout\s*\+\s*([\d_]+)\s*\)/.exec(
      source,
    );
  return extension?.[1] !== undefined && number(extension[1]) >= MIN_TIMEOUT_MS;
}

/** The test blocks of a spec file that take the site content lock and have a test timeout under 8 minutes. */
function shortLockTests(source: string): string[] {
  const fileTimeout = /test\.describe\.configure\(\{\s*timeout:\s*([\d_]+)/.exec(source);
  if (fileTimeout?.[1] !== undefined && number(fileTimeout[1]) >= MIN_TIMEOUT_MS) {
    return [];
  }
  // The shared seed in a hook takes the lock for the first test of a worker, so that test must get 8 minutes more: from a file-wide
  // timeout, or from the hook itself when `isDemoSeeded()` says the seed is still to come.
  if (source.includes('ensureDemoSiteContent(') && !extendsTimeoutBeforeSeed(source)) {
    return [
      '(a hook calls ensureDemoSiteContent and neither a file-wide timeout nor a timeout extension before the seed gives 8 minutes)',
    ];
  }
  const blocks = source.split(/^\s*test(?:\.describe(?:\.serial|\.parallel)?)?\(/m).slice(1);
  return blocks
    .filter((block) => block.includes('withSiteContentLock('))
    .filter((block) => {
      const own = /test\.setTimeout\(([\d_]+)\)/.exec(block);
      return own?.[1] === undefined || number(own[1]) < MIN_TIMEOUT_MS;
    })
    .map((block) => block.slice(0, 90).replaceAll(/\s+/g, ' '));
}

/** The lock wait in site-content-lock.ts, in milliseconds. */
function lockWaitMs(): number {
  const source = readFileSync(path.join(e2eDirectory, 'site-content-lock.ts'), 'utf8');
  const wait = /waitLimitMs:\s*(\d+)\s*\*\s*60\s*\*\s*1000/.exec(source);
  return wait?.[1] === undefined ? Number.NaN : Number(wait[1]) * 60 * 1000;
}

describe('e2e specs that take the site content lock', () => {
  it('leave at least 2 minutes of the 8 minute budget for setup after the lock wait (D-125)', () => {
    expect(MIN_TIMEOUT_MS - lockWaitMs()).toBeGreaterThanOrEqual(2 * 60 * 1000);
  });

  it('allow each test 8 minutes, longer than the 6 minute lock wait', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(e2eDirectory).filter((name) => name.endsWith('.spec.ts'))) {
      for (const block of shortLockTests(readFileSync(path.join(e2eDirectory, file), 'utf8'))) {
        offenders.push(`${file}: ${block}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('finds a lock test with a short timeout and passes one with a long timeout or a file-wide timeout', () => {
    const short =
      "test('a', async () => {\n  test.setTimeout(240_000);\n  await withSiteContentLock(async () => {});\n});";
    const long =
      "test('a', async () => {\n  test.setTimeout(480_000);\n  await withSiteContentLock(async () => {});\n});";
    const wide = `test.describe.configure({ timeout: 480_000 });\ntest('a', async () => {\n  await withSiteContentLock(async () => {});\n});`;
    expect(shortLockTests(short)).toHaveLength(1);
    expect(shortLockTests(long)).toEqual([]);
    expect(shortLockTests(wide)).toEqual([]);
    expect(shortLockTests('test.beforeEach(async () => { await ensureDemoSiteContent(request); });')).toHaveLength(1);
    expect(
      shortLockTests(
        'test.describe.configure({ timeout: 480_000 }); test.beforeEach(async () => { await ensureDemoSiteContent(request); });',
      ),
    ).toEqual([]);
  });

  it('passes a seed hook that extends the timeout only before the seed, and fails one that extends it by less', () => {
    const hook = (extra: string): string =>
      `test.beforeEach(async ({ request }, testInfo) => {
  if (!isDemoSeeded()) testInfo.setTimeout(testInfo.timeout + ${extra});
  await ensureDemoSiteContent(request);
});`;
    expect(shortLockTests(hook('480_000'))).toEqual([]);
    expect(shortLockTests(hook('60_000'))).toHaveLength(1);
    expect(
      shortLockTests('test.beforeEach(async ({ request }) => { await ensureDemoSiteContent(request); });'),
    ).toHaveLength(1);
  });
});
