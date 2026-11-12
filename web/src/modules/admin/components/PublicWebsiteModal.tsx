// STUB for the RED commit of plan 11-27 task 1; replaced in GREEN.
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface PublicWebsiteModalProps {
  order: OrderDetailResponse;
  open?: boolean;
  onClose: () => void;
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

export function PublicWebsiteModal({ order, onClose }: PublicWebsiteModalProps) {
  void order;
  void onClose;
  return null;
}
