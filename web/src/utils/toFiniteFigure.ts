/** Plain decimal text only: an optional minus, digits, an optional fraction. No hex, exponent, plus sign or bare point. */
const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * A figure from the API (generated as `number | string`) as a finite number. Text that is not a plain decimal (blank, words, hex,
 * exponent), `null`, `NaN` and `Infinity` give `null`, so the caller can refuse the whole answer instead of drawing a wrong figure.
 */
export function toFiniteFigure(value: unknown): number | null {
  const figure =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && DECIMAL.test(value.trim())
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(figure) ? figure : null;
}
