// @vitest-environment node
// The From and To toolbar fields are wider than a plain toolbar field, so the date box and the readable date fit side
// by side. Tailwind resolves one property by rule order, not class order, and jsdom runs no container query, so these
// tests read the generated CSS: each date width comes after the plain toolbar width it replaces, and phones give each
// date field its own row. A node test, because the class gate reads app.css with node:fs.
import { describe, expect, it } from 'vitest';
import { fieldClasses } from '@/components/forms/field.recipe';
import { buildCss } from '../../../../scripts/class-gate.mjs';
import { expensesDateFieldClasses } from './expenses.recipe';

const BASE = fieldClasses.split(/\s+/).filter(Boolean);
const DATE = expensesDateFieldClasses.split(/\s+/).filter(Boolean);
const css = await buildCss([...BASE, ...DATE]);

/** Where the rule for this exact class starts (-1 when absent). */
function ruleAt(token: string): number {
  const selector = `.${token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
  let from = css.indexOf(selector);
  while (from >= 0 && /[\w\\-]/.test(css.charAt(from + selector.length))) {
    from = css.indexOf(selector, from + 1);
  }
  return from;
}

const plain = (variant: string) => BASE.find((token) => token.startsWith(variant)) ?? '';
const wide = (variant: string) => DATE.find((token) => token.startsWith(variant)) ?? '';

describe('expensesDateFieldClasses (D-60, D-61)', () => {
  it('widens a toolbar date field on desktop and tablets, after the plain toolbar width so it wins', () => {
    for (const variant of ['in-data-', 'pg-tablet:in-data-']) {
      expect(wide(variant), variant).toContain('flex-[');
      expect(ruleAt(wide(variant)), variant).toBeGreaterThan(ruleAt(plain(variant)));
      expect(ruleAt(plain(variant)), variant).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives each date field its own full row on phones, after the plain phone width so it wins (D-61)', () => {
    const phone = wide('pg-phone:');

    expect(phone).toContain('basis-full');
    expect(ruleAt(phone)).toBeGreaterThan(ruleAt(plain('pg-phone:')));
    expect(ruleAt(plain('pg-phone:'))).toBeGreaterThanOrEqual(0);
  });
});
