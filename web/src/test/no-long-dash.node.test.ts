// @vitest-environment node
// Guards the owner's no-long-dash rule (OR-4): web/src holds no em dash, en dash or other long dash.
// The minus sign U+2212 stays allowed because negative money uses it (D-09).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../', import.meta.url));
const GENERATED = join(srcDir, 'types', 'api.generated.ts');

// U+2012 figure dash, U+2013 en dash, U+2014 em dash, U+2015 horizontal bar, U+2E3A and U+2E3B two- and
// three-em dash, U+FE31 and U+FE32 vertical forms, U+FE58 small em dash.
const LONG_DASH = /[\u2012\u2013\u2014\u2015\u2E3A\u2E3B\uFE31\uFE32\uFE58]/;

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

describe('web/src has no long dash (OR-4)', () => {
  it('finds no long dash in any source file except the generated API types', () => {
    const hits = filesUnder(srcDir)
      .filter((path) => path !== GENERATED)
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split(/\r?\n/)
          .flatMap((line, index) =>
            LONG_DASH.test(line) ? [`${relative(srcDir, path).replaceAll('\\', '/')}:${String(index + 1)}`] : [],
          ),
      );
    expect(hits).toEqual([]);
  });
});
