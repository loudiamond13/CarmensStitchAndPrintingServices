// @ts-check
// Builds tests/fixtures/order-math-golden-vectors.json from the exact-rational oracle (WEB-07, D-09, C-25).
//
//   node web/scripts/gen-golden-vectors.mjs --write   regenerate the committed file
//   node web/scripts/gen-golden-vectors.mjs --check   exit 1 when the committed file differs from the oracle
//
// `--file <path>` replaces the target file (tests only). The xUnit and Vitest golden suites only ever READ the
// committed file, so they can run in parallel or repeatedly; regeneration is this separate, explicit command. Amounts
// are strings, so neither side parses a binary float from JSON. The output has LF line endings, a 2-space indent, a
// fixed case order and no timestamp, so the same oracle always writes the same bytes. Random cases come from a
// fixed-seed PRNG, never Math.random.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { OPERATION_ORDER, computeExpected, formatCentavos } from './golden-math.mjs';

/** @typedef {import('./golden-math.mjs').VectorInput} VectorInput */
/** @typedef {import('./golden-math.mjs').VectorItem} VectorItem */
/** @typedef {import('./golden-math.mjs').VectorDiscount} VectorDiscount */
/** @typedef {import('./golden-math.mjs').VectorExpected} VectorExpected */
/** @typedef {VectorInput & { category: string, note: string, id?: string | undefined }} CaseSpec */
/**
 * @typedef {{ id: string, category: string, note: string, items: VectorItem[], discounts: VectorDiscount[],
 *   payments: string[], expenses: string[], expected: VectorExpected }} VectorCase
 */

export const VECTOR_FILE = fileURLToPath(
  new URL('../../tests/fixtures/order-math-golden-vectors.json', import.meta.url),
);

/** Every category the file must cover (WEB-07); both golden suites assert the same list. */
export const CATEGORIES = Object.freeze([
  'midpoint',
  'ord-fixture',
  'percent-100',
  'zero-items',
  'multi-discount',
  'negative-balance',
  'large-value',
  'seeded-random',
]);

/**
 * @param {number} quantity
 * @param {string} unitPrice
 * @returns {VectorItem}
 */
const item = (quantity, unitPrice) => ({ quantity, unitPrice });
/**
 * @param {string} value
 * @returns {VectorDiscount}
 */
const percent = (value) => ({ kind: 'percentage', value });
/**
 * @param {string} value
 * @returns {VectorDiscount}
 */
const fixed = (value) => ({ kind: 'fixed', value });

/**
 * @param {string} category
 * @param {string} note
 * @param {Partial<VectorInput>} input
 * @param {string} [id] A fixed id; without one the case is numbered within its category.
 * @returns {CaseSpec}
 */
function spec(category, note, input, id) {
  return {
    id,
    category,
    note,
    items: input.items ?? [],
    discounts: input.discounts ?? [],
    payments: input.payments ?? [],
    expenses: input.expenses ?? [],
  };
}

/**
 * Explicit half-centavo midpoints (D-09, research Pitfall 13). Most total/percent pairs below were picked because the
 * unmodified App. D.1 round2 (Math.round(n * 100) / 100) rounds them the wrong way.
 * @returns {CaseSpec[]}
 */
