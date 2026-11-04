// Stand-in so the description tests fail on their assertions (plan 09-21, RED). The real window follows.
import type { OrderWindowBanner } from '@/modules/admin/hooks/useOrderChildSave';

export interface PhotoDescriptionModalProps {
  open?: boolean | undefined;
  mode: 'draft' | 'live';
  orderLabel: string;
  position: number;
  total: number;
  initial: string;
  maxLength: number;
  onSave: (text: string) => void | Promise<void>;
  onClose: () => void;
  banner?: OrderWindowBanner | null | undefined;
}

export function PhotoDescriptionModal(_props: PhotoDescriptionModalProps) {
  return null;
}
