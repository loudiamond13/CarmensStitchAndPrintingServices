// @ts-check
// Exact-rational oracle for the order-math golden vectors (WEB-07, D-09). Inert until implemented.

/** @typedef {{ quantity: number, unitPrice: string }} VectorItem */
/** @typedef {{ kind: 'fixed' | 'percentage', value: string }} VectorDiscount */
/** @typedef {{ items: VectorItem[], discounts: VectorDiscount[], payments: string[], expenses: string[] }} VectorInput */
/**
 * @typedef {{ total: string, discount: string, paid: string, balance: string, expenses: string, profit: string,
 *   fullyPaid: boolean }} VectorExpected
 */

export const OPERATION_ORDER = '';

/**
 * @param {bigint} centavos
 * @returns {string}
 */
export function formatCentavos(centavos) {
  return String(centavos);
}

/**
 * @param {VectorInput} input
 * @returns {VectorExpected}
 */
export function computeExpected(input) {
  void input;
  return { total: '', discount: '', paid: '', balance: '', expenses: '', profit: '', fullyPaid: false };
}
