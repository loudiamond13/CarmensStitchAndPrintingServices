/**
 * A figure from the API (generated as `number | string`) as a finite number. Blank text, words, `null`, `NaN` and `Infinity` give
 * `null`, so the caller can refuse the whole answer instead of drawing a wrong figure.
 */
export function toFiniteFigure(value: unknown): number | null {
  const figure =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(figure) ? figure : null;
}
