// RED stub (plan 05-33): replaced in the GREEN commit.
export const AUDIT_RANGES: readonly string[] = [];
export const DEFAULT_AUDIT_RANGE = 'last-7-days';

export function keptFloor(today: string): string {
  return today === '' ? today : '';
}

export function resolveAuditRange(_state: { range: string; from: string | null; to: string | null }, today: string) {
  return { from: '', to: today === '' ? today : '' };
}