function midpointCases() {
  /** @type {CaseSpec[]} */
  const cases = [
    spec(
      'midpoint',
      '7.5% of 17.00 = 1.275 rounds away from zero to 1.28 (D-09 example)',
      { items: [item(1, '17.00')], discounts: [percent('7.5')] },
      'midpoint-7-5-percent-of-17',
    ),
    spec('midpoint', '7.5% of 3 x 17.00 = 3.825 rounds away from zero to 3.83', {
      items: [item(3, '17.00')],
      discounts: [percent('7.5')],
    }),
    spec('midpoint', '2.5% of 23.00 = 0.575 rounds away from zero to 0.58', {
      items: [item(1, '23.00')],
      discounts: [percent('2.5')],
    }),
    spec('midpoint', '12.5% of 1.16 = 0.145 rounds away from zero to 0.15', {
      items: [item(1, '1.16')],
      discounts: [percent('12.5')],
    }),
    spec('midpoint', 'fixed 1.005 rounds away from zero to 1.01', {
      items: [item(1, '100.00')],
      discounts: [fixed('1.005')],
    }),
  ];
  /** @type {[string, string[]][]} */
  const wholePesoTotals = [
    ['2.5', ['41', '51', '87', '97', '169', '179', '189', '199']],
    ['7.5', ['29', '63', '111', '121', '131', '217', '227', '237']],
  ];
  for (const [rate, totals] of wholePesoTotals) {
    for (const total of totals) {
      cases.push(
        spec('midpoint', `${rate}% of whole-peso ${total}.00 is a half centavo; rounds away from zero`, {
          items: [item(1, `${total}.00`)],
          discounts: [percent(rate)],
        }),
      );
    }
  }
  /** @type {[string, string[]][]} */
  const centavoTotals = [
    ['5', ['2.90', '5.70', '11.30']],
    ['10', ['1.45', '2.85', '5.65']],
    ['12.5', ['2.28', '4.52', '4.60']],
    ['15', ['1.90', '4.10', '6.70']],
  ];
  for (const [rate, totals] of centavoTotals) {
    for (const total of totals) {
      cases.push(
        spec('midpoint', `${rate}% of centavo total ${total} is a half centavo; rounds away from zero`, {
          items: [item(1, total)],
          discounts: [percent(rate)],
        }),
      );
    }
  }
  for (const value of ['10.075', '0.145', '0.285', '1.255']) {
    cases.push(
      spec('midpoint', `fixed ${value} rounds away from zero`, {
        items: [item(1, '100.00')],
        discounts: [fixed(value)],
      }),
    );
  }
  cases.push(
    spec('midpoint', 'items total 3 x 0.335 = 1.005 rounds away from zero to 1.01 before any discount', {
      items: [item(3, '0.335')],
      discounts: [percent('10')],
    }),
    spec('midpoint', 'items total 1 x 10.075 rounds away from zero to 10.08', {
      items: [item(1, '10.075')],
      payments: ['10.08'],
    }),
  );
  return cases;
}

/**
 * Every spec seed order (CSPS-UI-SPEC section 12.2). ORD-2026-0148 passes even with the buggy round2 (Pitfall 13),
 * which is why the midpoint category exists.
 * @returns {CaseSpec[]}
 */
function ordFixtureCases() {
  return [
    spec(
      'ord-fixture',
      'ORD-2026-0148 (spec seed): balance 9,327.50, profit 15,262.50',
      {
        items: [item(15, '650.00'), item(15, '300.00'), item(2, '550.00'), item(15, '420.00'), item(1, '800.00')],
        discounts: [percent('5')],
        payments: ['10000.00', '2000.00'],
        expenses: ['3825.00', '1640.00', '600.00'],
      },
      'ord-2026-0148',
    ),
    spec(
      'ord-fixture',
      'ORD-2026-0151 (spec seed): 23,000 - 500 - 22,500 = 0, fully paid',
      {
        items: [item(20, '1150.00')],
        discounts: [fixed('500.00')],
        payments: ['12000.00', '10500.00'],
        expenses: ['7200.00', '2100.00'],
      },
      'ord-2026-0151',
    ),
    spec(
      'ord-fixture',
      'ORD-2026-0153 (spec seed)',
      { items: [item(12, '780.00')], payments: ['3000.00'] },
      'ord-2026-0153',
    ),
    spec('ord-fixture', 'ORD-2026-0155 (spec seed)', { items: [item(14, '720.00')] }, 'ord-2026-0155'),
    spec(
      'ord-fixture',
      'ORD-2026-0157 (spec seed)',
      { items: [item(40, '450.00')], payments: ['9000.00'], expenses: ['6400.00'] },
      'ord-2026-0157',
    ),
    spec(
      'ord-fixture',
      'ORD-2026-0159 (spec seed)',
      { items: [item(25, '1150.00')], payments: ['5000.00'] },
      'ord-2026-0159',
    ),
    spec(
      'ord-fixture',
      'ORD-2026-0142 (spec seed): fully paid',
      {
        items: [item(30, '690.00')],
        discounts: [fixed('1000.00')],
        payments: ['10000.00', '9700.00'],
        expenses: ['8900.00'],
      },
      'ord-2026-0142',
    ),
    spec('ord-fixture', 'ORD-2026-0139 (spec seed)', { items: [item(10, '850.00')] }, 'ord-2026-0139'),
  ];
}

