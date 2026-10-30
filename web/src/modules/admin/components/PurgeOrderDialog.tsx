// PurgeOrderDialog (not built yet).
export interface PurgeOrderDialogProps {
  orderId: string;
  number: string;
  team: string | null;
  customer: string;
  open: boolean;
  onClose: () => void;
  onDone: (outcome: 'purged' | 'gone') => void;
}

export function PurgeOrderDialog(props: PurgeOrderDialogProps) {
  return props.open ? null : null;
}
