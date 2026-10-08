// @ts-check
// Exact-rational oracle for the order-math golden vectors (WEB-07, D-09, C-25).
// It shares no code with either implementation under test (Csps.Domain.Orders.OrderMath and web/src/lib/csps.ts):
// every amount is a decimal string parsed into a BigInt fraction, so no binary float is ever involved.
//
// Pinned operation order (the same text is the vector file's `operationOrder`):
//   round the items total; round each discount; sum the discounts and round the sum; subtract (D-09).
// Rounding is half away from zero at the centavo, the server's MidpointRounding.AwayFromZero.

/** @typedef {{ quantity: number, unitPrice: string }} VectorItem */
/** @typedef {{ kind: 'fixed' | 'percentage', value: string }} VectorDiscount */
/** @typedef {{ items: VectorItem[], discounts: VectorDiscount[], payments: string[], expenses: string[] }} VectorInput */
/**
 * @typedef {{ total: string, discount: string, paid: string, balance: string, expenses: string, profit: string,
 *   fullyPaid: boolean }} VectorExpected
 */
/** An exact fraction num / den with den > 0. @typedef {{ num: bigint, den: bigint }} Fraction */

/** The one documented operation order, quoted by both implementations (D-09). */
export const OPERATION_ORDER =
  'round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)';

const PLAIN_DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const ZERO = { num: 0n, den: 1n };

/**
 * Parses a plain decimal string ("17.00", "7.5", "-3") exactly. Anything else (exponents, grouping, blanks, a plus
 * sign) throws, so a malformed vector can never be read as a different number.
 * @param {string} text
 * @returns {Fraction}
 */
function parseDecimal(text) {
  const match = PLAIN_DECIMAL.exec(text);
  if (match === null) {
    throw new Error(`Not a decimal amount: ${JSON.stringify(text)}`);
  }
  const [, sign = '', whole = '', fraction = ''] = match;
  const magnitude = BigInt(whole + fraction);
  return { num: sign === '-' ? -magnitude : magnitude, den: 10n ** BigInt(fraction.length) };
}

/**
 * @param {number} quantity
 * @returns {Fraction}
 */
function parseQuantity(quantity) {
  if (!Number.isSafeInteger(quantity)) {
    throw new Error(`Not a whole quantity: ${String(quantity)}`);
  }
  return { num: BigInt(quantity), den: 1n };
}

/**
 * @param {Fraction} a
 * @param {Fraction} b
 * @returns {Fraction}
 */
function add(a, b) {
  return { num: a.num * b.den + b.num * a.den, den: a.den * b.den };
}

/**
 * @param {Fraction} a
 * @param {Fraction} b
 * @returns {Fraction}
 */
function multiply(a, b) {
  return { num: a.num * b.num, den: a.den * b.den };
}

/**
 * Rounds a fraction of pesos to whole centavos, half away from zero.
 * @param {Fraction} value
 * @returns {bigint}
 */
function toCentavos(value) {
  const negative = value.num < 0n;
  const scaled = (negative ? -value.num : value.num) * 100n;
  let centavos = scaled / value.den;
  if ((scaled % value.den) * 2n >= value.den) {
    centavos += 1n;
  }
  return negative ? -centavos : centavos;
}

/**
 * @param {readonly string[]} amounts
 * @returns {bigint}
 */
function sumToCentavos(amounts) {
  return toCentavos(amounts.map(parseDecimal).reduce(add, ZERO));
}

/**
 * Writes centavos as a two-decimal string with an ASCII minus ("-732.50"), the vector file's amount format.
 * @param {bigint} centavos
 * @returns {string}
 */
export function formatCentavos(centavos) {
  const negative = centavos < 0n;
  const digits = (negative ? -centavos : centavos).toString().padStart(3, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/**
 * The expected totals for one vector, in the pinned operation order (D-09).
 * @param {VectorInput} input
 * @returns {VectorExpected}
 */
export function computeExpected(input) {
  // 1. Round the items total.
  const total = toCentavos(
    input.items.map((item) => multiply(parseQuantity(item.quantity), parseDecimal(item.unitPrice))).reduce(add, ZERO),
  );
  const totalPesos = { num: total, den: 100n };

  // 2. Round each discount: a fixed value, or the rounded items total x percent / 100.
  const discounts = input.discounts.map((discount) => {
    const value = parseDecimal(discount.value);
    return discount.kind === 'percentage'
      ? toCentavos(multiply(multiply(totalPesos, value), { num: 1n, den: 100n }))
      : toCentavos(value);
  });

  // 3. Sum the discounts and round the sum (whole centavos already, so the rounding is exact).
  const discount = toCentavos({ num: discounts.reduce((sum, amount) => sum + amount, 0n), den: 100n });

  const paid = sumToCentavos(input.payments);
  const expenses = sumToCentavos(input.expenses);

  // 4. Subtract.
  const balance = total - discount - paid;
  const profit = total - discount - expenses;

  return {
    total: formatCentavos(total),
    discount: formatCentavos(discount),
    paid: formatCentavos(paid),
    balance: formatCentavos(balance),
    expenses: formatCentavos(expenses),
    profit: formatCentavos(profit),
    fullyPaid: total > 0n && balance <= 0n,
  };
}
