// STUB for the RED commit of plan 11-27 task 1; replaced in GREEN.
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface PublicWebsiteCardProps {
  order: OrderDetailResponse;
}

export function PublicWebsiteCard({ order }: PublicWebsiteCardProps) {
  void order;
  return null;
}