/** @returns {CaseSpec[]} */
function percent100Cases() {
  return [
    spec('percent-100', '100% of 17.00: discount equals total', {
      items: [item(1, '17.00')],
      discounts: [percent('100')],
    }),
    spec('percent-100', '100% with a payment: balance is 0 minus paid', {
      items: [item(3, '17.00')],
      discounts: [percent('100')],
      payments: ['20.00'],
    }),
    spec('percent-100', '100% of ORD-2026-0151 items with a payment', {
      items: [item(20, '1150.00')],
      discounts: [percent('100')],
      payments: ['12000.00'],
    }),
    spec('percent-100', '100% with expenses: profit is minus expenses', {
      items: [item(7, '1.16')],
      discounts: [percent('100')],
      expenses: ['5.00'],
    }),
    spec('percent-100', '100% of the largest items total', {
      items: [item(1, '9999999999.99')],
      discounts: [percent('100')],
    }),
    spec('percent-100', '100% plus a fixed 50.00: discount above the total', {
      items: [item(2, '100.00')],
      discounts: [percent('100'), fixed('50.00')],
    }),
  ];
}

/** @returns {CaseSpec[]} */
function zeroItemsCases() {
  return [
    spec('zero-items', 'an empty order is not fully paid', {}, 'zero-items'),
    spec('zero-items', 'a fixed discount with no items', { discounts: [fixed('100.00')] }),
    spec('zero-items', 'a percentage discount of nothing is 0.00', { discounts: [percent('10')] }),
    spec('zero-items', 'a payment with no items is not fully paid', { payments: ['500.00'] }),
    spec('zero-items', 'an expense with no items', { expenses: ['250.00'] }),
    spec('zero-items', 'zero-quantity lines add nothing', {
      items: [item(0, '650.00'), item(0, '300.00')],
      discounts: [percent('5')],
      payments: ['100.00'],
    }),
  ];
}

/** @returns {CaseSpec[]} */
function multiDiscountCases() {
  /** @type {VectorItem[][]} */
  const orders = [
    [item(3, '17.00')],
    [item(5, '23.00')],
    [item(7, '1.16')],
    [item(15, '650.00'), item(15, '300.00')],
    [item(12, '780.00')],
    [item(1, '1.45')],
  ];
  /** @type {[string, VectorDiscount[]][]} */
  const sets = [
    ['5% and fixed 100.00', [percent('5'), fixed('100.00')]],
    ['2.5% and 7.5%', [percent('2.5'), percent('7.5')]],
    ['12.5% and fixed 1.005', [percent('12.5'), fixed('1.005')]],
    ['fixed 10.075, fixed 0.285 and 10%', [fixed('10.075'), fixed('0.285'), percent('10')]],
    ['0% and fixed 0.00 add nothing', [percent('0'), fixed('0.00')]],
  ];
  /** @type {CaseSpec[]} */
  const cases = [];
  for (const items of orders) {
    for (const [label, discounts] of sets) {
      cases.push(
        spec('multi-discount', `${label}, each rounded before the sum`, { items, discounts, payments: ['5.00'] }),
      );
    }
  }
  return cases;
}

/**
 * Arithmetic only: no business rule about overpayment or over-discount is implied.
 * @returns {CaseSpec[]}
 */
