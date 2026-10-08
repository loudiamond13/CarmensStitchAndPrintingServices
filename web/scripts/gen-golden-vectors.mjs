// @ts-check
// Writes tests/fixtures/order-math-golden-vectors.json from the exact-rational oracle (WEB-07, D-09, C-25).
//
//   node web/scripts/gen-golden-vectors.mjs           regenerate the committed file
//   node web/scripts/gen-golden-vectors.mjs --check   exit 1 when the committed file differs from the oracle
//
// The xUnit and Vitest golden suites only ever READ the committed file, so they can run in parallel; regeneration is
// this separate command. Amounts are strings, so neither side parses a binary float from JSON. Output is sorted by id,
// LF line endings, 2-space indent, and has no timestamp, so the same oracle always writes the same bytes.
import { readFileSync, writeFileSync } from 'node:fs';
import { OPERATION_ORDER, computeExpected } from './golden-math.mjs';

/** @typedef {import('./golden-math.mjs').VectorInput} VectorInput */
/** @typedef {import('./golden-math.mjs').VectorItem} VectorItem */
/** @typedef {import('./golden-math.mjs').VectorDiscount} VectorDiscount */
/** @typedef {import('./golden-math.mjs').VectorExpected} VectorExpected */
/** @typedef {VectorInput & { category: string, note: string }} CaseSpec */
/**
 * @typedef {{ id: string, category: string, note: string, items: VectorItem[], discounts: VectorDiscount[],
 *   payments: string[], expenses: string[], expected: VectorExpected }} VectorCase
 */

export const VECTOR_FILE = new URL('../../tests/fixtures/order-math-golden-vectors.json', import.meta.url);

/**
 * @param {string} quantity
 * @param {string} unitPrice
 * @returns {VectorItem}
 */
const item = (quantity, unitPrice) => ({ quantity, unitPrice });
/**
 * @param {string} value
 * @returns {VectorDiscount}
 */
const percent = (value) => ({ type: 'percentage', value });
/**
 * @param {string} value
 * @returns {VectorDiscount}
 */
const fixed = (value) => ({ type: 'fixed', value });

/**
 * @param {string} category
 * @param {string} note
 * @param {Partial<VectorInput>} input
 * @returns {CaseSpec}
 */
function spec(category, note, input) {
  return {
    category,
    note,
    items: input.items ?? [],
    discounts: input.discounts ?? [],
    payments: input.payments ?? [],
    expenses: input.expenses ?? [],
  };
}

/** @returns {CaseSpec[]} */
function midpointCases() {
  return [
    spec('midpoint', '7.5% of 3 x 17.00 = 3.825 rounds away from zero to 3.83', {
      items: [item('3', '17.00')],
      discounts: [percent('7.5')],
    }),
    spec('midpoint', '7.5% of 17.00 = 1.275 rounds away from zero to 1.28 (D-09 example)', {
      items: [item('1', '17.00')],
      discounts: [percent('7.5')],
    }),
    spec('midpoint', '2.5% of 23.00 = 0.575 rounds away from zero to 0.58', {
      items: [item('1', '23.00')],
      discounts: [percent('2.5')],
    }),
    spec('midpoint', '12.5% of 1.16 = 0.145 rounds away from zero to 0.15', {
      items: [item('1', '1.16')],
      discounts: [percent('12.5')],
    }),
    spec('midpoint', 'fixed 1.005 rounds away from zero to 1.01', {
      items: [item('1', '100.00')],
      discounts: [fixed('1.005')],
    }),
  ];
}

/** @returns {CaseSpec[]} */
function ordFixtureCases() {
  return [
    spec('ord-fixture', 'ORD-2026-0151 (spec seed): 23,000 - 500 - 22,500 = 0, fully paid', {
      items: [item('20', '1150.00')],
      discounts: [fixed('500.00')],
      payments: ['12000.00', '10500.00'],
      expenses: ['7200.00', '2100.00'],
    }),
  ];
}

/**
 * Numbers each category's cases in generation order (midpoint-001, midpoint-002, ...), so ids stay stable as long as
 * new cases are appended.
 * @param {CaseSpec[]} specs
 * @returns {VectorCase[]}
 */
function assignIds(specs) {
  /** @type {Map<string, number>} */
  const counters = new Map();
  return specs.map((s) => {
    const n = (counters.get(s.category) ?? 0) + 1;
    counters.set(s.category, n);
    const { category, note, items, discounts, payments, expenses } = s;
    return {
      id: `${category}-${String(n).padStart(3, '0')}`,
      category,
      note,
      items,
      discounts,
      payments,
      expenses,
      expected: computeExpected({ items, discounts, payments, expenses }),
    };
  });
}

/** @returns {VectorCase[]} Every case, sorted by id. */
export function buildCases() {
  return assignIds([...midpointCases(), ...ordFixtureCases()]).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * @param {VectorCase[]} cases
 * @returns {string} The vector file's exact text.
 */
export function renderVectorFile(cases) {
  return `${JSON.stringify({ schemaVersion: 1, operationOrder: OPERATION_ORDER, cases }, null, 2)}\n`;
}

const cases = buildCases();
const text = renderVectorFile(cases);
if (process.argv.includes('--check')) {
  /** @type {string} */
  let committed;
  try {
    committed = readFileSync(VECTOR_FILE, 'utf8');
  } catch {
    committed = '';
  }
  if (committed !== text) {
    console.error(
      'tests/fixtures/order-math-golden-vectors.json differs from the oracle. Run: node web/scripts/gen-golden-vectors.mjs',
    );
    process.exit(1);
  }
  console.log('order-math-golden-vectors.json matches the oracle.');
} else {
  writeFileSync(VECTOR_FILE, text);
  console.log(`Wrote ${String(cases.length)} cases to tests/fixtures/order-math-golden-vectors.json`);
}
