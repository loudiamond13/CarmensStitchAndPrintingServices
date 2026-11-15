// @vitest-environment node
// Cleanup in a `finally` must not throw over the real failure. The lock-taking order specs delete their orders there, so they call
// `deleteOrderQuietly`, which records a failed delete as an annotation, and never `deleteOrderThroughApi`, which throws.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const e2eDirectory = path.join(fileURLToPath(new URL('..', import.meta.url)), 'e2e');
const SPECS = ['order-public-website.spec.ts', 'site-content-sweep.spec.ts'];

/** The text of every `finally { ... }` block in a source file, found by counting braces. */
function finallyBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(/finally\s*\{/g)) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (depth > 0 && index < source.length) {
      const character = source[index];
      depth += character === '{' ? 1 : character === '}' ? -1 : 0;
      index += 1;
    }
    blocks.push(source.slice(start, index - 1));
  }
  return blocks;
}

describe('e2e cleanup in a finally block', () => {
  it.each(SPECS)('%s deletes orders with the quiet helper, which cannot hide the real failure', (file) => {
    const blocks = finallyBlocks(readFileSync(path.join(e2eDirectory, file), 'utf8'));
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.filter((block) => block.includes('deleteOrderThroughApi('))).toEqual([]);
    expect(blocks.some((block) => block.includes('deleteOrderQuietly('))).toBe(true);
  });

  it('finds the blocks of a file, nested braces included', () => {
    const source = 'try { a(); } finally { if (x) { b(); } c(); } try { d(); } finally { e(); }';
    expect(finallyBlocks(source)).toEqual([' if (x) { b(); } c(); ', ' e(); ']);
  });
});
