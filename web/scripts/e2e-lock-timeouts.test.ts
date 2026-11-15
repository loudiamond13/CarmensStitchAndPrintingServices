// @vitest-environment node
// A spec that takes the site content lock can wait up to 7 minutes for it (site-content-lock.ts), so its test timeout must be 8
// minutes or more. A shorter timeout fires first with a generic message and leaves the lock request polling in the background.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIN_TIMEOUT_MS = 480_000;
const e2eDirectory = path.join(fileURLToPath(new URL('..', import.meta.url)), 'e2e');

const number = (text: string): number => Number(text.replaceAll('_', ''));

/** The test blocks of a spec file that call `withSiteContentLock` and have a test timeout under 8 minutes. */
function shortLockTests(source: string): string[] {
  const fileTimeout = /test\.describe\.configure\(\{\s*timeout:\s*([\d_]+)/.exec(source);
  if (fileTimeout?.[1] !== undefined && number(fileTimeout[1]) >= MIN_TIMEOUT_MS) {
    return [];
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

describe('e2e specs that take the site content lock', () => {
  it('allow each test 8 minutes, longer than the 7 minute lock wait', () => {
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
  });
});