function negativeBalanceCases() {
  return [
    spec('negative-balance', 'a fixed discount above the total', {
      items: [item(1, '500.00')],
      discounts: [fixed('600.00')],
    }),
    spec('negative-balance', 'ORD-2026-0151 overpaid', {
      items: [item(20, '1150.00')],
      discounts: [fixed('500.00')],
      payments: ['12000.00', '12000.00'],
    }),
    spec('negative-balance', 'paid the full total despite a 2.5% discount', {
      items: [item(1, '23.00')],
      discounts: [percent('2.5')],
      payments: ['23.00'],
    }),
    spec('negative-balance', 'a rounded fixed 1.005 above a 1.00 total', {
      items: [item(1, '1.00')],
      discounts: [fixed('1.005')],
    }),
    spec('negative-balance', 'three payments above the total', {
      items: [item(2, '99.99')],
      payments: ['100.00', '50.00', '75.25'],
    }),
    spec('negative-balance', 'fixed 50.00 and 10% above a 40.00 total, expenses above it too', {
      items: [item(1, '40.00')],
      discounts: [fixed('50.00'), percent('10')],
      expenses: ['60.00'],
    }),
  ];
}

/**
 * Up to the largest items total, 9,999,999,999.99 (WEB-07 boundary).
 * @returns {CaseSpec[]}
 */
function largeValueCases() {
  return [
    spec('large-value', 'the largest items total', { items: [item(1, '9999999999.99')] }),
    spec('large-value', '7.5% of 9,999,999,999.99, paid and spent in full', {
      items: [item(1, '9999999999.99')],
      discounts: [percent('7.5')],
      payments: ['9999999999.99'],
      expenses: ['9999999999.99'],
    }),
    spec('large-value', '7.5% of 999,999,999.99', { items: [item(1, '999999999.99')], discounts: [percent('7.5')] }),
    spec('large-value', '2.5% of 999,999,999.99', { items: [item(1, '999999999.99')], discounts: [percent('2.5')] }),
    spec('large-value', '12.5% of 999,999,999.99', {
      items: [item(1, '999999999.99')],
      discounts: [percent('12.5')],
    }),
    spec('large-value', '3 x 333,333,333.33 at 33.33%', {
      items: [item(3, '333333333.33')],
      discounts: [percent('33.33')],
    }),
    spec('large-value', '9 x 111,111,111.11 paid in full', {
      items: [item(9, '111111111.11')],
      payments: ['999999999.99'],
    }),
    spec('large-value', '100,000 x 9,999.99 at 15%', {
      items: [item(100000, '9999.99')],
      discounts: [percent('15')],
    }),
    spec('large-value', '99,999 x 10,000.00 with a fixed 0.005', {
      items: [item(99999, '10000.00')],
      discounts: [fixed('0.005')],
    }),
    spec('large-value', 'a 999,999,999.985 line rounds to 999,999,999.99', { items: [item(1, '999999999.985')] }),
    spec('large-value', 'two large lines, three discounts, payments and expenses', {
      items: [item(1, '5000000000.00'), item(1, '4999999999.99')],
      discounts: [percent('7.5'), percent('5'), fixed('1000000.00')],
      payments: ['9000000000.00'],
      expenses: ['500000000.00'],
    }),
    spec('large-value', 'paid twice the largest total', {
      items: [item(1, '9999999999.99')],
      payments: ['9999999999.99', '9999999999.99'],
    }),
  ];
}

/**
 * mulberry32: a fixed-seed 32-bit PRNG, so regeneration is reproducible (never Math.random).
 * @param {number} seed
 * @returns {() => number} Uniform values in [0, 1).
 */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANDOM_SEED = 20261008;
const TOTAL_CASES = 220;
const RANDOM_PERCENTS = ['2.5', '5', '7.5', '10', '12.5', '15', '20', '25', '33.33', '50'];

/**
 * @param {number} count
 * @returns {CaseSpec[]}
 */
function seededRandomCases(count) {
  const next = mulberry32(RANDOM_SEED);
  /** @type {(lo: number, hi: number) => number} */
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  /** @type {(lo: number, hi: number) => string} */
  const money = (lo, hi) => formatCentavos(BigInt(int(lo, hi)));
  /** @type {(n: number, make: () => string) => string[]} */
  const many = (n, make) => Array.from({ length: n }, make);
  /** @type {CaseSpec[]} */
  const cases = [];
  for (let draw = 1; draw <= count; draw++) {
    const items = Array.from({ length: int(1, 4) }, () => {
      const centavos = int(100, 500000);
      const wholePesos = next() < 0.5;
      return item(int(0, 60), formatCentavos(BigInt(wholePesos ? centavos - (centavos % 100) : centavos)));
    });
    const discounts = Array.from({ length: int(0, 3) }, () => {
      if (next() < 0.6) {
        return percent(RANDOM_PERCENTS[int(0, RANDOM_PERCENTS.length - 1)] ?? '5');
      }
      // One fixed discount in ten carries a third decimal 5, a half centavo the rounding must resolve.
      return fixed(next() < 0.1 ? `${money(1, 200000)}5` : money(1, 200000));
    });
    cases.push(
      spec('seeded-random', `seeded random case (mulberry32 seed ${String(RANDOM_SEED)}, draw ${String(draw)})`, {
        items,
        discounts,
        payments: many(int(0, 3), () => money(100, 3000000)),
        expenses: many(int(0, 3), () => money(100, 1000000)),
      }),
    );
  }
  return cases;
}

