import type { PageSpeed } from '@/modules/admin/services/visitorStatsService';

export interface PageSpeedCardProps {
  speed: PageSpeed | undefined;
}

export function PageSpeedCard({ speed }: PageSpeedCardProps) {
  void speed;
  return null;
}
