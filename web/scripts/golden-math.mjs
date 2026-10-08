// @ts-check
// Exact-rational oracle for the order-math golden vectors (WEB-07, D-09). RED placeholder: not implemented yet.

/** @typedef {{ quantity: string, unitPrice: string }} VectorItem */
/** @typedef {{ type: 'fixed' | 'percentage', value: string }} VectorDiscount */
/** @typedef {{ items: VectorItem[], discounts: VectorDiscount[], payments: string[], expenses: string[] }} VectorInput */
/**
 * @typedef {{ total: string, discount: string, paid: string, balance: string, expenses: string, profit: string,
 *   fullyPaid: boolean }} VectorExpected
 */

/**
 * @param {VectorInput} input
 * @returns {VectorExpected}
 */
export function computeExpected(input) {
  return {
    total: '',
    discount: '',
    paid: '',
    balance: '',
    expenses: '',
    profit: '',
    fullyPaid: input.items.length < 0,
  };
}

/**
 * @param {bigint} centavos
 * @returns {string}
 */
export function formatCentavos(centavos) {
  return centavos < 0n ? '' : '';
}