/**
 * Gives each case its fixed id, or numbers it within its category in generation order (midpoint-001, ...), so ids
 * stay stable as long as new cases are appended.
 * @param {CaseSpec[]} specs
 * @returns {VectorCase[]}
 */
function assignIds(specs) {
  /** @type {Map<string, number>} */
  const counters = new Map();
  return specs.map((s) => {
    const { category, note, items, discounts, payments, expenses } = s;
    let id = s.id;
    if (id === undefined) {
      const n = (counters.get(category) ?? 0) + 1;
      counters.set(category, n);
      id = `${category}-${String(n).padStart(3, '0')}`;
    }
    return {
      id,
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

/** @returns {VectorCase[]} Every case, in a fixed order. */
export function buildCases() {
  const fixedCases = [
    ...midpointCases(),
    ...ordFixtureCases(),
    ...percent100Cases(),
    ...zeroItemsCases(),
    ...multiDiscountCases(),
    ...negativeBalanceCases(),
    ...largeValueCases(),
  ];
  return assignIds([...fixedCases, ...seededRandomCases(TOTAL_CASES - fixedCases.length)]);
}

/**
 * @param {VectorCase[]} cases
 * @returns {string} The vector file's exact text.
 */
export function renderVectorFile(cases) {
  return `${JSON.stringify({ version: 1, operationOrder: OPERATION_ORDER, cases }, null, 2)}\n`;
}

/**
 * @param {string} actual The file as found.
 * @param {string} expected The generator output.
 * @returns {string | undefined} The first differing line, or undefined when they are equal.
 */
export function firstDifference(actual, expected) {
  if (actual === expected) {
    return undefined;
  }
  const lines = (/** @type {string} */ text) => (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
  const found = lines(actual);
  const wanted = lines(expected);
  const index = wanted.findIndex((line, i) => line !== found[i]);
  if (index === -1 && found.length === wanted.length) {
    return 'the final newline differs';
  }
  const at = index === -1 ? wanted.length : index;
  const foundLine = found[at];
  const wantedLine = wanted[at];
  const describe = (/** @type {string | undefined} */ line) =>
    line === undefined ? 'the end of the file' : JSON.stringify(line);
  return `line ${String(at + 1)}: expected ${describe(wantedLine)} but found ${describe(foundLine)}`;
}

/**
 * The CLI: writes or checks the vector file.
 * @returns {number} The exit code.
 */
function main() {
  const { values } = parseArgs({
    options: {
      write: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      file: { type: 'string', default: VECTOR_FILE },
    },
  });
  if (values.write === values.check) {
    console.error('Use exactly one of --write or --check.');
    return 1;
  }
  const cases = buildCases();
  const text = renderVectorFile(cases);
  if (values.write) {
    writeFileSync(values.file, text);
    console.log(`Wrote ${String(cases.length)} cases to ${values.file}.`);
    return 0;
  }
  const committed = existsSync(values.file) ? readFileSync(values.file, 'utf8') : '';
  const difference = firstDifference(committed, text);
  if (difference === undefined) {
    console.log(`${values.file} matches the oracle (${String(cases.length)} cases).`);
    return 0;
  }
  console.error(`${values.file} differs from the oracle.`);
  console.error(`First difference: ${difference}`);
  console.error('Run `node web/scripts/gen-golden-vectors.mjs --write` and commit the result.');
  return 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
