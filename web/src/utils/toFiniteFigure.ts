// RED stub (plan 10-13): replaced in the GREEN commit.
export function toFiniteFigure(value: unknown): number | null {
  return typeof value === 'symbol' ? 0 : null;
}
