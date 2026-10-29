// The due date and its flag (ORD-11, D-36 to D-38). `today` is the server's business date, never the device clock (D-59).

export interface DueFlagProps {
  dueDate: string | null;
  status: string;
  today: string;
  layout?: 'inline' | 'stacked';
}

export function DueFlag(_props: DueFlagProps) {
  return null;
}
