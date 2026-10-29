// Due-date day counts and flag states (ORD-11, D-36 to D-38). Plain calendar-date text in, whole days out: no time zone.

export type DueFlagKind = 'none' | 'date-only' | 'days-left' | 'tomorrow' | 'today' | 'overdue';

export interface DueFlagState {
  readonly kind: DueFlagKind;
  readonly days: number;
}

export function dueDays(_today: string, _dueDate: string): number {
  return 0;
}

export function dueFlagState(_today: string, _dueDate: string | null, _status: string): DueFlagState {
  return { kind: 'none', days: 0 };
}
