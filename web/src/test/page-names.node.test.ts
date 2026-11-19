// @vitest-environment node
// D-69, D-75. The web page names equal tests/fixtures/page-names.json, the file the server PageNames test is also checked against, so
// the Visitor Stats page and the CSV export cannot name a page two ways.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VISITOR_STATS_COPY } from '../modules/admin/visitorStatsCopy';

interface SharedPage {
  key: string;
  name: string;
}

const shared = (
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/page-names.json'), 'utf8')) as {
    pages: SharedPage[];
  }
).pages;

describe('the web page names and the shared file (D-69, D-75)', () => {
  it('has the same page keys', () => {
    expect(Object.keys(VISITOR_STATS_COPY.pages).sort()).toEqual(shared.map((page) => page.key).sort());
  });

  it.each(shared)('names $key "$name"', ({ key, name }) => {
    expect(VISITOR_STATS_COPY.pages[key]).toBe(name);
  });

  it('holds the eight pages and no Cookie Policy', () => {
    expect(shared).toHaveLength(8);
    expect(Object.keys(VISITOR_STATS_COPY.pages)).not.toContain('cookies');
  });
});
